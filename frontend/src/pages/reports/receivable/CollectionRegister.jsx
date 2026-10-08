import React, { useMemo, useState } from 'react';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
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
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
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
import { useGetCollectionRegisterReportQuery } from '../../../features/receivables/collectionRegisterReportApi';
import { chartOfAccountApi } from '../../../features/resources';
import useTableFeatures from '../../../components/data-display/useTableFeatures';
import TableToolbar from '../../../components/data-display/TableToolbar';
import SortableHeaderCell from '../../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import TableFilterPanel from '../../../components/data-display/TableFilterPanel';
import ReportPrintable from '../../../components/print/ReportPrintable';
import { buildPrintFilters } from '../../../components/print/reportPrint';

const PAGE_SIZE = 10;

const currency = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const currencyLakh = (v) => `${(Number(v || 0) / 100000).toFixed(2)}L`;
const formatDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '—');

// Filtering lives in the table's own Filter panel (above the item-detail
// table). Customer / Vendor / Account switches the dataset on the server; the rest are
// column filters on the rows. Every collection document is listed (all
// statuses, nothing hidden); the totals and stat cards count only Posted
// receipts that settle sales invoices, which keeps them reconciled with the
// dashboard's "Total Receivables" card — see the route comment in backend
// resources.js.
const PARTY_TYPE_OPTIONS = ['Customer', 'Vendor', 'Account'];
const PAYMENT_MODE_OPTIONS = ['Cash', 'Cheque', 'Bank Transfer'];
const DEFAULT_FILTERS = { include: 'All Payments' };

// Reports > Receivable > Collection Register print layout — see ReportPrintable.jsx.
const PRINT_FILTER_LABELS = { partyType: 'Customer / Vendor / Account' };
const PRINT_DATE_FIELDS = [];

export default function CollectionRegister() {
  const theme = useTheme();
  const isMobile = useIsMobileListView();

  const [partyType, setPartyType] = useState('Customer');
  const appliedFilters = useMemo(() => ({ ...DEFAULT_FILTERS, partyType }), [partyType]);
  const PARTY_COLUMNS = {
    Customer: { codeField: 'customerCode', nameField: 'customerName', codeLabel: 'Customer Code', nameLabel: 'Customer Name', partyWord: 'Customers' },
    Vendor: { codeField: 'supplierCode', nameField: 'supplierName', codeLabel: 'Supplier Code', nameLabel: 'Supplier Name', partyWord: 'Suppliers' },
    Account: { codeField: 'accountCode', nameField: 'accountName', codeLabel: 'Account Code', nameLabel: 'Account Name', partyWord: 'Accounts' },
  };
  const { codeField, nameField, codeLabel, nameLabel, partyWord } = PARTY_COLUMNS[partyType];
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const { data, isLoading, isFetching } = useGetCollectionRegisterReportQuery(appliedFilters);

  // Account Code filter is a pick-from-list dropdown fed by the same Chart of
  // Accounts list the vouchers use (posting accounts only, active only).
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
    { field: 'receiptNo', headerName: 'Receipt No.', filter: false },
    { field: 'receiptDate', headerName: 'Receipt Date', filter: 'dateRange', sortValue: (row) => (row.receiptDate ? new Date(row.receiptDate).getTime() : null), searchValue: (row) => formatDate(row.receiptDate) },
    partyType === 'Account'
      ? { field: codeField, headerName: codeLabel, filter: 'select', filterInput: 'autocomplete', filterOptions: accountCodeOptions }
      : { field: codeField, headerName: codeLabel, filter: 'text' },
    { field: nameField, headerName: nameLabel, filter: 'select' },
    { field: 'paymentMode', headerName: 'Payment Mode', filter: 'select', filterOptions: PAYMENT_MODE_OPTIONS },
    { field: 'referenceNo', headerName: 'Reference No.', filter: false },
    { field: 'bankName', headerName: 'Bank Name / UTR No.', filter: false },
    { field: 'invoiceAmount', headerName: 'Invoice Amount (₹)', filter: false, sortValue: (row) => (row.invoiceAmount == null || row.invoiceAmount === '' ? null : Number(row.invoiceAmount)) },
    { field: 'paidAmount', headerName: 'Paid Amount (₹)', filter: false, sortValue: (row) => (row.paidAmount == null || row.paidAmount === '' ? null : Number(row.paidAmount)) },
    { field: 'outstanding', headerName: 'Outstanding (₹)', filter: false, sortValue: (row) => (row.outstanding == null || row.outstanding === '' ? null : Number(row.outstanding)) },
    { field: 'collectedBy', headerName: 'Collected By', filter: false },
    { field: 'status', headerName: 'Status', filter: false },
  ]), [codeField, nameField, codeLabel, nameLabel, partyType, accountCodeOptions]);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  // Totals follow the table's own filters and count only Posted receipts that
  // settle sales invoices (equal to the backend totals when nothing is
  // filtered, and to the dashboard's Total Receivables).
  const totals = useMemo(() => rows.filter((r) => r.counted).reduce((acc, r) => ({
    invoiceAmount: acc.invoiceAmount + Number(r.invoiceAmount || 0),
    paidAmount: acc.paidAmount + Number(r.paidAmount || 0),
    outstanding: acc.outstanding + Number(r.outstanding || 0),
  }), { invoiceAmount: 0, paidAmount: 0, outstanding: 0 }), [rows]);
  const stats = data?.stats || {};
  const collectionByPaymentMode = data?.collectionByPaymentMode || [];
  const collectionTrend = data?.collectionTrend || [];
  const top5CustomersByCollection = data?.top5CustomersByCollection || [];
  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  // Print: full filtered/sorted rows (never just the current page), fed into
  // the shared ReportPrintable layout — see components/print/ReportPrintable.jsx.
  const printFilters = useMemo(
    () => buildPrintFilters(appliedFilters, PRINT_FILTER_LABELS, PRINT_DATE_FIELDS),
    [appliedFilters],
  );

  const periodLabel = 'All Time';

  const totalForPct = stats.totalCollections || 1;
  const pct = (v) => Math.round((Number(v || 0) / totalForPct) * 1000) / 10;

  const statCards = [
    { icon: <PaymentsOutlinedIcon fontSize="small" />, label: 'Total Collections', value: currency(stats.totalCollections), color: 'primary' },
    { icon: <EventNoteOutlinedIcon fontSize="small" />, label: `Total Receipts (${periodLabel})`, value: stats.totalReceipts ?? 0, color: 'success' },
    { icon: <PeopleAltOutlinedIcon fontSize="small" />, label: `Total ${partyWord} (${periodLabel})`, value: stats.totalCustomers ?? 0, color: 'warning' },
    { icon: <SavingsOutlinedIcon fontSize="small" />, label: `Cash Amount (${pct(stats.cashAmount)}%)`, value: currency(stats.cashAmount), color: 'secondary' },
    { icon: <AccountBalanceOutlinedIcon fontSize="small" />, label: `Bank Amount (${pct(stats.bankAmount)}%)`, value: currency(stats.bankAmount), color: 'primary' },
    { icon: <PhoneAndroidOutlinedIcon fontSize="small" />, label: `Other Mode Amount (${pct(stats.otherModeAmount)}%)`, value: currency(stats.otherModeAmount), color: 'secondary' },
  ];

  const donutColors = [
    theme.palette.primary.main, theme.palette.success.main, theme.palette.warning.main,
    theme.palette.secondary.main, theme.palette.error.main, theme.palette.grey[400],
  ];
  const chartTooltipStyle = { backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 };

  // Export: current filtered rows to CSV — same client-side pattern used
  // elsewhere.
  const EXPORT_COLUMNS = [
    ['receiptNo', 'Receipt No.'], ['receiptDate', 'Receipt Date'], [codeField, codeLabel], [nameField, nameLabel],
    ['paymentMode', 'Payment Mode'], ['referenceNo', 'Reference No.'], ['bankName', 'Bank Name / UTR No.'],
    ['invoiceAmount', 'Invoice Amount'], ['paidAmount', 'Paid Amount'], ['outstanding', 'Outstanding'], ['collectedBy', 'Collected By'], ['status', 'Status'],
  ];
  const handleExport = () => {
    const header = EXPORT_COLUMNS.map(([, label]) => label).join(',');
    const lines = baseTableRows.map((r) => EXPORT_COLUMNS.map(([key]) => {
      let v = r[key];
      if (key === 'receiptDate') v = formatDate(v);
      return `"${String(v ?? '').replace(/"/g, '""')}"`;
    }).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'collection-register.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<PaymentsOutlinedIcon />}
        title="Collection Register"
        subtitle="All collections received in the selected period."
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
            title="Collection Register List"
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
          <Collapse in={table.filterPanelOpen} unmountOnExit>
            <Box sx={{ px: { xs: 2, sm: 3 }, pb: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    select size="small" fullWidth label="Customer / Vendor / Account"
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
                    { label: 'Receipt No.', value: row.receiptNo },
                    { label: 'Receipt Date', value: formatDate(row.receiptDate) },
                    { label: codeLabel, value: row[codeField] },
                    { label: 'Payment Mode', value: row.paymentMode },
                    { label: 'Reference No.', value: row.referenceNo },
                    { label: 'Bank Name / UTR No.', value: row.bankName },
                    { label: 'Invoice Amount', value: currency(row.invoiceAmount) },
                    { label: 'Paid Amount', value: currency(row.paidAmount) },
                    { label: 'Outstanding', value: currency(row.outstanding) },
                    { label: 'Collected By', value: row.collectedBy },
                    { label: 'Status', value: row.status },
                  ]}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<RequestQuoteOutlinedIcon sx={{ fontSize: 48 }} />} title="No collections found for the selected criteria" message="Try adjusting your date range or filters" />
                )
              )}
              {!isLoading && rows.length > 0 && (
                <Card variant="outlined" sx={{ mb: 1.5, bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Total</Typography>
                    <Stack spacing={0.75}>
                      {[
                        ['Invoice Amount', currency(totals.invoiceAmount)], ['Paid Amount', currency(totals.paidAmount)],
                        ['Outstanding', currency(totals.outstanding)],
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
                    <SortableHeaderCell field="receiptNo" sort={table.sort} onSort={table.toggleSort}>Receipt No.</SortableHeaderCell>
                    <SortableHeaderCell field="receiptDate" sort={table.sort} onSort={table.toggleSort}>Receipt Date</SortableHeaderCell>
                    <SortableHeaderCell field={codeField} sort={table.sort} onSort={table.toggleSort}>{codeLabel}</SortableHeaderCell>
                    <SortableHeaderCell field={nameField} sort={table.sort} onSort={table.toggleSort}>{nameLabel}</SortableHeaderCell>
                    <SortableHeaderCell field="paymentMode" sort={table.sort} onSort={table.toggleSort}>Payment Mode</SortableHeaderCell>
                    <SortableHeaderCell field="referenceNo" sort={table.sort} onSort={table.toggleSort}>Reference No.</SortableHeaderCell>
                    <SortableHeaderCell field="bankName" sort={table.sort} onSort={table.toggleSort}>Bank Name / UTR No.</SortableHeaderCell>
                    <SortableHeaderCell field="invoiceAmount" sort={table.sort} onSort={table.toggleSort} align="right">Invoice Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="paidAmount" sort={table.sort} onSort={table.toggleSort} align="right">Paid Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="outstanding" sort={table.sort} onSort={table.toggleSort} align="right">Outstanding (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="collectedBy" sort={table.sort} onSort={table.toggleSort}>Collected By</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" fontWeight={700} color="primary.main">{row.receiptNo}</Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.receiptDate)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row[codeField]}</TableCell>
                      <TableCell sx={{ minWidth: 150 }}>{row[nameField]}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.paymentMode}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.referenceNo}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.bankName}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.invoiceAmount)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.paidAmount)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.outstanding)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.collectedBy}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.status}</TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={13}>
                        {isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<RequestQuoteOutlinedIcon sx={{ fontSize: 48 }} />} title="No collections found for the selected criteria" message="Try adjusting your date range or filters" />
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && rows.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={8}><Typography fontWeight={700}>Total</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.invoiceAmount)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.paidAmount)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.outstanding)}</Typography></TableCell>
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Collection by Payment Mode ({periodLabel})</Typography>
              <Box sx={{ width: '100%', height: 180, position: 'relative' }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={collectionByPaymentMode} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                      {collectionByPaymentMode.map((entry, i) => <Cell key={entry.name} fill={donutColors[i % donutColors.length]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => currency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <Typography variant="caption" color="text.secondary" display="block">Total</Typography>
                  <Typography variant="subtitle2" fontWeight={700}>{currency(stats.totalCollections)}</Typography>
                </Box>
              </Box>
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {collectionByPaymentMode.map((d, i) => (
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Collection Trend (Last 7 Days)</Typography>
              <Box sx={{ width: '100%', height: 300, mt: 1 }}>
                <ResponsiveContainer>
                  <LineChart data={collectionTrend} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Top 5 {partyWord} by Collection ({periodLabel})</Typography>
              <Box sx={{ width: '100%', height: 260, mt: 1 }}>
                <ResponsiveContainer>
                  <BarChart data={top5CustomersByCollection} layout="vertical" margin={{ top: 5, right: 50, left: 10, bottom: 0 }}>
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
        title="Collection Register"
        subtitle="Collections received during the selected period."
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
