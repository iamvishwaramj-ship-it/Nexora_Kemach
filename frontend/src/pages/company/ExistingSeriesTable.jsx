import React from 'react';
import {
  Box, Typography, Button, Card, CardContent, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, IconButton, Chip, Tooltip, Skeleton,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import EmptyState from '../../components/data-display/EmptyState';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import { formatFyLabel, SEPARATORS, currentNumberColor } from '../../lib/documentNumbering';

import { CanEdit, CanDelete } from '../../components/common/PermissionGate';

// Row sizing/border for this table — see ProductInventoryTab.jsx for the
// same pattern: TABLE_ROW_HEIGHT is a floor, not a cap (MUI's own cell
// padding can still push a row taller); TABLE_CELL_PADDING_Y is what
// around every cell.
const TABLE_ROW_HEIGHT = 0;
const TABLE_CELL_PADDING_Y = 6;
const separatorLabel = (value) => SEPARATORS.find((s) => s.value === value)?.label?.split(' ')[0] ?? value ?? '-';

// 'Completed' is derived by the server the moment the counter passes End No.,
// so it never disagrees with the numbers in the row next to it.
const statusChipProps = (row) => {
  switch (row.displayStatus) {
    case 'Completed': return { label: 'Completed', color: 'default' };
    case 'Active': return { label: 'Active', color: 'success' };
    default: return { label: 'Inactive', color: 'error' };
  }
};

/**
 * "Existing Series for <Document> - FY <year>" — shown on the Add/Edit form
 * once a document type is chosen.
 *
 * A document type can hold several series in a year (one used up, one live,
 * one in reserve), and you cannot sensibly pick a Start No. for a new one
 * without seeing what the existing blocks already cover. Overlapping ranges
 * are rejected on save, so this table is what makes that rule predictable
 * rather than a surprise error.
 */
export default function ExistingSeriesTable({
  documentCode,
  documentLabel,
  financialYear,
  series,
  isLoading,
  isFetching,
  editingId,
  onRefresh,
  onView,
  onEdit,
  onDelete,
  onSetDefault,
}) {
  if (!documentCode) return null;

  const rows = series || [];
  const fyLabel = financialYear ? `FY ${formatFyLabel(financialYear)}` : '';

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent sx={{ p: 0 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          flexWrap="wrap"
          gap={1.5}
          sx={{ px: 3, pt: 2.5, pb: 1.5 }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              Existing Series for {documentLabel}{fyLabel ? ` - ${fyLabel}` : ''}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              A new series must not overlap any range below.
            </Typography>
          </Box>
          <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={onRefresh} disabled={isFetching}>
            Refresh
          </Button>
        </Stack>

        {isLoading ? (
          <Box sx={{ px: 3, pb: 2 }}>
            {[0, 1, 2].map((i) => <Skeleton key={i} height={40} />)}
          </Box>
        ) : (
          <ScrollableTableContainer maxHeight="clamp(160px, 34vh, 340px)">
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
                  <TableCell width={56}>S.No</TableCell>
                  <TableCell>Series Name</TableCell>
                  <TableCell>Prefix</TableCell>
                  <TableCell align="center">Separator</TableCell>
                  <TableCell align="right">Start No.</TableCell>
                  <TableCell align="right">End No.</TableCell>
                  <TableCell align="right">Current No.</TableCell>
                  <TableCell align="center">No. of Length</TableCell>
                  <TableCell>Preview</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, i) => {
                  const pad = (n) => String(n).padStart(row.numberLength, '0');
                  // The row being edited is highlighted rather than hidden, so
                  // its range stays visible while you adjust the one above it.
                  const isEditing = editingId === row.id;
                  const chip = statusChipProps(row);

                  return (
                    <TableRow
                      key={row.id}
                      hover
                      selected={isEditing}
                      onDoubleClick={() => { if (row.displayStatus !== 'Completed') onEdit?.(row); }}
                      sx={{
                        cursor: 'pointer',
                        ...(row.isDefault ? { '& td': { bgcolor: 'success.50' } } : {}),
                      }}
                    >
                      <TableCell>{i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Stack direction="row" alignItems="center" spacing={0.75}>
                          <Typography variant="body2" fontWeight={isEditing ? 700 : 500}>
                            {row.seriesName}
                          </Typography>
                          {row.isDefault && (
                            <Tooltip title="Default series — new documents are numbered from this one" arrow>
                              <Chip size="small" label="Default" color="primary" variant="outlined" sx={{ height: 20 }} />
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{row.prefix || '—'}</TableCell>
                      <TableCell align="center">{separatorLabel(row.separator)}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{pad(row.startNumber)}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{pad(row.endNumber)}</TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontFamily: 'monospace', fontWeight: 700, color: currentNumberColor(row) }}
                      >
                        {row.currentNumber === null || row.currentNumber === undefined ? '—' : pad(row.currentNumber)}
                      </TableCell>
                      <TableCell align="center">{row.numberLength}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontFamily: 'monospace', color: 'primary.main', fontWeight: 600 }}>
                        {row.nextNumberFormatted || row.preview}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" variant="outlined" {...chip} />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.25} justifyContent="flex-end">
                          <IconButton size="small" color="info" onClick={() => onView?.(row)} aria-label="view">
                            <VisibilityIcon fontSize="small" />
                          </IconButton>

                          {/* Only a live series with room left can take over
                              allocation, so the star is hidden otherwise
                              rather than offered and then rejected. */}
                          {!row.isDefault && row.displayStatus === 'Active' && (
                            <Tooltip title="Set as the default series" arrow>
                              <IconButton size="small" color="warning" onClick={() => onSetDefault?.(row)} aria-label="set default">
                                <StarBorderIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {row.isDefault && (
                            <Tooltip title="This is the default series" arrow>
                              <span>
                                <IconButton size="small" color="warning" disabled aria-label="is default">
                                  <StarIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}

                          {/* A Completed series has run past its End No. — there is
                              nothing left to configure that isn't better done by
                              retiring it or starting a new block, so Edit is
                              disabled rather than opening a form with nowhere
                              useful to go. */}
                          <Tooltip title={row.displayStatus === 'Completed' ? 'Completed — extend a new series instead' : 'Edit'} arrow>
                            <span>
                              <CanEdit>
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => onEdit?.(row)}
                                  disabled={row.displayStatus === 'Completed'}
                                  aria-label="edit"
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </CanEdit>
                            </span>
                          </Tooltip>

                          <Tooltip title={row.isConsumed ? 'Has issued numbers — set Inactive instead' : 'Delete'} arrow>
                            <span>
                              <CanDelete>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => onDelete?.(row)}
                                  disabled={row.isConsumed}
                                  aria-label="delete"
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </CanDelete>
                            </span>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} sx={{ border: 'none' }}>
                      <EmptyState
                        icon={<DescriptionOutlinedIcon sx={{ fontSize: 48 }} />}
                        title="No series yet"
                        message={`No series yet for ${documentLabel} in this financial year — this will be the first.`}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollableTableContainer>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 3, py: 1.5 }}>
          Showing {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
        </Typography>
      </CardContent>
    </Card>
  );
}
