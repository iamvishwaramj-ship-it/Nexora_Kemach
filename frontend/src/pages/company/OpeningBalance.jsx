import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../../store/authSlice';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import {
  Box, Typography, Button, Card, CardContent, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, TableFooter, TableContainer, Chip, IconButton, Collapse, Grid,
} from '@mui/material';
import { useFieldArray } from 'react-hook-form';
import BalanceIcon from '@mui/icons-material/Balance';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import ImportItemsDialog from '../../components/common/ImportItemsDialog';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import MobileItemCard from '../../components/data-display/MobileItemCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import useDragScroll from '../../components/data-display/useDragScroll';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { itemTableSx } from '../../lib/columnWidth';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { openingBalanceDocumentSchema } from '../../lib/validation/partnerSchemas';
import {
  openingBalanceApi, useSaveOpeningBalanceBatchMutation,
  branchApi, productApi, salesEmployeeApi, chartOfAccountApi,
} from '../../features/resources';
import usePriceListRates from '../../hooks/usePriceListRates';
import { useWarehouseOptions, warehouseCodesForBranch, warehouseLabel } from '../../lib/useWarehouseOptions';
import { PRODUCT_USAGE, productOptionsFor } from '../../lib/productUsage';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer, { dragScrollbarSx } from '../../components/data-display/ScrollableTableContainer';

import { CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';

const STATUS_OPTIONS = [{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }];

// "Manage By" choice list. Only Batch asks for a Batch No.; Serial and
// Standard lines never carry one. A product's own Product Master setting
// ('Batch' | 'Serial' | 'None') pre-fills it when the item is picked.
const MANAGE_BY_OPTIONS = [
  { label: 'Batch', value: 'Batch' },
  { label: 'Serial', value: 'Serial' },
  { label: 'Standard', value: 'Standard' },
];
const manageByFromProduct = (product) => {
  if (product?.manageItemBy === 'Batch') return 'Batch';
  if (product?.manageItemBy === 'Serial') return 'Serial';
  return 'Standard';
};

// One blank item line. Document Number/Document Date are header-only now —
// the Item Details table dropped its per-line override columns for them, so
// every line is stamped with the header's values on save instead.
const emptyItem = {
  itemCode: '', itemName: '',
  // Batch tracking for a Batch-managed item's opening stock -- see
  // schema.prisma's own comment on OpeningBalance.batchNo.
  manageBy: '', warehouse: '', batchNo: '', stock: '', unitCost: '', stockValue: '', status: 'Active',
};

// `branch` rides along on the form purely to drive every row's Warehouse
// dropdown — opening_balance has no branch column (a warehouse already
// belongs to exactly one branch via WarehouseMaster.branch), so handleSubmit
// strips it back out before calling the API.
function getEmptyValues(preparedBy) {
  return {
    branch: '', documentNumber: '', documentDate: null, status: 'Active',
    openingBalanceAccount: '', openingBalanceAccountDescription: '',
    termsConditions: '', preparedBy: preparedBy || '', approvedBy: '',
    items: [{ ...emptyItem }],
  };
}

const PAGE_SIZE = 10;

// createdAt is a timestamp (date + time), not just a date, so it gets its
// own formatter rather than reusing a date-only one — this is when the row
// was actually inserted (typed by hand or imported via Excel), always
// server-stamped, never editable.
const formatDateTime = (d) => (d
  ? new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  : '—');

const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

// Each dropdown option carries both the code and the name so the list can
// show "PRD-000022 — Widget" while picking, even though the box itself (via
// getOptionLabel/label) ends up showing only the code on the Item Code field
// or only the name on the Item Name field once an option is chosen.
const renderItemOption = (props, option) => (
  <Box component="li" {...props} key={option.value}>
    <Stack direction="row" spacing={1} alignItems="baseline">
      <Typography variant="body2" fontWeight={600}>{option.productCode}</Typography>
      <Typography variant="body2" color="text.secondary">{option.productName || '—'}</Typography>
    </Stack>
  </Box>
);

// Item Code and Item Name are two selects over the same underlying itemCode
// field on ONE row — Item Code lists codes, Item Name lists names, but
// picking either resolves the same product and keeps that row's item identity
// in sync. Same "two selects, one field" pattern Stock Adjustment/Stock
// Issue use for their own product line items, scoped here to items.<index>.
function ItemCell({ index, methods, products, options, placeholder, sx, dlpRates }) {
  const { watch, setValue } = methods;
  const itemCodeValue = watch(`items.${index}.itemCode`);
  const prevValue = useRef(itemCodeValue);

  useEffect(() => {
    if (itemCodeValue !== prevValue.current) {
      const found = (products || []).find((p) => p.productCode === itemCodeValue);
      if (found) setValue(`items.${index}.itemName`, found.productName, { shouldValidate: true });
      // Manage By follows the item's Product Master setting (still changeable).
      if (found) setValue(`items.${index}.manageBy`, manageByFromProduct(found), { shouldValidate: true });
      // Unit Cost comes from the active DLP (Dealer/Distributor Price List)
      // -- Product Setup > Price List. An item with no DLP price starts at 0
      // and its Unit Cost becomes editable (see the table below).
      const dlp = dlpRates?.get(itemCodeValue);
      setValue(`items.${index}.unitCost`, dlp != null ? dlp : 0, { shouldValidate: true });
      prevValue.current = itemCodeValue;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemCodeValue]);

  return (
    <FormSelect
      name={`items.${index}.itemCode`}
      label=""
      placeholder={placeholder}
      options={options}
      renderOption={renderItemOption}
      popupFitContent
      sx={sx}
      // A bulk import resolves each row against whatever's in `products` at
      // that moment (see handleItemsImported) and stamps the resolved (or
      // raw, if unmatched) itemCode straight onto the row -- that value is
      // correct either way. But without this flag, FormSelect only shows a
      // value when it can find a matching entry in `options`
      // (selectableProducts, built from `products`): a code missing from
      // `products` at render time -- because the product list hadn't
      // finished loading yet, or a stale/renamed code -- rendered as a
      // blank box even though the row's real, correct value was sitting
      // right there in the field. This makes the box show that raw value
      // instead of nothing, so a large import never LOOKS like it lost
      // data it didn't actually lose.
      keepValueIfUnmatched
    />
  );
}

// One row per item per warehouse — mirrors Master Data.xlsx's Current Stock
// sheet (ItemCode, ItemName, Warehouse, Stock, StockValue), which is also
// what `npm run current_stock:seed` loads in bulk. The screen is now a
// header (Branch, Document No., Document Date, Status) plus a table of those
// rows, saved together as a batch — see POST /opening-balance/batch.
const OPENING_BALANCE_LIST_TABLE_ROW_HEIGHT = 0;
const OPENING_BALANCE_LIST_TABLE_CELL_PADDING_Y = 6;

export default function OpeningBalance() {
  const currentUser = useSelector(selectCurrentUser);
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const itemScrollRef = useDragScroll();
  const { data: balances, isLoading } = openingBalanceApi.useList();
  const { data: products } = productApi.useList();
  const [update, { isLoading: updating }] = openingBalanceApi.useUpdate();
  const [remove] = openingBalanceApi.useDelete();
  const [saveBatch, { isLoading: savingBatch }] = useSaveOpeningBalanceBatchMutation();
  const { data: branches } = branchApi.useList();
  const { data: salesEmployees } = salesEmployeeApi.useList();
  const { data: chartOfAccounts } = chartOfAccountApi.useList();
  // Unit Cost source: the active DLP price list, Map<productCode, price>.
  const { rates: dlpRates } = usePriceListRates('DLP');
  const [itemsImportOpen, setItemsImportOpen] = useState(false);
  const branchOptions = (branches || []).map((b) => ({ label: b.branchName, value: b.branchName }));
  // Document Number is auto-filled from the selected branch's own
  // branchCode (its "branch number") rather than typed -- see the effect
  // beside the Branch field below that writes it in on every branch change.
  const branchCodeByName = Object.fromEntries((branches || []).map((b) => [b.branchName, b.branchCode]));

  // Opening Balance Account: real posting accounts only (AccountNature 'A',
  // not inactive) -- same filter BP Opening Balance uses for its own header.
  const accountOptions = useMemo(
    () => (chartOfAccounts || [])
      .filter((a) => a.accountNature === 'A' && a.status !== 'I')
      .map((a) => ({ label: `${a.accountName} (${a.accountCode})`, value: a.accountCode, accountName: a.accountName })),
    [chartOfAccounts]
  );
  const accountByCode = useMemo(
    () => new Map((chartOfAccounts || []).map((a) => [a.accountCode, a])),
    [chartOfAccounts]
  );

  // Approved By is scoped to employees flagged with approval
  // authorization on the Employee Master — the same split
  // SalesInvoice.jsx makes for its own footer. Prepared By no longer
  // offers a picker; it locks to the signed-in account user (see
  // currentUser above).
  const approvedByOptions = useMemo(
    () => (salesEmployees || []).filter((s) => s.approvalAuthorization === true).map((s) => ({ label: s.employeeName, value: s.employeeName })),
    [salesEmployees]
  );

  // Form is hidden by default — only the list shows until "Add Opening
  // Balance" (or an edit action) is triggered, per the standard CRUD page
  // template (Warehouse Master/Location Master).
  const [showForm, setShowForm] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // Warehouse is picked from the Warehouse Master rather than typed, so every
  // Opening Balance row resolves to a real warehouse code (the server's FK is
  // the actual backstop; this just keeps the picker honest).
  //
  // Unfiltered — needed at this level to derive the Branch field's default
  // value when editing a row (a warehouse already belongs to exactly one
  // branch via WarehouseMaster.branch).
  const { warehouses } = useWarehouseOptions({});
  const warehouseLabelByCode = useMemo(
    () => new Map((warehouses || []).map((w) => [w.whsCode, warehouseLabel(w)])),
    [warehouses]
  );

  const allRows = balances || [];

  // The list itself is document-level, not item-level: every line sharing a
  // Document Number becomes ONE row on screen -- Branch/Document Number/
  // Document Date/Status, the same fields the header card above collects --
  // and the Item Details underneath a document are only reached by drilling
  // into it via its own Action -> View, rather than being shown inline for
  // every document at once. A blank Document Number no longer merges
  // unrelated rows together: each such row keys off its own id instead, so
  // it still gets a line of its own in the list.
  const documentGroups = useMemo(() => {
    const byKey = new Map();
    allRows.forEach((row) => {
      const key = row.documentNumber ? `doc:${row.documentNumber}` : `row:${row.id}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          key,
          documentNumber: row.documentNumber || '',
          documentDate: row.documentDate || null,
          status: row.status || 'Active',
          termsConditions: row.termsConditions || '',
          preparedBy: row.preparedBy || '',
          approvedBy: row.approvedBy || '',
          openingBalanceAccount: row.openingBalanceAccount || '',
          items: [],
        });
      }
      byKey.get(key).items.push(row);
    });
    // Branch isn't stored on the row at all (see emptyItem's own comment) --
    // every line in a document was scoped to the same Branch when it was
    // entered (switching Branch on the form clears any row whose Warehouse
    // doesn't belong to it), so the first line's Warehouse tells us which.
    return Array.from(byKey.values()).map((group) => ({
      ...group,
      branch: (warehouses || []).find((w) => w.whsCode === group.items[0]?.warehouse)?.branch || '',
      // Name shown in the list's Opening Balance Account column; the code
      // alone is the fallback for an account no longer in the Chart Of Accounts.
      accountName: accountByCode.get(group.openingBalanceAccount)?.accountName || '',
      itemCount: group.items.length,
    }));
  }, [allRows, warehouses, accountByCode]);

  const tableColumns = useMemo(() => ([
    { field: 'branch', headerName: 'Branch', filter: 'text' },
    { field: 'documentNumber', headerName: 'Document Number', filter: 'text' },
    { field: 'documentDate', headerName: 'Document Date', filter: 'dateRange', sortValue: (row) => (row.documentDate ? new Date(row.documentDate).getTime() : null), searchValue: (row) => formatDate(row.documentDate) },
    { field: 'accountName', headerName: 'Opening Balance Account', filter: 'text' },
    { field: 'status', headerName: 'Status', filter: 'select' },
  ]), []);
  const table = useTableFeatures(documentGroups, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  useEffect(() => { setPage(0); }, [rows.length]);

  const openCreate = () => {
    setEditingRow(null);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRow(null);
  };

  const handleToggleForm = () => (showForm ? closeForm() : openCreate());

  // Read-only look at a record — same form, every field disabled
  // and the save button removed (see AppForm's readOnly prop).
  // View and Edit both drill into ONE document's full Item Details -- every
  // line sharing its Document Number, not just the single summary row the
  // list itself renders for that document -- differing only in readOnly.
  const handleView = (group) => {
    setEditingRow(group);
    setReadOnly(true);
    setFormKey((k) => k + 1);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (group) => {
    setEditingRow(group);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Deleting a document deletes every line under it. There is no bulk
  // delete-by-document endpoint for plain Opening Balance (unlike its BP
  // Opening Balance sibling's own /document/:documentNumber route), so this
  // removes each of the document's rows through the same per-row endpoint
  // the old item-level Delete action already used.
  const handleDeleteDocument = async (group) => {
    const ok = await confirmDialog({
      title: 'Delete opening balance document',
      message: `Are you sure you want to delete "${group.documentNumber || '(no document number)'}" and its ${group.itemCount} item line(s)? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      // One at a time: each delete re-posts the document's journal entry from
      // the lines that remain, so they must not race each other.
      for (const item of group.items) {
        // eslint-disable-next-line no-await-in-loop
        await remove(item.id).unwrap();
      }
      notify.success('Opening balance document deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  // A Batch-managed item's opening stock must carry a Batch No. -- see
  // schema.prisma's own comment on OpeningBalance.batchNo. Checked against
  // Product Master's own Manage Item By, the same way DeliveryChallan.jsx
  // checks its batch/serial selections locally before ever calling the API.
  const validateOpeningBalanceBatches = (items) => {
    const productByCode = new Map((products || []).map((p) => [p.productCode, p]));
    const problems = [];
    (items || []).forEach((item, idx) => {
      const product = productByCode.get(item.itemCode);
      // The line's own Manage By decides; Batch No. is checked ONLY for Batch
      // (Serial/Standard lines may leave it empty).
      const manageBy = item.manageBy || manageByFromProduct(product);
      if (manageBy === 'Batch' && !String(item.batchNo || '').trim()) {
        problems.push(`Line ${idx + 1} ("${item.itemCode}"): Batch No. is required — Manage By is Batch.`);
      }
    });
    return problems;
  };

  const handleSubmit = async (values, formMethods) => {
    // branch only exists on the form to scope the Warehouse dropdowns —
    // opening_balance has no branch column, so it is dropped here rather
    // than sent to an API that would reject an unknown field.
    const {
      branch: _branch, openingBalanceAccountDescription: _accountDescription, items, ...header
    } = values;

    const batchProblems = validateOpeningBalanceBatches(items);
    if (batchProblems.length) {
      notify.error(batchProblems[0]);
      return;
    }

    try {
      if (editingRow) {
        const result = await saveBatch({ ...header, items }).unwrap();
        // Upsert only adds/updates -- a line removed from the table on this
        // edit is still sitting in the database under its old (itemCode,
        // warehouse) pair unless it's deleted explicitly here.
        // Lines are matched by their saved row id, so the same item/warehouse/
        // batch may repeat freely.
        const submittedIds = new Set((items || []).map((it) => it?.rowId).filter(Boolean));
        const removedLines = (editingRow.items || []).filter((it) => !submittedIds.has(it.id));
        if (removedLines.length) {
          for (const it of removedLines) {
            // eslint-disable-next-line no-await-in-loop
            await remove(it.id).unwrap();
          }
        }
        notify.success(result?.message || 'Opening balance updated');
      } else {
        const result = await saveBatch({ ...header, items }).unwrap();
        notify.success(result?.message || 'Opening balance saved');
      }
      closeForm();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<BalanceIcon />}
        title="Inventory Opening Balance"
        subtitle="Manage per-item, per-warehouse opening stock. Add, update or remove entries."
        rightContent={<CompanyBadge />}
      />

      {/* Excel import lives on the Item Details table ("Import Items"), which
          appends lines to the document being filled in. The old whole-sheet
          importer that used to sit here created records directly, bypassing
          the header entirely — two different meanings of "import" side by
          side was the confusing part, so only the line-level one remains. */}
      <Stack direction="row" justifyContent="flex-end" spacing={1.5} sx={{ mb: 2 }}>
        <Button
          variant="contained"
          startIcon={showForm ? <CloseIcon /> : <AddIcon />}
          onClick={handleToggleForm}
        >
          {showForm ? 'Close' : 'Add Inventory Opening Balance'}
        </Button>
      </Stack>

      <Collapse in={showForm} unmountOnExit>
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
              {readOnly ? 'View Inventory Opening Balance' : editingRow ? 'Edit Inventory Opening Balance' : 'New Inventory Opening Balance'}
            </Typography>

            <AppForm readOnly={readOnly}
              key={formKey}
              schema={openingBalanceDocumentSchema}
              defaultValues={editingRow
                ? {
                  ...getEmptyValues(),
                  // Derived, not stored — a warehouse belongs to exactly one
                  // branch, so the first item's own warehouse tells us which
                  // (every line in the document was scoped to the same
                  // Branch when it was entered).
                  branch: editingRow.branch || '',
                  documentNumber: editingRow.documentNumber || '',
                  documentDate: editingRow.documentDate || null,
                  status: editingRow.status || 'Active',
                  openingBalanceAccount: editingRow.openingBalanceAccount || '',
                  openingBalanceAccountDescription: accountByCode.get(editingRow.openingBalanceAccount)?.accountName || '',
                  termsConditions: editingRow.termsConditions || '',
                  preparedBy: editingRow.preparedBy || '',
                  approvedBy: editingRow.approvedBy || '',
                  // Every line under this Document Number, not just one --
                  // this is the whole point of drilling in via Action ->
                  // View on the document-level list.
                  items: (editingRow.items || []).map((it) => ({
                    rowId: it.id,
                    itemCode: it.itemCode || '',
                    itemName: it.itemName || '',
                    // Rows saved before Manage By existed: a batch number means
                    // Batch, otherwise the product's own setting.
                    manageBy: it.manageBy || (it.batchNo ? 'Batch' : manageByFromProduct((products || []).find((p) => p.productCode === it.itemCode))),
                    warehouse: it.warehouse || '',
                    batchNo: it.batchNo || '',
                    stock: it.stock ?? '',
                    // Rows saved before Unit Cost existed carry 0: derive it from
                    // their Stock Value so editing never changes the value.
                    unitCost: Number(it.unitCost) > 0 ? Number(it.unitCost) : (Number(it.stock) > 0 ? Number(it.stockValue) / Number(it.stock) : 0),
                    stockValue: it.stockValue ?? '',
                    status: it.status || 'Active',
                  })),
                }
                : getEmptyValues(currentUser?.name || currentUser?.email)}
              onSubmit={handleSubmit}
            >
              {(methods) => {
                const { watch, setValue, control } = methods;
                const branch = watch('branch');
                const { fields, append, remove: removeItem } = useFieldArray({ control, name: 'items' });
                const [visibleItemCount, setVisibleItemCount] = useState(50);
                const watchedItems = watch('items') || [];
                const { options: warehouseOptions } = useWarehouseOptions({
                  currentValue: (editingRow?.items || []).map((it) => it.warehouse),
                  branch,
                });

                // Item Code and Item Name are picked from Product Master
                // rather than typed, like every other document's product line
                // — see productOptionsFor/PRODUCT_USAGE.INVENTORY. Any code
                // already on a line is kept selectable even if that product
                // has since been re-flagged or deactivated, so reopening a
                // saved row can't blank the field out.
                const selectableProducts = productOptionsFor(
                  products,
                  PRODUCT_USAGE.INVENTORY,
                  [...(editingRow?.items || []).map((it) => it.itemCode), ...watchedItems.map((i) => i?.itemCode)].filter(Boolean)
                );
                const itemCodeOptions = selectableProducts.map((p) => ({ label: p.productCode, value: p.productCode, productCode: p.productCode, productName: p.productName }));
                const itemNameOptions = selectableProducts.map((p) => ({ label: p.productName, value: p.productCode, productCode: p.productCode, productName: p.productName }));

                // Columns only take the width their content needs — see
                // itemTableSx in lib/columnWidth.js.
                const itemColumnsSx = itemTableSx(watchedItems, []);

                // Opening Balance Account drives the read-only Account
                // Description beside it -- same "select drives a read-only
                // companion field" pattern as BP Opening Balance.
                const handleAccountChange = (nextValue) => {
                  setValue('openingBalanceAccountDescription', accountByCode.get(nextValue)?.accountName || '', { shouldValidate: false });
                };

                // Stock Value is always Stock x Unit Cost (2 dp). Recomputed
                // whenever either changes, so the column can never be typed
                // out of step with the other two -- and it is this value the
                // journal entry is posted from.
                // Fetch Unit Cost from the DLP price list for any row that
                // has an item but no Unit Cost yet (loaded/imported rows, or
                // the price list arriving after the rows). Saved costs > 0
                // are left alone.
                const dlpItemKey = watchedItems.map((i) => `${i?.itemCode}|${i?.unitCost}`).join(',');
                useEffect(() => {
                  if (!dlpRates || dlpRates.size === 0) return;
                  (watch('items') || []).forEach((row, idx) => {
                    const dlp = row?.itemCode ? dlpRates.get(row.itemCode) : undefined;
                    if (dlp != null && !(Number(row?.unitCost) > 0) && Number(row?.unitCost) !== dlp) {
                      setValue(`items.${idx}.unitCost`, dlp, { shouldValidate: true });
                    }
                  });
                  // eslint-disable-next-line react-hooks/exhaustive-deps
                }, [dlpItemKey, dlpRates]);

                const stockUnitKey = watchedItems.map((i) => `${i?.stock}|${i?.unitCost}`).join(',');
                useEffect(() => {
                  (watch('items') || []).forEach((row, idx) => {
                    const expected = Math.round((Number(row?.stock) || 0) * (Number(row?.unitCost) || 0) * 100) / 100;
                    const current = row?.stockValue === '' || row?.stockValue == null ? null : Number(row.stockValue);
                    if (current !== expected) setValue(`items.${idx}.stockValue`, expected, { shouldValidate: true });
                  });
                  // eslint-disable-next-line react-hooks/exhaustive-deps
                }, [stockUnitKey]);

                // Batch No. only belongs to Batch lines: switching a line to
                // Serial/Standard empties it, so nothing stale is saved or
                // validated.
                const manageByKey = watchedItems.map((i) => `${i?.manageBy}|${i?.batchNo ? 1 : 0}`).join(',');
                useEffect(() => {
                  (watch('items') || []).forEach((row, idx) => {
                    if (row?.manageBy && row.manageBy !== 'Batch' && row.batchNo) {
                      setValue(`items.${idx}.batchNo`, '', { shouldValidate: true });
                    }
                  });
                  // eslint-disable-next-line react-hooks/exhaustive-deps
                }, [manageByKey]);

                // Switching Branch clears any row whose Warehouse no longer
                // belongs to it — the same rule every branch-scoped warehouse
                // picker in the app follows. Skipped on the very first render
                // so opening an existing row for edit/view doesn't wipe the
                // value just derived into defaultValues above.
                const prevBranchRef = useRef(branch);
                useEffect(() => {
                  if (prevBranchRef.current === branch) return;
                  prevBranchRef.current = branch;
                  const allowed = warehouseCodesForBranch(warehouses, branch);
                  (watch('items') || []).forEach((row, idx) => {
                    if (row?.warehouse && !allowed.has(row.warehouse)) {
                      setValue(`items.${idx}.warehouse`, '');
                    }
                  });
                  // eslint-disable-next-line react-hooks/exhaustive-deps
                }, [branch]);

                // Document Number tracks whichever branch is currently
                // selected -- its own branchCode, not typed by hand (the
                // field is read-only below). Clearing Branch clears it too,
                // rather than leaving a stale code behind once no branch is
                // selected.
                useEffect(() => {
                  setValue('documentNumber', branch ? (branchCodeByName[branch] || '') : '');
                  // eslint-disable-next-line react-hooks/exhaustive-deps
                }, [branch]);

                // A new line inherits the header's status so the common case
                // needs no per-row typing at all. Document Number/Date are no
                // longer per-line — every line is stamped with the header's
                // values on save (see handleSubmit).
                const appendBlankRow = () => append({
                  ...emptyItem,
                  status: watch('status') || 'Active',
                });

                // Clears the whole table in one action instead of removing
                // rows one at a time (the per-row remove button is also
                // disabled on the last remaining row, so there was
                // previously no way to empty a document with several lines
                // without repeated clicks). A document still needs at least
                // one line to submit (see openingBalanceDocumentSchema), so
                // this leaves one fresh blank row behind rather than an
                // empty table -- the same starting state a brand-new
                // document opens with.
                const handleDeleteAllItems = async () => {
                  const ok = await confirmDialog({
                    title: 'Delete all item lines',
                    message: `Remove all ${fields.length} item line(s) from this document? This cannot be undone.`,
                    confirmLabel: 'Delete All',
                    severity: 'error',
                  });
                  if (!ok) return;
                  removeItem();
                  appendBlankRow();
                  setVisibleItemCount(50);
                  notify.success('All item lines removed');
                };

                // Rows parsed out of the uploaded sheet. The server only
                // checked them structurally; resolving each one against the
                // masters loaded on this page is what makes an imported line
                // identical to a hand-picked one (see ImportItemsDialog).
                const handleItemsImported = (imported) => {
                  const warehouseByCode = new Map((warehouses || []).map((w) => [String(w.whsCode).trim().toLowerCase(), w]));
                  const productByCode = new Map((products || []).map((p) => [String(p.productCode).trim().toLowerCase(), p]));
                  const unmatchedWarehouseRows = [];

                  // A brand-new document starts with one untouched blank row
                  // (see getEmptyValues/emptyItem) so there's always at least
                  // one line to fill in by hand. Importing just appended the
                  // sheet's rows after it, so that starter row was left behind
                  // empty at the top of the table instead of being replaced —
                  // drop it first when it's still blank, so the imported rows
                  // are all the table ends up showing.
                  const currentItems = watch('items') || [];
                  const isBlankRow = (row) => !row?.itemCode && !row?.itemName && !row?.warehouse && !row?.batchNo && !row?.stock && !row?.stockValue;
                  if (currentItems.length === 1 && isBlankRow(currentItems[0])) {
                    removeItem(0);
                  }


                  // Built up as a plain array and handed to append() ONCE
                  // at the end, rather than calling append() once per row
                  // inside this loop. useFieldArray's append() triggers its
                  // own React state update/re-render every time it's
                  // called -- 300-500 individual calls meant 300-500
                  // separate re-renders of the whole item table (each one
                  // also re-running the Save button's own full-document
                  // validation, before that was deferred), which is exactly
                  // what made a large import feel like it was hanging. A
                  // single append(array) call is one state update no
                  // matter how many rows it carries.
                  const newRows = imported.map((line, i) => {
                    const rowNum = i + 1;
                    const product = productByCode.get(String(line.itemCode || '').trim().toLowerCase());
                    const wh = warehouseByCode.get(String(line.warehouse || '').trim().toLowerCase());
                    if (!wh) unmatchedWarehouseRows.push(rowNum);

                    const resolvedItemCode = product ? product.productCode : (line.itemCode || '');
                    const resolvedWarehouse = wh ? wh.whsCode : '';
                    return {
                      itemCode: resolvedItemCode,
                      // Prefer the master's name over the sheet's, so a stale
                      // description in the file can't contradict the product.
                      itemName: product ? product.productName : (line.itemName || ''),
                      // Sheet's Manage By wins; blank falls back to the product's
                      // setting. Batch No. only survives on Batch lines.
                      manageBy: line.manageBy || manageByFromProduct(product),
                      warehouse: resolvedWarehouse,
                      batchNo: (line.manageBy || manageByFromProduct(product)) === 'Batch' ? (line.batchNo || '') : '',
                      stock: line.stock ?? '',
                      // Unit Cost comes from the DLP price list; Stock Value is
                      // then computed as Stock x Unit Cost.
                      unitCost: dlpRates?.get(resolvedItemCode) ?? 0,
                      stockValue: '',
                      status: line.status || watch('status') || 'Active',
                    };
                  });
                  if (newRows.length) append(newRows);

                  // Named row numbers (capped so the toast itself stays
                  // readable) rather than just a count -- a count alone
                  // gives no way to find the actual rows in a large table.
                  const listRows = (rows, max = 15) => {
                    const shown = rows.slice(0, max).join(', ');
                    return rows.length > max ? `${shown}, +${rows.length - max} more` : shown;
                  };

                  if (unmatchedWarehouseRows.length > 0) {
                    notify.warning(
                      `Row(s) ${listRows(unmatchedWarehouseRows)} named a warehouse that isn't in the Warehouse Master — pick one on those lines before saving.`,
                      { duration: 15000 }
                    );
                  }
                };

                return (
                  <>
                    <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                      <LabeledField label="Branch *">
                        <FormSelect name="branch" label="" placeholder="Select branch" options={branchOptions} />
                      </LabeledField>
                      <LabeledField label="Document Number">
                        <FormTextField name="documentNumber" label="" placeholder="Select a branch first" disabled />
                      </LabeledField>
                      <LabeledField label="Document Date">
                        <FormDatePicker name="documentDate" label="" />
                      </LabeledField>
                      <LabeledField label="Opening Balance Account *">
                        <FormSelect
                          name="openingBalanceAccount"
                          label=""
                          placeholder="Search G/L account"
                          options={accountOptions}
                          onValueChange={handleAccountChange}
                          popupFitContent
                        />
                      </LabeledField>
                      <LabeledField label="Account Description">
                        <FormTextField
                          name="openingBalanceAccountDescription"
                          label=""
                          disabled
                          placeholder="Auto-filled from Opening Balance Account"
                        />
                      </LabeledField>
                      <LabeledField label="Status *">
                        <FormSelect name="status" label="" options={STATUS_OPTIONS} />
                      </LabeledField>
                    </FormGrid>

                    <Box sx={{ mt: 3 }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight={700}>Item Details</Typography>
                        {!readOnly && (
                          <Stack direction="row" spacing={1.5}>
                            <Button
                              type="button"
                              variant="outlined"
                              color="inherit"
                              size="small"
                              startIcon={<UploadFileIcon />}
                              onClick={() => setItemsImportOpen(true)}
                            >
                              Import Items
                            </Button>
                            <Button type="button" variant="outlined" size="small" startIcon={<AddIcon />} onClick={appendBlankRow}>
                              Add Row
                            </Button>
                            <Button
                              type="button"
                              variant="outlined"
                              color="error"
                              size="small"
                              startIcon={<DeleteIcon />}
                              disabled={fields.length === 0}
                              onClick={handleDeleteAllItems}
                            >
                              Delete All
                            </Button>
                          </Stack>
                        )}
                      </Stack>

                      {readOnly ? (
                        // Read-only View renders straight from editingRow.items
                        // (plain text, no react-hook-form fields/subscriptions,
                        // no MUI Select/Autocomplete per row) instead of the
                        // editable field-array table below. A document with a
                        // couple of lines never noticed the difference, but one
                        // from a bulk import (100+ lines, each of the editable
                        // table's rows mounting several heavy MUI form
                        // controls) made View take long enough to look like the
                        // page had frozen, for a screen that never needed to be
                        // interactive in the first place.
                        isMobile ? (
                          <Box>
                            {(editingRow?.items || []).map((it, index) => (
                              <MobileItemCard key={it.id ?? index} index={index} amount={Number(it.stockValue ?? 0).toFixed(2)} removeDisabled>
                                <Typography variant="body2">{it.itemCode || '—'}</Typography>
                                <Typography variant="body2" color="text.secondary">{it.itemName || '—'}</Typography>
                                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 1.5, rowGap: 0.5 }}>
                                  <Typography variant="caption" color="text.secondary">Warehouse: {warehouseLabelByCode.get(it.warehouse) || it.warehouse || '—'}</Typography>
                                  <Typography variant="caption" color="text.secondary">Manage By: {it.manageBy || (it.batchNo ? 'Batch' : '—')}</Typography>
                                  <Typography variant="caption" color="text.secondary">Batch No.: {it.batchNo || '—'}</Typography>
                                  <Typography variant="caption" color="text.secondary">Stock: {Number(it.stock ?? 0).toFixed(2)}</Typography>
                                  <Typography variant="caption" color="text.secondary">Unit Cost: ₹{(Number(it.unitCost) > 0 ? Number(it.unitCost) : (Number(it.stock) > 0 ? Number(it.stockValue) / Number(it.stock) : 0)).toFixed(2)}</Typography>
                                  <Typography variant="caption" color="text.secondary">Stock Value: ₹{Number(it.stockValue ?? 0).toFixed(2)}</Typography>
                                  <Typography variant="caption" color="text.secondary">Status: {it.status || '—'}</Typography>
                                </Box>
                              </MobileItemCard>
                            ))}
                          </Box>
                        ) : (
                          <TableContainer ref={itemScrollRef} sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', cursor: 'grab', ...dragScrollbarSx }}>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell width={40}>#</TableCell>
                                  <TableCell>Item Code</TableCell>
                                  <TableCell>Item Name</TableCell>
                                  <TableCell>Manage By</TableCell>
                                  <TableCell>Warehouse</TableCell>
                                  <TableCell>Batch No.</TableCell>
                                  <TableCell align="right">Stock</TableCell>
                                  <TableCell align="right">Unit Cost (₹)</TableCell>
                                  <TableCell align="right">Stock Value (₹)</TableCell>
                                  <TableCell>Status</TableCell>
                                  <TableCell>Created At</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {(editingRow?.items || []).map((it, index) => (
                                  <TableRow key={it.id ?? index}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{it.itemCode || '—'}</TableCell>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{it.itemName || '—'}</TableCell>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{it.manageBy || (it.batchNo ? 'Batch' : '—')}</TableCell>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{warehouseLabelByCode.get(it.warehouse) || it.warehouse || '—'}</TableCell>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{it.batchNo || '—'}</TableCell>
                                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(it.stock ?? 0).toFixed(2)}</TableCell>
                                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                      {(Number(it.unitCost) > 0 ? Number(it.unitCost) : (Number(it.stock) > 0 ? Number(it.stockValue) / Number(it.stock) : 0)).toFixed(2)}
                                    </TableCell>
                                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(it.stockValue ?? 0).toFixed(2)}</TableCell>
                                    <TableCell>
                                      <Chip size="small" label={it.status || 'Active'} color={it.status === 'Active' ? 'success' : 'default'} variant="outlined" />
                                    </TableCell>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{it.createdAt ? formatDateTime(it.createdAt) : '—'}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        )
                      ) : isMobile ? (
                        <Box>
                          {fields.map((field, index) => ({ field, index })).slice(0, visibleItemCount).map(({ field, index }) => (
                            <MobileItemCard
                              key={field.id}
                              index={index}
                              amount={Number(watch(`items.${index}.stockValue`) || 0).toFixed(2)}
                              onRemove={() => removeItem(index)}
                              removeDisabled={fields.length <= 1 || readOnly}
                            >
                              <ItemCell dlpRates={dlpRates} index={index} methods={methods} products={products} options={itemCodeOptions} placeholder="Select item code" />
                              <ItemCell dlpRates={dlpRates} index={index} methods={methods} products={products} options={itemNameOptions} placeholder="Select item name" />
                              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 1.5, rowGap: 1.5 }}>
                                <FormSelect name={`items.${index}.manageBy`} label="Manage By *" options={MANAGE_BY_OPTIONS} />
                                <FormSelect
                                  name={`items.${index}.warehouse`}
                                  label="Warehouse *"
                                  placeholder={branch ? 'Select' : 'Select branch first'}
                                  options={warehouseOptions}
                                  disabled={!branch}
                                />
                                {/* Required only when this line's item is
                                    Batch-managed (Product Master) --
                                    validateOpeningBalanceBatches enforces
                                    that on submit; left optional here since
                                    a non-tracked item never needs it. */}
                                <FormTextField
                                  name={`items.${index}.batchNo`}
                                  label={watch(`items.${index}.manageBy`) === 'Batch' ? 'Batch No. *' : 'Batch No.'}
                                  disabled={watch(`items.${index}.manageBy`) !== 'Batch'}
                                />
                                <FormTextField name={`items.${index}.stock`} label="Stock *" type="number" />
                                <FormTextField
                                  name={`items.${index}.unitCost`}
                                  label="Unit Cost (₹) *"
                                  type="number"
                                  disabled={dlpRates?.has(watch(`items.${index}.itemCode`))}
                                />
                                <FormTextField name={`items.${index}.stockValue`} label="Stock Value (₹) *" type="number" disabled />
                                <FormSelect name={`items.${index}.status`} label="Status *" options={STATUS_OPTIONS} />
                              </Box>
                            </MobileItemCard>
                          ))}
                          {/* Rows beyond visibleItemCount are still in form
                              state (fields keeps every one of them) -- only
                              this many are actually mounted at once, so a
                              document with hundreds of lines doesn't have to
                              pay for hundreds of MUI form controls just to
                              open. */}
                          {fields.length > visibleItemCount && (
                            <Button type="button" variant="outlined" fullWidth onClick={() => setVisibleItemCount((n) => n + 50)} sx={{ mt: 1 }}>
                              Show 50 more ({fields.length - visibleItemCount} remaining)
                            </Button>
                          )}
                        </Box>
                      ) : (
                        <TableContainer ref={itemScrollRef} sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', cursor: 'grab', ...dragScrollbarSx }}>
                          <Table size="small" sx={[itemColumnsSx, { '& tbody .MuiFormHelperText-root:not(.Mui-error)': { display: 'none' } }]}>
                            <TableHead>
                              <TableRow>
                                <TableCell width={40}>#</TableCell>
                                <TableCell>Item Code *</TableCell>
                                <TableCell>Item Name *</TableCell>
                                <TableCell>Manage By *</TableCell>
                                <TableCell>Warehouse *</TableCell>
                                <TableCell>Batch No.</TableCell>
                                <TableCell align="right">Stock *</TableCell>
                                <TableCell align="right">Unit Cost (₹) *</TableCell>
                                <TableCell align="right">Stock Value (₹) *</TableCell>
                                <TableCell>Status *</TableCell>
                                <TableCell>Created At</TableCell>
                                <TableCell width={48}>Action</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {fields.map((field, index) => ({ field, index })).slice(0, visibleItemCount).map(({ field, index }) => (
                                <TableRow key={field.id} sx={{ '& > td': { verticalAlign: 'middle' } }}>
                                  <TableCell>{index + 1}</TableCell>
                                  <TableCell>
                                    <ItemCell dlpRates={dlpRates} index={index} methods={methods} products={products} options={itemCodeOptions} placeholder="Select item code" sx={{ minWidth: 200 }} />
                                  </TableCell>
                                  <TableCell>
                                    <ItemCell dlpRates={dlpRates} index={index} methods={methods} products={products} options={itemNameOptions} placeholder="Select item name" sx={{ minWidth: 240 }} />
                                  </TableCell>
                                  <TableCell>
                                    {/* Choice list: Batch / Serial / Standard. Batch No.
                                        is required (and enabled) only for Batch. */}
                                    <FormSelect name={`items.${index}.manageBy`} label="" placeholder="Select" options={MANAGE_BY_OPTIONS} sx={{ minWidth: 130 }} popupFitContent />
                                  </TableCell>
                                  <TableCell>
                                    <FormSelect
                                      name={`items.${index}.warehouse`}
                                      label=""
                                      placeholder={branch ? 'Select' : 'Select branch first'}
                                      options={warehouseOptions}
                                      disabled={!branch}
                                      sx={{ minWidth: 150 }}
                                      popupFitContent
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <FormTextField
                                      name={`items.${index}.batchNo`}
                                      label=""
                                      placeholder={watchedItems[index]?.manageBy === 'Batch' ? 'Batch No. *' : 'Not required'}
                                      disabled={watchedItems[index]?.manageBy !== 'Batch'}
                                      sx={{ minWidth: 130 }}
                                    />
                                  </TableCell>
                                  <TableCell align="right">
                                    <FormTextField name={`items.${index}.stock`} label="" type="number" inputProps={{ style: { textAlign: 'right' } }} />
                                  </TableCell>
                                  <TableCell align="right">
                                    {/* Filled from the DLP price list when the item
                                        has a price there (then locked); an item with
                                        no DLP price is entered by hand. */}
                                    <FormTextField
                                      name={`items.${index}.unitCost`}
                                      label=""
                                      type="number"
                                      disabled={dlpRates?.has(watchedItems[index]?.itemCode)}
                                      inputProps={{ style: { textAlign: 'right' } }}
                                    />
                                  </TableCell>
                                  <TableCell align="right">
                                    {/* Always Stock x Unit Cost -- computed, not typed. */}
                                    <FormTextField name={`items.${index}.stockValue`} label="" type="number" disabled inputProps={{ style: { textAlign: 'right' } }} />
                                  </TableCell>
                                  <TableCell>
                                    <FormSelect name={`items.${index}.status`} label="" options={STATUS_OPTIONS} sx={{ minWidth: 120 }} />
                                  </TableCell>
                                  {/* Server-stamped on insert, so a line that
                                      hasn't been saved yet genuinely has none. */}
                                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                    {editingRow?.items?.[index]?.createdAt ? formatDateTime(editingRow.items[index].createdAt) : '—'}
                                  </TableCell>
                                  <TableCell>
                                    <IconButton
                                      type="button"
                                      size="small"
                                      color="error"
                                      onClick={() => removeItem(index)}
                                      disabled={fields.length <= 1 || readOnly}
                                      aria-label="remove item"
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          {fields.length > visibleItemCount && (
                            <Button type="button" variant="outlined" fullWidth onClick={() => setVisibleItemCount((n) => n + 50)} sx={{ mt: 1 }}>
                              Show 50 more ({fields.length - visibleItemCount} remaining)
                            </Button>
                          )}
                        </TableContainer>
                      )}
                    </Box>

                    {/* Document footer — the same three fields, in the same
                        order, that every Sales/Purchase document closes with
                        (see SalesInvoice.jsx). Header-level: they are stamped
                        onto every line the batch save writes. */}
                    <Card variant="outlined" sx={{ mt: 3 }}>
                      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                        <Grid container spacing={3}>
                          <Grid item xs={12} md={4}>
                            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Terms &amp; Conditions</Typography>
                            <FormTextField name="termsConditions" label="" placeholder="Enter terms and conditions" multiline rows={6} />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Prepared By</Typography>
                            <FormTextField name="preparedBy" label="" disabled />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Approved By</Typography>
                            <FormSelect name="approvedBy" label="" placeholder="Select employee" options={approvedByOptions} />
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>

                    <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 3 }}>
                      <Button variant="outlined" color={readOnly ? 'error' : 'inherit'} onClick={closeForm} disabled={savingBatch || updating}>
                        {readOnly ? 'Close' : 'Clear'}
                      </Button>
                      <FormSubmitButton disabled={savingBatch || updating} loading={savingBatch || updating}>
                        {readOnly ? 'View' : editingRow ? 'Update Inventory Opening Balance' : 'Save Inventory Opening Balance'}
                      </FormSubmitButton>
                    </Stack>

                    <ImportItemsDialog
                      open={itemsImportOpen}
                      onClose={() => setItemsImportOpen(false)}
                      resourceName="Opening Balance Items"
                      templateUrl="/opening-balance/items-import/template"
                      importUrl="/opening-balance/items-import"
                      onImported={handleItemsImported}
                    />
                  </>
                );
              }}
            </AppForm>
          </CardContent>
        </Card>
      </Collapse>

      {/* The form and the list are mutually exclusive: opening Add/Edit/View
          gives the document the whole screen, and the list comes back only
          once the form is closed. Unmounted rather than hidden so the long
          list isn't rendering (or holding scroll position) behind it. */}
      {!showForm && (
      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Inventory Opening Balance List</Typography>
            <TableSearchFilter table={table} placeholder="Search by document number, branch..." width={260} />
          </Stack>

          <TableFilterPanel table={table} />

          {/* One row per Document Number, not per item line -- Branch,
              Document Number, Document Date and Status are the same fields
              the header card above collects. The Item Details for a document
              are reached by drilling in through its own Action -> View. */}
          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {!isLoading && pagedRows.map((group) => (
                <MobileRecordCard
                  key={group.key}
                  title={group.documentNumber || '(No document number)'}
                  statusChip={<Chip size="small" label={group.status} color={group.status === 'Active' ? 'success' : 'default'} variant="outlined" />}
                  fields={[
                    { label: 'Branch', value: group.branch || '—' },
                    { label: 'Document Date', value: formatDate(group.documentDate) },
                    { label: 'Opening Balance Account', value: group.accountName || group.openingBalanceAccount || '—' },
                    { label: 'Items', value: String(group.itemCount) },
                  ]}
                  onView={() => handleView(group)}
                  onEdit={() => handleEdit(group)}
                  onDelete={() => handleDeleteDocument(group)}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No opening balances yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first opening balance to get started'} />
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table
                size="small"
                stickyHeader
                sx={{
                  '& th, & td': {
                    height: OPENING_BALANCE_LIST_TABLE_ROW_HEIGHT,
                    paddingTop: `${OPENING_BALANCE_LIST_TABLE_CELL_PADDING_Y}px`,
                    paddingBottom: `${OPENING_BALANCE_LIST_TABLE_CELL_PADDING_Y}px`,
                    boxSizing: 'border-box',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell width={48}>#</TableCell>
                    <SortableHeaderCell field="branch" sort={table.sort} onSort={table.toggleSort}>Branch</SortableHeaderCell>
                    <SortableHeaderCell field="documentNumber" sort={table.sort} onSort={table.toggleSort}>Document Number</SortableHeaderCell>
                    <SortableHeaderCell field="documentDate" sort={table.sort} onSort={table.toggleSort}>Document Date</SortableHeaderCell>
                    <SortableHeaderCell field="accountName" sort={table.sort} onSort={table.toggleSort}>Opening Balance Account</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((group, i) => (
                    <TableRow key={group.key} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{group.branch || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{group.documentNumber || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(group.documentDate)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{group.accountName || group.openingBalanceAccount || '—'}</TableCell>
                      <TableCell>
                        <Chip size="small" label={group.status} color={group.status === 'Active' ? 'success' : 'default'} variant="outlined" />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <IconButton size="small" onClick={() => handleView(group)} aria-label="view">
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleEdit(group)} aria-label="edit">
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                          <CanDelete>
                            <IconButton size="small" color="error" onClick={() => handleDeleteDocument(group)} aria-label="delete">
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </CanDelete>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No opening balances yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first opening balance to get started'} />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollableTableContainer>
          )}

          <EntityListPagination total={rows.length} page={page} onChange={setPage} pageSize={pageSize} onPageSizeChange={(v) => { setPageSize(v); setPage(0); }} />
        </CardContent>
      </Card>
      )}
    </Box>
  );
}
