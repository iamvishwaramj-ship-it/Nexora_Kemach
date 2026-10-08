import React, { useEffect, useMemo, useRef, useState } from 'react';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import {
  Box, Typography, Button, Card, CardContent, Stack, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton, Menu, MenuItem, ListItemIcon,
  ListItemText, Autocomplete, Grid, Collapse, Dialog, DialogTitle, DialogContent,
  DialogActions, Checkbox, CircularProgress, Tooltip,
} from '@mui/material';
import { useFieldArray } from 'react-hook-form';
import dayjs from 'dayjs';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import SteamIcon from '../../components/common/SteamIcon';
import WhatsAppShareButton from '../../components/common/WhatsAppShareButton';
import PaymentVoucherPrintable, { printPaymentVoucher, capturePaymentVoucherPdf } from '../../components/print/PaymentVoucherPrintable';
import { useGetCompanyDetailsQuery } from '../../features/company/companyDetailsApi';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
import FormRadioGroup from '../../components/form/FormRadioGroup';
import { FormCheckbox } from '../../components/form/FormCheckbox';
import DocumentSeriesNoField from '../../components/form/DocumentSeriesNoField';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
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
import { round2 } from '../../lib/documentTotals';
import { paymentVoucherSchema } from '../../lib/validation/receivablesPayablesSchemas';
import { } from '../../lib/validation/partnerSchemas';
import { useCurrencyOptions } from '../../lib/currencyOptions';
import {
  paymentVoucherApi, supplierApi, chartOfAccountApi, supplierOutstandingApi, useSendPaymentVoucherWhatsAppMutation,
} from '../../features/resources';
import { useBranchNameOptions } from '../../lib/useBranchOptions';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer, { dragScrollbarSx } from '../../components/data-display/ScrollableTableContainer';
import TableFeatureScope from '../../components/data-display/TableFeatureScope';
import PaymentModesDialog from '../../components/banking/PaymentModesDialog';
import RouteMapButton from '../../components/common/RouteMapButton';
import RouteMapContextMenu from '../../components/common/RouteMapContextMenu';
import JournalEntryViewDialog from '../../components/accounting/JournalEntryViewDialog';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';

const PARTY_TYPE_OPTIONS = [
  { label: 'Vendor', value: 'Vendor' },
  { label: 'Account', value: 'Account' },
];
const PAYMENT_TYPE_OPTIONS = [
  { label: 'Payment', value: 'Payment' },
  { label: 'Refund', value: 'Refund' },
];

// Columns for the "Add Bill" picker dialog. The dialog lives inside a
// render prop, so its table features come from <TableFeatureScope>.
const INVOICE_PICKER_COLUMNS = [
  { field: 'invoiceNo', headerName: 'Invoice/Bill No.', filter: 'text' },
  { field: 'invoiceDate', headerName: 'Date', filter: 'dateRange', sortValue: (r) => (r.invoiceDate ? new Date(r.invoiceDate).getTime() : null), searchValue: (r) => (r.invoiceDate ? dayjs(r.invoiceDate).format('DD/MM/YYYY') : '') },
  { field: 'dueDate', headerName: 'Due Date', filter: 'dateRange', sortValue: (r) => (r.dueDate ? new Date(r.dueDate).getTime() : null), searchValue: (r) => (r.dueDate ? dayjs(r.dueDate).format('DD/MM/YYYY') : '') },
  { field: 'invoiceAmount', headerName: 'Amount (₹)', filter: 'numberRange', sortValue: (r) => Number(r.invoiceAmount) || 0 },
  { field: 'balanceAmount', headerName: 'Outstanding (₹)', filter: 'numberRange', sortValue: (r) => (r.balanceAmount != null ? Number(r.balanceAmount) : Number(r.invoiceAmount || 0) - Number(r.paidAmount || 0)) },
];

const PAGE_SIZE = 10;
const STATUS_FILTERS = ['All Status', 'Draft', 'Posted'];
const STATUS_COLORS = { Draft: 'info', Posted: 'success' };
const PARTY_TYPE_FILTERS = ['All Types', 'Vendor', 'Account'];

function getEmptyValues() {
  const today = new Date();
  return {
    paymentVoucherNo: '', seriesId: '', branch: '', partyType: 'Vendor', partyCode: '', partyName: '',
    billTo: '', contactPerson: '', reference: '', paymentType: 'Payment',
    postingDate: today, dueDate: null, documentDate: today, transactionNo: '',
    currency: 'INR', exchangeRate: '',
    remarks: '', journalRemarks: '',
    paymentOnAccount: false, totalDue: 0, roundOff: 0,
    // Payment Modes breakdown -- see PaymentModesDialog.jsx.
    paymentMode: '', paymentGlAccount: '', bankChargesAccount: '', bankChargesAmount: 0,
    applications: [],
  };
}

function rowToFormValues(row) {
  return {
    paymentVoucherNo: row.paymentVoucherNo, seriesId: '', branch: row.branch || '',
    partyType: row.partyType || 'Vendor', partyCode: row.partyCode || '', partyName: row.partyName || '',
    billTo: row.billTo || '', contactPerson: row.contactPerson || '', reference: row.reference || '',
    paymentType: row.paymentType || 'Payment',
    postingDate: row.postingDate, dueDate: row.dueDate || null, documentDate: row.documentDate,
    transactionNo: row.transactionNo || '',
    currency: row.currency || 'INR',
    // Shown blank for INR (the field is disabled — 1 stored underneath is
    // implied, not displayed); for a foreign currency, show whatever rate
    // was saved.
    exchangeRate: (row.currency || 'INR') === 'INR' ? '' : (row.exchangeRate != null ? Number(row.exchangeRate) : ''),
    remarks: row.remarks || '', journalRemarks: row.journalRemarks || '',
    paymentOnAccount: !!row.paymentOnAccount,
    totalDue: row.totalDue != null ? Number(row.totalDue) : 0,
    roundOff: row.roundOff != null ? Number(row.roundOff) : 0,
    paymentMode: row.paymentMode || '', paymentGlAccount: row.paymentGlAccount || '',
    bankChargesAccount: row.bankChargesAccount || '',
    bankChargesAmount: row.bankChargesAmount != null ? Number(row.bankChargesAmount) : 0,
    applications: (row.applications || []).map((a) => ({
      invoiceNo: a.invoiceNo || '', invoiceDate: a.invoiceDate, dueDate: a.dueDate,
      totalAmount: a.totalAmount != null ? Number(a.totalAmount) : 0,
      outstandingAtTimeOfApplication: a.outstandingAtTimeOfApplication != null ? Number(a.outstandingAtTimeOfApplication) : 0,
      amountApplied: a.amountApplied != null ? Number(a.amountApplied) : 0,
    })),
  };
}

const PAYMENT_VOUCHER_LIST_TABLE_ROW_HEIGHT = 0;
const PAYMENT_VOUCHER_LIST_TABLE_CELL_PADDING_Y = 6;
export default function PaymentVoucher({ openDocNo } = {}) {
  // Every currency dropdown reads live from Currency Master instead of a
  // hardcoded list — see lib/currencyOptions.js.
  const currencyOptions = useCurrencyOptions();
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const itemScrollRef = useDragScroll();
  const { data: vouchers, isLoading } = paymentVoucherApi.useList();
  const { data: suppliers } = supplierApi.useList();
  const { data: chartOfAccounts } = chartOfAccountApi.useList();
  const { data: outstandingSupplierInvoices } = supplierOutstandingApi.useList();
  const [create, { isLoading: creating }] = paymentVoucherApi.useCreate();
  const [update, { isLoading: updating }] = paymentVoucherApi.useUpdate();
  const [remove] = paymentVoucherApi.useDelete();
  const { data: company } = useGetCompanyDetailsQuery();
  const [sendVoucherWhatsAppMutation, { isLoading: sendingVoucherWhatsApp }] = useSendPaymentVoucherWhatsAppMutation();
  // Shared by both the form's own WhatsAppShareButton (already viewing the
  // row being sent) and the list row's own icon (which first switches into
  // viewing that row -- see handleSendRowWhatsApp below -- so that by the
  // time this runs, capturePaymentVoucherPdf() is screenshotting THIS
  // row's printable, not whatever was on screen before).
  const handleSendVoucherWhatsApp = async (row) => {
    try {
      const pdfBlob = await capturePaymentVoucherPdf();
      const formData = new FormData();
      formData.append('file', pdfBlob, `${row.paymentVoucherNo || 'payment-voucher'}.pdf`);
      await sendVoucherWhatsAppMutation({ id: row.id, formData }).unwrap();
      notify.success('Sent via WhatsApp');
    } catch (err) {
      notify.error(err?.data?.message || err?.message || 'Could not send via WhatsApp');
    }
  };

  const supplierCodeOptions = useMemo(
    () => (suppliers || []).filter((s) => s.status !== 'Inactive').map((s) => ({ label: `${s.supplierName} (${s.supplierCode})`, value: s.supplierCode })),
    [suppliers]
  );
  // Only real posting accounts (AccountNature 'A') make sense as a voucher
  // party — a Title account is a heading, never something money is posted
  // against.
  const accountCodeOptions = useMemo(
    () => (chartOfAccounts || []).filter((a) => a.accountNature === 'A' && a.status !== 'I').map((a) => ({ label: `${a.accountName} (${a.accountCode})`, value: a.accountCode })),
    [chartOfAccounts]
  );

  // Form is hidden by default -- it expands in a Collapse ABOVE the list
  // (which stays visible) when "New Payment Voucher" or an edit action is
  // triggered, matching the other Banking pages (Deposit Entry, Payment
  // Receipt).
  const [showForm, setShowForm] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const { options: branchOptions } = useBranchNameOptions({ currentValue: editingRow?.branch });
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  // Journal Entry view popup — opened from the header's "View Journal Entry"
  // icon (rendered only once editingRow.journalEntryId exists, i.e. this
  // voucher already has a linked entry). Same pattern as Purchase GRN.
  const [journalViewOpen, setJournalViewOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [partyTypeFilter, setPartyTypeFilter] = useState('All Types');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [rowMenuAnchor, setRowMenuAnchor] = useState(null);
  const [rowMenuTarget, setRowMenuTarget] = useState(null);
  const [pendingStatus, setPendingStatus] = useState('Draft');

  const rows = vouchers || [];

  const baseTableRows = useMemo(() => {
    return rows.filter((r) => {
      const matchesStatus = statusFilter === 'All Status' || r.status === statusFilter;
      const matchesPartyType = partyTypeFilter === 'All Types' || r.partyType === partyTypeFilter;
      return matchesStatus && matchesPartyType;
    });
  }, [rows, statusFilter, partyTypeFilter]);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'paymentVoucherNo', headerName: 'Payment Voucher No.', filter: 'text' },
    { field: 'partyType', headerName: 'Type', filter: 'select' },
    { field: 'partyName', headerName: 'Vendor/Account', filter: 'text' },
    { field: 'postingDate', headerName: 'Posting Date', filter: 'dateRange', sortValue: (row) => (row.postingDate ? new Date(row.postingDate).getTime() : null) },
    { field: 'totalDue', headerName: 'Total Due (₹)', filter: 'numberRange', sortValue: (row) => (row.totalDue == null || row.totalDue === '' ? null : Number(row.totalDue)) },
    { field: 'appliedAmount', headerName: 'Applied Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.appliedAmount == null || row.appliedAmount === '' ? null : Number(row.appliedAmount)) },
    { field: 'openBalance', headerName: 'Open Balance (₹)', filter: 'numberRange', sortValue: (row) => (row.openBalance == null || row.openBalance === '' ? null : Number(row.openBalance)) },
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

  // Opened from the Route Map's document preview popup: jump straight into
  // this record's own read-only View, exactly as clicking it in the list
  // would, instead of requiring the user to find and click the row.
  useEffect(() => {
    if (!openDocNo) return;
    if (editingRow && editingRow.paymentVoucherNo === openDocNo) return;
    const match = rows.find((r) => r.paymentVoucherNo === openDocNo);
    if (match) handleView(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDocNo, rows]);

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
      title: 'Delete payment voucher',
      message: `Are you sure you want to delete "${row.paymentVoucherNo}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Payment voucher deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const [printRequestVoucherNo, setPrintRequestVoucherNo] = useState(null);

  const handlePrint = (row) => {
    setRowMenuAnchor(null);
    handleView(row);
    setPrintRequestVoucherNo(row.paymentVoucherNo);
  };

  useEffect(() => {
    if (!printRequestVoucherNo) return;
    if (!editingRow || editingRow.paymentVoucherNo !== printRequestVoucherNo) return;
    setPrintRequestVoucherNo(null);
    // Printing from the LIST should leave the user back on the list once
    // the print dialog is dismissed, not sitting in front of a record it
    // only opened in order to print -- 'afterprint' fires either way
    // (printed or cancelled). The form's own Print button (added below)
    // calls printPaymentVoucher() directly, not through this effect, so
    // it's deliberately unaffected -- staying open there is correct.
    const returnToListAfterPrint = () => {
      window.removeEventListener('afterprint', returnToListAfterPrint);
      closeForm();
    };
    window.addEventListener('afterprint', returnToListAfterPrint);
    printPaymentVoucher();
  }, [printRequestVoucherNo, editingRow]);

  const [whatsappRequestVoucherNo, setWhatsappRequestVoucherNo] = useState(null);

  const handleSendRowWhatsApp = (row) => {
    setRowMenuAnchor(null);
    handleView(row);
    setWhatsappRequestVoucherNo(row.paymentVoucherNo);
  };

  useEffect(() => {
    if (!whatsappRequestVoucherNo) return;
    if (!editingRow || editingRow.paymentVoucherNo !== whatsappRequestVoucherNo) return;
    setWhatsappRequestVoucherNo(null);
    handleSendVoucherWhatsApp(editingRow).then(() => closeForm());
  }, [whatsappRequestVoucherNo, editingRow]);

  const handleSubmit = async (values, formMethods) => {
    // Exchange Rate is shown blank/disabled for INR (see getEmptyValues/
    // rowToFormValues/the currency-watch effect above) — 1 is what actually
    // gets saved, since INR against itself is always 1:1.
    const exchangeRate = values.currency === 'INR' ? 1 : Number(values.exchangeRate);
    const payload = { ...values, exchangeRate, status: pendingStatus };
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Payment voucher updated');
      } else {
        await create(payload).unwrap();
        notify.success('Payment voucher saved');
      }
      closeForm();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  if (openDocNo && (!editingRow || editingRow.paymentVoucherNo !== openDocNo)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box>
      <EntityHeaderCard
        icon={<PaymentsOutlinedIcon />}
        title="Payment Voucher (Outgoing Payment)"
        subtitle={showForm ? 'Record an outgoing payment against a vendor or account.' : 'Manage and track all outgoing payments.'}
        rightContent={<CompanyBadge />}
      />

      <Collapse in={showForm} unmountOnExit>
        <Box sx={{ mb: 2 }}>
          <RouteMapContextMenu flow="purchase" type="payment" docNo={editingRow?.paymentVoucherNo}>
            <AppForm readOnly={readOnly}
              key={formKey}
              schema={paymentVoucherSchema}
              defaultValues={editingRow ? rowToFormValues(editingRow) : getEmptyValues()}
              onSubmit={handleSubmit}
            >
              {(methods) => {
                const { control, watch, setValue, formState: { errors } } = methods;
                const { fields, append, remove: removeApplication, replace } = useFieldArray({ control, name: 'applications' });

                const partyType = watch('partyType');
                const partyCode = watch('partyCode');
                const partyName = watch('partyName');
                const paymentOnAccount = watch('paymentOnAccount');
                const watchedApplications = watch('applications') || [];
                const totalDue = Number(watch('totalDue')) || 0;
                const roundOff = Number(watch('roundOff')) || 0;

                // An Account party has no outstanding bills to settle against,
                // and Payment on Account explicitly means "don't apply this to
                // anything" — the applied-bills table only makes sense outside
                // those two cases.
                const tableApplicable = partyType !== 'Account' && !paymentOnAccount;
                const totalApplied = round2(watchedApplications.reduce((sum, a) => sum + (Number(a.amountApplied) || 0), 0));
                const appliedAmount = tableApplicable ? totalApplied : round2(totalDue - roundOff);
                const openBalance = round2(totalDue - appliedAmount - roundOff);

                const applicationsError = errors.applications?.message || errors.applications?.root?.message;
                const currencyValue = watch('currency');
                // INR against itself is always 1:1, so Exchange Rate is
                // disabled and not required whenever Currency is INR — for
                // any other currency it's enabled and mandatory (enforced in
                // paymentVoucherSchema's superRefine).
                const isInrCurrency = currencyValue === 'INR';
                const [paymentModesOpen, setPaymentModesOpen] = useState(false);
                const paymentMode = watch('paymentMode');
                const paymentGlAccount = watch('paymentGlAccount');
                const bankChargesAccount = watch('bankChargesAccount');
                const bankChargesAmount = watch('bankChargesAmount');
                // Hands the chosen tab's G/L account (and any bank charges) back
                // to the form -- glPosting.js credits this specific account
                // instead of the fixed cashOnHand determination account. See
                // utils/glPosting.js#resolvePaymentModeCashAccount.
                const handlePaymentModesApply = (data) => {
                  const glAccount = data.mode === 'Cash' ? data.cash?.glAccount
                    : data.mode === 'Cheque' ? data.cheque?.glAccount
                      : data.bankTransfer?.glAccount;
                  setValue('paymentMode', data.mode || '', { shouldDirty: true });
                  setValue('paymentGlAccount', glAccount || '', { shouldDirty: true });
                  setValue('bankChargesAccount', data.bankChargesAccount || '', { shouldDirty: true });
                  setValue('bankChargesAmount', Number(data.bankChargesAmount) || 0, { shouldDirty: true });
                };

                // Switching Vendor/Account clears whatever party and
                // applied-bill selections belonged to the previous type — an
                // Account has no meaning once the radio moves to Vendor, and an
                // invoice applied under the old party would silently settle the
                // wrong ledger otherwise. Skipped on the very first render
                // (mount) so loading an existing record for edit/view doesn't
                // wipe the values it just loaded.
                const prevPartyTypeRef = useRef(partyType);
                useEffect(() => {
                  if (prevPartyTypeRef.current === partyType) return;
                  prevPartyTypeRef.current = partyType;
                  setValue('partyCode', '');
                  setValue('partyName', '');
                  setValue('billTo', '');
                  setValue('contactPerson', '');
                  replace([]);
                  // eslint-disable-next-line react-hooks/exhaustive-deps
                }, [partyType]);

                // Checking Payment on Account mid-edit drops whatever bills
                // were staged — the two are mutually exclusive.
                const prevPayOnAccountRef = useRef(paymentOnAccount);
                useEffect(() => {
                  if (prevPayOnAccountRef.current === paymentOnAccount) return;
                  prevPayOnAccountRef.current = paymentOnAccount;
                  if (paymentOnAccount) replace([]);
                  // eslint-disable-next-line react-hooks/exhaustive-deps
                }, [paymentOnAccount]);

                // Switching Currency to INR blanks and disables Exchange
                // Rate (INR's 1:1 rate is implied, not shown/required — the
                // actual 1 is filled in on submit, see handleSubmit).
                // Switching away from INR clears it too, so the now-
                // mandatory field can't be submitted with a stale leftover
                // value — moving between two non-INR currencies leaves
                // whatever rate is already entered untouched. Skipped on
                // mount so loading an existing record for edit/view doesn't
                // overwrite its saved rate.
                const prevCurrencyRef = useRef(currencyValue);
                useEffect(() => {
                  const prevCurrency = prevCurrencyRef.current;
                  if (prevCurrency === currencyValue) return;
                  prevCurrencyRef.current = currencyValue;
                  if (currencyValue === 'INR' || prevCurrency === 'INR') {
                    setValue('exchangeRate', '', { shouldValidate: true, shouldDirty: true });
                  }
                  // eslint-disable-next-line react-hooks/exhaustive-deps
                }, [currencyValue]);

                // Picking a Vendor/Account code auto-fills Name (and Bill To /
                // Contact Person where the master carries them) — mirrors
                // Contact Person auto-fill elsewhere in the app
                // (PurchaseOrder.jsx).
                useEffect(() => {
                  if (!partyCode) return;
                  if (partyType === 'Vendor') {
                    const s = (suppliers || []).find((x) => x.supplierCode === partyCode);
                    if (s) {
                      setValue('partyName', s.supplierName, { shouldValidate: true });
                      setValue('billTo', s.billingAddress || '');
                      setValue('contactPerson', s.contactPerson || '');
                    }
                  } else if (partyType === 'Account') {
                    const a = (chartOfAccounts || []).find((x) => x.accountCode === partyCode);
                    if (a) setValue('partyName', a.accountName, { shouldValidate: true });
                  }
                  // eslint-disable-next-line react-hooks/exhaustive-deps
                }, [partyCode, partyType]);

                const partyCodeOptions = partyType === 'Vendor' ? supplierCodeOptions : accountCodeOptions;
                const partyCodeLabel = partyType === 'Account' ? 'Account Code' : 'Vendor Code';

                const outstandingSource = partyType === 'Vendor' ? outstandingSupplierInvoices : [];

                const [pickerOpen, setPickerOpen] = useState(false);
                const [pickedIds, setPickedIds] = useState([]);

                const alreadyAddedInvoiceNos = watchedApplications.map((a) => a.invoiceNo);
                const pickerRows = (outstandingSource || []).filter((inv) => {
                  const balance = inv.balanceAmount != null ? Number(inv.balanceAmount) : Number(inv.invoiceAmount || 0) - Number(inv.paidAmount || 0);
                  return inv.supplierName === partyName
                    && inv.status !== 'Paid'
                    && balance > 0
                    && !alreadyAddedInvoiceNos.includes(inv.invoiceNo);
                });

                const openPicker = () => {
                  if (!partyName) {
                    notify.error('Select a Vendor first');
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
                    <PaymentVoucherPrintable row={editingRow} company={company} />
                    <Card variant="outlined" sx={{ mb: 2 }}>
                      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                          <Typography variant="subtitle1" fontWeight={700}>{readOnly ? 'View Payment Voucher' : editingRow ? 'Edit Payment Voucher' : 'New Payment Voucher'}</Typography>
                          <Button type="button" variant="outlined" color="inherit" startIcon={<CloseIcon />} onClick={closeForm}>
                            Close
                          </Button>
                        </Stack>

                        <FormRadioGroup name="partyType" label="Vendor / Account *" options={PARTY_TYPE_OPTIONS} />

                        <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING} singleColumnOnMobile>
                          <LabeledField label={partyCodeLabel}>
                            <FormSelect name="partyCode" label="" placeholder="Search…" options={partyCodeOptions} />
                          </LabeledField>
                          <LabeledField label="Name *">
                            <FormTextField name="partyName" label="" disabled />
                          </LabeledField>
                          {/* <LabeledField label="Bill To">
                        <FormTextField name="billTo" label="" />
                      </LabeledField> */}
                          <LabeledField label="Contact Person">
                            <FormTextField name="contactPerson" label="" />
                          </LabeledField>
                          <LabeledField label="Reference">
                            <FormTextField name="reference" label="" placeholder="Optional" />
                          </LabeledField>
                          <LabeledField label="Branch *">
                            <FormSelect name="branch" label="" placeholder="Select branch" options={branchOptions} />
                          </LabeledField>
                        </FormGrid>
                      </CardContent>
                    </Card>

                    <Card variant="outlined" sx={{ mb: 2 }}>
                      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Payment Details</Typography>
                        <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING} singleColumnOnMobile>
                          <LabeledField label="Payment Type *">
                            <FormSelect name="paymentType" label="" options={PAYMENT_TYPE_OPTIONS} />
                          </LabeledField>
                          <LabeledField label="Outgoing Payment No *">
                            <DocumentSeriesNoField documentCode="OP" seriesFieldName="seriesId" numberFieldName="paymentVoucherNo" isCreate={!editingRow} />
                          </LabeledField>
                          <LabeledField label="Posting Date *">
                            <FormDatePicker name="postingDate" label="" />
                          </LabeledField>
                          <LabeledField label="Due Date">
                            <FormDatePicker name="dueDate" label="" />
                          </LabeledField>
                          <LabeledField label="Document Date *">
                            <FormDatePicker name="documentDate" label="" />
                          </LabeledField>
                          <LabeledField label="Transaction No.">
                            <FormTextField name="transactionNo" label="" placeholder="Optional" />
                          </LabeledField>
                          <LabeledField label="Currency *">
                            <FormSelect name="currency" label="" options={currencyOptions} />
                          </LabeledField>
                          <LabeledField label={isInrCurrency ? 'Exchange Rate' : 'Exchange Rate *'}>
                            <FormTextField name="exchangeRate" label="" type="number" disabled={isInrCurrency} />
                          </LabeledField>
                        </FormGrid>

                        {editingRow?.journalEntryNo && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5 }}>
                            <Typography variant="caption" color="text.secondary">Journal Entry:</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{editingRow.journalEntryNo}</Typography>
                            <Tooltip title="View Journal Entry">
                              <IconButton
                                size="small"
                                type="button"
                                onClick={() => setJournalViewOpen(true)}
                              >
                                <VisibilityOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )}
                      </CardContent>
                    </Card>

                    <Card variant="outlined" sx={{ mb: 2 }}>
                      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                          <Typography variant="subtitle1" fontWeight={700}>Applied Invoices / Bills</Typography>
                          {tableApplicable && (
                            <Button type="button" variant="outlined" size="small" startIcon={<AddIcon />} onClick={openPicker}>
                              Add Bill
                            </Button>
                          )}
                        </Stack>

                        {!tableApplicable ? (
                          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                            {partyType === 'Account'
                              ? 'Not applicable for an Account entry — there are no outstanding bills to apply this payment against.'
                              : 'Not applicable while Payment on Account is checked — this payment is recorded without settling any bill.'}
                          </Typography>
                        ) : (
                          <>
                            {applicationsError && (
                              <Typography variant="caption" color="error" display="block" sx={{ mb: 1.5 }}>
                                {applicationsError}
                              </Typography>
                            )}

                            {isMobile ? (
                              <Box>
                                {fields.map((field, index) => (
                                  <MobileItemCard
                                    key={field.id}
                                    index={index}
                                    amount={Number(watch(`applications.${index}.amountApplied`) || 0).toFixed(2)}
                                    onRemove={() => removeApplication(index)}
                                  >
                                    <FormTextField name={`applications.${index}.invoiceNo`} label="Invoice/Bill No." disabled />
                                    <FormTextField name={`applications.${index}.totalAmount`} label="Total Amount (₹)" disabled />
                                    <FormTextField name={`applications.${index}.outstandingAtTimeOfApplication`} label="Outstanding (₹)" disabled />
                                    <FormTextField name={`applications.${index}.amountApplied`} label="Amount to Apply (₹) *" type="number" />
                                  </MobileItemCard>
                                ))}
                                {fields.length === 0 && (
                                  <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>No invoices/bills applied yet</Typography>
                                )}
                              </Box>
                            ) : (
                              <TableContainer ref={itemScrollRef} sx={{ overflow: 'auto', maxHeight: 420, cursor: 'grab', ...dragScrollbarSx }}>
                                <Table size="small" stickyHeader>
                                  <TableHead>
                                    <TableRow>
                                      <TableCell width={40}>#</TableCell>
                                      <TableCell>Invoice/Bill No.</TableCell>
                                      <TableCell>Date</TableCell>
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
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{watch(`applications.${index}.invoiceNo`)}</TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                          {watch(`applications.${index}.invoiceDate`) ? dayjs(watch(`applications.${index}.invoiceDate`)).format('DD/MM/YYYY') : '—'}
                                        </TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                          {watch(`applications.${index}.dueDate`) ? dayjs(watch(`applications.${index}.dueDate`)).format('DD/MM/YYYY') : '—'}
                                        </TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(watch(`applications.${index}.totalAmount`) || 0).toFixed(2)}</TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{Number(watch(`applications.${index}.outstandingAtTimeOfApplication`) || 0).toFixed(2)}</TableCell>
                                        <TableCell align="right">
                                          <FormTextField inputProps={{ style: { textAlign: 'right' } }} name={`applications.${index}.amountApplied`} label="" type="number" />
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
                                          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>No invoices/bills applied yet</Typography>
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
                          </>
                        )}
                      </CardContent>
                    </Card>

                    <Card variant="outlined">
                      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                        <Grid container spacing={3}>
                          <Grid item xs={12} md={6}>
                            <Stack spacing={2}>
                              <Box>
                                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Remarks</Typography>
                                <FormTextField name="remarks" label="" placeholder="Enter any additional remarks (optional)" multiline rows={2} />
                              </Box>
                              <Box>
                                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Journal Remarks</Typography>
                                <FormTextField name="journalRemarks" label="" placeholder="Enter journal remarks (optional)" multiline rows={2} />
                              </Box>
                              <FormCheckbox name="paymentOnAccount" label="Payment on Account" />
                            </Stack>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <Stack spacing={2}>
                              <FormGrid columns={1}>
                                <FormTextField name="totalDue" label="Total Due (₹) *" type="number" />
                                <FormTextField name="roundOff" label="Round Off (₹)" type="number" allowNegative />
                              </FormGrid>
                              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 2.5 }}>
                                <Stack spacing={1}>
                                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Typography variant="body2" color="text.secondary">Applied Amount</Typography>
                                    <Stack direction="row" spacing={0.5} alignItems="center">
                                      <IconButton
                                        size="small"
                                        color="primary"
                                        disabled={!(totalDue > 0)}
                                        onClick={() => setPaymentModesOpen(true)}
                                        aria-label="Apply payment amount"
                                        sx={{ p: 0.25 }}
                                      >
                                        <Box
                                          sx={{
                                            width: 28, height: 28, borderRadius: '50%',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            bgcolor: totalDue > 0 ? 'primary.main' : 'action.disabledBackground',
                                          }}
                                        >
                                          <SteamIcon sx={{ fontSize: 18, color: '#fff' }} />
                                        </Box>
                                      </IconButton>
                                      <Typography variant="body1" fontWeight={700}>₹{appliedAmount.toFixed(2)}</Typography>
                                    </Stack>
                                  </Stack>
                                  <Stack direction="row" justifyContent="space-between">
                                    <Typography variant="body2" color="text.secondary">Open Balance</Typography>
                                    <Typography variant="body1" fontWeight={700}>₹{openBalance.toFixed(2)}</Typography>
                                  </Stack>
                                </Stack>
                              </Box>
                            </Stack>
                          </Grid>
                        </Grid>

                        <PaymentModesDialog
                          open={paymentModesOpen}
                          onClose={() => setPaymentModesOpen(false)}
                          appliedAmount={appliedAmount}
                          defaultCurrency={currencyValue || 'INR'}
                          onApply={handlePaymentModesApply}
                          initial={paymentMode ? {
                            mode: paymentMode, glAccount: paymentGlAccount,
                            bankChargesAccount, bankChargesAmount,
                          } : null}
                        />

                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={1.5}
                          justifyContent={{ xs: 'stretch', sm: 'flex-end' }}
                          sx={{ mt: 3 }}
                        >
                          <Button fullWidth={isMobile} type="button" variant="outlined" color={readOnly ? 'error' : 'inherit'} startIcon={<CloseIcon />} onClick={closeForm} disabled={creating || updating}>
                            {readOnly ? 'Close' : 'Cancel'}
                          </Button>
                          <Button fullWidth={isMobile} type="button" variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => printPaymentVoucher()} disabled={!editingRow?.id}>
                            Print
                          </Button>
                          <WhatsAppShareButton
                            fullWidth={isMobile}
                            phone={(suppliers || []).find((sup) => sup.supplierName === editingRow?.partyName)?.phone}
                            customerName={editingRow?.partyName}
                            docLabel="Payment Voucher"
                            docNo={editingRow?.paymentVoucherNo}
                            onClick={() => handleSendVoucherWhatsApp(editingRow)}
                            sending={sendingVoucherWhatsApp}
                            disabled={creating || updating || !editingRow?.id}
                          />
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
                            Save & Post Voucher
                          </FormSubmitButton>
                        </Stack>
                      </CardContent>
                    </Card>

                    <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} maxWidth="md" fullWidth>
                      <DialogTitle>Add Bill — Outstanding for {partyName || 'vendor'}</DialogTitle>
                      <DialogContent dividers>
                        <TableFeatureScope rows={pickerRows} columns={INVOICE_PICKER_COLUMNS}>
                          {(invTable) => (
                            <>
                              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                                <TableSearchFilter table={invTable} placeholder="Search…" width={200} />
                              </Stack>
                              <TableFilterPanel table={invTable} />
                              <ScrollableTableContainer maxHeight="min(55vh, 400px)">
                                <Table size="small" stickyHeader>
                                  <TableHead>
                                    <TableRow>
                                      <TableCell padding="checkbox" />
                                      <SortableHeaderCell field="invoiceNo" sort={invTable.sort} onSort={invTable.toggleSort}>Invoice/Bill No.</SortableHeaderCell>
                                      <SortableHeaderCell field="invoiceDate" sort={invTable.sort} onSort={invTable.toggleSort}>Date</SortableHeaderCell>
                                      <SortableHeaderCell field="dueDate" sort={invTable.sort} onSort={invTable.toggleSort}>Due Date</SortableHeaderCell>
                                      <SortableHeaderCell align="right" field="invoiceAmount" sort={invTable.sort} onSort={invTable.toggleSort}>Amount (₹)</SortableHeaderCell>
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
                                          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>{invTable.isFiltering ? 'No results match your search' : 'No outstanding bills for this vendor'}</Typography>
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

                    <JournalEntryViewDialog
                      open={journalViewOpen}
                      journalEntryId={editingRow?.journalEntryId}
                      onClose={() => setJournalViewOpen(false)}
                    />
                  </>
                );
              }}
            </AppForm>
          </RouteMapContextMenu>
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
            <Typography variant="subtitle1" fontWeight={700}>Payment Voucher List</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap sx={{ width: { xs: '100%', md: 'auto' } }}>
              <TableSearchFilter table={table} placeholder="Search by voucher no., party..." showFilter={false} />
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
                    New Payment Voucher
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
                <Autocomplete
                  size="small"
                  options={PARTY_TYPE_FILTERS}
                  value={partyTypeFilter}
                  onChange={(_e, v) => { setPartyTypeFilter(v || 'All Types'); setPage(0); }}
                  disableClearable
                  renderInput={(params) => <TextField {...params} label="Type" InputLabelProps={{ shrink: true }} />}
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
                  title={row.paymentVoucherNo}
                  statusChip={<Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />}
                  fields={[
                    { label: 'Type', value: row.partyType || '—' },
                    { label: 'Vendor/Account', value: row.partyName || '—' },
                    { label: 'Posting Date', value: row.postingDate ? dayjs(row.postingDate).format('DD/MM/YYYY') : '—' },
                    { label: 'Total Due', value: `₹${Number(row.totalDue).toFixed(2)}` },
                    { label: 'Applied Amount', value: `₹${Number(row.appliedAmount).toFixed(2)}` },
                    { label: 'Open Balance', value: `₹${Number(row.openBalance).toFixed(2)}` },
                  ]}
                  onView={() => handleView(row)}
                  onEdit={() => handleEdit(row)}
                  onDelete={() => handleDelete(row)}
                />
              ))}
              {!isLoading && filteredRows.length === 0 && (
                <EmptyState icon={<AccountBalanceOutlinedIcon sx={{ fontSize: 48 }} />} title="No payment vouchers found" message="Add your first payment voucher to get started" />
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table
                size="small"
                stickyHeader
                sx={{
                  '& th, & td': {
                    height: PAYMENT_VOUCHER_LIST_TABLE_ROW_HEIGHT,
                    paddingTop: `${PAYMENT_VOUCHER_LIST_TABLE_CELL_PADDING_Y}px`,
                    paddingBottom: `${PAYMENT_VOUCHER_LIST_TABLE_CELL_PADDING_Y}px`,
                    boxSizing: 'border-box',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell width={40}>#</TableCell>
                    <SortableHeaderCell field="paymentVoucherNo" sort={table.sort} onSort={table.toggleSort}>Payment Voucher No.</SortableHeaderCell>
                    <SortableHeaderCell field="partyType" sort={table.sort} onSort={table.toggleSort}>Type</SortableHeaderCell>
                    <SortableHeaderCell field="partyName" sort={table.sort} onSort={table.toggleSort}>Vendor/Account</SortableHeaderCell>
                    <SortableHeaderCell field="postingDate" sort={table.sort} onSort={table.toggleSort}>Posting Date</SortableHeaderCell>
                    <SortableHeaderCell field="totalDue" sort={table.sort} onSort={table.toggleSort}>Total Due (₹)</SortableHeaderCell>
                    <SortableHeaderCell align="right" field="appliedAmount" sort={table.sort} onSort={table.toggleSort}>Applied Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="openBalance" sort={table.sort} onSort={table.toggleSort}>Open Balance (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.paymentVoucherNo}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.partyType || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.partyName || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.postingDate ? dayjs(row.postingDate).format('DD/MM/YYYY') : '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{Number(row.totalDue).toFixed(2)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(row.appliedAmount).toFixed(2)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{Number(row.openBalance).toFixed(2)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => handleView(row)} aria-label="view">
                          <VisibilityOutlinedIcon fontSize="small" />
                        </IconButton>
                        <Tooltip title="Print">
                          <IconButton size="small" onClick={() => handlePrint(row)} aria-label="print">
                            <PrintOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {/* Row-level equivalent of the form's own
                          WhatsAppShareButton -- looked up by party name
                          since the list row itself only carries the
                          party's name/payment no., not their phone. An
                          Account party has no phone at all and the button
                          stays disabled for it (see hasUsableNumber in
                          WhatsAppShareButton.jsx). */}
                        <WhatsAppShareButton
                          iconOnly
                          phone={(suppliers || []).find((sup) => sup.supplierName === row.partyName)?.phone}
                          customerName={row.partyName}
                          docLabel="Payment Voucher"
                          docNo={row.paymentVoucherNo}
                          onClick={() => handleSendRowWhatsApp(row)}
                          sending={sendingVoucherWhatsApp && whatsappRequestVoucherNo === row.paymentVoucherNo}
                        />
                        <RouteMapButton flow="purchase" type="payment" docNo={row.paymentVoucherNo} />
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
                      <TableCell colSpan={10}>
                        <EmptyState icon={<AccountBalanceOutlinedIcon sx={{ fontSize: 48 }} />} title="No payment vouchers found" message="Add your first payment voucher to get started" />
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
