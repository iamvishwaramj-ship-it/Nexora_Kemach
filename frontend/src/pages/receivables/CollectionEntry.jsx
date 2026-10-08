import React, { useMemo, useState } from 'react';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import {
  Box, Typography, Button, Card, CardContent, Stack, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton, Menu, MenuItem, ListItemIcon,
  ListItemText, Autocomplete, Grid, Collapse, Dialog, DialogTitle, DialogContent,
  DialogActions, Checkbox,
} from '@mui/material';
import { useFieldArray } from 'react-hook-form';
import dayjs from 'dayjs';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
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
import { collectionSchema } from '../../lib/validation/receivablesPayablesSchemas';
import { collectionApi, customerApi, houseBankApi, appUserApi, customerOutstandingApi } from '../../features/resources';
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
    collectionNo: '', seriesId: '', branch: '', customerName: '', receiptDate: today, postingDate: today,
    paymentMode: 'Bank Transfer', depositTo: '', notes: '', receivedBy: '', instrumentNo: '',
    paymentCurrency: 'INR', paymentAmount: 0, paymentDate: today,
    remarks: '', invoiceApplications: [],
  };
}

function rowToFormValues(row) {
  return {
    collectionNo: row.collectionNo, seriesId: '', branch: row.branch || '', customerName: row.customerName || '',
    receiptDate: row.receiptDate, postingDate: row.postingDate,
    paymentMode: row.paymentMode || 'Bank Transfer', depositTo: row.depositTo || '',
    notes: row.notes || '', receivedBy: row.receivedBy || '', instrumentNo: row.instrumentNo || '',
    paymentCurrency: row.paymentCurrency || 'INR',
    paymentAmount: row.paymentAmount != null ? Number(row.paymentAmount) : 0,
    paymentDate: row.paymentDate,
    remarks: row.remarks || '',
    invoiceApplications: (row.invoiceApplications || []).map((a) => ({
      invoiceNo: a.invoiceNo || '', invoiceDate: a.invoiceDate, dueDate: a.dueDate,
      totalAmount: a.totalAmount != null ? Number(a.totalAmount) : 0,
      outstandingAtTimeOfApplication: a.outstandingAtTimeOfApplication != null ? Number(a.outstandingAtTimeOfApplication) : 0,
      amountApplied: a.amountApplied != null ? Number(a.amountApplied) : 0,
    })),
  };
}

const COLLECTION_ENTRY_LIST_TABLE_ROW_HEIGHT = 0;
const COLLECTION_ENTRY_LIST_TABLE_CELL_PADDING_Y = 6;
export default function CollectionEntry() {
  const currencyOptions = useCurrencyOptions();
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const itemScrollRef = useDragScroll();
  const { data: collections, isLoading } = collectionApi.useList();
  const { data: customers } = customerApi.useList();
  const { data: houseBanks } = houseBankApi.useList();
  const { data: appUsers } = appUserApi.useList();
  const { data: outstandingInvoices } = customerOutstandingApi.useList();
  const [create, { isLoading: creating }] = collectionApi.useCreate();
  const [update, { isLoading: updating }] = collectionApi.useUpdate();
  const [remove] = collectionApi.useDelete();

  const depositToOptions = (houseBanks || []).map((b) => ({ label: `${b.bankName} - ${b.accountNumber}`, value: `${b.bankName} - ${b.accountNumber}` }));
  const receivedByOptions = (appUsers || []).map((u) => ({ label: u.name, value: u.name }));

  // View toggles between the Collection list and the full-page Create/Edit
  // form -- same page, no dialog/popup, per the standard transaction-
  // document template (PurchaseInvoice/PurchaseOrder).
  const [view, setView] = useState('list');
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

  // Customer dropdown is scoped to whoever actually has an open balance on
  // Customer Outstanding — not the full Customer Master list — so users
  // can't start a Collection against a customer with nothing to collect.
  // customerCode is only used to prettify the label when a matching
  // Customer Master record exists; it isn't stored on CustomerOutstanding.
  const codeByCustomerName = useMemo(
    () => Object.fromEntries((customers || []).map((c) => [c.customerName, c.customerCode])),
    [customers]
  );
  const customerOptions = useMemo(() => {
    const names = new Set();
    (outstandingInvoices || []).forEach((inv) => {
      const balance = inv.balanceAmount != null ? Number(inv.balanceAmount) : Number(inv.invoiceAmount || 0) - Number(inv.paidAmount || 0);
      if (inv.customerName && inv.status !== 'Paid' && balance > 0) names.add(inv.customerName);
    });
    // Keep an already-saved collection's customer selectable even if their
    // balance has since been fully paid off elsewhere, so editing an old
    // record doesn't blank out the field.
    if (editingRow?.customerName) names.add(editingRow.customerName);
    return Array.from(names).sort().map((name) => ({
      label: codeByCustomerName[name] ? `${name} (${codeByCustomerName[name]})` : name,
      value: name,
    }));
  }, [outstandingInvoices, codeByCustomerName, editingRow]);

  const rows = collections || [];

  const baseTableRows = useMemo(() => {
    const q = '';
    return rows.filter((r) => {
      const matchesSearch = !q || [r.collectionNo, r.customerName].some((v) => String(v || '').toLowerCase().includes(q));
      const matchesStatus = statusFilter === 'All Status' || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, statusFilter]);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'collectionNo', headerName: 'Collection No.', filter: 'text' },
    { field: 'customerName', headerName: 'Customer', filter: 'text' },
    { field: 'receiptDate', headerName: 'Receipt Date', filter: 'dateRange', sortValue: (row) => (row.receiptDate ? new Date(row.receiptDate).getTime() : null) },
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
    setView('form');
  };

  const backToList = () => {
    setView('list');
    setEditingRow(null);
  };

  // Read-only look at a record — same form, every field disabled
  // and the save button removed (see AppForm's readOnly prop).
  const handleView = (row) => {
    setEditingRow(row);
    setReadOnly(true);
    setFormKey((k) => k + 1);
    setView('form');
    setRowMenuAnchor(null);
  };

  const handleEdit = (row) => {
    setEditingRow(row);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    setView('form');
    setRowMenuAnchor(null);
  };

  const handleDelete = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Delete collection',
      message: `Are you sure you want to delete "${row.collectionNo}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Collection deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    const payload = { ...values, status: pendingStatus };
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Collection updated');
      } else {
        await create(payload).unwrap();
        notify.success('Collection saved');
      }
      backToList();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<PaymentsOutlinedIcon />}
        title="Collection Entry"
        subtitle={view === 'form' ? 'Record customer payments.' : 'Manage and track all customer collections.'}
        rightContent={<CompanyBadge />}
      />

      {view === 'form' ? (
        <AppForm readOnly={readOnly}
          key={formKey}
          schema={collectionSchema}
          defaultValues={editingRow ? rowToFormValues(editingRow) : getEmptyValues()}
          onSubmit={handleSubmit}
        >
          {(methods) => {
            const { control, watch, setValue, formState: { errors } } = methods;
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
            const selectedCustomer = watch('customerName');
            const receiptDateValue = watch('receiptDate');
            const postingDateMinDate = receiptDateValue ? dayjs(receiptDateValue) : undefined;

            const [pickerOpen, setPickerOpen] = useState(false);
            const [pickedIds, setPickedIds] = useState([]);

            const alreadyAddedInvoiceNos = watchedApplications.map((a) => a.invoiceNo);
            const pickerRows = (outstandingInvoices || []).filter((inv) => {
              const balance = inv.balanceAmount != null ? Number(inv.balanceAmount) : Number(inv.invoiceAmount || 0) - Number(inv.paidAmount || 0);
              return inv.customerName === selectedCustomer
                && inv.status !== 'Paid'
                && balance > 0
                && !alreadyAddedInvoiceNos.includes(inv.invoiceNo);
            });

            const openPicker = () => {
              if (!selectedCustomer) {
                notify.error('Select a Customer first');
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
                      <Typography variant="subtitle1" fontWeight={700}>Collection Details</Typography>
                      <Button type="button" variant="outlined" color="inherit" startIcon={<ArrowBackIcon />} onClick={backToList}>
                        Back to List
                      </Button>
                    </Stack>

                    <FormGrid columns={3} singleColumnOnMobile>
                      <FormSelect name="customerName" label="Customer *" placeholder="Select customer" options={customerOptions} />
                      <FormDatePicker name="receiptDate" label="Receipt Date *" triggerFields={['postingDate']} />
                      <FormSelect name="paymentMode" label="Payment Mode *" options={PAYMENT_MODE_OPTIONS} />

                      <DocumentSeriesNoField documentCode="RV" seriesFieldName="seriesId" numberFieldName="collectionNo" label="Reference No." isCreate={!editingRow} />
                      <FormDatePicker name="postingDate" label="Posting Date *" minDate={postingDateMinDate} triggerFields={['receiptDate']} />
                      <FormSelect name="depositTo" label="Deposit To *" placeholder="Select house bank" options={depositToOptions} />

                      <FormTextField name="notes" label="Notes" placeholder="Optional notes" multiline rows={2} />
                      <FormSelect name="receivedBy" label="Received By *" placeholder="Select user" options={receivedByOptions} />
                      <FormTextField name="instrumentNo" label="Instrument / Transaction No." placeholder="Cheque / NEFT ref (optional)" />
                      <FormSelect name="branch" label="Branch *" placeholder="Select branch" options={branchOptions} />
                    </FormGrid>
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Payment Details</Typography>
                    <FormGrid columns={3} singleColumnOnMobile>
                      <FormSelect name="paymentCurrency" label="Payment Currency *" options={currencyOptions} />
                      <FormTextField name="paymentAmount" label="Payment Amount (₹) *" type="number" />
                      <FormDatePicker name="paymentDate" label="Payment Date *" />
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
                              <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Total Applied</TableCell>
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

                <Card variant="outlined">
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Remarks</Typography>
                        <FormTextField name="remarks" label="" placeholder="Enter any additional remarks (optional)" multiline rows={4} />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 3, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <Stack spacing={1}>
                            <Typography variant="body2" color="text.secondary">Total Amount (₹)</Typography>
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
                      <Button fullWidth={isMobile} type="button" variant="outlined" color={readOnly ? 'error' : 'inherit'} startIcon={<CloseIcon />} onClick={backToList} disabled={creating || updating}>
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
                        Save & Post Collection
                      </FormSubmitButton>
                    </Stack>
                  </CardContent>
                </Card>

                <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} maxWidth="md" fullWidth>
                  <DialogTitle>Add Invoice — Outstanding invoices for {selectedCustomer || 'customer'}</DialogTitle>
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
                                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>{invTable.isFiltering ? 'No invoices match your search' : 'No outstanding invoices for this customer'}</Typography>
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
      ) : (
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
              <Typography variant="subtitle1" fontWeight={700}>Collection List</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap sx={{ width: { xs: '100%', md: 'auto' } }}>
                <TableSearchFilter table={table} placeholder="Search by collection no., customer..." showFilter={false} />
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
                      New Collection
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
                    title={row.collectionNo}
                    statusChip={<Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />}
                    fields={[
                      { label: 'Customer', value: row.customerName || '—' },
                      { label: 'Receipt Date', value: row.receiptDate ? dayjs(row.receiptDate).format('DD/MM/YYYY') : '—' },
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
                  <EmptyState icon={<RequestQuoteOutlinedIcon sx={{ fontSize: 48 }} />} title="No collections found" message="Add your first collection to get started" />
                )}
              </Box>
            ) : (
              <ScrollableTableContainer>
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    '& th, & td': {
                      height: COLLECTION_ENTRY_LIST_TABLE_ROW_HEIGHT,
                      paddingTop: `${COLLECTION_ENTRY_LIST_TABLE_CELL_PADDING_Y}px`,
                      paddingBottom: `${COLLECTION_ENTRY_LIST_TABLE_CELL_PADDING_Y}px`,
                      boxSizing: 'border-box',
                    },
                  }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell width={40}>#</TableCell>
                      <SortableHeaderCell field="collectionNo" sort={table.sort} onSort={table.toggleSort}>Collection No.</SortableHeaderCell>
                      <SortableHeaderCell field="customerName" sort={table.sort} onSort={table.toggleSort}>Customer</SortableHeaderCell>
                      <SortableHeaderCell field="receiptDate" sort={table.sort} onSort={table.toggleSort}>Receipt Date</SortableHeaderCell>
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
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.collectionNo}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.customerName || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.receiptDate ? dayjs(row.receiptDate).format('DD/MM/YYYY') : '—'}</TableCell>
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
                          <EmptyState icon={<RequestQuoteOutlinedIcon sx={{ fontSize: 48 }} />} title="No collections found" message="Add your first collection to get started" />
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
