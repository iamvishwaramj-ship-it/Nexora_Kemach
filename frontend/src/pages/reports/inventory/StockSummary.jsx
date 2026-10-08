import React, { useMemo, useState, useRef, useLayoutEffect } from 'react';
import LoadingState from '../../../components/feedback/LoadingState';
import EmptyState from '../../../components/data-display/EmptyState';
import { useForm, FormProvider } from 'react-hook-form';
import {
  Box, Typography, Button, Card, CardContent, Stack, Grid, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, Tooltip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from 'recharts';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import dayjs from 'dayjs';
import FormSelect from '../../../components/form/FormSelect';
import FormDatePicker from '../../../components/form/FormDatePicker';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import CompanyBadge from '../../../components/common/CompanyBadge';
import EntityListPagination from '../../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../../components/data-display/useIsMobileListView';
import { branchApi, productGroupApi, productApi } from '../../../features/resources';
import { useWarehouseOptions } from '../../../lib/useWarehouseOptions';
import { useGetStockSummaryReportQuery } from '../../../features/inventory/stockSummaryReportApi';
import { useGetAvailableBalanceStockLedgerQuery } from '../../../features/inventory/availableBalanceReportApi';
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

// Stock Type has no dedicated column anywhere in the data model — this
// list is filter-bar-only and currently a no-op on the backend, see the
// route comment in resources.js.
const STOCK_TYPE_OPTIONS = ['Raw Material', 'Finished Goods', 'Consumable', 'Trading'];

const STATUS_OPTIONS = ['Available', 'Low Stock', 'Out of Stock'];
const STATUS_COLORS = { Available: 'success', 'Low Stock': 'warning', 'Out of Stock': 'error' };

const currency = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ledgerQty = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const number3 = (v) => Math.round(Number(v || 0)).toLocaleString('en-IN');
const formatDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '—');

const DEFAULT_FILTERS = { branch: '', warehouse: '', productGroup: '', product: '', itemCategory: '', stockType: '', stockStatus: '', asOnDate: dayjs().format('YYYY-MM-DD') };

// Reports > Inventory > Stock Summary print layout — see ReportPrintable.jsx.
const PRINT_FILTER_LABELS = {
  branch: 'Branch', warehouse: 'Warehouse', productGroup: 'Product Group', product: 'Product',
  itemCategory: 'Item Category', stockType: 'Stock Type', stockStatus: 'Stock Status', asOnDate: 'As On Date',
};
const PRINT_DATE_FIELDS = ['asOnDate'];

export default function StockSummary() {
  const theme = useTheme();
  const isMobile = useIsMobileListView();

  const { data: branches } = branchApi.useList();
  const { data: productGroups } = productGroupApi.useList();
  const { data: products } = productApi.useList();

  const branchOptions = useMemo(() => ([
    { label: 'All Branches', value: '' },
    ...(branches || []).map((b) => ({ label: b.branchName, value: b.branchName })),
  ]), [branches]);

  // Warehouses come from the Warehouse Master — see lib/useWarehouseOptions.js.
  // This filter used to synthesise '<branch> Warehouse' strings, which matched
  // nothing any document had ever stored.
  const { options: warehouseOptions } = useWarehouseOptions({ allLabel: 'All Warehouses' });

  const productGroupOptions = useMemo(() => ([
    { label: 'All Groups', value: '' },
    ...(productGroups || []).map((g) => ({ label: g.groupName, value: g.groupName })),
  ]), [productGroups]);

  const productOptions = useMemo(() => ([
    { label: 'All Products', value: '' },
    ...(products || []).map((p) => ({ label: `${p.productCode} - ${p.productName}`, value: p.productCode })),
  ]), [products]);

  const itemCategoryOptions = useMemo(() => ([
    { label: 'All Categories', value: '' },
    ...PRODUCT_TYPE_OPTIONS.map((s) => ({ label: s, value: s })),
  ]), []);

  const stockTypeOptions = useMemo(() => ([
    { label: 'All', value: '' },
    ...STOCK_TYPE_OPTIONS.map((s) => ({ label: s, value: s })),
  ]), []);

  const statusOptions = useMemo(() => ([
    { label: 'All', value: '' },
    ...STATUS_OPTIONS.map((s) => ({ label: s, value: s })),
  ]), []);

  // Filter bar is a report toolbar, not a create/edit form — no Zod
  // validation or persisted mutation, same as other report pages.
  const methods = useForm({
    defaultValues: { branch: '', warehouse: '', productGroup: '', product: '', itemCategory: '', stockType: '', stockStatus: '', asOnDate: dayjs() },
  });
  const { handleSubmit, reset } = methods;

  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [viewRow, setViewRow] = useState(null);

  // See LowStockReport.jsx / lib/useLocalCachedQuery.js for what this
  // does: instant table on reload from localStorage. Freshness while the
  // tab stays open is handled by useTabSyncedReportQuery (see
  // hooks/useTabSyncedReportQuery.js) -- it refetches on becoming active
  // (mount / tab visible) if 45s+ has elapsed since last sync, otherwise
  // arms a timer for the remainder, so a long-open tab doesn't quietly go
  // stale without polling on a fixed interval regardless of visibility.
  const stockSummaryQuery = useTabSyncedReportQuery(useGetStockSummaryReportQuery, appliedFilters);
  const cacheKey = useMemo(() => `stockSummaryReport:${JSON.stringify(appliedFilters)}`, [appliedFilters]);
  const { data, isLoading, isFetching } = useLocalCachedQuery(cacheKey, stockSummaryQuery);
  const baseTableRows = data?.rows || [];

  // Drill-down (eye icon): the individual Stock ledger entries behind the
  // clicked item's figures -- same endpoint Available Balance uses, but
  // across all warehouses (or just the one picked in the Warehouse filter),
  // scoped to the same branch / As On Date the report was run with.
  const { data: ledgerData, isFetching: isLedgerFetching } = useGetAvailableBalanceStockLedgerQuery(
    viewRow ? { productCode: viewRow.productCode, warehouse: appliedFilters.warehouse, branch: appliedFilters.branch, asOnDate: appliedFilters.asOnDate } : undefined,
    { skip: !viewRow },
  );
  const totals = data?.totals || {};
  const stats = data?.stats || {};
  const stockValueByGroup = data?.stockValueByGroup || [];
  const statusOverview = data?.statusOverview || [];
  const topLowStockItems = data?.topLowStockItems || [];
  const stockValueByWarehouse = data?.stockValueByWarehouse || [];
  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'productCode', headerName: 'Item No', filter: 'text' },
    { field: 'productName', headerName: 'Description', filter: 'text' },
    { field: 'productGroup', headerName: 'Product Group', filter: 'select' },
    { field: 'uom', headerName: 'UOM', filter: 'select' },
    { field: 'openingQty', headerName: 'Opening Qty', filter: 'numberRange', sortValue: (row) => Number(row.openingQty) || 0 },
    { field: 'openingValue', headerName: 'Opening Value', filter: 'numberRange', sortValue: (row) => Number(row.openingValue) || 0 },
    { field: 'inwardQty', headerName: 'Inward Qty', filter: 'numberRange', sortValue: (row) => Number(row.inwardQty) || 0 },
    { field: 'inwardValue', headerName: 'Inward Value', filter: 'numberRange', sortValue: (row) => Number(row.inwardValue) || 0 },
    { field: 'outwardQty', headerName: 'Outward Qty', filter: 'numberRange', sortValue: (row) => Number(row.outwardQty) || 0 },
    { field: 'outwardValue', headerName: 'Outward Value', filter: 'numberRange', sortValue: (row) => Number(row.outwardValue) || 0 },
    { field: 'closingQty', headerName: 'Closing Qty', filter: 'numberRange', sortValue: (row) => Number(row.closingQty) || 0 },
    { field: 'closingValue', headerName: 'Closing Value', filter: 'numberRange', sortValue: (row) => Number(row.closingValue) || 0 },
    { field: 'stockValue', headerName: 'Stock Value (₹)', filter: 'numberRange', sortValue: (row) => Number(row.stockValue) || 0 },
    { field: 'status', headerName: 'Stock Status', filter: 'select' },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const rows = table.rows;

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
      itemCategory: values.itemCategory || '',
      stockType: values.stockType || '',
      stockStatus: values.stockStatus || '',
      asOnDate: values.asOnDate ? dayjs(values.asOnDate).format('YYYY-MM-DD') : '',
    });
    setPage(0);
  });

  const onReset = () => {
    reset({ branch: '', warehouse: '', productGroup: '', product: '', itemCategory: '', stockType: '', stockStatus: '', asOnDate: dayjs() });
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  // The table's header is two rows deep (Opening/Inward/Outward/Closing
  // group labels on row 1, their Qty/Value sub-columns on row 2), but MUI's
  // `stickyHeader` pins EVERY head cell to `top: 0` by default -- correct
  // for row 1, but it makes row 2's cells stick at the very top too,
  // overlapping/fighting row 1 instead of sitting just beneath it. That's
  // the "Opening Stock / Inward / Outward / Closing Stock keeps moving"
  // report: row 2 was sticking to the wrong place, not actually broken,
  // just pinned on top of where row 1 already is. Measuring row 1's actual
  // rendered height and offsetting row 2's sticky `top` by that amount (via
  // headRow2Sx below) fixes it without hardcoding a pixel guess that would
  // drift if the theme's header font size/padding ever changes.
  const headRow1Ref = useRef(null);
  const [headRow1Height, setHeadRow1Height] = useState(0);
  useLayoutEffect(() => {
    const el = headRow1Ref.current;
    if (!el) return undefined;
    const measure = () => setHeadRow1Height(el.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const headRow2Sx = { top: headRow1Height };

  const donutColors = [
    theme.palette.primary.main, theme.palette.success.main, theme.palette.warning.main,
    theme.palette.secondary.main, theme.palette.error.main, theme.palette.grey[400],
  ];
  const statusDonutColors = [theme.palette.success.main, theme.palette.warning.main, theme.palette.error.main];
  const chartTooltipStyle = { backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 };

  // Export: current filtered rows to CSV — same client-side pattern used
  // elsewhere (PurchaseOrderRegister.jsx).
  const EXPORT_COLUMNS = [
    ['productCode', 'Item No'], ['productName', 'Description'], ['productGroup', 'Product Group'], ['uom', 'UOM'],
    ['openingQty', 'Opening Qty'], ['openingValue', 'Opening Value'], ['inwardQty', 'Inward Qty'], ['inwardValue', 'Inward Value'],
    ['outwardQty', 'Outward Qty'], ['outwardValue', 'Outward Value'], ['closingQty', 'Closing Qty'], ['closingValue', 'Closing Value'],
    ['stockValue', 'Stock Value'], ['status', 'Stock Status'],
  ];
  const handleExport = () => {
    const header = EXPORT_COLUMNS.map(([, label]) => label).join(',');
    const lines = baseTableRows.map((r) => EXPORT_COLUMNS.map(([key]) => `"${String(r[key] ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock-summary.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<Inventory2OutlinedIcon />}
        title="Stock Summary"
        subtitle="Current on-hand stock across all warehouses."
        rightContent={<CompanyBadge />}
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Filters</Typography>
          <FormProvider {...methods}>
            <Grid
              container
              spacing={2}
              alignItems="flex-start"
              sx={{
                '& .MuiOutlinedInput-root': {
                  height: 36,
                },
                '& .MuiInputLabel-root': {
                  fontSize: '0.85rem',
                },
              }}
            >
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="branch" label="Branch" options={branchOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="warehouse" label="Warehouse" options={warehouseOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="productGroup" label="Product Group" options={productGroupOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="product" label="Product" options={productOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="itemCategory" label="Item Category" options={itemCategoryOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="stockType" label="Stock Type" options={stockTypeOptions} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="stockStatus" label="Stock Status" options={statusOptions} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
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

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ p: 0 }}>
          <TableToolbar
            title="Stock Summary List"
            searchPlaceholder="Search products..."
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
                  onView={() => setViewRow(row)}
                  statusChip={<Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />}
                  fields={[
                    { label: '#', value: page * pageSize + idx + 1 },
                    { label: 'Item No', value: row.productCode },
                    { label: 'Product Group', value: row.productGroup },
                    { label: 'UOM', value: row.uom },
                    { label: 'Opening Qty', value: number3(row.openingQty) },
                    { label: 'Inward Qty', value: number3(row.inwardQty) },
                    { label: 'Outward Qty', value: number3(row.outwardQty) },
                    { label: 'Closing Qty', value: number3(row.closingQty) },
                    { label: 'Stock Value', value: currency(row.stockValue) },
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
                        ['Opening Value', currency(totals.openingValue)], ['Inward Value', currency(totals.inwardValue)],
                        ['Outward Value', currency(totals.outwardValue)], ['Closing Value', currency(totals.closingValue)],
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
                  <TableRow ref={headRow1Ref}>
                    <TableCell rowSpan={2}>#</TableCell>
                    <SortableHeaderCell field="productCode" sort={table.sort} onSort={table.toggleSort} rowSpan={2}>Item No</SortableHeaderCell>
                    <SortableHeaderCell field="productName" sort={table.sort} onSort={table.toggleSort} rowSpan={2}>Description</SortableHeaderCell>
                    <SortableHeaderCell field="productGroup" sort={table.sort} onSort={table.toggleSort} rowSpan={2}>Product Group</SortableHeaderCell>
                    <SortableHeaderCell field="uom" sort={table.sort} onSort={table.toggleSort} rowSpan={2}>UOM</SortableHeaderCell>
                    <TableCell align="center" colSpan={2}>Opening Stock</TableCell>
                    <TableCell align="center" colSpan={2}>Inward</TableCell>
                    <TableCell align="center" colSpan={2}>Outward</TableCell>
                    <TableCell align="center" colSpan={2}>Closing Stock</TableCell>
                    <SortableHeaderCell field="stockValue" sort={table.sort} onSort={table.toggleSort} rowSpan={2} align="right">Stock Value (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort} rowSpan={2}>Stock Status</SortableHeaderCell>
                  </TableRow>
                  <TableRow>
                    <SortableHeaderCell field="openingQty" sort={table.sort} onSort={table.toggleSort} align="right" sx={headRow2Sx}>Qty</SortableHeaderCell>
                    <SortableHeaderCell field="openingValue" sort={table.sort} onSort={table.toggleSort} align="right" sx={headRow2Sx}>Value (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="inwardQty" sort={table.sort} onSort={table.toggleSort} align="right" sx={headRow2Sx}>Qty</SortableHeaderCell>
                    <SortableHeaderCell field="inwardValue" sort={table.sort} onSort={table.toggleSort} align="right" sx={headRow2Sx}>Value (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="outwardQty" sort={table.sort} onSort={table.toggleSort} align="right" sx={headRow2Sx}>Qty</SortableHeaderCell>
                    <SortableHeaderCell field="outwardValue" sort={table.sort} onSort={table.toggleSort} align="right" sx={headRow2Sx}>Value (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="closingQty" sort={table.sort} onSort={table.toggleSort} align="right" sx={headRow2Sx}>Qty</SortableHeaderCell>
                    <SortableHeaderCell field="closingValue" sort={table.sort} onSort={table.toggleSort} align="right" sx={headRow2Sx}>Value (₹)</SortableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, idx) => (
                    <TableRow key={row.productCode} hover onClick={() => setViewRow(row)} sx={{ cursor: 'pointer' }}>
                      <TableCell>{page * pageSize + idx + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Typography variant="body2" fontWeight={700} color="primary.main">{row.productCode}</Typography>
                          <Tooltip title="View stock ledger">
                            <VisibilityOutlinedIcon fontSize="inherit" sx={{ color: 'text.disabled', fontSize: 14 }} />
                          </Tooltip>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ minWidth: 150 }}>{row.productName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.productGroup}</TableCell>
                      <TableCell>{row.uom}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{number3(row.openingQty)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.openingValue)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{number3(row.inwardQty)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.inwardValue)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{number3(row.outwardQty)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.outwardValue)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{number3(row.closingQty)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.closingValue)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.stockValue)}</TableCell>
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
                  <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No products found for the selected criteria" message="Try adjusting your date range or filters" />
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && rows.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={5}><Typography fontWeight={700}>Total</Typography></TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}><Typography fontWeight={700}>{number3(totals.openingQty)}</Typography></TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}><Typography fontWeight={700}>{currency(totals.openingValue)}</Typography></TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}><Typography fontWeight={700}>{number3(totals.inwardQty)}</Typography></TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}><Typography fontWeight={700}>{currency(totals.inwardValue)}</Typography></TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}><Typography fontWeight={700}>{number3(totals.outwardQty)}</Typography></TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}><Typography fontWeight={700}>{currency(totals.outwardValue)}</Typography></TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}><Typography fontWeight={700}>{number3(totals.closingQty)}</Typography></TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}><Typography fontWeight={700}>{currency(totals.closingValue)}</Typography></TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}><Typography fontWeight={700}>{currency(totals.closingValue)}</Typography></TableCell>
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

      {/* Print always reflects the full Filters-section-scoped dataset
          (baseTableRows), not the quick-search/column-filter-narrowed
          `rows` used on screen -- see SalesQuotationRegister.jsx. */}
      <ReportPrintable
        title="Stock Summary"
        subtitle="Opening, inward, outward and closing stock position."
        filters={printFilters}
        columns={tableColumns}
        rows={baseTableRows}
        totals={totals}
        totalsLabel="Total"
        orientation="landscape"
      />

      <Dialog open={!!viewRow} onClose={() => setViewRow(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          Stock Ledger — {viewRow?.productName} ({viewRow?.productCode}){appliedFilters.warehouse ? ` @ ${appliedFilters.warehouse}` : ' — All Warehouses'}
        </DialogTitle>
        <DialogContent dividers>
          {isLedgerFetching ? (
            <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress size={28} /></Stack>
          ) : (
            (ledgerData?.entries || []).length === 0 ? (
              <EmptyState
                icon={<Inventory2OutlinedIcon sx={{ fontSize: 40 }} />}
                title="No ledger entries found"
                message="Nothing has posted against this item as of the selected date."
              />
            ) : (
              <ScrollableTableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Warehouse</TableCell>
                      <TableCell>Document Type</TableCell>
                      <TableCell>Document No</TableCell>
                      <TableCell align="right">In Qty</TableCell>
                      <TableCell align="right">Out Qty</TableCell>
                      <TableCell align="right">Price (₹)</TableCell>
                      <TableCell align="right">Running Qty</TableCell>
                      <TableCell align="right">Running Value (₹)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(ledgerData?.entries || []).map((e) => (
                      <TableRow key={e.logEntry} hover>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{e.date ? dayjs(e.date).format('DD/MM/YYYY') : '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{e.warehouse}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{e.baseType}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{e.baseNum}</TableCell>
                        <TableCell align="right">{e.inQty ? ledgerQty(e.inQty) : '—'}</TableCell>
                        <TableCell align="right">{e.outQty ? ledgerQty(e.outQty) : '—'}</TableCell>
                        <TableCell align="right">{currency(e.price)}</TableCell>
                        <TableCell align="right"><Typography variant="body2" fontWeight={700}>{ledgerQty(e.runningQty)}</Typography></TableCell>
                        <TableCell align="right">{currency(e.runningValue)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={4}><Typography fontWeight={700}>Closing Balance</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{ledgerQty(ledgerData?.totals?.inQty)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{ledgerQty(ledgerData?.totals?.outQty)}</Typography></TableCell>
                      <TableCell>—</TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{ledgerQty(ledgerData?.totals?.closingQty)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(ledgerData?.totals?.closingValue)}</Typography></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </ScrollableTableContainer>
            )
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewRow(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
