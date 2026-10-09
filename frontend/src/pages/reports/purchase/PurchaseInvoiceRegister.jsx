import React, { useMemo, useState } from 'react';
import LoadingState from '../../../components/feedback/LoadingState';
import EmptyState from '../../../components/data-display/EmptyState';
import { useForm, FormProvider } from 'react-hook-form';
import {
  Box, Typography, Button, Card, CardContent, Stack, Grid, Chip, Table, TableBody, TableCell,
  TableHead, TableRow,
} from '@mui/material';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
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
import { useGetPurchaseInvoiceRegisterReportQuery } from '../../../features/purchase/purchaseInvoiceRegisterReportApi';
import { PAYMENT_STATUS_OPTIONS } from '../../../lib/validation/purchaseSchemas';
import useTableFeatures from '../../../components/data-display/useTableFeatures';
import TableToolbar from '../../../components/data-display/TableToolbar';
import SortableHeaderCell from '../../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import TableFilterPanel from '../../../components/data-display/TableFilterPanel';
import ReportPrintable from '../../../components/print/ReportPrintable';
import { buildPrintFilters } from '../../../components/print/reportPrint';

const PAGE_SIZE = 10;

// PurchaseInvoice.paymentStatus is the real stored field — "Partially
// Paid" is shortened to "Partial" for the chip label only, to match the
// compact style used elsewhere on this page.
const STATUS_COLORS = { Paid: 'success', Unpaid: 'error', 'Partially Paid': 'warning' };
const STATUS_LABELS = { 'Partially Paid': 'Partial' };

// Purchase Invoice has no source column of its own (unlike SalesOrder/
// SalesInvoice) — this list is filter-bar-only and currently a no-op on
// the backend, see the route comment in resources.js.
const SOURCE_OPTIONS = ['Direct Purchase', 'Rate Contract', 'Tender', 'Import'];

const currency = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '—');

const DEFAULT_FILTERS = { fromDate: '', toDate: '', supplier: '', status: '', source: '' };

// Reports > Purchase > Purchase Invoice Register print layout — see ReportPrintable.jsx.
const PRINT_FILTER_LABELS = {
  fromDate: 'From Date', toDate: 'To Date', supplier: 'Supplier', status: 'Status', source: 'Source',
};
const PRINT_DATE_FIELDS = ['fromDate', 'toDate'];

export default function PurchaseInvoiceRegister() {
  const isMobile = useIsMobileListView();

  const { data: suppliers } = supplierApi.useList();

  const supplierOptions = useMemo(() => ([
    { label: 'All Suppliers', value: '' },
    ...(suppliers || []).map((s) => ({ label: s.supplierName, value: s.supplierName })),
  ]), [suppliers]);

  const statusOptions = useMemo(() => ([
    { label: 'All Status', value: '' },
    ...PAYMENT_STATUS_OPTIONS.map((s) => ({ label: s, value: s })),
  ]), []);

  const sourceOptions = useMemo(() => ([
    { label: 'All Sources', value: '' },
    ...SOURCE_OPTIONS.map((s) => ({ label: s, value: s })),
  ]), []);

  // Filter bar is a report toolbar, not a create/edit form — no Zod
  // validation or persisted mutation, same as PurchaseOrderRegister.jsx.
  const methods = useForm({
    defaultValues: { fromDate: null, toDate: null, supplier: '', status: '', source: '' },
  });
  const { handleSubmit, reset } = methods;

  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const { data, isLoading, isFetching } = useGetPurchaseInvoiceRegisterReportQuery(appliedFilters);
  const baseTableRows = data?.rows || [];

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'invoiceNo', headerName: 'Inv. No.', filter: 'text' },
    { field: 'invoiceDate', headerName: 'Inv. Date', filter: 'dateRange', sortValue: (row) => (row.invoiceDate ? new Date(row.invoiceDate).getTime() : null), searchValue: (row) => formatDate(row.invoiceDate) },
    { field: 'supplierCode', headerName: 'Supplier Code', filter: 'text' },
    { field: 'supplier', headerName: 'Supplier Name', filter: 'text' },
    { field: 'poNo', headerName: 'PO No.', filter: 'text' },
    { field: 'subTotal', headerName: 'Sub Total (₹)', filter: 'numberRange', sortValue: (row) => (row.subTotal == null || row.subTotal === '' ? null : Number(row.subTotal)) },
    { field: 'discountAmount', headerName: 'Discount (₹)', filter: 'numberRange', sortValue: (row) => (row.discountAmount == null || row.discountAmount === '' ? null : Number(row.discountAmount)) },
    { field: 'taxAmount', headerName: 'Tax Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.taxAmount == null || row.taxAmount === '' ? null : Number(row.taxAmount)) },
    { field: 'netAmount', headerName: 'Net Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.netAmount == null || row.netAmount === '' ? null : Number(row.netAmount)) },
    { field: 'status', headerName: 'Status', filter: 'select' },
    { field: 'dueDate', headerName: 'Due Date', filter: 'dateRange', sortValue: (row) => (row.dueDate ? new Date(row.dueDate).getTime() : null), searchValue: (row) => formatDate(row.dueDate) },
    { field: 'daysPending', headerName: 'Days Pending', filter: 'text' },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const totals = data?.totals || {};
  const stats = data?.stats || {};
  const paymentBreakdown = data?.paymentBreakdown || {};
  const aging = data?.aging || {};
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
    { icon: <ReceiptLongOutlinedIcon fontSize="small" />, label: 'Total Invoices', value: stats.totalInvoices ?? 0, color: 'primary' },
    { icon: <ShoppingCartOutlinedIcon fontSize="small" />, label: 'Total Invoice Amount', value: currency(stats.totalInvoiceAmount), color: 'success' },
    { icon: <Inventory2OutlinedIcon fontSize="small" />, label: 'Total Tax Amount', value: currency(stats.totalTaxAmount), color: 'warning' },
    { icon: <PercentOutlinedIcon fontSize="small" />, label: 'Total Discount Amount', value: currency(stats.totalDiscountAmount), color: 'secondary' },
    { icon: <CurrencyRupeeOutlinedIcon fontSize="small" />, label: 'Total Net Amount', value: currency(stats.totalNetAmount), color: 'info' },
    { icon: <TrendingUpOutlinedIcon fontSize="small" />, label: 'Avg. Invoice Value', value: currency(stats.avgInvoiceValue), color: 'error' },
  ];

  const summaryStrip = [
    { label: 'Paid Amount', value: currency(paymentBreakdown.paidAmount), color: 'success.main' },
    { label: 'Unpaid Amount', value: currency(paymentBreakdown.unpaidAmount), color: 'error.main' },
    { label: 'Partial Paid Amount', value: currency(paymentBreakdown.partialAmount), color: 'warning.main' },
    { label: '0 - 30 Days', value: currency(aging.d0to30), color: 'text.primary' },
    { label: '31 - 60 Days', value: currency(aging.d31to60), color: 'text.primary' },
    { label: '61 - 90 Days', value: currency(aging.d61to90), color: 'text.primary' },
    { label: 'Above 90 Days', value: currency(aging.above90), color: 'text.primary' },
  ];

  // Export: current filtered rows to CSV — same client-side pattern used
  // elsewhere (PurchaseOrderRegister.jsx).
  const EXPORT_COLUMNS = [
    ['invoiceNo', 'Inv. No.'], ['invoiceDate', 'Inv. Date'], ['supplierCode', 'Supplier Code'], ['supplier', 'Supplier Name'],
    ['poNo', 'PO No.'], ['subTotal', 'Sub Total'], ['discountAmount', 'Discount'],
    ['taxAmount', 'Tax Amount'], ['netAmount', 'Net Amount'], ['status', 'Status'], ['dueDate', 'Due Date'], ['daysPending', 'Days Pending'],
  ];
  const handleExport = () => {
    const header = EXPORT_COLUMNS.map(([, label]) => label).join(',');
    const lines = baseTableRows.map((r) => EXPORT_COLUMNS.map(([key]) => {
      let v = r[key];
      if (key.toLowerCase().includes('date')) v = formatDate(v);
      else if (['subTotal', 'discountAmount', 'taxAmount', 'netAmount'].includes(key)) v = Number(v || 0).toFixed(2);
      return `"${String(v ?? '').replace(/"/g, '""')}"`;
    }).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'purchase-invoice-register.csv';
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

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ p: 0 }}>
          <TableToolbar
            title="Purchase Invoice List"
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
                  title={row.invoiceNo}
                  statusChip={<Chip size="small" label={STATUS_LABELS[row.status] || row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />}
                  fields={[
                    { label: 'Inv. Date', value: formatDate(row.invoiceDate) },
                    { label: 'Supplier Code', value: row.supplierCode },
                    { label: 'Supplier Name', value: row.supplier || '—' },
                    { label: 'PO No.', value: row.poNo || '—' },
                    { label: 'Sub Total', value: currency(row.subTotal) },
                    { label: 'Discount', value: currency(row.discountAmount) },
                    { label: 'Tax Amount', value: currency(row.taxAmount) },
                    { label: 'Net Amount', value: currency(row.netAmount) },
                    { label: 'Due Date', value: formatDate(row.dueDate) },
                    { label: 'Days Pending', value: row.daysPending ?? '—' },
                  ]}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<ShoppingCartOutlinedIcon sx={{ fontSize: 48 }} />} title="No purchase invoices found for the selected criteria" message="Try adjusting your date range or filters" />
                )
              )}
              {!isLoading && rows.length > 0 && (
                <Card variant="outlined" sx={{ mb: 1.5, bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Total</Typography>
                    <Stack spacing={0.75}>
                      {[
                        ['Sub Total', currency(totals.subTotal)], ['Discount', currency(totals.discountAmount)],
                        ['Tax Amount', currency(totals.taxAmount)], ['Net Amount', currency(totals.netAmount)],
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
                    <SortableHeaderCell field="invoiceNo" sort={table.sort} onSort={table.toggleSort}>Inv. No.</SortableHeaderCell>
                    <SortableHeaderCell field="invoiceDate" sort={table.sort} onSort={table.toggleSort}>Inv. Date</SortableHeaderCell>
                    <SortableHeaderCell field="supplierCode" sort={table.sort} onSort={table.toggleSort}>Supplier Code</SortableHeaderCell>
                    <SortableHeaderCell field="supplier" sort={table.sort} onSort={table.toggleSort}>Supplier Name</SortableHeaderCell>
                    <SortableHeaderCell field="poNo" sort={table.sort} onSort={table.toggleSort}>PO No.</SortableHeaderCell>
                    <SortableHeaderCell field="subTotal" sort={table.sort} onSort={table.toggleSort} align="right">Sub Total (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="discountAmount" sort={table.sort} onSort={table.toggleSort} align="right">Discount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="taxAmount" sort={table.sort} onSort={table.toggleSort} align="right">Tax Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="netAmount" sort={table.sort} onSort={table.toggleSort} align="right">Net Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <SortableHeaderCell field="dueDate" sort={table.sort} onSort={table.toggleSort}>Due Date</SortableHeaderCell>
                    <SortableHeaderCell field="daysPending" sort={table.sort} onSort={table.toggleSort} align="right">Days Pending</SortableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" fontWeight={700} color="primary.main">{row.invoiceNo}</Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.invoiceDate)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.supplierCode}</TableCell>
                      <TableCell sx={{ minWidth: 150 }}>{row.supplier || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.poNo || '—'}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.subTotal)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.discountAmount)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.taxAmount)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.netAmount)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={STATUS_LABELS[row.status] || row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.dueDate)}</TableCell>
                      <TableCell align="right">{row.daysPending ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={12}>
                        {isFetching ? (
                          <LoadingState label="Loading…" />
                        ) : (
                          <EmptyState icon={<ShoppingCartOutlinedIcon sx={{ fontSize: 48 }} />} title="No purchase invoices found for the selected criteria" message="Try adjusting your date range or filters" />
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && rows.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={5}><Typography fontWeight={700}>Total ({rows.length})</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.subTotal)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.discountAmount)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.taxAmount)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.netAmount)}</Typography></TableCell>
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

      {/* <Card variant="outlined">
        <CardContent>
          <Stack direction="row" flexWrap="wrap" useFlexGap spacing={4} rowGap={2}>
            {summaryStrip.map((s) => (
              <Box key={s.label}>
                <Typography variant="caption" color="text.secondary" display="block">{s.label}</Typography>
                <Typography variant="subtitle1" fontWeight={700} sx={{ color: s.color }}>{s.value}</Typography>
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>*/}

      <ReportPrintable
        title="Purchase Invoice Register"
        subtitle="All purchase invoices booked in the selected period."
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
