import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton, Collapse,
} from '@mui/material';
import { useFieldArray } from 'react-hook-form';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { z } from 'zod';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import useDragScroll from '../../components/data-display/useDragScroll';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { requiredString, nonNegativeNumber } from '../../lib/validation/common';
import { approvalFlowApi, branchApi } from '../../features/resources';
import { useListDocumentNumberingQuery } from '../../features/company/companyDetailsApi';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

import { CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import TableSkeleton from '../../components/feedback/TableSkeleton';
import LoadingState from '../../components/feedback/LoadingState';
import EmptyState from '../../components/data-display/EmptyState';
// Each level's amount range: fromAmount is required, toAmount is optional —
// an empty toAmount means "No Limit" (open-ended top of the range).
const levelSchema = z.object({
  approverType: requiredString('Approver type'),
  approver: requiredString('Approver'),
  fromAmount: nonNegativeNumber('From amount'),
  toAmount: z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().min(0, 'To amount cannot be negative').optional()),
  requiredAction: requiredString('Required action'),
});

// Local schema — the shared approvalFlowSchema is flat (no levels, has a
// visible Status field). This page's design has no Status field (defaults
// to Active behind the scenes, same pattern as Bank Details) and adds the
// nested levels array the mockup's "Approval Configuration" table needs.
const approvalFlowDetailsSchema = z.object({
  transactionName: requiredString('Transaction'),
  approvalType: requiredString('Approval type'),
  appliedFor: requiredString('Apply for'),
  levels: z.array(levelSchema).min(1, 'Add at least one approval level'),
});

const defaultLevel = { approverType: 'User', approver: '', fromAmount: 0, toAmount: '', requiredAction: 'Approve' };

const emptyValues = {
  transactionName: '', approvalType: 'Amount Based', appliedFor: 'All Branches',
  levels: [defaultLevel],
};

const APPROVAL_TYPE_OPTIONS = [
  { label: 'Amount Based', value: 'Amount Based' },
  { label: 'Role Based', value: 'Role Based' },
  { label: 'Sequential', value: 'Sequential' },
];

const APPROVER_TYPE_OPTIONS = [
  { label: 'User', value: 'User' },
  { label: 'Role', value: 'Role' },
];

const REQUIRED_ACTION_OPTIONS = [
  { label: 'Approve', value: 'Approve' },
  { label: 'Reject', value: 'Reject' },
  { label: 'Review', value: 'Review' },
];

const COMMON_APPROVERS = ['Manager', 'Senior Manager', 'General Manager', 'Director', 'CEO', 'CFO'];

const PAGE_SIZE = 10;

const TABLE_ROW_HEIGHT = 0;         // floor, not a cap
const TABLE_CELL_PADDING_Y = 6;     // the actual top/bottom gap per cell, in px — this is what actually controls row height
// Maps API row shape (levels: [{...}]) into the form's editable shape.
function rowToFormValues(row) {
  return {
    transactionName: row.transactionName,
    approvalType: row.approvalType,
    appliedFor: row.appliedFor,
    levels: (row.levels && row.levels.length ? row.levels : [defaultLevel]).map((l) => ({
      approverType: l.approverType || 'User',
      approver: l.approver || '',
      fromAmount: l.fromAmount != null ? Number(l.fromAmount) : 0,
      toAmount: l.toAmount != null ? Number(l.toAmount) : '',
      requiredAction: l.requiredAction || 'Approve',
    })),
  };
}

export default function ApprovalFlow() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const itemScrollRef = useDragScroll();
  const { data: flows, isLoading, isFetching, refetch } = approvalFlowApi.useList();
  const [create, { isLoading: creating }] = approvalFlowApi.useCreate();
  const [update, { isLoading: updating }] = approvalFlowApi.useUpdate();
  const [remove] = approvalFlowApi.useDelete();

  // Transaction options come from the real document numbering list (the
  // app's canonical transaction-type list) rather than a hardcoded copy.
  const { data: documentTypes } = useListDocumentNumberingQuery();
  const { data: branches } = branchApi.useList();

  const transactionOptions = useMemo(
    () => (documentTypes || []).map((d) => ({ label: d.documentName, value: d.documentName })),
    [documentTypes]
  );
  const appliedForOptions = useMemo(
    () => [{ label: 'All Branches', value: 'All Branches' }, ...(branches || []).map((b) => ({ label: b.branchName, value: b.branchName }))],
    [branches]
  );
  // Designation was removed from Employee Master (see SalesEmployee.jsx), so
  // this no longer has a per-employee source to draw approver options from —
  // falls back to the fixed COMMON_APPROVERS list only.
  const approverOptions = useMemo(
    () => COMMON_APPROVERS.map((a) => ({ label: a, value: a })),
    []
  );

  // Form is hidden by default — only the list shows until "Add Approval
  // Rule" (or an edit action) is triggered, per the standard CRUD page template.
  const [showForm, setShowForm] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const [search, setSearch] = useState('');
  const allRows = flows || [];
  const baseTableRows = useMemo(() => {
    const q = '';
    if (!q) return allRows;
    return allRows.filter((r) => [r.transactionName, r.approvalType, r.appliedFor].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [allRows]);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'transactionName', headerName: 'Transaction', filter: 'text' },
    { field: 'approvalType', headerName: 'Approval Type', filter: 'select' },
    { field: 'levels_length', headerName: 'Levels', value: (row) => row.levels.length, filter: 'text' },
    { field: 'appliedFor', headerName: 'Applied For', filter: 'text' },
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
      title: 'Delete approval rule',
      message: `Are you sure you want to delete the approval rule for "${row.transactionName}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Approval rule deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    const payload = { ...values, status: 'Active' };
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Approval configuration updated');
      } else {
        await create(payload).unwrap();
        notify.success('Approval configuration saved');
      }
      closeForm();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<FactCheckIcon />}
        title="Approval Flow"
        subtitle="Configure approval levels and users for various transactions."
        rightContent={
          <Button
            variant="contained"
            startIcon={showForm ? <CloseIcon /> : <AddIcon />}
            onClick={handleToggleForm}
          >
            {showForm ? 'Close' : 'Add Approval Rule'}
          </Button>
        }
      />

      <Collapse in={showForm} unmountOnExit>
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Approval Configuration</Typography>

            <AppForm readOnly={readOnly}
              key={formKey}
              schema={approvalFlowDetailsSchema}
              defaultValues={editingRow ? rowToFormValues(editingRow) : emptyValues}
              onSubmit={handleSubmit}
            >
              {({ control, watch }) => {
                const { fields, append, remove: removeLevel } = useFieldArray({ control, name: 'levels' });
                const levels = watch('levels') || [];

                const addLevel = () => {
                  const last = levels[levels.length - 1];
                  const nextFrom = last && last.toAmount !== '' && last.toAmount != null ? Number(last.toAmount) + 0.01 : 0;
                  append({ ...defaultLevel, fromAmount: nextFrom });
                };

                return (
                  <>
                    <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                      <LabeledField label="Transaction *">
                        <FormSelect name="transactionName" label="" placeholder="Select transaction" options={transactionOptions} />
                      </LabeledField>
                      <LabeledField label="Approval Type *">
                        <FormSelect name="approvalType" label="" placeholder="Select approval type" options={APPROVAL_TYPE_OPTIONS} />
                      </LabeledField>
                      <LabeledField label="Apply For *">
                        <FormSelect name="appliedFor" label="" placeholder="Select branches" options={appliedForOptions} />
                      </LabeledField>
                    </FormGrid>

                    <TableContainer ref={itemScrollRef} sx={{ mt: 3, overflow: 'auto', cursor: 'grab' }}>
                      <Table
                        size="small"
                        sx={{
                          '& tbody .MuiFormHelperText-root:not(.Mui-error)': { display: 'none' },
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
                            <TableCell width={56}>Level</TableCell>
                            <TableCell>Approver Type</TableCell>
                            <TableCell>Approver</TableCell>
                            <TableCell align="right">From Amount (INR)</TableCell>
                            <TableCell align="right">To Amount (INR)</TableCell>
                            <TableCell>Required Action</TableCell>
                            <TableCell width={48} />
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {fields.map((field, index) => (
                            <TableRow key={field.id} sx={{ '& > td': { verticalAlign: 'middle' } }}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell sx={{ minWidth: 130 }}>
                                <FormSelect name={`levels.${index}.approverType`} label="" options={APPROVER_TYPE_OPTIONS} />
                              </TableCell>
                              <TableCell sx={{ minWidth: 200 }}>
                                {/* autoWidth so the box grows to fit the full
                                    selected label (e.g. "General Manager")
                                    instead of clipping it at a fixed width —
                                    same fix used for Journal Lines' G/L
                                    Account / Business Partner cells. */}
                                <FormSelect name={`levels.${index}.approver`} label="" placeholder="Select approver" options={approverOptions} autoWidth />
                              </TableCell>
                              <TableCell align="right" sx={{ minWidth: 130 }}>
                                <FormTextField inputProps={{ style: { textAlign: 'right' } }} name={`levels.${index}.fromAmount`} label="" type="number" />
                              </TableCell>
                              <TableCell align="right" sx={{ minWidth: 130 }}>
                                <FormTextField inputProps={{ style: { textAlign: 'right' } }} name={`levels.${index}.toAmount`} label="" type="number" placeholder="No Limit" />
                              </TableCell>
                              <TableCell sx={{ minWidth: 130 }}>
                                <FormSelect name={`levels.${index}.requiredAction`} label="" options={REQUIRED_ACTION_OPTIONS} />
                              </TableCell>
                              <TableCell>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => removeLevel(index)}
                                  disabled={fields.length <= 1}
                                  aria-label="remove level"
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>

                    <Button startIcon={<AddIcon />} onClick={addLevel} sx={{ mt: 1.5 }}>
                      Add Level
                    </Button>

                    <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 3 }}>
                      <Button variant="outlined" color={readOnly ? 'error' : 'inherit'} onClick={closeForm} disabled={creating || updating}>
                        {readOnly ? 'Close' : 'Cancel'}
                      </Button>
                      <FormSubmitButton disabled={creating || updating}>
                        Save Configuration
                      </FormSubmitButton>
                    </Stack>
                  </>
                );
              }}
            </AppForm>
          </CardContent>
        </Card>
      </Collapse>

      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Approval Flow List</Typography>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TableSearchFilter table={table} placeholder="Search approval rules..." width={220} />
              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => refetch()} disabled={isFetching}>
                Refresh
              </Button>
            </Stack>

            <TableFilterPanel table={table} />
          </Stack>

          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {isLoading && <LoadingState label="Loading approval rules…" />}
              {!isLoading && pagedRows.map((row) => (
                <MobileRecordCard
                  key={row.id}
                  title={row.transactionName}
                  statusChip={<Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />}
                  fields={[
                    { label: 'Approval Type', value: row.approvalType || '—' },
                    { label: 'Levels', value: row.levels?.length ?? 0 },
                    { label: 'Applied For', value: row.appliedFor || '—' },
                  ]}
                  onView={() => handleView(row)}
                  onEdit={() => handleEdit(row)}
                  onDelete={() => handleDelete(row)}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                <EmptyState
                  icon={<FactCheckIcon sx={{ fontSize: 48 }} />}
                  title={table.isFiltering ? 'No matches' : 'No approval rules found'}
                  message={table.isFiltering ? 'Try adjusting your search or filters' : "You haven't added any approval rules yet. Click \"Add Approval Rule\" to get started."}
                  action={!table.isFiltering && (
                    <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add Approval Rule</Button>
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
                    <SortableHeaderCell field="transactionName" sort={table.sort} onSort={table.toggleSort}>Transaction</SortableHeaderCell>
                    <SortableHeaderCell field="approvalType" sort={table.sort} onSort={table.toggleSort}>Approval Type</SortableHeaderCell>
                    <SortableHeaderCell field="levels_length" sort={table.sort} onSort={table.toggleSort}>Levels</SortableHeaderCell>
                    <SortableHeaderCell field="appliedFor" sort={table.sort} onSort={table.toggleSort}>Applied For</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading && <TableSkeleton columns={7} rows={pageSize > 8 ? 8 : pageSize} />}
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.transactionName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.approvalType || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.levels?.length ?? 0}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.appliedFor || '—'}</TableCell>
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
                      <TableCell colSpan={7} sx={{ border: 'none' }}>
                        <EmptyState
                          icon={<FactCheckIcon sx={{ fontSize: 48 }} />}
                          title={table.isFiltering ? 'No matches' : 'No approval rules found'}
                          message={table.isFiltering ? 'Try adjusting your search or filters' : "You haven't added any approval rules yet. Click \"Add Approval Rule\" to get started."}
                          action={!table.isFiltering && (
                            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add Approval Rule</Button>
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
