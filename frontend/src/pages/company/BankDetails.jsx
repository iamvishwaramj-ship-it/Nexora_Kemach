import React, { useEffect, useMemo, useState } from 'react';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import {
  Box, Typography, Button, Card, CardContent, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { z } from 'zod';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import { useUnsavedChangesGuard, FormDirtyTracker } from '../../components/form/useUnsavedChangesGuard';
import FormTextField from '../../components/form/FormTextField';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import useDragScroll from '../../components/data-display/useDragScroll';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { requiredString } from '../../lib/validation/common';
import { bankNameApi } from '../../features/resources';
import DocumentNoField from '../../components/form/DocumentNoField';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';
// Local schema — the shared bankNameSchema also requires `status`, but this
// page's design is bank name only (status still defaults to 'Active'
// behind the scenes, it's just not surfaced as a field here). bankCode is
// system-generated from the BNK numbering series (see DocumentNoField
// below) — required the same way every other auto-numbered master's code
// is (Branch's branchCode, Sales Employee's employeeCode, ...).
const bankDetailsSchema = z.object({
  bankCode: requiredString('Bank code'),
  bankName: requiredString('Bank name'),
});

const emptyValues = { bankCode: '', bankName: '', status: 'Active' };

// This dialog is maxWidth="sm" (narrower than e.g. Tax Code's "md") and its
// two labels are short — the shared FIELD_LABEL_WIDTH (190px, sized for the
// app's longest labels) left almost no room for the input box itself in a
// 2-column row here, which is what squeezed "BNK-00001" and the Bank Name
// placeholder down to a few visible characters. Narrowed via LabeledField's
// own labelWidth prop, same approach as Tax Code's TAX_CODE_LABEL_WIDTH.
const BANK_LABEL_WIDTH = 90;

const PAGE_SIZE = 10;

const TABLE_ROW_HEIGHT = 0;         // floor, not a cap
const TABLE_CELL_PADDING_Y = 6;     // the actual top/bottom gap per cell, in px — this is what actually controls row height
export default function BankDetails() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const { data: banks, isLoading, isFetching, refetch } = bankNameApi.useList();
  const [create, { isLoading: creating }] = bankNameApi.useCreate();
  const [update, { isLoading: updating }] = bankNameApi.useUpdate();
  const [remove] = bankNameApi.useDelete();

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

  const allRows = banks || [];
  const baseTableRows = useMemo(() => {
    const q = '';
    if (!q) return allRows;
    return allRows.filter((r) => String(r.bankName || '').toLowerCase().includes(q));
  }, [allRows]);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'bankCode', headerName: 'Bank Code', filter: 'text' },
    { field: 'bankName', headerName: 'Bank Name', filter: 'text' },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  useEffect(() => { setPage(0); }, [search]);

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
      title: 'Delete bank',
      message: `Are you sure you want to delete "${row.bankName}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Bank deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...emptyValues, ...values }).unwrap();
        notify.success('Bank updated');
      } else {
        await create({ ...emptyValues, ...values }).unwrap();
        notify.success('Bank added');
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
        title="Bank Details"
        subtitle="Manage your bank names."
        rightContent={
          <CanAdd>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Add Bank
            </Button>
          </CanAdd>
        }
      />

      <Dialog
        open={dialogOpen}
        {...dialogCloseProps}
        maxWidth="sm"
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
            {readOnly ? 'View Bank' : editingRow ? 'Edit Bank' : 'New Bank'}
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
          schema={bankDetailsSchema}
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
                  <LabeledField label="Bank Code *" labelWidth={BANK_LABEL_WIDTH}>
                    <DocumentNoField documentCode="BNK" name="bankCode" label="" isCreate={!editingRow} />
                  </LabeledField>
                  <LabeledField label="Bank Name *" labelWidth={BANK_LABEL_WIDTH}>
                    <FormTextField name="bankName" label="" placeholder="Enter bank name" />
                  </LabeledField>
                </FormGrid>
              </DialogContent>

              <DialogActions sx={{ px: 3, py: 2 }}>
                <FormSubmitButton disabled={creating || updating}>
                  {readOnly ? 'View' : editingRow ? 'Update Bank' : 'Add Bank'}
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
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Bank List</Typography>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TableSearchFilter table={table} placeholder="Search banks..." width={220} />
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
                  fields={[{ label: 'Bank Code', value: row.bankCode }]}
                  onView={() => handleView(row)}
                  onEdit={() => handleEdit(row)}
                  onDelete={() => handleDelete(row)}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                <EmptyState icon={<ApartmentOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No banks yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first bank to get started'} />
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
                    <SortableHeaderCell field="bankCode" sort={table.sort} onSort={table.toggleSort}>Bank Code</SortableHeaderCell>
                    <SortableHeaderCell field="bankName" sort={table.sort} onSort={table.toggleSort}>Bank Name</SortableHeaderCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.bankCode || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.bankName}</TableCell>
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
                      <TableCell colSpan={4}>
                        <EmptyState icon={<ApartmentOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No banks yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first bank to get started'} />
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
