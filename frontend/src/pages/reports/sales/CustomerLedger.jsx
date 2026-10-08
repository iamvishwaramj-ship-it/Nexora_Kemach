import React, { useMemo, useState } from 'react';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import LoadingState from '../../../components/feedback/LoadingState';
import EmptyState from '../../../components/data-display/EmptyState';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import {
  Box, Typography, Button, Card, CardContent, Stack, Grid, Table, TableBody, TableCell,
  TableHead, TableRow, Chip, Checkbox, FormControlLabel,
} from '@mui/material';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import dayjs from 'dayjs';
import FormDatePicker from '../../../components/form/FormDatePicker';
import PartyCodeSelect, { buildPartyCodeOptions } from '../../../components/form/PartyCodeSelect';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import CompanyBadge from '../../../components/common/CompanyBadge';
import EntityListPagination from '../../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../../components/data-display/useIsMobileListView';
import { customerApi } from '../../../features/resources';
import { useGetCustomerLedgerReportQuery } from '../../../features/sales/customerLedgerReportApi';
import useTableFeatures from '../../../components/data-display/useTableFeatures';
import TableToolbar from '../../../components/data-display/TableToolbar';
import SortableHeaderCell from '../../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import TableFilterPanel from '../../../components/data-display/TableFilterPanel';
import ReportPrintable from '../../../components/print/ReportPrintable';
import { buildPrintFilters } from '../../../components/print/reportPrint';

const PAGE_SIZE = 10;

const currency = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '—');

const RECONCILED_COLORS = { true: 'success', false: 'warning' };

const DEFAULT_FILTERS = { customer: '', fromDate: '', toDate: '', reconciled: '', unreconciled: '' };

// Reports > Sales > Customer Ledger print layout — see ReportPrintable.jsx.
const PRINT_FILTER_LABELS = { customer: 'Customer', fromDate: 'From Date', toDate: 'To Date' };
const PRINT_DATE_FIELDS = ['fromDate', 'toDate'];

export default function CustomerLedger() {
  const isMobile = useIsMobileListView();

  const { data: customers } = customerApi.useList();
  // Code + Name, same picker used on every sales document's own Customer
  // field (see SalesInvoice.jsx) — was previously a plain name-only list
  // (`{ label: c.customerName, value: c.customerName }`), which is why the
  // CFL only ever showed the name and typing a customer CODE matched
  // nothing: FormSelect's default filtering only ever looks at `label`, and
  // the label held no code at all. buildPartyCodeOptions/PartyCodeSelect
  // below show a two-column Code | Name list and filter against both (see
  // codeNameListParts.jsx's codeNameOptionFilter) while the report itself
  // keeps filtering by customerName under the hood — value stays the name,
  // exactly as GET /receivables/customer-ledger/report expects.
  const customerOptions = useMemo(
    () => buildPartyCodeOptions(customers, 'customerCode', 'customerName'),
    [customers]
  );

  // Filter bar is a report toolbar, not a create/edit form — no Zod
  // validation or persisted mutation, same as other report pages. Customer
  // is required to run the report at all (there's no per-customer opening
  // balance to show otherwise), so the query only fires once one is chosen.
  const methods = useForm({
    defaultValues: { customer: '', fromDate: null, toDate: null, reconciled: false, unreconciled: false },
  });
  const { handleSubmit, reset, control, watch } = methods;
  const selectedCustomer = watch('customer');

  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const { data, isLoading, isFetching } = useGetCustomerLedgerReportQuery(appliedFilters, { skip: !appliedFilters.customer });
  const baseTableRows = data?.rows || [];

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'date', headerName: 'Date', filter: 'dateRange', sortValue: (row) => (row.date ? new Date(row.date).getTime() : null), searchValue: (row) => formatDate(row.date) },
    { field: 'docType', headerName: 'Document Type', filter: 'text' },
    { field: 'docNo', headerName: 'Document No.', filter: 'text' },
    { field: 'description', headerName: 'Description', filter: 'text' },
    { field: 'dueDate', headerName: 'Due Date', filter: 'dateRange', sortValue: (row) => (row.dueDate ? new Date(row.dueDate).getTime() : null), searchValue: (row) => formatDate(row.dueDate) },
    { field: 'debit', headerName: 'Debit (₹)', filter: 'numberRange', sortValue: (row) => Number(row.debit || 0) },
    { field: 'credit', headerName: 'Credit (₹)', filter: 'numberRange', sortValue: (row) => Number(row.credit || 0) },
    { field: 'balance', headerName: 'Balance (₹)', filter: 'numberRange', sortValue: (row) => Number(row.balance || 0) },
    { field: 'reconciled', headerName: 'Reconciled', filter: 'text', searchValue: (row) => (row.reconciled ? 'Reconciled' : 'Unreconciled') },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const totals = data?.totals || {};
  const openingBalance = data?.openingBalance ?? 0;
  const closingBalance = data?.closingBalance ?? 0;
  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  // Print: full filtered/sorted rows + the report's own grand totals, fed
  // into the shared ReportPrintable layout — see components/print/ReportPrintable.jsx.
  const printFilters = useMemo(
    () => buildPrintFilters(appliedFilters, PRINT_FILTER_LABELS, PRINT_DATE_FIELDS),
    [appliedFilters],
  );

  const onView = handleSubmit((values) => {
    setAppliedFilters({
      customer: values.customer || '',
      fromDate: values.fromDate ? dayjs(values.fromDate).format('YYYY-MM-DD') : '',
      toDate: values.toDate ? dayjs(values.toDate).format('YYYY-MM-DD') : '',
      reconciled: values.reconciled ? 'true' : '',
      unreconciled: values.unreconciled ? 'true' : '',
    });
    setPage(0);
  });

  const onReset = () => {
    reset({ customer: '', fromDate: null, toDate: null, reconciled: false, unreconciled: false });
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  // Export: current per-transaction rows to CSV, same client-side pattern
  // used elsewhere (CustomerWiseSales.jsx).
  const EXPORT_COLUMNS = [
    ['date', 'Date'], ['docType', 'Document Type'], ['docNo', 'Document No.'], ['description', 'Description'],
    ['dueDate', 'Due Date'], ['debit', 'Debit'], ['credit', 'Credit'], ['balance', 'Balance'], ['reconciled', 'Reconciled'],
  ];
  const handleExport = () => {
    const header = EXPORT_COLUMNS.map(([, label]) => label).join(',');
    const lines = baseTableRows.map((r) => EXPORT_COLUMNS.map(([key]) => {
      let v = r[key];
      if (key === 'date' || key === 'dueDate') v = formatDate(r[key]);
      else if (key === 'reconciled') v = r.reconciled ? 'Reconciled' : 'Unreconciled';
      return `"${String(v ?? '').replace(/"/g, '""')}"`;
    }).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer-ledger.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<AccountBalanceOutlinedIcon />}
        title="Customer Ledger"
        subtitle="Every receivable-relevant transaction for a customer, chronologically, with a running balance."
        rightContent={<CompanyBadge />}
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Filters</Typography>
          <FormProvider {...methods}>
            <Grid container spacing={2} alignItems="flex-start">
              <Grid item xs={12} sm={6} md={3}>
                <PartyCodeSelect name="customer" label="Customer *" placeholder="Select customer" options={customerOptions} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormDatePicker name="fromDate" label="From Date" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormDatePicker name="toDate" label="To Date" />
              </Grid>
              <Grid item xs={12} sm={6} md={2.5}>
                <Stack direction="row" spacing={0} alignItems="center" sx={{ height: 40 }}>
                  <Controller
                    name="reconciled"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={<Checkbox {...field} checked={!!field.value} size="small" />}
                        label="Reconciled"
                      />
                    )}
                  />
                  <Controller
                    name="unreconciled"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={<Checkbox {...field} checked={!!field.value} size="small" />}
                        label="Unreconciled"
                      />
                    )}
                  />
                </Stack>
              </Grid>
              <Grid item xs={12}>
                <Stack direction="row" spacing={1.5} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<SearchIcon />}
                    onClick={onView}
                    disabled={isFetching || !selectedCustomer}
                    sx={{ height: 40, minWidth: 120, whiteSpace: 'nowrap' }}
                  >
                    View
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
            title="Customer Ledger"
            searchPlaceholder="Search..."
            table={table}
            resultCount={table.rows.length}
            totalCount={table.totalCount}
            rightContent={(
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                {!!appliedFilters.customer && (
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                    Opening Balance: <strong>{currency(openingBalance)}</strong>
                  </Typography>
                )}
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

          {!appliedFilters.customer ? (
            <Box sx={{ px: 2, py: 4 }}>
              <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title="Select a customer" message="Choose a customer above and click View to see their ledger" />
            </Box>
          ) : isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {!isLoading && pagedRows.map((row, i) => (
                <MobileRecordCard
                  key={`${row.docType}-${row.docNo}-${i}`}
                  title={row.docNo}
                  statusChip={<Chip size="small" label={row.reconciled ? 'Reconciled' : 'Unreconciled'} color={RECONCILED_COLORS[row.reconciled]} variant="outlined" />}
                  fields={[
                    { label: 'Date', value: formatDate(row.date) },
                    { label: 'Document Type', value: row.docType },
                    { label: 'Description', value: row.description || '—' },
                    { label: 'Due Date', value: formatDate(row.dueDate) },
                    { label: 'Debit', value: row.debit ? currency(row.debit) : '—' },
                    { label: 'Credit', value: row.credit ? currency(row.credit) : '—' },
                    { label: 'Balance', value: currency(row.balance) },
                  ]}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title="No transactions found" message="Try adjusting your date range or filters" />
                )
              )}
              {!isLoading && rows.length > 0 && (
                <Card variant="outlined" sx={{ mb: 1.5, bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Total</Typography>
                    <Stack spacing={0.75}>
                      {[
                        ['Opening Balance', currency(openingBalance)], ['Total Debit', currency(totals.debit)],
                        ['Total Credit', currency(totals.credit)], ['Closing Balance', currency(closingBalance)],
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
                    <SortableHeaderCell field="date" sort={table.sort} onSort={table.toggleSort}>Date</SortableHeaderCell>
                    <SortableHeaderCell field="docType" sort={table.sort} onSort={table.toggleSort}>Document Type</SortableHeaderCell>
                    <SortableHeaderCell field="docNo" sort={table.sort} onSort={table.toggleSort}>Document No.</SortableHeaderCell>
                    <SortableHeaderCell field="description" sort={table.sort} onSort={table.toggleSort}>Description</SortableHeaderCell>
                    <SortableHeaderCell field="dueDate" sort={table.sort} onSort={table.toggleSort}>Due Date</SortableHeaderCell>
                    <SortableHeaderCell field="debit" sort={table.sort} onSort={table.toggleSort} align="right">Debit (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="credit" sort={table.sort} onSort={table.toggleSort} align="right">Credit (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="balance" sort={table.sort} onSort={table.toggleSort} align="right">Balance (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="reconciled" sort={table.sort} onSort={table.toggleSort}>Reconciled</SortableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={7}><Typography variant="body2" fontWeight={700}>Opening Balance</Typography></TableCell>
                    <TableCell align="right"><Typography variant="body2" fontWeight={700}>{currency(openingBalance)}</Typography></TableCell>
                    <TableCell />
                  </TableRow>
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={`${row.docType}-${row.docNo}-${i}`} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.date)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.docType}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" fontWeight={700} color="primary.main">{row.docNo}</Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 160 }}>{row.description || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.dueDate)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{row.debit ? currency(row.debit) : '—'}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{row.credit ? currency(row.credit) : '—'}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.balance)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={row.reconciled ? 'Reconciled' : 'Unreconciled'} color={RECONCILED_COLORS[row.reconciled]} variant="outlined" />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9}>
                        {isFetching ? (
                          <LoadingState label="Loading…" />
                        ) : (
                          <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title="No transactions found" message="Try adjusting your date range or filters" />
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && (
                    <TableRow>
                      <TableCell colSpan={5}><Typography fontWeight={700}>Closing Balance</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.debit)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.credit)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(closingBalance)}</Typography></TableCell>
                      <TableCell>—</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollableTableContainer>
          )}

          {!!appliedFilters.customer && (
            <EntityListPagination total={rows.length} page={page} onChange={setPage} pageSize={pageSize} onPageSizeChange={(v) => { setPageSize(v); setPage(0); }} />
          )}
        </CardContent>
      </Card>

      <ReportPrintable
        title="Customer Ledger"
        subtitle={`Business Partner Ledger for ${appliedFilters.customer || '—'}`}
        filters={printFilters}
        columns={tableColumns}
        // Print uses the base (unsearched/unfiltered-by-popover) rows so it
        // always reflects the full Filters-section result, not whatever the
        // quick search box or column filter popover currently narrows to.
        rows={baseTableRows}
        totals={totals}
      />
    </Box>
  );
}
