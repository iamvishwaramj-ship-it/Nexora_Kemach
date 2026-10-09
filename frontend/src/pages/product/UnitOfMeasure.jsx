import React, { useMemo, useState } from 'react';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import {
  Box, Typography, Button, Card, CardContent, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import StraightenIcon from '@mui/icons-material/Straighten';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { z } from 'zod';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import { useUnsavedChangesGuard, FormDirtyTracker } from '../../components/form/useUnsavedChangesGuard';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
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
import { requiredString, optionalString, statusEnum, strictName } from '../../lib/validation/common';
import { uomApi } from '../../features/resources';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';
// Local schema — the shared uomSchema treats unitType as optional, but this
// page's design always shows a Unit Type per row, so require it here rather
// than changing every other consumer of uomSchema.
const uomDetailsSchema = z.object({
  uomCode: requiredString('UOM code'),
  uomName: strictName('Unit name'),
  unitType: requiredString('Unit type'),
  description: optionalString(),
  status: statusEnum(),
});

const emptyValues = { uomCode: '', uomName: '', unitType: '', description: '', status: 'Active' };

const UNIT_TYPE_OPTIONS = [
  { label: 'Count', value: 'Count' },
  { label: 'Weight', value: 'Weight' },
  { label: 'Volume', value: 'Volume' },
  { label: 'Length', value: 'Length' },
  { label: 'Area', value: 'Area' },
  { label: 'Time', value: 'Time' },
  { label: 'Other', value: 'Other' },
];

const PAGE_SIZE = 10;

const UOM_LIST_TABLE_ROW_HEIGHT = 0;
const UOM_LIST_TABLE_CELL_PADDING_Y = 6;
export default function UnitOfMeasure() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const { data: uoms, isLoading } = uomApi.useList();
  const [create, { isLoading: creating }] = uomApi.useCreate();
  const [update, { isLoading: updating }] = uomApi.useUpdate();
  const [remove] = uomApi.useDelete();

  // The form lives in a modal — the page itself is the list, and "Create
  // Unit of Measure" (or an edit action) opens the dialog over it. Same
  // shape as Product Group / Product Sub-Group / Warehouse Master.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const rows = uoms || [];

  const baseTableRows = useMemo(() => {
    const q = '';
    return rows.filter((r) => {
      const matchesSearch = !q || [r.uomCode, r.uomName, r.unitType, r.description]
        .some((v) => String(v || '').toLowerCase().includes(q));
      return matchesSearch;
    });
  }, [rows]);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'uomCode', headerName: 'UOM Code', filter: 'text' },
    { field: 'uomName', headerName: 'Unit Name', filter: 'text' },
    { field: 'unitType', headerName: 'Unit Type', filter: 'text' },
    { field: 'description', headerName: 'Description', filter: 'text' },
    { field: 'status', headerName: 'Status', filter: 'select' },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const filteredRows = table.rows;

  const pagedRows = useMemo(
    () => filteredRows.slice(page * pageSize, page * pageSize + pageSize),
    [filteredRows, page, pageSize]
  );

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
      title: 'Delete unit of measure',
      message: `Are you sure you want to delete "${row.uomName}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Unit of measure deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...values }).unwrap();
        notify.success('Unit of measure updated');
      } else {
        await create(values).unwrap();
        notify.success('Unit of measure added');
      }
      forceClose();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  return (
    <Box>


      {/* The form lives in a modal, same shape as Product Group / Product
          Sub-Group — see ProductGroup.jsx's own Dialog for the reference
          this was copied from. */}
      <Dialog
        open={dialogOpen}
        {...dialogCloseProps}
        maxWidth="md"
        fullWidth
        sx={{
          // AppForm wraps its children in a <form>, which lands between the
          // dialog's Paper and DialogContent and breaks the flex chain Paper
          // relies on to make DialogContent scroll. Without this the field
          // grid is clipped on a short viewport instead of scrolling, and
          // the action buttons go with it.
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
            {readOnly ? 'View Unit of Measure' : editingRow ? 'Edit Unit of Measure' : 'New Unit of Measure'}
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
          schema={uomDetailsSchema}
          defaultValues={editingRow ? { ...emptyValues, ...editingRow } : emptyValues}
          onSubmit={handleSubmit}
        >
          {() => (
            <>
              {/* Watches for the first real user edit so the close handlers
                  above know whether there is anything to lose. */}
              <FormDirtyTracker onDirtyChange={setDirty} />
              <DialogContent dividers>
                {/* Label-left field layout — same LabeledField concept as
                    Product Master's add/edit form (see
                    components/form/LabeledField.jsx), only 2 columns —
                    same as Product Group / Warehouse Master. */}
                <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                  {/* Manually entered — unlike Branch/Location/Tax Code,
                      nothing elsewhere in the app references a UOM by its
                      code (ProductGroup.uom, ProductMaster.uom, etc. all
                      store the UOM's NAME instead — see the doc comment on
                      Uom.uomCode's usage in schema.prisma), so there's no
                      auto-numbering series to keep in sync and no risk in
                      leaving it editable on Edit too. */}
                  <LabeledField label="UOM Code *">
                    <FormTextField name="uomCode" label="" placeholder="Enter UOM code" maxLength={50} />
                  </LabeledField>
                  <LabeledField label="Unit Name *">
                    <FormTextField name="uomName" label="" placeholder="Enter unit name" />
                  </LabeledField>
                  <LabeledField label="Unit Type *">
                    <FormSelect name="unitType" label="" placeholder="Select unit type" options={UNIT_TYPE_OPTIONS} />
                  </LabeledField>
                  <LabeledField label="Status *">
                    <FormSelect
                      name="status"
                      label=""
                      options={[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]}
                    />
                  </LabeledField>
                  <LabeledField label="Description">
                    <FormTextField name="description" label="" placeholder="Enter description (optional)" />
                  </LabeledField>
                </FormGrid>
              </DialogContent>

              <DialogActions sx={{ px: 3, py: 2 }}>
                <FormSubmitButton disabled={creating || updating}>
                  {readOnly ? 'View' : editingRow ? 'Update' : 'Save'}
                </FormSubmitButton>
                <Button variant={readOnly ? 'outlined' : 'text'} color={readOnly ? 'error' : 'inherit'} onClick={requestClose} disabled={creating || updating}>
                  {readOnly ? 'Close' : 'Cancel'}
                </Button>
              </DialogActions>
            </>
          )}
        </AppForm>
      </Dialog>

      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Unit of Measure List</Typography>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              <TableSearchFilter table={table} placeholder="Search units..." width={220} />
              <CanAdd>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                  Create Unit of Measure
                </Button>
              </CanAdd>
            </Stack>

            <TableFilterPanel table={table} />
          </Stack>

          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {!isLoading && pagedRows.map((row) => (
                <MobileRecordCard
                  key={row.id}
                  title={row.uomName}
                  statusChip={<Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />}
                  fields={[
                    { label: 'UOM Code', value: row.uomCode },
                    { label: 'Unit Type', value: row.unitType || '—' },
                    { label: 'Description', value: row.description || '—' },
                  ]}
                  onView={() => handleView(row)}
                  onEdit={() => handleEdit(row)}
                  onDelete={() => handleDelete(row)}
                />
              ))}
              {!isLoading && filteredRows.length === 0 && (
                <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No units found" message="Add your first unit to get started" />
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table
                size="small"
                stickyHeader
                sx={{
                  '& th, & td': {
                    height: UOM_LIST_TABLE_ROW_HEIGHT,
                    paddingTop: `${UOM_LIST_TABLE_CELL_PADDING_Y}px`,
                    paddingBottom: `${UOM_LIST_TABLE_CELL_PADDING_Y}px`,
                    boxSizing: 'border-box',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell width={48}>#</TableCell>
                    <SortableHeaderCell field="uomCode" sort={table.sort} onSort={table.toggleSort}>UOM Code</SortableHeaderCell>
                    <SortableHeaderCell field="uomName" sort={table.sort} onSort={table.toggleSort}>Unit Name</SortableHeaderCell>
                    <SortableHeaderCell field="unitType" sort={table.sort} onSort={table.toggleSort}>Unit Type</SortableHeaderCell>
                    <SortableHeaderCell field="description" sort={table.sort} onSort={table.toggleSort}>Description</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.uomCode}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.uomName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.unitType || '—'}</TableCell>
                      <TableCell sx={{ maxWidth: 320 }}>{row.description || '—'}</TableCell>
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
                  {!isLoading && filteredRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No units found" message="Add your first unit to get started" />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollableTableContainer>
          )}

          <EntityListPagination total={filteredRows.length} page={page} onChange={setPage} pageSize={pageSize} onPageSizeChange={(v) => { setPageSize(v); setPage(0); }} />
        </CardContent>
      </Card>
    </Box>
  );
}
