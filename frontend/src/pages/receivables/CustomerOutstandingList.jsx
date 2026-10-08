import React, { useMemo, useState } from 'react';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import LoadingState from '../../components/feedback/LoadingState';
import EmptyState from '../../components/data-display/EmptyState';
import { useForm, FormProvider } from 'react-hook-form';
import {
  Box, Typography, Button, Card, CardContent, Stack, Grid, Table, TableBody, TableCell,
  TableHead, TableRow,
} from '@mui/material';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import CurrencyRupeeOutlinedIcon from '@mui/icons-material/CurrencyRupeeOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import dayjs from 'dayjs';
import FormSelect from '../../components/form/FormSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import StatCard from '../../components/data-display/StatCard';
import { customerApi } from '../../features/resources';
import { useGetOutstandingReportQuery } from '../../features/receivables/customerOutstandingReportApi';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';

const PAGE_SIZE = 10;

const AGING_BASIS_OPTIONS = [
  { label: 'Due Date', value: 'Due Date' },
  { label: 'Invoice Date', value: 'Invoice Date' },
];

const currency = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const DEFAULT_FILTERS = {
  customerName: '', asOnDate: dayjs().format('YYYY-MM-DD'), agingBasedOn: 'Due Date',
};

// Simplified Customer Outstanding page for the Receivables menu — a
// stripped-down view of the same underlying /receivables/outstanding/report
// aggregate the Reports > Customer Outstanding page uses (see
// CustomerOutstanding.jsx there, left untouched). This page only surfaces
// the fields the design calls for: Customer / As On Date / Aging Based On
// filters, four headline stats, and the outstanding-by-ageing table with
// Current, 1-30, 31-60, 61-90, Above 90 and Overdue columns.
const CUSTOMER_OUTSTANDING_LIST_TABLE_ROW_HEIGHT = 0;
const CUSTOMER_OUTSTANDING_LIST_TABLE_CELL_PADDING_Y = 6;
export default function CustomerOutstandingList() {
  const isMobile = useIsMobileListView();

  const { data: customers } = customerApi.useList();

  const customerOptions = useMemo(() => ([
    { label: 'All Customers', value: '' },
    ...(customers || []).map((c) => ({ label: c.customerName, value: c.customerName })),
  ]), [customers]);

  const methods = useForm({
    defaultValues: { customerName: '', asOnDate: dayjs(), agingBasedOn: 'Due Date' },
  });
  const { handleSubmit } = methods;

  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // 'All Customers' is the one magic value the backend treats as "don't
  // filter" (see /receivables/outstanding/report in resources.js) — anything
  // else narrows to customers who actually carry a balance, which is what
  // this simplified page is meant to show (unlike the Reports page, which
  // exposes the Include toggle to the user).
  const { data, isLoading, isFetching } = useGetOutstandingReportQuery({
    ...appliedFilters, include: 'Customers with Outstanding Only',
  });
  const rows = data?.rows || [];
  const totals = data?.totals || {};
  const stats = data?.stats || {};

  // Column definitions drive the sort icons — see
  // components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'customerCode', headerName: 'Customer Code', filter: 'text' },
    { field: 'customerName', headerName: 'Customer Name', filter: 'text' },
    { field: 'totalInvoiceAmount', headerName: 'Total Invoice Amount', filter: 'numberRange', sortValue: (row) => Number(row.totalInvoiceAmount) || 0 },
    { field: 'totalOutstanding', headerName: 'Total Outstanding', filter: 'numberRange', sortValue: (row) => Number(row.totalOutstanding) || 0 },
    { field: 'notDue', headerName: 'Current', filter: 'numberRange', sortValue: (row) => Number(row.notDue) || 0 },
    { field: 'd1to30', headerName: '1 - 30 Days', filter: 'numberRange', sortValue: (row) => Number(row.d1to30) || 0 },
    { field: 'd31to60', headerName: '31 - 60 Days', filter: 'numberRange', sortValue: (row) => Number(row.d31to60) || 0 },
    { field: 'd61to90', headerName: '61 - 90 Days', filter: 'numberRange', sortValue: (row) => Number(row.d61to90) || 0 },
    { field: 'above90', headerName: 'Above 90 Days', filter: 'numberRange', sortValue: (row) => Number(row.above90) || 0 },
    { field: 'overdueAmount', headerName: 'Overdue', filter: 'numberRange', sortValue: (row) => Number(row.overdueAmount) || 0 },
  ]), []);
  const table = useTableFeatures(rows, tableColumns, { onChange: setPage });
  const sortedRows = table.rows;
  const pagedRows = useMemo(() => sortedRows.slice(page * pageSize, page * pageSize + pageSize), [sortedRows, page, pageSize]);

  const onView = handleSubmit((values) => {
    setAppliedFilters({
      customerName: values.customerName || '',
      asOnDate: values.asOnDate ? dayjs(values.asOnDate).format('YYYY-MM-DD') : '',
      agingBasedOn: values.agingBasedOn || 'Due Date',
    });
    setPage(0);
  });

  const statCards = [
    { icon: <PeopleAltOutlinedIcon fontSize="small" />, label: 'Total Customers', value: stats.totalCustomers ?? 0, color: 'primary' },
    { icon: <CurrencyRupeeOutlinedIcon fontSize="small" />, label: 'Total Outstanding Amount', value: currency(stats.totalOutstandingAmount), color: 'success' },
    { icon: <AccessTimeOutlinedIcon fontSize="small" />, label: 'Overdue Amount', value: currency(stats.overdueAmount), color: 'warning' },
    { icon: <EventOutlinedIcon fontSize="small" />, label: 'Due Today', value: currency(stats.dueToday), color: 'error' },
  ];

  const EXPORT_COLUMNS = [
    ['customerCode', 'Customer Code'], ['customerName', 'Customer Name'], ['totalInvoiceAmount', 'Total Invoice Amount'],
    ['totalOutstanding', 'Total Outstanding'],
    ['notDue', 'Current'], ['d1to30', '1 - 30 Days'], ['d31to60', '31 - 60 Days'], ['d61to90', '61 - 90 Days'],
    ['above90', 'Above 90 Days'], ['overdueAmount', 'Overdue'],
  ];
  const handleExport = () => {
    const header = EXPORT_COLUMNS.map(([, label]) => label).join(',');
    const lines = sortedRows.map((r) => EXPORT_COLUMNS.map(([key]) => `"${String(r[key] ?? '').replace(/"/g, '""')}"`).join(','));
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
        subtitle="View customer wise outstanding balances."
        rightContent={<CompanyBadge />}
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Filters</Typography>
          <FormProvider {...methods}>
            <Grid container spacing={2} alignItems="flex-start">
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="customerName" label="Customer" options={customerOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormDatePicker name="asOnDate" label="As On Date *" />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="agingBasedOn" label="Aging Based On" options={AGING_BASIS_OPTIONS} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  startIcon={<SearchIcon />}
                  onClick={onView}
                  disabled={isFetching}
                  sx={{ height: 40, whiteSpace: 'nowrap' }}
                >
                  View
                </Button>
              </Grid>
            </Grid>
          </FormProvider>
        </CardContent>
      </Card>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {statCards.map((c) => (
          <Grid item xs={12} sm={6} md={3} key={c.label}>
            <StatCard {...c} />
          </Grid>
        ))}
      </Grid>

      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: { xs: 2, sm: 3 }, pt: 2.5, pb: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>Customer Outstanding List</Typography>
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
              <TableSearchFilter table={table} placeholder="Search customers..." />
              <Button variant="outlined" color="inherit" size="small" startIcon={<FileDownloadOutlinedIcon />} onClick={handleExport}>
                Export
              </Button>
            </Stack>

            <TableFilterPanel table={table} />
          </Stack>

          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {!isLoading && pagedRows.map((row, idx) => (
                <MobileRecordCard
                  key={row.customerCode}
                  title={row.customerName}
                  statusChip={(
                    <Typography variant="caption" fontWeight={700} color="error.main">{currency(row.overdueAmount)}</Typography>
                  )}
                  fields={[
                    { label: '#', value: page * pageSize + idx + 1 },
                    { label: 'Customer Code', value: row.customerCode },
                    { label: 'Total Invoice Amount', value: currency(row.totalInvoiceAmount) },
                    { label: 'Total Outstanding', value: currency(row.totalOutstanding) },
                    { label: 'Current', value: currency(row.notDue) },
                    { label: '1 - 30 Days', value: currency(row.d1to30) },
                    { label: '31 - 60 Days', value: currency(row.d31to60) },
                    { label: '61 - 90 Days', value: currency(row.d61to90) },
                    { label: 'Above 90 Days', value: currency(row.above90) },
                    { label: 'Overdue', value: currency(row.overdueAmount) },
                  ]}
                />
              ))}
              {!isLoading && sortedRows.length === 0 && (
                isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<RequestQuoteOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No outstanding balances found'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Try adjusting your date range or filters'} />
                )
              )}
              {!isLoading && sortedRows.length > 0 && (
                <Card variant="outlined" sx={{ mb: 1.5, bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Total</Typography>
                    <Stack spacing={0.75}>
                      {[
                        ['Total Invoice Amount', totals.totalInvoiceAmount],
                        ['Total Outstanding', totals.totalOutstanding], ['Current', totals.notDue],
                        ['1 - 30 Days', totals.d1to30], ['31 - 60 Days', totals.d31to60],
                        ['61 - 90 Days', totals.d61to90], ['Above 90 Days', totals.above90],
                        ['Overdue', totals.overdue],
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
                    height: CUSTOMER_OUTSTANDING_LIST_TABLE_ROW_HEIGHT,
                    paddingTop: `${CUSTOMER_OUTSTANDING_LIST_TABLE_CELL_PADDING_Y}px`,
                    paddingBottom: `${CUSTOMER_OUTSTANDING_LIST_TABLE_CELL_PADDING_Y}px`,
                    boxSizing: 'border-box',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell width={48}>#</TableCell>
                    <SortableHeaderCell field="customerCode" sort={table.sort} onSort={table.toggleSort}>Customer Code</SortableHeaderCell>
                    <SortableHeaderCell field="customerName" sort={table.sort} onSort={table.toggleSort}>Customer Name</SortableHeaderCell>
                    <SortableHeaderCell field="totalInvoiceAmount" sort={table.sort} onSort={table.toggleSort} align="right">Total Invoice Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="totalOutstanding" sort={table.sort} onSort={table.toggleSort} align="right">Total Outstanding (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="notDue" sort={table.sort} onSort={table.toggleSort} align="right">Current (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="d1to30" sort={table.sort} onSort={table.toggleSort} align="right">1 - 30 Days (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="d31to60" sort={table.sort} onSort={table.toggleSort} align="right">31 - 60 Days (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="d61to90" sort={table.sort} onSort={table.toggleSort} align="right">61 - 90 Days (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="above90" sort={table.sort} onSort={table.toggleSort} align="right">Above 90 Days (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="overdueAmount" sort={table.sort} onSort={table.toggleSort} align="right">Overdue (₹)</SortableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.customerCode} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" fontWeight={700} color="primary.main">{row.customerCode}</Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 150, whiteSpace: 'nowrap' }}>{row.customerName}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(row.totalInvoiceAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(row.totalOutstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(row.notDue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(row.d1to30 || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(row.d31to60 || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(row.d61to90 || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(row.above90 || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" fontWeight={700} color="error.main">
                          {Number(row.overdueAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && sortedRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11}>
                        {isFetching ? (
                          <LoadingState label="Loading…" />
                        ) : (
                          <EmptyState icon={<RequestQuoteOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No outstanding balances found'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Try adjusting your date range or filters'} />
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && sortedRows.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={3}><Typography fontWeight={700}>Total</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{Number(totals.totalInvoiceAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{Number(totals.totalOutstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{Number(totals.notDue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{Number(totals.d1to30 || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{Number(totals.d31to60 || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{Number(totals.d61to90 || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{Number(totals.above90 || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700} color="error.main">{Number(totals.overdue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Typography></TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollableTableContainer>
          )}

          <EntityListPagination total={sortedRows.length} page={page} onChange={setPage} pageSize={pageSize} onPageSizeChange={(v) => { setPageSize(v); setPage(0); }} />
        </CardContent>
      </Card>
    </Box>
  );
}
