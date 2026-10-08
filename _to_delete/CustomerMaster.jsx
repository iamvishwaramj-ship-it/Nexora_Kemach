import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Card, CardContent, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Chip, IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Grid, Collapse,
} from '@mui/material';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/SaveOutlined';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import CheckIcon from '@mui/icons-material/Check';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import useDragScroll from '../../components/data-display/useDragScroll';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { customerSchema, CUSTOMER_TYPE_OPTIONS, SALES_TYPE_OPTIONS, PAYMENT_TERMS_OPTIONS, PRICE_LIST_OPTIONS } from '../../lib/validation/partnerSchemas';
import {
  customerApi, salesEmployeeApi, chartOfAccountApi, financialYearApi, glAccountDeterminationApi,
} from '../../features/resources';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import DocumentNoField from '../../components/form/DocumentNoField';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
const emptyValues = {
  customerCode: '', customerName: '', customerType: '', salesType: '', status: 'Active',
  phone: '', email: '', alternatePhone: '', website: '',
  gstin: '', panNo: '', aadhaarNo: '', dateOfRegistration: null,
  billingAddress: '', shippingAddress: '', state: '',
  creditLimit: 0, openingBalance: 0, outstandingBalance: 0,
  paymentTerms: '', priceList: '', salesPerson: '', discountPercent: 0, notes: '',
  accountsReceivable: '', downPaymentClearingAccount: '', accountBalance: 0,
};

const PAGE_SIZE = 10;
const STATUS_FILTERS = ['All', 'Active', 'Inactive'];

export default function CustomerMaster() {
  const location = useLocation();
  const navigate = useNavigate();
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const { data: customers, isLoading } = customerApi.useList();
  const { data: salesEmployees } = salesEmployeeApi.useList();
  const { data: accounts } = chartOfAccountApi.useList();
  const { data: financialYears } = financialYearApi.useList();
  const { data: glDeterminations } = glAccountDeterminationApi.useList();
  const [create, { isLoading: creating }] = customerApi.useCreate();
  const [update, { isLoading: updating }] = customerApi.useUpdate();
  const [remove] = customerApi.useDelete();

  const salesPersonOptions = (salesEmployees || []).map((e) => ({ label: e.employeeName, value: e.employeeName }));
  // Accounting — Control Accounts. Only real posting accounts (accountNature
  // 'A', not a Title/heading) and only Active ones can be picked here, same
  // filter WarehouseMaster/ProductGroup's Accounting tabs use. Code and name
  // combined into one label since these are plain single-field selects
  // rather than a code/name table column pair.
  const accountOptions = (accounts || [])
    .filter((a) => a.accountNature === 'A' && a.status === 'A')
    .map((a) => ({ label: `${a.accountCode} — ${a.accountName}`, value: a.accountCode }));
  const accountByCode = useMemo(() => new Map((accounts || []).map((a) => [a.accountCode, a])), [accounts]);
  const accountCodeById = useMemo(() => new Map((accounts || []).map((a) => [a.id, a.accountCode])), [accounts]);

  // The G/L Account Determination row for the current Active Financial Year
  // — same lookup ProductGroup's Add form uses for its own defaults. Its
  // Sales > General "Down Payment Clearing Account" is what auto-fills here
  // once an Accounts Receivable account is picked below.
  const activeFinancialYear = useMemo(() => {
    const years = financialYears || [];
    return years.find((y) => y.status === 'Active')
      || [...years].sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0))[0]
      || null;
  }, [financialYears]);
  const activeDetermination = useMemo(() => {
    if (!activeFinancialYear) return null;
    return (glDeterminations || []).find((d) => d.financialYearId === activeFinancialYear.id) || null;
  }, [glDeterminations, activeFinancialYear]);

  // Form is hidden by default -- it expands in a Collapse ABOVE the list
  // (which stays visible) when "Add Customer" or an edit action is
  // triggered, per the inline form template (Payment Entry/Deposit Entry),
  // instead of swapping the whole page out for a separate form view.
  const [showForm, setShowForm] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [filterAnchor, setFilterAnchor] = useState(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const rows = customers || [];

  const baseTableRows = useMemo(() => {
    const q = '';
    return rows.filter((r) => {
      const matchesSearch = !q || [r.customerCode, r.customerName, r.phone, r.email].some((v) => String(v || '').toLowerCase().includes(q));
      const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, statusFilter]);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'customerCode', headerName: 'Customer Code', filter: 'text' },
    { field: 'customerName', headerName: 'Customer Name', filter: 'text' },
    { field: 'customerType', headerName: 'Type', filter: 'select' },
    { field: 'phone', headerName: 'Phone', filter: 'text' },
    { field: 'outstandingBalance', headerName: 'Outstanding (₹)', filter: 'numberRange', sortValue: (row) => (row.outstandingBalance == null || row.outstandingBalance === '' ? null : Number(row.outstandingBalance)) },
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
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRow(null);
  };

  // Other pages (e.g. Enquiry's "+ Add new customer" shortcut) can navigate
  // here with { state: { openAdd: true } } to land directly on the add form
  // instead of the list. Consumed once on mount, then cleared via replace so
  // it doesn't re-fire on a later revisit of this tab (browser back, etc.).
  useEffect(() => {
    if (location.state?.openAdd) {
      openCreate();
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Read-only look at a record — same form, every field disabled
  // and the save button removed (see AppForm's readOnly prop).
  const handleView = (row) => {
    setEditingRow(row);
    setReadOnly(true);
    setFormKey((k) => k + 1);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (row) => {
    setEditingRow(row);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (row) => {
    const ok = await confirmDialog({
      title: 'Delete customer',
      message: `Are you sure you want to delete "${row.customerName}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Customer deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...values }).unwrap();
        notify.success('Customer updated');
      } else {
        await create(values).unwrap();
        notify.success('Customer added');
      }
      closeForm();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<PeopleAltOutlinedIcon />}
        title="Customer Master"
        subtitle={showForm ? 'Create a new customer.' : 'Manage and track your customers.'}
        rightContent={<CompanyBadge />}
      />

      <Collapse in={showForm} unmountOnExit>
        <Box sx={{ mb: 2 }}>
          <AppForm readOnly={readOnly}
            key={formKey}
            schema={customerSchema}
            defaultValues={editingRow ? { ...emptyValues, ...editingRow } : emptyValues}
            onSubmit={handleSubmit}
          >
            {(methods) => {
              // Picking an Accounts Receivable account fetches that account's
              // own balance and the current Financial Year's default Down
              // Payment Clearing Account, so the user doesn't have to look
              // either up and set them by hand. Both fields stay editable
              // afterwards — this only runs again if Accounts Receivable
              // itself changes, via the same watch-a-value/compare-to-a-ref
              // pattern SupplierMaster uses for its own bank-name auto-fill.
              const accountsReceivableValue = methods.watch('accountsReceivable');
              const prevAccountsReceivable = useRef(editingRow ? editingRow.accountsReceivable : null);
              useEffect(() => {
                if (accountsReceivableValue !== prevAccountsReceivable.current) {
                  const account = accountByCode.get(accountsReceivableValue);
                  methods.setValue('accountBalance', account?.openingBalance != null ? Number(account.openingBalance) : 0, { shouldValidate: true });
                  const clearingCode = activeDetermination?.downPaymentClearingId != null
                    ? accountCodeById.get(activeDetermination.downPaymentClearingId)
                    : null;
                  if (clearingCode) {
                    methods.setValue('downPaymentClearingAccount', clearingCode, { shouldValidate: true });
                  }
                  prevAccountsReceivable.current = accountsReceivableValue;
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [accountsReceivableValue]);

              return (
              <>
                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight={700}>Customer Information</Typography>
                      <Button variant="outlined" color="inherit" startIcon={<CloseIcon />} onClick={closeForm}>
                        Close
                      </Button>
                    </Stack>

                    <FormGrid columns={4}>
                      {/* Auto-generated from the perpetual CUS numbering series (hidden
                          from the Document Numbering page — see hiddenFromNumberingUI
                          in documentNumberService.js). The field is filled and locked
                          on create, and left untouched on edit so an existing record's
                          code is never rewritten. */}
                      <DocumentNoField documentCode="CUS" name="customerCode" label="Customer Code *" isCreate={!editingRow} />
                      <FormTextField name="customerName" label="Customer Name *" placeholder="Enter customer name" />
                      <FormSelect name="customerType" label="Customer Type *" placeholder="Select customer type" options={CUSTOMER_TYPE_OPTIONS} />
                      <FormSelect name="salesType" label="Sales Type" placeholder="Select sales type" options={SALES_TYPE_OPTIONS} />
                      

                      <FormTextField name="phone" label="Phone No." placeholder="Enter phone number" digitsOnly maxLength={10} />
                      <FormTextField name="email" label="Email" placeholder="Enter email address" />
                      <FormTextField name="alternatePhone" label="Alternate Phone No." placeholder="Enter alternate phone" digitsOnly maxLength={10} />
                      <FormTextField name="website" label="Website" placeholder="Enter website" />

                      <FormTextField name="gstin" label="GSTIN" placeholder="Enter GSTIN" maxLength={15} inputProps={{ style: { textTransform: 'uppercase' } }} />
                      <FormTextField name="panNo" label="PAN No." placeholder="Enter PAN number" maxLength={10} inputProps={{ style: { textTransform: 'uppercase' } }} />
                      <FormTextField name="aadhaarNo" label="Aadhaar No." placeholder="Enter Aadhaar number" digitsOnly maxLength={12} />
                      <FormDatePicker name="dateOfRegistration" label="Date of Registration" />
                      <FormSelect
                        name="status"
                        label="Status *"
                        options={[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]}
                      />
                    </FormGrid>

                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                      <Grid item xs={12} md={6}>
                        <FormTextField name="billingAddress" label="Billing Address *" placeholder="Enter billing address" multiline rows={3} />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <FormTextField name="shippingAddress" label="Shipping Address" placeholder="Enter shipping address (optional)" multiline rows={3} />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>

                <Card variant="outlined">
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                      Additional Information
                    </Typography>

                    <FormGrid columns={4}>
                      <FormTextField name="creditLimit" label="Credit Limit (₹)" type="number" placeholder="0.00" />
                      <FormTextField name="openingBalance" label="Opening Balance (₹)" type="number" placeholder="0.00" />
                      <FormSelect name="paymentTerms" label="Payment Terms" placeholder="Select payment terms" options={PAYMENT_TERMS_OPTIONS} />
                      <FormSelect name="priceList" label="Price List" placeholder="Select price list" options={PRICE_LIST_OPTIONS} />
                    </FormGrid>

                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                      <Grid item xs={12} sm={6} md={3}>
                        <FormSelect name="salesPerson" label="Sales Person" placeholder="Select sales person" options={salesPersonOptions} />
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <FormTextField name="discountPercent" label="Discount (%)" type="number" placeholder="0.00" />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <FormTextField name="notes" label="Notes" placeholder="Enter notes (optional)" multiline rows={3} />
                      </Grid>
                    </Grid>

                    {/* Accounting — Control Accounts, the same section
                        WarehouseMaster/ProductGroup carry an Accounting tab
                        for. accountsReceivable / downPaymentClearingAccount
                        store a ChartOfAccount code; accountBalance is a
                        plain editable figure, separate from Opening/
                        Outstanding Balance above. */}
                    <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 3, mb: 2 }}>
                      Accounting
                    </Typography>
                    <FormGrid columns={4}>
                      <FormSelect
                        name="accountsReceivable"
                        label="Accounts Receivable"
                        placeholder="Select account"
                        options={accountOptions}
                      />
                      <FormSelect
                        name="downPaymentClearingAccount"
                        label="Down Payment Clearing Account"
                        placeholder="Select account"
                        options={accountOptions}
                      />
                      <FormTextField name="accountBalance" label="Account Balance (₹)" type="number" placeholder="0.00" />
                    </FormGrid>

                    <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 3 }}>
                      <Button variant="outlined" color={readOnly ? 'error' : 'inherit'} startIcon={<CloseIcon />} onClick={closeForm} disabled={creating || updating}>
                        {readOnly ? 'Close' : 'Cancel'}
                      </Button>
                      <FormSubmitButton startIcon={<SaveIcon />} disabled={creating || updating}>
                        {readOnly ? 'View' : editingRow ? 'Update Customer' : 'Save Customer'}
                      </FormSubmitButton>
                    </Stack>
                  </CardContent>
                </Card>
              </>
              );
            }}
          </AppForm>
        </Box>
      </Collapse>

      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Customer List</Typography>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              <TableSearchFilter table={table} placeholder="Search by code, name, phone or email..." width={260} />
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<FilterListIcon />}
                onClick={(e) => setFilterAnchor(e.currentTarget)}
              >
                Filter{statusFilter !== 'All' ? `: ${statusFilter}` : ''}
              </Button>
              <Menu anchorEl={filterAnchor} open={!!filterAnchor} onClose={() => setFilterAnchor(null)}>
                {STATUS_FILTERS.map((s) => (
                  <MenuItem key={s} selected={statusFilter === s} onClick={() => { setStatusFilter(s); setPage(0); setFilterAnchor(null); }}>
                    {statusFilter === s && <ListItemIcon><CheckIcon fontSize="small" /></ListItemIcon>}
                    <ListItemText inset={statusFilter !== s}>{s}</ListItemText>
                  </MenuItem>
                ))}
              </Menu>
              <CanAdd>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                  Add Customer
                </Button>
              </CanAdd>
            </Stack>

            <TableFilterPanel table={table} />
          </Stack>

          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {!isLoading && pagedRows.map((row) => (
                <MobileRecordCard
                  key={row.id}
                  title={row.customerName}
                  statusChip={<Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />}
                  fields={[
                    { label: 'Customer Code', value: row.customerCode },
                    { label: 'Type', value: row.customerType || '—' },
                    { label: 'Phone', value: row.phone || '—' },
                    { label: 'Outstanding', value: row.outstandingBalance != null ? `₹${Number(row.outstandingBalance).toFixed(2)}` : '—' },
                  ]}
                  onView={() => handleView(row)}
                  onEdit={() => handleEdit(row)}
                  onDelete={() => handleDelete(row)}
                />
              ))}
              {!isLoading && filteredRows.length === 0 && (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>No customers found</Typography>
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell width={48}>#</TableCell>
                    <SortableHeaderCell field="customerCode" sort={table.sort} onSort={table.toggleSort}>Customer Code</SortableHeaderCell>
                    <SortableHeaderCell field="customerName" sort={table.sort} onSort={table.toggleSort}>Customer Name</SortableHeaderCell>
                    <SortableHeaderCell field="customerType" sort={table.sort} onSort={table.toggleSort}>Type</SortableHeaderCell>
                    <SortableHeaderCell field="phone" sort={table.sort} onSort={table.toggleSort}>Phone</SortableHeaderCell>
                    <SortableHeaderCell field="outstandingBalance" sort={table.sort} onSort={table.toggleSort}>Outstanding (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.customerCode}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.customerName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.customerType || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.phone || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.outstandingBalance != null ? Number(row.outstandingBalance).toFixed(2) : '0.00'}</TableCell>
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
                  ))}
                  {!isLoading && filteredRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>No customers found</Typography>
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
