import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, IconButton, Chip, Switch, Tooltip, Autocomplete, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Divider, LinearProgress,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/DescriptionOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import BusinessIcon from '@mui/icons-material/BusinessOutlined';
import EmptyState from '../../components/data-display/EmptyState';
import DoubleArrowIcon from '@mui/icons-material/DoubleArrow';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import RefreshIcon from '@mui/icons-material/Refresh';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableToolbar from '../../components/data-display/TableToolbar';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import {
  useListDocumentNumberingQuery,
  useGetDocumentNumberingCatalogQuery,
  useCreateDocumentNumberingMutation,
  useUpdateDocumentNumberingMutation,
  useDeleteDocumentNumberingMutation,
  useResetDocumentNumberingMutation,
  useRolloverDocumentNumberingMutation,
  useListSeriesForDocumentQuery,
  useSetDefaultDocumentSeriesMutation,
  useGetCompanyDetailsQuery,
} from '../../features/company/companyDetailsApi';
import { financialYearApi, branchApi } from '../../features/resources';
import DocumentNumberingForm, { normaliseSeriesValues } from './DocumentNumberingForm';
import ExistingSeriesTable from './ExistingSeriesTable';
import { formatFyLabel, currentNumberColor, maxValueForLength, buildDocumentNumber } from '../../lib/documentNumbering';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
const PAGE_SIZE = 25;

// Inline toggle for a series switch (Reset Every FY / Auto Generate / Manual
// Entry). These three are safe to flip directly from the list — unlike the
// prefix/pattern fields, the server never locks them once a series has issued
// numbers — so there's no reason to force a trip through the full Edit form
// just to change one setting.
//
// It still round-trips through the update endpoint rather than writing
// straight to the cache: the server enforces the one rule these fields can
// violate (Auto Generate and Manual Entry can't both end up off, or the
// series could never produce a number), and on a 409 the switch needs to
// snap back rather than show a state the server rejected.
function SeriesToggleCell({ on, label, onToggle, disabled }) {
  const [saving, setSaving] = useState(false);

  const handleChange = async (e) => {
    const next = e.target.checked;
    setSaving(true);
    try {
      await onToggle(next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Tooltip title={`${label}: ${on ? 'Yes' : 'No'}${disabled ? '' : ' — click to toggle'}`} arrow>
      <span>
        <Switch
          checked={!!on}
          onChange={handleChange}
          color="success"
          size="small"
          disabled={disabled || saving}
          inputProps={{ 'aria-label': label }}
        />
      </span>
    </Tooltip>
  );
}

/** Detail dialog behind the eye icon — everything the table can't fit. */
function SeriesDetailDialog({ row, onClose }) {
  if (!row) return null;
  const used = row.currentNumber ? row.currentNumber - row.startNumber + 1 : 0;
  const total = row.endNumber - row.startNumber + 1;
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;

  const fields = [
    ['Document', `${row.documentName} (${row.documentCode})`],
    ['Series Name', `${row.seriesName || '—'}${row.isDefault ? '  (Default)' : ''}`],
    ['Financial Year', row.financialYear ? formatFyLabel(row.financialYear) : '—'],
    // Was hand-assembled here with its own copy of the prefix/FY/number/
    // suffix join logic, which had drifted from buildDocumentNumber's actual
    // layout (it put the Separator between the FY code and the number too,
    // e.g. 'KEM-26-27-000000' instead of 'KEM-2627000000') — reusing the one
    // real formatter means this can never disagree with the Preview field or
    // the numbers the series actually issues again.
    ['Pattern', buildDocumentNumber(row, 0)],
    ['Range', `${row.startNumber} – ${row.endNumber}`],
    ['Last issued', row.currentNumberFormatted || 'Nothing issued yet'],
    ['Next number', row.nextNumberFormatted || 'Series exhausted'],
    ['Numbers remaining', row.remaining?.toLocaleString?.() ?? '—'],
    ['Last issued at', row.lastNumberAt ? new Date(row.lastNumberAt).toLocaleString('en-GB') : '—'],
    ['Reset Every FY', row.resetEveryFy ? 'Yes' : 'No'],
    ['Auto Generate', row.autoGenerate ? 'Yes' : 'No'],
    ['Manual Entry', row.manualEntry ? 'Yes' : 'No'],
    // The stored value is only ever Active/Inactive; 'Completed' is derived
    // from the counter, so show both to make the distinction obvious.
    ['Status', row.displayStatus === 'Completed' ? 'Completed (range used up)' : row.displayStatus || row.status],
  ];

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {row.documentName}
        <Typography variant="body2" color="text.secondary">Numbering series detail</Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ mb: 2.5 }}>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
            <Typography variant="caption" color="text.secondary">Series consumption</Typography>
            <Typography variant="caption" fontWeight={700}>{used.toLocaleString()} of {total.toLocaleString()}</Typography>
          </Stack>
          <LinearProgress variant="determinate" value={pct} color={pct > 90 ? 'error' : pct > 70 ? 'warning' : 'success'} sx={{ height: 8, borderRadius: 4 }} />
        </Box>
        <Divider sx={{ mb: 2 }} />
        <Stack spacing={1.25}>
          {fields.map(([label, value]) => (
            <Stack key={label} direction="row" justifyContent="space-between" spacing={2}>
              <Typography variant="body2" color="text.secondary">{label}</Typography>
              <Typography variant="body2" fontWeight={600} sx={{ textAlign: 'right', fontFamily: label === 'Pattern' ? 'monospace' : undefined }}>
                {value}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Document Numbering Series — SAP Business One-style.
 *
 * Series are scoped per financial year, so the FY selector at the top is a
 * real filter on the data, not a cosmetic one: switching years shows a
 * different set of counters. Company is a singleton in this app, and Branch is
 * shown for parity with the rest of Company Setup but does not partition
 * series — numbering is company-wide within a year.
 */
const DOC_NUMBERING_LIST_TABLE_ROW_HEIGHT = 0;
const DOC_NUMBERING_LIST_TABLE_CELL_PADDING_Y = 6;
export default function DocumentNumbering() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();

  const { data: company } = useGetCompanyDetailsQuery();
  const { data: financialYears } = financialYearApi.useList();
  const { data: branches } = branchApi.useList();

  const [financialYearId, setFinancialYearId] = useState(null);
  const [branchId, setBranchId] = useState('');
  const [view, setView] = useState('list'); // 'list' | 'form'
  const [editingRow, setEditingRow] = useState(null);
  const [detailRow, setDetailRow] = useState(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  // Which document type the open form currently has selected — drives the
  // "Existing Series for ..." table below the form.
  const [formDocumentCode, setFormDocumentCode] = useState('');
  // Set only by the double-click shortcut (openAddForDocument) — the exact
  // row that was double-clicked, so Prefix/Separator/No. of Length can be
  // seeded straight from it instead of from the suggestion endpoint's
  // "template" pick (the document's default series, or its last one), which
  // may be a *different* series than the one actually clicked when a
  // document type has more than one.
  const [templateRow, setTemplateRow] = useState(null);

  // Default the FY selector to the year that's actually open, falling back to
  // the most recent one, so the page lands on the series in use today.
  useEffect(() => {
    if (financialYearId || !financialYears?.length) return;
    const today = new Date();
    const current = financialYears.find(
      (f) => f.status === 'Active' && f.startDate && f.endDate && new Date(f.startDate) <= today && new Date(f.endDate) >= today
    );
    const active = financialYears.find((f) => f.status === 'Active');
    setFinancialYearId((current || active || financialYears[0]).id);
  }, [financialYears, financialYearId]);

  const { data: rows, isLoading, isFetching, refetch: refetchList } = useListDocumentNumberingQuery(
    financialYearId ? { financialYearId } : {},
    { skip: !financialYearId }
  );
  const { data: catalog, refetch: refetchCatalog } = useGetDocumentNumberingCatalogQuery(
    financialYearId ? { financialYearId } : {},
    { skip: !financialYearId }
  );

  // Manual refresh next to the search box — a plain re-render won't show a
  // value someone else just changed (or that a mutation elsewhere hasn't
  // invalidated), so this re-fetches the list and catalog counts on demand.
  const handleRefreshList = () => {
    refetchList();
    refetchCatalog();
  };

  // Series for the document type selected in the open form. Skipped entirely
  // while the form is closed or no document type has been picked yet.
  const {
    data: docSeries,
    isLoading: docSeriesLoading,
    isFetching: docSeriesFetching,
    refetch: refetchDocSeries,
  } = useListSeriesForDocumentQuery(
    { documentCode: formDocumentCode, financialYearId },
    { skip: view !== 'form' || !formDocumentCode || !financialYearId }
  );

  // The suggestion the Add form pre-fills from. Normally this is exactly
  // what the server returned (its own pick of a "template" series — the
  // document's default, or its last one). But when the form was opened via
  // double-click on a specific row (templateRow set), Prefix/Separator/No.
  // of Length are recomputed from *that* row instead — the server has no way
  // to know which row was clicked, so its template pick can be a different
  // series than the one the user actually double-clicked, which looked like
  // "the prefix isn't fetched properly". Start No. still continues from the
  // true highest End No. across every series for the document, same as ever.
  const effectiveSuggestion = useMemo(() => {
    if (!templateRow || !docSeries) return docSeries?.suggestion;
    const rows = docSeries.series || [];
    const highestEnd = rows.reduce((max, r) => Math.max(max, r.endNumber), 0);
    const startNumber = highestEnd + 1;
    const rangeSize = Math.max(1, templateRow.endNumber - templateRow.startNumber + 1);
    let endNumber = startNumber + rangeSize - 1;
    let numberLength = templateRow.numberLength;
    const neededLength = String(endNumber).length;
    if (neededLength > numberLength) numberLength = neededLength;
    endNumber = Math.min(endNumber, maxValueForLength(numberLength));
    return {
      seriesName: docSeries.suggestion?.seriesName,
      startNumber,
      endNumber,
      prefix: templateRow.prefix,
      separator: templateRow.separator,
      numberLength,
      includeFyInNumber: templateRow.includeFyInNumber,
      isDefault: docSeries.suggestion?.isDefault ?? false,
    };
  }, [templateRow, docSeries]);

  const [create, { isLoading: creating }] = useCreateDocumentNumberingMutation();
  const [update, { isLoading: updating }] = useUpdateDocumentNumberingMutation();
  const [remove] = useDeleteDocumentNumberingMutation();
  const [reset, { isLoading: resetting }] = useResetDocumentNumberingMutation();
  const [rollover, { isLoading: rollingOver }] = useRolloverDocumentNumberingMutation();
  const [setDefault] = useSetDefaultDocumentSeriesMutation();

  const columns = useMemo(() => ([
    { field: 'documentName', headerName: 'Document Name', filter: 'text' },
    { field: 'seriesName', headerName: 'Series Name', filter: 'text' },
    { field: 'prefix', headerName: 'Prefix', filter: 'text' },
    { field: 'displayStatus', headerName: 'Status', filter: 'select', filterOptions: ['Active', 'Inactive', 'Completed'] },
  ]), []);

  const table = useTableFeatures(rows || [], columns, { onChange: setPage });
  const list = table.rows;
  const pagedRows = useMemo(() => list.slice(page * pageSize, page * pageSize + pageSize), [list, page, pageSize]);

  const selectedFy = useMemo(
    () => (financialYears || []).find((f) => f.id === financialYearId) || null,
    [financialYears, financialYearId]
  );

  const openCreate = () => {
    setEditingRow(null);
    setFormDocumentCode('');
    setTemplateRow(null);
    setView('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const openEdit = (row) => {
    setEditingRow(row);
    setFormDocumentCode(row.documentCode || '');
    setTemplateRow(null);
    setView('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  // Double-clicking a row is a shortcut to the *next* series for that same
  // document type, not an edit of the row itself — the Start No. should
  // continue from the last series' End No. (via the suggestion), not repeat
  // the clicked row's own Start No. Pre-selecting the document type here
  // means the suggestion loads immediately instead of waiting for the user
  // to pick it again from the dropdown. Prefix/Separator/No. of Length come
  // straight from the clicked row itself (via templateRow) rather than the
  // suggestion's own "template" pick, which is only the document's default
  // or last series — not necessarily this one — and would otherwise silently
  // swap in a different series' pattern.
  const openAddForDocument = (row) => {
    setEditingRow(null);
    setFormDocumentCode(row.documentCode || '');
    setTemplateRow(row);
    setView('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const closeForm = () => { setView('list'); setEditingRow(null); setFormDocumentCode(''); setTemplateRow(null); };

  const handleSubmit = async (values, formMethods) => {
    const payload = normaliseSeriesValues(values);
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success(`Series "${payload.seriesName}" updated`);
      } else {
        await create(payload).unwrap();
        notify.success(`Series "${payload.seriesName}" created`);
      }
      closeForm();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
      // Re-thrown so DocumentNumberingForm's submit wrapper can also read
      // err.data.errors and show each message under its own field — the
      // toast above stays as the single-glance summary.
      throw err;
    }
  };

  // Promote a series to be the one its document type numbers from. Goes
  // through a dedicated endpoint because the incumbent has to be demoted in
  // the same transaction — a partial unique index allows only one default.
  const handleSetDefault = async (row) => {
    try {
      await setDefault(row.id).unwrap();
      notify.success(`"${row.seriesName}" is now the default ${row.documentName} series`);
    } catch (err) {
      notify.error(err?.data?.message || 'Could not set default series');
    }
  };

  // Fires from the inline switches in the table. Sends only the changed
  // field(s) — the PUT route merges them onto the existing row — so toggling
  // Auto Generate can't accidentally clobber a Prefix someone else just saved.
  //
  // `exclusiveField` is set for Auto Generate/Manual Entry: the two always
  // sit on opposite settings (same rule enforced in the Add/Edit form), so
  // flipping one from the table sends the other's opposite value in the same
  // request instead of leaving it for a second click.
  const handleToggleField = async (row, field, value, exclusiveField) => {
    try {
      const payload = { id: row.id, [field]: value };
      if (exclusiveField) payload[exclusiveField] = !value;
      await update(payload).unwrap();
      notify.success(`"${row.seriesName}" updated`);
    } catch (err) {
      notify.error(err?.data?.message || 'Update failed');
      throw err; // let the switch know the change didn't stick
    }
  };

  const handleDelete = async (row) => {
    // The server refuses outright once a number has been issued; say so here
    // rather than making the user click through a confirm to reach a 409.
    if (row.isConsumed) {
      notify.error(`"${row.seriesName}" has already issued ${row.currentNumberFormatted}. Set it Inactive instead of deleting it.`);
      return;
    }
    const ok = await confirmDialog({
      title: 'Delete numbering series',
      message: row.isDefault
        ? `Delete "${row.seriesName}", the default ${row.documentName} series for ${selectedFy?.financialYearName || 'this year'}? If another active series exists it becomes the default; otherwise new ${row.documentName} documents will be blocked until one is configured.`
        : `Delete the ${row.documentName} series "${row.seriesName}" for ${selectedFy?.financialYearName || 'this year'}?`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Numbering series deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleReset = async () => {
    const ok = await confirmDialog({
      title: 'Reset to default',
      message: `This rebuilds the standard series set for ${selectedFy?.financialYearName || 'the selected year'} using the default prefixes, a 6-digit sequence and a 1–999999 range. Series that have already issued numbers are left untouched. Continue?`,
      confirmLabel: 'Reset',
      severity: 'warning',
    });
    if (!ok) return;
    try {
      const result = await reset({ financialYearId }).unwrap();
      notify.success(`Reset complete — ${result.length} series configured`);
    } catch (err) {
      notify.error(err?.data?.message || 'Reset failed');
    }
  };

  // Carry the current year's setup into another year. Series with Reset Every
  // FY restart at their Start No.; the rest continue from where they stopped.
  const handleRollover = async () => {
    const candidates = (financialYears || []).filter((f) => f.id !== financialYearId);
    if (!candidates.length) {
      notify.error('Create the next financial year under Company Setup → Financial Year first');
      return;
    }
    const target = candidates.reduce((a, b) => (new Date(b.startDate || 0) > new Date(a.startDate || 0) ? b : a));
    const ok = await confirmDialog({
      title: 'Carry series to next year',
      message: `Copy the ${selectedFy?.financialYearName || 'current'} series into ${target.financialYearName}? Series set to Reset Every FY will start again at their Start No.; the others continue from their current number. Series that already exist in ${target.financialYearName} are left alone.`,
      confirmLabel: 'Carry forward',
    });
    if (!ok) return;
    try {
      const created = await rollover({ targetFinancialYearId: target.id, sourceFinancialYearId: financialYearId }).unwrap();
      notify.success(`${created.length} series created for ${target.financialYearName}`);
    } catch (err) {
      notify.error(err?.data?.message || 'Rollover failed');
    }
  };

  const fyOptions = useMemo(() => (financialYears || []).map((f) => ({ label: formatFyLabel(f), value: f.id })), [financialYears]);
  const branchOptions = useMemo(
    () => [{ label: 'All Branches', value: '' }, ...(branches || []).map((b) => ({ label: b.branchName, value: b.id }))],
    [branches]
  );

  // -------------------------------------------------------------------------
  // Form view
  // -------------------------------------------------------------------------
  if (view === 'form') {
    const selectedDoc = (catalog?.documents || []).find((d) => d.code === formDocumentCode);
    const docLabel = selectedDoc ? `${selectedDoc.name} (${selectedDoc.code})` : formDocumentCode;

    return (
      <Box>
        <DocumentNumberingForm
          editingRow={editingRow}
          initialDocumentCode={formDocumentCode}
          // Double-click pre-picks the document type as a shortcut to "add
          // the next series for this document" — leaving it editable would
          // let the user swap documents while the Start No./Prefix are still
          // seeded from the row they double-clicked on a different one.
          documentCodeLocked={Boolean(templateRow)}
          catalog={catalog}
          financialYears={financialYears}
          defaultFinancialYearId={financialYearId}
          onSubmit={handleSubmit}
          onCancel={closeForm}
          saving={creating || updating}
          onDocumentCodeChange={setFormDocumentCode}
          suggestion={effectiveSuggestion}
          // The exact document the suggestion above was fetched for — lets
          // the form tell a fresh suggestion apart from one still loading
          // for a document the user just switched away from.
          suggestionDocumentCode={formDocumentCode}
          // Matching document codes alone isn't enough to trust `suggestion`
          // — RTK Query can render once with the new args (so the code above
          // already matches) while still returning the *previous* document's
          // cached data for one render before the new fetch resolves. Only
          // apply once both flags go false.
          suggestionLoading={docSeriesLoading || docSeriesFetching}
          availableNumberLengths={docSeries?.availableNumberLengths}
          existingSeriesPanel={(
            <ExistingSeriesTable
              documentCode={formDocumentCode}
              documentLabel={docLabel}
              financialYear={selectedFy}
              series={docSeries?.series}
              isLoading={docSeriesLoading}
              isFetching={docSeriesFetching}
              editingId={editingRow?.id ?? null}
              onRefresh={refetchDocSeries}
              onView={setDetailRow}
              // Switching which series the form is editing swaps the row
              // rather than opening a second form, so you can hop between a
              // document type's series without leaving the page.
              onEdit={openEdit}
              onDelete={handleDelete}
              onSetDefault={handleSetDefault}
            />
          )}
        />
        <SeriesDetailDialog row={detailRow} onClose={() => setDetailRow(null)} />
      </Box>
    );
  }

  // -------------------------------------------------------------------------
  // List view
  // -------------------------------------------------------------------------
  return (
    <Box>
      <EntityHeaderCard
        icon={<DescriptionIcon />}
        title="Document Numbering"
        subtitle="Define the numbering series used to number every business document."
      />

      {/* Scope bar. Financial Year genuinely filters the data — series are
          per-year. Company is the singleton profile and Branch is display-only. */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2.5 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Autocomplete
              sx={{ flex: 1 }}
              size="small"
              disabled
              options={[]}
              value={{ label: company?.companyName || 'Company', value: 0 }}
              getOptionLabel={(o) => o.label || ''}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Company *"
                  InputProps={{ ...params.InputProps, startAdornment: <BusinessIcon sx={{ fontSize: 18, mr: 0.5, color: 'text.disabled' }} /> }}
                />
              )}
            />
            <Autocomplete
              sx={{ flex: 1 }}
              size="small"
              disableClearable
              options={fyOptions}
              value={fyOptions.find((o) => o.value === financialYearId) || null}
              isOptionEqualToValue={(o, v) => o.value === v.value}
              getOptionLabel={(o) => o.label || ''}
              onChange={(_e, v) => { setFinancialYearId(v?.value ?? null); setPage(0); }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Financial Year *"
                  InputProps={{ ...params.InputProps, startAdornment: <CalendarMonthIcon sx={{ fontSize: 18, mr: 0.5, color: 'primary.main' }} /> }}
                />
              )}
            />
            <Autocomplete
              sx={{ flex: 1 }}
              size="small"
              options={branchOptions}
              value={branchOptions.find((o) => o.value === branchId) || branchOptions[0]}
              isOptionEqualToValue={(o, v) => o.value === v.value}
              getOptionLabel={(o) => o.label || ''}
              onChange={(_e, v) => setBranchId(v?.value ?? '')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Branch"
                  helperText="Numbering is company-wide within a financial year"
                  FormHelperTextProps={{ sx: { mx: 0 } }}
                  InputProps={{ ...params.InputProps, startAdornment: <BusinessIcon sx={{ fontSize: 18, mr: 0.5, color: 'text.disabled' }} /> }}
                />
              )}
            />
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <TableToolbar
            title="Document Numbering Series"
            searchPlaceholder="Search document name or prefix..."
            table={table}
            resultCount={list.length}
            totalCount={table.totalCount}
            rightContent={
              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
                <Tooltip title="Refresh the table — pulls the latest values instead of waiting for the next change" arrow>
                  <span>
                    <IconButton
                      onClick={handleRefreshList}
                      disabled={!financialYearId || isFetching}
                      aria-label="refresh"
                    >
                      <RefreshIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Button variant="outlined" startIcon={<DoubleArrowIcon />} onClick={handleRollover} disabled={rollingOver || !financialYearId}>
                  Carry to Next FY
                </Button>
                <Button variant="outlined" startIcon={<RestartAltIcon />} onClick={handleReset} disabled={resetting || !financialYearId}>
                  Reset to Default
                </Button>
                <CanAdd>
                  <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} disabled={!financialYearId}>
                    Add New Series
                  </Button>
                </CanAdd>
              </Stack>
            }
          />
          <TableFilterPanel table={table} />

          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {!isLoading && pagedRows.map((row) => (
                <MobileRecordCard
                  key={row.id}
                  title={`${row.documentName} — ${row.seriesName}${row.isDefault ? ' (Default)' : ''}`}
                  statusChip={(
                    <Chip
                      size="small"
                      variant="outlined"
                      label={row.displayStatus}
                      color={row.displayStatus === 'Active' ? 'success' : row.displayStatus === 'Completed' ? 'default' : 'error'}
                    />
                  )}
                  fields={[
                    { label: 'Prefix', value: row.prefix || '—' },
                    { label: 'Current No.', value: row.currentNumberFormatted || '—' },
                    { label: 'Next No.', value: row.nextNumberFormatted || 'Exhausted' },
                    { label: 'Range', value: `${row.startNumber} – ${row.endNumber}` },
                    { label: 'Reset Every FY', value: row.resetEveryFy ? 'Yes' : 'No' },
                    { label: 'Auto Generate', value: row.autoGenerate ? 'Yes' : 'No' },
                    { label: 'Manual Entry', value: row.manualEntry ? 'Yes' : 'No' },
                  ]}
                  onView={() => setDetailRow(row)}
                  onEdit={() => openEdit(row)}
                  onDelete={() => handleDelete(row)}
                />
              ))}
              {!isLoading && list.length === 0 && (
                <EmptyState
                  icon={<DescriptionIcon sx={{ fontSize: 48 }} />}
                  title={table.isFiltering ? 'No matches' : 'No numbering series yet'}
                  message={table.isFiltering ? 'Try adjusting your search or filters' : 'No numbering series configured for this year'}
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
                    height: DOC_NUMBERING_LIST_TABLE_ROW_HEIGHT,
                    paddingTop: `${DOC_NUMBERING_LIST_TABLE_CELL_PADDING_Y}px`,
                    paddingBottom: `${DOC_NUMBERING_LIST_TABLE_CELL_PADDING_Y}px`,
                    boxSizing: 'border-box',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell width={56}>S.No</TableCell>
                    <SortableHeaderCell field="documentName" sort={table.sort} onSort={table.toggleSort}>Document Name</SortableHeaderCell>
                    <SortableHeaderCell field="seriesName" sort={table.sort} onSort={table.toggleSort}>Series Name</SortableHeaderCell>
                    <SortableHeaderCell field="prefix" sort={table.sort} onSort={table.toggleSort}>Prefix</SortableHeaderCell>
                    <TableCell align="right">Start No</TableCell>
                    <TableCell align="right">Current No</TableCell>
                    <TableCell align="right">Next No</TableCell>
                    <TableCell align="right">End No</TableCell>
                    <TableCell>Suffix</TableCell>
                    <TableCell align="center">Reset Every FY</TableCell>
                    <TableCell align="center">Auto Generate</TableCell>
                    <TableCell align="center">Manual Entry</TableCell>
                    <TableCell>Preview</TableCell>
                    <SortableHeaderCell field="displayStatus" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => {
                    const pad = (n) => String(n).padStart(row.numberLength, '0');
                    return (
                      <TableRow
                        key={row.id}
                        hover
                        onDoubleClick={() => openAddForDocument(row)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>{page * pageSize + i + 1}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.documentName}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Stack direction="row" alignItems="center" spacing={0.75}>
                            <span>{row.seriesName}</span>
                            {row.isDefault && (
                              <Tooltip title="Default series — new documents are numbered from this one" arrow>
                                <Chip size="small" label="Default" color="primary" variant="outlined" sx={{ height: 20 }} />
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{row.prefix || '—'}</TableCell>
                        <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{pad(row.startNumber)}</TableCell>
                        <TableCell
                          align="right"
                          sx={{ fontFamily: 'monospace', fontWeight: 700, color: currentNumberColor(row) }}
                        >
                          {row.currentNumber === null || row.currentNumber === undefined ? '—' : pad(row.currentNumber)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                          {row.isExhausted
                            ? <Chip size="small" label="Exhausted" color="error" variant="outlined" />
                            : pad(row.nextNumber)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{pad(row.endNumber)}</TableCell>
                        <TableCell>{row.suffix || '-'}</TableCell>
                        <TableCell align="center">
                          <SeriesToggleCell on={row.resetEveryFy} label="Reset Every FY" onToggle={(v) => handleToggleField(row, 'resetEveryFy', v)} />
                        </TableCell>
                        <TableCell align="center">
                          <SeriesToggleCell on={row.autoGenerate} label="Auto Generate" onToggle={(v) => handleToggleField(row, 'autoGenerate', v, 'manualEntry')} />
                        </TableCell>
                        <TableCell align="center">
                          <SeriesToggleCell on={row.manualEntry} label="Manual Entry" onToggle={(v) => handleToggleField(row, 'manualEntry', v, 'autoGenerate')} />
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', fontFamily: 'monospace', color: 'primary.main', fontWeight: 600 }}>
                          {row.nextNumberFormatted || row.preview}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            variant="outlined"
                            label={row.displayStatus}
                            color={row.displayStatus === 'Active' ? 'success' : row.displayStatus === 'Completed' ? 'default' : 'error'}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.25} justifyContent="flex-end">
                            <IconButton size="small" color="info" onClick={() => setDetailRow(row)} aria-label="view">
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                            {!row.isDefault && row.displayStatus === 'Active' && (
                              <Tooltip title="Set as the default series" arrow>
                                <IconButton size="small" color="warning" onClick={() => handleSetDefault(row)} aria-label="set default">
                                  <StarBorderIcon fontSize="small" />
                                </IconButton>
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
                                    onClick={() => openEdit(row)}
                                    disabled={row.displayStatus === 'Completed'}
                                    aria-label="edit"
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </CanEdit>
                              </span>
                            </Tooltip>
                            <Tooltip title={row.isConsumed ? 'Already issued numbers — set Inactive instead' : 'Delete'} arrow>
                              <span>
                                <CanDelete>
                                  <IconButton size="small" color="error" onClick={() => handleDelete(row)} disabled={row.isConsumed} aria-label="delete">
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
                  {!isLoading && !isFetching && list.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={15} sx={{ border: 'none' }}>
                        <EmptyState
                          icon={<DescriptionIcon sx={{ fontSize: 48 }} />}
                          title={table.isFiltering ? 'No matches' : 'No numbering series yet'}
                          message={
                            table.isFiltering
                              ? 'Try adjusting your search or filters'
                              : `No numbering series configured for ${selectedFy?.financialYearName || 'this financial year'}`
                          }
                          action={!table.isFiltering && (
                            <Button variant="outlined" size="small" startIcon={<RestartAltIcon />} onClick={handleReset} disabled={resetting}>
                              Create the standard series set
                            </Button>
                          )}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollableTableContainer>
          )}

          <EntityListPagination total={list.length} page={page} onChange={setPage} pageSize={pageSize} onPageSizeChange={(v) => { setPageSize(v); setPage(0); }} />
        </CardContent>
      </Card>

      <SeriesDetailDialog row={detailRow} onClose={() => setDetailRow(null)} />
    </Box>
  );
}
