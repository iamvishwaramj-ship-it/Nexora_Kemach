import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  supplierSchema, SUPPLIER_TYPE_OPTIONS, SUPPLIER_PAYMENT_TERMS_OPTIONS,
  PAYMENT_MODE_OPTIONS, CURRENCY_OPTIONS, PURCHASE_CATEGORY_OPTIONS, SUPPLIER_PRICE_LIST_OPTIONS,
} from '../../lib/validation/partnerSchemas';
import {
  supplierApi, houseBankApi, chartOfAccountApi, financialYearApi, glAccountDeterminationApi,
} from '../../features/resources';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import DocumentNoField from '../../components/form/DocumentNoField';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
const emptyValues = {
  supplierCode: '', supplierName: '', supplierType: '', status: 'Active',
  contactPerson: '', phone: '', alternatePhone: '', email: '',
  gstin: '', panNo: '', msmeNo: '', dateOfRegistration: null,
  billingAddress: '', shippingAddress: '', state: '',
  creditLimit: 0, openingBalance: 0, outstandingBalance: 0,
  paymentTerms: '', paymentMode: '', bankName: '', accountNumber: '', ifscCode: '',
  priceList: '', currency: 'INR', preferredPurchaseCategory: '', discountPercent: 0, notes: '',
  accountsReceivable: '', downPaymentClearingAccount: '', accountBalance: 0,
};

const PAGE_SIZE = 10;
const STATUS_FILTERS = ['All', 'Active', 'Inactive'];

export default function SupplierMaster() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const { data: suppliers, isLoading } = supplierApi.useList();
  const { data: houseBanks } = houseBankApi.useList();
  const { data: accounts } = chartOfAccountApi.useList();
  const { data: financialYears } = financialYearApi.useList();
  const { data: glDeterminations } = glAccountDeterminationApi.useList();
  const [create, { isLoading: creating }] = supplierApi.useCreate();
  const [update, { isLoading: updating }] = supplierApi.useUpdate();
  const [remove] = supplierApi.useDelete();

  const houseBankRows = houseBanks || [];
  // Accounting — Control Accounts. Same filter/shape as CustomerMaster's own
  // accountOptions — see the comment there.
  const accountOptions = (accounts || [])
    .filter((a) => a.accountNature === 'A' && a.status === 'A')
    .map((a) => ({ label: `${a.accountCode} — ${a.accountName}`, value: a.accountCode }));
  const accountByCode = useMemo(() => new Map((accounts || []).map((a) => [a.accountCode, a])), [accounts]);
  const accountCodeById = useMemo(() => new Map((accounts || []).map((a) => [a.id, a.accountCode])), [accounts]);

  // The G/L Account Determination row for the current Active Financial Year
  // — same lookup ProductGroup's/CustomerMaster's Add forms use for their
  // own defaults. Its Sales > General "Down Payment Clearing Account" is
  // what auto-fills here once an Accounts Receivable account is picked below.
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
  const bankNameOptions = houseBankRows.map((b) => ({
    label: b.accountNumber ? `${b.bankName} — ${b.accountNumber}` : b.bankName,
    value: b.bankName,
  }));

  // Form is hidden by default -- it expands in a Collapse ABOVE the list
  // (which stays visible) when "Add Supplier" or an edit action is
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

  const rows = suppliers || [];

  const baseTableRows = useMemo(() => {
    const q = '';
    return rows.filter((r) => {
      const matchesSearch = !q || [r.supplierCode, r.supplierName, r.phone, r.email].some((v) => String(v || '').toLowerCase().includes(q));
      const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, statusFilter]);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'supplierCode', headerName: 'Supplier Code', filter: 'text' },
    { field: 'supplierName', headerName: 'Supplier Name', filter: 'text' },
    { field: 'supplierType', headerName: 'Type', filter: 'select' },
    { field: 'phone', headerName: 'Phone', filter: 'text' },
    { field: 'paymentTerms', headerName: 'Payment Terms', filter: 'text' },
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
      title: 'Delete supplier',
      message: `Are you sure you want to delete "${row.supplierName}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Supplier deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...values }).unwrap();
        notify.success('Supplier updated');
      } else {
        await create(values).unwrap();
        notify.success('Supplier added');
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
        title="Supplier Master"
        subtitle={showForm ? 'Create a new supplier.' : 'Manage and track your suppliers.'}
        rightContent={<CompanyBadge />}
      />

      <Collapse in={showForm} unmountOnExit>
        <Box sx={{ mb: 2 }}>
          <AppForm readOnly={readOnly}
            key={formKey}
            schema={supplierSchema}
            defaultValues={editingRow ? { ...emptyValues, ...editingRow } : emptyValues}
            onSubmit={handleSubmit}
          >
            {(methods) => {
              // Auto-fill Account Number / IFSC Code from the selected house
              // bank (still editable), without stomping on values the user
              // already entered when the bank hasn't changed. If more than
              // one house bank account shares the same bank name, the first
              // match is used since `bankName` is a plain string field here.
              const bankNameValue = methods.watch('bankName');
              const prevBankName = useRef(editingRow ? editingRow.bankName : null);
              useEffect(() => {
                if (bankNameValue !== prevBankName.current) {
                  const found = houseBankRows.find((b) => b.bankName === bankNameValue);
                  if (found) {
                    methods.setValue('accountNumber', found.accountNumber || '', { shouldValidate: true });
                    methods.setValue('ifscCode', found.ifscCode || '', { shouldValidate: true });
                  }
                  prevBankName.current = bankNameValue;
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [bankNameValue]);

              // Picking an Accounts Receivable account fetches that account's
              // own balance and the current Financial Year's default Down
              // Payment Clearing Account — same auto-fill as CustomerMaster's
              // own Accounts Receivable field, see the comment there.
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
                        <Typography variant="subtitle1" fontWeight={700}>Supplier Information</Typography>
                        <Button variant="outlined" color="inherit" startIcon={<CloseIcon />} onClick={closeForm}>
                          Close
                        </Button>
                      </Stack>

                      <FormGrid columns={4}>
                        {/* Auto-generated from the perpetual SUP numbering series (hidden
                            from the Document Numbering page — see hiddenFromNumberingUI
                            in documentNumberService.js). The field is filled and locked
                            on create, and left untouched on edit so an existing record's
                            code is never rewritten. */}
                        <DocumentNoField documentCode="SUP" name="supplierCode" label="Supplier Code *" isCreate={!editingRow} />
                        <FormTextField name="supplierName" label="Supplier Name *" placeholder="Enter supplier name" />
                        <FormSelect name="supplierType" label="Supplier Type *" placeholder="Select supplier type" options={SUPPLIER_TYPE_OPTIONS} />
                        

                        <FormTextField name="contactPerson" label="Contact Person" placeholder="Enter contact person" />
                        <FormTextField name="phone" label="Phone No." placeholder="Enter phone number" digitsOnly maxLength={10} />
                        <FormTextField name="alternatePhone" label="Alternate Phone No." placeholder="Enter alternate phone" digitsOnly maxLength={10} />
                        <FormTextField name="email" label="Email" placeholder="Enter email address" />

                        <FormTextField name="gstin" label="GSTIN" placeholder="Enter GSTIN" maxLength={15} inputProps={{ style: { textTransform: 'uppercase' } }} />
                        <FormTextField name="panNo" label="PAN No." placeholder="Enter PAN number" maxLength={10} inputProps={{ style: { textTransform: 'uppercase' } }} />
                        <FormTextField name="msmeNo" label="MSME No." placeholder="Enter MSME number" />
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
                        <FormSelect name="paymentTerms" label="Payment Terms" placeholder="Select payment terms" options={SUPPLIER_PAYMENT_TERMS_OPTIONS} />
                        <FormSelect name="paymentMode" label="Payment Mode" placeholder="Select payment mode" options={PAYMENT_MODE_OPTIONS} />
                      </FormGrid>

                      <FormGrid columns={4}>
                        <FormSelect name="bankName" label="Bank Name" placeholder="Select house bank" options={bankNameOptions} />
                        <FormTextField name="accountNumber" label="Account Number" placeholder="Auto-filled from house bank" disabled />
                        <FormTextField name="ifscCode" label="IFSC Code" placeholder="Auto-filled from house bank" disabled />
                        <FormSelect name="priceList" label="Price List" placeholder="Select price list" options={SUPPLIER_PRICE_LIST_OPTIONS} />
                      </FormGrid>

                      <FormGrid columns={4}>
                        <FormSelect name="currency" label="Currency" options={CURRENCY_OPTIONS} />
                        <FormSelect name="preferredPurchaseCategory" label="Preferred Purchase Category" placeholder="Select category" options={PURCHASE_CATEGORY_OPTIONS} />
                        <FormTextField name="discountPercent" label="Discount (%)" type="number" placeholder="0.00" />
                      </FormGrid>

                      <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        <Grid item xs={12}>
                          <FormTextField name="notes" label="Notes" placeholder="Enter notes (optional)" multiline rows={3} />
                        </Grid>
                      </Grid>

                      {/* Accounting — Control Accounts, the same section
                          WarehouseMaster/ProductGroup carry an Accounting
                          tab for. accountsReceivable /
                          downPaymentClearingAccount store a ChartOfAccount
                          code; accountBalance is a plain editable figure,
                          separate from Opening/Outstanding Balance above. */}
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
                          {readOnly ? 'View' : editingRow ? 'Update Supplier' : 'Save Supplier'}
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
            <Typography variant="subtitle1" fontWeight={700}>Supplier List</Typography>
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
                  Add Supplier
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
                  title={row.supplierName}
                  statusChip={<Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />}
                  fields={[
                    { label: 'Supplier Code', value: row.supplierCode },
                    { label: 'Type', value: row.supplierType || '—' },
                    { label: 'Payment Terms', value: row.paymentTerms || '—' },
                    { label: 'Outstanding', value: row.outstandingBalance != null ? `₹${Number(row.outstandingBalance).toFixed(2)}` : '—' },
                  ]}
                  onView={() => handleView(row)}
                  onEdit={() => handleEdit(row)}
                  onDelete={() => handleDelete(row)}
                />
              ))}
              {!isLoading && filteredRows.length === 0 && (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>No suppliers found</Typography>
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell width={48}>#</TableCell>
                    <SortableHeaderCell field="supplierCode" sort={table.sort} onSort={table.toggleSort}>Supplier Code</SortableHeaderCell>
                    <SortableHeaderCell field="supplierName" sort={table.sort} onSort={table.toggleSort}>Supplier Name</SortableHeaderCell>
                    <SortableHeaderCell field="supplierType" sort={table.sort} onSort={table.toggleSort}>Type</SortableHeaderCell>
                    <SortableHeaderCell field="phone" sort={table.sort} onSort={table.toggleSort}>Phone</SortableHeaderCell>
                    <SortableHeaderCell field="paymentTerms" sort={table.sort} onSort={table.toggleSort}>Payment Terms</SortableHeaderCell>
                    <SortableHeaderCell field="outstandingBalance" sort={table.sort} onSort={table.toggleSort}>Outstanding (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.supplierCode}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.supplierName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.supplierType || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.phone || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.paymentTerms || '—'}</TableCell>
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
                      <TableCell colSpan={9}>
                        <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>No suppliers found</Typography>
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
