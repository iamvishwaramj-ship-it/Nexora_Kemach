import React, { useMemo, useState } from 'react';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import {
  Box, Typography, Button, Card, CardContent, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Tooltip,
  Tabs, Tab, Grid, createFilterOptions, TextField,
} from '@mui/material';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import InputAdornment from '@mui/material/InputAdornment';
import { useSelector } from 'react-redux';
import { z } from 'zod';
import AppForm, { FormSubmitButton } from '../../components/form/AppForm';
import { useUnsavedChangesGuard, FormDirtyTracker } from '../../components/form/useUnsavedChangesGuard';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import PermissionMatrix, { buildPermissionRows } from '../../components/common/PermissionMatrix';
import BranchAccessTable from '../../components/user/BranchAccessTable';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { requiredString, optionalString, statusEnum } from '../../lib/validation/common';
import { appUserApi, salesEmployeeApi } from '../../features/resources';
import { selectCurrentUser } from '../../store/authSlice';
import { isAdmin } from '../../lib/permissions';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';

// role stays a plain string (matches the existing AppUser.role column), but
// 'admin' specifically must be preserved verbatim — it's the exact string
// backend/src/middleware/auth.js and crudRouter's deleteRoles compare
// against everywhere else in the app that gates an action to admins. The
// other three are just labels; nothing currently branches on them.
const ROLE_OPTIONS = [
  { label: 'Admin', value: 'admin' },
  { label: 'Manager', value: 'manager' },
  { label: 'Staff', value: 'staff' },
  { label: 'User', value: 'user' },
];

const permissionRowSchema = z.object({
  menuKey: z.string(),
  canView: z.boolean(),
  canAdd: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
  canCancel: z.boolean().optional(),
  // Extra flag (Notification column) -- NOT menu access, so the "at least one
  // permission" refine below and the N-sections summaries deliberately ignore it.
  canNotify: z.boolean().optional(),
  hiddenColumns: z.array(z.string()).optional(),
});

// Same rule the reference design shows in red at the top of the grid, and
// the same rule the server re-checks on save (see routes/users.js) — a
// client-side schema is never trusted as the only gate.
const permissionsSchema = z
  .array(permissionRowSchema)
  .refine((rows) => rows.some((r) => r.canView || r.canAdd || r.canEdit || r.canDelete || r.canCancel), {
    message: 'Grant at least one section permission.',
  });

const passwordRule = (v) => !v || (v.length >= 8 && /[A-Z]/.test(v) && /[0-9]/.test(v));
const passwordMessage = 'Password must be at least 8 characters and contain an uppercase letter and a number';

const branchRowSchema = z.object({
  branchId: requiredString('Branch'),
  isDefault: z.boolean(),
});

// Same "at least one" shape as permissionsSchema below — a user with zero
// branches has nowhere to work at all, so the Branch tab can't be left
// empty any more than the Permissions tab can.
const branchesSchema = z.array(branchRowSchema).min(1, 'At least one branch is required');

// Nullable FK select (Employee) — an empty Autocomplete emits null (see
// FormSelect), which must stay null rather than being coerced to '' (this is
// an INT column, not a string). Same shape as SalesEmployee.jsx's own
// optionalDepartmentId, kept local since this is the only FK select here.
//
// Optional for every account — no user code requires an Employee link.
const optionalEmployeeId = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z.number({ invalid_type_error: 'Employee is invalid' }).int().positive().nullable().optional()
);

export const SEEDED_ADMIN_USER_CODE = 'admin';

// userCode ("Employee User Code") replaced email as the login identifier, so
// it is a plain required string — an email validator here would reject every
// user code. email is no longer collected on this form at all (it survives on
// AppUser purely as optional contact info; see schema.prisma).
//
// name is likewise gone from the form: it is derived server-side from the
// selected Employee's name (routes/users.js's resolveEmployeeFields), which
// is exactly what employeeName below mirrors for display.
const baseUserShape = () => ({
  userCode: requiredString('Employee user code'),
  employeeId: optionalEmployeeId,
  // Auto-filled from the Employee selection and rendered read-only — carried
  // in the form purely so the two fields have somewhere to live and so the
  // payload matches what the server stores.
  employeeCode: optionalString(),
  employeeName: optionalString(),
  role: requiredString('Role'),
  status: statusEnum(),
  branches: branchesSchema,
  permissions: permissionsSchema,
});

// Password + confirmation are required on create...
const buildCreateUserSchema = () => z
  .object({
    ...baseUserShape(),
    password: z.string().min(1, 'Password is required').refine(passwordRule, passwordMessage),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// ...but optional on edit — a blank password leaves the account's existing
// one untouched (see routes/users.js's PUT handler), so re-saving someone's
// role or permissions never forces a password reset as a side effect.
const buildEditUserSchema = () => z
  .object({
    ...baseUserShape(),
    password: z.string().refine(passwordRule, passwordMessage),
    confirmPassword: z.string(),
  })
  .refine((data) => !data.password || data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

function getEmptyValues() {
  return {
    userCode: '', employeeId: null, employeeCode: '', employeeName: '',
    password: '', confirmPassword: '', role: 'staff', status: 'Active',
    branches: [{ branchId: '', isDefault: true }],
    permissions: buildPermissionRows(),
  };
}

// The Employee Name dropdown is searchable by BOTH the employee's code and
// their name: MUI's default filter only matches an option's `label` (the name
// here), so typing a code like "EMP-000012" would find nothing at all.
// Stringifying both fields into the searchable text is what makes one field
// serve as the picker for both columns.
const employeeFilterOptions = createFilterOptions({
  stringify: (option) => `${option.employeeCode || ''} ${option.employeeName || ''}`,
});

// Each row shows the code alongside the name while choosing, so two employees
// with the same or similar names are still tellable apart — the field itself
// keeps showing just the name once picked (Autocomplete uses getOptionLabel
// for that), with the code landing in its own Employee Code field.
const renderEmployeeOption = (props, option) => {
  const { key, ...optionProps } = props;
  return (
    <Box component="li" {...optionProps} key={option.value ?? key}>
      <Stack direction="row" spacing={1} alignItems="baseline">
        <Typography variant="body2" fontWeight={600}>{option.employeeCode || '—'}</Typography>
        <Typography variant="body2" color="text.secondary">{option.employeeName}</Typography>
      </Stack>
    </Box>
  );
};

const PAGE_SIZE = 10;

const USER_LIST_TABLE_ROW_HEIGHT = 0;
const USER_LIST_TABLE_CELL_PADDING_Y = 6;
export default function UserManagement() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const currentUser = useSelector(selectCurrentUser);
  // User Management's own writes are hard-locked to role === 'admin' on the
  // server (backend/src/routes/users.js's POST/PUT/DELETE all declare
  // auth(['admin'])) -- deliberately, since granting someone Edit here would
  // otherwise mean granting them the power to edit their own (and everyone
  // else's) permission grid. That is a stricter, separate boundary from the
  // per-menu canAdd/canEdit/canDelete grid every other page gates its
  // buttons on, so this page cannot use CanAdd/CanEdit/CanDelete (those
  // would show the button to anyone the grid happens to grant "Edit" on the
  // User menu, only for the click to bounce off the server's admin-only
  // check with "Insufficient permissions"). Gate directly on isAdmin
  // instead, matching the real boundary being enforced.
  const admin = isAdmin(currentUser);
  const { data: users, isLoading } = appUserApi.useList();
  // Employee Master drives the Employee select and its auto-fill — same
  // salesEmployeeApi.useList() source SalesOrder.jsx builds its own
  // Sales Person / Prepared By / Approved By pickers from.
  const { data: employees } = salesEmployeeApi.useList();
  // The option's `label` is the Employee NAME, because the field the user
  // picks from is labelled "Employee Name" — but each option also carries its
  // employeeCode so the dropdown can be searched by either one (see
  // employeeFilterOptions below) and can show both while choosing.
  const employeeOptions = useMemo(
    () => (employees || [])
      .filter((e) => e.status !== 'Inactive')
      .map((e) => ({
        label: e.employeeName,
        value: e.id,
        employeeCode: e.employeeCode,
        employeeName: e.employeeName,
      })),
    [employees]
  );
  const [create, { isLoading: creating }] = appUserApi.useCreate();
  const [update, { isLoading: updating }] = appUserApi.useUpdate();
  const [remove] = appUserApi.useDelete();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  // Editing an existing user is split into two separate actions: 'details'
  // (name/email/role/password/status + Branch) and 'permissions' (the
  // Permissions grid only). Irrelevant when creating (null) or viewing
  // (readOnly shows everything regardless of this value).
  const [editMode, setEditMode] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const allRows = users || [];

  const tableColumns = useMemo(() => ([
    { field: 'userCode', headerName: 'Employee User Code', filter: 'text' },
    { field: 'employeeCode', headerName: 'Employee Code', filter: 'text' },
    { field: 'employeeName', headerName: 'Employee Name', filter: 'text', value: (r) => r.employeeName || r.name || '' },
    { field: 'role', headerName: 'Role', filter: 'select' },
    { field: 'status', headerName: 'Status', filter: 'select' },
    // Not searchable/sortable by anything meaningful — just a quick "how
    // much access does this person actually have" glance in the list.
    {
      field: 'permissionCount',
      headerName: 'Permissions',
      filter: 'numberRange',
      value: (r) => (r.permissions || []).filter((p) => p.canView || p.canAdd || p.canEdit || p.canDelete || p.canCancel).length,
    },
  ]), []);
  const table = useTableFeatures(allRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  const openCreate = () => {
    setEditingRow(null);
    setReadOnly(false);
    setEditMode(null);
    setFormKey((k) => k + 1);
    setDialogOpen(true);
  };

  const closeForm = () => {
    setDialogOpen(false);
    setEditingRow(null);
    setEditMode(null);
  };

  const { requestClose, forceClose, setDirty, dialogCloseProps } = useUnsavedChangesGuard(closeForm);

  // Read-only look at a record — same form, every field disabled
  // and the save button removed (see AppForm's readOnly prop).
  const handleView = (row) => {
    setEditingRow(row);
    setReadOnly(true);
    setEditMode(null);
    setFormKey((k) => k + 1);
    setDialogOpen(true);
  };

  // mode: 'details' (name/email/role/password/status + Branch) or
  // 'permissions' (the Permissions grid only) — the two Edit actions in the
  // row menu each open the same dialog scoped to one half of the record.
  const handleEdit = (row, mode) => {
    setEditingRow(row);
    setReadOnly(false);
    setEditMode(mode);
    setFormKey((k) => k + 1);
    setDialogOpen(true);
  };

  const handleDelete = async (row) => {
    const ok = await confirmDialog({
      title: 'Delete user',
      message: `Are you sure you want to delete "${row.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('User deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    const { confirmPassword, ...rest } = values;
    const payload = { ...rest };
    // Editing without touching the password field must not send an empty
    // string through — routes/users.js treats "no password key" and "blank
    // password" the same way (leave the hash alone), but there is no reason
    // to send the field at all when there is nothing in it.
    if (!payload.password) delete payload.password;
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('User updated');
      } else {
        await create(payload).unwrap();
        notify.success('User added');
      }
      forceClose();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<ManageAccountsIcon />}
        title="User Management"
        subtitle="Add users and grant menu-based View / Add / Edit / Delete / Cancel permissions."
        rightContent={
          admin ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Add User
            </Button>
          ) : null
        }
      />

      <Dialog
        open={dialogOpen}
        {...dialogCloseProps}
        maxWidth="lg"
        fullWidth
        sx={{
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
            {readOnly
              ? 'View User'
              : editingRow
                ? (editMode === 'permissions' ? 'Edit Permissions' : 'Edit User')
                : 'New User'}
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
          schema={editingRow ? buildEditUserSchema() : buildCreateUserSchema()}
          defaultValues={editingRow
            ? {
              ...getEmptyValues(),
              ...editingRow,
              password: '',
              confirmPassword: '',
              branches: (editingRow.branches || []).length
                ? editingRow.branches.map((b) => ({ branchId: String(b.branchId), isDefault: !!b.isDefault }))
                : getEmptyValues().branches,
              permissions: buildPermissionRows(editingRow.permissions),
            }
            : getEmptyValues()}
          onSubmit={handleSubmit}
        >
          {({ setValue, watch }) => {
            const [activeTab, setActiveTab] = useState(0);
            // Confirm Password starts locked (greyed out) every time the
            // dialog opens — this render-prop remounts along with AppForm's
            // `key={formKey}`, so the lock re-arms itself on every open the
            // same way `activeTab` above does. Clicking the lock next to the
            // Password field is the only way to unlock it; it never unlocks
            // itself as a side effect of typing.
            const [confirmPasswordUnlocked, setConfirmPasswordUnlocked] = useState(false);
            // Picking an Employee copies that Employee Master record's code
            // and name onto the form. Both fields are rendered read-only, so
            // this selection is the only thing that can ever set them —
            // they always mirror the linked employee rather than drifting
            // into a hand-typed value. The server re-reads the employee by
            // id on save and re-derives both (see routes/users.js), so these
            // are for display, not the source of truth.
            const handleEmployeeChange = (value) => {
              const employee = (employees || []).find((e) => e.id === value);
              setValue('employeeCode', employee?.employeeCode || '', { shouldValidate: true });
              setValue('employeeName', employee?.employeeName || '', { shouldValidate: true });
            };
            // Create and View still work with the full record (top fields +
            // both tabs). An in-progress edit is scoped to just the half its
            // Edit button was opened for.
            // 'admin' is the one role the whole app special-cases (the same
            // verbatim string noted on ROLE_OPTIONS above), and branch
            // scoping is one of the places it does: an admin is never
            // branch-restricted on either side of the wire — see
            // backend/src/utils/branchScope.js and lib/useBranchOptions.js.
            // So the Branch tab drops its per-branch grid for one and says
            // so outright instead; see BranchAccessTable's `unrestricted`.
            const unrestrictedBranches = watch('role') === 'admin';
            // Staff still gets the normal per-row grid (unlike Admin above)
            // but may also be granted every branch in one pick — see
            // BranchAccessTable's `showAllOption` doc comment.
            const showAllBranchesOption = watch('role') === 'staff';
            const showTopFields = !editingRow || readOnly || editMode === 'details';
            const showBranchSection = !editingRow || readOnly || editMode === 'details';
            const showPermissionsSection = !editingRow || readOnly || editMode === 'permissions';
            const showBothSections = showBranchSection && showPermissionsSection;
            return (
            <>
              <FormDirtyTracker onDirtyChange={setDirty} />
              <DialogContent dividers>
                {showTopFields && (
                  /* Two EXPLICIT columns, not a 2-up FormGrid: FormGrid flows
                     its children left-right-left-right, which cannot produce
                     the required grouping (the left column has five fields and
                     the right three). A Grid of two halves, each stacking its
                     own fields vertically, is what actually pins each field to
                     the column it belongs in at md and up — and collapses to a
                     single readable column on a phone. */
                  <Grid container columnSpacing={FIELD_COLUMN_SPACING} rowSpacing={0}>
                    <Grid item xs={12} md={6}>
                      <Stack spacing={FIELD_ROW_SPACING}>
                        <LabeledField label="Employee User Code *">
                          <FormTextField name="userCode" label="" placeholder="Enter employee user code" />
                        </LabeledField>
                        {/* Auto-filled from the Employee Name select in the
                            right-hand column — read-only, so the pair always
                            describes one real Employee Master record. */}
                        <LabeledField label="Employee Code">
                          <FormTextField
                            name="employeeCode"
                            label=""
                            placeholder="Filled from the selected employee"
                            disabled
                          />
                        </LabeledField>
                        <LabeledField label={readOnly ? 'View' : editingRow ? 'New Password' : 'Password *'}>
                          {editingRow && !readOnly && !confirmPasswordUnlocked ? (
                            // Mirrors the Confirm Password lock below: the
                            // real password field only mounts (and only
                            // becomes part of the RHF-validated payload) once
                            // unlocked. While locked it's a plain, disabled,
                            // masked stand-in — there's no real value to show
                            // or edit, so it never touches form state or
                            // validation.
                            <TextField
                              name="password-locked-display"
                              fullWidth
                              size="small"
                              type="password"
                              value="********"
                              disabled
                              InputProps={{
                                readOnly: true,
                                endAdornment: (
                                  <InputAdornment position="end">
                                    <Tooltip title={confirmPasswordUnlocked ? 'Lock Password' : 'Unlock Password'}>
                                      <span>
                                        <IconButton
                                          size="small"
                                          edge="end"
                                          onClick={() => {
                                            // Re-locking clears whatever was
                                            // typed into both password fields
                                            // — otherwise a value entered
                                            // before locking would sit hidden
                                            // behind the disabled fields and
                                            // still get submitted.
                                            setConfirmPasswordUnlocked((v) => {
                                              if (v) {
                                                setValue('password', '', { shouldValidate: true });
                                                setValue('confirmPassword', '', { shouldValidate: true });
                                              }
                                              return !v;
                                            });
                                          }}
                                          aria-label={confirmPasswordUnlocked ? 'Lock password field' : 'Unlock password field'}
                                        >
                                          {confirmPasswordUnlocked
                                            ? <LockOpenOutlinedIcon fontSize="small" />
                                            : <LockOutlinedIcon fontSize="small" />}
                                        </IconButton>
                                      </span>
                                    </Tooltip>
                                  </InputAdornment>
                                ),
                              }}
                            />
                          ) : (
                            <FormTextField
                              name="password"
                              label=""
                              type="password"
                              placeholder={readOnly ? 'View' : editingRow ? 'Enter new password' : 'Enter password'}
                              InputProps={editingRow && !readOnly ? {
                                endAdornment: (
                                  <InputAdornment position="end">
                                    <Tooltip title="Lock Password">
                                      <span>
                                        <IconButton
                                          size="small"
                                          edge="end"
                                          onClick={() => {
                                            setValue('password', '', { shouldValidate: true });
                                            setValue('confirmPassword', '', { shouldValidate: true });
                                            setConfirmPasswordUnlocked(false);
                                          }}
                                          aria-label="Lock password field"
                                        >
                                          <LockOpenOutlinedIcon fontSize="small" />
                                        </IconButton>
                                      </span>
                                    </Tooltip>
                                  </InputAdornment>
                                ),
                              } : undefined}
                            />
                          )}
                        </LabeledField>
                        <LabeledField label="Status *">
                          <FormSelect
                            name="status"
                            label=""
                            options={[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]}
                          />
                        </LabeledField>
                      </Stack>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Stack spacing={FIELD_ROW_SPACING}>
                        {/* This IS the employee picker — there is no separate
                            "Employee" field. It writes employeeId (the FK)
                            while displaying the name, and filling in the
                            Employee Code opposite it. Searchable by code or
                            name; see employeeFilterOptions. */}
                        <LabeledField label="Employee Name">
                          <FormSelect
                            name="employeeId"
                            label=""
                            placeholder="Search by employee code or name"
                            options={employeeOptions}
                            filterOptions={employeeFilterOptions}
                            renderOption={renderEmployeeOption}
                            popupFitContent
                            onValueChange={handleEmployeeChange}
                          />
                        </LabeledField>
                        <LabeledField label="Role *">
                          <FormSelect name="role" label="" options={ROLE_OPTIONS} />
                        </LabeledField>
                        <LabeledField label={readOnly ? 'View' : editingRow ? 'Confirm New Password' : 'Confirm Password *'}>
                          <FormTextField
                            name="confirmPassword"
                            label=""
                            type="password"
                            placeholder={!editingRow || confirmPasswordUnlocked ? 'Re-enter password' : 'Click the lock on Password to enable'}
                            disabled={editingRow ? !confirmPasswordUnlocked : false}
                          />
                        </LabeledField>
                      </Stack>
                    </Grid>
                  </Grid>
                )}

                {showBothSections ? (
                  <>
                    <Tabs
                      value={activeTab}
                      onChange={(_e, v) => setActiveTab(v)}
                      sx={{ mt: 3, borderBottom: 1, borderColor: 'divider' }}
                    >
                      <Tab label="Branch" />
                      <Tab label="Permissions" />
                    </Tabs>
                    <Box sx={{ pt: 2 }}>
                      {activeTab === 0 && <BranchAccessTable name="branches" unrestricted={unrestrictedBranches} showAllOption={showAllBranchesOption} />}
                      {activeTab === 1 && <PermissionMatrix name="permissions" />}
                    </Box>
                  </>
                ) : (
                  <Box sx={{ pt: showTopFields ? 3 : 0 }}>
                    {showBranchSection && <BranchAccessTable name="branches" unrestricted={unrestrictedBranches} showAllOption={showAllBranchesOption} />}
                    {showPermissionsSection && <PermissionMatrix name="permissions" />}
                  </Box>
                )}
              </DialogContent>

              <DialogActions sx={{ px: 3, py: 2 }}>
                <FormSubmitButton disabled={creating || updating}>
                  {readOnly
                    ? 'View'
                    : editingRow
                      ? (editMode === 'permissions' ? 'Update Permissions' : 'Update User')
                      : 'Save User'}
                </FormSubmitButton>
                <Button variant={readOnly ? 'outlined' : 'text'} color={readOnly ? 'error' : 'inherit'} onClick={requestClose} disabled={creating || updating}>
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
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>User List</Typography>
            <TableSearchFilter table={table} placeholder="Search users..." width={220} />
          </Stack>

          <TableFilterPanel table={table} />

          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {!isLoading && pagedRows.map((row) => {
                const isSelf = currentUser?.id === row.id;
                return (
                  <MobileRecordCard
                    key={row.id}
                    title={row.employeeName || row.name}
                    statusChip={<Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />}
                    fields={[
                      { label: 'Employee User Code', value: row.userCode || '—' },
                      { label: 'Employee Code', value: row.employeeCode || '—' },
                      { label: 'Role', value: row.role },
                      { label: 'Permissions', value: `${(row.permissions || []).filter((p) => p.canView || p.canAdd || p.canEdit || p.canDelete || p.canCancel).length} sections` },
                    ]}
                    onView={() => handleView(row)}
                    onEdit={admin ? () => handleEdit(row, 'details') : undefined}
                    extraActions={admin ? [{
                      key: 'permissions',
                      label: 'edit-permissions',
                      icon: <AdminPanelSettingsOutlinedIcon fontSize="small" />,
                      onClick: () => handleEdit(row, 'permissions'),
                    }] : []}
                    onDelete={admin && !isSelf ? () => handleDelete(row) : undefined}
                  />
                );
              })}
              {!isLoading && rows.length === 0 && (
                <EmptyState icon={<PersonOutlineIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No users yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first user to get started'} />
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table
                size="small"
                stickyHeader
                sx={{
                  '& th, & td': {
                    height: USER_LIST_TABLE_ROW_HEIGHT,
                    paddingTop: `${USER_LIST_TABLE_CELL_PADDING_Y}px`,
                    paddingBottom: `${USER_LIST_TABLE_CELL_PADDING_Y}px`,
                    boxSizing: 'border-box',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell width={48}>#</TableCell>
                    <SortableHeaderCell field="userCode" sort={table.sort} onSort={table.toggleSort}>Employee User Code</SortableHeaderCell>
                    <SortableHeaderCell field="employeeCode" sort={table.sort} onSort={table.toggleSort}>Employee Code</SortableHeaderCell>
                    <SortableHeaderCell field="employeeName" sort={table.sort} onSort={table.toggleSort}>Employee Name</SortableHeaderCell>
                    <SortableHeaderCell field="role" sort={table.sort} onSort={table.toggleSort}>Role</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <TableCell>Permissions</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => {
                    const isSelf = currentUser?.id === row.id;
                    const grantedCount = (row.permissions || []).filter((p) => p.canView || p.canAdd || p.canEdit || p.canDelete || p.canCancel).length;
                    return (
                      <TableRow key={row.id} hover>
                        <TableCell>{page * pageSize + i + 1}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.userCode || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.employeeCode || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.employeeName || row.name || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{row.role}</TableCell>
                        <TableCell>
                          <Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{grantedCount} section{grantedCount === 1 ? '' : 's'}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <IconButton size="small" onClick={() => handleView(row)} aria-label="view">
                              <VisibilityOutlinedIcon fontSize="small" />
                            </IconButton>
                            {admin && (
                              <Tooltip title="Edit user details & branch">
                                <IconButton size="small" color="primary" onClick={() => handleEdit(row, 'details')} aria-label="edit-details">
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {admin && (
                              <Tooltip title="Edit permissions">
                                <IconButton size="small" color="secondary" onClick={() => handleEdit(row, 'permissions')} aria-label="edit-permissions">
                                  <AdminPanelSettingsOutlinedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {admin && (isSelf ? (
                              <Tooltip title="You cannot delete your own account">
                                <span>
                                  <IconButton size="small" color="error" disabled aria-label="delete">
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            ) : (
                              <IconButton size="small" color="error" onClick={() => handleDelete(row)} aria-label="delete">
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            ))}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <EmptyState icon={<PersonOutlineIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No users yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first user to get started'} />
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
    </Box>
  );
}
