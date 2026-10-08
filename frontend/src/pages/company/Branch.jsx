import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import ApartmentIcon from '@mui/icons-material/Apartment';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { z } from 'zod';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import { useUnsavedChangesGuard, FormDirtyTracker } from '../../components/form/useUnsavedChangesGuard';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import { FormCheckbox } from '../../components/form/FormCheckbox';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import useDragScroll from '../../components/data-display/useDragScroll';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { requiredString, optionalMobileNumber, optionalEmail, optionalString, requiredPincode, statusEnum } from '../../lib/validation/common';
import { branchApi, customerApi, supplierApi } from '../../features/resources';
import { countries, getStateOptions } from '../../lib/constants/locations';
import { getCityOptions } from '../../lib/constants/locationsCities';
import { useWarehouseOptions } from '../../lib/useWarehouseOptions';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import DocumentNoField from '../../components/form/DocumentNoField';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import TableSkeleton from '../../components/feedback/TableSkeleton';
import LoadingState from '../../components/feedback/LoadingState';
import EmptyState from '../../components/data-display/EmptyState';
// Local schema — the shared branchSchema treats address fields as optional,
// but this page's design marks them required, so extend it here rather than
// changing required-ness for every other consumer of branchSchema.
const branchDetailsSchema = z.object({
  branchName: requiredString('Branch name'),
  branchCode: requiredString('Branch code'),
  streetNo: requiredString('Street No'),
  buildingFloorRoom: requiredString('Building/Floor/Room'),
  block: requiredString('Block'),
  phone: optionalMobileNumber('Phone'),
  email: optionalEmail(),
  country: requiredString('Country'),
  state: requiredString('State'),
  city: requiredString('City'),
  zipCode: requiredPincode('Zipcode'),
  isDefault: z.boolean().optional(),
  defaultWarehouse: optionalString(),
  defaultCustomer: optionalString(),
  defaultVendor: optionalString(),
  status: statusEnum(),
});

const emptyValues = {
  branchName: '', branchCode: '', streetNo: '', buildingFloorRoom: '', block: '',
  phone: '', email: '', country: 'India', state: '', city: '', zipCode: '',
  isDefault: false, defaultWarehouse: '', defaultCustomer: '', defaultVendor: '',
  status: 'Active',
};

const PAGE_SIZE = 10;

const TABLE_ROW_HEIGHT = 0;         // floor, not a cap
const TABLE_CELL_PADDING_Y = 6;     // the actual top/bottom gap per cell, in px — this is what actually controls row height
export default function Branch() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const { data: branches, isLoading } = branchApi.useList();
  const { data: customers } = customerApi.useList();
  const { data: suppliers } = supplierApi.useList();
  const [create, { isLoading: creating }] = branchApi.useCreate();
  const [update, { isLoading: updating }] = branchApi.useUpdate();
  const [remove] = branchApi.useDelete();

  // The form lives in a modal — the page itself is the list, and "Add Branch"
  // (or an edit action) opens the dialog over it. Same shape as the shared
  // MasterCrudPage template.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // Warehouse options come from the Warehouse Master — see lib/useWarehouseOptions.js.
  // currentValue keeps an existing branch's saved warehouse selectable even if
  // it no longer matches an active warehouse (see that file for why).
  const { options: warehouseOptions } = useWarehouseOptions({ currentValue: editingRow?.defaultWarehouse });
  const customerOptions = (customers || []).map((c) => ({ label: c.customerName, value: c.customerName }));
  const supplierOptions = (suppliers || []).map((s) => ({ label: s.supplierName, value: s.supplierName }));
  const [search, setSearch] = useState('');

  const allRows = branches || [];
  const baseTableRows = useMemo(() => {
    const q = '';
    if (!q) return allRows;
    return allRows.filter((r) => [r.branchName, r.branchCode, r.city, r.state].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [allRows]);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'branchCode', headerName: 'Branch Code', filter: 'text' },
    { field: 'branchName', headerName: 'Branch Name', filter: 'text' },
    { field: 'phone', headerName: 'Phone Number', filter: 'text' },
    { field: 'email', headerName: 'Email', filter: 'text' },
    // Which branch is the Main Branch (Branch.isDefault). `value` maps the
    // raw boolean to the words shown in the cell, so searching "Main",
    // sorting, and the filter popover's auto-derived options all work on
    // what the user can actually see rather than on true/false.
    { field: 'isDefault', headerName: 'Default', filter: 'select', value: (r) => (r.isDefault ? 'Main' : '—') },
    { field: 'status', headerName: 'Status', filter: 'select' },
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
      title: 'Delete branch',
      message: `Are you sure you want to delete "${row.branchName}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Branch deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...values }).unwrap();
        notify.success('Branch updated');
      } else {
        await create(values).unwrap();
        notify.success('Branch added');
      }
      forceClose();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<ApartmentIcon />}
        title="Branch Details"
        subtitle="Manage your company branches. Add, update or remove branches."
        rightContent={
          <CanAdd>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Add Branch
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
            {readOnly ? 'View Branch' : editingRow ? 'Edit Branch' : 'New Branch'}
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
          schema={branchDetailsSchema}
          defaultValues={editingRow ? { ...emptyValues, ...editingRow } : emptyValues}
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
                    {/* Auto-generated from the perpetual BRN numbering series (Document
                        Numbering is filtered to hide this master from that page — see
                        hiddenFromNumberingUI in documentNumberService.js). The field is
                        filled and locked on create, and left untouched on edit so an
                        existing record's code is never rewritten. */}
                    <LabeledField label="Branch Code *">
                      <DocumentNoField documentCode="BRN" name="branchCode" label="" isCreate={!editingRow} />
                    </LabeledField>
                    <LabeledField label="Branch Name *">
                      <FormTextField name="branchName" label="" placeholder="Enter branch name" />
                    </LabeledField>
                    </FormGrid>
                    <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                    <LabeledField label="Street No *">
                      <FormTextField name="streetNo" label="" placeholder="Enter street number" />
                    </LabeledField>

                    <LabeledField label="Building/Floor/Room *">
                      <FormTextField name="buildingFloorRoom" label="" placeholder="Enter building, floor or room" />
                    </LabeledField>
                    <LabeledField label="Block *">
                      <FormTextField name="block" label="" placeholder="Enter block" />
                    </LabeledField>
                    <LabeledField label="Country *">
                      <FormSelect name="country" label="" placeholder="Select country" options={countries} />
                    </LabeledField>

                    <LabeledField label="State *">
                      <FormSelect name="state" label="" placeholder="Select state" options={getStateOptions(country)} />
                    </LabeledField>
                    <LabeledField label="City *">
                      <FormSelect name="city" label="" placeholder="Select city" options={getCityOptions(country, state)} />
                    </LabeledField>
                    <LabeledField label="Zipcode *">
                      <FormTextField name="zipCode" label="" placeholder="Enter zipcode" digitsOnly maxLength={6} />
                    </LabeledField>

                    <LabeledField label="Phone Number">
                      <FormTextField name="phone" label="" placeholder="Enter phone number" digitsOnly maxLength={10} />
                    </LabeledField>
                    <LabeledField label="Email">
                      <FormTextField name="email" label="" placeholder="Enter email address" />
                    </LabeledField>


                    <LabeledField label="Default Warehouse">
                      <FormSelect name="defaultWarehouse" label="" placeholder="Select warehouse" options={warehouseOptions} />
                    </LabeledField>
                    <LabeledField label="Default Customer">
                      <FormSelect name="defaultCustomer" label="" placeholder="Select customer" options={customerOptions} />
                    </LabeledField>
                    <LabeledField label="Default Vendor">
                      <FormSelect name="defaultVendor" label="" placeholder="Select vendor" options={supplierOptions} />
                    </LabeledField>

                    {/* Sits alone on its last row rather than beside a text
                        field: a checkbox is shorter than an input, so pairing
                        them on one row leaves the labels visibly out of line. */}
                        <LabeledField label="Status *">
                          <FormSelect
                        name="status"
                        label=""
                        options={[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]}
                      />
                        </LabeledField>

                    <FormCheckbox name="isDefault" label="Main Branch" />
                  </FormGrid>
                </DialogContent>

                <DialogActions sx={{ px: 3, py: 2 }}>

                  <FormSubmitButton disabled={creating || updating}>
                    {readOnly ? 'View' : editingRow ? 'Update Branch' : 'Save Branch'}
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
            <Typography variant="subtitle1" fontWeight={700}>Branch List</Typography>
            <TableSearchFilter table={table} placeholder="Search branches..." width={220} />
          </Stack>

          <TableFilterPanel table={table} />

          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {isLoading && <LoadingState label="Loading branches…" />}
              {!isLoading && pagedRows.map((row) => (
                <MobileRecordCard
                  key={row.id}
                  title={row.branchName}
                  statusChip={<Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />}
                  fields={[
                    { label: 'Branch Code', value: row.branchCode },
                    { label: 'Default', value: row.isDefault ? 'Main' : '—' },
                    { label: 'Phone Number', value: row.phone || '—' },
                    { label: 'Email', value: row.email || '—' },
                  ]}
                  onView={() => handleView(row)}
                  onEdit={() => handleEdit(row)}
                  onDelete={() => handleDelete(row)}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                <EmptyState
                  icon={<AccountTreeOutlinedIcon sx={{ fontSize: 48 }} />}
                  title={table.isFiltering ? 'No matches' : 'No branches yet'}
                  message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first branch to get started'}
                  action={!table.isFiltering && (
                    <CanAdd>
                      <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add Branch</Button>
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
                    <SortableHeaderCell field="branchCode" sort={table.sort} onSort={table.toggleSort}>Branch Code</SortableHeaderCell>
                    <SortableHeaderCell field="branchName" sort={table.sort} onSort={table.toggleSort}>Branch Name</SortableHeaderCell>
                    <SortableHeaderCell field="phone" sort={table.sort} onSort={table.toggleSort}>Phone Number</SortableHeaderCell>
                    <SortableHeaderCell field="email" sort={table.sort} onSort={table.toggleSort}>Email</SortableHeaderCell>
                    <SortableHeaderCell field="isDefault" sort={table.sort} onSort={table.toggleSort}>Default</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading && <TableSkeleton columns={8} rows={pageSize > 8 ? 8 : pageSize} />}
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.branchCode}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.branchName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.phone || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.email || '—'}</TableCell>
                      {/* Only ever one row carries this — the server demotes
                          the previous main branch whenever another is
                          promoted (see the branches route in company.js). */}
                      <TableCell>
                        {row.isDefault
                          ? <Chip size="small" label="Main" color="primary" />
                          : <Typography variant="body2" color="text.secondary">—</Typography>}
                      </TableCell>
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
                      <TableCell colSpan={8} sx={{ border: 'none' }}>
                        <EmptyState
                          icon={<AccountTreeOutlinedIcon sx={{ fontSize: 48 }} />}
                          title={table.isFiltering ? 'No matches' : 'No branches yet'}
                          message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first branch to get started'}
                          action={!table.isFiltering && (
                            <CanAdd>
                              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add Branch</Button>
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
