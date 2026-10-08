import React, { useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Stack, Typography, Box,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Chip, Alert, CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import { BASE_URL, ensureFreshAccessToken } from '../../store/baseApi';
import { useNotify } from '../feedback/NotificationProvider';

// Two different response shapes exist across this app's import endpoints, so
// the dialog normalizes both into one structure rather than forcing either
// side to change:
//
//   A) The bulk DOCUMENT imports (Sales Order, Purchase Invoice, ...) return
//      explicit per-row results: { results: [{ row, status, message }], ... }.
//
//   B) The MASTER imports (Employee Master, Opening Balance, Chart of
//      Accounts) return counters plus a flat list of "Row N: reason" strings:
//      { created, updated, skipped, total, errors: [...] }. Only failures are
//      itemised there, so the parsed rows are errors-only — `failuresOnly`
//      flags that, and the UI says so instead of implying the successful rows
//      were simply left out of the table.
//
// Shape A is detected first and passes through untouched, so every existing
// caller keeps exactly the behaviour it had before shape B was supported.
function normalizeImportResponse(body) {
  if (Array.isArray(body?.results)) {
    const results = body.results;
    return {
      results,
      successCount: body.successCount ?? results.filter((r) => r.status === 'success').length,
      errorCount: body.errorCount ?? results.filter((r) => r.status !== 'success').length,
      total: body.total ?? results.length,
      failuresOnly: false,
    };
  }

  const errors = Array.isArray(body?.errors) ? body.errors : [];
  const successCount = (body?.created ?? 0) + (body?.updated ?? 0);
  const errorCount = body?.skipped ?? errors.length;
  return {
    results: errors.map((text) => {
      // "Row 12: branch "X" was not found..." -> { row: '12', message: '...' }
      const match = /^\s*Row\s+(\d+)\s*:\s*([\s\S]*)$/i.exec(String(text));
      return match
        ? { row: match[1], status: 'error', message: match[2].trim() }
        : { row: '—', status: 'error', message: String(text) };
    }),
    successCount,
    errorCount,
    total: body?.total ?? successCount + errorCount,
    failuresOnly: true,
  };
}

/**
 * Generic "Bulk Excel Import" dialog — Sales Invoice's List page is the
 * first user, but this has nothing Sales-Invoice-specific in it on purpose:
 * the same 12-document rollout this feature is meant to grow into (Sales
 * Order/Quotation/Delivery Challan/Return/Credit Memo, and the six Purchase
 * documents) can reuse this exact component just by pointing it at that
 * document's own template/import endpoints. Master screens (Employee Master)
 * reuse it too — see normalizeImportResponse above.
 *
 * Deliberately built on a plain authenticated `fetch` rather than an
 * injected RTK Query endpoint: a reusable dialog that only knows a resource
 * by its URL strings can't also know that resource's tag type to invalidate,
 * so it stays decoupled from baseApi.js entirely and leaves refreshing the
 * calling page's list to `onImported` (typically that page's own list
 * query's `refetch()`).
 *
 * Props:
 *   open, onClose       — standard controlled-dialog pair.
 *   resourceName        — plural label used in copy, e.g. "Sales Invoices".
 *   templateUrl          — GET endpoint (relative to the API root, e.g.
 *                          "/sales/invoices/bulk-import/template") that
 *                          streams the .xlsx template.
 *   importUrl           — POST endpoint (same base) that accepts the filled
 *                          workbook as multipart form data under "file" and
 *                          returns { results: [{ row, status, message }] }.
 *   onImported          — called once after an import request completes
 *                          successfully (even if some/all rows failed) so
 *                          the caller can refetch its list.
 */
export default function BulkImportDialog({
  open,
  onClose,
  resourceName = 'Records',
  templateUrl,
  importUrl,
  onImported,
  // The default copy describes a multi-line DOCUMENT sheet (one row per item
  // line). A master sheet is one row per record, so those screens pass their
  // own wording rather than instructing people to repeat header columns that
  // don't exist on their template.
  description = 'Download the template, fill in one row per item line (repeat the header columns for every line of the same document, and reset Row No to 1 to start the next one), then upload it back here.',
  // Heading of the results table's first column — "Document" for the bulk
  // document imports, "Row" for a master sheet where each line is a record.
  rowLabel = 'Document',
}) {
  const notify = useNotify();

  const fileInputRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null); // { results, successCount, errorCount, total }
  const [fileName, setFileName] = useState('');

  const apiUrl = (path) => `${BASE_URL}/api${path}`;

  const handleClose = () => {
    if (downloading || importing) return; // don't let a click-away abandon an in-flight request silently
    setResults(null);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose?.();
  };

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    try {
      // ensureFreshAccessToken refreshes first if the token in Redux is
      // already expired/about to be -- this fetch bypasses baseApi entirely
      // so it never gets that treatment otherwise (see the doc comment on
      // ensureFreshAccessToken itself for why that used to 401 outright).
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
      a.download = `${resourceName.toLowerCase().replace(/\s+/g, '-')}-bulk-import-template.xlsx`;
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
    setResults(null);

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
      const normalized = normalizeImportResponse(body);
      setResults(normalized);
      // Read the refetch trigger off the NORMALIZED counts: a counter-style
      // response carries no `successCount` of its own, so keying off the raw
      // body here meant a master import that actually saved rows never
      // refreshed the list behind the dialog.
      if (normalized.successCount > 0) onImported?.();
    } catch (err) {
      notify.error(err.message || 'Import failed. Check the file and try again.');
    } finally {
      setImporting(false);
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
            {description}
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
              {importing ? 'Importing...' : 'Upload & Import'}
            </Button>
          </Stack>

          {fileName ? (
            <Typography variant="caption" color="text.secondary">Selected file: {fileName}</Typography>
          ) : null}

          {results ? (
            <Box>
              <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                <Chip
                  size="small"
                  color="success"
                  variant="outlined"
                  icon={<CheckCircleOutlineIcon />}
                  label={`${results.successCount} succeeded`}
                />
                <Chip
                  size="small"
                  color={results.errorCount ? 'error' : 'default'}
                  variant="outlined"
                  icon={<HighlightOffIcon />}
                  label={`${results.errorCount} failed`}
                />
                <Chip size="small" variant="outlined" label={`${results.total} total`} />
              </Stack>

              {results.errorCount > 0 && results.successCount === 0 ? (
                <Alert severity="error" sx={{ mb: 1.5 }}>
                  Nothing was imported — fix the rows below and upload again.
                </Alert>
              ) : results.errorCount > 0 ? (
                <Alert severity="warning" sx={{ mb: 1.5 }}>
                  {results.successCount} row(s) were saved. {results.errorCount} could not be —
                  see the reasons below.
                </Alert>
              ) : (
                <Alert severity="success" sx={{ mb: 1.5 }}>
                  All {results.successCount} row(s) were imported.
                </Alert>
              )}

              {/* A counter-style response itemises only what failed, so say
                  that outright rather than leaving someone to wonder why the
                  rows that worked aren't listed. */}
              {results.failuresOnly && results.errorCount > 0 && results.successCount > 0 ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Only the rows that failed are listed below.
                </Typography>
              ) : null}

              {results.results.length > 0 ? (
              <TableContainer sx={{ maxHeight: 320 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{rowLabel}</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Message</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {results.results.map((r, idx) => (
                      <TableRow key={`${r.row}-${idx}`}>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.row}</TableCell>
                        <TableCell>
                          {r.status === 'success' ? (
                            <Chip size="small" color="success" label="Success" />
                          ) : (
                            <Chip size="small" color="error" label="Error" />
                          )}
                        </TableCell>
                        <TableCell>{r.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              ) : null}
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
