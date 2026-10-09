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
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
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
import PaymentReceiptPrintable, { printPaymentReceipt, capturePaymentReceiptPdf } from '../../components/print/PaymentReceiptPrintable';
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
import { paymentReceiptSchema } from '../../lib/validation/receivablesPayablesSchemas';
import { useCurrencyOptions } from '../../lib/currencyOptions';
import {
  paymentReceiptApi, customerApi, supplierApi, chartOfAccountApi,
  customerOutstandingApi, supplierOutstandingApi, useSendPaymentReceiptWhatsAppMutation,
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
  { label: 'Customer', value: 'Customer' },
  { label: 'Vendor', value: 'Vendor' },
  { label: 'Account', value: 'Account' },
];

// Columns for the "Add Invoice/Bill" picker dialog. The dialog lives inside a
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
const PARTY_TYPE_FILTERS = ['All Types', 'Customer', 'Vendor', 'Account'];

function getEmptyValues() {
  const today = new Date();
  return {
    paymentReceiptNo: '', seriesId: '', branch: '', partyType: 'Customer', partyCode: '', partyName: '',
    billTo: '', contactPerson: '', postingDate: today, dueDate: null, documentDate: today,
    reference: '', transactionNo: '', currency: 'INR', exchangeRate: '',
    remarks: '', journalRemarks: '',
    paymentOnAccount: false, roundOff: 0, totalAmountDue: 0,
    // Payment Modes breakdown -- see PaymentModesDialog.jsx.
    paymentMode: '', paymentGlAccount: '', bankChargesAccount: '', bankChargesAmount: 0,
    applications: [],
  };
}

function rowToFormValues(row) {
  return {
    paymentReceiptNo: row.paymentReceiptNo, seriesId: '', branch: row.branch || '',
    partyType: row.partyType || 'Customer', partyCode: row.partyCode || '', partyName: row.partyName || '',
    billTo: row.billTo || '', contactPerson: row.contactPerson || '',
    postingDate: row.postingDate, dueDate: row.dueDate || null, documentDate: row.documentDate,
    reference: row.reference || '', transactionNo: row.transactionNo || '',
    currency: row.currency || 'INR',
    // Shown blank for INR (the field is disabled — 1 stored underneath is
    // implied, not displayed); for a foreign currency, show whatever rate
    // was saved. Mirrors PaymentVoucher's rowToFormValues.
    exchangeRate: (row.currency || 'INR') === 'INR' ? '' : (row.exchangeRate != null ? Number(row.exchangeRate) : ''),
    remarks: row.remarks || '', journalRemarks: row.journalRemarks || '',
    paymentOnAccount: !!row.paymentOnAccount,
    roundOff: row.roundOff != null ? Number(row.roundOff) : 0,
    totalAmountDue: row.totalAmountDue != null ? Number(row.totalAmountDue) : 0,
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

const PAYMENT_RECEIPT_LIST_TABLE_ROW_HEIGHT = 0;
const PAYMENT_RECEIPT_LIST_TABLE_CELL_PADDING_Y = 6;
export default function PaymentReceipt({ openDocNo } = {}) {
  // Every currency dropdown reads live from Currency Master instead of a
  // hardcoded list — see lib/currencyOptions.js.
  const currencyOptions = useCurrencyOptions();
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const itemScrollRef = useDragScroll();
  const { data: receipts, isLoading } = paymentReceiptApi.useList();
  const { data: customers } = customerApi.useList();
  const { data: suppliers } = supplierApi.useList();
  const { data: chartOfAccounts } = chartOfAccountApi.useList();
  const { data: outstandingCustomerInvoices } = customerOutstandingApi.useList();
  const { data: outstandingSupplierInvoices } = supplierOutstandingApi.useList();
  const [create, { isLoading: creating }] = paymentReceiptApi.useCreate();
  const [update, { isLoading: updating }] = paymentReceiptApi.useUpdate();
  const [remove] = paymentReceiptApi.useDelete();
  const { data: company } = useGetCompanyDetailsQuery();
  const [sendReceiptWhatsAppMutation, { isLoading: sendingReceiptWhatsApp }] = useSendPaymentReceiptWhatsAppMutation();
  // Shared by both the form's own WhatsAppShareButton (already viewing the
  // row being sent) and the list row's own icon (which first switches into
  // viewing that row -- see handleSendRowWhatsApp below -- so that by the
  // time this runs, capturePaymentReceiptPdf() is screenshotting THIS
  // row's printable, not whatever was on screen before).
  const handleSendReceiptWhatsApp = async (row) => {
    try {
      const pdfBlob = await capturePaymentReceiptPdf();
      const formData = new FormData();
      formData.append('file', pdfBlob, `${row.paymentReceiptNo || 'payment-receipt'}.pdf`);
      await sendReceiptWhatsAppMutation({ id: row.id, formData }).unwrap();
      notify.success('Sent via WhatsApp');
    } catch (err) {
      notify.error(err?.data?.message || err?.message || 'Could not send via WhatsApp');
    }
  };

  const customerCodeOptions = useMemo(
    () => (customers || []).filter((c) => c.status !== 'Inactive').map((c) => ({ label: `${c.customerName} (${c.customerCode})`, value: c.customerCode })),
    [customers]
  );
  const supplierCodeOptions = useMemo(
    () => (suppliers || []).filter((s) => s.status !== 'Inactive').map((s) => ({ label: `${s.supplierName} (${s.supplierCode})`, value: s.supplierCode })),
    [suppliers]
  );
  // Only real posting accounts (AccountNature 'A') make sense as a receipt
  // party — a Title account is a heading, never something money is posted
  // against.
  const accountCodeOptions = useMemo(
    () => (chartOfAccounts || []).filter((a) => a.accountNature === 'A' && a.status !== 'I').map((a) => ({ label: `${a.accountName} (${a.accountCode})`, value: a.accountCode })),
    [chartOfAccounts]
  );

  // Form is hidden by default -- it expands in a Collapse ABOVE the list
  // (which stays visible) when "New Payment Receipt" or an edit action is
  // triggered, matching the other Banking pages (Deposit Entry).
  const [showForm, setShowForm] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const { options: branchOptions } = useBranchNameOptions({ currentValue: editingRow?.branch });
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  // Journal Entry view popup — opened from the header's "View Journal Entry"
  // icon (rendered only once editingRow.journalEntryId exists, i.e. this
  // receipt already has a linked entry). Same pattern as Purchase GRN.
  const [journalViewOpen, setJournalViewOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [partyTypeFilter, setPartyTypeFilter] = useState('All Types');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [rowMenuAnchor, setRowMenuAnchor] = useState(null);
  const [rowMenuTarget, setRowMenuTarget] = useState(null);
  const [pendingStatus, setPendingStatus] = useState('Draft');

  const rows = receipts || [];

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
    { field: 'paymentReceiptNo', headerName: 'Payment Receipt No.', filter: 'text' },
    { field: 'partyType', headerName: 'Type', filter: 'select' },
    { field: 'partyName', headerName: 'Customer/Vendor/Account', filter: 'text' },
    { field: 'postingDate', headerName: 'Posting Date', filter: 'dateRange', sortValue: (row) => (row.postingDate ? new Date(row.postingDate).getTime() : null) },
    { field: 'totalAmountDue', headerName: 'Total Amount Due (₹)', filter: 'numberRange', sortValue: (row) => (row.totalAmountDue == null || row.totalAmountDue === '' ? null : Number(row.totalAmountDue)) },
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
    if (editingRow && editingRow.paymentReceiptNo === openDocNo) return;
    const match = rows.find((r) => r.paymentReceiptNo === openDocNo);
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
      title: 'Delete payment receipt',
      message: `Are you sure you want to delete "${row.paymentReceiptNo}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Payment receipt deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const [printRequestReceiptNo, setPrintRequestReceiptNo] = useState(null);

  const handlePrint = (row) => {
    setRowMenuAnchor(null);
    handleView(row);
    setPrintRequestReceiptNo(row.paymentReceiptNo);
  };

  useEffect(() => {
    if (!printRequestReceiptNo) return;
    if (!editingRow || editingRow.paymentReceiptNo !== printRequestReceiptNo) return;
    setPrintRequestReceiptNo(null);
    // Printing from the LIST should leave the user back on the list once
    // the print dialog is dismissed, not sitting in front of a record it
    // only opened in order to print -- 'afterprint' fires either way
    // (printed or cancelled). The form's own Print button (added below)
    // calls printPaymentReceipt() directly, not through this effect, so
    // it's deliberately unaffected -- staying open there is correct.
    const returnToListAfterPrint = () => {
      window.removeEventListener('afterprint', returnToListAfterPrint);
      closeForm();
    };
    window.addEventListener('afterprint', returnToListAfterPrint);
    printPaymentReceipt();
  }, [printRequestReceiptNo, editingRow]);

  const [whatsappRequestReceiptNo, setWhatsappRequestReceiptNo] = useState(null);

  const handleSendRowWhatsApp = (row) => {
    setRowMenuAnchor(null);
    handleView(row);
    setWhatsappRequestReceiptNo(row.paymentReceiptNo);
  };

  useEffect(() => {
    if (!whatsappRequestReceiptNo) return;
    if (!editingRow || editingRow.paymentReceiptNo !== whatsappRequestReceiptNo) return;
    setWhatsappRequestReceiptNo(null);
    handleSendReceiptWhatsApp(editingRow).then(() => closeForm());
  }, [whatsappRequestReceiptNo, editingRow]);

  const handleSubmit = async (values, formMethods) => {
    // Exchange Rate is shown blank/disabled for INR (see getEmptyValues/
    // rowToFormValues/the currency-watch effect below) — 1 is what actually
    // gets saved, since INR against itself is always 1:1. Mirrors
    // PaymentVoucher's handleSubmit.
    const exchangeRate = values.currency === 'INR' ? 1 : Number(values.exchangeRate);
    const payload = { ...values, exchangeRate, status: pendingStatus };
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Payment receipt updated');
      } else {
        await create(payload).unwrap();
        notify.success('Payment receipt saved');
      }
      closeForm();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  if (openDocNo && (!editingRow || editingRow.paymentReceiptNo !== openDocNo)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box>

      <Collapse in={showForm} unmountOnExit>
      <Box sx={{ mb: 2 }}>
        <RouteMapContextMenu flow="sales" type="payment" docNo={editingRow?.paymentReceiptNo}>
        <AppForm readOnly={readOnly}
          key={formKey}
          schema={paymentReceiptSchema}
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
            const totalAmountDue = Number(watch('totalAmountDue')) || 0;
            const roundOff = Number(watch('roundOff')) || 0;
            const currencyValue = watch('currency');
            // INR against itself is always 1:1, so Exchange Rate is
            // disabled and not required whenever Currency is INR — for any
            // other currency it's enabled and mandatory (enforced in
            // paymentReceiptSchema's superRefine). Mirrors PaymentVoucher.
            const isInrCurrency = currencyValue === 'INR';

            // An Account party has no outstanding invoices to settle against,
            // and Payment on Account explicitly means "don't apply this to
            // anything" — the applied-invoices table only makes sense outside
            // those two cases.
            const tableApplicable = partyType !== 'Account' && !paymentOnAccount;
            const totalApplied = round2(watchedApplications.reduce((sum, a) => sum + (Number(a.amountApplied) || 0), 0));
            const appliedAmount = tableApplicable ? totalApplied : round2(totalAmountDue - roundOff);
            const openBalance = round2(totalAmountDue - appliedAmount - roundOff);

            // Link this receipt's own Due Date to the Sales/Purchase Invoice(s)
            // it is being applied against, instead of leaving it a manually
            // typed date with no connection to what is actually being paid.
            // Each application row already carries the source invoice's own
            // dueDate (set in confirmPicker below) — when more than one
            // invoice is applied, the earliest of them is the one that
            // actually governs whether this receipt is on time, so that is
            // what the header field follows.
            // Guarded by a ref, not a plain effect-on-watchedApplications: the
            // watched array is a fresh reference every render, so comparing
            // only the derived due-date key (not the array itself) is what
            // stops this from re-firing (and re-touching the field, marking
            // it dirty) on every keystroke elsewhere on the form.
            const earliestAppliedDueDate = (() => {
              const dueDates = watchedApplications
                .map((a) => a.dueDate)
                .filter(Boolean)
                .map((d) => new Date(d).getTime())
                .filter((t) => !Number.isNaN(t));
              return dueDates.length ? Math.min(...dueDates) : null;
            })();
            const prevAppliedDueDateRef = useRef(null);
            useEffect(() => {
              if (earliestAppliedDueDate === prevAppliedDueDateRef.current) return;
              prevAppliedDueDateRef.current = earliestAppliedDueDate;
              // Only ever pushes a date IN, never clears one back out — if
              // every applied invoice is removed, the last-linked Due Date
              // stays put rather than snapping back to blank, since it is
              // still a plain editable field the user may have fine-tuned.
              if (earliestAppliedDueDate != null) {
                setValue('dueDate', new Date(earliestAppliedDueDate), { shouldValidate: true });
              }
              // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [earliestAppliedDueDate]);

            const applicationsError = errors.applications?.message || errors.applications?.root?.message;
            const [paymentModesOpen, setPaymentModesOpen] = useState(false);
            const paymentMode = watch('paymentMode');
            const paymentGlAccount = watch('paymentGlAccount');
            const bankChargesAccount = watch('bankChargesAccount');
            const bankChargesAmount = watch('bankChargesAmount');
            // Hands the chosen tab's G/L account (and any bank charges) back
            // to the form -- glPosting.js debits this specific account
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

            // Switching Customer/Vendor/Account clears whatever party and
            // applied-invoice selections belonged to the previous type — a
            // Vendor code has no meaning once the radio moves to Account, and
            // an invoice applied under the old party would silently settle
            // the wrong ledger otherwise. Skipped on the very first render
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

            // Checking Payment on Account mid-edit drops whatever invoices
            // were staged — the two are mutually exclusive.
            const prevPayOnAccountRef = useRef(paymentOnAccount);
            useEffect(() => {
              if (prevPayOnAccountRef.current === paymentOnAccount) return;
              prevPayOnAccountRef.current = paymentOnAccount;
              if (paymentOnAccount) replace([]);
              // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [paymentOnAccount]);

            // Switching Currency to INR blanks and disables Exchange Rate
            // (INR's 1:1 rate is implied, not shown/required — the actual 1
            // is filled in on submit, see handleSubmit). Switching away from
            // INR clears it too, so the now-mandatory field can't be
            // submitted with a stale leftover value — moving between two
            // non-INR currencies leaves whatever rate is already entered
            // untouched. Skipped on mount so loading an existing record for
            // edit/view doesn't overwrite its saved rate. Mirrors
            // PaymentVoucher.
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

            // Picking a Customer/Vendor/Account code auto-fills Name (and
            // Bill To / Contact Person where the master carries them) —
            // mirrors Contact Person auto-fill elsewhere in the app
            // (PurchaseOrder.jsx).
            useEffect(() => {
              if (!partyCode) return;
              if (partyType === 'Customer') {
                const c = (customers || []).find((x) => x.customerCode === partyCode);
                if (c) {
                  setValue('partyName', c.customerName, { shouldValidate: true });
                  setValue('billTo', c.billingAddress || '');
                }
              } else if (partyType === 'Vendor') {
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

            const partyCodeOptions = partyType === 'Customer' ? customerCodeOptions
              : partyType === 'Vendor' ? supplierCodeOptions
                : accountCodeOptions;
            const partyCodeLabel = partyType === 'Vendor' ? 'Vendor Code' : partyType === 'Account' ? 'Account Code' : 'Customer Code';

            const outstandingSource = partyType === 'Customer' ? outstandingCustomerInvoices
              : partyType === 'Vendor' ? outstandingSupplierInvoices
                : [];
            const partyField = partyType === 'Customer' ? 'customerName' : 'supplierName';

            const [pickerOpen, setPickerOpen] = useState(false);
            const [pickedIds, setPickedIds] = useState([]);

            const alreadyAddedInvoiceNos = watchedApplications.map((a) => a.invoiceNo);
            const pickerRows = (outstandingSource || []).filter((inv) => {
              const balance = inv.balanceAmount != null ? Number(inv.balanceAmount) : Number(inv.invoiceAmount || 0) - Number(inv.paidAmount || 0);
              return inv[partyField] === partyName
                && inv.status !== 'Paid'
                && balance > 0
                && !alreadyAddedInvoiceNos.includes(inv.invoiceNo);
            });

            const openPicker = () => {
              if (!partyName) {
                notify.error(`Select a ${partyType === 'Vendor' ? 'Vendor' : 'Customer'} first`);
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
                <PaymentReceiptPrintable row={editingRow} company={company} />
                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight={700}>{readOnly ? 'View Payment Receipt' : editingRow ? 'Edit Payment Receipt' : 'New Payment Receipt'}</Typography>
                      <Button type="button" variant="outlined" color="inherit" startIcon={<CloseIcon />} onClick={closeForm}>
                        Close
                      </Button>
                    </Stack>

                    <FormRadioGroup name="partyType" label="Customer / Vendor / Account *" options={PARTY_TYPE_OPTIONS} />

                    <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING} singleColumnOnMobile>
                      <LabeledField label={partyCodeLabel}>
                        <FormSelect name="partyCode" label="" placeholder="Search…" options={partyCodeOptions} />
                      </LabeledField>
                      <LabeledField label="Name *">
                        <FormTextField name="partyName" label="" disabled />
                      </LabeledField>
                      <LabeledField label="Bill To">
                        <FormTextField name="billTo" label="" />
                      </LabeledField>
                      <LabeledField label="Contact Person">
                        <FormTextField name="contactPerson" label="" />
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
                      <LabeledField label="Incoming Payment No *">
                        <DocumentSeriesNoField documentCode="IP" seriesFieldName="seriesId" numberFieldName="paymentReceiptNo" isCreate={!editingRow} />
                      </LabeledField>
                      <LabeledField label="Posting Date *">
                        <FormDatePicker name="postingDate" label="" />
                      </LabeledField>
                      <LabeledField label="Due Date">
                        {/* Linked to the applied invoice(s)' own Due Date —
                        see the earliestAppliedDueDate effect above. Still a
                        plain editable date, not read-only: the auto-fill is a
                        default to start from, not a lock, since a receipt can
                        be dated differently for its own reasons. */}
                        <FormDatePicker name="dueDate" label="" />
                      </LabeledField>
                      <LabeledField label="Document Date *">
                        <FormDatePicker name="documentDate" label="" />
                      </LabeledField>
                      <LabeledField label="Reference">
                        <FormTextField name="reference" label="" placeholder="Optional" />
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
                          Add Invoice/Bill
                        </Button>
                      )}
                    </Stack>

                    {!tableApplicable ? (
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        {partyType === 'Account'
                          ? 'Not applicable for an Account entry — there are no outstanding invoices to apply this receipt against.'
                          : 'Not applicable while Payment on Account is checked — this receipt is recorded without settling any invoice.'}
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
                            <FormTextField name="roundOff" label="Round Off (₹)" type="number" allowNegative />
                            <FormTextField name="totalAmountDue" label="Total Amount Due (₹) *" type="number" />
                          </FormGrid>
                          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 2.5 }}>
                            <Stack spacing={1}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="body2" color="text.secondary">Applied Amount</Typography>
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    disabled={!(totalAmountDue > 0)}
                                    onClick={() => setPaymentModesOpen(true)}
                                    aria-label="Apply payment amount"
                                    sx={{ p: 0.25 }}
                                  >
                                    <Box
                                      sx={{
                                        width: 28, height: 28, borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        bgcolor: totalAmountDue > 0 ? 'primary.main' : 'action.disabledBackground',
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
                      <Button fullWidth={isMobile} type="button" variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => printPaymentReceipt()} disabled={!editingRow?.id}>
                        Print
                      </Button>
                      <WhatsAppShareButton
                        fullWidth={isMobile}
                        phone={(customers || []).find((c) => c.customerName === editingRow?.partyName)?.phone
                          || (suppliers || []).find((sup) => sup.supplierName === editingRow?.partyName)?.phone}
                        customerName={editingRow?.partyName}
                        docLabel="Payment Receipt"
                        docNo={editingRow?.paymentReceiptNo}
                        onClick={() => handleSendReceiptWhatsApp(editingRow)}
                        sending={sendingReceiptWhatsApp}
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
                        Save & Post Receipt
                      </FormSubmitButton>
                    </Stack>
                  </CardContent>
                </Card>

                <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} maxWidth="md" fullWidth>
                  <DialogTitle>Add Invoice/Bill — Outstanding for {partyName || (partyType === 'Vendor' ? 'vendor' : 'customer')}</DialogTitle>
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
                                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>{invTable.isFiltering ? 'No results match your search' : 'No outstanding invoices/bills for this party'}</Typography>
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
              <Typography variant="subtitle1" fontWeight={700}>Payment Receipt List</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap sx={{ width: { xs: '100%', md: 'auto' } }}>
                <TableSearchFilter table={table} placeholder="Search by receipt no., party..." showFilter={false} />
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
                      New Payment Receipt
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
                    title={row.paymentReceiptNo}
                    statusChip={<Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />}
                    fields={[
                      { label: 'Type', value: row.partyType || '—' },
                      { label: 'Customer/Vendor/Account', value: row.partyName || '—' },
                      { label: 'Posting Date', value: row.postingDate ? dayjs(row.postingDate).format('DD/MM/YYYY') : '—' },
                      { label: 'Total Amount Due', value: `₹${Number(row.totalAmountDue).toFixed(2)}` },
                      { label: 'Applied Amount', value: `₹${Number(row.appliedAmount).toFixed(2)}` },
                      { label: 'Open Balance', value: `₹${Number(row.openBalance).toFixed(2)}` },
                    ]}
                    onView={() => handleView(row)}
                    onEdit={() => handleEdit(row)}
                    onDelete={() => handleDelete(row)}
                  />
                ))}
                {!isLoading && filteredRows.length === 0 && (
                  <EmptyState icon={<AccountBalanceOutlinedIcon sx={{ fontSize: 48 }} />} title="No payment receipts found" message="Add your first payment receipt to get started" />
                )}
              </Box>
            ) : (
              <ScrollableTableContainer>
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    '& th, & td': {
                      height: PAYMENT_RECEIPT_LIST_TABLE_ROW_HEIGHT,
                      paddingTop: `${PAYMENT_RECEIPT_LIST_TABLE_CELL_PADDING_Y}px`,
                      paddingBottom: `${PAYMENT_RECEIPT_LIST_TABLE_CELL_PADDING_Y}px`,
                      boxSizing: 'border-box',
                    },
                  }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell width={40}>#</TableCell>
                      <SortableHeaderCell field="paymentReceiptNo" sort={table.sort} onSort={table.toggleSort}>Payment Receipt No.</SortableHeaderCell>
                      <SortableHeaderCell field="partyType" sort={table.sort} onSort={table.toggleSort}>Type</SortableHeaderCell>
                      <SortableHeaderCell field="partyName" sort={table.sort} onSort={table.toggleSort}>Customer/Vendor/Account</SortableHeaderCell>
                      <SortableHeaderCell field="postingDate" sort={table.sort} onSort={table.toggleSort}>Posting Date</SortableHeaderCell>
                      <SortableHeaderCell align="right" field="totalAmountDue" sort={table.sort} onSort={table.toggleSort}>Total Amount Due (₹)</SortableHeaderCell>
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
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.paymentReceiptNo}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.partyType || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.partyName || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.postingDate ? dayjs(row.postingDate).format('DD/MM/YYYY') : '—'}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(row.totalAmountDue).toFixed(2)}</TableCell>
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
                            party's name/payment no., not their phone. A
                            Vendor party is looked up in suppliers, an
                            Account party has no phone at all and the button
                            stays disabled for it (see hasUsableNumber in
                            WhatsAppShareButton.jsx). */}
                          <WhatsAppShareButton
                            iconOnly
                            phone={(customers || []).find((c) => c.customerName === row.partyName)?.phone
                              || (suppliers || []).find((sup) => sup.supplierName === row.partyName)?.phone}
                            customerName={row.partyName}
                            docLabel="Payment Receipt"
                            docNo={row.paymentReceiptNo}
                            onClick={() => handleSendRowWhatsApp(row)}
                            sending={sendingReceiptWhatsApp && whatsappRequestReceiptNo === row.paymentReceiptNo}
                          />
                          <RouteMapButton flow="sales" type="payment" docNo={row.paymentReceiptNo} />
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
                          <EmptyState icon={<AccountBalanceOutlinedIcon sx={{ fontSize: 48 }} />} title="No payment receipts found" message="Add your first payment receipt to get started" />
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
