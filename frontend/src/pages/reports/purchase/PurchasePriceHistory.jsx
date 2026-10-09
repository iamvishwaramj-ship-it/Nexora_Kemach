import React, { useMemo, useState } from 'react';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import LoadingState from '../../../components/feedback/LoadingState';
import EmptyState from '../../../components/data-display/EmptyState';
import { useForm, FormProvider } from 'react-hook-form';
import {
  Box, Typography, Button, Card, CardContent, Stack, Grid, Table, TableBody, TableCell,
  TableHead, TableRow,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, LabelList,
} from 'recharts';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import CurrencyRupeeOutlinedIcon from '@mui/icons-material/CurrencyRupeeOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import TrendingDownOutlinedIcon from '@mui/icons-material/TrendingDownOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import DonutLargeOutlinedIcon from '@mui/icons-material/DonutLargeOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import dayjs from 'dayjs';
import FormSelect from '../../../components/form/FormSelect';
import FormDatePicker from '../../../components/form/FormDatePicker';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import CompanyBadge from '../../../components/common/CompanyBadge';
import EntityListPagination from '../../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../../components/data-display/useIsMobileListView';
import StatCard from '../../../components/data-display/StatCard';
import { supplierApi, productApi, productGroupApi, branchApi } from '../../../features/resources';
import { useGetPurchasePriceHistoryReportQuery } from '../../../features/purchase/purchasePriceHistoryReportApi';
import useTableFeatures from '../../../components/data-display/useTableFeatures';
import TableToolbar from '../../../components/data-display/TableToolbar';
import SortableHeaderCell from '../../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import TableFilterPanel from '../../../components/data-display/TableFilterPanel';
import ReportPrintable from '../../../components/print/ReportPrintable';
import { buildPrintFilters } from '../../../components/print/reportPrint';

const PAGE_SIZE = 10;

const HISTORY_VIEW_OPTIONS = [
  { label: 'Entire Purchase History', value: '' },
  { label: 'Last 5 Purchases', value: '5' },
  { label: 'Last 10 Purchases', value: '10' },
  { label: 'Last 15 Purchases', value: '15' },
  { label: 'Last 20 Purchases', value: '20' },
  { label: 'Last 50 Purchases', value: '50' },
];

const currency = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const number2 = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  ;
const formatDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '—');

const DEFAULT_FILTERS = { productGroup: '', product: '', supplier: '', branch: '', fromDate: '', toDate: '', historyView: '' };

// Reports > Purchase > Purchase Price History print layout — see ReportPrintable.jsx.
const PRINT_FILTER_LABELS = {
  productGroup: 'Product Group', product: 'Product', supplier: 'Supplier', branch: 'Branch',
  fromDate: 'From Date', toDate: 'To Date', historyView: 'History View',
};
const PRINT_DATE_FIELDS = ['fromDate', 'toDate'];

export default function PurchasePriceHistory() {
  const theme = useTheme();
  const isMobile = useIsMobileListView();

  const { data: productGroups } = productGroupApi.useList();
  const { data: products } = productApi.useList();
  const { data: suppliers } = supplierApi.useList();
  const { data: branches } = branchApi.useList();

  const productGroupOptions = useMemo(() => ([
    { label: 'All Groups', value: '' },
    ...(productGroups || []).map((g) => ({ label: g.groupName, value: g.groupName })),
  ]), [productGroups]);

  // Product Group narrows this list client-side (cascading select) — the
  // report itself only ever queries the one selected Product.
  const methods = useForm({
    defaultValues: { productGroup: '', product: '', supplier: '', branch: '', fromDate: null, toDate: null, historyView: '' },
  });
  const { handleSubmit, reset, watch } = methods;
  const selectedProductGroup = watch('productGroup');

  const productOptions = useMemo(() => ([
    ...(products || [])
      .filter((p) => !selectedProductGroup || p.productGroup === selectedProductGroup)
      .map((p) => ({ label: `${p.productCode} - ${p.productName}`, value: p.productCode })),
  ]), [products, selectedProductGroup]);

  const supplierOptions = useMemo(() => ([
    { label: 'All Suppliers', value: '' },
    ...(suppliers || []).map((s) => ({ label: s.supplierName, value: s.supplierName })),
  ]), [suppliers]);

  const branchOptions = useMemo(() => ([
    { label: 'All Branches', value: '' },
    ...(branches || []).map((b) => ({ label: b.branchName, value: b.branchName })),
  ]), [branches]);

  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const { data, isLoading, isFetching } = useGetPurchasePriceHistoryReportQuery(appliedFilters, { skip: !appliedFilters.product });
  const productInfo = data?.productInfo || null;
  const baseTableRows = data?.rows || [];

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'purchaseDate', headerName: 'Purchase Date', filter: 'dateRange', sortValue: (row) => (row.purchaseDate ? new Date(row.purchaseDate).getTime() : null), searchValue: (row) => formatDate(row.purchaseDate) },
    { field: 'documentNo', headerName: 'Document No.', filter: 'text' },
    { field: 'supplierCode', headerName: 'Supplier Code', filter: 'text' },
    { field: 'supplierName', headerName: 'Supplier Name', filter: 'text' },
    { field: 'quantity', headerName: 'Quantity', filter: 'numberRange', sortValue: (row) => (row.quantity == null || row.quantity === '' ? null : Number(row.quantity)) },
    { field: 'uom', headerName: 'UOM', filter: 'text' },
    { field: 'unitPrice', headerName: 'Unit Price (₹)', filter: 'numberRange', sortValue: (row) => (row.unitPrice == null || row.unitPrice === '' ? null : Number(row.unitPrice)) },
    { field: 'discountPercent', headerName: 'Discount (%)', filter: 'numberRange', sortValue: (row) => (row.discountPercent == null || row.discountPercent === '' ? null : Number(row.discountPercent)) },
    { field: 'netPrice', headerName: 'Net Price (₹)', filter: 'numberRange', sortValue: (row) => (row.netPrice == null || row.netPrice === '' ? null : Number(row.netPrice)) },
    { field: 'purchaseAmount', headerName: 'Purchase Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.purchaseAmount == null || row.purchaseAmount === '' ? null : Number(row.purchaseAmount)) },
    { field: 'purchaseType', headerName: 'Purchase Type', filter: 'text' },
    { field: 'branch', headerName: 'Branch', filter: 'text' },
    { field: 'buyer', headerName: 'Buyer', filter: 'text' },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const stats = data?.stats || {};
  const trend = data?.trend || [];
  const supplierAverages = data?.supplierAverages || [];
  const quantityVsPrice = data?.quantityVsPrice || [];
  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  // Print: full filtered/sorted rows (never just the current page), fed into
  // the shared ReportPrintable layout — see components/print/ReportPrintable.jsx.
  const printFilters = useMemo(
    () => buildPrintFilters(appliedFilters, PRINT_FILTER_LABELS, PRINT_DATE_FIELDS),
    [appliedFilters],
  );

  const onView = handleSubmit((values) => {
    setAppliedFilters({
      productGroup: values.productGroup || '',
      product: values.product || '',
      supplier: values.supplier || '',
      branch: values.branch || '',
      fromDate: values.fromDate ? dayjs(values.fromDate).format('YYYY-MM-DD') : '',
      toDate: values.toDate ? dayjs(values.toDate).format('YYYY-MM-DD') : '',
      historyView: values.historyView || '',
    });
    setPage(0);
  });

  const onReset = () => {
    reset({ productGroup: '', product: '', supplier: '', branch: '', fromDate: null, toDate: null, historyView: '' });
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  const statCards = [
    { icon: <CurrencyRupeeOutlinedIcon fontSize="small" />, label: `Current Purchase Price${stats.currentDate ? ` (As on ${formatDate(stats.currentDate)})` : ''}`, value: currency(stats.currentPrice), color: 'warning' },
    { icon: <EventOutlinedIcon fontSize="small" />, label: `Last Purchase Price${stats.lastPurchaseDate ? ` (${formatDate(stats.lastPurchaseDate)})` : ''}`, value: currency(stats.lastPrice), color: 'primary' },
    { icon: <TrendingDownOutlinedIcon fontSize="small" />, label: 'Lowest Purchase Price', value: currency(stats.lowestPrice), color: 'success' },
    { icon: <TrendingUpOutlinedIcon fontSize="small" />, label: 'Highest Purchase Price', value: currency(stats.highestPrice), color: 'error' },
    { icon: <DonutLargeOutlinedIcon fontSize="small" />, label: 'Average Purchase Price', value: currency(stats.averagePrice), color: 'secondary' },
    { icon: <ReceiptLongOutlinedIcon fontSize="small" />, label: 'Total Purchase Transactions', value: stats.totalTransactions ?? 0, color: 'info' },
  ];

  const chartTooltipStyle = { backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 };

  // Export: current filtered price-history rows to CSV — same
  // client-side pattern used elsewhere (PriceComparison.jsx).
  const EXPORT_COLUMNS = [
    ['purchaseDate', 'Purchase Date'], ['documentNo', 'Document No.'], ['supplierCode', 'Supplier Code'], ['supplierName', 'Supplier Name'],
    ['quantity', 'Quantity'], ['uom', 'UOM'], ['unitPrice', 'Unit Price'], ['discountPercent', 'Discount (%)'], ['netPrice', 'Net Price'],
    ['purchaseAmount', 'Purchase Amount'], ['purchaseType', 'Purchase Type'], ['branch', 'Branch'], ['buyer', 'Buyer'],
  ];
  const handleExport = () => {
    const header = EXPORT_COLUMNS.map(([, label]) => label).join(',');
    const lines = baseTableRows.map((r) => EXPORT_COLUMNS.map(([key]) => {
      let v = r[key];
      if (key === 'purchaseDate') v = formatDate(v);
      else if (['quantity', 'unitPrice', 'discountPercent', 'netPrice', 'purchaseAmount'].includes(key)) v = Number(v || 0).toFixed(2);
      return `"${String(v ?? '').replace(/"/g, '""')}"`;
    }).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'purchase-price-history.csv';
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
                <FormSelect name="productGroup" label="Product Group" options={productGroupOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="product" label="Product *" options={productOptions} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="supplier" label="Supplier" options={supplierOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="branch" label="Branch" options={branchOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={1.5}>
                <FormDatePicker name="fromDate" label="From Date" />
              </Grid>
              <Grid item xs={12} sm={6} md={1.5}>
                <FormDatePicker name="toDate" label="To Date" />
              </Grid>
              <Grid item xs={12} sm={6} md={1}>
                <FormSelect name="historyView" label="History View" options={HISTORY_VIEW_OPTIONS} />
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
                  <Button variant="outlined" color="inherit" size="small" startIcon={<FileDownloadOutlinedIcon />} onClick={handleExport} sx={{ height: 40 }}>
                    Export
                  </Button>
                  <Button variant="outlined" color="inherit" size="small" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()} sx={{ height: 40 }}>
                    Print
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

      {!appliedFilters.product && (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <EmptyState
              icon={<HistoryOutlinedIcon sx={{ fontSize: 48 }} />}
              title="No product selected"
              message="Select a product and click View Report to see its purchase price history"
            />
          </CardContent>
        </Card>
      )}

      {appliedFilters.product && productInfo && (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
              <Box sx={{
                width: 64, height: 64, borderRadius: 1.5, bgcolor: 'action.hover',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Inventory2OutlinedIcon sx={{ color: 'text.disabled' }} />
              </Box>
              <Box sx={{ minWidth: 200 }}>
                <Typography variant="subtitle1" fontWeight={700}>{productInfo.productCode} - {productInfo.productName}</Typography>
                <Stack direction="row" spacing={3} sx={{ mt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">Product Group : {productInfo.productGroup}</Typography>
                  <Typography variant="caption" color="text.secondary">UOM : {productInfo.uom}</Typography>
                </Stack>
              </Box>
              <Box sx={{ ml: { md: 4 } }}>
                <Typography variant="caption" color="text.secondary" display="block">Standard Cost</Typography>
                <Typography variant="body2" fontWeight={700}>{currency(productInfo.standardCost)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">Last Purchase Date</Typography>
                <Typography variant="body2" fontWeight={700}>{formatDate(stats.lastPurchaseDate)}</Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      )}

      {appliedFilters.product && (
        <>
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
                title="Purchase Price History List (Product-wise)"
                searchPlaceholder="Search..."
                table={table}
                resultCount={table.rows.length}
                totalCount={table.totalCount}
              />
              <TableFilterPanel table={table} />
              {isMobile ? (
                <Box sx={{ px: 2, pb: 1 }}>
                  {!isLoading && pagedRows.map((row, idx) => (
                    <MobileRecordCard
                      key={`${row.documentNo}-${idx}`}
                      title={row.documentNo}
                      fields={[
                        { label: 'Purchase Date', value: formatDate(row.purchaseDate) },
                        { label: 'Supplier Code', value: row.supplierCode },
                        { label: 'Supplier Name', value: row.supplierName },
                        { label: 'Quantity', value: `${number2(row.quantity)} ${row.uom}` },
                        { label: 'Unit Price', value: currency(row.unitPrice) },
                        { label: 'Net Price', value: currency(row.netPrice) },
                        { label: 'Purchase Amount', value: currency(row.purchaseAmount) },
                        { label: 'Purchase Type', value: row.purchaseType },
                        { label: 'Branch', value: row.branch },
                        { label: 'Buyer', value: row.buyer },
                      ]}
                    />
                  ))}
                  {!isLoading && rows.length === 0 && (
                    isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<ShoppingCartOutlinedIcon sx={{ fontSize: 48 }} />} title="No purchase history found for this product" message="Try adjusting your date range or filters" />
                )
                  )}
                </Box>
              ) : (
                <ScrollableTableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>#</TableCell>
                        <SortableHeaderCell field="purchaseDate" sort={table.sort} onSort={table.toggleSort}>Purchase Date</SortableHeaderCell>
                        <SortableHeaderCell field="documentNo" sort={table.sort} onSort={table.toggleSort}>Document No.</SortableHeaderCell>
                        <SortableHeaderCell field="supplierCode" sort={table.sort} onSort={table.toggleSort}>Supplier Code</SortableHeaderCell>
                        <SortableHeaderCell field="supplierName" sort={table.sort} onSort={table.toggleSort}>Supplier Name</SortableHeaderCell>
                        <SortableHeaderCell field="quantity" sort={table.sort} onSort={table.toggleSort} align="right">Quantity</SortableHeaderCell>
                        <SortableHeaderCell field="uom" sort={table.sort} onSort={table.toggleSort}>UOM</SortableHeaderCell>
                        <SortableHeaderCell field="unitPrice" sort={table.sort} onSort={table.toggleSort} align="right">Unit Price (₹)</SortableHeaderCell>
                        <SortableHeaderCell field="discountPercent" sort={table.sort} onSort={table.toggleSort} align="right">Discount (%)</SortableHeaderCell>
                        <SortableHeaderCell field="netPrice" sort={table.sort} onSort={table.toggleSort} align="right">Net Price (₹)</SortableHeaderCell>
                        <SortableHeaderCell field="purchaseAmount" sort={table.sort} onSort={table.toggleSort} align="right">Purchase Amount (₹)</SortableHeaderCell>
                        <SortableHeaderCell field="purchaseType" sort={table.sort} onSort={table.toggleSort}>Purchase Type</SortableHeaderCell>
                        <SortableHeaderCell field="branch" sort={table.sort} onSort={table.toggleSort}>Branch</SortableHeaderCell>
                        <SortableHeaderCell field="buyer" sort={table.sort} onSort={table.toggleSort}>Buyer</SortableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {!isLoading && pagedRows.map((row, idx) => (
                        <TableRow key={`${row.documentNo}-${idx}`} hover>
                          <TableCell>{page * pageSize + idx + 1}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.purchaseDate)}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Typography variant="body2" fontWeight={700} color="primary.main">{row.documentNo}</Typography>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.supplierCode}</TableCell>
                          <TableCell sx={{ minWidth: 140 }}>{row.supplierName}</TableCell>
                          <TableCell align="right">{number2(row.quantity)}</TableCell>
                          <TableCell>{row.uom}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.unitPrice)}</TableCell>
                          <TableCell align="right">{number2(row.discountPercent)}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.netPrice)}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.purchaseAmount)}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.purchaseType}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.branch}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.buyer}</TableCell>
                        </TableRow>
                      ))}
                      {!isLoading && rows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={13}>
                            {isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<ShoppingCartOutlinedIcon sx={{ fontSize: 48 }} />} title="No purchase history found for this product" message="Try adjusting your date range or filters" />
                            )}
                          </TableCell>
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
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Purchase Price Trend (From First Purchase to Latest)</Typography>
                  <Box sx={{ width: '100%', height: 280, mt: 1 }}>
                    <ResponsiveContainer>
                      <LineChart data={trend} margin={{ top: 20, right: 8, left: -12, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} angle={-40} textAnchor="end" height={60} interval={0} />
                        <YAxis tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                        <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => [currency(v), 'Unit Price']} />
                        <Line type="monotone" dataKey="value" name="Unit Price (₹)" stroke={theme.palette.warning.main} strokeWidth={2.5} dot={{ r: 3, fill: theme.palette.warning.main, strokeWidth: 0 }} activeDot={{ r: 5 }}>
                          <LabelList dataKey="value" position="top" formatter={(v) => number2(v)} style={{ fontSize: 9, fill: theme.palette.text.secondary }} />
                        </Line>
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Supplier-wise Average Price Comparison</Typography>
                  <Box sx={{ width: '100%', height: 280, mt: 1 }}>
                    <ResponsiveContainer>
                      <BarChart data={supplierAverages} margin={{ top: 20, right: 8, left: -12, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} interval={0} />
                        <YAxis tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                        <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => currency(v)} />
                        <Bar dataKey="value" name="Average Price" radius={[4, 4, 0, 0]} maxBarSize={40}>
                          <LabelList dataKey="value" position="top" formatter={(v) => number2(v)} style={{ fontSize: 10, fill: theme.palette.text.secondary }} />
                          {supplierAverages.map((entry, i) => (
                            <Cell key={entry.name} fill={[theme.palette.warning.main, theme.palette.info.main, theme.palette.success.main, theme.palette.secondary.main, theme.palette.primary.main][i % 5]} />
                          ))}
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
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Quantity vs Price Trend</Typography>
                  <Box sx={{ width: '100%', height: 280, mt: 1 }}>
                    <ResponsiveContainer>
                      <ComposedChart data={quantityVsPrice} margin={{ top: 20, right: 8, left: -12, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10, fill: theme.palette.error.main }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: theme.palette.success.main }} axisLine={false} tickLine={false} />
                        <RechartsTooltip contentStyle={chartTooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar yAxisId="right" dataKey="quantity" name="Quantity (KG)" fill={theme.palette.success.main} radius={[3, 3, 0, 0]} maxBarSize={20} />
                        <Line yAxisId="left" type="monotone" dataKey="unitPrice" name="Unit Price (₹)" stroke={theme.palette.warning.main} strokeWidth={2.5} dot={{ r: 3, fill: theme.palette.warning.main, strokeWidth: 0 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Note: Price history is based on Goods Receipt and Purchase Invoice transactions.
          </Typography>

          <ReportPrintable
            title="Purchase Price History"
            subtitle="Historical purchase prices by product and supplier."
            filters={printFilters}
            columns={tableColumns}
            // Print always reflects the full Filters-section-scoped dataset, not
            // whatever the quick search box / column filter popover currently
            // narrows the on-screen table to — see SalesQuotationRegister.jsx.
            rows={baseTableRows}
            orientation="landscape"
          />
        </>
      )}
    </Box>
  );
}
