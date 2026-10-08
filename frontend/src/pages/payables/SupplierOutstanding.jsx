import React, { useEffect, useMemo, useState } from 'react';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import LoadingState from '../../components/feedback/LoadingState';
import EmptyState from '../../components/data-display/EmptyState';
import { useCurrencyOptions } from '../../lib/currencyOptions';
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
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import dayjs from 'dayjs';
import FormSelect from '../../components/form/FormSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import useDragScroll from '../../components/data-display/useDragScroll';
import StatCard from '../../components/data-display/StatCard';
import { branchApi, supplierApi } from '../../features/resources';
import { useGetSupplierOutstandingReportQuery } from '../../features/payables/supplierOutstandingReportApi';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableToolbar from '../../components/data-display/TableToolbar';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import ReportPrintable from '../../components/print/ReportPrintable';
import { buildPrintFilters } from '../../components/print/reportPrint';

const PAGE_SIZE = 10;

// Period Range is label-only here — it doesn't narrow which invoices are
// included (this report is always an as-of-"To Date" snapshot, same as
// the old "Ageing As On" date), it just drives the "(MTD)"-style subtitle
// shown on the stat cards, matching Collection Register's convention.
const PERIOD_RANGE_OPTIONS = ['MTD (Month To Date)', 'WTD (Week To Date)', 'QTD (Quarter To Date)', 'YTD (Year To Date)', 'Custom Range'];
const AGING_BASIS_OPTIONS = [
  { label: 'Due Date', value: 'Due Date' },
  { label: 'Invoice Date', value: 'Invoice Date' },
];
const INCLUDE_OPTIONS = ['All Invoices', 'Suppliers with Outstanding Only', 'Overdue Invoices Only'];
const SHOW_PAID_OPTIONS = [{ label: 'No', value: 'No' }, { label: 'Yes', value: 'Yes' }];
// Currency reads live from Currency Master instead of a hardcoded
// single-item list — see lib/currencyOptions.js.

const amount = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const currency = (v) => `₹ ${amount(v)}`;

const DEFAULT_FILTERS = {
  branch: '', supplierGroup: '', supplier: '', currency: 'INR',
  include: 'Suppliers with Outstanding Only', showPaidInvoices: 'No', asOnDate: dayjs().format('YYYY-MM-DD'), agingBasedOn: 'Due Date',
};

// Reports > Payable > Supplier Outstanding print layout — see ReportPrintable.jsx.
const PRINT_FILTER_LABELS = {
  branch: 'Branch', supplierGroup: 'Supplier Group', supplier: 'Supplier', currency: 'Currency',
  include: 'Include', showPaidInvoices: 'Show Paid Invoices', asOnDate: 'As On Date', agingBasedOn: 'Ageing Based On',
};
const PRINT_DATE_FIELDS = ['asOnDate'];

const SUPPLIER_OUTSTANDING_DETAIL_TABLE_ROW_HEIGHT = 0;
const SUPPLIER_OUTSTANDING_DETAIL_TABLE_CELL_PADDING_Y = 6;
export default function SupplierOutstanding() {
  const theme = useTheme();
  const isMobile = useIsMobileListView();

  const { data: branches } = branchApi.useList();
  const { data: suppliers } = supplierApi.useList();

  const branchOptions = useMemo(() => ([
    { label: 'All Branches', value: '' },
    ...(branches || []).map((b) => ({ label: b.branchName, value: b.branchName })),
  ]), [branches]);

  // Supplier Group is Supplier.supplierType — the only classification field
  // on Supplier — so the option list is just the distinct values in use.
  const supplierGroupOptions = useMemo(() => {
    const distinct = Array.from(new Set((suppliers || []).map((s) => s.supplierType).filter(Boolean)));
    return [{ label: 'All Groups', value: '' }, ...distinct.map((g) => ({ label: g, value: g }))];
  }, [suppliers]);

  const supplierOptions = useMemo(() => ([
    { label: 'All Suppliers', value: '' },
    ...(suppliers || []).map((s) => ({ label: s.supplierName, value: s.supplierName })),
  ]), [suppliers]);

  const periodRangeOptions = useMemo(() => (
    PERIOD_RANGE_OPTIONS.map((s) => ({ label: s, value: s }))
  ), []);
  const includeOptions = useMemo(() => (
    INCLUDE_OPTIONS.map((s) => ({ label: s, value: s }))
  ), []);
  const currencyOptions = useCurrencyOptions();

  // Filter bar is a report toolbar, not a create/edit form — no Zod
  // validation or persisted mutation, same as other report pages.
  const methods = useForm({
    defaultValues: {
      periodRange: 'MTD (Month To Date)', branch: '', supplierGroup: '', supplier: '',
      asOnDate: dayjs(), agingBasedOn: 'Due Date', currency: 'INR',
      include: 'Suppliers with Outstanding Only', showPaidInvoices: 'No',
    },
  });
  const { handleSubmit, reset, watch } = methods;
  const periodRange = watch('periodRange');
  const periodLabel = (periodRange || 'MTD (Month To Date)').split(' ')[0];

  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const { data, isLoading, isFetching } = useGetSupplierOutstandingReportQuery(appliedFilters);
  const baseTableRows = data?.rows || [];

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'supplierCode', headerName: 'Supplier Code', filter: 'text' },
    { field: 'supplierName', headerName: 'Supplier Name', filter: 'text' },
    { field: 'supplierGroup', headerName: 'Supplier Group', filter: 'text' },
    { field: 'totalInvoices', headerName: 'Total Invoices', filter: 'text' },
    { field: 'totalOutstanding', headerName: 'Total Outstanding (₹)', filter: 'numberRange', sortValue: (row) => (row.totalOutstanding == null || row.totalOutstanding === '' ? null : Number(row.totalOutstanding)) },
    { field: 'overdue', headerName: 'Overdue (₹)', filter: 'numberRange', sortValue: (row) => (row.overdue == null || row.overdue === '' ? null : Number(row.overdue)) },
    { field: 'dueWithin30', headerName: 'Due Within 30 Days (₹)', filter: 'numberRange', sortValue: (row) => (row.dueWithin30 == null || row.dueWithin30 === '' ? null : Number(row.dueWithin30)) },
    { field: 'due31to60', headerName: 'Due 31-60 Days (₹)', filter: 'numberRange', sortValue: (row) => (row.due31to60 == null || row.due31to60 === '' ? null : Number(row.due31to60)) },
    { field: 'dueAbove60', headerName: 'Due Above 60 Days (₹)', filter: 'numberRange', sortValue: (row) => (row.dueAbove60 == null || row.dueAbove60 === '' ? null : Number(row.dueAbove60)) },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const totals = data?.totals || {};
  const stats = data?.stats || {};
  const outstandingByAgeing = data?.outstandingByAgeing || [];
  const top5SuppliersByOutstanding = data?.top5SuppliersByOutstanding || [];
  const outstandingTrend = data?.outstandingTrend || [];
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
      supplierGroup: values.supplierGroup || '',
      supplier: values.supplier || '',
      currency: values.currency || 'INR',
      include: values.include || 'All Invoices',
      showPaidInvoices: values.showPaidInvoices || 'No',
      asOnDate: values.asOnDate ? dayjs(values.asOnDate).format('YYYY-MM-DD') : '',
      agingBasedOn: values.agingBasedOn || 'Due Date',
    });
    setPage(0);
  });

  const onReset = () => {
    reset({
      periodRange: 'MTD (Month To Date)', branch: '', supplierGroup: '', supplier: '',
      asOnDate: dayjs(), agingBasedOn: 'Due Date', currency: 'INR',
      include: 'Suppliers with Outstanding Only', showPaidInvoices: 'No',
    });
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  const totalForPct = stats.totalOutstandingAmount || 1;
  const pct = (v) => Math.round((Number(v || 0) / totalForPct) * 1000) / 10;

  const statCards = [
    { icon: <PeopleAltOutlinedIcon fontSize="small" />, label: `Total Suppliers (${periodLabel})`, value: stats.totalSuppliers ?? 0, color: 'secondary' },
    { icon: <ReceiptLongOutlinedIcon fontSize="small" />, label: `Total Outstanding (₹) (${periodLabel})`, value: currency(stats.totalOutstandingAmount), color: 'error' },
    { icon: <AccessTimeOutlinedIcon fontSize="small" />, label: `Overdue (₹) ${pct(stats.overdue)}%`, value: currency(stats.overdue), color: 'warning' },
    { icon: <EventOutlinedIcon fontSize="small" />, label: `Due Within 30 Days (₹) ${pct(stats.dueWithin30)}%`, value: currency(stats.dueWithin30), color: 'primary' },
    { icon: <CalendarMonthOutlinedIcon fontSize="small" />, label: `Due 31-60 Days (₹) ${pct(stats.due31to60)}%`, value: currency(stats.due31to60), color: 'success' },
    { icon: <EventBusyOutlinedIcon fontSize="small" />, label: `Due Above 60 Days (₹) ${pct(stats.dueAbove60)}%`, value: currency(stats.dueAbove60), color: 'secondary' },
  ];

  const ageingDonutColors = [theme.palette.error.main, theme.palette.primary.main, theme.palette.warning.main, theme.palette.success.main];
  const barColor = theme.palette.primary.main;
  const chartTooltipStyle = { backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 };

  // Export: current filtered rows to CSV — same client-side pattern used
  // elsewhere.
  const EXPORT_COLUMNS = [
    ['supplierCode', 'Supplier Code'], ['supplierName', 'Supplier Name'], ['supplierGroup', 'Supplier Group'],
    ['totalInvoices', 'Total Invoices'], ['totalOutstanding', 'Total Outstanding'],
    ['overdue', 'Overdue'], ['dueWithin30', 'Due Within 30 Days'], ['due31to60', 'Due 31-60 Days'], ['dueAbove60', 'Due Above 60 Days'],
  ];
  const handleExport = () => {
    const header = EXPORT_COLUMNS.map(([, label]) => label).join(',');
    const lines = rows.map((r) => EXPORT_COLUMNS.map(([key]) => `"${String(r[key] ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'supplier-outstanding.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<DescriptionOutlinedIcon />}
        title="Supplier Outstanding"
        subtitle="View supplier wise outstanding balances and ageing."
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
                <FormSelect name="supplierGroup" label="Supplier Group" options={supplierGroupOptions} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormDatePicker name="asOnDate" label="To Date" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="branch" label="Branch" options={branchOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="supplier" label="Supplier" options={supplierOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="currency" label="Currency" options={currencyOptions} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="include" label="Include" options={includeOptions} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="showPaidInvoices" label="Show Paid Invoices" options={SHOW_PAID_OPTIONS} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="agingBasedOn" label="Ageing Based On" options={AGING_BASIS_OPTIONS} />
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
            title="Supplier Outstanding List"
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
                  key={row.supplierCode}
                  title={row.supplierName}
                  fields={[
                    { label: '#', value: page * pageSize + idx + 1 },
                    { label: 'Supplier Code', value: row.supplierCode },
                    { label: 'Supplier Group', value: row.supplierGroup },
                    { label: 'Total Invoices', value: row.totalInvoices },
                    { label: 'Total Outstanding (₹)', value: amount(row.totalOutstanding) },
                    { label: 'Overdue (₹)', value: amount(row.overdue) },
                    { label: 'Due Within 30 Days (₹)', value: amount(row.dueWithin30) },
                    { label: 'Due 31-60 Days (₹)', value: amount(row.due31to60) },
                    { label: 'Due Above 60 Days (₹)', value: amount(row.dueAbove60) },
                  ]}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<PaymentsOutlinedIcon sx={{ fontSize: 48 }} />} title="No outstanding balances found" message="Try adjusting your date range or filters" />
                )
              )}
              {!isLoading && rows.length > 0 && (
                <Card variant="outlined" sx={{ mb: 1.5, bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Total</Typography>
                    <Stack spacing={0.75}>
                      {[
                        ['Total Invoices', totals.totalInvoices], ['Total Outstanding (₹)', amount(totals.totalOutstanding)],
                        ['Overdue (₹)', amount(totals.overdue)], ['Due Within 30 Days (₹)', amount(totals.dueWithin30)],
                        ['Due 31-60 Days (₹)', amount(totals.due31to60)], ['Due Above 60 Days (₹)', amount(totals.dueAbove60)],
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
              <Table
                size="small"
                stickyHeader
                sx={{
                  '& th, & td': {
                    height: SUPPLIER_OUTSTANDING_DETAIL_TABLE_ROW_HEIGHT,
                    paddingTop: `${SUPPLIER_OUTSTANDING_DETAIL_TABLE_CELL_PADDING_Y}px`,
                    paddingBottom: `${SUPPLIER_OUTSTANDING_DETAIL_TABLE_CELL_PADDING_Y}px`,
                    boxSizing: 'border-box',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell width={48}>#</TableCell>
                    <SortableHeaderCell field="supplierCode" sort={table.sort} onSort={table.toggleSort}>Supplier Code</SortableHeaderCell>
                    <SortableHeaderCell field="supplierName" sort={table.sort} onSort={table.toggleSort}>Supplier Name</SortableHeaderCell>
                    <SortableHeaderCell field="supplierGroup" sort={table.sort} onSort={table.toggleSort}>Supplier Group</SortableHeaderCell>
                    <SortableHeaderCell field="totalInvoices" sort={table.sort} onSort={table.toggleSort} align="right">Total Invoices</SortableHeaderCell>
                    <SortableHeaderCell field="totalOutstanding" sort={table.sort} onSort={table.toggleSort} align="right">Total Outstanding (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="overdue" sort={table.sort} onSort={table.toggleSort} align="right">Overdue (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="dueWithin30" sort={table.sort} onSort={table.toggleSort} align="right">Due Within 30 Days (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="due31to60" sort={table.sort} onSort={table.toggleSort} align="right">Due 31-60 Days (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="dueAbove60" sort={table.sort} onSort={table.toggleSort} align="right">Due Above 60 Days (₹)</SortableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.supplierCode} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" fontWeight={700} color="primary.main">{row.supplierCode}</Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 150 }}>{row.supplierName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.supplierGroup}</TableCell>
                      <TableCell align="right">{row.totalInvoices}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{amount(row.totalOutstanding)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{amount(row.overdue)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{amount(row.dueWithin30)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{amount(row.due31to60)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{amount(row.dueAbove60)}</TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10}>
                        {isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<PaymentsOutlinedIcon sx={{ fontSize: 48 }} />} title="No outstanding balances found" message="Try adjusting your date range or filters" />
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && rows.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={4}><Typography fontWeight={700}>Total</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{totals.totalInvoices}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{amount(totals.totalOutstanding)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{amount(totals.overdue)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{amount(totals.dueWithin30)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{amount(totals.due31to60)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{amount(totals.dueAbove60)}</Typography></TableCell>
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Outstanding by Ageing</Typography>
              <Box sx={{ width: '100%', height: 180, position: 'relative' }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={outstandingByAgeing} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                      {outstandingByAgeing.map((entry, i) => <Cell key={entry.name} fill={ageingDonutColors[i % ageingDonutColors.length]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => currency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <Typography variant="caption" color="text.secondary" display="block">Total</Typography>
                  <Typography variant="subtitle2" fontWeight={700}>{currency(stats.totalOutstandingAmount)}</Typography>
                </Box>
              </Box>
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {outstandingByAgeing.map((d, i) => (
                  <Stack key={d.name} direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ageingDonutColors[i % ageingDonutColors.length], flexShrink: 0 }} />
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Outstanding Trend (Last 6 Months)</Typography>
              <Box sx={{ width: '100%', height: 300, mt: 1 }}>
                <ResponsiveContainer>
                  <LineChart data={outstandingTrend} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} />
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Top 5 Suppliers by Outstanding</Typography>
              <Box sx={{ width: '100%', height: 260, mt: 1 }}>
                <ResponsiveContainer>
                  <BarChart data={top5SuppliersByOutstanding} layout="vertical" margin={{ top: 5, right: 50, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 9, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => currency(v)} />
                    <Bar dataKey="value" fill={barColor} radius={[0, 4, 4, 0]} maxBarSize={18}>
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
        title="Supplier Outstanding"
        subtitle="Supplier-wise outstanding balances and ageing analysis."
        filters={printFilters}
        columns={tableColumns}
        rows={rows}
        totals={totals}
        totalsLabel="Total"
      />
    </Box>
  );
}
