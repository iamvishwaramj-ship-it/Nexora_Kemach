import React, { useMemo, useState } from 'react';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import {
  Box, Typography, Button, Card, CardContent, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Chip, IconButton, Collapse, Grid, TableContainer,
} from '@mui/material';
import { useFieldArray } from 'react-hook-form';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
import DocumentNoField from '../../components/form/DocumentNoField';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import ImportItemsDialog from '../../components/common/ImportItemsDialog';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { businessPartnerOpeningBalanceDocumentSchema } from '../../lib/validation/partnerSchemas';
import {
  businessPartnerApi, chartOfAccountApi,
} from '../../features/resources';
import {
  businessPartnerOpeningBalanceApi,
  useLazyGetBusinessPartnerOpeningBalanceDocumentQuery,
  useSaveBusinessPartnerOpeningBalanceBatchMutation,
  useUpdateBusinessPartnerOpeningBalanceDocumentMutation,
  useDeleteBusinessPartnerOpeningBalanceDocumentMutation,
} from '../../features/company/businessPartnerOpeningBalanceApi';
import useServerListTable from '../../components/data-display/useServerListTable';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import { CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';

const BP_TYPE_OPTIONS = [
  { label: 'Customer', value: 'Customer' },
  { label: 'Vendor', value: 'Vendor' },
];

const PAGE_SIZE = 10;

// How many lines' worth of fully-interactive Edit rows (BpCodeCell's MUI
// Autocomplete + two more RHF-wired inputs, each with its own watch()
// subscription) get mounted into the DOM at once while editing a document.
// Mounting every line of a real document (a seeded/imported one can run to
// hundreds or thousands) froze the tab and could crash it outright -- this
// is the same failure mode View mode already dodges by rendering plain text
// instead (see the comment on the Edit table body below), but Edit can't do
// that since the rows have to stay genuinely editable. Windowing which
// rows are actually mounted, while keeping the full line set in
// useFieldArray underneath (so Save still submits every line, on whichever
// page it's currently showing), fixes the freeze without changing what
// gets saved.
const EDIT_PAGE_SIZE = 50;

const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const currency = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// One blank BP line.
const emptyLine = {
  bpCode: '', bpName: '', invoiceNo: '', invoiceDate: null, dueDate: null, openingBalance: '',
};

// 'YYYY-MM-DD' (what the import endpoint returns) -> the UTC-midnight Date
// FormDatePicker stores, or null when blank/unreadable.
const toPickerDate = (v) => {
  if (!v) return null;
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
};

function getEmptyValues() {
  return {
    documentNumber: '', documentDate: null, openingBalanceAccount: '', openingBalanceAccountDescription: '',
    ref1: '', ref2: '', bpType: 'Customer', remarks: '', lines: [{ ...emptyLine }],
  };
}

// BP Code drives BP Name on the same row — picking a Business Partner
// auto-fills its name, and (per the spec: Accounts Receivable/Down Payment
// Clearing A/C are deliberately excluded from this form — both are resolved
// automatically from the partner's own Control Account at posting time, the
// same way every other AR/AP document works) nothing about which control
// account it posts to is ever picked here. Same "one select drives a
// read-only companion field" pattern as the Employee picker on
// UserManagement.jsx.
function BpCodeCell({ index, methods, options, sx }) {
  const { setValue, watch } = methods;
  const value = watch(`lines.${index}.bpCode`);
  const handleChange = (nextValue) => {
    const found = options.find((o) => o.value === nextValue);
    setValue(`lines.${index}.bpName`, found?.bpName || '', { shouldValidate: true });
  };
  return (
    <FormSelect
      name={`lines.${index}.bpCode`}
      label=""
      placeholder="Search BP code or name"
      options={options}
      onValueChange={handleChange}
      popupFitContent
      sx={sx}
    />
  );
}

export default function BPOpeningBalance() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();

  // `?view=list` (see GET /business-partners's own comment in resources.js)
  // -- this page only ever reads partnerCode/partnerName/partnerType off
  // each row (see bpOptions below) to build the BP Code dropdown, but a
  // plain useList() with no params gets EVERY business partner with the
  // full contacts/addresses/machineries include plus a per-row pre-signed
  // logo URL fetch, unbounded -- exactly the query the customer/supplier
  // legacy adapters genuinely need that data for elsewhere, but this page
  // was paying that same cost on every single mount for three fields it
  // was going to throw away. That's what made opening this page directly
  // slow: it was the single biggest thing blocking the first render, not
  // this page's own document list. `view: 'list'` gets the slim
  // partnerCode/partnerName/partnerType/groupName/mobile/status projection
  // instead, with neither the includes nor the per-row enrichment.
  const { data: businessPartners } = businessPartnerApi.useList({ view: 'list' });
  const { data: chartOfAccounts } = chartOfAccountApi.useList();

  const [saveBatch, { isLoading: saving }] = useSaveBusinessPartnerOpeningBalanceBatchMutation();
  const [updateDocument, { isLoading: updatingDoc }] = useUpdateBusinessPartnerOpeningBalanceDocumentMutation();
  const [deleteDocument] = useDeleteBusinessPartnerOpeningBalanceDocumentMutation();
  // View/Edit fetch a document's own lines on demand (see the comment on
  // this endpoint) rather than trusting whatever the list's current page
  // happens to hold.
  const [fetchDocumentLines] = useLazyGetBusinessPartnerOpeningBalanceDocumentQuery();
  const [openingDoc, setOpeningDoc] = useState(false);

  // Only real posting accounts (AccountNature 'A') belong on a header that
  // funds/receives an opening balance — same filter JournalEntry.jsx applies
  // to its own account picker; a Title account is a heading, never something
  // posted to directly.
  const accountOptions = useMemo(
    () => (chartOfAccounts || [])
      .filter((a) => a.accountNature === 'A' && a.status !== 'I')
      .map((a) => ({ label: `${a.accountName} (${a.accountCode})`, value: a.accountCode, accountName: a.accountName })),
    [chartOfAccounts]
  );
  const accountByCode = useMemo(
    () => new Map((chartOfAccounts || []).map((a) => [a.accountCode, a])),
    [chartOfAccounts]
  );
  const [showForm, setShowForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null); // { documentNumber, rows: [...] } or null
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [linesImportOpen, setLinesImportOpen] = useState(false);

  // Columns describe the RAW lines GET /business-partner-opening-balance
  // returns (one row per BP line, page-at-a-time — see that route's own
  // comment), not the grouped-by-document rows built below. Only `status`
  // is marked `server: true`: its filter/sort both round-trip to the where
  // clause the backend actually understands (see resources.js). documentDate
  // stays client-side-only on purpose — its filter is a {from,to} range
  // object, and useServerListTable's generic filter serializer only knows
  // how to join a plain value/array into a query string, so forwarding it
  // would send the backend a broken value instead of a real range; same
  // documented "client-only column" escape hatch useServerListTable already
  // uses for Product's own "Stock". documentNumber has no dedicated
  // server-side filter either — free-text search below already reaches it
  // (and bpCode/bpName/ref1) via `q`, so a per-column filter on it would
  // just be redundant. bpType/accountName/lineCount only exist after the
  // grouping below (accountName and lineCount aren't real columns on the
  // table at all), so they can never be more than client-side/per-page.
  const tableColumns = useMemo(() => ([
    { field: 'documentNumber', headerName: 'Document No', filter: 'text' },
    { field: 'documentDate', headerName: 'Document Date', filter: 'dateRange', sortValue: (row) => (row.documentDate ? new Date(row.documentDate).getTime() : null), searchValue: (row) => formatDate(row.documentDate) },
    { field: 'bpType', headerName: 'BP Type', filter: 'select' },
    { field: 'accountName', headerName: 'Opening Balance Account', filter: 'text' },
    { field: 'status', headerName: 'Status', filter: 'select', server: true },
    { field: 'lineCount', headerName: 'Lines', filter: 'numberRange' },
  ]), []);

  // Server-paged + debounced-search counterpart to useTableFeatures — see
  // useServerListTable's own doc comment. `q` (free text) and `status`
  // round-trip to the server; everything else here narrows only the current
  // page. initialPageSize matches the old client-side PAGE_SIZE default —
  // the backend caps `limit` at 200 regardless of what's requested.
  const table = useServerListTable(businessPartnerOpeningBalanceApi.useListPaged, {
    columns: tableColumns,
    initialPageSize: PAGE_SIZE,
  });
  const isLoading = table.isLoading;
  const pageLines = table.rows;

  // One row per document rather than one row per BP line -- a 3-line
  // document used to repeat its own header fields 3 times in this list
  // (same problem Inventory Opening Balance's list had). Every line here
  // carries the same documentNumber (grouping never falls back to a
  // per-row key the way Inventory's does, since documentNumber is a
  // required field on this form, never blank).
  //
  // The list endpoint now pages DISTINCT DOCUMENTS server-side (see GET
  // /business-partner-opening-balance's own comment in resources.js), so
  // `pageLines` here is always the complete, real line set of whichever
  // documents landed on this page -- never a partial slice of a bigger
  // document that spilled onto the next page. This used to page raw LINE
  // rows instead and group whatever landed on the current page, which
  // could split one document's lines across two pages and show an
  // undercounted Lines/Total on the first -- fixed on the backend, not
  // here, since the grouping itself was always going to be exactly this
  // simple; the bug was the shape of the data it was fed. View/Edit below
  // still re-fetch the document's own lines independently on open rather
  // than trusting this grouping -- not for the old undercount reason, but
  // because a document can be edited by someone else between this list
  // loading and the row being opened.
  const documentGroups = useMemo(() => {
    const byDoc = new Map();
    pageLines.forEach((row) => {
      if (!byDoc.has(row.documentNumber)) {
        byDoc.set(row.documentNumber, {
          documentNumber: row.documentNumber,
          documentDate: row.documentDate || null,
          bpType: row.bpType || '',
          status: row.status || 'Posted',
          openingBalanceAccount: row.openingBalanceAccount || '',
          rows: [],
        });
      }
      byDoc.get(row.documentNumber).rows.push(row);
    });
    return Array.from(byDoc.values()).map((group) => ({
      ...group,
      accountName: accountByCode.get(group.openingBalanceAccount)?.accountName || '',
      lineCount: group.rows.length,
      totalOpeningBalance: group.rows.reduce((sum, r) => sum + Number(r.openingBalance || 0), 0),
    }));
  }, [pageLines, accountByCode]);

  const rows = documentGroups;

  const openCreate = () => {
    setEditingDoc(null);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingDoc(null);
  };

  const handleToggleForm = () => (showForm ? closeForm() : openCreate());

  // `group` here is one of documentGroups' own entries, but `group.rows` is
  // only whatever lines of that document happened to land on the current
  // SERVER page (see the comment on documentGroups above) — now that the
  // list is paged, that can be a real subset of the document's actual
  // lines. Both View and Edit re-fetch the document's own complete line set
  // by documentNumber before opening the form; PUT .../document/:documentNumber
  // replaces every line of a document with whatever the form submits, so
  // editing off a partial set would silently delete the rest on save.
  // Falls back to the (possibly partial) page rows only if that fetch
  // itself fails, so the form can still open rather than dead-end.
  const openDocument = async (group, readOnlyMode) => {
    setOpeningDoc(true);
    let docRows = group.rows;
    try {
      docRows = await fetchDocumentLines(group.documentNumber).unwrap();
    } catch (err) {
      notify.error(err?.data?.message || `Couldn't load all lines of "${group.documentNumber}" — showing what was already loaded.`);
    } finally {
      setOpeningDoc(false);
    }
    setEditingDoc({ documentNumber: group.documentNumber, rows: docRows });
    setReadOnly(readOnlyMode);
    setFormKey((k) => k + 1);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleView = (group) => openDocument(group, true);
  const handleEdit = (group) => openDocument(group, false);

  const handleDelete = async (group) => {
    const ok = await confirmDialog({
      title: 'Delete BP Opening Balance',
      message: `Delete BP Opening Balance document "${group.documentNumber}" and its ${group.lineCount} line(s)? This reverses its journal entry and removes it from Outstanding. This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await deleteDocument(group.documentNumber).unwrap();
      notify.success('BP Opening Balance document deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    // openingBalanceAccountDescription is UI-only (auto-filled from
    // openingBalanceAccount — see AccountSelectCell below) — dropped here
    // the same way OpeningBalance.jsx strips its own UI-only `branch`
    // field before calling the API.
    // documentNumberSeriesId: the plumbing field DocumentNoField stashes the
    // peeked series' id into (see that component's own doc comment) — pulled
    // out here rather than left in `body` so it goes to the backend under the
    // name the batch route actually reads (`seriesId`), not the form's own
    // field name. Edit never resolves a series at all (PUT keeps the
    // existing documentNumber as-is), so it's dropped for that path.
    const {
      documentNumber, documentNumberSeriesId: seriesId,
      openingBalanceAccountDescription: _accountDescription, ...body
    } = values;
    try {
      if (editingDoc) {
        const result = await updateDocument({ documentNumber: editingDoc.documentNumber, ...body }).unwrap();
        notify.success(result?.message || 'BP Opening Balance updated');
      } else {
        // seriesId pins this save to the exact series DocumentNoField's peek
        // resolved -- see resolveDocumentNumber/resolveSeries. Sending null
        // when peek hasn't resolved one (or failed) preserves the pre-existing
        // fallback: the server re-derives the document type's default series,
        // same as before this field existed.
        const result = await saveBatch({ documentNumber, seriesId: seriesId ?? null, ...body }).unwrap();
        notify.success(result?.message || 'BP Opening Balance saved');
      }
      closeForm();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<AccountBalanceOutlinedIcon />}
        title="BP Opening Balance"
        subtitle="Starting Accounts Receivable/Payable balances per Business Partner, posted to the G/L."
        rightContent={<CompanyBadge />}
      />

      <Stack direction="row" justifyContent="flex-end" spacing={1.5} sx={{ mb: 2 }}>
        <Button
          variant="contained"
          startIcon={showForm ? <CloseIcon /> : <AddIcon />}
          onClick={handleToggleForm}
        >
          {showForm ? 'Close' : 'Add New'}
        </Button>
      </Stack>

      <Collapse in={showForm} unmountOnExit>
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
              {readOnly ? 'View BP Opening' : editingDoc ? 'Edit BP Opening' : 'Add BP Opening'}
            </Typography>

            <AppForm
              readOnly={readOnly}
              key={formKey}
              schema={businessPartnerOpeningBalanceDocumentSchema}
              defaultValues={editingDoc
                ? {
                  documentNumber: editingDoc.documentNumber,
                  documentDate: editingDoc.rows[0]?.documentDate || null,
                  openingBalanceAccount: editingDoc.rows[0]?.openingBalanceAccount || '',
                  openingBalanceAccountDescription: accountByCode.get(editingDoc.rows[0]?.openingBalanceAccount)?.accountName || '',
                  ref1: editingDoc.rows[0]?.ref1 || '',
                  ref2: editingDoc.rows[0]?.ref2 || '',
                  bpType: editingDoc.rows[0]?.bpType || 'Customer',
                  remarks: editingDoc.rows[0]?.remarks || '',
                  lines: editingDoc.rows.map((r) => ({
                    bpCode: r.bpCode,
                    bpName: r.bpName,
                    invoiceNo: r.invoiceNo || '',
                    invoiceDate: r.invoiceDate || null,
                    dueDate: r.dueDate || null,
                    openingBalance: r.openingBalance ?? '',
                  })),
                }
                : getEmptyValues()}
              onSubmit={handleSubmit}
            >
              {(methods) => {
                const { watch, control, setValue, setError } = methods;
                const bpType = watch('bpType');
                const { fields, append, remove: removeLine } = useFieldArray({ control, name: 'lines' });
                // Which EDIT_PAGE_SIZE-row window of `fields` is actually
                // mounted right now -- see EDIT_PAGE_SIZE's own doc comment.
                // Reset to 0 every time this form (re)mounts (formKey
                // changes on every Add New/View/Edit open), so a new
                // editing session always starts on the document's first
                // page rather than wherever a previous one was left.
                const [editPage, setEditPage] = useState(0);
                const editPageCount = Math.max(1, Math.ceil(fields.length / EDIT_PAGE_SIZE));
                const clampedEditPage = Math.min(editPage, editPageCount - 1);
                const editPageStart = clampedEditPage * EDIT_PAGE_SIZE;
                const editPageFields = fields.slice(editPageStart, editPageStart + EDIT_PAGE_SIZE);

                // Opening Balance Account drives the read-only Account
                // Description field on the same header — same "select
                // drives a read-only companion field" pattern as BP
                // Code/BP Name below and the Employee picker on
                // UserManagement.jsx.
                const handleAccountChange = (nextValue) => {
                  setValue('openingBalanceAccountDescription', accountByCode.get(nextValue)?.accountName || '', { shouldValidate: false });
                };

                // BP Code lists only Business Partners of the header's own
                // BP Type — picking "Vendor" and then a BP still on-screen
                // from "Customer" would post the wrong control account
                // entirely, so the option list itself narrows instead of
                // trusting the user to pick consistently.
                const bpOptions = useMemo(
                  () => (businessPartners || [])
                    .filter((p) => p.partnerType === bpType)
                    .map((p) => ({ label: `${p.partnerCode} - ${p.partnerName}`, value: p.partnerCode, bpName: p.partnerName })),
                  [businessPartners, bpType]
                );

                // The new row always lands at the current end of the array -- jump
                // to whichever page will hold it (computed from the
                // PRE-append length) so Add Row always scrolls the user to
                // a row they can actually see and edit, instead of
                // silently appending it onto a page that's still showing
                // page 1.
                const appendBlankRow = () => {
                  setEditPage(Math.floor(fields.length / EDIT_PAGE_SIZE));
                  append({ ...emptyLine });
                };

                // Rows parsed out of the uploaded sheet. The server only
                // checked them structurally; resolving each one against the
                // Business Partner master loaded on this page — narrowed to
                // the header's own BP Type, same as bpOptions above — is
                // what makes an imported line identical to a hand-picked one
                // (see ImportItemsDialog).
                const handleLinesImported = (imported) => {
                  const bpByCode = new Map(bpOptions.map((o) => [String(o.value).trim().toLowerCase(), o]));
                  let unmatchedBp = 0;

                  // A brand-new document starts with one untouched blank
                  // line (see getEmptyValues/emptyLine) so there's always
                  // one row to fill in by hand. Importing just appended the
                  // sheet's rows after it, so that starter row was left
                  // behind empty at the top of the table instead of being
                  // replaced — drop it first when it's still blank, so the
                  // imported rows are all the table ends up showing.
                  const currentLines = watch('lines') || [];
                  const isBlankLine = (row) => !row?.bpCode && !row?.openingBalance && !row?.invoiceNo && !row?.invoiceDate && !row?.dueDate;
                  const startsBlank = currentLines.length === 1 && isBlankLine(currentLines[0]);
                  const baseIndex = startsBlank ? 0 : currentLines.length;
                  if (startsBlank) removeLine(0);

                  // Server-side validateHeaders/lines-import only checks the
                  // sheet structurally (bpCode present, openingBalance
                  // numeric) — resolving BP Code against the master already
                  // loaded on this page is deliberately a client-side step
                  // (see the comment on BP_OPENING_BALANCE_LINES_IMPORT_FIELDS
                  // in resources.js), so an unmatched code has to be caught
                  // and surfaced here, per-row, rather than silently
                  // importing a line that looks fine in the table but would
                  // fail — or worse, post against the wrong BP — on save.
                  //
                  // Matching itself stays a plain per-row loop (cheap: one
                  // Map lookup), but it no longer calls `append()` inside
                  // that loop — useFieldArray's append re-derives its whole
                  // field array on every call, so appending one row at a
                  // time turned a several-thousand-row import into an O(n²)
                  // render storm (each of the last rows re-processing every
                  // row appended before it) that could hang the tab on a
                  // large sheet. Every row is collected into `newRows`
                  // first and handed to append() ONCE as an array — a
                  // single O(n) update no matter how many rows were
                  // imported — with the per-row validation errors applied
                  // in a second, separate pass afterwards.
                  const newRows = [];
                  const rowMeta = [];
                  imported.forEach((line) => {
                    const bpMatch = bpByCode.get(String(line.bpCode || '').trim().toLowerCase());
                    if (!bpMatch) unmatchedBp += 1;

                    newRows.push({
                      bpCode: bpMatch ? bpMatch.value : (line.bpCode || ''),
                      // Prefer the master's name over the sheet's, so a
                      // stale name in the file can't contradict the BP.
                      bpName: bpMatch ? bpMatch.bpName : '',
                      invoiceNo: line.invoiceNo || '',
                      invoiceDate: toPickerDate(line.invoiceDate),
                      dueDate: toPickerDate(line.dueDate),
                      openingBalance: line.openingBalance ?? '',
                    });
                    rowMeta.push({ bpMatch, row: line.row ?? '?', bpCode: line.bpCode || '' });
                  });

                  if (newRows.length) {
                    // Same reasoning as appendBlankRow above -- land on the
                    // page that will actually show the imported rows (and
                    // the row-level errors set() right below) rather than
                    // leaving the view on whichever page it happened to be
                    // showing before the import.
                    setEditPage(Math.floor(baseIndex / EDIT_PAGE_SIZE));
                    append(newRows);
                  }

                  rowMeta.forEach((meta, i) => {
                    const lineIndex = baseIndex + i;
                    if (!meta.bpMatch) {
                      setError(`lines.${lineIndex}.bpCode`, {
                        type: 'manual',
                        message: `"${meta.bpCode}" (sheet row ${meta.row}) isn't an Active ${bpType} in Business Partner Master — pick one.`,
                      });
                    }
                  });

                  if (unmatchedBp > 0) {
                    notify.warning(
                      `Imported with ${unmatchedBp} row(s) with an unmatched BP Code — fix the highlighted line(s) before saving.`,
                      { duration: 10000 }
                    );
                  }
                };

                return (
                  <>
                    <FormGrid columns={3} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                      <LabeledField label="No. *">
                        <DocumentNoField
                          documentCode="BPOB"
                          name="documentNumber"
                          label=""
                          isCreate={!editingDoc}
                          // Pins the save to the exact series this peek resolved --
                          // see DocumentNoField's own doc comment and handleSubmit
                          // above for why (fixes the manual-entry "must match the
                          // series pattern" mismatch between preview and save).
                          emitsSeriesId
                        />
                      </LabeledField>
                      <LabeledField label="Document Date *">
                        <FormDatePicker name="documentDate" label="" />
                      </LabeledField>
                      <LabeledField label="Opening Balance Account *">
                        <FormSelect
                          name="openingBalanceAccount"
                          label=""
                          placeholder="Search G/L account"
                          options={accountOptions}
                          onValueChange={handleAccountChange}
                          popupFitContent
                        />
                      </LabeledField>
                      <LabeledField label="Account Description">
                        <FormTextField
                          name="openingBalanceAccountDescription"
                          label=""
                          disabled
                          placeholder="Auto-filled from Opening Balance Account"
                        />
                      </LabeledField>
                      <LabeledField label="BP Type *">
                        <FormSelect name="bpType" label="" options={BP_TYPE_OPTIONS} disabled={!!editingDoc} />
                      </LabeledField>
                      <LabeledField label="Ref 1">
                        <FormTextField name="ref1" label="" placeholder="Defaults to the document number" />
                      </LabeledField>
                      <LabeledField label="Ref 2">
                        <FormTextField name="ref2" label="" placeholder="Enter Ref 2" />
                      </LabeledField>
                    </FormGrid>

                    <Box sx={{ mt: 3 }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight={700}>Business Partner Lines</Typography>
                        {!readOnly && (
                          <Stack direction="row" spacing={1.5}>
                            <Button
                              type="button"
                              variant="outlined"
                              color="inherit"
                              size="small"
                              startIcon={<UploadFileIcon />}
                              onClick={() => setLinesImportOpen(true)}
                            >
                              Import Lines
                            </Button>
                            <Button type="button" variant="outlined" size="small" startIcon={<AddIcon />} onClick={appendBlankRow}>
                              Add Row
                            </Button>
                          </Stack>
                        )}
                      </Stack>

                      <TableContainer sx={{ overflowX: 'auto' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell width={40}>#</TableCell>
                              <TableCell>BP Code *</TableCell>
                              <TableCell>BP Name</TableCell>
                              <TableCell>Invoice No</TableCell>
                              <TableCell>Date</TableCell>
                              <TableCell>Due Date</TableCell>
                              <TableCell align="right">Opening Balance *</TableCell>
                              <TableCell width={48}>Action</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {/* View mode renders every line as PLAIN TEXT, never
                                through BpCodeCell/FormTextField/FormSelect. Those
                                are a MUI Autocomplete (BpCodeCell) plus two more
                                RHF-wired inputs PER ROW, each with its own watch()
                                subscription — fine for a handful of rows, but
                                mounting hundreds to thousands of them at once (a
                                real seeded document, or the 20,000-line import
                                this table exists to hold) blocks the main thread
                                long enough for the browser to show its own "Page
                                Unresponsive" prompt. View never needs them
                                editable in the first place, so it skips the
                                interactive controls entirely and reads straight off
                                `field` (already carries this row's bpCode/bpName/
                                openingBalance from useFieldArray's own
                                defaultValues — no extra data plumbing needed).
                                Edit used to reuse this same fields.map over the
                                interactive row below with no windowing at all,
                                and hit exactly this wall on a document this
                                large (froze the tab, sometimes hard enough to
                                crash it) since the fields there really do have
                                to stay editable and can't fall back to plain
                                text. Fixed by windowing which rows are mounted
                                -- see EDIT_PAGE_SIZE/editPageFields below. */}
                            {readOnly ? fields.map((field, index) => (
                              <TableRow key={field.id} sx={{ '& > td': { verticalAlign: 'middle' } }}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell>{field.bpCode || '—'}</TableCell>
                                <TableCell>{field.bpName || '—'}</TableCell>
                                <TableCell>{field.invoiceNo || '—'}</TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(field.invoiceDate)}</TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(field.dueDate)}</TableCell>
                                <TableCell align="right">{currency(field.openingBalance)}</TableCell>
                                <TableCell />
                              </TableRow>
                            )) : editPageFields.map((field, i) => {
                              // Real index into the full `fields`/`lines`
                              // array -- editPageFields is only a slice, so
                              // `i` alone would renumber every row on every
                              // page back to 0 and point every RHF field
                              // name at the wrong line.
                              const index = editPageStart + i;
                              return (
                                <TableRow key={field.id} sx={{ '& > td': { verticalAlign: 'middle' } }}>
                                  <TableCell>{index + 1}</TableCell>
                                  <TableCell>
                                    <BpCodeCell index={index} methods={methods} options={bpOptions} sx={{ minWidth: 200 }} />
                                  </TableCell>
                                  <TableCell>
                                    <FormTextField name={`lines.${index}.bpName`} label="" disabled placeholder="Auto-filled from BP Code" />
                                  </TableCell>
                                  <TableCell>
                                    <FormTextField name={`lines.${index}.invoiceNo`} label="" placeholder="Invoice No" inputProps={{ maxLength: 50 }} sx={{ minWidth: 140 }} />
                                  </TableCell>
                                  <TableCell>
                                    <FormDatePicker name={`lines.${index}.invoiceDate`} label="" triggerFields={`lines.${index}.dueDate`} sx={{ minWidth: 160 }} />
                                  </TableCell>
                                  <TableCell>
                                    <FormDatePicker name={`lines.${index}.dueDate`} label="" triggerFields={`lines.${index}.invoiceDate`} sx={{ minWidth: 160 }} />
                                  </TableCell>
                                  <TableCell align="right">
                                    <FormTextField name={`lines.${index}.openingBalance`} label="" type="number" inputProps={{ style: { textAlign: 'right' } }} />
                                  </TableCell>
                                  <TableCell>
                                    <IconButton
                                      type="button"
                                      size="small"
                                      color="error"
                                      onClick={() => removeLine(index)}
                                      disabled={fields.length <= 1}
                                      aria-label="remove line"
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>

                      {/* Only shown in Edit -- View has no per-row controls
                          to bound and a document this large already renders
                          as plain text there (see the comment on the table
                          body above), and there's nothing to page through
                          below EDIT_PAGE_SIZE lines. */}
                      {!readOnly && fields.length > EDIT_PAGE_SIZE && (
                        <EntityListPagination
                          total={fields.length}
                          page={clampedEditPage}
                          onChange={setEditPage}
                          pageSize={EDIT_PAGE_SIZE}
                        />
                      )}
                    </Box>

                    <Grid container spacing={3} sx={{ mt: 3 }}>
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Remarks</Typography>
                        <FormTextField name="remarks" label="" placeholder="Enter remarks" multiline rows={3} />
                      </Grid>
                    </Grid>

                    <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 3 }}>
                      <Button variant="outlined" color={readOnly ? 'error' : 'inherit'} onClick={closeForm} disabled={saving || updatingDoc}>
                        {readOnly ? 'Close' : 'Clear'}
                      </Button>
                      {!readOnly && (
                        <FormSubmitButton disabled={saving || updatingDoc}>
                          {editingDoc ? 'Update BP Opening' : 'Save BP Opening'}
                        </FormSubmitButton>
                      )}
                    </Stack>

                    <ImportItemsDialog
                      open={linesImportOpen}
                      onClose={() => setLinesImportOpen(false)}
                      resourceName="BP Opening Balance Lines"
                      templateUrl="/business-partner-opening-balance/lines-import/template"
                      importUrl="/business-partner-opening-balance/lines-import"
                      onImported={handleLinesImported}
                    />
                  </>
                );
              }}
            </AppForm>
          </CardContent>
        </Card>
      </Collapse>

      {!showForm && (
      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>BP Opening Balance List</Typography>
            <TableSearchFilter table={table} placeholder="Search by document no, BP code, name..." width={280} />
          </Stack>

          <TableFilterPanel table={table} />

          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {!isLoading && rows.map((group) => (
                <MobileRecordCard
                  key={group.documentNumber}
                  title={group.documentNumber || '—'}
                  statusChip={<Chip size="small" label={group.status} color={group.status === 'Posted' ? 'success' : 'default'} variant="outlined" />}
                  fields={[
                    { label: 'Document Date', value: formatDate(group.documentDate) },
                    { label: 'BP Type', value: group.bpType || '—' },
                    { label: 'Opening Balance Account', value: group.accountName || group.openingBalanceAccount || '—' },
                    { label: 'Total Opening Balance', value: currency(group.totalOpeningBalance) },
                    { label: 'Lines', value: group.lineCount },
                  ]}
                  onView={() => handleView(group)}
                  onEdit={() => handleEdit(group)}
                  onDelete={() => handleDelete(group)}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                <EmptyState icon={<AccountBalanceOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No BP opening balances yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first BP opening balance to get started'} />
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell width={48}>#</TableCell>
                    <SortableHeaderCell field="documentNumber" sort={table.sort} onSort={table.toggleSort}>Document No</SortableHeaderCell>
                    <SortableHeaderCell field="documentDate" sort={table.sort} onSort={table.toggleSort}>Document Date</SortableHeaderCell>
                    <SortableHeaderCell field="bpType" sort={table.sort} onSort={table.toggleSort}>BP Type</SortableHeaderCell>
                    <SortableHeaderCell field="accountName" sort={table.sort} onSort={table.toggleSort}>Opening Balance Account</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <SortableHeaderCell align="right" field="lineCount" sort={table.sort} onSort={table.toggleSort}>Lines</SortableHeaderCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && rows.map((group, i) => (
                    <TableRow key={group.documentNumber} hover>
                      <TableCell>{table.page * table.pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{group.documentNumber || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(group.documentDate)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{group.bpType}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{group.accountName || group.openingBalanceAccount || '—'}</TableCell>
                      <TableCell>
                        <Chip size="small" label={group.status} color={group.status === 'Posted' ? 'success' : 'default'} variant="outlined" />
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{group.lineCount}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <IconButton size="small" onClick={() => handleView(group)} disabled={openingDoc} aria-label="view">
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleEdit(group)} disabled={openingDoc} aria-label="edit">
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                          <CanDelete>
                            <IconButton size="small" color="error" onClick={() => handleDelete(group)} aria-label="delete">
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </CanDelete>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <EmptyState icon={<AccountBalanceOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No BP opening balances yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first BP opening balance to get started'} />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollableTableContainer>
          )}

          {/* total/page/pageSize come straight from the server's own meta
              (line counts) — see useServerListTable — rather than this
              page's grouped row count, so the pager reflects the real,
              server-side total instead of however many documents this one
              page happened to collapse into. */}
          <EntityListPagination total={table.total} page={table.page} onChange={table.setPage} pageSize={table.pageSize} onPageSizeChange={(v) => { table.setPageSize(v); table.setPage(0); }} />
        </CardContent>
      </Card>
      )}
    </Box>
  );
}
