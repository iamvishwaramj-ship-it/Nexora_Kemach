import React, { useMemo, useState } from 'react';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
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
import PriceCheckOutlinedIcon from '@mui/icons-material/PriceCheckOutlined';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import WidgetsOutlinedIcon from '@mui/icons-material/WidgetsOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import ArrowUpwardOutlinedIcon from '@mui/icons-material/ArrowUpwardOutlined';
import ArrowDownwardOutlinedIcon from '@mui/icons-material/ArrowDownwardOutlined';
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
import { useGetStockValuationReportQuery } from '../../../features/inventory/stockValuationReportApi';
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

// This schema has no perpetual FIFO/moving-average costing ledger, but the
// backend still computes a real, honest per-unit figure per method from
// purchase receipt history (Purchase Invoice + GRN quantities/prices)
// rather than always reporting Product.costPrice: Standard Cost is
// costPrice unchanged, Moving Average is the weighted-average receipt cost
// to date, and FIFO values on-hand qty at the cost of the most-recently-
// received layers. See computeValuationUnitCost in resources.js.
//
// NOTE: this selector still drives the Unit Cost / Valuation Method columns
// below, but it no longer drives Stock Value — Stock Value is now the same
// journal-based figure (Opening + Inward - Outward, from the Stock table)
// that Stock Summary's Closing Value and the Dashboard's Total Inventory
// Value card use, regardless of which method is selected here.
const VALUATION_METHOD_OPTIONS = ['Moving Average', 'FIFO', 'Standard Cost'];

const currency = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const number3 = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const formatDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '—');

const DEFAULT_FILTERS = { branch: '', warehouse: '', productGroup: '', product: '', valuationMethod: '', asOnDate: dayjs().format('YYYY-MM-DD') };

// Reports > Inventory > Stock Valuation print layout — see ReportPrintable.jsx.
const PRINT_FILTER_LABELS = {
  branch: 'Branch', warehouse: 'Warehouse', productGroup: 'Product Group', product: 'Product',
  valuationMethod: 'Valuation Method', asOnDate: 'As On Date',
};
const PRINT_DATE_FIELDS = ['asOnDate'];

export default function StockValuation() {
  const theme = useTheme();
  const isMobile = useIsMobileListView();

  const { data: branches } = branchApi.useList();
  const { data: productGroups } = productGroupApi.useList();
  const { data: products } = productApi.useList();

  const branchOptions = useMemo(() => ([
    { label: 'All Branches', value: '' },
    ...(branches || []).map((b) => ({ label: b.branchName, value: b.branchName })),
  ]), [branches]);

  // Warehouse options come from the Warehouse Master — see
  // lib/useWarehouseOptions.js. The FILTER now applies to the Stock
  // journal's own `warehouse` column (same as Stock Summary), so it narrows
  // to products that actually moved stock in that warehouse as of the
  // selected date, not to products whose master record happens to default
  // there. The per-row "Warehouse" column shown in the table below is still
  // Product.defaultLocation (a display-only field), unchanged.
  const { options: warehouseOptions } = useWarehouseOptions({ allLabel: 'All Warehouses' });

  const productGroupOptions = useMemo(() => ([
    { label: 'All Groups', value: '' },
    ...(productGroups || []).map((g) => ({ label: g.groupName, value: g.groupName })),
  ]), [productGroups]);

  const productOptions = useMemo(() => ([
    { label: 'All Products', value: '' },
    ...(products || []).map((p) => ({ label: `${p.productCode} - ${p.productName}`, value: p.productCode })),
  ]), [products]);

  const valuationMethodOptions = useMemo(() => ([
    ...VALUATION_METHOD_OPTIONS.map((s) => ({ label: s, value: s })),
  ]), []);

  // Filter bar is a report toolbar, not a create/edit form — no Zod
  // validation or persisted mutation, same as other report pages.
  const methods = useForm({
    defaultValues: { branch: '', warehouse: '', productGroup: '', product: '', valuationMethod: 'Moving Average', asOnDate: dayjs() },
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
  const stockValuationQuery = useTabSyncedReportQuery(useGetStockValuationReportQuery, appliedFilters);
  const cacheKey = useMemo(() => `stockValuationReport:${JSON.stringify(appliedFilters)}`, [appliedFilters]);
  const { data, isLoading, isFetching } = useLocalCachedQuery(cacheKey, stockValuationQuery);
  const baseTableRows = data?.rows || [];

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'productCode', headerName: 'Item No', filter: 'text' },
    { field: 'productName', headerName: 'Description', filter: 'text' },
    { field: 'productGroup', headerName: 'Product Group', filter: 'text' },
    { field: 'warehouse', headerName: 'Warehouse', filter: 'text' },
    { field: 'uom', headerName: 'UOM', filter: 'text' },
    { field: 'onHandQty', headerName: 'On-Hand Quantity', filter: 'numberRange', sortValue: (row) => (row.onHandQty == null || row.onHandQty === '' ? null : Number(row.onHandQty)) },
    { field: 'unitCost', headerName: 'Unit Cost (₹)', filter: 'numberRange', sortValue: (row) => (row.unitCost == null || row.unitCost === '' ? null : Number(row.unitCost)) },
    // Opening/Inward/Outward Value — the journal-based components that now
    // make up Stock Value (Opening + Inward - Outward), so the grand total
    // visibly reconciles the same way Stock Summary's Closing Value does.
    { field: 'openingValue', headerName: 'Opening Stock Value (₹)', filter: 'numberRange', sortValue: (row) => (row.openingValue == null || row.openingValue === '' ? null : Number(row.openingValue)) },
    { field: 'inwardValue', headerName: 'Inward Value (₹)', filter: 'numberRange', sortValue: (row) => (row.inwardValue == null || row.inwardValue === '' ? null : Number(row.inwardValue)) },
    { field: 'outwardValue', headerName: 'Outward Value (₹)', filter: 'numberRange', sortValue: (row) => (row.outwardValue == null || row.outwardValue === '' ? null : Number(row.outwardValue)) },
    { field: 'stockValue', headerName: 'Stock Value (₹)', filter: 'numberRange', sortValue: (row) => (row.stockValue == null || row.stockValue === '' ? null : Number(row.stockValue)) },
    { field: 'valuationMethod', headerName: 'Valuation Method', filter: 'text' },
    { field: 'lastPurchasePrice', headerName: 'Last Purchase Price (₹)', filter: 'numberRange', sortValue: (row) => (row.lastPurchasePrice == null || row.lastPurchasePrice === '' ? null : Number(row.lastPurchasePrice)) },
    { field: 'lastUpdated', headerName: 'Last Updated', filter: 'dateRange', sortValue: (row) => (row.lastUpdated ? new Date(row.lastUpdated).getTime() : null), searchValue: (row) => formatDate(row.lastUpdated) },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const totals = data?.totals || {};
  const stats = data?.stats || {};
  const inventoryValueByGroup = data?.inventoryValueByGroup || [];
  const topHighestValueProducts = data?.topHighestValueProducts || [];
  const warehouseWiseStockValue = data?.warehouseWiseStockValue || [];
  const stockValueDistribution = data?.stockValueDistribution || [];
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
      product: values.product || '',
      valuationMethod: values.valuationMethod || '',
      asOnDate: values.asOnDate ? dayjs(values.asOnDate).format('YYYY-MM-DD') : '',
    });
    setPage(0);
  });

  const onReset = () => {
    reset({ branch: '', warehouse: '', productGroup: '', product: '', valuationMethod: '', asOnDate: dayjs() });
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  const statCards = [
    { icon: <AccountBalanceWalletOutlinedIcon fontSize="small" />, label: 'Total Inventory Value', value: currency(stats.totalInventoryValue), color: 'primary' },
    { icon: <Inventory2Icon fontSize="small" />, label: 'Total Products', value: stats.totalProducts ?? 0, color: 'info' },
    { icon: <WidgetsOutlinedIcon fontSize="small" />, label: 'Total Stock Quantity', value: number3(stats.totalStockQuantity), color: 'success' },
    { icon: <PaidOutlinedIcon fontSize="small" />, label: 'Average Unit Cost', value: currency(stats.averageUnitCost), color: 'warning' },
    {
      icon: <ArrowUpwardOutlinedIcon fontSize="small" />,
      label: stats.highestValueItem?.name ? `Highest Value Item: ${stats.highestValueItem.name}` : 'Highest Value Item',
      value: currency(stats.highestValueItem?.value),
      color: 'secondary',
    },
    {
      icon: <ArrowDownwardOutlinedIcon fontSize="small" />,
      label: stats.lowestValueItem?.name ? `Lowest Value Item: ${stats.lowestValueItem.name}` : 'Lowest Value Item',
      value: currency(stats.lowestValueItem?.value),
      color: 'error',
    },
  ];

  const donutColors = [
    theme.palette.primary.main, theme.palette.success.main, theme.palette.warning.main,
    theme.palette.secondary.main, theme.palette.error.main, theme.palette.grey[400],
  ];
  const chartTooltipStyle = { backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 };

  // Export: current filtered rows to CSV — same client-side pattern used
  // elsewhere (StockSummary.jsx).
  const EXPORT_COLUMNS = [
    ['productCode', 'Item No'], ['productName', 'Description'], ['productGroup', 'Product Group'], ['warehouse', 'Warehouse'],
    ['uom', 'UOM'], ['onHandQty', 'On-Hand Quantity'], ['unitCost', 'Unit Cost'],
    ['openingValue', 'Opening Stock Value'], ['inwardValue', 'Inward Value'], ['outwardValue', 'Outward Value'],
    ['stockValue', 'Stock Value'],
    ['valuationMethod', 'Valuation Method'], ['lastPurchasePrice', 'Last Purchase Price'], ['lastUpdated', 'Last Updated'],
  ];
  const handleExport = () => {
    const header = EXPORT_COLUMNS.map(([, label]) => label).join(',');
    const lines = baseTableRows.map((r) => EXPORT_COLUMNS.map(([key]) => {
      let v = r[key];
      if (key === 'lastUpdated') v = formatDate(v);
      return `"${String(v ?? '').replace(/"/g, '""')}"`;
    }).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock-valuation.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<PriceCheckOutlinedIcon />}
        title="Stock Valuation"
        subtitle="Value of current stock on hand."
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
                <FormSelect name="product" label="Product" options={productOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="valuationMethod" label="Valuation Method" options={valuationMethodOptions} />
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
            <StatCard icon={c.icon} label={c.label} value={c.value} color={c.color} />
          </Grid>
        ))}
      </Grid>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ p: 0 }}>
          <TableToolbar
            title="Stock Valuation List"
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
                  fields={[
                    { label: '#', value: page * pageSize + idx + 1 },
                    { label: 'Item No', value: row.productCode },
                    { label: 'Product Group', value: row.productGroup },
                    { label: 'Warehouse', value: row.warehouse },
                    { label: 'UOM', value: row.uom },
                    { label: 'On-Hand Quantity', value: number3(row.onHandQty) },
                    { label: 'Unit Cost', value: currency(row.unitCost) },
                    { label: 'Opening Stock Value', value: currency(row.openingValue) },
                    { label: 'Inward Value', value: currency(row.inwardValue) },
                    { label: 'Outward Value', value: currency(row.outwardValue) },
                    { label: 'Stock Value', value: currency(row.stockValue) },
                    { label: 'Valuation Method', value: row.valuationMethod },
                    { label: 'Last Purchase Price', value: row.lastPurchasePrice != null ? currency(row.lastPurchasePrice) : '—' },
                    { label: 'Last Updated', value: formatDate(row.lastUpdated) },
                  ]}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No products found for the selected criteria" message="Try adjusting your date range or filters" />
                )
              )}
              {!isLoading && rows.length > 0 && (
                <Card variant="outlined" sx={{ mb: 1.5, bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Total</Typography>
                    <Stack spacing={0.75}>
                      {[
                        ['On-Hand Quantity', number3(totals.onHandQty)],
                        ['Opening Stock Value', currency(totals.openingValue)],
                        ['Inward Value', currency(totals.inwardValue)],
                        ['Outward Value', currency(totals.outwardValue)],
                        ['Stock Value', currency(totals.stockValue)],
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
            <>
              <ScrollableTableContainer>
                {/* `stickyHeader` pins the header row via ScrollableTableContainer's
                    own `& thead th` styling (see that component) — without it the
                    header scrolled away with the body like any other row. The
                    Total row below is pinned separately (position: sticky,
                    bottom: 0), since MUI's stickyHeader only pins the head. */}
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <SortableHeaderCell field="productCode" sort={table.sort} onSort={table.toggleSort}>Item No</SortableHeaderCell>
                      <SortableHeaderCell field="productName" sort={table.sort} onSort={table.toggleSort}>Description</SortableHeaderCell>
                      <SortableHeaderCell field="productGroup" sort={table.sort} onSort={table.toggleSort}>Product Group</SortableHeaderCell>
                      <SortableHeaderCell field="warehouse" sort={table.sort} onSort={table.toggleSort}>Warehouse</SortableHeaderCell>
                      <SortableHeaderCell field="uom" sort={table.sort} onSort={table.toggleSort}>UOM</SortableHeaderCell>
                      <SortableHeaderCell field="onHandQty" sort={table.sort} onSort={table.toggleSort} align="right">On-Hand Quantity</SortableHeaderCell>
                      <SortableHeaderCell field="unitCost" sort={table.sort} onSort={table.toggleSort} align="right">Unit Cost (₹)</SortableHeaderCell>
                      <SortableHeaderCell field="openingValue" sort={table.sort} onSort={table.toggleSort} align="right">Opening Stock Value (₹)</SortableHeaderCell>
                      <SortableHeaderCell field="inwardValue" sort={table.sort} onSort={table.toggleSort} align="right">Inward Value (₹)</SortableHeaderCell>
                      <SortableHeaderCell field="outwardValue" sort={table.sort} onSort={table.toggleSort} align="right">Outward Value (₹)</SortableHeaderCell>
                      <SortableHeaderCell field="stockValue" sort={table.sort} onSort={table.toggleSort} align="right">Stock Value (₹)</SortableHeaderCell>
                      <SortableHeaderCell field="valuationMethod" sort={table.sort} onSort={table.toggleSort}>Valuation Method</SortableHeaderCell>
                      <SortableHeaderCell field="lastPurchasePrice" sort={table.sort} onSort={table.toggleSort} align="right">Last Purchase Price (₹)</SortableHeaderCell>
                      <SortableHeaderCell field="lastUpdated" sort={table.sort} onSort={table.toggleSort}>Last Updated</SortableHeaderCell>
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
                        <TableCell align="right">{number3(row.onHandQty)}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.unitCost)}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.openingValue)}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.inwardValue)}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.outwardValue)}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.stockValue)}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.valuationMethod}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{row.lastPurchasePrice != null ? currency(row.lastPurchasePrice) : '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.lastUpdated)}</TableCell>
                      </TableRow>
                    ))}
                    {!isLoading && rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={15}>
                          {isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No products found for the selected criteria" message="Try adjusting your date range or filters" />
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                    {!isLoading && rows.length > 0 && (
                      // Pinned to the bottom of the scroll viewport, same idea as
                      // the header's `stickyHeader` above — an opaque background
                      // is required or scrolling rows show through underneath it,
                      // and zIndex 2 keeps it below the header's zIndex 3 (see
                      // ScrollableTableContainer) so the header still wins if the
                      // table is ever short enough for the two to meet.
                      <TableRow
                        sx={{
                          position: 'sticky',
                          bottom: 0,
                          zIndex: 2,
                          '& > td': {
                            backgroundColor: 'background.paper',
                            borderTop: '2px solid',
                            borderTopColor: 'divider',
                          },
                        }}
                      >
                        <TableCell colSpan={6}><Typography fontWeight={700}>Total</Typography></TableCell>
                        <TableCell align="right"><Typography fontWeight={700}>{number3(totals.onHandQty)}</Typography></TableCell>
                        <TableCell>—</TableCell>
                        <TableCell align="right"><Typography fontWeight={700}>{currency(totals.openingValue)}</Typography></TableCell>
                        <TableCell align="right"><Typography fontWeight={700}>{currency(totals.inwardValue)}</Typography></TableCell>
                        <TableCell align="right"><Typography fontWeight={700}>{currency(totals.outwardValue)}</Typography></TableCell>
                        <TableCell align="right"><Typography fontWeight={700}>{currency(totals.stockValue)}</Typography></TableCell>
                        <TableCell>—</TableCell>
                        <TableCell>—</TableCell>
                        <TableCell>—</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollableTableContainer>
            </>
          )}

          <EntityListPagination total={rows.length} page={page} onChange={setPage} pageSize={pageSize} onPageSizeChange={(v) => { setPageSize(v); setPage(0); }} />
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Inventory Value by Product Group</Typography>
              <Box sx={{ width: '100%', height: 180, position: 'relative' }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={inventoryValueByGroup} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                      {inventoryValueByGroup.map((entry, i) => <Cell key={entry.name} fill={donutColors[i % donutColors.length]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => currency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <Typography variant="caption" color="text.secondary" display="block">Total Value</Typography>
                  <Typography variant="subtitle2" fontWeight={700}>{currency(stats.totalInventoryValue)}</Typography>
                </Box>
              </Box>
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {inventoryValueByGroup.map((d, i) => (
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

        <Grid item xs={12} md={3}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Top 10 Highest Value Products</Typography>
              <Box sx={{ width: '100%', height: 300, mt: 1 }}>
                <ResponsiveContainer>
                  <BarChart data={topHighestValueProducts} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 9, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => currency(v)} />
                    <Bar dataKey="value" fill={theme.palette.warning.main} radius={[0, 4, 4, 0]} maxBarSize={14}>
                      <LabelList dataKey="value" position="right" formatter={(v) => currency(v)} style={{ fontSize: 9, fill: theme.palette.text.secondary }} />
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Warehouse-wise Stock Value</Typography>
              <Box sx={{ width: '100%', height: 260, mt: 1 }}>
                <ResponsiveContainer>
                  <BarChart data={warehouseWiseStockValue} margin={{ top: 20, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={{ fontSize: 10, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}L`} />
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => currency(v)} />
                    <Bar dataKey="value" fill={theme.palette.success.main} radius={[4, 4, 0, 0]} maxBarSize={36}>
                      <LabelList dataKey="value" position="top" formatter={(v) => currency(v)} style={{ fontSize: 9, fill: theme.palette.text.secondary }} />
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Stock Value Distribution</Typography>
              <Box sx={{ width: '100%', height: 180, position: 'relative' }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={stockValueDistribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                      {stockValueDistribution.map((entry, i) => <Cell key={entry.name} fill={donutColors[i % donutColors.length]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => `${v} products`} />
                  </PieChart>
                </ResponsiveContainer>
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <Typography variant="caption" color="text.secondary" display="block">Total Value</Typography>
                  <Typography variant="subtitle2" fontWeight={700}>{currency(stats.totalInventoryValue)}</Typography>
                </Box>
              </Box>
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {stockValueDistribution.map((d, i) => (
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
      </Grid>

      {/* Print always reflects the full Filters-section-scoped dataset
          (baseTableRows), not the quick-search/column-filter-narrowed
          `rows` used on screen -- see SalesQuotationRegister.jsx. */}
      <ReportPrintable
        title="Stock Valuation"
        subtitle="Inventory valuation by product and warehouse."
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
