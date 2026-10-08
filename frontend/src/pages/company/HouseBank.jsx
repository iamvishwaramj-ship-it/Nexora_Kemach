import React, { useEffect, useMemo, useState } from 'react';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import {
  Box, Typography, Button, Card, CardContent, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, alpha,
} from '@mui/material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import QrCode2OutlinedIcon from '@mui/icons-material/QrCode2Outlined';
import { z } from 'zod';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import { useUnsavedChangesGuard, FormDirtyTracker } from '../../components/form/useUnsavedChangesGuard';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
import { FormCheckbox } from '../../components/form/FormCheckbox';
import { useCurrencyOptions } from '../../lib/currencyOptions';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import useDragScroll from '../../components/data-display/useDragScroll';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { requiredString, optionalString, statusEnum, optionalDate, accountNumber } from '../../lib/validation/common';
import {
  houseBankApi, bankNameApi, useUploadHouseBankQrCodeMutation, useRemoveHouseBankQrCodeMutation,
} from '../../features/resources';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';
// Local schema — the shared houseBankSchema requires accountName, opening
// balance and opening date; this page's design marks those optional (no
// asterisk), so relax them here rather than changing every other consumer
// of houseBankSchema.
const houseBankDetailsSchema = z.object({
  bankName: requiredString('Bank name'),
  accountNumber: accountNumber('Account number'),
  accountName: requiredString('Account name'),
  ifscCode: optionalString(),
  bankAddress: optionalString(),
  branchName: optionalString(),
  accountType: requiredString('Account type'),
  currency: requiredString('Currency'),
  openingBalance: z.preprocess(
    (v) => (v === '' || v == null ? undefined : Number(v)),
    z.number().min(0, 'Opening balance cannot be negative').optional()
  ),
  openingDate: optionalDate('Opening date'),
  description: optionalString(),
  status: statusEnum(),
  isDefault: z.boolean().optional(),
});

const emptyValues = {
  bankName: '', accountNumber: '', accountName: '', ifscCode: '', bankAddress: '', branchName: '',
  accountType: '', currency: 'INR', openingBalance: '', openingDate: null, description: '', status: 'Active',
  isDefault: false,
};

// QR code — same upload/preview/remove pattern as
// BusinessPartnerLogoField (pages/businessPartner/BusinessPartner.jsx),
// backed by House Bank's own POST/DELETE /company/house-banks/:id/qr-code
// endpoints instead of /business-partners/:id/logo. Deposit Entry's
// "Attachment" field looked like the obvious precedent to copy but never
// actually uploads file bytes anywhere (it only remembers the chosen file's
// name), so it has nothing to render as a thumbnail here — this reuses the
// logo pattern instead, which is the only "upload one image, show it back"
// flow in this codebase that actually persists bytes.
//
// Upload/remove don't hit the server immediately on pick/click — they're
// staged locally (qrFile / removeRequested, held in the page component so
// they survive re-renders of the AppForm render-prop) and only sent when the
// surrounding form is actually saved (see handleSubmit below), so backing
// out of an edit with Cancel never leaves a half-applied QR code change.
const QR_ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const QR_MAX_BYTES = 2 * 1024 * 1024;

function validateQrFile(file) {
  if (!QR_ACCEPTED_TYPES.includes(file.type)) {
    return 'Please choose a PNG, JPG or WEBP image.';
  }
  if (file.size > QR_MAX_BYTES) {
    return 'Image is too large. Maximum size is 2MB.';
  }
  return null;
}

function HouseBankQrCodeField({ currentQrUrl, editing, qrFile, previewUrl, removeRequested, onFileSelected, onRemove, error }) {
  const showImage = !removeRequested && (previewUrl || currentQrUrl);
  const imageSrc = qrFile ? previewUrl : currentQrUrl;

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
          width: 80, height: 80,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', flexShrink: 0,
        }}
      >
        {showImage ? (
          <Box component="img" src={imageSrc} alt="Bank QR code" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <QrCode2OutlinedIcon sx={{ fontSize: 34, color: 'text.disabled' }} />
        )}
        {editing && (
          <IconButton
            component="label"
            size="small"
            sx={{ position: 'absolute', bottom: -4, right: -4, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
          >
            <PhotoCameraIcon fontSize="small" />
            <input type="file" accept={QR_ACCEPTED_TYPES.join(',')} hidden onChange={handleChange} />
          </IconButton>
        )}
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          PNG, JPG or WEBP. Max 2MB.
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

const ACCOUNT_TYPE_OPTIONS = [
  { label: 'Current Account', value: 'Current Account' },
  { label: 'Savings Account', value: 'Savings Account' },
  { label: 'Cash Credit', value: 'Cash Credit' },
  { label: 'Overdraft', value: 'Overdraft' },
];

// Currency reads live from Currency Master instead of a hardcoded list — see
// lib/currencyOptions.js. (AED, previously hardcoded here, is not seeded in
// Currency Master by default; add it there if this bank needs it.)

const PAGE_SIZE = 10;

const TABLE_ROW_HEIGHT = 0;         // floor, not a cap
const TABLE_CELL_PADDING_Y = 6;     // the actual top/bottom gap per cell, in px — this is what actually controls row height
const currency = (v) => (v == null ? '—' : Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function HouseBank() {
  const currencyOptions = useCurrencyOptions();
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const { data: houseBanks, isLoading, isFetching, refetch } = houseBankApi.useList();
  const { data: bankNames } = bankNameApi.useList();
  const [create, { isLoading: creating }] = houseBankApi.useCreate();
  const [update, { isLoading: updating }] = houseBankApi.useUpdate();
  const [remove] = houseBankApi.useDelete();
  const [uploadQrCode, { isLoading: uploadingQrCode }] = useUploadHouseBankQrCodeMutation();
  const [removeQrCode, { isLoading: removingQrCode }] = useRemoveHouseBankQrCodeMutation();

  // QR code — staged here (not inside the AppForm render-prop) so it survives
  // that render-prop remounting on every field change, same reason
  // BusinessPartner.jsx stages its logo state at the page level.
  const [qrFile, setQrFile] = useState(null);
  const [qrPreview, setQrPreview] = useState(null);
  const [removeQrRequested, setRemoveQrRequested] = useState(false);
  const [qrError, setQrError] = useState(null);

  const resetQrState = () => {
    setQrFile(null);
    setQrPreview(null);
    setRemoveQrRequested(false);
    setQrError(null);
  };

  const handleQrFileSelected = (file) => {
    const validationError = validateQrFile(file);
    if (validationError) {
      setQrError(validationError);
      return;
    }
    setQrError(null);
    setRemoveQrRequested(false);
    setQrFile(file);
    const reader = new FileReader();
    reader.onload = () => setQrPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleQrRemoveClick = () => {
    setQrFile(null);
    setQrPreview(null);
    setQrError(null);
    setRemoveQrRequested(true);
  };

  const bankNameOptions = (bankNames || []).map((b) => ({ label: b.bankName, value: b.bankName }));

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
  const allRows = houseBanks || [];
  const baseTableRows = useMemo(() => {
    const q = '';
    if (!q) return allRows;
    return allRows.filter((r) => [r.bankName, r.accountNumber, r.accountName, r.branchName].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [allRows]);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'bankName', headerName: 'Bank Name', filter: 'text' },
    { field: 'accountNumber', headerName: 'A/c No.', filter: 'text' },
    { field: 'accountName', headerName: 'Beneficiary Name', filter: 'text' },
    { field: 'ifscCode', headerName: 'RTGS/IFSC Code', filter: 'text' },
    { field: 'accountType', headerName: 'Type', filter: 'text' },
    { field: 'currency', headerName: 'Currency', filter: 'text' },
    { field: 'openingBalance', headerName: 'Opening Balance', filter: 'numberRange', sortValue: (row) => (row.openingBalance == null || row.openingBalance === '' ? null : Number(row.openingBalance)) },
    { field: 'openingDate', headerName: 'Opening Date', filter: 'dateRange', sortValue: (row) => (row.openingDate ? new Date(row.openingDate).getTime() : null), searchValue: (row) => formatDate(row.openingDate) },
    { field: 'status', headerName: 'Status', filter: 'select' },
    // Which house bank is the default (HouseBank.isDefault). `value` maps
    // the raw boolean to the words shown in the cell, same convention as
    // Branch.jsx's own Default column.
    { field: 'isDefault', headerName: 'Default', filter: 'select', value: (r) => (r.isDefault ? 'Default' : '—') },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  useEffect(() => { setPage(0); }, [search]);

  const openCreate = () => {
    setEditingRow(null);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    resetQrState();
    setDialogOpen(true);
  };

  const closeForm = () => {
    setDialogOpen(false);
    setEditingRow(null);
    resetQrState();
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
    resetQrState();
    setDialogOpen(true);
  };

  const handleEdit = (row) => {
    setEditingRow(row);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    resetQrState();
    setDialogOpen(true);
  };

  const handleDelete = async (row) => {
    const ok = await confirmDialog({
      title: 'Delete house bank',
      message: `Are you sure you want to delete "${row.bankName}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('House bank deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    try {
      if (editingRow) {
        // QR code changes go through their own multipart/DELETE endpoints
        // (OCI Object Storage), applied first, ahead of the plain JSON
        // update for the rest of the fields — a failed QR upload then never
        // leaves the rest of the form silently unsaved along with it. Same
        // ordering as BusinessPartner.jsx's own logo handling.
        if (qrFile) {
          const formData = new FormData();
          formData.append('file', qrFile);
          await uploadQrCode({ id: editingRow.id, formData }).unwrap();
        } else if (removeQrRequested) {
          await removeQrCode(editingRow.id).unwrap();
        }
        await update({ id: editingRow.id, ...values }).unwrap();
        notify.success('House bank updated');
      } else {
        const created = await create(values).unwrap();
        // A QR code picked on the Add form has no bank id to upload against
        // until the record exists, so it's uploaded right after creation
        // succeeds instead.
        if (qrFile) {
          const formData = new FormData();
          formData.append('file', qrFile);
          await uploadQrCode({ id: created.id, formData }).unwrap();
        }
        notify.success('House bank added');
      }
      forceClose();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<AccountBalanceIcon />}
        title="House Bank"
        subtitle="Manage your house bank accounts."
        rightContent={
          <CanAdd>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Add House Bank
            </Button>
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
            {readOnly ? 'View House Bank' : editingRow ? 'Edit House Bank' : 'New House Bank'}
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
          schema={houseBankDetailsSchema}
          defaultValues={editingRow ? { ...emptyValues, ...editingRow } : emptyValues}
          onSubmit={handleSubmit}
        >
          {() => (
            <>
              {/* Watches for the first real user edit so the close handlers
                  above know whether there is anything to lose. */}
              <FormDirtyTracker onDirtyChange={setDirty} />
              <DialogContent dividers>
                <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                  <LabeledField label="Bank Name *">
                    <FormSelect name="bankName" label="" placeholder="Select bank name" options={bankNameOptions} />
                  </LabeledField>
                  <LabeledField label="A/c No. *">
                    <FormTextField name="accountNumber" label="" placeholder="Enter account number" digitsOnly maxLength={18} />
                  </LabeledField>
                  <LabeledField label="Beneficiary Name *">
                    <FormTextField name="accountName" label="" placeholder="Enter account name" />
                  </LabeledField>
                  <LabeledField label="RTGS/IFSC Code">
                    <FormTextField name="ifscCode" label="" placeholder="Enter IFSC code" />
                  </LabeledField>

                  <LabeledField label="Bank Address">
                    <FormTextField name="bankAddress" label="" placeholder="Enter bank address" />
                  </LabeledField>
                  <LabeledField label="Branch">
                    <FormTextField name="branchName" label="" placeholder="Enter branch name" />
                  </LabeledField>
                  <LabeledField label="Type *">
                    <FormSelect name="accountType" label="" placeholder="Select account type" options={ACCOUNT_TYPE_OPTIONS} />
                  </LabeledField>
                  <LabeledField label="Currency *">
                    <FormSelect name="currency" label="" placeholder="Select currency" options={currencyOptions} />
                  </LabeledField>

                  <LabeledField label="Opening Balance">
                    <FormTextField name="openingBalance" label="" type="number" placeholder="Enter opening balance" />
                  </LabeledField>
                  <LabeledField label="Opening Balance Date">
                    <FormDatePicker name="openingDate" label="" />
                  </LabeledField>
                  <LabeledField label="Description">
                    <FormTextField name="description" label="" placeholder="Enter description (optional)" />
                  </LabeledField>
                  <LabeledField label="Status *">
                    <FormSelect
                      name="status"
                      label=""
                      options={[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]}
                    />
                  </LabeledField>

                  <FormCheckbox name="isDefault" label="Set as Default" />
                  <LabeledField label="Bank QR Code">
                    <HouseBankQrCodeField
                      currentQrUrl={editingRow?.qrCodeUrl}
                      editing={!readOnly}
                      qrFile={qrFile}
                      previewUrl={qrPreview}
                      removeRequested={removeQrRequested}
                      onFileSelected={handleQrFileSelected}
                      onRemove={handleQrRemoveClick}
                      error={qrError}
                    />
                  </LabeledField>
                </FormGrid>
              </DialogContent>

              <DialogActions sx={{ px: 3, py: 2 }}>
                <FormSubmitButton disabled={creating || updating || uploadingQrCode || removingQrCode}>
                  {readOnly ? 'View' : editingRow ? 'Update House Bank' : 'Save House Bank'}
                </FormSubmitButton>
                <Button variant={readOnly ? 'outlined' : 'text'} color={readOnly ? 'error' : 'inherit'} onClick={requestClose} disabled={creating || updating || uploadingQrCode || removingQrCode}>
                  {readOnly ? 'Close' : 'Cancel'}
                </Button>
              </DialogActions>
            </>
          )}
        </AppForm>
      </Dialog>

      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>House Bank List</Typography>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TableSearchFilter table={table} placeholder="Search house banks..." width={220} />
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
                  title={row.bankName}
                  statusChip={
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      {row.isDefault && <Chip size="small" label="Default" color="primary" />}
                      <Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />
                    </Stack>
                  }
                  fields={[
                    { label: 'A/c No.', value: row.accountNumber },
                    { label: 'Beneficiary Name', value: row.accountName || '—' },
                    { label: 'RTGS/IFSC Code', value: row.ifscCode || '—' },
                    { label: 'Type', value: row.accountType || '—' },
                    { label: 'Currency', value: row.currency || '—' },
                    { label: 'Opening Balance', value: currency(row.openingBalance) },
                    { label: 'Opening Date', value: formatDate(row.openingDate) },
                    {
                      label: 'QR Code',
                      value: row.qrCodeUrl
                        ? <Box component="img" src={row.qrCodeUrl} alt="Bank QR code" sx={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 0.5, border: '1px solid', borderColor: 'divider' }} />
                        : '—',
                    },
                  ]}
                  onView={() => handleView(row)}
                  onEdit={() => handleEdit(row)}
                  onDelete={() => handleDelete(row)}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                <EmptyState icon={<ApartmentOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No house banks yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first house bank to get started'} />
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
                    <SortableHeaderCell field="bankName" sort={table.sort} onSort={table.toggleSort}>Bank Name</SortableHeaderCell>
                    <SortableHeaderCell field="accountNumber" sort={table.sort} onSort={table.toggleSort}>A/c No.</SortableHeaderCell>
                    <SortableHeaderCell field="accountName" sort={table.sort} onSort={table.toggleSort}>Beneficiary Name</SortableHeaderCell>
                    <SortableHeaderCell field="ifscCode" sort={table.sort} onSort={table.toggleSort}>RTGS/IFSC Code</SortableHeaderCell>
                    <SortableHeaderCell field="accountType" sort={table.sort} onSort={table.toggleSort}>Type</SortableHeaderCell>
                    <SortableHeaderCell field="currency" sort={table.sort} onSort={table.toggleSort}>Currency</SortableHeaderCell>
                    <SortableHeaderCell field="openingBalance" sort={table.sort} onSort={table.toggleSort}>Opening Balance</SortableHeaderCell>
                    <SortableHeaderCell field="openingDate" sort={table.sort} onSort={table.toggleSort}>Opening Date</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <SortableHeaderCell field="isDefault" sort={table.sort} onSort={table.toggleSort}>Default</SortableHeaderCell>
                    <TableCell>QR Code</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.bankName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.accountNumber}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.accountName || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.ifscCode || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.accountType || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.currency || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{currency(row.openingBalance)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.openingDate)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        {row.isDefault
                          ? <Chip size="small" label="Default" color="primary" />
                          : <Typography variant="body2" color="text.secondary">—</Typography>}
                      </TableCell>
                      <TableCell>
                        {row.qrCodeUrl
                          ? <Box component="img" src={row.qrCodeUrl} alt="Bank QR code" sx={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 0.5, border: '1px solid', borderColor: 'divider' }} />
                          : <Typography variant="body2" color="text.secondary">—</Typography>}
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
                      <TableCell colSpan={13}>
                        <EmptyState icon={<ApartmentOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No house banks yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first house bank to get started'} />
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
