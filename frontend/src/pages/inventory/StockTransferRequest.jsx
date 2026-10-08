import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box, Typography, Button, Card, CardContent, Stack, TextField, InputAdornment, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, Menu, MenuItem,
  ListItemIcon, ListItemText, Checkbox, Autocomplete, Popover, Grid, Tooltip, Collapse, Tabs, Tab,
} from '@mui/material';
import { useFieldArray } from 'react-hook-form';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
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
import StockTransferRequestPrintable, { printStockTransferRequest } from '../../components/print/StockTransferRequestPrintable';
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
import { stockTransferRequestSchema, STOCK_TRANSFER_REQUEST_STATUS_OPTIONS, TRANSFER_TYPE_OPTIONS } from '../../lib/validation/inventorySchemas';
import {
  stockTransferRequestApi, productApi, chartOfAccountApi, appUserApi, taxCodeApi, useGetTransferWarehousesQuery,
} from '../../features/resources';
import { buildTaxCodeOptions } from '../../lib/taxCodeOptions';
import DocumentTotalsPanel from '../../components/form/DocumentTotalsPanel';
import { useBranchNameOptions } from '../../lib/useBranchOptions';
import { useGetCompanyDetailsQuery } from '../../features/company/companyDetailsApi';
import { productOptionsFor, PRODUCT_USAGE } from '../../lib/productUsage';
import { useWarehouseOptions, useWarehouseLabeller, warehouseLabel as formatWarehouseLabel, warehouseCodesForBranch } from '../../lib/useWarehouseOptions';
import usePriceListRates, { dlpMissMessage } from '../../hooks/usePriceListRates';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer, { dragScrollbarSx } from '../../components/data-display/ScrollableTableContainer';
import { selectCurrentUser } from '../../store/authSlice';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import { canDelete } from '../../config/deleteConfig';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';

const emptyItem = {
  productCode: '', productName: '', toWarehouse: '', uom: '',
  quantity: '', transferredQuantity: 0, unitPrice: 0, itemCost: 0, taxCodeId: null, taxPercent: 0, accountCode: '', project: '', remarks: '',
};

// A brand-new row defaults its Tax (%) to the Kerala GST@18% Tax Code
// (the branches/warehouses this document moves stock between are all
// within Kerala) rather than starting blank — see defaultTaxCodeOption
// below, which resolves it by name from whatever Tax Codes are configured.
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
    requestNo: '', seriesId: '', branch: defaultBranch || '', toBranch: '', transferType: 'Stock Transfer', status: 'Open',
    requestDate: today, documentDate: today,
    preparedBy: preparedBy || '', remarks: '', attachmentName: '',
    items: [newItem(defaultTaxCodeOption)],
  };
}

// Same shared engine every Sales/Purchase document uses (documentTotals.js's
// buildDocument/computeTotals), reused rather than reimplemented — this
// document has no header Discount % (see DocumentTotalsPanel's
// discountField={null} below), so 0 is passed for it.
//
// `interState` decides CGST/SGST vs IGST — see
// resolveStockTransferRequestTaxTreatment in routes/resources.js for why
// this compares From Branch's state to To Branch's state instead of a
// customer's place of supply, same rule as StockTransfer.jsx's own
// computeTotals.
function computeTotals(items, taxCodeById, interState) {
  const lines = (items || []).map((i) => ({
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    taxPercent: i.taxPercent,
    taxType: taxCodeById?.get(i.taxCodeId)?.taxType || '',
  }));
  const { totals } = buildDocument(lines, 0, { interState, roundOff: true });
  return { ...totals, grandTotal: totals.amount };
}

// Per-row "Total (₹)" — quantity x unit price, grossed up by that row's own
// Tax %, so what's shown per line is the line's own final amount rather than
// just its pre-tax value. Mathematically this reconciles with the header's
// own Sub Total/Taxable Amount/CGST/SGST/Grand Total breakdown above (see
// computeTotals): with no header discount, buildDocument's per-line tax
// share is exactly this same qty x unitPrice x taxPercent/100, so the sum of
// every row's lineTotal equals the pre-round grand total, up to the Round
// Off line already shown there.
function lineTotal(item) {
  const quantity = Number(item?.quantity) || 0;
  const unitPrice = Number(item?.unitPrice) || 0;
  const taxPercent = Number(item?.taxPercent) || 0;
  return round2(quantity * unitPrice * (1 + taxPercent / 100));
}

// `defaultTaxCodeOption` fills in Kerala GST@18% (see newItem above) on any
// SAVED line that has no Tax Code of its own — a legacy request saved before
// this feature existed — without touching a line that already has one, even
// a different one the user genuinely picked.
function rowToFormValues(row, defaultTaxCodeOption) {
  return {
    requestNo: row.requestNo, seriesId: '', branch: row.branch || '',
    toBranch: row.toBranch || '', transferType: row.transferType || 'Stock Transfer',
    status: row.status || 'Open',
    requestDate: row.requestDate, documentDate: row.documentDate,
    preparedBy: row.preparedBy || '', remarks: row.remarks || '',
    attachmentName: row.attachmentName || '',
    items: (row.items && row.items.length ? row.items : [newItem(defaultTaxCodeOption)]).map((i) => ({
      productCode: i.productCode || '', productName: i.productName || '',
      toWarehouse: i.toWarehouse || '',
      uom: i.uom || '', quantity: i.quantity != null ? Number(i.quantity) : 0,
      transferredQuantity: i.transferredQuantity != null ? Number(i.transferredQuantity) : 0,
      unitPrice: i.unitPrice != null ? Number(i.unitPrice) : 0,
      itemCost: i.itemCost != null ? Number(i.itemCost) : 0,
      taxCodeId: i.taxCodeId != null ? Number(i.taxCodeId) : (defaultTaxCodeOption?.value ?? null),
      taxPercent: i.taxCodeId != null ? (i.taxPercent != null ? Number(i.taxPercent) : 0) : (defaultTaxCodeOption?.rate ?? 0),
      accountCode: i.accountCode || '', project: i.project || '', remarks: i.remarks || '',
    })),
  };
}

// Every per-row Warehouse dropdown reads from this same list — a warehouse
// belongs to a Branch (WarehouseMaster.branch), so once Branch is picked,
// every warehouse dropdown on the document is scoped to that branch's
// warehouses only.
//
// `keepValues` is one warehouse code or an array of them (every line's own
// Warehouse on the document being edited/viewed) that must stay selectable
// even if it's since gone Inactive or been reassigned to a different branch
// — without this, opening an older request whose saved warehouse no longer
// matches the current filter renders that row's select blank even though
// the value IS there on the form.
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
const STATUS_FILTERS = ['All Status', ...STOCK_TRANSFER_REQUEST_STATUS_OPTIONS];
const TYPE_FILTERS = ['All Types', ...TRANSFER_TYPE_OPTIONS];
const STATUS_COLORS = { Open: 'default', Closed: 'success' };
// Notification bell feature — approvalStatus is separate from the document's
// own Open/Closed status above (see schema.prisma's comment on
// StockTransferRequest.approvalStatus).
const APPROVAL_STATUS_COLORS = { Pending: 'warning', Approved: 'success', Rejected: 'error' };

const STOCK_TRANSFER_REQUEST_LIST_TABLE_ROW_HEIGHT = 0;
const STOCK_TRANSFER_REQUEST_LIST_TABLE_CELL_PADDING_Y = 6;
export default function StockTransferRequest() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const itemScrollRef = useDragScroll();
  const currentUser = useSelector(selectCurrentUser);
  const { data: requests, isLoading } = stockTransferRequestApi.useList();
  const { data: products } = productApi.useList();
  const { data: chartOfAccounts } = chartOfAccountApi.useList();
  const { data: appUsers } = appUserApi.useList();
  const { data: taxCodes } = taxCodeApi.useList();
  // Tax (%) is a Tax Code CFL, same convention as Stock Transfer/Stock
  // Transfer Receipt's own — see buildTaxCodeOptions: keyed by taxCodeId
  // (not the rate), so two Tax Codes that happen to share a rate both still
  // show up in the dropdown.
  const taxCodeOptions = useMemo(() => buildTaxCodeOptions(taxCodes), [taxCodes]);
  const taxCodeById = useMemo(() => new Map(taxCodeOptions.map((o) => [o.value, o])), [taxCodeOptions]);
  // Every new item row defaults its Tax (%) to this Tax Code rather than
  // starting blank — see newItem above. Matched by name (not by rate alone),
  // so it's resilient to another Tax Code that happens to also carry an 18%
  // rate.
  const defaultTaxCodeOption = useMemo(() => {
    // Match the Tax Code's own name exactly (not a substring of the option
    // label) — "Kerala GST@18%" and "Kerala GST@18% + TCS@1%" are two
    // different Tax Codes that happen to share the same 18% rate, and an
    // `includes` check on the label matched either one depending on array
    // order. The label is always `${taxName} (${rate}%)` (see
    // buildTaxCodeOptions in taxCodeOptions.js), so strip the trailing
    // " (<rate>%)" before comparing.
    const isExactKeralaGst18 = (label) =>
      String(label || '').replace(/\s*\([^()]*\)\s*$/, '').trim().toLowerCase() === 'kerala gst@18%';
    return taxCodeOptions.find((o) => isExactKeralaGst18(o.label)) || null;
  }, [taxCodeOptions]);
  // Company master — the printable's letterhead falls back to this when no
  // Branch is selected/matched, same as DeliveryChallanPrintable.jsx.
  const { data: company } = useGetCompanyDetailsQuery();
  const [create, { isLoading: creating }] = stockTransferRequestApi.useCreate();
  const [update, { isLoading: updating }] = stockTransferRequestApi.useUpdate();
  const [remove] = stockTransferRequestApi.useDelete();
  const warehouseLabel = useWarehouseLabeller();

  const productsByCode = useMemo(
    () => Object.fromEntries((products || []).map((p) => [p.productCode, p])),
    [products]
  );
  const accountOptions = useMemo(
    () => (chartOfAccounts || []).filter((a) => a.accountNature === 'A' && a.status !== 'I').map((a) => ({ label: `${a.accountName} (${a.accountCode})`, value: a.accountCode })),
    [chartOfAccounts]
  );
  // View toggles between the request list and the full-page Create/Edit
  // form — same page, no dialog/popup, matching Stock Transfer.
  const [view, setView] = useState('list');
  const [editingRow, setEditingRow] = useState(null);
  const { options: branchOptions } = useBranchNameOptions({ currentValue: editingRow?.branch });
  // Separate call so the destination side of a Branch Transfer request keeps
  // ITS OWN saved branch selectable — reusing branchOptions here would only
  // guarantee editingRow.branch stays visible, not editingRow.toBranch,
  // leaving the "Request to" box blank on edit/view whenever the signed-in
  // user isn't granted that branch (or it's since been deactivated).
  // branches (unrestricted) also doubles as the lookup list the printable
  // uses to resolve the From/To Branch address boxes — it needs every
  // branch's address regardless of which ones the signed-in user is granted.
  const { options: toBranchOptions, branches: allBranchesForPrint } = useBranchNameOptions({ currentValue: editingRow?.toBranch, restrictToUserBranches: false });

  const selectableProducts = productOptionsFor(
    products,
    PRODUCT_USAGE.INVENTORY,
    (editingRow?.items || []).map((i) => i.productCode)
  );
  const productCodeOptions = selectableProducts.map((p) => ({ label: p.productCode, value: p.productCode }));
  const productNameOptions = selectableProducts.map((p) => ({ label: p.productName, value: p.productCode }));

  // Unfiltered — used for the list view's Warehouse filter, which should
  // still search across every warehouse regardless of branch.
  const { options: allWarehouseOptions, warehouses: scopedWarehouses } = useWarehouseOptions({});
  // The item Warehouse dropdown draws from the DESTINATION branch, which a
  // non-admin usually has no branch grant for -- the branch-scoped master
  // list above never contains it, so merge in the unscoped transfer lookup.
  // Scoped rows win on a code clash (they carry the full record).
  const { data: transferWarehouses } = useGetTransferWarehousesQuery();
  // Unit Price auto-fills from the Active DLP price list (falls back to the
  // product's own Unit Price when the item isn't on it) — see ProductCell.
  const dlpRates = usePriceListRates('DLP', { alwaysRefetch: true });
  const priceListRates = dlpRates.rates;
  const allWarehouses = useMemo(() => {
    const byCode = new Map((transferWarehouses || []).map((w) => [w.whsCode, w]));
    (scopedWarehouses || []).forEach((w) => byCode.set(w.whsCode, w));
    return Array.from(byCode.values());
  }, [scopedWarehouses, transferWarehouses]);
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
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
  const pendingStatusRef = useRef('Open');

  const rows = requests || [];

  const baseTableRows = useMemo(() => {
    return rows.filter((r) => {
      const matchesType = typeFilter === 'All Types' || r.transferType === typeFilter;
      const matchesStatus = statusFilter === 'All Status' || r.status === statusFilter;
      const matchesWarehouse = !warehouseFilter || (r.items || []).some(
        (it) => it.toWarehouse === warehouseFilter.value
      );
      const rd = r.requestDate ? dayjs(r.requestDate) : null;
      const matchesFrom = !dateFrom || (rd && !rd.isBefore(dateFrom, 'day'));
      const matchesTo = !dateTo || (rd && !rd.isAfter(dateTo, 'day'));
      return matchesType && matchesStatus && matchesWarehouse && matchesFrom && matchesTo;
    });
  }, [rows, typeFilter, statusFilter, warehouseFilter, dateFrom, dateTo]);

  const tableColumns = useMemo(() => ([
    { field: 'id', headerName: 'Select', filter: false, searchable: false },
    { field: 'requestNo', headerName: 'Request No.', filter: 'text' },
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

  const [printRequestRequestNo, setPrintRequestRequestNo] = useState(null);

  const handlePrint = (row) => {
    setRowMenuAnchor(null);
    handleView(row);
    setPrintRequestRequestNo(row.requestNo);
  };

  useEffect(() => {
    if (!printRequestRequestNo) return;
    if (!editingRow || editingRow.requestNo !== printRequestRequestNo) return;

    const returnToListAfterPrint = () => {
      window.removeEventListener('afterprint', returnToListAfterPrint);
      setPrintRequestRequestNo(null);
      backToList();
    };

    window.addEventListener('afterprint', returnToListAfterPrint);
    printStockTransferRequest();
  }, [printRequestRequestNo, editingRow]);

  const handleDelete = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Delete stock transfer request',
      message: `Are you sure you want to delete "${row.requestNo}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Stock transfer request deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const removeSelected = async () => {
    const ok = await confirmDialog({
      title: 'Delete selected requests',
      message: `Delete ${checkedIds.length} selected request${checkedIds.length > 1 ? 's' : ''}? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await Promise.all(checkedIds.map((id) => remove(id).unwrap()));
      notify.success('Selected requests deleted');
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
        notify.success('Stock transfer request updated');
      } else {
        await create(payload).unwrap();
        notify.success('Stock transfer request saved');
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
        icon={<AssignmentOutlinedIcon />}
        title="Stock Transfer Request"
        subtitle={view === 'form' ? 'Request stock to be moved from one warehouse to another.' : 'Manage and track all stock transfer requests.'}
        rightContent={<CompanyBadge />}
      />

      {view === 'form' ? (
        <AppForm
          key={formKey}
          schema={stockTransferRequestSchema}
          defaultValues={editingRow ? rowToFormValues(editingRow, defaultTaxCodeOption) : getEmptyValues(currentUser?.defaultBranch, currentUser?.name || currentUser?.email, defaultTaxCodeOption)}
          onSubmit={handleSubmit}
        >
          {(methods) => {
            const { control, watch, setValue } = methods;
            const { fields, append, remove: removeItem } = useFieldArray({ control, name: 'items' });
            const watchedItems = watch('items') || [];

            // Branch Transfer requests have no per-line Warehouse — the column
            // is dropped (here, in the table, and in the mobile cards) and any
            // previously picked warehouse is cleared; see the effect below.
            const showWarehouseCol = watch('transferType') !== 'Branch Transfer';
            const itemColumnsSx = itemTableSx(watchedItems, [
              null,
              { header: 'Item No. *', get: (i) => i?.productCode, field: 'select' },
              { header: 'Name *', get: (i) => i?.productName, field: 'select' },
              ...(showWarehouseCol ? [{ header: 'Warehouse *', get: (i) => i?.toWarehouse, field: 'select' }] : []),
              { header: 'Quantity *', get: (i) => i?.quantity, field: 'text' },
              { header: 'Unit Price', get: (i) => i?.unitPrice, field: 'text' },
              { header: 'Tax (%)', get: (i) => taxCodeById.get(i?.taxCodeId)?.label ?? i?.taxPercent, field: 'select' },
              { header: 'Total (₹)', get: (i) => lineTotal(i).toFixed(2), field: 'plain', min: 110 },
              null,
            ]);
            // The DLP rates load asynchronously — if an item was picked before
            // they arrived it kept Unit Price 0. Once they're in, fill any
            // still-zero price on a NEW request (never on a saved one being
            // viewed/edited, and never over a price the user typed).
            useEffect(() => {
              if (editingRow || !priceListRates || priceListRates.size === 0) return;
              (watch('items') || []).forEach((it, idx) => {
                if (!it?.productCode || Number(it.unitPrice) > 0) return;
                const rate = priceListRates.get(it.productCode) ?? priceListRates.get(String(it.productCode).trim().toUpperCase());
                if (rate != null) setValue(`items.${idx}.unitPrice`, rate, { shouldValidate: true });
              });
              // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [priceListRates]);
            const branch = watch('branch');
            const toBranch = watch('toBranch');
            const transferType = watch('transferType');
            // Same interState rule as StockTransfer.jsx's own computeTotals —
            // a plain Stock Transfer (no To Branch) always falls back to
            // intra-state.
            const branchStateByName = new Map((allBranchesForPrint || []).map((b) => [String(b.branchName || '').trim(), b.state || '']));
            const interState = transferType === 'Branch Transfer'
              ? isInterState(branchStateByName.get(String(toBranch || '').trim()), branchStateByName.get(String(branch || '').trim()))
              : false;
            const totals = computeTotals(watchedItems, taxCodeById, interState);
            // Print — A4 landscape design (see StockTransferRequestPrintable.jsx).
            // Rendered off the form's live watched values so a Print
            // triggered mid-edit reflects whatever is on screen, not just
            // what was last saved.
            const printOrder = watch();
            // Which branch scopes the item Warehouse dropdown: for a plain
            // Stock Transfer request there's only one branch; for a Branch
            // Transfer request, the destination side uses the separate To
            // Branch field.
            const effectiveToBranch = transferType === 'Branch Transfer' ? toBranch : branch;
            // A Branch Transfer request moves stock OUT of From Branch, so it
            // can't also be the destination — drop whichever branch is
            // currently selected as From Branch from the "Request to" list.
            // Recomputed on every render off the live watch()ed value (not
            // just the saved editingRow.branch this page opened with) so
            // switching From Branch immediately removes it from "Request to"
            // too.
            const toBranchOptionsFiltered = branch
              ? toBranchOptions.filter((o) => o.value !== branch)
              : toBranchOptions;
            const [tab, setTab] = useState(0);

            // Every warehouse dropdown on this document — each item row's own
            // Warehouse — draws from this same branch-scoped list. With no
            // branch chosen yet there is nothing to offer. Every line's own
            // saved Warehouse is passed as keepValues so opening an existing
            // request for edit/view doesn't blank a row whose warehouse has
            // since gone Inactive or moved to another branch.
            const branchWarehouseOptions = useMemo(
              () => warehouseOptionsForBranch(allWarehouses, effectiveToBranch, (editingRow?.items || []).map((i) => i.toWarehouse)),
              [allWarehouses, effectiveToBranch, editingRow]
            );

            const handleFile = (file) => {
              if (file) setValue('attachmentName', file.name, { shouldValidate: true });
            };

            // Switching Branch (or To Branch, or Type) invalidates any
            // per-row warehouse choice that doesn't belong to the new
            // effective branch; a warehouse picked under one branch has no
            // meaning under another. Skipped on the very first render so
            // loading an existing record for edit/view doesn't wipe values
            // it just loaded.
            const prevBranchRef = useRef(effectiveToBranch);
            useEffect(() => {
              if (prevBranchRef.current === effectiveToBranch) return;
              prevBranchRef.current = effectiveToBranch;
              const allowed = warehouseCodesForBranch(allWarehouses, effectiveToBranch);
              (watch('items') || []).forEach((it, idx) => {
                if (it.toWarehouse && !allowed.has(it.toWarehouse)) setValue(`items.${idx}.toWarehouse`, '');
              });
              // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [effectiveToBranch]);

            // Switching Type to Branch Transfer hides the Warehouse column, so
            // drop any warehouse already picked on the rows — otherwise the
            // now-invisible values would be saved. Skipped on first render so
            // an existing record loads untouched.
            const prevTransferTypeRef = useRef(transferType);
            useEffect(() => {
              if (prevTransferTypeRef.current === transferType) return;
              prevTransferTypeRef.current = transferType;
              if (transferType !== 'Branch Transfer') return;
              (watch('items') || []).forEach((it, idx) => {
                if (it.toWarehouse) setValue(`items.${idx}.toWarehouse`, '');
              });
              // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [transferType]);

            // From Branch and "Request to" can't be the same branch (see
            // toBranchOptionsFiltered above, which hides this branch from the
            // "Request to" list) — if the newly-picked From Branch matches
            // what's already sitting in "Request to", clear it rather than
            // leaving a now-hidden value stuck in the field. Skipped on the
            // very first render for the same reason as the effect above.
            const prevFromBranchRef = useRef(branch);
            useEffect(() => {
              if (prevFromBranchRef.current === branch) return;
              prevFromBranchRef.current = branch;
              if (watch('toBranch') === branch) setValue('toBranch', '');
              // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [branch]);

            // Backfill for the race none of the other call sites can cover on
            // their own: this fires once Tax Codes finish loading, whether
            // the request is brand-new (Tax Codes weren't ready when
            // getEmptyValues ran) or an existing saved request being edited
            // (a legacy line with no Tax Code of its own, which
            // rowToFormValues already tried to default at form-init time but
            // could only do if Tax Codes had loaded by then). A no-op once a
            // row already has a Tax Code (the user's own pick, or this
            // effect already fired).
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
                    <Typography variant="subtitle1" fontWeight={700}>Request Details</Typography>
                    <Button type="button" variant="outlined" color="inherit" startIcon={<ArrowBackIcon />} onClick={backToList}>
                      Back to List
                    </Button>
                  </Stack>
                  <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
                    <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                      <LabeledField label="Type *">
                        <FormSelect name="transferType" label="" options={TRANSFER_TYPE_OPTIONS.map((t) => ({ label: t, value: t }))} />
                      </LabeledField>
                      <LabeledField label="Request No. *">
                        <DocumentSeriesNoField documentCode="MR" seriesFieldName="seriesId" numberFieldName="requestNo" isCreate={!editingRow} />
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
                                Request to *
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
                      <LabeledField label="Status *">
                        <FormSelect name="status" label="" disabled options={STOCK_TRANSFER_REQUEST_STATUS_OPTIONS.map((s) => ({ label: s, value: s }))} />
                      </LabeledField>
                    </FormGrid>
                  </fieldset>
                </CardContent>
              </Card>

              <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
                      <Tab label="Contents" />
                      <Tab label="Attachments" />
                    </Tabs>

                    {tab === 0 && (
                      <>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                          <Typography variant="subtitle1" fontWeight={700}>Item Details</Typography>
                          <Button
                            type="button"
                            variant="outlined"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={() => append(newItem(defaultTaxCodeOption))}
                          >
                            Add Item
                          </Button>
                        </Stack>

                        {isMobile ? (
                          <Box>
                            {fields.map((field, index) => {
                              const item = watchedItems[index];
                              return (
                                <MobileItemCard
                                  key={field.id}
                                  index={index}
                                  amount={lineTotal(item).toFixed(2)}
                                  onRemove={() => removeItem(index)}
                                  removeDisabled={fields.length <= 1}
                                >
                                  <ProductCell index={index} methods={methods} options={productCodeOptions} products={products} priceListRates={priceListRates} dlpInfo={dlpRates} label="Item No. *" placeholder="Select item" />
                                  <ProductCell index={index} methods={methods} options={productNameOptions} products={products} priceListRates={priceListRates} dlpInfo={dlpRates} label="Name *" placeholder="Select item" />
                                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 1.5, rowGap: 1.5 }}>
                                    {showWarehouseCol ? (
                                      <FormSelect name={`items.${index}.toWarehouse`} label="Warehouse *" placeholder={effectiveToBranch ? 'Select' : 'Select branch first'} options={branchWarehouseOptions} disabled={!effectiveToBranch} />
                                    ) : null}
                                    <FormTextField name={`items.${index}.quantity`} label="Quantity *" type="number" />
                                    <FormTextField name={`items.${index}.unitPrice`} label="Unit Price" type="number" />
                                    <FormSelect
                                      name={`items.${index}.taxCodeId`}
                                      label="Tax (%)"
                                      options={taxCodeOptions}
                                      popupFitContent
                                      onValueChange={(_v, option) => setValue(`items.${index}.taxPercent`, option ? option.rate : 0, { shouldValidate: true })}
                                    />
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
                                {showWarehouseCol ? <TableCell>Warehouse *</TableCell> : null}
                                <TableCell>Quantity *</TableCell>
                                <TableCell>Unit Price</TableCell>
                                <TableCell>Tax (%)</TableCell>
                                <TableCell>Total (₹)</TableCell>
                                <TableCell width={48}>Action</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {fields.map((field, index) => {
                                const item = watchedItems[index];
                                return (
                                  <TableRow key={field.id} sx={{ '& > td': { verticalAlign: 'middle' } }}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>
                                      <ProductCell index={index} methods={methods} options={productCodeOptions} products={products} priceListRates={priceListRates} dlpInfo={dlpRates} placeholder="Select item" sx={{ minWidth: 180 }} />
                                    </TableCell>
                                    <TableCell>
                                      <ProductCell index={index} methods={methods} options={productNameOptions} products={products} priceListRates={priceListRates} dlpInfo={dlpRates} placeholder="Select item" sx={{ minWidth: 200 }} />
                                    </TableCell>
                                    {showWarehouseCol ? (
                                      <TableCell>
                                        <FormSelect
                                          name={`items.${index}.toWarehouse`}
                                          label=""
                                          placeholder={effectiveToBranch ? 'Select' : 'Select branch first'}
                                          options={branchWarehouseOptions}
                                          disabled={!effectiveToBranch}
                                          sx={{ minWidth: 150 }}
                                        />
                                      </TableCell>
                                    ) : null}
                                    <TableCell>
                                      <FormTextField name={`items.${index}.quantity`} label="" type="number" />
                                    </TableCell>
                                    <TableCell>
                                      <FormTextField name={`items.${index}.unitPrice`} label="" type="number" />
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
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{lineTotal(item).toFixed(2)}</TableCell>
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
                  </CardContent>
                </Card>
              </fieldset>

              <Card variant="outlined">
                <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                  <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={4}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Prepared By *</Typography>
                        <FormTextField name="preparedBy" label="" disabled />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Remarks</Typography>
                        <FormTextField name="remarks" label="" placeholder="Enter any remarks (optional)" multiline rows={3} />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.5 }}>
                          {/* Same totals panel every Sales/Purchase document uses — see
                              computeTotals above for why discountField is null (a Stock
                              Transfer Request has no header Discount %) and how interState
                              is decided. */}
                          <DocumentTotalsPanel totals={totals} interState={interState} subtotalLabel="Sub Total" discountField={null} showDiscount={false} />
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
                    <Button fullWidth={isMobile} type="button" variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => printStockTransferRequest()}>
                      Print
                    </Button>
                    {!readOnly && (
                      <FormSubmitButton
                        fullWidth={isMobile}
                        onClick={() => { pendingStatusRef.current = editingRow?.status || 'Open'; }}
                        disabled={creating || updating}
                      >
                        {editingRow ? 'Update Request' : 'Save Request'}
                      </FormSubmitButton>
                    )}
                  </Stack>

                  <StockTransferRequestPrintable order={printOrder} company={company} branches={allBranchesForPrint} warehouses={allWarehouses} />
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
              <Typography variant="subtitle1" fontWeight={700}>Stock Transfer Request List</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap sx={{ width: { xs: '100%', sm: 'auto' } }}>
                <TableSearchFilter table={table} placeholder="Search by request no..." showFilter={false} />
                <Stack direction="row" spacing={1.5}>
                  <Button size="small" variant="outlined" color="inherit" startIcon={<FilterListIcon />} onClick={() => setShowFilters((v) => !v)} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                    Filter
                  </Button>
                  <CanAdd>
                    <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                      Create Request
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
                    title={row.requestNo}
                    statusChip={<Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />}
                    fields={[
                      { label: 'Type', value: row.transferType || '—' },
                      { label: 'Request Date', value: row.requestDate ? dayjs(row.requestDate).format('DD/MM/YYYY') : '—' },
                      {
                        label: 'Approval',
                        value: (
                          <Chip size="small" label={row.approvalStatus || 'Pending'} color={APPROVAL_STATUS_COLORS[row.approvalStatus] || 'warning'} variant="outlined" />
                        ),
                      },
                    ]}
                    onEdit={() => handleEdit(row)}
                    onDelete={() => handleDelete(row)}
                  />
                ))}
                {!isLoading && filteredRows.length === 0 && (
                  <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No stock transfer requests found" message="Add your first stock transfer request to get started" />
                )}
              </Box>
            ) : (
              <ScrollableTableContainer>
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    '& th, & td': {
                      height: STOCK_TRANSFER_REQUEST_LIST_TABLE_ROW_HEIGHT,
                      paddingTop: `${STOCK_TRANSFER_REQUEST_LIST_TABLE_CELL_PADDING_Y}px`,
                      paddingBottom: `${STOCK_TRANSFER_REQUEST_LIST_TABLE_CELL_PADDING_Y}px`,
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
                      <SortableHeaderCell field="requestNo" sort={table.sort} onSort={table.toggleSort}>Request No.</SortableHeaderCell>
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
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.requestNo}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.transferType || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.requestDate ? dayjs(row.requestDate).format('DD/MM/YYYY') : '—'}</TableCell>
                        <TableCell>
                          <Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={row.approvalStatus || 'Pending'} color={APPROVAL_STATUS_COLORS[row.approvalStatus] || 'warning'} variant="outlined" />
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
                          <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No stock transfer requests found" message="Add your first stock transfer request to get started" />
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
// Unit Price/Item Cost are filled from the product's cost price so the
// request can be costed; both stay editable.
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
        setValue(`items.${index}.taxCodeId`, null);
        setValue(`items.${index}.taxPercent`, 0);
        prevValue.current = '';
        return;
      }
      const found = (products || []).find((p) => p.productCode === productCodeValue);
      if (found) {
        setValue(`items.${index}.productName`, found.productName, { shouldValidate: true });
        setValue(`items.${index}.uom`, found.uom || '', { shouldValidate: true });
        // Unit Price comes from the Active DLP price list; an item not on
        // it falls back to Product Master's own Unit Price. Item Cost is a
        // separate, costing-only figure and keeps reading Cost Price.
        const priceListRate = priceListRates?.get(found.productCode) ?? priceListRates?.get(String(found.productCode).trim().toUpperCase());
        if (priceListRate == null && dlpInfo) notify.warning(dlpMissMessage(dlpInfo, found.productCode));
        setValue(`items.${index}.unitPrice`, priceListRate != null ? priceListRate : (found.unitPrice != null ? Number(found.unitPrice) : 0), { shouldValidate: true });
        setValue(`items.${index}.itemCost`, found.costPrice != null ? Number(found.costPrice) : 0, { shouldValidate: true });
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
