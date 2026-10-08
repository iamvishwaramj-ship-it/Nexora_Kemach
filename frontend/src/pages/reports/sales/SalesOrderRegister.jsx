import React, { useMemo, useState } from 'react';
import LoadingState from '../../../components/feedback/LoadingState';
import EmptyState from '../../../components/data-display/EmptyState';
import { useForm, FormProvider } from 'react-hook-form';
import {
  Box, Typography, Button, Card, CardContent, Stack, Grid, Chip, Table, TableBody, TableCell,
  TableHead, TableRow, Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
} from '@mui/material';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
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
import { useGetSalesOrderRegisterReportQuery } from '../../../features/sales/salesOrderRegisterReportApi';
import { ENQUIRY_SOURCE_OPTIONS, ORDER_STATUS_OPTIONS } from '../../../lib/validation/salesSchemas';
import useTableFeatures from '../../../components/data-display/useTableFeatures';
import TableToolbar from '../../../components/data-display/TableToolbar';
import SortableHeaderCell from '../../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import TableFilterPanel from '../../../components/data-display/TableFilterPanel';
import ReportPrintable from '../../../components/print/ReportPrintable';
import { buildPrintFilters } from '../../../components/print/reportPrint';

const PAGE_SIZE = 10;

// Same status palette as the master Sales Order page (SalesOrder.jsx).
const STATUS_COLORS = { Draft: 'default', Confirmed: 'success', Pending: 'warning', Shipped: 'info', Delivered: 'success', Cancelled: 'error' };

// Delivery Status has no stored column on SalesOrder — it's derived
// server-side (register/report route) from ordered vs delivered quantity.
const DELIVERY_STATUS_COLORS = { Pending: 'warning', 'Partially Delivered': 'secondary', Delivered: 'success' };

const currency = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '—');

const DEFAULT_FILTERS = { fromDate: '', toDate: '', customer: '', salesPerson: '', status: '', source: '' };

// Reports > Sales > Sales Order Register print layout — see ReportPrintable.jsx.
const PRINT_FILTER_LABELS = {
  fromDate: 'From Date', toDate: 'To Date', customer: 'Customer', salesPerson: 'Salesperson', status: 'Status', source: 'Source',
};
const PRINT_DATE_FIELDS = ['fromDate', 'toDate'];

export default function SalesOrderRegister() {
  const isMobile = useIsMobileListView();

  const { data: customers } = customerApi.useList();
  const { data: salesEmployees } = salesEmployeeApi.useList();

  const customerOptions = useMemo(() => ([
    { label: 'All Customers', value: '' },
    ...(customers || []).map((c) => ({ label: c.customerName, value: c.customerName })),
  ]), [customers]);

  const salespersonOptions = useMemo(() => ([
    { label: 'All Salespersons', value: '' },
    ...(salesEmployees || []).map((e) => ({ label: e.employeeName, value: e.employeeName })),
  ]), [salesEmployees]);

  const statusOptions = useMemo(() => ([
    { label: 'All Status', value: '' },
    ...ORDER_STATUS_OPTIONS.map((s) => ({ label: s, value: s })),
  ]), []);

  const sourceOptions = useMemo(() => ([
    { label: 'All Sources', value: '' },
    ...ENQUIRY_SOURCE_OPTIONS.map((s) => ({ label: s, value: s })),
  ]), []);

  // Filter bar is a report toolbar, not a create/edit form — no Zod
  // validation or persisted mutation, same as EnquiryRegister.jsx.
  const methods = useForm({
    defaultValues: { fromDate: null, toDate: null, customer: '', salesPerson: '', status: '', source: '' },
  });
  const { handleSubmit, reset } = methods;

  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [viewRow, setViewRow] = useState(null);

  const { data, isLoading, isFetching } = useGetSalesOrderRegisterReportQuery(appliedFilters);
  const baseTableRows = data?.rows || [];

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'orderNo', headerName: 'Order No.', filter: 'text' },
    { field: 'orderDate', headerName: 'Order Date', filter: 'dateRange', sortValue: (row) => (row.orderDate ? new Date(row.orderDate).getTime() : null), searchValue: (row) => formatDate(row.orderDate) },
    { field: 'customer', headerName: 'Customer / Name', filter: 'text' },
    { field: 'salesPerson', headerName: 'Salesperson', filter: 'text' },
    { field: 'source', headerName: 'Source', filter: 'text' },
    { field: 'amount', headerName: 'Order Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.amount == null || row.amount === '' ? null : Number(row.amount)) },
    { field: 'deliveryDate', headerName: 'Required Date', filter: 'dateRange', sortValue: (row) => (row.deliveryDate ? new Date(row.deliveryDate).getTime() : null), searchValue: (row) => formatDate(row.deliveryDate) },
    { field: 'status', headerName: 'Status', filter: 'select' },
    { field: 'deliveryStatus', headerName: 'Delivery Status', filter: 'select' },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const stats = data?.stats || {};
  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  // Print: full filtered/sorted rows + the report's own grand total, fed into
  // the shared ReportPrintable layout — see components/print/ReportPrintable.jsx.
  const printFilters = useMemo(
    () => buildPrintFilters(appliedFilters, PRINT_FILTER_LABELS, PRINT_DATE_FIELDS),
    [appliedFilters],
  );
  const printTotals = useMemo(() => ({ amount: stats.totalOrderAmount }), [stats]);

  const onView = handleSubmit((values) => {
    setAppliedFilters({
      fromDate: values.fromDate ? dayjs(values.fromDate).format('YYYY-MM-DD') : '',
      toDate: values.toDate ? dayjs(values.toDate).format('YYYY-MM-DD') : '',
      customer: values.customer || '',
      salesPerson: values.salesPerson || '',
      status: values.status || '',
      source: values.source || '',
    });
    setPage(0);
  });

  const onReset = () => {
    reset({ fromDate: null, toDate: null, customer: '', salesPerson: '', status: '', source: '' });
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  const statCards = [
    { icon: <AssignmentOutlinedIcon fontSize="small" />, label: 'Total Orders', value: stats.totalOrders ?? 0, color: 'primary' },
    { icon: <AccountBalanceWalletOutlinedIcon fontSize="small" />, label: 'Total Order Amount', value: currency(stats.totalOrderAmount), color: 'success' },
    { icon: <ReceiptLongOutlinedIcon fontSize="small" />, label: 'Total Delivered Amount', value: currency(stats.totalDeliveredAmount), color: 'warning' },
    { icon: <TaskAltOutlinedIcon fontSize="small" />, label: 'Total Pending Amount', value: currency(stats.totalPendingAmount), color: 'secondary' },
    { icon: <CancelOutlinedIcon fontSize="small" />, label: 'Cancelled Orders', value: stats.cancelledOrders ?? 0, color: 'error' },
  ];

  // Export: current filtered rows to CSV — same client-side pattern used
  // elsewhere (EnquiryRegister.jsx).
  const EXPORT_COLUMNS = [
    ['orderNo', 'Order No.'], ['orderDate', 'Order Date'], ['customer', 'Customer / Name'],
    ['salesPerson', 'Salesperson'], ['source', 'Source'], ['amount', 'Order Amount'],
    ['deliveryDate', 'Required Date'], ['status', 'Status'], ['deliveryStatus', 'Delivery Status'],
  ];
  const handleExport = () => {
    const header = EXPORT_COLUMNS.map(([, label]) => label).join(',');
    const lines = baseTableRows.map((r) => EXPORT_COLUMNS.map(([key]) => {
      let v = r[key];
      if (key.toLowerCase().includes('date')) v = formatDate(v);
      else if (key === 'amount') v = Number(v || 0).toFixed(2);
      else if (key === 'deliveryStatus') v = v || '-';
      return `"${String(v ?? '').replace(/"/g, '""')}"`;
    }).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sales-order-register.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<ListAltOutlinedIcon />}
        title="Sales Order Register"
        subtitle="View and manage all sales orders."
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
                <FormSelect name="customer" label="Customer" options={customerOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="salesPerson" label="Salesperson" options={salespersonOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="status" label="Status" options={statusOptions} emptyValue="" />
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
                  <Button variant="outlined" color="inherit" onClick={onReset} sx={{ height: 40, whiteSpace: 'nowrap' }}>
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
          <Grid item xs={12} sm={6} md={2.4} key={c.label}>
            <StatCard {...c} />
          </Grid>
        ))}
      </Grid>

      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <TableToolbar
            title="Sales Order List"
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
                  title={row.orderNo}
                  statusChip={<Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />}
                  fields={[
                    { label: 'Order Date', value: formatDate(row.orderDate) },
                    { label: 'Customer / Name', value: row.customer || '—' },
                    { label: 'Salesperson', value: row.salesPerson || '—' },
                    { label: 'Source', value: row.source || '—' },
                    { label: 'Order Amount', value: currency(row.amount) },
                    { label: 'Required Date', value: formatDate(row.deliveryDate) },
                    { label: 'Delivery Status', value: row.deliveryStatus || '—' },
                  ]}
                  onView={() => setViewRow(row)}
                  onEdit={() => window.print()}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title="No sales orders found for the selected criteria" message="Try adjusting your date range or filters" />
                )
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <SortableHeaderCell field="orderNo" sort={table.sort} onSort={table.toggleSort}>Order No.</SortableHeaderCell>
                    <SortableHeaderCell field="orderDate" sort={table.sort} onSort={table.toggleSort}>Order Date</SortableHeaderCell>
                    <SortableHeaderCell field="customer" sort={table.sort} onSort={table.toggleSort}>Customer / Name</SortableHeaderCell>
                    <SortableHeaderCell field="salesPerson" sort={table.sort} onSort={table.toggleSort}>Salesperson</SortableHeaderCell>
                    <SortableHeaderCell field="source" sort={table.sort} onSort={table.toggleSort}>Source</SortableHeaderCell>
                    <SortableHeaderCell field="amount" sort={table.sort} onSort={table.toggleSort} align="right">Order Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="deliveryDate" sort={table.sort} onSort={table.toggleSort}>Required Date</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <SortableHeaderCell field="deliveryStatus" sort={table.sort} onSort={table.toggleSort}>Delivery Status</SortableHeaderCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" fontWeight={700} color="primary.main">{row.orderNo}</Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.orderDate)}</TableCell>
                      <TableCell sx={{ minWidth: 160 }}>{row.customer || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.salesPerson || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.source || '—'}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.amount)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.deliveryDate)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        {row.deliveryStatus
                          ? <Chip size="small" label={row.deliveryStatus} color={DELIVERY_STATUS_COLORS[row.deliveryStatus] || 'default'} variant="outlined" />
                          : <Typography variant="body2" color="text.secondary">—</Typography>}
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          <IconButton size="small" onClick={() => setViewRow(row)} aria-label="view">
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => window.print()} aria-label="print">
                            <PrintOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10}>
                        {isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title="No sales orders found for the selected criteria" message="Try adjusting your date range or filters" />
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

      <Dialog open={!!viewRow} onClose={() => setViewRow(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Sales Order Details — {viewRow?.orderNo}</DialogTitle>
        <DialogContent dividers>
          {viewRow && (
            <Stack spacing={1.25}>
              {[
                ['Order Date', formatDate(viewRow.orderDate)],
                ['Customer / Name', viewRow.customer || '—'],
                ['Salesperson', viewRow.salesPerson || '—'],
                ['Source', viewRow.source || '—'],
                ['Order Amount', currency(viewRow.amount)],
                ['Required Date', formatDate(viewRow.deliveryDate)],
                ['Status', viewRow.status || '—'],
                ['Delivery Status', viewRow.deliveryStatus || '—'],
              ].map(([label, value]) => (
                <Stack key={label} direction="row" justifyContent="space-between" spacing={2}>
                  <Typography variant="body2" color="text.secondary">{label}</Typography>
                  <Typography variant="body2" fontWeight={600} sx={{ textAlign: 'right' }}>{value}</Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewRow(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <ReportPrintable
        title="Sales Order Register"
        subtitle="View and manage all sales orders."
        filters={printFilters}
        columns={tableColumns}
        // Print always reflects the full Filters-section-scoped dataset, not
        // whatever the quick search box / column filter popover currently
        // narrows the on-screen table to — see SalesQuotationRegister.jsx.
        rows={baseTableRows}
        totals={printTotals}
      />
    </Box>
  );
}
