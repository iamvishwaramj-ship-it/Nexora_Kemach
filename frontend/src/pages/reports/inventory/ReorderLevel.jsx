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
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from 'recharts';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import CurrencyRupeeOutlinedIcon from '@mui/icons-material/CurrencyRupeeOutlined';
import dayjs from 'dayjs';
import FormSelect from '../../../components/form/FormSelect';
import FormDatePicker from '../../../components/form/FormDatePicker';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import CompanyBadge from '../../../components/common/CompanyBadge';
import EntityListPagination from '../../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../../components/data-display/useIsMobileListView';
import StatCard from '../../../components/data-display/StatCard';
import { branchApi, productGroupApi, productApi } from '../../../features/resources';
import { useWarehouseOptions } from '../../../lib/useWarehouseOptions';
import { useGetReorderLevelReportQuery } from '../../../features/inventory/reorderLevelReportApi';
import { useLocalCachedQuery } from '../../../lib/useLocalCachedQuery';
import { useTabSyncedReportQuery } from '../../../hooks/useTabSyncedReportQuery';
import useTableFeatures from '../../../components/data-display/useTableFeatures';
import TableToolbar from '../../../components/data-display/TableToolbar';
import SortableHeaderCell from '../../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import TableFilterPanel from '../../../components/data-display/TableFilterPanel';
import ReportPrintable from '../../../components/print/ReportPrintable';
import { buildPrintFilters } from '../../../components/print/reportPrint';

const PAGE_SIZE = 10;

const PRODUCT_TYPE_OPTIONS = ['Raw Material', 'Semi-Finished Goods', 'Finished Goods', 'Trading Goods', 'Service', 'Consumable', 'Other'];

const REORDER_STATUS_OPTIONS = ['Below Reorder Level', 'Above Reorder Level', 'No Reorder Level', 'All Items'];

const STATUS_COLORS = { 'Below Reorder Level': 'error', 'Above Reorder Level': 'success', 'No Reorder Level': 'text.secondary' };

const currency = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const number3 = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const formatDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '—');

const DEFAULT_FILTERS = {
  branch: '', warehouse: '', productGroup: '', itemCategory: '',
  reorderStatus: 'Below Reorder Level', asOnDate: dayjs().format('YYYY-MM-DD'),
};

// Reports > Inventory > Reorder Level print layout — see ReportPrintable.jsx.
const PRINT_FILTER_LABELS = {
  branch: 'Branch', warehouse: 'Warehouse', productGroup: 'Product Group', itemCategory: 'Item Category',
  reorderStatus: 'Reorder Status', asOnDate: 'As On Date',
};
const PRINT_DATE_FIELDS = ['asOnDate'];

export default function ReorderLevel() {
  const theme = useTheme();
  const isMobile = useIsMobileListView();

  const { data: branches } = branchApi.useList();
  const { data: productGroups } = productGroupApi.useList();
  const { data: products } = productApi.useList();

  const branchOptions = useMemo(() => ([
    { label: 'All Branches', value: '' },
    ...(branches || []).map((b) => ({ label: b.branchName, value: b.branchName })),
  ]), [branches]);

  // Warehouse is Product.defaultLocation — a real per-product field — so
  // the option list is just the distinct values already in use.
  // Warehouses come from the Warehouse Master — see lib/useWarehouseOptions.js.
  // This filter used to list the distinct free-text values of
  // Product.defaultLocation, so it offered whatever anyone had happened to type
  // on a product record, and could never offer a warehouse holding no product.
  const { options: warehouseOptions } = useWarehouseOptions({ allLabel: 'All Warehouses' });

  const productGroupOptions = useMemo(() => ([
    { label: 'All Groups', value: '' },
    ...(productGroups || []).map((g) => ({ label: g.groupName, value: g.groupName })),
  ]), [productGroups]);

  const itemCategoryOptions = useMemo(() => ([
    { label: 'All Categories', value: '' },
    ...PRODUCT_TYPE_OPTIONS.map((s) => ({ label: s, value: s })),
  ]), []);

  const reorderStatusOptions = useMemo(() => ([
    { label: 'All Items', value: 'All Items' },
    ...REORDER_STATUS_OPTIONS.filter((s) => s !== 'All Items').map((s) => ({ label: s, value: s })),
  ]), []);

  // Filter bar is a report toolbar, not a create/edit form — no Zod
  // validation or persisted mutation, same as other report pages.
  const methods = useForm({
    defaultValues: {
      branch: '', warehouse: '', productGroup: '', itemCategory: '',
      reorderStatus: 'All Items', asOnDate: dayjs(),
    },
  });
  const { handleSubmit, reset } = methods;

  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // See LowStockReport.jsx / lib/useLocalCachedQuery.js for what this
  // does: instant table on reload from localStorage. Freshness while the
  // tab stays open is handled by useTabSyncedReportQuery (see
  // hooks/useTabSyncedReportQuery.js) -- it refetches on becoming active
  // (mount / tab visible) if 45s+ has elapsed since last sync, otherwise
  // arms a timer for the remainder, so a long-open tab doesn't quietly go
  // stale.
  const reorderLevelQuery = useTabSyncedReportQuery(useGetReorderLevelReportQuery, appliedFilters);
  const cacheKey = useMemo(() => `reorderLevelReport:${JSON.stringify(appliedFilters)}`, [appliedFilters]);
  const { data, isLoading, isFetching } = useLocalCachedQuery(cacheKey, reorderLevelQuery);
  const baseTableRows = data?.rows || [];

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'productCode', headerName: 'Item No', filter: 'text' },
    { field: 'productName', headerName: 'Description', filter: 'text' },
    { field: 'productGroup', headerName: 'Product Group', filter: 'text' },
    { field: 'warehouse', headerName: 'Warehouse', filter: 'text' },
    { field: 'uom', headerName: 'UOM', filter: 'text' },
    { field: 'reorderLevel', headerName: 'Reorder Level', filter: 'text' },
    { field: 'currentStock', headerName: 'Current Stock', filter: 'numberRange', sortValue: (row) => (row.currentStock == null || row.currentStock === '' ? null : Number(row.currentStock)) },
    { field: 'reorderQty', headerName: 'Reorder Qty', filter: 'numberRange', sortValue: (row) => (row.reorderQty == null || row.reorderQty === '' ? null : Number(row.reorderQty)) },
    { field: 'suggestedOrderQty', headerName: 'Suggested Order Qty', filter: 'numberRange', sortValue: (row) => (row.suggestedOrderQty == null || row.suggestedOrderQty === '' ? null : Number(row.suggestedOrderQty)) },
    { field: 'unitCost', headerName: 'Unit Cost (₹)', filter: 'numberRange', sortValue: (row) => (row.unitCost == null || row.unitCost === '' ? null : Number(row.unitCost)) },
    { field: 'estimatedValue', headerName: 'Estimated Value (₹)', filter: 'numberRange', sortValue: (row) => (row.estimatedValue == null || row.estimatedValue === '' ? null : Number(row.estimatedValue)) },
    { field: 'lastPurchaseDate', headerName: 'Last Purchase Date', filter: 'dateRange', sortValue: (row) => (row.lastPurchaseDate ? new Date(row.lastPurchaseDate).getTime() : null), searchValue: (row) => formatDate(row.lastPurchaseDate) },
    { field: 'status', headerName: 'Status', filter: 'select' },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const totals = data?.totals || {};
  const stats = data?.stats || {};
  const reorderStatusOverview = data?.reorderStatusOverview || [];
  const topReorderItems = data?.topReorderItems || [];
  const reorderItemsByWarehouse = data?.reorderItemsByWarehouse || [];
  const estimatedValueByGroup = data?.estimatedValueByGroup || [];
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
      warehouse: values.warehouse || '',
      productGroup: values.productGroup || '',
      itemCategory: values.itemCategory || '',
      reorderStatus: values.reorderStatus || 'Below Reorder Level',
      asOnDate: values.asOnDate ? dayjs(values.asOnDate).format('YYYY-MM-DD') : '',
    });
    setPage(0);
  });

  const onReset = () => {
    reset({
      branch: '', warehouse: '', productGroup: '', itemCategory: '',
      reorderStatus: 'All Items', asOnDate: dayjs(),
    });
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  const statCards = [
    { icon: <ShoppingCartOutlinedIcon fontSize="small" />, label: 'Items Below Reorder Level', value: stats.itemsBelowReorderLevel ?? 0, color: 'warning' },
    { icon: <Inventory2OutlinedIcon fontSize="small" />, label: 'Total Items Monitored', value: stats.totalItemsMonitored ?? 0, color: 'secondary' },
    { icon: <HomeOutlinedIcon fontSize="small" />, label: 'Total Warehouses', value: stats.totalWarehouses ?? 0, color: 'primary' },
    { icon: <LayersOutlinedIcon fontSize="small" />, label: 'Total Stock Qty', value: number3(stats.totalStockQty), color: 'success' },
    { icon: <AccessTimeOutlinedIcon fontSize="small" />, label: 'Pending Reorder Qty', value: number3(stats.pendingReorderQty), color: 'error' },
    { icon: <CurrencyRupeeOutlinedIcon fontSize="small" />, label: 'Estimated Reorder Value', value: currency(stats.estimatedReorderValue), color: 'error' },
  ];

  const donutColors = [
    theme.palette.primary.main, theme.palette.success.main, theme.palette.warning.main,
    theme.palette.secondary.main, theme.palette.error.main, theme.palette.grey[400],
  ];
  const statusDonutColors = [theme.palette.warning.main, theme.palette.primary.main, theme.palette.grey[400]];
  const chartTooltipStyle = { backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 };

  // Export: current filtered rows to CSV — same client-side pattern used
  // elsewhere (LowStockReport.jsx).
  const EXPORT_COLUMNS = [
    ['productCode', 'Item No'], ['productName', 'Description'], ['productGroup', 'Product Group'], ['warehouse', 'Warehouse'],
    ['uom', 'UOM'], ['reorderLevel', 'Reorder Level'], ['currentStock', 'Current Stock'], ['reorderQty', 'Reorder Qty'],
    ['suggestedOrderQty', 'Suggested Order Qty'], ['unitCost', 'Unit Cost'], ['estimatedValue', 'Estimated Value'],
    ['lastPurchaseDate', 'Last Purchase Date'], ['status', 'Status'],
  ];
  const handleExport = () => {
    const header = EXPORT_COLUMNS.map(([, label]) => label).join(',');
    const lines = baseTableRows.map((r) => EXPORT_COLUMNS.map(([key]) => {
      let v = r[key];
      if (key === 'lastPurchaseDate') v = formatDate(v);
      return `"${String(v ?? '').replace(/"/g, '""')}"`;
    }).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reorder-level-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<ShoppingCartOutlinedIcon />}
        title="Reorder Level"
        subtitle="Items below their reorder level and suggested restock quantities."
        rightContent={<CompanyBadge />}
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Filters</Typography>
          <FormProvider {...methods}>
            <Grid container spacing={2} alignItems="flex-start">
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="branch" label="Branch" options={branchOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="warehouse" label="Warehouse" options={warehouseOptions} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="productGroup" label="Product Group" options={productGroupOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="itemCategory" label="Item Category" options={itemCategoryOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="reorderStatus" label="Reorder Status" options={reorderStatusOptions} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormDatePicker name="asOnDate" label="As On Date" />
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
            title="Items Below Reorder Level"
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
                  key={row.productCode}
                  title={row.productName}
                  statusChip={(
                    <Typography variant="caption" fontWeight={700} sx={{ color: `${STATUS_COLORS[row.status] || 'text.primary'}.main` }}>{row.status}</Typography>
                  )}
                  fields={[
                    { label: '#', value: page * pageSize + idx + 1 },
                    { label: 'Item No', value: row.productCode },
                    { label: 'Warehouse', value: row.warehouse },
                    { label: 'Reorder Level', value: number3(row.reorderLevel) },
                    { label: 'Current Stock', value: number3(row.currentStock) },
                    { label: 'Reorder Qty', value: number3(row.reorderQty) },
                    { label: 'Suggested Order Qty', value: number3(row.suggestedOrderQty) },
                    { label: 'Unit Cost', value: currency(row.unitCost) },
                    { label: 'Estimated Value', value: currency(row.estimatedValue) },
                    { label: 'Last Purchase Date', value: formatDate(row.lastPurchaseDate) },
                  ]}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No items found for the selected criteria" message="Try adjusting your date range or filters" />
                )
              )}
              {!isLoading && rows.length > 0 && (
                <Card variant="outlined" sx={{ mb: 1.5, bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Total</Typography>
                    <Stack spacing={0.75}>
                      {[
                        ['Reorder Qty', number3(totals.reorderQty)], ['Suggested Order Qty', number3(totals.suggestedOrderQty)],
                        ['Estimated Value', currency(totals.estimatedValue)],
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
                    <SortableHeaderCell field="productCode" sort={table.sort} onSort={table.toggleSort}>Item No</SortableHeaderCell>
                    <SortableHeaderCell field="productName" sort={table.sort} onSort={table.toggleSort}>Description</SortableHeaderCell>
                    <SortableHeaderCell field="productGroup" sort={table.sort} onSort={table.toggleSort}>Product Group</SortableHeaderCell>
                    <SortableHeaderCell field="warehouse" sort={table.sort} onSort={table.toggleSort}>Warehouse</SortableHeaderCell>
                    <SortableHeaderCell field="uom" sort={table.sort} onSort={table.toggleSort}>UOM</SortableHeaderCell>
                    <SortableHeaderCell field="reorderLevel" sort={table.sort} onSort={table.toggleSort} align="right">Reorder Level</SortableHeaderCell>
                    <SortableHeaderCell field="currentStock" sort={table.sort} onSort={table.toggleSort} align="right">Current Stock</SortableHeaderCell>
                    <SortableHeaderCell field="reorderQty" sort={table.sort} onSort={table.toggleSort} align="right">Reorder Qty</SortableHeaderCell>
                    <SortableHeaderCell field="suggestedOrderQty" sort={table.sort} onSort={table.toggleSort} align="right">Suggested Order Qty</SortableHeaderCell>
                    <SortableHeaderCell field="unitCost" sort={table.sort} onSort={table.toggleSort} align="right">Unit Cost (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="estimatedValue" sort={table.sort} onSort={table.toggleSort} align="right">Estimated Value (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="lastPurchaseDate" sort={table.sort} onSort={table.toggleSort}>Last Purchase Date</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, idx) => (
                    <TableRow key={row.productCode} hover>
                      <TableCell>{page * pageSize + idx + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" fontWeight={700} color="primary.main">{row.productCode}</Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 150 }}>{row.productName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.productGroup}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.warehouse}</TableCell>
                      <TableCell>{row.uom}</TableCell>
                      <TableCell align="right">{number3(row.reorderLevel)}</TableCell>
                      <TableCell align="right">{number3(row.currentStock)}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={700} color="error.main">{number3(row.reorderQty)}</Typography>
                      </TableCell>
                      <TableCell align="right">{number3(row.suggestedOrderQty)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.unitCost)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.estimatedValue)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.lastPurchaseDate)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700} sx={{ color: `${STATUS_COLORS[row.status] || 'text.primary'}.main` }}>{row.status}</Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={14}>
                        {isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No items found for the selected criteria" message="Try adjusting your date range or filters" />
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && rows.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={6}><Typography fontWeight={700}>Total</Typography></TableCell>
                      <TableCell align="right">—</TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{number3(totals.currentStock)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700} color="error.main">{number3(totals.reorderQty)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{number3(totals.suggestedOrderQty)}</Typography></TableCell>
                      <TableCell>—</TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.estimatedValue)}</Typography></TableCell>
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
        <Grid item xs={12} md={3}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Reorder Status</Typography>
              <Box sx={{ width: '100%', height: 180, position: 'relative' }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={reorderStatusOverview} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                      {reorderStatusOverview.map((entry, i) => <Cell key={entry.name} fill={statusDonutColors[i % statusDonutColors.length]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => number3(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <Typography variant="caption" color="text.secondary" display="block">Total</Typography>
                  <Typography variant="subtitle2" fontWeight={700}>{stats.totalItemsMonitored ?? 0} Items</Typography>
                </Box>
              </Box>
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {reorderStatusOverview.map((d, i) => {
                  const percent = stats.totalItemsMonitored ? Math.round((d.value / stats.totalItemsMonitored) * 1000) / 10 : 0;
                  return (
                    <Stack key={d.name} direction="row" alignItems="center" justifyContent="space-between">
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: statusDonutColors[i % statusDonutColors.length], flexShrink: 0 }} />
                        <Typography variant="caption" color="text.secondary" noWrap>{d.name}</Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">{d.value} ({percent}%)</Typography>
                    </Stack>
                  );
                })}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Top 10 Items Requiring Reorder</Typography>
              <Box sx={{ width: '100%', height: 300, mt: 1 }}>
                <ResponsiveContainer>
                  <BarChart data={topReorderItems} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 9, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => number3(v)} />
                    <Bar dataKey="value" fill={theme.palette.warning.main} radius={[0, 4, 4, 0]} maxBarSize={14}>
                      <LabelList dataKey="value" position="right" formatter={(v) => number3(v)} style={{ fontSize: 9, fill: theme.palette.text.secondary }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Reorder Items by Warehouse</Typography>
              <Box sx={{ width: '100%', height: 260, mt: 1 }}>
                <ResponsiveContainer>
                  <BarChart data={reorderItemsByWarehouse} margin={{ top: 20, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={{ fontSize: 10, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => `${v} items`} />
                    <Bar dataKey="value" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} maxBarSize={36}>
                      <LabelList dataKey="value" position="top" style={{ fontSize: 10, fill: theme.palette.text.secondary }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Estimated Reorder Value by Product Group</Typography>
              <Box sx={{ width: '100%', height: 180, position: 'relative' }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={estimatedValueByGroup} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                      {estimatedValueByGroup.map((entry, i) => <Cell key={entry.name} fill={donutColors[i % donutColors.length]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => currency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <Typography variant="caption" color="text.secondary" display="block">Total</Typography>
                  <Typography variant="subtitle2" fontWeight={700}>{currency(stats.estimatedReorderValue)}</Typography>
                </Box>
              </Box>
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {estimatedValueByGroup.map((d, i) => (
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
      </Grid>

      {/* Print always reflects the full Filters-section-scoped dataset
          (baseTableRows), not the quick-search/column-filter-narrowed
          `rows` used on screen -- see SalesQuotationRegister.jsx. */}
      <ReportPrintable
        title="Reorder Level Report"
        subtitle="Products requiring reorder based on stock levels."
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
