import React, { useEffect, useMemo, useState } from 'react';
import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined';
import { useFormContext } from 'react-hook-form';
import {
  Box, Typography, Button, Card, CardContent, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Chip, IconButton, Collapse,
} from '@mui/material';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { accountGroupSchema, STATUS_AI_OPTIONS } from '../../lib/validation/accountingSchemas';
import { accountGroupApi } from '../../features/resources';
import { buildTreeRows } from '../../lib/tree';
import {
  FIRST_GROUP_LEVEL, MAX_GROUP_LEVEL, buildGroupLevelMap, rootGroupIdOf,
} from '../../lib/accountHierarchy';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

import { CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';
const emptyValues = {
  groupCode: '', groupName: '', parentGroupId: null, groupLevel: FIRST_GROUP_LEVEL,
  status: 'A', remarks: '',
};

// Level + Parent Group, kept in step with each other.
//
// Lives in its own component rather than inline in AppForm's render callback:
// that callback runs as part of AppForm's own render, so hooks called there
// would be counted against AppForm and its hook count would change whenever
// the form opened or closed — which React treats as a fatal error. Same
// reasoning as AccountFormFields on the Chart of Accounts screen.
function GroupHierarchyFields({ allRows, levelById, editingRow }) {
  const { watch, setValue, getValues } = useFormContext();
  const groupLevel = Number(watch('groupLevel') ?? FIRST_GROUP_LEVEL);

  // A group can't be filed under itself or its own descendants — that would
  // cut the branch off from the tree entirely.
  const excludeIds = useMemo(() => (
    editingRow
      ? new Set([editingRow.id, ...collectDescendants(allRows, editingRow.id)])
      : new Set()
  ), [allRows, editingRow]);

  // Parents legal for the chosen level: groups exactly one level above it.
  const parentOptions = useMemo(() => {
    if (groupLevel <= FIRST_GROUP_LEVEL) return [];
    return allRows
      .filter((g) => !excludeIds.has(g.id))
      .filter((g) => (levelById.get(g.id) ?? FIRST_GROUP_LEVEL) === groupLevel - 1)
      .sort((a, b) => String(a.groupCode || '').localeCompare(String(b.groupCode || ''), undefined, { numeric: true }))
      .map((g) => ({ label: `${g.groupCode} ${g.groupName}`, value: g.id }));
  }, [allRows, excludeIds, levelById, groupLevel]);

  // A level is only offered when something exists to attach it to, so an
  // unreachable level can't be picked and then rejected on Save.
  const levelOptions = useMemo(() => {
    const countAt = new Map();
    allRows.forEach((g) => {
      const level = levelById.get(g.id) ?? FIRST_GROUP_LEVEL;
      countAt.set(level, (countAt.get(level) || 0) + 1);
    });
    return Array.from({ length: MAX_GROUP_LEVEL }, (_, i) => i + FIRST_GROUP_LEVEL).map((level) => {
      const reachable = level === FIRST_GROUP_LEVEL || (countAt.get(level - 1) || 0) > 0;
      return {
        label: level === FIRST_GROUP_LEVEL
          ? 'Level 1 — top-level drawer'
          : `Level ${level}${reachable ? '' : ' — no group available at this depth'}`,
        value: level,
        disabled: !reachable,
      };
    });
  }, [allRows, levelById]);

  // Level 1 is a drawer, which by definition has nothing above it.
  useEffect(() => {
    if (groupLevel <= FIRST_GROUP_LEVEL && getValues('parentGroupId') != null) {
      setValue('parentGroupId', null, { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupLevel]);

  // A parent stranded by a level change is dropped rather than submitted as a
  // value the dropdown no longer lists.
  useEffect(() => {
    const current = getValues('parentGroupId');
    if (current != null && !parentOptions.some((o) => o.value === current)) {
      setValue('parentGroupId', null, { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupLevel]);

  return (
    <>
      <LabeledField label="Level *">
        <FormSelect
          name="groupLevel"
          label=""
          options={levelOptions}
          getOptionDisabled={(o) => Boolean(o.disabled)}
        />
      </LabeledField>
      <LabeledField label={groupLevel <= FIRST_GROUP_LEVEL ? 'Parent Group' : 'Parent Group *'}>
        <FormSelect
          name="parentGroupId"
          label=""
          placeholder={groupLevel <= FIRST_GROUP_LEVEL
            ? 'None — this is a top-level drawer'
            : `Select the level ${groupLevel - 1} group this sits under`}
          options={parentOptions}
          disabled={groupLevel <= FIRST_GROUP_LEVEL}
        />
      </LabeledField>
    </>
  );
}

// Every group beneath `id`, walked from the flat list. Used to stop a group
// being re-parented under one of its own descendants, which would detach that
// whole branch from the tree into a cycle.
function collectDescendants(rows, id) {
  const found = new Set();
  const stack = [id];
  while (stack.length) {
    const current = stack.pop();
    rows.forEach((r) => {
      if (r.parentGroupId === current && !found.has(r.id)) {
        found.add(r.id);
        stack.push(r.id);
      }
    });
  }
  return found;
}

const ACCOUNT_GROUP_LIST_TABLE_ROW_HEIGHT = 0;
const ACCOUNT_GROUP_LIST_TABLE_CELL_PADDING_Y = 6;
export default function AccountGroup() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const { data: groups, isLoading, isFetching, refetch } = accountGroupApi.useList();
  const [create, { isLoading: creating }] = accountGroupApi.useCreate();
  const [update, { isLoading: updating }] = accountGroupApi.useUpdate();
  const [remove] = accountGroupApi.useDelete();

  const [showForm, setShowForm] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const allRows = groups || [];
  const groupById = useMemo(() => new Map(allRows.map((g) => [g.id, g])), [allRows]);
  // Derived depth (see lib/accountHierarchy), not the stored GroupLevel — so a
  // row whose level was written before this form could set one still reads
  // correctly against its actual position in the tree.
  const levelById = useMemo(() => buildGroupLevelMap(allRows), [allRows]);
  const childCount = useMemo(() => {
    const counts = new Map();
    allRows.forEach((g) => {
      if (g.parentGroupId == null) return;
      counts.set(g.parentGroupId, (counts.get(g.parentGroupId) || 0) + 1);
    });
    return counts;
  }, [allRows]);

  // Column definitions drive the global search, the filter popover and the
  // tri-state sort icons in the header.
  const tableColumns = useMemo(() => ([
    { field: 'groupCode', headerName: 'Group Code', filter: 'text' },
    { field: 'groupName', headerName: 'Group Name', filter: 'text' },
    { field: 'groupType', headerName: 'Group Type', filter: 'select' },
    { field: 'groupLevel', headerName: 'Level', filter: 'numberRange' },
    {
      field: 'isPostingAllowed', headerName: 'Posting Allowed', filter: 'select',
      value: (row) => (row.isPostingAllowed ? 'Yes' : 'No'),
    },
    {
      field: 'status', headerName: 'Status', filter: 'select',
      value: (row) => (row.status === 'A' ? 'Active' : 'Inactive'),
    },
    { field: 'remarks', headerName: 'Remarks', filter: 'text' },
  ]), []);
  const table = useTableFeatures(allRows, tableColumns);

  // Group Code is a plain running sequence — 1, 2, 3 … n — not a prefixed
  // document number. The next code is one past the highest whole-number code
  // in use, so it keeps counting on from the seeded groups (1 Assets …
  // 5 Expenditure) rather than restarting.
  //
  // Only codes that are entirely digits count towards the maximum: a dotted
  // sub-group code like '1.1' would otherwise be read as 1 by parseInt and
  // could hand out a number that's already taken.
  const nextGroupCode = useMemo(() => {
    const used = allRows
      .map((g) => String(g.groupCode ?? '').trim())
      .filter((code) => /^\d+$/.test(code))
      .map(Number);
    return String((used.length ? Math.max(...used) : 0) + 1);
  }, [allRows]);

  // Unsorted, the list shows the hierarchy: depth-first, parent-then-children,
  // the same shape the org's recursive AccountTree CTE produces.
  //
  // With a sort active, that nesting is dropped and the rows show flat. Those
  // two things genuinely conflict — re-nesting sorted rows puts each child
  // back under its parent, so "sort by Group Name" would still be led by
  // whatever order the parents happen to be in, and the sort would look
  // broken. Flattening is what makes the sort mean what the header says.
  //
  // No pagination either way: an account-group tree is reference data meant to
  // be read whole, same as the recursive query itself never pages.
  const displayRows = useMemo(() => {
    if (table.sort) return table.rows.map((row) => ({ ...row, depth: 0 }));
    return buildTreeRows(table.rows, { idField: 'id', parentField: 'parentGroupId' });
  }, [table.rows, table.sort]);

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
    const hasChildren = allRows.some((g) => g.parentGroupId === row.id);
    if (hasChildren) {
      notify.error('This group has sub-groups under it — move or delete those first.');
      return;
    }
    const ok = await confirmDialog({
      title: 'Delete account group',
      message: `Are you sure you want to delete "${row.groupName}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Account group deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    // Parent Group and Level ARE captured now, so a group can be filed
    // anywhere in the tree from this screen instead of every UI-created group
    // being stranded at level 1.
    //
    // Two columns are still derived rather than asked for, because asking
    // would invite an answer that contradicts the tree:
    //
    //   GroupType — the accounting classification (Assets, Liabilities, ...)
    //     belongs to the DRAWER. A sub-group of Assets is an Assets group;
    //     letting someone mark 1.1.1 Cash as a Liability would misfile every
    //     account under it in the financial statements. Inherited from the
    //     level-1 ancestor, matching what seed_accounting.js does.
    //   IsPostingAllowed — a group with sub-groups under it is roll-up only;
    //     accounts hang off the leaves. So it's simply "has no children",
    //     recomputed on every save rather than drifting out of step with the
    //     tree the moment someone adds a sub-group.
    const parentId = values.parentGroupId ?? null;
    const parent = parentId != null ? groupById.get(parentId) : null;
    const groupLevel = parent ? (levelById.get(parent.id) ?? FIRST_GROUP_LEVEL) + 1 : FIRST_GROUP_LEVEL;

    if (groupLevel > MAX_GROUP_LEVEL) {
      notify.error(`Account groups are limited to ${MAX_GROUP_LEVEL} levels — this group would be level ${groupLevel}.`);
      return;
    }
    // A group can't be filed under itself or one of its own descendants.
    if (editingRow && parentId != null) {
      const descendants = collectDescendants(allRows, editingRow.id);
      if (parentId === editingRow.id || descendants.has(parentId)) {
        notify.error('A group cannot sit under itself or one of its own sub-groups.');
        return;
      }
    }

    const drawerId = parentId != null ? rootGroupIdOf(parentId, groupById) : null;
    const groupType = drawerId != null
      ? (groupById.get(drawerId)?.groupType || '')
      // A new drawer has no ancestor to inherit from, and on edit the existing
      // classification is kept rather than blanked.
      : (editingRow?.groupType || '');

    const payload = {
      ...values,
      parentGroupId: parentId,
      groupLevel,
      groupType,
      isPostingAllowed: (childCount.get(editingRow?.id) || 0) === 0,
    };
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Account group updated');
      } else {
        await create(payload).unwrap();
        notify.success('Account group added');
      }
      closeForm();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  return (
    <Box>

 

      <Collapse in={showForm} unmountOnExit>
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
              {readOnly ? 'View Account Group' : editingRow ? 'Edit Account Group' : 'Add Account Group'}
            </Typography>

            <AppForm readOnly={readOnly}
              key={formKey}
              schema={accountGroupSchema}
              // groupLevel comes from the derived map rather than the stored
              // column, so a group saved before this form could set a level
              // opens at its real depth.
              defaultValues={editingRow
                ? {
                  ...emptyValues,
                  ...editingRow,
                  groupLevel: levelById.get(editingRow.id) ?? FIRST_GROUP_LEVEL,
                }
                : { ...emptyValues, groupCode: nextGroupCode }}
              onSubmit={handleSubmit}
            >
              {() => (
                <>
                  <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                    {/* Plain running number (see nextGroupCode above), not the
                        AG-000001 document series. Locked on create so the
                        sequence can't be broken by hand; editable on an
                        existing record in case a code needs correcting. */}
                    <LabeledField label="Group Code *">
                      <FormTextField
                        name="groupCode"
                        label=""
                        placeholder="Enter group code"
                        disabled={!editingRow}
                      />
                    </LabeledField>
                    <LabeledField label="Group Name *">
                      <FormTextField name="groupName" label="" placeholder="Enter group name" />
                    </LabeledField>
                    <LabeledField label="Status *">
                      <FormSelect name="status" label="" options={STATUS_AI_OPTIONS} />
                    </LabeledField>
                    {/* The group hierarchy, captured the same way the account
                        hierarchy is on the Chart of Accounts screen: pick the
                        Level, and the Parent Group list narrows to the groups one
                        level above it. Level 1 is a drawer and has no parent. */}
                    <GroupHierarchyFields
                      allRows={allRows}
                      levelById={levelById}
                      editingRow={editingRow}
                    />
                    <FormGrid columns={1} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                    <LabeledField label="Remarks">
                      <FormTextField name="remarks" label="" placeholder="Enter remarks (optional)" />
                    </LabeledField>
                  </FormGrid>
                  </FormGrid>
                  

                  <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 3 }}>
                    <Button variant="outlined" color={readOnly ? 'error' : 'inherit'} onClick={closeForm} disabled={creating || updating}>
                      {readOnly ? 'Close' : 'Clear'}
                    </Button>
                    <FormSubmitButton disabled={creating || updating}>
                      {readOnly ? 'View' : editingRow ? 'Update Group' : 'Save Group'}
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
            <Typography variant="subtitle1" fontWeight={700}>Account Group List</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }} flexWrap="wrap" useFlexGap>
              <TableSearchFilter table={table} placeholder="Search account groups..." width={220} />
              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => refetch()} disabled={isFetching} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                Refresh
              </Button>
              <Button
    variant="contained"
    startIcon={showForm ? <CloseIcon /> : <AddIcon />}
    onClick={handleToggleForm}
    sx={{ width: { xs: '100%', sm: 'auto' } }}
  >
    {showForm ? 'Close' : 'Add Account Group'}
  </Button>
            </Stack>

            <TableFilterPanel table={table} />
          </Stack>

          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {!isLoading && displayRows.map((row) => (
                <MobileRecordCard
                  key={row.id}
                  title={`${'— '.repeat(row.depth)}${row.groupName}`}
                  statusChip={<Chip size="small" label={row.status === 'A' ? 'Active' : 'Inactive'} color={row.status === 'A' ? 'success' : 'default'} variant="outlined" />}
                  fields={[
                    { label: 'Group Code', value: row.groupCode },
                    { label: 'Group Type', value: row.groupType || '—' },
                    { label: 'Level', value: levelById.get(row.id) ?? row.groupLevel },
                    { label: 'Parent Group', value: row.parentGroupId ? (groupById.get(row.parentGroupId)?.groupName || '—') : '—' },
                    { label: 'Posting Allowed', value: (childCount.get(row.id) || 0) === 0 ? 'Yes' : 'No' },
                    { label: 'Remarks', value: row.remarks || '—' },
                  ]}
                  onView={() => handleView(row)}
                  onEdit={() => handleEdit(row)}
                  onDelete={() => handleDelete(row)}
                />
              ))}
              {!isLoading && displayRows.length === 0 && (
                <EmptyState icon={<CalculateOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No account groups yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first account group to get started'} />
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table
                size="small"
                stickyHeader
                sx={{
                  '& th, & td': {
                    height: ACCOUNT_GROUP_LIST_TABLE_ROW_HEIGHT,
                    paddingTop: `${ACCOUNT_GROUP_LIST_TABLE_CELL_PADDING_Y}px`,
                    paddingBottom: `${ACCOUNT_GROUP_LIST_TABLE_CELL_PADDING_Y}px`,
                    boxSizing: 'border-box',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell width={48}>#</TableCell>
                    <SortableHeaderCell field="groupCode" sort={table.sort} onSort={table.toggleSort}>Group Code</SortableHeaderCell>
                    <SortableHeaderCell field="groupName" sort={table.sort} onSort={table.toggleSort}>Group Name</SortableHeaderCell>
                    <SortableHeaderCell field="groupType" sort={table.sort} onSort={table.toggleSort}>Group Type</SortableHeaderCell>
                    <SortableHeaderCell field="groupLevel" sort={table.sort} onSort={table.toggleSort} align="center">Level</SortableHeaderCell>
                    <SortableHeaderCell field="isPostingAllowed" sort={table.sort} onSort={table.toggleSort} align="center">Posting Allowed</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <SortableHeaderCell field="remarks" sort={table.sort} onSort={table.toggleSort}>Remarks</SortableHeaderCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && displayRows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.groupCode}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Stack direction="row" alignItems="center" sx={{ pl: row.depth * 2.5 }}>
                          {row.depth > 0 && <SubdirectoryArrowRightIcon fontSize="inherit" sx={{ mr: 0.5, color: 'text.disabled' }} />}
                          {row.groupName}
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.groupType || '—'}</TableCell>
                      {/* Derived depth, not the stored column — see levelById. */}
                      <TableCell align="center">{levelById.get(row.id) ?? row.groupLevel}</TableCell>
                      <TableCell align="center">
                        {/* Also derived: a group with sub-groups is roll-up
                            only, accounts hang off the leaves. Reading it from
                            the tree means it can't drift out of date the
                            moment someone adds a sub-group beneath it. */}
                        {(() => {
                          const postingAllowed = (childCount.get(row.id) || 0) === 0;
                          return <Chip size="small" label={postingAllowed ? 'Yes' : 'No'} color={postingAllowed ? 'primary' : 'default'} variant="outlined" />;
                        })()}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={row.status === 'A' ? 'Active' : 'Inactive'} color={row.status === 'A' ? 'success' : 'default'} variant="outlined" />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 240 }}>{row.remarks || '—'}</TableCell>
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
                  {!isLoading && displayRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9}>
                        <EmptyState icon={<CalculateOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No account groups yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first account group to get started'} />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollableTableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
