import React, { useEffect, useMemo, useState } from 'react';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import {
  Box, Typography, Button, Card, CardContent, Stack, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton, Menu, MenuItem, ListItemIcon,
  ListItemText, Autocomplete, Grid, Collapse, Checkbox, Dialog, DialogTitle, DialogContent,
  DialogActions, FormControlLabel,
} from '@mui/material';
import dayjs from 'dayjs';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
import DocumentSeriesNoField from '../../components/form/DocumentSeriesNoField';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import useDragScroll from '../../components/data-display/useDragScroll';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { chequeSchema } from '../../lib/validation/bankingSchemas';
import { chequeApi, houseBankApi, supplierApi, customerApi, supplierOutstandingApi, customerOutstandingApi } from '../../features/resources';
import { useBranchNameOptions } from '../../lib/useBranchOptions';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import TableFeatureScope from '../../components/data-display/TableFeatureScope';
import { noSpinnersSx } from '../../components/form/FormTextField';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';
const CHEQUE_TYPE_OPTIONS = ['Current Account', 'Savings Account', 'Cash Credit', 'Overdraft'].map((s) => ({ label: s, value: s }));
const PRINT_TEMPLATE_OPTIONS = ['Standard Cheque', 'CTS 2010', 'Custom'].map((s) => ({ label: s, value: s }));

// Columns for the "Outstanding Invoices" picker. It sits inside a render
// prop, so its table features come from <TableFeatureScope>.
const INVOICE_PICKER_COLUMNS = [
  { field: 'invoiceNo', headerName: 'Invoice No.', filter: 'text' },
  { field: 'invoiceDate', headerName: 'Invoice Date', filter: 'dateRange', sortValue: (r) => (r.invoiceDate ? new Date(r.invoiceDate).getTime() : null), searchValue: (r) => (r.invoiceDate ? dayjs(r.invoiceDate).format('DD/MM/YYYY') : '') },
  { field: 'dueDate', headerName: 'Due Date', filter: 'dateRange', sortValue: (r) => (r.dueDate ? new Date(r.dueDate).getTime() : null), searchValue: (r) => (r.dueDate ? dayjs(r.dueDate).format('DD/MM/YYYY') : '') },
  { field: 'invoiceAmount', headerName: 'Total Amount (₹)', filter: 'numberRange', sortValue: (r) => Number(r.invoiceAmount) || 0 },
  { field: 'balanceAmount', headerName: 'Outstanding (₹)', filter: 'numberRange', sortValue: (r) => (r.balanceAmount != null ? Number(r.balanceAmount) : Number(r.invoiceAmount || 0) - Number(r.paidAmount || 0)) },
];

const PAGE_SIZE = 10;
const STATUS_FILTERS = ['All Status', 'Pending', 'Printed'];
const STATUS_COLORS = { Pending: 'info', Printed: 'success' };

// Indian-system number to words ("Rupees Fifteen Thousand Two Hundred Fifty
// Only") for the auto-filled Amount in Words field and the cheque preview.
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
}

function threeDigits(n) {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return `${h ? `${ONES[h]} Hundred` : ''}${h && rest ? ' ' : ''}${rest ? twoDigits(rest) : ''}`;
}

function amountToWords(value) {
  const num = Math.floor(Math.abs(Number(value) || 0));
  const paise = Math.round((Math.abs(Number(value) || 0) - num) * 100);
  if (num === 0 && paise === 0) return '';
  const parts = [];
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const rest = num % 1000;
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  const rupees = parts.length ? `Rupees ${parts.join(' ')}` : 'Rupees Zero';
  return paise ? `${rupees} and ${twoDigits(paise)} Paise Only` : `${rupees} Only`;
}

function getEmptyValues() {
  return {
    chequeNo: '', seriesId: '', branch: '', bankAccount: '', chequeDate: new Date(), chequeType: 'Current Account',
    payTo: '', printTemplate: 'Standard Cheque', amount: 0, amountInWords: '',
    narration: '', attachmentName: '',
  };
}

function rowToFormValues(row) {
  return {
    chequeNo: row.chequeNo, seriesId: '', branch: row.branch || '', bankAccount: row.bankAccount || '',
    chequeDate: row.chequeDate, chequeType: row.chequeType || 'Current Account',
    payTo: row.payTo || '', printTemplate: row.printTemplate || 'Standard Cheque',
    amount: row.amount != null ? Number(row.amount) : 0,
    amountInWords: row.amountInWords || '', narration: row.narration || '',
    attachmentName: row.attachmentName || '',
  };
}

const DEFAULT_PRINT_OPTIONS = {
  payeeName: true, amountInWords: true, narration: true, companyName: true, signatory: true,
};

// The live cheque preview, reused by the inline card and the Preview dialog.
function ChequePreview({ values, printOptions }) {
  const [bankName, accountNo] = String(values.bankAccount || '').split(' - ');
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 2.5, bgcolor: 'action.hover' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="subtitle2" fontWeight={700}>{bankName || 'Bank Name'}</Typography>
          <Typography variant="caption" color="text.secondary">{accountNo || 'Account No.'}</Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="caption" display="block">Cheque No. : <b>{values.chequeNo || '—'}</b></Typography>
          <Typography variant="caption" display="block">Date : <b>{values.chequeDate ? dayjs(values.chequeDate).format('DD/MM/YYYY') : '—'}</b></Typography>
        </Box>
      </Stack>

      <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mb: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>Pay</Typography>
        <Typography variant="body2" fontWeight={600} sx={{ flexGrow: 1, borderBottom: '1px solid', borderColor: 'text.secondary', minHeight: 20 }}>
          {printOptions.payeeName ? (values.payTo || '') : ''}
        </Typography>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="baseline" sx={{ flexGrow: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>Rupees</Typography>
          <Typography variant="body2" sx={{ flexGrow: 1, borderBottom: '1px solid', borderColor: 'text.secondary', minHeight: 20 }}>
            {printOptions.amountInWords ? String(values.amountInWords || '').replace(/^Rupees\s*/i, '') : ''}
          </Typography>
        </Stack>
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.5, py: 0.5, bgcolor: 'background.paper', flexShrink: 0 }}>
          <Typography variant="body1" fontWeight={700}>₹ {Number(values.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
        </Box>
      </Stack>

      {printOptions.narration && values.narration && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>Narration: {values.narration}</Typography>
      )}

      <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
        <Typography variant="caption" color="text.secondary">A/c No. : {accountNo || '—'}</Typography>
        {printOptions.signatory && (
          <Box sx={{ textAlign: 'center' }}>
            {/* Blank space for the actual pen-and-ink signature, above the
                signature line/label. */}
            <Box sx={{ height: 40, minWidth: 140 }} />
            <Typography variant="caption" fontWeight={700} sx={{ borderTop: '1px solid', borderColor: 'text.secondary', pt: 0.5, display: 'block' }}>
              Authorised Signatory
            </Typography>
          </Box>
        )}
      </Stack>
    </Box>
  );
}

const CHEQUE_PRINT_LIST_TABLE_ROW_HEIGHT = 0;
const CHEQUE_PRINT_LIST_TABLE_CELL_PADDING_Y = 6;
export default function ChequePrint() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const { data: cheques, isLoading } = chequeApi.useList();
  const { data: houseBanks } = houseBankApi.useList();
  const { data: suppliers } = supplierApi.useList();
  const { data: customers } = customerApi.useList();
  const { data: supplierOutstanding } = supplierOutstandingApi.useList();
  const { data: customerOutstanding } = customerOutstandingApi.useList();
  const [create, { isLoading: creating }] = chequeApi.useCreate();
  const [update, { isLoading: updating }] = chequeApi.useUpdate();
  const [remove] = chequeApi.useDelete();

  const bankAccountOptions = (houseBanks || []).map((b) => ({ label: `${b.bankName} - ${b.accountNumber}`, value: `${b.bankName} - ${b.accountNumber}` }));
  // Cheques can be written to suppliers or customers (refunds), so both
  // masters feed the Pay To options.
  const payToOptions = [
    ...(suppliers || []).map((s) => ({ label: `${s.supplierName} (${s.supplierCode})`, value: s.supplierName })),
    ...(customers || []).map((c) => ({ label: `${c.customerName} (${c.customerCode})`, value: c.customerName })),
  ];

  // Form is hidden by default -- it expands in a Collapse ABOVE the list
  // (which stays visible), per the inline form template (PaymentEntry).
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
  const [pendingStatus, setPendingStatus] = useState('Pending');
  // invoiceNo -> { checked, amountToPay } for the Outstanding Invoices table
  // (kept outside the form; only checked rows are saved as applications).
  const [invoiceSel, setInvoiceSel] = useState({});
  const [printOptions, setPrintOptions] = useState({ ...DEFAULT_PRINT_OPTIONS });
  const [previewOpen, setPreviewOpen] = useState(false);

  const rows = cheques || [];

  const baseTableRows = useMemo(() => {
    const q = '';
    return rows.filter((r) => {
      const matchesSearch = !q || [r.chequeNo, r.payTo, r.bankAccount].some((v) => String(v || '').toLowerCase().includes(q));
      const matchesStatus = statusFilter === 'All Status' || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, statusFilter]);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'chequeNo', headerName: 'Cheque No.', filter: 'text' },
    { field: 'bankAccount', headerName: 'Bank Account', filter: 'numberRange', sortValue: (row) => (row.bankAccount == null || row.bankAccount === '' ? null : Number(row.bankAccount)) },
    { field: 'payTo', headerName: 'Pay To', filter: 'text' },
    { field: 'chequeDate', headerName: 'Cheque Date', filter: 'dateRange', sortValue: (row) => (row.chequeDate ? new Date(row.chequeDate).getTime() : null) },
    { field: 'amount', headerName: 'Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.amount == null || row.amount === '' ? null : Number(row.amount)) },
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
    setInvoiceSel({});
    setPrintOptions({ ...DEFAULT_PRINT_OPTIONS });
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
    setInvoiceSel(Object.fromEntries((row.invoiceApplications || []).map((a) => [
      a.invoiceNo, { checked: true, amountToPay: a.amountToPay != null ? Number(a.amountToPay) : 0 },
    ])));
    setPrintOptions({ ...DEFAULT_PRINT_OPTIONS });
    setFormKey((k) => k + 1);
    setShowForm(true);
    setRowMenuAnchor(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (row) => {
    setEditingRow(row);
    setReadOnly(false);
    setInvoiceSel(Object.fromEntries((row.invoiceApplications || []).map((a) => [
      a.invoiceNo, { checked: true, amountToPay: a.amountToPay != null ? Number(a.amountToPay) : 0 },
    ])));
    setPrintOptions({ ...DEFAULT_PRINT_OPTIONS });
    setFormKey((k) => k + 1);
    setShowForm(true);
    setRowMenuAnchor(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Delete cheque',
      message: `Are you sure you want to delete cheque "${row.chequeNo}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Cheque deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  // Outstanding invoices for a party can come from either side (supplier
  // bills to pay, or customer invoices when refunding).
  const outstandingFor = (party) => [
    ...(supplierOutstanding || []).filter((r) => r.supplierName === party),
    ...(customerOutstanding || []).filter((r) => r.customerName === party),
  ].filter((r) => {
    const balance = r.balanceAmount != null ? Number(r.balanceAmount) : Number(r.invoiceAmount || 0) - Number(r.paidAmount || 0);
    return r.status !== 'Paid' && balance > 0;
  });

  const buildApplications = (party) => outstandingFor(party)
    .filter((inv) => invoiceSel[inv.invoiceNo]?.checked)
    .map((inv) => {
      const balance = inv.balanceAmount != null ? Number(inv.balanceAmount) : Number(inv.invoiceAmount || 0) - Number(inv.paidAmount || 0);
      return {
        invoiceNo: inv.invoiceNo, invoiceDate: inv.invoiceDate, dueDate: inv.dueDate,
        totalAmount: inv.invoiceAmount != null ? Number(inv.invoiceAmount) : 0,
        outstanding: balance,
        amountToPay: Number(invoiceSel[inv.invoiceNo]?.amountToPay) || 0,
      };
    });

  const handleSubmit = async (values, formMethods) => {
    const payload = { ...values, status: pendingStatus, invoiceApplications: buildApplications(values.payTo) };
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success(pendingStatus === 'Printed' ? 'Cheque updated & marked as Printed' : 'Cheque updated');
      } else {
        await create(payload).unwrap();
        notify.success(pendingStatus === 'Printed' ? 'Cheque saved & marked as Printed' : 'Cheque saved');
      }
      closeForm();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<ReceiptLongOutlinedIcon />}
        title="Cheque Print"
        subtitle={showForm ? 'Print cheques for payments.' : 'Manage and print payment cheques.'}
        rightContent={<CompanyBadge />}
      />

      <Collapse in={showForm} unmountOnExit>
        <Box sx={{ mb: 2 }}>
          <AppForm readOnly={readOnly}
            key={formKey}
            schema={chequeSchema}
            defaultValues={editingRow ? rowToFormValues(editingRow) : getEmptyValues()}
            onSubmit={handleSubmit}
          >
            {(methods) => {
              const { watch, setValue } = methods;
              const payTo = watch('payTo');
              const amount = Number(watch('amount')) || 0;
              const chequeNo = watch('chequeNo');
              const chequeDate = watch('chequeDate');
              const bankAccount = watch('bankAccount');
              const amountInWords = watch('amountInWords');
              const narration = watch('narration');

              const partyInvoices = outstandingFor(payTo);
              const totalPayable = partyInvoices.reduce(
                (sum, inv) => sum + (invoiceSel[inv.invoiceNo]?.checked ? (Number(invoiceSel[inv.invoiceNo]?.amountToPay) || 0) : 0),
                0
              );

              // Amount in Words always mirrors the amount; the amount itself
              // follows the invoice selection whenever any invoice is checked.
              useEffect(() => {
                setValue('amountInWords', amountToWords(amount));
              }, [amount, setValue]);

              useEffect(() => {
                if (totalPayable > 0 && Math.abs(totalPayable - amount) > 0.009) {
                  setValue('amount', Number(totalPayable.toFixed(2)));
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [totalPayable, setValue]);

              const toggleInvoice = (inv) => {
                const balance = inv.balanceAmount != null ? Number(inv.balanceAmount) : Number(inv.invoiceAmount || 0) - Number(inv.paidAmount || 0);
                setInvoiceSel((prev) => {
                  const cur = prev[inv.invoiceNo];
                  return { ...prev, [inv.invoiceNo]: cur?.checked ? { ...cur, checked: false } : { checked: true, amountToPay: cur?.amountToPay || balance } };
                });
              };

              const setInvoiceAmount = (invoiceNo, value) => {
                setInvoiceSel((prev) => ({ ...prev, [invoiceNo]: { ...(prev[invoiceNo] || { checked: true }), amountToPay: value } }));
              };

              const handleFile = (file) => {
                if (file) setValue('attachmentName', file.name, { shouldValidate: true });
              };

              const previewValues = { chequeNo, chequeDate, bankAccount, payTo, amount, amountInWords, narration };

              const chequeDateMaxDate = dayjs().add(1, 'year');

              return (
                <>
                  <Card variant="outlined" sx={{ mb: 2 }}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight={700}>{readOnly ? 'View Cheque' : editingRow ? 'Edit Cheque' : 'New Cheque'} — Cheque Details</Typography>
                        <Button type="button" variant="outlined" color="inherit" startIcon={<CloseIcon />} onClick={closeForm}>
                          Close
                        </Button>
                      </Stack>

                      <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING} singleColumnOnMobile>
                        {/* The document number leads the form, so the field identifying the
                          record is the first thing read on it. */}
                        <LabeledField label="Branch *">
                          <FormSelect name="branch" label="" placeholder="Select branch" options={branchOptions} />
                        </LabeledField>
                        <LabeledField label="Cheque No. *">
                          <DocumentSeriesNoField documentCode="CHQ" seriesFieldName="seriesId" numberFieldName="chequeNo" isCreate={!editingRow} />
                        </LabeledField>
                        <LabeledField label="Bank Account *">
                          <FormSelect name="bankAccount" label="" placeholder="Select bank account" options={bankAccountOptions} />
                        </LabeledField>
                        <LabeledField label="Cheque Date *">
                          <FormDatePicker name="chequeDate" label="" maxDate={chequeDateMaxDate} />
                        </LabeledField>

                        <LabeledField label="Cheque Type *">
                          <FormSelect name="chequeType" label="" options={CHEQUE_TYPE_OPTIONS} />
                        </LabeledField>
                        <LabeledField label="Pay To *">
                          <FormSelect name="payTo" label="" placeholder="Select party" options={payToOptions} />
                        </LabeledField>
                        <LabeledField label="Print Template">
                          <FormSelect name="printTemplate" label="" options={PRINT_TEMPLATE_OPTIONS} />
                        </LabeledField>


                        <LabeledField label="Amount (₹) *">
                          <FormTextField name="amount" label="" type="number" />
                        </LabeledField>
                        <LabeledField label="Narration">
                          <FormTextField name="narration" label="" placeholder="e.g. Payment against Invoice" multiline rows={2} />
                        </LabeledField>
                        <LabeledField label="Attachments (Optional)">
                          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                            <Button component="label" variant="outlined" size="small">
                              Choose File
                              <input type="file" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
                            </Button>
                            {watch('attachmentName') ? (
                              <Chip size="small" label={watch('attachmentName')} onDelete={() => setValue('attachmentName', '')} />
                            ) : (
                              <Typography variant="body2" color="text.secondary">No file chosen</Typography>
                            )}
                          </Stack>
                        </LabeledField>
                      </FormGrid>

                      <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        <Grid item xs={12} md={4}>
                          <FormTextField name="amountInWords" label="Amount in Words" disabled />
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>

                  <Card variant="outlined" sx={{ mb: 2 }}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Outstanding Invoices</Typography>
                      <TableFeatureScope rows={partyInvoices} columns={INVOICE_PICKER_COLUMNS}>
                        {(invTable) => (
                          <>
                            <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                              <TableSearchFilter table={invTable} placeholder="Search invoices..." width={200} />
                            </Stack>
                            <TableFilterPanel table={invTable} />
                            <ScrollableTableContainer maxHeight="min(50vh, 420px)">
                              <Table size="small" stickyHeader>
                                <TableHead>
                                  <TableRow>
                                    <TableCell padding="checkbox" />
                                    <SortableHeaderCell field="invoiceNo" sort={invTable.sort} onSort={invTable.toggleSort}>Invoice No.</SortableHeaderCell>
                                    <SortableHeaderCell field="invoiceDate" sort={invTable.sort} onSort={invTable.toggleSort}>Invoice Date</SortableHeaderCell>
                                    <SortableHeaderCell field="dueDate" sort={invTable.sort} onSort={invTable.toggleSort}>Due Date</SortableHeaderCell>
                                    <SortableHeaderCell field="invoiceAmount" sort={invTable.sort} onSort={invTable.toggleSort} align="right">Total Amount (₹)</SortableHeaderCell>
                                    <SortableHeaderCell field="balanceAmount" sort={invTable.sort} onSort={invTable.toggleSort} align="right">Outstanding (₹)</SortableHeaderCell>
                                    <TableCell sx={{ minWidth: 140 }} align="right">Amount to Pay (₹)</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {invTable.rows.map((inv) => {
                                    const balance = inv.balanceAmount != null ? Number(inv.balanceAmount) : Number(inv.invoiceAmount || 0) - Number(inv.paidAmount || 0);
                                    const sel = invoiceSel[inv.invoiceNo];
                                    return (
                                      <TableRow key={inv.invoiceNo} hover>
                                        <TableCell padding="checkbox">
                                          <Checkbox size="small" checked={!!sel?.checked} onChange={() => toggleInvoice(inv)} />
                                        </TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{inv.invoiceNo}</TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{inv.invoiceDate ? dayjs(inv.invoiceDate).format('DD/MM/YYYY') : '—'}</TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{inv.dueDate ? dayjs(inv.dueDate).format('DD/MM/YYYY') : '—'}</TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(inv.invoiceAmount || 0).toFixed(2)}</TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{balance.toFixed(2)}</TableCell>
                                        <TableCell align="right">
                                          <TextField
                                            size="small"
                                            type="number"
                                            value={sel?.checked ? sel.amountToPay : 0}
                                            onChange={(e) => setInvoiceAmount(inv.invoiceNo, e.target.value === '' ? '' : Number(e.target.value))}
                                            disabled={!sel?.checked}
                                            inputProps={{ min: 0, max: balance, style: { textAlign: 'right' } }}
                                            sx={[noSpinnersSx, { width: 130 }]}
                                          />
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                  {invTable.rows.length === 0 && (
                                    <TableRow>
                                      <TableCell colSpan={7}>
                                        <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                                          {invTable.isFiltering ? 'No invoices match your search' : payTo ? 'No outstanding invoices for this party' : 'Select a party to see outstanding invoices'}
                                        </Typography>
                                      </TableCell>
                                    </TableRow>
                                  )}
                                  {invTable.rows.length > 0 && (
                                    <TableRow>
                                      <TableCell colSpan={5} />
                                      <TableCell align="right" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Total Payable Amount (₹)</TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{totalPayable.toFixed(2)}</TableCell>
                                    </TableRow>
                                  )}
                                </TableBody>
                              </Table>
                            </ScrollableTableContainer>
                          </>
                        )}
                      </TableFeatureScope>
                    </CardContent>
                  </Card>

                  <Card variant="outlined" sx={{ mb: 0 }}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={7}>
                          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Cheque Preview</Typography>
                          <ChequePreview values={previewValues} printOptions={printOptions} />
                        </Grid>
                        <Grid item xs={12} md={5}>
                          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Print Options</Typography>
                          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 2 }}>
                            <Stack>
                              {[
                                ['payeeName', 'Print Payee Name'],
                                ['amountInWords', 'Print Amount in Words'],
                                ['narration', 'Print Narration'],
                                ['companyName', 'Print Company Name & Address'],
                                ['signatory', 'Print Authorised Signatory'],
                              ].map(([key, label]) => (
                                <FormControlLabel
                                  key={key}
                                  control={
                                    <Checkbox
                                      size="small"
                                      checked={printOptions[key]}
                                      onChange={(e) => setPrintOptions((prev) => ({ ...prev, [key]: e.target.checked }))}
                                    />
                                  }
                                  label={<Typography variant="body2">{label}</Typography>}
                                />
                              ))}
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
                        <Button
                          fullWidth={isMobile}
                          type="button"
                          variant="outlined"
                          startIcon={<VisibilityOutlinedIcon />}
                          onClick={() => setPreviewOpen(true)}
                        >
                          Preview
                        </Button>
                        <FormSubmitButton
                          fullWidth={isMobile}
                          startIcon={<PrintOutlinedIcon />}
                          onClick={() => setPendingStatus('Printed')}
                          disabled={creating || updating}
                        >
                          Print Cheque
                        </FormSubmitButton>
                      </Stack>
                    </CardContent>
                  </Card>

                  <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
                    <DialogTitle>Cheque Preview — {chequeNo || 'New Cheque'}</DialogTitle>
                    <DialogContent dividers>
                      <ChequePreview values={previewValues} printOptions={printOptions} />
                    </DialogContent>
                    <DialogActions>
                      <Button onClick={() => setPreviewOpen(false)} color="inherit">Close</Button>
                      <Button variant="contained" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()}>Print</Button>
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
            <Typography variant="subtitle1" fontWeight={700}>Cheque List</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap sx={{ width: { xs: '100%', md: 'auto' } }}>
              <TableSearchFilter table={table} placeholder="Search by cheque no., party, bank..." showFilter={false} />
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
                    New Cheque
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
                  title={row.chequeNo}
                  statusChip={<Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />}
                  fields={[
                    { label: 'Bank Account', value: row.bankAccount || '—' },
                    { label: 'Pay To', value: row.payTo || '—' },
                    { label: 'Cheque Date', value: row.chequeDate ? dayjs(row.chequeDate).format('DD/MM/YYYY') : '—' },
                    { label: 'Amount', value: `₹${Number(row.amount || 0).toFixed(2)}` },
                  ]}
                  onView={() => handleView(row)}
                  onEdit={() => handleEdit(row)}
                  onDelete={() => handleDelete(row)}
                />
              ))}
              {!isLoading && filteredRows.length === 0 && (
                <EmptyState icon={<AccountBalanceOutlinedIcon sx={{ fontSize: 48 }} />} title="No cheques found" message="Add your first cheque to get started" />
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table
                size="small"
                stickyHeader
                sx={{
                  '& th, & td': {
                    height: CHEQUE_PRINT_LIST_TABLE_ROW_HEIGHT,
                    paddingTop: `${CHEQUE_PRINT_LIST_TABLE_CELL_PADDING_Y}px`,
                    paddingBottom: `${CHEQUE_PRINT_LIST_TABLE_CELL_PADDING_Y}px`,
                    boxSizing: 'border-box',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell width={40}>#</TableCell>
                    <SortableHeaderCell field="chequeNo" sort={table.sort} onSort={table.toggleSort}>Cheque No.</SortableHeaderCell>
                    <SortableHeaderCell field="bankAccount" sort={table.sort} onSort={table.toggleSort}>Bank Account</SortableHeaderCell>
                    <SortableHeaderCell field="payTo" sort={table.sort} onSort={table.toggleSort}>Pay To</SortableHeaderCell>
                    <SortableHeaderCell field="chequeDate" sort={table.sort} onSort={table.toggleSort}>Cheque Date</SortableHeaderCell>
                    <SortableHeaderCell field="amount" sort={table.sort} onSort={table.toggleSort} align="right">Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.chequeNo}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.bankAccount || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.payTo || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.chequeDate ? dayjs(row.chequeDate).format('DD/MM/YYYY') : '—'}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(row.amount || 0).toFixed(2)}</TableCell>
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
                      <TableCell colSpan={8}>
                        <EmptyState icon={<AccountBalanceOutlinedIcon sx={{ fontSize: 48 }} />} title="No cheques found" message="Add your first cheque to get started" />
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
