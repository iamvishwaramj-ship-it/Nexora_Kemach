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
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, LabelList,
} from 'recharts';
import CompareArrowsOutlinedIcon from '@mui/icons-material/CompareArrowsOutlined';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PercentOutlinedIcon from '@mui/icons-material/PercentOutlined';
import CurrencyRupeeOutlinedIcon from '@mui/icons-material/CurrencyRupeeOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
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
import { useGetPriceComparisonReportQuery } from '../../../features/purchase/priceComparisonReportApi';
import useTableFeatures from '../../../components/data-display/useTableFeatures';
import TableToolbar from '../../../components/data-display/TableToolbar';
import SortableHeaderCell from '../../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import TableFilterPanel from '../../../components/data-display/TableFilterPanel';
import ReportPrintable from '../../../components/print/ReportPrintable';
import { buildPrintFilters } from '../../../components/print/reportPrint';

const PAGE_SIZE = 10;

const currency = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const percent = (v) => `${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const formatDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '—');
const thousand = (v) => `${Number(v || 0)}K`;

const DEFAULT_FILTERS = { fromDate: '', toDate: '', productGroup: '', product: '', supplier: '', branch: '' };

// Reports > Purchase > Price Comparison print layout — see ReportPrintable.jsx.
const PRINT_FILTER_LABELS = {
  fromDate: 'From Date', toDate: 'To Date', productGroup: 'Product Group', product: 'Product',
  supplier: 'Supplier', branch: 'Branch',
};
const PRINT_DATE_FIELDS = ['fromDate', 'toDate'];

export default function PriceComparison() {
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

  const productOptions = useMemo(() => ([
    { label: 'All Products', value: '' },
    ...(products || []).map((p) => ({ label: p.productName, value: p.productCode })),
  ]), [products]);

  const supplierOptions = useMemo(() => ([
    { label: 'All Suppliers', value: '' },
    ...(suppliers || []).map((s) => ({ label: s.supplierName, value: s.supplierName })),
  ]), [suppliers]);

  const branchOptions = useMemo(() => ([
    { label: 'All Branches', value: '' },
    ...(branches || []).map((b) => ({ label: b.branchName, value: b.branchName })),
  ]), [branches]);

  // Filter bar is a report toolbar, not a create/edit form — no Zod
  // validation or persisted mutation, same as other report pages.
  const methods = useForm({
    defaultValues: { fromDate: null, toDate: null, productGroup: '', product: '', supplier: '', branch: '' },
  });
  const { handleSubmit, reset } = methods;

  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const { data, isLoading, isFetching } = useGetPriceComparisonReportQuery(appliedFilters);
  const baseTableRows = data?.rows || [];

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'productCode', headerName: 'Item No', filter: 'text' },
    { field: 'productName', headerName: 'Description', filter: 'text' },
    { field: 'supplier', headerName: 'Supplier', filter: 'text' },
    { field: 'quotationNo', headerName: 'Quote No.', filter: 'text' },
    { field: 'quotationDate', headerName: 'Quote Date', filter: 'dateRange', sortValue: (row) => (row.quotationDate ? new Date(row.quotationDate).getTime() : null), searchValue: (row) => formatDate(row.quotationDate) },
    { field: 'quotedPrice', headerName: 'Quoted Price (₹)', filter: 'numberRange', sortValue: (row) => (row.quotedPrice == null || row.quotedPrice === '' ? null : Number(row.quotedPrice)) },
    { field: 'lowestQuote', headerName: 'Lowest Quote (₹)', filter: 'numberRange', sortValue: (row) => (row.lowestQuote == null || row.lowestQuote === '' ? null : Number(row.lowestQuote)) },
    { field: 'highestQuote', headerName: 'Highest Quote (₹)', filter: 'numberRange', sortValue: (row) => (row.highestQuote == null || row.highestQuote === '' ? null : Number(row.highestQuote)) },
    { field: 'averageQuote', headerName: 'Average Quote (₹)', filter: 'numberRange', sortValue: (row) => (row.averageQuote == null || row.averageQuote === '' ? null : Number(row.averageQuote)) },
    { field: 'diffAmount', headerName: 'Difference (₹)', filter: 'numberRange', sortValue: (row) => (row.diffAmount == null || row.diffAmount === '' ? null : Number(row.diffAmount)) },
    { field: 'diffPercent', headerName: 'Difference (%)', filter: 'numberRange', sortValue: (row) => (row.diffPercent == null || row.diffPercent === '' ? null : Number(row.diffPercent)) },
    { field: 'validUpto', headerName: 'Valid Till', filter: 'dateRange', sortValue: (row) => (row.validUpto ? new Date(row.validUpto).getTime() : null), searchValue: (row) => formatDate(row.validUpto) },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const totals = data?.totals || {};
  const stats = data?.stats || {};
  const topLowestQuoteProducts = data?.topLowestQuoteProducts || [];
  const topHighestVarianceProducts = data?.topHighestVarianceProducts || [];
  const trend = data?.trend || [];
  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  // Print: full filtered/sorted rows (never just the current page), fed into
  // the shared ReportPrintable layout — see components/print/ReportPrintable.jsx.
  const printFilters = useMemo(
    () => buildPrintFilters(appliedFilters, PRINT_FILTER_LABELS, PRINT_DATE_FIELDS),
    [appliedFilters],
  );

  const onView = handleSubmit((values) => {
    setAppliedFilters({
      fromDate: values.fromDate ? dayjs(values.fromDate).format('YYYY-MM-DD') : '',
      toDate: values.toDate ? dayjs(values.toDate).format('YYYY-MM-DD') : '',
      productGroup: values.productGroup || '',
      product: values.product || '',
      supplier: values.supplier || '',
      branch: values.branch || '',
    });
    setPage(0);
  });

  const onReset = () => {
    reset({ fromDate: null, toDate: null, productGroup: '', product: '', supplier: '', branch: '' });
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  const statCards = [
    { icon: <AssignmentOutlinedIcon fontSize="small" />, label: 'Total Quotations', value: stats.totalQuotations ?? 0, color: 'primary' },
    { icon: <ShoppingCartOutlinedIcon fontSize="small" />, label: 'Lowest Quoted Price', value: currency(stats.lowestQuotedPrice), color: 'success' },
    { icon: <Inventory2OutlinedIcon fontSize="small" />, label: 'Highest Quoted Price', value: currency(stats.highestQuotedPrice), color: 'warning' },
    { icon: <PercentOutlinedIcon fontSize="small" />, label: 'Average Quote Price', value: currency(stats.averageQuotePrice), color: 'secondary' },
    { icon: <CurrencyRupeeOutlinedIcon fontSize="small" />, label: 'Maximum Price Difference', value: currency(stats.maxPriceDifference), color: 'info' },
    { icon: <TrendingUpOutlinedIcon fontSize="small" />, label: 'Suppliers Compared', value: stats.suppliersCompared ?? 0, color: 'error' },
  ];

  const chartTooltipStyle = { backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 };

  // Export: current filtered quote lines to CSV — same client-side
  // pattern used elsewhere (PurchaseOrderRegister.jsx).
  const EXPORT_COLUMNS = [
    ['productCode', 'Item No'], ['productName', 'Description'], ['supplier', 'Supplier'], ['quotationNo', 'Quote No.'],
    ['quotationDate', 'Quote Date'], ['quotedPrice', 'Quoted Price'], ['lowestQuote', 'Lowest Quote'], ['highestQuote', 'Highest Quote'],
    ['averageQuote', 'Average Quote'], ['diffAmount', 'Difference'], ['diffPercent', 'Difference %'], ['validUpto', 'Valid Till'],
  ];
  const handleExport = () => {
    const header = EXPORT_COLUMNS.map(([, label]) => label).join(',');
    const lines = baseTableRows.map((r) => EXPORT_COLUMNS.map(([key]) => {
      let v = r[key];
      if (key.toLowerCase().includes('date') || key === 'validUpto') v = formatDate(v);
      else if (['quotedPrice', 'lowestQuote', 'highestQuote', 'averageQuote', 'diffAmount'].includes(key)) v = Number(v || 0).toFixed(2);
      return `"${String(v ?? '').replace(/"/g, '""')}"`;
    }).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'price-comparison.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<CompareArrowsOutlinedIcon />}
        title="Price Comparison"
        subtitle="Compare supplier quoted prices for the same product."
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
                <FormSelect name="productGroup" label="Product Group" options={productGroupOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="product" label="Product" options={productOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="supplier" label="Supplier" options={supplierOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="branch" label="Branch" options={branchOptions} emptyValue="" />
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
            title="Price Comparison (Quote) List"
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
                  key={`${row.productCode}-${row.quotationNo}-${idx}`}
                  title={row.productName}
                  fields={[
                    { label: 'Item No', value: row.productCode },
                    { label: 'Supplier', value: row.supplier },
                    { label: 'Quote No.', value: row.quotationNo },
                    { label: 'Quote Date', value: formatDate(row.quotationDate) },
                    { label: 'Quoted Price', value: currency(row.quotedPrice) },
                    { label: 'Lowest Quote', value: currency(row.lowestQuote) },
                    { label: 'Highest Quote', value: currency(row.highestQuote) },
                    { label: 'Average Quote', value: currency(row.averageQuote) },
                    { label: 'Difference', value: row.diffAmount > 0 ? currency(row.diffAmount) : '—' },
                    { label: 'Difference %', value: percent(row.diffPercent) },
                    { label: 'Valid Till', value: formatDate(row.validUpto) },
                  ]}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<ShoppingCartOutlinedIcon sx={{ fontSize: 48 }} />} title="No quotations found for the selected criteria" message="Try adjusting your date range or filters" />
                )
              )}
              {!isLoading && rows.length > 0 && (
                <Card variant="outlined" sx={{ mb: 1.5, bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Total</Typography>
                    <Stack spacing={0.75}>
                      {[
                        ['Lowest Quote', currency(totals.lowestQuote)], ['Highest Quote', currency(totals.highestQuote)],
                        ['Average Quote', currency(totals.averageQuote)],
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
                    <SortableHeaderCell field="supplier" sort={table.sort} onSort={table.toggleSort}>Supplier</SortableHeaderCell>
                    <SortableHeaderCell field="quotationNo" sort={table.sort} onSort={table.toggleSort}>Quote No.</SortableHeaderCell>
                    <SortableHeaderCell field="quotationDate" sort={table.sort} onSort={table.toggleSort}>Quote Date</SortableHeaderCell>
                    <SortableHeaderCell field="quotedPrice" sort={table.sort} onSort={table.toggleSort} align="right">Quoted Price (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="lowestQuote" sort={table.sort} onSort={table.toggleSort} align="right">Lowest Quote (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="highestQuote" sort={table.sort} onSort={table.toggleSort} align="right">Highest Quote (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="averageQuote" sort={table.sort} onSort={table.toggleSort} align="right">Average Quote (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="diffAmount" sort={table.sort} onSort={table.toggleSort} align="right">Difference (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="diffPercent" sort={table.sort} onSort={table.toggleSort} align="right">Difference (%)</SortableHeaderCell>
                    <SortableHeaderCell field="validUpto" sort={table.sort} onSort={table.toggleSort}>Valid Till</SortableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, idx) => (
                    <TableRow key={`${row.productCode}-${row.quotationNo}-${idx}`} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" fontWeight={700} color="primary.main">{row.productCode}</Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 150 }}>{row.productName}</TableCell>
                      <TableCell sx={{ minWidth: 140 }}>{row.supplier}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.quotationNo}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.quotationDate)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.quotedPrice)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.lowestQuote)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.highestQuote)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.averageQuote)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{row.diffAmount > 0 ? currency(row.diffAmount) : '—'}</TableCell>
                      <TableCell align="right">{percent(row.diffPercent)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.validUpto)}</TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={12}>
                        {isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<ShoppingCartOutlinedIcon sx={{ fontSize: 48 }} />} title="No quotations found for the selected criteria" message="Try adjusting your date range or filters" />
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && rows.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={2}><Typography fontWeight={700}>Total</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{rows.length}</Typography></TableCell>
                      <TableCell>—</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.lowestQuote)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.highestQuote)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.averageQuote)}</Typography></TableCell>
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Top 10 Lowest Quote Products</Typography>
              <Box sx={{ width: '100%', height: 300, mt: 1 }}>
                <ResponsiveContainer>
                  <BarChart data={topLowestQuoteProducts} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => currency(v)} />
                    <Bar dataKey="value" fill={theme.palette.primary.main} radius={[0, 4, 4, 0]} maxBarSize={16}>
                      <LabelList dataKey="value" position="right" formatter={(v) => currency(v)} style={{ fontSize: 9, fill: theme.palette.text.secondary }} />
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Top 10 Highest Quote Variance (Difference %)</Typography>
              <Box sx={{ width: '100%', height: 300, mt: 1 }}>
                <ResponsiveContainer>
                  <BarChart data={topHighestVarianceProducts} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => `${v}%`} />
                    <Bar dataKey="value" fill={theme.palette.secondary.main} radius={[0, 4, 4, 0]} maxBarSize={16}>
                      <LabelList dataKey="value" position="right" formatter={(v) => `${v}%`} style={{ fontSize: 9, fill: theme.palette.text.secondary }} />
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Quote Price Trend (Average Quote Price)</Typography>
              <Box sx={{ width: '100%', height: 260, mt: 1 }}>
                <ResponsiveContainer>
                  <LineChart data={trend} margin={{ top: 20, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} tickFormatter={(v) => thousand(v)} />
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => [currency(v), 'Average Quote Price']} />
                    <Line type="monotone" dataKey="value" name="Average Quote Price" stroke={theme.palette.primary.main} strokeWidth={2.5} dot={{ r: 4, fill: theme.palette.primary.main, strokeWidth: 0 }} activeDot={{ r: 6 }}>
                      <LabelList dataKey="value" position="top" formatter={(v) => thousand(v)} style={{ fontSize: 10, fill: theme.palette.text.secondary }} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <ReportPrintable
        title="Purchase Price Comparison"
        subtitle="Compare supplier quotations for products across suppliers."
        filters={printFilters}
        columns={tableColumns}
        // Print always reflects the full Filters-section-scoped dataset, not
        // whatever the quick search box / column filter popover currently
        // narrows the on-screen table to — see SalesQuotationRegister.jsx.
        rows={baseTableRows}
        orientation="landscape"
      />
    </Box>
  );
}
