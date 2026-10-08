import React, { useEffect, useMemo, useState } from 'react';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import {
  Box, Typography, Button, Card, CardContent, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import { useUnsavedChangesGuard, FormDirtyTracker } from '../../components/form/useUnsavedChangesGuard';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { locationMasterSchema } from '../../lib/validation/partnerSchemas';
import { locationMasterApi } from '../../features/resources';
import { countries, getStateOptions } from '../../lib/constants/locations';
import { getCityOptions } from '../../lib/constants/locationsCities';
// locationMasterSchema's own zipCode field is optionalZipcode() — deliberately
// alphanumeric, country-agnostic (see its comment in lib/validation/common.js),
// since this page's Country selector can pick any country and non-Indian
// postal codes legitimately include letters (UK's "SW1A 1AA", for example).
// Layered on top here rather than changed at the source, which every other
// consumer of optionalZipcode() (Branch, Business Partner Address, ...) also
// relies on for the same reason: when Country is India specifically, enforce
// the strict numeric 6-digit PIN code format instead.
const locationMasterFormSchema = locationMasterSchema.refine(
  (d) => d.country !== 'India' || !d.zipCode || /^\d{6}$/.test(d.zipCode),
  { message: 'Zipcode must be exactly 6 digits for India', path: ['zipCode'] }
);
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';
// Fields of LocationMaster ([dbo].[location_master]) — the single location
// master. This page used to write to [dbo].[locations] while the Warehouse
// Master's Location dropdown read [dbo].[location_master], so a location added
// here never appeared where it was actually needed. See the retirement note on
// the Location model in schema.prisma.
//
// The code column is `code` here, not `locationCode`.
const emptyValues = {
  code: '', locationName: '', panNo: '', regType: '', eccNo: '', gstRegistrationNo: '',
  streetNo: '', buildingFloorRoom: '', block: '', country: 'India', state: '', city: '', zipCode: '',
  status: 'Active',
};

const PAGE_SIZE = 10;

const TABLE_ROW_HEIGHT = 0;         // floor, not a cap
const TABLE_CELL_PADDING_Y = 6;     // the actual top/bottom gap per cell, in px — this is what actually controls row height
export default function LocationMaster() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const { data: locations, isLoading } = locationMasterApi.useList();
  const [create, { isLoading: creating }] = locationMasterApi.useCreate();
  const [update, { isLoading: updating }] = locationMasterApi.useUpdate();
  const [remove] = locationMasterApi.useDelete();

  // The form lives in a modal — the page itself is the list, and "Add Location"
  // (or an edit action) opens the dialog over it. Same shape as the Branch
  // Details page / shared MasterCrudPage template.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const allRows = locations || [];

  // The next code is one past the highest whole-number code in use, so it keeps
  // counting on from the locations already in the master (… 11, 12 -> 13)
  // rather than restarting.
  //
  // Only codes that are ENTIRELY digits count towards the maximum. A code like
  // 'AAICK1298FXM004' would otherwise be read by parseInt as a number and could
  // hand out one that is already taken. Same rule as Account Group's
  // nextGroupCode, for the same reason.
  const nextLocationCode = useMemo(() => {
    const used = allRows
      .map((l) => String(l.code ?? '').trim())
      .filter((code) => /^\d+$/.test(code))
      .map(Number);
    return String((used.length ? Math.max(...used) : 0) + 1);
  }, [allRows]);

  const tableColumns = useMemo(() => ([
    { field: 'code', headerName: 'Location Code', filter: 'text' },
    { field: 'locationName', headerName: 'Location Name', filter: 'text' },
    { field: 'regType', headerName: 'Reg. Type', filter: 'select' },
    { field: 'panNo', headerName: 'PAN No.', filter: 'text' },
    { field: 'eccNo', headerName: 'ECC No.', filter: 'text' },
    { field: 'gstRegistrationNo', headerName: 'GST Registration No.', filter: 'text' },
    { field: 'status', headerName: 'Status', filter: 'select' },
  ]), []);
  const table = useTableFeatures(allRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  useEffect(() => { setPage(0); }, [rows.length]);

  const openCreate = () => {
    setEditingRow(null);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    setDialogOpen(true);
  };

  const closeForm = () => {
    setDialogOpen(false);
    setEditingRow(null);
  };

  // Closing a half-filled form asks before throwing the work away. requestClose
  // is what Cancel / the X / Esc go through; forceClose is the save path, which
  // has nothing to lose. See useUnsavedChangesGuard.jsx.
  const { requestClose, forceClose, setDirty, dialogCloseProps } = useUnsavedChangesGuard(closeForm);

  // Read-only look at a record — same form, every field disabled
  // and the save button removed (see AppForm's readOnly prop).
  const handleView = (row) => {
    setEditingRow(row);
    setReadOnly(true);
    setFormKey((k) => k + 1);
    setDialogOpen(true);
  };

  const handleEdit = (row) => {
    setEditingRow(row);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    setDialogOpen(true);
  };

  const handleDelete = async (row) => {
    const ok = await confirmDialog({
      title: 'Delete location',
      message: `Are you sure you want to delete "${row.locationName}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Location deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...values }).unwrap();
        notify.success('Location updated');
      } else {
        await create(values).unwrap();
        notify.success('Location added');
      }
      forceClose();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<PlaceOutlinedIcon />}
        title="Location Master"
        subtitle="Manage your registered locations. Add, update or remove locations."
        rightContent={
          <CanAdd>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Add Location
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
            {readOnly ? 'View Location' : editingRow ? 'Edit Location' : 'New Location'}
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
          schema={locationMasterFormSchema}
          defaultValues={editingRow
            ? { ...emptyValues, ...editingRow }
            : { ...emptyValues, code: nextLocationCode }}
          onSubmit={handleSubmit}
        >
          {({ watch }) => {
            const country = watch('country') || 'India';
            const state = watch('state');
            return (
              <>
                {/* Watches for the first real user edit so the close handlers
                    above know whether there is anything to lose. */}
                <FormDirtyTracker onDirtyChange={setDirty} />
                <DialogContent dividers>
                  <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                    {/* Auto-generated from the perpetual LOC numbering series (Document
                        Numbering is filtered to hide this master from that page — see
                        hiddenFromNumberingUI in documentNumberService.js). The field is
                        filled and locked on create, and left untouched on edit so an
                        existing record's code is never rewritten. */}
                    {/* A plain running number — 1, 2, 3 … n — not a prefixed
                        document number. This master's codes are bare integers
                        (see nextLocationCode above), so the LOC numbering series
                        would have offered LOC-000001, which matches nothing
                        already in the table.
                        Same treatment as Group Code on the Account Group page,
                        which is the other master numbered this way.
                        Locked on create so the sequence cannot be broken by
                        hand, and locked on edit too: a location's code is what
                        every warehouse points at, so rewriting one would orphan
                        them. */}
                    <LabeledField label="Location Code *">
                      <FormTextField
                        name="code"
                        label=""
                        disabled
                      />
                    </LabeledField>
                    <LabeledField label="Location Name *">
                      <FormTextField name="locationName" label="" placeholder="Enter location name" />
                    </LabeledField>
                    <LabeledField label="Registration Type">
                      <FormTextField name="regType" label="" placeholder="Enter registration type" />
                    </LabeledField>
                    <LabeledField label="PAN No.">
                      <FormTextField
                        name="panNo"
                        label=""
                        placeholder="Enter PAN number"
                        maxLength={10}
                        inputProps={{ style: { textTransform: 'uppercase' } }}
                      />
                    </LabeledField>

                    <LabeledField label="ECC No.">
                      <FormTextField
                        name="eccNo"
                        label=""
                        placeholder="Enter ECC number"
                        maxLength={20}
                        inputProps={{ style: { textTransform: 'uppercase' } }}
                      />
                    </LabeledField>
                    <LabeledField label="GST Registration No.">
                      <FormTextField
                        name="gstRegistrationNo"
                        label=""
                        placeholder="Enter GST registration number"
                        maxLength={15}
                        inputProps={{ style: { textTransform: 'uppercase' } }}
                      />
                    </LabeledField>

                    <LabeledField label="Street No">
                      <FormTextField name="streetNo" label="" placeholder="Enter street number" />
                    </LabeledField>
                    <LabeledField label="Building/Floor/Room">
                      <FormTextField name="buildingFloorRoom" label="" placeholder="Enter building, floor or room" />
                    </LabeledField>
                    <LabeledField label="Block">
                      <FormTextField name="block" label="" placeholder="Enter block" />
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

                    <LabeledField label="Zipcode">
                      {/* India's PIN code is strictly numeric (see
                          locationMasterFormSchema's refine above) — block
                          letters at the keystroke for that country instead of
                          only rejecting them on save. Other countries keep
                          accepting letters (e.g. UK "SW1A 1AA"), matching what
                          the shared zipcode validator already allows. */}
                      <FormTextField
                        name="zipCode"
                        label=""
                        placeholder={country === 'India' ? 'Enter 6-digit PIN code' : 'Enter zipcode'}
                        maxLength={country === 'India' ? 6 : 20}
                        digitsOnly={country === 'India'}
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
                </DialogContent>

                <DialogActions sx={{ px: 3, py: 2 }}>
                  <FormSubmitButton disabled={creating || updating}>
                    {readOnly ? 'View' : editingRow ? 'Update Location' : 'Save Location'}
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
            <Typography variant="subtitle1" fontWeight={700}>Location List</Typography>
            <TableSearchFilter table={table} placeholder="Search locations..." width={220} />
          </Stack>

          <TableFilterPanel table={table} />

          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {!isLoading && pagedRows.map((row) => (
                <MobileRecordCard
                  key={row.id}
                  title={row.locationName}
                  statusChip={<Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />}
                  fields={[
                    { label: 'Location Code', value: row.code },
                    { label: 'Reg. Type', value: row.regType || '—' },
                    { label: 'PAN No.', value: row.panNo || '—' },
                    { label: 'ECC No.', value: row.eccNo || '—' },
                    { label: 'GST Registration No.', value: row.gstRegistrationNo || '—' },
                  ]}
                  onView={() => handleView(row)}
                  onEdit={() => handleEdit(row)}
                  onDelete={() => handleDelete(row)}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                <EmptyState icon={<ApartmentOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No locations yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first location to get started'} />
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
                    <SortableHeaderCell field="code" sort={table.sort} onSort={table.toggleSort}>Location Code</SortableHeaderCell>
                    <SortableHeaderCell field="locationName" sort={table.sort} onSort={table.toggleSort}>Location Name</SortableHeaderCell>
                    <SortableHeaderCell field="regType" sort={table.sort} onSort={table.toggleSort}>Reg. Type</SortableHeaderCell>
                    <SortableHeaderCell field="panNo" sort={table.sort} onSort={table.toggleSort}>PAN No.</SortableHeaderCell>
                    <SortableHeaderCell field="eccNo" sort={table.sort} onSort={table.toggleSort}>ECC No.</SortableHeaderCell>
                    <SortableHeaderCell field="gstRegistrationNo" sort={table.sort} onSort={table.toggleSort}>GST Registration No.</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.code}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.locationName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.regType || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.panNo || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.eccNo || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.gstRegistrationNo || '—'}</TableCell>
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
                        <EmptyState icon={<ApartmentOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No locations yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first location to get started'} />
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
