import React, { useEffect, useMemo, useState } from 'react';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import {
  Box, Typography, Button, Card, CardContent, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, alpha,
} from '@mui/material';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import BorderColorOutlinedIcon from '@mui/icons-material/BorderColorOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { z } from 'zod';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import { useUnsavedChangesGuard, FormDirtyTracker } from '../../components/form/useUnsavedChangesGuard';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import useDragScroll from '../../components/data-display/useDragScroll';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import {
  requiredString, optionalString, optionalEmail, mobileNumber, statusEnum, optionalDate,
  optionalMobileNumber, optionalAccountNumber, optionalIfscCode, panNumber, optionalZipcode,
} from '../../lib/validation/common';
import {
  salesEmployeeApi, departmentMasterApi, branchApi,
  useUploadEmployeeSignatureMutation, useRemoveEmployeeSignatureMutation,
} from '../../features/resources';
import BulkImportDialog from '../../components/common/BulkImportDialog';
import ImageCropDialog from '../../components/common/ImageCropDialog';
import { countries, getStateOptions } from '../../lib/constants/locations';
import { getCityOptions } from '../../lib/constants/locationsCities';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';
// Nullable FK select (Department) — an empty Autocomplete emits null (see
// FormSelect), which must stay null rather than being coerced to '' (this
// is an INT column, not a string). Same shape as accountingSchemas.js's own
// optionalId, kept local since this is the only FK field on this page.
const optionalDepartmentId = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z.number({ invalid_type_error: 'Department is invalid' }).int().positive().nullable().optional()
);

// Same nullable-FK preprocessing as optionalDepartmentId above, for the new
// Branch field (Card 1 "Employee Details") — an FK to Branch, kept local to
// this page for the same reason optionalDepartmentId is.
const optionalBranchId = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z.number({ invalid_type_error: 'Branch is invalid' }).int().positive().nullable().optional()
);

const PAY_MODE_OPTIONS = [
  { label: 'Bank', value: 'Bank' },
  { label: 'Cash', value: 'Cash' },
];

// Local schema — the shared salesEmployeeSchema makes phone optional and
// date of joining required; this page's design is the opposite (Phone
// Number required, Date of Joining optional), so override both here rather
// than changing every other consumer of salesEmployeeSchema.
//
// department is now departmentId — an FK to DepartmentMaster (see
// departmentMasterApi below) — rather than free text.
//
// Bank fields (accountNumber/ifscCode/bankBranch) are only required when
// payMode is 'Bank' — enforced below via superRefine rather than in the
// field schemas themselves, since whether they're required depends on
// another field's value, not a fixed rule. Cash leaves them optional/blank.
const salesEmployeeDetailsSchema = z.object({
  employeeCode: requiredString('Employee code'),
  employeeName: requiredString('Employee name'),
  branchId: optionalBranchId,
  departmentId: optionalDepartmentId,
  payMode: z.string().optional().or(z.literal('')),
  accountNumber: optionalAccountNumber('Account number'),
  ifscCode: optionalIfscCode('IFSC code'),
  bankBranch: optionalString(),
  email: optionalEmail(),
  addressLine1: optionalString(),
  addressLine2: optionalString(),
  country: optionalString(),
  state: optionalString(),
  city: optionalString(),
  zip: optionalZipcode('Zip'),
  panNumber: panNumber('PAN'),
  phoneNumber: mobileNumber('Mobile number'),
  alternateMobileNumber: optionalMobileNumber('Alternate mobile number'),
  dateOfJoining: optionalDate('Date of joining'),
  status: statusEnum(),
  approvalAuthorization: z.boolean().optional(),
}).superRefine((values, ctx) => {
  if (values.payMode !== 'Bank') return;
  if (!values.accountNumber) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['accountNumber'], message: 'Account number is required when Pay Mode is Bank' });
  }
  if (!values.ifscCode) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ifscCode'], message: 'IFSC code is required when Pay Mode is Bank' });
  }
  if (!values.bankBranch) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['bankBranch'], message: 'Branch is required when Pay Mode is Bank' });
  }
});

const emptyValues = {
  employeeCode: '', employeeName: '', branchId: null, departmentId: null,
  payMode: '', accountNumber: '', ifscCode: '', bankBranch: '',
  email: '', addressLine1: '', addressLine2: '', country: 'India', state: '', city: '', zip: '',
  panNumber: '', phoneNumber: '', alternateMobileNumber: '',
  dateOfJoining: null, status: 'Active', approvalAuthorization: false,
};

// Accepted signature image types and size cap, enforced client-side before
// anything is sent to the server -- mirrors backend/src/routes/company.js's
// signature upload limits (same shape as CompanyDetails.jsx's own logo
// validation and HouseBank.jsx's QR code validation) so a rejected file
// never makes a round trip just to be told what it could have been told
// immediately.
const SIGNATURE_ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const SIGNATURE_MAX_BYTES = 2 * 1024 * 1024;

function validateSignatureFile(file) {
  if (!SIGNATURE_ACCEPTED_TYPES.includes(file.type)) {
    return 'Please choose a PNG, JPG or WEBP image.';
  }
  if (file.size > SIGNATURE_MAX_BYTES) {
    return 'Image is too large. Maximum size is 2MB.';
  }
  return null;
}

// Signature preview + file picker + remove, shown in the form's field grid.
// Same staged-until-Save shape as CompanyDetails.jsx's CompanyLogoField and
// HouseBank.jsx's HouseBankQrCodeField -- nothing is uploaded or removed just
// from picking a file or clicking Remove; the surrounding handleSubmit
// applies it (see below). A signature image is wider than tall, so the
// preview box favours width over the square logo/QR boxes those use.
function EmployeeSignatureField({ currentSignatureUrl, editing, signatureFile, previewUrl, removeRequested, onFileSelected, onRemove, error }) {
  const showImage = !removeRequested && (previewUrl || currentSignatureUrl);
  const imageSrc = signatureFile ? previewUrl : currentSignatureUrl;

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file name after an error
    if (!file) return;
    onFileSelected(file);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Box
        sx={{
          position: 'relative',
          width: 140, height: 70,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', flexShrink: 0,
        }}
      >
        {showImage ? (
          <Box component="img" src={imageSrc} alt="Employee signature" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <BorderColorOutlinedIcon sx={{ fontSize: 30, color: 'text.disabled' }} />
        )}
        {editing && (
          <IconButton
            component="label"
            size="small"
            sx={{ position: 'absolute', bottom: -4, right: -4, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
          >
            <PhotoCameraIcon fontSize="small" />
            <input type="file" accept={SIGNATURE_ACCEPTED_TYPES.join(',')} hidden onChange={handleChange} />
          </IconButton>
        )}
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          PNG, JPG or WEBP. Max 2MB. You'll get to position and crop it next.
        </Typography>
        {error && (
          <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5 }}>
            {error}
          </Typography>
        )}
        {editing && showImage && (
          <Button
            size="small"
            color="error"
            startIcon={<DeleteIcon fontSize="small" />}
            onClick={onRemove}
            sx={{ mt: 0.5, px: 0 }}
          >
            Remove
          </Button>
        )}
      </Box>
    </Box>
  );
}

const APPROVAL_AUTHORIZATION_OPTIONS = [
  { label: 'Yes', value: true },
  { label: 'No', value: false },
];

const PAGE_SIZE = 10;

const TABLE_ROW_HEIGHT = 0;         // floor, not a cap
const TABLE_CELL_PADDING_Y = 6;     // the actual top/bottom gap per cell, in px — this is what actually controls row height
const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function SalesEmployee() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const { data: employees, isLoading, isFetching, refetch } = salesEmployeeApi.useList();
  const [create, { isLoading: creating }] = salesEmployeeApi.useCreate();
  const [update, { isLoading: updating }] = salesEmployeeApi.useUpdate();
  const [remove] = salesEmployeeApi.useDelete();
  const [uploadSignature, { isLoading: uploadingSignature }] = useUploadEmployeeSignatureMutation();
  const [removeSignature, { isLoading: removingSignature }] = useRemoveEmployeeSignatureMutation();
  // Bulk import lives in the shared BulkImportDialog (the same component the
  // Purchase/Sales document lists use) rather than a pair of bespoke toolbar
  // buttons: Download Template and Upload both sit inside it, and — the
  // reason for moving — it renders the server's per-row failures in a real
  // table instead of flattening them into a toast that truncates.
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  // Signature — staged here (not inside the AppForm render-prop) so it
  // survives that render-prop remounting on every field change, same reason
  // HouseBank.jsx stages its QR code state at the page level.
  const [signatureFile, setSignatureFile] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState(null);
  const [removeSignatureRequested, setRemoveSignatureRequested] = useState(false);
  const [signatureError, setSignatureError] = useState(null);
  // A raw picked file never becomes the staged signature directly -- it's
  // first sent through the crop dialog below, so a signature of any size or
  // aspect ratio the person happens to have on hand always lands on disk cut
  // to the same fixed box (see ImageCropDialog's own comment for why this,
  // not print-side CSS, is what actually keeps an oversized source from
  // stretching a print template's footer out of shape).
  const [cropSourceUrl, setCropSourceUrl] = useState(null);
  const [cropSourceFile, setCropSourceFile] = useState(null);

  const resetSignatureState = () => {
    setSignatureFile(null);
    setSignaturePreview(null);
    setRemoveSignatureRequested(false);
    setSignatureError(null);
    setCropSourceUrl(null);
    setCropSourceFile(null);
  };

  const handleSignatureFileSelected = (file) => {
    const validationError = validateSignatureFile(file);
    if (validationError) {
      setSignatureError(validationError);
      return;
    }
    setSignatureError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setCropSourceFile(file);
      setCropSourceUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSignatureCropCancel = () => {
    setCropSourceUrl(null);
    setCropSourceFile(null);
  };

  const handleSignatureCropped = (croppedFile, previewUrl) => {
    setRemoveSignatureRequested(false);
    setSignatureFile(croppedFile);
    setSignaturePreview(previewUrl);
    setCropSourceUrl(null);
    setCropSourceFile(null);
  };

  const handleSignatureRemoveClick = () => {
    setSignatureFile(null);
    setSignaturePreview(null);
    setSignatureError(null);
    setRemoveSignatureRequested(true);
  };

  // Department is a live list from Department Master (an FK by id) rather
  // than the hardcoded DEPARTMENT_OPTIONS this page used to carry. `data` is
  // undefined while loading — departments/departmentOptions/departmentNameById
  // all default to empty so the form and table render fine before it lands.
  const { data: departments } = departmentMasterApi.useList();
  const departmentOptions = useMemo(
    () => (departments || []).map((d) => ({ label: d.name, value: d.id })),
    [departments]
  );
  const departmentNameById = useMemo(
    () => new Map((departments || []).map((d) => [d.id, d.name])),
    [departments]
  );

  // Branch (Card 1 "Employee Details") — a live list from Branch Details,
  // same FK-by-id shape as Department above rather than the store-the-name
  // convention most other branch columns in this schema use.
  const { data: branches } = branchApi.useList();
  const branchOptions = useMemo(
    () => (branches || []).map((b) => ({ label: b.branchName, value: b.id })),
    [branches]
  );

  // The form lives in a modal — the page itself is the list, and the Add
  // button (or an edit action) opens the dialog over it. Same shape as the
  // Branch Details page / shared MasterCrudPage template.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const [search, setSearch] = useState('');
  const allRows = employees || [];
  const baseTableRows = useMemo(() => {
    const q = '';
    if (!q) return allRows;
    return allRows.filter((r) => [r.employeeCode, r.employeeName, r.email].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [allRows]);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js. Department is
  // stored as departmentId, so sort/search read the resolved name off
  // departmentNameById rather than the raw id.
  const tableColumns = useMemo(() => ([
    { field: 'employeeCode', headerName: 'Employee Code', filter: 'text' },
    { field: 'employeeName', headerName: 'Employee Name', filter: 'text' },
    { field: 'department', headerName: 'Department', filter: 'text', value: (row) => departmentNameById.get(row.departmentId) || '' },
    { field: 'phoneNumber', headerName: 'Phone Number', filter: 'text' },
    { field: 'email', headerName: 'Email', filter: 'text' },
    { field: 'dateOfJoining', headerName: 'Date of Joining', filter: 'dateRange', sortValue: (row) => (row.dateOfJoining ? new Date(row.dateOfJoining).getTime() : null), searchValue: (row) => formatDate(row.dateOfJoining) },
    { field: 'status', headerName: 'Status', filter: 'select' },
  ]), [departmentNameById]);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  useEffect(() => { setPage(0); }, [search]);

  const openCreate = () => {
    setEditingRow(null);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    resetSignatureState();
    setDialogOpen(true);
  };

  const closeForm = () => {
    setDialogOpen(false);
    setEditingRow(null);
    resetSignatureState();
  };

  // Closing a half-filled form asks before throwing the work away.
  // requestClose is what Cancel / the X / Esc go through; forceClose is the
  // save path, which has nothing to lose. See useUnsavedChangesGuard.jsx.
  const { requestClose, forceClose, setDirty, dialogCloseProps } = useUnsavedChangesGuard(closeForm);

  // Read-only look at a record — same form, every field disabled
  // and the save button removed (see AppForm's readOnly prop).
  const handleView = (row) => {
    setEditingRow(row);
    setReadOnly(true);
    setFormKey((k) => k + 1);
    resetSignatureState();
    setDialogOpen(true);
  };

  const handleEdit = (row) => {
    setEditingRow(row);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    resetSignatureState();
    setDialogOpen(true);
  };

  const handleDelete = async (row) => {
    const ok = await confirmDialog({
      title: 'Delete employee',
      message: `Are you sure you want to delete "${row.employeeName}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Employee deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    try {
      if (editingRow) {
        // Signature changes go through their own multipart/DELETE endpoints
        // (OCI Object Storage), applied first, ahead of the plain JSON
        // update for the rest of the fields — a failed signature upload then
        // never leaves the rest of the form silently unsaved along with it.
        // Same ordering as HouseBank.jsx's own QR code handling.
        if (signatureFile) {
          const formData = new FormData();
          formData.append('file', signatureFile);
          await uploadSignature({ id: editingRow.id, formData }).unwrap();
        } else if (removeSignatureRequested) {
          await removeSignature(editingRow.id).unwrap();
        }
        await update({ id: editingRow.id, ...values }).unwrap();
        notify.success('Employee updated');
      } else {
        const created = await create(values).unwrap();
        // A signature picked on the Add form has no employee id to upload
        // against until the record exists, so it's uploaded right after
        // creation succeeds instead — same as HouseBank.jsx's QR code.
        if (signatureFile) {
          const formData = new FormData();
          formData.append('file', signatureFile);
          await uploadSignature({ id: created.id, formData }).unwrap();
        }
        notify.success('Employee added');
      }
      forceClose();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<PeopleAltIcon />}
        title="Employee Master"
        subtitle="Manage your employees. Add, update or remove employees."
        rightContent={
          <CanAdd>
            {/* One entry point, matching the Purchase/Sales list pages:
                Download Template and Upload both live inside the dialog. */}
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                startIcon={<UploadFileIcon />}
                onClick={() => setBulkImportOpen(true)}
                sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                Import from Excel
              </Button>
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                Add Employee
              </Button>
            </Stack>
          </CanAdd>
        }
      />

      <Dialog
        open={dialogOpen}
        {...dialogCloseProps}
        maxWidth="lg"
        fullWidth
        sx={{
          // AppForm wraps its children in a <form>, which lands between the
          // dialog's Paper and DialogContent and breaks the flex chain Paper
          // relies on to make DialogContent scroll. Without this the field
          // grid is clipped on a short viewport instead of scrolling, and the
          // action buttons go with it.
          '& .MuiDialog-paper > form': {
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle
          component="div"
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, pr: 1 }}
        >
          <Typography variant="subtitle1" fontWeight={700}>
            {readOnly ? 'View Employee' : editingRow ? 'Edit Employee' : 'New Employee'}
          </Typography>
          <IconButton
            onClick={requestClose}
            size="small"
            aria-label="close"
            // Red only while viewing — on an Add/Edit dialog this same button sits
            // beside a live Save, where red would read as destructive.
            sx={readOnly ? {
              border: '1px solid',
              borderColor: 'error.main',
              color: 'error.main',
              '&:hover': { borderColor: 'error.dark', color: 'error.dark' },
            } : undefined}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <AppForm readOnly={readOnly}
          key={formKey}
          schema={salesEmployeeDetailsSchema}
          defaultValues={editingRow ? { ...emptyValues, ...editingRow } : emptyValues}
          onSubmit={handleSubmit}
        >
          {({ watch, setValue }) => {
            const payMode = watch('payMode');
            const country = watch('country') || 'India';
            const state = watch('state');
            // Bank fields are only meaningful when Pay Mode is Bank — clearing
            // them the moment the user switches to Cash keeps a stale account
            // number/IFSC/bank branch from being silently resubmitted for an
            // employee who is no longer paid by bank.
            const handlePayModeChange = (value) => {
              if (value !== 'Bank') {
                setValue('accountNumber', '', { shouldValidate: true });
                setValue('ifscCode', '', { shouldValidate: true });
                setValue('bankBranch', '', { shouldValidate: true });
              }
            };
            return (
            <>
              {/* Watches for the first real user edit so the close handlers
                  above know whether there is anything to lose. */}
              <FormDirtyTracker onDirtyChange={setDirty} />
              <DialogContent dividers>
                <Stack spacing={2.5}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
                        Employee Details
                      </Typography>
                      <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                        {/* Manual entry — the user types the Employee Code themselves.
                            (Previously auto-generated from the perpetual EMP numbering
                            series; switched to manual per request.) Uniqueness is
                            enforced server-side (see the /sales-employees route's
                            validate rule). */}
                        <LabeledField label="Employee Code *">
                          <FormTextField name="employeeCode" label="" placeholder="Enter employee code" />
                        </LabeledField>
                        <LabeledField label="Employee Name *">
                          <FormTextField name="employeeName" label="" placeholder="Enter employee name" />
                        </LabeledField>
                        <LabeledField label="Branch">
                          <FormSelect name="branchId" label="" placeholder="Select branch" options={branchOptions} />
                        </LabeledField>
                        <LabeledField label="Department">
                          <FormSelect name="departmentId" label="" placeholder="Select department" options={departmentOptions} />
                        </LabeledField>
                      </FormGrid>
                    </CardContent>
                  </Card>

                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
                        Other Details
                      </Typography>
                      <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                        <LabeledField label="Pay Mode">
                          <FormSelect
                            name="payMode"
                            label=""
                            placeholder="Select pay mode"
                            options={PAY_MODE_OPTIONS}
                            onValueChange={handlePayModeChange}
                          />
                        </LabeledField>
                        {/* Kept beside Pay Mode purely for grid alignment when the
                            bank fields below aren't shown. */}
                        <span />

                        {/* Each conditional field is its own top-level child of
                            FormGrid — NOT grouped in a single <>...</> fragment.
                            FormGrid assigns one grid cell per direct child, and a
                            fragment counts as exactly one child no matter how many
                            elements it wraps, so grouping these four together was
                            collapsing Account Number/IFSC Code/Branch/spacer into a
                            single cell and knocking every field after them (Email,
                            Permanent Address Line 1/2, ...) out of their intended
                            pairing whenever Pay Mode was Bank. Written individually,
                            each one either renders its own cell or (when `false`)
                            contributes no cell at all — so the row count, and every
                            later field's left/right position, stays identical
                            whether Pay Mode is Bank or Cash. */}
                        {payMode === 'Bank' && (
                          <LabeledField label="Account Number *">
                            <FormTextField name="accountNumber" label="" placeholder="Enter account number" digitsOnly maxLength={18} />
                          </LabeledField>
                        )}
                        {payMode === 'Bank' && (
                          <LabeledField label="IFSC Code *">
                            <FormTextField name="ifscCode" label="" placeholder="Enter IFSC code" />
                          </LabeledField>
                        )}
                        {payMode === 'Bank' && (
                          <LabeledField label="Branch *">
                            <FormTextField name="bankBranch" label="" placeholder="Enter bank branch" />
                          </LabeledField>
                        )}
                        {payMode === 'Bank' && <span />}

                        <LabeledField label="Email">
                          <FormTextField name="email" label="" placeholder="Enter email address" />
                        </LabeledField>
                        <span />

                        <LabeledField label="Permanent Address Line 1">
                          <FormTextField name="addressLine1" label="" placeholder="Enter address line 1" />
                        </LabeledField>
                        <LabeledField label="Permanent Address Line 2">
                          <FormTextField name="addressLine2" label="" placeholder="Enter address line 2" />
                        </LabeledField>
                        <LabeledField label="Country">
                          <FormSelect name="country" label="" placeholder="Select country" options={countries} />
                        </LabeledField>
                        <LabeledField label="State">
                          <FormSelect name="state" label="" placeholder="Select state" options={getStateOptions(country)} />
                        </LabeledField>
                        <LabeledField label="City">
                          <FormSelect name="city" label="" placeholder="Select city" options={getCityOptions(country, state)} />
                        </LabeledField>
                        <LabeledField label="Zip">
                          <FormTextField name="zip" label="" placeholder="Enter zip" />
                        </LabeledField>

                        <LabeledField label="PAN Number">
                          <FormTextField name="panNumber" label="" placeholder="Enter PAN number" />
                        </LabeledField>
                        <LabeledField label="Mobile Number *">
                          <FormTextField name="phoneNumber" label="" placeholder="Enter mobile number" digitsOnly maxLength={10} />
                        </LabeledField>
                        <LabeledField label="Alternate Mobile Number">
                          <FormTextField name="alternateMobileNumber" label="" placeholder="Enter alternate mobile number" digitsOnly maxLength={10} />
                        </LabeledField>
                        <LabeledField label="Date of Joining">
                          <FormDatePicker name="dateOfJoining" label="" />
                        </LabeledField>

                        <LabeledField label="Approval Authorization">
                          <FormSelect name="approvalAuthorization" label="" options={APPROVAL_AUTHORIZATION_OPTIONS} />
                        </LabeledField>
                        <LabeledField label="Signature">
                          <EmployeeSignatureField
                            currentSignatureUrl={editingRow?.signatureUrl}
                            editing={!readOnly}
                            signatureFile={signatureFile}
                            previewUrl={signaturePreview}
                            removeRequested={removeSignatureRequested}
                            onFileSelected={handleSignatureFileSelected}
                            onRemove={handleSignatureRemoveClick}
                            error={signatureError}
                          />
                        </LabeledField>
                        <LabeledField label="Status *">
                          <FormSelect
                            name="status"
                            label=""
                            options={[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]}
                          />
                        </LabeledField>
                      </FormGrid>
                    </CardContent>
                  </Card>
                </Stack>
              </DialogContent>

              <DialogActions sx={{ px: 3, py: 2 }}>
                <FormSubmitButton disabled={creating || updating || uploadingSignature || removingSignature}>
                  {readOnly ? 'View' : editingRow ? 'Update Employee' : 'Save Employee'}
                </FormSubmitButton>
                <Button variant={readOnly ? 'outlined' : 'text'} color={readOnly ? 'error' : 'inherit'} onClick={requestClose} disabled={creating || updating || uploadingSignature || removingSignature}>
                  {readOnly ? 'Close' : 'Cancel'}
                </Button>
              </DialogActions>
            </>
            );
          }}
        </AppForm>
      </Dialog>

      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Employee List</Typography>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TableSearchFilter table={table} placeholder="Search employees..." width={220} />
              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => refetch()} disabled={isFetching}>
                Refresh
              </Button>
            </Stack>

            <TableFilterPanel table={table} />
          </Stack>

          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {!isLoading && pagedRows.map((row) => (
                <MobileRecordCard
                  key={row.id}
                  title={row.employeeName}
                  statusChip={<Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />}
                  fields={[
                    { label: 'Employee Code', value: row.employeeCode },
                    { label: 'Department', value: departmentNameById.get(row.departmentId) || '—' },
                    { label: 'Phone Number', value: row.phoneNumber || '—' },
                    { label: 'Email', value: row.email || '—' },
                    { label: 'Date of Joining', value: formatDate(row.dateOfJoining) },
                  ]}
                  onView={() => handleView(row)}
                  onEdit={() => handleEdit(row)}
                  onDelete={() => handleDelete(row)}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                <EmptyState icon={<ApartmentOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No employees yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first employee to get started'} />
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table
                size="small"
                stickyHeader
                sx={{
                  '& th, & td': {
                    height: TABLE_ROW_HEIGHT,
                    paddingTop: `${TABLE_CELL_PADDING_Y}px`,
                    paddingBottom: `${TABLE_CELL_PADDING_Y}px`,
                    boxSizing: 'border-box',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell width={48}>#</TableCell>
                    <SortableHeaderCell field="employeeCode" sort={table.sort} onSort={table.toggleSort}>Employee Code</SortableHeaderCell>
                    <SortableHeaderCell field="employeeName" sort={table.sort} onSort={table.toggleSort}>Employee Name</SortableHeaderCell>
                    <SortableHeaderCell field="department" sort={table.sort} onSort={table.toggleSort}>Department</SortableHeaderCell>
                    <SortableHeaderCell field="phoneNumber" sort={table.sort} onSort={table.toggleSort}>Phone Number</SortableHeaderCell>
                    <SortableHeaderCell field="email" sort={table.sort} onSort={table.toggleSort}>Email</SortableHeaderCell>
                    <SortableHeaderCell field="dateOfJoining" sort={table.sort} onSort={table.toggleSort}>Date of Joining</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.employeeCode}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.employeeName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{departmentNameById.get(row.departmentId) || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.phoneNumber || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.email || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.dateOfJoining)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <IconButton size="small" onClick={() => handleView(row)} aria-label="view">
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                          <CanEdit>
                            <IconButton size="small" color="primary" onClick={() => handleEdit(row)} aria-label="edit">
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </CanEdit>
                          <CanDelete>
                            <IconButton size="small" color="error" onClick={() => handleDelete(row)} aria-label="delete">
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </CanDelete>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9}>
                        <EmptyState icon={<ApartmentOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No employees yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first employee to get started'} />
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

      {/* Employee Master is one row per employee, not the multi-line document
          sheet the dialog's default copy describes — hence its own
          description and a "Row" heading on the results table. Department and
          Branch are the two columns that must match an existing master
          record, so the copy says so up front rather than leaving it to be
          discovered from a failed import. */}
      <BulkImportDialog
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        resourceName="Employees"
        templateUrl="/company/sales-employees/import-template"
        importUrl="/company/sales-employees/import-xlsx"
        rowLabel="Row"
        description="Download the template, fill in one row per employee, then upload it back here. Employee Code and Employee Name are required; Department and Branch must match a name that already exists in those masters (leave them blank if unsure)."
        onImported={refetch}
      />

      {/* Fixed 2:1 box -- same proportions as the signature preview box
          above (140x70) -- so what the person sees while cropping matches
          what the print templates will actually show. */}
      <ImageCropDialog
        open={Boolean(cropSourceUrl)}
        imageSrc={cropSourceUrl}
        fileName={cropSourceFile?.name}
        mimeType={cropSourceFile?.type}
        aspect={2}
        outputWidth={480}
        outputHeight={240}
        title="Position signature"
        onCancel={handleSignatureCropCancel}
        onCropped={handleSignatureCropped}
      />
    </Box>
  );
}
