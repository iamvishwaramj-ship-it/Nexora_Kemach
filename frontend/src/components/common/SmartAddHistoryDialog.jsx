import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Table, TableHead,
  TableBody, TableRow, TableCell, TableContainer, TextField, Typography, Box, Stack,
  Checkbox, MenuItem, Select, InputAdornment, Chip, Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import BoltIcon from '@mui/icons-material/Bolt';
import AddIcon from '@mui/icons-material/Add';
import dayjs from 'dayjs';

/**
 * Formats a past date with human-readable relative time (e.g. "15 days ago (24-Feb-2026)")
 */
function formatRelativeDate(dateStr) {
  if (!dateStr) return '—';
  const d = dayjs(dateStr);
  if (!d.isValid()) return '—';
  const diffDays = dayjs().startOf('day').diff(d.startOf('day'), 'day');
  if (diffDays === 0) return `Today (${d.format('DD-MMM-YYYY')})`;
  if (diffDays === 1) return `Yesterday (${d.format('DD-MMM-YYYY')})`;
  if (diffDays < 30) return `${diffDays} days ago (${d.format('DD-MMM-YYYY')})`;
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} ${months === 1 ? 'mo' : 'mos'} ago (${d.format('DD-MMM-YYYY')})`;
  }
  return d.format('DD-MMM-YYYY');
}

/**
 * Formats an Indian currency number
 */
function formatCurrency(val) {
  const num = Number(val) || 0;
  return `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * SmartAddHistoryDialog
 * 
 * Opens a modal table of previously ordered items for the selected customer.
 * Supports:
 * - Search by item code, item name, description, HSN
 * - Multi-select checkboxes with bulk import
 * - Individual [+ Add] action per row
 * - Editable quantity prefilled with customer's last ordered quantity
 * - Auto-populated previous unit price, HSN, UOM, and Tax Rate
 */
export default function SmartAddHistoryDialog({
  open,
  onClose,
  onImport,
  customer,
  documents = [], // previous sales orders, quotations, etc.
  products = [],  // product master list
  defaultWarehouse = '',
  title = 'Smart Add — Customer Purchase History',
}) {
  const [search, setSearch] = useState('');
  const [perPage, setPerPage] = useState(25);
  const [page, setPage] = useState(0);
  const [selectedCodes, setSelectedCodes] = useState(new Set());
  const [customQuantities, setCustomQuantities] = useState({});

  // Reset search and selection on open
  useEffect(() => {
    if (open) {
      setSearch('');
      setPage(0);
      setSelectedCodes(new Set());
      setCustomQuantities({});
    }
  }, [open]);

  // Aggregate past items for this customer across all provided documents
  const historyItems = useMemo(() => {
    if (!customer) return [];
    const customerLower = String(customer).trim().toLowerCase();
    const itemMap = new Map();

    for (const doc of documents || []) {
      const docCustomer = String(doc.customer || doc.customerName || '').trim().toLowerCase();
      if (docCustomer !== customerLower) continue;

      const docDate = doc.orderDate || doc.quotationDate || doc.challanDate || doc.invoiceDate || doc.createdAt;
      const items = doc.items || [];

      for (const item of items) {
        if (!item.productCode) continue;
        const code = item.productCode;

        if (!itemMap.has(code)) {
          itemMap.set(code, {
            productCode: code,
            productName: item.productName || '',
            description: item.description || '',
            hsnCode: item.hsnCode || '',
            uom: item.uom || '',
            unitPrice: Number(item.unitPrice) || 0,
            quantity: Number(item.quantity) || 1,
            taxPercent: item.taxPercent != null ? Number(item.taxPercent) : 18,
            taxCodeId: item.taxCodeId || null,
            discountPercent: Number(item.discountPercent) || 0,
            warehouse: item.warehouse || defaultWarehouse || '',
            lastOrderDate: docDate,
            totalOrders: 1,
          });
        } else {
          const existing = itemMap.get(code);
          existing.totalOrders += 1;
          // Update to newer order details if applicable
          if (docDate && (!existing.lastOrderDate || new Date(docDate) > new Date(existing.lastOrderDate))) {
            existing.lastOrderDate = docDate;
            if (item.unitPrice != null) existing.unitPrice = Number(item.unitPrice);
            if (item.quantity != null) existing.quantity = Number(item.quantity);
            if (item.productName) existing.productName = item.productName;
            if (item.description) existing.description = item.description;
            if (item.hsnCode) existing.hsnCode = item.hsnCode;
            if (item.uom) existing.uom = item.uom;
            if (item.taxCodeId) existing.taxCodeId = item.taxCodeId;
            if (item.taxPercent != null) existing.taxPercent = Number(item.taxPercent);
            if (item.discountPercent != null) existing.discountPercent = Number(item.discountPercent);
          }
        }
      }
    }

    // Enrich missing fields from product master list
    const productByCode = new Map((products || []).map((p) => [p.productCode, p]));
    const result = Array.from(itemMap.values()).map((row) => {
      const p = productByCode.get(row.productCode);
      return {
        ...row,
        productName: row.productName || p?.productName || '',
        description: row.description || p?.description || '',
        hsnCode: row.hsnCode || p?.hsnCode || '',
        uom: row.uom || p?.uom || '',
        taxCodeId: row.taxCodeId || p?.taxCodeId || null,
        taxPercent: row.taxPercent != null ? row.taxPercent : (p?.taxPercent != null ? Number(p.taxPercent) : 18),
      };
    });

    // Sort by latest order date descending
    result.sort((a, b) => {
      const timeA = a.lastOrderDate ? new Date(a.lastOrderDate).getTime() : 0;
      const timeB = b.lastOrderDate ? new Date(b.lastOrderDate).getTime() : 0;
      return timeB - timeA;
    });

    return result;
  }, [customer, documents, products, defaultWarehouse]);

  // Filter items by search query
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return historyItems;
    return historyItems.filter((r) =>
      [r.productCode, r.productName, r.description, r.hsnCode]
        .some((val) => String(val || '').toLowerCase().includes(q))
    );
  }, [historyItems, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * perPage, safePage * perPage + perPage);

  // Toggle selection
  const handleToggleCode = (code) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  // Select all / deselect all
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selectedCodes.has(r.productCode));
  const handleToggleSelectAll = () => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visible.forEach((r) => next.delete(r.productCode));
      } else {
        visible.forEach((r) => next.add(r.productCode));
      }
      return next;
    });
  };

  // Update quantity in state
  const handleQuantityChange = (code, val) => {
    const num = Math.max(1, Number(val) || 1);
    setCustomQuantities((prev) => ({ ...prev, [code]: num }));
  };

  // Single-row import
  const handleSingleImport = (row) => {
    const qty = customQuantities[row.productCode] ?? row.quantity ?? 1;
    onImport([{ ...row, quantity: qty }]);
  };

  // Bulk import
  const handleBulkImport = () => {
    if (selectedCodes.size === 0) return;
    const chosen = historyItems
      .filter((r) => selectedCodes.has(r.productCode))
      .map((r) => ({
        ...r,
        quantity: customQuantities[r.productCode] ?? r.quantity ?? 1,
      }));
    onImport(chosen);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth disableRestoreFocus>
      <DialogTitle
        component="div"
        sx={{
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 1.5,
          borderBottom: 3,
          borderColor: 'success.main',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <BoltIcon />
          <Typography component="div" variant="h6" fontWeight={700}>
            {title} {customer ? `— ${customer}` : ''}
          </Typography>
        </Stack>
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
            placeholder="Search by code, name, description or HSN..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            sx={{ minWidth: { sm: 340 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          <Stack direction="row" alignItems="center" gap={1}>
            <Typography variant="body2" color="text.secondary">
              {historyItems.length} past item{historyItems.length === 1 ? '' : 's'} found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mx: 1 }}>•</Typography>
            <Typography variant="body2" color="text.secondary">Show</Typography>
            <Select
              size="small"
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(0);
              }}
            >
              {[10, 25, 50, 100].map((n) => (
                <MenuItem key={n} value={n}>{n}</MenuItem>
              ))}
            </Select>
            <Typography variant="body2" color="text.secondary">per page</Typography>
          </Stack>
        </Stack>

        <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1, maxHeight: 460 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow sx={{ '& th': { bgcolor: 'primary.light', color: 'primary.contrastText', fontWeight: 700, whiteSpace: 'nowrap' } }}>
                <TableCell align="center" padding="checkbox" sx={{ width: 48 }}>
                  <Checkbox
                    size="small"
                    color="default"
                    checked={allVisibleSelected}
                    indeterminate={visible.some((r) => selectedCodes.has(r.productCode)) && !allVisibleSelected}
                    onChange={handleToggleSelectAll}
                    disabled={visible.length === 0}
                    sx={{ color: 'primary.contrastText', '&.Mui-checked': { color: 'primary.contrastText' } }}
                  />
                </TableCell>
                <TableCell sx={{ minWidth: 120 }}>Product Code</TableCell>
                <TableCell sx={{ minWidth: 220 }}>Product Name / Description</TableCell>
                <TableCell sx={{ minWidth: 100 }}>HSN / UOM</TableCell>
                <TableCell sx={{ minWidth: 150 }}>Last Ordered</TableCell>
                <TableCell align="center" sx={{ minWidth: 90 }}>Frequency</TableCell>
                <TableCell align="right" sx={{ minWidth: 110 }}>Last Rate</TableCell>
                <TableCell align="center" sx={{ width: 95 }}>Order Qty</TableCell>
                <TableCell align="center" sx={{ width: 85 }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {!customer
                      ? 'Please select a customer first to view past order history.'
                      : search
                      ? `No items found matching "${search}".`
                      : `No previous purchase history found for ${customer}.`}
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((r) => {
                  const isChecked = selectedCodes.has(r.productCode);
                  const currentQty = customQuantities[r.productCode] ?? r.quantity ?? 1;

                  return (
                    <TableRow
                      key={r.productCode}
                      hover
                      selected={isChecked}
                      sx={{ cursor: 'pointer' }}
                      onClick={(e) => {
                        if (e.target.tagName === 'INPUT' || e.target.closest('button')) return;
                        handleToggleCode(r.productCode);
                      }}
                    >
                      <TableCell align="center" padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={isChecked}
                          onChange={() => handleToggleCode(r.productCode)}
                        />
                      </TableCell>

                      <TableCell sx={{ fontWeight: 600, color: 'primary.main', whiteSpace: 'nowrap' }}>
                        {r.productCode}
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{r.productName || r.productCode}</Typography>
                        {r.description && r.description !== r.productName && (
                          <Typography variant="caption" color="text.secondary" display="block" noWrap sx={{ maxWidth: 280 }}>
                            {r.description}
                          </Typography>
                        )}
                      </TableCell>

                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2">{r.hsnCode || '—'}</Typography>
                        <Typography variant="caption" color="text.secondary">{r.uom || ''}</Typography>
                      </TableCell>

                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2">{formatRelativeDate(r.lastOrderDate)}</Typography>
                      </TableCell>

                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={`${r.totalOrders}x`}
                          color={r.totalOrders > 2 ? 'primary' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>

                      <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {formatCurrency(r.unitPrice)}
                      </TableCell>

                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <TextField
                          size="small"
                          type="number"
                          value={currentQty}
                          onChange={(e) => handleQuantityChange(r.productCode, e.target.value)}
                          inputProps={{ min: 1, style: { textAlign: 'center', padding: '4px 6px', width: 45 } }}
                        />
                      </TableCell>

                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="Import single item">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<AddIcon fontSize="small" />}
                            onClick={() => handleSingleImport(r)}
                            sx={{ minWidth: 65, py: 0.25, px: 0.75, fontSize: '0.75rem' }}
                          >
                            Add
                          </Button>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {pageCount > 1 && (
          <Stack direction="row" alignItems="center" justifyContent="center" flexWrap="wrap" gap={1} sx={{ mt: 2 }}>
            <Button size="small" variant="contained" disabled={safePage === 0} onClick={() => setPage(0)}>First</Button>
            <Button size="small" variant="contained" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Previous</Button>
            <Typography variant="body2" color="text.secondary" sx={{ mx: 1 }}>
              Page {safePage + 1} of {pageCount}
            </Typography>
            <Button size="small" variant="contained" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>Next</Button>
            <Button size="small" variant="contained" disabled={safePage >= pageCount - 1} onClick={() => setPage(pageCount - 1)}>Last</Button>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mr: 'auto' }}>
          {selectedCodes.size > 0 ? (
            <strong>{selectedCodes.size} item{selectedCodes.size === 1 ? '' : 's'} selected</strong>
          ) : (
            'Select items to import into order'
          )}
        </Typography>
        <Button variant="outlined" color="inherit" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<BoltIcon />}
          onClick={handleBulkImport}
          disabled={selectedCodes.size === 0}
        >
          Import Selected ({selectedCodes.size})
        </Button>
      </DialogActions>
    </Dialog>
  );
}
