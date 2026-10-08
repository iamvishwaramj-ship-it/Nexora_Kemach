import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { makeScopedPrint } from '../../components/print/purchaseStationery';
import { useIsActiveTab } from '../../components/navigation/TabPathContext';

const PRINTING_CLASS = 'barcode-printing';
const PAGE_RULE_ID = 'barcode-print-page-rule';
const printBarcode = makeScopedPrint({ printingClass: PRINTING_CLASS, pageRuleId: PAGE_RULE_ID });
import {
  Box, Typography, Button, Card, CardContent, Stack, TextField, Table, TableBody, TableCell,
  TableHead, TableRow, Chip, IconButton, Menu, MenuItem,
  Checkbox, SvgIcon, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import { FormGrid } from '../../components/form/AppForm';
import BarcodeSvg from '../../components/common/BarcodeSvg';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import useDragScroll from '../../components/data-display/useDragScroll';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { productApi } from '../../features/resources';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

import { CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';
// No stock MUI icon renders as a barcode glyph — a small custom one keeps
// the header consistent with every other page's circular icon treatment.
function BarcodeGlyphIcon(props) {
  const bars = [2, 1, 2, 1, 1, 2, 1, 3, 1, 2, 1, 1, 2];
  let x = 3;
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      {bars.map((w, i) => {
        const rect = <rect key={i} x={x} y={4} width={w * 0.6} height={16} fill="currentColor" />;
        x += w * 0.6 + 0.7;
        return rect;
      })}
    </SvgIcon>
  );
}

const PAGE_SIZE = 10;

const BARCODE_LIST_TABLE_ROW_HEIGHT = 0;
const BARCODE_LIST_TABLE_CELL_PADDING_Y = 6;
export default function Barcode() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const isActive = useIsActiveTab();
  const { data: products, isLoading } = productApi.useList();
  const [update] = productApi.useUpdate();

  useEffect(() => {
    if (!isActive) return;
    const onBefore = () => document.body.classList.add(PRINTING_CLASS);
    const onAfter = () => document.body.classList.remove(PRINTING_CLASS);
    window.addEventListener('beforeprint', onBefore);
    window.addEventListener('afterprint', onAfter);
    return () => {
      window.removeEventListener('beforeprint', onBefore);
      window.removeEventListener('afterprint', onAfter);
      document.body.classList.remove(PRINTING_CLASS);
    };
  }, [isActive]);

  const [search, setSearch] = useState('');
  const [genMenuAnchor, setGenMenuAnchor] = useState(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [checkedCodes, setCheckedCodes] = useState([]);
  const [editingRow, setEditingRow] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [busy, setBusy] = useState(false);

  const rows = products || [];

  const baseTableRows = useMemo(() => {
    const q = '';
    return rows.filter((r) => {
      const matchesSearch = !q || [r.productCode, r.productName].some((v) => String(v || '').toLowerCase().includes(q));
      return matchesSearch;
    });
  }, [rows]);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'productCode', headerName: 'Item No', filter: 'text' },
    { field: 'productName', headerName: 'Description', filter: 'text' },
    { field: 'barcode', headerName: 'Barcode (Item No)', filter: 'text' },
    { field: 'status', headerName: 'Status', filter: 'select' },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const filteredRows = table.rows;

  const pagedRows = useMemo(
    () => filteredRows.slice(page * pageSize, page * pageSize + pageSize),
    [filteredRows, page, pageSize]
  );

  const allChecked = pagedRows.length > 0 && pagedRows.every((r) => checkedCodes.includes(r.productCode));
  const someChecked = pagedRows.some((r) => checkedCodes.includes(r.productCode)) && !allChecked;

  const toggleRowChecked = (code) => {
    setCheckedCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const closeEditor = () => {
    setEditingRow(null);
    setEditValue('');
  };

  const handleEdit = (row) => {
    setEditingRow(row);
    setEditValue(row.barcode || row.productCode || '');
  };

  const handleSaveBarcode = async () => {
    if (!editingRow) return;
    setBusy(true);
    try {
      await update({ id: editingRow.id, barcode: editValue.trim() }).unwrap();
      notify.success('Barcode saved');
      closeEditor();
    } catch (err) {
      notify.error(err?.data?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (row) => {
    const ok = await confirmDialog({
      title: 'Remove barcode',
      message: `Remove the barcode for "${row.productName}"? The product record itself will not be deleted.`,
      confirmLabel: 'Remove',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await update({ id: row.id, barcode: null }).unwrap();
      notify.success('Barcode removed');
    } catch (err) {
      notify.error(err?.data?.message || 'Remove failed');
    }
  };

  const handleGenerate = async (mode) => {
    setGenMenuAnchor(null);
    const targets = mode === 'selected'
      ? rows.filter((r) => checkedCodes.includes(r.productCode) && !r.barcode)
      : rows.filter((r) => !r.barcode);
    if (targets.length === 0) {
      notify.info(mode === 'selected' ? 'Selected products already have barcodes' : 'Every product already has a barcode');
      return;
    }
    setBusy(true);
    try {
      await Promise.all(targets.map((r) => update({ id: r.id, barcode: r.productCode }).unwrap()));
      notify.success(`Generated ${targets.length} barcode${targets.length > 1 ? 's' : ''}`);
    } catch (err) {
      notify.error(err?.data?.message || 'Generate failed');
    } finally {
      setBusy(false);
    }
  };

  const printRows = useMemo(() => {
    const source = checkedCodes.length > 0 ? rows.filter((r) => checkedCodes.includes(r.productCode)) : filteredRows;
    return source.filter((r) => r.barcode);
  }, [rows, filteredRows, checkedCodes]);

  const handlePrint = () => {
    if (printRows.length === 0) {
      notify.info('No generated barcodes to print — generate barcodes first');
      return;
    }
    printBarcode();
  };

  return (
    <Box>
      {isActive && (
        <style>{`
          .barcode-print-area { display: none; }
          @media print {
            body.${PRINTING_CLASS} #root { display: none !important; }
            body.${PRINTING_CLASS} .barcode-print-area {
              display: block !important; width: 100%;
              padding: 16px; box-sizing: border-box;
            }
            body.${PRINTING_CLASS} .barcode-print-area,
            body.${PRINTING_CLASS} .barcode-print-area * {
              visibility: visible;
            }
          }
        `}</style>
      )}

      <EntityHeaderCard
        icon={<BarcodeGlyphIcon />}
        title="Barcode"
        subtitle="Generate and manage product barcodes."
        rightContent={<CompanyBadge />}
      />

      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Barcode List</Typography>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              <TableSearchFilter table={table} placeholder="Search by product code or name..." width={260} />
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                endIcon={<ArrowDropDownIcon />}
                onClick={(e) => setGenMenuAnchor(e.currentTarget)}
                disabled={busy}
              >
                Generate Barcode
              </Button>
              <Menu anchorEl={genMenuAnchor} open={!!genMenuAnchor} onClose={() => setGenMenuAnchor(null)}>
                <MenuItem onClick={() => handleGenerate('selected')} disabled={checkedCodes.length === 0}>
                  Generate for Selected ({checkedCodes.length})
                </MenuItem>
                <MenuItem onClick={() => handleGenerate('missing')}>
                  Generate for All Missing
                </MenuItem>
              </Menu>
              <Button variant="outlined" color="inherit" startIcon={<PrintOutlinedIcon />} onClick={handlePrint}>
                Print Barcodes
              </Button>
            </Stack>

            <TableFilterPanel table={table} />
          </Stack>

          {/* Edit Barcode lives in a popup, same shape as the other Product
              Setup pages' Add/Edit dialogs — see ProductGroup.jsx's own
              Dialog for the reference this was copied from. This page has
              no separate Add/View flow (barcodes are bulk-generated, not
              typed in one at a time), so only Edit gets the popup. */}
          <Dialog open={!!editingRow} onClose={closeEditor} maxWidth="sm" fullWidth>
            <DialogTitle
              component="div"
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, pr: 1 }}
            >
              <Typography variant="subtitle1" fontWeight={700}>
                Edit Barcode — {editingRow?.productName}
              </Typography>
              <IconButton onClick={closeEditor} size="small" aria-label="close">
                <CloseIcon fontSize="small" />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              {/* Label-left field layout — same LabeledField concept as
                  Product Master's add/edit form (see
                  components/form/LabeledField.jsx). */}
              <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                <LabeledField label="Barcode Value">
                  <TextField
                    size="small"
                    fullWidth
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                  />
                </LabeledField>
              </FormGrid>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button variant="contained" onClick={handleSaveBarcode} disabled={busy || !editValue.trim()}>Save</Button>
              <Button variant="text" color="inherit" onClick={closeEditor} disabled={busy}>Cancel</Button>
            </DialogActions>
          </Dialog>

          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {!isLoading && pagedRows.map((row) => (
                <MobileRecordCard
                  key={row.id}
                  title={row.productName}
                  statusChip={<Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />}
                  fields={[
                    { label: 'Item No', value: row.productCode },
                    { label: 'Barcode', value: row.barcode ? <BarcodeSvg value={row.barcode} height={32} /> : 'Not generated' },
                  ]}
                  onEdit={() => handleEdit(row)}
                  onDelete={() => handleDelete(row)}
                />
              ))}
              {!isLoading && filteredRows.length === 0 && (
                <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No products found" message="Add your first product to get started" />
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table
                size="small"
                stickyHeader
                sx={{
                  '& th, & td': {
                    height: BARCODE_LIST_TABLE_ROW_HEIGHT,
                    paddingTop: `${BARCODE_LIST_TABLE_CELL_PADDING_Y}px`,
                    paddingBottom: `${BARCODE_LIST_TABLE_CELL_PADDING_Y}px`,
                    boxSizing: 'border-box',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <SortableHeaderCell field="productCode" sort={table.sort} onSort={table.toggleSort} padding="checkbox">
                      <Checkbox
                        size="small"
                        indeterminate={someChecked}
                        checked={allChecked}
                        onChange={(e) => {
                          const codes = pagedRows.map((r) => r.productCode);
                          setCheckedCodes((prev) => e.target.checked
                            ? Array.from(new Set([...prev, ...codes]))
                            : prev.filter((c) => !codes.includes(c)));
                        }}
                      />
                    </SortableHeaderCell>
                    <TableCell width={48}>#</TableCell>
                    <TableCell>Item No</TableCell>
                    <SortableHeaderCell field="productName" sort={table.sort} onSort={table.toggleSort}>Description</SortableHeaderCell>
                    <SortableHeaderCell field="barcode" sort={table.sort} onSort={table.toggleSort}>Barcode (Item No)</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox size="small" checked={checkedCodes.includes(row.productCode)} onChange={() => toggleRowChecked(row.productCode)} />
                      </TableCell>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.productCode}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.productName}</TableCell>
                      <TableCell>
                        {row.barcode ? (
                          <BarcodeSvg value={row.barcode} height={34} />
                        ) : (
                          <Typography variant="body2" color="text.secondary">Not generated</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <CanEdit>
                            <IconButton size="small" color="primary" onClick={() => handleEdit(row)} aria-label="edit">
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </CanEdit>
                          <CanDelete>
                            <IconButton size="small" color="error" onClick={() => handleDelete(row)} aria-label="delete" disabled={!row.barcode}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </CanDelete>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && filteredRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No products found" message="Add your first product to get started" />
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

      {isActive && typeof document !== 'undefined' && createPortal(
        <Box className="barcode-print-area">
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Product Barcodes</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
            {printRows.map((row) => (
              <Box key={row.id} sx={{ border: '1px solid #ccc', borderRadius: 1, p: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>{row.productName}</Typography>
                <BarcodeSvg value={row.barcode} height={45} />
              </Box>
            ))}
          </Box>
        </Box>,
        document.body
      )}
    </Box>
  );
}
