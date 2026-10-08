import React, { useEffect, useMemo, useState } from 'react';
import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined';
import {
  Box, Typography, Button, Card, CardContent, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Chip, IconButton, Collapse,
} from '@mui/material';
import CategoryIcon from '@mui/icons-material/Category';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormSelect from '../../components/form/FormSelect';
import FormTextField from '../../components/form/FormTextField';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import {
  accountTypeSchema, BALANCE_TYPE_OPTIONS, STATUS_AI_OPTIONS, FINANCIAL_STATEMENT_OPTIONS,
} from '../../lib/validation/accountingSchemas';
import { accountTypeApi } from '../../features/resources';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import DocumentNoField from '../../components/form/DocumentNoField';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';

import { CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';
const emptyValues = {
  typeCode: '', typeName: '', financialStatement: 'Balance Sheet', normalBalance: 'D', status: 'A',
};

const PAGE_SIZE = 10;

const ACCOUNT_TYPE_LIST_TABLE_ROW_HEIGHT = 0;
const ACCOUNT_TYPE_LIST_TABLE_CELL_PADDING_Y = 6;
export default function AccountType() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const { data: types, isLoading, isFetching, refetch } = accountTypeApi.useList();
  const [create, { isLoading: creating }] = accountTypeApi.useCreate();
  const [update, { isLoading: updating }] = accountTypeApi.useUpdate();
  const [remove] = accountTypeApi.useDelete();

  // Form is hidden by default — only the list shows until "Add Account Type"
  // (or an edit action) is triggered, per the standard CRUD page template.
  const [showForm, setShowForm] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const allRows = types || [];

  // Column definitions drive the global search, the sort icons and the
  // filter popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'typeCode', headerName: 'Type Code', filter: 'text' },
    { field: 'typeName', headerName: 'Type Name', filter: 'text' },
    { field: 'financialStatement', headerName: 'Financial Statement', filter: 'select' },
    {
      field: 'normalBalance', headerName: 'Normal Balance', filter: 'select',
      value: (row) => (row.normalBalance === 'D' ? 'Debit' : 'Credit'),
    },
    {
      field: 'status', headerName: 'Status', filter: 'select',
      value: (row) => (row.status === 'A' ? 'Active' : 'Inactive'),
    },
  ]), []);
  const table = useTableFeatures(allRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  useEffect(() => { setPage(0); }, [rows.length]);

  const openCreate = () => {
    setEditingRow(null);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRow(null);
  };

  const handleToggleForm = () => (showForm ? closeForm() : openCreate());

  // Read-only look at a record — same form, every field disabled
  // and the save button removed (see AppForm's readOnly prop).
  const handleView = (row) => {
    setEditingRow(row);
    setReadOnly(true);
    setFormKey((k) => k + 1);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (row) => {
    setEditingRow(row);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (row) => {
    const ok = await confirmDialog({
      title: 'Delete account type',
      message: `Are you sure you want to delete "${row.typeName}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Account type deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...values }).unwrap();
        notify.success('Account type updated');
      } else {
        await create(values).unwrap();
        notify.success('Account type added');
      }
      closeForm();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<CategoryIcon />}
        title="Account Type"
        subtitle="Manage the account types used to classify Chart Of Accounts entries."
        rightContent={<CompanyBadge />}
      />

      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
        <Button
          variant="contained"
          startIcon={showForm ? <CloseIcon /> : <AddIcon />}
          onClick={handleToggleForm}
        >
          {showForm ? 'Close' : 'Add Account Type'}
        </Button>
      </Stack>

      <Collapse in={showForm} unmountOnExit>
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
              {readOnly ? 'View Account Type' : editingRow ? 'Edit Account Type' : 'Add Account Type'}
            </Typography>

            <AppForm readOnly={readOnly}
              key={formKey}
              schema={accountTypeSchema}
              defaultValues={editingRow ? { ...emptyValues, ...editingRow } : emptyValues}
              onSubmit={handleSubmit}
            >
              {() => (
                <>
                  <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                    {/* Auto-generated from the perpetual ATY numbering series (hidden
                        from the Document Numbering page — see hiddenFromNumberingUI in
                        documentNumberService.js). The field is filled and locked on
                        create, and left untouched on edit so an existing record's code
                        is never rewritten. */}
                    <LabeledField label="Type Code *">
                      <DocumentNoField documentCode="ATY" name="typeCode" label="" isCreate={!editingRow} />
                    </LabeledField>
                    <LabeledField label="Type Name *">
                      <FormTextField name="typeName" label="" placeholder="Enter type name" />
                    </LabeledField>
                    <LabeledField label="Financial Statement *">
                      <FormSelect name="financialStatement" label="" options={FINANCIAL_STATEMENT_OPTIONS} />
                    </LabeledField>
                    <LabeledField label="Normal Balance *">
                      <FormSelect name="normalBalance" label="" options={BALANCE_TYPE_OPTIONS} />
                    </LabeledField>
                    <LabeledField label="Status *">
                      <FormSelect name="status" label="" options={STATUS_AI_OPTIONS} />
                    </LabeledField>
                  </FormGrid>

                  <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 3 }}>
                    <Button variant="outlined" color={readOnly ? 'error' : 'inherit'} onClick={closeForm} disabled={creating || updating}>
                      {readOnly ? 'Close' : 'Clear'}
                    </Button>
                    <FormSubmitButton disabled={creating || updating}>
                      {readOnly ? 'View' : editingRow ? 'Update Type' : 'Save Type'}
                    </FormSubmitButton>
                  </Stack>
                </>
              )}
            </AppForm>
          </CardContent>
        </Card>
      </Collapse>

      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: { xs: 2, sm: 3 }, pt: 2.5, pb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Account Type List</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }} flexWrap="wrap" useFlexGap>
              <TableSearchFilter table={table} placeholder="Search account types..." width={220} />
              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => refetch()} disabled={isFetching} sx={{ width: { xs: '100%', sm: 'auto' } }}>
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
                  title={row.typeName}
                  statusChip={<Chip size="small" label={row.status === 'A' ? 'Active' : 'Inactive'} color={row.status === 'A' ? 'success' : 'default'} variant="outlined" />}
                  fields={[
                    { label: 'Type Code', value: row.typeCode },
                    { label: 'Financial Statement', value: row.financialStatement || '—' },
                    { label: 'Normal Balance', value: row.normalBalance === 'D' ? 'Debit' : 'Credit' },
                  ]}
                  onView={() => handleView(row)}
                  onEdit={() => handleEdit(row)}
                  onDelete={() => handleDelete(row)}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                <EmptyState icon={<CalculateOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No account types yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first account type to get started'} />
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table
                size="small"
                stickyHeader
                sx={{
                  '& th, & td': {
                    height: ACCOUNT_TYPE_LIST_TABLE_ROW_HEIGHT,
                    paddingTop: `${ACCOUNT_TYPE_LIST_TABLE_CELL_PADDING_Y}px`,
                    paddingBottom: `${ACCOUNT_TYPE_LIST_TABLE_CELL_PADDING_Y}px`,
                    boxSizing: 'border-box',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell width={48}>#</TableCell>
                    <SortableHeaderCell field="typeCode" sort={table.sort} onSort={table.toggleSort}>Type Code</SortableHeaderCell>
                    <SortableHeaderCell field="typeName" sort={table.sort} onSort={table.toggleSort}>Type Name</SortableHeaderCell>
                    <SortableHeaderCell field="financialStatement" sort={table.sort} onSort={table.toggleSort}>Financial Statement</SortableHeaderCell>
                    <SortableHeaderCell field="normalBalance" sort={table.sort} onSort={table.toggleSort}>Normal Balance</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.typeCode}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.typeName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.financialStatement || '—'}</TableCell>
                      <TableCell>
                        <Chip size="small" label={row.normalBalance === 'D' ? 'Debit' : 'Credit'} color={row.normalBalance === 'D' ? 'primary' : 'secondary'} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={row.status === 'A' ? 'Active' : 'Inactive'} color={row.status === 'A' ? 'success' : 'default'} variant="outlined" />
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
                      <TableCell colSpan={7}>
                        <EmptyState icon={<CalculateOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No account types yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first account type to get started'} />
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
