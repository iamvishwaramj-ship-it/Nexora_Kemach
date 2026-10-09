import React, { useMemo, useState } from 'react';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import LoadingState from '../../../components/feedback/LoadingState';
import EmptyState from '../../../components/data-display/EmptyState';
import { useForm, FormProvider } from 'react-hook-form';
import {
  Box, Typography, Button, Card, CardContent, Stack, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
} from 'recharts';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import CurrencyRupeeOutlinedIcon from '@mui/icons-material/CurrencyRupeeOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PercentOutlinedIcon from '@mui/icons-material/PercentOutlined';
import dayjs from 'dayjs';
import FormSelect from '../../../components/form/FormSelect';
import FormDatePicker from '../../../components/form/FormDatePicker';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import CompanyBadge from '../../../components/common/CompanyBadge';
import EntityListPagination from '../../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../../components/data-display/useIsMobileListView';
import StatCard from '../../../components/data-display/StatCard';
import { customerApi, productApi, salesEmployeeApi } from '../../../features/resources';
import { useGetProfitabilityReportQuery } from '../../../features/sales/profitabilityReportApi';
import useTableFeatures from '../../../components/data-display/useTableFeatures';
import TableToolbar from '../../../components/data-display/TableToolbar';
import SortableHeaderCell from '../../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import TableFilterPanel from '../../../components/data-display/TableFilterPanel';
import ReportPrintable from '../../../components/print/ReportPrintable';
import { buildPrintFilters } from '../../../components/print/reportPrint';

const PAGE_SIZE = 10;

const BASIS_OPTIONS = [
  { label: 'Customer', value: 'customer' },
  { label: 'Product', value: 'product' },
];

const currency = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const percent = (v) => `${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const lakh = (v) => `${Number(v || 0)}L`;

const DEFAULT_FILTERS = { fromDate: '', toDate: '', basis: 'customer', customer: '', product: '', salesPerson: '' };

// Reports > Sales > Profitability Analysis print layout — see ReportPrintable.jsx.
const PRINT_FILTER_LABELS = {
  fromDate: 'From Date', toDate: 'To Date', basis: 'Group By', customer: 'Customer', product: 'Product', salesPerson: 'Salesperson',
};
const PRINT_DATE_FIELDS = ['fromDate', 'toDate'];

export default function ProfitabilityAnalysis() {
  const theme = useTheme();
  const isMobile = useIsMobileListView();

  const { data: customers } = customerApi.useList();
  const { data: products } = productApi.useList();
  const { data: salesEmployees } = salesEmployeeApi.useList();

  const customerOptions = useMemo(() => ([
    { label: 'All Customers', value: '' },
    ...(customers || []).map((c) => ({ label: c.customerName, value: c.customerName })),
  ]), [customers]);

  const productOptions = useMemo(() => ([
    { label: 'All Products', value: '' },
    ...(products || []).map((p) => ({ label: p.productName, value: p.productCode })),
  ]), [products]);

  const salespersonOptions = useMemo(() => ([
    { label: 'All Salespersons', value: '' },
    ...(salesEmployees || []).map((e) => ({ label: e.employeeName, value: e.employeeName })),
  ]), [salesEmployees]);

  // Filter bar is a report toolbar, not a create/edit form — no Zod
  // validation or persisted mutation, same as other report pages.
  const methods = useForm({
    defaultValues: { fromDate: null, toDate: null, basis: 'customer', customer: '', product: '', salesPerson: '' },
  });
  const { handleSubmit, reset } = methods;

  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const { data, isLoading, isFetching } = useGetProfitabilityReportQuery(appliedFilters);
  const baseTableRows = data?.rows || [];
  const totals = data?.totals || {};
  const stats = data?.stats || {};
  const topCustomers = data?.topCustomers || [];
  const topCustomersTotal = data?.topCustomersTotal || {};
  const topProducts = data?.topProducts || [];
  const topProductsTotal = data?.topProductsTotal || {};
  const trend = data?.trend || [];
  const detailsBasis = appliedFilters.basis || 'customer';

  // Sorting for the two "Top 5" summary cards. No search box — they are
  // five-row cards, so re-ordering is the only control worth having.
  const topNColumns = useMemo(() => ([
    { field: 'customerName', headerName: 'Customer Name', filter: false },
    { field: 'productName', headerName: 'Description', filter: false },
    { field: 'salesAmount', headerName: 'Sales Amount (₹)', filter: false, sortValue: (r) => Number(r.salesAmount) || 0 },
    { field: 'costAmount', headerName: 'Cost Amount (₹)', filter: false, sortValue: (r) => Number(r.costAmount) || 0 },
    { field: 'grossProfit', headerName: 'Gross Profit (₹)', filter: false, sortValue: (r) => Number(r.grossProfit) || 0 },
    { field: 'gpPercent', headerName: 'GP %', filter: false, sortValue: (r) => Number(r.gpPercent) || 0 },
  ]), []);
  const topCustomersTable = useTableFeatures(topCustomers, topNColumns);
  const topProductsTable = useTableFeatures(topProducts, topNColumns);

  // The first two columns swap between product and customer with the report
  // basis, so the column set is derived from detailsBasis rather than fixed.
  const tableColumns = useMemo(() => ([
    detailsBasis === 'product'
      ? { field: 'productCode', headerName: 'Item No', filter: 'text' }
      : { field: 'customerCode', headerName: 'Customer Code', filter: 'text' },
    detailsBasis === 'product'
      ? { field: 'productName', headerName: 'Description', filter: 'text' }
      : { field: 'customerName', headerName: 'Customer Name', filter: 'text' },
    { field: 'salesAmount', headerName: 'Sales Amount (₹)', filter: 'numberRange', sortValue: (row) => Number(row.salesAmount) || 0 },
    { field: 'costAmount', headerName: 'Cost Amount (₹)', filter: 'numberRange', sortValue: (row) => Number(row.costAmount) || 0 },
    { field: 'grossProfit', headerName: 'Gross Profit (₹)', filter: 'numberRange', sortValue: (row) => Number(row.grossProfit) || 0 },
    { field: 'gpPercent', headerName: 'Gross Profit %', filter: 'numberRange', sortValue: (row) => Number(row.gpPercent) || 0 },
    { field: 'percentOfTotalSales', headerName: '% of Total Sales', filter: 'numberRange', sortValue: (row) => Number(row.percentOfTotalSales) || 0 },
  ]), [detailsBasis]);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const rows = table.rows;

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
      basis: values.basis || 'customer',
      customer: values.customer || '',
      product: values.product || '',
      salesPerson: values.salesPerson || '',
    });
    setPage(0);
  });

  const onReset = () => {
    reset({ fromDate: null, toDate: null, basis: 'customer', customer: '', product: '', salesPerson: '' });
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  const statCards = [
    { icon: <CurrencyRupeeOutlinedIcon fontSize="small" />, label: 'Total Sales Amount', value: currency(stats.totalSalesAmount), color: 'primary' },
    { icon: <Inventory2OutlinedIcon fontSize="small" />, label: 'Total Cost Amount', value: currency(stats.totalCostAmount), color: 'success' },
    { icon: <TrendingUpIcon fontSize="small" />, label: 'Gross Profit', value: currency(stats.grossProfit), color: 'warning' },
    { icon: <PercentOutlinedIcon fontSize="small" />, label: 'Gross Profit %', value: percent(stats.grossProfitPercent), color: 'secondary' },
  ];

  const chartTooltipStyle = { backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 };

  // Export: current Profitability Details rows to CSV, keyed by basis —
  // same client-side pattern used elsewhere (CustomerWiseSales.jsx).
  const EXPORT_COLUMNS = detailsBasis === 'product'
    ? [['productCode', 'Item No'], ['productName', 'Description'], ['salesAmount', 'Sales Amount'], ['costAmount', 'Cost Amount'], ['grossProfit', 'Gross Profit'], ['gpPercent', 'Gross Profit %'], ['percentOfTotalSales', '% of Total Sales']]
    : [['customerCode', 'Customer Code'], ['customerName', 'Customer Name'], ['salesAmount', 'Sales Amount'], ['costAmount', 'Cost Amount'], ['grossProfit', 'Gross Profit'], ['gpPercent', 'Gross Profit %'], ['percentOfTotalSales', '% of Total Sales']];
  const handleExport = () => {
    const header = EXPORT_COLUMNS.map(([, label]) => label).join(',');
    const lines = baseTableRows.map((r) => EXPORT_COLUMNS.map(([key]) => `"${String(r[key] ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'profitability-analysis.csv';
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
                <FormSelect name="basis" label="Basis" options={BASIS_OPTIONS} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="customer" label="Customer" options={customerOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="product" label="Product" options={productOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="salesPerson" label="Salesperson" options={salespersonOptions} emptyValue="" />
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
          <Grid item xs={12} sm={6} md={3} key={c.label}>
            <StatCard {...c} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Profit Trend</Typography>
              <Box sx={{ width: '100%', height: 280, mt: 1 }}>
                <ResponsiveContainer>
                  <ComposedChart data={trend} margin={{ top: 20, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} tickFormatter={(v) => lakh(v)} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v, n) => (n === 'Gross Profit %' ? [`${v}%`, n] : [lakh(v), n])} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="left" dataKey="salesAmount" name="Sales Amount" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} maxBarSize={36} />
                    <Line yAxisId="right" type="monotone" dataKey="gpPercent" name="Gross Profit %" stroke={theme.palette.warning.main} strokeWidth={2.5} dot={{ r: 4, fill: theme.palette.warning.main, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent sx={{ p: 0 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ px: 2, pt: 2, pb: 1 }}>Profitability by Customer (Top 5)</Typography>
              <ScrollableTableContainer maxHeight="min(45vh, 320px)">
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <SortableHeaderCell field="customerName" sort={topCustomersTable.sort} onSort={topCustomersTable.toggleSort}>Customer Name</SortableHeaderCell>
                      <SortableHeaderCell field="salesAmount" sort={topCustomersTable.sort} onSort={topCustomersTable.toggleSort} align="right">Sales Amount (₹)</SortableHeaderCell>
                      <SortableHeaderCell field="costAmount" sort={topCustomersTable.sort} onSort={topCustomersTable.toggleSort} align="right">Cost Amount (₹)</SortableHeaderCell>
                      <SortableHeaderCell field="grossProfit" sort={topCustomersTable.sort} onSort={topCustomersTable.toggleSort} align="right">Gross Profit (₹)</SortableHeaderCell>
                      <SortableHeaderCell field="gpPercent" sort={topCustomersTable.sort} onSort={topCustomersTable.toggleSort} align="right">GP %</SortableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topCustomersTable.rows.map((r, i) => (
                      <TableRow key={r.customerName} hover>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell sx={{ minWidth: 130 }}>{r.customerName}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(r.salesAmount)}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(r.costAmount)}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(r.grossProfit)}</TableCell>
                        <TableCell align="right">{percent(r.gpPercent)}</TableCell>
                      </TableRow>
                    ))}
                    {topCustomers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>No data</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {topCustomers.length > 0 && (
                      <TableRow>
                        <TableCell colSpan={2}><Typography fontWeight={700}>Total</Typography></TableCell>
                        <TableCell align="right"><Typography fontWeight={700}>{currency(topCustomersTotal.salesAmount)}</Typography></TableCell>
                        <TableCell align="right"><Typography fontWeight={700}>{currency(topCustomersTotal.costAmount)}</Typography></TableCell>
                        <TableCell align="right"><Typography fontWeight={700}>{currency(topCustomersTotal.grossProfit)}</Typography></TableCell>
                        <TableCell>—</TableCell>
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
            <CardContent sx={{ p: 0 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ px: 2, pt: 2, pb: 1 }}>Profitability by Product (Top 5)</Typography>
              <ScrollableTableContainer maxHeight="min(45vh, 320px)">
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <SortableHeaderCell field="productName" sort={topProductsTable.sort} onSort={topProductsTable.toggleSort}>Description</SortableHeaderCell>
                      <SortableHeaderCell field="salesAmount" sort={topProductsTable.sort} onSort={topProductsTable.toggleSort} align="right">Sales Amount (₹)</SortableHeaderCell>
                      <SortableHeaderCell field="costAmount" sort={topProductsTable.sort} onSort={topProductsTable.toggleSort} align="right">Cost Amount (₹)</SortableHeaderCell>
                      <SortableHeaderCell field="grossProfit" sort={topProductsTable.sort} onSort={topProductsTable.toggleSort} align="right">Gross Profit (₹)</SortableHeaderCell>
                      <SortableHeaderCell field="gpPercent" sort={topProductsTable.sort} onSort={topProductsTable.toggleSort} align="right">GP %</SortableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topProductsTable.rows.map((r, i) => (
                      <TableRow key={r.productCode} hover>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell sx={{ minWidth: 130 }}>{r.productName}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(r.salesAmount)}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(r.costAmount)}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(r.grossProfit)}</TableCell>
                        <TableCell align="right">{percent(r.gpPercent)}</TableCell>
                      </TableRow>
                    ))}
                    {topProducts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>No data</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {topProducts.length > 0 && (
                      <TableRow>
                        <TableCell colSpan={2}><Typography fontWeight={700}>Total</Typography></TableCell>
                        <TableCell align="right"><Typography fontWeight={700}>{currency(topProductsTotal.salesAmount)}</Typography></TableCell>
                        <TableCell align="right"><Typography fontWeight={700}>{currency(topProductsTotal.costAmount)}</Typography></TableCell>
                        <TableCell align="right"><Typography fontWeight={700}>{currency(topProductsTotal.grossProfit)}</Typography></TableCell>
                        <TableCell>—</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollableTableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <TableToolbar
            title="Profitability Details"
            searchPlaceholder="Search details..."
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
                  key={detailsBasis === 'product' ? row.productCode : row.customerName}
                  title={detailsBasis === 'product' ? row.productName : row.customerName}
                  fields={[
                    ...(detailsBasis === 'product'
                      ? [{ label: 'Item No', value: row.productCode }]
                      : [{ label: 'Customer Code', value: row.customerCode }]),
                    { label: 'Sales Amount', value: currency(row.salesAmount) },
                    { label: 'Cost Amount', value: currency(row.costAmount) },
                    { label: 'Gross Profit', value: currency(row.grossProfit) },
                    { label: 'Gross Profit %', value: percent(row.gpPercent) },
                    { label: '% of Total Sales', value: percent(row.percentOfTotalSales) },
                  ]}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title="No data found for the selected criteria" message="Try adjusting your date range or filters" />
                )
              )}
              {!isLoading && rows.length > 0 && (
                <Card variant="outlined" sx={{ mb: 1.5, bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Total</Typography>
                    <Stack spacing={0.75}>
                      {[
                        ['Sales Amount', currency(totals.salesAmount)], ['Cost Amount', currency(totals.costAmount)],
                        ['Gross Profit', currency(totals.grossProfit)],
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
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {detailsBasis === 'product' ? (
                      <>
                        <SortableHeaderCell field="productCode" sort={table.sort} onSort={table.toggleSort}>Item No</SortableHeaderCell>
                        <SortableHeaderCell field="productName" sort={table.sort} onSort={table.toggleSort}>Description</SortableHeaderCell>
                      </>
                    ) : (
                      <>
                        <SortableHeaderCell field="customerCode" sort={table.sort} onSort={table.toggleSort}>Customer Code</SortableHeaderCell>
                        <SortableHeaderCell field="customerName" sort={table.sort} onSort={table.toggleSort}>Customer Name</SortableHeaderCell>
                      </>
                    )}
                    <SortableHeaderCell field="salesAmount" sort={table.sort} onSort={table.toggleSort} align="right">Sales Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="costAmount" sort={table.sort} onSort={table.toggleSort} align="right">Cost Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="grossProfit" sort={table.sort} onSort={table.toggleSort} align="right">Gross Profit (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="gpPercent" sort={table.sort} onSort={table.toggleSort} align="right">Gross Profit %</SortableHeaderCell>
                    <SortableHeaderCell field="percentOfTotalSales" sort={table.sort} onSort={table.toggleSort} align="right">% of Total Sales</SortableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row) => (
                    <TableRow key={detailsBasis === 'product' ? row.productCode : row.customerName} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" fontWeight={700} color="primary.main">
                          {detailsBasis === 'product' ? row.productCode : row.customerCode}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 160 }}>{detailsBasis === 'product' ? row.productName : row.customerName}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.salesAmount)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.costAmount)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.grossProfit)}</TableCell>
                      <TableCell align="right">{percent(row.gpPercent)}</TableCell>
                      <TableCell align="right">{percent(row.percentOfTotalSales)}</TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        {isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title="No data found for the selected criteria" message="Try adjusting your date range or filters" />
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && rows.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={2}><Typography fontWeight={700}>Total</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.salesAmount)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.costAmount)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.grossProfit)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{percent(stats.grossProfitPercent)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>100.00%</Typography></TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollableTableContainer>
          )}

          <EntityListPagination total={rows.length} page={page} onChange={setPage} pageSize={pageSize} onPageSizeChange={(v) => { setPageSize(v); setPage(0); }} />
        </CardContent>
      </Card>

      <ReportPrintable
        title="Profitability Analysis"
        subtitle="Analyze profitability based on sales performance."
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
