import React, { useMemo, useState } from 'react';
import LoadingState from '../../../components/feedback/LoadingState';
import EmptyState from '../../../components/data-display/EmptyState';
import { useForm, FormProvider } from 'react-hook-form';
import {
  Box, Typography, Button, Card, CardContent, Stack, Grid, Table, TableBody, TableCell,
  TableHead, TableRow,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip,
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from 'recharts';
import Diversity3OutlinedIcon from '@mui/icons-material/Diversity3Outlined';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import Diversity3Icon from '@mui/icons-material/Diversity3';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import DonutLargeOutlinedIcon from '@mui/icons-material/DonutLargeOutlined';
import dayjs from 'dayjs';
import FormSelect from '../../../components/form/FormSelect';
import FormDatePicker from '../../../components/form/FormDatePicker';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import CompanyBadge from '../../../components/common/CompanyBadge';
import EntityListPagination from '../../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../../components/data-display/useIsMobileListView';
import StatCard from '../../../components/data-display/StatCard';
import { customerApi, salesEmployeeApi } from '../../../features/resources';
import { useGetSalesmanWiseSalesReportQuery } from '../../../features/sales/salesmanWiseSalesReportApi';
import { ENQUIRY_SOURCE_OPTIONS } from '../../../lib/validation/salesSchemas';
import useTableFeatures from '../../../components/data-display/useTableFeatures';
import TableToolbar from '../../../components/data-display/TableToolbar';
import SortableHeaderCell from '../../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import TableFilterPanel from '../../../components/data-display/TableFilterPanel';
import ReportPrintable from '../../../components/print/ReportPrintable';
import { buildPrintFilters } from '../../../components/print/reportPrint';

const PAGE_SIZE = 10;

const currency = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const number2 = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const lakh = (v) => `${Number(v || 0)}L`;

// Document Type is filter-bar-only for now — every row in this report
// comes from SalesInvoice, the only sales document with a stats-ready
// shape, so "All" and "Sales Invoice" are equivalent on the backend.
const DOCUMENT_TYPE_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Sales Invoice', value: 'Sales Invoice' },
];

const DEFAULT_FILTERS = { fromDate: '', toDate: '', salesPerson: '', customer: '', documentType: '', source: '' };

// Reports > Sales > Salesman-wise Sales print layout — see ReportPrintable.jsx.
const PRINT_FILTER_LABELS = {
  fromDate: 'From Date', toDate: 'To Date', salesPerson: 'Salesperson', customer: 'Customer', documentType: 'Document Type', source: 'Source',
};
const PRINT_DATE_FIELDS = ['fromDate', 'toDate'];

export default function SalesmanWiseSales() {
  const theme = useTheme();
  const isMobile = useIsMobileListView();

  const { data: salesEmployees } = salesEmployeeApi.useList();
  const { data: customers } = customerApi.useList();

  const salespersonOptions = useMemo(() => ([
    { label: 'All Salespersons', value: '' },
    ...(salesEmployees || []).map((e) => ({ label: e.employeeName, value: e.employeeName })),
  ]), [salesEmployees]);

  const customerOptions = useMemo(() => ([
    { label: 'All Customers', value: '' },
    ...(customers || []).map((c) => ({ label: c.customerName, value: c.customerName })),
  ]), [customers]);

  const sourceOptions = useMemo(() => ([
    { label: 'All Sources', value: '' },
    ...ENQUIRY_SOURCE_OPTIONS.map((s) => ({ label: s, value: s })),
  ]), []);

  // Filter bar is a report toolbar, not a create/edit form — no Zod
  // validation or persisted mutation, same as other report pages.
  const methods = useForm({
    defaultValues: { fromDate: null, toDate: null, salesPerson: '', customer: '', documentType: '', source: '' },
  });
  const { handleSubmit, reset } = methods;

  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const { data, isLoading, isFetching } = useGetSalesmanWiseSalesReportQuery(appliedFilters);
  const baseTableRows = data?.rows || [];

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'salespersonCode', headerName: 'Salesperson Code', filter: 'text' },
    { field: 'salespersonName', headerName: 'Salesperson Name', filter: 'text' },
    { field: 'totalInvoices', headerName: 'Total Invoices', filter: 'text' },
    { field: 'salesQuantity', headerName: 'Total Sales Quantity', filter: 'numberRange', sortValue: (row) => (row.salesQuantity == null || row.salesQuantity === '' ? null : Number(row.salesQuantity)) },
    { field: 'totalSalesAmount', headerName: 'Total Sales Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.totalSalesAmount == null || row.totalSalesAmount === '' ? null : Number(row.totalSalesAmount)) },
    { field: 'totalDiscount', headerName: 'Total Discount (₹)', filter: 'numberRange', sortValue: (row) => (row.totalDiscount == null || row.totalDiscount === '' ? null : Number(row.totalDiscount)) },
    { field: 'totalTaxAmount', headerName: 'Total Tax Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.totalTaxAmount == null || row.totalTaxAmount === '' ? null : Number(row.totalTaxAmount)) },
    { field: 'netSalesAmount', headerName: 'Net Sales Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.netSalesAmount == null || row.netSalesAmount === '' ? null : Number(row.netSalesAmount)) },
    { field: 'avgInvoiceValue', headerName: 'Avg. Invoice Value (₹)', filter: 'numberRange', sortValue: (row) => (row.avgInvoiceValue == null || row.avgInvoiceValue === '' ? null : Number(row.avgInvoiceValue)) },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const totals = data?.totals || {};
  const stats = data?.stats || {};
  const topSalespersons = data?.topSalespersons || [];
  const contribution = data?.contribution || [];
  const trend = data?.trend || [];
  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  // Print: full filtered/sorted rows + the report's own grand totals, fed
  // into the shared ReportPrintable layout — see components/print/ReportPrintable.jsx.
  const printFilters = useMemo(
    () => buildPrintFilters(appliedFilters, PRINT_FILTER_LABELS, PRINT_DATE_FIELDS),
    [appliedFilters],
  );

  const onView = handleSubmit((values) => {
    setAppliedFilters({
      fromDate: values.fromDate ? dayjs(values.fromDate).format('YYYY-MM-DD') : '',
      toDate: values.toDate ? dayjs(values.toDate).format('YYYY-MM-DD') : '',
      salesPerson: values.salesPerson || '',
      customer: values.customer || '',
      documentType: values.documentType || '',
      source: values.source || '',
    });
    setPage(0);
  });

  const onReset = () => {
    reset({ fromDate: null, toDate: null, salesPerson: '', customer: '', documentType: '', source: '' });
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  const statCards = [
    { icon: <Diversity3Icon fontSize="small" />, label: 'Total Salespersons', value: stats.totalSalespersons ?? 0, color: 'primary' },
    { icon: <ReceiptLongOutlinedIcon fontSize="small" />, label: 'Total Invoices', value: stats.totalInvoices ?? 0, color: 'success' },
    { icon: <ShoppingCartOutlinedIcon fontSize="small" />, label: 'Total Sales Amount', value: currency(stats.totalSalesAmount), color: 'warning' },
    { icon: <RequestQuoteOutlinedIcon fontSize="small" />, label: 'Total Discount Amount', value: currency(stats.totalDiscountAmount), color: 'secondary' },
    { icon: <CancelOutlinedIcon fontSize="small" />, label: 'Total Tax Amount', value: currency(stats.totalTaxAmount), color: 'error' },
    { icon: <DonutLargeOutlinedIcon fontSize="small" />, label: 'Net Sales Amount', value: currency(stats.netSalesAmount), color: 'info' },
  ];

  const donutColors = [
    theme.palette.primary.main, theme.palette.success.main, theme.palette.warning.main,
    theme.palette.secondary.main, theme.palette.info.main, theme.palette.grey[400],
  ];
  const chartTooltipStyle = { backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 };

  // Export: current per-salesperson summary rows to CSV, same client-side
  // pattern used elsewhere (CustomerWiseSales.jsx / ProductWiseSales.jsx).
  const EXPORT_COLUMNS = [
    ['salespersonCode', 'Salesperson Code'], ['salespersonName', 'Salesperson Name'], ['totalInvoices', 'Total Invoices'],
    ['salesQuantity', 'Total Sales Quantity'], ['totalSalesAmount', 'Total Sales Amount'], ['totalDiscount', 'Total Discount'],
    ['totalTaxAmount', 'Total Tax Amount'], ['netSalesAmount', 'Net Sales Amount'], ['avgInvoiceValue', 'Avg Invoice Value'],
  ];
  const handleExport = () => {
    const header = EXPORT_COLUMNS.map(([, label]) => label).join(',');
    const lines = baseTableRows.map((r) => EXPORT_COLUMNS.map(([key]) => `"${String(r[key] ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'salesman-wise-sales.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>


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
                <FormSelect name="salesPerson" label="Salesperson" options={salespersonOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="customer" label="Customer" options={customerOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="documentType" label="Document Type" options={DOCUMENT_TYPE_OPTIONS} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="source" label="Source" options={sourceOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12}>
                <Stack direction="row" spacing={1.5} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<SearchIcon />}
                    onClick={onView}
                    disabled={isFetching}
                    sx={{ height: 40, minWidth: 120, whiteSpace: 'nowrap' }}
                  >
                    View
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
            title="Salesman-wise Sales Summary"
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
              {!isLoading && pagedRows.map((row) => (
                <MobileRecordCard
                  key={row.salespersonName}
                  title={row.salespersonName}
                  fields={[
                    { label: 'Salesperson Code', value: row.salespersonCode },
                    { label: 'Total Invoices', value: row.totalInvoices },
                    { label: 'Total Sales Quantity', value: number2(row.salesQuantity) },
                    { label: 'Total Sales Amount', value: currency(row.totalSalesAmount) },
                    { label: 'Total Discount', value: currency(row.totalDiscount) },
                    { label: 'Total Tax Amount', value: currency(row.totalTaxAmount) },
                    { label: 'Net Sales Amount', value: currency(row.netSalesAmount) },
                    { label: 'Avg Invoice Value', value: currency(row.avgInvoiceValue) },
                  ]}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title="No sales found for the selected criteria" message="Try adjusting your date range or filters" />
                )
              )}
              {!isLoading && rows.length > 0 && (
                <Card variant="outlined" sx={{ mb: 1.5, bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Total</Typography>
                    <Stack spacing={0.75}>
                      {[
                        ['Total Invoices', totals.totalInvoices], ['Total Sales Quantity', number2(totals.salesQuantity)],
                        ['Total Sales Amount', currency(totals.totalSalesAmount)], ['Total Discount', currency(totals.totalDiscount)],
                        ['Total Tax Amount', currency(totals.totalTaxAmount)], ['Net Sales Amount', currency(totals.netSalesAmount)],
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
                    <SortableHeaderCell field="salespersonCode" sort={table.sort} onSort={table.toggleSort}>Salesperson Code</SortableHeaderCell>
                    <SortableHeaderCell field="salespersonName" sort={table.sort} onSort={table.toggleSort}>Salesperson Name</SortableHeaderCell>
                    <SortableHeaderCell field="totalInvoices" sort={table.sort} onSort={table.toggleSort} align="right">Total Invoices</SortableHeaderCell>
                    <SortableHeaderCell field="salesQuantity" sort={table.sort} onSort={table.toggleSort} align="right">Total Sales Quantity</SortableHeaderCell>
                    <SortableHeaderCell field="totalSalesAmount" sort={table.sort} onSort={table.toggleSort} align="right">Total Sales Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="totalDiscount" sort={table.sort} onSort={table.toggleSort} align="right">Total Discount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="totalTaxAmount" sort={table.sort} onSort={table.toggleSort} align="right">Total Tax Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="netSalesAmount" sort={table.sort} onSort={table.toggleSort} align="right">Net Sales Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="avgInvoiceValue" sort={table.sort} onSort={table.toggleSort} align="right">Avg. Invoice Value (₹)</SortableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row) => (
                    <TableRow key={row.salespersonName} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" fontWeight={700} color="primary.main">{row.salespersonCode}</Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 160 }}>{row.salespersonName}</TableCell>
                      <TableCell align="right">{row.totalInvoices}</TableCell>
                      <TableCell align="right">{number2(row.salesQuantity)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.totalSalesAmount)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.totalDiscount)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.totalTaxAmount)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.netSalesAmount)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.avgInvoiceValue)}</TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9}>
                        {isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title="No sales found for the selected criteria" message="Try adjusting your date range or filters" />
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && rows.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={2}><Typography fontWeight={700}>Total</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{totals.totalInvoices}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{number2(totals.salesQuantity)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.totalSalesAmount)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.totalDiscount)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.totalTaxAmount)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.netSalesAmount)}</Typography></TableCell>
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Top 5 Salespersons by Sales Amount</Typography>
              <Box sx={{ width: '100%', height: 240, mt: 1 }}>
                <ResponsiveContainer>
                  <BarChart data={topSalespersons} margin={{ top: 20, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} tickFormatter={(v) => lakh(v)} />
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => [lakh(v), 'Amount']} />
                    <Bar dataKey="value" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} maxBarSize={36}>
                      <LabelList dataKey="value" position="top" formatter={(v) => lakh(v)} style={{ fontSize: 10, fill: theme.palette.text.secondary }} />
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Sales Amount Contribution</Typography>
              <Box sx={{ width: '100%', height: 180, position: 'relative' }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={contribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                      {contribution.map((entry, i) => <Cell key={entry.name} fill={donutColors[i % donutColors.length]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => currency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <Typography variant="caption" color="text.secondary" display="block">Total</Typography>
                  <Typography variant="subtitle2" fontWeight={700}>{lakh(Math.round(((stats.totalSalesAmount || 0) / 100000) * 100) / 100)}</Typography>
                </Box>
              </Box>
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {contribution.length === 0 && (
                  <Typography variant="caption" color="text.secondary" align="center">No data for the selected criteria</Typography>
                )}
                {contribution.map((d, i) => (
                  <Stack key={d.name} direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: donutColors[i % donutColors.length], flexShrink: 0 }} />
                      <Typography variant="caption" color="text.secondary" noWrap>{d.name}</Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">{d.percent}%</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Sales Amount Trend</Typography>
              <Typography variant="caption" color="text.secondary">Amount (₹, in Lakhs)</Typography>
              <Box sx={{ width: '100%', height: 220, mt: 1 }}>
                <ResponsiveContainer>
                  <LineChart data={trend} margin={{ top: 20, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} tickFormatter={(v) => lakh(v)} />
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => [lakh(v), 'Sales Amount']} />
                    <Line type="monotone" dataKey="value" name="Sales Amount" stroke={theme.palette.primary.main} strokeWidth={2.5} dot={{ r: 4, fill: theme.palette.primary.main, strokeWidth: 0 }} activeDot={{ r: 6 }}>
                      <LabelList dataKey="value" position="top" formatter={(v) => lakh(v)} style={{ fontSize: 10, fill: theme.palette.text.secondary }} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <ReportPrintable
        title="Salesman-wise Sales"
        subtitle="View and analyze sales performance grouped by salespersons."
        filters={printFilters}
        columns={tableColumns}
        // Print always reflects the full Filters-section-scoped dataset, not
        // whatever the quick search box / column filter popover currently
        // narrows the on-screen table to — see SalesQuotationRegister.jsx.
        rows={baseTableRows}
        totals={totals}
      />
    </Box>
  );
}
