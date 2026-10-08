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
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
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
import { useGetDepositRegisterReportQuery } from '../../../features/banking/depositRegisterReportApi';
import useTableFeatures from '../../../components/data-display/useTableFeatures';
import TableToolbar from '../../../components/data-display/TableToolbar';
import SortableHeaderCell from '../../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import TableFilterPanel from '../../../components/data-display/TableFilterPanel';
import ReportPrintable from '../../../components/print/ReportPrintable';
import { buildPrintFilters } from '../../../components/print/reportPrint';

const PAGE_SIZE = 10;

const PERIOD_RANGE_OPTIONS = ['MTD (Month To Date)', 'WTD (Week To Date)', 'QTD (Quarter To Date)', 'YTD (Year To Date)', 'Custom Range'];
// Deposit Type reflects the real BankDeposit.depositType field — the deposit
// slip's payment composition (Cash/Cheque/Bank Transfer/Mixed), not a
// Fixed/Recurring Deposit product type (no such model exists in this
// schema — see the route comment in resources.js).
const DEPOSIT_TYPE_OPTIONS = ['Cash', 'Cheque', 'Bank Transfer', 'Mixed'];
const INCLUDE_OPTIONS = ['All Deposits', 'Posted Only', 'Draft Only'];
const YES_NO_OPTIONS = [{ label: 'No', value: 'No' }, { label: 'Yes', value: 'Yes' }];
// Currency reads live from Currency Master instead of a hardcoded
// single-item list — see lib/currencyOptions.js.

const currency = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const currencyLakh = (v) => `${(Number(v || 0) / 100000).toFixed(2)}L`;
const formatDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '—');
// Term-deposit fields are null on ordinary deposit slips, so they render as
// "—" rather than 0 — a blank rate must not read as a 0% one.
const percent = (v) => (v == null ? '—' : `${Number(v).toFixed(2)}`);

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
  branch: '', account: '', depositType: '', currency: 'INR', include: 'All Deposits',
  showCancelledDeposits: 'No',
  fromDate: resolvePeriodRange('MTD (Month To Date)').from.format('YYYY-MM-DD'),
  toDate: resolvePeriodRange('MTD (Month To Date)').to.format('YYYY-MM-DD'),
};

// Reports > Cash & Bank > Deposit Register print layout — see ReportPrintable.jsx.
const PRINT_FILTER_LABELS = {
  branch: 'Branch', account: 'Account', depositType: 'Deposit Type', currency: 'Currency', include: 'Include',
  showCancelledDeposits: 'Show Cancelled Deposits', fromDate: 'From Date', toDate: 'To Date',
};
const PRINT_DATE_FIELDS = ['fromDate', 'toDate'];

export default function DepositRegister() {
  const theme = useTheme();
  const isMobile = useIsMobileListView();

  const { data: branches } = branchApi.useList();
  const { data: houseBanks } = houseBankApi.useList();

  const branchOptions = useMemo(() => ([
    { label: 'All Branches', value: '' },
    ...(branches || []).map((b) => ({ label: b.branchName, value: b.branchName })),
  ]), [branches]);

  const accountOptions = useMemo(() => ([
    { label: 'All Accounts', value: '' },
    ...(houseBanks || []).map((b) => {
      const label = b.accountName || b.bankName;
      return { label, value: label };
    }),
  ]), [houseBanks]);

  const periodRangeOptions = useMemo(() => (
    PERIOD_RANGE_OPTIONS.map((s) => ({ label: s, value: s }))
  ), []);
  const depositTypeOptions = useMemo(() => ([
    { label: 'All', value: '' },
    ...DEPOSIT_TYPE_OPTIONS.map((s) => ({ label: s, value: s })),
  ]), []);
  const includeOptions = useMemo(() => (
    INCLUDE_OPTIONS.map((s) => ({ label: s, value: s }))
  ), []);
  const currencyOptions = useCurrencyOptions();

  const methods = useForm({
    defaultValues: {
      periodRange: 'MTD (Month To Date)',
      fromDate: resolvePeriodRange('MTD (Month To Date)').from,
      toDate: resolvePeriodRange('MTD (Month To Date)').to,
      branch: '', account: '', depositType: '', currency: 'INR',
      include: 'All Deposits', showCancelledDeposits: 'No',
    },
  });
  const { handleSubmit, reset, watch, setValue } = methods;
  const periodRange = watch('periodRange');

  useEffect(() => {
    if (periodRange && periodRange !== 'Custom Range') {
      const { from, to } = resolvePeriodRange(periodRange);
      setValue('fromDate', from);
      setValue('toDate', to);
    }
  }, [periodRange, setValue]);

  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const { data, isLoading, isFetching } = useGetDepositRegisterReportQuery(appliedFilters);
  const baseTableRows = data?.rows || [];

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'date', headerName: 'Date', filter: 'dateRange', sortValue: (row) => (row.date ? new Date(row.date).getTime() : null), searchValue: (row) => formatDate(row.date) },
    { field: 'depositNo', headerName: 'Deposit No.', filter: 'text' },
    { field: 'accountName', headerName: 'Account Name', filter: 'text' },
    { field: 'depositType', headerName: 'Deposit Type', filter: 'text' },
    { field: 'amount', headerName: 'Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.amount == null || row.amount === '' ? null : Number(row.amount)) },
    { field: 'interestRate', headerName: 'Interest Rate (%)', filter: 'numberRange', sortValue: (row) => (row.interestRate == null ? null : Number(row.interestRate)) },
    { field: 'maturityDate', headerName: 'Maturity Date', filter: 'dateRange', sortValue: (row) => (row.maturityDate ? new Date(row.maturityDate).getTime() : null), searchValue: (row) => formatDate(row.maturityDate) },
    { field: 'maturityAmount', headerName: 'Maturity Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.maturityAmount == null ? null : Number(row.maturityAmount)) },
    { field: 'referenceNo', headerName: 'Reference No.', filter: 'text' },
    { field: 'remarks', headerName: 'Remarks', filter: 'text' },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const totals = data?.totals || {};
  const stats = data?.stats || {};
  const depositTypeSummary = data?.depositTypeSummary || [];
  const depositTrend = data?.depositTrend || [];
  const top5AccountsByDeposit = data?.top5AccountsByDeposit || [];
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
      account: values.account || '',
      depositType: values.depositType || '',
      currency: values.currency || 'INR',
      include: values.include || 'All Deposits',
      showCancelledDeposits: values.showCancelledDeposits || 'No',
      fromDate: values.fromDate ? dayjs(values.fromDate).format('YYYY-MM-DD') : '',
      toDate: values.toDate ? dayjs(values.toDate).format('YYYY-MM-DD') : '',
    });
    setPage(0);
  });

  const onReset = () => {
    const { from, to } = resolvePeriodRange('MTD (Month To Date)');
    reset({
      periodRange: 'MTD (Month To Date)', fromDate: from, toDate: to,
      branch: '', account: '', depositType: '', currency: 'INR',
      include: 'All Deposits', showCancelledDeposits: 'No',
    });
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  const periodLabel = useMemo(() => (
    (methods.getValues('periodRange') || 'MTD (Month To Date)').split(' ')[0]
  ), [appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Opening/Closing Balance are point-in-time figures, so they're labelled
  // with the actual boundary dates of the applied period rather than the
  // period preset the other cards use.
  const openingAsOnLabel = formatDate(appliedFilters.fromDate);
  const closingAsOnLabel = formatDate(appliedFilters.toDate);

  const statCards = [
    { icon: <AccountBalanceOutlinedIcon fontSize="small" />, label: `Opening Balance (₹) (As on ${openingAsOnLabel})`, value: currency(stats.openingBalance), color: 'primary' },
    { icon: <ReceiptLongOutlinedIcon fontSize="small" />, label: `Total Deposits (₹) (${periodLabel})`, value: currency(stats.totalDeposits), color: 'success' },
    { icon: <ArrowUpwardIcon fontSize="small" />, label: `Total Withdrawals (₹) (${periodLabel})`, value: currency(stats.totalWithdrawals), color: 'error' },
    { icon: <AccountBalanceWalletOutlinedIcon fontSize="small" />, label: `Closing Balance (₹) (As on ${closingAsOnLabel})`, value: currency(stats.closingBalance), color: 'secondary' },
    { icon: <DescriptionOutlinedIcon fontSize="small" />, label: `No. of Deposits (${periodLabel})`, value: stats.noOfDeposits ?? 0, color: 'warning' },
    { icon: <PaymentsOutlinedIcon fontSize="small" />, label: `Cash Deposits (₹) (${periodLabel})`, value: currency(stats.cashDeposits), color: 'success' },
    { icon: <SavingsOutlinedIcon fontSize="small" />, label: `Cheque Deposits (₹) (${periodLabel})`, value: currency(stats.chequeDeposits), color: 'secondary' },
    { icon: <AccountBalanceOutlinedIcon fontSize="small" />, label: `Bank Transfer Deposits (₹) (${periodLabel})`, value: currency(stats.bankTransferDeposits), color: 'primary' },
  ];

  const donutColors = [
    theme.palette.success.main, theme.palette.primary.main, theme.palette.secondary.main, theme.palette.warning.main,
  ];
  const chartTooltipStyle = { backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 };

  const EXPORT_COLUMNS = [
    ['date', 'Date'], ['depositNo', 'Deposit No.'], ['accountName', 'Account Name'], ['depositType', 'Deposit Type'],
    ['amount', 'Amount'], ['interestRate', 'Interest Rate (%)'], ['maturityDate', 'Maturity Date'],
    ['maturityAmount', 'Maturity Amount'],
    ['referenceNo', 'Reference No.'], ['remarks', 'Remarks'],
  ];
  const handleExport = () => {
    const header = EXPORT_COLUMNS.map(([, label]) => label).join(',');
    const lines = baseTableRows.map((r) => EXPORT_COLUMNS.map(([key]) => {
      let v = r[key];
      if (key === 'date' || key === 'maturityDate') v = formatDate(v);
      return `"${String(v ?? '').replace(/"/g, '""')}"`;
    }).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deposit-register.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<SavingsOutlinedIcon />}
        title="Deposit Register"
        subtitle="All deposits made to bank accounts in the selected period."
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
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="branch" label="Branch" options={branchOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="currency" label="Currency" options={currencyOptions} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="account" label="Account" options={accountOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="depositType" label="Deposit Type" options={depositTypeOptions} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="include" label="Include" options={includeOptions} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="showCancelledDeposits" label="Show Cancelled Deposits" options={YES_NO_OPTIONS} />
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
          <Grid item xs={12} sm={6} md={2.4} key={c.label}>
            <StatCard {...c} />
          </Grid>
        ))}
      </Grid>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ p: 0 }}>
          <TableToolbar
            title="Deposit Register List"
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
                  key={row.id}
                  title={row.accountName}
                  fields={[
                    { label: '#', value: page * pageSize + idx + 1 },
                    { label: 'Date', value: formatDate(row.date) },
                    { label: 'Deposit No.', value: row.depositNo },
                    { label: 'Deposit Type', value: row.depositType },
                    { label: 'Amount (₹)', value: currency(row.amount) },
                    { label: 'Interest Rate (%)', value: percent(row.interestRate) },
                    { label: 'Maturity Date', value: formatDate(row.maturityDate) },
                    { label: 'Maturity Amount (₹)', value: row.maturityAmount == null ? '—' : currency(row.maturityAmount) },
                    { label: 'Reference No.', value: row.referenceNo },
                    { label: 'Remarks', value: row.remarks },
                  ]}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<AccountBalanceWalletOutlinedIcon sx={{ fontSize: 48 }} />} title="No deposits found for the selected criteria" message="Try adjusting your date range or filters" />
                )
              )}
              {!isLoading && rows.length > 0 && (
                <Card variant="outlined" sx={{ mb: 1.5, bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Total</Typography>
                    <Stack spacing={0.75}>
                      {[
                        ['Amount (₹)', currency(totals.amount)],
                        ['Maturity Amount (₹)', currency(totals.maturityAmount)],
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
                    <SortableHeaderCell field="depositNo" sort={table.sort} onSort={table.toggleSort}>Deposit No.</SortableHeaderCell>
                    <SortableHeaderCell field="accountName" sort={table.sort} onSort={table.toggleSort}>Account Name</SortableHeaderCell>
                    <SortableHeaderCell field="depositType" sort={table.sort} onSort={table.toggleSort}>Deposit Type</SortableHeaderCell>
                    <SortableHeaderCell field="amount" sort={table.sort} onSort={table.toggleSort} align="right">Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="interestRate" sort={table.sort} onSort={table.toggleSort} align="right">Interest Rate (%)</SortableHeaderCell>
                    <SortableHeaderCell field="maturityDate" sort={table.sort} onSort={table.toggleSort}>Maturity Date</SortableHeaderCell>
                    <SortableHeaderCell field="maturityAmount" sort={table.sort} onSort={table.toggleSort} align="right">Maturity Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="referenceNo" sort={table.sort} onSort={table.toggleSort}>Reference No.</SortableHeaderCell>
                    <SortableHeaderCell field="remarks" sort={table.sort} onSort={table.toggleSort}>Remarks</SortableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.date)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" fontWeight={700} color="primary.main">{row.depositNo}</Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.accountName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.depositType}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.amount)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{percent(row.interestRate)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.maturityDate)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{row.maturityAmount == null ? '—' : currency(row.maturityAmount)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.referenceNo}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.remarks}</TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={12}>
                        {isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<AccountBalanceWalletOutlinedIcon sx={{ fontSize: 48 }} />} title="No deposits found for the selected criteria" message="Try adjusting your date range or filters" />
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && rows.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={5}><Typography fontWeight={700}>Total</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.amount)}</Typography></TableCell>
                      <TableCell align="right">—</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.maturityAmount)}</Typography></TableCell>
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Deposit Type Summary ({periodLabel})</Typography>
              <Box sx={{ width: '100%', height: 180, position: 'relative' }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={depositTypeSummary} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                      {depositTypeSummary.map((entry, i) => <Cell key={entry.name} fill={donutColors[i % donutColors.length]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => currency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <Typography variant="caption" color="text.secondary" display="block">Total</Typography>
                  <Typography variant="subtitle2" fontWeight={700}>{currency(stats.totalDeposits)}</Typography>
                </Box>
              </Box>
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {depositTypeSummary.map((d, i) => (
                  <Stack key={d.name} direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: donutColors[i % donutColors.length], flexShrink: 0 }} />
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Deposit Trend (Last 7 Days)</Typography>
              <Box sx={{ width: '100%', height: 300, mt: 1 }}>
                <ResponsiveContainer>
                  <LineChart data={depositTrend} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Top 5 Accounts by Deposit Amount ({periodLabel})</Typography>
              <Box sx={{ width: '100%', height: 260, mt: 1 }}>
                <ResponsiveContainer>
                  <BarChart data={top5AccountsByDeposit} layout="vertical" margin={{ top: 5, right: 50, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 9, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => currency(v)} />
                    <Bar dataKey="value" fill={theme.palette.success.main} radius={[0, 4, 4, 0]} maxBarSize={18}>
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
        title="Deposit Register"
        subtitle="Fixed and other deposits placed during the selected period."
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
