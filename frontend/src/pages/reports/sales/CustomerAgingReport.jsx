import React, { useMemo, useState } from 'react';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import LoadingState from '../../../components/feedback/LoadingState';
import EmptyState from '../../../components/data-display/EmptyState';
import { useForm, FormProvider } from 'react-hook-form';
import {
  Box, Typography, Button, Card, CardContent, Stack, Grid, Table, TableBody, TableCell,
  TableHead, TableRow,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import dayjs from 'dayjs';
import FormSelect from '../../../components/form/FormSelect';
import FormDatePicker from '../../../components/form/FormDatePicker';
import FormTextField from '../../../components/form/FormTextField';
import BusinessPartnerMultiSelect from '../../../components/common/BusinessPartnerMultiSelect';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import CompanyBadge from '../../../components/common/CompanyBadge';
import EntityListPagination from '../../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../../components/data-display/useIsMobileListView';
import { branchApi, customerApi, salesEmployeeApi } from '../../../features/resources';
import { useGetCustomerAgingReportQuery } from '../../../features/sales/customerAgingReportApi';
import useTableFeatures from '../../../components/data-display/useTableFeatures';
import TableToolbar from '../../../components/data-display/TableToolbar';
import SortableHeaderCell from '../../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import TableFilterPanel from '../../../components/data-display/TableFilterPanel';
import ReportPrintable from '../../../components/print/ReportPrintable';
import { buildPrintFilters } from '../../../components/print/reportPrint';

const PAGE_SIZE = 50;

const currency = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDate = (d) => (d ? dayjs(d).format('DD-MM-YYYY') : '—');

const INTERVAL_UNIT_OPTIONS = [{ label: 'Days', value: 'Days' }];
const DATE_TYPE_OPTIONS = [
  { label: 'Document Date', value: 'Document Date' },
  { label: 'Due Date', value: 'Due Date' },
];
const DEFAULT_BOUNDARIES = [30, 60, 90, 120, 150, 180, 210, 240];

const DEFAULT_FILTERS = {
  customers: [], branch: '', salesEmployee: '', agingDate: dayjs().format('YYYY-MM-DD'),
  dateType: 'Document Date', fromDate: '', toDate: '', boundaries: DEFAULT_BOUNDARIES.join(','),
};

// Reports > Sales > Customer Aging Report print layout — see ReportPrintable.jsx.
const PRINT_FILTER_LABELS = {
  customers: 'Business Partner (Customer)', branch: 'Branch', salesEmployee: 'Sales Employee',
  agingDate: 'Aging Date', dateType: 'Date Type', fromDate: 'From Date', toDate: 'To Date',
  boundaries: 'Interval Boundaries (Days)',
};
const PRINT_DATE_FIELDS = ['agingDate', 'fromDate', 'toDate'];

export default function CustomerAgingReport() {
  const isMobile = useIsMobileListView();

  const { data: branches } = branchApi.useList();
  const { data: customers, isLoading: customersLoading } = customerApi.useList();
  const { data: salesEmployees } = salesEmployeeApi.useList();

  const branchOptions = useMemo(() => ([
    { label: 'All Branches', value: '' },
    ...(branches || []).map((b) => ({ label: b.branchName, value: b.branchName })),
  ]), [branches]);

  const customerOptions = useMemo(() => (
    (customers || []).map((c) => ({ label: c.customerName, value: c.customerName }))
  ), [customers]);

  const salesEmployeeOptions = useMemo(() => ([
    { label: 'All Sales Employees', value: '' },
    ...(salesEmployees || []).map((e) => ({ label: e.employeeName, value: e.employeeName })),
  ]), [salesEmployees]);

  // Filter bar is a report toolbar, not a create/edit form — no Zod
  // validation or persisted mutation, same as other report pages. No
  // auto-run on load — the report only fires once "Apply Filters" is
  // clicked, same as every field on this page defaulting to "show nothing
  // until asked."
  const methods = useForm({
    defaultValues: {
      customers: [], branch: '', salesEmployee: '', agingDate: dayjs(), dateType: 'Document Date',
      fromDate: null, toDate: null, intervalUnit: 'Days',
      boundary1: 30, boundary2: 60, boundary3: 90, boundary4: 120, boundary5: 150, boundary6: 180, boundary7: 210, boundary8: 240,
    },
  });
  const { handleSubmit, reset } = methods;

  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const { data, isLoading, isFetching } = useGetCustomerAgingReportQuery(appliedFilters);
  const bucketDefs = data?.bucketDefs || [];
  const baseTableRows = data?.rows || [];

  // Column definitions drive the global search, the sort icons and the
  // filter popover — see components/data-display/useTableFeatures.js. The
  // aging-bucket columns are appended dynamically, one per boundary
  // actually returned by the backend, so re-running with a different
  // interval changes both the number and the width of these columns.
  const tableColumns = useMemo(() => ([
    { field: 'customerCode', headerName: 'Customer Code', filter: 'text' },
    { field: 'customerName', headerName: 'Customer Name', filter: 'text' },
    { field: 'salesExecutiveName', headerName: 'Sales Executive Name (BP)', filter: 'text' },
    { field: 'invoiceSalesPerson', headerName: 'Invoice Document (Sales Employee)', filter: 'text' },
    { field: 'branch', headerName: 'Branch', filter: 'text' },
    { field: 'openingBalance', headerName: 'Opening Balance', filter: 'numberRange', sortValue: (row) => Number(row.openingBalance || 0) },
    { field: 'debit', headerName: 'Debit Amount', filter: 'numberRange', sortValue: (row) => Number(row.debit || 0) },
    { field: 'collected', headerName: 'Collected Amount', filter: 'numberRange', sortValue: (row) => Number(row.collected || 0) },
    { field: 'creditAllDocs', headerName: 'Credit Amount (All Docs)', filter: 'numberRange', sortValue: (row) => Number(row.creditAllDocs || 0) },
    { field: 'closingBalance', headerName: 'Closing Balance', filter: 'numberRange', sortValue: (row) => Number(row.closingBalance || 0) },
    ...bucketDefs.map((b, i) => ({
      field: `bucket_${i}`, headerName: `${b.label} Days`, filter: 'numberRange',
      sortValue: (row) => Number(row.buckets?.[i] || 0),
    })),
  ]), [bucketDefs]);
  const rowsForTable = useMemo(() => baseTableRows.map((r) => {
    const flat = { ...r };
    (r.buckets || []).forEach((v, i) => { flat[`bucket_${i}`] = v; });
    return flat;
  }), [baseTableRows]);
  const table = useTableFeatures(rowsForTable, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const totals = data?.totals || {};
  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  const printFilters = useMemo(() => buildPrintFilters(
    { ...appliedFilters, customers: appliedFilters.customers?.length ? appliedFilters.customers.join(', ') : undefined },
    PRINT_FILTER_LABELS,
    PRINT_DATE_FIELDS,
  ), [appliedFilters]);

  const onApply = handleSubmit((values) => {
    const boundaries = [
      values.boundary1, values.boundary2, values.boundary3, values.boundary4,
      values.boundary5, values.boundary6, values.boundary7, values.boundary8,
    ].map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0);
    setAppliedFilters({
      customers: values.customers || [],
      branch: values.branch || '',
      salesEmployee: values.salesEmployee || '',
      agingDate: values.agingDate ? dayjs(values.agingDate).format('YYYY-MM-DD') : '',
      dateType: values.dateType || 'Document Date',
      fromDate: values.fromDate ? dayjs(values.fromDate).format('YYYY-MM-DD') : '',
      toDate: values.toDate ? dayjs(values.toDate).format('YYYY-MM-DD') : '',
      boundaries: boundaries.length ? boundaries.join(',') : DEFAULT_BOUNDARIES.join(','),
    });
    setPage(0);
  });

  const onReset = () => {
    reset({
      customers: [], branch: '', salesEmployee: '', agingDate: dayjs(), dateType: 'Document Date',
      fromDate: null, toDate: null, intervalUnit: 'Days',
      boundary1: 30, boundary2: 60, boundary3: 90, boundary4: 120, boundary5: 150, boundary6: 180, boundary7: 210, boundary8: 240,
    });
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  // Export: current filtered/sorted rows to CSV, same client-side pattern
  // used elsewhere (CustomerOutstanding.jsx).
  const exportColumns = useMemo(() => ([
    ['customerCode', 'Customer Code'], ['customerName', 'Customer Name'], ['salesExecutiveName', 'Sales Executive Name (BP)'],
    ['invoiceSalesPerson', 'Invoice Document (Sales Employee)'], ['branch', 'Branch'], ['openingBalance', 'Opening Balance'],
    ['debit', 'Debit Amount'], ['collected', 'Collected Amount'], ['creditAllDocs', 'Credit Amount (All Docs)'],
    ['closingBalance', 'Closing Balance'],
    ...bucketDefs.map((b, i) => [`bucket_${i}`, `${b.label} Days`]),
  ]), [bucketDefs]);
  const handleExport = () => {
    const header = exportColumns.map(([, label]) => label).join(',');
    const lines = rowsForTable.map((r) => exportColumns.map(([key]) => `"${String(r[key] ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer-aging-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print Preview / PDF: this app has no dedicated PDF-generation library —
  // every other report's "Print" is the browser's own print dialog via
  // ReportPrintable (see that file), which is also how a user gets a PDF
  // (Chromium/Edge's print dialog offers "Save as PDF" as a printer
  // target). Rather than add a new client-side PDF dependency for this one
  // page, both buttons open that same dialog; "PDF" is kept as its own
  // labelled button, matching the reference screenshot, rather than folded
  // into "Print Preview".
  const handlePrint = () => window.print();

  const ready = !isLoading;

  return (
    <Box>
      <EntityHeaderCard
        icon={<HourglassBottomOutlinedIcon />}
        title="Customer Aging Report"
        subtitle="Receivables aging by customer and invoice sales employee, with configurable aging buckets."
        rightContent={<CompanyBadge />}
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <FormProvider {...methods}>
            <Grid container spacing={2} alignItems="flex-start">
              <Grid item xs={12} sm={6} md={4}>
                <BusinessPartnerMultiSelect name="customers" label="Business Partner (Customer)" options={customerOptions} loading={customersLoading} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="branch" label="Branch" options={branchOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="salesEmployee" label="Sales Employee" options={salesEmployeeOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormDatePicker name="agingDate" label="Aging Date" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="intervalUnit" label="Interval" options={INTERVAL_UNIT_OPTIONS} />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Interval Boundaries (Days)</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <Box key={n} sx={{ width: 84 }}>
                      <FormTextField name={`boundary${n}`} label={`B${n}`} type="number" reserveHelperSpace={false} />
                    </Box>
                  ))}
                </Stack>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="dateType" label="Date Type" options={DATE_TYPE_OPTIONS} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormDatePicker name="fromDate" label="From Date" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormDatePicker name="toDate" label="To Date" />
              </Grid>
              <Grid item xs={12} sm={6} md={6}>
                <Stack direction="row" spacing={1.5} justifyContent="flex-end" flexWrap="wrap" useFlexGap sx={{ height: '100%', alignItems: 'flex-end' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<SearchIcon />}
                    onClick={onApply}
                    disabled={isFetching}
                    sx={{ height: 40, minWidth: 140, whiteSpace: 'nowrap' }}
                  >
                    Apply Filters
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
            title="Customer Aging Report"
            searchPlaceholder="Search..."
            table={table}
            resultCount={table.rows.length}
            totalCount={table.totalCount}
            rightContent={(
              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                <Button variant="outlined" color="inherit" size="small" startIcon={<FileDownloadOutlinedIcon />} onClick={handleExport}>
                  Export to Excel
                </Button>
                <Button variant="outlined" color="inherit" size="small" startIcon={<PrintOutlinedIcon />} onClick={handlePrint}>
                  Print Preview
                </Button>
                <Button variant="outlined" color="inherit" size="small" startIcon={<PictureAsPdfOutlinedIcon />} onClick={handlePrint}>
                  PDF
                </Button>
              </Stack>
            )}
          />
          <TableFilterPanel table={table} />

          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {ready && pagedRows.map((row, i) => (
                <MobileRecordCard
                  key={`${row.customerCode}-${row.invoiceSalesPerson}-${i}`}
                  title={row.customerName}
                  statusChip={<Typography variant="caption" fontWeight={700} color="text.secondary">{row.invoiceSalesPerson}</Typography>}
                  fields={[
                    { label: 'Customer Code', value: row.customerCode },
                    { label: 'Sales Executive Name (BP)', value: row.salesExecutiveName },
                    { label: 'Branch', value: row.branch },
                    { label: 'Opening Balance', value: currency(row.openingBalance) },
                    { label: 'Debit Amount', value: currency(row.debit) },
                    { label: 'Collected Amount', value: currency(row.collected) },
                    { label: 'Credit Amount (All Docs)', value: currency(row.creditAllDocs) },
                    { label: 'Closing Balance', value: currency(row.closingBalance) },
                    ...bucketDefs.map((b, idx) => ({ label: `${b.label} Days`, value: currency(row.buckets?.[idx]) })),
                  ]}
                />
              ))}
              {ready && rows.length === 0 && (
                isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<HourglassBottomOutlinedIcon sx={{ fontSize: 48 }} />} title="No aging data found" message="Apply filters and click Apply Filters to run the report" />
                )
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width={40}>#</TableCell>
                    <SortableHeaderCell field="customerCode" sort={table.sort} onSort={table.toggleSort}>Customer Code</SortableHeaderCell>
                    <SortableHeaderCell field="customerName" sort={table.sort} onSort={table.toggleSort}>Customer Name</SortableHeaderCell>
                    <SortableHeaderCell field="salesExecutiveName" sort={table.sort} onSort={table.toggleSort}>Sales Executive Name (BP)</SortableHeaderCell>
                    <SortableHeaderCell field="invoiceSalesPerson" sort={table.sort} onSort={table.toggleSort}>Invoice Document (Sales Employee)</SortableHeaderCell>
                    <SortableHeaderCell field="branch" sort={table.sort} onSort={table.toggleSort}>Branch</SortableHeaderCell>
                    <SortableHeaderCell field="openingBalance" sort={table.sort} onSort={table.toggleSort} align="right">Opening Balance</SortableHeaderCell>
                    <SortableHeaderCell field="debit" sort={table.sort} onSort={table.toggleSort} align="right">Debit Amount</SortableHeaderCell>
                    <SortableHeaderCell field="collected" sort={table.sort} onSort={table.toggleSort} align="right">Collected Amount</SortableHeaderCell>
                    <SortableHeaderCell field="creditAllDocs" sort={table.sort} onSort={table.toggleSort} align="right">Credit Amount (All Docs)</SortableHeaderCell>
                    <SortableHeaderCell field="closingBalance" sort={table.sort} onSort={table.toggleSort} align="right">Closing Balance</SortableHeaderCell>
                    {bucketDefs.map((b, i) => (
                      <SortableHeaderCell key={b.key} field={`bucket_${i}`} sort={table.sort} onSort={table.toggleSort} align="right">{b.label} Days</SortableHeaderCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ready && pagedRows.map((row, i) => (
                    <TableRow key={`${row.customerCode}-${row.invoiceSalesPerson}-${i}`} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" fontWeight={700} color="primary.main">{row.customerCode}</Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 150, whiteSpace: 'nowrap' }}>{row.customerName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.salesExecutiveName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.invoiceSalesPerson}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.branch}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.openingBalance)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap', color: 'success.main' }}>{currency(row.debit)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.collected)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap', color: 'error.main' }}>{currency(row.creditAllDocs)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.closingBalance)}</TableCell>
                      {bucketDefs.map((b, idx) => (
                        <TableCell key={b.key} align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.buckets?.[idx])}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {ready && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11 + bucketDefs.length}>
                        {isFetching ? (
                          <LoadingState label="Loading…" />
                        ) : (
                          <EmptyState icon={<HourglassBottomOutlinedIcon sx={{ fontSize: 48 }} />} title="No aging data found" message="Apply filters and click Apply Filters to run the report" />
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                  {ready && rows.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={6}><Typography fontWeight={700}>Total</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.openingBalance)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.debit)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.collected)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.creditAllDocs)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.closingBalance)}</Typography></TableCell>
                      {bucketDefs.map((b, idx) => (
                        <TableCell key={b.key} align="right"><Typography fontWeight={700}>{currency(totals.buckets?.[idx])}</Typography></TableCell>
                      ))}
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
        title="Customer Aging Report"
        subtitle="Receivables aging by customer and invoice sales employee."
        filters={printFilters}
        columns={tableColumns}
        // Print uses the base (unsearched/unfiltered-by-popover) rows so it
        // always reflects the full Filters-section result, not whatever the
        // quick search box or column filter popover currently narrows to.
        rows={rowsForTable}
        totals={{ ...totals, ...bucketDefs.reduce((acc, b, i) => ({ ...acc, [`bucket_${i}`]: totals.buckets?.[i] }), {}) }}
        orientation="landscape"
      />
    </Box>
  );
}
