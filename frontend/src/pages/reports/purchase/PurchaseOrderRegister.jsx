import React, { useMemo, useState } from 'react';
import LoadingState from '../../../components/feedback/LoadingState';
import EmptyState from '../../../components/data-display/EmptyState';
import { useForm, FormProvider } from 'react-hook-form';
import {
  Box, Typography, Button, Card, CardContent, Stack, Grid, Chip, Table, TableBody, TableCell,
  TableHead, TableRow,
} from '@mui/material';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
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
import { supplierApi } from '../../../features/resources';
import { useGetPurchaseOrderRegisterReportQuery } from '../../../features/purchase/purchaseOrderRegisterReportApi';
import { PO_STATUS_OPTIONS } from '../../../lib/validation/purchaseSchemas';
import useTableFeatures from '../../../components/data-display/useTableFeatures';
import TableToolbar from '../../../components/data-display/TableToolbar';
import SortableHeaderCell from '../../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import TableFilterPanel from '../../../components/data-display/TableFilterPanel';
import ReportPrintable from '../../../components/print/ReportPrintable';
import { buildPrintFilters } from '../../../components/print/reportPrint';

const PAGE_SIZE = 10;

// Same status palette convention as the sales-side register reports
// (SalesOrderRegister.jsx) — PurchaseOrder.status is the real stored field.
const STATUS_COLORS = {
  Draft: 'default', Open: 'warning', 'Partially Received': 'secondary',
  Received: 'success', 'Partially Invoiced': 'info', Closed: 'success', Cancelled: 'error',
};

// Purchase Order has no source column of its own (unlike SalesOrder/
// SalesInvoice) — this list is filter-bar-only and currently a no-op on
// the backend, see the route comment in resources.js.
const SOURCE_OPTIONS = ['Direct Purchase', 'Rate Contract', 'Tender', 'Import'];

const currency = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const number2 = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '—');

const DEFAULT_FILTERS = { fromDate: '', toDate: '', supplier: '', status: '', source: '' };

// Reports > Purchase > Purchase Order Register print layout — see ReportPrintable.jsx.
const PRINT_FILTER_LABELS = {
  fromDate: 'From Date', toDate: 'To Date', supplier: 'Supplier', status: 'Status', source: 'Source',
};
const PRINT_DATE_FIELDS = ['fromDate', 'toDate'];

export default function PurchaseOrderRegister() {
  const isMobile = useIsMobileListView();

  const { data: suppliers } = supplierApi.useList();

  const supplierOptions = useMemo(() => ([
    { label: 'All Suppliers', value: '' },
    ...(suppliers || []).map((s) => ({ label: s.supplierName, value: s.supplierName })),
  ]), [suppliers]);

  const statusOptions = useMemo(() => ([
    { label: 'All Status', value: '' },
    ...PO_STATUS_OPTIONS.map((s) => ({ label: s, value: s })),
  ]), []);

  const sourceOptions = useMemo(() => ([
    { label: 'All Sources', value: '' },
    ...SOURCE_OPTIONS.map((s) => ({ label: s, value: s })),
  ]), []);

  // Filter bar is a report toolbar, not a create/edit form — no Zod
  // validation or persisted mutation, same as SalesOrderRegister.jsx.
  const methods = useForm({
    defaultValues: { fromDate: null, toDate: null, supplier: '', status: '', source: '' },
  });
  const { handleSubmit, reset } = methods;

  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const { data, isLoading, isFetching } = useGetPurchaseOrderRegisterReportQuery(appliedFilters);
  const baseTableRows = data?.rows || [];

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'poNo', headerName: 'PO No.', filter: 'text' },
    { field: 'poDate', headerName: 'PO Date', filter: 'dateRange', sortValue: (row) => (row.poDate ? new Date(row.poDate).getTime() : null), searchValue: (row) => formatDate(row.poDate) },
    { field: 'supplierCode', headerName: 'Supplier Code', filter: 'text' },
    { field: 'supplier', headerName: 'Supplier Name', filter: 'text' },
    { field: 'goodsAmount', headerName: 'Goods Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.goodsAmount == null || row.goodsAmount === '' ? null : Number(row.goodsAmount)) },
    { field: 'taxAmount', headerName: 'Tax Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.taxAmount == null || row.taxAmount === '' ? null : Number(row.taxAmount)) },
    { field: 'otherCharges', headerName: 'Other Charges (₹)', filter: 'numberRange', sortValue: (row) => (row.otherCharges == null || row.otherCharges === '' ? null : Number(row.otherCharges)) },
    { field: 'netAmount', headerName: 'Net Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.netAmount == null || row.netAmount === '' ? null : Number(row.netAmount)) },
    { field: 'status', headerName: 'Status', filter: 'select' },
    { field: 'expectedDate', headerName: 'Expected Date', filter: 'dateRange', sortValue: (row) => (row.expectedDate ? new Date(row.expectedDate).getTime() : null), searchValue: (row) => formatDate(row.expectedDate) },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const totals = data?.totals || {};
  const stats = data?.stats || {};
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
      supplier: values.supplier || '',
      status: values.status || '',
      source: values.source || '',
    });
    setPage(0);
  });

  const onReset = () => {
    reset({ fromDate: null, toDate: null, supplier: '', status: '', source: '' });
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  const statCards = [
    { icon: <AssignmentOutlinedIcon fontSize="small" />, label: 'Total Orders', value: stats.totalOrders ?? 0, color: 'primary' },
    { icon: <ShoppingCartOutlinedIcon fontSize="small" />, label: 'Total Order Amount', value: currency(stats.totalOrderAmount), color: 'success' },
    { icon: <Inventory2OutlinedIcon fontSize="small" />, label: 'Total Ordered Quantity', value: number2(stats.totalOrderedQuantity), color: 'warning' },
    { icon: <PercentOutlinedIcon fontSize="small" />, label: 'Total Tax Amount', value: currency(stats.totalTaxAmount), color: 'secondary' },
    { icon: <CurrencyRupeeOutlinedIcon fontSize="small" />, label: 'Total Net Amount', value: currency(stats.totalNetAmount), color: 'info' },
    { icon: <TrendingUpOutlinedIcon fontSize="small" />, label: 'Avg. Order Value', value: currency(stats.avgOrderValue), color: 'error' },
  ];

  // Export: current filtered rows to CSV — same client-side pattern used
  // elsewhere (SalesOrderRegister.jsx).
  const EXPORT_COLUMNS = [
    ['poNo', 'PO No.'], ['poDate', 'PO Date'], ['supplierCode', 'Supplier Code'], ['supplier', 'Supplier Name'],
    ['goodsAmount', 'Goods Amount'], ['taxAmount', 'Tax Amount'], ['otherCharges', 'Other Charges'], ['netAmount', 'Net Amount'],
    ['status', 'Status'], ['expectedDate', 'Expected Date'],
  ];
  const handleExport = () => {
    const header = EXPORT_COLUMNS.map(([, label]) => label).join(',');
    const lines = baseTableRows.map((r) => EXPORT_COLUMNS.map(([key]) => {
      let v = r[key];
      if (key.toLowerCase().includes('date')) v = formatDate(v);
      else if (['goodsAmount', 'taxAmount', 'otherCharges', 'netAmount'].includes(key)) v = Number(v || 0).toFixed(2);
      return `"${String(v ?? '').replace(/"/g, '""')}"`;
    }).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'purchase-order-register.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<AssignmentOutlinedIcon />}
        title="Purchase Order Register"
        subtitle="All purchase orders raised in the selected period."
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
              <Grid item xs={12} sm={6} md={2.5}>
                <FormSelect name="supplier" label="Supplier" options={supplierOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2.5}>
                <FormSelect name="status" label="Status" options={statusOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
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

      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <TableToolbar
            title="Purchase Order List"
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
                  statusChip={<Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />}
                  fields={[
                    { label: 'PO Date', value: formatDate(row.poDate) },
                    { label: 'Supplier Code', value: row.supplierCode },
                    { label: 'Supplier Name', value: row.supplier || '—' },
                    { label: 'Goods Amount', value: currency(row.goodsAmount) },
                    { label: 'Tax Amount', value: currency(row.taxAmount) },
                    { label: 'Other Charges', value: currency(row.otherCharges) },
                    { label: 'Net Amount', value: currency(row.netAmount) },
                    { label: 'Expected Date', value: formatDate(row.expectedDate) },
                  ]}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<ShoppingCartOutlinedIcon sx={{ fontSize: 48 }} />} title="No purchase orders found for the selected criteria" message="Try adjusting your date range or filters" />
                )
              )}
              {!isLoading && rows.length > 0 && (
                <Card variant="outlined" sx={{ mb: 1.5, bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Total</Typography>
                    <Stack spacing={0.75}>
                      {[
                        ['Goods Amount', currency(totals.goodsAmount)], ['Tax Amount', currency(totals.taxAmount)],
                        ['Other Charges', currency(totals.otherCharges)], ['Net Amount', currency(totals.netAmount)],
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
                    <SortableHeaderCell field="goodsAmount" sort={table.sort} onSort={table.toggleSort} align="right">Goods Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="taxAmount" sort={table.sort} onSort={table.toggleSort} align="right">Tax Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="otherCharges" sort={table.sort} onSort={table.toggleSort} align="right">Other Charges (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="netAmount" sort={table.sort} onSort={table.toggleSort} align="right">Net Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <SortableHeaderCell field="expectedDate" sort={table.sort} onSort={table.toggleSort}>Expected Date</SortableHeaderCell>
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
                      <TableCell sx={{ minWidth: 160 }}>{row.supplier || '—'}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.goodsAmount)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.taxAmount)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.otherCharges)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.netAmount)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.expectedDate)}</TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10}>
                        {isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<ShoppingCartOutlinedIcon sx={{ fontSize: 48 }} />} title="No purchase orders found for the selected criteria" message="Try adjusting your date range or filters" />
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && rows.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={3}><Typography fontWeight={700}>Total ({rows.length} orders)</Typography></TableCell>
                      <TableCell>—</TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.goodsAmount)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.taxAmount)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.otherCharges)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.netAmount)}</Typography></TableCell>
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

      <ReportPrintable
        title="Purchase Order Register"
        subtitle="All purchase orders raised in the selected period."
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
