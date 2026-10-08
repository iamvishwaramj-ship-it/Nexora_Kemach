import React, { useMemo, useState } from 'react';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import LoadingState from '../../../components/feedback/LoadingState';
import EmptyState from '../../../components/data-display/EmptyState';
import { useForm, FormProvider } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Card, CardContent, Stack, Grid, Chip, Table, TableBody, TableCell,
  TableHead, TableRow, Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
} from '@mui/material';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import dayjs from 'dayjs';
import FormSelect from '../../../components/form/FormSelect';
import FormDatePicker from '../../../components/form/FormDatePicker';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import CompanyBadge from '../../../components/common/CompanyBadge';
import EntityListPagination from '../../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../../components/data-display/useIsMobileListView';
import { customerApi, salesEmployeeApi } from '../../../features/resources';
import { useGetEnquiryRegisterReportQuery } from '../../../features/sales/enquiryRegisterReportApi';
import { ENQUIRY_SOURCE_OPTIONS, ENQUIRY_STATUS_OPTIONS } from '../../../lib/validation/salesSchemas';
import useTableFeatures from '../../../components/data-display/useTableFeatures';
import TableToolbar from '../../../components/data-display/TableToolbar';
import SortableHeaderCell from '../../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import TableFilterPanel from '../../../components/data-display/TableFilterPanel';
import ReportPrintable from '../../../components/print/ReportPrintable';
import { buildPrintFilters } from '../../../components/print/reportPrint';

const PAGE_SIZE = 10;

// Same status palette as the master Enquiry page (Enquiry.jsx) — reused
// here so a given status reads identically wherever it's shown in the app.
const STATUS_COLORS = {
  Open: 'warning',
  Closed: 'success',
};

const formatDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '—');

const DEFAULT_FILTERS = {
  fromDate: '', toDate: '', customerName: '', assignedTo: '', status: '', sourceOfEnquiry: '',
};

// Reports > Sales > Enquiry Register print layout — see ReportPrintable.jsx.
const PRINT_FILTER_LABELS = {
  fromDate: 'From Date', toDate: 'To Date', customerName: 'Customer', assignedTo: 'Salesperson',
  status: 'Status', sourceOfEnquiry: 'Source',
};
const PRINT_DATE_FIELDS = ['fromDate', 'toDate'];

export default function EnquiryRegister() {
  const navigate = useNavigate();
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
    ...ENQUIRY_STATUS_OPTIONS.map((s) => ({ label: s, value: s })),
  ]), []);

  const sourceOptions = useMemo(() => ([
    { label: 'All Sources', value: '' },
    ...ENQUIRY_SOURCE_OPTIONS.map((s) => ({ label: s, value: s })),
  ]), []);

  // Filter bar is a report toolbar, not a create/edit form — no Zod
  // validation or persisted mutation, same as CustomerOutstanding.jsx.
  const methods = useForm({
    defaultValues: { fromDate: null, toDate: null, customerName: '', assignedTo: '', status: '', sourceOfEnquiry: '' },
  });
  const { handleSubmit, reset } = methods;

  // The query params actually sent — only updated when "View Report" is
  // clicked (or on initial mount), not on every filter change.
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [viewRow, setViewRow] = useState(null);

  const { data, isLoading, isFetching } = useGetEnquiryRegisterReportQuery(appliedFilters);
  const baseTableRows = data?.rows || [];

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'enquiryNo', headerName: 'Enquiry No.', filter: 'text' },
    { field: 'enquiryDate', headerName: 'Enquiry Date', filter: 'dateRange', sortValue: (row) => (row.enquiryDate ? new Date(row.enquiryDate).getTime() : null), searchValue: (row) => formatDate(row.enquiryDate) },
    { field: 'customerName', headerName: 'Customer / Name', filter: 'text' },
    { field: 'assignedTo', headerName: 'Salesperson', filter: 'text' },
    { field: 'contactPerson', headerName: 'Contact Person', filter: 'text' },
    { field: 'mobileNo', headerName: 'Mobile No.', filter: 'text' },
    { field: 'sourceOfEnquiry', headerName: 'Source', filter: 'text' },
    { field: 'subject', headerName: 'Subject', filter: 'text' },
    { field: 'status', headerName: 'Status', filter: 'select' },
    { field: 'expectedClosureDate', headerName: 'Expected Close Date', filter: 'dateRange', sortValue: (row) => (row.expectedClosureDate ? new Date(row.expectedClosureDate).getTime() : null), searchValue: (row) => formatDate(row.expectedClosureDate) },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  // Print: full filtered/sorted rows (never just the current page), fed into
  // the shared ReportPrintable layout — see components/print/ReportPrintable.jsx.
  const printFilters = useMemo(
    () => buildPrintFilters(appliedFilters, PRINT_FILTER_LABELS, PRINT_DATE_FIELDS),
    [appliedFilters],
  );

  const onView = handleSubmit((values) => {
    setAppliedFilters({
      fromDate: values.fromDate ? dayjs(values.fromDate).format('YYYY-MM-DD') : '',
      toDate: values.toDate ? dayjs(values.toDate).format('YYYY-MM-DD') : '',
      customerName: values.customerName || '',
      assignedTo: values.assignedTo || '',
      status: values.status || '',
      sourceOfEnquiry: values.sourceOfEnquiry || '',
    });
    setPage(0);
  });

  const onReset = () => {
    reset({ fromDate: null, toDate: null, customerName: '', assignedTo: '', status: '', sourceOfEnquiry: '' });
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  const handleEdit = (row) => navigate('/sales/enquiry', { state: { enquiryNo: row.enquiryNo } });

  // Export: current filtered rows to CSV — a real client-side download,
  // matching the stub pattern used elsewhere (Enquiry.jsx/CustomerOutstanding.jsx).
  const EXPORT_COLUMNS = [
    ['enquiryNo', 'Enquiry No.'], ['enquiryDate', 'Enquiry Date'], ['customerName', 'Customer / Name'],
    ['assignedTo', 'Salesperson'], ['contactPerson', 'Contact Person'], ['mobileNo', 'Mobile No.'],
    ['sourceOfEnquiry', 'Source'], ['subject', 'Subject'], ['status', 'Status'], ['expectedClosureDate', 'Expected Close Date'],
  ];
  const handleExport = () => {
    const header = EXPORT_COLUMNS.map(([, label]) => label).join(',');
    const lines = baseTableRows.map((r) => EXPORT_COLUMNS.map(([key]) => {
      const v = key.toLowerCase().includes('date') ? formatDate(r[key]) : r[key];
      return `"${String(v ?? '').replace(/"/g, '""')}"`;
    }).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'enquiry-register.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<ListAltOutlinedIcon />}
        title="Enquiry Register"
        subtitle="View and manage all customer enquiries."
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
              {/* emptyValue="" — each of these carries an explicit "All ..."
                  option holding ''. Passing it here means an untouched or
                  cleared filter shows that option rather than an empty box,
                  which is what the report is actually doing in both cases. */}
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="customerName" label="Customer" options={customerOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="assignedTo" label="Salesperson" options={salespersonOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="status" label="Status" options={statusOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormSelect name="sourceOfEnquiry" label="Source" options={sourceOptions} emptyValue="" />
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

      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <TableToolbar
            title="Enquiry List"
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
                  title={row.enquiryNo}
                  statusChip={<Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />}
                  fields={[
                    { label: 'Enquiry Date', value: formatDate(row.enquiryDate) },
                    { label: 'Customer / Name', value: row.customerName || '—' },
                    { label: 'Salesperson', value: row.assignedTo || '—' },
                    { label: 'Contact Person', value: row.contactPerson || '—' },
                    { label: 'Mobile No.', value: row.mobileNo || '—' },
                    { label: 'Source', value: row.sourceOfEnquiry || '—' },
                    { label: 'Subject', value: row.subject || '—' },
                    { label: 'Expected Close Date', value: formatDate(row.expectedClosureDate) },
                  ]}
                  onView={() => setViewRow(row)}
                  onEdit={() => handleEdit(row)}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title="No enquiries found for the selected criteria" message="Try adjusting your date range or filters" />
                )
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width={48}>#</TableCell>
                    <SortableHeaderCell field="enquiryNo" sort={table.sort} onSort={table.toggleSort}>Enquiry No.</SortableHeaderCell>
                    <SortableHeaderCell field="enquiryDate" sort={table.sort} onSort={table.toggleSort}>Enquiry Date</SortableHeaderCell>
                    <SortableHeaderCell field="customerName" sort={table.sort} onSort={table.toggleSort}>Customer / Name</SortableHeaderCell>
                    <SortableHeaderCell field="assignedTo" sort={table.sort} onSort={table.toggleSort}>Salesperson</SortableHeaderCell>
                    <SortableHeaderCell field="contactPerson" sort={table.sort} onSort={table.toggleSort}>Contact Person</SortableHeaderCell>
                    <SortableHeaderCell field="mobileNo" sort={table.sort} onSort={table.toggleSort}>Mobile No.</SortableHeaderCell>
                    <SortableHeaderCell field="sourceOfEnquiry" sort={table.sort} onSort={table.toggleSort}>Source</SortableHeaderCell>
                    <SortableHeaderCell field="subject" sort={table.sort} onSort={table.toggleSort}>Subject</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <SortableHeaderCell field="expectedClosureDate" sort={table.sort} onSort={table.toggleSort}>Expected Close Date</SortableHeaderCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.enquiryNo}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.enquiryDate)}</TableCell>
                      <TableCell sx={{ minWidth: 160 }}>{row.customerName || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.assignedTo || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.contactPerson || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.mobileNo || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.sourceOfEnquiry || '—'}</TableCell>
                      <TableCell sx={{ minWidth: 180 }}>{row.subject || '—'}</TableCell>
                      <TableCell>
                        <Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.expectedClosureDate)}</TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          <IconButton size="small" onClick={() => setViewRow(row)} aria-label="view">
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleEdit(row)} aria-label="edit">
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={12}>
                        {isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title="No enquiries found for the selected criteria" message="Try adjusting your date range or filters" />
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
        <DialogTitle>Enquiry Details — {viewRow?.enquiryNo}</DialogTitle>
        <DialogContent dividers>
          {viewRow && (
            <Stack spacing={1.25}>
              {[
                ['Enquiry Date', formatDate(viewRow.enquiryDate)],
                ['Customer / Name', viewRow.customerName || '—'],
                ['Salesperson', viewRow.assignedTo || '—'],
                ['Contact Person', viewRow.contactPerson || '—'],
                ['Mobile No.', viewRow.mobileNo || '—'],
                ['Email ID', viewRow.emailId || '—'],
                ['Source', viewRow.sourceOfEnquiry || '—'],
                ['Subject', viewRow.subject || '—'],
                ['Status', viewRow.status || '—'],
                ['Expected Close Date', formatDate(viewRow.expectedClosureDate)],
                ['Remarks', viewRow.remarks || '—'],
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
        title="Enquiry Register"
        subtitle="View and manage all customer enquiries."
        filters={printFilters}
        columns={tableColumns}
        // Print uses the base (unsearched/unfiltered-by-popover) rows so it
        // always reflects the full Filters-section result, not whatever the
        // quick search box or column filter popover currently narrows to.
        rows={baseTableRows}
        orientation="landscape"
      />
    </Box>
  );
}
