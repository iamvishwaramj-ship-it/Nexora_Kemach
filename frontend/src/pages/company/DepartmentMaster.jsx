import React, { useEffect, useMemo, useState } from 'react';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import {
  Box, Typography, Button, Card, CardContent, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
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
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { departmentMasterSchema } from '../../lib/validation/partnerSchemas';
import { departmentMasterApi } from '../../features/resources';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';

// Department Master ([dbo].[department_master]) — a simple 3-field lookup
// (code, name, status) that Employee Master's Department dropdown binds to
// by id. Modeled directly on Location Master, stripped down.
const emptyValues = {
  code: '', name: '', status: 'Active',
};

const PAGE_SIZE = 10;

const TABLE_ROW_HEIGHT = 0;         // floor, not a cap
const TABLE_CELL_PADDING_Y = 6;     // the actual top/bottom gap per cell, in px — this is what actually controls row height
export default function DepartmentMaster() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const { data: departments, isLoading } = departmentMasterApi.useList();
  const [create, { isLoading: creating }] = departmentMasterApi.useCreate();
  const [update, { isLoading: updating }] = departmentMasterApi.useUpdate();
  const [remove] = departmentMasterApi.useDelete();

  // The form lives in a modal — the page itself is the list, and "Add
  // Department" (or an edit action) opens the dialog over it. Same shape as
  // the Location Master page / shared MasterCrudPage template.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const allRows = departments || [];

  // The next code is one past the highest whole-number code in use, so it
  // keeps counting on from the departments already in the master, exactly
  // like Location Master's nextLocationCode.
  //
  // Only codes that are ENTIRELY digits count towards the maximum — see the
  // comment on nextLocationCode in LocationMaster.jsx for why.
  const nextDepartmentCode = useMemo(() => {
    const used = allRows
      .map((d) => String(d.code ?? '').trim())
      .filter((code) => /^\d+$/.test(code))
      .map(Number);
    return String((used.length ? Math.max(...used) : 0) + 1);
  }, [allRows]);

  const tableColumns = useMemo(() => ([
    { field: 'code', headerName: 'Department Code', filter: 'text' },
    { field: 'name', headerName: 'Department Name', filter: 'text' },
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
      title: 'Delete department',
      message: `Are you sure you want to delete "${row.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Department deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...values }).unwrap();
        notify.success('Department updated');
      } else {
        await create(values).unwrap();
        notify.success('Department added');
      }
      forceClose();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<ApartmentOutlinedIcon />}
        title="Department Master"
        subtitle="Manage your departments. Add, update or remove departments."
        rightContent={
          <CanAdd>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Add Department
            </Button>
          </CanAdd>
        }
      />

      <Dialog
        open={dialogOpen}
        {...dialogCloseProps}
        maxWidth="md"
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
            {readOnly ? 'View Department' : editingRow ? 'Edit Department' : 'New Department'}
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
          schema={departmentMasterSchema}
          defaultValues={editingRow
            ? { ...emptyValues, ...editingRow }
            : { ...emptyValues, code: nextDepartmentCode }}
          onSubmit={handleSubmit}
        >
          {() => (
            <>
              {/* Watches for the first real user edit so the close handlers
                  above know whether there is anything to lose. */}
              <FormDirtyTracker onDirtyChange={setDirty} />
              <DialogContent dividers>
                <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                  {/* A plain running number — 1, 2, 3 … n — not a prefixed
                      document number, same treatment as Location Master's
                      code and Account Group's Group Code. Locked on create so
                      the sequence cannot be broken by hand, and locked on
                      edit too: a department's code is what Employee Master
                      points at, so rewriting one would orphan every employee
                      assigned to it. */}
                  <LabeledField label="Department Code *">
                    <FormTextField
                      name="code"
                      label=""
                      disabled
                    />
                  </LabeledField>
                  <LabeledField label="Department Name *">
                    <FormTextField name="name" label="" placeholder="Enter department name" />
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
                  {readOnly ? 'View' : editingRow ? 'Update Department' : 'Save Department'}
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
            <Typography variant="subtitle1" fontWeight={700}>Department List</Typography>
            <TableSearchFilter table={table} placeholder="Search departments..." width={220} />
          </Stack>

          <TableFilterPanel table={table} />

          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {!isLoading && pagedRows.map((row) => (
                <MobileRecordCard
                  key={row.id}
                  title={row.name}
                  statusChip={<Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />}
                  fields={[
                    { label: 'Department Code', value: row.code },
                  ]}
                  onView={() => handleView(row)}
                  onEdit={() => handleEdit(row)}
                  onDelete={() => handleDelete(row)}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                <EmptyState icon={<ApartmentOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No departments yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first department to get started'} />
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
                    <SortableHeaderCell field="code" sort={table.sort} onSort={table.toggleSort}>Department Code</SortableHeaderCell>
                    <SortableHeaderCell field="name" sort={table.sort} onSort={table.toggleSort}>Department Name</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.code}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.name}</TableCell>
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
                      <TableCell colSpan={5}>
                        <EmptyState icon={<ApartmentOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No departments yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first department to get started'} />
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
