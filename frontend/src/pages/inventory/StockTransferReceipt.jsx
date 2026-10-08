import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box, Typography, Button, Card, CardContent, Stack, TextField, InputAdornment, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, Menu, MenuItem,
  ListItemIcon, ListItemText, Checkbox, Autocomplete, Popover, Grid, Tooltip, Collapse, Tabs, Tab,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { useFieldArray } from 'react-hook-form';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import MoveToInboxOutlinedIcon from '@mui/icons-material/MoveToInboxOutlined';
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
import StockTransferReceiptPrintable, { printStockTransferReceipt } from '../../components/print/StockTransferReceiptPrintable';
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
import { stockTransferReceiptSchema, TRANSFER_TYPE_OPTIONS, STOCK_TRANSFER_RECEIPT_STATUS_OPTIONS } from '../../lib/validation/inventorySchemas';
import {
  stockTransferReceiptApi, stockTransferApi, stockTransferRequestApi, productApi, chartOfAccountApi, appUserApi, taxCodeApi,
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
import { selectCurrentUser } from '../../store/authSlice';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import { canDelete } from '../../config/deleteConfig';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';

const emptyItem = {
  productCode: '', productName: '', fromWarehouse: '', toWarehouse: '', uom: '',
  transferQuantity: 0, quantity: '', unitPrice: 0, itemCost: 0, taxCodeId: null, taxPercent: 0, accountCode: '', project: '', remarks: '',
};

// Every brand-new row starts on the same default Tax Code as the other
// Stock Transfer documents — Kerala GST@18% — rather than blank, unless Tax
// Codes haven't loaded yet (defaultTaxCodeOption is null until they have).
function newItem(defaultTaxCodeOption) {
  return {
    ...emptyItem,
    taxCodeId: defaultTaxCodeOption?.value ?? null,
    taxPercent: defaultTaxCodeOption?.rate ?? 0,
  };
}

function getEmptyValues(preparedBy, defaultTaxCodeOption) {
  const today = new Date();
  return {
    receiptNo: '', seriesId: '', branch: '', toBranch: '', transferType: 'Stock Transfer', status: 'Draft', requestNo: '', transferNo: '', transferDate: null,
    documentDate: today,
    preparedBy: preparedBy || '', remarks: '', attachmentName: '',
    items: [newItem(defaultTaxCodeOption)],
  };
}

// Same shared engine every Sales/Purchase document uses (documentTotals.js's
// buildDocument/computeTotals) — see StockTransfer.jsx's own computeTotals
// for the identical reasoning. A line's amount here is quantity x unit
// price (this document's own established basis — see toStockTransferReceiptItemData,
// unlike Stock Transfer's itemCost). No header Discount % on this document.
//
// `interState` is decided by comparing this receipt's own `branch` (its FROM
// branch) against whichever destination branch the referenced Stock
// Transfer/Stock Transfer Request carries — see
// resolveStockTransferReceiptTaxTreatment in routes/resources.js and
// effectiveToBranch below, which is exactly the same lookup done here.
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

// Row-level "Total (LC)" — tax-inclusive, same convention as the other Stock
// Transfer documents' own lineTotal: qty * unit price * (1 + tax% / 100).
function lineTotal(item) {
  const quantity = Number(item?.quantity) || 0;
  const unitPrice = Number(item?.unitPrice) || 0;
  const taxPercent = Number(item?.taxPercent) || 0;
  return round2(quantity * unitPrice * (1 + taxPercent / 100));
}

// `defaultTaxCodeOption` fills in Kerala GST@18% on any SAVED line with no
// Tax Code of its own (a legacy receipt saved before this feature existed) —
// a line that already has a real Tax Code (even a different one) is left
// untouched.
function rowToFormValues(row, defaultTaxCodeOption) {
  return {
    receiptNo: row.receiptNo, seriesId: '', branch: row.branch || '',
    toBranch: row.toBranch || '', transferType: row.transferType || 'Stock Transfer',
    status: row.status || 'Draft',
    requestNo: row.requestNo || '',
    transferNo: row.transferNo || '', transferDate: row.transferDate || null,
    documentDate: row.documentDate,
    preparedBy: row.preparedBy || '', remarks: row.remarks || '',
    attachmentName: row.attachmentName || '',
    items: (row.items && row.items.length ? row.items : [newItem(defaultTaxCodeOption)]).map((i) => ({
      productCode: i.productCode || '', productName: i.productName || '',
      fromWarehouse: i.fromWarehouse || '',
      toWarehouse: i.toWarehouse || '',
      uom: i.uom || '',
      transferQuantity: i.transferQuantity != null ? Number(i.transferQuantity) : 0,
      quantity: i.quantity != null ? Number(i.quantity) : 0,
      unitPrice: i.unitPrice != null ? Number(i.unitPrice) : 0,
      itemCost: i.itemCost != null ? Number(i.itemCost) : 0,
      taxCodeId: i.taxCodeId != null ? Number(i.taxCodeId) : (defaultTaxCodeOption?.value ?? null),
      taxPercent: i.taxCodeId != null ? (i.taxPercent != null ? Number(i.taxPercent) : 0) : (defaultTaxCodeOption?.rate ?? 0),
      accountCode: i.accountCode || '', project: i.project || '', remarks: i.remarks || '',
    })),
  };
}

// Every per-row From/To Warehouse dropdown reads from this same list — a
// warehouse belongs to a Branch (WarehouseMaster.branch), so once Branch is
// picked, every warehouse dropdown on the document (there is no directional
// split; From and To simply must differ from each other) is scoped to that
// branch's warehouses only.
//
// `keepValues` is one warehouse code or an array of them (every line's own
// From/To Warehouse on the document being edited/viewed) that must stay
// selectable even if it's since gone Inactive or been reassigned to a
// different branch — without this, opening an older receipt whose saved
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
const STATUS_FILTERS = ['All Status', ...STOCK_TRANSFER_RECEIPT_STATUS_OPTIONS];
const STATUS_COLORS = { Draft: 'default', Confirmed: 'success', Cancelled: 'error' };

const STOCK_TRANSFER_RECEIPT_LIST_TABLE_ROW_HEIGHT = 0;
const STOCK_TRANSFER_RECEIPT_LIST_TABLE_CELL_PADDING_Y = 6;
export default function StockTransferReceipt() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const itemScrollRef = useDragScroll();
  const currentUser = useSelector(selectCurrentUser);
  const { data: receipts, isLoading } = stockTransferReceiptApi.useList();
  // Source Stock Transfer list — used only to power the "Stock Transfer No."
  // Autocomplete below, matching by transferNo. transferNo itself stays a
  // plain string reference on the receipt (no FK), same as the backend.
  const { data: sourceTransfers } = stockTransferApi.useList();
  // Source Stock Transfer Request list — powers the "Stock Request No."
  // select below, matching by requestNo. Same no-FK, string-reference
  // convention as transferNo above.
  const { data: sourceRequests } = stockTransferRequestApi.useList();
  const { data: products } = productApi.useList();
  const { data: chartOfAccounts } = chartOfAccountApi.useList();
  const { data: appUsers } = appUserApi.useList();
  const { data: taxCodes } = taxCodeApi.useList();
  // Tax (%) is a Tax Code CFL — see the identical comment on StockTransfer.jsx.
  const taxCodeOptions = useMemo(() => buildTaxCodeOptions(taxCodes), [taxCodes]);
  const taxCodeById = useMemo(() => new Map(taxCodeOptions.map((o) => [o.value, o])), [taxCodeOptions]);
  // Default Tax Code for a brand-new row — same "Kerala GST@18%" convention
  // as the other Stock Transfer documents. Matched on the Tax Code's own
  // name exactly (label minus its trailing " (<rate>%)"), not a substring of
  // the label — "Kerala GST@18%" and "Kerala GST@18% + TCS@1%" are two
  // different Tax Codes that happen to share the same 18% rate.
  const defaultTaxCodeOption = useMemo(() => {
    const isExactKeralaGst18 = (label) =>
      String(label || '').replace(/\s*\([^()]*\)\s*$/, '').trim().toLowerCase() === 'kerala gst@18%';
    return taxCodeOptions.find((o) => isExactKeralaGst18(o.label)) || null;
  }, [taxCodeOptions]);
  // Company master — the printable's letterhead falls back to this when no
  // Branch is selected/matched, same as StockTransfer.jsx/StockTransferRequest.jsx.
  const { data: company } = useGetCompanyDetailsQuery();
  const [create, { isLoading: creating }] = stockTransferReceiptApi.useCreate();
  const [update, { isLoading: updating }] = stockTransferReceiptApi.useUpdate();
  const [remove] = stockTransferReceiptApi.useDelete();
  const warehouseLabel = useWarehouseLabeller();

  const productsByCode = useMemo(
    () => Object.fromEntries((products || []).map((p) => [p.productCode, p])),
    [products]
  );
  const accountOptions = useMemo(
    () => (chartOfAccounts || []).filter((a) => a.accountNature === 'A' && a.status !== 'I').map((a) => ({ label: `${a.accountName} (${a.accountCode})`, value: a.accountCode })),
    [chartOfAccounts]
  );
  const transferNoOptions = useMemo(
    () => (sourceTransfers || []).map((t) => t.transferNo).filter(Boolean),
    [sourceTransfers]
  );

  // View toggles between the receipt list and the full-page Create/Edit
  // form — same page, no dialog/popup, matching Stock Transfer.
  const [view, setView] = useState('list');
  const [editingRow, setEditingRow] = useState(null);
  // Unit Price auto-fills from the Active DLP price list (falls back to the
  // product's own Unit Price when the item isn't on it) — see ProductCell.
  const dlpRates = usePriceListRates('DLP', { alwaysRefetch: true });
  const priceListRates = dlpRates.rates;
  const { options: branchOptions } = useBranchNameOptions({ currentValue: editingRow?.branch });
  // Separate call so the destination side of a Branch Transfer keeps ITS OWN
  // saved branch selectable — same reasoning as StockTransfer.jsx's own
  // toBranchOptions. `branches` (unrestricted) also doubles as the lookup
  // list the printable uses to resolve the From/To Branch address boxes.
  const { options: toBranchOptions, branches: allBranchesForPrint } = useBranchNameOptions({ currentValue: editingRow?.toBranch, restrictToUserBranches: false });

  // Stock Request No. select — sourced from the Stock Transfer Request list
  // (matched by requestNo, no FK, same convention as Stock Transfer No.
  // above). Kept selectable even if the referenced request has since been
  // deleted, so opening an existing receipt for edit/view doesn't blank it.
  const requestNoOptions = useMemo(() => {
    const out = (sourceRequests || []).map((r) => ({ label: r.requestNo, value: r.requestNo })).filter((o) => o.value);
    const current = editingRow?.requestNo || '';
    if (current && !out.some((o) => o.value === current)) {
      out.unshift({ label: `${current} (not available)`, value: current });
    }
    return out;
  }, [sourceRequests, editingRow]);

  const selectableProducts = productOptionsFor(
    products,
    PRODUCT_USAGE.INVENTORY,
    (editingRow?.items || []).map((i) => i.productCode)
  );
  const productCodeOptions = selectableProducts.map((p) => ({ label: p.productCode, value: p.productCode }));
  const productNameOptions = selectableProducts.map((p) => ({ label: p.productName, value: p.productCode }));

  // Unfiltered — used for the list view's Warehouse filter, which should
  // still search across every warehouse regardless of branch.
  const { options: allWarehouseOptions, warehouses: allWarehouses } = useWarehouseOptions({});
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
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

  const rows = receipts || [];

  const baseTableRows = useMemo(() => {
    return rows.filter((r) => {
      const matchesStatus = statusFilter === 'All Status' || r.status === statusFilter;
      const matchesWarehouse = !warehouseFilter || (r.items || []).some(
        (it) => it.fromWarehouse === warehouseFilter.value || it.toWarehouse === warehouseFilter.value
      );
      const rd = r.documentDate ? dayjs(r.documentDate) : null;
      const matchesFrom = !dateFrom || (rd && !rd.isBefore(dateFrom, 'day'));
      const matchesTo = !dateTo || (rd && !rd.isAfter(dateTo, 'day'));
      return matchesStatus && matchesWarehouse && matchesFrom && matchesTo;
    });
  }, [rows, statusFilter, warehouseFilter, dateFrom, dateTo]);

  const tableColumns = useMemo(() => ([
    { field: 'id', headerName: 'Select', filter: false, searchable: false },
    { field: 'receiptNo', headerName: 'Receipt No.', filter: 'text' },
    { field: 'transferNo', headerName: 'Stock Transfer No.', filter: 'text' },
    { field: 'documentDate', headerName: 'Document Date', filter: 'dateRange', sortValue: (row) => (row.documentDate ? new Date(row.documentDate).getTime() : null) },
    { field: 'amount', headerName: 'Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.amount == null || row.amount === '' ? null : Number(row.amount)) },
    { field: 'status', headerName: 'Status', filter: 'select' },
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

  const [printRequestReceiptNo, setPrintRequestReceiptNo] = useState(null);

  const handlePrint = (row) => {
    setRowMenuAnchor(null);
    handleView(row);
    setPrintRequestReceiptNo(row.receiptNo);
  };

  useEffect(() => {
    if (!printRequestReceiptNo) return;
    if (!editingRow || editingRow.receiptNo !== printRequestReceiptNo) return;

    const returnToListAfterPrint = () => {
      window.removeEventListener('afterprint', returnToListAfterPrint);
      setPrintRequestReceiptNo(null);
      backToList();
    };

    window.addEventListener('afterprint', returnToListAfterPrint);
    printStockTransferReceipt();
  }, [printRequestReceiptNo, editingRow]);

  const handleDelete = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Delete stock transfer receipt',
      message: `Are you sure you want to delete "${row.receiptNo}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Stock transfer receipt deleted');
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
    const payload = { ...values, status: pendingStatusRef.current };
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Stock transfer receipt updated');
      } else {
        await create(payload).unwrap();
        notify.success('Stock transfer receipt saved');
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
        icon={<MoveToInboxOutlinedIcon />}
        title="Stock Transfer Receipt"
        subtitle={view === 'form' ? 'Confirm stock received against a Stock Transfer.' : 'Manage and track all stock transfer receipts.'}
        rightContent={<CompanyBadge />}
      />

      {view === 'form' ? (
        <AppForm
          key={formKey}
          schema={stockTransferReceiptSchema}
          defaultValues={editingRow ? rowToFormValues(editingRow, defaultTaxCodeOption) : getEmptyValues(currentUser?.name || currentUser?.email, defaultTaxCodeOption)}
          onSubmit={handleSubmit}
        >
          {(methods) => {
            const { control, watch, setValue } = methods;
            const { fields, append, remove: removeItem, replace: replaceItems } = useFieldArray({ control, name: 'items' });
            const watchedItems = watch('items') || [];

            // Branch Transfer receipts show no From Warehouse column (the value
            // is still carried in form state from the source transfer line —
            // sourceItemsByKey and the Batch/Serial view key off it) and call
            // the To Warehouse "Receive Warehouse".
            const isBranchTransferType = watch('transferType') === 'Branch Transfer';
            const toWhseLabel = isBranchTransferType ? 'Receive Warehouse *' : 'To Whse *';
            const itemColumnsSx = itemTableSx(watchedItems, [
              null,
              { header: 'Item No. *', get: (i) => i?.productCode, field: 'select' },
              { header: 'Name *', get: (i) => i?.productName, field: 'select' },
              ...(isBranchTransferType ? [] : [{ header: 'From Whse *', get: (i) => i?.fromWarehouse, field: 'select' }]),
              { header: toWhseLabel, get: (i) => i?.toWarehouse, field: 'select' },
              { header: 'Receipt Quantity *', get: (i) => i?.quantity, field: 'text' },
              { header: 'Unit Price', get: (i) => i?.unitPrice, field: 'text' },
              { header: 'Tax (%)', get: (i) => taxCodeById.get(i?.taxCodeId)?.label ?? i?.taxPercent, field: 'select' },
              { header: 'Total (LC)', get: (i) => lineTotal(i).toFixed(2), field: 'plain', min: 110 },
              null,
            ]);
            // The DLP rates load asynchronously — if an item was picked before
            // they arrived it kept Unit Price 0. Once they're in, fill any
            // still-zero price on a NEW document (never on a saved one being
            // viewed/edited, and never over a price the user typed).
            useEffect(() => {
              if (editingRow || !priceListRates || priceListRates.size === 0) return;
              (watch('items') || []).forEach((it, idx) => {
                if (!it?.productCode || Number(it.unitPrice) > 0) return;
                const rate = priceListRates.get(it.productCode) ?? priceListRates.get(String(it.productCode).trim().toUpperCase());
                if (rate == null) return;
                setValue(`items.${idx}.unitPrice`, rate, { shouldValidate: true });
              });
              // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [priceListRates]);
            const branch = watch('branch');
            const toBranch = watch('toBranch');
            const transferType = watch('transferType');
            // A Branch Transfer moves stock OUT of From Branch, so it can't
            // also be the destination — drop whichever branch is currently
            // selected as From Branch from the To Branch list, same as
            // StockTransfer.jsx's own toBranchOptionsFiltered.
            const toBranchOptionsFiltered = branch
              ? toBranchOptions.filter((o) => o.value !== branch)
              : toBranchOptions;
            const [tab, setTab] = useState(0);

            // Every warehouse dropdown on this document — each item row's own
            // From/To — draws from this same branch-scoped list. With no
            // branch chosen yet there is nothing to offer. Every line's own
            // saved From/To Warehouse is passed as keepValues so opening an
            // existing receipt for edit/view doesn't blank a row whose
            // warehouse has since gone Inactive or moved to another branch.
            const branchWarehouseOptions = useMemo(
              () => warehouseOptionsForBranch(
                allWarehouses,
                branch,
                (editingRow?.items || []).flatMap((i) => [i.fromWarehouse, i.toWarehouse])
              ),
              [allWarehouses, branch, editingRow]
            );

            const handleFile = (file) => {
              if (file) setValue('attachmentName', file.name, { shouldValidate: true });
            };

            // Switching Branch invalidates any per-row From Warehouse choice
            // that doesn't belong to the new branch; a warehouse picked under
            // one branch has no meaning under another. To Warehouse is
            // validated separately below, against its own (possibly
            // different) destination branch — see effectiveToBranch. Skipped
            // on the very first render so loading an existing record for
            // edit/view doesn't wipe values it just loaded.
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

            const transferNoValue = watch('transferNo');
            const requestNoValue = watch('requestNo');

            // The selected Stock Transfer / Stock Transfer Request, kept
            // around so effectiveToBranch (and the item-copy effect further
            // below) don't each re-derive the same lookup.
            const selectedSourceTransfer = useMemo(
              () => (sourceTransfers || []).find((t) => t.transferNo === transferNoValue) || null,
              [sourceTransfers, transferNoValue]
            );
            const selectedSourceRequest = useMemo(
              () => (sourceRequests || []).find((r) => r.requestNo === requestNoValue) || null,
              [sourceRequests, requestNoValue]
            );

            // Read-only Batch/Serial view (Item Details table) — matches each
            // receipt line back to its originating Stock Transfer line by
            // Item No. + From Warehouse (not by row index, so it stays correct
            // even after a manual row reorder/add/remove on this receipt) to
            // show what batch/serial numbers were actually allocated on the
            // transfer being received. Purely informational: no selection, no
            // schema/database changes — see selectedSourceTransfer above,
            // whose .items already carry batchAllocations/serialAllocations
            // via the backend's existing stockTransferInclude.
            const sourceItemsByKey = useMemo(() => {
              const map = new Map();
              (selectedSourceTransfer?.items || []).forEach((it) => {
                map.set(`${it.productCode}::${it.fromWarehouse}`, it);
              });
              return map;
            }, [selectedSourceTransfer]);
            const [batchSerialView, setBatchSerialView] = useState(null); // { productCode, productName, batchAllocations, serialAllocations } | null

            // Notification bell feature: confirming this receipt is what
            // actually closes the Stock Transfer and posts stock/GL (see
            // syncStockTransferClosure, routes/resources.js) — refuse that
            // client-side too, not just rely on the server's 409, so the
            // person sees why before they click rather than after.
            const confirmBlockedReason = selectedSourceTransfer && selectedSourceTransfer.approvalStatus !== 'Approved'
              ? (selectedSourceTransfer.approvalStatus === 'Rejected'
                ? `Stock Transfer ${selectedSourceTransfer.transferNo} was rejected and cannot be received.`
                : `Stock Transfer ${selectedSourceTransfer.transferNo} is awaiting approval.`)
              : null;

            // Which branch scopes the To Warehouse dropdowns: for a plain
            // Stock Transfer receipt there's only one branch (both sides use
            // it); for a Branch Transfer, the destination side uses this
            // receipt's own To Branch field — same rule as StockTransfer.jsx's
            // own effectiveToBranch. Type/To Branch are usually auto-filled
            // from whichever Stock Transfer is picked (see the transferNoValue
            // effect below) but are otherwise this receipt's own fields now,
            // not inferred from the source document on every render.
            const effectiveToBranch = transferType === 'Branch Transfer' ? toBranch : branch;

            // CGST/SGST vs IGST — same rule as StockTransfer.jsx's own
            // computeTotals, comparing this receipt's own `branch` (its FROM
            // branch) against effectiveToBranch above instead of a customer's
            // place of supply.
            const branchStateByName = new Map((allBranchesForPrint || []).map((b) => [String(b.branchName || '').trim(), b.state || '']));
            const interState = isInterState(branchStateByName.get(String(effectiveToBranch || '').trim()), branchStateByName.get(String(branch || '').trim()));
            const totals = computeTotals(watchedItems, taxCodeById, interState);

            // Print — A4 portrait design (see StockTransferReceiptPrintable.jsx).
            // Rendered off the form's live watched values so a Print triggered
            // mid-edit reflects whatever is on screen, not just what was last
            // saved. transferType/toBranch are now real fields on this form
            // (see above), so the printable's own From/To Branch logic — the
            // same one StockTransfer.jsx/StockTransferRequest.jsx use — reads
            // them straight off watch() like every other document.
            const printOrder = watch();

            // Same idea as branchWarehouseOptions above, scoped to the
            // destination branch instead — only differs from it for a Branch
            // Transfer-sourced receipt. Used for every "To Whse" select so a
            // destination warehouse that genuinely belongs to a different
            // branch than this receipt's own "branch" field stays offered
            // and selectable, instead of silently rendering blank.
            const toBranchWarehouseOptions = useMemo(
              () => warehouseOptionsForBranch(
                allWarehouses,
                effectiveToBranch,
                (editingRow?.items || []).map((i) => i.toWarehouse)
              ),
              [allWarehouses, effectiveToBranch, editingRow]
            );

            // Same "invalidate on change" rule as the Branch effect above,
            // but for To Warehouse against effectiveToBranch instead — kept
            // as its own ref/effect so switching plain "branch" alone (an
            // ordinary Stock Transfer) doesn't wipe a Branch Transfer's
            // cross-branch To Warehouse, and vice versa.
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

            // Stock Transfer No. options narrow to only the Stock Transfers
            // raised from the selected Stock Request No. — matched by the
            // same requestNo string-reference StockTransfer.jsx itself
            // writes onto each transfer it creates from a request. With no
            // request selected yet, every transfer stays offered so the
            // field remains usable on its own, same as before this change.
            const scopedTransferNoOptions = useMemo(() => {
              if (!requestNoValue) return transferNoOptions;
              return (sourceTransfers || [])
                .filter((t) => t.requestNo === requestNoValue)
                .map((t) => t.transferNo)
                .filter(Boolean);
              // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [sourceTransfers, requestNoValue, transferNoOptions]);

            // Picking a different Stock Request No. invalidates a
            // previously chosen Transfer No. that doesn't belong to it —
            // same "switching an upstream field clears a now-invalid
            // downstream choice" pattern as the Branch -> Warehouse effect
            // below. Skipped on first render so loading an existing receipt
            // for edit/view doesn't wipe a value it just loaded.
            const prevRequestNoRef = useRef(requestNoValue);
            useEffect(() => {
              if (prevRequestNoRef.current === requestNoValue) return;
              prevRequestNoRef.current = requestNoValue;
              const currentTransferNo = watch('transferNo');
              if (currentTransferNo && requestNoValue && !scopedTransferNoOptions.includes(currentTransferNo)) {
                setValue('transferNo', '', { shouldValidate: true });
              }
              // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [requestNoValue]);

            // Picking a Stock Transfer No. pulls that transfer's own data
            // onto this receipt — branch, party/project, and every line
            // (From/To Warehouse, quantity, cost) — so the receipt doesn't
            // have to be re-keyed by hand. Quantity is copied twice: once
            // into the read-only Transfer Qty reference and again into this
            // receipt's own editable Quantity, defaulting to "receive
            // everything that was transferred" while staying adjustable.
            // Uses useFieldArray's replace() rather than setValue('items',
            // ...) so every row remounts with a fresh field id — the same
            // reasoning as StockTransfer.jsx's own Request No. copy (a
            // reused row's product-autofill effect would otherwise
            // silently stomp the copied Unit Price/Item Cost with the
            // product master's own defaults). Skipped on first render so
            // loading an existing receipt for edit/view doesn't overwrite
            // values it just loaded.
            const prevCopyTransferNoRef = useRef(transferNoValue);
            useEffect(() => {
              if (prevCopyTransferNoRef.current === transferNoValue) return;
              prevCopyTransferNoRef.current = transferNoValue;
              if (!transferNoValue) return;
              const src = selectedSourceTransfer;
              if (!src) return;

              if (src.branch) setValue('branch', src.branch, { shouldValidate: true });
              // Type/To Branch auto-fill from the source Stock Transfer, same
              // as Transfer Date just below — still independently editable
              // afterwards, same as every other auto-filled field here.
              setValue('transferType', src.transferType || 'Stock Transfer', { shouldValidate: true });
              setValue('toBranch', src.toBranch || '', { shouldValidate: true });
              setValue('partyCode', src.partyCode || '', { shouldValidate: true });
              setValue('partyName', src.partyName || '', { shouldValidate: true });
              setValue('contactPerson', src.contactPerson || '', { shouldValidate: true });
              setValue('project', src.project || '', { shouldValidate: true });
              if (src.documentDate) setValue('transferDate', src.documentDate, { shouldValidate: true });

              // Branch Transfer stock transfers auto-set every line's own
              // toWarehouse to the destination branch's Transit Warehouse
              // (see StockTransfer.jsx's transitWarehouseCode), which is
              // blank whenever that branch has no warehouse flagged
              // isTransit — so a Branch Transfer copied here can arrive with
              // an empty To Whse on every line. The Stock Transfer Request
              // that raised the transfer already holds the real, user-picked
              // destination warehouse per line (its own "Warehouse *"
              // select, never tied to a transit warehouse), so fall back to
              // that instead of leaving the line unusable.
              const srcRequest = src.transferType === 'Branch Transfer'
                ? (sourceRequests || []).find((r) => r.requestNo === (src.requestNo || requestNoValue)) || selectedSourceRequest
                : null;
              const requestToWarehouseByProduct = new Map(
                (srcRequest?.items || []).map((ri) => [ri.productCode, ri.toWarehouse || ''])
              );

              const srcItems = src.items && src.items.length ? src.items : null;
              if (srcItems) {
                replaceItems(srcItems.map((i) => ({
                  productCode: i.productCode || '', productName: i.productName || '',
                  fromWarehouse: i.fromWarehouse || '',
                  toWarehouse: i.toWarehouse || requestToWarehouseByProduct.get(i.productCode) || '',
                  uom: i.uom || '',
                  transferQuantity: i.quantity != null ? Number(i.quantity) : 0,
                  quantity: i.quantity != null ? Number(i.quantity) : 0,
                  unitPrice: i.unitPrice != null ? Number(i.unitPrice) : 0,
                  itemCost: i.itemCost != null ? Number(i.itemCost) : 0,
                  // Carried over from the source Stock Transfer line's own
                  // Tax Code — the receipt starts with the same tax the
                  // transfer was raised at, still editable per row. Falls
                  // back to the same Kerala GST@18% default as any other new
                  // row when the source line has none (a transfer saved
                  // before Stock Transfer's own Tax Code feature existed).
                  taxCodeId: i.taxCodeId != null ? Number(i.taxCodeId) : (defaultTaxCodeOption?.value ?? null),
                  taxPercent: i.taxCodeId != null ? (i.taxPercent != null ? Number(i.taxPercent) : 0) : (defaultTaxCodeOption?.rate ?? 0),
                  accountCode: i.accountCode || '', project: i.project || '', remarks: i.remarks || '',
                })));
              }
              // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [transferNoValue]);

            // Backfill for the race none of the other call sites can cover on
            // their own: fires once Tax Codes finish loading, whether the
            // receipt is brand-new, an existing saved receipt being edited (a
            // legacy line with no Tax Code of its own), or a row just copied
            // in from a source Stock Transfer whose own Tax Code hadn't
            // loaded yet either. A no-op once a row already has a Tax Code
            // (the user's own pick, or this effect already fired).
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
                    <Typography variant="subtitle1" fontWeight={700}>Receipt Details</Typography>
                    <Button type="button" variant="outlined" color="inherit" startIcon={<ArrowBackIcon />} onClick={backToList}>
                      Back to List
                    </Button>
                  </Stack>
                  <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
                    <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                      <LabeledField label="Type *">
                        <FormSelect name="transferType" label="" options={TRANSFER_TYPE_OPTIONS.map((t) => ({ label: t, value: t }))} />
                      </LabeledField>
                      <LabeledField label="Receipt No. *">
                        <DocumentSeriesNoField documentCode="MC" seriesFieldName="seriesId" numberFieldName="receiptNo" isCreate={!editingRow} />
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
                      <LabeledField label="Stock Transfer No.">
                        <Autocomplete
                          freeSolo
                          options={scopedTransferNoOptions}
                          value={transferNoValue || ''}
                          onInputChange={(_e, v) => setValue('transferNo', v || '', { shouldValidate: true })}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              placeholder={requestNoValue ? 'Select transfer no. for this request' : 'Select or enter transfer no.'}
                              size="small"
                            />
                          )}
                        />
                      </LabeledField>
                      <LabeledField label="Receipt Date">
                        <FormDatePicker name="transferDate" label="" />
                      </LabeledField>
                      <LabeledField label="Status *">
                        <FormSelect name="status" label="" disabled options={STOCK_TRANSFER_RECEIPT_STATUS_OPTIONS.map((s) => ({ label: s, value: s }))} />
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
                              const qty = Number(watch(`items.${index}.quantity`)) || 0;
                              const price = Number(watch(`items.${index}.unitPrice`)) || 0;
                              const taxPct = Number(watch(`items.${index}.taxPercent`)) || 0;
                              const rowProductCode = watch(`items.${index}.productCode`);
                              const rowFromWarehouse = watch(`items.${index}.fromWarehouse`);
                              const rowSourceItem = sourceItemsByKey.get(`${rowProductCode}::${rowFromWarehouse}`);
                              const rowHasBatchSerial = !!(rowSourceItem && (
                                (rowSourceItem.batchAllocations || []).length || (rowSourceItem.serialAllocations || []).length
                              ));
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
                                    {isBranchTransferType ? null : (
                                      <FormSelect name={`items.${index}.fromWarehouse`} label="From Whse *" placeholder={branch ? 'Select' : 'Select branch first'} options={branchWarehouseOptions} disabled={!branch} />
                                    )}
                                    <FormSelect name={`items.${index}.toWarehouse`} label={toWhseLabel} placeholder={effectiveToBranch ? 'Select' : 'Select branch first'} options={toBranchWarehouseOptions} disabled={!effectiveToBranch} />
                                    <FormTextField name={`items.${index}.quantity`} label="Receipt Quantity *" type="number" />
                                    <FormTextField name={`items.${index}.unitPrice`} label="Unit Price" type="number" />
                                    <FormSelect name={`items.${index}.taxCodeId`} label="Tax (%)" options={taxCodeOptions} popupFitContent onValueChange={(_v, option) => setValue(`items.${index}.taxPercent`, option ? option.rate : 0, { shouldValidate: true })} />
                                  </Box>
                                  {rowHasBatchSerial && (
                                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1 }}>
                                      <Typography variant="caption" color="text.secondary">Batch/Serial</Typography>
                                      <ReceiptBatchSerialCell
                                        sourceItem={rowSourceItem}
                                        onOpen={() => setBatchSerialView({
                                          productCode: rowSourceItem.productCode,
                                          productName: rowSourceItem.productName,
                                          batchAllocations: rowSourceItem.batchAllocations || [],
                                          serialAllocations: rowSourceItem.serialAllocations || [],
                                        })}
                                      />
                                    </Stack>
                                  )}
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
                                {isBranchTransferType ? null : <TableCell>From Whse *</TableCell>}
                                <TableCell>{toWhseLabel}</TableCell>
                                <TableCell>Receipt Quantity *</TableCell>
                                <TableCell>Unit Price</TableCell>
                                <TableCell>Tax (%)</TableCell>
                                <TableCell>Total (LC)</TableCell>
                                <TableCell width={64}>Batch/Serial</TableCell>
                                <TableCell width={48}>Action</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {fields.map((field, index) => {
                                const qty = Number(watch(`items.${index}.quantity`)) || 0;
                                const price = Number(watch(`items.${index}.unitPrice`)) || 0;
                                const taxPct = Number(watch(`items.${index}.taxPercent`)) || 0;
                                const rowProductCode = watch(`items.${index}.productCode`);
                                const rowFromWarehouse = watch(`items.${index}.fromWarehouse`);
                                const rowSourceItem = sourceItemsByKey.get(`${rowProductCode}::${rowFromWarehouse}`);
                                const rowHasBatchSerial = !!(rowSourceItem && (
                                  (rowSourceItem.batchAllocations || []).length || (rowSourceItem.serialAllocations || []).length
                                ));
                                return (
                                  <TableRow key={field.id} sx={{ '& > td': { verticalAlign: 'middle' } }}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>
                                      <ProductCell index={index} methods={methods} options={productCodeOptions} products={products} priceListRates={priceListRates} dlpInfo={dlpRates} placeholder="Select item" sx={{ minWidth: 180 }} />
                                    </TableCell>
                                    <TableCell>
                                      <ProductCell index={index} methods={methods} options={productNameOptions} products={products} priceListRates={priceListRates} dlpInfo={dlpRates} placeholder="Select item" sx={{ minWidth: 200 }} />
                                    </TableCell>
                                    {isBranchTransferType ? null : (
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
                                    )}
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
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{round2(qty * price * (1 + taxPct / 100)).toFixed(2)}</TableCell>
                                    <TableCell>
                                      <ReceiptBatchSerialCell
                                        sourceItem={rowSourceItem}
                                        onOpen={() => setBatchSerialView({
                                          productCode: rowSourceItem.productCode,
                                          productName: rowSourceItem.productName,
                                          batchAllocations: rowSourceItem.batchAllocations || [],
                                          serialAllocations: rowSourceItem.serialAllocations || [],
                                        })}
                                      />
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
                        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 2.5 }}>
                          {/* Same shared totals panel every Sales/Purchase document (and now
                              Stock Transfer) uses — see computeTotals above for how interState
                              is decided and why discountField is null (no header Discount %). */}
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
                    <Button fullWidth={isMobile} type="button" variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => printStockTransferReceipt()}>
                      Print
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
                        <Tooltip
                          title={
                            confirmBlockedReason
                              ? confirmBlockedReason
                              : ''
                          }
                        >
                          <span>
                            <FormSubmitButton
                              fullWidth={isMobile}
                              onClick={() => { pendingStatusRef.current = 'Confirmed'; }}
                              disabled={creating || updating || Boolean(confirmBlockedReason)}
                            >
                              {editingRow ? 'Update Receipt' : 'Save & Confirm Receipt'}
                            </FormSubmitButton>
                          </span>
                        </Tooltip>
                      </>
                    )}
                  </Stack>
                  {confirmBlockedReason && (
                    <Typography variant="caption" color="warning.main" sx={{ display: 'block', textAlign: 'right', mt: 1 }}>
                      {confirmBlockedReason}
                    </Typography>
                  )}

                  <StockTransferReceiptPrintable order={printOrder} company={company} branches={allBranchesForPrint} warehouses={allWarehouses} />
                </CardContent>
              </Card>

              <BatchSerialViewDialog
                open={!!batchSerialView}
                onClose={() => setBatchSerialView(null)}
                data={batchSerialView}
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
              <Typography variant="subtitle1" fontWeight={700}>Stock Transfer Receipt List</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap sx={{ width: { xs: '100%', sm: 'auto' } }}>
                <TableSearchFilter table={table} placeholder="Search by receipt no..." showFilter={false} />
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
                      { label: 'Stock Transfer No.', value: row.transferNo || '—' },
                      { label: 'Document Date', value: row.documentDate ? dayjs(row.documentDate).format('DD/MM/YYYY') : '—' },
                      { label: 'Amount', value: `₹${Number(row.amount).toFixed(2)}` },
                    ]}
                    onEdit={() => handleEdit(row)}
                    onDelete={() => handleDelete(row)}
                  />
                ))}
                {!isLoading && filteredRows.length === 0 && (
                  <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No stock transfer receipts found" message="Add your first stock transfer receipt to get started" />
                )}
              </Box>
            ) : (
              <ScrollableTableContainer>
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    '& th, & td': {
                      height: STOCK_TRANSFER_RECEIPT_LIST_TABLE_ROW_HEIGHT,
                      paddingTop: `${STOCK_TRANSFER_RECEIPT_LIST_TABLE_CELL_PADDING_Y}px`,
                      paddingBottom: `${STOCK_TRANSFER_RECEIPT_LIST_TABLE_CELL_PADDING_Y}px`,
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
                      <SortableHeaderCell field="transferNo" sort={table.sort} onSort={table.toggleSort}>Stock Transfer No.</SortableHeaderCell>
                      <SortableHeaderCell field="documentDate" sort={table.sort} onSort={table.toggleSort}>Document Date</SortableHeaderCell>
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
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.transferNo || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.documentDate ? dayjs(row.documentDate).format('DD/MM/YYYY') : '—'}</TableCell>
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
                        <TableCell colSpan={8}>
                          <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No stock transfer receipts found" message="Add your first stock transfer receipt to get started" />
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

// Same "Batch: x/y" / "Serial: x/y" pill used by StockTransfer.jsx's own
// BatchSerialCell, but read-only here: x/y is always the source transfer
// line's own allocated-vs-transferred count (there's nothing to pick on a
// receipt), and the click opens BatchSerialViewDialog instead of the
// active-picking BatchSerialSelectionDialog. Shows "—" when this receipt
// line has no matching source line or that line has no batch/serial data.
function ReceiptBatchSerialCell({ sourceItem, onOpen }) {
  const batchAllocations = sourceItem?.batchAllocations || [];
  const serialAllocations = sourceItem?.serialAllocations || [];
  const mode = batchAllocations.length ? 'Batch' : (serialAllocations.length ? 'Serial' : null);
  if (!mode) {
    return <Typography variant="caption" color="text.secondary">—</Typography>;
  }
  const selected = mode === 'Batch'
    ? batchAllocations.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0)
    : serialAllocations.length;
  const needed = Number(sourceItem.quantity) || 0;
  const complete = needed > 0 && Math.abs(selected - needed) < 0.005;
  return (
    <Button
      type="button"
      component="span"
      size="small"
      variant="outlined"
      color={complete ? 'success' : 'warning'}
      startIcon={<Inventory2OutlinedIcon fontSize="small" />}
      onClick={onOpen}
      sx={{ whiteSpace: 'nowrap' }}
    >
      {mode}: {selected}/{needed}
    </Button>
  );
}

// Read-only view of the batch/serial numbers allocated on the source Stock
// Transfer line being received — informational only (no picking, no
// editing), deliberately separate from the active-picking
// BatchSerialSelectionDialog used on StockTransfer.jsx itself.
function BatchSerialViewDialog({ open, onClose, data }) {
  const batchRows = data?.batchAllocations || [];
  const serialRows = data?.serialAllocations || [];
  const mode = batchRows.length ? 'Batch' : 'Serial';
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        Batch/Serial{data?.productName ? ` — ${data.productName}` : ''}
      </DialogTitle>
      <DialogContent dividers>
        <Table size="small">
          <TableHead>
            <TableRow>
              {mode === 'Batch' ? (
                <>
                  <TableCell>Batch No</TableCell>
                  <TableCell align="right">Quantity</TableCell>
                </>
              ) : (
                <TableCell>Serial No</TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {mode === 'Batch' ? (
              batchRows.length ? (
                batchRows.map((r, i) => (
                  <TableRow key={r.id ?? i}>
                    <TableCell>{r.batchNo}</TableCell>
                    <TableCell align="right">{Number(r.quantity || 0)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2}>
                    <Typography variant="body2" color="text.secondary">No batch/serial data.</Typography>
                  </TableCell>
                </TableRow>
              )
            ) : (
              serialRows.length ? (
                serialRows.map((r, i) => (
                  <TableRow key={r.id ?? i}>
                    <TableCell>{r.serialNo}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">No batch/serial data.</Typography>
                  </TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

// Isolated so the per-row product-select auto-fill effect only re-runs for
// the row whose product actually changed, not every row on every keystroke.
// Unit Price/Item Cost are filled from the product's cost price so the
// receipt can be costed; both stay editable.
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
        // Unit Price comes from Product Master's own Unit Price (the same
        // figure Price List selection there autofills) — Item Cost is a
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
