import React, {
  useEffect, useMemo, useState,
} from 'react';
import PercentOutlinedIcon from '@mui/icons-material/PercentOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
// Header icon only — distinct per tax report so the three pages (and their
// browser tabs/breadcrumbs) are visually tellable apart at a glance; the
// EmptyState below still uses PercentOutlinedIcon as the shared "Tax"
// domain icon, same convention as every other report family in this app
// (e.g. Inventory reports all share Inventory2OutlinedIcon there). Matches
// the ReceiptLong icon now used for this report's own nav/sidebar entry
// (see router/navConfig.js + iconMap.js) — same icon, outlined variant.
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { useForm, FormProvider } from 'react-hook-form';
import {
  Box, Typography, Button, Card, CardContent, Stack, Grid, Table, TableBody, TableCell,
  TableHead, TableRow, IconButton,
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
import { branchApi, taxCodeApi, supplierApi } from '../../../features/resources';
import { useGetInputTaxReportQuery, useExportInputTaxReportGstr2Mutation } from '../../../features/sales/taxReportApi';
import useTableFeatures from '../../../components/data-display/useTableFeatures';
import TableToolbar from '../../../components/data-display/TableToolbar';
import SortableHeaderCell from '../../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import TableFilterPanel from '../../../components/data-display/TableFilterPanel';
import ReportPrintable from '../../../components/print/ReportPrintable';
import { buildPrintFilters } from '../../../components/print/reportPrint';
import TaxReportLineDetailDialog from '../../../components/common/TaxReportLineDetailDialog';
// taxReportMonthsSpanned is unused now that isMonthWise is hardcoded to
// false below (see that constant's own comment) — only
// buildTaxReportMonthRows is still referenced, inside the now-dead
// monthRows branch.
import { buildTaxReportMonthRows } from '../../../lib/taxReportMonthRollup';

const PAGE_SIZE = 50;

const currency = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percent = (v) => (v === null || v === undefined || v === '' ? '—' : `${Number(v).toFixed(2)}%`);
const formatDate = (d) => (d ? dayjs(d).format('DD-MM-YYYY') : '—');

// Input Tax Credit is only ever claimable against a valid Purchase
// Invoice — not a GRN (a warehouse-side receiving document with no fiscal
// standing of its own) or a Purchase Return/Credit Memo (a tax REVERSAL,
// not additional credit) — so this only lists Purchase Invoice. Mirrors
// backend/src/routes/resources.js's INPUT_TAX_REPORT_DOC_TYPES exactly,
// so a value picked here is always a value the backend actually
// recognizes for this report.
const DOCUMENT_TYPE_OPTIONS = [
  { label: 'All Document Types', value: '' },
  { label: 'Purchase Invoice', value: 'Purchase Invoice' },
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

// One row per Purchase Invoice LINE ITEM (Input Tax never comes from a
// Sales document, a GRN, or a Purchase Return/Credit Memo — see
// DOCUMENT_TYPE_OPTIONS above). Document Type tells the merged sources
// apart. Customer/Vendor Code and
// Name are the generic "whichever party this row's own document carries"
// columns (always Vendor here, since this report is Purchase-side only —
// kept as Customer/Vendor rather than just Vendor so its own column labels
// stay identical to Output Tax Report's and Payable Tax Report's).
const LINE_COLUMNS = [
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
  { field: 'itemCode', headerName: 'Item Code', filter: 'text' },
  { field: 'description', headerName: 'Description', filter: 'text' },
  { field: 'quantity', headerName: 'Quantity', filter: 'numberRange', align: 'right', sortValue: (r) => Number(r.quantity || 0), printValue: (r) => qty(r.quantity) },
  { field: 'unitPrice', headerName: 'Unit Price', filter: 'numberRange', align: 'right', sortValue: (r) => Number(r.unitPrice || 0), printValue: (r) => currency(r.unitPrice) },
  { field: 'taxableValue', headerName: 'Taxable Value', filter: 'numberRange', align: 'right', sortValue: (r) => Number(r.taxableValue || 0), printValue: (r) => currency(r.taxableValue) },
  { field: 'taxPercent', headerName: 'Tax %', filter: 'numberRange', align: 'right', sortValue: (r) => Number(r.taxPercent || 0), printValue: (r) => percent(r.taxPercent) },
  { field: 'inputTax', headerName: 'Input Tax', filter: 'numberRange', align: 'right', sortValue: (r) => Number(r.inputTax || 0), printValue: (r) => currency(r.inputTax) },
  { field: 'invoiceTotal', headerName: 'Invoice Total', filter: 'numberRange', align: 'right', sortValue: (r) => Number(r.invoiceTotal || 0), printValue: (r) => currency(r.invoiceTotal) },
];

// Shown instead of LINE_COLUMNS once the applied date range spans more
// than one calendar month (see taxReportMonthsSpanned/buildTaxReportMonthRows
// in lib/taxReportMonthRollup.js) — Tax % and the per-line document/party/
// item fields have no single value once lines are combined this way, so
// only the figures that are still meaningful summed are kept.
const MONTH_COLUMNS = [
  { field: 'month', headerName: 'Month', filter: 'text' },
  { field: 'quantity', headerName: 'Quantity', filter: 'numberRange', align: 'right', sortValue: (r) => Number(r.quantity || 0), printValue: (r) => qty(r.quantity) },
  { field: 'taxableValue', headerName: 'Taxable Value', filter: 'numberRange', align: 'right', sortValue: (r) => Number(r.taxableValue || 0), printValue: (r) => currency(r.taxableValue) },
  { field: 'inputTax', headerName: 'Input Tax', filter: 'numberRange', align: 'right', sortValue: (r) => Number(r.inputTax || 0), printValue: (r) => currency(r.inputTax) },
  { field: 'invoiceTotal', headerName: 'Invoice Total', filter: 'numberRange', align: 'right', sortValue: (r) => Number(r.invoiceTotal || 0), printValue: (r) => currency(r.invoiceTotal) },
];

// Lets the Customer/Vendor Name filter also be found by typing its code —
// the option's own label already shows "Name (Code)" (see partyOptions
// below), so matching against the label alone covers both.
const partyFilterOptions = createFilterOptions({
  stringify: (option) => option.label,
});

const emptyDefaultValues = {
  fromDate: null, toDate: null, branch: '', documentType: '', party: '', taxRate: '', taxType: '',
};
const emptyAppliedFilters = {
  fromDate: '', toDate: '', branch: '', documentType: '', party: '', taxRate: '', taxType: '',
};

export default function TaxReport() {
  const isMobile = useIsMobileListView();
  const notify = useNotify();

  const { data: branches } = branchApi.useList();
  const { data: taxCodes } = taxCodeApi.useList();
  // Input Tax only ever comes from the Purchase side (see
  // DOCUMENT_TYPE_OPTIONS below), so this is Vendors only — not the
  // combined Customer+Vendor list Payable Tax Report's own party filter
  // uses.
  const { data: vendors } = supplierApi.useList();

  const branchOptions = useMemo(() => ([
    { label: 'All Branches', value: '' },
    ...(branches || []).map((b) => ({ label: b.branchName, value: b.branchName })),
  ]), [branches]);
  const partyOptions = useMemo(() => {
    const seen = new Set();
    const opts = [];
    (vendors || []).forEach((v) => {
      const name = v.supplierName;
      if (!name || seen.has(name)) return;
      seen.add(name);
      const code = v.supplierCode || '';
      // Code shown in the option's own label (not just matched on while
      // typing) — two vendors with a similar name are otherwise
      // indistinguishable in the dropdown.
      opts.push({ label: code ? `${name} (${code})` : name, value: name, code });
    });
    opts.sort((a, b) => a.label.localeCompare(b.label));
    return [{ label: 'All Vendors', value: '' }, ...opts];
  }, [vendors]);
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

  const methods = useForm({ defaultValues: emptyDefaultValues });
  const { handleSubmit, reset } = methods;

  const [appliedFilters, setAppliedFilters] = useState(emptyAppliedFilters);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [detailRow, setDetailRow] = useState(null);

  // Date Range is required — no query fires (and nothing renders but the
  // "pick a date range" empty state) until both From Date and To Date have
  // actually been applied, matching the backend's own required-fields guard.
  const { data, isLoading, isFetching } = useGetInputTaxReportQuery(appliedFilters, {
    skip: !appliedFilters.fromDate || !appliedFilters.toDate,
  });

  const baseRows = data?.rows || [];
  const totals = data?.totals || {};

  const hasAppliedDates = Boolean(appliedFilters.fromDate && appliedFilters.toDate);
  // Auto rollup — DISABLED per request: a date range wider than one calendar
  // month used to switch the table to one row per month instead of the
  // detailed per-line view. Every applied date range now always shows every
  // matching document line, however wide the range (a quarter, a financial
  // year, ...). The month-wise code paths below (monthRows/MONTH_COLUMNS,
  // and buildTaxReportMonthRows's import) are left in place, just
  // permanently unreached — hardcoding `false` here rather than deleting
  // them keeps this a small, easily-reversible change instead of ripping out
  // a working feature.
  const isMonthWise = false;
  const monthRows = useMemo(
    () => (isMonthWise ? buildTaxReportMonthRows(baseRows, 'inputTax') : []),
    [isMonthWise, baseRows],
  );
  const activeColumns = isMonthWise ? MONTH_COLUMNS : LINE_COLUMNS;
  const tableRows = isMonthWise ? monthRows : baseRows;

  // The eye icon shows the WHOLE source document, not just the one line
  // that was clicked — every line of that same documentType+documentNo is
  // already loaded in baseRows (this report fetches every matching line up
  // front), so no extra request is needed to gather them.
  const detailLines = useMemo(
    () => (detailRow ? baseRows.filter((r) => r.documentType === detailRow.documentType && r.documentNo === detailRow.documentNo) : null),
    [detailRow, baseRows],
  );

  const table = useTableFeatures(tableRows, activeColumns, { onChange: setPage });
  const { resetAll: resetTable } = table;
  const rows = table.rows;
  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  // Switching between line-wise and month-wise changes the row shape (and
  // usually the row count) entirely — reset paging/sort/filters left over
  // from the other view so nothing points past the new row set.
  useEffect(() => {
    setPage(0);
    resetTable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMonthWise]);

  const ready = !isLoading;

  const printFilterLabels = {
    fromDate: 'From Date', toDate: 'To Date', branch: 'Branch', documentType: 'Document Type', party: 'Customer/Vendor Name', taxRate: 'Tax Rate', taxType: 'Tax Type',
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
    });
    setPage(0);
  });

  const onReset = () => {
    reset(emptyDefaultValues);
    setAppliedFilters(emptyAppliedFilters);
    setPage(0);
  };

  // Export to Excel: downloads the GSTR-2 purchase filing sheet (one row per
  // Purchase Invoice, in the filing template's column layout) for the applied
  // filters — built by the server (GET /tax/input-tax-report/export), not
  // from the on-screen line-wise table.
  const [exportGstr2, { isLoading: exporting }] = useExportInputTaxReportGstr2Mutation();
  const handleExport = async () => {
    if (!hasAppliedDates) {
      notify.error('Pick a date range and apply the filters first');
      return;
    }
    try {
      const blob = await exportGstr2(appliedFilters).unwrap();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GSTR-2 Purchase ${appliedFilters.fromDate} to ${appliedFilters.toDate}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      notify.error('Could not export the GSTR-2 sheet');
    }
  };

  const handlePrint = () => window.print();

  return (
    <Box>
      <EntityHeaderCard
        icon={<ReceiptLongOutlinedIcon />}
        title="Input Tax Report"
        subtitle="GST paid on Purchase transactions — one row per document line, for the entire selected date range."
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
              <Grid item xs={12} sm={6} md={8}>
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
                <Button variant="outlined" color="inherit" size="small" startIcon={<FileDownloadOutlinedIcon />} onClick={handleExport} disabled={exporting}>
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
                  title={isMonthWise ? row.month : row.documentNo}
                  statusChip={!isMonthWise ? (
                    <Typography variant="caption" fontWeight={700} color="text.secondary">{row.documentType} · {formatDate(row.postingDate)}</Typography>
                  ) : null}
                  onView={!isMonthWise ? () => setDetailRow(row) : undefined}
                  fields={isMonthWise ? [
                    { label: 'Quantity', value: qty(row.quantity) },
                    { label: 'Taxable Value', value: currency(row.taxableValue) },
                    { label: 'Input Tax', value: currency(row.inputTax) },
                    { label: 'Invoice Total', value: currency(row.invoiceTotal) },
                  ] : [
                    { label: 'Customer/Vendor Code', value: row.partyCode || '—' },
                    { label: 'Customer/Vendor Name', value: row.partyName || '—' },
                    { label: 'Item Code', value: row.itemCode || '—' },
                    { label: 'Description', value: row.description || '—' },
                    { label: 'Quantity', value: qty(row.quantity) },
                    { label: 'Unit Price', value: currency(row.unitPrice) },
                    { label: 'Taxable Value', value: currency(row.taxableValue) },
                    { label: 'Tax %', value: percent(row.taxPercent) },
                    { label: 'Input Tax', value: currency(row.inputTax) },
                    { label: 'Invoice Total', value: currency(row.invoiceTotal) },
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
                    {activeColumns.map((c) => (
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
                      {isMonthWise ? (
                        <>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Typography variant="body2" fontWeight={700}>{row.month}</Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{qty(row.quantity)}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.taxableValue)}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.inputTax)}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{currency(row.invoiceTotal)}</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.documentType}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.postingDate)}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Typography variant="body2" fontWeight={700} color="primary.main">{row.documentNo}</Typography>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.partyCode || '—'}</TableCell>
                          <TableCell sx={{ minWidth: 150, whiteSpace: 'nowrap' }}>{row.partyName || '—'}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.itemCode || '—'}</TableCell>
                          <TableCell sx={{ minWidth: 200 }}>{row.description || '—'}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{qty(row.quantity)}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.unitPrice)}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.taxableValue)}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{percent(row.taxPercent)}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            <Stack direction="row" spacing={0.25} justifyContent="flex-end" alignItems="center">
                              <IconButton size="small" onClick={() => setDetailRow(row)} aria-label="View line detail">
                                <VisibilityOutlinedIcon fontSize="inherit" />
                              </IconButton>
                              <span>{currency(row.inputTax)}</span>
                            </Stack>
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{currency(row.invoiceTotal)}</TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                  {ready && (!hasAppliedDates || rows.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={activeColumns.length + 1}>
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
                  {ready && hasAppliedDates && rows.length > 0 && (
                    isMonthWise ? (
                      <TableRow>
                        <TableCell colSpan={2}><Typography fontWeight={700}>Total</Typography></TableCell>
                        <TableCell align="right"><Typography fontWeight={700}>{qty(totals.quantity)}</Typography></TableCell>
                        <TableCell align="right"><Typography fontWeight={700}>{currency(totals.taxableValue)}</Typography></TableCell>
                        <TableCell align="right"><Typography fontWeight={700}>{currency(totals.inputTax)}</Typography></TableCell>
                        <TableCell align="right"><Typography fontWeight={700}>{currency(totals.invoiceTotal)}</Typography></TableCell>
                      </TableRow>
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8}><Typography fontWeight={700}>Total</Typography></TableCell>
                        <TableCell align="right"><Typography fontWeight={700}>{qty(totals.quantity)}</Typography></TableCell>
                        <TableCell />
                        <TableCell align="right"><Typography fontWeight={700}>{currency(totals.taxableValue)}</Typography></TableCell>
                        <TableCell />
                        <TableCell align="right"><Typography fontWeight={700}>{currency(totals.inputTax)}</Typography></TableCell>
                        <TableCell align="right"><Typography fontWeight={700}>{currency(totals.invoiceTotal)}</Typography></TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </ScrollableTableContainer>
          )}

          <EntityListPagination total={rows.length} page={page} onChange={setPage} pageSize={pageSize} onPageSizeChange={(v) => { setPageSize(v); setPage(0); }} />
        </CardContent>
      </Card>

      <ReportPrintable
        title="Input Tax Report"
        subtitle={isMonthWise ? 'GST paid on Purchase transactions — one row per month.' : 'GST paid on Purchase transactions — one row per document line.'}
        filters={printFilters}
        columns={activeColumns}
        rows={tableRows}
        totals={totals}
        orientation="landscape"
      />

      <TaxReportLineDetailDialog
        open={Boolean(detailRow)}
        onClose={() => setDetailRow(null)}
        lines={detailLines}
        taxLabel="Input Tax"
        taxField="inputTax"
      />
    </Box>
  );
}
