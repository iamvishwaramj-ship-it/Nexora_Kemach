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
  branchApi, productApi, salesEmployeeApi,
} from '../../features/resources';
import { useWarehouseOptions, warehouseCodesForBranch } from '../../lib/useWarehouseOptions';
import { PRODUCT_USAGE, productOptionsFor } from '../../lib/productUsage';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer, { dragScrollbarSx } from '../../components/data-display/ScrollableTableContainer';

import { CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';

const STATUS_OPTIONS = [{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }];

// One blank item line. Document Number/Document Date are header-only now —
// the Item Details table dropped its per-line override columns for them, so
// every line is stamped with the header's values on save instead.
const emptyItem = {
  itemCode: '', itemName: '',
  warehouse: '', stock: '', stockValue: '', status: 'Active',
};

// `branch` rides along on the form purely to drive every row's Warehouse
// dropdown — opening_balance has no branch column (a warehouse already
// belongs to exactly one branch via WarehouseMaster.branch), so handleSubmit
// strips it back out before calling the API.
function getEmptyValues(preparedBy) {
  return {
    branch: '', documentNumber: '', documentDate: null, status: 'Active',
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
function ItemCell({ index, methods, products, options, placeholder, sx }) {
  const { watch, setValue } = methods;
  const itemCodeValue = watch(`items.${index}.itemCode`);
  const prevValue = useRef(itemCodeValue);

  useEffect(() => {
    if (itemCodeValue !== prevValue.current) {
      const found = (products || []).find((p) => p.productCode === itemCodeValue);
      if (found) setValue(`items.${index}.itemName`, found.productName, { shouldValidate: true });
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

// Totals row pinned to the bottom of the list scroller. MUI puts TableFooter
// cells in the `footer` variant, which greys and shrinks the text, so the
// colour/size/weight are restated here to read as a real totals line.
const totalsRowSx = {
  '& td': {
    position: 'sticky',
    bottom: 0,
    zIndex: 2,
    // Opaque on purpose: action.hover is a translucent overlay, and rows would
    // show through a row that is pinned on top of them.
    backgroundColor: (theme) => (theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[100]),
    borderTop: '1px solid',
    borderColor: 'divider',
    color: 'text.primary',
    fontSize: (theme) => theme.typography.body2.fontSize,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
};
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
  const [itemsImportOpen, setItemsImportOpen] = useState(false);
  const branchOptions = (branches || []).map((b) => ({ label: b.branchName, value: b.branchName }));

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

  const allRows = balances || [];

  const tableColumns = useMemo(() => ([
    { field: 'documentNumber', headerName: 'Document Number', filter: 'text' },
    { field: 'documentDate', headerName: 'Document Date', filter: 'dateRange', sortValue: (row) => (row.documentDate ? new Date(row.documentDate).getTime() : null), searchValue: (row) => formatDate(row.documentDate) },
    { field: 'itemCode', headerName: 'Item Code', filter: 'text' },
    { field: 'itemName', headerName: 'Item Name', filter: 'text' },
    { field: 'warehouse', headerName: 'Warehouse', filter: 'text' },
    { field: 'stock', headerName: 'Stock', filter: 'numberRange', sortValue: (row) => (row.stock == null ? null : Number(row.stock)) },
    { field: 'stockValue', headerName: 'Stock Value (₹)', filter: 'numberRange', sortValue: (row) => (row.stockValue == null ? null : Number(row.stockValue)) },
    { field: 'status', headerName: 'Status', filter: 'select' },
    { field: 'createdAt', headerName: 'Created At', filter: 'dateRange', sortValue: (row) => (row.createdAt ? new Date(row.createdAt).getTime() : null), searchValue: (row) => formatDateTime(row.createdAt) },
  ]), []);
  const table = useTableFeatures(allRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  // Totals across every row the current search/filters match — not just the
  // page on screen — since "total stock" that changed when you paged would be
  // useless. Rendered outside the table's horizontal scroller so they stay
  // visible no matter how far the columns are scrolled across.
  const listTotals = useMemo(() => rows.reduce(
    (acc, r) => ({
      stock: acc.stock + (Number(r.stock) || 0),
      stockValue: acc.stockValue + (Number(r.stockValue) || 0),
    }),
    { stock: 0, stockValue: 0 }
  ), [rows]);

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
  const handleView = (row) => {
    setEditingRow(row);
    setReadOnly(true);
    setFormKey((k) => k + 1);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (row) => {
    const ok = await confirmDialog({
      title: 'Delete opening balance',
      message: `Are you sure you want to delete the opening balance for "${row.itemCode}" at "${row.warehouse}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Opening balance deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    // branch only exists on the form to scope the Warehouse dropdowns —
    // opening_balance has no branch column, so it is dropped here rather
    // than sent to an API that would reject an unknown field.
    const { branch: _branch, items, ...header } = values;

    try {
      if (editingRow) {
        // Editing targets ONE existing row, so it goes through the ordinary
        // per-record update rather than the batch endpoint. That matters:
        // the batch upserts on (itemCode, warehouse), so changing either of
        // those on an existing row would create a second row and strand the
        // original instead of moving it.
        const line = (items || [])[0] || {};
        await update({
          id: editingRow.id,
          documentNumber: header.documentNumber || null,
          documentDate: header.documentDate || null,
          itemCode: line.itemCode,
          itemName: line.itemName,
          warehouse: line.warehouse,
          stock: line.stock,
          stockValue: line.stockValue,
          status: line.status || header.status,
          termsConditions: header.termsConditions || null,
          preparedBy: header.preparedBy || null,
          approvedBy: header.approvedBy || null,
        }).unwrap();
        notify.success('Opening balance updated');
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
        title="Opening Balance"
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
          {showForm ? 'Close' : 'Add Opening Balance'}
        </Button>
      </Stack>

      <Collapse in={showForm} unmountOnExit>
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
              {readOnly ? 'View Opening Balance' : editingRow ? 'Edit Opening Balance' : 'New Opening Balance'}
            </Typography>

            <AppForm readOnly={readOnly}
              key={formKey}
              schema={openingBalanceDocumentSchema}
              defaultValues={editingRow
                ? {
                  ...getEmptyValues(),
                  // Derived, not stored — a warehouse belongs to exactly one
                  // branch, so the row's own warehouse tells us which.
                  branch: (warehouses || []).find((w) => w.whsCode === editingRow.warehouse)?.branch || '',
                  documentNumber: editingRow.documentNumber || '',
                  documentDate: editingRow.documentDate || null,
                  status: editingRow.status || 'Active',
                  termsConditions: editingRow.termsConditions || '',
                  preparedBy: editingRow.preparedBy || '',
                  approvedBy: editingRow.approvedBy || '',
                  items: [{
                    itemCode: editingRow.itemCode || '',
                    itemName: editingRow.itemName || '',
                    warehouse: editingRow.warehouse || '',
                    stock: editingRow.stock ?? '',
                    stockValue: editingRow.stockValue ?? '',
                    status: editingRow.status || 'Active',
                  }],
                }
                : getEmptyValues(currentUser?.name || currentUser?.email)}
              onSubmit={handleSubmit}
            >
              {(methods) => {
                const { watch, setValue, control } = methods;
                const branch = watch('branch');
                const { fields, append, remove: removeItem } = useFieldArray({ control, name: 'items' });
                const watchedItems = watch('items') || [];
                const { options: warehouseOptions } = useWarehouseOptions({
                  currentValue: editingRow?.warehouse,
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
                  [editingRow?.itemCode, ...watchedItems.map((i) => i?.itemCode)].filter(Boolean)
                );
                const itemCodeOptions = selectableProducts.map((p) => ({ label: p.productCode, value: p.productCode, productCode: p.productCode, productName: p.productName }));
                const itemNameOptions = selectableProducts.map((p) => ({ label: p.productName, value: p.productCode, productCode: p.productCode, productName: p.productName }));

                // Columns only take the width their content needs — see
                // itemTableSx in lib/columnWidth.js.
                const itemColumnsSx = itemTableSx(watchedItems, []);

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

                // A new line inherits the header's status so the common case
                // needs no per-row typing at all. Document Number/Date are no
                // longer per-line — every line is stamped with the header's
                // values on save (see handleSubmit).
                const appendBlankRow = () => append({
                  ...emptyItem,
                  status: watch('status') || 'Active',
                });

                // Rows parsed out of the uploaded sheet. The server only
                // checked them structurally; resolving each one against the
                // masters loaded on this page is what makes an imported line
                // identical to a hand-picked one (see ImportItemsDialog).
                const handleItemsImported = (imported) => {
                  const warehouseByCode = new Map((warehouses || []).map((w) => [String(w.whsCode).trim().toLowerCase(), w]));
                  const productByCode = new Map((products || []).map((p) => [String(p.productCode).trim().toLowerCase(), p]));
                  let unmatchedWarehouse = 0;

                  // A brand-new document starts with one untouched blank row
                  // (see getEmptyValues/emptyItem) so there's always at least
                  // one line to fill in by hand. Importing just appended the
                  // sheet's rows after it, so that starter row was left behind
                  // empty at the top of the table instead of being replaced —
                  // drop it first when it's still blank, so the imported rows
                  // are all the table ends up showing.
                  const currentItems = watch('items') || [];
                  const isBlankRow = (row) => !row?.itemCode && !row?.itemName && !row?.warehouse && !row?.stock && !row?.stockValue;
                  if (currentItems.length === 1 && isBlankRow(currentItems[0])) {
                    removeItem(0);
                  }

                  imported.forEach((line) => {
                    const product = productByCode.get(String(line.itemCode || '').trim().toLowerCase());
                    const wh = warehouseByCode.get(String(line.warehouse || '').trim().toLowerCase());
                    if (!wh) unmatchedWarehouse += 1;
                    append({
                      itemCode: product ? product.productCode : (line.itemCode || ''),
                      // Prefer the master's name over the sheet's, so a stale
                      // description in the file can't contradict the product.
                      itemName: product ? product.productName : (line.itemName || ''),
                      warehouse: wh ? wh.whsCode : '',
                      stock: line.stock ?? '',
                      stockValue: line.stockValue ?? '',
                      status: line.status || watch('status') || 'Active',
                    });
                  });

                  if (unmatchedWarehouse > 0) {
                    notify.warning(
                      `${unmatchedWarehouse} imported row(s) named a warehouse that isn't in the Warehouse Master — pick one on those lines before saving.`,
                      { duration: 10000 }
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
                        <FormTextField name="documentNumber" label="" placeholder="Enter document number" />
                      </LabeledField>
                      <LabeledField label="Document Date">
                        <FormDatePicker name="documentDate" label="" />
                      </LabeledField>
                      <LabeledField label="Status *">
                        <FormSelect name="status" label="" options={STATUS_OPTIONS} />
                      </LabeledField>
                    </FormGrid>

                    <Box sx={{ mt: 3 }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight={700}>Item Details</Typography>
                        {!readOnly && !editingRow && (
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
                          </Stack>
                        )}
                      </Stack>

                      {isMobile ? (
                        <Box>
                          {fields.map((field, index) => (
                            <MobileItemCard
                              key={field.id}
                              index={index}
                              amount={Number(watch(`items.${index}.stockValue`) || 0).toFixed(2)}
                              onRemove={() => removeItem(index)}
                              removeDisabled={fields.length <= 1 || !!editingRow}
                            >
                              <ItemCell index={index} methods={methods} products={products} options={itemCodeOptions} placeholder="Select item code" />
                              <ItemCell index={index} methods={methods} products={products} options={itemNameOptions} placeholder="Select item name" />
                              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 1.5, rowGap: 1.5 }}>
                                <FormSelect
                                  name={`items.${index}.warehouse`}
                                  label="Warehouse *"
                                  placeholder={branch ? 'Select' : 'Select branch first'}
                                  options={warehouseOptions}
                                  disabled={!branch}
                                />
                                <FormTextField name={`items.${index}.stock`} label="Stock *" type="number" />
                                <FormTextField name={`items.${index}.stockValue`} label="Stock Value (₹) *" type="number" />
                                <FormSelect name={`items.${index}.status`} label="Status *" options={STATUS_OPTIONS} />
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
                                <TableCell>Item Code *</TableCell>
                                <TableCell>Item Name *</TableCell>
                                <TableCell>Warehouse *</TableCell>
                                <TableCell align="right">Stock *</TableCell>
                                <TableCell align="right">Stock Value (₹) *</TableCell>
                                <TableCell>Status *</TableCell>
                                <TableCell>Created At</TableCell>
                                <TableCell width={48}>Action</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {fields.map((field, index) => (
                                <TableRow key={field.id} sx={{ '& > td': { verticalAlign: 'middle' } }}>
                                  <TableCell>{index + 1}</TableCell>
                                  <TableCell>
                                    <ItemCell index={index} methods={methods} products={products} options={itemCodeOptions} placeholder="Select item code" sx={{ minWidth: 200 }} />
                                  </TableCell>
                                  <TableCell>
                                    <ItemCell index={index} methods={methods} products={products} options={itemNameOptions} placeholder="Select item name" sx={{ minWidth: 240 }} />
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
                                  <TableCell align="right">
                                    <FormTextField name={`items.${index}.stock`} label="" type="number" inputProps={{ style: { textAlign: 'right' } }} />
                                  </TableCell>
                                  <TableCell align="right">
                                    <FormTextField name={`items.${index}.stockValue`} label="" type="number" inputProps={{ style: { textAlign: 'right' } }} />
                                  </TableCell>
                                  <TableCell>
                                    <FormSelect name={`items.${index}.status`} label="" options={STATUS_OPTIONS} sx={{ minWidth: 120 }} />
                                  </TableCell>
                                  {/* Server-stamped on insert, so a line that
                                      hasn't been saved yet genuinely has none. */}
                                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                    {editingRow ? formatDateTime(editingRow.createdAt) : '—'}
                                  </TableCell>
                                  <TableCell>
                                    <IconButton
                                      type="button"
                                      size="small"
                                      color="error"
                                      onClick={() => removeItem(index)}
                                      disabled={fields.length <= 1 || !!editingRow}
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
                      <FormSubmitButton disabled={savingBatch || updating}>
                        {readOnly ? 'View' : editingRow ? 'Update Opening Balance' : 'Save Opening Balance'}
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
            <Typography variant="subtitle1" fontWeight={700}>Opening Balance List</Typography>
            <TableSearchFilter table={table} placeholder="Search by item code, name, warehouse..." width={260} />
          </Stack>

          <TableFilterPanel table={table} />

          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {!isLoading && pagedRows.map((row) => (
                <MobileRecordCard
                  key={row.id}
                  title={row.itemName}
                  statusChip={<Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />}
                  fields={[
                    { label: 'Document Number', value: row.documentNumber || '—' },
                    { label: 'Document Date', value: formatDate(row.documentDate) },
                    { label: 'Item Code', value: row.itemCode },
                    { label: 'Warehouse', value: row.warehouse || '—' },
                    { label: 'Stock', value: Number(row.stock ?? 0).toFixed(2) },
                    { label: 'Stock Value', value: `₹${Number(row.stockValue ?? 0).toFixed(2)}` },
                    { label: 'Created At', value: formatDateTime(row.createdAt) },
                  ]}
                  onView={() => handleView(row)}
                  onDelete={() => handleDelete(row)}
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
                    <SortableHeaderCell field="documentNumber" sort={table.sort} onSort={table.toggleSort}>Document Number</SortableHeaderCell>
                    <SortableHeaderCell field="documentDate" sort={table.sort} onSort={table.toggleSort}>Document Date</SortableHeaderCell>
                    <SortableHeaderCell field="itemCode" sort={table.sort} onSort={table.toggleSort}>Item Code</SortableHeaderCell>
                    <SortableHeaderCell field="itemName" sort={table.sort} onSort={table.toggleSort}>Item Name</SortableHeaderCell>
                    <SortableHeaderCell field="warehouse" sort={table.sort} onSort={table.toggleSort}>Warehouse</SortableHeaderCell>
                    <SortableHeaderCell align="right" field="stock" sort={table.sort} onSort={table.toggleSort}>Stock</SortableHeaderCell>
                    <SortableHeaderCell align="right" field="stockValue" sort={table.sort} onSort={table.toggleSort}>Stock Value (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <SortableHeaderCell field="createdAt" sort={table.sort} onSort={table.toggleSort}>Created At</SortableHeaderCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.documentNumber || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.documentDate)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.itemCode}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.itemName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.warehouse || '—'}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(row.stock ?? 0).toFixed(2)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(row.stockValue ?? 0).toFixed(2)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(row.createdAt)}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <IconButton size="small" onClick={() => handleView(row)} aria-label="view">
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                          <CanDelete>
                            <IconButton size="small" color="error" onClick={() => handleDelete(row)} aria-label="delete">
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </CanDelete>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11}>
                        <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No opening balances yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first opening balance to get started'} />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                {/* Totals live in a TableFooter so each figure sits directly
                    under the column it totals — Stock under Stock, Stock Value
                    under Stock Value — instead of floating at the right edge.
                    `position: sticky; bottom: 0` pins the row to the bottom of
                    the scroller so it stays on screen while the rows scroll,
                    the same way stickyHeader pins the header to the top. */}
                {!isLoading && rows.length > 0 && (
                  <TableFooter>
                    <TableRow sx={totalsRowSx}>
                      <TableCell colSpan={6} align="right">Total</TableCell>
                      <TableCell align="right">{listTotals.stock.toFixed(2)}</TableCell>
                      <TableCell align="right">{listTotals.stockValue.toFixed(2)}</TableCell>
                      <TableCell colSpan={3} />
                    </TableRow>
                  </TableFooter>
                )}
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
