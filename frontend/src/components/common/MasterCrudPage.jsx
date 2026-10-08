import React, { useState } from 'react';
import { Box, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import DataTable from '../data-display/DataTable';
import AppForm, { FormGrid } from '../form/AppForm';
import { useUnsavedChangesGuard, FormDirtyTracker } from '../form/useUnsavedChangesGuard';
import { useNotify } from '../feedback/NotificationProvider';
import { useConfirm } from '../feedback/ConfirmationDialog';

/**
 * MasterCrudPage — the standard shape for a master/transaction-header page:
 * DataTable (list) + a Create/Edit dialog built from AppForm/FormGrid + the
 * shared ConfirmationDialog for deletes. Composes the shared component
 * library rather than forking a bespoke page each time (component-library.md).
 *
 * Props:
 *   title, columns (DataTable columns), schema (zod), defaultValues,
 *   renderFields(methods) -> form fields (usually FormTextField/FormSelect/... inside FormGrid),
 *   api: { useList, useCreate, useUpdate, useDelete },
 *   formColumns: 3 | 4 (FormGrid column count)
 */
export default function MasterCrudPage({
  title,
  columns,
  schema,
  defaultValues = {},
  renderFields,
  api,
  formColumns = 4,
  dialogMaxWidth = 'md',
  extraHeaderActions,
}) {
  const { t } = useTranslation();
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const { data: rows, isLoading } = api.useList();
  const [create, { isLoading: creating }] = api.useCreate();
  const [update, { isLoading: updating }] = api.useUpdate();
  const [remove] = api.useDelete();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);

  const openCreate = () => { setEditingRow(null); setDialogOpen(true); };
  const openEdit = (row) => { setEditingRow(row); setDialogOpen(true); };
  const closeDialog = () => setDialogOpen(false);

  // Closing a half-filled form asks before throwing the work away. requestClose
  // is what Cancel / Esc go through; forceClose is the save path, which has
  // nothing to lose. See form/useUnsavedChangesGuard.jsx.
  const { requestClose, forceClose, setDirty, dialogCloseProps } = useUnsavedChangesGuard(closeDialog);

  const handleSubmit = async (values) => {
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...values }).unwrap();
        notify.success('Updated successfully');
      } else {
        await create(values).unwrap();
        notify.success('Created successfully');
      }
      forceClose();
    } catch (err) {
      notify.error(err?.data?.message || 'Something went wrong');
    }
  };

  const handleDelete = async (row) => {
    const ok = await confirmDialog({
      title: 'Delete record',
      message: `Are you sure you want to delete this record? This cannot be undone.`,
      confirmLabel: t('common.delete'),
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Deleted successfully');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>{title}</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {extraHeaderActions}
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            {t('common.create')}
          </Button>
        </Box>
      </Box>

      <DataTable
        columns={columns}
        rows={rows || []}
        loading={isLoading}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      <Dialog open={dialogOpen} {...dialogCloseProps} maxWidth={dialogMaxWidth} fullWidth>
        <DialogTitle>{editingRow ? t('common.edit') : t('common.create')} — {title}</DialogTitle>
        <AppForm
          id="master-crud-form"
          schema={schema}
          defaultValues={editingRow ? { ...defaultValues, ...editingRow } : defaultValues}
          onSubmit={handleSubmit}
        >
          {(methods) => (
            <>
              {/* Watches for the first real user edit so the close handlers
                  above know whether there is anything to lose. */}
              <FormDirtyTracker onDirtyChange={setDirty} />
              <DialogContent dividers>
                <FormGrid columns={formColumns}>{renderFields(methods)}</FormGrid>
              </DialogContent>
              <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={requestClose} color="inherit">{t('common.cancel')}</Button>
                <Button type="submit" form="master-crud-form" variant="contained" disabled={creating || updating}>
                  {t('common.save')}
                </Button>
              </DialogActions>
            </>
          )}
        </AppForm>
      </Dialog>
    </Box>
  );
}
