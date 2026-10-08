import React, { useEffect, useMemo, useState } from 'react';
import LoadingState from '../../../components/feedback/LoadingState';
import EmptyState from '../../../components/data-display/EmptyState';
import { useCurrencyOptions } from '../../../lib/currencyOptions';
import { useForm, FormProvider } from 'react-hook-form';
import {
  Box, Typography, Button, Card, CardContent, Stack, Grid, Table, TableBody, TableCell,
  TableHead, TableRow,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip,
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, LabelList,
} from 'recharts';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ArrowDownwardOutlinedIcon from '@mui/icons-material/ArrowDownwardOutlined';
import ArrowUpwardOutlinedIcon from '@mui/icons-material/ArrowUpwardOutlined';
import BalanceOutlinedIcon from '@mui/icons-material/BalanceOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import dayjs from 'dayjs';
import FormSelect from '../../../components/form/FormSelect';
import FormDatePicker from '../../../components/form/FormDatePicker';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import CompanyBadge from '../../../components/common/CompanyBadge';
import EntityListPagination from '../../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../../components/data-display/useIsMobileListView';
import StatCard from '../../../components/data-display/StatCard';
import { branchApi, houseBankApi } from '../../../features/resources';
import { useGetBankBookReportQuery } from '../../../features/banking/bankBookReportApi';
import useTableFeatures from '../../../components/data-display/useTableFeatures';
import TableToolbar from '../../../components/data-display/TableToolbar';
import SortableHeaderCell from '../../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import TableFilterPanel from '../../../components/data-display/TableFilterPanel';
import ReportPrintable from '../../../components/print/ReportPrintable';
import { buildPrintFilters } from '../../../components/print/reportPrint';

const PAGE_SIZE = 10;

const PERIOD_RANGE_OPTIONS = ['MTD (Month To Date)', 'WTD (Week To Date)', 'QTD (Quarter To Date)', 'YTD (Year To Date)', 'Custom Range'];
const INCLUDE_OPTIONS = ['All Transactions', 'Receipts Only', 'Payments Only'];
const VOUCHER_TYPE_OPTIONS = ['Opening Balance', 'Receipt', 'Payment'];
const YES_NO_OPTIONS = [{ label: 'Yes', value: 'Yes' }, { label: 'No', value: 'No' }];
// Currency reads live from Currency Master instead of a hardcoded
// single-item list — see lib/currencyOptions.js.

const VOUCHER_COLORS = { 'Opening Balance': 'text.secondary', Receipt: 'success', Payment: 'error' };
const CLEARED_COLORS = { Cleared: 'success', Uncleared: 'error' };

const currency = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const currencyLakh = (v) => `${(Number(v || 0) / 100000).toFixed(2)}L`;
const formatDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '—');

function resolvePeriodRange(preset) {
  const today = dayjs();
  if (preset === 'WTD (Week To Date)') {
    const day = today.day();
    const diffToMonday = day === 0 ? 6 : day - 1;
    return { from: today.subtract(diffToMonday, 'day').startOf('day'), to: today };
  }
  if (preset === 'QTD (Quarter To Date)') {
    const quarterStartMonth = Math.floor(today.month() / 3) * 3;
    return { from: today.month(quarterStartMonth).startOf('month'), to: today };
  }
  if (preset === 'YTD (Year To Date)') {
    return { from: today.startOf('year'), to: today };
  }
  return { from: today.startOf('month'), to: today };
}

const DEFAULT_FILTERS = {
  branch: '', bankAccount: '', currency: 'INR', include: 'All Transactions', voucherType: '',
  showClearedTransactions: 'Yes',
  fromDate: resolvePeriodRange('MTD (Month To Date)').from.format('YYYY-MM-DD'),
  toDate: resolvePeriodRange('MTD (Month To Date)').to.format('YYYY-MM-DD'),
  openingBalanceAsOn: resolvePeriodRange('MTD (Month To Date)').from.subtract(1, 'day').format('YYYY-MM-DD'),
};

// Reports > Cash & Bank > Bank Book print layout — see ReportPrintable.jsx.
const PRINT_FILTER_LABELS = {
  branch: 'Branch', bankAccount: 'Bank Account', currency: 'Currency', include: 'Include', voucherType: 'Voucher Type',
  showClearedTransactions: 'Show Cleared Transactions', fromDate: 'From Date', toDate: 'To Date',
  openingBalanceAsOn: 'Opening Balance As On',
};
const PRINT_DATE_FIELDS = ['fromDate', 'toDate', 'openingBalanceAsOn'];

export default function BankBook() {
  const theme = useTheme();
  const isMobile = useIsMobileListView();

  const { data: branches } = branchApi.useList();
  const { data: houseBanks } = houseBankApi.useList();

  const branchOptions = useMemo(() => ([
    { label: 'All Branches', value: '' },
    ...(branches || []).map((b) => ({ label: b.branchName, value: b.branchName })),
  ]), [branches]);

  // Bank Account options come from HouseBank — accountType is free text
  // with no enum distinguishing "Cash" from "Bank" accounts in this
  // schema, so every HouseBank record is offered here, same as Cash Book.
  const bankAccountOptions = useMemo(() => ([
    { label: 'All Bank Accounts', value: '' },
    ...(houseBanks || []).map((b) => {
      const label = b.accountName || b.bankName;
      return { label, value: label };
    }),
  ]), [houseBanks]);

  const periodRangeOptions = useMemo(() => (
    PERIOD_RANGE_OPTIONS.map((s) => ({ label: s, value: s }))
  ), []);
  const includeOptions = useMemo(() => (
    INCLUDE_OPTIONS.map((s) => ({ label: s, value: s }))
  ), []);
  const voucherTypeOptions = useMemo(() => ([
    { label: 'All', value: '' },
    ...VOUCHER_TYPE_OPTIONS.map((s) => ({ label: s, value: s })),
  ]), []);
  const currencyOptions = useCurrencyOptions();

  const methods = useForm({
    defaultValues: {
      periodRange: 'MTD (Month To Date)',
      fromDate: resolvePeriodRange('MTD (Month To Date)').from,
      toDate: resolvePeriodRange('MTD (Month To Date)').to,
      bankAccount: '', currency: 'INR',
      branch: '', include: 'All Transactions', voucherType: '', showClearedTransactions: 'Yes',
      openingBalanceAsOn: resolvePeriodRange('MTD (Month To Date)').from.subtract(1, 'day'),
    },
  });
  const { handleSubmit, reset, watch, setValue } = methods;
  const periodRange = watch('periodRange');

  useEffect(() => {
    if (periodRange && periodRange !== 'Custom Range') {
      const { from, to } = resolvePeriodRange(periodRange);
      setValue('fromDate', from);
      setValue('toDate', to);
      setValue('openingBalanceAsOn', from.subtract(1, 'day'));
    }
  }, [periodRange, setValue]);

  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const { data, isLoading, isFetching } = useGetBankBookReportQuery(appliedFilters);
  const baseTableRows = data?.rows || [];

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'date', headerName: 'Date', filter: 'dateRange', sortValue: (row) => (row.date ? new Date(row.date).getTime() : null), searchValue: (row) => formatDate(row.date) },
    { field: 'voucherType', headerName: 'Voucher Type', filter: 'text' },
    { field: 'voucherNo', headerName: 'Voucher No.', filter: 'text' },
    { field: 'particulars', headerName: 'Particulars', filter: 'text' },
    { field: 'receipt', headerName: 'Deposits (₹)', filter: 'numberRange', sortValue: (row) => (row.receipt == null || row.receipt === '' ? null : Number(row.receipt)) },
    { field: 'payment', headerName: 'Withdrawals (₹)', filter: 'numberRange', sortValue: (row) => (row.payment == null || row.payment === '' ? null : Number(row.payment)) },
    { field: 'balance', headerName: 'Balance (₹)', filter: 'numberRange', sortValue: (row) => (row.balance == null || row.balance === '' ? null : Number(row.balance)) },
    { field: 'chequeRefNo', headerName: 'Cheque / Ref No.', filter: 'text' },
    { field: 'clearedStatus', headerName: 'Cleared Status', filter: 'text' },
    { field: 'remarks', headerName: 'Remarks', filter: 'text' },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const totals = data?.totals || {};
  const stats = data?.stats || {};
  const receiptVsPayment = data?.receiptVsPayment || [];
  const bankBalanceTrend = data?.bankBalanceTrend || [];
  const top5Transactions = data?.top5Transactions || [];
  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  // Print: full filtered/sorted rows (never just the current page), fed into
  // the shared ReportPrintable layout — see components/print/ReportPrintable.jsx.
  const printFilters = useMemo(
    () => buildPrintFilters(appliedFilters, PRINT_FILTER_LABELS, PRINT_DATE_FIELDS),
    [appliedFilters],
  );

  const onView = handleSubmit((values) => {
    setAppliedFilters({
      branch: values.branch || '',
      bankAccount: values.bankAccount || '',
      currency: values.currency || 'INR',
      include: values.include || 'All Transactions',
      voucherType: values.voucherType || '',
      showClearedTransactions: values.showClearedTransactions || 'Yes',
      fromDate: values.fromDate ? dayjs(values.fromDate).format('YYYY-MM-DD') : '',
      toDate: values.toDate ? dayjs(values.toDate).format('YYYY-MM-DD') : '',
      openingBalanceAsOn: values.openingBalanceAsOn ? dayjs(values.openingBalanceAsOn).format('YYYY-MM-DD') : '',
    });
    setPage(0);
  });

  const onReset = () => {
    const { from, to } = resolvePeriodRange('MTD (Month To Date)');
    reset({
      periodRange: 'MTD (Month To Date)', fromDate: from, toDate: to, openingBalanceAsOn: from.subtract(1, 'day'),
      bankAccount: '', currency: 'INR', branch: '', include: 'All Transactions',
      voucherType: '', showClearedTransactions: 'Yes',
    });
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  const periodLabel = useMemo(() => (
    (methods.getValues('periodRange') || 'MTD (Month To Date)').split(' ')[0]
  ), [appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const statCards = [
    { icon: <AccountBalanceWalletOutlinedIcon fontSize="small" />, label: `Opening Balance (₹) (As on ${formatDate(appliedFilters.openingBalanceAsOn)})`, value: currency(stats.openingBalance), color: 'primary' },
    { icon: <ArrowDownwardOutlinedIcon fontSize="small" />, label: `Total Receipts (₹) (${periodLabel})`, value: currency(stats.totalReceipts), color: 'success' },
    { icon: <ArrowUpwardOutlinedIcon fontSize="small" />, label: `Total Payments (₹) (${periodLabel})`, value: currency(stats.totalPayments), color: 'error' },
    { icon: <BalanceOutlinedIcon fontSize="small" />, label: `Closing Balance (₹) (As on ${formatDate(appliedFilters.toDate)})`, value: currency(stats.closingBalance), color: 'secondary' },
    { icon: <ReceiptLongOutlinedIcon fontSize="small" />, label: `No. of Transactions (${periodLabel})`, value: stats.noOfTransactions ?? 0, color: 'warning' },
    { icon: <CheckCircleOutlinedIcon fontSize="small" />, label: `Cleared Balance (₹) (As on ${formatDate(appliedFilters.toDate)})`, value: currency(stats.clearedBalance), color: 'primary' },
    { icon: <CancelOutlinedIcon fontSize="small" />, label: `Uncleared Balance (₹) (As on ${formatDate(appliedFilters.toDate)})`, value: currency(stats.unclearedBalance), color: 'error' },
  ];

  const receiptPaymentColors = [theme.palette.success.main, theme.palette.error.main];
  const chartTooltipStyle = { backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 };

  const EXPORT_COLUMNS = [
    ['date', 'Date'], ['voucherType', 'Voucher Type'], ['voucherNo', 'Voucher No.'], ['particulars', 'Particulars'],
    ['receipt', 'Deposits'], ['payment', 'Withdrawals'], ['balance', 'Balance'], ['chequeRefNo', 'Cheque / Ref No.'],
    ['clearedStatus', 'Cleared Status'], ['remarks', 'Remarks'],
  ];
  const handleExport = () => {
    const header = EXPORT_COLUMNS.map(([, label]) => label).join(',');
    const lines = baseTableRows.map((r) => EXPORT_COLUMNS.map(([key]) => {
      let v = r[key];
      if (key === 'date') v = formatDate(v);
      else if (key === 'receipt' || key === 'payment' || key === 'balance') v = v == null ? '-' : v;
      return `"${String(v ?? '').replace(/"/g, '""')}"`;
    }).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bank-book.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<AccountBalanceWalletOutlinedIcon />}
        title="Bank Book"
        subtitle="Bank receipts and payments for the selected period."
        rightContent={<CompanyBadge />}
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Filters</Typography>
          <FormProvider {...methods}>
            <Grid container spacing={2} alignItems="flex-start">
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="periodRange" label="Period Range" options={periodRangeOptions} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormDatePicker name="fromDate" label="From Date" disabled={periodRange !== 'Custom Range'} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormDatePicker name="toDate" label="To Date" disabled={periodRange !== 'Custom Range'} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="bankAccount" label="Bank Account" options={bankAccountOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="currency" label="Currency" options={currencyOptions} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="branch" label="Branch" options={branchOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="include" label="Include" options={includeOptions} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="voucherType" label="Voucher Type" options={voucherTypeOptions} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="showClearedTransactions" label="Show Cleared Transactions" options={YES_NO_OPTIONS} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormDatePicker name="openingBalanceAsOn" label="Opening Balance As On" disabled={periodRange !== 'Custom Range'} />
              </Grid>
              <Grid item xs={12}>
                <Stack direction="row" spacing={1.5} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<SearchIcon />}
                    onClick={onView}
                    disabled={isFetching}
                    sx={{ height: 40, minWidth: 130, whiteSpace: 'nowrap' }}
                  >
                    View Report
                  </Button>
                  <Button variant="outlined" color="inherit" onClick={onReset} sx={{ height: 40, minWidth: 100 }}>
                    Reset
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </FormProvider>
        </CardContent>
      </Card>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {statCards.map((c) => (
          <Grid item xs={12} sm={6} md={2} key={c.label}>
            <StatCard {...c} />
          </Grid>
        ))}
      </Grid>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ p: 0 }}>
          <TableToolbar
            title="Bank Book Register"
            searchPlaceholder="Search..."
            table={table}
            resultCount={table.rows.length}
            totalCount={table.totalCount}
            rightContent={(
              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                <Button variant="outlined" color="inherit" size="small" startIcon={<FileDownloadOutlinedIcon />} onClick={handleExport}>
                  Export
                </Button>
                <Button variant="outlined" color="inherit" size="small" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()}>
                  Print
                </Button>
              </Stack>
            )}
          />
          <TableFilterPanel table={table} />
          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {!isLoading && pagedRows.map((row, idx) => (
                <MobileRecordCard
                  key={`${row.voucherNo}-${idx}`}
                  title={row.particulars}
                  statusChip={(
                    <Typography variant="caption" fontWeight={700} sx={{ color: `${CLEARED_COLORS[row.clearedStatus] || 'text.primary'}.main` }}>{row.clearedStatus}</Typography>
                  )}
                  fields={[
                    { label: '#', value: page * pageSize + idx + 1 },
                    { label: 'Date', value: formatDate(row.date) },
                    { label: 'Voucher Type', value: row.voucherType },
                    { label: 'Voucher No.', value: row.voucherNo },
                    { label: 'Deposits (₹)', value: row.receipt != null ? currency(row.receipt) : '—' },
                    { label: 'Withdrawals (₹)', value: row.payment != null ? currency(row.payment) : '—' },
                    { label: 'Balance (₹)', value: currency(row.balance) },
                    { label: 'Cheque / Ref No.', value: row.chequeRefNo },
                    { label: 'Remarks', value: row.remarks },
                  ]}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<AccountBalanceWalletOutlinedIcon sx={{ fontSize: 48 }} />} title="No bank book entries found for the selected criteria" message="Try adjusting your date range or filters" />
                )
              )}
              {!isLoading && rows.length > 0 && (
                <Card variant="outlined" sx={{ mb: 1.5, bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Total</Typography>
                    <Stack spacing={0.75}>
                      {[
                        ['Deposits (₹)', currency(totals.receipt)], ['Withdrawals (₹)', currency(totals.payment)],
                      ].map(([label, value]) => (
                        <Stack key={label} direction="row" justifyContent="space-between">
                          <Typography variant="caption" color="text.secondary">{label}</Typography>
                          <Typography variant="body2" fontWeight={700}>{value}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <SortableHeaderCell field="date" sort={table.sort} onSort={table.toggleSort}>Date</SortableHeaderCell>
                    <SortableHeaderCell field="voucherType" sort={table.sort} onSort={table.toggleSort}>Voucher Type</SortableHeaderCell>
                    <SortableHeaderCell field="voucherNo" sort={table.sort} onSort={table.toggleSort}>Voucher No.</SortableHeaderCell>
                    <SortableHeaderCell field="particulars" sort={table.sort} onSort={table.toggleSort}>Particulars</SortableHeaderCell>
                    <SortableHeaderCell field="receipt" sort={table.sort} onSort={table.toggleSort} align="right">Deposits (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="payment" sort={table.sort} onSort={table.toggleSort} align="right">Withdrawals (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="balance" sort={table.sort} onSort={table.toggleSort} align="right">Balance (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="chequeRefNo" sort={table.sort} onSort={table.toggleSort}>Cheque / Ref No.</SortableHeaderCell>
                    <SortableHeaderCell field="clearedStatus" sort={table.sort} onSort={table.toggleSort}>Cleared Status</SortableHeaderCell>
                    <SortableHeaderCell field="remarks" sort={table.sort} onSort={table.toggleSort}>Remarks</SortableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={`${row.voucherNo}-${i}`} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.date)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" fontWeight={700} sx={{ color: `${VOUCHER_COLORS[row.voucherType] || 'text.primary'}.main` }}>{row.voucherType}</Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" fontWeight={700} color="primary.main">{row.voucherNo}</Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 160 }}>{row.particulars}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{row.receipt != null ? currency(row.receipt) : '—'}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{row.payment != null ? currency(row.payment) : '—'}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.balance)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.chequeRefNo}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700} sx={{ color: `${CLEARED_COLORS[row.clearedStatus] || 'text.primary'}.main` }}>{row.clearedStatus}</Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.remarks}</TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11}>
                        {isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<AccountBalanceWalletOutlinedIcon sx={{ fontSize: 48 }} />} title="No bank book entries found for the selected criteria" message="Try adjusting your date range or filters" />
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && rows.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={5}><Typography fontWeight={700}>Total</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.receipt)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.payment)}</Typography></TableCell>
                      <TableCell>—</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell>—</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollableTableContainer>
          )}

          <EntityListPagination total={rows.length} page={page} onChange={setPage} pageSize={pageSize} onPageSizeChange={(v) => { setPageSize(v); setPage(0); }} />
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Receipts vs Payments ({periodLabel})</Typography>
              <Box sx={{ width: '100%', height: 180, position: 'relative' }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={receiptVsPayment} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                      {receiptVsPayment.map((entry, i) => <Cell key={entry.name} fill={receiptPaymentColors[i % receiptPaymentColors.length]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => currency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <Typography variant="caption" color="text.secondary" display="block">Net Inflow</Typography>
                  <Typography variant="subtitle2" fontWeight={700}>{currency((stats.totalReceipts || 0) - (stats.totalPayments || 0))}</Typography>
                </Box>
              </Box>
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {receiptVsPayment.map((d, i) => (
                  <Stack key={d.name} direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: receiptPaymentColors[i % receiptPaymentColors.length], flexShrink: 0 }} />
                      <Typography variant="caption" color="text.secondary" noWrap>{d.name}</Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">{currency(d.value)} ({d.percent}%)</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Bank Balance Trend (Last 7 Days)</Typography>
              <Box sx={{ width: '100%', height: 300, mt: 1 }}>
                <ResponsiveContainer>
                  <LineChart data={bankBalanceTrend} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} tickFormatter={(v) => currencyLakh(v)} />
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => currency(v)} />
                    <Line type="monotone" dataKey="value" stroke={theme.palette.primary.main} strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Top 5 Transactions ({periodLabel})</Typography>
              <Box sx={{ width: '100%', height: 260, mt: 1 }}>
                <ResponsiveContainer>
                  <BarChart data={top5Transactions} layout="vertical" margin={{ top: 5, right: 50, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 9, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => currency(v)} />
                    <Bar dataKey="value" fill={theme.palette.primary.main} radius={[0, 4, 4, 0]} maxBarSize={18}>
                      <LabelList dataKey="value" position="right" formatter={(v) => currency(v)} style={{ fontSize: 9, fill: theme.palette.text.secondary }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Print: the FULL set of rows matching the applied Filters section
          (baseTableRows = data.rows straight off the API), never `rows`
          (which is additionally narrowed by the toolbar's quick search box
          and column filter popover). Those two are on-screen/CSV
          conveniences for finding a row quickly -- they shouldn't silently
          drop rows from what's meant to be a full printed report. `totals`
          already comes from data.totals (server-side, full applied-Filters
          dataset), so it was never affected by search/column-filter either. */}
      <ReportPrintable
        title="Bank Book"
        subtitle="Bank deposits, withdrawals and running balance for the selected period."
        filters={printFilters}
        columns={tableColumns}
        rows={baseTableRows}
        totals={totals}
        totalsLabel="Total"
        orientation="landscape"
      />
    </Box>
  );
}
