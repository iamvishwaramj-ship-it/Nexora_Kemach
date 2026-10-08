import React, { useEffect, useMemo, useState } from 'react';
import PercentOutlinedIcon from '@mui/icons-material/PercentOutlined';
// Header icon only — distinct per tax report so the three pages (and their
// browser tabs/breadcrumbs) are visually tellable apart at a glance; the
// EmptyState below still uses PercentOutlinedIcon as the shared "Tax"
// domain icon, same convention as every other report family in this app
// (e.g. Inventory reports all share Inventory2OutlinedIcon there). Matches
// the AccountBalanceWallet icon now used for this report's own nav/sidebar
// entry (see router/navConfig.js + iconMap.js) — same icon, outlined
// variant.
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import { useForm, FormProvider } from 'react-hook-form';
import {
  Box, Typography, Button, Card, CardContent, Stack, Grid, Table, TableBody, TableCell,
  TableHead, TableRow, Chip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import { createFilterOptions } from '@mui/material/Autocomplete';
import dayjs from 'dayjs';
import FormSelect from '../../../components/form/FormSelect';
import FormDatePicker from '../../../components/form/FormDatePicker';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import CompanyBadge from '../../../components/common/CompanyBadge';
import EntityListPagination from '../../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../../components/data-display/useIsMobileListView';
import LoadingState from '../../../components/feedback/LoadingState';
import EmptyState from '../../../components/data-display/EmptyState';
import { useNotify } from '../../../components/feedback/NotificationProvider';
import {
  branchApi, customerApi, supplierApi, taxCodeApi,
} from '../../../features/resources';
import { useGetPayableTaxReportQuery } from '../../../features/sales/payableTaxReportApi';
import useTableFeatures from '../../../components/data-display/useTableFeatures';
import TableToolbar from '../../../components/data-display/TableToolbar';
import SortableHeaderCell from '../../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import TableFilterPanel from '../../../components/data-display/TableFilterPanel';
import ReportPrintable from '../../../components/print/ReportPrintable';
import { buildPrintFilters } from '../../../components/print/reportPrint';

// Payable Tax Report — net GST payable = Output Tax (Sales-side documents)
// less Input Tax (Purchase-side documents). Reuses the same 7 source
// screens as Input Tax Report / Output Tax Report (see backend/src/routes/
// resources.js's buildPayableTaxReportRows), rolled up to whichever level
// "View By" picks: Month Wise (one row per calendar month — the default),
// All (one overall row), Customer Wise (one row per party — a Customer
// only ever carries Output Tax, a Vendor only ever carries Input Tax, so
// this is Customer/Vendor-wise together) or Invoice Wise (one row per
// source document). Balance is always Output − Input: positive means net
// GST payable, negative means a net input credit carried forward.

const PAGE_SIZE = 50;

const currency = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDate = (d) => (d ? dayjs(d).format('DD-MM-YYYY') : '—');

const GROUP_BY_OPTIONS = [
  { label: 'Month Wise', value: 'month' },
  { label: 'Invoice Wise', value: 'invoice' },
  { label: 'Customer Wise', value: 'party' },
  { label: 'All', value: 'all' },
];

const DOCUMENT_TYPE_OPTIONS = [
  { label: 'All Document Types', value: '' },
  { label: 'Sales Invoice', value: 'Sales Invoice' },
  { label: 'Sales Return', value: 'Sales Return' },
  { label: 'Sales Credit Memo', value: 'Sales Credit Memo' },
  { label: 'Purchase Invoice', value: 'Purchase Invoice' },
  { label: 'Purchase Return', value: 'Purchase Return' },
  { label: 'Purchase Credit Memo', value: 'Purchase Credit Memo' },
  { label: 'GRN', value: 'GRN' },
];

// Tax Type lives on the TaxCode record itself (Company Setup > Tax Code —
// see TAX_TYPE_OPTIONS there), not on the line, so this filters to lines
// whose resolved TaxCode has this exact tax type. A hand-typed/legacy line
// with no TaxCode has no Tax Type at all and is excluded whenever this
// filter is set to anything but "All".
const TAX_TYPE_OPTIONS = [
  { label: 'All Tax Types', value: '' },
  { label: 'GST', value: 'GST' },
  { label: 'IGST', value: 'IGST' },
  { label: 'GST+TCS', value: 'GST+TCS' },
  { label: 'IGST+TCS', value: 'IGST+TCS' },
];

const currencyCol = (field, headerName) => ({
  field, headerName, filter: 'numberRange', align: 'right', sortValue: (r) => Number(r[field] || 0), printValue: (r) => currency(r[field]),
});

// Column set differs by "View By" mode — each mode's rows carry a
// different shape (see buildPayableTaxReportRows), so the table itself
// switches columns rather than padding narrower rows with blank cells.
const INVOICE_COLUMNS = [
  { field: 'documentType', headerName: 'Document Type', filter: 'select' },
  {
    field: 'postingDate',
    headerName: 'Posting Date',
    filter: 'text',
    // value/searchValue both use the displayed DD-MM-YYYY text, not the raw
    // ISO timestamp — the per-column filter panel matches against `value`
    // (see useTableFeatures' getRaw), so without this a typed date like
    // "26-09-2026" would never match the underlying ISO string and the
    // filter would silently do nothing.
    value: (r) => formatDate(r.postingDate),
    searchValue: (r) => formatDate(r.postingDate),
    sortValue: (r) => (r.postingDate ? new Date(r.postingDate).getTime() : 0),
  },
  { field: 'documentNo', headerName: 'Document No.', filter: 'text' },
  { field: 'partyCode', headerName: 'Customer/Vendor Code', filter: 'text' },
  { field: 'partyName', headerName: 'Customer/Vendor Name', filter: 'text' },
  currencyCol('inputTax', 'Input Tax'),
  currencyCol('outputTax', 'Output Tax'),
  currencyCol('balance', 'Balance'),
];

const PARTY_COLUMNS = [
  { field: 'partyCode', headerName: 'Customer/Vendor Code', filter: 'text' },
  { field: 'partyName', headerName: 'Customer/Vendor Name', filter: 'text' },
  currencyCol('inputTax', 'Input Tax'),
  currencyCol('outputTax', 'Output Tax'),
  currencyCol('balance', 'Balance'),
];

const ALL_COLUMNS = [
  { field: 'label', headerName: 'Summary', filter: false, sortable: false },
  currencyCol('inputTax', 'Input Tax'),
  currencyCol('outputTax', 'Output Tax'),
  currencyCol('balance', 'Balance'),
];

const MONTH_COLUMNS = [
  { field: 'month', headerName: 'Month', filter: 'text' },
  currencyCol('inputTax', 'Input Tax'),
  currencyCol('outputTax', 'Output Tax'),
  currencyCol('balance', 'Balance'),
];

const COLUMNS_BY_MODE = {
  invoice: INVOICE_COLUMNS, party: PARTY_COLUMNS, all: ALL_COLUMNS, month: MONTH_COLUMNS,
};
const LEADING_COLSPAN_BY_MODE = {
  invoice: 5, party: 2, all: 1, month: 1,
};

// Lets the Customer/Vendor Name filter also be found by typing its code —
// the option's own label already shows "Name (Code) (Customer/Vendor)"
// (see partyOptions below), so matching against the label alone covers both.
const partyFilterOptions = createFilterOptions({
  stringify: (option) => option.label,
});

const emptyDefaultValues = {
  fromDate: null, toDate: null, branch: '', documentType: '', party: '', taxRate: '', taxType: '', groupBy: 'month',
};
const emptyAppliedFilters = {
  fromDate: '', toDate: '', branch: '', documentType: '', party: '', taxRate: '', taxType: '', groupBy: 'month',
};

export default function PayableTaxReport() {
  const isMobile = useIsMobileListView();
  const notify = useNotify();

  const { data: branches } = branchApi.useList();
  // Payable Tax Report spans both sides (Output on Sales docs, Input on
  // Purchase docs), so its own party filter offers both Customers and
  // Vendors together — unlike Input Tax Report (Vendors only) and Output
  // Tax Report (Customers only), which are each scoped to one side.
  const { data: customers } = customerApi.useList();
  const { data: suppliers } = supplierApi.useList();
  const { data: taxCodes } = taxCodeApi.useList();

  const branchOptions = useMemo(() => ([
    { label: 'All Branches', value: '' },
    ...(branches || []).map((b) => ({ label: b.branchName, value: b.branchName })),
  ]), [branches]);
  const taxRateOptions = useMemo(() => {
    const rates = new Set(
      (taxCodes || [])
        .filter((t) => t.status === 'Active')
        .map((t) => Number(t.taxRate ?? 0)),
    );
    return [
      { label: 'All Rates', value: '' },
      ...[...rates].sort((a, b) => a - b).map((r) => ({ label: `${r}%`, value: r })),
    ];
  }, [taxCodes]);
  const partyOptions = useMemo(() => {
    // Deduped by name+side, not name alone — a Customer and a Vendor that
    // happen to share the same name are two distinct, separately
    // selectable options (each still just filters by that name string,
    // same as every other Tax Report's own party filter).
    const seen = new Set();
    const opts = [];
    (customers || []).forEach((c) => {
      const name = c.customerName;
      const key = `Customer:${name}`;
      if (!name || seen.has(key)) return;
      seen.add(key);
      const code = c.customerCode || '';
      // Code shown in the option's own label (not just matched on while
      // typing) — two parties with a similar name are otherwise
      // indistinguishable in the dropdown.
      opts.push({ label: code ? `${name} (${code}) (Customer)` : `${name} (Customer)`, value: name, code });
    });
    (suppliers || []).forEach((s) => {
      const name = s.supplierName;
      const key = `Vendor:${name}`;
      if (!name || seen.has(key)) return;
      seen.add(key);
      const code = s.supplierCode || '';
      opts.push({ label: code ? `${name} (${code}) (Vendor)` : `${name} (Vendor)`, value: name, code });
    });
    opts.sort((a, b) => a.label.localeCompare(b.label));
    return [{ label: 'All Customers/Vendors', value: '' }, ...opts];
  }, [customers, suppliers]);

  const methods = useForm({ defaultValues: emptyDefaultValues });
  const { handleSubmit, reset } = methods;

  const [appliedFilters, setAppliedFilters] = useState(emptyAppliedFilters);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // Date Range is required — no query fires (and nothing renders but the
  // "pick a date range" empty state) until both From Date and To Date have
  // actually been applied, matching the backend's own required-fields guard.
  const { data, isLoading, isFetching } = useGetPayableTaxReportQuery(appliedFilters, {
    skip: !appliedFilters.fromDate || !appliedFilters.toDate,
  });

  const baseRows = data?.rows || [];
  const totals = data?.totals || {};
  const mode = data?.groupBy || appliedFilters.groupBy || 'month';
  const columns = COLUMNS_BY_MODE[mode] || INVOICE_COLUMNS;
  const leadingColSpan = LEADING_COLSPAN_BY_MODE[mode] || 1;

  const table = useTableFeatures(baseRows, columns, { onChange: setPage });
  const { resetAll: resetTable } = table;
  const rows = table.rows;
  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  // Fix: switching "View By" changes the row shape entirely (item-level
  // documents collapse down to a handful of parties, or a single "All"
  // row) — without this, a page number or a search/sort/filter left over
  // from the previous mode could point past the new, much shorter row set,
  // or hide rows under a leftover filter that no longer makes sense for
  // this mode's columns. Either way the table would silently show nothing,
  // looking like "View By" itself was broken.
  useEffect(() => {
    setPage(0);
    resetTable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const hasAppliedDates = Boolean(appliedFilters.fromDate && appliedFilters.toDate);
  const ready = !isLoading;

  const printFilterLabels = {
    fromDate: 'From Date', toDate: 'To Date', branch: 'Branch', documentType: 'Document Type', party: 'Customer/Vendor Name', taxRate: 'Tax %', taxType: 'Tax Type', groupBy: 'View By',
  };
  const printFilters = useMemo(() => buildPrintFilters(
    appliedFilters,
    printFilterLabels,
    ['fromDate', 'toDate'],
  ), [appliedFilters]);

  const onApply = handleSubmit((values) => {
    if (!values.fromDate || !values.toDate) {
      notify.error('From Date and To Date are required');
      return;
    }
    setAppliedFilters({
      fromDate: dayjs(values.fromDate).format('YYYY-MM-DD'),
      toDate: dayjs(values.toDate).format('YYYY-MM-DD'),
      branch: values.branch || '',
      documentType: values.documentType || '',
      party: values.party || '',
      taxRate: values.taxRate === '' || values.taxRate === undefined || values.taxRate === null ? '' : values.taxRate,
      taxType: values.taxType || '',
      groupBy: values.groupBy || 'month',
    });
    setPage(0);
  });

  const onReset = () => {
    reset(emptyDefaultValues);
    setAppliedFilters(emptyAppliedFilters);
    setPage(0);
  };

  // Export to Excel: current filtered/sorted rows to CSV.
  const exportColumns = useMemo(() => columns.map((c) => [c.field, c.headerName]), [columns]);
  const handleExport = () => {
    const header = exportColumns.map(([, label]) => label).join(',');
    const lines = baseRows.map((r) => exportColumns.map(([key]) => `"${String(r[key] ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'payable-tax-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();

  const balanceChip = (value) => {
    const n = Number(value || 0);
    const positive = n >= 0;
    return (
      <Chip
        size="small"
        label={currency(Math.abs(n))}
        color={positive ? 'error' : 'success'}
        variant="outlined"
        sx={{ fontWeight: 700 }}
      />
    );
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<AccountBalanceWalletOutlinedIcon />}
        title="Payable Tax Report"
        subtitle="Net GST payable — Output Tax less Input Tax — viewable All / Customer Wise / Invoice Wise."
        rightContent={<CompanyBadge />}
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <FormProvider {...methods}>
            <Grid container spacing={2} alignItems="flex-start">
              <Grid item xs={12} sm={6} md={2}>
                <FormDatePicker name="fromDate" label="From Date *" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormDatePicker name="toDate" label="To Date *" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="branch" label="Branch" options={branchOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="documentType" label="Document Type" options={DOCUMENT_TYPE_OPTIONS} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="party" label="Customer/Vendor Name" options={partyOptions} emptyValue="" filterOptions={partyFilterOptions} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="taxRate" label="Tax %" options={taxRateOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="taxType" label="Tax Type" options={TAX_TYPE_OPTIONS} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="groupBy" label="View By" options={GROUP_BY_OPTIONS} />
              </Grid>
              <Grid item xs={12} sm={6} md={12}>
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
              {ready && hasAppliedDates && pagedRows.map((row) => (
                <MobileRecordCard
                  key={row.id}
                  title={mode === 'invoice' ? row.documentNo : (mode === 'party' ? (row.partyName || '—') : (mode === 'month' ? row.month : 'All Transactions'))}
                  statusChip={mode === 'invoice' ? (
                    <Typography variant="caption" fontWeight={700} color="text.secondary">{row.documentType} · {formatDate(row.postingDate)}</Typography>
                  ) : null}
                  fields={[
                    ...(mode === 'invoice' || mode === 'party' ? [{ label: 'Customer/Vendor Code', value: row.partyCode || '—' }] : []),
                    { label: 'Input Tax', value: currency(row.inputTax) },
                    { label: 'Output Tax', value: currency(row.outputTax) },
                    { label: 'Balance', value: currency(row.balance) },
                  ]}
                />
              ))}
              {ready && (!hasAppliedDates || rows.length === 0) && (
                isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState
                    icon={<PercentOutlinedIcon sx={{ fontSize: 48 }} />}
                    title={hasAppliedDates ? 'No tax data found' : 'Pick a date range'}
                    message={hasAppliedDates ? 'Try widening the filters' : 'From Date and To Date are required — set them and click Apply Filters'}
                  />
                )
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width={40}>#</TableCell>
                    {columns.map((c) => (
                      <SortableHeaderCell key={c.field} field={c.field} sort={table.sort} onSort={table.toggleSort} align={c.align}>
                        {c.headerName}
                      </SortableHeaderCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ready && hasAppliedDates && pagedRows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      {mode === 'invoice' && (
                        <>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.documentType}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.postingDate)}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Typography variant="body2" fontWeight={700} color="primary.main">{row.documentNo}</Typography>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.partyCode || '—'}</TableCell>
                          <TableCell sx={{ minWidth: 150, whiteSpace: 'nowrap' }}>{row.partyName || '—'}</TableCell>
                        </>
                      )}
                      {mode === 'party' && (
                        <>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.partyCode || '—'}</TableCell>
                          <TableCell sx={{ minWidth: 150, whiteSpace: 'nowrap' }}>{row.partyName || '—'}</TableCell>
                        </>
                      )}
                      {mode === 'month' && (
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography variant="body2" fontWeight={700}>{row.month}</Typography>
                        </TableCell>
                      )}
                      {mode === 'all' && (
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography variant="body2" fontWeight={700}>All Transactions</Typography>
                        </TableCell>
                      )}
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.inputTax)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.outputTax)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{balanceChip(row.balance)}</TableCell>
                    </TableRow>
                  ))}
                  {ready && (!hasAppliedDates || rows.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={columns.length + 1}>
                        {isFetching ? (
                          <LoadingState label="Loading…" />
                        ) : (
                          <EmptyState
                            icon={<PercentOutlinedIcon sx={{ fontSize: 48 }} />}
                            title={hasAppliedDates ? 'No tax data found' : 'Pick a date range'}
                            message={hasAppliedDates ? 'Try widening the filters' : 'From Date and To Date are required — set them and click Apply Filters'}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                  {ready && hasAppliedDates && rows.length > 0 && mode !== 'all' && (
                    <TableRow>
                      <TableCell colSpan={leadingColSpan + 1}><Typography fontWeight={700}>Total</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.inputTax)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.outputTax)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.balance)}</Typography></TableCell>
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
        title="Payable Tax Report"
        subtitle="Net GST payable — Output Tax less Input Tax."
        filters={printFilters}
        columns={columns}
        // Print always reflects the full Filters-section-scoped dataset (for
        // the current "View By" mode), not whatever the quick search box /
        // column filter popover currently narrows the on-screen table to —
        // see SalesQuotationRegister.jsx.
        rows={baseRows}
        totals={totals}
        orientation="landscape"
      />
    </Box>
  );
}
