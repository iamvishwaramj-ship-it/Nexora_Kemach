import React, { useEffect, useMemo, useRef, useState } from 'react';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import {
  Box, Typography, Button, Card, CardContent, Stack, TextField, InputAdornment, Table,
  TableBody, TableCell, TableHead, TableRow, Chip, IconButton, Collapse, Checkbox,
  Autocomplete, Popover, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
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
import { customerDiscountSchema } from '../../lib/validation/productSchemas';
import { customerDiscountApi, customerApi, productApi } from '../../features/resources';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import { canDelete } from '../../config/deleteConfig';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';
const ALL_CUSTOMERS = { label: 'All Customers', value: '' };
const ALL_PRODUCTS = { label: 'All Products', value: '' };

// Sales/purchase pricing already uses these generic tiers alongside real
// customers — reuse the same convention here rather than inventing a new one.
const GENERIC_PRICE_LISTS = ['Walk-in Customer', 'Retail Price List', 'Corporate Customer', 'Wholesale Price List'];

const DISCOUNT_TYPE_OPTIONS = [
  { label: 'Flat', value: 'Flat' },
  { label: 'Slab', value: 'Slab' },
];

const emptyValues = {
  customer: '', discountType: 'Flat', productCode: '', productName: '',
  discountValue: 0, validFrom: null, validTo: null, status: 'Active',
};

const PAGE_SIZE = 10;
const STATUS_FILTERS = ['All', 'Active', 'Inactive', 'Expired'];

function isExpired(row) {
  return row.status === 'Active' && row.validTo && dayjs(row.validTo).isBefore(dayjs(), 'day');
}

function displayStatus(row) {
  return isExpired(row) ? 'Expired' : row.status;
}

const CUSTOMER_DISCOUNT_LIST_TABLE_ROW_HEIGHT = 0;
const CUSTOMER_DISCOUNT_LIST_TABLE_CELL_PADDING_Y = 6;
export default function CustomerDiscount() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const { data: discounts, isLoading } = customerDiscountApi.useList();
  const { data: customers } = customerApi.useList();
  const { data: products } = productApi.useList();
  const [create, { isLoading: creating }] = customerDiscountApi.useCreate();
  const [update, { isLoading: updating }] = customerDiscountApi.useUpdate();
  const [remove] = customerDiscountApi.useDelete();

  const customerOptions = useMemo(() => {
    const real = (customers || []).map((c) => ({ label: c.customerName, value: c.customerName }));
    const generic = GENERIC_PRICE_LISTS.map((label) => ({ label, value: label }));
    return [ALL_CUSTOMERS, ...generic, ...real];
  }, [customers]);
  // The form lives in a modal — the page itself is the list, and "Add
  // Discount" (or an edit action) opens the dialog over it. Same shape as
  // Product Group / Product Sub-Group / Warehouse Master.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  // Inactive products are dropped from the picker — same "still show it if
  // the record already references it" exemption productOptionsFor uses for
  // the transactional documents (lib/productUsage.js), so reopening an
  // existing discount rule whose product has since been deactivated doesn't
  // blank the field.
  const productOptions = useMemo(
    () => [ALL_PRODUCTS, ...(products || [])
      .filter((p) => p.status !== 'Inactive' || p.productCode === editingRow?.productCode)
      .map((p) => ({ label: `${p.productCode} - ${p.productName}`, value: p.productCode }))],
    [products, editingRow]
  );
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [customerFilter, setCustomerFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);
  const [productFilter, setProductFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [dateAnchor, setDateAnchor] = useState(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [checkedIds, setCheckedIds] = useState([]);

  const rows = discounts || [];

  const baseTableRows = useMemo(() => {
    const q = '';
    return rows.filter((r) => {
      const matchesSearch = !q || [r.customer, r.productCode, r.productName].some((v) => String(v || '').toLowerCase().includes(q));
      const matchesCustomer = !customerFilter || (customerFilter.value === '' ? !r.customer : r.customer === customerFilter.value);
      const matchesType = !typeFilter || r.discountType === typeFilter.value;
      const matchesProduct = !productFilter || (productFilter.value === '' ? !r.productCode : r.productCode === productFilter.value);
      const matchesStatus = statusFilter === 'All' || displayStatus(r) === statusFilter;
      const from = r.validFrom ? dayjs(r.validFrom) : null;
      const to = r.validTo ? dayjs(r.validTo) : null;
      const matchesFrom = !dateFrom || (from && !from.isBefore(dateFrom, 'day'));
      const matchesTo = !dateTo || (to && !to.isAfter(dateTo, 'day'));
      return matchesSearch && matchesCustomer && matchesType && matchesProduct && matchesStatus && matchesFrom && matchesTo;
    });
  }, [rows, customerFilter, typeFilter, productFilter, statusFilter, dateFrom, dateTo]);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'id', headerName: 'Select', filter: false, searchable: false },
    { field: 'customer', headerName: 'Customer', filter: 'text' },
    { field: 'discountType', headerName: 'Discount Type', filter: 'text' },
    { field: 'productCode', headerName: 'Product', filter: 'text', searchValue: (row) => [row.productCode, row.productName].join(' ') },
    { field: 'discountValue', headerName: 'Discount Value', filter: 'numberRange', sortValue: (row) => (row.discountValue == null || row.discountValue === '' ? null : Number(row.discountValue)) },
    { field: 'validFrom', headerName: 'Date Range', filter: 'text', searchValue: (row) => [row.validFrom, row.validTo].join(' ') },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const filteredRows = table.rows;

  const pagedRows = useMemo(
    () => filteredRows.slice(page * pageSize, page * pageSize + pageSize),
    [filteredRows, page, pageSize]
  );

  const allChecked = pagedRows.length > 0 && pagedRows.every((r) => checkedIds.includes(r.id));
  const someChecked = pagedRows.some((r) => checkedIds.includes(r.id)) && !allChecked;

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
      title: 'Delete discount rule',
      message: `Are you sure you want to delete this discount rule for "${row.customer || 'All Customers'}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Discount rule deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const removeSelected = async () => {
    const ok = await confirmDialog({
      title: 'Delete selected discount rules',
      message: `Delete ${checkedIds.length} selected discount rule${checkedIds.length > 1 ? 's' : ''}? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await Promise.all(checkedIds.map((id) => remove(id).unwrap()));
      notify.success('Selected discount rules deleted');
      setCheckedIds([]);
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    const selectedProduct = values.productCode ? (products || []).find((p) => p.productCode === values.productCode) : null;
    const payload = {
      ...values,
      productName: selectedProduct?.productName || '',
    };
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Discount rule updated');
      } else {
        await create(payload).unwrap();
        notify.success('Discount rule added');
      }
      forceClose();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  const dateRangeLabel = dateFrom && dateTo
    ? `${dateFrom.format('DD/MM/YYYY')} - ${dateTo.format('DD/MM/YYYY')}`
    : 'Select date range';

  const statusColor = (row) => {
    const s = displayStatus(row);
    if (s === 'Active') return 'success';
    return 'default';
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<LocalOfferOutlinedIcon />}
        title="Customer Discount"
        subtitle="Manage and track customer-wise discount settings."
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
            {readOnly ? 'View Discount Rule' : editingRow ? 'Edit Discount Rule' : 'Add Discount Rule'}
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
          schema={customerDiscountSchema}
          defaultValues={editingRow ? { ...emptyValues, ...editingRow } : emptyValues}
          onSubmit={handleSubmit}
        >
          {(methods) => {
            // Description is derived from the selected Product (or
            // cleared for "All Products") — sync it in immediately so
            // it's ready by the time this gets submitted.
            const productCodeValue = methods.watch('productCode');
            const prevProductCode = useRef(editingRow ? editingRow.productCode : null);
            useEffect(() => {
              if (productCodeValue !== prevProductCode.current) {
                const found = productCodeValue ? (products || []).find((p) => p.productCode === productCodeValue) : null;
                methods.setValue('productName', found?.productName || '', { shouldValidate: true });
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
                    <LabeledField label="Customer">
                      <FormSelect name="customer" label="" placeholder="All Customers" options={customerOptions} />
                    </LabeledField>
                    <LabeledField label="Discount Type *">
                      <FormSelect name="discountType" label="" options={DISCOUNT_TYPE_OPTIONS} />
                    </LabeledField>
                    <LabeledField label="Product">
                      <FormSelect name="productCode" label="" placeholder="All Products" options={productOptions} />
                    </LabeledField>
                    <LabeledField label="Description">
                      <FormTextField name="productName" label="" disabled placeholder="Auto-filled from product" />
                    </LabeledField>
                    <LabeledField label="Discount Value (%) *">
                      <FormTextField name="discountValue" label="" type="number" placeholder="0.00" />
                    </LabeledField>
                    <LabeledField label="Valid From *">
                      <FormDatePicker name="validFrom" label="" />
                    </LabeledField>
                    <LabeledField label="Valid To *">
                      <FormDatePicker name="validTo" label="" />
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
            <Typography variant="subtitle1" fontWeight={700}>Customer Discount List</Typography>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              <TableSearchFilter table={table} placeholder="Search by customer or product..." width={260} showFilter={false} />
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
                  Add Discount
                </Button>
              </CanAdd>
            </Stack>
          </Stack>

          <Collapse in={showFilters} unmountOnExit>
            <Box sx={{ px: 3, pb: 2 }}>
              <FormGrid columns={4}>
                <FilterAutocomplete
                  label="Customer"
                  allLabel="All Customers"
                  options={customerOptions}
                  value={customerFilter}
                  onChange={(v) => { setCustomerFilter(v); setPage(0); }}
                />
                <FilterAutocomplete
                  label="Discount Type"
                  allLabel="All Types"
                  options={DISCOUNT_TYPE_OPTIONS}
                  value={typeFilter}
                  onChange={(v) => { setTypeFilter(v); setPage(0); }}
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
                  InputLabelProps={{ shrink: true }}
                  sx={{ cursor: 'pointer' }}
                />
              </FormGrid>

              <Box sx={{ mt: 2 }}>
                <FormGrid columns={4}>
                  <Autocomplete
                    size="small"
                    options={STATUS_FILTERS}
                    value={statusFilter}
                    onChange={(_e, v) => { setStatusFilter(v || 'All'); setPage(0); }}
                    disableClearable
                    renderInput={(params) => <TextField {...params} label="Status" InputLabelProps={{ shrink: true }} />}
                  />
                </FormGrid>
              </Box>

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
              {!isLoading && pagedRows.map((row) => (
                <MobileRecordCard
                  key={row.id}
                  title={row.customer || 'All Customers'}
                  statusChip={<Chip size="small" label={displayStatus(row)} color={statusColor(row)} variant="outlined" />}
                  fields={[
                    { label: 'Discount Type', value: row.discountType },
                    { label: 'Product', value: row.productCode ? `${row.productCode} - ${row.productName}` : 'All Products' },
                    { label: 'Discount Value', value: `${Number(row.discountValue).toFixed(2)} %` },
                    { label: 'Applicable On', value: row.productCode ? 'Product Amount' : 'Total Amount' },
                    { label: 'Date Range', value: `${row.validFrom ? dayjs(row.validFrom).format('DD/MM/YYYY') : '—'} - ${row.validTo ? dayjs(row.validTo).format('DD/MM/YYYY') : '—'}` },
                  ]}
                  onView={() => handleView(row)}
                  onEdit={() => handleEdit(row)}
                  onDelete={() => handleDelete(row)}
                />
              ))}
              {!isLoading && filteredRows.length === 0 && (
                <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No discount rules found" message="Add your first discount rule to get started" />
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table
                size="small"
                stickyHeader
                sx={{
                  '& th, & td': {
                    height: CUSTOMER_DISCOUNT_LIST_TABLE_ROW_HEIGHT,
                    paddingTop: `${CUSTOMER_DISCOUNT_LIST_TABLE_CELL_PADDING_Y}px`,
                    paddingBottom: `${CUSTOMER_DISCOUNT_LIST_TABLE_CELL_PADDING_Y}px`,
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
                    <SortableHeaderCell field="customer" sort={table.sort} onSort={table.toggleSort}>Customer</SortableHeaderCell>
                    <SortableHeaderCell field="discountType" sort={table.sort} onSort={table.toggleSort}>Discount Type</SortableHeaderCell>
                    <SortableHeaderCell field="productCode" sort={table.sort} onSort={table.toggleSort}>Product</SortableHeaderCell>
                    <SortableHeaderCell field="discountValue" sort={table.sort} onSort={table.toggleSort}>Discount Value</SortableHeaderCell>
                    <TableCell>Applicable On</TableCell>
                    <SortableHeaderCell field="validFrom" sort={table.sort} onSort={table.toggleSort}>Date Range</SortableHeaderCell>
                    <TableCell>Status</TableCell>
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
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.customer || 'All Customers'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.discountType}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.productCode ? `${row.productCode} - ${row.productName}` : 'All Products'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{Number(row.discountValue).toFixed(2)} %</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.productCode ? 'Product Amount' : 'Total Amount'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {row.validFrom ? dayjs(row.validFrom).format('DD/MM/YYYY') : '—'} - {row.validTo ? dayjs(row.validTo).format('DD/MM/YYYY') : '—'}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={displayStatus(row)} color={statusColor(row)} variant="outlined" />
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
                  ))}
                  {!isLoading && filteredRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10}>
                        <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No discount rules found" message="Add your first discount rule to get started" />
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
