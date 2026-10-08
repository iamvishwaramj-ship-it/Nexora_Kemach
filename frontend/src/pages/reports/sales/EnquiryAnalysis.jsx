import React, { useMemo, useState } from 'react';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import LoadingState from '../../../components/feedback/LoadingState';
import EmptyState from '../../../components/data-display/EmptyState';
import { useForm, FormProvider } from 'react-hook-form';
import {
  Box, Typography, Button, Card, CardContent, Stack, Grid, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip,
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from 'recharts';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import dayjs from 'dayjs';
import FormSelect from '../../../components/form/FormSelect';
import FormDatePicker from '../../../components/form/FormDatePicker';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import CompanyBadge from '../../../components/common/CompanyBadge';
import EntityListPagination from '../../../components/data-display/EntityListPagination';
import StatCard from '../../../components/data-display/StatCard';
import { customerApi, salesEmployeeApi } from '../../../features/resources';
import { useGetEnquiryAnalysisReportQuery } from '../../../features/sales/enquiryAnalysisReportApi';
import { ENQUIRY_SOURCE_OPTIONS } from '../../../lib/validation/salesSchemas';
import useTableFeatures from '../../../components/data-display/useTableFeatures';
import TableToolbar from '../../../components/data-display/TableToolbar';
import SortableHeaderCell from '../../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import TableFilterPanel from '../../../components/data-display/TableFilterPanel';
import ReportPrintable from '../../../components/print/ReportPrintable';
import { buildPrintFilters } from '../../../components/print/reportPrint';

const PAGE_SIZE = 10;

// Same status palette as the master Enquiry page / Enquiry Register report —
// reused here so a given status reads identically wherever it's shown.
const STATUS_COLORS = {
  Open: 'warning',
  Closed: 'success',
};

const formatDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '—');

const DEFAULT_FILTERS = { fromDate: '', toDate: '', customerName: '', assignedTo: '', sourceOfEnquiry: '' };

// Reports > Sales > Enquiry Analysis print layout — see ReportPrintable.jsx.
const PRINT_FILTER_LABELS = {
  fromDate: 'From Date', toDate: 'To Date', customerName: 'Customer', assignedTo: 'Salesperson', sourceOfEnquiry: 'Source',
};
const PRINT_DATE_FIELDS = ['fromDate', 'toDate'];

export default function EnquiryAnalysis() {
  const theme = useTheme();

  const { data: customers } = customerApi.useList();
  const { data: salesEmployees } = salesEmployeeApi.useList();

  const customerOptions = useMemo(() => ([
    { label: 'All Customers', value: '' },
    ...(customers || []).map((c) => ({ label: c.customerName, value: c.customerName })),
  ]), [customers]);

  const salespersonOptions = useMemo(() => ([
    { label: 'All Sales Persons', value: '' },
    ...(salesEmployees || []).map((e) => ({ label: e.employeeName, value: e.employeeName })),
  ]), [salesEmployees]);

  const sourceOptions = useMemo(() => ([
    { label: 'All Sources', value: '' },
    ...ENQUIRY_SOURCE_OPTIONS.map((s) => ({ label: s, value: s })),
  ]), []);

  // Filter bar is a report toolbar, not a create/edit form — no Zod
  // validation or persisted mutation, same as CustomerOutstanding.jsx /
  // EnquiryRegister.jsx.
  const methods = useForm({
    defaultValues: { fromDate: null, toDate: null, customerName: '', assignedTo: '', sourceOfEnquiry: '' },
  });
  const { handleSubmit, reset } = methods;

  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const { data, isLoading, isFetching } = useGetEnquiryAnalysisReportQuery(appliedFilters);
  const stats = data?.stats || {};
  const statusBreakdown = data?.statusBreakdown || [];
  const sourceBreakdown = data?.sourceBreakdown || [];
  const dailyTrend = data?.dailyTrend || [];
  const topCustomers = data?.topCustomers || [];
  const bySalesPerson = data?.bySalesPerson || [];
  const conversion = data?.conversion || {};
  const baseTableRows = data?.rows || [];

  // Sorting for the "Top Customers" summary card — a search box would be
  // noise on a five-row card, but re-ordering it is useful.
  const topCustomersTable = useTableFeatures(topCustomers, useMemo(() => ([
    { field: 'customerName', headerName: 'Customer / Name', filter: false },
    { field: 'count', headerName: 'No. of Enquiries', filter: false, sortValue: (r) => Number(r.count) || 0 },
  ]), []));

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'enquiryNo', headerName: 'Enquiry No.', filter: 'text' },
    { field: 'enquiryDate', headerName: 'Enquiry Date', filter: 'dateRange', sortValue: (row) => (row.enquiryDate ? new Date(row.enquiryDate).getTime() : null), searchValue: (row) => formatDate(row.enquiryDate) },
    { field: 'customerName', headerName: 'Customer / Name', filter: 'text' },
    { field: 'sourceOfEnquiry', headerName: 'Source', filter: 'text' },
    { field: 'subject', headerName: 'Subject', filter: 'text' },
    { field: 'assignedTo', headerName: 'Sales Person', filter: 'text' },
    { field: 'status', headerName: 'Status', filter: 'select' },
    { field: 'expectedClosureDate', headerName: 'Expected Close Date', filter: 'dateRange', sortValue: (row) => (row.expectedClosureDate ? new Date(row.expectedClosureDate).getTime() : null), searchValue: (row) => formatDate(row.expectedClosureDate) },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  // Print: full filtered/sorted rows, fed into the shared ReportPrintable
  // layout — see components/print/ReportPrintable.jsx.
  const printFilters = useMemo(
    () => buildPrintFilters(appliedFilters, PRINT_FILTER_LABELS, PRINT_DATE_FIELDS),
    [appliedFilters],
  );

  const onView = handleSubmit((values) => {
    setAppliedFilters({
      fromDate: values.fromDate ? dayjs(values.fromDate).format('YYYY-MM-DD') : '',
      toDate: values.toDate ? dayjs(values.toDate).format('YYYY-MM-DD') : '',
      customerName: values.customerName || '',
      assignedTo: values.assignedTo || '',
      sourceOfEnquiry: values.sourceOfEnquiry || '',
    });
    setPage(0);
  });

  const onReset = () => {
    reset({ fromDate: null, toDate: null, customerName: '', assignedTo: '', sourceOfEnquiry: '' });
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  // Enquiry status is a plain Open/Closed now (Closed = a Sales Quotation was
  // raised against it), so the old six-card funnel — In Progress, Quoted,
  // Closed-Won, Closed-Lost — has nothing behind it any more. Three cards is
  // what the data actually supports.
  const statCards = [
    { icon: <HelpOutlineIcon fontSize="small" />, label: 'Total Enquiries', value: stats.total ?? 0, color: 'primary' },
    { icon: <GroupsOutlinedIcon fontSize="small" />, label: 'Open', value: stats.open ?? 0, color: 'warning' },
    { icon: <CheckCircleOutlineIcon fontSize="small" />, label: 'Quoted (Closed)', value: stats.closed ?? 0, color: 'success' },
  ];

  const donutColors = [
    theme.palette.primary.main, theme.palette.warning.main, theme.palette.secondary.main,
    theme.palette.success.main, theme.palette.error.main, theme.palette.info.main,
  ];

  const chartTooltipStyle = { backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 };

  const renderDonut = (title, dataset) => (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>{title}</Typography>
        <Box sx={{ width: '100%', height: 180 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={dataset} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2} strokeWidth={0}>
                {dataset.map((entry, i) => <Cell key={entry.name} fill={donutColors[i % donutColors.length]} />)}
              </Pie>
              <RechartsTooltip contentStyle={chartTooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </Box>
        <Stack spacing={0.75} sx={{ mt: 1 }}>
          {dataset.length === 0 && (
            <Typography variant="caption" color="text.secondary" align="center">No data for the selected criteria</Typography>
          )}
          {dataset.map((d, i) => (
            <Stack key={d.name} direction="row" alignItems="center" justifyContent="space-between">
              <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: donutColors[i % donutColors.length], flexShrink: 0 }} />
                <Typography variant="caption" color="text.secondary" noWrap>{d.name}</Typography>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ flexShrink: 0 }}>
                <Typography variant="caption" fontWeight={600}>{d.value}</Typography>
                <Typography variant="caption" color="text.secondary">({d.percent}%)</Typography>
              </Stack>
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );

  // Export: the Enquiry Summary rows to CSV, same client-side pattern used
  // elsewhere (Enquiry.jsx / EnquiryRegister.jsx).
  const EXPORT_COLUMNS = [
    ['enquiryNo', 'Enquiry No.'], ['enquiryDate', 'Enquiry Date'], ['customerName', 'Customer / Name'],
    ['sourceOfEnquiry', 'Source'], ['subject', 'Subject'], ['assignedTo', 'Sales Person'],
    ['status', 'Status'], ['expectedClosureDate', 'Expected Close Date'],
  ];
  const handleExport = () => {
    const header = EXPORT_COLUMNS.map(([, label]) => label).join(',');
    const lines = baseTableRows.map((r) => EXPORT_COLUMNS.map(([key]) => {
      const v = key.toLowerCase().includes('date') ? formatDate(r[key]) : r[key];
      return `"${String(v ?? '').replace(/"/g, '""')}"`;
    }).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'enquiry-analysis.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // "Conversion" now means reaching a quotation, which is the only transition
  // the two-value status records. There is no won/lost split left to show.
  const conversionRows = [
    ['Total Enquiries', conversion.totalEnquiries ?? 0],
    ['Awaiting Quotation (Open)', conversion.open ?? 0],
    ['Quoted (Closed)', conversion.closed ?? 0],
  ];

  return (
    <Box>
      <EntityHeaderCard
        icon={<BarChartOutlinedIcon />}
        title="Enquiry Analysis"
        subtitle="Analyse enquiry performance and trends."
        rightContent={<CompanyBadge />}
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Filters</Typography>
          <FormProvider {...methods}>
            <Grid container spacing={2} alignItems="flex-start">
              <Grid item xs={12} sm={6} md={2}>
                <FormDatePicker name="fromDate" label="From Date" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormDatePicker name="toDate" label="To Date" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="customerName" label="Customer" options={customerOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="sourceOfEnquiry" label="Source" options={sourceOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="assignedTo" label="Sales Person" options={salespersonOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={1}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<SearchIcon />}
                  onClick={onView}
                  disabled={isFetching}
                  fullWidth
                  sx={{ height: 40 }}
                >
                  View
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={1}>
                <Button variant="outlined" color="inherit" onClick={onReset} fullWidth sx={{ height: 40 }}>
                  Reset
                </Button>
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

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={4}>
          {renderDonut('Enquiries by Status', statusBreakdown)}
        </Grid>
        <Grid item xs={12} md={4}>
          {renderDonut('Enquiries by Source', sourceBreakdown)}
        </Grid>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Enquiries Trend (Daily)</Typography>
              <Typography variant="caption" color="text.secondary">No. of Enquiries</Typography>
              <Box sx={{ width: '100%', height: 220, mt: 1 }}>
                <ResponsiveContainer>
                  <LineChart data={dailyTrend} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => [v, 'Enquiries']} />
                    <Line type="monotone" dataKey="value" stroke={theme.palette.primary.main} strokeWidth={2.5} dot={{ r: 4, fill: theme.palette.primary.main, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent sx={{ p: 0 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ px: 2.5, pt: 2.5, pb: 1.5 }}>Top Customers by Enquiries</Typography>
              <ScrollableTableContainer maxHeight="min(45vh, 300px)">
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <SortableHeaderCell field="customerName" sort={topCustomersTable.sort} onSort={topCustomersTable.toggleSort}>Customer / Name</SortableHeaderCell>
                      <SortableHeaderCell field="count" sort={topCustomersTable.sort} onSort={topCustomersTable.toggleSort} align="right">No. of Enquiries</SortableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topCustomersTable.rows.map((c) => (
                      <TableRow key={c.customerName} hover>
                        <TableCell>{c.customerName}</TableCell>
                        <TableCell align="right">{c.count}</TableCell>
                      </TableRow>
                    ))}
                    {topCustomers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} sx={{ border: 'none' }}>
                          <EmptyState
                            icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />}
                            title="No data for the selected criteria"
                            message="Try adjusting your date range or filters"
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollableTableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Enquiries by Sales Person</Typography>
              <Box sx={{ width: '100%', height: 220, mt: 1 }}>
                <ResponsiveContainer>
                  <BarChart data={bySalesPerson} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => [v, 'Enquiries']} />
                    <Bar dataKey="value" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} maxBarSize={36}>
                      <LabelList dataKey="value" position="top" style={{ fontSize: 10, fill: theme.palette.text.secondary }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Conversion Summary</Typography>
              <Stack spacing={1.25}>
                {conversionRows.map(([label, value]) => (
                  <Stack key={label} direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                    <Typography variant="body2" fontWeight={700}>{value}</Typography>
                  </Stack>
                ))}
                <Box sx={{ mt: 0.5, p: 1.5, borderRadius: 1.5, bgcolor: (t) => t.palette.success.main + '1a' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" fontWeight={700} color="success.main">Conversion Rate (Won / Total)</Typography>
                    <Typography variant="body2" fontWeight={700} color="success.main">{conversion.conversionRate ?? 0}%</Typography>
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <TableToolbar
            title="Enquiry Summary"
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
          <ScrollableTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <SortableHeaderCell field="enquiryNo" sort={table.sort} onSort={table.toggleSort}>Enquiry No.</SortableHeaderCell>
                  <SortableHeaderCell field="enquiryDate" sort={table.sort} onSort={table.toggleSort}>Enquiry Date</SortableHeaderCell>
                  <SortableHeaderCell field="customerName" sort={table.sort} onSort={table.toggleSort}>Customer / Name</SortableHeaderCell>
                  <SortableHeaderCell field="sourceOfEnquiry" sort={table.sort} onSort={table.toggleSort}>Source</SortableHeaderCell>
                  <SortableHeaderCell field="subject" sort={table.sort} onSort={table.toggleSort}>Subject</SortableHeaderCell>
                  <SortableHeaderCell field="assignedTo" sort={table.sort} onSort={table.toggleSort}>Sales Person</SortableHeaderCell>
                  <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                  <SortableHeaderCell field="expectedClosureDate" sort={table.sort} onSort={table.toggleSort}>Expected Close Date</SortableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!isLoading && pagedRows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" fontWeight={700} color="primary.main">{row.enquiryNo}</Typography>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.enquiryDate)}</TableCell>
                    <TableCell sx={{ minWidth: 160 }}>{row.customerName || '—'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.sourceOfEnquiry || '—'}</TableCell>
                    <TableCell sx={{ minWidth: 180 }}>{row.subject || '—'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.assignedTo || '—'}</TableCell>
                    <TableCell>
                      <Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.expectedClosureDate)}</TableCell>
                  </TableRow>
                ))}
                {!isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8}>
                      {isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title="No enquiries found for the selected criteria" message="Try adjusting your date range or filters" />
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollableTableContainer>

          <EntityListPagination total={rows.length} page={page} onChange={setPage} pageSize={pageSize} onPageSizeChange={(v) => { setPageSize(v); setPage(0); }} />
        </CardContent>
      </Card>

      <ReportPrintable
        title="Enquiry Analysis"
        subtitle="Analyse enquiry performance and trends."
        filters={printFilters}
        columns={tableColumns}
        // Print uses the base (unsearched/unfiltered-by-popover) rows so it
        // always reflects the full Filters-section result, not whatever the
        // quick search box or column filter popover currently narrows to.
        rows={baseTableRows}
      />
    </Box>
  );
}
