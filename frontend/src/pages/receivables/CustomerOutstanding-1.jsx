import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import LoadingState from '../../components/feedback/LoadingState';
import EmptyState from '../../components/data-display/EmptyState';
import { useCurrencyOptions } from '../../lib/currencyOptions';
import { useForm, FormProvider } from 'react-hook-form';
import {
  Box, Typography, Button, Card, CardContent, Stack, Grid, Table, TableBody, TableCell,
  TableHead, TableRow,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from 'recharts';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import dayjs from 'dayjs';
import FormSelect from '../../components/form/FormSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import ChartContainer from '../../components/data-display/ChartContainer';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import useDragScroll from '../../components/data-display/useDragScroll';
import StatCard from '../../components/data-display/StatCard';
import { branchApi, customerApi, salesEmployeeApi } from '../../features/resources';
import { useGetOutstandingReportQuery } from '../../features/receivables/customerOutstandingReportApi';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableToolbar from '../../components/data-display/TableToolbar';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import ReportPrintable from '../../components/print/ReportPrintable';
import { buildPrintFilters } from '../../components/print/reportPrint';

const PAGE_SIZE = 10;

// Header cells that span both header rows (everything outside the
// "Outstanding Ageing (₹)" group) — centred vertically across the two rows
// so their labels line up against the group's stacked parent/child pair.
const SPANNED_HEADER_SX = { verticalAlign: 'middle' };

const AGING_BASIS_OPTIONS = [
  { label: 'Due Date', value: 'Due Date' },
  { label: 'Invoice Date', value: 'Invoice Date' },
];

// Outstanding Type has no dedicated column anywhere in the data model —
// there's no DebitNote model in this schema, so every outstanding row is
// always invoice-derived. This list is filter-bar-only and a no-op on the
// backend, see the route comment in resources.js.
const OUTSTANDING_TYPE_OPTIONS = ['All (Invoices + Debit Notes)', 'Invoices Only'];
const INCLUDE_OPTIONS = ['All Customers', 'Customers with Outstanding Only'];
const SHOW_INACTIVE_OPTIONS = [{ label: 'No', value: 'No' }, { label: 'Yes', value: 'Yes' }];
// Currency reads live from Currency Master instead of a hardcoded
// single-item list — see lib/currencyOptions.js.

const STATUS_COLORS = { Overdue: 'error', Current: 'warning', 'No Outstanding': 'success' };

const currency = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '—');

const DEFAULT_FILTERS = {
  branch: '', customerGroup: '', salesPerson: '', customerName: '',
  outstandingType: 'All (Invoices + Debit Notes)', include: 'Customers with Outstanding Only', showInactiveCustomers: 'No',
  currency: 'INR', asOnDate: dayjs().format('YYYY-MM-DD'), agingBasedOn: 'Due Date',
};

// Reports > Receivable > Customer Outstanding print layout — see ReportPrintable.jsx.
const PRINT_FILTER_LABELS = {
  branch: 'Branch', customerGroup: 'Customer Group', salesPerson: 'Sales Person', customerName: 'Customer',
  outstandingType: 'Outstanding Type', include: 'Include', showInactiveCustomers: 'Show Inactive Customers',
  currency: 'Currency', asOnDate: 'As On Date', agingBasedOn: 'Ageing Based On',
};
const PRINT_DATE_FIELDS = ['asOnDate'];

const CUSTOMER_OUTSTANDING_DETAIL_TABLE_ROW_HEIGHT = 0;
const CUSTOMER_OUTSTANDING_DETAIL_TABLE_CELL_PADDING_Y = 6;
export default function CustomerOutstanding() {
  const theme = useTheme();
  const isMobile = useIsMobileListView();

  const { data: branches } = branchApi.useList();
  const { data: customers } = customerApi.useList();
  const { data: salesEmployees } = salesEmployeeApi.useList();

  const branchOptions = useMemo(() => ([
    { label: 'All Branches', value: '' },
    ...(branches || []).map((b) => ({ label: b.branchName, value: b.branchName })),
  ]), [branches]);

  // Customer Group is Customer.customerType — the only classification field
  // on Customer — so the option list is just the distinct values in use.
  const customerGroupOptions = useMemo(() => {
    const distinct = Array.from(new Set((customers || []).map((c) => c.customerType).filter(Boolean)));
    return [{ label: 'All Groups', value: '' }, ...distinct.map((g) => ({ label: g, value: g }))];
  }, [customers]);

  const salesPersonOptions = useMemo(() => ([
    { label: 'All Sales Persons', value: '' },
    ...(salesEmployees || []).map((e) => ({ label: e.employeeName, value: e.employeeName })),
  ]), [salesEmployees]);

  const customerOptions = useMemo(() => ([
    { label: 'All Customers', value: '' },
    ...(customers || []).map((c) => ({ label: c.customerName, value: c.customerName })),
  ]), [customers]);

  const outstandingTypeOptions = useMemo(() => (
    OUTSTANDING_TYPE_OPTIONS.map((s) => ({ label: s, value: s }))
  ), []);
  const includeOptions = useMemo(() => (
    INCLUDE_OPTIONS.map((s) => ({ label: s, value: s }))
  ), []);
  const currencyOptions = useCurrencyOptions();

  // Filter bar is a report toolbar, not a create/edit form — no Zod
  // validation or persisted mutation, same as other report pages.
  const methods = useForm({
    defaultValues: {
      branch: '', customerGroup: '', salesPerson: '', customerName: '',
      outstandingType: 'All (Invoices + Debit Notes)', include: 'Customers with Outstanding Only', showInactiveCustomers: 'No',
      currency: 'INR', asOnDate: dayjs(), agingBasedOn: 'Due Date',
    },
  });
  const { handleSubmit, reset } = methods;

  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // The table header is two rows deep (the four ageing buckets sit under a
  // single "Outstanding Ageing (₹)" group cell). `stickyHeader` pins every
  // header cell at top: 0, which would stack the second row on top of the
  // first — so the second row is offset by the measured height of the first
  // rather than a hardcoded guess, which would drift with font/density
  // changes.
  const groupHeaderRowRef = useRef(null);
  const [groupHeaderHeight, setGroupHeaderHeight] = useState(0);

  useLayoutEffect(() => {
    const el = groupHeaderRowRef.current;
    if (!el) { setGroupHeaderHeight(0); return undefined; }
    const measure = () => setGroupHeaderHeight(el.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMobile]);

  const { data, isLoading, isFetching } = useGetOutstandingReportQuery(appliedFilters);
  const baseTableRows = data?.rows || [];

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'customerCode', headerName: 'Customer Code', filter: 'text' },
    { field: 'customerName', headerName: 'Customer Name', filter: 'text' },
    { field: 'customerGroup', headerName: 'Customer Group', filter: 'text' },
    { field: 'salesPerson', headerName: 'Sales Person', filter: 'text' },
    { field: 'creditLimit', headerName: 'Credit Limit (₹)', filter: 'numberRange', sortValue: (row) => (row.creditLimit == null || row.creditLimit === '' ? null : Number(row.creditLimit)) },
    { field: 'totalOutstanding', headerName: 'Total Outstanding (₹)', filter: 'numberRange', sortValue: (row) => (row.totalOutstanding == null || row.totalOutstanding === '' ? null : Number(row.totalOutstanding)) },
    { field: 'current', headerName: '0 - 30 Days', filter: 'numberRange', sortValue: (row) => (row.current == null || row.current === '' ? null : Number(row.current)) },
    { field: 'd31to60', headerName: '31 - 60 Days', filter: 'numberRange', sortValue: (row) => (row.d31to60 == null || row.d31to60 === '' ? null : Number(row.d31to60)) },
    { field: 'd61to90', headerName: '61 - 90 Days', filter: 'numberRange', sortValue: (row) => (row.d61to90 == null || row.d61to90 === '' ? null : Number(row.d61to90)) },
    { field: 'above90', headerName: 'Above 90 Days', filter: 'numberRange', sortValue: (row) => (row.above90 == null || row.above90 === '' ? null : Number(row.above90)) },
    { field: 'overdueDays', headerName: 'Overdue Days', filter: 'numberRange', sortValue: (row) => (row.overdueDays == null || row.overdueDays === '' ? null : Number(row.overdueDays)) },
    { field: 'lastInvoiceDate', headerName: 'Last Invoice Date', filter: 'dateRange', sortValue: (row) => (row.lastInvoiceDate ? new Date(row.lastInvoiceDate).getTime() : null), searchValue: (row) => formatDate(row.lastInvoiceDate) },
    { field: 'status', headerName: 'Status', filter: 'select' },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const totals = data?.totals || {};
  const stats = data?.stats || {};
  const outstandingByAgeing = data?.outstandingByAgeing || [];
  const topCustomersByOutstanding = data?.topCustomersByOutstanding || [];
  const outstandingByCustomerGroup = data?.outstandingByCustomerGroup || [];
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
      customerGroup: values.customerGroup || '',
      salesPerson: values.salesPerson || '',
      customerName: values.customerName || '',
      outstandingType: values.outstandingType || 'All (Invoices + Debit Notes)',
      include: values.include || 'All Customers',
      showInactiveCustomers: values.showInactiveCustomers || 'No',
      currency: values.currency || 'INR',
      asOnDate: values.asOnDate ? dayjs(values.asOnDate).format('YYYY-MM-DD') : '',
      agingBasedOn: values.agingBasedOn || 'Due Date',
    });
    setPage(0);
  });

  const onReset = () => {
    reset({
      branch: '', customerGroup: '', salesPerson: '', customerName: '',
      outstandingType: 'All (Invoices + Debit Notes)', include: 'Customers with Outstanding Only', showInactiveCustomers: 'No',
      currency: 'INR', asOnDate: dayjs(), agingBasedOn: 'Due Date',
    });
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  const totalOutstandingForPct = stats.totalOutstandingAmount || 1;
  const pct = (v) => Math.round((Number(v || 0) / totalOutstandingForPct) * 1000) / 10;

  const statCards = [
    { icon: <PeopleAltOutlinedIcon fontSize="small" />, label: 'Total Customers', value: stats.totalCustomers ?? 0, color: 'primary' },
    { icon: <AccountBalanceWalletOutlinedIcon fontSize="small" />, label: 'Total Outstanding Amount', value: currency(stats.totalOutstandingAmount), color: 'secondary' },
    { icon: <Inventory2OutlinedIcon fontSize="small" />, label: `Current (0 - 30 Days) ${pct(stats.current)}%`, value: currency(stats.current), color: 'success' },
    { icon: <EventOutlinedIcon fontSize="small" />, label: `31 - 60 Days ${pct(stats.d31to60)}%`, value: currency(stats.d31to60), color: 'warning' },
    { icon: <WarningAmberOutlinedIcon fontSize="small" />, label: `61 - 90 Days ${pct(stats.d61to90)}%`, value: currency(stats.d61to90), color: 'error' },
    { icon: <EventBusyOutlinedIcon fontSize="small" />, label: `Above 90 Days ${pct(stats.above90)}%`, value: currency(stats.above90), color: 'success' },
  ];

  const donutColors = [
    theme.palette.primary.main, theme.palette.success.main, theme.palette.warning.main,
    theme.palette.secondary.main, theme.palette.error.main, theme.palette.grey[400],
  ];
  const ageingDonutColors = [theme.palette.primary.main, theme.palette.warning.main, theme.palette.error.main, theme.palette.secondary.main];
  const chartTooltipStyle = { backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 };

  // Export: current filtered/aggregated rows to CSV — same client-side
  // pattern used elsewhere.
  const EXPORT_COLUMNS = [
    ['customerCode', 'Customer Code'], ['customerName', 'Customer Name'], ['customerGroup', 'Customer Group'],
    ['salesPerson', 'Sales Person'], ['creditLimit', 'Credit Limit'], ['totalOutstanding', 'Total Outstanding'],
    ['current', '0 - 30 Days'], ['d31to60', '31 - 60 Days'], ['d61to90', '61 - 90 Days'], ['above90', 'Above 90 Days'],
    ['overdueDays', 'Overdue Days'], ['lastInvoiceDate', 'Last Invoice Date'], ['status', 'Status'],
  ];
  const handleExport = () => {
    const header = EXPORT_COLUMNS.map(([, label]) => label).join(',');
    const lines = rows.map((r) => EXPORT_COLUMNS.map(([key]) => {
      let v = r[key];
      if (key === 'lastInvoiceDate') v = formatDate(v);
      return `"${String(v ?? '').replace(/"/g, '""')}"`;
    }).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer-outstanding.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<DescriptionOutlinedIcon />}
        title="Customer Outstanding"
        subtitle="View customer wise outstanding balances and ageing."
        rightContent={<CompanyBadge />}
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Filters</Typography>
          <FormProvider {...methods}>
            <Grid container spacing={2} alignItems="flex-start">
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="branch" label="Branch" options={branchOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="customerGroup" label="Customer Group" options={customerGroupOptions} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="salesPerson" label="Sales Person" options={salesPersonOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="customerName" label="Customer" options={customerOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormDatePicker name="asOnDate" label="Ageing As On" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="agingBasedOn" label="Ageing Based On" options={AGING_BASIS_OPTIONS} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="outstandingType" label="Outstanding Type" options={outstandingTypeOptions} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="include" label="Include" options={includeOptions} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="showInactiveCustomers" label="Show Inactive Customers" options={SHOW_INACTIVE_OPTIONS} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="currency" label="Currency" options={currencyOptions} />
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
            title="Customer Outstanding List"
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
              {!isLoading && pagedRows.map((row, idx) => (
                <MobileRecordCard
                  key={row.customerCode}
                  title={row.customerName}
                  statusChip={(
                    <Typography variant="caption" fontWeight={700} sx={{ color: `${STATUS_COLORS[row.status] || 'text.primary'}.main` }}>{row.status}</Typography>
                  )}
                  fields={[
                    { label: '#', value: page * pageSize + idx + 1 },
                    { label: 'Customer Code', value: row.customerCode },
                    { label: 'Customer Group', value: row.customerGroup },
                    { label: 'Sales Person', value: row.salesPerson },
                    { label: 'Credit Limit', value: currency(row.creditLimit) },
                    { label: 'Total Outstanding', value: currency(row.totalOutstanding) },
                    { label: '0 - 30 Days', value: currency(row.current) },
                    { label: '31 - 60 Days', value: currency(row.d31to60) },
                    { label: '61 - 90 Days', value: currency(row.d61to90) },
                    { label: 'Above 90 Days', value: currency(row.above90) },
                    { label: 'Overdue Days', value: row.overdueDays },
                    { label: 'Last Invoice Date', value: formatDate(row.lastInvoiceDate) },
                  ]}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<RequestQuoteOutlinedIcon sx={{ fontSize: 48 }} />} title="No outstanding balances found" message="Try adjusting your date range or filters" />
                )
              )}
              {!isLoading && rows.length > 0 && (
                <Card variant="outlined" sx={{ mb: 1.5, bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Total</Typography>
                    <Stack spacing={0.75}>
                      {[
                        ['Credit Limit', totals.creditLimit], ['Total Outstanding', totals.totalOutstanding],
                        ['0 - 30 Days', totals.current], ['31 - 60 Days', totals.d31to60],
                        ['61 - 90 Days', totals.d61to90], ['Above 90 Days', totals.above90],
                      ].map(([label, value]) => (
                        <Stack key={label} direction="row" justifyContent="space-between">
                          <Typography variant="caption" color="text.secondary">{label}</Typography>
                          <Typography variant="body2" fontWeight={700}>{currency(value)}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table
                size="small"
                stickyHeader
                sx={{
                  '& th, & td': {
                    height: CUSTOMER_OUTSTANDING_DETAIL_TABLE_ROW_HEIGHT,
                    paddingTop: `${CUSTOMER_OUTSTANDING_DETAIL_TABLE_CELL_PADDING_Y}px`,
                    paddingBottom: `${CUSTOMER_OUTSTANDING_DETAIL_TABLE_CELL_PADDING_Y}px`,
                    boxSizing: 'border-box',
                  },
                }}
              >
                <TableHead>
                  <TableRow ref={groupHeaderRowRef}>
                    <TableCell width={48} rowSpan={2} sx={SPANNED_HEADER_SX}>#</TableCell>
                    <SortableHeaderCell field="customerCode" sort={table.sort} onSort={table.toggleSort} rowSpan={2} sx={SPANNED_HEADER_SX}>Customer Code</SortableHeaderCell>
                    <SortableHeaderCell field="customerName" sort={table.sort} onSort={table.toggleSort} rowSpan={2} sx={SPANNED_HEADER_SX}>Customer Name</SortableHeaderCell>
                    <SortableHeaderCell field="customerGroup" sort={table.sort} onSort={table.toggleSort} rowSpan={2} sx={SPANNED_HEADER_SX}>Customer Group</SortableHeaderCell>
                    <SortableHeaderCell field="salesPerson" sort={table.sort} onSort={table.toggleSort} rowSpan={2} sx={SPANNED_HEADER_SX}>Sales Person</SortableHeaderCell>
                    <SortableHeaderCell field="creditLimit" sort={table.sort} onSort={table.toggleSort} align="right" rowSpan={2} sx={SPANNED_HEADER_SX}>Credit Limit (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="totalOutstanding" sort={table.sort} onSort={table.toggleSort} align="right" rowSpan={2} sx={SPANNED_HEADER_SX}>Total Outstanding (₹)</SortableHeaderCell>
                    <TableCell
                      align="center"
                      colSpan={4}
                      sx={{ whiteSpace: 'nowrap', borderLeft: 1, borderRight: 1, borderColor: 'divider' }}
                    >
                      Outstanding Ageing (₹)
                    </TableCell>
                    <SortableHeaderCell field="overdueDays" sort={table.sort} onSort={table.toggleSort} align="right" rowSpan={2} sx={SPANNED_HEADER_SX}>Overdue Days</SortableHeaderCell>
                    <SortableHeaderCell field="lastInvoiceDate" sort={table.sort} onSort={table.toggleSort} rowSpan={2} sx={SPANNED_HEADER_SX}>Last Invoice Date</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort} rowSpan={2} sx={SPANNED_HEADER_SX}>Status</SortableHeaderCell>
                  </TableRow>
                  <TableRow>
                    <SortableHeaderCell field="current" sort={table.sort} onSort={table.toggleSort} align="right" sx={{ top: groupHeaderHeight, borderLeft: 1, borderColor: 'divider' }}>0 - 30 Days</SortableHeaderCell>
                    <SortableHeaderCell field="d31to60" sort={table.sort} onSort={table.toggleSort} align="right" sx={{ top: groupHeaderHeight }}>31 - 60 Days</SortableHeaderCell>
                    <SortableHeaderCell field="d61to90" sort={table.sort} onSort={table.toggleSort} align="right" sx={{ top: groupHeaderHeight }}>61 - 90 Days</SortableHeaderCell>
                    <SortableHeaderCell field="above90" sort={table.sort} onSort={table.toggleSort} align="right" sx={{ top: groupHeaderHeight, borderRight: 1, borderColor: 'divider' }}>Above 90 Days</SortableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.customerCode} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" fontWeight={700} color="primary.main">{row.customerCode}</Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 150 }}>{row.customerName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.customerGroup}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.salesPerson}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.creditLimit)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.totalOutstanding)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.current)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.d31to60)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.d61to90)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.above90)}</TableCell>
                      <TableCell align="right">{row.overdueDays}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.lastInvoiceDate)}</TableCell>
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
                  <EmptyState icon={<RequestQuoteOutlinedIcon sx={{ fontSize: 48 }} />} title="No outstanding balances found" message="Try adjusting your date range or filters" />
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && rows.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={5}><Typography fontWeight={700}>Total</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.creditLimit)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.totalOutstanding)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.current)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.d31to60)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.d61to90)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.above90)}</Typography></TableCell>
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

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Outstanding by Ageing</Typography>
              <ChartContainer sx={{ width: '100%', height: 180, position: 'relative' }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={outstandingByAgeing} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                      {outstandingByAgeing.map((entry, i) => <Cell key={entry.name} fill={ageingDonutColors[i % ageingDonutColors.length]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => currency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <Typography variant="caption" color="text.secondary" display="block">Total</Typography>
                  <Typography variant="subtitle2" fontWeight={700}>{currency(stats.totalOutstandingAmount)}</Typography>
                </Box>
              </ChartContainer>
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {outstandingByAgeing.map((d, i) => (
                  <Stack key={d.name} direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ageingDonutColors[i % ageingDonutColors.length], flexShrink: 0 }} />
                      <Typography variant="caption" color="text.secondary" noWrap>{d.name}</Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">{currency(d.value)} ({d.percent}%)</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Top 10 Customers by Outstanding Amount</Typography>
              <ChartContainer sx={{ width: '100%', height: 300, mt: 1 }}>
                <ResponsiveContainer>
                  <BarChart data={topCustomersByOutstanding} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 9, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => currency(v)} />
                    <Bar dataKey="value" fill={theme.palette.primary.main} radius={[0, 4, 4, 0]} maxBarSize={14}>
                      <LabelList dataKey="value" position="right" formatter={(v) => currency(v)} style={{ fontSize: 9, fill: theme.palette.text.secondary }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Outstanding by Customer Group</Typography>
              <ChartContainer sx={{ width: '100%', height: 180, position: 'relative' }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={outstandingByCustomerGroup} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                      {outstandingByCustomerGroup.map((entry, i) => <Cell key={entry.name} fill={donutColors[i % donutColors.length]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => currency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <Typography variant="caption" color="text.secondary" display="block">Total</Typography>
                  <Typography variant="subtitle2" fontWeight={700}>{currency(stats.totalOutstandingAmount)}</Typography>
                </Box>
              </ChartContainer>
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {outstandingByCustomerGroup.map((d, i) => (
                  <Stack key={d.name} direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: donutColors[i % donutColors.length], flexShrink: 0 }} />
                      <Typography variant="caption" color="text.secondary" noWrap>{d.name}</Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">{currency(d.value)} ({d.percent}%)</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <ReportPrintable
        title="Customer Outstanding"
        subtitle="Customer-wise outstanding balances and ageing analysis."
        filters={printFilters}
        columns={tableColumns}
        rows={rows}
        totals={totals}
        totalsLabel="Total"
        orientation="landscape"
      />
    </Box>
  );
}
