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
import BatchSerialSelectionDialog from '../../components/common/BatchSerialSelectionDialog';
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
import { stockIssueSchema, ISSUE_TYPE_OPTIONS, STOCK_ISSUE_STATUS_OPTIONS } from '../../lib/validation/inventorySchemas';
import { stockIssueApi, stockReceiptApi, productApi } from '../../features/resources';
import { useBranchNameOptions } from '../../lib/useBranchOptions';
import { productOptionsFor, PRODUCT_USAGE } from '../../lib/productUsage';
import { useWarehouseOptions, warehouseLabel as formatWarehouseLabel, warehouseCodesForBranch } from '../../lib/useWarehouseOptions';
import { useWarehouseStock } from '../../lib/useWarehouseStock';
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
  // Populated via the "Batches Number - Selection" / "Serial Numbers -
  // Selection" dialog — see BatchSerialSelectionDialog and the Batch/Serial
  // column below. Empty unless the selected product's Manage Item By is
  // Batch or Serial.
  batchAllocations: [], serialAllocations: [],
};

/**
 * Blocks the issue save when a Batch/Serial-tracked line's quantity isn't
 * fully covered by its selected batches/serials — the client-side half of
 * the same rule the server enforces in assertBatchSerialIssueAllocation
 * (utils/businessRules.js). See the identical function on DeliveryChallan.jsx
 * for the full rationale — this document's own quantity field is just
 * `quantity` rather than `receivedQuantity`.
 *
 * Also carries DeliveryChallan.jsx's same (Item, Warehouse, Batch) check —
 * the same (batchNo, warehouse, productCode) selected on two lines of THIS
 * document, which would let each line's own allocated-vs-quantity check
 * below pass individually while together over-issuing that batch.
 * Different warehouses sharing a batch number is fine, same as the receive
 * side, and productCode is part of the key (not just batchNo, warehouse)
 * because ProductBatch is now unique per (batchNo, warehouse, productCode)
 * — two different products sharing a batch number and warehouse are two
 * different physical lots, not a collision — see DeliveryChallan.jsx's own
 * copy of this comment for the full rationale.
 */
function validateBatchSerialAllocation(items, productsByCode) {
  const seenBatchKeys = new Map();
  const seenSerialNos = new Map();

  for (let i = 0; i < (items || []).length; i++) {
    const item = items[i];
    const trackingMode = productsByCode[item.productCode]?.manageItemBy;
    const label = item.productCode || `Row ${i + 1}`;
    const warehouse = item.warehouse || null;

    for (const b of item.batchAllocations || []) {
      const no = (b.batchNo || '').trim();
      if (!no) continue;
      const key = `${no}::${warehouse || ''}::${item.productCode || ''}`;
      if (seenBatchKeys.has(key)) {
        return `Batch number "${no}" is used on more than one line for warehouse "${warehouse || '—'}".`;
      }
      seenBatchKeys.set(key, i);
    }
    for (const s of item.serialAllocations || []) {
      const no = (s.serialNo || '').trim();
      if (!no) continue;
      if (seenSerialNos.has(no)) return `Serial number "${no}" is used on more than one line.`;
      seenSerialNos.set(no, i);
    }

    if (trackingMode !== 'Batch' && trackingMode !== 'Serial') continue;
    const qty = Number(item.quantity) || 0;

    if (trackingMode === 'Batch') {
      const allocated = (item.batchAllocations || []).reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
      if (Math.abs(allocated - qty) > 0.005) {
        return `${label}: select ${qty} from batches via "Batches Number - Selection" — currently ${allocated}.`;
      }
    } else {
      const count = (item.serialAllocations || []).length;
      if (count !== qty) {
        return `${label}: select ${qty} serial number(s) via "Serial Numbers - Selection" — currently ${count}.`;
      }
    }
  }
  return null;
}

function getEmptyValues() {
  return {
    issueNo: '', seriesId: '', branch: '', issueType: 'Material Issue', date: new Date(), postingDate: new Date(),
    referenceNo: '', toWarehouse: '', notes: '', attachmentName: '', remarks: '', status: 'Draft',
    items: [{ ...emptyItem }],
  };
}

// Mirrors the backend's computeStockIssueTotals exactly — a plain sum of
// item amounts (qty * the product's cost price), with no tax or discount,
// since this is an internal stock movement document rather than a tax
// invoice. The rate isn't shown as an editable column, but is still stored
// per item behind the scenes so the total can be costed.
function computeTotals(items) {
  const amount = (items || []).reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  return { amount };
}

function rowToFormValues(row) {
  return {
    issueNo: row.issueNo, seriesId: '', branch: row.branch || '', issueType: row.issueType || 'Material Issue',
    date: row.date, postingDate: row.postingDate, referenceNo: row.referenceNo || '',
    toWarehouse: row.toWarehouse || '', notes: row.notes || '', attachmentName: row.attachmentName || '',
    remarks: row.remarks || '', status: row.status || 'Draft',
    items: (row.items && row.items.length ? row.items : [{ ...emptyItem }]).map((i) => ({
      productCode: i.productCode || '', productName: i.productName || '', hsnCode: i.hsnCode || '',
      batchNo: i.batchNo || '', expiryDate: i.expiryDate || null,
      // A line saved before per-row Warehouse existed has no warehouse of its
      // own — fall back to the document's header Warehouse so an old row is
      // never forced blank/invalid the moment this field became mandatory.
      warehouse: i.warehouse || row.toWarehouse || '',
      uom: i.uom || '',
      quantity: i.quantity != null ? Number(i.quantity) : 1,
      unitPrice: i.unitPrice != null ? Number(i.unitPrice) : 0,
      batchAllocations: (i.batchAllocations || []).map((b) => ({ batchNo: b.batchNo, quantity: Number(b.quantity) || 0 })),
      serialAllocations: (i.serialAllocations || []).map((s) => ({ serialNo: s.serialNo })),
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
const STATUS_FILTERS = ['All Status', ...STOCK_ISSUE_STATUS_OPTIONS];
const ISSUE_TYPE_FILTERS = ['All Types', ...ISSUE_TYPE_OPTIONS];

const STATUS_COLORS = { Draft: 'default', Posted: 'success', Cancelled: 'error' };

const STOCK_ISSUE_LIST_TABLE_ROW_HEIGHT = 0;
const STOCK_ISSUE_LIST_TABLE_CELL_PADDING_Y = 6;
export default function StockIssue() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const itemScrollRef = useDragScroll();
  const { data: issues, isLoading } = stockIssueApi.useList();
  const { data: receipts } = stockReceiptApi.useList();
  const { data: products } = productApi.useList();
  const [create, { isLoading: creating }] = stockIssueApi.useCreate();
  const [update, { isLoading: updating }] = stockIssueApi.useUpdate();
  const [remove] = stockIssueApi.useDelete();

  // Looked up per row to decide whether the Batch/Serial column applies —
  // Product Master's Manage Item By select is what makes a line ask for it.
  const productsByCode = useMemo(
    () => Object.fromEntries((products || []).map((p) => [p.productCode, p])),
    [products]
  );
  const receiptOptions = (receipts || []).map((r) => ({ label: r.receiptNo, value: r.receiptNo }));

  // View toggles between the issue list and the full-page Create/Edit
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
  const { options: allWarehouseOptions, warehouses } = useWarehouseOptions({ currentValue: editingRow?.toWarehouse });
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  // Journal Entry view popup — opened from the header's "View Journal Entry"
  // icon (rendered only once editingRow.journalEntryId exists, i.e. this
  // issue already has a linked entry). Same pattern as Purchase GRN.
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
  // { index, mode } for the item row whose "Batches Number - Selection" /
  // "Serial Numbers - Selection" dialog is open; null when closed.
  const [batchDialog, setBatchDialog] = useState(null);

  const rows = issues || [];

  const baseTableRows = useMemo(() => {
    const q = '';
    return rows.filter((r) => {
      const matchesSearch = !q || [r.issueNo, r.referenceNo].some((v) => String(v || '').toLowerCase().includes(q));
      const matchesType = typeFilter === 'All Types' || r.issueType === typeFilter;
      const matchesStatus = statusFilter === 'All Status' || r.status === statusFilter;
      const matchesWarehouse = !warehouseFilter || r.toWarehouse === warehouseFilter.value;
      const id = r.date ? dayjs(r.date) : null;
      const matchesFrom = !dateFrom || (id && !id.isBefore(dateFrom, 'day'));
      const matchesTo = !dateTo || (id && !id.isAfter(dateTo, 'day'));
      return matchesSearch && matchesType && matchesStatus && matchesWarehouse && matchesFrom && matchesTo;
    });
  }, [rows, typeFilter, statusFilter, warehouseFilter, dateFrom, dateTo]);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'id', headerName: 'Select', filter: false, searchable: false },
    { field: 'issueNo', headerName: 'Issue No.', filter: 'text' },
    { field: 'issueType', headerName: 'Issue Type', filter: 'text' },
    { field: 'date', headerName: 'Issue Date', filter: 'dateRange', sortValue: (row) => (row.date ? new Date(row.date).getTime() : null) },
    { field: 'toWarehouse', headerName: 'Warehouse', filter: 'text' },
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
      title: 'Delete stock issue',
      message: `Are you sure you want to delete "${row.issueNo}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Stock issue deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const removeSelected = async () => {
    const ok = await confirmDialog({
      title: 'Delete selected issues',
      message: `Delete ${checkedIds.length} selected issue${checkedIds.length > 1 ? 's' : ''}? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await Promise.all(checkedIds.map((id) => remove(id).unwrap()));
      notify.success('Selected issues deleted');
      setCheckedIds([]);
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    // A Batch/Serial-tracked line whose quantity isn't fully covered by its
    // selected batches/serials cannot be saved — see
    // validateBatchSerialAllocation above. The server enforces the same
    // rule (assertBatchSerialIssueAllocation) so this is a fast local
    // check, not the only line of defence.
    const allocationError = validateBatchSerialAllocation(values.items, productsByCode);
    if (allocationError) {
      notify.error(allocationError);
      return;
    }
    const payload = { ...values, status: pendingStatusRef.current };
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Stock issue updated');
      } else {
        await create(payload).unwrap();
        notify.success('Stock issue saved');
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
      <EntityHeaderCard
        icon={<Inventory2OutlinedIcon />}
        title="Stock Issue"
        subtitle={view === 'form' ? 'Create a new stock issue.' : 'Manage and track all stock issues.'}
        rightContent={<CompanyBadge />}
      />

      {view === 'form' ? (
        <AppForm
          key={formKey}
          schema={stockIssueSchema}
          defaultValues={editingRow ? rowToFormValues(editingRow) : getEmptyValues()}
          onSubmit={handleSubmit}
        >
          {(methods) => {
            const { control, watch, setValue } = methods;
            const { fields, append, remove: removeItem, replace: replaceItems } = useFieldArray({ control, name: 'items' });
            const watchedItems = watch('items') || [];

            // Every column of this item table is sized to show its values IN FULL —
            // no ellipsis, no wrapping, no hover, however long the text is. The
            // spec below is positional: it mirrors the header row top to bottom,
            // and `null` leaves a column (the # counter, the action column) at
            // whatever width it already has. See itemTableSx in lib/columnWidth.js.
            const itemColumnsSx = itemTableSx(watchedItems, [
              null,
              { header: 'Item No', get: (i) => i?.productCode, field: 'select' },
              { header: 'Description', get: (i) => i?.productName, field: 'select' },
              { header: 'HSN/SAC', get: (i) => i?.hsnCode, field: 'text' },
              { header: 'Batch No.', get: (i) => i?.batchNo, field: 'text' },
              { header: 'Expiry Date', get: () => 'MM/DD/YYYY', field: 'text' },
              { header: 'Warehouse *', get: (i) => i?.warehouse, field: 'select' },
              { header: 'Unit *', get: (i) => i?.uom, field: 'text' },
              { header: 'Quantity *', get: (i) => i?.quantity, field: 'text' },
              null,
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
              () => warehouseOptionsForBranch(warehouses, branch, editingRow?.toWarehouse),
              [warehouses, branch]
            );

            // Tracks, per row (keyed by field.id so it survives index shifts
            // from add/remove), whether that line's Quantity exceeds live
            // available stock in its own selected Warehouse — computed by
            // AvailableStockCell below via useWarehouseStock. No static zod
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

            // Picking a Reference No. (Stock Receipt) pulls every field that
            // exists on that receipt across onto the issue — Issue Date,
            // Posting Date, Notes, Attachment, Remarks, and item lines
            // (product, HSN/SAC, batch no., expiry date, unit, quantity).
            //
            // The item columns used to render `disabled`, on the grounds
            // that they mirror the receipt and aren't issue-specific data.
            // In practice that made it impossible to record an issue that
            // actually differs from the receipt — a substituted product, a
            // corrected batch/expiry, or an issue with no receipt behind it
            // at all ("Add Item" produced a row that could never be filled
            // in). They are editable now; picking a reference still
            // pre-fills them, it just no longer forbids a correction.
            //
            // Issue No., Issue Type, and To Warehouse aren't part of a stock
            // receipt and were already editable. Only fires on an actual
            // user change, not on initial load of an existing issue.
            const referenceValue = watch('referenceNo');
            const prevReference = useRef(editingRow ? editingRow.referenceNo : null);
            useEffect(() => {
              if (referenceValue !== prevReference.current) {
                const found = (receipts || []).find((r) => r.receiptNo === referenceValue);
                if (found) {
                  setValue('date', found.date || null, { shouldValidate: true });
                  setValue('postingDate', found.postingDate || null, { shouldValidate: true });
                  setValue('notes', found.notes || '', { shouldValidate: true });
                  setValue('attachmentName', found.attachmentName || '', { shouldValidate: true });
                  setValue('remarks', found.remarks || '', { shouldValidate: true });
                  if (found.items && found.items.length) {
                    // replaceItems(), not setValue('items', ...) — see the
                    // same fix on Delivery Challan's order-fetch effect.
                    // replace() (useFieldArray's own API) gives every row a
                    // fresh field id, remounting each ProductCell instead of
                    // reusing the old one — reused cells saw productCode
                    // change from '' to the receipt's value, read that as a
                    // user picking a product, and overwrote the unit price
                    // just set here with the *product master's* default
                    // instead of the receipt's.
                    replaceItems(found.items.map((i) => ({
                      productCode: i.productCode || '', productName: i.productName || '',
                      hsnCode: i.hsnCode || '', batchNo: i.batchNo || '', expiryDate: i.expiryDate || null,
                      // The receipt's own line warehouse isn't meaningful here —
                      // Stock Issue's line Warehouse is where THIS issue draws
                      // from, so seed it from the issue's own Warehouse header
                      // field, not the referenced receipt's line.
                      warehouse: watch('toWarehouse') || '',
                      uom: i.uom || '',
                      quantity: i.quantity != null ? Number(i.quantity) : 1,
                      unitPrice: i.unitPrice != null ? Number(i.unitPrice) : 0,
                      batchAllocations: [], serialAllocations: [],
                    })));
                  }
                } else if (!referenceValue && prevReference.current) {
                  // Reference receipt cleared via the Autocomplete's × button —
                  // undo the pre-fill above rather than leaving the stale
                  // receipt's values sitting in fields that now claim no
                  // receipt is referenced. Only fires when a receipt was
                  // actually applied before (prevReference.current truthy), so
                  // plain page load with an empty referenceNo doesn't blank out
                  // an existing issue's own saved values.
                  setValue('date', null, { shouldValidate: true });
                  setValue('postingDate', null, { shouldValidate: true });
                  setValue('notes', '', { shouldValidate: true });
                  setValue('attachmentName', '', { shouldValidate: true });
                  setValue('remarks', '', { shouldValidate: true });
                  replaceItems([{ ...emptyItem }]);
                }
                prevReference.current = referenceValue;
              }
              // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [referenceValue]);

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
              if (watch('toWarehouse') && !allowed.has(watch('toWarehouse'))) setValue('toWarehouse', '');
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
                        {readOnly ? 'Issue Details (View Only)' : 'Issue Details'}
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
                        <LabeledField label="Issue No. *">
                          <DocumentSeriesNoField documentCode="SIG" seriesFieldName="seriesId" numberFieldName="issueNo" isCreate={!editingRow} />
                        </LabeledField>
                        <LabeledField label="Issue Type *">
                          <FormSelect name="issueType" label="" options={ISSUE_TYPE_OPTIONS.map((t) => ({ label: t, value: t }))} />
                        </LabeledField>
                        <LabeledField label="Issue Date *">
                          <FormDatePicker name="date" label="" />
                        </LabeledField>

                        <LabeledField label="Reference No.">
                          <FormSelect name="referenceNo" label="" placeholder="Select stock receipt" options={receiptOptions} />
                        </LabeledField>
                        <LabeledField label="Posting Date *">
                          <FormDatePicker name="postingDate" label="" disabled />
                        </LabeledField>
                        <LabeledField label="Warehouse *">
                          <FormSelect
                            name="toWarehouse"
                            label=""
                            placeholder={branch ? 'Select warehouse' : 'Select a branch first'}
                            options={branchWarehouseOptions}
                            disabled={!branch}
                          />
                        </LabeledField>


                        <LabeledField label="Notes">
                          <FormTextField name="notes" label="" placeholder="Auto-filled from stock receipt" multiline rows={2} disabled />
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
                        <Button type="button" variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => append({ ...emptyItem, warehouse: watch('toWarehouse') })}>
                          Add Item
                        </Button>
                      </Stack>

                      {isMobile ? (
                        <Box>
                          {fields.map((field, index) => (
                            <MobileItemCard
                              key={field.id}
                              index={index}
                              onRemove={() => removeItem(index)}
                              removeDisabled={fields.length <= 1}
                            >
                              <ProductCell index={index} methods={methods} options={productCodeOptions} products={products} label="Item No" placeholder="Select product" />
                              <ProductCell index={index} methods={methods} options={productNameOptions} products={products} label="Description" placeholder="Select product" />
                              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 1.5, rowGap: 1.5 }}>
                                <FormTextField name={`items.${index}.hsnCode`} label="HSN/SAC" placeholder="4, 6 or 8 digits" digitsOnly maxLength={8} />
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
                              </Box>
                              <Box sx={{ mt: 0.5 }}>
                                <AvailableStockCell index={index} methods={methods} fieldId={field.id} onErrorChange={handleStockErrorChange} products={products} />
                              </Box>
                              <Box sx={{ mt: 1.5 }}>
                                <BatchSerialCell index={index} methods={methods} product={productsByCode[watch(`items.${index}.productCode`)]} onOpen={(mode) => setBatchDialog({ index, mode })} />
                              </Box>
                            </MobileItemCard>
                          ))}
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
                                <TableCell>Batch/Serial Selection</TableCell>
                                <TableCell width={80}>Action</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {fields.map((field, index) => (
                                <TableRow key={field.id} sx={{ '& > td': { verticalAlign: 'middle' } }}>
                                  <TableCell>{index + 1}</TableCell>
                                  <TableCell>
                                    <ProductCell index={index} methods={methods} options={productCodeOptions} products={products} placeholder="Select product" sx={{ minWidth: 180 }} />
                                  </TableCell>
                                  <TableCell>
                                    <ProductCell index={index} methods={methods} options={productNameOptions} products={products} placeholder="Select product" sx={{ minWidth: 200 }} />
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
                                    <AvailableStockCell index={index} methods={methods} fieldId={field.id} onErrorChange={handleStockErrorChange} products={products} />
                                  </TableCell>
                                  <TableCell>
                                    <BatchSerialCell index={index} methods={methods} product={productsByCode[watch(`items.${index}.productCode`)]} onOpen={(mode) => setBatchDialog({ index, mode })} />
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
                              ))}
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
                          <FormTextField name="remarks" label="" placeholder="Auto-filled from stock receipt" multiline rows={5} disabled />
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
                            disabled={creating || updating || hasStockError}
                          >
                            Save as Draft
                          </FormSubmitButton>
                          <FormSubmitButton
                            fullWidth={isMobile}
                            onClick={() => { pendingStatusRef.current = 'Posted'; }}
                            disabled={creating || updating || hasStockError}
                          >
                            {editingRow ? 'Update Issue' : 'Save & Post Issue'}
                          </FormSubmitButton>
                        </>
                      )}
                    </Stack>
                  </CardContent>
                </Card>

                {batchDialog && batchDialog.index < fields.length && (
                  <BatchSerialSelectionDialog
                    open
                    onClose={() => setBatchDialog(null)}
                    mode={batchDialog.mode}
                    readOnly={readOnly}
                    docNo={editingRow?.issueNo}
                    itemNumber={watch(`items.${batchDialog.index}.productCode`)}
                    itemDescription={watch(`items.${batchDialog.index}.productName`)}
                    warehouseCode={watch(`items.${batchDialog.index}.warehouse`) || watch('toWarehouse')}
                    warehouseName={(branchWarehouseOptions.find((w) => w.value === (watch(`items.${batchDialog.index}.warehouse`) || watch('toWarehouse'))) || {}).label}
                    totalNeeded={Number(watch(`items.${batchDialog.index}.quantity`)) || 0}
                    productCode={watch(`items.${batchDialog.index}.productCode`)}
                    value={watch(`items.${batchDialog.index}.${batchDialog.mode === 'Batch' ? 'batchAllocations' : 'serialAllocations'}`)}
                    onSave={(rows) => setValue(
                      `items.${batchDialog.index}.${batchDialog.mode === 'Batch' ? 'batchAllocations' : 'serialAllocations'}`,
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
              <Typography variant="subtitle1" fontWeight={700}>Stock Issue List</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap sx={{ width: { xs: '100%', sm: 'auto' } }}>
                <TableSearchFilter table={table} placeholder="Search by issue no., reference no..." showFilter={false} />
                <Stack direction="row" spacing={1.5}>
                  <Button size="small" variant="outlined" color="inherit" startIcon={<FilterListIcon />} onClick={() => setShowFilters((v) => !v)} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                    Filter
                  </Button>
                  <CanAdd>
                    <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                      Create Issue
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
                    options={ISSUE_TYPE_FILTERS}
                    value={typeFilter}
                    onChange={(_e, v) => { setTypeFilter(v || 'All Types'); setPage(0); }}
                    disableClearable
                    renderInput={(params) => <TextField {...params} label="Issue Type" InputLabelProps={{ shrink: true }} />}
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
                    title={row.issueNo}
                    statusChip={<Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />}
                    fields={[
                      { label: 'Issue Type', value: row.issueType || '—' },
                      { label: 'Issue Date', value: row.date ? dayjs(row.date).format('DD/MM/YYYY') : '—' },
                      { label: 'Warehouse', value: row.toWarehouse || '—' },
                      { label: 'Amount', value: `₹${Number(row.amount).toFixed(2)}` },
                    ]}
                    onEdit={() => handleEdit(row)}
                    onDelete={() => handleDelete(row)}
                  />
                ))}
                {!isLoading && filteredRows.length === 0 && (
                  <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No stock issues found" message="Add your first stock issue to get started" />
                )}
              </Box>
            ) : (
              <ScrollableTableContainer>
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    '& th, & td': {
                      height: STOCK_ISSUE_LIST_TABLE_ROW_HEIGHT,
                      paddingTop: `${STOCK_ISSUE_LIST_TABLE_CELL_PADDING_Y}px`,
                      paddingBottom: `${STOCK_ISSUE_LIST_TABLE_CELL_PADDING_Y}px`,
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
                      <SortableHeaderCell field="issueNo" sort={table.sort} onSort={table.toggleSort}>Issue No.</SortableHeaderCell>
                      <SortableHeaderCell field="issueType" sort={table.sort} onSort={table.toggleSort}>Issue Type</SortableHeaderCell>
                      <SortableHeaderCell field="date" sort={table.sort} onSort={table.toggleSort}>Issue Date</SortableHeaderCell>
                      <SortableHeaderCell field="toWarehouse" sort={table.sort} onSort={table.toggleSort}>Warehouse</SortableHeaderCell>
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
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.issueNo}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.issueType || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.date ? dayjs(row.date).format('DD/MM/YYYY') : '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.toWarehouse || '—'}</TableCell>
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
                          <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No stock issues found" message="Add your first stock issue to get started" />
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
// The rate isn't shown in the table (per the mockup) but is still filled in
// behind the scenes from the product's cost price so the total can be costed.
// Both the Item No and Description columns are selects over the same
// underlying items.{index}.productCode field — Item No lists codes,
// Description lists names. Both render disabled here: issue items come
// straight from the selected Stock Receipt's item list (see the
// referenceNo effect above), so the product on an issue row isn't something
// the user picks by hand — it's whatever the receipt said, read-only.
function ProductCell({ index, methods, options, products, label = '', placeholder = 'Select product', disabled = false, sx }) {
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
      disabled={disabled}
      sx={sx}
    />
  );
}

// Live "Available: N" hint for this row's own selected Warehouse, and the
// component-state half of the quantity<=available-stock rule — re-fetched
// automatically (via useWarehouseStock/RTK Query) whenever this row's
// Warehouse or product changes, and re-compared whenever Quantity changes.
// No static zod rule can express this since it needs a live server value;
// instead this reports up to the parent's stockErrors map (keyed by the
// field's stable id so it survives row add/remove reordering), which gates
// the Save buttons. Server-side, assertNoNegativeWarehouseStockFor is the
// actual authority — this is the same kind of early client-side hint as
// StockTransferItem.totalStock / StockAdjustmentItem.systemQuantity.
function AvailableStockCell({ index, methods, fieldId, onErrorChange, products }) {
  const { watch } = methods;
  const productCode = watch(`items.${index}.productCode`);
  const warehouse = watch(`items.${index}.warehouse`);
  const quantity = Number(watch(`items.${index}.quantity`)) || 0;
  // A non-inventory product (Product Master's Inventory Item unchecked) is
  // never stock-tracked — no ledger posting, no quantity validation, on the
  // server (see attachInventoryItemFlag in routes/resources.js) — so its
  // line gets a neutral placeholder here instead of a live figure, and its
  // quantity never blocks Save regardless of what's on hand.
  const isNonInventory = (products || []).find((p) => p.productCode === productCode)?.inventoryItem === false;
  const { onHand, isLoading } = useWarehouseStock(isNonInventory ? null : productCode, warehouse);
  const exceeds = !isNonInventory && onHand != null && quantity > onHand;

  useEffect(() => {
    onErrorChange(fieldId, exceeds);
    // Clear this row's error if it unmounts (row removed) rather than
    // leaving a stale entry behind forever.
    return () => onErrorChange(fieldId, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldId, exceeds]);

  if (!productCode || !warehouse) return null;
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

// Shows nothing for a None-tracked (or unrecognised) product — the column
// only means something once Product Master's Manage Item By is Batch or
// Serial for the row's selected product. Otherwise a button that opens the
// matching "... - Selection" dialog, labelled with how much of the line is
// selected so far so an incomplete line is visible without opening it.
function BatchSerialCell({ index, methods, product, onOpen }) {
  const { watch } = methods;
  const trackingMode = product?.manageItemBy;
  if (trackingMode !== 'Batch' && trackingMode !== 'Serial') {
    return <Typography variant="caption" color="text.secondary">—</Typography>;
  }
  const needed = Number(watch(`items.${index}.quantity`)) || 0;
  const batchAllocations = watch(`items.${index}.batchAllocations`) || [];
  const serialAllocations = watch(`items.${index}.serialAllocations`) || [];
  const selected = trackingMode === 'Batch'
    ? batchAllocations.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0)
    : serialAllocations.length;
  const complete = needed > 0 && Math.abs(selected - needed) < 0.005;

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
      {trackingMode}: {selected}/{needed}
    </Button>
  );
}
