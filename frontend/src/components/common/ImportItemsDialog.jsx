import React, { useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Stack, Typography, Box,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Chip, Alert, CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { BASE_URL, ensureFreshAccessToken } from '../../store/baseApi';
import { useNotify } from '../feedback/NotificationProvider';

/**
 * "Import Items from Excel" — adds item lines to the document CURRENTLY
 * open in the create/edit form, as opposed to BulkImportDialog (which
 * creates whole new documents from the list page). Deliberately separate
 * from that component: this one never creates or saves anything itself —
 * the uploaded sheet only has to carry item-line columns (Item Code, Qty,
 * Rate, ...), never header fields like Branch/Customer/Date, because the
 * document's header is already filled in on screen. The server route behind
 * `importUrl` only PARSES the sheet and validates each row structurally
 * (a number where one is expected, a required column not left blank) — it
 * does not look anything up against Product/Tax Code/Warehouse masters,
 * because the calling page already has those masters loaded in memory and
 * is what actually resolves each row (via `onImported`), the exact same way
 * picking a product from the Item No dropdown does. That keeps a freshly
 * imported row and a hand-picked one behave identically.
 *
 * Props:
 *   open, onClose   — standard controlled-dialog pair.
 *   resourceName    — plural label used in copy, e.g. "Sales Invoice Items".
 *   templateUrl     — GET endpoint (relative to the API root) that streams
 *                     the item-only .xlsx template.
 *   importUrl       — POST endpoint (same base) that accepts the filled
 *                     workbook as multipart form data under "file" and
 *                     returns { items: [...], errors: [{ row, message }] }.
 *   onImported      — called with the parsed `items` array once a request
 *                     completes with at least one valid row. The caller
 *                     resolves each row's productCode/taxCode/warehouse
 *                     against its own masters and appends the results to
 *                     the item field array — this dialog never touches the
 *                     form itself.
 */
// Adding item lines to the form one giant array at a time is what actually
// freezes the tab on a large sheet: `append()` itself is cheap (one state
// update), but React then has to mount every new row — each with several
// controlled MUI inputs — in a SINGLE synchronous commit, and the browser
// can't paint or respond to input until that commit finishes. 500 rows is
// enough for that one commit to take seconds, which reads as "buffering".
//
// The fix is the same "binary chunking" idea you'd use for a large upload:
// split the parsed rows into small batches and hand them to the form one
// batch at a time, yielding to the browser (two rAF ticks — the first lets
// the just-committed batch actually paint, the second fires after that
// paint) between batches so it can render and stay responsive instead of
// doing all 500 rows in one blocking pass. The template download / server
// parse were never the bottleneck (that route only parses the sheet, no DB
// lookups — see the route's own comment), so nothing else needs chunking.
const IMPORT_CHUNK_SIZE = 40;

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const nextFrame = () => new Promise((resolve) => {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  } else {
    setTimeout(resolve, 16);
  }
});

export default function ImportItemsDialog({
  open,
  onClose,
  resourceName = 'Items',
  templateUrl,
  importUrl,
  onImported,
}) {
  const notify = useNotify();
  const fileInputRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [outcome, setOutcome] = useState(null); // { addedCount, errors: [{row, message}] }
  const [fileName, setFileName] = useState('');
  const [addProgress, setAddProgress] = useState(null); // { added, total } while chunking rows into the form

  const apiUrl = (path) => `${BASE_URL}/api${path}`;

  const handleClose = () => {
    if (downloading || importing) return; // don't let a click-away abandon an in-flight request silently
    setOutcome(null);
    setFileName('');
    setAddProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose?.();
  };

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    try {
      const token = await ensureFreshAccessToken();
      const res = await fetch(apiUrl(templateUrl), {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        let message = 'Could not download the template. Try again.';
        try { message = (await res.json())?.message || message; } catch { /* non-JSON error body */ }
        throw new Error(message);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${resourceName.toLowerCase().replace(/\s+/g, '-')}-template.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      notify.error(err.message || 'Could not download the template. Try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file after a failed attempt
    if (!file) return;
    setFileName(file.name);
    setOutcome(null);

    const formData = new FormData();
    formData.append('file', file);

    setImporting(true);
    try {
      const token = await ensureFreshAccessToken();
      const res = await fetch(apiUrl(importUrl), {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) {
        throw new Error(body?.message || 'Import failed. Check the file and try again.');
      }
      const items = body.items || [];
      const errors = body.errors || [];

      if (items.length > 0) {
        // Hand the rows to the form in small batches rather than all at
        // once — see the comment above IMPORT_CHUNK_SIZE. The caller's
        // onImported still gets a plain array each time (same shape as
        // before), just fewer rows per call.
        const chunks = chunkArray(items, IMPORT_CHUNK_SIZE);
        let added = 0;
        for (let i = 0; i < chunks.length; i += 1) {
          onImported?.(chunks[i]);
          added += chunks[i].length;
          setAddProgress({ added, total: items.length });
          if (i < chunks.length - 1) await nextFrame(); // let the browser paint this batch before building the next
        }
        setAddProgress(null);
      }

      setOutcome({ addedCount: items.length, errors });
    } catch (err) {
      notify.error(err.message || 'Import failed. Check the file and try again.');
    } finally {
      setImporting(false);
      setAddProgress(null);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Import {resourceName} from Excel</span>
        <IconButton size="small" onClick={handleClose} disabled={downloading || importing}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Download the template, fill in one row per item line, then upload it
            back here — the rows are added to the Item Details table below,
            alongside anything already on this document.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={downloading ? <CircularProgress size={16} /> : <DownloadIcon />}
              onClick={handleDownloadTemplate}
              disabled={downloading}
            >
              Download Template
            </Button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" hidden onChange={handleFileChosen} />
            <Button
              variant="contained"
              startIcon={importing ? <CircularProgress size={16} color="inherit" /> : <UploadFileIcon />}
              onClick={handlePickFile}
              disabled={importing}
            >
              {addProgress ? `Adding rows... ${addProgress.added}/${addProgress.total}` : importing ? 'Importing...' : 'Upload & Import'}
            </Button>
          </Stack>

          {fileName ? (
            <Typography variant="caption" color="text.secondary">Selected file: {fileName}</Typography>
          ) : null}

          {outcome ? (
            <Box>
              <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                <Chip size="small" color="success" variant="outlined" label={`${outcome.addedCount} row(s) added`} />
                <Chip
                  size="small"
                  color={outcome.errors.length ? 'error' : 'default'}
                  variant="outlined"
                  label={`${outcome.errors.length} row(s) skipped`}
                />
              </Stack>

              {outcome.addedCount === 0 && outcome.errors.length > 0 ? (
                <Alert severity="error" sx={{ mb: 1.5 }}>
                  Nothing could be added — fix the rows below and upload again.
                </Alert>
              ) : outcome.errors.length > 0 ? (
                <Alert severity="warning" sx={{ mb: 1.5 }}>
                  Some rows were skipped — see the reasons below. The rest were added to the item table.
                </Alert>
              ) : (
                <Alert severity="success" sx={{ mb: 1.5 }}>
                  All {outcome.addedCount} row(s) were added to the item table.
                </Alert>
              )}

              {outcome.errors.length > 0 && (
                <TableContainer sx={{ maxHeight: 280 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Row</TableCell>
                        <TableCell>Message</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {outcome.errors.map((e, idx) => (
                        <TableRow key={`${e.row}-${idx}`}>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{e.row}</TableCell>
                          <TableCell>{e.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={downloading || importing}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
