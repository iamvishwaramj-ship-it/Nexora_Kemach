import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Table, TableHead,
  TableBody, TableRow, TableCell, TableContainer, TextField, Typography, Box, Stack,
  Radio, MenuItem, Select, InputAdornment,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import dayjs from 'dayjs';

/**
 * The "Find <document>" picker behind every Copy From button — "Find Purchase
 * Quotation" on the Purchase Order form, "Find Purchase Order" on the GRN
 * form, "Find Sales Enquiry" on the Sales Quotation form, and so on down both
 * chains.
 *
 * Copy From only enables once the trading party is chosen, and this list is
 * scoped to that one party: the question it answers is "which of THIS party's
 * documents am I carrying forward", not "show me every document in the
 * system". Which field holds that party differs by chain — `supplier` on
 * purchase documents, `customer` or `customerName` on sales ones — so it is
 * named by `partyField`. Picking a row and pressing Choose hands the whole
 * source record back through `onChoose`; the calling page owns the actual
 * field-filling, because what maps onto what differs per document pair.
 *
 * Selection is single-row on purpose. A target document copies from exactly
 * one source (its reference field and its lines' baseNo are single values), so
 * a control that permitted two would be lying about what the form can accept.
 *
 * `columns` describes the table, so a caller can present its own document's
 * vocabulary — "Quotation No / Valid Until" vs "Order No / Order Date":
 *   { field, headerName, type: 'date' | 'text' }
 * The first column's field doubles as the fallback row key when a record has
 * no id.
 */
export default function CopyFromDocumentDialog({
  open,
  onClose,
  onChoose,
  documents = [],
  // The trading party whose documents this lists, and the field on each record
  // that holds it. `party` empty means nothing has been picked yet — the list
  // shows the "select a party first" message rather than every record in the
  // system, since an unfiltered list is exactly what this control exists to
  // avoid.
  party,
  partyField = 'supplier',
  partyLabel = 'supplier',
  title = 'Find Document',
  columns = [],
  searchFields,
  emptyMessage,
}) {
  const [search, setSearch] = useState('');
  const [perPage, setPerPage] = useState(50);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState(null);

  const keyField = columns[0]?.field;

  // Every open starts clean. Carrying the previous search and selection over
  // is how someone ends up copying from a record they highlighted minutes ago
  // for a different supplier and never re-checked.
  useEffect(() => {
    if (open) {
      setSearch('');
      setPage(0);
      setSelectedId(null);
    }
  }, [open]);

  const forParty = useMemo(
    () => (documents || []).filter((d) => !party || d[partyField] === party),
    [documents, party, partyField]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return forParty;
    const fields = searchFields || columns.map((c) => c.field);
    return forParty.filter((r) => fields.some((f) => String(r[f] ?? '').toLowerCase().includes(q)));
  }, [forParty, search, searchFields, columns]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * perPage, safePage * perPage + perPage);

  const rowKey = (r) => r.id ?? r[keyField];
  const chosen = filtered.find((r) => rowKey(r) === selectedId);

  const renderCell = (row, col) => {
    const raw = row[col.field];
    if (col.type === 'date') return raw ? dayjs(raw).format('DD-MMM-YYYY') : '—';
    if (col.type === 'optional') return raw || '';
    return raw || '—';
  };

  const handleChoose = () => {
    if (!chosen) return;
    onChoose(chosen);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth disableRestoreFocus>
      <DialogTitle
      component="div"
        sx={{
          bgcolor: 'primary.main', color: 'primary.contrastText',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          py: 1.5, borderBottom: 3, borderColor: 'success.main',
        }}
      >
        <Typography component="div" variant="h6" fontWeight={700}>{title}</Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: 'inherit' }} aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          gap={1.5}
          sx={{ mb: 2 }}
        >
          <TextField
            size="small"
            placeholder="Search..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            sx={{ minWidth: { sm: 320 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
              ),
            }}
          />
          <Stack direction="row" alignItems="center" gap={1}>
            <Typography variant="body2" color="text.secondary">Show</Typography>
            <Select
              size="small"
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value)); setPage(0); }}
            >
              {[10, 25, 50, 100].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
            </Select>
            <Typography variant="body2" color="text.secondary">per page</Typography>
          </Stack>
        </Stack>

        <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow sx={{ '& th': { bgcolor: 'primary.light', color: 'primary.contrastText', fontWeight: 700, whiteSpace: 'nowrap' } }}>
                <TableCell align="center">Choose</TableCell>
                {columns.map((c) => <TableCell key={c.field}>{c.headerName}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {party
                      ? (emptyMessage ? `${emptyMessage} ${party}.` : `Nothing found for ${party}.`)
                      : `Select a ${partyLabel} first.`}
                  </TableCell>
                </TableRow>
              ) : visible.map((r) => {
                const rid = rowKey(r);
                return (
                  <TableRow
                    key={rid}
                    hover
                    selected={selectedId === rid}
                    onClick={() => setSelectedId(rid)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell align="center" padding="checkbox">
                      <Radio size="small" checked={selectedId === rid} onChange={() => setSelectedId(rid)} />
                    </TableCell>
                    {columns.map((c) => (
                      <TableCell key={c.field} sx={c.type === 'date' || c.nowrap ? { whiteSpace: 'nowrap' } : undefined}>
                        {renderCell(r, c)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        <Stack direction="row" alignItems="center" justifyContent="center" flexWrap="wrap" gap={1} sx={{ mt: 2 }}>
          <Button size="small" variant="contained" disabled={safePage === 0} onClick={() => setPage(0)}>First</Button>
          <Button size="small" variant="contained" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Previous</Button>
          <Typography variant="body2" color="text.secondary" sx={{ mx: 1 }}>
            Page {safePage + 1} of {pageCount}
          </Typography>
          <Button size="small" variant="contained" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>Next</Button>
          <Button size="small" variant="contained" disabled={safePage >= pageCount - 1} onClick={() => setPage(pageCount - 1)}>Last</Button>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" onClick={handleChoose} disabled={!chosen}>Choose</Button>
        <Button variant="contained" color="error" onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
