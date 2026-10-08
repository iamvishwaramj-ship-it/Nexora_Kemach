import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import {
  Box, Typography, Button, Card, CardContent, Stack, TextField, Grid, Table, TableBody,
  TableCell, TableHead, TableRow, Chip, IconButton, Collapse, Tooltip, Menu, MenuItem,
  ListItemIcon, ListItemText,
} from '@mui/material';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CallOutlinedIcon from '@mui/icons-material/CallOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SendIcon from '@mui/icons-material/Send';
import SaveIcon from '@mui/icons-material/SaveOutlined';
import dayjs from 'dayjs';
import { useForm, useFormContext, FormProvider } from 'react-hook-form';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
import FormTimePicker from '../../components/form/FormTimePicker';
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
import { followUpSchema, FOLLOW_UP_MODE_OPTIONS, FOLLOW_UP_STATUS_OPTIONS, ENQUIRY_PRIORITY_OPTIONS } from '../../lib/validation/salesSchemas';
import { followUpApi, enquiryApi, salesEmployeeApi } from '../../features/resources';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';
const toOptions = (arr) => arr.map((v) => ({ label: v, value: v }));
const YES_NO_OPTIONS = [{ label: 'Yes', value: 'Yes' }, { label: 'No', value: 'No' }];

// Matches Enquiry.jsx's own ENQUIRY_LABEL_WIDTH so the label-left layout
// lines up visually between the two pages.
const FOLLOWUP_LABEL_WIDTH = 220;

const PURPOSE_OPTIONS = ['Requirement Discussion', 'Quotation Follow-up', 'Payment Follow-up', 'Demo/Presentation', 'Negotiation', 'Other'];
const OUTCOME_OPTIONS = ['Interested - Quotation Requested', 'Interested - Needs More Info', 'Not Interested', 'No Response', 'Converted', 'Follow-up Required', 'Other'];
const DEPARTMENT_OPTIONS = ['Administration', 'Purchase', 'Finance', 'Operations', 'IT', 'Sales', 'Other'];

const STATUS_COLORS = { Completed: 'success', Pending: 'warning', Scheduled: 'info', Overdue: 'error' };

const MODE_ICONS = {
  Call: <CallOutlinedIcon fontSize="small" />,
  Email: <EmailOutlinedIcon fontSize="small" />,
  WhatsApp: <WhatsAppIcon fontSize="small" />,
  Meeting: <GroupsOutlinedIcon fontSize="small" />,
};

const emptyValues = {
  followUpNo: '', enquiryId: null,
  followUpMode: '', followUpDate: null, followUpTime: '', followUpBy: '', nextFollowUpDate: null,
  followUpWith: '', designation: '', department: '', phoneNo: '', emailId: '',
  purposeDiscussion: '', outcomeResult: '', status: 'Pending', followUpNotes: '',
  reminderAlert: 'No', reminderDate: null, reminderTime: '', assignTo: '', priority: '',
  attachmentName: '', internalRemarks: '',
};

// followUpNo is required by the schema but had no input anywhere in the
// form to fill it, so it stayed '' for every new record and silently failed
// validation on every single save. Auto-generate it the same way
// PaymentEntry's generatePaymentNo does ("FU/2026/07/0001"), sequenced
// against follow-up numbers already used this year/month; the backend still
// owns followUpNo as the source of truth (@unique) so a collision here would
// surface as a save error rather than silently overwriting another record.
function generateFollowUpNo(existingRows) {
  const now = dayjs();
  const prefix = `FU/${now.format('YYYY')}/${now.format('MM')}/`;
  const usedThisMonth = (existingRows || [])
    .map((r) => r.followUpNo || '')
    .filter((no) => no.startsWith(prefix))
    .map((no) => Number(no.slice(prefix.length)) || 0);
  const next = (usedThisMonth.length ? Math.max(...usedThisMonth) : 0) + 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

const PAGE_SIZE = 10;
const formatDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '—');
const formatDateTime = (d, t) => (d ? `${dayjs(d).format('DD/MM/YYYY')}${t ? ` ${t}` : ''}` : '—');

// Numbered circular badge + title, matching the New Enquiry design's 1/2/3/4
// section headers -- same look, duplicated locally rather than shared since
// each page's section list/count differs (Enquiry.jsx has its own copy).
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

// Follow-up Mode select with a leading icon (Call/Email/WhatsApp/Meeting),
// matching the design -- built on the same Autocomplete pattern as FormSelect
// rather than modifying that shared component just for this one field.
function FollowUpModeField() {
  const { control } = useFormContext();
  return (
    <FormSelect
      name="followUpMode"
      label="Follow-up Mode *"
      placeholder="Select mode"
      options={FOLLOW_UP_MODE_OPTIONS.map((m) => ({ label: m, value: m }))}
      renderOption={(props, option) => (
        <Box component="li" {...props} key={option.value}>
          <Stack direction="row" spacing={1} alignItems="center">
            {MODE_ICONS[option.value]}
            <Typography variant="body2">{option.label}</Typography>
          </Stack>
        </Box>
      )}
    />
  );
}

// Next Follow-up Date must be on/after the Follow-up Date, so the calendar
// blocks out every day before it (matching the dateRange('followUpDate',
// 'nextFollowUpDate') refinement in salesSchemas.js). triggerFields
// re-validates this field the moment Follow-up Date changes, so a stale
// "cannot be before" error clears immediately if the new Follow-up Date now
// falls before the already-picked Next Follow-up Date.
function NextFollowUpDateField() {
  const { watch } = useFormContext();
  const followUpDate = watch('followUpDate');
  const minDate = followUpDate ? dayjs(followUpDate) : undefined;
  return (
    <FormDatePicker
      name="nextFollowUpDate"
      label=""
      minDate={minDate}
      triggerFields={['nextFollowUpDate']}
    />
  );
}

const FOLLOWUP_LIST_TABLE_ROW_HEIGHT = 0;
const FOLLOWUP_LIST_TABLE_CELL_PADDING_Y = 6;
// initialShowForm: the /sales/follow-up/add route ("Add Follow-up" card)
// opens the page with the create form already expanded.
export default function FollowUp({ initialShowForm = false }) {
  const navigate = useNavigate();
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const { data: followUps, isLoading } = followUpApi.useList();
  const { data: enquiries } = enquiryApi.useList();
  const { data: salesEmployees } = salesEmployeeApi.useList();
  const [create, { isLoading: creating }] = followUpApi.useCreate();
  const [update, { isLoading: updating }] = followUpApi.useUpdate();
  const [remove] = followUpApi.useDelete();

  const [showForm, setShowForm] = useState(initialShowForm);
  const [editingRow, setEditingRow] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [selectedRow, setSelectedRow] = useState(null);
  // Which top action button was clicked: 'save' keeps the follow-up at its
  // current/'Pending' status, 'submit' advances it to 'Scheduled'.
  const [pendingAction, setPendingAction] = useState('save');

  // Date Range filter — a report-toolbar-style RHF instance of its own
  // (same pattern as EnquiryRegister.jsx's own filter bar), just so its two
  // fields can use the app's themed FormDatePicker instead of a bare native
  // <input type="date">. Not part of the create/edit AppForm above; nothing
  // here is submitted, watch() just feeds baseTableRows below directly.
  const dateFilterMethods = useForm({ defaultValues: { dateFrom: null, dateTo: null } });
  const dateFrom = dateFilterMethods.watch('dateFrom');
  const dateTo = dateFilterMethods.watch('dateTo');
  const [enquiryNoFilter, setEnquiryNoFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [byFilter, setByFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [rowMenuAnchor, setRowMenuAnchor] = useState(null);
  const [rowMenuTarget, setRowMenuTarget] = useState(null);
  const [exportAnchor, setExportAnchor] = useState(null);

  const rows = followUps || [];
  const enquiryRows = enquiries || [];

  const enquiryById = useMemo(
    () => Object.fromEntries(enquiryRows.map((e) => [e.id, e])),
    [enquiryRows]
  );

  const enquiryNoById = (id) => enquiryById[id]?.enquiryNo || '—';
  const customerNameById = (id) => enquiryById[id]?.customerName || '—';

  // Same navigate-with-state convention EnquiryRegister.jsx's own Enquiry
  // No. link uses — takes the user to Sales > Enquiry with the record's own
  // enquiryNo carried in location.state.
  const goToEnquiry = (id) => {
    const enq = enquiryById[id];
    if (!enq) return;
    navigate('/sales/enquiry', { state: { enquiryNo: enq.enquiryNo } });
  };

  // Enquiry No. is the one interactive field in Section 1 — pick a number
  // here and every other field in the section (Customer Name, Contact
  // Person, Mobile No., Enquiry Date, Subject/Requirement, Source, Enquiry
  // Type) auto-fills as a read-only summary of that linked enquiry.
  const enquiryOptions = useMemo(
    () => enquiryRows.map((e) => ({ label: e.enquiryNo, value: e.id })),
    [enquiryRows]
  );

  const customerOptions = useMemo(
    () => toOptions([...new Set(enquiryRows.map((e) => e.customerName).filter(Boolean))]),
    [enquiryRows]
  );
  // "Follow-up By" / "Assign To" — sourced from Sales Employee, not app users.
  const userOptions = useMemo(
    () => (salesEmployees || []).map((s) => ({ label: s.employeeName, value: s.employeeName })),
    [salesEmployees]
  );
  const followUpWithOptions = useMemo(
    () => toOptions([...new Set(rows.map((r) => r.followUpWith).filter(Boolean))]),
    [rows]
  );

  const baseTableRows = useMemo(() => {
    return rows.filter((r) => {
      const enq = enquiryById[r.enquiryId];
      const matchesEnquiry = !enquiryNoFilter || String(enq?.enquiryNo || '').toLowerCase().includes(enquiryNoFilter.toLowerCase());
      const matchesCustomer = !customerFilter || enq?.customerName === customerFilter;
      const matchesBy = !byFilter || r.followUpBy === byFilter;
      const matchesStatus = !statusFilter || r.status === statusFilter;
      const d = r.followUpDate ? dayjs(r.followUpDate) : null;
      const matchesFrom = !dateFrom || (d && !d.isBefore(dayjs(dateFrom), 'day'));
      const matchesTo = !dateTo || (d && !d.isAfter(dayjs(dateTo), 'day'));
      return matchesEnquiry && matchesCustomer && matchesBy && matchesStatus && matchesFrom && matchesTo;
    });
  }, [rows, enquiryNoFilter, customerFilter, byFilter, statusFilter, dateFrom, dateTo, enquiryById]);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'followUpNo', headerName: 'Follow-up No.', filter: 'text' },
    // enquiryId is the raw FK — searching/filtering on it directly meant
    // typing the displayed enquiry number ("ENQ/2026/00007") never matched
    // anything, since the row only ever held the numeric id. `value` gives
    // useTableFeatures the same displayed string the column itself renders
    // (see enquiryNoById below) for both the global search box and the
    // column filter panel to match against.
    { field: 'enquiryId', headerName: 'Enquiry No.', filter: 'text', value: (row) => enquiryNoById(row.enquiryId) },
    { field: 'followUpDate', headerName: 'Follow-up Date', filter: 'dateRange', sortValue: (row) => (row.followUpDate ? new Date(row.followUpDate).getTime() : null), searchValue: (row) => [row.followUpDate, row.followUpTime].join(' ') },
    { field: 'followUpMode', headerName: 'Mode', filter: 'text' },
    { field: 'followUpBy', headerName: 'Follow-up By', filter: 'text' },
    { field: 'nextFollowUpDate', headerName: 'Next Follow-up Date', filter: 'dateRange', sortValue: (row) => (row.nextFollowUpDate ? new Date(row.nextFollowUpDate).getTime() : null), searchValue: (row) => formatDate(row.nextFollowUpDate) },
    { field: 'status', headerName: 'Status', filter: 'select' },
  ]), [enquiryById]);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const filteredRows = table.rows;

  const pagedRows = useMemo(
    () => filteredRows.slice(page * pageSize, page * pageSize + pageSize),
    [filteredRows, page, pageSize]
  );

  // Follow-up Details panel: only shows once a row's eye (view) icon has
  // been explicitly clicked -- no default fallback row, so the panel stays
  // hidden until the user asks to see it.
  const detailRow = selectedRow;

  const resetFilters = () => {
    dateFilterMethods.reset({ dateFrom: null, dateTo: null });
    setEnquiryNoFilter(''); setCustomerFilter(''); setByFilter(''); setStatusFilter('');
    setPage(0);
  };

  const openCreate = () => {
    setEditingRow(null);
    setFormKey((k) => k + 1);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRow(null);
  };

  const handleEdit = (row) => {
    setEditingRow(row);
    setFormKey((k) => k + 1);
    setShowForm(true);
    setRowMenuAnchor(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleView = (row) => {
    setSelectedRow(row);
  };

  const handleDelete = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Delete follow-up',
      message: `Are you sure you want to delete follow-up "${row.followUpNo}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      if (selectedRow?.id === row.id) setSelectedRow(null);
      notify.success('Follow-up deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, status, setError) => {
    try {
      const payload = { ...values, enquiryId: values.enquiryId ? Number(values.enquiryId) : null, status };
      if (editingRow) {
        const updated = await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Follow-up updated');
        if (selectedRow?.id === editingRow.id) setSelectedRow(updated);
      } else {
        await create(payload).unwrap();
        notify.success(status === 'Scheduled' ? 'Follow-up submitted' : 'Follow-up saved');
      }
      closeForm();
    } catch (err) {
      notify.error(applyServerErrors(err, setError));
    }
  };

  const handleExport = () => {
    const cols = [
      ['followUpNo', 'Follow-up No.'], ['followUpDate', 'Follow-up Date'], ['followUpMode', 'Mode'],
      ['followUpBy', 'Follow-up By'], ['nextFollowUpDate', 'Next Follow-up Date'], ['status', 'Status'],
    ];
    const header = cols.map(([, label]) => label).join(',');
    const lines = filteredRows.map((r) => cols.map(([key]) => `"${String(r[key] ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'follow-ups.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<EventRepeatOutlinedIcon />}
        title="Follow-up"
        subtitle="Log and track every follow-up made against a sales enquiry."
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
        <Button variant="outlined" color="inherit" startIcon={<CalendarMonthOutlinedIcon />} disabled>
          Calendar View
        </Button>
        <CanAdd>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Add Follow-up
          </Button>
        </CanAdd>
      </Stack>

      <Collapse in={showForm} unmountOnExit>
        <Box sx={{ mb: 2 }}>
          <Card variant="outlined">
            <CardContent sx={{ p: 3 }}>
              <AppForm
                id="follow-up-form"
                key={formKey}
                schema={followUpSchema}
                defaultValues={editingRow
                  ? { ...emptyValues, ...editingRow }
                  // followUpDate defaults to today — new Date() here (not
                  // baked into the module-level emptyValues) so a session left
                  // open past midnight still gets the actual current date on
                  // the next "New Follow-up" click, not whatever date the
                  // page happened to load on.
                  : { ...emptyValues, followUpNo: generateFollowUpNo(rows), followUpDate: new Date() }}
                onSubmit={(values, methods) => {
                  // The Status dropdown (values.status) is the source of
                  // truth — editing a Pending follow-up to Completed and
                  // hitting Save used to silently drop back to
                  // editingRow.status (the stale pre-edit value) no matter
                  // what the dropdown showed. Only fall back to a
                  // Scheduled/Pending default when this is a brand-new
                  // record whose Status field the user never actually
                  // touched (dirtyFields.status is false, so it's still
                  // sitting on emptyValues' own default) — an existing
                  // record's status always came from editingRow.status to
                  // begin with, so it's never "unchosen".
                  const statusChosen = editingRow || !!methods.formState.dirtyFields.status;
                  const status = statusChosen
                    ? values.status
                    : (pendingAction === 'submit' ? 'Scheduled' : 'Pending');
                  handleSubmit(values, status, methods.setError);
                }}
              >
                {({ watch }) => {
                  const enquiryId = watch('enquiryId');
                  const selectedEnquiry = enquiryById[enquiryId];

                  // FormSelect (an Autocomplete under the hood) only shows a
                  // value as selected when it's actually present in
                  // `options` — a bound value that isn't there (e.g.
                  // followUpBy/assignTo naming a Sales Employee who's since
                  // been made inactive and dropped out of userOptions)
                  // renders the box blank instead of clearing the
                  // underlying field, which reads as "this record lost its
                  // data" even though it didn't. Same fix followUpWith
                  // already applies for selectedEnquiry.contactPerson:
                  // union the current value into the option list so it
                  // still shows.
                  const followUpByValue = watch('followUpBy');
                  const assignToValue = watch('assignTo');
                  const followUpByOptions = followUpByValue && !userOptions.some((o) => o.value === followUpByValue)
                    ? [{ label: followUpByValue, value: followUpByValue }, ...userOptions]
                    : userOptions;
                  const assignToOptions = assignToValue && !userOptions.some((o) => o.value === assignToValue)
                    ? [{ label: assignToValue, value: assignToValue }, ...userOptions]
                    : userOptions;

                  return (
                    <>
                      <SectionHeader number={1} title="Enquiry Information" />
                      <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                        <LabeledField label="Enquiry No. *" labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <FormSelect name="enquiryId" label="" placeholder="Select enquiry" options={enquiryOptions} />
                        </LabeledField>
                        <LabeledField label="Customer Name *" labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <TextField size="small" fullWidth label="" value={selectedEnquiry?.customerName || ''} disabled />
                        </LabeledField>
                        <LabeledField label="Contact Person" labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <TextField size="small" fullWidth label="" value={selectedEnquiry?.contactPerson || ''} disabled />
                        </LabeledField>
                        <LabeledField label="Mobile No." labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <TextField size="small" fullWidth label="" value={selectedEnquiry?.mobileNo || ''} disabled />
                        </LabeledField>
                        <LabeledField label="Enquiry Date" labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <TextField size="small" fullWidth label="" value={formatDate(selectedEnquiry?.enquiryDate)} disabled />
                        </LabeledField>
                        <LabeledField label="Subject / Requirement" labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <TextField size="small" fullWidth label="" value={selectedEnquiry?.subject || ''} disabled />
                        </LabeledField>
                        <LabeledField label="Source" labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <TextField size="small" fullWidth label="" value={selectedEnquiry?.sourceOfEnquiry || ''} disabled />
                        </LabeledField>
                        <LabeledField label="Enquiry Type" labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <TextField size="small" fullWidth label="" value={selectedEnquiry?.enquiryType || ''} disabled />
                        </LabeledField>
                      </FormGrid>

                      <Box sx={{ mt: 4 }}>
                        <SectionHeader number={2} title="Follow-up Details" />
                      </Box>
                      <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                        <LabeledField label="Follow-up No. *" labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <FormTextField name="followUpNo" label="" disabled />
                        </LabeledField>
                        <LabeledField label="Mode *" labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <FollowUpModeField />
                        </LabeledField>
                        <LabeledField label="Follow-up Date *" labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <FormDatePicker name="followUpDate" label="" triggerFields={['nextFollowUpDate']} />
                        </LabeledField>
                        <LabeledField label="Follow-up Time *" labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <FormTimePicker name="followUpTime" label="" />
                        </LabeledField>
                        <LabeledField label="Follow-up By *" labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <FormSelect name="followUpBy" label="" placeholder="Select user" options={followUpByOptions} />
                        </LabeledField>
                        <LabeledField label="Next Follow-up Date" labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <NextFollowUpDateField />
                        </LabeledField>
                        <LabeledField label="Follow-up With *" labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <FormSelect
                            name="followUpWith"
                            label=""
                            placeholder="Select contact"
                            options={selectedEnquiry?.contactPerson
                              ? [{ label: selectedEnquiry.contactPerson, value: selectedEnquiry.contactPerson }, ...followUpWithOptions.filter((o) => o.value !== selectedEnquiry.contactPerson)]
                              : followUpWithOptions}
                          />
                        </LabeledField>
                        <LabeledField label="Designation" labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <FormTextField name="designation" label="" placeholder="Enter designation" />
                        </LabeledField>
                        <LabeledField label="Department" labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <FormSelect name="department" label="" placeholder="Select department" options={toOptions(DEPARTMENT_OPTIONS)} />
                        </LabeledField>
                        <LabeledField label="Phone No." labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <FormTextField name="phoneNo" label="" placeholder="Enter phone number" digitsOnly maxLength={10} />
                        </LabeledField>
                        <LabeledField label="Email ID" labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <FormTextField name="emailId" label="" placeholder="Enter email address" />
                        </LabeledField>
                        <LabeledField label="Purpose / Discussion *" labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <FormSelect name="purposeDiscussion" label="" placeholder="Select purpose" options={toOptions(PURPOSE_OPTIONS)} />
                        </LabeledField>
                        <LabeledField label="Outcome / Result *" labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <FormSelect name="outcomeResult" label="" placeholder="Select outcome" options={toOptions(OUTCOME_OPTIONS)} />
                        </LabeledField>
                        <LabeledField label="Status *" labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <FormSelect name="status" label="" placeholder="Select status" options={toOptions(FOLLOW_UP_STATUS_OPTIONS)} />
                        </LabeledField>
                      </FormGrid>
                      <FormGrid columns={1} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                        <LabeledField label="Follow-up Notes *" labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <FormTextField name="followUpNotes" label="" placeholder="Enter follow-up notes" multiline rows={3} />
                        </LabeledField>
                      </FormGrid>

                      <Box sx={{ mt: 4 }}>
                        <SectionHeader number={3} title="Additional Information" />
                      </Box>
                      <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                        <LabeledField label="Reminder / Alert" labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <FormSelect name="reminderAlert" label="" options={YES_NO_OPTIONS} />
                        </LabeledField>
                        <LabeledField label="Reminder Date" labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <FormDatePicker name="reminderDate" label="" />
                        </LabeledField>
                        <LabeledField label="Reminder Time" labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <FormTimePicker name="reminderTime" label="" />
                        </LabeledField>
                        <LabeledField label="Assign To" labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <FormSelect name="assignTo" label="" placeholder="Select user" options={assignToOptions} />
                        </LabeledField>
                        <LabeledField label="Priority" labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <FormSelect name="priority" label="" placeholder="Select priority" options={toOptions(ENQUIRY_PRIORITY_OPTIONS)} />
                        </LabeledField>
                      </FormGrid>

                      <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Attachments</Typography>
                        <AttachmentField />
                      </Box>

                      <Box sx={{ mt: 4 }}>
                        <SectionHeader number={4} title="Internal Remarks (Optional)" />
                      </Box>
                      <FormGrid columns={1} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                        <LabeledField label="Internal Remarks" labelWidth={FOLLOWUP_LABEL_WIDTH}>
                          <FormTextField name="internalRemarks" label="" placeholder="Enter internal remarks..." multiline rows={3} />
                        </LabeledField>
                      </FormGrid>

                      <Stack direction="row" justifyContent="flex-end" spacing={1.5} sx={{ mt: 3 }}>
                        <Button variant="outlined" color="inherit" startIcon={<CloseIcon />} onClick={closeForm} disabled={creating || updating}>
                          Cancel
                        </Button>
                        <FormSubmitButton
                          color="warning"
                          startIcon={<SaveIcon />}
                          form="follow-up-form"
                          onClick={() => setPendingAction('save')}
                          disabled={creating || updating}
                          loading={creating || updating}
                        >
                          Save
                        </FormSubmitButton>
                        <FormSubmitButton
                          sx={{ bgcolor: 'grey.900', '&:hover': { bgcolor: 'grey.800' } }}
                          startIcon={<SendIcon />}
                          form="follow-up-form"
                          onClick={() => setPendingAction('submit')}
                          disabled={creating || updating}
                          loading={creating || updating}
                        >
                          Save &amp; Submit
                        </FormSubmitButton>
                      </Stack>
                    </>
                  );
                }}
              </AppForm>
            </CardContent>
          </Card>
        </Box>
      </Collapse>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Follow-up List</Typography>
          <Grid container spacing={{ xs: 1, sm: 2 }}>
            <Grid item xs={12} sm={6} md={2.4}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Date Range</Typography>
              <FormProvider {...dateFilterMethods}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <FormDatePicker name="dateFrom" label="" />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>–</Typography>
                  <FormDatePicker name="dateTo" label="" />
                </Stack>
              </FormProvider>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Enquiry No.</Typography>
              <TextField
                size="small" fullWidth placeholder="Search Enquiry No." value={enquiryNoFilter}
                onChange={(e) => { setEnquiryNoFilter(e.target.value); setPage(0); }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Customer Name</Typography>
              <TextField
                select size="small" fullWidth value={customerFilter}
                onChange={(e) => { setCustomerFilter(e.target.value); setPage(0); }} SelectProps={{ native: true }}
              >
                <option value="">Select Customer</option>
                {customerOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Follow-up By</Typography>
              <TextField
                select size="small" fullWidth value={byFilter}
                onChange={(e) => { setByFilter(e.target.value); setPage(0); }} SelectProps={{ native: true }}
              >
                <option value="">Select User</option>
                {userOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={1.8}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Status</Typography>
              <TextField
                select size="small" fullWidth value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} SelectProps={{ native: true }}
              >
                <option value="">Select Status</option>
                {FOLLOW_UP_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={1.8}>
              <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>&nbsp;</Typography>
              <Stack direction="row" spacing={1}>
                <Button variant="contained" size="small" onClick={() => setPage(0)} fullWidth>Search</Button>
                <Button variant="outlined" color="inherit" size="small" onClick={resetFilters} fullWidth>Reset</Button>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ p: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Follow-up List</Typography>
            <TableSearchFilter table={table} placeholder="Search follow-ups..." width={220} />
          </Stack>

          <TableFilterPanel table={table} />

          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {!isLoading && pagedRows.map((row) => (
                <MobileRecordCard
                  key={row.id}
                  title={row.followUpNo}
                  statusChip={<Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />}
                  fields={[
                    { label: 'Enquiry No.', value: enquiryNoById(row.enquiryId) },
                    { label: 'Customer Name', value: customerNameById(row.enquiryId) },
                    { label: 'Follow-up Date', value: formatDateTime(row.followUpDate, row.followUpTime) },
                    { label: 'Mode', value: row.followUpMode || '—' },
                    { label: 'Follow-up By', value: row.followUpBy || '—' },
                    { label: 'Next Follow-up', value: formatDate(row.nextFollowUpDate) },
                  ]}
                  onView={() => handleView(row)}
                  onEdit={() => handleEdit(row)}
                  onDelete={() => handleDelete(row)}
                />
              ))}
              {!isLoading && filteredRows.length === 0 && (
                <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No follow-ups found'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first follow-up to get started'} />
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table
                size="small"
                stickyHeader
                sx={{
                  '& th, & td': {
                    height: FOLLOWUP_LIST_TABLE_ROW_HEIGHT,
                    paddingTop: `${FOLLOWUP_LIST_TABLE_CELL_PADDING_Y}px`,
                    paddingBottom: `${FOLLOWUP_LIST_TABLE_CELL_PADDING_Y}px`,
                    boxSizing: 'border-box',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <SortableHeaderCell field="followUpNo" sort={table.sort} onSort={table.toggleSort}>Follow-up No.</SortableHeaderCell>
                    <SortableHeaderCell field="enquiryId" sort={table.sort} onSort={table.toggleSort}>Enquiry No.</SortableHeaderCell>
                    <TableCell>Customer Name</TableCell>
                    <SortableHeaderCell field="followUpDate" sort={table.sort} onSort={table.toggleSort}>Follow-up Date</SortableHeaderCell>
                    <SortableHeaderCell field="followUpMode" sort={table.sort} onSort={table.toggleSort}>Mode</SortableHeaderCell>
                    <SortableHeaderCell field="followUpBy" sort={table.sort} onSort={table.toggleSort}>Follow-up By</SortableHeaderCell>
                    <SortableHeaderCell field="nextFollowUpDate" sort={table.sort} onSort={table.toggleSort}>Next Follow-up Date</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row) => (
                    <TableRow key={row.id} hover selected={detailRow?.id === row.id}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography
                          variant="body2" fontWeight={600} color="primary.main"
                          onClick={() => handleView(row)}
                          sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                        >
                          {row.followUpNo}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {row.enquiryId ? (
                          <Typography
                            variant="body2" color="primary.main"
                            onClick={() => goToEnquiry(row.enquiryId)}
                            sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                          >
                            {enquiryNoById(row.enquiryId)}
                          </Typography>
                        ) : '—'}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{customerNameById(row.enquiryId)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(row.followUpDate, row.followUpTime)}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          {MODE_ICONS[row.followUpMode]}
                          <Typography variant="body2">{row.followUpMode || '—'}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.followUpBy || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.nextFollowUpDate)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="View">
                            <IconButton size="small" onClick={() => handleView(row)} aria-label="view">
                              <VisibilityOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
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
                      <TableCell colSpan={9}>
                        <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No follow-ups found'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first follow-up to get started'} />
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

      {detailRow && (
        <Card variant="outlined" sx={{ borderColor: 'warning.main', borderWidth: 1.5 }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>Follow-up Details</Typography>
              <Stack direction="row" spacing={0.5}>
                <Tooltip title="Edit">
                  <IconButton size="small" onClick={() => handleEdit(detailRow)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Close">
                  <IconButton size="small" onClick={() => setSelectedRow(null)} aria-label="close">
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>

            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Stack spacing={1.5}>
                  <DetailRow label="Follow-up No." value={detailRow.followUpNo} />
                  <DetailRow
                    label="Enquiry No."
                    value={detailRow.enquiryId ? (
                      <Typography
                        component="span" variant="body2" fontWeight={600} color="primary.main"
                        onClick={() => goToEnquiry(detailRow.enquiryId)}
                        sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                      >
                        {enquiryNoById(detailRow.enquiryId)}
                      </Typography>
                    ) : null}
                  />
                  <DetailRow label="Customer Name" value={customerNameById(detailRow.enquiryId)} />
                  <DetailRow label="Contact Person" value={enquiryById[detailRow.enquiryId]?.contactPerson} />
                  <DetailRow label="Subject / Requirement" value={enquiryById[detailRow.enquiryId]?.subject} />
                  <DetailRow label="Follow-up Date & Time" value={formatDateTime(detailRow.followUpDate, detailRow.followUpTime)} />
                  <DetailRow
                    label="Follow-up Mode"
                    value={(
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {MODE_ICONS[detailRow.followUpMode]}
                        <Typography variant="body2">{detailRow.followUpMode || '—'}</Typography>
                      </Stack>
                    )}
                  />
                  <DetailRow label="Follow-up By" value={detailRow.followUpBy} />
                </Stack>
              </Grid>

              <Grid item xs={12} md={4}>
                <Stack spacing={2}>
                  <DetailBox label="Follow-up Notes" value={detailRow.followUpNotes} minHeight={110} />
                  <DetailBox label="Outcome" value={detailRow.outcomeResult} />
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 0.75 }}>Attachments</Typography>
                    {detailRow.attachmentName ? (
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.25 }}>
                        <PictureAsPdfIcon color="error" fontSize="small" />
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography variant="body2" noWrap>{detailRow.attachmentName.split(' (')[0]}</Typography>
                          <Typography variant="caption" color="text.secondary">{(detailRow.attachmentName.match(/\(([^)]+)\)/) || [])[1] || ''}</Typography>
                        </Box>
                        <IconButton size="small"><FileDownloadIcon fontSize="small" /></IconButton>
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">—</Typography>
                    )}
                  </Box>
                </Stack>
              </Grid>

              <Grid item xs={12} md={4}>
                <Stack spacing={2}>
                  <DetailBox label="Next Follow-up Date" value={formatDate(detailRow.nextFollowUpDate)} icon={<CalendarMonthOutlinedIcon fontSize="small" color="action" />} />
                  <DetailBox
                    label="Reminder"
                    value={`${detailRow.reminderAlert || 'No'}${detailRow.reminderDate ? ` — ${formatDate(detailRow.reminderDate)}${detailRow.reminderTime ? ` ${detailRow.reminderTime}` : ''}` : ''}`}
                    icon={<CalendarMonthOutlinedIcon fontSize="small" color="action" />}
                  />
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 0.75 }}>Status</Typography>
                    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, px: 1.5, py: 1 }}>
                      <Chip size="small" label={detailRow.status} color={STATUS_COLORS[detailRow.status] || 'default'} variant="outlined" />
                    </Box>
                  </Box>
                  <DetailBox label="Remarks (Internal)" value={detailRow.internalRemarks} minHeight={80} />
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

// Read-only "attachment filename" field — no real file storage backend
// exists in this app (checked purchase/sales schemas: attachmentName is
// already a plain string field there too), so this stores filename/size as
// a display string rather than uploading a blob.
function AttachmentField() {
  const { watch, setValue } = useFormContext();
  const attachmentName = watch('attachmentName');
  return (
    <Grid container spacing={2} alignItems="center">
      <Grid item xs={12} sm={attachmentName ? 7 : 12}>
        <Box
          component="label"
          sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            border: '1px dashed', borderColor: 'divider', borderRadius: 1.5, p: 2.5, cursor: 'pointer',
            color: 'text.secondary', textAlign: 'center',
          }}
        >
          <CloudUploadOutlinedIcon sx={{ mb: 0.5 }} />
          <Typography variant="body2">Drag and drop files here or click to browse</Typography>
          <Typography variant="caption">Supports: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG (Max 10MB)</Typography>
          <input
            type="file"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setValue('attachmentName', `${file.name} (${Math.round(file.size / 1024)} KB)`, { shouldValidate: true });
            }}
          />
        </Box>
      </Grid>
      {attachmentName && (
        <Grid item xs={12} sm={5}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.25 }}>
            <PictureAsPdfIcon color="error" fontSize="small" />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="body2" noWrap>{attachmentName.split(' (')[0]}</Typography>
              <Typography variant="caption" color="text.secondary">{(attachmentName.match(/\(([^)]+)\)/) || [])[1] || ''}</Typography>
            </Box>
            <IconButton size="small" onClick={() => setValue('attachmentName', '', { shouldValidate: true })}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Grid>
      )}
    </Grid>
  );
}

function DetailRow({ label, value }) {
  return (
    <Stack direction="row" flexWrap="wrap" alignItems="baseline" columnGap={1}>
      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, minWidth: 170 }}>{label}:</Typography>
      <Typography variant="body2" fontWeight={600} sx={{ wordBreak: 'break-word' }}>{value || '—'}</Typography>
    </Stack>
  );
}

function DetailBox({ label, value, minHeight, icon }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 0.75 }}>{label}</Typography>
      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, px: 1.5, py: 1, minHeight, display: 'flex', alignItems: minHeight ? 'flex-start' : 'center', gap: 1 }}>
        {icon}
        <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{value || '—'}</Typography>
      </Box>
    </Box>
  );
}
