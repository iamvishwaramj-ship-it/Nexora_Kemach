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
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
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
import { useGetSalesQuotationRegisterReportQuery } from '../../../features/sales/salesQuotationRegisterReportApi';
import { QUOTATION_STATUS_OPTIONS } from '../../../lib/validation/salesSchemas';
import useTableFeatures from '../../../components/data-display/useTableFeatures';
import TableToolbar from '../../../components/data-display/TableToolbar';
import SortableHeaderCell from '../../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import TableFilterPanel from '../../../components/data-display/TableFilterPanel';
import ReportPrintable from '../../../components/print/ReportPrintable';
import { buildPrintFilters } from '../../../components/print/reportPrint';

const PAGE_SIZE = 10;

// Same status palette style as the master Sales Quotation page — the
// quotation's own Open/Closed status.
const STATUS_COLORS = { Open: 'success', Closed: 'default' };

// Conversion Status has no stored column on SalesQuotation — it's derived
// server-side (register/report route) from whether a Sales Order has been
// raised against the quotation's number, and from its Valid Till date.
const CONVERSION_STATUS_COLORS = { Open: 'warning', 'Converted to Order': 'success', Expired: 'error' };

const currency = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '—');

const DEFAULT_FILTERS = { fromDate: '', toDate: '', customer: '', salesPerson: '', status: '' };

// Reports > Sales > Sales Quotation Register print layout — see ReportPrintable.jsx.
const PRINT_FILTER_LABELS = {
  fromDate: 'From Date', toDate: 'To Date', customer: 'Customer', salesPerson: 'Salesperson', status: 'Status',
};
const PRINT_DATE_FIELDS = ['fromDate', 'toDate'];

export default function SalesQuotationRegister() {
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
    ...QUOTATION_STATUS_OPTIONS.map((s) => ({ label: s, value: s })),
  ]), []);

  // Filter bar is a report toolbar, not a create/edit form — no Zod
  // validation or persisted mutation, same as EnquiryRegister.jsx.
  const methods = useForm({
    defaultValues: { fromDate: null, toDate: null, customer: '', salesPerson: '', status: '' },
  });
  const { handleSubmit, reset } = methods;

  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [viewRow, setViewRow] = useState(null);

  const { data, isLoading, isFetching } = useGetSalesQuotationRegisterReportQuery(appliedFilters);
  const baseTableRows = data?.rows || [];

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'quotationNo', headerName: 'Quotation No.', filter: 'text' },
    { field: 'quotationDate', headerName: 'Quotation Date', filter: 'dateRange', sortValue: (row) => (row.quotationDate ? new Date(row.quotationDate).getTime() : null), searchValue: (row) => formatDate(row.quotationDate) },
    { field: 'customer', headerName: 'Customer / Name', filter: 'text' },
    { field: 'salesPerson', headerName: 'Salesperson', filter: 'text' },
    { field: 'amount', headerName: 'Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.amount == null || row.amount === '' ? null : Number(row.amount)) },
    { field: 'expiryDate', headerName: 'Valid Till', filter: 'dateRange', sortValue: (row) => (row.expiryDate ? new Date(row.expiryDate).getTime() : null), searchValue: (row) => formatDate(row.expiryDate) },
    { field: 'status', headerName: 'Status', filter: 'select' },
    { field: 'conversionStatus', headerName: 'Conversion Status', filter: 'select' },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const stats = data?.stats || {};
  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  // Print: the FULL set of rows matching the applied Filters section
  // (baseTableRows = data.rows straight off the API), never `rows` (which is
  // additionally narrowed by the toolbar's quick search box and column
  // filter popover). Those two are on-screen/CSV conveniences for finding a
  // row quickly -- they shouldn't silently drop rows from what's meant to be
  // a full printed report. The report's own grand total (printTotals below)
  // already comes from `stats`, i.e. the same full applied-Filters dataset,
  // so it was never affected by search/column-filter either.
  const printFilters = useMemo(
    () => buildPrintFilters(appliedFilters, PRINT_FILTER_LABELS, PRINT_DATE_FIELDS),
    [appliedFilters],
  );
  const printTotals = useMemo(() => ({ amount: stats.totalQuotationAmount }), [stats]);

  const onView = handleSubmit((values) => {
    setAppliedFilters({
      fromDate: values.fromDate ? dayjs(values.fromDate).format('YYYY-MM-DD') : '',
      toDate: values.toDate ? dayjs(values.toDate).format('YYYY-MM-DD') : '',
      customer: values.customer || '',
      salesPerson: values.salesPerson || '',
      status: values.status || '',
    });
    setPage(0);
  });

  const onReset = () => {
    reset({ fromDate: null, toDate: null, customer: '', salesPerson: '', status: '' });
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  const statCards = [
    { icon: <RequestQuoteOutlinedIcon fontSize="small" />, label: 'Total Quotations', value: stats.totalQuotations ?? 0, color: 'primary' },
    { icon: <AccountBalanceWalletOutlinedIcon fontSize="small" />, label: 'Total Quotation Amount', value: currency(stats.totalQuotationAmount), color: 'success' },
    { icon: <ReceiptLongOutlinedIcon fontSize="small" />, label: 'Total Converted Amount', value: currency(stats.totalConvertedAmount), color: 'warning' },
    { icon: <TaskAltOutlinedIcon fontSize="small" />, label: 'Total Open Amount', value: currency(stats.totalOpenAmount), color: 'secondary' },
    { icon: <EventBusyOutlinedIcon fontSize="small" />, label: 'Expired Quotations', value: stats.expiredQuotations ?? 0, color: 'error' },
  ];

  // Export: current filtered rows to CSV — same client-side pattern used
  // elsewhere (EnquiryRegister.jsx).
  const EXPORT_COLUMNS = [
    ['quotationNo', 'Quotation No.'], ['quotationDate', 'Quotation Date'], ['customer', 'Customer / Name'],
    ['salesPerson', 'Salesperson'], ['amount', 'Amount'],
    ['expiryDate', 'Valid Till'], ['status', 'Status'], ['conversionStatus', 'Conversion Status'],
  ];
  const handleExport = () => {
    const header = EXPORT_COLUMNS.map(([, label]) => label).join(',');
    const lines = baseTableRows.map((r) => EXPORT_COLUMNS.map(([key]) => {
      let v = r[key];
      if (key.toLowerCase().includes('date')) v = formatDate(v);
      else if (key === 'amount') v = Number(v || 0).toFixed(2);
      else if (key === 'conversionStatus') v = v || '-';
      return `"${String(v ?? '').replace(/"/g, '""')}"`;
    }).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sales-quotation-register.csv';
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
                <FormSelect name="customer" label="Customer" options={customerOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="salesPerson" label="Salesperson" options={salespersonOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="status" label="Status" options={statusOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Stack direction="row" spacing={1.5} justifyContent="flex-end" flexWrap="wrap" useFlexGap sx={{ height: '100%', alignItems: 'flex-end' }}>
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
            title="Sales Quotation List"
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
                  title={row.quotationNo}
                  statusChip={<Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />}
                  fields={[
                    { label: 'Quotation Date', value: formatDate(row.quotationDate) },
                    { label: 'Customer / Name', value: row.customer || '—' },
                    { label: 'Salesperson', value: row.salesPerson || '—' },
                    { label: 'Amount', value: currency(row.amount) },
                    { label: 'Valid Till', value: formatDate(row.expiryDate) },
                    { label: 'Conversion Status', value: row.conversionStatus || '—' },
                  ]}
                  onView={() => setViewRow(row)}
                  onEdit={() => window.print()}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title="No sales quotations found for the selected criteria" message="Try adjusting your date range or filters" />
                )
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <SortableHeaderCell field="quotationNo" sort={table.sort} onSort={table.toggleSort}>Quotation No.</SortableHeaderCell>
                    <SortableHeaderCell field="quotationDate" sort={table.sort} onSort={table.toggleSort}>Quotation Date</SortableHeaderCell>
                    <SortableHeaderCell field="customer" sort={table.sort} onSort={table.toggleSort}>Customer / Name</SortableHeaderCell>
                    <SortableHeaderCell field="salesPerson" sort={table.sort} onSort={table.toggleSort}>Salesperson</SortableHeaderCell>
                    <SortableHeaderCell field="amount" sort={table.sort} onSort={table.toggleSort} align="right">Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="expiryDate" sort={table.sort} onSort={table.toggleSort}>Valid Till</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <SortableHeaderCell field="conversionStatus" sort={table.sort} onSort={table.toggleSort}>Conversion Status</SortableHeaderCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" fontWeight={700} color="primary.main">{row.quotationNo}</Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.quotationDate)}</TableCell>
                      <TableCell sx={{ minWidth: 160 }}>{row.customer || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.salesPerson || '—'}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.amount)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.expiryDate)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        {row.conversionStatus
                          ? <Chip size="small" label={row.conversionStatus} color={CONVERSION_STATUS_COLORS[row.conversionStatus] || 'default'} variant="outlined" />
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
                      <TableCell colSpan={9}>
                        {isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title="No sales quotations found for the selected criteria" message="Try adjusting your date range or filters" />
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
        <DialogTitle>Sales Quotation Details — {viewRow?.quotationNo}</DialogTitle>
        <DialogContent dividers>
          {viewRow && (
            <Stack spacing={1.25}>
              {[
                ['Quotation Date', formatDate(viewRow.quotationDate)],
                ['Customer / Name', viewRow.customer || '—'],
                ['Salesperson', viewRow.salesPerson || '—'],
                ['Amount', currency(viewRow.amount)],
                ['Valid Till', formatDate(viewRow.expiryDate)],
                ['Status', viewRow.status || '—'],
                ['Conversion Status', viewRow.conversionStatus || '—'],
                ['Converted Order No.', viewRow.convertedOrderNo || '—'],
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
        title="Sales Quotation Register"
        subtitle="View and manage all sales quotations."
        filters={printFilters}
        columns={tableColumns}
        rows={baseTableRows}
        totals={printTotals}
      />
    </Box>
  );
}
