import React, { useMemo, useState } from 'react';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import LoadingState from '../../../components/feedback/LoadingState';
import EmptyState from '../../../components/data-display/EmptyState';
import { useForm, FormProvider } from 'react-hook-form';
import {
  Box, Typography, Button, Card, CardContent, Stack, Grid, Table, TableBody, TableCell,
  TableHead, TableRow,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip,
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from 'recharts';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
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
import { supplierApi, salesEmployeeApi } from '../../../features/resources';
import { useGetVendorWisePurchaseReportQuery } from '../../../features/purchase/vendorWisePurchaseReportApi';
import useTableFeatures from '../../../components/data-display/useTableFeatures';
import TableToolbar from '../../../components/data-display/TableToolbar';
import SortableHeaderCell from '../../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import TableFilterPanel from '../../../components/data-display/TableFilterPanel';
import ReportPrintable from '../../../components/print/ReportPrintable';
import { buildPrintFilters } from '../../../components/print/reportPrint';

// Reports > Purchase > Vendor-wise Purchase — Purchase-side mirror of
// Reports > Sales > Customer-wise Sales (see pages/reports/sales/
// CustomerWiseSales.jsx): same layout/filter bar/charts, just grouped by
// vendor instead of customer. Sourced from PurchaseInvoice (a realised
// purchase), NOT Purchase Order — a Purchase Order is only a commitment,
// not yet an actual purchase — see buildVendorWisePurchaseReportRows'
// backend counterpart at /purchase/invoices/vendor-wise/report in
// backend/src/routes/resources.js. There is no Source filter here (that's
// an Enquiry-only concept on the Sales side with no Purchase equivalent);
// "Purchase Person" reuses the same Sales Employee master PurchaseInvoice
// itself uses for its own purchaseEmployee field.

const PAGE_SIZE = 10;

const currency = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const lakh = (v) => `${Number(v || 0)}L`;
const formatDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '—');

const DEFAULT_FILTERS = { fromDate: '', toDate: '', vendor: '', purchaseEmployee: '' };

// Reports > Purchase > Vendor-wise Purchase print layout — see ReportPrintable.jsx.
const PRINT_FILTER_LABELS = {
  fromDate: 'From Date', toDate: 'To Date', vendor: 'Vendor', purchaseEmployee: 'Purchase Person',
};
const PRINT_DATE_FIELDS = ['fromDate', 'toDate'];

export default function VendorWisePurchase() {
  const theme = useTheme();
  const isMobile = useIsMobileListView();

  const { data: suppliers } = supplierApi.useList();
  const { data: salesEmployees } = salesEmployeeApi.useList();

  const vendorOptions = useMemo(() => ([
    { label: 'All Vendors', value: '' },
    ...(suppliers || []).map((s) => ({ label: s.supplierName, value: s.supplierName })),
  ]), [suppliers]);

  const purchaseEmployeeOptions = useMemo(() => ([
    { label: 'All Purchase Persons', value: '' },
    ...(salesEmployees || []).map((e) => ({ label: e.employeeName, value: e.employeeName })),
  ]), [salesEmployees]);

  // Filter bar is a report toolbar, not a create/edit form — no Zod
  // validation or persisted mutation, same as other report pages.
  const methods = useForm({
    defaultValues: { fromDate: null, toDate: null, vendor: '', purchaseEmployee: '' },
  });
  const { handleSubmit, reset } = methods;

  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const { data, isLoading, isFetching } = useGetVendorWisePurchaseReportQuery(appliedFilters);
  const baseTableRows = data?.rows || [];

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'vendorCode', headerName: 'Vendor Code', filter: 'text' },
    { field: 'vendorName', headerName: 'Vendor Name', filter: 'text' },
    { field: 'totalInvoices', headerName: 'Total Invoices', filter: 'text' },
    { field: 'totalPurchaseAmount', headerName: 'Total Purchase Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.totalPurchaseAmount == null || row.totalPurchaseAmount === '' ? null : Number(row.totalPurchaseAmount)) },
    { field: 'totalTaxAmount', headerName: 'Total Tax Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.totalTaxAmount == null || row.totalTaxAmount === '' ? null : Number(row.totalTaxAmount)) },
    { field: 'totalDiscount', headerName: 'Total Discount (₹)', filter: 'numberRange', sortValue: (row) => (row.totalDiscount == null || row.totalDiscount === '' ? null : Number(row.totalDiscount)) },
    { field: 'netPurchaseAmount', headerName: 'Net Purchase Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.netPurchaseAmount == null || row.netPurchaseAmount === '' ? null : Number(row.netPurchaseAmount)) },
    { field: 'payableAmount', headerName: 'Payable Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.payableAmount == null || row.payableAmount === '' ? null : Number(row.payableAmount)) },
    { field: 'lastInvoiceDate', headerName: 'Last Invoice Date', filter: 'dateRange', sortValue: (row) => (row.lastInvoiceDate ? new Date(row.lastInvoiceDate).getTime() : null), searchValue: (row) => formatDate(row.lastInvoiceDate) },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const totals = data?.totals || {};
  const stats = data?.stats || {};
  const topVendors = data?.topVendors || [];
  const contribution = data?.contribution || [];
  const trend = data?.trend || [];
  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  // Print: full filtered/sorted rows + the report's own grand totals (keys
  // already match the table's own field names), fed into the shared
  // ReportPrintable layout — see components/print/ReportPrintable.jsx.
  const printFilters = useMemo(
    () => buildPrintFilters(appliedFilters, PRINT_FILTER_LABELS, PRINT_DATE_FIELDS),
    [appliedFilters],
  );

  const onView = handleSubmit((values) => {
    setAppliedFilters({
      fromDate: values.fromDate ? dayjs(values.fromDate).format('YYYY-MM-DD') : '',
      toDate: values.toDate ? dayjs(values.toDate).format('YYYY-MM-DD') : '',
      vendor: values.vendor || '',
      purchaseEmployee: values.purchaseEmployee || '',
    });
    setPage(0);
  });

  const onReset = () => {
    reset({ fromDate: null, toDate: null, vendor: '', purchaseEmployee: '' });
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  const statCards = [
    { icon: <PeopleAltOutlinedIcon fontSize="small" />, label: 'Total Vendors', value: stats.totalVendors ?? 0, color: 'primary' },
    { icon: <AccountBalanceWalletOutlinedIcon fontSize="small" />, label: 'Total Purchase Amount', value: currency(stats.totalPurchaseAmount), color: 'success' },
    { icon: <DescriptionOutlinedIcon fontSize="small" />, label: 'Total Tax Amount', value: currency(stats.totalTaxAmount), color: 'warning' },
    { icon: <TaskAltOutlinedIcon fontSize="small" />, label: 'Total Discount Amount', value: currency(stats.totalDiscountAmount), color: 'secondary' },
    { icon: <CancelOutlinedIcon fontSize="small" />, label: 'Net Purchase Amount', value: currency(stats.netPurchaseAmount), color: 'error' },
  ];

  const donutColors = [
    theme.palette.primary.main, theme.palette.warning.main, theme.palette.secondary.main,
    theme.palette.success.main, theme.palette.error.main, theme.palette.grey[400],
  ];
  const chartTooltipStyle = { backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 };

  // Export: current per-vendor summary rows to CSV, same client-side
  // pattern used elsewhere (SalesInvoiceRegister.jsx / CustomerWiseSales.jsx).
  const EXPORT_COLUMNS = [
    ['vendorCode', 'Vendor Code'], ['vendorName', 'Vendor Name'], ['totalInvoices', 'Total Invoices'],
    ['totalPurchaseAmount', 'Total Purchase Amount'], ['totalTaxAmount', 'Total Tax Amount'], ['totalDiscount', 'Total Discount'],
    ['netPurchaseAmount', 'Net Purchase Amount'], ['payableAmount', 'Payable Amount'], ['lastInvoiceDate', 'Last Invoice Date'],
  ];
  const handleExport = () => {
    const header = EXPORT_COLUMNS.map(([, label]) => label).join(',');
    const lines = baseTableRows.map((r) => EXPORT_COLUMNS.map(([key]) => {
      const v = key === 'lastInvoiceDate' ? formatDate(r[key]) : r[key];
      return `"${String(v ?? '').replace(/"/g, '""')}"`;
    }).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vendor-wise-purchase.csv';
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
              <Grid item xs={12} sm={6} md={2.5}>
                <FormDatePicker name="fromDate" label="From Date" />
              </Grid>
              <Grid item xs={12} sm={6} md={2.5}>
                <FormDatePicker name="toDate" label="To Date" />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="vendor" label="Vendor" options={vendorOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="purchaseEmployee" label="Purchase Person" options={purchaseEmployeeOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12}>
                <Stack direction="row" spacing={1.5} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<SearchIcon />}
                    onClick={onView}
                    disabled={isFetching}
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

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {statCards.map((c) => (
          <Grid item xs={12} sm={6} md={2.4} key={c.label}>
            <StatCard {...c} />
          </Grid>
        ))}
      </Grid>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ p: 0 }}>
          <TableToolbar
            title="Vendor-wise Purchase Summary"
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
                  key={row.vendorName}
                  title={row.vendorName}
                  fields={[
                    { label: 'Vendor Code', value: row.vendorCode },
                    { label: 'Total Invoices', value: row.totalInvoices },
                    { label: 'Total Purchase Amount', value: currency(row.totalPurchaseAmount) },
                    { label: 'Total Tax Amount', value: currency(row.totalTaxAmount) },
                    { label: 'Total Discount', value: currency(row.totalDiscount) },
                    { label: 'Net Purchase Amount', value: currency(row.netPurchaseAmount) },
                    { label: 'Payable Amount', value: currency(row.payableAmount) },
                    { label: 'Last Invoice Date', value: formatDate(row.lastInvoiceDate) },
                  ]}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title="No purchases found for the selected criteria" message="Try adjusting your date range or filters" />
                )
              )}
              {!isLoading && rows.length > 0 && (
                <Card variant="outlined" sx={{ mb: 1.5, bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Total</Typography>
                    <Stack spacing={0.75}>
                      {[
                        ['Total Invoices', totals.totalInvoices], ['Total Purchase Amount', currency(totals.totalPurchaseAmount)],
                        ['Total Tax Amount', currency(totals.totalTaxAmount)], ['Total Discount', currency(totals.totalDiscount)],
                        ['Net Purchase Amount', currency(totals.netPurchaseAmount)], ['Payable Amount', currency(totals.payableAmount)],
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
                    <SortableHeaderCell field="vendorCode" sort={table.sort} onSort={table.toggleSort}>Vendor Code</SortableHeaderCell>
                    <SortableHeaderCell field="vendorName" sort={table.sort} onSort={table.toggleSort}>Vendor Name</SortableHeaderCell>
                    <SortableHeaderCell field="totalInvoices" sort={table.sort} onSort={table.toggleSort} align="right">Total Invoices</SortableHeaderCell>
                    <SortableHeaderCell field="totalPurchaseAmount" sort={table.sort} onSort={table.toggleSort} align="right">Total Purchase Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="totalTaxAmount" sort={table.sort} onSort={table.toggleSort} align="right">Total Tax Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="totalDiscount" sort={table.sort} onSort={table.toggleSort} align="right">Total Discount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="netPurchaseAmount" sort={table.sort} onSort={table.toggleSort} align="right">Net Purchase Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="payableAmount" sort={table.sort} onSort={table.toggleSort} align="right">Payable Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="lastInvoiceDate" sort={table.sort} onSort={table.toggleSort}>Last Invoice Date</SortableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row) => (
                    <TableRow key={row.vendorName} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" fontWeight={700} color="primary.main">{row.vendorCode}</Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 160 }}>{row.vendorName}</TableCell>
                      <TableCell align="right">{row.totalInvoices}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.totalPurchaseAmount)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.totalTaxAmount)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.totalDiscount)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.netPurchaseAmount)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(row.payableAmount)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.lastInvoiceDate)}</TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9}>
                        {isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title="No purchases found for the selected criteria" message="Try adjusting your date range or filters" />
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && rows.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={2}><Typography fontWeight={700}>Total</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{totals.totalInvoices}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.totalPurchaseAmount)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.totalTaxAmount)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.totalDiscount)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.netPurchaseAmount)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(totals.payableAmount)}</Typography></TableCell>
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Top 5 Vendors by Purchase Amount</Typography>
              <Box sx={{ width: '100%', height: 240, mt: 1 }}>
                <ResponsiveContainer>
                  <BarChart data={topVendors} margin={{ top: 20, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} tickFormatter={(v) => lakh(v)} />
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => [lakh(v), 'Amount']} />
                    <Bar dataKey="value" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} maxBarSize={36}>
                      <LabelList dataKey="value" position="top" formatter={(v) => lakh(v)} style={{ fontSize: 10, fill: theme.palette.text.secondary }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Purchase Contribution by Vendor</Typography>
              <Box sx={{ width: '100%', height: 180, position: 'relative' }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={contribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                      {contribution.map((entry, i) => <Cell key={entry.name} fill={donutColors[i % donutColors.length]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => currency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <Typography variant="caption" color="text.secondary" display="block">Total</Typography>
                  <Typography variant="subtitle2" fontWeight={700}>{lakh(Math.round(((stats.totalPurchaseAmount || 0) / 100000) * 100) / 100)}</Typography>
                </Box>
              </Box>
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {contribution.length === 0 && (
                  <Typography variant="caption" color="text.secondary" align="center">No data for the selected criteria</Typography>
                )}
                {contribution.map((d, i) => (
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Purchase Amount Trend</Typography>
              <Typography variant="caption" color="text.secondary">Amount (₹, in Lakhs)</Typography>
              <Box sx={{ width: '100%', height: 220, mt: 1 }}>
                <ResponsiveContainer>
                  <LineChart data={trend} margin={{ top: 20, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} tickFormatter={(v) => lakh(v)} />
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => [lakh(v), 'Purchase Amount']} />
                    <Line type="monotone" dataKey="value" name="Purchase Amount" stroke={theme.palette.primary.main} strokeWidth={2.5} dot={{ r: 4, fill: theme.palette.primary.main, strokeWidth: 0 }} activeDot={{ r: 6 }}>
                      <LabelList dataKey="value" position="top" formatter={(v) => lakh(v)} style={{ fontSize: 10, fill: theme.palette.text.secondary }} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <ReportPrintable
        title="Vendor-wise Purchase"
        subtitle="View and analyze purchase performance grouped by vendors."
        filters={printFilters}
        columns={tableColumns}
        // Print always reflects the full Filters-section-scoped dataset, not
        // whatever the quick search box / column filter popover currently
        // narrows the on-screen table to — see SalesQuotationRegister.jsx.
        rows={baseTableRows}
        totals={totals}
      />
    </Box>
  );
}
