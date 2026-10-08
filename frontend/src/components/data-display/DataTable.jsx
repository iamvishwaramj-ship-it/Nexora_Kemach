import React, { useMemo, useState, memo } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableRow,
  TablePagination, Paper, Box, IconButton, Chip,
  Stack, Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import { useTranslation } from 'react-i18next';
import TableSkeleton from '../feedback/TableSkeleton';
import LoadingState from '../feedback/LoadingState';
import EmptyState from './EmptyState';
import MobileRecordCard from './MobileRecordCard';
import { useIsMobileListView } from './useIsMobileListView';
import useTableFeatures from './useTableFeatures';
import TableSearchFilter from './TableSearchFilter';
import SortableHeaderCell from './SortableHeaderCell';
import ScrollableTableContainer from './ScrollableTableContainer';
import { canEdit as canEditConfig } from '../../config/deleteConfig';
import { usePermissions } from '../../lib/permissions';

/**
 * DataTable — the default component for ANY tabular data in the app.
 * Global search, tri-state column sorting, per-column filters, internal
 * scrolling with a pinned header, pagination and row actions, all built in.
 * Never build a bespoke table per page — compose this instead.
 *
 * columns: [{ field, headerName, sortable, filter, render?(row), value?, sortValue?, searchValue? }]
 *   filter: 'text' | 'select' | 'dateRange' | 'numberRange' | false (default 'text')
 * rows: array of records (each needs a stable `id` or getRowId provided)
 */
function DataTable({
  columns,
  rows = [],
  loading = false,
  getRowId = (row) => row.id,
  onEdit,
  onDelete,
  onView,
  searchable = true,
  searchPlaceholder,
  emptyMessage,
  emptyTitle,
  emptyIcon,
  rowsPerPageOptions = [10, 25, 50, 100],
  defaultRowsPerPage = 10,
  dense = false,
  // Which navConfig menu this table's Delete action is governed by. Defaults
  // to whatever usePermissions() resolves from the current route (correct
  // for the common case: a page's own table, rendered on that page's own
  // route) — pass this explicitly when a table is rendered somewhere other
  // than its governing page (e.g. embedded in a dialog opened from a
  // different route), or simply to be explicit. See lib/permissions.js.
  menuKey,
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobileListView();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);

  // A column is filterable unless it opts out; `render`-only columns with no
  // backing field are excluded so the filter popover stays meaningful.
  const featureColumns = useMemo(
    () => columns.map((col) => ({
      ...col,
      filter: col.filter === undefined ? 'text' : col.filter,
    })),
    [columns]
  );
  const table = useTableFeatures(rows, featureColumns, { onChange: setPage });
  const sortedRows = table.rows;

  const pagedRows = useMemo(
    () => sortedRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [sortedRows, page, rowsPerPage]
  );

  // Edit: deleteConfig.js's canEdit is still a blanket override — when
  // false, Edit is dropped from this table's actions everywhere it's used,
  // regardless of onEdit being passed in. Unaffected by this task's Delete
  // scoping. MobileRecordCard applies the same flag on its own mobile path
  // below.
  const showEdit = onEdit && canEditConfig;
  // Delete: resolved through usePermissions(menuKey), NOT the raw
  // deleteConfig.js boolean — for a menu in DELETE_SCOPED_MENU_KEYS this
  // already folds in the config flag (see usePermissions()'s own comment in
  // lib/permissions.js); for every other menu it's the untouched per-user
  // UserPermission.canDelete check, same as CanDelete/MobileRecordCard.
  const { canDelete: canDeleteByPermission } = usePermissions(menuKey);
  const showDelete = onDelete && canDeleteByPermission;
  const hasActions = showEdit || showDelete || onView;

  return (
    <Paper variant="outlined" sx={{ width: '100%' }}>
      {searchable && (
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <TableSearchFilter
            table={table}
            placeholder={searchPlaceholder || t('common.search')}
            width={280}
          />
        </Box>
      )}
      {isMobile ? (
        <Box sx={{ p: 2 }}>
          {loading && <LoadingState label={t('common.loading')} />}
          {!loading && pagedRows.length === 0 && (
            <EmptyState
              icon={emptyIcon}
              title={table.isFiltering ? t('common.noMatches') : (emptyTitle || t('common.noResults'))}
              message={table.isFiltering ? t('common.tryAdjustingSearch') : emptyMessage}
            />
          )}
          {!loading && pagedRows.map((row) => {
            const [titleCol, ...restCols] = columns;
            const bodyCols = restCols.filter((col) => col.field !== 'status');
            const statusCol = restCols.find((col) => col.field === 'status');
            return (
              <MobileRecordCard
                key={getRowId(row)}
                title={titleCol.render ? titleCol.render(row) : (row[titleCol.field] ?? '—')}
                statusChip={statusCol && (
                  statusCol.render ? statusCol.render(row) : (
                    <Chip
                      size="small"
                      label={row[statusCol.field]}
                      color={String(row[statusCol.field]).toLowerCase() === 'active' ? 'success' : 'default'}
                      variant="outlined"
                    />
                  )
                )}
                fields={bodyCols.map((col) => ({
                  label: col.headerName,
                  value: col.render ? col.render(row) : (row[col.field] ?? '—'),
                }))}
                onView={onView ? () => onView(row) : undefined}
                onEdit={onEdit ? () => onEdit(row) : undefined}
                onDelete={onDelete ? () => onDelete(row) : undefined}
                menuKey={menuKey}
              />
            );
          })}
        </Box>
      ) : (
        <ScrollableTableContainer>
          <Table stickyHeader size={dense ? 'small' : 'medium'}>
            <TableHead>
              <TableRow>
                {columns.map((col) => (
                  <SortableHeaderCell
                    key={col.field}
                    field={col.field}
                    sort={table.sort}
                    onSort={table.toggleSort}
                    sortable={col.sortable !== false}
                    sx={{ minWidth: col.minWidth }}
                  >
                    {col.headerName}
                  </SortableHeaderCell>
                ))}
                {hasActions && <TableCell align="right">{t('common.actions')}</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && <TableSkeleton columns={columns.length + (hasActions ? 1 : 0)} rows={rowsPerPage > 8 ? 8 : rowsPerPage} />}
              {!loading && pagedRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length + (hasActions ? 1 : 0)} sx={{ border: 'none' }}>
                    <EmptyState
                      icon={emptyIcon}
                      title={table.isFiltering ? t('common.noMatches') : (emptyTitle || t('common.noResults'))}
                      message={table.isFiltering ? t('common.tryAdjustingSearch') : emptyMessage}
                    />
                  </TableCell>
                </TableRow>
              )}
              {!loading && pagedRows.map((row) => (
                <TableRow key={getRowId(row)} hover>
                  {columns.map((col) => (
                    <TableCell key={col.field}>
                      {col.render ? col.render(row) : col.field === 'status' ? (
                        <Chip
                          size="small"
                          label={row[col.field]}
                          color={String(row[col.field]).toLowerCase() === 'active' ? 'success' : 'default'}
                          variant="outlined"
                        />
                      ) : (row[col.field] ?? '—')}
                    </TableCell>
                  ))}
                  {hasActions && (
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        {onView && (
                          <IconButton size="small" onClick={() => onView(row)} aria-label="view">
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        )}
                        {showEdit && (
                          <IconButton size="small" onClick={() => onEdit(row)} aria-label="edit">
                            <EditIcon fontSize="small" />
                          </IconButton>
                        )}
                        {showDelete && (
                          <IconButton size="small" onClick={() => onDelete(row)} aria-label="delete" color="error">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Stack>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollableTableContainer>
      )}
      <TablePagination
        component="div"
        count={sortedRows.length}
        page={page}
        onPageChange={(_e, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        rowsPerPageOptions={rowsPerPageOptions}
        labelRowsPerPage={t('common.rowsPerPage')}
      />
    </Paper>
  );
}

// Memoized — table-heavy pages re-render often (tab switches, theme changes);
// avoid re-sorting/filtering unless rows/columns actually change.
export default memo(DataTable);
