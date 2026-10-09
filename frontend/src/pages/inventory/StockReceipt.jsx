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
import BatchSerialSetupDialog from '../../components/common/BatchSerialSetupDialog';
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
import { stockReceiptSchema, RECEIPT_TYPE_OPTIONS, STOCK_RECEIPT_STATUS_OPTIONS } from '../../lib/validation/inventorySchemas';
import { stockReceiptApi, productApi } from '../../features/resources';
import { useBranchNameOptions } from '../../lib/useBranchOptions';
import { productOptionsFor, PRODUCT_USAGE } from '../../lib/productUsage';
import { useWarehouseOptions, warehouseLabel as formatWarehouseLabel, warehouseCodesForBranch } from '../../lib/useWarehouseOptions';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer, { dragScrollbarSx } from '../../components/data-display/ScrollableTableContainer';
import JournalEntryViewDialog from '../../components/accounting/JournalEntryViewDialog';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import { canDelete } from '../../config/deleteConfig';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';
const emptyItem = {
  productCode: '', productName: '', hsnCode: '', batchNo: '', expiryDate: null, warehouse: '', uom: '', quantity: 1, unitPrice: 0,
  // Populated via the "Batches - Setup" / "Serial Numbers - Setup" dialog —
  // see BatchSerialSetupDialog and the Batch/Serial column below. Empty
  // unless the selected product's Manage Item By is Batch or Serial.
  batches: [], serials: [],
};

/**
 * Blocks the Stock Receipt save when a Batch/Serial-tracked line's quantity
 * isn't fully accounted for — the client-side half of the same rule the
 * server enforces in assertBatchSerialAllocation (utils/businessRules.js).
 * Mirrors PurchaseGRN.jsx's validateBatchSerialAllocation, using this
 * document's own quantity field name (`quantity`, not `receivedQuantity`).
 */
function validateBatchSerialAllocation(items, productsByCode) {
  // Serial numbers are unique system-wide (see the ProductSerial schema
  // comment), so any reuse across two lines of this receipt is flagged here.
  //
  // Batch numbers, on a Stock Receipt, are unique PER RECEIPT, not per item
  // or per warehouse — see assertUniqueBatchesAndSerials's doc comment
  // (batchScope: 'stockReceipt') in utils/businessRules.js, which this
  // mirrors (same concept as Purchase GRN's own 'grn' scope — see
  // PurchaseGRN.jsx's own validateBatchSerialAllocation). The same batch
  // number is free to repeat across as many lines of THIS receipt as
  // needed (any item, any warehouse), so there is nothing to flag within
  // the document here. Reuse of that batch number against a number already
  // saved on a DIFFERENT Stock Receipt is caught server-side
  // (assertUniqueBatchesAndSerials in utils/businessRules.js), since this
  // form has no visibility into what already exists in the database.
  const seenSerialNos = new Map();

  for (let i = 0; i < (items || []).length; i++) {
    const item = items[i];
    const trackingMode = productsByCode[item.productCode]?.manageItemBy;
    const label = item.productCode || `Row ${i + 1}`;

    for (const s of item.serials || []) {
      const no = (s.serialNo || '').trim();
      if (!no) continue;
      if (seenSerialNos.has(no)) return `Serial number "${no}" is used on more than one line.`;
      seenSerialNos.set(no, i);
    }

    if (trackingMode !== 'Batch' && trackingMode !== 'Serial') continue;
    const qty = Number(item.quantity) || 0;

    if (trackingMode === 'Batch') {
      const allocated = (item.batches || []).reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
      if (Math.abs(allocated - qty) > 0.005) {
        return `${label}: allocate ${qty} to batches via "Batches - Setup" — currently ${allocated}.`;
      }
    } else {
      const count = (item.serials || []).length;
      if (count !== qty) {
        return `${label}: assign ${qty} serial number(s) via "Serial Numbers - Setup" — currently ${count}.`;
      }
    }
  }
  return null;
}

function getEmptyValues() {
  return {
    receiptNo: '', seriesId: '', branch: '', receiptType: 'Stock Transfer In', date: new Date(), postingDate: new Date(),
    referenceNo: '', warehouse: '', notes: '', attachmentName: '', remarks: '', status: 'Draft',
    items: [{ ...emptyItem }],
  };
}

// Mirrors the backend's computeStockReceiptTotals exactly — a plain sum of
// item amounts, with no tax or discount involved, since this is an internal
// stock movement document rather than a tax invoice.
function computeTotals(items) {
  const amount = (items || []).reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  return { amount };
}

function rowToFormValues(row) {
  return {
    receiptNo: row.receiptNo, seriesId: '', branch: row.branch || '', receiptType: row.receiptType || 'Stock Transfer In',
    date: row.date, postingDate: row.postingDate, referenceNo: row.referenceNo || '',
    warehouse: row.warehouse || '', notes: row.notes || '', attachmentName: row.attachmentName || '',
    remarks: row.remarks || '', status: row.status || 'Draft',
    items: (row.items && row.items.length ? row.items : [{ ...emptyItem }]).map((i) => ({
      productCode: i.productCode || '', productName: i.productName || '', hsnCode: i.hsnCode || '',
      batchNo: i.batchNo || '', expiryDate: i.expiryDate || null,
      // A line saved before per-row Warehouse existed has no warehouse of its
      // own — fall back to the document's header Warehouse so an old row is
      // never forced blank/invalid the moment this field became mandatory.
      warehouse: i.warehouse || row.warehouse || '',
      uom: i.uom || '',
      quantity: i.quantity != null ? Number(i.quantity) : 1,
      unitPrice: i.unitPrice != null ? Number(i.unitPrice) : 0,
      // Coerced like the line's own quantity/unitPrice above, and for the same
      // reason: the API hands these back as strings. Every other page that
      // loads batch sub-rows already does this (see StockIssue, StockTransfer,
      // DeliveryChallan et al) — the two "Setup"-dialog documents, this one and
      // PurchaseGRN, were the ones passing the array straight through.
      // productBatchLineSchema now preprocesses the value too, so this is
      // belt-and-braces; it also keeps the form state itself numeric, which is
      // what validateBatchSerialAllocation and the dialog's Open Qty read.
      // Only `quantity` needs it — every other productBatchLineSchema field is
      // a string or a date, and dates are preprocessed by optionalDate().
      batches: (i.batches || []).map((b) => ({
        ...b,
        quantity: b.quantity != null ? Number(b.quantity) : 0,
      })),
      // No coercion for serials: productSerialLineSchema has no numeric fields
      // at all — one row per physical unit, so the row count IS the quantity.
      serials: i.serials || [],
    })),
  };
}

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

const PAGE_SIZE = 10;
const STATUS_FILTERS = ['All Status', ...STOCK_RECEIPT_STATUS_OPTIONS];
const RECEIPT_TYPE_FILTERS = ['All Types', ...RECEIPT_TYPE_OPTIONS];

const STATUS_COLORS = { Draft: 'default', Posted: 'success', Cancelled: 'error' };

const STOCK_RECEIPT_LIST_TABLE_ROW_HEIGHT = 0;
const STOCK_RECEIPT_LIST_TABLE_CELL_PADDING_Y = 6;
export default function StockReceipt() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const itemScrollRef = useDragScroll();
  const { data: receipts, isLoading } = stockReceiptApi.useList();
  const { data: products } = productApi.useList();
  const [create, { isLoading: creating }] = stockReceiptApi.useCreate();
  const [update, { isLoading: updating }] = stockReceiptApi.useUpdate();
  const [remove] = stockReceiptApi.useDelete();

  // Looked up per row to decide whether the Batch/Serial column applies —
  // Product Master's Manage Item By select is what makes a line ask for it.
  const productsByCode = useMemo(
    () => Object.fromEntries((products || []).map((p) => [p.productCode, p])),
    [products]
  );
  // View toggles between the receipt list and the full-page Create/Edit
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
  // Journal Entry view popup — opened from the header's "View Journal Entry"
  // icon (rendered only once editingRow.journalEntryId exists, i.e. this
  // receipt already has a linked entry — Stock Return is backed by the
  // Stock Receipt document). Same pattern as Purchase GRN.
  const [journalViewOpen, setJournalViewOpen] = useState(false);
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
  // { index, mode } for the item row whose "Batches - Setup" / "Serial
  // Numbers - Setup" dialog is open; null when closed.
  const [batchDialog, setBatchDialog] = useState(null);

  const rows = receipts || [];

  const baseTableRows = useMemo(() => {
    const q = '';
    return rows.filter((r) => {
      const matchesSearch = !q || [r.receiptNo, r.referenceNo].some((v) => String(v || '').toLowerCase().includes(q));
      const matchesType = typeFilter === 'All Types' || r.receiptType === typeFilter;
      const matchesStatus = statusFilter === 'All Status' || r.status === statusFilter;
      const matchesWarehouse = !warehouseFilter || r.warehouse === warehouseFilter.value;
      const rd = r.date ? dayjs(r.date) : null;
      const matchesFrom = !dateFrom || (rd && !rd.isBefore(dateFrom, 'day'));
      const matchesTo = !dateTo || (rd && !rd.isAfter(dateTo, 'day'));
      return matchesSearch && matchesType && matchesStatus && matchesWarehouse && matchesFrom && matchesTo;
    });
  }, [rows, typeFilter, statusFilter, warehouseFilter, dateFrom, dateTo]);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'id', headerName: 'Select', filter: false, searchable: false },
    { field: 'receiptNo', headerName: 'Receipt No.', filter: 'text' },
    { field: 'receiptType', headerName: 'Receipt Type', filter: 'text' },
    { field: 'date', headerName: 'Receipt Date', filter: 'dateRange', sortValue: (row) => (row.date ? new Date(row.date).getTime() : null) },
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
      title: 'Delete stock receipt',
      message: `Are you sure you want to delete "${row.receiptNo}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Stock receipt deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const removeSelected = async () => {
    const ok = await confirmDialog({
      title: 'Delete selected receipts',
      message: `Delete ${checkedIds.length} selected receipt${checkedIds.length > 1 ? 's' : ''}? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await Promise.all(checkedIds.map((id) => remove(id).unwrap()));
      notify.success('Selected receipts deleted');
      setCheckedIds([]);
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    // A Batch/Serial-tracked line whose quantity isn't fully covered by its
    // batches/serials cannot be saved — see validateBatchSerialAllocation
    // above. The server enforces the same rule (assertBatchSerialAllocation)
    // so this is a fast local check, not the only line of defence.
    const allocationError = validateBatchSerialAllocation(values.items, productsByCode);
    if (allocationError) {
      notify.error(allocationError);
      return;
    }
    const payload = { ...values, status: pendingStatusRef.current };
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Stock receipt updated');
      } else {
        await create(payload).unwrap();
        notify.success('Stock receipt saved');
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
          schema={stockReceiptSchema}
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
              { header: 'HSN/SAC', get: (i) => i?.hsnCode, field: 'text' },
              { header: 'Batch No.', get: (i) => i?.batchNo, field: 'text' },
              { header: 'Expiry Date', get: () => 'MM/DD/YYYY', field: 'text' },
              { header: 'Warehouse *', get: (i) => i?.warehouse, field: 'select' },
              { header: 'Unit *', get: (i) => i?.uom, field: 'text' },
              { header: 'Quantity *', get: (i) => i?.quantity, field: 'text' },
              { header: 'Rate (₹) *', get: (i) => i?.unitPrice, field: 'text' },
              null,
              { header: 'Amount (₹)', get: (i) => ((Number(i?.quantity) || 0) * (Number(i?.unitPrice) || 0)).toFixed(2), field: 'plain', min: 110 },
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
                        {readOnly ? 'Receipt Details (View Only)' : 'Receipt Details'}
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
                        <LabeledField label="Receipt No. *">
                          <DocumentSeriesNoField documentCode="SRC" seriesFieldName="seriesId" numberFieldName="receiptNo" isCreate={!editingRow} />
                        </LabeledField>
                        <LabeledField label="Receipt Type *">
                          <FormSelect name="receiptType" label="" options={RECEIPT_TYPE_OPTIONS.map((t) => ({ label: t, value: t }))} />
                        </LabeledField>
                        <LabeledField label="Receipt Date *">
                          <FormDatePicker name="date" label="" />
                        </LabeledField>

                        <LabeledField label="Reference No.">
                          <FormTextField name="referenceNo" label="" placeholder="Enter reference number" />
                        </LabeledField>
                        <LabeledField label="Posting Date *">
                          <FormDatePicker name="postingDate" label="" />
                        </LabeledField>

                        <LabeledField label="From Warehouse *">
                          <FormSelect
                            name="warehouse"
                            label=""
                            placeholder={branch ? 'Select warehouse' : 'Select a branch first'}
                            options={branchWarehouseOptions}
                            disabled={!branch}
                          />
                        </LabeledField>

                        <LabeledField label="Notes">
                          <FormTextField name="notes" label="" placeholder="Enter any notes (optional)" multiline rows={2} />
                        </LabeledField>
                        <Box>
                          <Typography variant="body2" sx={{ mb: 0.5 }}>Attach Document</Typography>
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
                      </FormGrid>
                    </fieldset>

                    {editingRow?.journalEntryNo && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">Journal Entry:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{editingRow.journalEntryNo}</Typography>
                        <Tooltip title="View Journal Entry">
                          <IconButton
                            size="small"
                            type="button"
                            onClick={() => setJournalViewOpen(true)}
                          >
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
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
                            const price = Number(watch(`items.${index}.unitPrice`)) || 0;
                            const rowAmount = qty * price;
                            return (
                              <MobileItemCard
                                key={field.id}
                                index={index}
                                amount={rowAmount.toFixed(2)}
                                onRemove={() => removeItem(index)}
                                removeDisabled={fields.length <= 1}
                              >
                                <ProductCell index={index} methods={methods} options={productCodeOptions} products={products} label="Item No *" placeholder="Select product code" />
                                <ProductCell index={index} methods={methods} options={productNameOptions} products={products} label="Description" placeholder="Select product name" />
                                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 1.5, rowGap: 1.5 }}>
                                  <FormTextField name={`items.${index}.hsnCode`} label="HSN/SAC" placeholder="HSN/SAC" digitsOnly maxLength={8} />
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
                                  <FormTextField name={`items.${index}.quantity`} label="Quantity *" type="number" />
                                  <FormTextField name={`items.${index}.unitPrice`} label="Rate (₹) *" type="number" />
                                </Box>
                                <Box sx={{ mt: 1.5 }}>
                                  <BatchSerialCell index={index} methods={methods} product={productsByCode[watch(`items.${index}.productCode`)]} onOpen={(mode) => setBatchDialog({ index, mode })} />
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
                                <TableCell>HSN/SAC</TableCell>
                                <TableCell>Batch No.</TableCell>
                                <TableCell>Expiry Date</TableCell>
                                <TableCell>Warehouse *</TableCell>
                                <TableCell>Unit *</TableCell>
                                <TableCell>Quantity *</TableCell>
                                <TableCell>Rate (₹) *</TableCell>
                                <TableCell>Batch / Serial</TableCell>
                                <TableCell align="right">Amount (₹)</TableCell>
                                <TableCell width={48} />
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {fields.map((field, index) => {
                                const qty = Number(watch(`items.${index}.quantity`)) || 0;
                                const price = Number(watch(`items.${index}.unitPrice`)) || 0;
                                const rowAmount = qty * price;
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
                                      <FormTextField name={`items.${index}.hsnCode`} label="" placeholder="HSN/SAC" digitsOnly maxLength={8} />
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
                                      <FormTextField name={`items.${index}.quantity`} label="" type="number" />
                                    </TableCell>
                                    <TableCell>
                                      <FormTextField name={`items.${index}.unitPrice`} label="" type="number" />
                                    </TableCell>
                                    <TableCell>
                                      <BatchSerialCell index={index} methods={methods} product={productsByCode[watch(`items.${index}.productCode`)]} onOpen={(mode) => setBatchDialog({ index, mode })} />
                                    </TableCell>
                                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{rowAmount.toFixed(2)}</TableCell>
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
                            <Typography variant="body2" color="text.secondary">Total Amount (₹)</Typography>
                            <Typography variant="h5" fontWeight={700}>₹{totals.amount.toFixed(2)}</Typography>
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
                            disabled={creating || updating}
                          >
                            Save as Draft
                          </FormSubmitButton>
                          <FormSubmitButton
                            fullWidth={isMobile}
                            onClick={() => { pendingStatusRef.current = 'Posted'; }}
                            disabled={creating || updating}
                          >
                            {editingRow ? 'Update Receipt' : 'Save & Post Receipt'}
                          </FormSubmitButton>
                        </>
                      )}
                    </Stack>
                  </CardContent>
                </Card>

                {batchDialog && batchDialog.index < fields.length && (
                  <BatchSerialSetupDialog
                    open
                    onClose={() => setBatchDialog(null)}
                    mode={batchDialog.mode}
                    readOnly={readOnly}
                    docNo={editingRow?.receiptNo}
                    itemNumber={watch(`items.${batchDialog.index}.productCode`)}
                    itemDescription={watch(`items.${batchDialog.index}.productName`)}
                    warehouseCode={watch('warehouse')}
                    warehouseName={(branchWarehouseOptions.find((w) => w.value === watch('warehouse')) || {}).label}
                    totalNeeded={Number(watch(`items.${batchDialog.index}.quantity`)) || 0}
                    value={watch(`items.${batchDialog.index}.${batchDialog.mode === 'Batch' ? 'batches' : 'serials'}`)}
                    onSave={(rows) => setValue(
                      `items.${batchDialog.index}.${batchDialog.mode === 'Batch' ? 'batches' : 'serials'}`,
                      rows,
                      { shouldValidate: true }
                    )}
                  />
                )}

                <JournalEntryViewDialog
                  open={journalViewOpen}
                  journalEntryId={editingRow?.journalEntryId}
                  onClose={() => setJournalViewOpen(false)}
                />
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
              <Typography variant="subtitle1" fontWeight={700}>Stock Receipt List</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap sx={{ width: { xs: '100%', sm: 'auto' } }}>
                <TableSearchFilter table={table} placeholder="Search by receipt no., reference no..." showFilter={false} />
                <Stack direction="row" spacing={1.5}>
                  <Button size="small" variant="outlined" color="inherit" startIcon={<FilterListIcon />} onClick={() => setShowFilters((v) => !v)} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                    Filter
                  </Button>
                  <CanAdd>
                    <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                      Create Receipt
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
                    options={RECEIPT_TYPE_FILTERS}
                    value={typeFilter}
                    onChange={(_e, v) => { setTypeFilter(v || 'All Types'); setPage(0); }}
                    disableClearable
                    renderInput={(params) => <TextField {...params} label="Receipt Type" InputLabelProps={{ shrink: true }} />}
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
                    title={row.receiptNo}
                    statusChip={<Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />}
                    fields={[
                      { label: 'Receipt Type', value: row.receiptType || '—' },
                      { label: 'Receipt Date', value: row.date ? dayjs(row.date).format('DD/MM/YYYY') : '—' },
                      { label: 'Warehouse', value: row.warehouse || '—' },
                      { label: 'Amount', value: `₹${Number(row.amount).toFixed(2)}` },
                    ]}
                    onEdit={() => handleEdit(row)}
                    onDelete={() => handleDelete(row)}
                  />
                ))}
                {!isLoading && filteredRows.length === 0 && (
                  <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No stock receipts found" message="Add your first stock receipt to get started" />
                )}
              </Box>
            ) : (
              <ScrollableTableContainer>
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    '& th, & td': {
                      height: STOCK_RECEIPT_LIST_TABLE_ROW_HEIGHT,
                      paddingTop: `${STOCK_RECEIPT_LIST_TABLE_CELL_PADDING_Y}px`,
                      paddingBottom: `${STOCK_RECEIPT_LIST_TABLE_CELL_PADDING_Y}px`,
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
                      <SortableHeaderCell field="receiptNo" sort={table.sort} onSort={table.toggleSort}>Receipt No.</SortableHeaderCell>
                      <SortableHeaderCell field="receiptType" sort={table.sort} onSort={table.toggleSort}>Receipt Type</SortableHeaderCell>
                      <SortableHeaderCell field="date" sort={table.sort} onSort={table.toggleSort}>Receipt Date</SortableHeaderCell>
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
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.receiptNo}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.receiptType || '—'}</TableCell>
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
                          <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No stock receipts found" message="Add your first stock receipt to get started" />
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
// Both the Item No and Description columns are selects over the same
// underlying items.{index}.productCode field — Item No lists codes,
// Description lists names, but selecting either one sets the same value, so
// whichever the user picks from, the row's product identity (and therefore
// the auto-filled HSN/UOM/price below) stays in sync.
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
        setValue(`items.${index}.unitPrice`, 0);
        prevValue.current = '';
        return;
      }
      const found = (products || []).find((p) => p.productCode === productCodeValue);
      if (found) {
        setValue(`items.${index}.productName`, found.productName, { shouldValidate: true });
        setValue(`items.${index}.hsnCode`, found.hsnCode || '', { shouldValidate: true });
        setValue(`items.${index}.uom`, found.uom || '', { shouldValidate: true });
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

// Shows nothing for a None-tracked (or unrecognised) product — the column
// only means something once Product Master's Manage Item By is Batch or
// Serial for the row's selected product. Otherwise a button that opens the
// matching setup dialog, labelled with how much of the line is allocated so
// far so an incomplete line is visible without opening it.
function BatchSerialCell({ index, methods, product, onOpen }) {
  const { watch } = methods;
  const trackingMode = product?.manageItemBy;
  if (trackingMode !== 'Batch' && trackingMode !== 'Serial') {
    return <Typography variant="caption" color="text.secondary">—</Typography>;
  }
  const needed = Number(watch(`items.${index}.quantity`)) || 0;
  const batches = watch(`items.${index}.batches`) || [];
  const serials = watch(`items.${index}.serials`) || [];
  const allocated = trackingMode === 'Batch'
    ? batches.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0)
    : serials.length;
  const complete = needed > 0 && Math.abs(allocated - needed) < 0.005;

  return (
    <Button
      type="button"
      size="small"
      variant="outlined"
      color={complete ? 'success' : 'warning'}
      startIcon={<Inventory2OutlinedIcon fontSize="small" />}
      onClick={() => onOpen(trackingMode)}
      sx={{ whiteSpace: 'nowrap' }}
    >
      {trackingMode}: {allocated}/{needed}
    </Button>
  );
}
