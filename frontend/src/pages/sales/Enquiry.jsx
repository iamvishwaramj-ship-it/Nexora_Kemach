import React, { useEffect, useMemo, useState } from 'react';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import {
  Box, Typography, Button, Card, CardContent, Stack, TextField, Grid, Table, TableBody,
  TableCell, TableHead, TableRow, TableSortLabel, Chip, IconButton, Collapse, Menu, MenuItem,
  ListItemIcon, ListItemText, Tooltip, alpha, Dialog, DialogTitle, DialogContent,
  DialogActions, InputAdornment, RadioGroup, FormControlLabel, Radio, List, ListItemButton,
  ListItemText as MuiListItemText, CircularProgress,
} from '@mui/material';
import ContactMailOutlinedIcon from '@mui/icons-material/ContactMailOutlined';
import AddIcon from '@mui/icons-material/Add';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import SendIcon from '@mui/icons-material/Send';
import SaveIcon from '@mui/icons-material/SaveOutlined';
import { useFormContext, Controller } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
import DocumentSeriesNoField from '../../components/form/DocumentSeriesNoField';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import useDragScroll from '../../components/data-display/useDragScroll';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { getStateOptions } from '../../lib/constants/locations';
import { getCityOptions } from '../../lib/constants/locationsCities';
import {
  enquirySchema, ENQUIRY_SOURCE_OPTIONS, ENQUIRY_TYPE_OPTIONS, ENQUIRY_PRIORITY_OPTIONS, ENQUIRY_STATUS_OPTIONS,
} from '../../lib/validation/salesSchemas';
import { enquiryApi, customerApi } from '../../features/resources';
import { useBranchNameOptions } from '../../lib/useBranchOptions';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

import { CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';
import RouteMapButton from '../../components/common/RouteMapButton';
import RouteMapContextMenu from '../../components/common/RouteMapContextMenu';
const toOptions = (arr) => arr.map((v) => ({ label: v, value: v }));
const YES_NO_OPTIONS = [{ label: 'Yes', value: 'Yes' }, { label: 'No', value: 'No' }];

// Expected Budget is presented as a range picker in the design rather than a
// raw number field. The underlying schema/DB column stays a plain Decimal,
// so each range stores a representative numeric value; nearestBudgetOption
// maps a saved number back to the range it falls in when editing.
const BUDGET_RANGES = [
  { label: 'Under 50,000', value: 25000, max: 50000 },
  { label: '50,000 - 1,00,000', value: 75000, min: 50000, max: 100000 },
  { label: '1,00,000 - 5,00,000', value: 300000, min: 100000, max: 500000 },
  { label: '5,00,000 - 10,00,000', value: 750000, min: 500000, max: 1000000 },
  { label: 'Above 10,00,000', value: 1500000, min: 1000000 },
];

function nearestBudgetOption(value) {
  const n = Number(value);
  if (!n) return '';
  const inRange = BUDGET_RANGES.find((r) => (r.min == null || n >= r.min) && (r.max == null || n < r.max));
  if (inRange) return inRange.value;
  return BUDGET_RANGES.reduce((best, r) => (Math.abs(r.value - n) < Math.abs(best.value - n) ? r : best)).value;
}

// A Yes/No pair rendered as radio buttons (design has these instead of
// dropdowns for Installation Required / AMC Required).
// Label is rendered by the wrapping LabeledField (align="center"), not here —
// this renders only the radio group itself.
function YesNoRadioField({ name }) {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <RadioGroup row {...field} value={field.value || 'No'}>
          <FormControlLabel value="Yes" control={<Radio size="small" />} label="Yes" />
          <FormControlLabel value="No" control={<Radio size="small" />} label="No" />
        </RadioGroup>
      )}
    />
  );
}

// Open (still awaiting a quotation) amber, Closed (quoted) green. Set by the
// server — see recomputeEnquiryStatus in backend utils/documentFlow.js — so
// there is no status control on the form, only this chip in the list.
const STATUS_COLORS = {
  Open: 'warning',
  Closed: 'success',
};

const emptyValues = {
  enquiryNo: '', seriesId: '', branch: '', enquiryDate: null, sourceOfEnquiry: '', enquiryType: '', priority: '', subject: '', referenceCampaign: '',
  customerName: '', contactPerson: '', mobileNo: '', emailId: '', address: '', country: 'India', city: '', state: '', pinCode: '',
  requirementDescription: '', expectedBudget: '', expectedClosureDate: null, noOfLocations: '', productServiceInterest: '',
  installationRequired: 'No', amcRequired: 'No',
  existingSetup: 'No', competitorDiscussed: 'No', competitorName: '', hearAboutUs: '', remarks: '',
  status: 'Open', assignedTo: '',
};

const PAGE_SIZE = 10;

// Wider than the shared FIELD_LABEL_WIDTH default — this form's longest
// labels ("Product / Service Interest", "How did you hear about us?") would
// otherwise wrap onto a second line against the default column width.
const ENQUIRY_LABEL_WIDTH = 220;

const formatDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '—');

// Numbered circular badge + title, matching the design's 1/2/3/4 section
// headers (Enquiry Information, Customer Information, Requirement Details,
// Additional Information).
function SectionHeader({ number, title }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
      <Box sx={{
        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: 'primary.main', color: 'primary.contrastText', fontSize: 14, fontWeight: 700,
      }}>
        {number}
      </Box>
      <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
      <Box sx={{ flexGrow: 1, borderBottom: '1px solid', borderColor: 'divider' }} />
    </Stack>
  );
}

const ENQUIRY_LIST_TABLE_ROW_HEIGHT = 0;
const ENQUIRY_LIST_TABLE_CELL_PADDING_Y = 6;
// initialShowForm: the /sales/enquiry/new route ("New Enquiry" card) opens
// the page with the create form already expanded.
export default function Enquiry({ initialShowForm = false, openDocNo } = {}) {
  const navigate = useNavigate();
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const { data: enquiries, isLoading } = enquiryApi.useList();
  const { data: customers } = customerApi.useList();
  const [create, { isLoading: creating }] = enquiryApi.useCreate();
  const [update, { isLoading: updating }] = enquiryApi.useUpdate();
  const [remove] = enquiryApi.useDelete();

  const [showForm, setShowForm] = useState(initialShowForm);
  const [editingRow, setEditingRow] = useState(null);
  // View opens the same form as Edit but locked -- see handleView/handleEdit
  // below and AppForm's readOnly prop, which disables every field and drops
  // the Save/Submit buttons.
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  // Which top action button was clicked: 'save' keeps the enquiry at its
  // current/'New' status, 'submit' advances it to 'In Progress'.
  const [pendingAction, setPendingAction] = useState('save');

  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [sourceFilter, setSourceFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');
  // Enquiry Date column sort direction (mockup's sortable date column).
  const [dateSort, setDateSort] = useState('desc');
  const [search, setSearch] = useState('');

  const [rowMenuAnchor, setRowMenuAnchor] = useState(null);
  const [rowMenuTarget, setRowMenuTarget] = useState(null);
  const [exportAnchor, setExportAnchor] = useState(null);

  // Customer Name field's search (pick existing customer) icon button,
  // matching the design. The add (+) icon navigates to the Customer Master
  // create page instead of a quick-add popup.
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  const rows = enquiries || [];

  const assignedToOptions = useMemo(
    () => toOptions([...new Set(rows.map((r) => r.assignedTo).filter(Boolean))]),
    [rows]
  );

  const { options: branchOptions } = useBranchNameOptions({ currentValue: editingRow?.branch });

  // Text search is handled by useTableFeatures (it covers every column);
  // what remains here are the page's own dropdown/date filters.
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchesSource = !sourceFilter || r.sourceOfEnquiry === sourceFilter;
      const matchesType = !typeFilter || r.enquiryType === typeFilter;
      const matchesStatus = !statusFilter || r.status === statusFilter;
      const matchesAssigned = !assignedFilter || r.assignedTo === assignedFilter;
      const d = r.enquiryDate ? dayjs(r.enquiryDate) : null;
      const matchesFrom = !dateFrom || (d && !d.isBefore(dayjs(dateFrom), 'day'));
      const matchesTo = !dateTo || (d && !d.isAfter(dayjs(dateTo), 'day'));
      return matchesSource && matchesType && matchesStatus && matchesAssigned && matchesFrom && matchesTo;
    });
  }, [rows, sourceFilter, typeFilter, statusFilter, assignedFilter, dateFrom, dateTo]);

  const baseTableRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const da = a.enquiryDate ? new Date(a.enquiryDate).getTime() : 0;
      const db = b.enquiryDate ? new Date(b.enquiryDate).getTime() : 0;
      return dateSort === 'asc' ? da - db : db - da;
    });
  }, [filteredRows, dateSort]);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'enquiryNo', headerName: 'Enquiry No.', filter: 'text' },
    { field: 'enquiryDate', headerName: 'Enquiry Date', filter: 'dateRange', sortValue: (row) => (row.enquiryDate ? new Date(row.enquiryDate).getTime() : null), searchValue: (row) => formatDate(row.enquiryDate) },
    { field: 'customerName', headerName: 'Customer Name', filter: 'text' },
    { field: 'mobileNo', headerName: 'Mobile No.', filter: 'text' },
    { field: 'subject', headerName: 'Subject/Requirement', filter: 'text' },
    { field: 'sourceOfEnquiry', headerName: 'Source', filter: 'text' },
    { field: 'enquiryType', headerName: 'Enquiry Type', filter: 'text' },
    { field: 'status', headerName: 'Status', filter: 'select' },
    { field: 'assignedTo', headerName: 'Assigned To', filter: 'text' },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const sortedRows = table.rows;

  const pagedRows = useMemo(
    () => sortedRows.slice(page * pageSize, page * pageSize + pageSize),
    [sortedRows, page, pageSize]
  );

  // Bottom stat cards — computed client-side from the list query's data,
  // not a separate endpoint (see tempmem.md section 7's guidance on noting
  // computed/proxied fields).
  const stats = useMemo(() => {
    const total = rows.length;
    const countFor = (status) => rows.filter((r) => r.status === status).length;
    const pct = (n) => (total === 0 ? '0.00' : ((n / total) * 100).toFixed(2));
    return ENQUIRY_STATUS_OPTIONS.map((status) => ({ status, count: status === 'Total' ? total : countFor(status), pct: pct(countFor(status)) }))
      .reduce((acc, s) => { acc[s.status] = s; return acc; }, { Total: { status: 'Total', count: total, pct: '100.00' } });
  }, [rows]);

  const resetFilters = () => {
    setDateFrom(null); setDateTo(null);
    setSourceFilter(''); setTypeFilter(''); setStatusFilter(''); setAssignedFilter('');
    setPage(0);
  };

  useEffect(() => { setPage(0); }, [sourceFilter, typeFilter, statusFilter, assignedFilter, dateFrom, dateTo]);

  const openCreate = () => {
    setEditingRow(null);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRow(null);
    setReadOnly(false);
  };

  const handleToggleForm = () => (showForm ? closeForm() : openCreate());

  const handleEdit = (row) => {
    setEditingRow(row);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    setShowForm(true);
    setRowMenuAnchor(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Same form as Edit, but locked -- see AppForm's readOnly prop below.
  const handleView = (row) => {
    setEditingRow(row);
    setReadOnly(true);
    setFormKey((k) => k + 1);
    setShowForm(true);
    setRowMenuAnchor(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Opened from the Route Map's document preview popup: jump straight into
  // this record's own read-only View, exactly as clicking it in the list
  // would, instead of requiring the user to find and click the row.
  useEffect(() => {
    if (!openDocNo) return;
    if (editingRow && editingRow.enquiryNo === openDocNo) return;
    const match = rows.find((r) => r.enquiryNo === openDocNo);
    if (match) handleView(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDocNo, rows]);

  const handleDelete = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Delete enquiry',
      message: `Are you sure you want to delete enquiry "${row.enquiryNo}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Enquiry deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, status, setError) => {
    const payload = status ? { ...values, status } : values;
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Enquiry updated');
      } else {
        await create(payload).unwrap();
        notify.success(status === 'Follow-up' ? 'Enquiry submitted' : 'Enquiry saved');
      }
      closeForm();
    } catch (err) {
      notify.error(applyServerErrors(err, setError));
    }
  };

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    return (customers || []).filter((c) => !q || [c.customerName, c.customerCode, c.phone].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [customers, customerSearch]);

  // setValue is the enquiry form's own RHF setter, passed in directly from
  // the AppForm render-prop's closure at the call site — never lifted into
  // component state (setting state unconditionally during another
  // component's render causes an infinite render loop).
  const applyCustomer = (c, setValue) => {
    const fields = {
      customerName: c.customerName || '', contactPerson: c.contactPerson || '', mobileNo: c.phone || '',
      emailId: c.email || '', address: c.billingAddress || '', city: c.city || '', state: c.state || '',
    };
    Object.entries(fields).forEach(([key, val]) => setValue(key, val, { shouldValidate: true }));
    setCustomerPickerOpen(false);
    setCustomerSearch('');
  };

  // Export: current filtered rows to CSV — a real client-side download, not
  // decorative. Import: reads a CSV back and creates one enquiry per row,
  // matching columns by header name.
  const EXPORT_COLUMNS = [
    ['enquiryNo', 'Enquiry No.'], ['enquiryDate', 'Enquiry Date'], ['customerName', 'Customer Name'],
    ['mobileNo', 'Mobile No.'], ['subject', 'Subject/Requirement'], ['sourceOfEnquiry', 'Source'],
    ['enquiryType', 'Enquiry Type'], ['status', 'Status'], ['assignedTo', 'Assigned To'],
  ];

  const handleExport = () => {
    const header = EXPORT_COLUMNS.map(([, label]) => label).join(',');
    const lines = filteredRows.map((r) => EXPORT_COLUMNS.map(([key]) => `"${String(r[key] ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'enquiries.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const [headerLine, ...lines] = text.trim().split(/\r?\n/);
      const headers = headerLine.split(',').map((h) => h.replace(/"/g, '').trim());
      const keyByLabel = Object.fromEntries(EXPORT_COLUMNS.map(([key, label]) => [label, key]));
      let created = 0;
      for (const line of lines) {
        if (!line.trim()) continue;
        const cells = line.split(',').map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"'));
        const payload = {};
        headers.forEach((h, i) => {
          const key = keyByLabel[h];
          if (key) payload[key] = cells[i] || '';
        });
        if (!payload.enquiryNo) continue;
        // eslint-disable-next-line no-await-in-loop
        await create({ status: 'Open', ...payload }).unwrap();
        created += 1;
      }
      notify.success(`Imported ${created} enquiries`);
    } catch (err) {
      notify.error('Import failed — check the CSV format');
    }
  };

  if (openDocNo && (!editingRow || editingRow.enquiryNo !== openDocNo)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box>
      <EntityHeaderCard
        icon={<ContactMailOutlinedIcon />}
        title="Enquiry"
        subtitle="Track and manage incoming sales enquiries end to end."
        rightContent={<CompanyBadge />}
      />

      <Stack direction="row" justifyContent="flex-end" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<FileDownloadOutlinedIcon />}
          endIcon={<ArrowDropDownIcon />}
          onClick={(e) => setExportAnchor(e.currentTarget)}
        >
          Export
        </Button>
        <Menu anchorEl={exportAnchor} open={!!exportAnchor} onClose={() => setExportAnchor(null)}>
          <MenuItem onClick={() => { handleExport(); setExportAnchor(null); }}>
            <ListItemIcon><FileDownloadOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Export as CSV</ListItemText>
          </MenuItem>
        </Menu>
        <Button variant="outlined" color="inherit" component="label" startIcon={<FileUploadOutlinedIcon />}>
          Import
          <input type="file" accept=".csv" hidden onChange={handleImportFile} />
        </Button>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<FilterListIcon />}
          onClick={() => setShowFilters((s) => !s)}
        >
          Filter
        </Button>
        <Button variant="contained" startIcon={showForm ? <CloseIcon /> : <AddIcon />} onClick={handleToggleForm}>
          {showForm ? 'Close' : 'New Enquiry'}
        </Button>
      </Stack>

      <Collapse in={showForm} unmountOnExit>
        <Box sx={{ mb: 2 }}>

          <Card variant="outlined">
            <CardContent sx={{ p: 3 }}>
              <RouteMapContextMenu flow="sales" type="enquiry" docNo={editingRow?.enquiryNo}>
                <AppForm
                  id="enquiry-form"
                  key={formKey}
                  readOnly={readOnly}
                  schema={enquirySchema}
                  defaultValues={editingRow
                    ? { ...emptyValues, ...editingRow, expectedBudget: nearestBudgetOption(editingRow.expectedBudget) }
                    // enquiryDate defaults to today — new Date() here (not baked
                    // into the module-level emptyValues) so a session left open
                    // past midnight still gets the actual current date on the
                    // next "New Enquiry" click, not whatever date the page
                    // happened to load on.
                    : { ...emptyValues, enquiryDate: new Date() }}
                  onSubmit={(values, methods) => {
                    const status = pendingAction === 'submit'
                      ? (editingRow ? editingRow.status : 'In Progress')
                      : (editingRow ? editingRow.status : 'New');
                    handleSubmit(values, status, methods.setError);
                  }}
                >
                  {({ watch, setValue }) => {
                    const country = watch('country') || 'India';
                    const state = watch('state');

                    return (
                      <>
                        <SectionHeader number={1} title="Enquiry Information" />
                        <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                          <LabeledField label="Branch *" labelWidth={ENQUIRY_LABEL_WIDTH}>
                            <FormSelect name="branch" label="" placeholder="Select branch" options={branchOptions} />
                          </LabeledField>
                          <LabeledField label="Enquiry No. *" labelWidth={ENQUIRY_LABEL_WIDTH}>
                            <DocumentSeriesNoField documentCode="ENQ" seriesFieldName="seriesId" numberFieldName="enquiryNo" isCreate={!editingRow} />
                          </LabeledField>

                          <LabeledField label="Enquiry Date *" labelWidth={ENQUIRY_LABEL_WIDTH}>
                            <FormDatePicker name="enquiryDate" label="" />
                          </LabeledField>
                          <LabeledField label="Source of Enquiry *" labelWidth={ENQUIRY_LABEL_WIDTH}>
                            <FormSelect name="sourceOfEnquiry" label="" placeholder="Select source" options={toOptions(ENQUIRY_SOURCE_OPTIONS)} />
                          </LabeledField>
                          <LabeledField label="Enquiry Type" labelWidth={ENQUIRY_LABEL_WIDTH}>
                            <FormSelect name="enquiryType" label="" placeholder="Select type" options={toOptions(ENQUIRY_TYPE_OPTIONS)} />
                          </LabeledField>
                          <LabeledField label="Priority" labelWidth={ENQUIRY_LABEL_WIDTH}>
                            <FormSelect name="priority" label="" placeholder="Select priority" options={toOptions(ENQUIRY_PRIORITY_OPTIONS)} />
                          </LabeledField>
                          <LabeledField label="Subject / Requirement *" labelWidth={ENQUIRY_LABEL_WIDTH}>
                            <FormTextField name="subject" label="" placeholder="Enter subject or requirement" />
                          </LabeledField>
                          <LabeledField label="Reference / Campaign" labelWidth={ENQUIRY_LABEL_WIDTH}>
                            <FormTextField name="referenceCampaign" label="" placeholder="Enter reference or campaign" />
                          </LabeledField>
                        </FormGrid>

                        <Box sx={{ mt: 4 }}>
                          <SectionHeader number={2} title="Customer Information" />
                        </Box>
                        <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                          <LabeledField label="Customer Name *" labelWidth={ENQUIRY_LABEL_WIDTH}>
                            <FormTextField
                              name="customerName"
                              label=""
                              placeholder="Enter customer name"
                              InputProps={{
                                endAdornment: (
                                  <InputAdornment position="end">
                                    <Stack direction="row" spacing={0.25}>
                                      <Tooltip title="Find existing customer">
                                        <IconButton size="small" edge="end" onClick={() => setCustomerPickerOpen(true)}>
                                          <SearchIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title="Add new customer">
                                        {/* Customer Master is retired — Business Partner is now where a new
                                          customer/vendor record is added; pick "Customer" as its Partner
                                          Type in the form that opens. */}
                                        <IconButton size="small" edge="end" onClick={() => navigate('/partner/business-partner/create', { state: { openAdd: true } })}>
                                          <AddIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    </Stack>
                                  </InputAdornment>
                                ),
                              }}
                            />
                          </LabeledField>
                          <LabeledField label="Contact Person *" labelWidth={ENQUIRY_LABEL_WIDTH}>
                            <FormTextField name="contactPerson" label="" placeholder="Enter contact person" />
                          </LabeledField>
                          <LabeledField label="Mobile No. *" labelWidth={ENQUIRY_LABEL_WIDTH}>
                            <FormTextField name="mobileNo" label="" placeholder="Enter mobile number" digitsOnly maxLength={10} />
                          </LabeledField>
                          <LabeledField label="Email ID" labelWidth={ENQUIRY_LABEL_WIDTH}>
                            <FormTextField name="emailId" label="" placeholder="Enter email address" />
                          </LabeledField>
                          <LabeledField label="Address" labelWidth={ENQUIRY_LABEL_WIDTH}>
                            <FormTextField name="address" label="" placeholder="Enter full address" />
                          </LabeledField>
                          <LabeledField label="State" labelWidth={ENQUIRY_LABEL_WIDTH}>
                            <FormSelect name="state" label="" placeholder="Select state" options={getStateOptions(country)} />
                          </LabeledField>
                          <LabeledField label="City" labelWidth={ENQUIRY_LABEL_WIDTH}>
                            <FormSelect name="city" label="" placeholder="Select city" options={getCityOptions(country, state)} />
                          </LabeledField>
                          <LabeledField label="PIN Code" labelWidth={ENQUIRY_LABEL_WIDTH}>
                            <FormTextField name="pinCode" label="" placeholder="Enter PIN code" digitsOnly maxLength={6} />
                          </LabeledField>
                        </FormGrid>

                        <Box sx={{ mt: 4 }}>
                          <SectionHeader number={3} title="Requirement Details" />
                        </Box>
                        <FormGrid columns={1} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                          <LabeledField label="Requirement / Description *" labelWidth={ENQUIRY_LABEL_WIDTH}>
                            <FormTextField name="requirementDescription" label="" placeholder="Describe the requirement" multiline rows={4} />
                          </LabeledField>
                        </FormGrid>
                        <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                          <LabeledField label="Expected Budget" labelWidth={ENQUIRY_LABEL_WIDTH}>
                            <FormSelect
                              name="expectedBudget"
                              label=""
                              placeholder="Select range"
                              options={BUDGET_RANGES.map((r) => ({ label: r.label, value: r.value }))}
                            />
                          </LabeledField>
                          <LabeledField label="Expected Closure Date" labelWidth={ENQUIRY_LABEL_WIDTH}>
                            <FormDatePicker name="expectedClosureDate" label="" />
                          </LabeledField>
                          <LabeledField label="Product / Service Interest" labelWidth={ENQUIRY_LABEL_WIDTH}>
                            <FormTextField name="productServiceInterest" label="" placeholder="Enter product or service" />
                          </LabeledField>
                          <LabeledField label="Installation Required" labelWidth={ENQUIRY_LABEL_WIDTH} align="center">
                            <YesNoRadioField name="installationRequired" />
                          </LabeledField>
                          <LabeledField label="AMC Required" labelWidth={ENQUIRY_LABEL_WIDTH} align="center">
                            <YesNoRadioField name="amcRequired" />
                          </LabeledField>
                        </FormGrid>

                        <Box sx={{ mt: 4 }}>
                          <SectionHeader number={4} title="Additional Information" />
                        </Box>
                        <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                          <LabeledField label="Existing Setup" labelWidth={ENQUIRY_LABEL_WIDTH}>
                            <FormSelect name="existingSetup" label="" options={YES_NO_OPTIONS} />
                          </LabeledField>
                          <LabeledField label="Competitor Discussed" labelWidth={ENQUIRY_LABEL_WIDTH}>
                            <FormSelect name="competitorDiscussed" label="" options={YES_NO_OPTIONS} />
                          </LabeledField>
                          <LabeledField label="Competitor Name" labelWidth={ENQUIRY_LABEL_WIDTH}>
                            <FormTextField name="competitorName" label="" placeholder="Enter competitor name" />
                          </LabeledField>
                          <LabeledField label="How did you hear about us?" labelWidth={ENQUIRY_LABEL_WIDTH}>
                            <FormSelect
                              name="hearAboutUs"
                              label=""
                              placeholder="Select source"
                              options={toOptions(['Google Search', 'Social Media', 'Referral', 'Advertisement', 'Existing Customer', 'Other'])}
                            />
                          </LabeledField>
                        </FormGrid>
                        <FormGrid columns={1} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                          <LabeledField label="Remarks" labelWidth={ENQUIRY_LABEL_WIDTH}>
                            <FormTextField name="remarks" label="" placeholder="Enter remarks" multiline rows={3} />
                          </LabeledField>
                        </FormGrid>

                        <Stack direction="row" justifyContent="flex-end" spacing={1.5} sx={{ mt: 3 }}>
                          <Button variant="outlined" color="inherit" startIcon={<CloseIcon />} onClick={closeForm} disabled={creating || updating}>
                            Cancel
                          </Button>
                          <FormSubmitButton
                            color="warning"
                            startIcon={<SaveIcon />}
                            form="enquiry-form"
                            onClick={() => setPendingAction('save')}
                            disabled={creating || updating}
                            loading={creating || updating}
                          >
                            Save
                          </FormSubmitButton>
                          <FormSubmitButton
                            sx={{ bgcolor: 'grey.900', '&:hover': { bgcolor: 'grey.800' } }}
                            startIcon={<SendIcon />}
                            form="enquiry-form"
                            onClick={() => setPendingAction('submit')}
                            disabled={creating || updating}
                            loading={creating || updating}
                          >
                            Save &amp; Submit
                          </FormSubmitButton>
                        </Stack>

                        <Dialog open={customerPickerOpen} onClose={() => setCustomerPickerOpen(false)} maxWidth="sm" fullWidth>
                          <DialogTitle>Find Existing Customer</DialogTitle>
                          <DialogContent dividers sx={{ p: 0 }}>
                            <Box sx={{ p: 2 }}>
                              <TextField
                                size="small"
                                fullWidth
                                autoFocus
                                placeholder="Search by name, code or phone..."
                                value={customerSearch}
                                onChange={(e) => setCustomerSearch(e.target.value)}
                                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                              />
                            </Box>
                            <List sx={{ maxHeight: 360, overflowY: 'auto', pt: 0 }}>
                              {filteredCustomers.map((c) => (
                                <ListItemButton key={c.id} onClick={() => applyCustomer(c, setValue)}>
                                  <MuiListItemText
                                    primary={`${c.customerName} (${c.customerCode})`}
                                    secondary={[c.phone, c.email].filter(Boolean).join(' · ') || '—'}
                                  />
                                </ListItemButton>
                              ))}
                              {filteredCustomers.length === 0 && (
                                <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title="No customers found" />
                              )}
                            </List>
                          </DialogContent>
                          <DialogActions>
                            <Button onClick={() => setCustomerPickerOpen(false)} color="inherit">Close</Button>
                          </DialogActions>
                        </Dialog>
                      </>
                    );
                  }}
                </AppForm>
              </RouteMapContextMenu>
            </CardContent>
          </Card>
        </Box>
      </Collapse>

      <Collapse in={showFilters} unmountOnExit>
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Quick Filters</Typography>
            {/* Quick filter controls are plain state, not RHF-bound (no submit) */}
            <Grid container spacing={{ xs: 1, sm: 2 }}>
              <Grid item xs={12} sm={6} md={2.8}>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Date Range</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    size="small" fullWidth type="date"
                    value={dateFrom || ''} onChange={(e) => { setDateFrom(e.target.value || null); setPage(0); }}
                  />
                  <Typography variant="body2" color="text.secondary">–</Typography>
                  <TextField
                    size="small" fullWidth type="date"
                    value={dateTo || ''} onChange={(e) => { setDateTo(e.target.value || null); setPage(0); }}
                  />
                </Stack>
              </Grid>
              <Grid item xs={12} sm={6} md={1.8}>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Source</Typography>
                <TextField
                  select size="small" fullWidth value={sourceFilter}
                  onChange={(e) => { setSourceFilter(e.target.value); setPage(0); }} SelectProps={{ native: true }}
                >
                  <option value="">All Sources</option>
                  {ENQUIRY_SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6} md={1.8}>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Enquiry Type</Typography>
                <TextField
                  select size="small" fullWidth value={typeFilter}
                  onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }} SelectProps={{ native: true }}
                >
                  <option value="">All Types</option>
                  {ENQUIRY_TYPE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6} md={1.8}>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Status</Typography>
                <TextField
                  select size="small" fullWidth value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} SelectProps={{ native: true }}
                >
                  <option value="">All Status</option>
                  {ENQUIRY_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6} md={1.8}>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Assigned To</Typography>
                <TextField
                  select size="small" fullWidth value={assignedFilter}
                  onChange={(e) => { setAssignedFilter(e.target.value); setPage(0); }} SelectProps={{ native: true }}
                >
                  <option value="">All Users</option>
                  {assignedToOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>&nbsp;</Typography>
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" size="small" onClick={() => setPage(0)} fullWidth>Search</Button>
                  <Button variant="outlined" color="inherit" size="small" onClick={resetFilters} fullWidth>Reset</Button>
                </Stack>
              </Grid>
            </Grid>
            <TableFilterPanel table={table} embedded open />
          </CardContent>
        </Card>
      </Collapse>

      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Enquiry List</Typography>
            <TableSearchFilter table={table} placeholder="Search enquiries..." width={220} showFilter={false} />
          </Stack>

          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {!isLoading && pagedRows.map((row) => (
                <MobileRecordCard
                  key={row.id}
                  title={row.enquiryNo}
                  statusChip={<Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />}
                  fields={[
                    { label: 'Enquiry Date', value: formatDate(row.enquiryDate) },
                    { label: 'Customer Name', value: row.customerName || '—' },
                    { label: 'Mobile No.', value: row.mobileNo || '—' },
                    { label: 'Subject', value: row.subject || '—' },
                    { label: 'Source', value: row.sourceOfEnquiry || '—' },
                    { label: 'Assigned To', value: row.assignedTo || '—' },
                  ]}
                  onView={() => handleView(row)}
                  onEdit={() => handleEdit(row)}
                  onDelete={() => handleDelete(row)}
                />
              ))}
              {!isLoading && filteredRows.length === 0 && (
                <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No enquiries found'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first enquiry to get started'} />
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table
                size="small"
                stickyHeader
                sx={{
                  '& th, & td': {
                    height: ENQUIRY_LIST_TABLE_ROW_HEIGHT,
                    paddingTop: `${ENQUIRY_LIST_TABLE_CELL_PADDING_Y}px`,
                    paddingBottom: `${ENQUIRY_LIST_TABLE_CELL_PADDING_Y}px`,
                    boxSizing: 'border-box',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <SortableHeaderCell field="enquiryNo" sort={table.sort} onSort={table.toggleSort}>Enquiry No.</SortableHeaderCell>
                    <SortableHeaderCell field="enquiryDate" sort={table.sort} onSort={table.toggleSort} sortDirection={dateSort}>
                      <TableSortLabel
                        active
                        direction={dateSort}
                        onClick={() => { setDateSort((d) => (d === 'asc' ? 'desc' : 'asc')); setPage(0); }}
                        // TableSortLabel's own up/down arrow duplicated the
                        // up/down icon SortableHeaderCell already renders for
                        // every column, showing two arrows on this one header.
                        // Suppress TableSortLabel's icon so this column shows
                        // the same single icon as every other one.
                        IconComponent={() => null}
                        // TableSortLabel's `active` state hard-codes
                        // text.primary (near-black) for its label, which
                        // reads fine on a plain background but goes
                        // invisible-on-dark on this header's colored
                        // background in light mode. Every sibling header
                        // stays legible via color:'inherit' (see
                        // SortableHeaderCell) — force the same here so this
                        // column matches instead of going dark.
                        sx={{
                          color: 'inherit',
                          '&.Mui-active': { color: 'inherit' },
                        }}
                      >
                        Enquiry Date
                      </TableSortLabel>
                    </SortableHeaderCell>
                    <SortableHeaderCell field="customerName" sort={table.sort} onSort={table.toggleSort}>Customer Name</SortableHeaderCell>
                    <SortableHeaderCell field="mobileNo" sort={table.sort} onSort={table.toggleSort}>Mobile No.</SortableHeaderCell>
                    <SortableHeaderCell field="subject" sort={table.sort} onSort={table.toggleSort}>Subject/Requirement</SortableHeaderCell>
                    <SortableHeaderCell field="sourceOfEnquiry" sort={table.sort} onSort={table.toggleSort}>Source</SortableHeaderCell>
                    <SortableHeaderCell field="enquiryType" sort={table.sort} onSort={table.toggleSort}>Enquiry Type</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <SortableHeaderCell field="assignedTo" sort={table.sort} onSort={table.toggleSort}>Assigned To</SortableHeaderCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          color="primary.main"
                          onClick={() => handleView(row)}
                          sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                        >
                          {row.enquiryNo}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.enquiryDate)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.customerName || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.mobileNo || '—'}</TableCell>
                      <TableCell sx={{ maxWidth: 240 }}>{row.subject || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.sourceOfEnquiry || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.enquiryType || '—'}</TableCell>
                      <TableCell>
                        <Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.assignedTo || '—'}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="View">
                            <IconButton size="small" onClick={() => handleView(row)} aria-label="view">
                              <VisibilityOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <RouteMapButton flow="sales" type="enquiry" docNo={row.enquiryNo} />
                          <IconButton
                            size="small"
                            onClick={(e) => { setRowMenuAnchor(e.currentTarget); setRowMenuTarget(row); }}
                            aria-label="more actions"
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && filteredRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10}>
                        <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No enquiries found'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first enquiry to get started'} />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollableTableContainer>
          )}

          <Menu anchorEl={rowMenuAnchor} open={!!rowMenuAnchor} onClose={() => setRowMenuAnchor(null)}>
            <CanEdit>
              <MenuItem onClick={() => handleEdit(rowMenuTarget)}>
                <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Edit</ListItemText>
              </MenuItem>
            </CanEdit>
            <CanDelete>
              <MenuItem onClick={() => handleDelete(rowMenuTarget)}>
                <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                <ListItemText>Delete</ListItemText>
              </MenuItem>
            </CanDelete>
          </Menu>

          <EntityListPagination total={filteredRows.length} page={page} onChange={setPage} pageSize={pageSize} onPageSizeChange={(v) => { setPageSize(v); setPage(0); }} />
        </CardContent>
      </Card>

      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        {[
          // Enquiry status is Open/Closed now — Closed meaning a Sales
          // Quotation has been raised against it. The six cards that used to
          // sit here (New / In Progress / Quotation Sent / Converted /
          // Closed - Lost) counted buckets that no longer exist and would all
          // have read zero.
          { label: 'Total Enquiries', key: 'Total', color: 'primary', icon: <DescriptionOutlinedIcon fontSize="small" />, caption: 'This Period' },
          { label: 'Open', key: 'Open', color: 'warning', icon: <AddCircleOutlineIcon fontSize="small" />, caption: 'Awaiting Quotation' },
          { label: 'Closed', key: 'Closed', color: 'success', icon: <CheckCircleOutlineIcon fontSize="small" />, caption: 'Quoted' },
        ].map((s) => {
          const stat = stats[s.key] || { count: 0, pct: '0.00' };
          return (
            <Grid item xs={12} sm={4} md={4} key={s.key}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent sx={{ py: 2 }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <Box sx={{
                      width: 32, height: 32, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      bgcolor: (theme) => alpha(theme.palette[s.color].main, 0.14),
                      color: `${s.color}.main`,
                    }}>
                      {s.icon}
                    </Box>
                    <Typography variant="caption" fontWeight={600} sx={{ color: `${s.color}.main` }} noWrap>{s.label}</Typography>
                  </Stack>
                  <Typography variant="h5" fontWeight={700}>{stat.count}</Typography>
                  <Typography variant="caption" color="text.secondary">{s.caption || `${stat.pct}%`}</Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
