import React, { useMemo, useState } from 'react';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import {
  Box, Typography, Button, Card, CardContent, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Chip, IconButton, Menu, MenuItem, ListItemIcon, ListItemText,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import CurrencyExchangeOutlinedIcon from '@mui/icons-material/CurrencyExchangeOutlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import CheckIcon from '@mui/icons-material/Check';
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
import { currencySchema } from '../../lib/validation/productSchemas';
import { currencyApi } from '../../features/resources';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';

// Product Setup > Currency Master — the single place every currency value in
// the app is defined. See the CurrencyMaster model doc comment in
// schema.prisma and lib/currencyOptions.js for how the rest of the app reads
// this list instead of a hardcoded array.
const emptyValues = { currencyCode: '', currencyName: '', symbol: '', isActive: true };

const PAGE_SIZE = 10;
const STATUS_FILTERS = ['All', 'Active', 'Inactive'];

const CURRENCY_LIST_TABLE_ROW_HEIGHT = 0;
const CURRENCY_LIST_TABLE_CELL_PADDING_Y = 6;
export default function CurrencyMaster() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const { data: currencies, isLoading } = currencyApi.useList();
  const [create, { isLoading: creating }] = currencyApi.useCreate();
  const [update, { isLoading: updating }] = currencyApi.useUpdate();
  const [remove] = currencyApi.useDelete();

  // The form lives in a modal — same shape as Brand / Product Group.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState('All');
  const [filterAnchor, setFilterAnchor] = useState(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const rows = currencies || [];

  const baseTableRows = useMemo(() => rows.filter((r) => {
    const status = r.isActive === false ? 'Inactive' : 'Active';
    return statusFilter === 'All' || status === statusFilter;
  }), [rows, statusFilter]);

  // Column definitions drive the global search, the sort icons and the
  // filter popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'currencyCode', headerName: 'Currency Code', filter: 'text' },
    { field: 'currencyName', headerName: 'Currency Name', filter: 'text' },
    { field: 'symbol', headerName: 'Symbol', filter: 'text' },
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
      title: 'Delete currency',
      message: `Are you sure you want to delete "${row.currencyName}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Currency deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...values }).unwrap();
        notify.success('Currency updated');
      } else {
        await create(values).unwrap();
        notify.success('Currency added');
      }
      forceClose();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<CurrencyExchangeOutlinedIcon />}
        title="Currency Master"
        subtitle="Create and manage the currencies offered everywhere in the app."
        rightContent={<CompanyBadge />}
      />

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
            {readOnly ? 'View Currency' : editingRow ? 'Edit Currency' : 'Add Currency'}
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
          schema={currencySchema}
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
                    Brand / Product Group, only a single column: the
                    reference "Add Currency" design stacks Name, Symbol and
                    Status one under the other rather than side by side. */}
                <FormGrid columns={1} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                  {/* Not in the reference design, but every currency field
                      elsewhere in the app already stores this 3-letter code
                      on saved documents — see the model doc comment in
                      schema.prisma. Left editable (not auto-numbered like
                      Brand/UOM) since currency codes are standard
                      abbreviations (INR, USD, ...), not a sequence. */}
                  <LabeledField label="Currency Code *">
                    <FormTextField name="currencyCode" label="" placeholder="e.g. INR" />
                  </LabeledField>
                  <LabeledField label="Currency Name *">
                    <FormTextField name="currencyName" label="" placeholder="Enter currency name" />
                  </LabeledField>
                  <LabeledField label="Symbol">
                    <FormTextField name="symbol" label="" placeholder="Enter symbol (optional)" />
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
            <Typography variant="subtitle1" fontWeight={700}>Currency List</Typography>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              <TableSearchFilter table={table} placeholder="Search currencies..." width={220} />
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<FilterListIcon />}
                onClick={(e) => setFilterAnchor(e.currentTarget)}
              >
                Filter{statusFilter !== 'All' ? `: ${statusFilter}` : ''}
              </Button>
              <Menu anchorEl={filterAnchor} open={!!filterAnchor} onClose={() => setFilterAnchor(null)}>
                {STATUS_FILTERS.map((s) => (
                  <MenuItem key={s} selected={statusFilter === s} onClick={() => { setStatusFilter(s); setPage(0); setFilterAnchor(null); }}>
                    {statusFilter === s && <ListItemIcon><CheckIcon fontSize="small" /></ListItemIcon>}
                    <ListItemText inset={statusFilter !== s}>{s}</ListItemText>
                  </MenuItem>
                ))}
              </Menu>
              <CanAdd>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                  Add Currency
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
                  title={row.currencyName}
                  statusChip={<Chip size="small" label={row.isActive === false ? 'Inactive' : 'Active'} color={row.isActive === false ? 'default' : 'success'} variant="outlined" />}
                  fields={[
                    { label: 'Currency Code', value: row.currencyCode },
                    { label: 'Symbol', value: row.symbol || '—' },
                  ]}
                  onView={() => handleView(row)}
                  onEdit={() => handleEdit(row)}
                  onDelete={() => handleDelete(row)}
                />
              ))}
              {!isLoading && filteredRows.length === 0 && (
                <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No currencies found" message="Add your first currency to get started" />
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table
                size="small"
                stickyHeader
                sx={{
                  '& th, & td': {
                    height: CURRENCY_LIST_TABLE_ROW_HEIGHT,
                    paddingTop: `${CURRENCY_LIST_TABLE_CELL_PADDING_Y}px`,
                    paddingBottom: `${CURRENCY_LIST_TABLE_CELL_PADDING_Y}px`,
                    boxSizing: 'border-box',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell width={48}>#</TableCell>
                    <SortableHeaderCell field="currencyCode" sort={table.sort} onSort={table.toggleSort}>Currency Code</SortableHeaderCell>
                    <SortableHeaderCell field="currencyName" sort={table.sort} onSort={table.toggleSort}>Currency Name</SortableHeaderCell>
                    <SortableHeaderCell field="symbol" sort={table.sort} onSort={table.toggleSort}>Symbol</SortableHeaderCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.currencyCode}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.currencyName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.symbol || '—'}</TableCell>
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
                      <TableCell colSpan={6}>
                        <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No currencies found" message="Add your first currency to get started" />
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
