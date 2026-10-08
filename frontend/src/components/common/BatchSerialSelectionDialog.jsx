import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Table, TableHead,
  TableBody, TableRow, TableCell, TextField, Typography, Box, Stack, Alert, Checkbox,
  LinearProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import BoltIcon from '@mui/icons-material/Bolt';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useGetAvailableBatchesQuery, useGetAvailableSerialsQuery } from '../../features/resources';

function toDateInputValue(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/**
 * "Batches Number - Selection" / "Serial Numbers - Selection" — opened from
 * a Delivery Challan or Stock Issue line whose product is Batch- or
 * Serial-tracked (Product Master > Manage Item By).
 *
 * The counterpart to BatchSerialSetupDialog: that dialog CREATES new batch/
 * serial numbers on a receipt; this one SELECTS existing ones to cover an
 * issue's quantity, drawing from whatever ProductBatch/ProductSerial rows
 * are currently in stock (see GET /product-batches?available=true and
 * GET /product-serials?status=In%20Stock).
 *
 * Purely local state until "Update" is pressed — the parent owns the line's
 * actual `batchAllocations`/`serialAllocations` form value and only receives
 * the finished array back through `onSave`. Reopening re-seeds from `value`.
 *
 * A batch/serial this line already holds (from `value`, seeded when the
 * dialog opens) is added back into what's shown as "available" — the number
 * the server returns already has this line's own prior save subtracted from
 * it, exactly as assertBatchSerialAvailability adds it back server-side
 * before validating an update.
 */
export default function BatchSerialSelectionDialog({
  open,
  onClose,
  onSave,
  mode = 'Batch',
  readOnly = false,
  // docNo/itemNumber/itemDescription/warehouseName were only ever displayed
  // in the "Rows from Documents" summary row, now removed — every caller
  // still passes them, which is harmless, so the props stay accepted here
  // rather than touching every call site just to drop them.
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

  // Frozen at dialog-open time — this is what the line already had reserved
  // before this session's edits, which is what gets added back to the
  // server's "available" figure for display. Re-computing it from `selected`
  // as the user edits would double count.
  const [ownedBatchQty, setOwnedBatchQty] = useState(new Map());
  const [ownedSerials, setOwnedSerials] = useState(new Map());
  const [selectedBatches, setSelectedBatches] = useState([]);
  const [selectedSerials, setSelectedSerials] = useState([]);
  const [checkedAvailable, setCheckedAvailable] = useState(new Set());

  useEffect(() => {
    if (!open) return;
    if (isBatch) {
      const owned = new Map();
      (value || []).forEach((r) => {
        if (!r.batchNo) return;
        owned.set(r.batchNo, (owned.get(r.batchNo) || 0) + (Number(r.quantity) || 0));
      });
      setOwnedBatchQty(owned);
      setSelectedBatches((value || []).filter((r) => r.batchNo).map((r) => ({ batchNo: r.batchNo, quantity: Number(r.quantity) || 0 })));
    } else {
      const owned = new Map((value || []).filter((r) => r.serialNo).map((r) => [r.serialNo, r]));
      setOwnedSerials(owned);
      setSelectedSerials((value || []).filter((r) => r.serialNo).map((r) => ({ serialNo: r.serialNo })));
    }
    setCheckedAvailable(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value, isBatch]);

  const { data: availableBatches, isFetching: batchesFetching } = useGetAvailableBatchesQuery(
    { productCode, warehouse: warehouseCode },
    { skip: !open || !isBatch || !productCode || !warehouseCode, refetchOnMountOrArgChange: true }
  );
  const { data: availableSerials, isFetching: serialsFetching } = useGetAvailableSerialsQuery(
    { productCode, warehouse: warehouseCode },
    { skip: !open || isBatch || !productCode || !warehouseCode, refetchOnMountOrArgChange: true }
  );

  // Diagnostic only: when the chosen warehouse holds no batch of this item,
  // look the same item up across ALL warehouses so the dialog can say where
  // the stock really is (a different warehouse, or a batch row with no
  // warehouse recorded) instead of just "No batches available". Skipped
  // unless the warehouse-scoped lookup has finished and come back empty.
  const warehouseScopedEmpty = open && isBatch && !!productCode && !!warehouseCode
    && !batchesFetching && Array.isArray(availableBatches) && availableBatches.length === 0;
  const { data: batchesAnywhere } = useGetAvailableBatchesQuery(
    { productCode },
    { skip: !warehouseScopedEmpty, refetchOnMountOrArgChange: true }
  );
  const batchesElsewhere = useMemo(() => {
    if (!warehouseScopedEmpty) return [];
    const byWarehouse = new Map();
    (batchesAnywhere || []).forEach((b) => {
      const key = b.warehouse || '';
      byWarehouse.set(key, (byWarehouse.get(key) || 0) + (Number(b.quantity) || 0));
    });
    return [...byWarehouse.entries()].map(([warehouse, quantity]) => ({ warehouse, quantity }));
  }, [warehouseScopedEmpty, batchesAnywhere]);

  // Available Qty shown per batch = what the server says is currently free,
  // plus whatever this same line already had reserved before this dialog
  // session started (ownedBatchQty) — see the component doc comment above.
  const batchRows = useMemo(() => {
    const rows = (availableBatches || []).map((b) => ({
      batchNo: b.batchNo,
      available: (Number(b.quantity) || 0) + (ownedBatchQty.get(b.batchNo) || 0),
      expirationDate: b.expirationDate,
      mfrDate: b.mfrDate,
      location: b.location,
    }));
    // A batch this line owns but the server no longer lists (fully consumed
    // by everything else, so `available=true` excludes it) still needs to
    // appear — otherwise a fully-reserved batch this line is holding
    // vanishes from the picker entirely.
    ownedBatchQty.forEach((qty, batchNo) => {
      if (!rows.some((r) => r.batchNo === batchNo)) {
        rows.push({ batchNo, available: qty, expirationDate: null, mfrDate: null, location: null });
      }
    });
    return rows;
  }, [availableBatches, ownedBatchQty]);

  // Same idea for serials: the "In Stock" pool from the server plus
  // whichever of this line's own serials are currently 'Issued' (held by
  // this same document), so they still show up to pick from/keep.
  const serialRows = useMemo(() => {
    const rows = [...(availableSerials || [])];
    ownedSerials.forEach((row, serialNo) => {
      if (!rows.some((r) => r.serialNo === serialNo)) rows.push(row);
    });
    return rows;
  }, [availableSerials, ownedSerials]);

  const selectedBatchQtyByNo = useMemo(
    () => new Map(selectedBatches.map((r) => [r.batchNo, r.quantity])),
    [selectedBatches]
  );
  const totalSelected = isBatch
    ? selectedBatches.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)
    : selectedSerials.length;
  const openQty = Math.round((needed - totalSelected) * 1000) / 1000;

  const setBatchQty = (batchNo, qty, maxAvailable) => {
    const clamped = Math.max(0, Math.min(Number(qty) || 0, maxAvailable));
    setSelectedBatches((prev) => {
      const withoutThis = prev.filter((r) => r.batchNo !== batchNo);
      return clamped > 0 ? [...withoutThis, { batchNo, quantity: clamped }] : withoutThis;
    });
  };
  const removeBatch = (batchNo) => setSelectedBatches((prev) => prev.filter((r) => r.batchNo !== batchNo));

  // Fills batches top-down (server already sorts earliest-expiry-first, so
  // this doubles as FEFO) until Open Qty reaches zero or the pool runs out.
  // Each batch is taken only up to exactly what's still needed, so the
  // total selected never overshoots the requested quantity.
  const allocateRemaining = () => {
    let remaining = Math.max(0, needed - totalSelected);
    if (remaining <= 0) return;
    setSelectedBatches((prev) => {
      const byNo = new Map(prev.map((r) => [r.batchNo, r.quantity]));
      for (const row of batchRows) {
        if (remaining <= 0) break;
        const already = byNo.get(row.batchNo) || 0;
        const room = row.available - already;
        if (room <= 0) continue;
        const take = Math.min(room, remaining);
        byNo.set(row.batchNo, already + take);
        remaining -= take;
      }
      return [...byNo.entries()].filter(([, qty]) => qty > 0).map(([batchNo, quantity]) => ({ batchNo, quantity }));
    });
  };
  const clearSelectedBatches = () => setSelectedBatches([]);

  // A serial can only be ticked while doing so keeps the total at or under
  // Needed — unticking is always allowed, but a line asking for 1 unit
  // cannot have 9 boxes checked at once. addChecked() then moves exactly
  // what's ticked across, so Selected never runs past Needed either.
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
        {isBatch ? 'Batches Number - Selection' : 'Serial Numbers - Selection'}
        <IconButton size="small" onClick={onClose} aria-label="close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      {fetching && <LinearProgress />}

      <DialogContent dividers>
        {!productCode && (
          <Alert severity="warning" sx={{ mb: 2 }}>Select a product on this line first.</Alert>
        )}

        {!!productCode && !warehouseCode && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Select the From Warehouse on the document first — only batches/serials held in that warehouse can be selected.
          </Alert>
        )}

        {isBatch && warehouseScopedEmpty && batchesElsewhere.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {`No batch of this item is in warehouse ${warehouseName || warehouseCode}. Batches with stock exist in: `}
            {batchesElsewhere
              .map((b) => `${b.warehouse || 'no warehouse recorded'} (${b.quantity})`)
              .join(', ')}
            {'. Pick the From Whse that holds the stock, or correct the batch\'s warehouse.'}
          </Alert>
        )}
        {isBatch && warehouseScopedEmpty && batchesAnywhere && batchesElsewhere.length === 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {`This item has no batch with stock in any warehouse, including ${warehouseName || warehouseCode}.`}
          </Alert>
        )}

        {isBatch ? (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={700}>Available Batches</Typography>
                {!readOnly && (
                  <Stack direction="row" spacing={1}>
                    <Button size="small" startIcon={<BoltIcon fontSize="small" />} onClick={allocateRemaining} disabled={openQty <= 0}>
                      Auto Allocate
                    </Button>
                    <Button size="small" color="inherit" onClick={clearSelectedBatches} disabled={!selectedBatches.length}>
                      Clear
                    </Button>
                  </Stack>
                )}
              </Stack>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ minWidth: 150 }}>Batch</TableCell>
                      <TableCell align="right" sx={{ minWidth: 90 }}>Available</TableCell>
                      <TableCell align="right" sx={{ minWidth: 110 }}>Selected</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {batchRows.map((row) => {
                      const selectedQty = selectedBatchQtyByNo.get(row.batchNo) || 0;
                      // What's left to pick from this batch — the server's
                      // own total, minus whatever this dialog session has
                      // already put into Selected Batches for it, so ticking
                      // a batch up visibly draws its balance down instead of
                      // leaving Available looking unchanged.
                      const remainingAvailable = Math.max(0, row.available - selectedQty);
                      return (
                        <TableRow key={row.batchNo}>
                          <TableCell>{row.batchNo}</TableCell>
                          <TableCell align="right">{remainingAvailable}</TableCell>
                          <TableCell align="right">
                            <TextField
                              size="small" type="number" disabled={readOnly}
                              inputProps={{ min: 0, max: row.available, style: { textAlign: 'right' } }}
                              sx={{ width: 90 }}
                              value={selectedQty || ''}
                              onChange={(e) => setBatchQty(row.batchNo, e.target.value, row.available)}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!batchRows.length && (
                      <TableRow>
                        <TableCell colSpan={3}>
                          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                            {productCode ? 'No batches available' : 'No product selected'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Box>
            </Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Selected Batches</Typography>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Batch</TableCell>
                      <TableCell align="right">Selected</TableCell>
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
                <Typography variant="subtitle2" fontWeight={700}>Available Serial Numbers</Typography>
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
                            {productCode ? 'No serial numbers available' : 'No product selected'}
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
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Selected Serial Numbers</Typography>
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
