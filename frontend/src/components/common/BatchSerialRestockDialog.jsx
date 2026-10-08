import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Table, TableHead,
  TableBody, TableRow, TableCell, TextField, Typography, Box, Stack, Chip, Alert, Checkbox,
  LinearProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useGetRestockableBatchesQuery, useGetRestockableSerialsQuery } from '../../features/resources';

function toDateInputValue(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/**
 * "Restock" — opened from a Sales Return or Sales Credit Memo line whose
 * product is Batch- or Serial-tracked (Product Master > Manage Item By).
 *
 * Visually modelled on BatchSerialSelectionDialog (the issue-side "...
 * Selection" dialog), but runs in the opposite direction: instead of
 * decrementing stock already on hand, it puts a previously-issued
 * batch/serial number BACK into stock. The numbers themselves are never
 * created here — a returned batch/serial already exists (it was created at
 * original receipt via Purchase GRN/Stock Receipt's "... Setup" dialog), and
 * batchNo/serialNo are globally unique, so this can only pick an EXISTING
 * number to restock, never type a new one — which is what distinguishes this
 * from BatchSerialSetupDialog even though both dialogs "add" stock.
 *
 * Data source: batches/serials currently OUT (see
 * useGetRestockableBatchesQuery/useGetRestockableSerialsQuery — serials are
 * scoped server-side to status=Issued; batches have no per-row "issued" flag,
 * so every batch of the product is offered).
 *
 * Purely local state until "Update" is pressed — the parent owns the line's
 * actual `batchAllocations`/`serialAllocations` form value and only receives
 * the finished array back through `onSave`. Reopening re-seeds from `value`.
 */
export default function BatchSerialRestockDialog({
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
  productCode,
}) {
  const isBatch = mode === 'Batch';
  const needed = Number(totalNeeded) || 0;

  const [selectedBatches, setSelectedBatches] = useState([]);
  const [selectedSerials, setSelectedSerials] = useState([]);
  const [checkedAvailable, setCheckedAvailable] = useState(new Set());

  useEffect(() => {
    if (!open) return;
    if (isBatch) {
      setSelectedBatches((value || []).filter((r) => r.batchNo).map((r) => ({ batchNo: r.batchNo, quantity: Number(r.quantity) || 0 })));
    } else {
      setSelectedSerials((value || []).filter((r) => r.serialNo).map((r) => ({ serialNo: r.serialNo })));
    }
    setCheckedAvailable(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value, isBatch]);

  const { data: restockableBatches, isFetching: batchesFetching } = useGetRestockableBatchesQuery(
    { productCode, warehouse: warehouseCode },
    { skip: !open || !isBatch || !productCode, refetchOnMountOrArgChange: true }
  );
  const { data: restockableSerials, isFetching: serialsFetching } = useGetRestockableSerialsQuery(
    { productCode, warehouse: warehouseCode },
    { skip: !open || isBatch || !productCode, refetchOnMountOrArgChange: true }
  );

  const batchRows = useMemo(() => (restockableBatches || []).map((b) => ({
    batchNo: b.batchNo,
    quantity: Number(b.quantity) || 0,
    expirationDate: b.expirationDate,
    mfrDate: b.mfrDate,
    location: b.location,
  })), [restockableBatches]);

  // A serial this line already has selected (from `value`) but which the
  // server no longer lists as Issued (e.g. it was restocked by this same
  // line in a prior, unsaved edit) still needs to appear, or it silently
  // vanishes from the picker.
  const serialRows = useMemo(() => {
    const rows = [...(restockableSerials || [])];
    (selectedSerials || []).forEach((s) => {
      if (!rows.some((r) => r.serialNo === s.serialNo)) rows.push(s);
    });
    return rows;
  }, [restockableSerials, selectedSerials]);

  const selectedBatchQtyByNo = useMemo(
    () => new Map(selectedBatches.map((r) => [r.batchNo, r.quantity])),
    [selectedBatches]
  );
  const totalSelected = isBatch
    ? selectedBatches.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)
    : selectedSerials.length;
  const openQty = Math.round((needed - totalSelected) * 1000) / 1000;

  const setBatchQty = (batchNo, qty) => {
    const clamped = Math.max(0, Number(qty) || 0);
    setSelectedBatches((prev) => {
      const withoutThis = prev.filter((r) => r.batchNo !== batchNo);
      return clamped > 0 ? [...withoutThis, { batchNo, quantity: clamped }] : withoutThis;
    });
  };
  const removeBatch = (batchNo) => setSelectedBatches((prev) => prev.filter((r) => r.batchNo !== batchNo));
  const clearSelectedBatches = () => setSelectedBatches([]);

  const remainingSlots = Math.max(0, needed - selectedSerials.length - checkedAvailable.size);
  const toggleChecked = (serialNo) => setCheckedAvailable((prev) => {
    const next = new Set(prev);
    if (next.has(serialNo)) {
      next.delete(serialNo);
    } else {
      if (remainingSlots <= 0) return prev;
      next.add(serialNo);
    }
    return next;
  });
  const addChecked = () => {
    const already = new Set(selectedSerials.map((s) => s.serialNo));
    const toAdd = [...checkedAvailable].filter((no) => !already.has(no)).map((serialNo) => ({ serialNo }));
    setSelectedSerials((prev) => [...prev, ...toAdd]);
    setCheckedAvailable(new Set());
  };
  const removeSerial = (serialNo) => setSelectedSerials((prev) => prev.filter((s) => s.serialNo !== serialNo));
  const pickableSerials = useMemo(
    () => serialRows.filter((r) => !selectedSerials.some((s) => s.serialNo === r.serialNo)),
    [serialRows, selectedSerials]
  );

  const handleUpdate = () => {
    onSave(isBatch ? selectedBatches : selectedSerials);
    onClose();
  };

  const fetching = isBatch ? batchesFetching : serialsFetching;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {isBatch ? 'Batches - Restock' : 'Serial Numbers - Restock'}
        <IconButton size="small" onClick={onClose} aria-label="close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      {fetching && <LinearProgress />}

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
                <TableCell align="right">Needed</TableCell>
                <TableCell align="right">Selected</TableCell>
                <TableCell align="right">Open</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>{docNo || 'New'}</TableCell>
                <TableCell>{itemNumber || '—'}</TableCell>
                <TableCell>{itemDescription || '—'}</TableCell>
                <TableCell>{warehouseCode || '—'}</TableCell>
                <TableCell>{warehouseName || '—'}</TableCell>
                <TableCell align="right">{needed}</TableCell>
                <TableCell align="right">{totalSelected}</TableCell>
                <TableCell align="right">
                  <Chip size="small" label={Math.max(0, openQty)} color={openQty <= 0 ? 'success' : 'warning'} variant="outlined" />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>

        {!productCode && (
          <Alert severity="warning" sx={{ mb: 2 }}>Select a product on this line first.</Alert>
        )}

        {isBatch ? (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={700}>Existing Batches</Typography>
                {!readOnly && (
                  <Button size="small" color="inherit" onClick={clearSelectedBatches} disabled={!selectedBatches.length}>
                    Clear
                  </Button>
                )}
              </Stack>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ minWidth: 150 }}>Batch</TableCell>
                      <TableCell align="right" sx={{ minWidth: 90 }}>In Stock</TableCell>
                      <TableCell align="right" sx={{ minWidth: 130 }}>Restock Qty</TableCell>
                      <TableCell sx={{ minWidth: 140 }}>Expiry</TableCell>
                      <TableCell sx={{ minWidth: 140 }}>Mfr Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {batchRows.map((row) => {
                      const selectedQty = selectedBatchQtyByNo.get(row.batchNo) || 0;
                      return (
                        <TableRow key={row.batchNo}>
                          <TableCell>{row.batchNo}</TableCell>
                          <TableCell align="right">{row.quantity}</TableCell>
                          <TableCell align="right">
                            <TextField
                              size="small" type="number" disabled={readOnly}
                              inputProps={{ min: 0, style: { textAlign: 'right' } }}
                              sx={{ width: 100 }}
                              value={selectedQty || ''}
                              onChange={(e) => setBatchQty(row.batchNo, e.target.value)}
                            />
                          </TableCell>
                          <TableCell>{toDateInputValue(row.expirationDate) || '—'}</TableCell>
                          <TableCell>{toDateInputValue(row.mfrDate) || '—'}</TableCell>
                        </TableRow>
                      );
                    })}
                    {!batchRows.length && (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                            {productCode ? 'No existing batches for this product' : 'No product selected'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Box>
            </Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Selected For Restock</Typography>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Batch</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      {!readOnly && <TableCell width={48} />}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedBatches.map((row) => (
                      <TableRow key={row.batchNo}>
                        <TableCell>{row.batchNo}</TableCell>
                        <TableCell align="right">{row.quantity}</TableCell>
                        {!readOnly && (
                          <TableCell>
                            <IconButton size="small" color="error" onClick={() => removeBatch(row.batchNo)} aria-label="remove batch">
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {!selectedBatches.length && (
                      <TableRow>
                        <TableCell colSpan={3}>
                          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>No batches selected</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Box>
            </Box>
          </Stack>
        ) : (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={700}>Serial Numbers Currently Issued</Typography>
                {!readOnly && (
                  <Typography variant="caption" color="text.secondary">
                    {remainingSlots > 0 ? `Pick up to ${remainingSlots} more` : 'Needed quantity reached'}
                  </Typography>
                )}
              </Stack>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {!readOnly && <TableCell width={40} />}
                      <TableCell sx={{ minWidth: 150 }}>Serial No</TableCell>
                      <TableCell sx={{ minWidth: 120 }}>Lot No</TableCell>
                      <TableCell sx={{ minWidth: 140 }}>Mfr Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pickableSerials.map((row) => {
                      const isChecked = checkedAvailable.has(row.serialNo);
                      return (
                      <TableRow key={row.serialNo} hover>
                        {!readOnly && (
                          <TableCell padding="checkbox">
                            <Checkbox
                              size="small"
                              checked={isChecked}
                              disabled={!isChecked && remainingSlots <= 0}
                              onChange={() => toggleChecked(row.serialNo)}
                            />
                          </TableCell>
                        )}
                        <TableCell>{row.serialNo}</TableCell>
                        <TableCell>{row.lotNo || '—'}</TableCell>
                        <TableCell>{toDateInputValue(row.mfrDate) || '—'}</TableCell>
                      </TableRow>
                      );
                    })}
                    {!pickableSerials.length && (
                      <TableRow>
                        <TableCell colSpan={4}>
                          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                            {productCode ? 'No serial numbers currently issued' : 'No product selected'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Box>
            </Box>

            {!readOnly && (
              <Stack alignItems="center" justifyContent="center" sx={{ pt: { xs: 0, md: 6 } }}>
                <IconButton onClick={addChecked} disabled={!checkedAvailable.size} color="primary" sx={{ border: '1px solid', borderColor: 'divider' }}>
                  <ChevronRightIcon />
                </IconButton>
              </Stack>
            )}

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Selected For Restock</Typography>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ minWidth: 150 }}>Serial No</TableCell>
                      {!readOnly && <TableCell width={48} />}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedSerials.map((row) => (
                      <TableRow key={row.serialNo}>
                        <TableCell>{row.serialNo}</TableCell>
                        {!readOnly && (
                          <TableCell>
                            <IconButton size="small" color="error" onClick={() => removeSerial(row.serialNo)} aria-label="remove serial">
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {!selectedSerials.length && (
                      <TableRow>
                        <TableCell colSpan={2}>
                          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                            <HourglassEmptyIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                            No serial numbers selected
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Box>
            </Box>
          </Stack>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
          Total Selected : {totalSelected}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        {!readOnly && (
          <Button onClick={handleUpdate} variant="contained">Update</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
