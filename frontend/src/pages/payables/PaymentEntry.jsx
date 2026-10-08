import React, { useMemo, useState } from 'react';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import {
  Box, Typography, Button, Card, CardContent, Stack, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton, Menu, MenuItem, ListItemIcon,
  ListItemText, Autocomplete, Grid, Collapse, Dialog, DialogTitle, DialogContent,
  DialogActions, Checkbox,
} from '@mui/material';
import { useFieldArray } from 'react-hook-form';
import dayjs from 'dayjs';
import CurrencyRupeeOutlinedIcon from '@mui/icons-material/CurrencyRupeeOutlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
import DocumentSeriesNoField from '../../components/form/DocumentSeriesNoField';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import MobileItemCard from '../../components/data-display/MobileItemCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import useDragScroll from '../../components/data-display/useDragScroll';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { supplierPaymentSchema } from '../../lib/validation/receivablesPayablesSchemas';
import { supplierPaymentApi, supplierApi, houseBankApi, appUserApi, supplierOutstandingApi } from '../../features/resources';
import { useBranchNameOptions } from '../../lib/useBranchOptions';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer, { dragScrollbarSx } from '../../components/data-display/ScrollableTableContainer';
import TableFeatureScope from '../../components/data-display/TableFeatureScope';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';
import { useCurrencyOptions } from '../../lib/currencyOptions';
const PAYMENT_MODE_OPTIONS = ['Cash', 'Cheque', 'Bank Transfer', 'UPI', 'NEFT', 'RTGS'].map((s) => ({ label: s, value: s }));
// Currency reads live from Currency Master instead of a hardcoded list —
// see lib/currencyOptions.js.

// Columns for the "Add Invoice" picker dialog. The dialog lives inside a
// render prop, so its table features come from <TableFeatureScope>.
const INVOICE_PICKER_COLUMNS = [
  { field: 'invoiceNo', headerName: 'Invoice No.', filter: 'text' },
  { field: 'invoiceDate', headerName: 'Invoice Date', filter: 'dateRange', sortValue: (r) => (r.invoiceDate ? new Date(r.invoiceDate).getTime() : null), searchValue: (r) => (r.invoiceDate ? dayjs(r.invoiceDate).format('DD/MM/YYYY') : '') },
  { field: 'dueDate', headerName: 'Due Date', filter: 'dateRange', sortValue: (r) => (r.dueDate ? new Date(r.dueDate).getTime() : null), searchValue: (r) => (r.dueDate ? dayjs(r.dueDate).format('DD/MM/YYYY') : '') },
  { field: 'invoiceAmount', headerName: 'Invoice Amount (₹)', filter: 'numberRange', sortValue: (r) => Number(r.invoiceAmount) || 0 },
  { field: 'balanceAmount', headerName: 'Outstanding (₹)', filter: 'numberRange', sortValue: (r) => (r.balanceAmount != null ? Number(r.balanceAmount) : Number(r.invoiceAmount || 0) - Number(r.paidAmount || 0)) },
];

const PAGE_SIZE = 10;
const STATUS_FILTERS = ['All Status', 'Draft', 'Posted'];
const STATUS_COLORS = { Draft: 'info', Posted: 'success' };

function getEmptyValues() {
  const today = new Date();
  return {
    paymentNo: '', seriesId: '', branch: '', supplierName: '', paymentDate: today, postingDate: today,
    paymentMode: 'Bank Transfer', payFromAccount: '', notes: '', paidBy: '', instrumentNo: '',
    paymentCurrency: 'INR', paymentAmount: 0, summaryPaymentDate: today,
    remarks: '', invoiceApplications: [],
  };
}

function rowToFormValues(row) {
  return {
    paymentNo: row.paymentNo, seriesId: '', branch: row.branch || '', supplierName: row.supplierName || '',
    paymentDate: row.paymentDate, postingDate: row.postingDate,
    paymentMode: row.paymentMode || 'Bank Transfer', payFromAccount: row.payFromAccount || '',
    notes: row.notes || '', paidBy: row.paidBy || '', instrumentNo: row.instrumentNo || '',
    paymentCurrency: row.paymentCurrency || 'INR',
    paymentAmount: row.paymentAmount != null ? Number(row.paymentAmount) : 0,
    summaryPaymentDate: row.summaryPaymentDate,
    remarks: row.remarks || '',
    invoiceApplications: (row.invoiceApplications || []).map((a) => ({
      invoiceNo: a.invoiceNo || '', invoiceDate: a.invoiceDate, dueDate: a.dueDate,
      totalAmount: a.totalAmount != null ? Number(a.totalAmount) : 0,
      outstandingAtTimeOfApplication: a.outstandingAtTimeOfApplication != null ? Number(a.outstandingAtTimeOfApplication) : 0,
      amountApplied: a.amountApplied != null ? Number(a.amountApplied) : 0,
    })),
  };
}

const PAYMENT_ENTRY_LIST_TABLE_ROW_HEIGHT = 0;
const PAYMENT_ENTRY_LIST_TABLE_CELL_PADDING_Y = 6;
export default function PaymentEntry() {
  const currencyOptions = useCurrencyOptions();
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const itemScrollRef = useDragScroll();
  const { data: payments, isLoading } = supplierPaymentApi.useList();
  const { data: suppliers } = supplierApi.useList();
  const { data: houseBanks } = houseBankApi.useList();
  const { data: appUsers } = appUserApi.useList();
  const { data: outstandingInvoices } = supplierOutstandingApi.useList();
  const [create, { isLoading: creating }] = supplierPaymentApi.useCreate();
  const [update, { isLoading: updating }] = supplierPaymentApi.useUpdate();
  const [remove] = supplierPaymentApi.useDelete();

  const payFromOptions = (houseBanks || []).map((b) => ({ label: `${b.bankName} - ${b.accountNumber}`, value: `${b.bankName} - ${b.accountNumber}` }));
  const paidByOptions = (appUsers || []).map((u) => ({ label: u.name, value: u.name }));

  // Form is hidden by default -- it expands in a Collapse ABOVE the list
  // (which stays visible) when "New Payment" or an edit action is
  // triggered, per the inline form template (Branch/TaxCode).
  const [showForm, setShowForm] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const { options: branchOptions } = useBranchNameOptions({ currentValue: editingRow?.branch });
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [rowMenuAnchor, setRowMenuAnchor] = useState(null);
  const [rowMenuTarget, setRowMenuTarget] = useState(null);
  const [pendingStatus, setPendingStatus] = useState('Draft');

  // Supplier dropdown should only list suppliers that currently have an
  // outstanding balance (per Supplier Outstanding), not the whole Supplier
  // Master -- mirrors the same fix applied to Collection Entry's customer
  // dropdown. Keep editingRow's supplier selectable even if it has since
  // been fully paid off, so editing an old payment doesn't blank the field.
  const codeBySupplierName = useMemo(() => {
    const map = {};
    (suppliers || []).forEach((s) => { map[s.supplierName] = s.supplierCode; });
    return map;
  }, [suppliers]);

  const supplierOptions = useMemo(() => {
    const names = new Set();
    (outstandingInvoices || []).forEach((inv) => {
      const balance = inv.balanceAmount != null ? Number(inv.balanceAmount) : Number(inv.invoiceAmount || 0) - Number(inv.paidAmount || 0);
      if (inv.status !== 'Paid' && balance > 0 && inv.supplierName) names.add(inv.supplierName);
    });
    if (editingRow?.supplierName) names.add(editingRow.supplierName);
    return Array.from(names).sort().map((name) => ({
      label: codeBySupplierName[name] ? `${name} (${codeBySupplierName[name]})` : name,
      value: name,
    }));
  }, [outstandingInvoices, codeBySupplierName, editingRow]);

  const rows = payments || [];

  const baseTableRows = useMemo(() => {
    const q = '';
    return rows.filter((r) => {
      const matchesSearch = !q || [r.paymentNo, r.supplierName].some((v) => String(v || '').toLowerCase().includes(q));
      const matchesStatus = statusFilter === 'All Status' || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, statusFilter]);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'paymentNo', headerName: 'Payment No.', filter: 'text' },
    { field: 'supplierName', headerName: 'Supplier', filter: 'text' },
    { field: 'paymentDate', headerName: 'Payment Date', filter: 'dateRange', sortValue: (row) => (row.paymentDate ? new Date(row.paymentDate).getTime() : null) },
    { field: 'paymentMode', headerName: 'Payment Mode', filter: 'text' },
    { field: 'paymentAmount', headerName: 'Payment Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.paymentAmount == null || row.paymentAmount === '' ? null : Number(row.paymentAmount)) },
    { field: 'totalAppliedAmount', headerName: 'Applied Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.totalAppliedAmount == null || row.totalAppliedAmount === '' ? null : Number(row.totalAppliedAmount)) },
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
    setRowMenuAnchor(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (row) => {
    setEditingRow(row);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    setShowForm(true);
    setRowMenuAnchor(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Delete payment',
      message: `Are you sure you want to delete "${row.paymentNo}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Payment deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    const payload = { ...values, status: pendingStatus };
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Payment updated');
      } else {
        await create(payload).unwrap();
        notify.success('Payment saved');
      }
      closeForm();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<CurrencyRupeeOutlinedIcon />}
        title="Payment Entry"
        subtitle={showForm ? 'Record supplier payments.' : 'Manage and track all supplier payments.'}
        rightContent={<CompanyBadge />}
      />

      <Collapse in={showForm} unmountOnExit>
      <Box sx={{ mb: 2 }}>
        <AppForm readOnly={readOnly}
          key={formKey}
          schema={supplierPaymentSchema}
          defaultValues={editingRow ? rowToFormValues(editingRow) : getEmptyValues()}
          onSubmit={handleSubmit}
        >
          {(methods) => {
            const { control, watch, formState: { errors } } = methods;
            const { fields, append, remove: removeApplication } = useFieldArray({ control, name: 'invoiceApplications' });
            // invoiceApplications requires at least one applied invoice, but
            // that's an array-level rule (z.array().min(1)) with no single
            // field to attach the error to — react-hook-form doesn't render
            // it under any FormTextField/FormSelect, so Save used to fail
            // with zero on-screen feedback whenever no invoice was added.
            // Surface it explicitly next to the section header instead.
            const invoiceApplicationsError = errors.invoiceApplications?.message || errors.invoiceApplications?.root?.message;
            const watchedApplications = watch('invoiceApplications') || [];
            const paymentAmount = Number(watch('paymentAmount')) || 0;
            const totalApplied = watchedApplications.reduce((sum, a) => sum + (Number(a.amountApplied) || 0), 0);
            const selectedSupplier = watch('supplierName');
            const paymentDateValue = watch('paymentDate');
            const postingDateMinDate = paymentDateValue ? dayjs(paymentDateValue) : undefined;

            const [pickerOpen, setPickerOpen] = useState(false);
            const [pickedIds, setPickedIds] = useState([]);

            const alreadyAddedInvoiceNos = watchedApplications.map((a) => a.invoiceNo);
            const pickerRows = (outstandingInvoices || []).filter((inv) => {
              const balance = inv.balanceAmount != null ? Number(inv.balanceAmount) : Number(inv.invoiceAmount || 0) - Number(inv.paidAmount || 0);
              return inv.supplierName === selectedSupplier
                && inv.status !== 'Paid'
                && balance > 0
                && !alreadyAddedInvoiceNos.includes(inv.invoiceNo);
            });

            const openPicker = () => {
              if (!selectedSupplier) {
                notify.error('Select a Supplier first');
                return;
              }
              setPickedIds([]);
              setPickerOpen(true);
            };

            const confirmPicker = () => {
              pickerRows.filter((inv) => pickedIds.includes(inv.id)).forEach((inv) => {
                const balance = inv.balanceAmount != null ? Number(inv.balanceAmount) : Number(inv.invoiceAmount || 0) - Number(inv.paidAmount || 0);
                append({
                  invoiceNo: inv.invoiceNo,
                  invoiceDate: inv.invoiceDate,
                  dueDate: inv.dueDate,
                  totalAmount: inv.invoiceAmount != null ? Number(inv.invoiceAmount) : 0,
                  outstandingAtTimeOfApplication: balance,
                  amountApplied: balance,
                });
              });
              setPickerOpen(false);
            };

            return (
              <>
                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight={700}>{readOnly ? 'View Payment' : editingRow ? 'Edit Payment' : 'New Payment'} — Payment Details</Typography>
                      <Button type="button" variant="outlined" color="inherit" startIcon={<CloseIcon />} onClick={closeForm}>
                        Close
                      </Button>
                    </Stack>

                    <FormGrid columns={3} singleColumnOnMobile>
                      <FormSelect name="supplierName" label="Supplier *" placeholder="Select supplier" options={supplierOptions} />
                      <FormDatePicker name="paymentDate" label="Payment Date *" triggerFields={['postingDate']} />
                      <FormSelect name="paymentMode" label="Payment Mode *" options={PAYMENT_MODE_OPTIONS} />

                      <DocumentSeriesNoField documentCode="PV" seriesFieldName="seriesId" numberFieldName="paymentNo" label="Reference No." isCreate={!editingRow} />
                      <FormDatePicker name="postingDate" label="Posting Date *" minDate={postingDateMinDate} triggerFields={['paymentDate']} />
                      <FormSelect name="payFromAccount" label="Pay From Account *" placeholder="Select house bank" options={payFromOptions} />

                      <FormTextField name="notes" label="Notes" placeholder="Enter any notes (optional)" multiline rows={2} />
                      <FormSelect name="paidBy" label="Paid By *" placeholder="Select user" options={paidByOptions} />
                      <FormTextField name="instrumentNo" label="Instrument / Transaction No." placeholder="Cheque / NEFT ref (optional)" />
                      <FormSelect name="branch" label="Branch *" placeholder="Select branch" options={branchOptions} />
                    </FormGrid>
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight={700}>Applied Invoices</Typography>
                      <Button type="button" variant="outlined" size="small" startIcon={<AddIcon />} onClick={openPicker}>
                        Add Invoice
                      </Button>
                    </Stack>

                    {invoiceApplicationsError && (
                      <Typography variant="caption" color="error" display="block" sx={{ mb: 1.5 }}>
                        {invoiceApplicationsError}
                      </Typography>
                    )}

                    {isMobile ? (
                      <Box>
                        {fields.map((field, index) => (
                          <MobileItemCard
                            key={field.id}
                            index={index}
                            amount={Number(watch(`invoiceApplications.${index}.amountApplied`) || 0).toFixed(2)}
                            onRemove={() => removeApplication(index)}
                          >
                            <FormTextField name={`invoiceApplications.${index}.invoiceNo`} label="Invoice No." disabled />
                            <FormTextField name={`invoiceApplications.${index}.totalAmount`} label="Total Amount (₹)" disabled />
                            <FormTextField name={`invoiceApplications.${index}.outstandingAtTimeOfApplication`} label="Outstanding (₹)" disabled />
                            <FormTextField name={`invoiceApplications.${index}.amountApplied`} label="Amount to Apply (₹) *" type="number" />
                          </MobileItemCard>
                        ))}
                        {fields.length === 0 && (
                          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>No invoices applied yet</Typography>
                        )}
                      </Box>
                    ) : (
                    <TableContainer ref={itemScrollRef} sx={{ overflow: 'auto', maxHeight: 420, cursor: 'grab', ...dragScrollbarSx }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell width={40}>#</TableCell>
                            <TableCell>Invoice No.</TableCell>
                            <TableCell>Invoice Date</TableCell>
                            <TableCell>Due Date</TableCell>
                            <TableCell align="right">Total Amount (₹)</TableCell>
                            <TableCell>Outstanding (₹)</TableCell>
                            <TableCell align="right" sx={{ minWidth: 140 }}>Amount to Apply (₹)</TableCell>
                            <TableCell width={48} />
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {fields.map((field, index) => (
                            <TableRow key={field.id}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{watch(`invoiceApplications.${index}.invoiceNo`)}</TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                {watch(`invoiceApplications.${index}.invoiceDate`) ? dayjs(watch(`invoiceApplications.${index}.invoiceDate`)).format('DD/MM/YYYY') : '—'}
                              </TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                {watch(`invoiceApplications.${index}.dueDate`) ? dayjs(watch(`invoiceApplications.${index}.dueDate`)).format('DD/MM/YYYY') : '—'}
                              </TableCell>
                              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(watch(`invoiceApplications.${index}.totalAmount`) || 0).toFixed(2)}</TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{Number(watch(`invoiceApplications.${index}.outstandingAtTimeOfApplication`) || 0).toFixed(2)}</TableCell>
                              <TableCell align="right">
                                <FormTextField inputProps={{ style: { textAlign: 'right' } }} name={`invoiceApplications.${index}.amountApplied`} label="" type="number" />
                              </TableCell>
                              <TableCell>
                                <IconButton type="button" size="small" color="error" onClick={() => removeApplication(index)} aria-label="remove invoice">
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                          {fields.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={8}>
                                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>No invoices applied yet</Typography>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                        {fields.length > 0 && (
                          <TableBody>
                            <TableRow>
                              <TableCell colSpan={5} />
                              <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Total Applied Amount (₹)</TableCell>
                              <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>₹{totalApplied.toFixed(2)}</TableCell>
                              <TableCell />
                            </TableRow>
                          </TableBody>
                        )}
                      </Table>
                    </TableContainer>
                    )}
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ mb: 0 }}>
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Payment Summary</Typography>
                    <FormGrid columns={3} singleColumnOnMobile>
                      <FormSelect name="paymentCurrency" label="Payment Currency *" options={currencyOptions} />
                      <FormTextField name="paymentAmount" label="Payment Amount (₹) *" type="number" />
                      <FormDatePicker name="summaryPaymentDate" label="Payment Date *" />
                    </FormGrid>

                    <Grid container spacing={3} sx={{ mt: 0 }}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Remarks</Typography>
                        <FormTextField name="remarks" label="" placeholder="Enter any remarks (optional)" multiline rows={4} />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 3, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <Stack spacing={1}>
                            <Typography variant="body2" color="text.secondary">Total Payment Amount (₹)</Typography>
                            <Typography variant="h4" fontWeight={700}>₹{paymentAmount.toFixed(2)}</Typography>
                            {Math.abs(paymentAmount - totalApplied) > 0.01 && (
                              <Typography variant="caption" color="warning.main">
                                Applied amount (₹{totalApplied.toFixed(2)}) differs from payment amount — the difference is treated as an advance/overpayment.
                              </Typography>
                            )}
                          </Stack>
                        </Box>
                      </Grid>
                    </Grid>

                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1.5}
                      justifyContent={{ xs: 'stretch', sm: 'flex-end' }}
                      sx={{ mt: 3 }}
                    >
                      <Button fullWidth={isMobile} type="button" variant="outlined" color={readOnly ? 'error' : 'inherit'} startIcon={<CloseIcon />} onClick={closeForm} disabled={creating || updating}>
                        {readOnly ? 'Close' : 'Cancel'}
                      </Button>
                      <FormSubmitButton
                        fullWidth={isMobile}
                        variant="outlined"
                        onClick={() => setPendingStatus('Draft')}
                        disabled={creating || updating}
                      >
                        Save as Draft
                      </FormSubmitButton>
                      <FormSubmitButton
                        fullWidth={isMobile}
                        onClick={() => setPendingStatus('Posted')}
                        disabled={creating || updating}
                      >
                        Save & Post Payment
                      </FormSubmitButton>
                    </Stack>
                  </CardContent>
                </Card>

                <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} maxWidth="md" fullWidth>
                  <DialogTitle>Add Invoice — Outstanding invoices for {selectedSupplier || 'supplier'}</DialogTitle>
                  <DialogContent dividers>
                    <TableFeatureScope rows={pickerRows} columns={INVOICE_PICKER_COLUMNS}>
                    {(invTable) => (
                    <>
                    <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                      <TableSearchFilter table={invTable} placeholder="Search invoices..." width={200} />
                    </Stack>
                    <TableFilterPanel table={invTable} />
                    <ScrollableTableContainer maxHeight="min(55vh, 400px)">
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell padding="checkbox" />
                            <SortableHeaderCell field="invoiceNo" sort={invTable.sort} onSort={invTable.toggleSort}>Invoice No.</SortableHeaderCell>
                            <SortableHeaderCell field="invoiceDate" sort={invTable.sort} onSort={invTable.toggleSort}>Invoice Date</SortableHeaderCell>
                            <SortableHeaderCell field="dueDate" sort={invTable.sort} onSort={invTable.toggleSort}>Due Date</SortableHeaderCell>
                            <SortableHeaderCell align="right" field="invoiceAmount" sort={invTable.sort} onSort={invTable.toggleSort}>Invoice Amount (₹)</SortableHeaderCell>
                            <SortableHeaderCell field="balanceAmount" sort={invTable.sort} onSort={invTable.toggleSort}>Outstanding (₹)</SortableHeaderCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {invTable.rows.map((inv) => {
                            const balance = inv.balanceAmount != null ? Number(inv.balanceAmount) : Number(inv.invoiceAmount || 0) - Number(inv.paidAmount || 0);
                            const checked = pickedIds.includes(inv.id);
                            return (
                              <TableRow key={inv.id} hover onClick={() => setPickedIds((prev) => checked ? prev.filter((id) => id !== inv.id) : [...prev, inv.id])} sx={{ cursor: 'pointer' }}>
                                <TableCell padding="checkbox">
                                  <Checkbox size="small" checked={checked} />
                                </TableCell>
                                <TableCell>{inv.invoiceNo}</TableCell>
                                <TableCell>{inv.invoiceDate ? dayjs(inv.invoiceDate).format('DD/MM/YYYY') : '—'}</TableCell>
                                <TableCell>{inv.dueDate ? dayjs(inv.dueDate).format('DD/MM/YYYY') : '—'}</TableCell>
                                <TableCell align="right">{Number(inv.invoiceAmount || 0).toFixed(2)}</TableCell>
                                <TableCell>{balance.toFixed(2)}</TableCell>
                              </TableRow>
                            );
                          })}
                          {invTable.rows.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6}>
                                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>{invTable.isFiltering ? 'No invoices match your search' : 'No outstanding invoices for this supplier'}</Typography>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </ScrollableTableContainer>
                    </>
                    )}
                    </TableFeatureScope>
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => setPickerOpen(false)} color="inherit">Cancel</Button>
                    <Button onClick={confirmPicker} variant="contained" disabled={pickedIds.length === 0}>Add Selected</Button>
                  </DialogActions>
                </Dialog>
              </>
            );
          }}
        </AppForm>
      </Box>
      </Collapse>

      <Card variant="outlined">
          <CardContent sx={{ p: 0 }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              alignItems={{ xs: 'stretch', md: 'center' }}
              justifyContent="space-between"
              flexWrap="wrap"
              gap={1.5}
              sx={{ px: { xs: 2, sm: 3 }, pt: 2.5, pb: 1.5 }}
            >
              <Typography variant="subtitle1" fontWeight={700}>Payment List</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap sx={{ width: { xs: '100%', md: 'auto' } }}>
                <TableSearchFilter table={table} placeholder="Search by payment no., supplier..." showFilter={false} />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
                  <Button
                    variant="outlined"
                    color="inherit"
                    startIcon={<FilterListIcon />}
                    onClick={() => setShowFilters((v) => !v)}
                    sx={{ width: { xs: '100%', sm: 'auto' }, height: 40, whiteSpace: 'nowrap' }}
                  >
                    Filter
                  </Button>
                  <CanAdd>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={openCreate}
                      sx={{ width: { xs: '100%', sm: 'auto' }, height: 40, whiteSpace: 'nowrap' }}
                    >
                      New Payment
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
                </FormGrid>
                <TableFilterPanel table={table} embedded open />
              </Box>
            </Collapse>

            {isMobile ? (
              <Box sx={{ px: 2, pb: 1 }}>
                {!isLoading && pagedRows.map((row) => (
                  <MobileRecordCard
                    key={row.id}
                    title={row.paymentNo}
                    statusChip={<Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />}
                    fields={[
                      { label: 'Supplier', value: row.supplierName || '—' },
                      { label: 'Payment Date', value: row.paymentDate ? dayjs(row.paymentDate).format('DD/MM/YYYY') : '—' },
                      { label: 'Payment Mode', value: row.paymentMode || '—' },
                      { label: 'Payment Amount', value: `₹${Number(row.paymentAmount).toFixed(2)}` },
                      { label: 'Applied Amount', value: `₹${Number(row.totalAppliedAmount).toFixed(2)}` },
                    ]}
                    onView={() => handleView(row)}
                    onEdit={() => handleEdit(row)}
                    onDelete={() => handleDelete(row)}
                  />
                ))}
                {!isLoading && filteredRows.length === 0 && (
                  <EmptyState icon={<PaymentsOutlinedIcon sx={{ fontSize: 48 }} />} title="No payments found" message="Add your first payment to get started" />
                )}
              </Box>
            ) : (
              <ScrollableTableContainer>
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    '& th, & td': {
                      height: PAYMENT_ENTRY_LIST_TABLE_ROW_HEIGHT,
                      paddingTop: `${PAYMENT_ENTRY_LIST_TABLE_CELL_PADDING_Y}px`,
                      paddingBottom: `${PAYMENT_ENTRY_LIST_TABLE_CELL_PADDING_Y}px`,
                      boxSizing: 'border-box',
                    },
                  }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell width={40}>#</TableCell>
                      <SortableHeaderCell field="paymentNo" sort={table.sort} onSort={table.toggleSort}>Payment No.</SortableHeaderCell>
                      <SortableHeaderCell field="supplierName" sort={table.sort} onSort={table.toggleSort}>Supplier</SortableHeaderCell>
                      <SortableHeaderCell field="paymentDate" sort={table.sort} onSort={table.toggleSort}>Payment Date</SortableHeaderCell>
                      <SortableHeaderCell field="paymentMode" sort={table.sort} onSort={table.toggleSort}>Payment Mode</SortableHeaderCell>
                      <SortableHeaderCell align="right" field="paymentAmount" sort={table.sort} onSort={table.toggleSort}>Payment Amount (₹)</SortableHeaderCell>
                      <SortableHeaderCell align="right" field="totalAppliedAmount" sort={table.sort} onSort={table.toggleSort}>Applied Amount (₹)</SortableHeaderCell>
                      <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {!isLoading && pagedRows.map((row, i) => (
                      <TableRow key={row.id} hover>
                        <TableCell>{page * pageSize + i + 1}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.paymentNo}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.supplierName || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.paymentDate ? dayjs(row.paymentDate).format('DD/MM/YYYY') : '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.paymentMode || '—'}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(row.paymentAmount).toFixed(2)}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(row.totalAppliedAmount).toFixed(2)}</TableCell>
                        <TableCell>
                          <Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />
                        </TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => handleView(row)} aria-label="view">
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={(e) => { setRowMenuAnchor(e.currentTarget); setRowMenuTarget(row); }}
                            aria-label="more actions"
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!isLoading && filteredRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9}>
                          <EmptyState icon={<PaymentsOutlinedIcon sx={{ fontSize: 48 }} />} title="No payments found" message="Add your first payment to get started" />
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
    </Box>
  );
}
