import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Stack,
  Table, TableBody, TableCell, TableHead, TableRow, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import { useUnsavedChangesGuard, FormDirtyTracker } from '../../components/form/useUnsavedChangesGuard';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
import dayjs from 'dayjs';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableToolbar from '../../components/data-display/TableToolbar';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { financialYearSchema } from '../../lib/validation/companySchemas';
import { financialYearApi } from '../../features/resources';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import TableSkeleton from '../../components/feedback/TableSkeleton';
import LoadingState from '../../components/feedback/LoadingState';
import EmptyState from '../../components/data-display/EmptyState';
const emptyValues = { financialYearName: '', startDate: null, endDate: null, status: 'Active' };

// This form's labels are all short — the shared FIELD_LABEL_WIDTH is sized
// for the app's longest labels elsewhere, which on this page just left a
// wide gap of blank space between each label and its input. Narrowed here
// via LabeledField's own labelWidth prop rather than lowering the shared
// constant, so other pages with longer labels are unaffected. Same
// treatment as Tax Code's TAX_CODE_LABEL_WIDTH.
const FINANCIAL_YEAR_LABEL_WIDTH = 165;

const PAGE_SIZE = 10;

// Table border + tunable row height — see components/data-display and
// pages/product/ProductInventoryTab.jsx for the same pattern:
//   - TABLE_ROW_HEIGHT       a floor, not a cap — TABLE_CELL_PADDING_Y is
//                             what actually controls row height.
//   - TABLE_CELL_PADDING_Y   the actual top/bottom gap per cell, in px.
const TABLE_ROW_HEIGHT = 0;
const TABLE_CELL_PADDING_Y = 6;
const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function FinancialYear() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const { data: years, isLoading } = financialYearApi.useList();
  const [create, { isLoading: creating }] = financialYearApi.useCreate();
  const [update, { isLoading: updating }] = financialYearApi.useUpdate();
  const [remove] = financialYearApi.useDelete();

  // The form lives in a modal — the page itself is the list, and the Add
  // button (or an edit action) opens the dialog over it. Same shape as the
  // Branch Details page / shared MasterCrudPage template.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const columns = useMemo(() => [
    { field: 'financialYearName', headerName: 'Financial Year Name', filter: 'text' },
    { field: 'startDate', headerName: 'Start Date', filter: 'dateRange', sortValue: (r) => (r.startDate ? new Date(r.startDate).getTime() : null), searchValue: (r) => formatDate(r.startDate) },
    { field: 'endDate', headerName: 'End Date', filter: 'dateRange', sortValue: (r) => (r.endDate ? new Date(r.endDate).getTime() : null), searchValue: (r) => formatDate(r.endDate) },
    { field: 'status', headerName: 'Status', filter: 'select', filterOptions: ['Active', 'Inactive'] },
  ], []);

  const table = useTableFeatures(years, columns, { onChange: setPage });
  const { rows, sort, toggleSort, isFiltering } = table;

  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

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
      title: 'Delete financial year',
      message: `Are you sure you want to delete "${row.financialYearName}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Financial year deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...values }).unwrap();
        notify.success('Financial year updated');
      } else {
        await create(values).unwrap();
        notify.success('Financial year added');
      }
      forceClose();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<CalendarMonthIcon />}
        title="Financial Year"
        subtitle="Create and manage financial years for your business."
        rightContent={
          <CanAdd>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Add Financial Year
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
            {readOnly ? 'View Financial Year' : editingRow ? 'Edit Financial Year' : 'New Financial Year'}
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
          schema={financialYearSchema}
          defaultValues={editingRow ? { ...emptyValues, ...editingRow } : emptyValues}
          onSubmit={handleSubmit}
        >
          {({ watch }) => {
            const startDateValue = watch('startDate');
            // Calendar-level guard to match the schema's cross-field refine
            // (see financialYearSchema in lib/validation/companySchemas.js):
            // once a start date is picked, the end date picker can't even
            // open on an earlier day, instead of only flagging it red after
            // the fact.
            const endDateMin = startDateValue ? dayjs(startDateValue) : undefined;
            return (
            <>
              {/* Watches for the first real user edit so the close handlers
                  above know whether there is anything to lose. */}
              <FormDirtyTracker onDirtyChange={setDirty} />
              <DialogContent dividers>
                <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                  <LabeledField label="Financial Year Name *" labelWidth={FINANCIAL_YEAR_LABEL_WIDTH}>
                    <FormTextField name="financialYearName" label="" placeholder="Enter financial year (e.g. 2026-2027)" />
                  </LabeledField>
                  <LabeledField label="Start Date *" labelWidth={FINANCIAL_YEAR_LABEL_WIDTH}>
                    <FormDatePicker name="startDate" label="" triggerFields={['endDate']} />
                  </LabeledField>
                  <LabeledField label="End Date *" labelWidth={FINANCIAL_YEAR_LABEL_WIDTH}>
                    <FormDatePicker name="endDate" label="" triggerFields={['startDate']} minDate={endDateMin} />
                  </LabeledField>
                  <LabeledField label="Status *" labelWidth={FINANCIAL_YEAR_LABEL_WIDTH}>
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
                  {readOnly ? 'View' : editingRow ? 'Update Financial Year' : 'Save Financial Year'}
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
          <TableToolbar
            title="Financial Year List"
            searchPlaceholder="Search financial years..."
            table={table}
            resultCount={rows.length}
            totalCount={table.totalCount}
          />
          <TableFilterPanel table={table} />

          {isMobile ? (
            <Box sx={{ px: 2, pb: 1, height: 'clamp(240px, calc(100vh - 340px), 560px)', overflowY: 'auto', overscrollBehavior: 'contain' }}>
              {isLoading && <LoadingState label="Loading financial years…" />}
              {!isLoading && pagedRows.map((row) => (
                <MobileRecordCard
                  key={row.id}
                  title={row.financialYearName}
                  statusChip={<Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'error'} variant="outlined" />}
                  fields={[
                    { label: 'Start Date', value: formatDate(row.startDate) },
                    { label: 'End Date', value: formatDate(row.endDate) },
                  ]}
                  onView={() => handleView(row)}
                  onEdit={() => handleEdit(row)}
                  onDelete={() => handleDelete(row)}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                <EmptyState
                  icon={<CalendarMonthIcon sx={{ fontSize: 48 }} />}
                  title={isFiltering ? 'No matches' : 'No financial years yet'}
                  message={isFiltering ? 'Try adjusting your search or filters' : 'Add your first financial year to get started'}
                  action={!isFiltering && (
                    <CanAdd>
                      <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add Financial Year</Button>
                    </CanAdd>
                  )}
                />
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
                    <SortableHeaderCell field="financialYearName" sort={sort} onSort={toggleSort}>Financial Year Name</SortableHeaderCell>
                    <SortableHeaderCell field="startDate" sort={sort} onSort={toggleSort}>Start Date</SortableHeaderCell>
                    <SortableHeaderCell field="endDate" sort={sort} onSort={toggleSort}>End Date</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={sort} onSort={toggleSort}>Status</SortableHeaderCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading && <TableSkeleton columns={6} rows={pageSize > 8 ? 8 : pageSize} />}
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.financialYearName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.startDate)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.endDate)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'error'} variant="outlined" />
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
                      <TableCell colSpan={6} sx={{ border: 'none' }}>
                        <EmptyState
                          icon={<CalendarMonthIcon sx={{ fontSize: 48 }} />}
                          title={isFiltering ? 'No matches' : 'No financial years yet'}
                          message={isFiltering ? 'Try adjusting your search or filters' : 'Add your first financial year to get started'}
                          action={!isFiltering && (
                            <CanAdd>
                              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add Financial Year</Button>
                            </CanAdd>
                          )}
                        />
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
