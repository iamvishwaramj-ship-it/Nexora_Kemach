import React, { useMemo, useState } from 'react';
import LoadingState from '../../../components/feedback/LoadingState';
import EmptyState from '../../../components/data-display/EmptyState';
import {
  Box, Typography, Button, Card, CardContent, Stack, Grid, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, MenuItem, Collapse,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip,
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, LabelList,
} from 'recharts';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import PhoneAndroidOutlinedIcon from '@mui/icons-material/PhoneAndroidOutlined';
import dayjs from 'dayjs';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import CompanyBadge from '../../../components/common/CompanyBadge';
import EntityListPagination from '../../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../../components/data-display/useIsMobileListView';
import StatCard from '../../../components/data-display/StatCard';
import { useGetPaymentRegisterReportQuery } from '../../../features/payables/paymentRegisterReportApi';
import { chartOfAccountApi } from '../../../features/resources';
import useTableFeatures from '../../../components/data-display/useTableFeatures';
import TableToolbar from '../../../components/data-display/TableToolbar';
import SortableHeaderCell from '../../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import TableFilterPanel from '../../../components/data-display/TableFilterPanel';
import { downloadXlsx } from '../../../lib/simpleXlsx';
import ReportPrintable from '../../../components/print/ReportPrintable';
import { buildPrintFilters } from '../../../components/print/reportPrint';

const PAGE_SIZE = 10;

const currency = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const currencyLakh = (v) => `${(Number(v || 0) / 100000).toFixed(2)}L`;
const formatDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '—');

// The page-level filter card was removed: filtering now lives in the table's
// own Filter panel (above the item-detail table). Vendor / Account switches the
// dataset on the server; the rest are column filters on the rows.
// Every payment document is listed (all statuses, nothing hidden); the totals
// and stat cards count only Posted payments that settle purchase invoices,
// which keeps them reconciled with the dashboard's "Total Payables" card —
// see the route comment in backend resources.js.
const PARTY_TYPE_OPTIONS = ['Vendor', 'Account'];
const PAYMENT_MODE_OPTIONS = ['Cash', 'Cheque', 'Bank Transfer'];
const DEFAULT_FILTERS = { include: 'All Payments' };

// Reports > Payable > Payment Register print layout — see ReportPrintable.jsx.
const PRINT_FILTER_LABELS = { partyType: 'Vendor / Account' };
const PRINT_DATE_FIELDS = [];

export default function PaymentRegister() {
  const theme = useTheme();
  const isMobile = useIsMobileListView();

  const [partyType, setPartyType] = useState('Vendor');
  const appliedFilters = useMemo(() => ({ ...DEFAULT_FILTERS, partyType }), [partyType]);
  const isAccount = partyType === 'Account';
  const codeField = isAccount ? 'accountCode' : 'supplierCode';
  const nameField = isAccount ? 'accountName' : 'supplierName';
  const codeLabel = isAccount ? 'Account Code' : 'Supplier Code';
  const nameLabel = isAccount ? 'Account Name' : 'Supplier Name';
  const partyWord = isAccount ? 'Accounts' : 'Suppliers';
  const periodLabel = 'All Time';
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const { data, isLoading, isFetching } = useGetPaymentRegisterReportQuery(appliedFilters);

  // Account Code filter is a pick-from-list dropdown fed by the same Chart of
  // Accounts list the Payment Voucher uses — posting accounts only (Nature 'A'),
  // never Title/heading accounts or inactive ones.
  const { data: chartOfAccounts } = chartOfAccountApi.useList();
  const accountCodeOptions = useMemo(
    () => (chartOfAccounts || [])
      .filter((a) => a.accountNature === 'A' && a.status !== 'I')
      .map((a) => ({ label: `${a.accountName} (${a.accountCode})`, value: a.accountCode })),
    [chartOfAccounts],
  );
  const baseTableRows = data?.rows || [];

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'paymentNo', headerName: 'Payment No.', filter: false },
    { field: 'paymentDate', headerName: 'Payment Date', filter: 'dateRange', sortValue: (row) => (row.paymentDate ? new Date(row.paymentDate).getTime() : null), searchValue: (row) => formatDate(row.paymentDate) },
    isAccount
      ? { field: codeField, headerName: codeLabel, filter: 'select', filterInput: 'autocomplete', filterOptions: accountCodeOptions }
      : { field: codeField, headerName: codeLabel, filter: 'text' },
    { field: nameField, headerName: nameLabel, filter: 'select' },
    { field: 'paymentMode', headerName: 'Payment Mode', filter: 'select', filterOptions: PAYMENT_MODE_OPTIONS },
    { field: 'referenceNo', headerName: 'Reference No.', filter: false },
    { field: 'bankName', headerName: 'Bank Name / UTR No.', filter: false },
    { field: 'invoiceAmount', headerName: 'Invoice Amount (₹)', filter: false, sortValue: (row) => (row.invoiceAmount == null || row.invoiceAmount === '' ? null : Number(row.invoiceAmount)) },
    { field: 'paymentAmount', headerName: 'Payment Amount (₹)', filter: false, sortValue: (row) => (row.paymentAmount == null || row.paymentAmount === '' ? null : Number(row.paymentAmount)) },
    { field: 'discount', headerName: 'Discount (₹)', filter: false, sortValue: (row) => (row.discount == null || row.discount === '' ? null : Number(row.discount)) },
    { field: 'netPaid', headerName: 'Net Paid (₹)', filter: false, sortValue: (row) => (row.netPaid == null || row.netPaid === '' ? null : Number(row.netPaid)) },
    { field: 'paidBy', headerName: 'Paid By', filter: false },
    { field: 'status', headerName: 'Status', filter: false },
  ]), [codeField, nameField, codeLabel, nameLabel, isAccount, accountCodeOptions]);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  // Totals follow the table's own filters and count only Posted payments that
  // settle purchase invoices (equal to the backend totals when nothing is
  // filtered, and to the dashboard's Total Payables).
  const totals = useMemo(() => rows.filter((r) => r.counted).reduce((acc, r) => ({
    invoiceAmount: acc.invoiceAmount + Number(r.invoiceAmount || 0),
    paymentAmount: acc.paymentAmount + Number(r.paymentAmount || 0),
    discount: acc.discount + Number(r.discount || 0),
    netPaid: acc.netPaid + Number(r.netPaid || 0),
  }), { invoiceAmount: 0, paymentAmount: 0, discount: 0, netPaid: 0 }), [rows]);
  const stats = data?.stats || {};
  const paymentByPaymentMode = data?.paymentByPaymentMode || [];
  const paymentTrend = data?.paymentTrend || [];
  const top5SuppliersByPayment = data?.top5SuppliersByPayment || [];
  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  // Print: full filtered/sorted rows (never just the current page), fed into
  // the shared ReportPrintable layout — see components/print/ReportPrintable.jsx.
  const printFilters = useMemo(
    () => buildPrintFilters(appliedFilters, PRINT_FILTER_LABELS, PRINT_DATE_FIELDS),
    [appliedFilters],
  );

  const totalForPct = stats.totalPayments || 1;
  const pct = (v) => Math.round((Number(v || 0) / totalForPct) * 1000) / 10;

  const statCards = [
    { icon: <PaymentsOutlinedIcon fontSize="small" />, label: 'Total Payments', value: currency(stats.totalPayments), color: 'success' },
    { icon: <ReceiptLongOutlinedIcon fontSize="small" />, label: `Total Payment Transactions (${periodLabel})`, value: stats.totalPaymentTransactions ?? 0, color: 'primary' },
    { icon: <PersonOutlinedIcon fontSize="small" />, label: `${partyWord} Paid (${periodLabel})`, value: stats.suppliersPaid ?? 0, color: 'warning' },
    { icon: <AccountBalanceOutlinedIcon fontSize="small" />, label: `Payment by Bank (${pct(stats.bankAmount)}%)`, value: currency(stats.bankAmount), color: 'secondary' },
    { icon: <SavingsOutlinedIcon fontSize="small" />, label: `Payment by Cash (${pct(stats.cashAmount)}%)`, value: currency(stats.cashAmount), color: 'primary' },
    { icon: <PhoneAndroidOutlinedIcon fontSize="small" />, label: `Payment by UPI (${pct(stats.upiAmount)}%)`, value: currency(stats.upiAmount), color: 'error' },
  ];

  const donutColors = [
    theme.palette.primary.main, theme.palette.success.main, theme.palette.warning.main,
    theme.palette.secondary.main, theme.palette.error.main, theme.palette.grey[400],
  ];
  const chartTooltipStyle = { backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 };

  // Export: current filtered rows to CSV — same client-side pattern used
  // elsewhere.
  const EXPORT_COLUMNS = [
    ['paymentNo', 'Payment No.'], ['paymentDate', 'Payment Date'], [codeField, codeLabel], [nameField, nameLabel],
    ['paymentMode', 'Payment Mode'], ['referenceNo', 'Reference No.'], ['bankName', 'Bank Name / UTR No.'],
    ['invoiceAmount', 'Invoice Amount'], ['paymentAmount', 'Payment Amount'], ['discount', 'Discount'], ['netPaid', 'Net Paid'], ['paidBy', 'Paid By'], ['status', 'Status'],
  ];
  const handleExport = () => {
    const header = EXPORT_COLUMNS.map(([, label]) => label).join(',');
    const lines = baseTableRows.map((r) => EXPORT_COLUMNS.map(([key]) => {
      let v = r[key];
      if (key === 'paymentDate') v = formatDate(v);
      return `"${String(v ?? '').replace(/"/g, '""')}"`;
    }).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'payment-register.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download: Excel in the ledger layout of the "PETTY ..." template
  // (Posting Date, Due Date, Series, Doc. No., Ref. 3, Trans. No., Offset Acct,
  // Remarks, Credit (LC), Branch Name) followed by the remaining register
  // fields so nothing on screen is missing. Uses the full filtered/sorted rows.
  const handleDownload = () => {
    const xd = (d) => (d ? dayjs(d).format('DD/MM/YY') : '');
    const dates = baseTableRows.map((r) => r.paymentDate).filter(Boolean).map((d) => dayjs(d)).sort((a, b) => a.valueOf() - b.valueOf());
    const fromL = dates.length ? dates[0].format('DD-MM-YY') : '';
    const toL = dates.length ? dates[dates.length - 1].format('DD-MM-YY') : '';
    const H = (v) => ({ v, s: 4 });
    const num = (v) => ({ v: Number(v || 0), s: 2 });
    const body = baseTableRows.map((r) => {
      const name = r[nameField] && r[nameField] !== 'Unknown' ? r[nameField] : '';
      const dash = (v) => (v && v !== '—' ? v : '');
      return [
        xd(r.paymentDate), xd(r.dueDate || r.paymentDate),
        (String(r.paymentNo || '').match(/^[A-Za-z]+/) || [''])[0],
        dash(r.paymentNo), dash(r.paymentMode), r.transNo === '' || r.transNo == null ? '' : r.transNo,
        dash(r[codeField]), [name, r.remarks].filter(Boolean).join(' - '), num(r.paymentAmount), r.branch || '',
        dash(r.referenceNo), dash(r.bankName), num(r.invoiceAmount), num(r.discount), num(r.netPaid), dash(r.paidBy), r.status || '',
      ];
    });
    const T = (v) => ({ v, s: 3 });
    const sheetRows = [
      ['Posting Date', 'Due Date', 'Series', 'Doc. No.', 'Ref. 3 (Row)', 'Trans. No.', 'Offset Acct', 'Remarks', 'Credit (LC)', 'Branch Name',
        'Reference No.', 'Bank Name / UTR No.', 'Invoice Amount', 'Discount', 'Net Paid', 'Paid By', 'Status'].map(H),
      [{ v: isAccount ? 'Account' : 'Vendor', s: 1 }, null, null, null, null, null, null, { v: `Payment Register (${isAccount ? 'Accounts' : 'Suppliers'})`, s: 1 }],
      ...body,
      [null, null, null, null, null, null, null, { v: 'TOTAL', s: 1 }, T(totals.paymentAmount), null, null, null, T(totals.invoiceAmount), T(totals.discount), T(totals.netPaid)],
      [],
      [null, null, null, null, null, null, null, null, null, { v: '……………………………………….' }],
    ];
    downloadXlsx(`PAYMENT REGISTER ${fromL}${fromL ? ' TO ' : ''}${toL}`.trim() + '.xlsx', {
      sheetName: 'Sheet1',
      colWidths: [14, 14, 12, 16, 14, 11, 15, 52, 14, 14, 18, 22, 15, 12, 14, 16, 12],
      rows: sheetRows,
    });
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<PaymentsOutlinedIcon />}
        title="Payment Register"
        subtitle="All payments made in the selected period."
        rightContent={<CompanyBadge />}
      />

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
            title="Payment Register List"
            searchPlaceholder="Search..."
            table={table}
            resultCount={table.rows.length}
            totalCount={table.totalCount}
            rightContent={(
              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                <Button variant="outlined" color="inherit" size="small" startIcon={<FileDownloadOutlinedIcon />} onClick={handleExport}>
                  Export
                </Button>
                <Button variant="outlined" color="inherit" size="small" startIcon={<FileDownloadOutlinedIcon />} onClick={handleDownload}>
                  Download
                </Button>
                <Button variant="outlined" color="inherit" size="small" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()}>
                  Print
                </Button>
              </Stack>
            )}
          />
          <Collapse in={table.filterPanelOpen} unmountOnExit>
            <Box sx={{ px: { xs: 2, sm: 3 }, pb: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    select size="small" fullWidth label="Vendor / Account"
                    value={partyType}
                    onChange={(e) => { setPartyType(e.target.value); table.clearFilters(); }}
                    InputLabelProps={{ shrink: true }}
                  >
                    {PARTY_TYPE_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                  </TextField>
                </Grid>
              </Grid>
              <TableFilterPanel table={table} embedded open />
            </Box>
          </Collapse>
          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {!isLoading && pagedRows.map((row, idx) => (
                <MobileRecordCard
                  key={row.id}
                  title={row[nameField]}
                  fields={[
                    { label: '#', value: page * pageSize + idx + 1 },
                    { label: 'Payment No.', value: row.paymentNo },
                    { label: 'Payment Date', value: formatDate(row.paymentDate) },
                    { label: codeLabel, value: row[codeField] },
                    { label: 'Payment Mode', value: row.paymentMode },
                    { label: 'Reference No.', value: row.referenceNo },
                    { label: 'Bank Name / UTR No.', value: row.bankName },
                    { label: 'Invoice Amount', value: currency(row.invoiceAmount) },
                    { label: 'Payment Amount', value: currency(row.paymentAmount) },
                    { label: 'Discount', value: currency(row.discount) },
                    { label: 'Net Paid', value: currency(row.netPaid) },
                    { label: 'Paid By', value: row.paidBy },
                    { label: 'Status', value: row.status },
                  ]}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<PaymentsOutlinedIcon sx={{ fontSize: 48 }} />} title="No payments found for the selected criteria" message="Try adjusting your date range or filters" />
                )
              )}
              {!isLoading && rows.length > 0 && (
                <Card variant="outlined" sx={{ mb: 1.5, bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Total</Typography>
                    <Stack spacing={0.75}>
                      {[
                        ['Invoice Amount', currency(totals.invoiceAmount)], ['Payment Amount', currency(totals.paymentAmount)],
                        ['Discount', currency(totals.discount)], ['Net Paid', currency(totals.netPaid)],
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
                    <SortableHeaderCell field="paymentNo" sort={table.sort} onSort={table.toggleSort}>Payment No.</SortableHeaderCell>
                    <SortableHeaderCell field="paymentDate" sort={table.sort} onSort={table.toggleSort}>Payment Date</SortableHeaderCell>
                    <SortableHeaderCell field={codeField} sort={table.sort} onSort={table.toggleSort}>{codeLabel}</SortableHeaderCell>
                    <SortableHeaderCell field={nameField} sort={table.sort} onSort={table.toggleSort}>{nameLabel}</SortableHeaderCell>
                    <SortableHeaderCell field="paymentMode" sort={table.sort} onSort={table.toggleSort}>Payment Mode</SortableHeaderCell>
                    <SortableHeaderCell field="referenceNo" sort={table.sort} onSort={table.toggleSort}>Reference No.</SortableHeaderCell>
                    <SortableHeaderCell field="bankName" sort={table.sort} onSort={table.toggleSort}>Bank Name / UTR No.</SortableHeaderCell>
                    <SortableHeaderCell field="invoiceAmount" sort={table.sort} onSort={table.toggleSort} align="right">Invoice Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="paymentAmount" sort={table.sort} onSort={table.toggleSort} align="right">Payment Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="discount" sort={table.sort} onSort={table.toggleSort} align="right">Discount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="netPaid" sort={table.sort} onSort={table.toggleSort} align="right">Net Paid (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="paidBy" sort={table.sort} onSort={table.toggleSort}>Paid By</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" fontWeight={700} color="primary.main">{row.paymentNo}</Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.paymentDate)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row[codeField]}</TableCell>
                      <TableCell sx={{ minWidth: 150 }}>{row[nameField]}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.paymentMode}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.referenceNo}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.bankName}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.invoiceAmount)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.paymentAmount)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.discount)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.netPaid)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.paidBy}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.status}</TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={14}>
                        {isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<PaymentsOutlinedIcon sx={{ fontSize: 48 }} />} title="No payments found for the selected criteria" message="Try adjusting your date range or filters" />
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && rows.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={8}><Typography fontWeight={700}>Total</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.invoiceAmount)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.paymentAmount)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.discount)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.netPaid)}</Typography></TableCell>
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Payment by Payment Mode ({periodLabel})</Typography>
              <Box sx={{ width: '100%', height: 180, position: 'relative' }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={paymentByPaymentMode} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                      {paymentByPaymentMode.map((entry, i) => <Cell key={entry.name} fill={donutColors[i % donutColors.length]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => currency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <Typography variant="caption" color="text.secondary" display="block">Total</Typography>
                  <Typography variant="subtitle2" fontWeight={700}>{currency(stats.totalPayments)}</Typography>
                </Box>
              </Box>
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {paymentByPaymentMode.map((d, i) => (
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Payment Trend (Last 7 Days)</Typography>
              <Box sx={{ width: '100%', height: 300, mt: 1 }}>
                <ResponsiveContainer>
                  <LineChart data={paymentTrend} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Top 5 {partyWord} by Payment ({periodLabel})</Typography>
              <Box sx={{ width: '100%', height: 260, mt: 1 }}>
                <ResponsiveContainer>
                  <BarChart data={top5SuppliersByPayment} layout="vertical" margin={{ top: 5, right: 50, left: 10, bottom: 0 }}>
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

      <ReportPrintable
        title="Payment Register"
        subtitle="Payments made during the selected period."
        filters={printFilters}
        columns={tableColumns}
        // Print uses the base (unsearched/unfiltered-by-popover) rows so it
        // always reflects the full Filters-section result, not whatever the
        // quick search box or column filter popover currently narrows to.
        rows={baseTableRows}
        totals={totals}
        totalsLabel="Total"
        orientation="landscape"
      />
    </Box>
  );
}
