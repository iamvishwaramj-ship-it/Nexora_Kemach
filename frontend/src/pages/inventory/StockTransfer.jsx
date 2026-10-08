import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box, Typography, Button, Card, CardContent, Stack, TextField, InputAdornment, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, Menu, MenuItem,
  ListItemIcon, ListItemText, Checkbox, Autocomplete, Popover, Grid, Tooltip, Collapse, Tabs, Tab,
  Alert, Dialog, DialogTitle, DialogContent, DialogActions, Divider,
} from '@mui/material';
import { useFieldArray } from 'react-hook-form';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FilterListIcon from '@mui/icons-material/FilterList';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import EventIcon from '@mui/icons-material/Event';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
import DocumentSeriesNoField from '../../components/form/DocumentSeriesNoField';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import BatchSerialSelectionDialog from '../../components/common/BatchSerialSelectionDialog';
import StockTransferPrintable, { printStockTransfer } from '../../components/print/StockTransferPrintable';
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
import { round2, buildDocument, isInterState } from '../../lib/documentTotals';
import DocumentTotalsPanel from '../../components/form/DocumentTotalsPanel';
import { stockTransferSchema, TRANSFER_TYPE_OPTIONS, STOCK_TRANSFER_STATUS_OPTIONS } from '../../lib/validation/inventorySchemas';
import {
  stockTransferApi, stockTransferRequestApi, productApi, chartOfAccountApi, appUserApi, taxCodeApi,
  useGetProductInventoryQuery,
  useGenerateStockTransferEWayBillMutation, useCancelStockTransferEWayBillMutation,
} from '../../features/resources';
import { buildTaxCodeOptions } from '../../lib/taxCodeOptions';
import { useBranchNameOptions } from '../../lib/useBranchOptions';
import { useGetCompanyDetailsQuery } from '../../features/company/companyDetailsApi';
import { productOptionsFor, PRODUCT_USAGE } from '../../lib/productUsage';
import { useWarehouseOptions, useWarehouseLabeller, warehouseLabel as formatWarehouseLabel, warehouseCodesForBranch } from '../../lib/useWarehouseOptions';
import usePriceListRates, { dlpMissMessage } from '../../hooks/usePriceListRates';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer, { dragScrollbarSx } from '../../components/data-display/ScrollableTableContainer';
import JournalEntryViewDialog from '../../components/accounting/JournalEntryViewDialog';
import { selectCurrentUser } from '../../store/authSlice';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import { canDelete } from '../../config/deleteConfig';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';

const emptyItem = {
  productCode: '', productName: '', fromWarehouse: '', toWarehouse: '', totalStock: 0, uom: '',
  quantity: '', unitPrice: 0, itemCost: 0, taxCodeId: null, taxPercent: 0, accountCode: '', project: '', remarks: '',
  batchAllocations: [], serialAllocations: [],
};

/**
 * Blocks the transfer save when a Batch/Serial-tracked line's quantity isn't
 * fully covered by its selected batches/serials — the client-side half of
 * the same rule the server enforces in assertBatchSerialRelocateAllocation
 * (utils/businessRules.js). Stock Transfer relocates whole batches only
 * (assertWholeBatchRelocation on the server), so a partial-quantity batch
 * pick that still sums to the line's quantity is caught there, not here.
 */
function validateBatchSerialAllocation(items, productsByCode) {
  for (let i = 0; i < (items || []).length; i++) {
    const item = items[i];
    const trackingMode = productsByCode[item.productCode]?.manageItemBy;
    if (trackingMode !== 'Batch' && trackingMode !== 'Serial') continue;
    const label = item.productCode || `Row ${i + 1}`;
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

// Every brand-new row starts on the same default Tax Code as Stock Transfer
// Request's own newItem — Kerala GST@18% — rather than blank, unless Tax
// Codes haven't loaded yet (defaultTaxCodeOption is null until they have).
function newItem(defaultTaxCodeOption) {
  return {
    ...emptyItem,
    taxCodeId: defaultTaxCodeOption?.value ?? null,
    taxPercent: defaultTaxCodeOption?.rate ?? 0,
  };
}

function getEmptyValues(defaultBranch, preparedBy, defaultTaxCodeOption) {
  const today = new Date();
  return {
    transferNo: '', seriesId: '', branch: defaultBranch || '', toBranch: '', transferType: 'Stock Transfer', requestNo: '', status: 'Open',
    requestDate: today, documentDate: today,
    preparedBy: preparedBy || '', journalRemarks: 'Material Transfer - ', remarks: '', attachmentName: '',
    items: [newItem(defaultTaxCodeOption)],
  };
}

// Same shared engine every Sales/Purchase document uses (documentTotals.js's
// buildDocument/computeTotals), reused rather than reimplemented — this
// document has no header Discount % (see DocumentTotalsPanel's
// discountField={null} below), so 0 is passed for it, and there's no
// `quantityField` override since this item's field really is `quantity`.
// `unitPrice` here means the item table's own Unit Price column, which is
// `itemCost` internally (see the FormTextField/itemColumnsSx below) — mapped
// across at the call site, not renamed, so the rest of the codebase's
// itemCost convention for this document is untouched.
//
// `interState` decides CGST/SGST vs IGST — see resolveStockTransferTaxTreatment
// in routes/resources.js for why this compares From Branch's state to To
// Branch's state instead of a customer's place of supply.
function computeTotals(items, taxCodeById, interState) {
  const lines = (items || []).map((i) => ({
    quantity: i.quantity,
    unitPrice: i.itemCost,
    taxPercent: i.taxPercent,
    taxType: taxCodeById?.get(i.taxCodeId)?.taxType || '',
  }));
  const { totals } = buildDocument(lines, 0, { interState, roundOff: true });
  return { ...totals, grandTotal: totals.amount };
}

// Row-level "Total (LC)" — tax-inclusive, same convention as Stock Transfer
// Request's lineTotal: qty * unit price * (1 + tax% / 100). Kept independent
// of computeTotals' own per-line proportional tax split (which rounds off at
// the document level) since this is just the on-screen per-row figure.
function lineTotal(item) {
  const quantity = Number(item?.quantity) || 0;
  const unitPrice = Number(item?.itemCost) || 0;
  const taxPercent = Number(item?.taxPercent) || 0;
  return round2(quantity * unitPrice * (1 + taxPercent / 100));
}

// `defaultTaxCodeOption` fills in Kerala GST@18% on any SAVED line with no
// Tax Code of its own (a legacy transfer saved before this feature existed),
// same as Stock Transfer Request's own rowToFormValues — a line that already
// has a real Tax Code (even a different one) is left untouched.
function rowToFormValues(row, defaultTaxCodeOption) {
  return {
    transferNo: row.transferNo, seriesId: '', branch: row.branch || '', toBranch: row.toBranch || '', transferType: row.transferType || 'Stock Transfer',
    requestNo: row.requestNo || '',
    status: row.status || 'Open',
    requestDate: row.requestDate, documentDate: row.documentDate,
    preparedBy: row.preparedBy || '', journalRemarks: row.journalRemarks || '', remarks: row.remarks || '',
    attachmentName: row.attachmentName || '',
    items: (row.items && row.items.length ? row.items : [newItem(defaultTaxCodeOption)]).map((i) => ({
      productCode: i.productCode || '', productName: i.productName || '',
      fromWarehouse: i.fromWarehouse || '',
      toWarehouse: i.toWarehouse || '',
      totalStock: i.totalStock != null ? Number(i.totalStock) : 0,
      uom: i.uom || '', quantity: i.quantity != null ? Number(i.quantity) : 0,
      unitPrice: i.unitPrice != null ? Number(i.unitPrice) : 0,
      itemCost: i.itemCost != null ? Number(i.itemCost) : 0,
      taxCodeId: i.taxCodeId != null ? Number(i.taxCodeId) : (defaultTaxCodeOption?.value ?? null),
      taxPercent: i.taxCodeId != null ? (i.taxPercent != null ? Number(i.taxPercent) : 0) : (defaultTaxCodeOption?.rate ?? 0),
      accountCode: i.accountCode || '', project: i.project || '', remarks: i.remarks || '',
      batchAllocations: (i.batchAllocations || []).map((b) => ({ batchNo: b.batchNo, quantity: Number(b.quantity) || 0 })),
      serialAllocations: (i.serialAllocations || []).map((s) => ({ serialNo: s.serialNo })),
    })),
  };
}

// Every per-row From/To Warehouse dropdown reads from this same list — a
// warehouse belongs to a Branch (WarehouseMaster.branch), so once Branch is
// picked, every warehouse dropdown on the document (there is no directional
// split; From and To simply must differ from each other, enforced by the
// line schema's refine) is scoped to that branch's warehouses only. Mirrors
// useWarehouseOptions' own "keep the record's legacy value selectable even if
// it's not in the current list" behavior, since this bypasses that hook to
// add the branch filter.
//
// `keepValues` is one warehouse code or an array of them (every line's own
// From/To Warehouse on the document being edited/viewed) that must stay
// selectable even if it's since gone Inactive or been reassigned to a
// different branch — without this, opening an older document whose saved
// warehouse no longer matches the current filter renders that row's select
// blank even though the value IS there on the form.
function warehouseOptionsForBranch(warehouses, branchName, keepValues) {
  const rows = (warehouses || [])
    .filter((w) => w.status === 'Active' && (!branchName || w.branch === branchName))
    .slice()
    .sort((a, b) => String(a.whsCode || '').localeCompare(String(b.whsCode || ''), undefined, { numeric: true }));
  const out = rows.map((w) => ({ label: formatWarehouseLabel(w), value: w.whsCode }));
  const keep = Array.isArray(keepValues) ? keepValues : (keepValues == null ? [] : [keepValues]);
  for (const raw of keep) {
    const current = raw == null ? '' : String(raw);
    if (current === '' || out.some((o) => o.value === current)) continue;
    const known = (warehouses || []).find((w) => w.whsCode === current);
    out.unshift({
      label: known ? formatWarehouseLabel(known) : `${current} (not in Warehouse Master)`,
      value: current,
    });
  }
  return out;
}

const PAGE_SIZE = 10;
const EWAY_TRANSPORT_MODES = ['Road', 'Rail', 'Air', 'Ship'];
const STATUS_FILTERS = ['All Status', ...STOCK_TRANSFER_STATUS_OPTIONS];
const TYPE_FILTERS = ['All Types', ...TRANSFER_TYPE_OPTIONS];
const STATUS_COLORS = { Open: 'default', Closed: 'success' };
// Notification bell feature — copied from the referenced Stock Transfer
// Request at creation time (see schema.prisma's comment on
// StockTransfer.approvalStatus); gates whether a receipt can close/post it.
const APPROVAL_STATUS_COLORS = { Pending: 'warning', Approved: 'success', Rejected: 'error' };

const STOCK_TRANSFER_LIST_TABLE_ROW_HEIGHT = 0;
const STOCK_TRANSFER_LIST_TABLE_CELL_PADDING_Y = 6;
export default function StockTransfer() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const itemScrollRef = useDragScroll();
  const currentUser = useSelector(selectCurrentUser);
  const { data: transfers, isLoading } = stockTransferApi.useList();
  const { data: products } = productApi.useList();
  const { data: chartOfAccounts } = chartOfAccountApi.useList();
  const { data: appUsers } = appUserApi.useList();
  const { data: transferRequests } = stockTransferRequestApi.useList();
  const { data: taxCodes } = taxCodeApi.useList();
  // Tax (%) is a Tax Code CFL, same convention as Purchase Order's own — see
  // buildTaxCodeOptions: keyed by taxCodeId (not the rate), so two Tax Codes
  // that happen to share a rate both still show up in the dropdown. No
  // taxType filtering (no GST/place-of-supply concept on this document —
  // see the taxPercent comment on StockTransferItem in schema.prisma).
  const taxCodeOptions = useMemo(() => buildTaxCodeOptions(taxCodes), [taxCodes]);
  const taxCodeById = useMemo(() => new Map(taxCodeOptions.map((o) => [o.value, o])), [taxCodeOptions]);
  // Default Tax Code for a brand-new row — same "Kerala GST@18%" convention
  // as Stock Transfer Request. Matched on the Tax Code's own name exactly
  // (label minus its trailing " (<rate>%)"), not a substring of the label —
  // "Kerala GST@18%" and "Kerala GST@18% + TCS@1%" are two different Tax
  // Codes that happen to share the same 18% rate, and a naive `includes`
  // check on the label can match either one depending on array order.
  const defaultTaxCodeOption = useMemo(() => {
    const isExactKeralaGst18 = (label) =>
      String(label || '').replace(/\s*\([^()]*\)\s*$/, '').trim().toLowerCase() === 'kerala gst@18%';
    return taxCodeOptions.find((o) => isExactKeralaGst18(o.label)) || null;
  }, [taxCodeOptions]);
  // Company master — the printable's letterhead falls back to this when no
  // Branch is selected/matched, same as DeliveryChallanPrintable.jsx.
  const { data: company } = useGetCompanyDetailsQuery();
  const [create, { isLoading: creating }] = stockTransferApi.useCreate();
  const [update, { isLoading: updating }] = stockTransferApi.useUpdate();
  const [remove] = stockTransferApi.useDelete();
  const warehouseLabel = useWarehouseLabeller();

  // Looked up per row to decide whether the Batch/Serial column applies —
  // Product Master's Manage Item By select is what makes a line ask for it.
  const productsByCode = useMemo(
    () => Object.fromEntries((products || []).map((p) => [p.productCode, p])),
    [products]
  );
  const accountOptions = useMemo(
    () => (chartOfAccounts || []).filter((a) => a.accountNature === 'A' && a.status !== 'I').map((a) => ({ label: `${a.accountName} (${a.accountCode})`, value: a.accountCode })),
    [chartOfAccounts]
  );

  // View toggles between the transfer list and the full-page Create/Edit
  // form — same page, no dialog/popup, matching Stock Issue/Stock Adjustment.
  const [view, setView] = useState('list');
  const [editingRow, setEditingRow] = useState(null);
  // Unit Price auto-fills from the Active DLP price list (falls back to the
  // product's own Unit Price when the item isn't on it) — see ProductCell.
  const dlpRates = usePriceListRates('DLP', { alwaysRefetch: true });
  const priceListRates = dlpRates.rates;
  const { options: branchOptions } = useBranchNameOptions({ currentValue: editingRow?.branch });
  // Separate call so the destination side of a Branch Transfer keeps ITS
  // OWN saved branch selectable — reusing branchOptions here would only
  // guarantee editingRow.branch stays visible, not editingRow.toBranch,
  // leaving the To Branch box blank on edit/view whenever the signed-in
  // user isn't granted that branch (or it's since been deactivated).
  // branches (unrestricted) also doubles as the lookup list the printable
  // uses to resolve the From/To Branch address boxes — it needs every
  // branch's address regardless of which ones the signed-in user is granted.
  const { options: toBranchOptions, branches: allBranchesForPrint } = useBranchNameOptions({ currentValue: editingRow?.toBranch, restrictToUserBranches: false });

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
  // selectableProducts' own keepCodes already re-includes a saved line's
  // product if it still exists in Product Master (just filtered out by
  // usage flag or Inactive status) — but a line whose product has since been
  // DELETED from Product Master entirely has no row there to re-include, and
  // would otherwise render this select permanently blank on edit/view despite
  // the code being right there in the saved item. Same "keep the record's own
  // value selectable" idiom as warehouseOptionsForBranch/preparedByOptions
  // below, applied here off editingRow.items directly rather than the
  // products list.
  const productCodeOptions = useMemo(() => {
    const out = selectableProducts.map((p) => ({ label: p.productCode, value: p.productCode }));
    for (const it of editingRow?.items || []) {
      const code = it.productCode;
      if (code && !out.some((o) => o.value === code)) {
        out.unshift({ label: `${code} (not in Product Master)`, value: code });
      }
    }
    return out;
  }, [selectableProducts, editingRow]);
  const productNameOptions = useMemo(() => {
    const out = selectableProducts.map((p) => ({ label: p.productName, value: p.productCode }));
    for (const it of editingRow?.items || []) {
      const code = it.productCode;
      if (code && !out.some((o) => o.value === code)) {
        out.unshift({ label: it.productName ? `${it.productName} (not in Product Master)` : `${code} (not in Product Master)`, value: code });
      }
    }
    return out;
  }, [selectableProducts, editingRow]);

  // Unfiltered — used for the list view's Warehouse filter, which should
  // still search across every warehouse regardless of branch.
  const { options: allWarehouseOptions, warehouses: allWarehouses } = useWarehouseOptions({});
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  // Journal Entry view popup — opened from the header's "View Journal Entry"
  // icon (rendered only once editingRow.journalEntryId exists, i.e. this
  // transfer already has a linked entry). Same pattern as Purchase GRN.
  const [journalViewOpen, setJournalViewOpen] = useState(false);
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

  const rows = transfers || [];

  const baseTableRows = useMemo(() => {
    return rows.filter((r) => {
      const matchesType = typeFilter === 'All Types' || r.transferType === typeFilter;
      const matchesStatus = statusFilter === 'All Status' || r.status === statusFilter;
      // No header-level From/To Warehouse any more — matches if ANY line on
      // this transfer moved through the filtered warehouse, on either leg.
      const matchesWarehouse = !warehouseFilter || (r.items || []).some(
        (it) => it.fromWarehouse === warehouseFilter.value || it.toWarehouse === warehouseFilter.value
      );
      const rd = r.requestDate ? dayjs(r.requestDate) : null;
      const matchesFrom = !dateFrom || (rd && !rd.isBefore(dateFrom, 'day'));
      const matchesTo = !dateTo || (rd && !rd.isAfter(dateTo, 'day'));
      return matchesType && matchesStatus && matchesWarehouse && matchesFrom && matchesTo;
    });
  }, [rows, typeFilter, statusFilter, warehouseFilter, dateFrom, dateTo]);

  const tableColumns = useMemo(() => ([
    { field: 'id', headerName: 'Select', filter: false, searchable: false },
    { field: 'transferNo', headerName: 'Material Transfer No.', filter: 'text' },
    { field: 'transferType', headerName: 'Type', filter: 'text' },
    { field: 'requestDate', headerName: 'Request Date', filter: 'dateRange', sortValue: (row) => (row.requestDate ? new Date(row.requestDate).getTime() : null) },
    { field: 'status', headerName: 'Status', filter: 'select' },
    { field: 'approvalStatus', headerName: 'Approval', filter: 'select' },
  ]), [warehouseLabel]);
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

  const [printRequestTransferNo, setPrintRequestTransferNo] = useState(null);

  const handlePrint = (row) => {
    setRowMenuAnchor(null);
    handleView(row);
    setPrintRequestTransferNo(row.transferNo);
  };

  useEffect(() => {
    if (!printRequestTransferNo) return;
    if (!editingRow || editingRow.transferNo !== printRequestTransferNo) return;

    const returnToListAfterPrint = () => {
      window.removeEventListener('afterprint', returnToListAfterPrint);
      setPrintRequestTransferNo(null);
      backToList();
    };

    window.addEventListener('afterprint', returnToListAfterPrint);
    printStockTransfer();
  }, [printRequestTransferNo, editingRow]);

  const handleDelete = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Delete stock transfer issue',
      message: `Are you sure you want to delete "${row.transferNo}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Stock transfer issue deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const removeSelected = async () => {
    const ok = await confirmDialog({
      title: 'Delete selected transfer issues',
      message: `Delete ${checkedIds.length} selected transfer issue${checkedIds.length > 1 ? 's' : ''}? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await Promise.all(checkedIds.map((id) => remove(id).unwrap()));
      notify.success('Selected transfer issues deleted');
      setCheckedIds([]);
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    const allocationError = validateBatchSerialAllocation(values.items, productsByCode);
    if (allocationError) {
      notify.error(allocationError);
      return;
    }
    // Status is no longer a manual choice on save — every transfer is
    // raised Open, and only closes once a Stock Transfer Receipt confirms
    // the goods arrived (see syncStockTransferClosure in
    // routes/resources.js). Editing an already-Closed transfer must not
    // silently reopen it just because this form's Status field is never
    // itself submitted for editing — it carries forward whatever the
    // record's own current status is rather than resetting to Open.
    const payload = { ...values, status: editingRow ? editingRow.status : 'Open' };
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Stock transfer issue updated');
      } else {
        await create(payload).unwrap();
        notify.success('Stock transfer issue saved');
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
        icon={<SwapHorizOutlinedIcon />}
        title="Stock Transfer Issue"
        subtitle={view === 'form' ? 'Move stock from one warehouse to another.' : 'Manage and track all stock transfer issues.'}
        rightContent={<CompanyBadge />}
      />

      {view === 'form' ? (
        <AppForm
          key={formKey}
          schema={stockTransferSchema}
          defaultValues={editingRow ? rowToFormValues(editingRow, defaultTaxCodeOption) : getEmptyValues(currentUser?.defaultBranch, currentUser?.name || currentUser?.email, defaultTaxCodeOption)}
          onSubmit={handleSubmit}
        >
          {(methods) => {
            const { control, watch, setValue } = methods;
            const { fields, append, remove: removeItem, replace: replaceItems } = useFieldArray({ control, name: 'items' });
            const watchedItems = watch('items') || [];
            const requestNo = watch('requestNo');
            const transferType = watch('transferType');
            // Transit Whse and To Whse are mutually exclusive columns on the
            // item table — a plain Stock Transfer moves stock straight to a
            // chosen warehouse (To Whse), while a Branch Transfer moves it
            // through the destination branch's own Transit Warehouse
            // instead. The Transit Whse column itself is never shown any
            // more (at the user's request): it was always read-only —
            // auto-filled from WarehouseMaster.isTransit, nothing the user
            // could edit — and often blank when the destination branch has
            // no transit warehouse configured yet, which just read as
            // confusing dead space in the table. The value is still
            // resolved and written to each row's own toWarehouse behind the
            // scenes (see transitWarehouseCode/the effect below) — hiding
            // the column changes nothing about how a Branch Transfer moves
            // stock, only what's visible in this table.
            const showTransitWhse = false;
            const showToWhse = transferType !== 'Branch Transfer';

            // Every column of this item table is sized to show its values IN FULL —
            // no ellipsis, no wrapping, no hover, however long the text is. The
            // spec below is positional: it mirrors the header row top to bottom,
            // and `null` leaves a column (the # counter, the action column) at
            // whatever width it already has. See itemTableSx in lib/columnWidth.js.
            const itemColumnsSx = itemTableSx(watchedItems, [
              null,
              { header: 'Item No. *', get: (i) => i?.productCode, field: 'select' },
              { header: 'Name *', get: (i) => i?.productName, field: 'select' },
              { header: 'Issue Warehouse *', get: (i) => i?.fromWarehouse, field: 'select' },
              { header: 'Total Stock', get: (i) => i?.totalStock, field: 'plain' },
              ...(showTransitWhse ? [{ header: 'Transit Whse', get: (i) => i?.toWarehouse, field: 'plain' }] : []),
              ...(showToWhse ? [{ header: 'To Whse *', get: (i) => i?.toWarehouse, field: 'select' }] : []),
              { header: 'Quantity *', get: (i) => i?.quantity, field: 'text' },
              { header: 'Unit Price', get: (i) => i?.itemCost, field: 'text' },
              { header: 'Tax (%)', get: (i) => taxCodeById.get(i?.taxCodeId)?.label ?? i?.taxPercent, field: 'select' },
              { header: 'Total (LC)', get: (i) => lineTotal(i).toFixed(2), field: 'plain', min: 110 },
              null,
              null,
            ]);
            // The DLP rates load asynchronously — if an item was picked before
            // they arrived it kept Unit Price 0. Once they're in, fill any
            // still-zero price on a NEW document (never on a saved one being
            // viewed/edited, and never over a price the user typed).
            useEffect(() => {
              if (editingRow || !priceListRates || priceListRates.size === 0) return;
              (watch('items') || []).forEach((it, idx) => {
                if (!it?.productCode || Number(it.itemCost) > 0) return;
                const rate = priceListRates.get(it.productCode) ?? priceListRates.get(String(it.productCode).trim().toUpperCase());
                if (rate == null) return;
                setValue(`items.${idx}.unitPrice`, rate, { shouldValidate: true });
                setValue(`items.${idx}.itemCost`, rate, { shouldValidate: true });
              });
              // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [priceListRates]);
            const branch = watch('branch');
            const toBranch = watch('toBranch');
            // CGST/SGST vs IGST for this document is decided by comparing
            // the From Branch's state to the To Branch's state (see
            // resolveStockTransferTaxTreatment in routes/resources.js) — a
            // plain Stock Transfer has no To Branch and falls back to
            // intra-state, same as isInterState's own blank-side rule.
            const branchStateByName = new Map((allBranchesForPrint || []).map((b) => [String(b.branchName || '').trim(), b.state || '']));
            const interState = isInterState(branchStateByName.get(String(toBranch || '').trim()), branchStateByName.get(String(branch || '').trim()));
            const totals = computeTotals(watchedItems, taxCodeById, interState);
            // Print — A4 landscape design (see StockTransferPrintable.jsx).
            // Rendered off the form's live watched values so a Print
            // triggered mid-edit reflects whatever is on screen, not just
            // what was last saved.
            const printOrder = watch();
            // Which branch scopes the To Warehouse dropdowns: for a plain
            // Stock Transfer there's only one branch (both sides use it,
            // same as before); for a Branch Transfer, the destination side
            // uses the separate To Branch field.
            const effectiveToBranch = transferType === 'Branch Transfer' ? toBranch : branch;
            // A Branch Transfer moves stock OUT of From Branch, so it can't
            // also be the destination — drop whichever branch is currently
            // selected as From Branch from the To Branch list. Recomputed on
            // every render off the live watch()ed value (not just the saved
            // editingRow.branch this page opened with) so switching From
            // Branch immediately removes it from To Branch too.
            const toBranchOptionsFiltered = branch
              ? toBranchOptions.filter((o) => o.value !== branch)
              : toBranchOptions;
            const [tab, setTab] = useState(0);

            // E-Way Bill tab (Branch Transfer) -- TaxPro GSP actions, same
            // approach as Sales Invoice's E-Invoice / E-Way Bill tab: these are
            // system-generated values that only change through the two API
            // calls below, so they are NOT react-hook-form fields and never
            // travel with the main Save/Update. They are read straight off
            // `editingRow`, which each mutation's response is merged back into.
            // Transport Mode / Transporter / Vehicle / Distance are the inputs
            // to the call, seeded once from the saved row (this form instance
            // is remounted via formKey whenever a different transfer opens).
            const [generateEWayBill, { isLoading: generatingEWayBill }] = useGenerateStockTransferEWayBillMutation();
            const [cancelEWayBill, { isLoading: cancellingEWayBill }] = useCancelStockTransferEWayBillMutation();
            const [ewayError, setEwayError] = useState('');
            const [ewayCancelOpen, setEwayCancelOpen] = useState(false);
            const [ewayCancelReason, setEwayCancelReason] = useState('');
            const [ewbTransportMode, setEwbTransportMode] = useState(editingRow?.transportMode || 'Road');
            const [ewbTransporterName, setEwbTransporterName] = useState(editingRow?.transporterName || '');
            const [ewbTransporterGstin, setEwbTransporterGstin] = useState(editingRow?.transporterGstin || '');
            const [ewbVehicleNo, setEwbVehicleNo] = useState(editingRow?.vehicleNo || '');
            const [ewbDistanceKm, setEwbDistanceKm] = useState(editingRow?.ewayDistanceKm != null ? String(editingRow.ewayDistanceKm) : '');

            const ewayBillStatus = editingRow?.ewayBillStatus || 'Not Generated';
            const ewayStatusColor = ewayBillStatus === 'Generated' ? 'success' : ewayBillStatus === 'Cancelled' ? 'error' : 'default';
            const isBranchTransferDoc = transferType === 'Branch Transfer';
            const approvalBlocksEWay = editingRow?.approvalStatus === 'Pending' || editingRow?.approvalStatus === 'Rejected';
            // Only a saved Branch Transfer that is not waiting on / refused by
            // its Stock Transfer Request approval can have an e-way bill.
            const canGenerateEWay = Boolean(editingRow?.id && editingRow?.transferNo)
              && isBranchTransferDoc && !approvalBlocksEWay && editingRow?.status !== 'Cancelled';

            const handleGenerateEWayBill = async () => {
              setEwayError('');
              try {
                const updated = await generateEWayBill({
                  id: editingRow.id,
                  transportMode: ewbTransportMode,
                  transporterName: ewbTransporterName,
                  transporterGstin: ewbTransporterGstin,
                  vehicleNo: ewbVehicleNo,
                  distanceKm: ewbDistanceKm === '' ? null : Number(ewbDistanceKm),
                }).unwrap();
                setEditingRow((prev) => (prev ? { ...prev, ...updated } : prev));
                notify.success('E-Way Bill generated');
              } catch (err) {
                setEwayError(err?.data?.message || 'Could not generate the e-way bill');
              }
            };

            const handleConfirmCancelEWayBill = async () => {
              if (!ewayCancelReason.trim()) return;
              setEwayError('');
              try {
                const updated = await cancelEWayBill({ id: editingRow.id, cancelReason: ewayCancelReason }).unwrap();
                setEditingRow((prev) => (prev ? { ...prev, ...updated } : prev));
                notify.success('E-Way Bill cancelled');
                setEwayCancelOpen(false);
                setEwayCancelReason('');
              } catch (err) {
                setEwayError(err?.data?.message || 'Could not cancel the e-way bill');
              }
            };
            // { index, mode } for the item row whose "Batches Number -
            // Selection" / "Serial Numbers - Selection" dialog is open;
            // null when closed. Opened from the From Warehouse side only —
            // relocation moves the SAME batch/serial row to the To
            // Warehouse, so there is nothing to pick on that side.
            const [batchDialog, setBatchDialog] = useState(null);

            // Every warehouse dropdown on this document — each item row's own
            // From/To — draws from this same branch-scoped list. With no
            // branch chosen yet there is nothing to offer. Every line's own
            // saved fromWarehouse is passed as keepValues so opening an
            // existing transfer for edit/view doesn't blank a row whose
            // warehouse has since gone Inactive or moved to another branch.
            const branchWarehouseOptions = useMemo(
              () => warehouseOptionsForBranch(allWarehouses, branch, (editingRow?.items || []).map((i) => i.fromWarehouse)),
              [allWarehouses, branch, editingRow]
            );
            // Same idea, scoped to the destination branch — only differs
            // from branchWarehouseOptions when transferType is 'Branch
            // Transfer' (see effectiveToBranch above). Keeps every line's
            // saved toWarehouse selectable for the same reason.
            const toBranchWarehouseOptions = useMemo(
              () => warehouseOptionsForBranch(allWarehouses, effectiveToBranch, (editingRow?.items || []).map((i) => i.toWarehouse)),
              [allWarehouses, effectiveToBranch, editingRow]
            );

            // For a Branch Transfer, the Transit Whse column isn't a manual
            // pick (showToWhse is false in that mode, so there's no field to
            // set it from) — it's the destination branch's own Transit
            // Warehouse, the single warehouse in To Branch flagged
            // WarehouseMaster.isTransit (at most one per branch, enforced
            // server-side the same way Branch.isDefault is). Blank when the
            // destination branch has none flagged yet, or for a plain Stock
            // Transfer.
            const transitWarehouseCode = useMemo(() => {
              if (transferType !== 'Branch Transfer' || !effectiveToBranch) return '';
              const found = (allWarehouses || []).find(
                (w) => w.branch === effectiveToBranch && w.isTransit && w.status === 'Active'
              );
              return found ? found.whsCode : '';
            }, [allWarehouses, transferType, effectiveToBranch]);

            // Request No. picker — scoped to the Branch chosen on this
            // document (a request raised for one branch has no bearing on
            // a transfer from another), and only Stock Transfer Requests
            // still Open are offered, since a request that's already
            // Partially Transferred/Closed/Cancelled isn't one this
            // transfer should be raised against. With no Branch chosen yet
            // there is nothing to scope by, so no requests are offered at
            // all (mirrors the Warehouse dropdowns' own "Select branch
            // first" behaviour) rather than listing every branch's requests.
            // The record's own already-saved value is kept selectable even
            // if it no longer matches (branch changed since, or status has
            // moved on).
            const requestNoOptions = useMemo(() => {
              // A Stock Transfer Request's From Branch is the branch ASKING for
              // stock and its "Request to" branch is the one that holds and
              // sends it. A Branch Transfer is raised (issued) by the sending
              // branch, so this document's Branch (= From Branch, the issuing
              // side) is matched against the request's "Request to" branch.
              // A plain Stock Transfer has a single branch on both sides, so
              // it still matches on the request's own branch.
              const out = !branch ? [] : (transferRequests || [])
                .filter((r) => r.status === 'Open'
                  && (r.transferType === 'Branch Transfer' ? r.toBranch === branch : r.branch === branch))
                .map((r) => ({ label: r.requestNo, value: r.requestNo }));
              const current = requestNo || '';
              if (current && !out.some((o) => o.value === current)) {
                out.unshift({ label: `${current} (not available)`, value: current });
              }
              return out;
            }, [transferRequests, branch, requestNo]);

            // Same "keep the record's own value selectable" idiom as
            // requestNoOptions above — a document saved under an older status
            // value (e.g. a pre-relabelling 'Draft', before the migration to
            // 'Open' runs) would otherwise have nothing in the fixed
            // Open/Closed list to match against and render this box blank
            // on edit/view despite the value being right there on the
            // record.
            const statusValue = watch('status');
            const statusOptions = useMemo(() => {
              const out = STOCK_TRANSFER_STATUS_OPTIONS.map((s) => ({ label: s, value: s }));
              if (statusValue && !out.some((o) => o.value === statusValue)) {
                out.unshift({ label: statusValue, value: statusValue });
              }
              return out;
            }, [statusValue]);

            const handleFile = (file) => {
              if (file) setValue('attachmentName', file.name, { shouldValidate: true });
            };

            // Switching Branch invalidates any per-row warehouse choice that
            // doesn't belong to the new branch; a warehouse picked under one
            // branch has no meaning under another. Skipped on the very first
            // render so loading an existing record for edit/view doesn't wipe
            // values it just loaded.
            const prevBranchRef = useRef(branch);
            useEffect(() => {
              if (prevBranchRef.current === branch) return;
              prevBranchRef.current = branch;
              const allowed = warehouseCodesForBranch(allWarehouses, branch);
              (watch('items') || []).forEach((it, idx) => {
                if (it.fromWarehouse && !allowed.has(it.fromWarehouse)) setValue(`items.${idx}.fromWarehouse`, '');
              });
              // From Branch and To Branch can't be the same branch (see
              // toBranchOptionsFiltered above, which hides this branch from
              // the To Branch list) — if the newly-picked From Branch matches
              // what's already sitting in To Branch, clear To Branch rather
              // than leaving a now-hidden value stuck in the field.
              if (watch('toBranch') === branch) setValue('toBranch', '');
              // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [branch]);

            // Same as above, for the destination side — tracks
            // effectiveToBranch so it also reacts to switching Type between
            // Stock Transfer and Branch Transfer, not just to either branch
            // field changing.
            const prevToBranchRef = useRef(effectiveToBranch);
            useEffect(() => {
              if (prevToBranchRef.current === effectiveToBranch) return;
              prevToBranchRef.current = effectiveToBranch;
              const allowed = warehouseCodesForBranch(allWarehouses, effectiveToBranch);
              (watch('items') || []).forEach((it, idx) => {
                if (it.toWarehouse && !allowed.has(it.toWarehouse)) setValue(`items.${idx}.toWarehouse`, '');
              });
              // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [effectiveToBranch]);

            // Keeps every line's Transit Whse (stored in toWarehouse — see
            // TransitWarehouseCell) in sync with the destination branch's own
            // Transit Warehouse. Fires whenever that resolved warehouse
            // changes: To Branch is picked/changed, Type switches into/out
            // of Branch Transfer, or a new line is added while To Branch is
            // already set. Applies to every row, not just new ones, since
            // there is nothing for the user to edit here to begin with —
            // unlike the plain-Stock-Transfer To Warehouse column, this one
            // is never a manual choice.
            const prevTransitWarehouseRef = useRef(transitWarehouseCode);
            useEffect(() => {
              if (transferType !== 'Branch Transfer') return;
              if (prevTransitWarehouseRef.current === transitWarehouseCode) return;
              prevTransitWarehouseRef.current = transitWarehouseCode;
              (watch('items') || []).forEach((_it, idx) => {
                setValue(`items.${idx}.toWarehouse`, transitWarehouseCode, { shouldValidate: true });
              });
              // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [transitWarehouseCode, transferType]);

            // Picking a Request No. copies that request's line items onto
            // this transfer — each request line's own Warehouse becomes the
            // new item's To Warehouse (kept only if valid for the current
            // destination branch; From Warehouse is always left blank since
            // the request doesn't carry one). If the request itself was
            // raised as a Branch Transfer, this transfer's Type switches to
            // Branch Transfer too and adopts the request's From Branch/
            // Request To as this transfer's Branch/To Branch. Skipped on
            // first render so opening an existing transfer for edit/view
            // doesn't overwrite its own saved lines, and skipped when
            // cleared back to blank.
            const prevRequestNoRef = useRef(requestNo);
            useEffect(() => {
              if (prevRequestNoRef.current === requestNo) return;
              prevRequestNoRef.current = requestNo;
              if (!requestNo) return;
              const req = (transferRequests || []).find((r) => r.requestNo === requestNo);
              if (!req) return;
              // Direction: the request's From Branch is the branch ASKING for
              // stock; its "Request to" branch is the one that holds and sends
              // it. So the transfer issued against it moves stock FROM the
              // request's "Request to" branch TO the request's From Branch,
              // and the warehouse named on the request line (a warehouse of
              // the sending branch) is where the stock is issued from.
              const isBranchRequest = req.transferType === 'Branch Transfer';
              if (isBranchRequest) {
                setValue('transferType', 'Branch Transfer', { shouldValidate: true });
                if (req.toBranch) setValue('branch', req.toBranch, { shouldValidate: true });
                if (req.branch) setValue('toBranch', req.branch, { shouldValidate: true });
              }
              // Which branch the request line's warehouse must belong to for
              // it to be carried over: the sending branch for a Branch
              // Transfer (becomes From Whse), this document's own single
              // branch for a plain Stock Transfer (becomes To Whse, as before).
              const warehouseBranch = isBranchRequest ? (req.toBranch || '') : effectiveToBranch;
              const allowedRequestWarehouse = warehouseCodesForBranch(allWarehouses, warehouseBranch);
              const reqItems = req.items && req.items.length ? req.items : null;
              if (reqItems) {
                replaceItems(reqItems.map((i) => ({
                  productCode: i.productCode || '', productName: i.productName || '',
                  // Branch Transfer: To Whse isn't a field (the transitWarehouseCode
                  // effect fills it from the destination branch), so only From
                  // Whse is carried over. Plain Stock Transfer: unchanged --
                  // From Whse blank, the request warehouse becomes To Whse.
                  fromWarehouse: isBranchRequest && i.toWarehouse && allowedRequestWarehouse.has(i.toWarehouse) ? i.toWarehouse : '',
                  toWarehouse: !isBranchRequest && i.toWarehouse && allowedRequestWarehouse.has(i.toWarehouse) ? i.toWarehouse : '',
                  totalStock: 0,
                  // UoM is required on this document but isn't a column
                  // anywhere in its own item table — a copied-in row never
                  // gets a chance to fill it via ProductCell's own
                  // productCode-change effect, because that effect only
                  // fires when productCode actually CHANGES after mount,
                  // and a row born already holding its copied productCode
                  // never triggers it. Falling back to the Product Master's
                  // own UoM here (same lookup ProductCell itself would do)
                  // is what stops a request line with no UoM of its own
                  // from copying across as silently blank — which failed
                  // validation with no visible field to fix, since there is
                  // none, permanently disabling Save with no visible cause.
                  uom: i.uom || productsByCode[i.productCode || '']?.uom || '',
                  quantity: i.quantity != null ? Number(i.quantity) : 0,
                  unitPrice: i.unitPrice != null ? Number(i.unitPrice) : 0,
                  itemCost: i.itemCost != null ? Number(i.itemCost) : 0,
                  // Stock Transfer Request now carries its own Tax Code per
                  // line (see stockTransferRequestItemSchema) — copy it
                  // across when the request line has one, and fall back to
                  // the same Kerala GST@18% default as any other new row
                  // when it doesn't (a request line saved before that
                  // feature existed).
                  taxCodeId: i.taxCodeId != null ? Number(i.taxCodeId) : (defaultTaxCodeOption?.value ?? null),
                  taxPercent: i.taxCodeId != null ? (i.taxPercent != null ? Number(i.taxPercent) : 0) : (defaultTaxCodeOption?.rate ?? 0),
                  accountCode: i.accountCode || '', project: i.project || '', remarks: i.remarks || '',
                  batchAllocations: [], serialAllocations: [],
                })));
              }
              if (req.remarks) setValue('remarks', req.remarks, { shouldValidate: true });
              // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [requestNo]);

            // Backfill for the race none of the other call sites can cover on
            // their own: fires once Tax Codes finish loading, whether the
            // transfer is brand-new (Tax Codes weren't ready when
            // getEmptyValues ran), an existing saved transfer being edited
            // (a legacy line with no Tax Code of its own), or a row just
            // copied in from a Request whose own Tax Code hadn't loaded yet
            // either. A no-op once a row already has a Tax Code (the user's
            // own pick, or this effect already fired).
            useEffect(() => {
              if (!defaultTaxCodeOption) return;
              (watch('items') || []).forEach((it, idx) => {
                if (it.taxCodeId == null) {
                  setValue(`items.${idx}.taxCodeId`, defaultTaxCodeOption.value, { shouldValidate: true });
                  setValue(`items.${idx}.taxPercent`, defaultTaxCodeOption.rate, { shouldValidate: true });
                }
              });
              // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [defaultTaxCodeOption]);

            return (
              <>
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>Transfer Details</Typography>
                    <Button type="button" variant="outlined" color="inherit" startIcon={<ArrowBackIcon />} onClick={backToList}>
                      Back to List
                    </Button>
                  </Stack>
                  <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
                    <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                      <LabeledField label="Type *">
                        <FormSelect name="transferType" label="" options={TRANSFER_TYPE_OPTIONS.map((t) => ({ label: t, value: t }))} />
                      </LabeledField>
                      <LabeledField label="Material Transfer No. *">
                        <DocumentSeriesNoField documentCode="MT" seriesFieldName="seriesId" numberFieldName="transferNo" isCreate={!editingRow} />
                      </LabeledField>
                      <LabeledField label="Branch *">
                        {transferType === 'Branch Transfer' ? (
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Box sx={{ flex: '1 1 50%', minWidth: 0 }}>
                              <Typography variant="caption" sx={{ display: 'block', mb: 0.25, fontWeight: 600, color: 'text.secondary' }}>
                                From Branch *
                              </Typography>
                              <FormSelect name="branch" label="" placeholder="Select branch" options={branchOptions} />
                            </Box>
                            <Box sx={{ flex: '1 1 50%', minWidth: 0 }}>
                              <Typography variant="caption" sx={{ display: 'block', mb: 0.25, fontWeight: 600, color: 'text.secondary' }}>
                                To Branch *
                              </Typography>
                              <FormSelect name="toBranch" label="" placeholder="Select branch" options={toBranchOptionsFiltered} />
                            </Box>
                          </Box>
                        ) : (
                          <FormSelect name="branch" label="" placeholder="Select branch" options={branchOptions} />
                        )}
                      </LabeledField>
                      <LabeledField label="Document Date *">
                        <FormDatePicker name="documentDate" label="" />
                      </LabeledField>
                      <LabeledField label="Request No.">
                        <FormSelect name="requestNo" label="" placeholder={branch ? 'Select request' : 'Select branch first'} options={requestNoOptions} disabled={!branch} />
                      </LabeledField>
                      <LabeledField label="Status *">
                        <FormSelect name="status" label="" disabled options={statusOptions} />
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

                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    {/* Tabs sit OUTSIDE the read-only fieldset: a disabled
                        fieldset disables every button inside it, which would
                        make the E-Way Bill tab unclickable in View. */}
                    <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
                      <Tab label="Contents" />
                      <Tab label="Attachments" />
                      <Tab label="E-Way Bill" />
                    </Tabs>
                    <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>

                    {tab === 0 && (
                      <>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                          <Typography variant="subtitle1" fontWeight={700}>Item Details</Typography>
                          <Button
                            type="button"
                            variant="outlined"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={() => append({ ...newItem(defaultTaxCodeOption), toWarehouse: transitWarehouseCode })}
                          >
                            Add Item
                          </Button>
                        </Stack>

                        {isMobile ? (
                          <Box>
                            {fields.map((field, index) => {
                              const qty = Number(watch(`items.${index}.quantity`)) || 0;
                              const price = Number(watch(`items.${index}.itemCost`)) || 0;
                              const taxPct = Number(watch(`items.${index}.taxPercent`)) || 0;
                              return (
                                <MobileItemCard
                                  key={field.id}
                                  index={index}
                                  amount={round2(qty * price * (1 + taxPct / 100)).toFixed(2)}
                                  onRemove={() => removeItem(index)}
                                  removeDisabled={fields.length <= 1}
                                >
                                  <ProductCell index={index} methods={methods} options={productCodeOptions} products={products} priceListRates={priceListRates} dlpInfo={dlpRates} label="Item No. *" placeholder="Select item" />
                                  <ProductCell index={index} methods={methods} options={productNameOptions} products={products} priceListRates={priceListRates} dlpInfo={dlpRates} label="Name *" placeholder="Select item" />
                                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 1.5, rowGap: 1.5 }}>
                                    <FormSelect name={`items.${index}.fromWarehouse`} label="Issue Warehouse *" placeholder={branch ? 'Select' : 'Select branch first'} options={branchWarehouseOptions} disabled={!branch} />
                                    <TotalStockCell index={index} methods={methods} label="Total Stock" />
                                    {showTransitWhse && (
                                      <TransitWarehouseCell index={index} methods={methods} warehouseLabel={warehouseLabel} label="Transit Whse" />
                                    )}
                                    {showToWhse && (
                                      <FormSelect name={`items.${index}.toWarehouse`} label="To Whse *" placeholder={effectiveToBranch ? 'Select' : 'Select branch first'} options={toBranchWarehouseOptions} disabled={!effectiveToBranch} />
                                    )}
                                    <FormTextField name={`items.${index}.quantity`} label="Quantity *" type="number" />
                                    <FormTextField name={`items.${index}.itemCost`} label="Unit Price" type="number" />
                                    <FormSelect name={`items.${index}.taxCodeId`} label="Tax (%)" options={taxCodeOptions} popupFitContent onValueChange={(_v, option) => setValue(`items.${index}.taxPercent`, option ? option.rate : 0, { shouldValidate: true })} />
                                    <Box sx={{ gridColumn: '1 / -1' }}>
                                      <BatchSerialCell index={index} methods={methods} product={productsByCode[watch(`items.${index}.productCode`)]} onOpen={(mode) => setBatchDialog({ index, mode })} requireToWarehouse={showToWhse} />
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
                                <TableCell>Item No. *</TableCell>
                                <TableCell>Name *</TableCell>
                                <TableCell>Issue Warehouse *</TableCell>
                                <TableCell>Total Stock</TableCell>
                                {showTransitWhse && <TableCell>Transit Whse</TableCell>}
                                {showToWhse && <TableCell>To Whse *</TableCell>}
                                <TableCell>Quantity *</TableCell>
                                <TableCell>Unit Price</TableCell>
                                <TableCell>Tax (%)</TableCell>
                                <TableCell>Total (LC)</TableCell>
                                <TableCell>Batch/Serial Selection</TableCell>
                                <TableCell width={48}>Action</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {fields.map((field, index) => {
                                const qty = Number(watch(`items.${index}.quantity`)) || 0;
                                const price = Number(watch(`items.${index}.itemCost`)) || 0;
                                const taxPct = Number(watch(`items.${index}.taxPercent`)) || 0;
                                return (
                                  <TableRow key={field.id} sx={{ '& > td': { verticalAlign: 'middle' } }}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>
                                      <ProductCell index={index} methods={methods} options={productCodeOptions} products={products} priceListRates={priceListRates} dlpInfo={dlpRates} placeholder="Select item" sx={{ minWidth: 180 }} />
                                    </TableCell>
                                    <TableCell>
                                      <ProductCell index={index} methods={methods} options={productNameOptions} products={products} priceListRates={priceListRates} dlpInfo={dlpRates} placeholder="Select item" sx={{ minWidth: 200 }} />
                                    </TableCell>
                                    <TableCell>
                                      <FormSelect
                                        name={`items.${index}.fromWarehouse`}
                                        label=""
                                        placeholder={branch ? 'Select' : 'Select branch first'}
                                        options={branchWarehouseOptions}
                                        disabled={!branch}
                                        sx={{ minWidth: 150 }}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <TotalStockCell index={index} methods={methods} />
                                    </TableCell>
                                    {showTransitWhse && (
                                      <TableCell>
                                        <TransitWarehouseCell index={index} methods={methods} warehouseLabel={warehouseLabel} sx={{ minWidth: 150 }} />
                                      </TableCell>
                                    )}
                                    {showToWhse && (
                                      <TableCell>
                                        <FormSelect
                                          name={`items.${index}.toWarehouse`}
                                          label=""
                                          placeholder={effectiveToBranch ? 'Select' : 'Select branch first'}
                                          options={toBranchWarehouseOptions}
                                          disabled={!effectiveToBranch}
                                          sx={{ minWidth: 150 }}
                                        />
                                      </TableCell>
                                    )}
                                    <TableCell>
                                      <FormTextField name={`items.${index}.quantity`} label="" type="number" />
                                    </TableCell>
                                    <TableCell>
                                      <FormTextField name={`items.${index}.itemCost`} label="" type="number" />
                                    </TableCell>
                                    <TableCell>
                                      <FormSelect
                                        name={`items.${index}.taxCodeId`}
                                        label=""
                                        options={taxCodeOptions}
                                        disableClearable
                                        sx={{ minWidth: 96 }}
                                        popupFitContent
                                        onValueChange={(_v, option) => setValue(`items.${index}.taxPercent`, option ? option.rate : 0, { shouldValidate: true })}
                                      />
                                    </TableCell>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{round2(qty * price * (1 + taxPct / 100)).toFixed(2)}</TableCell>
                                    <TableCell>
                                      <BatchSerialCell index={index} methods={methods} product={productsByCode[watch(`items.${index}.productCode`)]} onOpen={(mode) => setBatchDialog({ index, mode })} requireToWarehouse={showToWhse} />
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
                      </>
                    )}

                    {tab === 1 && (
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
                    )}

                    {tab === 2 && (
                      <Box>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                          <Typography variant="subtitle1" fontWeight={700}>E-Way Bill</Typography>
                          <Chip size="small" label={ewayBillStatus} color={ewayStatusColor} />
                        </Stack>

                        {!isBranchTransferDoc && (
                          <Alert severity="info" sx={{ mb: 2 }}>
                            An e-way bill applies to a Branch Transfer only. A plain Stock Transfer moves stock between warehouses inside one branch, so no e-way bill is needed.
                          </Alert>
                        )}
                        {isBranchTransferDoc && approvalBlocksEWay && (
                          <Alert severity="warning" sx={{ mb: 2 }}>
                            {editingRow?.approvalStatus === 'Rejected'
                              ? 'The Stock Transfer Request for this transfer was rejected, so an e-way bill cannot be generated.'
                              : 'This transfer is waiting for its Stock Transfer Request to be approved. An e-way bill can be generated once it is approved.'}
                          </Alert>
                        )}

                        <FormGrid columns={2} singleColumnOnMobile rowSpacing={2.5} columnSpacing={FIELD_COLUMN_SPACING}>
                          <LabeledField label="E-Way Bill No">
                            <TextField value={editingRow?.ewayBillNo || ''} placeholder="Not generated" fullWidth size="small" helperText=" " InputProps={{ readOnly: true }} />
                          </LabeledField>
                          <LabeledField label="E-Way Bill Date">
                            <TextField value={editingRow?.ewayBillDate ? dayjs(editingRow.ewayBillDate).format('DD/MM/YYYY HH:mm') : ''} placeholder="—" fullWidth size="small" helperText=" " InputProps={{ readOnly: true }} />
                          </LabeledField>
                          <LabeledField label="Valid Upto">
                            <TextField value={editingRow?.ewayBillValidUpto ? dayjs(editingRow.ewayBillValidUpto).format('DD/MM/YYYY HH:mm') : ''} placeholder="—" fullWidth size="small" helperText=" " InputProps={{ readOnly: true }} />
                          </LabeledField>
                          <LabeledField label="Transport Mode">
                            <TextField
                              select
                              value={ewbTransportMode}
                              onChange={(e) => setEwbTransportMode(e.target.value)}
                              fullWidth
                              size="small"
                              helperText=" "
                              disabled={ewayBillStatus === 'Generated'}
                            >
                              {EWAY_TRANSPORT_MODES.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                            </TextField>
                          </LabeledField>
                          <LabeledField label="Transporter Name">
                            <TextField
                              value={ewbTransporterName}
                              onChange={(e) => setEwbTransporterName(e.target.value)}
                              placeholder="Transporter name"
                              fullWidth
                              size="small"
                              helperText=" "
                              disabled={ewayBillStatus === 'Generated'}
                            />
                          </LabeledField>
                          <LabeledField label="Transporter ID / GSTIN">
                            <TextField
                              value={ewbTransporterGstin}
                              onChange={(e) => setEwbTransporterGstin(e.target.value.toUpperCase().slice(0, 15))}
                              placeholder="15-digit GSTIN"
                              fullWidth
                              size="small"
                              helperText=" "
                              disabled={ewayBillStatus === 'Generated'}
                            />
                          </LabeledField>
                          <LabeledField label="Vehicle No">
                            <TextField
                              value={ewbVehicleNo}
                              onChange={(e) => setEwbVehicleNo(e.target.value.toUpperCase())}
                              placeholder="e.g. KA01AB1234"
                              fullWidth
                              size="small"
                              helperText=" "
                              disabled={ewayBillStatus === 'Generated'}
                            />
                          </LabeledField>
                          <LabeledField label="Distance (km)">
                            <TextField
                              value={ewbDistanceKm}
                              onChange={(e) => setEwbDistanceKm(e.target.value.replace(/[^0-9]/g, ''))}
                              placeholder="0"
                              fullWidth
                              size="small"
                              helperText=" "
                              disabled={ewayBillStatus === 'Generated'}
                            />
                          </LabeledField>
                        </FormGrid>

                        <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
                          <Button
                            type="button"
                            variant="contained"
                            size="small"
                            disabled={!canGenerateEWay || readOnly || ewayBillStatus === 'Generated' || generatingEWayBill}
                            onClick={handleGenerateEWayBill}
                          >
                            {generatingEWayBill ? 'Generating…' : 'Generate E-Way Bill'}
                          </Button>
                          <Button
                            type="button"
                            variant="outlined"
                            color="error"
                            size="small"
                            disabled={!editingRow?.ewayBillNo || readOnly || ewayBillStatus !== 'Generated' || cancellingEWayBill}
                            onClick={() => { setEwayError(''); setEwayCancelReason(''); setEwayCancelOpen(true); }}
                          >
                            Cancel E-Way Bill
                          </Button>
                        </Stack>
                        {!editingRow?.id && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                            Save the transfer before generating an e-way bill. It is generated from the saved document (From/To Branch, items and amounts), so save any changes first.
                          </Typography>
                        )}

                        {ewayError && (
                          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setEwayError('')}>
                            {ewayError}
                          </Alert>
                        )}

                        <Dialog open={ewayCancelOpen} onClose={() => setEwayCancelOpen(false)} maxWidth="xs" fullWidth>
                          <DialogTitle>Cancel E-Way Bill</DialogTitle>
                          <DialogContent>
                            <TextField
                              autoFocus
                              fullWidth
                              multiline
                              minRows={2}
                              label="Cancel Reason *"
                              placeholder="Reason for cancellation"
                              value={ewayCancelReason}
                              onChange={(e) => setEwayCancelReason(e.target.value)}
                              sx={{ mt: 1 }}
                            />
                          </DialogContent>
                          <DialogActions>
                            <Button onClick={() => setEwayCancelOpen(false)}>Close</Button>
                            <Button
                              variant="contained"
                              color="error"
                              disabled={!ewayCancelReason.trim() || cancellingEWayBill}
                              onClick={handleConfirmCancelEWayBill}
                            >
                              Confirm Cancel
                            </Button>
                          </DialogActions>
                        </Dialog>
                      </Box>
                    )}
                    </fieldset>
                  </CardContent>
                </Card>

              {batchDialog && batchDialog.index < fields.length && (
                <BatchSerialSelectionDialog
                  open
                  onClose={() => setBatchDialog(null)}
                  mode={batchDialog.mode}
                  readOnly={readOnly}
                  docNo={editingRow?.transferNo}
                  itemNumber={watch(`items.${batchDialog.index}.productCode`)}
                  itemDescription={watch(`items.${batchDialog.index}.productName`)}
                  warehouseCode={watch(`items.${batchDialog.index}.fromWarehouse`)}
                  warehouseName={warehouseLabel(watch(`items.${batchDialog.index}.fromWarehouse`))}
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

              <Card variant="outlined">
                <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                  <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
                    <Grid container rowSpacing={3} columnSpacing={{ xs: 3, md: 8 }}>
                      <Grid item xs={12} md={6}>
                        <FormGrid columns={1} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                          <LabeledField label="Journal Remarks">
                            <FormTextField name="journalRemarks" label="" placeholder="Enter journal remarks (optional)" multiline rows={3} />
                          </LabeledField>
                          <LabeledField label="Remarks">
                            <FormTextField name="remarks" label="" placeholder="Enter any remarks (optional)" multiline rows={3} />
                          </LabeledField>
                        </FormGrid>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.5, maxWidth: 420, ml: { md: 'auto' } }}>
                          {/* Same totals panel every Sales/Purchase document uses — see
                              computeTotals above for why discountField is null (Stock
                              Transfer has no header Discount %) and how interState is
                              decided. */}
                          <DocumentTotalsPanel totals={totals} interState={interState} subtotalLabel="Sub Total" discountField={null} showDiscount={false} />
                        </Box>
                      </Grid>
                    </Grid>
                  </fieldset>

                  <Grid container rowSpacing={3} columnSpacing={{ xs: 3, md: 8 }} sx={{ mt: 3 }} alignItems="flex-end">
                    <Grid item xs={12} md={6}>
                      <LabeledField label="Prepared By *">
                        <FormTextField name="preparedBy" label="" disabled />
                      </LabeledField>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1.5}
                        alignItems={{ xs: 'stretch', sm: 'center' }}
                        justifyContent={{ xs: 'stretch', sm: 'flex-end' }}
                        mb={{xs: 2, sm: "2px" }}
                      >
                        <Button fullWidth={isMobile} type="button" variant="outlined" color="inherit" startIcon={<CloseIcon />} onClick={backToList} disabled={creating || updating}>
                          Cancel
                        </Button>
                        <Button fullWidth={isMobile} type="button" variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => printStockTransfer()}>
                          Print
                        </Button>
                        {!readOnly && (
                          <FormSubmitButton
                            fullWidth={isMobile}
                            disabled={creating || updating}
                          >
                            {editingRow ? 'Update Transfer' : 'Save Transfer'}
                          </FormSubmitButton>
                        )}
                      </Stack>
                      {/* Invisible spacer matching the blank MuiFormHelperText row every
                          FormTextField/FormSelect reserves below itself (see FIELD_INPUT_SX
                          in LabeledField.jsx / reserveHelperSpace in FormSelect.jsx). Without
                          it, the "Prepared By" field's real bottom edge sits above this grid
                          item's bottom, while the buttons here have no such reserved row and
                          sit flush with it — bottom-aligning the two columns then left the
                          buttons visibly lower than the select box. Matching the same reserved
                          height here makes both columns' visible content bottoms coincide. */}
                      <Box sx={{ minHeight: '0.9em', lineHeight: 1.2, fontSize: '0.6875rem' }} />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              <StockTransferPrintable order={printOrder} company={company} branches={allBranchesForPrint} warehouses={allWarehouses} />

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
              <Typography variant="subtitle1" fontWeight={700}>Stock Transfer Issue List</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap sx={{ width: { xs: '100%', sm: 'auto' } }}>
                <TableSearchFilter table={table} placeholder="Search by transfer no..." showFilter={false} />
                <Stack direction="row" spacing={1.5}>
                  <Button size="small" variant="outlined" color="inherit" startIcon={<FilterListIcon />} onClick={() => setShowFilters((v) => !v)} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                    Filter
                  </Button>
                  <CanAdd>
                    <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                      Create Transfer
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
                  options={TYPE_FILTERS}
                  value={typeFilter}
                  onChange={(_e, v) => { setTypeFilter(v || 'All Types'); setPage(0); }}
                  disableClearable
                  renderInput={(params) => <TextField {...params} label="Type" InputLabelProps={{ shrink: true }} />}
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
                    title={row.transferNo}
                    statusChip={<Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />}
                    fields={[
                      { label: 'Type', value: row.transferType || '—' },
                      { label: 'Request Date', value: row.requestDate ? dayjs(row.requestDate).format('DD/MM/YYYY') : '—' },
                      {
                        label: 'Approval',
                        value: (
                          <Chip size="small" label={row.approvalStatus || 'Approved'} color={APPROVAL_STATUS_COLORS[row.approvalStatus] || 'success'} variant="outlined" />
                        ),
                      },
                    ]}
                    onEdit={() => handleEdit(row)}
                    onDelete={() => handleDelete(row)}
                  />
                ))}
                {!isLoading && filteredRows.length === 0 && (
                  <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No stock transfer issues found" message="Add your first stock transfer issue to get started" />
                )}
              </Box>
            ) : (
              <ScrollableTableContainer>
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    '& th, & td': {
                      height: STOCK_TRANSFER_LIST_TABLE_ROW_HEIGHT,
                      paddingTop: `${STOCK_TRANSFER_LIST_TABLE_CELL_PADDING_Y}px`,
                      paddingBottom: `${STOCK_TRANSFER_LIST_TABLE_CELL_PADDING_Y}px`,
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
                      <SortableHeaderCell field="transferNo" sort={table.sort} onSort={table.toggleSort}>Material Transfer No.</SortableHeaderCell>
                      <SortableHeaderCell field="transferType" sort={table.sort} onSort={table.toggleSort}>Type</SortableHeaderCell>
                      <SortableHeaderCell field="requestDate" sort={table.sort} onSort={table.toggleSort}>Request Date</SortableHeaderCell>
                      <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                      <SortableHeaderCell field="approvalStatus" sort={table.sort} onSort={table.toggleSort}>Approval</SortableHeaderCell>
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
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.transferNo}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.transferType || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.requestDate ? dayjs(row.requestDate).format('DD/MM/YYYY') : '—'}</TableCell>
                        <TableCell>
                          <Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={row.approvalStatus || 'Approved'} color={APPROVAL_STATUS_COLORS[row.approvalStatus] || 'success'} variant="outlined" />
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
                        <TableCell colSpan={8}>
                          <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No stock transfer issues found" message="Add your first stock transfer issue to get started" />
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
// Total Stock is pre-filled from the product's current opening stock (the
// same company-wide, not warehouse-scoped, approximation Stock Adjustment
// uses) — the authoritative figure used for the negative-stock guard is
// recomputed server-side from the live ledger at save time regardless of
// what is shown here. The item table's Unit Price field (itemCost
// internally) is filled from the product's Unit Price so the transfer can
// be costed; it stays editable.
function ProductCell({ index, methods, options, products, priceListRates, dlpInfo, label = '', placeholder = 'Select item', sx }) {
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
        setValue(`items.${index}.uom`, '');
        setValue(`items.${index}.unitPrice`, 0);
        setValue(`items.${index}.itemCost`, 0);
        prevValue.current = '';
        return;
      }
      const found = (products || []).find((p) => p.productCode === productCodeValue);
      if (found) {
        setValue(`items.${index}.productName`, found.productName, { shouldValidate: true });
        setValue(`items.${index}.uom`, found.uom || '', { shouldValidate: true });
        // Total Stock is no longer set from here — it's warehouse-scoped now
        // (see TotalStockCell below), and a product change alone doesn't
        // determine it without also knowing the row's From Warehouse.
        // Both unitPrice (kept for reference/back-compat) and the item
        // table's own Unit Price field (itemCost internally) come from
        // Product Master's own Unit Price (the same figure Price List
        // selection there autofills), not Cost Price.
        const priceListRate = priceListRates?.get(found.productCode) ?? priceListRates?.get(String(found.productCode).trim().toUpperCase());
        if (priceListRate == null && dlpInfo) notify.warning(dlpMissMessage(dlpInfo, found.productCode));
        const dlpPrice = priceListRate != null ? priceListRate : (found.unitPrice != null ? Number(found.unitPrice) : 0);
        setValue(`items.${index}.unitPrice`, dlpPrice, { shouldValidate: true });
        setValue(`items.${index}.itemCost`, dlpPrice, { shouldValidate: true });
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

// Total Stock is the row's own From Warehouse position for the row's own
// product — genuinely warehouse-scoped, not the company-wide approximation
// Stock Adjustment uses, because a transfer's whole point is moving stock out
// of ONE specific warehouse, and a company-wide figure could show plenty of
// stock while the actual From Warehouse has none. Reuses Product Master's
// Inventory tab endpoint (utils/productInventory.js), which already derives
// on-hand per warehouse from the same movement ledger the rest of the app
// reads — no new backend endpoint needed.
function TotalStockCell({ index, methods, label = '' }) {
  const { watch, setValue } = methods;
  const productCode = watch(`items.${index}.productCode`);
  const fromWarehouse = watch(`items.${index}.fromWarehouse`);
  const { data: inventory } = useGetProductInventoryQuery(productCode, { skip: !productCode });

  useEffect(() => {
    if (!productCode || !fromWarehouse) return;
    if (!inventory) return;
    const row = (inventory.rows || []).find((r) => r.warehouseCode === fromWarehouse);
    setValue(`items.${index}.totalStock`, row ? Number(row.onHand) || 0 : 0, { shouldValidate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productCode, fromWarehouse, inventory]);

  return <FormTextField name={`items.${index}.totalStock`} label={label} type="number" disabled />;
}

// Transit Warehouse isn't an independent choice on this document — it is
// autofilled (see the transitWarehouseCode effect above) from the destination
// branch's own Transit Warehouse (WarehouseMaster.isTransit) the moment To
// Branch is set, and simply stored in/mirrored from this row's own To
// Warehouse. Shown read-only, right before Quantity. A blank value once To
// Branch is picked means that branch has no warehouse flagged as its Transit
// Warehouse yet (Company Setup > Warehouse Master, General tab).
function TransitWarehouseCell({ index, methods, warehouseLabel, label = '', sx }) {
  const { watch } = methods;
  const toBranch = watch('toBranch');
  const toWarehouse = watch(`items.${index}.toWarehouse`);
  return (
    <TextField
      value={toWarehouse ? warehouseLabel(toWarehouse) : ''}
      placeholder={!toWarehouse && toBranch ? 'No Transit Warehouse set for To Branch' : ''}
      label={label}
      fullWidth
      size="small"
      disabled
      sx={sx}
    />
  );
}

// Shows nothing for a None-tracked (or unrecognised) product — the column
// only means something once Product Master's Manage Item By is Batch or
// Serial for the row's selected product. Otherwise a button that opens the
// matching "... - Selection" dialog (From Warehouse side only — relocation
// moves the same batch/serial row to the To Warehouse rather than picking
// anything new there), labelled with how much of the line is selected so
// far. Mirrors PurchaseReturn.jsx's BatchSerialCell.
function BatchSerialCell({ index, methods, product, onOpen, requireToWarehouse = true }) {
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

  // The dialog needs the row's Item No and Quantity to actually mean
  // anything (it allocates against this line's own product/quantity) — so
  // it stays disabled until those are filled in. To Warehouse is only
  // required here for a plain Stock Transfer, where it's a visible, manual
  // field on the row (showToWhse/requireToWarehouse true). For a Branch
  // Transfer the To Whse column is hidden entirely and its value is
  // auto-resolved from the destination branch's Transit Warehouse — the
  // user has no field to fill and no way to satisfy that requirement if
  // no Transit Warehouse is configured yet, so it must not block opening
  // the dialog (requireToWarehouse=false in that case).
  const toWarehouse = watch(`items.${index}.toWarehouse`);
  const mandatoryFilled = Boolean(product?.productCode) && (!requireToWarehouse || Boolean(toWarehouse)) && needed > 0;

  const button = (
    <Button
      type="button"
      size="small"
      variant="outlined"
      color={complete ? 'success' : 'warning'}
      startIcon={<Inventory2OutlinedIcon fontSize="small" />}
      onClick={() => onOpen(trackingMode)}
      disabled={!mandatoryFilled}
      sx={{ whiteSpace: 'nowrap' }}
    >
      {trackingMode}: {selected}/{needed}
    </Button>
  );

  if (mandatoryFilled) return button;
  return (
    <Tooltip title={requireToWarehouse ? 'Select Item No, To Whse and Quantity on this row first' : 'Select Item No and Quantity on this row first'} arrow>
      <span>{button}</span>
    </Tooltip>
  );
}
