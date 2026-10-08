import React, { useEffect, useMemo, useRef, useState } from 'react';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import {
  Box, Typography, Button, Card, CardContent, Stack, TextField, InputAdornment, Table,
  TableBody, TableCell, TableHead, TableRow, Chip, IconButton, Collapse, Checkbox,
  Autocomplete, Popover, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import EventIcon from '@mui/icons-material/Event';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import { useUnsavedChangesGuard, FormDirtyTracker } from '../../components/form/useUnsavedChangesGuard';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import FilterAutocomplete from '../../components/data-display/FilterAutocomplete';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import useDragScroll from '../../components/data-display/useDragScroll';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { salesPriceSchema } from '../../lib/validation/productSchemas';
import { salesPriceApi, purchasePriceApi, customerApi, productApi } from '../../features/resources';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import { canDelete } from '../../config/deleteConfig';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';
import { useCurrencyOptions } from '../../lib/currencyOptions';
const emptyValues = { customer: '', productCode: '', productName: '', uom: '', currency: 'INR', price: 0, effectiveDate: null, status: 'Active' };

// Currency reads live from Currency Master instead of a hardcoded list —
// see lib/currencyOptions.js.

// Sales pricing is often quoted against a generic price-list tier rather
// than one named account — offer these alongside real customers instead of
// hardcoding the whole "Customer / Price List" field.
const GENERIC_PRICE_LISTS = ['Walk-in Customer', 'Retail Price List', 'Corporate Customer', 'Wholesale Price List'];

const PAGE_SIZE = 10;
const STATUS_FILTERS = ['All', 'Active', 'Inactive'];

const SALES_PRICE_LIST_TABLE_ROW_HEIGHT = 0;
const SALES_PRICE_LIST_TABLE_CELL_PADDING_Y = 6;
export default function SalesPrice() {
  const currencyOptions = useCurrencyOptions();
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const { data: salesPrices, isLoading } = salesPriceApi.useList();
  const { data: purchasePrices } = purchasePriceApi.useList();
  const { data: customers } = customerApi.useList();
  const { data: products } = productApi.useList();
  const [create, { isLoading: creating }] = salesPriceApi.useCreate();
  const [update, { isLoading: updating }] = salesPriceApi.useUpdate();
  const [remove] = salesPriceApi.useDelete();

  // The form lives in a modal — the page itself is the list, and "Add
  // Sales Price" (or an edit action) opens the dialog over it. Same shape
  // as Product Group / Product Sub-Group / Warehouse Master.
  //
  // Declared before the memos below: productOptions reads editingRow to
  // decide which inactive product to still show (see its own comment), so
  // editingRow's useState has to run first — a memo/effect can reference a
  // `const` declared later in the same component, but only after that
  // declaration has actually executed once, and hooks all execute at the
  // top of render in source order. Referencing it earlier in the file threw
  // "Cannot access 'editingRow' before initialization" on every render,
  // which is why this whole page came up blank.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [customerFilter, setCustomerFilter] = useState(null);
  const [productFilter, setProductFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [dateAnchor, setDateAnchor] = useState(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [checkedIds, setCheckedIds] = useState([]);

  const customerOptions = useMemo(() => {
    const real = (customers || []).map((c) => ({ label: c.customerName, value: c.customerName }));
    const generic = GENERIC_PRICE_LISTS.map((label) => ({ label, value: label }));
    return [...generic, ...real];
  }, [customers]);
  // Inactive products are dropped from the picker — same "still show it if
  // the record already references it" exemption productOptionsFor uses for
  // the transactional documents (lib/productUsage.js), so reopening an
  // existing sales price whose product has since been deactivated doesn't
  // blank the field.
  const productOptions = useMemo(() => (products || [])
    .filter((p) => p.status !== 'Inactive' || p.productCode === editingRow?.productCode)
    .map((p) => ({ label: `${p.productName} (${p.productCode})`, value: p.productCode })),
  [products, editingRow]);

  // Cost reference for the Margin (%) column: the most recent Purchase
  // Price entry for that product, falling back to Product Master's own
  // cost price if no purchase price record exists yet.
  const costFor = useMemo(() => {
    const byProduct = new Map();
    (purchasePrices || []).forEach((p) => {
      if (!p.productCode) return;
      const existing = byProduct.get(p.productCode);
      if (!existing || (p.effectiveDate && new Date(p.effectiveDate) > new Date(existing.effectiveDate || 0))) {
        byProduct.set(p.productCode, p);
      }
    });
    return (productCode) => {
      const match = byProduct.get(productCode);
      if (match) return Number(match.price);
      const product = (products || []).find((p) => p.productCode === productCode);
      return product?.costPrice != null ? Number(product.costPrice) : null;
    };
  }, [purchasePrices, products]);

  const rows = salesPrices || [];

  const baseTableRows = useMemo(() => {
    const q = '';
    return rows.filter((r) => {
      const matchesSearch = !q || [r.productName, r.productCode, r.customer].some((v) => String(v || '').toLowerCase().includes(q));
      const matchesCustomer = !customerFilter || r.customer === customerFilter.value;
      const matchesProduct = !productFilter || r.productCode === productFilter.value;
      const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
      const d = r.effectiveDate ? dayjs(r.effectiveDate) : null;
      const matchesFrom = !dateFrom || (d && !d.isBefore(dateFrom, 'day'));
      const matchesTo = !dateTo || (d && !d.isAfter(dateTo, 'day'));
      return matchesSearch && matchesCustomer && matchesProduct && matchesStatus && matchesFrom && matchesTo;
    });
  }, [rows, customerFilter, productFilter, statusFilter, dateFrom, dateTo]);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'id', headerName: 'Select', filter: false, searchable: false },
    { field: 'effectiveDate', headerName: 'Date', filter: 'dateRange', sortValue: (row) => (row.effectiveDate ? new Date(row.effectiveDate).getTime() : null) },
    { field: 'customer', headerName: 'Customer / Price List', filter: 'text' },
    { field: 'productCode', headerName: 'Item No', filter: 'text' },
    { field: 'productName', headerName: 'Description', filter: 'text' },
    { field: 'uom', headerName: 'Unit', filter: 'text' },
    { field: 'price', headerName: 'Sales Price (₹)', filter: 'numberRange', sortValue: (row) => (row.price == null || row.price === '' ? null : Number(row.price)) },
    { field: 'currency', headerName: 'Currency', filter: 'text' },
    { field: 'status', headerName: 'Status', filter: 'select' },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const filteredRows = table.rows;

  const pagedRows = useMemo(
    () => filteredRows.slice(page * pageSize, page * pageSize + pageSize),
    [filteredRows, page, pageSize]
  );

  const allChecked = pagedRows.length > 0 && pagedRows.every((r) => checkedIds.includes(r.id));
  const someChecked = pagedRows.some((r) => checkedIds.includes(r.id)) && !allChecked;

  const marginFor = (row) => {
    const cost = costFor(row.productCode);
    if (!cost) return null;
    return ((Number(row.price) - cost) / cost) * 100;
  };

  const openCreate = () => {
    setEditingRow(null);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    setDialogOpen(true);
  };

  const closeForm = () => {
    setDialogOpen(false);
    setEditingRow(null);
  };

  // Closing a half-filled form asks before throwing the work away.
  // requestClose is what Cancel / the X / Esc go through; forceClose is the
  // save path, which has nothing to lose. See useUnsavedChangesGuard.jsx.
  const { requestClose, forceClose, setDirty, dialogCloseProps } = useUnsavedChangesGuard(closeForm);

  // Read-only look at a record — same form, every field disabled
  // and the save button removed (see AppForm's readOnly prop).
  const handleView = (row) => {
    setEditingRow(row);
    setReadOnly(true);
    setFormKey((k) => k + 1);
    setDialogOpen(true);
  };

  const handleEdit = (row) => {
    setEditingRow(row);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    setDialogOpen(true);
  };

  const handleDelete = async (row) => {
    const ok = await confirmDialog({
      title: 'Delete sales price',
      message: `Are you sure you want to delete the sales price for "${row.productName}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Sales price deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const removeSelected = async () => {
    const ok = await confirmDialog({
      title: 'Delete selected sales prices',
      message: `Delete ${checkedIds.length} selected sales price record${checkedIds.length > 1 ? 's' : ''}? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await Promise.all(checkedIds.map((id) => remove(id).unwrap()));
      notify.success('Selected sales prices deleted');
      setCheckedIds([]);
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    const selectedProduct = (products || []).find((p) => p.productCode === values.productCode);
    const payload = {
      ...values,
      productName: selectedProduct?.productName || values.productName,
      uom: selectedProduct?.uom || values.uom,
    };
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Sales price updated');
      } else {
        await create(payload).unwrap();
        notify.success('Sales price added');
      }
      forceClose();
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
        icon={<SellOutlinedIcon />}
        title="Sales Price"
        subtitle="Manage and track product sales prices."
        rightContent={<CompanyBadge />}
      />

      {/* The form lives in a modal, same shape as Product Group / Product
          Sub-Group — see ProductGroup.jsx's own Dialog for the reference
          this was copied from. */}
      <Dialog
        open={dialogOpen}
        {...dialogCloseProps}
        maxWidth="md"
        fullWidth
        sx={{
          // AppForm wraps its children in a <form>, which lands between the
          // dialog's Paper and DialogContent and breaks the flex chain Paper
          // relies on to make DialogContent scroll. Without this the field
          // grid is clipped on a short viewport instead of scrolling, and
          // the action buttons go with it.
          '& .MuiDialog-paper > form': {
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle
          component="div"
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, pr: 1 }}
        >
          <Typography variant="subtitle1" fontWeight={700}>
            {readOnly ? 'View Sales Price' : editingRow ? 'Edit Sales Price' : 'Add Sales Price'}
          </Typography>
          <IconButton
            onClick={requestClose}
            size="small"
            aria-label="close"
            // Red only while viewing — on an Add/Edit dialog this same button sits
            // beside a live Save, where red would read as destructive.
            sx={readOnly ? {
              border: '1px solid',
              borderColor: 'error.main',
              color: 'error.main',
              '&:hover': { borderColor: 'error.dark', color: 'error.dark' },
            } : undefined}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <AppForm readOnly={readOnly}
          key={formKey}
          schema={salesPriceSchema}
          defaultValues={editingRow ? { ...emptyValues, ...editingRow } : emptyValues}
          onSubmit={handleSubmit}
        >
          {(methods) => {
            // Description / Unit are required by the schema but only
            // ever chosen indirectly via the Product select — sync them
            // in as soon as a product is picked so validation actually
            // has a value to check, instead of relying on the values
            // only being patched after submit. Sales Price is also
            // pre-filled from Product Master's own Sales Price (MRP) so
            // the user isn't retyping a number that's already on record
            // (still editable — this page can quote a different price
            // per customer/price-list than the master default).
            const productCodeValue = methods.watch('productCode');
            const prevProductCode = useRef(editingRow ? editingRow.productCode : null);
            useEffect(() => {
              if (productCodeValue !== prevProductCode.current) {
                const found = (products || []).find((p) => p.productCode === productCodeValue);
                if (found) {
                  methods.setValue('productName', found.productName, { shouldValidate: true });
                  methods.setValue('uom', found.uom || '', { shouldValidate: true });
                  methods.setValue('price', found.salesPrice != null ? Number(found.salesPrice) : 0, { shouldValidate: true });
                }
                prevProductCode.current = productCodeValue;
              }
              // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [productCodeValue]);

            return (
              <>
                {/* Watches for the first real user edit so the close handlers
                    above know whether there is anything to lose. */}
                <FormDirtyTracker onDirtyChange={setDirty} />
                <DialogContent dividers>
                  {/* Label-left field layout — same LabeledField concept as
                      Product Master's add/edit form (see
                      components/form/LabeledField.jsx), only 2 columns —
                      same as Product Group / Warehouse Master. */}
                  <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                    <LabeledField label="Customer / Price List *">
                      <FormSelect name="customer" label="" placeholder="Select customer or price list" options={customerOptions} />
                    </LabeledField>
                    <LabeledField label="Product *">
                      <FormSelect name="productCode" label="" placeholder="Select product" options={productOptions} />
                    </LabeledField>
                    <LabeledField label="Description *">
                      <FormTextField name="productName" label="" disabled placeholder="Auto-filled from product" />
                    </LabeledField>
                    <LabeledField label="Unit">
                      <FormTextField name="uom" label="" disabled placeholder="Auto-filled from product" />
                    </LabeledField>
                    <LabeledField label="Sales Price (₹) *">
                      <FormTextField name="price" label="" type="number" placeholder="0.00" />
                    </LabeledField>
                    <LabeledField label="Currency *">
                      <FormSelect name="currency" label="" options={currencyOptions} />
                    </LabeledField>
                    <LabeledField label="Effective Date *">
                      <FormDatePicker name="effectiveDate" label="" />
                    </LabeledField>
                    <LabeledField label="Status *">
                      <FormSelect
                        name="status"
                        label=""
                        options={[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]}
                      />
                    </LabeledField>
                  </FormGrid>
                </DialogContent>

                <DialogActions sx={{ px: 3, py: 2 }}>
                  <FormSubmitButton disabled={creating || updating}>
                    {readOnly ? 'View' : editingRow ? 'Update' : 'Save'}
                  </FormSubmitButton>
                  <Button variant={readOnly ? 'outlined' : 'text'} color={readOnly ? 'error' : 'inherit'} onClick={requestClose} disabled={creating || updating}>
                    {readOnly ? 'Close' : 'Cancel'}
                  </Button>
                </DialogActions>
              </>
            );
          }}
        </AppForm>
      </Dialog>

      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Sales Price List</Typography>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              <TableSearchFilter table={table} placeholder="Search by product name, code or customer..." width={260} showFilter={false} />
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<FilterListIcon />}
                onClick={() => setShowFilters((v) => !v)}
              >
                Filter
              </Button>
              <CanAdd>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                  Add Sales Price
                </Button>
              </CanAdd>
            </Stack>
          </Stack>

          <Collapse in={showFilters} unmountOnExit>
            <Box sx={{ px: 3, pb: 2 }}>
              <FormGrid columns={4}>
                <FilterAutocomplete
                  label="Customer / Price List"
                  allLabel="All Customers"
                  options={customerOptions}
                  value={customerFilter}
                  onChange={(v) => { setCustomerFilter(v); setPage(0); }}
                />
                <FilterAutocomplete
                  label="Product"
                  allLabel="All Products"
                  options={productOptions}
                  value={productFilter}
                  onChange={(v) => { setProductFilter(v); setPage(0); }}
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
                  sx={{ cursor: 'pointer' }}
                />
                <Autocomplete
                  size="small"
                  options={STATUS_FILTERS}
                  value={statusFilter}
                  onChange={(_e, v) => { setStatusFilter(v || 'All'); setPage(0); }}
                  disableClearable
                  renderInput={(params) => <TextField {...params} label="Status" />}
                />
              </FormGrid>

              <Popover
                open={!!dateAnchor}
                anchorEl={dateAnchor}
                onClose={() => setDateAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              >
                <Stack direction="row" spacing={2} sx={{ p: 2 }}>
                  <DatePicker
                    label="From"
                    value={dateFrom}
                    onChange={(v) => { setDateFrom(v); setPage(0); }}
                    slotProps={{ textField: { size: 'small' } }}
                  />
                  <DatePicker
                    label="To"
                    value={dateTo}
                    onChange={(v) => { setDateTo(v); setPage(0); }}
                    slotProps={{ textField: { size: 'small' } }}
                  />
                </Stack>
              </Popover>
              <TableFilterPanel table={table} embedded open />
            </Box>
          </Collapse>

          {canDelete && checkedIds.length > 0 && (
            <Box sx={{ px: 3, pb: 1.5 }}>
              <Button variant="outlined" color="error" size="small" startIcon={<DeleteIcon />} onClick={removeSelected}>
                Delete Selected ({checkedIds.length})
              </Button>
            </Box>
          )}

          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {!isLoading && pagedRows.map((row) => {
                const margin = marginFor(row);
                return (
                  <MobileRecordCard
                    key={row.id}
                    title={row.productName}
                    statusChip={<Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />}
                    fields={[
                      { label: 'Date', value: row.effectiveDate ? dayjs(row.effectiveDate).format('DD/MM/YYYY') : '—' },
                      { label: 'Customer / Price List', value: row.customer || '—' },
                      { label: 'Item No', value: row.productCode || '—' },
                      { label: 'Unit', value: row.uom || '—' },
                      { label: 'Sales Price', value: `₹${Number(row.price).toFixed(2)} ${row.currency}` },
                      { label: 'Margin (%)', value: margin != null ? `${margin.toFixed(2)}%` : '—' },
                    ]}
                    onView={() => handleView(row)}
                    onEdit={() => handleEdit(row)}
                    onDelete={() => handleDelete(row)}
                  />
                );
              })}
              {!isLoading && filteredRows.length === 0 && (
                <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No sales prices found" message="Add your first sales price to get started" />
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table
                size="small"
                stickyHeader
                sx={{
                  '& th, & td': {
                    height: SALES_PRICE_LIST_TABLE_ROW_HEIGHT,
                    paddingTop: `${SALES_PRICE_LIST_TABLE_CELL_PADDING_Y}px`,
                    paddingBottom: `${SALES_PRICE_LIST_TABLE_CELL_PADDING_Y}px`,
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
                          indeterminate={someChecked}
                          checked={allChecked}
                          onChange={(e) => {
                            const ids = pagedRows.map((r) => r.id);
                            setCheckedIds((prev) => e.target.checked
                              ? Array.from(new Set([...prev, ...ids]))
                              : prev.filter((c) => !ids.includes(c)));
                          }}
                        />
                      </SortableHeaderCell>
                    )}
                    <TableCell width={48}>#</TableCell>
                    <SortableHeaderCell field="effectiveDate" sort={table.sort} onSort={table.toggleSort}>Date</SortableHeaderCell>
                    <SortableHeaderCell field="customer" sort={table.sort} onSort={table.toggleSort}>Customer / Price List</SortableHeaderCell>
                    <SortableHeaderCell field="productCode" sort={table.sort} onSort={table.toggleSort}>Item No</SortableHeaderCell>
                    <SortableHeaderCell field="productName" sort={table.sort} onSort={table.toggleSort}>Description</SortableHeaderCell>
                    <SortableHeaderCell field="uom" sort={table.sort} onSort={table.toggleSort}>Unit</SortableHeaderCell>
                    <SortableHeaderCell field="price" sort={table.sort} onSort={table.toggleSort}>Sales Price (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="currency" sort={table.sort} onSort={table.toggleSort}>Currency</SortableHeaderCell>
                    <TableCell>Margin (%)</TableCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => {
                    const margin = marginFor(row);
                    return (
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
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.effectiveDate ? dayjs(row.effectiveDate).format('DD/MM/YYYY') : '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.customer || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.productCode || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.productName}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.uom || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{Number(row.price).toFixed(2)}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.currency}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{margin != null ? margin.toFixed(2) : '—'}</TableCell>
                        <TableCell>
                          <Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <IconButton size="small" onClick={() => handleView(row)} aria-label="view">
                              <VisibilityOutlinedIcon fontSize="small" />
                            </IconButton>
                            <CanEdit>
                              <IconButton size="small" color="primary" onClick={() => handleEdit(row)} aria-label="edit">
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </CanEdit>
                            <CanDelete>
                              <IconButton size="small" color="error" onClick={() => handleDelete(row)} aria-label="delete">
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </CanDelete>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!isLoading && filteredRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={12}>
                        <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No sales prices found" message="Add your first sales price to get started" />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollableTableContainer>
          )}

          <EntityListPagination total={filteredRows.length} page={page} onChange={setPage} pageSize={pageSize} onPageSizeChange={(v) => { setPageSize(v); setPage(0); }} />
        </CardContent>
      </Card>
    </Box>
  );
}
