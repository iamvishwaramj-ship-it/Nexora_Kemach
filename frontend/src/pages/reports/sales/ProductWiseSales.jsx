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
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import CurrencyRupeeOutlinedIcon from '@mui/icons-material/CurrencyRupeeOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import dayjs from 'dayjs';
import FormSelect from '../../../components/form/FormSelect';
import FormDatePicker from '../../../components/form/FormDatePicker';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import CompanyBadge from '../../../components/common/CompanyBadge';
import EntityListPagination from '../../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../../components/data-display/useIsMobileListView';
import StatCard from '../../../components/data-display/StatCard';
import { productApi, productGroupApi, salesEmployeeApi } from '../../../features/resources';
import { useGetProductWiseSalesReportQuery } from '../../../features/sales/productWiseSalesReportApi';
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

const DEFAULT_FILTERS = { fromDate: '', toDate: '', product: '', category: '', salesPerson: '', source: '' };

// Reports > Sales > Product-wise Sales print layout — see ReportPrintable.jsx.
const PRINT_FILTER_LABELS = {
  fromDate: 'From Date', toDate: 'To Date', product: 'Product', category: 'Category', salesPerson: 'Salesperson', source: 'Source',
};
const PRINT_DATE_FIELDS = ['fromDate', 'toDate'];

export default function ProductWiseSales() {
  const theme = useTheme();
  const isMobile = useIsMobileListView();

  const { data: products } = productApi.useList();
  const { data: productGroups } = productGroupApi.useList();
  const { data: salesEmployees } = salesEmployeeApi.useList();

  const productOptions = useMemo(() => ([
    { label: 'All Products', value: '' },
    ...(products || []).map((p) => ({ label: p.productName, value: p.productCode })),
  ]), [products]);

  const categoryOptions = useMemo(() => ([
    { label: 'All Categories', value: '' },
    ...(productGroups || []).map((g) => ({ label: g.groupName, value: g.groupName })),
  ]), [productGroups]);

  const salespersonOptions = useMemo(() => ([
    { label: 'All Salespersons', value: '' },
    ...(salesEmployees || []).map((e) => ({ label: e.employeeName, value: e.employeeName })),
  ]), [salesEmployees]);

  const sourceOptions = useMemo(() => ([
    { label: 'All Sources', value: '' },
    ...ENQUIRY_SOURCE_OPTIONS.map((s) => ({ label: s, value: s })),
  ]), []);

  // Filter bar is a report toolbar, not a create/edit form — no Zod
  // validation or persisted mutation, same as other report pages.
  const methods = useForm({
    defaultValues: { fromDate: null, toDate: null, product: '', category: '', salesPerson: '', source: '' },
  });
  const { handleSubmit, reset } = methods;

  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const { data, isLoading, isFetching } = useGetProductWiseSalesReportQuery(appliedFilters);
  const baseTableRows = data?.rows || [];

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'productCode', headerName: 'Item No', filter: 'text' },
    { field: 'productName', headerName: 'Description', filter: 'text' },
    { field: 'category', headerName: 'Category', filter: 'select' },
    { field: 'salesQuantity', headerName: 'Sales Quantity', filter: 'numberRange', sortValue: (row) => (row.salesQuantity == null || row.salesQuantity === '' ? null : Number(row.salesQuantity)) },
    { field: 'uom', headerName: 'UOM', filter: 'text' },
    { field: 'totalInvoices', headerName: 'Total Invoices', filter: 'text' },
    { field: 'totalSalesAmount', headerName: 'Total Sales Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.totalSalesAmount == null || row.totalSalesAmount === '' ? null : Number(row.totalSalesAmount)) },
    { field: 'discountAmount', headerName: 'Discount Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.discountAmount == null || row.discountAmount === '' ? null : Number(row.discountAmount)) },
    { field: 'netSalesAmount', headerName: 'Net Sales Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.netSalesAmount == null || row.netSalesAmount === '' ? null : Number(row.netSalesAmount)) },
    { field: 'avgSellingPrice', headerName: 'Avg. Selling Price (₹)', filter: 'numberRange', sortValue: (row) => (row.avgSellingPrice == null || row.avgSellingPrice === '' ? null : Number(row.avgSellingPrice)) },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const totals = data?.totals || {};
  const stats = data?.stats || {};
  const topProducts = data?.topProducts || [];
  const categoryContribution = data?.categoryContribution || [];
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
      product: values.product || '',
      category: values.category || '',
      salesPerson: values.salesPerson || '',
      source: values.source || '',
    });
    setPage(0);
  });

  const onReset = () => {
    reset({ fromDate: null, toDate: null, product: '', category: '', salesPerson: '', source: '' });
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  const statCards = [
    { icon: <Inventory2Icon fontSize="small" />, label: 'Total Products', value: stats.totalProducts ?? 0, color: 'primary' },
    { icon: <ReceiptLongOutlinedIcon fontSize="small" />, label: 'Total Invoices', value: stats.totalInvoices ?? 0, color: 'success' },
    { icon: <ShoppingCartOutlinedIcon fontSize="small" />, label: 'Total Sales Quantity', value: number2(stats.totalSalesQuantity), color: 'warning' },
    { icon: <CurrencyRupeeOutlinedIcon fontSize="small" />, label: 'Total Sales Amount', value: currency(stats.totalSalesAmount), color: 'secondary' },
    { icon: <CancelOutlinedIcon fontSize="small" />, label: 'Total Discount Amount', value: currency(stats.totalDiscountAmount), color: 'error' },
    { icon: <AccessTimeOutlinedIcon fontSize="small" />, label: 'Net Sales Amount', value: currency(stats.netSalesAmount), color: 'info' },
  ];

  const donutColors = [
    theme.palette.primary.main, theme.palette.warning.main, theme.palette.success.main,
    theme.palette.secondary.main, theme.palette.error.main, theme.palette.grey[400],
  ];
  const chartTooltipStyle = { backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 };

  // Export: current per-product summary rows to CSV, same client-side
  // pattern used elsewhere (CustomerWiseSales.jsx).
  const EXPORT_COLUMNS = [
    ['productCode', 'Item No'], ['productName', 'Description'], ['category', 'Category'],
    ['salesQuantity', 'Sales Quantity'], ['uom', 'UOM'], ['totalInvoices', 'Total Invoices'],
    ['totalSalesAmount', 'Total Sales Amount'], ['discountAmount', 'Discount Amount'],
    ['netSalesAmount', 'Net Sales Amount'], ['avgSellingPrice', 'Avg Selling Price'],
  ];
  const handleExport = () => {
    const header = EXPORT_COLUMNS.map(([, label]) => label).join(',');
    const lines = baseTableRows.map((r) => EXPORT_COLUMNS.map(([key]) => `"${String(r[key] ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product-wise-sales.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<Inventory2OutlinedIcon />}
        title="Product-wise Sales"
        subtitle="View and analyze sales performance grouped by products."
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
                <FormSelect name="product" label="Product" options={productOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="category" label="Category" options={categoryOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="salesPerson" label="Salesperson" options={salespersonOptions} emptyValue="" />
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
            title="Product-wise Sales Summary"
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
                  key={row.productCode}
                  title={row.productName}
                  fields={[
                    { label: 'Item No', value: row.productCode },
                    { label: 'Category', value: row.category },
                    { label: 'Sales Quantity', value: number2(row.salesQuantity) },
                    { label: 'UOM', value: row.uom },
                    { label: 'Total Invoices', value: row.totalInvoices },
                    { label: 'Total Sales Amount', value: currency(row.totalSalesAmount) },
                    { label: 'Discount Amount', value: currency(row.discountAmount) },
                    { label: 'Net Sales Amount', value: currency(row.netSalesAmount) },
                    { label: 'Avg Selling Price', value: currency(row.avgSellingPrice) },
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
                        ['Sales Quantity', number2(totals.salesQuantity)], ['Total Invoices', totals.totalInvoices],
                        ['Total Sales Amount', currency(totals.totalSalesAmount)], ['Discount Amount', currency(totals.discountAmount)],
                        ['Net Sales Amount', currency(totals.netSalesAmount)],
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
                    <SortableHeaderCell field="productCode" sort={table.sort} onSort={table.toggleSort}>Item No</SortableHeaderCell>
                    <SortableHeaderCell field="productName" sort={table.sort} onSort={table.toggleSort}>Description</SortableHeaderCell>
                    <SortableHeaderCell field="category" sort={table.sort} onSort={table.toggleSort}>Category</SortableHeaderCell>
                    <SortableHeaderCell field="salesQuantity" sort={table.sort} onSort={table.toggleSort} align="right">Sales Quantity</SortableHeaderCell>
                    <SortableHeaderCell field="uom" sort={table.sort} onSort={table.toggleSort}>UOM</SortableHeaderCell>
                    <SortableHeaderCell field="totalInvoices" sort={table.sort} onSort={table.toggleSort} align="right">Total Invoices</SortableHeaderCell>
                    <SortableHeaderCell field="totalSalesAmount" sort={table.sort} onSort={table.toggleSort} align="right">Total Sales Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="discountAmount" sort={table.sort} onSort={table.toggleSort} align="right">Discount Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="netSalesAmount" sort={table.sort} onSort={table.toggleSort} align="right">Net Sales Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="avgSellingPrice" sort={table.sort} onSort={table.toggleSort} align="right">Avg. Selling Price (₹)</SortableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row) => (
                    <TableRow key={row.productCode} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" fontWeight={700} color="primary.main">{row.productCode}</Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 160 }}>{row.productName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.category}</TableCell>
                      <TableCell align="right">{number2(row.salesQuantity)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.uom}</TableCell>
                      <TableCell align="right">{row.totalInvoices}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.totalSalesAmount)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.discountAmount)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.netSalesAmount)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.avgSellingPrice)}</TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10}>
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
                      <TableCell colSpan={3}><Typography fontWeight={700}>Total</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{number2(totals.salesQuantity)}</Typography></TableCell>
                      <TableCell>—</TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{totals.totalInvoices}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.totalSalesAmount)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.discountAmount)}</Typography></TableCell>
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Top 5 Products by Sales Amount</Typography>
              <Box sx={{ width: '100%', height: 240, mt: 1 }}>
                <ResponsiveContainer>
                  <BarChart data={topProducts} margin={{ top: 20, right: 8, left: -12, bottom: 0 }}>
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Sales Amount by Category</Typography>
              <Box sx={{ width: '100%', height: 180, position: 'relative' }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={categoryContribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                      {categoryContribution.map((entry, i) => <Cell key={entry.name} fill={donutColors[i % donutColors.length]} />)}
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
                {categoryContribution.length === 0 && (
                  <Typography variant="caption" color="text.secondary" align="center">No data for the selected criteria</Typography>
                )}
                {categoryContribution.map((d, i) => (
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
        title="Product-wise Sales"
        subtitle="View and analyze sales performance grouped by products."
        filters={printFilters}
        columns={tableColumns}
        // Print always reflects the full Filters-section-scoped dataset, not
        // whatever the quick search box / column filter popover currently
        // narrows the on-screen table to — see SalesQuotationRegister.jsx.
        rows={baseTableRows}
        totals={totals}
        orientation="landscape"
      />
    </Box>
  );
}
