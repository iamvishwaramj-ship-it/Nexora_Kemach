import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Stack, TextField, InputAdornment, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, Menu, MenuItem,
  ListItemIcon, ListItemText, Checkbox, Autocomplete, Popover, Grid, Tooltip, Collapse,
} from '@mui/material';
import { useFieldArray } from 'react-hook-form';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import EventIcon from '@mui/icons-material/Event';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import WarehouseCodeSelect from '../../components/form/WarehouseCodeSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
import DocumentSeriesNoField from '../../components/form/DocumentSeriesNoField';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import FilterAutocomplete from '../../components/data-display/FilterAutocomplete';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import MobileItemCard from '../../components/data-display/MobileItemCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import useDragScroll from '../../components/data-display/useDragScroll';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { itemTableSx } from '../../lib/columnWidth';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { stockAdjustmentSchema, ADJUSTMENT_TYPE_OPTIONS, ITEM_ADJUSTMENT_TYPE_OPTIONS, STOCK_ADJUSTMENT_STATUS_OPTIONS } from '../../lib/validation/inventorySchemas';
import { stockAdjustmentApi, productApi } from '../../features/resources';
import { useBranchNameOptions } from '../../lib/useBranchOptions';
import { productOptionsFor, PRODUCT_USAGE } from '../../lib/productUsage';
import { useWarehouseOptions, warehouseLabel as formatWarehouseLabel, warehouseCodesForBranch } from '../../lib/useWarehouseOptions';
import { useWarehouseStock } from '../../lib/useWarehouseStock';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer, { dragScrollbarSx } from '../../components/data-display/ScrollableTableContainer';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import { canDelete } from '../../config/deleteConfig';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';
const emptyItem = {
  productCode: '', productName: '', hsnCode: '', batchNo: '', expiryDate: null, warehouse: '', uom: '',
  currentStock: 0, itemAdjustmentType: 'Increase', quantity: '', reason: '', unitPrice: 0,
};

// Per-row Warehouse dropdown, scoped to the selected Branch, mirroring
// StockTransfer.jsx's warehouseOptionsForBranch — both the header Warehouse
// and every item row's own Warehouse read from the same branch-scoped list.
function warehouseOptionsForBranch(warehouses, branchName, currentValue) {
  const rows = (warehouses || [])
    .filter((w) => w.status === 'Active' && (!branchName || w.branch === branchName))
    .slice()
    .sort((a, b) => String(a.whsCode || '').localeCompare(String(b.whsCode || ''), undefined, { numeric: true }));
  // code/name feed WarehouseCodeSelect's Code | Name list rows.
  const out = rows.map((w) => ({ label: formatWarehouseLabel(w), value: w.whsCode, code: w.whsCode, name: w.whsName || '' }));
  const current = currentValue == null ? '' : String(currentValue);
  if (current !== '' && !out.some((o) => o.value === current)) {
    const known = (warehouses || []).find((w) => w.whsCode === current);
    out.unshift({
      label: known ? formatWarehouseLabel(known) : `${current} (not in Warehouse Master)`,
      value: current,
      code: current,
      name: known ? (known.whsName || '') : 'Not in Warehouse Master',
    });
  }
  return out;
}

function getEmptyValues() {
  return {
    adjustmentNo: '', seriesId: '', branch: '', adjustmentType: 'Increase', date: new Date(), postingDate: new Date(),
    referenceNo: '', warehouse: '', reason: '', attachmentName: '', remarks: '', status: 'Draft',
    items: [{ ...emptyItem }],
  };
}

// Mirrors the backend's toStockAdjustmentItemData/computeStockAdjustmentTotals
// exactly — each item's adjustment value is its signed quantity (increase is
// positive, decrease is negative) costed at the product's unit price, so a
// decrease reduces the total and an increase raises it.
function computeTotals(items) {
  const amount = (items || []).reduce((sum, i) => {
    const qty = Number(i.quantity) || 0;
    const signed = i.itemAdjustmentType === 'Decrease' ? -qty : qty;
    return sum + signed * (Number(i.unitPrice) || 0);
  }, 0);
  return { amount };
}

function rowToFormValues(row) {
  return {
    adjustmentNo: row.adjustmentNo, seriesId: '', branch: row.branch || '', adjustmentType: row.adjustmentType || 'Increase',
    date: row.date, postingDate: row.postingDate, referenceNo: row.referenceNo || '',
    warehouse: row.warehouse || '', reason: row.reason || '', attachmentName: row.attachmentName || '',
    remarks: row.remarks || '', status: row.status || 'Draft',
    items: (row.items && row.items.length ? row.items : [{ ...emptyItem }]).map((i) => ({
      productCode: i.productCode || '', productName: i.productName || '', hsnCode: i.hsnCode || '',
      batchNo: i.batchNo || '', expiryDate: i.expiryDate || null,
      // A line saved before per-row Warehouse existed has no warehouse of its
      // own — fall back to the document's header Warehouse so an old row is
      // never forced blank/invalid the moment this field became mandatory.
      warehouse: i.warehouse || row.warehouse || '',
      uom: i.uom || '',
      currentStock: i.systemQuantity != null ? Number(i.systemQuantity) : 0,
      itemAdjustmentType: i.itemAdjustmentType || 'Increase',
      quantity: i.quantity != null ? Number(i.quantity) : 0,
      reason: i.reason || '',
      unitPrice: i.unitPrice != null ? Number(i.unitPrice) : 0,
    })),
  };
}

const PAGE_SIZE = 10;
const STATUS_FILTERS = ['All Status', ...STOCK_ADJUSTMENT_STATUS_OPTIONS];
const ADJUSTMENT_TYPE_FILTERS = ['All Types', ...ADJUSTMENT_TYPE_OPTIONS];

const STATUS_COLORS = { Draft: 'default', Posted: 'success', Cancelled: 'error' };

const STOCK_ADJUSTMENT_LIST_TABLE_ROW_HEIGHT = 0;
const STOCK_ADJUSTMENT_LIST_TABLE_CELL_PADDING_Y = 6;
export default function StockAdjustment() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const itemScrollRef = useDragScroll();
  const { data: adjustments, isLoading } = stockAdjustmentApi.useList();
  const { data: products } = productApi.useList();
  const [create, { isLoading: creating }] = stockAdjustmentApi.useCreate();
  const [update, { isLoading: updating }] = stockAdjustmentApi.useUpdate();
  const [remove] = stockAdjustmentApi.useDelete();

  // View toggles between the adjustment list and the full-page Create/Edit
  // form — same page, no dialog/popup, per the standard CRUD page template.
  const [view, setView] = useState('list');
  const [editingRow, setEditingRow] = useState(null);
  const { options: branchOptions } = useBranchNameOptions({ currentValue: editingRow?.branch });

  // Only products flagged for the inventory flow on Product Master are offered
  // here — see lib/productUsage.js. `products` itself stays unfiltered below,
  // because the line lookups (price, tax, UOM, batch/serial mode) must still
  // resolve a product this document already names even if it has since been
  // re-flagged; passing the saved lines' codes as `keepCodes` is what keeps
  // reopening an existing document from silently blanking its own rows.
  // productOptionsFor filters/maps the whole product master and the two
  // maps below turn it into Select options, all of which depended only on
  // `products` and the row being edited — but ran again on every render of
  // this page, including every keystroke in the form below, handing each
  // line's Autocomplete a brand-new options array identity each time.
  // Memoized on exactly those two inputs; the output is identical to
  // calling productOptionsFor directly. Same shape as the already-proven
  // version in PurchaseGRN.jsx (which keys off the form's live lines
  // instead, because there the codes can change without editingRow doing).
  const selectableProducts = useMemo(
    () => productOptionsFor(
      products,
      PRODUCT_USAGE.INVENTORY,
      (editingRow?.items || []).map((i) => i.productCode)
    ),
    [products, editingRow]
  );
  const productCodeOptions = useMemo(
    () => selectableProducts.map((p) => ({ label: p.productCode, value: p.productCode })),
    [selectableProducts]
  );
  const productNameOptions = useMemo(
    () => selectableProducts.map((p) => ({ label: p.productName, value: p.productCode })),
    [selectableProducts]
  );

  // Warehouses come from the Warehouse Master, like every other warehouse
  // dropdown in the app now — see lib/useWarehouseOptions.js. This list used to
  // be the literal string 'Main Warehouse' plus every BRANCH name, which are
  // not warehouses at all, so a warehouse picked here could never be filtered
  // for in a stock report.
  //
  // The record's stored value is passed in because documents saved under that
  // old list hold values no warehouse matches. Without it the select would
  // render blank on those documents and the next save would rewrite a posted
  // movement's warehouse to null.
  const { options: allWarehouseOptions, warehouses } = useWarehouseOptions({ currentValue: editingRow?.warehouse });
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [warehouseFilter, setWarehouseFilter] = useState(null);
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [dateAnchor, setDateAnchor] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [checkedIds, setCheckedIds] = useState([]);
  const [rowMenuAnchor, setRowMenuAnchor] = useState(null);
  const [rowMenuTarget, setRowMenuTarget] = useState(null);
  const pendingStatusRef = useRef('Draft');

  const rows = adjustments || [];

  const baseTableRows = useMemo(() => {
    const q = '';
    return rows.filter((r) => {
      const matchesSearch = !q || [r.adjustmentNo, r.referenceNo].some((v) => String(v || '').toLowerCase().includes(q));
      const matchesType = typeFilter === 'All Types' || r.adjustmentType === typeFilter;
      const matchesStatus = statusFilter === 'All Status' || r.status === statusFilter;
      const matchesWarehouse = !warehouseFilter || r.warehouse === warehouseFilter.value;
      const ad = r.date ? dayjs(r.date) : null;
      const matchesFrom = !dateFrom || (ad && !ad.isBefore(dateFrom, 'day'));
      const matchesTo = !dateTo || (ad && !ad.isAfter(dateTo, 'day'));
      return matchesSearch && matchesType && matchesStatus && matchesWarehouse && matchesFrom && matchesTo;
    });
  }, [rows, typeFilter, statusFilter, warehouseFilter, dateFrom, dateTo]);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'id', headerName: 'Select', filter: false, searchable: false },
    { field: 'adjustmentNo', headerName: 'Adjustment No.', filter: 'text' },
    { field: 'adjustmentType', headerName: 'Adjustment Type', filter: 'text' },
    { field: 'date', headerName: 'Adjustment Date', filter: 'dateRange', sortValue: (row) => (row.date ? new Date(row.date).getTime() : null) },
    { field: 'warehouse', headerName: 'Warehouse', filter: 'text' },
    { field: 'referenceNo', headerName: 'Reference No.', filter: 'text' },
    { field: 'amount', headerName: 'Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.amount == null || row.amount === '' ? null : Number(row.amount)) },
    { field: 'status', headerName: 'Status', filter: 'select' },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const filteredRows = table.rows;

  const pagedRows = useMemo(
    () => filteredRows.slice(page * pageSize, page * pageSize + pageSize),
    [filteredRows, page, pageSize]
  );

  const openCreate = () => {
    setEditingRow(null);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    setView('form');
  };

  const backToList = () => {
    setView('list');
    setEditingRow(null);
    setReadOnly(false);
  };

  const handleView = (row) => {
    setEditingRow(row);
    setReadOnly(true);
    setFormKey((k) => k + 1);
    setView('form');
  };

  const handleEdit = (row) => {
    setEditingRow(row);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    setView('form');
    setRowMenuAnchor(null);
  };

  const handlePrint = (row) => {
    setRowMenuAnchor(null);
    handleView(row);
    setTimeout(() => window.print(), 300);
  };

  const handleDelete = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Delete stock adjustment',
      message: `Are you sure you want to delete "${row.adjustmentNo}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Stock adjustment deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const removeSelected = async () => {
    const ok = await confirmDialog({
      title: 'Delete selected adjustments',
      message: `Delete ${checkedIds.length} selected adjustment${checkedIds.length > 1 ? 's' : ''}? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await Promise.all(checkedIds.map((id) => remove(id).unwrap()));
      notify.success('Selected adjustments deleted');
      setCheckedIds([]);
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    const payload = { ...values, status: pendingStatusRef.current };
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Stock adjustment updated');
      } else {
        await create(payload).unwrap();
        notify.success('Stock adjustment saved');
      }
      backToList();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  const dateRangeLabel = dateFrom && dateTo
    ? `${dateFrom.format('DD/MM/YYYY')} - ${dateTo.format('DD/MM/YYYY')}`
    : 'Select date range';

  return (
    <Box>

      {view === 'form' ? (
        <AppForm
          key={formKey}
          schema={stockAdjustmentSchema}
          defaultValues={editingRow ? rowToFormValues(editingRow) : getEmptyValues()}
          onSubmit={handleSubmit}
        >
          {(methods) => {
            const { control, watch, setValue } = methods;
            const { fields, append, remove: removeItem } = useFieldArray({ control, name: 'items' });
            const watchedItems = watch('items') || [];

            // Every column of this item table is sized to show its values IN FULL —
            // no ellipsis, no wrapping, no hover, however long the text is. The
            // spec below is positional: it mirrors the header row top to bottom,
            // and `null` leaves a column (the # counter, the action column) at
            // whatever width it already has. See itemTableSx in lib/columnWidth.js.
            const itemColumnsSx = itemTableSx(watchedItems, [
              null,
              { header: 'Item No *', get: (i) => i?.productCode, field: 'select' },
              { header: 'Description', get: (i) => i?.productName, field: 'select' },
              { header: 'Batch No.', get: (i) => i?.batchNo, field: 'text' },
              { header: 'Expiry Date', get: () => 'MM/DD/YYYY', field: 'text' },
              { header: 'Warehouse *', get: (i) => i?.warehouse, field: 'select' },
              { header: 'Unit *', get: (i) => i?.uom, field: 'text' },
              { header: 'Current Stock', get: (i) => i?.currentStock, field: 'text' },
              { header: 'Adjustment Type *', get: (i) => i?.itemAdjustmentType, field: 'select' },
              { header: 'Quantity *', get: (i) => i?.quantity, field: 'text' },
              { header: 'Reason', get: (i) => i?.reason, field: 'text' },
              null,
            ]);
            const totals = computeTotals(watchedItems);
            const branch = watch('branch');

            // Once Branch is picked, the Warehouse dropdown is scoped to
            // that branch's warehouses only — see useWarehouseOptions.js.
            // Shared by the header Warehouse AND every item row's own
            // Warehouse (see warehouseOptionsForBranch above), same as
            // StockTransfer.jsx.
            const branchWarehouseOptions = useMemo(
              () => warehouseOptionsForBranch(warehouses, branch, editingRow?.warehouse),
              [warehouses, branch]
            );

            // Tracks, per Decrease-type row (keyed by field.id so it survives
            // index shifts from add/remove), whether that line's Quantity
            // exceeds live available stock in its own selected Warehouse —
            // computed by AvailableStockCell below via useWarehouseStock.
            // Increase lines add stock and are never checked. No static zod
            // rule can express this (it needs a live server fetch), so it is
            // component state that gates the Save buttons instead, mirroring
            // the codebase's established "field error computed outside the
            // static schema" idiom (see ContactPersonDialog in
            // BusinessPartner.jsx for the plain-state precedent).
            const [stockErrors, setStockErrors] = useState({});
            const handleStockErrorChange = React.useCallback((fieldId, hasError) => {
              setStockErrors((prev) => {
                if (!!prev[fieldId] === hasError) return prev;
                const next = { ...prev, [fieldId]: hasError };
                if (!hasError) delete next[fieldId];
                return next;
              });
            }, []);
            const hasStockError = Object.keys(stockErrors).length > 0;

            const handleFile = (file) => {
              if (file) setValue('attachmentName', file.name, { shouldValidate: true });
            };

            // Switching Branch invalidates a Warehouse choice that doesn't
            // belong to the new branch. Skipped on the very first render so
            // loading an existing record for edit/view doesn't wipe a value
            // it just loaded.
            const prevBranchRef = useRef(branch);
            useEffect(() => {
              if (prevBranchRef.current === branch) return;
              prevBranchRef.current = branch;
              const allowed = warehouseCodesForBranch(warehouses, branch);
              if (watch('warehouse') && !allowed.has(watch('warehouse'))) setValue('warehouse', '');
              (watch('items') || []).forEach((it, idx) => {
                if (it.warehouse && !allowed.has(it.warehouse)) setValue(`items.${idx}.warehouse`, '');
              });
              // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [branch]);

            return (
              // minWidth: 0 is required — fieldsets default to min-width: min-content,
              // which lets the wide item table blow out the page width on mobile.
              // The Back to List / Cancel buttons are kept outside the fieldset(s)
              // so they stay clickable in read-only (view) mode -- a native
              // <fieldset disabled> disables every descendant control, buttons
              // included.
              <>
                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight={700}>
                        {readOnly ? 'Adjustment Details (View Only)' : 'Adjustment Details'}
                      </Typography>
                      <Button type="button" variant="outlined" color="inherit" startIcon={<ArrowBackIcon />} onClick={backToList}>
                        Back to List
                      </Button>
                    </Stack>

                    <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
                      <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                        {/* The document number leads the form, so the field identifying the
                          record is the first thing read on it. */}
                        <LabeledField label="Branch *">
                          <FormSelect name="branch" label="" placeholder="Select branch" options={branchOptions} />
                        </LabeledField>
                        <LabeledField label="Adjustment No. *">
                          <DocumentSeriesNoField documentCode="ADJ" seriesFieldName="seriesId" numberFieldName="adjustmentNo" isCreate={!editingRow} />
                        </LabeledField>
                        <LabeledField label="Adjustment Type *">
                          <FormSelect name="adjustmentType" label="" options={ADJUSTMENT_TYPE_OPTIONS.map((t) => ({ label: t, value: t }))} />
                        </LabeledField>
                        <LabeledField label="Adjustment Date *">
                          <FormDatePicker name="date" label="" />
                        </LabeledField>

                        <LabeledField label="Reference No.">
                          <FormTextField name="referenceNo" label="" placeholder="Enter reference number" />
                        </LabeledField>
                        <LabeledField label="Posting Date *">
                          <FormDatePicker name="postingDate" label="" />
                        </LabeledField>
                        <LabeledField label="Warehouse *">
                          <FormSelect
                            name="warehouse"
                            label=""
                            placeholder={branch ? 'Select warehouse' : 'Select a branch first'}
                            options={branchWarehouseOptions}
                            disabled={!branch}
                          />
                        </LabeledField>


                        <LabeledField label="Notes">
                          <FormTextField name="reason" label="" placeholder="Enter any Notes (optional)" multiline rows={2} />
                        </LabeledField>
                        <LabeledField label="Attach Document">
                          <Box>
                            <Button component="label" variant="outlined" size="small">
                              Choose File
                              <input type="file" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
                            </Button>
                            {watch('attachmentName') && (
                              <Chip
                                sx={{ ml: 1.5 }}
                                size="small"
                                label={watch('attachmentName')}
                                onDelete={() => setValue('attachmentName', '')}
                              />
                            )}
                          </Box>
                        </LabeledField>
                      </FormGrid>
                    </fieldset>
                  </CardContent>
                </Card>

                <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
                  <Card variant="outlined" sx={{ mb: 2 }}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight={700}>Item Details</Typography>
                        <Button type="button" variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => append({ ...emptyItem, warehouse: watch('warehouse') })}>
                          Add Item
                        </Button>
                      </Stack>

                      {isMobile ? (
                        <Box>
                          {fields.map((field, index) => {
                            const qty = Number(watch(`items.${index}.quantity`)) || 0;
                            const type = watch(`items.${index}.itemAdjustmentType`) || 'Increase';
                            const signed = type === 'Decrease' ? -qty : qty;
                            return (
                              <MobileItemCard
                                key={field.id}
                                index={index}
                                amount={signed.toFixed(2)}
                                onRemove={() => removeItem(index)}
                                removeDisabled={fields.length <= 1}
                              >
                                <ProductCell index={index} methods={methods} options={productCodeOptions} products={products} label="Item No *" placeholder="Select product code" />
                                <ProductCell index={index} methods={methods} options={productNameOptions} products={products} label="Description" placeholder="Select product name" />
                                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 1.5, rowGap: 1.5 }}>
                                  <FormTextField name={`items.${index}.batchNo`} label="Batch No." placeholder="Batch No." />
                                  <FormDatePicker name={`items.${index}.expiryDate`} label="Expiry Date" />
                                  <WarehouseCodeSelect
                                    name={`items.${index}.warehouse`}
                                    label="Warehouse *"
                                    placeholder={branch ? 'Select' : 'Select branch first'}
                                    options={branchWarehouseOptions}
                                    disabled={!branch}
                                  />
                                  <FormTextField name={`items.${index}.uom`} label="Unit *" placeholder="Unit" />
                                  <FormTextField name={`items.${index}.currentStock`} label="Current Stock" type="number" />
                                  <FormSelect name={`items.${index}.itemAdjustmentType`} label="Adjustment Type *" options={ITEM_ADJUSTMENT_TYPE_OPTIONS.map((t) => ({ label: t, value: t }))} />
                                  <FormTextField name={`items.${index}.quantity`} label="Quantity *" type="number" />
                                  <Box sx={{ gridColumn: '1 / -1' }}>
                                    <AvailableStockCell index={index} methods={methods} fieldId={field.id} onErrorChange={handleStockErrorChange} products={products} />
                                  </Box>
                                  <Box sx={{ gridColumn: '1 / -1' }}>
                                    <FormTextField name={`items.${index}.reason`} label="Reason" placeholder="Enter reason" />
                                  </Box>
                                </Box>
                              </MobileItemCard>
                            );
                          })}
                        </Box>
                      ) : (
                        <TableContainer ref={itemScrollRef} sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', cursor: 'grab', ...dragScrollbarSx }}>
                          <Table size="small" sx={[itemColumnsSx, { '& tbody .MuiFormHelperText-root:not(.Mui-error)': { display: 'none' } }]}>
                            <TableHead>
                              <TableRow>
                                <TableCell width={40}>#</TableCell>
                                <TableCell>Item No *</TableCell>
                                <TableCell>Description</TableCell>
                                <TableCell>Batch No.</TableCell>
                                <TableCell>Expiry Date</TableCell>
                                <TableCell>Warehouse *</TableCell>
                                <TableCell>Unit *</TableCell>
                                <TableCell>Current Stock</TableCell>
                                {/* Same sizing problem as Deposit Entry: the Autocomplete's clear and
                                dropdown buttons take ~56px, so 150 left room for about
                                five characters and clipped "Increase"/"Decrease". */}
                                <TableCell>Adjustment Type *</TableCell>
                                <TableCell>Quantity *</TableCell>
                                <TableCell>Reason</TableCell>
                                <TableCell width={48}>Action</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {fields.map((field, index) => {
                                return (
                                  <TableRow key={field.id} sx={{ '& > td': { verticalAlign: 'middle' } }}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>
                                      <ProductCell index={index} methods={methods} options={productCodeOptions} products={products} placeholder="Select product code" sx={{ minWidth: 200 }} />
                                    </TableCell>
                                    <TableCell>
                                      <ProductCell index={index} methods={methods} options={productNameOptions} products={products} placeholder="Select product name" sx={{ minWidth: 240 }} />
                                    </TableCell>
                                    <TableCell>
                                      <FormTextField name={`items.${index}.batchNo`} label="" placeholder="Batch No." />
                                    </TableCell>
                                    <TableCell>
                                      <FormDatePicker name={`items.${index}.expiryDate`} label="" />
                                    </TableCell>
                                    <TableCell>
                                      <WarehouseCodeSelect
                                        name={`items.${index}.warehouse`}
                                        label=""
                                        placeholder={branch ? 'Select' : 'Select branch first'}
                                        options={branchWarehouseOptions}
                                        disabled={!branch}
                                        sx={{ minWidth: 150 }}
                                        popupFitContent
                                        showNameBelow={false}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <FormTextField name={`items.${index}.uom`} label="" placeholder="Unit" />
                                    </TableCell>
                                    <TableCell>
                                      <FormTextField name={`items.${index}.currentStock`} label="" type="number" />
                                    </TableCell>
                                    <TableCell>
                                      <FormSelect name={`items.${index}.itemAdjustmentType`} label="" options={ITEM_ADJUSTMENT_TYPE_OPTIONS.map((t) => ({ label: t, value: t }))} />
                                    </TableCell>
                                    <TableCell>
                                      <FormTextField name={`items.${index}.quantity`} label="" type="number" />
                                      <AvailableStockCell index={index} methods={methods} fieldId={field.id} onErrorChange={handleStockErrorChange} products={products} />
                                    </TableCell>
                                    <TableCell>
                                      <FormTextField name={`items.${index}.reason`} label="" placeholder="Reason" />
                                    </TableCell>
                                    <TableCell>
                                      <IconButton
                                        type="button"
                                        size="small"
                                        color="error"
                                        onClick={() => removeItem(index)}
                                        disabled={fields.length <= 1}
                                        aria-label="remove item"
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}
                    </CardContent>
                  </Card>
                </fieldset>

                <Card variant="outlined">
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={7}>
                          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Remarks</Typography>
                          <FormTextField name="remarks" label="" placeholder="Enter any remarks (optional)" multiline rows={5} />
                        </Grid>

                        <Grid item xs={12} md={5}>
                          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <Typography variant="body2" color="text.secondary">Total Adjustment Value (₹)</Typography>
                            <Typography variant="h5" fontWeight={700} color={totals.amount < 0 ? 'error.main' : totals.amount > 0 ? 'success.main' : 'text.primary'}>
                              {totals.amount < 0 ? '-' : ''}₹{Math.abs(totals.amount).toFixed(2)}
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </fieldset>

                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1.5}
                      justifyContent={{ xs: 'stretch', sm: 'flex-end' }}
                      sx={{ mt: 3 }}
                    >
                      <Button fullWidth={isMobile} type="button" variant="outlined" color="inherit" startIcon={<CloseIcon />} onClick={backToList} disabled={creating || updating}>
                        Cancel
                      </Button>
                      {!readOnly && (
                        <>
                          <FormSubmitButton
                            fullWidth={isMobile}
                            variant="outlined"
                            onClick={() => { pendingStatusRef.current = 'Draft'; }}
                            disabled={creating || updating || hasStockError}
                          >
                            Save as Draft
                          </FormSubmitButton>
                          <FormSubmitButton
                            fullWidth={isMobile}
                            onClick={() => { pendingStatusRef.current = 'Posted'; }}
                            disabled={creating || updating || hasStockError}
                          >
                            {editingRow ? 'Update Adjustment' : 'Save & Post Adjustment'}
                          </FormSubmitButton>
                        </>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </>
            );
          }}
        </AppForm>
      ) : (
        <Card variant="outlined">
          <CardContent sx={{ p: 0 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              justifyContent="space-between"
              flexWrap="wrap"
              gap={1.5}
              sx={{ px: { xs: 2, sm: 3 }, pt: 2.5, pb: 1.5 }}
            >
              <Typography variant="subtitle1" fontWeight={700}>Stock Adjustment List</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap sx={{ width: { xs: '100%', sm: 'auto' } }}>
                <TableSearchFilter table={table} placeholder="Search by adjustment no., reference no..." showFilter={false} />
                <Stack direction="row" spacing={1.5}>
                  <Button size="small" variant="outlined" color="inherit" startIcon={<FilterListIcon />} onClick={() => setShowFilters((v) => !v)} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                    Filter
                  </Button>
                  <CanAdd>
                    <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                      Create Adjustment
                    </Button>
                  </CanAdd>
                </Stack>
              </Stack>
            </Stack>

            <Collapse in={showFilters} unmountOnExit>
              <Box sx={{ px: { xs: 2, sm: 3 }, pb: 2 }}>
                <FormGrid columns={4} singleColumnOnMobile>
                  <Autocomplete
                    size="small"
                    options={ADJUSTMENT_TYPE_FILTERS}
                    value={typeFilter}
                    onChange={(_e, v) => { setTypeFilter(v || 'All Types'); setPage(0); }}
                    disableClearable
                    renderInput={(params) => <TextField {...params} label="Adjustment Type" InputLabelProps={{ shrink: true }} />}
                  />
                  <Autocomplete
                    size="small"
                    options={STATUS_FILTERS}
                    value={statusFilter}
                    onChange={(_e, v) => { setStatusFilter(v || 'All Status'); setPage(0); }}
                    disableClearable
                    renderInput={(params) => <TextField {...params} label="Status" InputLabelProps={{ shrink: true }} />}
                  />
                  <TextField
                    size="small"
                    fullWidth
                    label="Date Range"
                    value={dateRangeLabel}
                    onClick={(e) => setDateAnchor(e.currentTarget)}
                    InputProps={{
                      readOnly: true,
                      startAdornment: <InputAdornment position="start"><EventIcon fontSize="small" /></InputAdornment>,
                      endAdornment: (dateFrom || dateTo) ? (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDateFrom(null); setDateTo(null); setPage(0); }}>
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      ) : null,
                    }}
                    InputLabelProps={{ shrink: true }}
                    sx={{ cursor: 'pointer' }}
                  />
                  <FilterAutocomplete
                    label="Warehouse"
                    allLabel="All Warehouses"
                    options={allWarehouseOptions}
                    value={warehouseFilter}
                    onChange={(v) => { setWarehouseFilter(v); setPage(0); }}
                  />
                </FormGrid>

                <Popover
                  open={!!dateAnchor}
                  anchorEl={dateAnchor}
                  onClose={() => setDateAnchor(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                >
                  <Stack direction="row" spacing={2} sx={{ p: 2 }}>
                    <DatePicker label="From" value={dateFrom} onChange={(v) => { setDateFrom(v); setPage(0); }} slotProps={{ textField: { size: 'small' } }} />
                    <DatePicker label="To" value={dateTo} onChange={(v) => { setDateTo(v); setPage(0); }} slotProps={{ textField: { size: 'small' } }} />
                  </Stack>
                </Popover>
                <TableFilterPanel table={table} embedded open />
              </Box>
            </Collapse>

            {canDelete && checkedIds.length > 0 && (
              <Box sx={{ px: { xs: 2, sm: 3 }, pb: 1.5 }}>
                <Button variant="outlined" color="error" size="small" startIcon={<DeleteIcon />} onClick={removeSelected}>
                  Delete Selected ({checkedIds.length})
                </Button>
              </Box>
            )}

            {isMobile ? (
              <Box sx={{ px: 2, pb: 1 }}>
                {!isLoading && pagedRows.map((row) => (
                  <MobileRecordCard
                    key={row.id}
                    title={row.adjustmentNo}
                    statusChip={<Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />}
                    fields={[
                      { label: 'Adjustment Type', value: row.adjustmentType || '—' },
                      { label: 'Adjustment Date', value: row.date ? dayjs(row.date).format('DD/MM/YYYY') : '—' },
                      { label: 'Warehouse', value: row.warehouse || '—' },
                      { label: 'Amount', value: `₹${Number(row.amount).toFixed(2)}` },
                    ]}
                    onEdit={() => handleEdit(row)}
                    onDelete={() => handleDelete(row)}
                  />
                ))}
                {!isLoading && filteredRows.length === 0 && (
                  <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No stock adjustments found" message="Add your first stock adjustment to get started" />
                )}
              </Box>
            ) : (
              <ScrollableTableContainer>
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    '& th, & td': {
                      height: STOCK_ADJUSTMENT_LIST_TABLE_ROW_HEIGHT,
                      paddingTop: `${STOCK_ADJUSTMENT_LIST_TABLE_CELL_PADDING_Y}px`,
                      paddingBottom: `${STOCK_ADJUSTMENT_LIST_TABLE_CELL_PADDING_Y}px`,
                      boxSizing: 'border-box',
                    },
                  }}
                >
                  <TableHead>
                    <TableRow>
                      {canDelete && (
                        <SortableHeaderCell field="id" sort={table.sort} onSort={table.toggleSort} padding="checkbox">
                          <Checkbox
                            size="small"
                            checked={pagedRows.length > 0 && pagedRows.every((r) => checkedIds.includes(r.id))}
                            indeterminate={pagedRows.some((r) => checkedIds.includes(r.id)) && !pagedRows.every((r) => checkedIds.includes(r.id))}
                            onChange={(e) => {
                              const ids = pagedRows.map((r) => r.id);
                              setCheckedIds((prev) => e.target.checked
                                ? Array.from(new Set([...prev, ...ids]))
                                : prev.filter((c) => !ids.includes(c)));
                            }}
                          />
                        </SortableHeaderCell>
                      )}
                      <TableCell width={40}>#</TableCell>
                      <SortableHeaderCell field="adjustmentNo" sort={table.sort} onSort={table.toggleSort}>Adjustment No.</SortableHeaderCell>
                      <SortableHeaderCell field="adjustmentType" sort={table.sort} onSort={table.toggleSort}>Adjustment Type</SortableHeaderCell>
                      <SortableHeaderCell field="date" sort={table.sort} onSort={table.toggleSort}>Adjustment Date</SortableHeaderCell>
                      <SortableHeaderCell field="warehouse" sort={table.sort} onSort={table.toggleSort}>Warehouse</SortableHeaderCell>
                      <SortableHeaderCell field="referenceNo" sort={table.sort} onSort={table.toggleSort}>Reference No.</SortableHeaderCell>
                      <SortableHeaderCell align="right" field="amount" sort={table.sort} onSort={table.toggleSort}>Amount (₹)</SortableHeaderCell>
                      <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {!isLoading && pagedRows.map((row, i) => (
                      <TableRow key={row.id} hover>
                        {canDelete && (
                          <TableCell padding="checkbox">
                            <Checkbox
                              size="small"
                              checked={checkedIds.includes(row.id)}
                              onChange={() => setCheckedIds((prev) => prev.includes(row.id) ? prev.filter((c) => c !== row.id) : [...prev, row.id])}
                            />
                          </TableCell>
                        )}
                        <TableCell>{page * pageSize + i + 1}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.adjustmentNo}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.adjustmentType || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.date ? dayjs(row.date).format('DD/MM/YYYY') : '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.warehouse || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.referenceNo || '—'}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(row.amount).toFixed(2)}</TableCell>
                        <TableCell>
                          <Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="View">
                              <IconButton size="small" onClick={() => handleView(row)} aria-label="view">
                                <VisibilityOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Print">
                              <IconButton size="small" onClick={() => handlePrint(row)} aria-label="print">
                                <PrintOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <IconButton
                              size="small"
                              onClick={(e) => { setRowMenuAnchor(e.currentTarget); setRowMenuTarget(row); }}
                              aria-label="more actions"
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!isLoading && filteredRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10}>
                          <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No stock adjustments found" message="Add your first stock adjustment to get started" />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollableTableContainer>
            )}

            <Menu anchorEl={rowMenuAnchor} open={!!rowMenuAnchor} onClose={() => setRowMenuAnchor(null)}>
              <CanEdit>
                <MenuItem onClick={() => handleEdit(rowMenuTarget)}>
                  <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>Edit</ListItemText>
                </MenuItem>
              </CanEdit>
              <CanDelete>
                <MenuItem onClick={() => handleDelete(rowMenuTarget)}>
                  <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                  <ListItemText>Delete</ListItemText>
                </MenuItem>
              </CanDelete>
            </Menu>

            <EntityListPagination total={filteredRows.length} page={page} onChange={setPage} pageSize={pageSize} onPageSizeChange={(v) => { setPageSize(v); setPage(0); }} />
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

// Isolated so the per-row product-select auto-fill effect only re-runs for
// the row whose product actually changed, not every row on every keystroke.
// Current Stock is pre-filled from the product's current opening stock; the
// rate is filled in behind the scenes from the product's cost price so the
// adjustment value can be costed.
// Both the Item No and Description columns are selects over the same
// underlying items.{index}.productCode field — Item No lists codes,
// Description lists names, but selecting either one sets the same value, so
// whichever the user picks from, the row's product identity (and therefore
// the auto-filled HSN/UOM/current stock/price below) stays in sync.
function ProductCell({ index, methods, options, products, label = '', placeholder = 'Select product', sx }) {
  const { watch, setValue } = methods;
  const notify = useNotify();
  const allItems = watch('items') || [];
  const otherSelectedCodes = useMemo(() => {
    const set = new Set();
    allItems.forEach((it, i) => {
      if (i !== index && it?.productCode) {
        set.add(String(it.productCode).trim().toUpperCase());
      }
    });
    return set;
  }, [allItems, index]);

  const optionsWithDisabledLabel = useMemo(() => {
    return options.map((opt) => ({
      ...opt,
      label: otherSelectedCodes.has(String(opt.value).trim().toUpperCase())
        ? `${opt.label} (Already selected)`
        : opt.label,
    }));
  }, [options, otherSelectedCodes]);

  const productCodeValue = watch(`items.${index}.productCode`);
  const prevValue = useRef(productCodeValue);

  useEffect(() => {
    if (productCodeValue !== prevValue.current) {
      if (productCodeValue && otherSelectedCodes.has(String(productCodeValue).trim().toUpperCase())) {
        notify.error(`Item "${productCodeValue}" is already added to this document.`);
        setValue(`items.${index}.productCode`, '');
        setValue(`items.${index}.productName`, '');
        setValue(`items.${index}.hsnCode`, '');
        setValue(`items.${index}.uom`, '');
        setValue(`items.${index}.currentStock`, 0);
        setValue(`items.${index}.unitPrice`, 0);
        prevValue.current = '';
        return;
      }
      const found = (products || []).find((p) => p.productCode === productCodeValue);
      if (found) {
        setValue(`items.${index}.productName`, found.productName, { shouldValidate: true });
        setValue(`items.${index}.hsnCode`, found.hsnCode || '', { shouldValidate: true });
        setValue(`items.${index}.uom`, found.uom || '', { shouldValidate: true });
        const openingQty = found.openingStock != null ? Number(found.openingStock) : 0;
        setValue(`items.${index}.currentStock`, openingQty, { shouldValidate: true });
        setValue(`items.${index}.unitPrice`, found.unitPrice != null ? Number(found.unitPrice) : 0, { shouldValidate: true });
      }
      prevValue.current = productCodeValue;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productCodeValue, otherSelectedCodes]);

  return (
    <FormSelect
      name={`items.${index}.productCode`}
      label={label}
      placeholder={placeholder}
      options={optionsWithDisabledLabel}
      getOptionDisabled={(opt) => otherSelectedCodes.has(String(opt?.value ?? '').trim().toUpperCase())}
      sx={sx}
    />
  );
}

// Live "Available: N" hint and quantity<=available-stock check, but ONLY for
// a Decrease line — an Increase line adds stock to its warehouse and can
// never go negative, so it renders nothing and never reports an error.
// Re-fetched (via useWarehouseStock/RTK Query) whenever this row's Warehouse
// or product changes, and re-compared whenever Quantity or Adjustment Type
// changes. No static zod rule can express this since it needs a live server
// value; instead this reports up to the parent's stockErrors map (keyed by
// the field's stable id so it survives row add/remove reordering), which
// gates the Save buttons. Server-side, assertNoNegativeWarehouseStockFor
// (Decrease lines only) is the actual authority — this is the same kind of
// early client-side hint as the existing (company-wide, not warehouse-scoped)
// Current Stock column already on this row.
function AvailableStockCell({ index, methods, fieldId, onErrorChange, products }) {
  const { watch } = methods;
  const productCode = watch(`items.${index}.productCode`);
  const warehouse = watch(`items.${index}.warehouse`);
  const adjustmentType = watch(`items.${index}.itemAdjustmentType`);
  const quantity = Number(watch(`items.${index}.quantity`)) || 0;
  const isDecrease = adjustmentType === 'Decrease';
  // A non-inventory product (Product Master's Inventory Item unchecked) is
  // never stock-tracked — no ledger posting, no quantity validation, on the
  // server (see attachInventoryItemFlag in routes/resources.js) — so its
  // line gets a neutral placeholder here instead of a live figure, and its
  // quantity never blocks Save regardless of what's on hand.
  const isNonInventory = (products || []).find((p) => p.productCode === productCode)?.inventoryItem === false;
  const shouldFetch = isDecrease && !isNonInventory;
  const { onHand, isLoading } = useWarehouseStock(shouldFetch ? productCode : null, shouldFetch ? warehouse : null);
  const exceeds = shouldFetch && onHand != null && quantity > onHand;

  useEffect(() => {
    onErrorChange(fieldId, exceeds);
    return () => onErrorChange(fieldId, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldId, exceeds]);

  if (!isDecrease || !productCode || !warehouse) return null;
  if (isNonInventory) {
    return (
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'nowrap', mt: 0.25 }}>
        Available: —
      </Typography>
    );
  }
  return (
    <Typography variant="caption" color={exceeds ? 'error' : 'text.secondary'} sx={{ display: 'block', whiteSpace: 'nowrap', mt: 0.25 }}>
      {isLoading ? 'Available: …' : exceeds ? `Available: ${onHand} — exceeds stock` : `Available: ${onHand}`}
    </Typography>
  );
}
