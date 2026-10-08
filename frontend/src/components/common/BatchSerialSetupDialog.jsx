import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Table, TableHead,
  TableBody, TableRow, TableCell, TextField, Typography, Box, Stack, Chip, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import CloseIcon from '@mui/icons-material/Close';

let rowSeq = 0;
const nextRowId = () => `row-${Date.now()}-${rowSeq++}`;

// Native <input type="date"> wants 'YYYY-MM-DD'. Values coming back from the
// API are ISO datetime strings (or already Date objects on a freshly-typed
// row); both need to collapse to that shape or the field renders blank.
function toDateInputValue(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

const emptyBatchRow = () => ({
  _rowId: nextRowId(), batchNo: '', quantity: '', batchAttribute1: '', batchAttribute2: '',
  expirationDate: '', mfrDate: '', admissionDate: '', location: '', details: '',
});
const emptySerialRow = () => ({
  _rowId: nextRowId(), serialNo: '', lotNo: '',
  expirationDate: '', mfrDate: '', admissionDate: '', mfrWarrantyStart: '', mfrWarrantyEnd: '', location: '',
});

// A row counts as "in use" once anything on it has been typed. Once it is,
// its identifying number (Batch No. / Serial No.) stops being optional — a
// row with an expiry date and a location but no serial number would
// otherwise be silently dropped on Update, quietly losing what was typed.
// A row nobody has touched yet (one of the auto-generated blanks) is left
// alone rather than flagged, since Serial mode pre-fills one per unit still
// needed and not all of them have to be used in one sitting.
function rowOtherFieldsFilled(row, isBatch) {
  const fields = isBatch
    ? [row.quantity, row.batchAttribute1, row.batchAttribute2, row.expirationDate, row.mfrDate, row.admissionDate, row.location, row.details]
    : [row.lotNo, row.expirationDate, row.mfrDate, row.admissionDate, row.mfrWarrantyStart, row.mfrWarrantyEnd, row.location];
  return fields.some((v) => v !== '' && v !== null && v !== undefined);
}

// Batch and serial numbers are unique system-wide (see the ProductBatch /
// ProductSerial schema comments), so duplicates are refused here in the
// dialog too — immediately, on the numbers visible right now, rather than
// only after Update round-trips to the server.
function computeRowIssues(rows, isBatch) {
  const issues = {};
  const rowIdsByNumber = new Map();

  rows.forEach((row) => {
    const number = (isBatch ? row.batchNo : row.serialNo || '').trim();
    if (!number) {
      if (rowOtherFieldsFilled(row, isBatch)) {
        issues[row._rowId] = isBatch ? 'Batch No. is required' : 'Serial No. is required';
      }
      return;
    }
    if (!rowIdsByNumber.has(number)) rowIdsByNumber.set(number, []);
    rowIdsByNumber.get(number).push(row._rowId);
  });

  rowIdsByNumber.forEach((rowIds) => {
    if (rowIds.length < 2) return;
    rowIds.forEach((rowId) => {
      issues[rowId] = `Duplicate ${isBatch ? 'batch' : 'serial'} number`;
    });
  });

  return issues;
}

/**
 * "Batches - Setup" / "Serial Numbers - Setup" — opened from a Purchase GRN
 * line whose product is Batch- or Serial-tracked (Product Master > Manage
 * Item By). Lets the received quantity be split across batch numbers (each
 * with its own quantity) or listed as one serial number per unit.
 *
 * Purely local state until "Update" is pressed: the parent (PurchaseGRN)
 * owns the line's actual `batches`/`serials` form value and only receives
 * the finished array back through `onSave`. Reopening the dialog re-seeds
 * from `value` every time, so cancelling never leaves stray edits behind.
 *
 * Serial mode pre-fills one blank row per unit still needed (up to
 * totalNeeded) rather than starting from a single row.
 *
 * Update is disabled while any row is missing its identifying number (once
 * something else on that row has been filled in) or repeats one already
 * used elsewhere on this line — see computeRowIssues. Open Qty being
 * nonzero does NOT block Update on its own: a line can be partially
 * allocated and revisited later. The GRN itself refuses to save while any
 * Batch/Serial-tracked line is short (see validateBatchSerialAllocation in
 * PurchaseGRN.jsx), so that gate is on the document, not on this dialog.
 */
export default function BatchSerialSetupDialog({
  open,
  onClose,
  onSave,
  mode = 'Batch',
  readOnly = false,
  docNo,
  itemNumber,
  itemDescription,
  warehouseCode,
  warehouseName,
  totalNeeded,
  value,
}) {
  const isBatch = mode === 'Batch';
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!open) return;
    const seeded = (value || []).map((r) => ({
      _rowId: nextRowId(),
      ...(isBatch
        ? { batchNo: r.batchNo || '', quantity: r.quantity ?? '' }
        : { serialNo: r.serialNo || '', lotNo: r.lotNo || '' }),
      ...(isBatch
        ? { batchAttribute1: r.batchAttribute1 || '', batchAttribute2: r.batchAttribute2 || '', details: r.details || '' }
        : { mfrWarrantyStart: toDateInputValue(r.mfrWarrantyStart), mfrWarrantyEnd: toDateInputValue(r.mfrWarrantyEnd) }),
      expirationDate: toDateInputValue(r.expirationDate),
      mfrDate: toDateInputValue(r.mfrDate),
      admissionDate: toDateInputValue(r.admissionDate),
      location: r.location || '',
    }));
    // Serial rows are one-per-unit, so a fresh (or partially-filled) line
    // starts with a ready row for every unit still needed rather than one
    // blank row someone has to duplicate by hand.
    const needed = Number(totalNeeded) || 0;
    const padded = !isBatch && !readOnly
      ? [...seeded, ...Array.from({ length: Math.max(0, needed - seeded.length) }, emptySerialRow)]
      : seeded;
    setRows(padded.length ? padded : [isBatch ? emptyBatchRow() : emptySerialRow()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value, isBatch]);

  const issues = useMemo(() => computeRowIssues(rows, isBatch), [rows, isBatch]);
  const issueCount = Object.keys(issues).length;

  const totalCreated = isBatch
    ? rows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)
    : rows.filter((r) => (r.serialNo || '').trim()).length;
  const openQty = Math.round(((Number(totalNeeded) || 0) - totalCreated) * 1000) / 1000;

  const updateRow = (rowId, patch) => setRows((prev) => prev.map((r) => (r._rowId === rowId ? { ...r, ...patch } : r)));
  const addRow = () => setRows((prev) => [...prev, isBatch ? emptyBatchRow() : emptySerialRow()]);
  const removeRow = (rowId) => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r._rowId !== rowId) : prev));

  const handleUpdate = () => {
    if (issueCount) return;
    const cleaned = rows
      .filter((r) => (isBatch ? (r.batchNo || '').trim() : (r.serialNo || '').trim()))
      .map(({ _rowId, ...r }) => ({
        ...r,
        ...(isBatch ? { quantity: Number(r.quantity) || 0 } : {}),
        expirationDate: r.expirationDate || null,
        mfrDate: r.mfrDate || null,
        admissionDate: r.admissionDate || null,
        ...(isBatch ? {} : {
          mfrWarrantyStart: r.mfrWarrantyStart || null,
          mfrWarrantyEnd: r.mfrWarrantyEnd || null,
        }),
      }));
    onSave(cleaned);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {isBatch ? 'Batches - Setup' : 'Serial Numbers - Setup'}
        <IconButton size="small" onClick={onClose} aria-label="close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Rows from Documents</Typography>
        <Box sx={{ overflowX: 'auto', mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Doc. No.</TableCell>
                <TableCell>Item Number</TableCell>
                <TableCell>Item Description</TableCell>
                <TableCell>Whse Code</TableCell>
                <TableCell>Whse Name</TableCell>
                <TableCell align="right">Total Needed</TableCell>
                <TableCell align="right">Total Created</TableCell>
                <TableCell align="right">Open Qty</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>{docNo || 'New'}</TableCell>
                <TableCell>{itemNumber || '—'}</TableCell>
                <TableCell>{itemDescription || '—'}</TableCell>
                <TableCell>{warehouseCode || '—'}</TableCell>
                <TableCell>{warehouseName || '—'}</TableCell>
                <TableCell align="right">{totalNeeded}</TableCell>
                <TableCell align="right">{totalCreated}</TableCell>
                <TableCell align="right">
                  <Chip size="small" label={openQty} color={openQty === 0 ? 'success' : 'warning'} variant="outlined" />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>

        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            {isBatch ? 'Created Batches' : 'Created Serial Numbers'}
          </Typography>
          {!readOnly && (
            <Button size="small" startIcon={<AddIcon />} onClick={addRow}>Add Row</Button>
          )}
        </Stack>

        {!readOnly && issueCount > 0 && (
          <Alert severity="error" sx={{ mb: 1.5 }}>
            {issueCount === 1 ? '1 row needs attention before Update.' : `${issueCount} rows need attention before Update.`}
          </Alert>
        )}

        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={40}>#</TableCell>
                {isBatch ? (
                  <>
                    <TableCell sx={{ minWidth: 170 }}>Batch *</TableCell>
                    <TableCell sx={{ minWidth: 100 }}>Qty</TableCell>
                    <TableCell sx={{ minWidth: 140 }}>Batch Attribute 1</TableCell>
                    <TableCell sx={{ minWidth: 140 }}>Batch Attribute 2</TableCell>
                    <TableCell sx={{ minWidth: 170 }}>Expiration Date</TableCell>
                    <TableCell sx={{ minWidth: 170 }}>Mfr Date</TableCell>
                    <TableCell sx={{ minWidth: 170 }}>Admission Date</TableCell>
                    <TableCell sx={{ minWidth: 160 }}>Location</TableCell>
                    <TableCell sx={{ minWidth: 200 }}>Details</TableCell>
                  </>
                ) : (
                  <>
                    <TableCell sx={{ minWidth: 170 }}>Serial No *</TableCell>
                    <TableCell sx={{ minWidth: 130 }}>Lot No</TableCell>
                    <TableCell sx={{ minWidth: 170 }}>Expiration Date</TableCell>
                    <TableCell sx={{ minWidth: 170 }}>Mfr Date</TableCell>
                    <TableCell sx={{ minWidth: 170 }}>Admission Date</TableCell>
                    <TableCell sx={{ minWidth: 190 }}>Mfr Warranty Start</TableCell>
                    <TableCell sx={{ minWidth: 190 }}>Mfr Warranty End</TableCell>
                    <TableCell sx={{ minWidth: 160 }}>Location</TableCell>
                  </>
                )}
                {!readOnly && <TableCell width={48} />}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, index) => {
                const issue = issues[row._rowId];
                return (
                  <TableRow key={row._rowId}>
                    <TableCell>{index + 1}</TableCell>
                    {isBatch ? (
                      <>
                        <TableCell>
                          <TextField
                            size="small" fullWidth disabled={readOnly}
                            value={row.batchNo} onChange={(e) => updateRow(row._rowId, { batchNo: e.target.value })}
                            error={!!issue} helperText={issue || ''}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" type="number" fullWidth disabled={readOnly} value={row.quantity} onChange={(e) => updateRow(row._rowId, { quantity: e.target.value })} />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" fullWidth disabled={readOnly} value={row.batchAttribute1} onChange={(e) => updateRow(row._rowId, { batchAttribute1: e.target.value })} />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" fullWidth disabled={readOnly} value={row.batchAttribute2} onChange={(e) => updateRow(row._rowId, { batchAttribute2: e.target.value })} />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" type="date" fullWidth disabled={readOnly} InputLabelProps={{ shrink: true }} value={row.expirationDate} onChange={(e) => updateRow(row._rowId, { expirationDate: e.target.value })} />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" type="date" fullWidth disabled={readOnly} InputLabelProps={{ shrink: true }} value={row.mfrDate} onChange={(e) => updateRow(row._rowId, { mfrDate: e.target.value })} />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" type="date" fullWidth disabled={readOnly} InputLabelProps={{ shrink: true }} value={row.admissionDate} onChange={(e) => updateRow(row._rowId, { admissionDate: e.target.value })} />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" fullWidth disabled={readOnly} value={row.location} onChange={(e) => updateRow(row._rowId, { location: e.target.value })} />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" fullWidth disabled={readOnly} value={row.details} onChange={(e) => updateRow(row._rowId, { details: e.target.value })} />
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>
                          <TextField
                            size="small" fullWidth disabled={readOnly}
                            placeholder="Serial No" value={row.serialNo} onChange={(e) => updateRow(row._rowId, { serialNo: e.target.value })}
                            error={!!issue} helperText={issue || ''}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" fullWidth disabled={readOnly} placeholder="Lot No" value={row.lotNo} onChange={(e) => updateRow(row._rowId, { lotNo: e.target.value })} />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" type="date" fullWidth disabled={readOnly} InputLabelProps={{ shrink: true }} value={row.expirationDate} onChange={(e) => updateRow(row._rowId, { expirationDate: e.target.value })} />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" type="date" fullWidth disabled={readOnly} InputLabelProps={{ shrink: true }} value={row.mfrDate} onChange={(e) => updateRow(row._rowId, { mfrDate: e.target.value })} />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" type="date" fullWidth disabled={readOnly} InputLabelProps={{ shrink: true }} value={row.admissionDate} onChange={(e) => updateRow(row._rowId, { admissionDate: e.target.value })} />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" type="date" fullWidth disabled={readOnly} InputLabelProps={{ shrink: true }} value={row.mfrWarrantyStart} onChange={(e) => updateRow(row._rowId, { mfrWarrantyStart: e.target.value })} />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" type="date" fullWidth disabled={readOnly} InputLabelProps={{ shrink: true }} value={row.mfrWarrantyEnd} onChange={(e) => updateRow(row._rowId, { mfrWarrantyEnd: e.target.value })} />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" fullWidth disabled={readOnly} placeholder="Location" value={row.location} onChange={(e) => updateRow(row._rowId, { location: e.target.value })} />
                        </TableCell>
                      </>
                    )}
                    {!readOnly && (
                      <TableCell>
                        <IconButton size="small" color="error" onClick={() => removeRow(row._rowId)} disabled={rows.length <= 1} aria-label="remove row">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
          Total Created : {totalCreated}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        {!readOnly && (
          <Button onClick={handleUpdate} variant="contained" disabled={issueCount > 0}>Update</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
