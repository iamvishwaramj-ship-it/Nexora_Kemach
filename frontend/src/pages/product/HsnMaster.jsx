import React, { useMemo, useState } from 'react';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import {
  Box, Typography, Button, Card, CardContent, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import AddIcon from '@mui/icons-material/Add';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import { useUnsavedChangesGuard, FormDirtyTracker } from '../../components/form/useUnsavedChangesGuard';
import FormTextField from '../../components/form/FormTextField';
import { FormCheckbox } from '../../components/form/FormCheckbox';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { hsnMasterSchema } from '../../lib/validation/productSchemas';
import { hsnMasterApi } from '../../features/resources';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import BulkImportDialog from '../../components/common/BulkImportDialog';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';

// Product Setup > HSN Master — the single place every HSN/SAC code is
// defined. Product Master's GST-enabled HSN field (Item Category tab) reads
// its dropdown options from this list instead of accepting free-text entry
// — see the model doc comment in schema.prisma. GST Rate is no longer shown
// or captured here (removed per request); the DB column still exists and
// defaults to 0 so nothing else breaks.
const emptyValues = { hsnCode: '', description: '', isActive: true };

const PAGE_SIZE = 10;

const HSN_LIST_TABLE_ROW_HEIGHT = 0;
const HSN_LIST_TABLE_CELL_PADDING_Y = 6;
export default function HsnMaster() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const { data: hsnCodes, isLoading, refetch } = hsnMasterApi.useList();
  const [create, { isLoading: creating }] = hsnMasterApi.useCreate();
  const [update, { isLoading: updating }] = hsnMasterApi.useUpdate();
  const [remove] = hsnMasterApi.useDelete();

  // Bulk import lives in the shared BulkImportDialog (same component Sales
  // Quotation's list page uses) — Download Template and Upload both sit
  // inside it, see BulkImportDialog.jsx.
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  // The form lives in a modal — same shape as Brand / Product Group.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const rows = hsnCodes || [];

  // Column definitions drive the global search, the sort icons and the
  // filter panel — see components/data-display/useTableFeatures.js. Status
  // used to be a second, separate Filter button/menu of its own; it's now
  // just another column filter here, so there's a single Filter button for
  // the whole list (see TableSearchFilter below).
  const tableColumns = useMemo(() => ([
    { field: 'hsnCode', headerName: 'HSN Code', filter: 'text' },
    { field: 'description', headerName: 'Description', filter: 'text' },
    {
      field: 'status',
      headerName: 'Status',
      filter: 'select',
      filterOptions: ['Active', 'Inactive'],
      value: (row) => (row.isActive === false ? 'Inactive' : 'Active'),
    },
  ]), []);
  const table = useTableFeatures(rows, tableColumns, { onChange: setPage });
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

  // Read-only look at a record — same form, every field disabled and the
  // save button removed (see AppForm's readOnly prop).
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
      title: 'Delete HSN code',
      message: `Are you sure you want to delete "${row.hsnCode}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('HSN code deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...values }).unwrap();
        notify.success('HSN code updated');
      } else {
        await create(values).unwrap();
        notify.success('HSN code added');
      }
      forceClose();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  return (
    <Box>
      {/* The form lives in a modal, same shape as Brand — see Brand.jsx for
          the reference this was copied from. */}
      <Dialog
        open={dialogOpen}
        {...dialogCloseProps}
        maxWidth="sm"
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
            {readOnly ? 'View HSN Code' : editingRow ? 'Edit HSN Code' : 'Add HSN Code'}
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
          schema={hsnMasterSchema}
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
                    Brand / Product Group / Currency Master, only a single
                    column: stacks HSN Code, Description, GST Rate and
                    Status one under the other rather than side by side. */}
                <FormGrid columns={1} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                  {/* Left editable (not auto-numbered like Brand/UOM) since
                      HSN/SAC codes are a fixed external GST classification,
                      not a sequence — same reasoning as Currency Code on
                      Currency Master. */}
                  <LabeledField label="HSN Code *">
                    <FormTextField name="hsnCode" label="" placeholder="Enter HSN / SAC code" digitsOnly maxLength={8} />
                  </LabeledField>
                  <LabeledField label="Description">
                    <FormTextField name="description" label="" placeholder="Enter description" />
                  </LabeledField>
                  <LabeledField label="Status">
                    <FormCheckbox name="isActive" label="Active" />
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
            <Typography variant="subtitle1" fontWeight={700}>HSN List</Typography>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              <TableSearchFilter table={table} placeholder="Search HSN codes..." width={220} />
              <CanAdd>
                {/* React.Children.only needs one child — group both buttons in a Stack. */}
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
                    Add HSN Code
                  </Button>
                </Stack>
              </CanAdd>
            </Stack>

            <TableFilterPanel table={table} />
          </Stack>

          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {!isLoading && pagedRows.map((row) => (
                <MobileRecordCard
                  key={row.id}
                  title={row.hsnCode}
                  statusChip={<Chip size="small" label={row.isActive === false ? 'Inactive' : 'Active'} color={row.isActive === false ? 'default' : 'success'} variant="outlined" />}
                  fields={[
                    { label: 'Description', value: row.description || '—' },
                  ]}
                  onView={() => handleView(row)}
                  onEdit={() => handleEdit(row)}
                  onDelete={() => handleDelete(row)}
                />
              ))}
              {!isLoading && filteredRows.length === 0 && (
                <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No HSN codes found" message="Add your first HSN code to get started" />
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table
                size="small"
                stickyHeader
                sx={{
                  '& th, & td': {
                    height: HSN_LIST_TABLE_ROW_HEIGHT,
                    paddingTop: `${HSN_LIST_TABLE_CELL_PADDING_Y}px`,
                    paddingBottom: `${HSN_LIST_TABLE_CELL_PADDING_Y}px`,
                    boxSizing: 'border-box',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell width={48}>#</TableCell>
                    <SortableHeaderCell field="hsnCode" sort={table.sort} onSort={table.toggleSort}>HSN Code</SortableHeaderCell>
                    <SortableHeaderCell field="description" sort={table.sort} onSort={table.toggleSort}>Description</SortableHeaderCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.hsnCode}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.description || '—'}</TableCell>
                      <TableCell>
                        <Chip size="small" label={row.isActive === false ? 'Inactive' : 'Active'} color={row.isActive === false ? 'default' : 'success'} variant="outlined" />
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
                      <TableCell colSpan={5}>
                        <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No HSN codes found" message="Add your first HSN code to get started" />
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

      {/* HSN Master is one row per code, not the multi-line document sheet
          the dialog's default copy describes — hence its own description
          and a "Row" heading on the results table, same as Employee Master's
          own BulkImportDialog usage. */}
      <BulkImportDialog
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        resourceName="HSN Codes"
        templateUrl="/hsn-master/import-template"
        importUrl="/hsn-master/import-xlsx"
        rowLabel="Row"
        description="Download the template, fill in one row per HSN/SAC code, then upload it back here. HSN Code is required (4, 6 or 8 digits); Description and Status are optional."
        onImported={refetch}
      />
    </Box>
  );
}
