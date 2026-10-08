import React, { useEffect, useMemo, useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import {
  Box, Typography, Button, Card, CardContent, Stack, Grid, Tabs, Tab, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Checkbox,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import BalanceOutlinedIcon from '@mui/icons-material/BalanceOutlined';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import EmptyState from '../../components/data-display/EmptyState';
import RefreshIcon from '@mui/icons-material/Refresh';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import dayjs from 'dayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import FormSelect from '../../components/form/FormSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import { FormGrid } from '../../components/form/AppForm';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import StatCard from '../../components/data-display/StatCard';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { bankReconciliationApi, houseBankApi } from '../../features/resources';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import { noSpinnersSx } from '../../components/form/FormTextField';

import { CanAdd } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
const PAGE_SIZE = 10;

const currency = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_FILTER_OPTIONS = [
  { label: 'All', value: 'All' },
  { label: 'Reconciled', value: 'Reconciled' },
  { label: 'Unreconciled', value: 'Unreconciled' },
];

const TYPE_CHIP_COLORS = { Credit: 'success', Debit: 'error' };
const TXN_STATUS_COLORS = { Reconciled: 'success', Unreconciled: 'warning' };

const sumBy = (txns, pred) => txns.filter(pred).reduce((s, t) => s + Number(t.amount || 0), 0);

const RECONCILIATION_LIST_TABLE_ROW_HEIGHT = 0;
const RECONCILIATION_LIST_TABLE_CELL_PADDING_Y = 6;
export default function BankReconciliation() {
  const notify = useNotify();
  const isMobile = useIsMobileListView();
  const { data: reconciliations, isLoading, refetch } = bankReconciliationApi.useList();
  const { data: houseBanks } = houseBankApi.useList();
  const [update, { isLoading: updating }] = bankReconciliationApi.useUpdate();
  const [create, { isLoading: creating }] = bankReconciliationApi.useCreate();

  const bankAccountOptions = (houseBanks || []).map((b) => ({ label: `${b.bankName} - ${b.accountNumber}`, value: `${b.bankName} - ${b.accountNumber}` }));

  // Filter bar is a report toolbar, not a create/edit form — no Zod
  // validation or persisted mutation. react-hook-form is only used here to
  // satisfy FormSelect/FormDatePicker's useFormContext requirement.
  const methods = useForm({
    defaultValues: { bankAccount: '', statementDate: new Date(), reconciliationDate: new Date(), status: 'All' },
  });
  const { handleSubmit } = methods;

  // The filters actually applied — only updated when "View" is clicked.
  const [appliedFilters, setAppliedFilters] = useState({ bankAccount: '', status: 'All', statementDate: new Date(), reconciliationDate: new Date() });
  const [activeTab, setActiveTab] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const onView = handleSubmit((values) => {
    setAppliedFilters({
      bankAccount: values.bankAccount || '',
      status: values.status || 'All',
      statementDate: values.statementDate || new Date(),
      reconciliationDate: values.reconciliationDate || new Date(),
    });
    setSelectedIds([]);
    setPage(0);
  });

  // The reconciliation being worked on: the one for the selected bank
  // account, or the most recent one when no account has been picked yet.
  const recon = useMemo(() => {
    const rows = reconciliations || [];
    if (!rows.length) return null;
    if (appliedFilters.bankAccount) return rows.find((r) => r.bankAccount === appliedFilters.bankAccount) || null;
    return rows[0];
  }, [reconciliations, appliedFilters.bankAccount]);

  const txns = recon?.transactions || [];
  const bankTxns = useMemo(() => txns.filter((t) => t.source === 'Bank'), [txns]);
  const systemTxns = useMemo(() => txns.filter((t) => t.source === 'System'), [txns]);

  // Statement (A) side — computed from the bank lines.
  const opening = Number(recon?.openingBalance || 0);
  const bankCredits = sumBy(bankTxns, (t) => t.type === 'Credit');
  const bankDebits = sumBy(bankTxns, (t) => t.type === 'Debit');
  const statementClosing = opening + bankCredits - bankDebits; // (A)

  // System/book (B) side — computed from the system lines.
  const sysCredits = sumBy(systemTxns, (t) => t.type === 'Credit');
  const sysDebits = sumBy(systemTxns, (t) => t.type === 'Debit');
  const systemClosing = opening + sysCredits - sysDebits; // (B)

  const difference = systemClosing - statementClosing; // (B - A)
  // Unreconciled amounts are measured on the bank-statement side.
  const unreconciledCredits = sumBy(bankTxns, (t) => t.type === 'Credit' && t.status === 'Unreconciled');
  const unreconciledDebits = sumBy(bankTxns, (t) => t.type === 'Debit' && t.status === 'Unreconciled');
  const calculatedBankBalance = systemClosing + unreconciledCredits - unreconciledDebits;

  // Running balance per system line (Balance column in the System
  // Transactions tab): opening balance, then +credit / -debit in order.
  const systemBalances = useMemo(() => {
    const map = {};
    let bal = 0;
    systemTxns.forEach((t) => {
      if (t.type === 'Opening Balance') bal = Number(t.amount || 0);
      else if (t.type === 'Credit') bal += Number(t.amount || 0);
      else if (t.type === 'Debit') bal -= Number(t.amount || 0);
      map[t.id] = bal;
    });
    return map;
  }, [systemTxns]);

  const statCards = [
    { icon: <AccountBalanceOutlinedIcon fontSize="small" />, label: 'Statement Opening Balance', value: currency(opening), color: 'primary' },
    { icon: <ArrowDownwardIcon fontSize="small" />, label: 'Total Credits (As per Bank)', value: currency(bankCredits), color: 'success' },
    { icon: <ArrowUpwardIcon fontSize="small" />, label: 'Total Debits (As per Bank)', value: currency(bankDebits), color: 'error' },
    { icon: <BalanceOutlinedIcon fontSize="small" />, label: 'Statement Closing Balance (A)', value: currency(statementClosing), color: 'warning' },
  ];

  const summaryBoxes = [
    { label: 'System Closing Balance', sub: '(B)', value: currency(systemClosing), color: 'text.primary' },
    { label: 'Difference (B - A)', value: currency(difference), color: Math.abs(difference) > 0.009 ? 'error.main' : 'success.main' },
    { label: 'Unreconciled Credits', value: currency(unreconciledCredits), color: 'success.main' },
    { label: 'Unreconciled Debits', value: currency(unreconciledDebits), color: 'error.main' },
  ];

  // Rows for the active tab, with the Status filter applied.
  const tabTxns = activeTab === 0 ? bankTxns : activeTab === 1 ? systemTxns : [];
  const baseTxns = useMemo(() => {
    const byStatus = appliedFilters.status === 'All' ? tabTxns : tabTxns.filter((t) => t.status === appliedFilters.status);
    const q = '';
    if (!q) return byStatus;
    return byStatus.filter((t) => [t.description, t.refNo, t.voucherType, t.voucherNo, t.remarks].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [tabTxns, appliedFilters.status]);

  // The middle columns swap between the bank-statement and system-ledger
  // tabs, so the column set follows activeTab.
  const tableColumns = useMemo(() => ([
    { field: 'txnDate', headerName: 'Date', filter: 'dateRange', sortValue: (row) => (row.txnDate ? new Date(row.txnDate).getTime() : null), searchValue: (row) => (row.txnDate ? dayjs(row.txnDate).format('DD/MM/YYYY') : '') },
    { field: 'description', headerName: 'Description', filter: 'text' },
    ...(activeTab === 1
      ? [
        { field: 'voucherType', headerName: 'Voucher Type', filter: 'select' },
        { field: 'voucherNo', headerName: 'Voucher No.', filter: 'text' },
        { field: 'amount', headerName: 'Amount (₹)', filter: 'numberRange', sortValue: (row) => Number(row.amount) || 0 },
      ]
      : [
        { field: 'refNo', headerName: 'Cheque / Ref No.', filter: 'text' },
        { field: 'type', headerName: 'Type', filter: 'select' },
        { field: 'amount', headerName: 'Amount (₹)', filter: 'numberRange', sortValue: (row) => Number(row.amount) || 0 },
      ]),
    { field: 'remarks', headerName: 'Remarks', filter: 'text' },
    { field: 'status', headerName: 'Status', filter: 'select' },
  ]), [activeTab]);
  const table = useTableFeatures(baseTxns, tableColumns, { onChange: setPage });
  const filteredTxns = table.rows;

  const pagedTxns = useMemo(
    () => filteredTxns.slice(page * pageSize, page * pageSize + pageSize),
    [filteredTxns, page, pageSize]
  );


  const toggleSelected = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const pageIds = pagedTxns.map((t) => t.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const toggleSelectAll = () => setSelectedIds((prev) => (
    allPageSelected ? prev.filter((id) => !pageIds.includes(id)) : [...new Set([...prev, ...pageIds])]
  ));

  // Persist a new transactions array by PUT-ing the whole reconciliation
  // back (the backend replaces the line set wholesale).
  const persistTxns = async (nextTxns, successMessage) => {
    try {
      await update({
        id: recon.id,
        bankAccount: recon.bankAccount,
        statementDate: recon.statementDate,
        reconciliationDate: recon.reconciliationDate,
        openingBalance: Number(recon.openingBalance || 0),
        status: recon.status,
        notes: recon.notes,
        transactions: nextTxns,
      }).unwrap();
      setSelectedIds([]);
      notify.success(successMessage);
    } catch (err) {
      notify.error(err?.data?.message || 'Save failed');
    }
  };

  const setStatusFor = (ids, status) => txns.map((t) => (ids.includes(t.id) ? { ...t, status } : t));

  const handleMatch = () => {
    if (!recon || selectedIds.length === 0) return notify.error('Select at least one transaction');
    persistTxns(setStatusFor(selectedIds, 'Reconciled'), 'Transactions matched');
  };

  const handleUnmatch = () => {
    if (!recon || selectedIds.length === 0) return notify.error('Select at least one transaction');
    persistTxns(setStatusFor(selectedIds, 'Unreconciled'), 'Transactions unmatched');
  };

  // The Statement side (Bank Statement Transactions tab, and every stat
  // card/summary figure derived from it — Opening Balance, Total Credits/
  // Debits, Statement Closing Balance) only ever has data if a 'Bank'-source
  // line exists. Unlike System transactions, which the backend fills in
  // automatically from Deposits/Collections/Payments/Cheques, nothing
  // auto-populates the bank statement side — there's no bank feed. Add
  // Transaction is the only way to enter it, which is why those figures sit
  // at ₹0.00 until the user adds at least one bank-statement line here.
  const emptyBankTxn = { txnDate: new Date(), description: '', refNo: '', type: 'Credit', amount: '', remarks: '' };
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyBankTxn);

  const openAddDialog = () => {
    if (!appliedFilters.bankAccount) return notify.error('Select a bank account and click View first');
    setAddForm(emptyBankTxn);
    setAddOpen(true);
  };

  const handleAddTransaction = async () => {
    if (!addForm.txnDate) return notify.error('Date is required');
    const amount = Number(addForm.amount);
    if (!amount || amount <= 0) return notify.error('Enter a valid amount');

    const newTxn = {
      source: 'Bank', txnDate: addForm.txnDate, description: addForm.description,
      refNo: addForm.refNo, type: addForm.type, amount, remarks: addForm.remarks,
      status: 'Unreconciled',
    };

    try {
      if (recon) {
        await update({
          id: recon.id,
          bankAccount: recon.bankAccount,
          statementDate: recon.statementDate,
          reconciliationDate: recon.reconciliationDate,
          openingBalance: Number(recon.openingBalance || 0),
          status: recon.status,
          notes: recon.notes,
          transactions: [...txns, newTxn],
        }).unwrap();
      } else {
        // No reconciliation exists yet for this bank account at all (no
        // System activity has landed on it either) — create one, seeded
        // with just this bank-statement line.
        await create({
          bankAccount: appliedFilters.bankAccount,
          statementDate: appliedFilters.statementDate,
          reconciliationDate: appliedFilters.reconciliationDate,
          openingBalance: 0,
          status: 'In Progress',
          transactions: [newTxn],
        }).unwrap();
      }
      setAddOpen(false);
      notify.success('Bank transaction added');
    } catch (err) {
      notify.error(err?.data?.message || 'Save failed');
    }
  };

  const handleDeleteSelected = () => {
    if (!recon || selectedIds.length === 0) return notify.error('Select at least one transaction');
    // Only ever offered on the Bank tab (see the toolbar below) — System
    // lines are auto-synced from real vouchers and deleting them here
    // wouldn't undo anything on the source document, just desync the two.
    persistTxns(txns.filter((t) => !selectedIds.includes(t.id)), 'Transaction(s) deleted');
  };

  // Auto Match: pair each unreconciled Bank line with an unreconciled
  // System line of the same type and amount (each side used at most once),
  // and mark both Reconciled.
  const handleAutoMatch = () => {
    if (!recon) return;
    const usedSystemIds = new Set();
    const matchedIds = new Set();
    bankTxns.filter((t) => t.status === 'Unreconciled').forEach((bankTxn) => {
      const counterpart = systemTxns.find((s) => s.status === 'Unreconciled'
        && !usedSystemIds.has(s.id)
        && s.type === bankTxn.type
        && Number(s.amount) === Number(bankTxn.amount));
      if (counterpart) {
        usedSystemIds.add(counterpart.id);
        matchedIds.add(bankTxn.id);
        matchedIds.add(counterpart.id);
      }
    });
    if (matchedIds.size === 0) return notify.error('No matching transactions found');
    persistTxns(setStatusFor([...matchedIds], 'Reconciled'), `Auto-matched ${matchedIds.size} transactions`);
  };

  const matchedCount = bankTxns.filter((t) => t.status === 'Reconciled').length;
  const unmatchedInSystem = systemTxns.filter((t) => t.status === 'Unreconciled').length;
  const unmatchedInBank = bankTxns.filter((t) => t.status === 'Unreconciled').length;
  const isReconciled = Math.abs(difference) < 0.01 && unmatchedInSystem === 0 && unmatchedInBank === 0;

  // Export: all transaction lines (both sides) to CSV — a real client-side
  // download, matching the pattern used elsewhere (CustomerOutstanding).
  const handleExport = () => {
    const header = ['Source', 'Date', 'Description', 'Cheque / Ref No.', 'Voucher Type', 'Voucher No.', 'Type', 'Amount', 'Remarks', 'Status'].join(',');
    const lines = txns.map((t) => [
      t.source, t.txnDate ? dayjs(t.txnDate).format('DD/MM/YYYY') : '', t.description, t.refNo,
      t.voucherType, t.voucherNo, t.type, Number(t.amount || 0).toFixed(2), t.remarks, t.status,
    ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bank-reconciliation.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<AccountBalanceOutlinedIcon />}
        title="Bank Reconciliation"
        subtitle="Reconcile your bank transactions with system records."
        rightContent={<CompanyBadge />}
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Filters</Typography>
          <FormProvider {...methods}>
            <Grid container spacing={2} alignItems="flex-start">
              <Grid item xs={12} sm={6} md={2.5}>
                <FormSelect name="bankAccount" label="Bank Account *" placeholder="Select bank account" options={bankAccountOptions} />
              </Grid>
              <Grid item xs={12} sm={6} md={2.5}>
                <FormDatePicker name="statementDate" label="Statement Date *" />
              </Grid>
              <Grid item xs={12} sm={6} md={2.5}>
                <FormDatePicker name="reconciliationDate" label="Reconciliation Date *" />
              </Grid>
              <Grid item xs={12} sm={6} md={2.5}>
                <FormSelect name="status" label="Status" options={STATUS_FILTER_OPTIONS} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<SearchIcon />}
                    onClick={onView}
                    fullWidth
                    sx={{ height: 40 }}
                  >
                    View
                  </Button>
                  <Box sx={{ minHeight: '1.1em', mt: 0.25 }} />
                </Box>
              </Grid>
            </Grid>
          </FormProvider>
        </CardContent>
      </Card>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {statCards.map((c) => (
          <Grid item xs={12} sm={6} md={3} key={c.label}>
            <StatCard {...c} />
          </Grid>
        ))}
      </Grid>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Reconciliation Summary</Typography>
          <Grid container spacing={2}>
            {summaryBoxes.map((b) => (
              <Grid item xs={12} sm={6} md={3} key={b.label}>
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 2 }}>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {b.label} {b.sub || ''}
                  </Typography>
                  <Typography variant="h6" fontWeight={700} sx={{ color: b.color }} noWrap>{b.value}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ xs: 'stretch', md: 'center' }}
            justifyContent="space-between"
            gap={1.5}
            sx={{ px: { xs: 2, sm: 3 }, pt: 1.5, pb: 0.5 }}
          >
            <Tabs
              value={activeTab}
              onChange={(_e, v) => { setActiveTab(v); setSelectedIds([]); setPage(0); }}
              variant="scrollable"
              allowScrollButtonsMobile
            >
              <Tab label="Bank Statement Transactions" />
              <Tab label="System Transactions" />
              <Tab label="Reconciliation Summary" />
            </Tabs>
            {activeTab !== 2 && (
              <TableSearchFilter table={table} placeholder="Search transactions..." width={220} />
            )}
            {activeTab === 2 ? (
              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                <Button variant="outlined" color="inherit" size="small" startIcon={<RefreshIcon />} onClick={() => refetch()}>
                  Refresh
                </Button>
                <Button variant="outlined" color="inherit" size="small" startIcon={<FileDownloadOutlinedIcon />} onClick={handleExport}>
                  Export
                </Button>
                <Button variant="outlined" color="inherit" size="small" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()}>
                  Print
                </Button>
              </Stack>
            ) : (
              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                {activeTab === 0 && (
                  <>
                    <CanAdd>
                      <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openAddDialog} disabled={creating || updating}>
                        Add Transaction
                      </Button>
                    </CanAdd>
                    <Button variant="outlined" color="error" size="small" startIcon={<DeleteOutlineIcon />} onClick={handleDeleteSelected} disabled={updating || !recon}>
                      Delete
                    </Button>
                  </>
                )}
                <Button variant="outlined" color="inherit" size="small" startIcon={<LinkIcon />} onClick={handleMatch} disabled={updating || !recon}>
                  Match
                </Button>
                <Button variant="outlined" color="inherit" size="small" startIcon={<LinkOffIcon />} onClick={handleUnmatch} disabled={updating || !recon}>
                  Unmatch
                </Button>
                <Button variant="outlined" size="small" startIcon={<AutoFixHighOutlinedIcon />} onClick={handleAutoMatch} disabled={updating || !recon}>
                  Auto Match
                </Button>
              </Stack>
            )}
          </Stack>

          <TableFilterPanel table={table} />

          {activeTab === 2 ? (
            <Box sx={{ p: { xs: 2, sm: 3 } }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Reconciliation Breakdown</Typography>
                      <Stack spacing={1.25}>
                        {[
                          { label: 'System Closing Balance (B)', value: currency(systemClosing) },
                          { label: 'Add: Unreconciled Credits', value: currency(unreconciledCredits), color: 'success.main' },
                          { label: 'Less: Unreconciled Debits', value: currency(unreconciledDebits), color: 'error.main' },
                          { label: 'Calculated Bank Balance', value: currency(calculatedBankBalance), bold: true, divider: true },
                          { label: 'Bank Statement Closing Balance (A)', value: currency(statementClosing), bold: true },
                          { label: 'Difference (B - A)', value: currency(difference), bold: true, divider: true, color: Math.abs(difference) > 0.009 ? 'error.main' : 'success.main' },
                        ].map((r) => (
                          <Stack
                            key={r.label}
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            sx={r.divider ? { borderTop: '1px solid', borderColor: 'divider', pt: 1.25 } : undefined}
                          >
                            <Typography variant="body2" color="text.secondary" fontWeight={r.bold ? 700 : 400}>{r.label}</Typography>
                            <Typography variant="body2" fontWeight={700} sx={{ color: r.color || 'text.primary' }}>{r.value}</Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Reconciliation Status</Typography>
                      <Stack spacing={1.25}>
                        {[
                          { label: 'Total Bank Statement Transactions', value: bankTxns.length },
                          { label: 'Total System Transactions', value: systemTxns.length },
                          { label: 'Matched Transactions', value: matchedCount, color: 'success.main' },
                          { label: 'Unmatched in System (Not in Bank)', value: unmatchedInSystem, color: unmatchedInSystem ? 'error.main' : 'success.main' },
                          { label: 'Unmatched in Bank (Not in System)', value: unmatchedInBank, color: unmatchedInBank ? 'error.main' : 'success.main' },
                        ].map((r) => (
                          <Stack key={r.label} direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" color="text.secondary">{r.label}</Typography>
                            <Typography variant="body2" fontWeight={700} sx={{ color: r.color || 'text.primary' }}>{r.value}</Typography>
                          </Stack>
                        ))}
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1.25 }}>
                          <Typography variant="body2" color="text.secondary" fontWeight={700}>Reconciliation Status</Typography>
                          <Chip
                            size="small"
                            label={isReconciled ? 'Reconciled' : 'Not Reconciled'}
                            color={isReconciled ? 'success' : 'warning'}
                            variant="outlined"
                          />
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          ) : isMobile ? (
            <Box sx={{ px: 2, pb: 1, pt: 1 }}>
              {!isLoading && pagedTxns.map((t) => (
                <MobileRecordCard
                  key={t.id}
                  title={t.description || '—'}
                  statusChip={<Chip size="small" label={t.status} color={TXN_STATUS_COLORS[t.status] || 'default'} variant="outlined" />}
                  fields={activeTab === 1 ? [
                    { label: 'Date', value: t.txnDate ? dayjs(t.txnDate).format('DD/MM/YYYY') : '—' },
                    { label: 'Voucher Type', value: t.voucherType || '—' },
                    { label: 'Voucher No.', value: t.voucherNo || '—' },
                    { label: 'Debit', value: t.type === 'Debit' ? currency(t.amount) : '—' },
                    { label: 'Credit', value: t.type === 'Credit' ? currency(t.amount) : '—' },
                    { label: 'Balance', value: currency(systemBalances[t.id]) },
                    { label: 'Remarks', value: t.remarks || '—' },
                    { label: 'Selected', value: selectedIds.includes(t.id) ? 'Yes' : 'No' },
                  ] : [
                    { label: 'Date', value: t.txnDate ? dayjs(t.txnDate).format('DD/MM/YYYY') : '—' },
                    { label: 'Cheque / Ref No.', value: t.refNo || '—' },
                    { label: 'Type', value: t.type || '—' },
                    { label: 'Amount', value: currency(t.amount) },
                    { label: 'Remarks', value: t.remarks || '—' },
                    { label: 'Selected', value: selectedIds.includes(t.id) ? 'Yes' : 'No' },
                  ]}
                  onEdit={() => toggleSelected(t.id)}
                />
              ))}
              {!isLoading && filteredTxns.length === 0 && (
                <EmptyState
                  icon={<AccountBalanceOutlinedIcon sx={{ fontSize: 48 }} />}
                  title={table.isFiltering ? 'No matches' : 'No transactions found'}
                  message={table.isFiltering ? 'Try adjusting your search or filters' : 'Select a bank account to see its transactions'}
                />
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table
                size="small"
                stickyHeader
                sx={{
                  '& th, & td': {
                    height: RECONCILIATION_LIST_TABLE_ROW_HEIGHT,
                    paddingTop: `${RECONCILIATION_LIST_TABLE_CELL_PADDING_Y}px`,
                    paddingBottom: `${RECONCILIATION_LIST_TABLE_CELL_PADDING_Y}px`,
                    boxSizing: 'border-box',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={allPageSelected} indeterminate={!allPageSelected && pageIds.some((id) => selectedIds.includes(id))} onChange={toggleSelectAll} />
                    </TableCell>
                    <SortableHeaderCell field="txnDate" sort={table.sort} onSort={table.toggleSort}>Date</SortableHeaderCell>
                    <SortableHeaderCell field="description" sort={table.sort} onSort={table.toggleSort}>Description</SortableHeaderCell>
                    {activeTab === 1 ? (
                      <>
                        <SortableHeaderCell field="voucherType" sort={table.sort} onSort={table.toggleSort}>Voucher Type</SortableHeaderCell>
                        <SortableHeaderCell field="voucherNo" sort={table.sort} onSort={table.toggleSort}>Voucher No.</SortableHeaderCell>
                        <TableCell align="right">Debit (₹)</TableCell>
                        <TableCell align="right">Credit (₹)</TableCell>
                        <TableCell align="right">Balance (₹)</TableCell>
                      </>
                    ) : (
                      <>
                        <SortableHeaderCell field="refNo" sort={table.sort} onSort={table.toggleSort}>Cheque / Ref No.</SortableHeaderCell>
                        <SortableHeaderCell field="type" sort={table.sort} onSort={table.toggleSort}>Type</SortableHeaderCell>
                        <SortableHeaderCell field="amount" sort={table.sort} onSort={table.toggleSort} align="right">Amount (₹)</SortableHeaderCell>
                      </>
                    )}
                    <SortableHeaderCell field="remarks" sort={table.sort} onSort={table.toggleSort}>Remarks</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedTxns.map((t) => (
                    <TableRow key={t.id} hover selected={selectedIds.includes(t.id)} onClick={() => toggleSelected(t.id)} sx={{ cursor: 'pointer' }}>
                      <TableCell padding="checkbox">
                        <Checkbox size="small" checked={selectedIds.includes(t.id)} />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{t.txnDate ? dayjs(t.txnDate).format('DD/MM/YYYY') : '—'}</TableCell>
                      <TableCell sx={{ minWidth: 200 }}>{t.description || '—'}</TableCell>
                      {activeTab === 1 ? (
                        <>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{t.voucherType || '—'}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{t.voucherNo || '—'}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            {t.type === 'Debit' ? Number(t.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            {t.type === 'Credit' ? Number(t.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            {Number(systemBalances[t.id] || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{t.refNo || '—'}</TableCell>
                          <TableCell>
                            {t.type === 'Opening Balance'
                              ? <Typography variant="body2" fontWeight={600} sx={{ whiteSpace: 'nowrap' }}>Opening Balance</Typography>
                              : <Chip size="small" label={t.type} color={TYPE_CHIP_COLORS[t.type] || 'default'} variant="outlined" />}
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(t.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        </>
                      )}
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{t.remarks || '—'}</TableCell>
                      <TableCell>
                        <Chip size="small" label={t.status} color={TXN_STATUS_COLORS[t.status] || 'default'} variant="outlined" />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && filteredTxns.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={activeTab === 1 ? 10 : 8} sx={{ border: 'none' }}>
                        <EmptyState
                          icon={<AccountBalanceOutlinedIcon sx={{ fontSize: 48 }} />}
                          title={!recon ? 'No reconciliation selected' : table.isFiltering ? 'No matches' : 'No transactions found'}
                          message={!recon ? 'Select a bank account to see its transactions' : table.isFiltering ? 'Try adjusting your search or filters' : 'No transactions for this reconciliation yet'}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollableTableContainer>
          )}

          {activeTab !== 2 && (
            <EntityListPagination total={filteredTxns.length} page={page} onChange={setPage} pageSize={pageSize} onPageSizeChange={(v) => { setPageSize(v); setPage(0); }} />
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Bank Statement Transaction</DialogTitle>
        <DialogContent>
          <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
            <LabeledField label="Date *">
              <DatePicker
                value={addForm.txnDate ? dayjs(addForm.txnDate) : null}
                onChange={(v) => setAddForm((f) => ({ ...f, txnDate: v ? v.toDate() : null }))}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </LabeledField>
            <LabeledField label="Type *">
              <TextField
                select
                size="small"
                fullWidth
                label=""
                value={addForm.type}
                onChange={(e) => setAddForm((f) => ({ ...f, type: e.target.value }))}
                SelectProps={{ native: true }}
              >
                <option value="Credit">Credit</option>
                <option value="Debit">Debit</option>
              </TextField>
            </LabeledField>
            <LabeledField label="Description">
              <TextField
                size="small"
                fullWidth
                label=""
                value={addForm.description}
                onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
              />
            </LabeledField>
            <LabeledField label="Cheque / Ref No.">
              <TextField
                size="small"
                fullWidth
                label=""
                value={addForm.refNo}
                onChange={(e) => setAddForm((f) => ({ ...f, refNo: e.target.value }))}
              />
            </LabeledField>
            <LabeledField label="Amount (₹) *">
              <TextField
                size="small"
                fullWidth
                type="number"
                label=""
                value={addForm.amount}
                onChange={(e) => setAddForm((f) => ({ ...f, amount: e.target.value }))}
                inputProps={{ min: 0 }}
                sx={noSpinnersSx}
              />
            </LabeledField>
            <LabeledField label="Remarks">
              <TextField
                size="small"
                fullWidth
                label=""
                value={addForm.remarks}
                onChange={(e) => setAddForm((f) => ({ ...f, remarks: e.target.value }))}
              />
            </LabeledField>
          </FormGrid>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddTransaction} disabled={creating || updating}>Add</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
