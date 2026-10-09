import React, { useMemo, useState } from 'react';
import LoadingState from '../../../components/feedback/LoadingState';
import EmptyState from '../../../components/data-display/EmptyState';
import { useForm, FormProvider } from 'react-hook-form';
import {
  Box, Typography, Button, Card, CardContent, Stack, Grid, Chip, Table, TableBody, TableCell,
  TableHead, TableRow,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from 'recharts';
import AssignmentLateOutlinedIcon from '@mui/icons-material/AssignmentLateOutlined';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import CurrencyRupeeOutlinedIcon from '@mui/icons-material/CurrencyRupeeOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import dayjs from 'dayjs';
import FormSelect from '../../../components/form/FormSelect';
import FormDatePicker from '../../../components/form/FormDatePicker';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import CompanyBadge from '../../../components/common/CompanyBadge';
import EntityListPagination from '../../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../../components/data-display/useIsMobileListView';
import StatCard from '../../../components/data-display/StatCard';
import { supplierApi, productGroupApi } from '../../../features/resources';
import { useGetPendingPurchaseOrderReportQuery } from '../../../features/purchase/pendingPurchaseOrderReportApi';
import useTableFeatures from '../../../components/data-display/useTableFeatures';
import TableToolbar from '../../../components/data-display/TableToolbar';
import SortableHeaderCell from '../../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import TableFilterPanel from '../../../components/data-display/TableFilterPanel';
import ReportPrintable from '../../../components/print/ReportPrintable';
import { buildPrintFilters } from '../../../components/print/reportPrint';

const PAGE_SIZE = 10;

// Purchase Order has no source column of its own — this list is
// filter-bar-only and currently a no-op on the backend, see the route
// comment in resources.js.
const SOURCE_OPTIONS = ['Direct Purchase', 'Rate Contract', 'Tender', 'Import'];

const currency = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const number2 = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '—');
const lakh = (v) => `${Number(v || 0)}L`;

const DEFAULT_FILTERS = { supplier: '', fromExpectedDate: '', toExpectedDate: '', buyingGroup: '', source: '' };

// Reports > Purchase > Pending Purchase Order print layout — see ReportPrintable.jsx.
const PRINT_FILTER_LABELS = {
  supplier: 'Supplier', fromExpectedDate: 'From Expected Date', toExpectedDate: 'To Expected Date',
  buyingGroup: 'Buying Group', source: 'Source',
};
const PRINT_DATE_FIELDS = ['fromExpectedDate', 'toExpectedDate'];

export default function PendingPurchaseOrder() {
  const theme = useTheme();
  const isMobile = useIsMobileListView();

  const { data: suppliers } = supplierApi.useList();
  const { data: productGroups } = productGroupApi.useList();

  const supplierOptions = useMemo(() => ([
    { label: 'All Suppliers', value: '' },
    ...(suppliers || []).map((s) => ({ label: s.supplierName, value: s.supplierName })),
  ]), [suppliers]);

  const buyingGroupOptions = useMemo(() => ([
    { label: 'All Groups', value: '' },
    ...(productGroups || []).map((g) => ({ label: g.groupName, value: g.groupName })),
  ]), [productGroups]);

  const sourceOptions = useMemo(() => ([
    { label: 'All Sources', value: '' },
    ...SOURCE_OPTIONS.map((s) => ({ label: s, value: s })),
  ]), []);

  // Filter bar is a report toolbar, not a create/edit form — no Zod
  // validation or persisted mutation, same as PurchaseOrderRegister.jsx.
  const methods = useForm({
    defaultValues: { supplier: '', fromExpectedDate: null, toExpectedDate: null, buyingGroup: '', source: '' },
  });
  const { handleSubmit, reset } = methods;

  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const { data, isLoading, isFetching } = useGetPendingPurchaseOrderReportQuery(appliedFilters);
  const baseTableRows = data?.rows || [];

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'poNo', headerName: 'PO No.', filter: 'text' },
    { field: 'poDate', headerName: 'PO Date', filter: 'dateRange', sortValue: (row) => (row.poDate ? new Date(row.poDate).getTime() : null), searchValue: (row) => formatDate(row.poDate) },
    { field: 'supplierCode', headerName: 'Supplier Code', filter: 'text' },
    { field: 'supplier', headerName: 'Supplier Name', filter: 'text' },
    { field: 'expectedDate', headerName: 'Expected Date', filter: 'dateRange', sortValue: (row) => (row.expectedDate ? new Date(row.expectedDate).getTime() : null), searchValue: (row) => formatDate(row.expectedDate) },
    { field: 'buyingGroup', headerName: 'Buying Group', filter: 'text' },
    { field: 'goodsAmount', headerName: 'Goods Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.goodsAmount == null || row.goodsAmount === '' ? null : Number(row.goodsAmount)) },
    { field: 'taxAmount', headerName: 'Tax Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.taxAmount == null || row.taxAmount === '' ? null : Number(row.taxAmount)) },
    { field: 'netAmount', headerName: 'Net Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.netAmount == null || row.netAmount === '' ? null : Number(row.netAmount)) },
    { field: 'pendingQty', headerName: 'Pending Qty', filter: 'numberRange', sortValue: (row) => (row.pendingQty == null || row.pendingQty === '' ? null : Number(row.pendingQty)) },
    { field: 'daysPending', headerName: 'Days Pending', filter: 'text' },
    { field: 'status', headerName: 'Status', filter: 'select' },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const totals = data?.totals || {};
  const stats = data?.stats || {};
  const topSuppliers = data?.topSuppliers || [];
  const buyingGroupContribution = data?.buyingGroupContribution || [];
  const expectedDateBuckets = data?.expectedDateBuckets || {};
  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  // Print: full filtered/sorted rows + the report's own grand totals, fed
  // into the shared ReportPrintable layout — see components/print/ReportPrintable.jsx.
  const printFilters = useMemo(
    () => buildPrintFilters(appliedFilters, PRINT_FILTER_LABELS, PRINT_DATE_FIELDS),
    [appliedFilters],
  );

  const expectedDateChartData = useMemo(() => ([
    { name: '0 - 7 Days', value: Math.round(((expectedDateBuckets.d0to7 || 0) / 100000) * 100) / 100 },
    { name: '8 - 15 Days', value: Math.round(((expectedDateBuckets.d8to15 || 0) / 100000) * 100) / 100 },
    { name: '16 - 30 Days', value: Math.round(((expectedDateBuckets.d16to30 || 0) / 100000) * 100) / 100 },
    { name: 'Above 30 Days', value: Math.round(((expectedDateBuckets.above30 || 0) / 100000) * 100) / 100 },
  ]), [expectedDateBuckets]);

  const onView = handleSubmit((values) => {
    setAppliedFilters({
      supplier: values.supplier || '',
      fromExpectedDate: values.fromExpectedDate ? dayjs(values.fromExpectedDate).format('YYYY-MM-DD') : '',
      toExpectedDate: values.toExpectedDate ? dayjs(values.toExpectedDate).format('YYYY-MM-DD') : '',
      buyingGroup: values.buyingGroup || '',
      source: values.source || '',
    });
    setPage(0);
  });

  const onReset = () => {
    reset({ supplier: '', fromExpectedDate: null, toExpectedDate: null, buyingGroup: '', source: '' });
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  const statCards = [
    { icon: <AssignmentOutlinedIcon fontSize="small" />, label: 'Total Pending Orders', value: stats.totalPendingOrders ?? 0, color: 'primary' },
    { icon: <ShoppingCartOutlinedIcon fontSize="small" />, label: 'Total Order Amount', value: currency(stats.totalOrderAmount), color: 'success' },
    { icon: <Inventory2OutlinedIcon fontSize="small" />, label: 'Total Pending Quantity', value: number2(stats.totalPendingQuantity), color: 'warning' },
    { icon: <CurrencyRupeeOutlinedIcon fontSize="small" />, label: 'Total Tax Amount', value: currency(stats.totalTaxAmount), color: 'secondary' },
    { icon: <PaidOutlinedIcon fontSize="small" />, label: 'Total Net Amount', value: currency(stats.totalNetAmount), color: 'info' },
    { icon: <EventOutlinedIcon fontSize="small" />, label: 'Avg. Days Pending', value: `${number2(stats.avgDaysPending)} Days`, color: 'error' },
  ];

  const donutColors = [
    theme.palette.primary.main, theme.palette.success.main, theme.palette.warning.main,
    theme.palette.secondary.main, theme.palette.info.main, theme.palette.grey[400],
  ];
  const chartTooltipStyle = { backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 };

  // Export: current filtered rows to CSV — same client-side pattern used
  // elsewhere (PurchaseOrderRegister.jsx).
  const EXPORT_COLUMNS = [
    ['poNo', 'PO No.'], ['poDate', 'PO Date'], ['supplierCode', 'Supplier Code'], ['supplier', 'Supplier Name'],
    ['expectedDate', 'Expected Date'], ['buyingGroup', 'Buying Group'], ['goodsAmount', 'Goods Amount'],
    ['taxAmount', 'Tax Amount'], ['netAmount', 'Net Amount'], ['pendingQty', 'Pending Qty'], ['daysPending', 'Days Pending'], ['status', 'Status'],
  ];
  const handleExport = () => {
    const header = EXPORT_COLUMNS.map(([, label]) => label).join(',');
    const lines = baseTableRows.map((r) => EXPORT_COLUMNS.map(([key]) => {
      let v = r[key];
      if (key.toLowerCase().includes('date')) v = formatDate(v);
      else if (['goodsAmount', 'taxAmount', 'netAmount'].includes(key)) v = Number(v || 0).toFixed(2);
      return `"${String(v ?? '').replace(/"/g, '""')}"`;
    }).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pending-purchase-orders.csv';
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
                <FormSelect name="supplier" label="Supplier" options={supplierOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormDatePicker name="fromExpectedDate" label="From Expected Date" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormDatePicker name="toExpectedDate" label="To Expected Date" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="buyingGroup" label="Buying Group" options={buyingGroupOptions} emptyValue="" />
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
            title="Pending Purchase Order List"
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
                  key={row.id}
                  title={row.poNo}
                  statusChip={<Chip size="small" label={row.status} color="warning" variant="outlined" />}
                  fields={[
                    { label: 'PO Date', value: formatDate(row.poDate) },
                    { label: 'Supplier Code', value: row.supplierCode },
                    { label: 'Supplier Name', value: row.supplier || '—' },
                    { label: 'Expected Date', value: formatDate(row.expectedDate) },
                    { label: 'Buying Group', value: row.buyingGroup },
                    { label: 'Goods Amount', value: currency(row.goodsAmount) },
                    { label: 'Tax Amount', value: currency(row.taxAmount) },
                    { label: 'Net Amount', value: currency(row.netAmount) },
                    { label: 'Pending Qty', value: number2(row.pendingQty) },
                    { label: 'Days Pending', value: row.daysPending ?? '—' },
                  ]}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<ShoppingCartOutlinedIcon sx={{ fontSize: 48 }} />} title="No pending purchase orders found for the selected criteria" message="Try adjusting your date range or filters" />
                )
              )}
              {!isLoading && rows.length > 0 && (
                <Card variant="outlined" sx={{ mb: 1.5, bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Total</Typography>
                    <Stack spacing={0.75}>
                      {[
                        ['Goods Amount', currency(totals.goodsAmount)], ['Tax Amount', currency(totals.taxAmount)],
                        ['Net Amount', currency(totals.netAmount)], ['Pending Qty', number2(totals.pendingQty)],
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
                    <SortableHeaderCell field="poNo" sort={table.sort} onSort={table.toggleSort}>PO No.</SortableHeaderCell>
                    <SortableHeaderCell field="poDate" sort={table.sort} onSort={table.toggleSort}>PO Date</SortableHeaderCell>
                    <SortableHeaderCell field="supplierCode" sort={table.sort} onSort={table.toggleSort}>Supplier Code</SortableHeaderCell>
                    <SortableHeaderCell field="supplier" sort={table.sort} onSort={table.toggleSort}>Supplier Name</SortableHeaderCell>
                    <SortableHeaderCell field="expectedDate" sort={table.sort} onSort={table.toggleSort}>Expected Date</SortableHeaderCell>
                    <SortableHeaderCell field="buyingGroup" sort={table.sort} onSort={table.toggleSort}>Buying Group</SortableHeaderCell>
                    <SortableHeaderCell field="goodsAmount" sort={table.sort} onSort={table.toggleSort} align="right">Goods Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="taxAmount" sort={table.sort} onSort={table.toggleSort} align="right">Tax Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="netAmount" sort={table.sort} onSort={table.toggleSort} align="right">Net Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="pendingQty" sort={table.sort} onSort={table.toggleSort} align="right">Pending Qty</SortableHeaderCell>
                    <SortableHeaderCell field="daysPending" sort={table.sort} onSort={table.toggleSort} align="right">Days Pending</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" fontWeight={700} color="primary.main">{row.poNo}</Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.poDate)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.supplierCode}</TableCell>
                      <TableCell sx={{ minWidth: 150 }}>{row.supplier || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.expectedDate)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.buyingGroup}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.goodsAmount)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.taxAmount)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.netAmount)}</TableCell>
                      <TableCell align="right">{number2(row.pendingQty)}</TableCell>
                      <TableCell align="right">{row.daysPending ?? '—'}</TableCell>
                      <TableCell>
                        <Chip size="small" label={row.status} color="warning" variant="outlined" />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={12}>
                        {isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<ShoppingCartOutlinedIcon sx={{ fontSize: 48 }} />} title="No pending purchase orders found for the selected criteria" message="Try adjusting your date range or filters" />
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && rows.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={6}><Typography fontWeight={700}>Total ({rows.length})</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.goodsAmount)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.taxAmount)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.netAmount)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{number2(totals.pendingQty)}</Typography></TableCell>
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Pending by Supplier (Top 5)</Typography>
              <Box sx={{ width: '100%', height: 180, position: 'relative' }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={topSuppliers} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                      {topSuppliers.map((entry, i) => <Cell key={entry.name} fill={donutColors[i % donutColors.length]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => currency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <Typography variant="caption" color="text.secondary" display="block">Total</Typography>
                  <Typography variant="subtitle2" fontWeight={700}>{lakh(Math.round(((stats.totalOrderAmount || 0) / 100000) * 100) / 100)}</Typography>
                </Box>
              </Box>
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {topSuppliers.length === 0 && (
                  <Typography variant="caption" color="text.secondary" align="center">No data for the selected criteria</Typography>
                )}
                {topSuppliers.map((d, i) => (
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Pending by Buying Group</Typography>
              <Box sx={{ width: '100%', height: 180, position: 'relative' }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={buyingGroupContribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                      {buyingGroupContribution.map((entry, i) => <Cell key={entry.name} fill={donutColors[i % donutColors.length]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => number2(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <Typography variant="caption" color="text.secondary" display="block">Total</Typography>
                  <Typography variant="subtitle2" fontWeight={700}>{number2(stats.totalPendingQuantity)}</Typography>
                </Box>
              </Box>
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {buyingGroupContribution.length === 0 && (
                  <Typography variant="caption" color="text.secondary" align="center">No data for the selected criteria</Typography>
                )}
                {buyingGroupContribution.map((d, i) => (
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Pending by Expected Date</Typography>
              <Box sx={{ width: '100%', height: 240, mt: 1 }}>
                <ResponsiveContainer>
                  <BarChart data={expectedDateChartData} margin={{ top: 20, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} tickFormatter={(v) => lakh(v)} />
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => [lakh(v), 'Amount']} />
                    <Bar dataKey="value" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} maxBarSize={48}>
                      <LabelList dataKey="value" position="top" formatter={(v) => lakh(v)} style={{ fontSize: 10, fill: theme.palette.text.secondary }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <ReportPrintable
        title="Pending Purchase Order"
        subtitle="Purchase orders yet to be fully received/invoiced."
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
