import React, { useMemo, useState } from 'react';
import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined';
import {
  Box, Typography, Button, Card, CardContent, Stack, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton, Menu, MenuItem, ListItemIcon,
  ListItemText, Autocomplete, Grid, Collapse, Alert, Checkbox, FormControlLabel,
} from '@mui/material';
import { useFieldArray, Controller } from 'react-hook-form';
import dayjs from 'dayjs';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import PublishOutlinedIcon from '@mui/icons-material/PublishOutlined';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
import DocumentNoField from '../../components/form/DocumentNoField';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import MobileItemCard from '../../components/data-display/MobileItemCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import useDragScroll from '../../components/data-display/useDragScroll';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { round2 } from '../../lib/documentTotals';
import { journalEntrySchema, JOURNAL_ENTRY_TRANSACTION_TYPE_OPTIONS } from '../../lib/validation/accountingSchemas';
import {  } from '../../lib/validation/partnerSchemas';
import { useCurrencyOptions } from '../../lib/currencyOptions';
import { useBranchNameOptions } from '../../lib/useBranchOptions';
import {
  journalEntryApi, chartOfAccountApi, businessPartnerApi, usePostJournalEntryToGlMutation,
} from '../../features/resources';
import FindAccountsDialog from '../../components/accounting/FindAccountsDialog';
import FindBusinessPartnersDialog from '../../components/accounting/FindBusinessPartnersDialog';
import SearchIcon from '@mui/icons-material/Search';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer, { dragScrollbarSx } from '../../components/data-display/ScrollableTableContainer';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';

const PAGE_SIZE = 10;
// 'Pending G/L' is the parked state — the source document posted, but account
// determination was incomplete, so the entry exists naming what is missing
// rather than being silently skipped. Amber because it is neither finished
// nor broken: it is work waiting on a configuration fix.
const STATUS_FILTERS = ['All Status', 'Draft', 'Posted', 'Pending G/L', 'Reversed'];
const STATUS_COLORS = {
  Draft: 'info', Posted: 'success', 'Pending G/L': 'warning',
  // Superseded by a reversal (see reverseJournalEntry in utils/glPosting.js)
  // rather than deleted -- still worth its own color so a cancelled
  // document's original entry doesn't read as just another Draft/Posted row.
  Reversed: 'default',
};
// A reversal entry's own transactionType is `${original} Reversal` (see
// reverseJournalEntry) -- flagging it here, rather than adding a second
// server-side boolean to every row this list already fetches, keeps the
// "is this row a reversal" check colocated with the one column that already
// carries the answer.
const isReversalTransactionType = (transactionType) => !!transactionType && /\sReversal$/.test(transactionType);

// Journal Lines table sizing — pulled into named constants the same way
// ProductInventoryTab.jsx (Product Master > Inventory) does it, so the
// table's scrollable height and grid border can be tuned in one place
// instead of hunting through the JSX below.
//   - LINES_TABLE_MAX_HEIGHT   how tall the scrollable line-grid area is
//                                before it scrolls internally, in px. Was a
//                                bare `maxHeight: 420` inline in the
//                                TableContainer's own sx prop.
//   - LINES_TABLE_ROW_HEIGHT   a floor on every row's (including the header's)
//                                height, in px -- like ProductInventoryTab's
//                                own TABLE_ROW_HEIGHT, this is a floor, not a
//                                cap: LINES_TABLE_CELL_PADDING_Y can still
//                                push a row taller if it needs more room than
//                                that padding leaves.
//   - LINES_TABLE_CELL_PADDING_Y  the actual top/bottom gap around each
//                                cell's content -- this, not the row-height
//                                floor above, is what was making every row
//                                look tall, since a cell's padding adds on
//                                top of an explicit height rather than
//                                shrinking to fit it. cellFieldSx (below,
//                                inside the render function) mirrors this
//                                value for the input fields living inside
//                                these cells, so the field's own padding
//                                doesn't reintroduce the same problem.
const LINES_TABLE_MAX_HEIGHT = 420;
const LINES_TABLE_CELL_BORDER = { border: '1px solid', borderColor: 'divider' };
const LINES_TABLE_ROW_HEIGHT = 0;
const LINES_TABLE_CELL_PADDING_Y = 2;

// The Journal Entry List table below (the entry-level list, not the Journal
// Lines grid above) had no cell-border/padding treatment at all, so it fell
// back to MUI's default row-underline-only look — every other master list in
// the app (Warehouse Master, Branch, Tax Code, House Bank, ...) uses this
// same fully-ruled-grid pattern instead. Same values as WarehouseMaster's own
// WAREHOUSE_LIST_TABLE_* constants, kept separate per file per that existing
// convention rather than shared, so each list can still be tuned on its own.
const JOURNAL_LIST_TABLE_ROW_HEIGHT = 0;
const JOURNAL_LIST_TABLE_CELL_PADDING_Y = 6;
/**
 * Was this entry generated by the G/L posting engine, or typed by a human?
 *
 * `sourceType` is set only by backend/src/utils/glPosting.js when a business
 * document posts, so its presence is the authoritative test — and the server
 * enforces the same rule, refusing any edit or delete of an entry that has
 * one. The UI mirrors that instead of merely hiding the buttons.
 */
const isSystemGenerated = (row) => Boolean(row?.sourceType);

function emptyLine() {
  return {
    accountCode: '', accountName: '', description: '', branch: '',
    businessPartnerCode: '', businessPartnerName: '', debit: '', credit: '',
    // Per-line Ref 1/2/3 -- free text, distinct from the header's own Ref
    // 1/2/3 fields above.
    ref1: '', ref2: '', ref3: '',
  };
}

function getEmptyValues() {
  const today = new Date();
  return {
    journalEntryNo: '', branch: '', transactionType: 'Manual', postingDate: today, documentDate: today,
    // No natural due date for a hand-typed manual entry — left blank, and
    // optional in journalEntrySchema, rather than defaulted to anything.
    dueDate: null,
    narration: '', currency: 'INR', exchangeRate: 1, remarks: '',
    // Origin No — a manual entry's own second number, allocated from its own
    // series (see schema.prisma). Left blank for a system-generated entry.
    originNo: '',
    // Reference-only fields from the legacy Journal Entry screen — see
    // schema.prisma and journalEntrySchema.
    ref1: '', ref2: '', ref3: '',
    reviseDateEnabled: false, reviseDate: null,
    lines: [emptyLine(), emptyLine()],
  };
}

function rowToFormValues(row) {
  return {
    journalEntryNo: row.journalEntryNo, branch: row.branch || '',
    transactionType: row.transactionType || 'Manual',
    postingDate: row.postingDate, documentDate: row.documentDate, dueDate: row.dueDate || null,
    narration: row.narration || '', currency: row.currency || 'INR',
    exchangeRate: row.exchangeRate != null ? Number(row.exchangeRate) : 1,
    remarks: row.remarks || '',
    originNo: row.originNo || '',
    ref1: row.ref1 || '', ref2: row.ref2 || '', ref3: row.ref3 || '',
    reviseDateEnabled: Boolean(row.reviseDateEnabled), reviseDate: row.reviseDate || null,
    lines: (row.lines || []).map((l) => ({
      accountCode: l.accountCode || '', accountName: l.accountName || '',
      description: l.description || '', branch: l.branch || '',
      businessPartnerCode: l.businessPartnerCode || '', businessPartnerName: l.businessPartnerName || '',
      ref1: l.ref1 || '', ref2: l.ref2 || '', ref3: l.ref3 || '',
      debit: l.debit != null ? Number(l.debit) : '', credit: l.credit != null ? Number(l.credit) : '',
    })),
  };
}

/**
 * Debit(SC)/Credit(SC)/Base Amount, computed the same way the server does
 * (see toJournalEntryLineData in routes/resources.js) so the grid shows a
 * live preview while typing. These are never form fields — only ever derived
 * and displayed — and the server recomputes and stores its own authoritative
 * copy on save regardless of what the client sends.
 */
function computeLineDerived(line, exchangeRate) {
  const debit = Number(line?.debit) || 0;
  const credit = Number(line?.credit) || 0;
  const rate = Number(exchangeRate) || 1;
  const baseAmount = debit || credit;
  return {
    debitSc: round2(debit * rate),
    creditSc: round2(credit * rate),
    baseAmount: round2(baseAmount),
  };
}

// Journal Entry (Accounting > Journal Entry) — the general ledger.
//
// Two kinds of entry live here and they behave completely differently:
//
//   Manual   — typed on this screen, SAP FB50/F-02 style. Every line posts
//              either a debit or a credit against a G/L account, and the
//              entry can only be saved once total debit equals total credit
//              (enforced client-side in journalEntrySchema and again
//              server-side). Transaction Type is always 'Manual' and is
//              shown read-only: a hand-typed entry cannot claim to be the
//              accounting behind a sales invoice.
//
//   System   — generated automatically by backend/src/utils/glPosting.js
//              when a business document posts, exactly as SAP generates an
//              accounting document behind a goods movement or an invoice.
//              Rendered fully read-only with its source document named:
//              editing the ledger behind a document's back is what an audit
//              trail exists to prevent. Corrections go through the document,
//              which rebuilds its entry on every save.
//
// An entry parked as 'Pending G/L' is the third state to know about — its
// document posted but account determination was incomplete. It shows the
// exact missing account and a Post to G/L action to retry once configured.
export default function JournalEntry() {
  // Every currency dropdown reads live from Currency Master instead of a
  // hardcoded list — see lib/currencyOptions.js.
  const currencyOptions = useCurrencyOptions();
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const itemScrollRef = useDragScroll();
  const { data: entries, isLoading } = journalEntryApi.useList();
  const { data: chartOfAccounts } = chartOfAccountApi.useList();
  const { data: businessPartners } = businessPartnerApi.useList();
  const [create, { isLoading: creating }] = journalEntryApi.useCreate();
  const [update, { isLoading: updating }] = journalEntryApi.useUpdate();
  const [remove] = journalEntryApi.useDelete();
  const [postToGl, { isLoading: postingToGl }] = usePostJournalEntryToGlMutation();

  // Declared here (ahead of showForm/readOnly/formKey further down) so
  // editingRow is available to seed useBranchNameOptions' currentValue —
  // the same list feeds the header Branch select and every line's own
  // Branch select.
  const [editingRow, setEditingRow] = useState(null);
  const { options: branchOptions } = useBranchNameOptions({ currentValue: editingRow?.branch });
  // Only real posting accounts (AccountNature 'A') belong on a journal line —
  // a Title account is a heading, never something posted to directly. Same
  // filter PaymentVoucher applies to its own Account party option list.
  const accountCodeOptions = useMemo(
    () => (chartOfAccounts || []).filter((a) => a.accountNature === 'A' && a.status !== 'I').map((a) => ({ label: `${a.accountName} (${a.accountCode})`, value: a.accountCode })),
    [chartOfAccounts]
  );
  const accountByCode = useMemo(
    () => new Map((chartOfAccounts || []).map((a) => [a.accountCode, a])),
    [chartOfAccounts]
  );
  // Every Business Partner, Customer and Vendor alike — a journal line can
  // reconcile against either side (an AR or an AP control account), so
  // unlike the customerApi/supplierApi adapters elsewhere this is not
  // filtered by partnerType.
  const businessPartnerOptions = useMemo(
    () => (businessPartners || []).map((p) => ({
      label: `${p.partnerCode} — ${p.partnerName} (${p.partnerType})`,
      value: p.partnerCode,
    })),
    [businessPartners]
  );
  const businessPartnerByCode = useMemo(
    () => new Map((businessPartners || []).map((p) => [p.partnerCode, p])),
    [businessPartners]
  );
  // The G/L Acct/BP No. column (the name says it) doubles as either a G/L
  // account or a business partner — see the Ctrl/Cmd+click Find Business
  // Partner picker below, which now writes a partner's code into this same
  // accountCode field. Without every business partner listed here too, this
  // dropdown (an Autocomplete: it can only display a value that's actually
  // among its own `options`) would find no match for a partner code and
  // render blank, even though the field's real value was set correctly.
  const accountOrPartnerOptions = useMemo(
    () => [...accountCodeOptions, ...businessPartnerOptions],
    [accountCodeOptions, businessPartnerOptions]
  );
  // Accounts offered in the Find Accounts popup — same postable-only filter
  // as accountCodeOptions above, kept separate since the dialog wants the
  // full account row (name, code, nature) rather than a label/value pair.
  const findAccountsRows = useMemo(
    () => (chartOfAccounts || []).filter((a) => a.accountNature === 'A' && a.status !== 'I'),
    [chartOfAccounts]
  );
  // Business Partners offered in the Find Business Partner popup — the full
  // partner row (code, name, type), same list businessPartnerOptions above
  // is built from, just not reduced to a label/value pair.
  const findBusinessPartnersRows = useMemo(() => businessPartners || [], [businessPartners]);

  const [showForm, setShowForm] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  // Which journal line's G/L Account is being picked via the Find Accounts
  // popup — null when the dialog is closed.
  const [findAccountsLineIndex, setFindAccountsLineIndex] = useState(null);
  // Which journal line's Business Partner is being picked via the Find
  // Business Partner popup — opened with Ctrl/Cmd+click on the same search
  // icon that plain-clicks into Find Accounts. Null when closed.
  const [findBpLineIndex, setFindBpLineIndex] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [rowMenuAnchor, setRowMenuAnchor] = useState(null);
  const [rowMenuTarget, setRowMenuTarget] = useState(null);
  const [pendingStatus, setPendingStatus] = useState('Draft');

  const rows = entries || [];

  const baseTableRows = useMemo(() => {
    return rows.filter((r) => statusFilter === 'All Status' || r.status === statusFilter);
  }, [rows, statusFilter]);

  const tableColumns = useMemo(() => ([
    { field: 'journalEntryNo', headerName: 'Journal Entry No.', filter: 'text' },
    { field: 'transactionType', headerName: 'Transaction Type', filter: 'select' },
    { field: 'sourceDocNo', headerName: 'Source Document', filter: 'text' },
    { field: 'postingDate', headerName: 'Posting Date', filter: 'dateRange', sortValue: (row) => (row.postingDate ? new Date(row.postingDate).getTime() : null) },
    { field: 'referenceNo', headerName: 'Reference', filter: 'text' },
    { field: 'totalDebit', headerName: 'Total Debit (₹)', filter: 'numberRange', sortValue: (row) => Number(row.totalDebit) || 0 },
    { field: 'totalCredit', headerName: 'Total Credit (₹)', filter: 'numberRange', sortValue: (row) => Number(row.totalCredit) || 0 },
    { field: 'status', headerName: 'Status', filter: 'select' },
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
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRow(null);
  };

  const handleView = (row) => {
    setEditingRow(row);
    setReadOnly(true);
    setFormKey((k) => k + 1);
    setShowForm(true);
    setRowMenuAnchor(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // A system-generated entry opens for viewing however it was reached — the
  // menu hides Edit for one, but the row itself is still clickable, and the
  // server would refuse the save regardless.
  const handleEdit = (row) => {
    if (isSystemGenerated(row)) {
      handleView(row);
      return;
    }
    setEditingRow(row);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    setShowForm(true);
    setRowMenuAnchor(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (row) => {
    setRowMenuAnchor(null);
    if (isSystemGenerated(row)) {
      notify.error(
        `This entry was generated from ${row.sourceType} ${row.sourceDocNo}. Delete or amend that document instead — its journal entry follows it.`
      );
      return;
    }
    const ok = await confirmDialog({
      title: 'Delete journal entry',
      message: `Are you sure you want to delete "${row.journalEntryNo}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Journal entry deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  /**
   * Retry a parked entry after its missing account has been configured.
   * The server re-reads the source document and rebuilds the lines, so this
   * picks up any edit made to that document in the meantime.
   */
  const handlePostToGl = async (row) => {
    setRowMenuAnchor(null);
    try {
      await postToGl(row.id).unwrap();
      notify.success(`${row.journalEntryNo} posted to the general ledger`);
    } catch (err) {
      notify.error(err?.data?.message || 'Could not post to the general ledger');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    // accountName is display-only metadata carried alongside each line's
    // accountCode -- resolved here at submit time from the current Chart Of
    // Accounts rather than kept in sync per-keystroke, so there's no need to
    // wire a side-effecting onChange into FormSelect (whose own Controller
    // already owns the field's onChange).
    const lines = (values.lines || []).map((line) => ({
      ...line,
      accountName: accountByCode.get(line.accountCode)?.accountName || line.accountName || '',
      businessPartnerName: businessPartnerByCode.get(line.businessPartnerCode)?.partnerName || line.businessPartnerName || '',
    }));
    const payload = { ...values, lines, status: pendingStatus };
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Journal entry updated');
      } else {
        await create(payload).unwrap();
        notify.success('Journal entry saved');
      }
      closeForm();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<MenuBookOutlinedIcon />}
        title="Journal Entry"
        subtitle={showForm ? 'Post a manual double-entry transaction directly to the general ledger.' : 'Manage and track all manual journal entries.'}
        rightContent={<CompanyBadge />}
      />

      <Collapse in={showForm} unmountOnExit>
      <Box sx={{ mb: 2 }}>
        <AppForm readOnly={readOnly}
          key={formKey}
          schema={journalEntrySchema}
          defaultValues={editingRow ? rowToFormValues(editingRow) : getEmptyValues()}
          onSubmit={handleSubmit}
        >
          {(methods) => {
            const { control, watch, setValue, getValues, formState: { errors } } = methods;
            const { fields, append, remove: removeLine } = useFieldArray({ control, name: 'lines' });

            // Double-entry helper: an amount typed on one line's Debit is
            // mirrored into the NEXT line's Credit (and vice-versa), the way a
            // two-legged entry is normally keyed. The same line's opposite
            // side is cleared so a line never carries both. If the edited line
            // is the last one, a balancing line is appended.
            const mirrorAmount = (index, side, value, prevValue) => {
              const other = side === 'debit' ? 'credit' : 'debit';
              const num = Number(value) || 0;
              const prev = Number(prevValue) || 0;
              const opts = { shouldDirty: true, shouldValidate: true };
              if (num > 0 && (Number(getValues(`lines.${index}.${other}`)) || 0) > 0) {
                setValue(`lines.${index}.${other}`, '', opts);
              }
              const next = index + 1;
              const lines = getValues('lines') || [];
              if (next < lines.length) {
                const nextOther = Number(lines[next]?.[other]) || 0;
                const nextSame = Number(lines[next]?.[side]) || 0;
                if (num > 0) {
                  if (nextSame > 0) setValue(`lines.${next}.${side}`, '', opts);
                  setValue(`lines.${next}.${other}`, value, opts);
                } else if (prev > 0 && nextOther === prev) {
                  // Amount cleared: drop the mirrored figure too (only if the
                  // user hasn't since changed it).
                  setValue(`lines.${next}.${other}`, '', opts);
                }
              } else if (num > 0) {
                append({ ...emptyLine(), [other]: value });
              }
            };

            const watchedLines = watch('lines') || [];
            const watchedExchangeRate = watch('exchangeRate');
            const watchedReviseDateEnabled = watch('reviseDateEnabled');
            const totalDebit = round2(watchedLines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0));
            const totalCredit = round2(watchedLines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0));
            const difference = round2(totalDebit - totalCredit);
            const isBalanced = Math.abs(difference) < 0.005 && watchedLines.length >= 2;

            const linesError = errors.lines?.message || errors.lines?.root?.message;
            const systemGenerated = isSystemGenerated(editingRow);

            // A manual entry's cells are still real, editable RHF-bound
            // inputs -- they just shouldn't look like it. MUI's default
            // outlined TextField/Autocomplete draws its own rounded border
            // and background inside the cell, so every field reads as a
            // separate little box floating inside the table's own border --
            // two borders stacked, one from the cell grid and one from the
            // input. Stripping the input's own outline and background
            // leaves only the table's grid line, so clicking into a cell
            // feels like editing a spreadsheet cell rather than filling out
            // a form that happens to sit in a table.
            const cellFieldSx = {
              '& .MuiOutlinedInput-root': { borderRadius: 0, backgroundColor: 'transparent' },
              '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
              '& .Mui-focused .MuiOutlinedInput-notchedOutline': { border: '1px solid', borderColor: 'primary.main' },
              // Matches LINES_TABLE_CELL_PADDING_Y (top-of-file constant) so
              // the field's own padding doesn't add back the row height that
              // constant was trimmed to remove.
              '& .MuiOutlinedInput-input, & .MuiAutocomplete-input': { padding: `${LINES_TABLE_CELL_PADDING_Y}px 4px` },
            };
            // Drop the dropdown arrow on the two "search-style" line selects
            // (G/L Account, Business Partner) -- selecting still works by
            // typing or via their Find popup, and the plain caret makes the
            // cell read less like a rigid <select> box, closer to a
            // free-typed spreadsheet cell.
            const noArrowSx = {
              '& .MuiAutocomplete-popupIndicator': { display: 'none' },
            };

            return (
              <>
                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight={700}>
                        {systemGenerated ? 'Journal Entry (System Generated)' : readOnly ? 'View Journal Entry' : editingRow ? 'Edit Journal Entry' : 'New Journal Entry'}
                      </Typography>
                      <Button type="button" variant="outlined" color="inherit" startIcon={<CloseIcon />} onClick={closeForm}>
                        Close
                      </Button>
                    </Stack>

                    {/* Why this entry cannot be edited — stated where somebody
                        looking for an Edit button would look for it, rather
                        than leaving a screen that silently refuses to save. */}
                    {systemGenerated && (
                      <Alert severity="info" sx={{ mb: 2 }}>
                        Generated automatically from <strong>{editingRow.sourceType} {editingRow.sourceDocNo}</strong>.
                        {' '}Its accounts and amounts come from that document and from G/L Account Determination, so they
                        cannot be changed here — amend the document and this entry is rebuilt from it.
                      </Alert>
                    )}

                    {/* A parked entry names the exact configuration gap that
                        stopped it, because "posting failed" sends somebody
                        hunting and "no Revenue account for Product Group
                        Electronics" is a five-second fix. */}
                    {editingRow?.status === 'Pending G/L' && (
                      <Alert
                        severity="warning"
                        sx={{ mb: 2 }}
                        action={(
                          <Button
                            color="inherit"
                            size="small"
                            disabled={postingToGl}
                            onClick={() => handlePostToGl(editingRow)}
                          >
                            Post to G/L
                          </Button>
                        )}
                      >
                        <strong>Awaiting G/L posting.</strong> {editingRow.glError}
                      </Alert>
                    )}

                    {/* Label-left field layout — same LabeledField concept as
                        Product Master's "Edit Items / Material" reference
                        template (see components/form/LabeledField.jsx): a
                        plain label sits to the left of a plain box instead of
                        this app's usual floating-label style. Every
                        FormTextField/FormSelect/FormDatePicker/DocumentNoField
                        below is given label="" so LabeledField's own label is
                        the only one that renders. */}
                    <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                      <LabeledField label="Journal Entry No *">
                        <DocumentNoField documentCode="JE" name="journalEntryNo" label="" isCreate={!editingRow} />
                      </LabeledField>
                      <LabeledField label="Branch *">
                        <FormSelect name="branch" label="" placeholder="Select branch" options={branchOptions} />
                      </LabeledField>

                      {/* Always read-only. A hand-typed entry is a MANUAL
                          entry by definition — every other type is stamped by
                          the posting engine on the document that caused it,
                          and the server rejects any attempt to set it from
                          here. Shown rather than hidden because on a system
                          entry it is the most useful field on the form. */}
                      <LabeledField label="Origin *">
                        <FormSelect
                          name="transactionType"
                          label=""
                          options={JOURNAL_ENTRY_TRANSACTION_TYPE_OPTIONS}
                          disabled
                          helperText={systemGenerated ? undefined : 'Manual — set automatically for entries typed here'}
                        />
                      </LabeledField>
                      {/* Origin No — for a manual entry (Origin = Manual)
                          this is a second, independent number allocated
                          from its own series (documentCode 'JEO'), typed
                          and auto-generated exactly the way Journal Entry
                          No is. A system-generated entry has no series
                          number here at all -- its Origin No is simply the
                          source document that generated it, shown
                          read-only from the entry's own sourceDocNo. */}
                      <LabeledField label="Origin No">
                        {systemGenerated ? (
                          <TextField label="" value={editingRow?.sourceDocNo || ''} size="small" fullWidth disabled InputLabelProps={{ shrink: true }} />
                        ) : (
                          <DocumentNoField documentCode="JEO" name="originNo" label="" isCreate={!editingRow} />
                        )}
                      </LabeledField>

                      
                      <LabeledField label="Posting Date *">
                        <FormDatePicker name="postingDate" label="" />
                      </LabeledField>

                      <LabeledField label="Document Date *">
                        <FormDatePicker name="documentDate" label="" />
                      </LabeledField>
                      {/* System-generated: filled in from the source
                          document's own due date where it has one (Invoice,
                          Return, Credit Memo, Payment Receipt/Voucher) —
                          left blank for a GRN, Delivery Challan or stock
                          document, none of which has a due date to carry.
                          Manual: optional, left blank unless the user sets
                          one. */}
                      <LabeledField label="Due Date">
                        <FormDatePicker name="dueDate" label="" />
                      </LabeledField>

                      <LabeledField label="Currency *">
                        <FormSelect name="currency" label="" options={currencyOptions} />
                      </LabeledField>
                      <LabeledField label="Exchange Rate *">
                        <FormTextField name="exchangeRate" label="" type="number" />
                      </LabeledField>

                      <LabeledField label="Ref 1">
                        <FormTextField name="ref1" label="" placeholder="Optional" />
                      </LabeledField>
                      <LabeledField label="Ref 2">
                        <FormTextField name="ref2" label="" placeholder="Optional" />
                      </LabeledField>

                      <LabeledField label="Ref 3">
                        <FormTextField name="ref3" label="" placeholder="Optional" />
                      </LabeledField>
                      <LabeledField label="Narration">
                        <FormTextField name="narration" label="" placeholder="Optional" />
                      </LabeledField>
                      {/* Total Amount is always the entry's own total debit
                          (== total credit once balanced) -- shown, never
                          typed. */}
                      <LabeledField label="Total Amount">
                        <TextField label="" value={totalDebit.toFixed(2)} size="small" fullWidth disabled InputLabelProps={{ shrink: true }} />
                      </LabeledField>
                    </FormGrid>

                    <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 2 }}>
                      <Controller
                        name="reviseDateEnabled"
                        control={control}
                        render={({ field }) => (
                          <FormControlLabel
                            label="Revise Date"
                            control={(
                              <Checkbox
                                checked={Boolean(field.value)}
                                onChange={(e) => field.onChange(e.target.checked)}
                                disabled={readOnly}
                              />
                            )}
                          />
                        )}
                      />
                      {watchedReviseDateEnabled && (
                        <Box sx={{ maxWidth: 220 }}>
                          <FormDatePicker name="reviseDate" label="Revise Date" />
                        </Box>
                      )}
                    </Stack>
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight={700}>Journal Lines</Typography>
                      {!readOnly && (
                        <Button type="button" variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => append(emptyLine())}>
                          Add Line
                        </Button>
                      )}
                    </Stack>

                    {linesError && (
                      <Typography variant="caption" color="error" display="block" sx={{ mb: 1.5 }}>
                        {linesError}
                      </Typography>
                    )}

                    {/* The line grid sits outside FormGrid, which is what
                        AppForm normally uses to switch a read-only form's
                        fields off — so it carries its own disabled fieldset.
                        Without it a system-generated entry would look
                        editable right up until the server refused the save. */}
                    <Box
                      component="fieldset"
                      disabled={readOnly}
                      sx={{ border: 0, p: 0, m: 0, minWidth: 0, width: '100%', display: 'block' }}
                    >
                    {isMobile ? (
                      <Box>
                        {fields.map((field, index) => {
                          const line = watchedLines[index] || {};
                          return readOnly ? (
                            <MobileItemCard
                              key={field.id}
                              index={index}
                              amount={(Number(line.debit) || Number(line.credit) || 0).toFixed(2)}
                              removeDisabled
                            >
                              <Typography variant="body2"><strong>G/L Account:</strong> {line.accountName ? `${line.accountName} (${line.accountCode})` : (accountByCode.get(line.accountCode)?.accountName || line.accountCode || '—')}</Typography>
                              <Typography variant="body2"><strong>Description:</strong> {line.description || '—'}</Typography>
                              <Typography variant="body2"><strong>Branch:</strong> {line.branch || '—'}</Typography>
                              <Typography variant="body2"><strong>Business Partner:</strong> {line.businessPartnerName || (businessPartnerByCode.get(line.businessPartnerCode)?.partnerName) || '—'}</Typography>
                              <Typography variant="body2" sx={{ textAlign: 'right' }}><strong>Debit (₹):</strong> {(Number(line.debit) || 0).toFixed(2)}</Typography>
                              <Typography variant="body2" sx={{ textAlign: 'right' }}><strong>Credit (₹):</strong> {(Number(line.credit) || 0).toFixed(2)}</Typography>
                              <Typography variant="body2"><strong>Ref 1:</strong> {line.ref1 || '—'}</Typography>
                              <Typography variant="body2"><strong>Ref 2:</strong> {line.ref2 || '—'}</Typography>
                              <Typography variant="body2"><strong>Ref 3:</strong> {line.ref3 || '—'}</Typography>
                              {(() => {
                                // Debit(SC)/Credit(SC) are still computed here
                                // (computeLineDerived) and still saved by the
                                // server/DB on every line -- only their
                                // display on this screen is hidden, on
                                // request. Base Amount stays visible.
                                const derived = computeLineDerived(line, watchedExchangeRate);
                                return (
                                  <Typography variant="body2"><strong>Base Amount:</strong> {derived.baseAmount.toFixed(2)}</Typography>
                                );
                              })()}
                            </MobileItemCard>
                          ) : (
                            <MobileItemCard
                              key={field.id}
                              index={index}
                              amount={(Number(watch(`lines.${index}.debit`)) || Number(watch(`lines.${index}.credit`)) || 0).toFixed(2)}
                              onRemove={() => removeLine(index)}
                            >
                              <FormSelect
                                name={`lines.${index}.accountCode`}
                                label="G/L Account *"
                                placeholder="Search…"
                                options={accountOrPartnerOptions}
                              />
                              <FormTextField name={`lines.${index}.description`} label="Description" />
                              <FormSelect name={`lines.${index}.branch`} label="Branch" placeholder="Select branch" options={branchOptions} />
                              <FormSelect
                                name={`lines.${index}.businessPartnerCode`}
                                label="Business Partner"
                                placeholder="Optional — Customer or Vendor"
                                options={businessPartnerOptions}
                              />
                              <FormTextField name={`lines.${index}.debit`} label="Debit (₹)" type="number" />
                              <FormTextField name={`lines.${index}.credit`} label="Credit (₹)" type="number" />
                              <FormTextField name={`lines.${index}.ref1`} label="Ref 1" placeholder="Optional" />
                              <FormTextField name={`lines.${index}.ref2`} label="Ref 2" placeholder="Optional" />
                              <FormTextField name={`lines.${index}.ref3`} label="Ref 3" placeholder="Optional" />
                            </MobileItemCard>
                          );
                        })}
                        {fields.length === 0 && (
                          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>No journal lines yet</Typography>
                        )}
                      </Box>
                    ) : (
                    <TableContainer
                      ref={itemScrollRef}
                      sx={{
                        overflow: 'auto',
                        maxHeight: LINES_TABLE_MAX_HEIGHT,
                        cursor: 'grab',
                        // A fully ruled grid, in both modes: read-only (a view,
                        // or a system-generated entry) shows the posted figures
                        // as plain text -- an input-shaped box invites editing
                        // that the server would refuse anyway -- and a manual
                        // entry's own cell inputs have their MUI outline
                        // stripped (see cellFieldSx above) so the grid line is
                        // the only border either mode ever shows.
                        ...LINES_TABLE_CELL_BORDER,
                        '& .MuiTableCell-root': LINES_TABLE_CELL_BORDER,
                        ...dragScrollbarSx,
                      }}
                    >
                      <Table
                        size="small"
                        stickyHeader
                        sx={{
                          '& th, & td': {
                            height: LINES_TABLE_ROW_HEIGHT,
                            paddingTop: `${LINES_TABLE_CELL_PADDING_Y}px`,
                            paddingBottom: `${LINES_TABLE_CELL_PADDING_Y}px`,
                            boxSizing: 'border-box',
                            // Every cell's content -- input, plain display
                            // text, icon button -- sits centered on the
                            // row's own vertical midline rather than
                            // top-aligned, so cells of differing content
                            // height (a field with a validation message
                            // showing vs. one without, an icon button vs.
                            // a text field) still read as one even row.
                            verticalAlign: 'middle',
                          },
                        }}
                      >
                        <TableHead>
                          <TableRow>
                            <TableCell width={40}>#</TableCell>
                            {/* No minWidth on these two -- G/L Account and
                                Business Partner now auto-size to their own
                                selected text (see autoWidth on FormSelect
                                below) rather than being forced into a fixed,
                                truncating box. */}
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>G/L Acct/BP No. *</TableCell>
                            <TableCell sx={{ minWidth: 200 }}>G/L Acct/BP Name</TableCell>
                            <TableCell sx={{ minWidth: 200 }}>Description</TableCell>
                            <TableCell sx={{ minWidth: 180 }}>Branch</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>Business Partner</TableCell>
                            <TableCell sx={{ minWidth: 130 }} align="right">Debit (₹)</TableCell>
                            <TableCell sx={{ minWidth: 130 }} align="right">Credit (₹)</TableCell>
                            {/* Per-line Ref 1/2/3 -- free text, distinct from
                                the header's own Ref 1/2/3 fields. */}
                            <TableCell sx={{ minWidth: 130 }}>Ref 1</TableCell>
                            <TableCell sx={{ minWidth: 130 }}>Ref 2</TableCell>
                            <TableCell sx={{ minWidth: 130 }}>Ref 3</TableCell>
                            {/* Debit(SC)/Credit(SC) are still computed and
                                saved by the server/DB on every line -- only
                                their column on this screen is hidden, on
                                request. */}
                            <TableCell align="right" sx={{ minWidth: 130 }}>Base Amount</TableCell>
                            {!readOnly && <TableCell width={48} />}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {fields.map((field, index) => {
                            const line = watchedLines[index] || {};
                            const derived = computeLineDerived(line, watchedExchangeRate);
                            return readOnly ? (
                              <TableRow key={field.id}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell>{line.accountCode || '—'}</TableCell>
                                <TableCell>{line.accountName || accountByCode.get(line.accountCode)?.accountName || '—'}</TableCell>
                                <TableCell>{line.description || '—'}</TableCell>
                                <TableCell>{line.branch || '—'}</TableCell>
                                <TableCell>{line.businessPartnerName || businessPartnerByCode.get(line.businessPartnerCode)?.partnerName || '—'}</TableCell>
                                <TableCell align="right">{(Number(line.debit) || 0).toFixed(2)}</TableCell>
                                <TableCell align="right">{(Number(line.credit) || 0).toFixed(2)}</TableCell>
                                <TableCell>{line.ref1 || '—'}</TableCell>
                                <TableCell>{line.ref2 || '—'}</TableCell>
                                <TableCell>{line.ref3 || '—'}</TableCell>
                                <TableCell>{derived.baseAmount.toFixed(2)}</TableCell>
                              </TableRow>
                            ) : (
                              <TableRow key={field.id}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell sx={{ p: 0.5 }}>
                                  <Stack direction="row" alignItems="center" spacing={0.25}>
                                    {/* autoWidth: the box grows/shrinks with
                                        the account code+name as it's typed
                                        or selected, instead of stretching to
                                        fill the column (fullWidth) or
                                        truncating inside a fixed one. */}
                                    <FormSelect
                                      name={`lines.${index}.accountCode`}
                                      label=""
                                      placeholder="Search…"
                                      options={accountOrPartnerOptions}
                                      autoWidth
                                      popupIcon={null}
                                      reserveHelperSpace={false}
                                      sx={{ ...cellFieldSx, ...noArrowSx }}
                                    />
                                    {/* Plain click opens the Find Accounts
                                        popup (Chart Of Accounts,
                                        searchable/paginated) as an
                                        alternative to typing into the
                                        dropdown above — same picker the
                                        legacy Journal Entry screen used.
                                        Ctrl/Cmd+click instead opens Find
                                        Business Partner — this column (G/L
                                        Acct/BP No. — the name says it) is
                                        meant to hold either one, so a
                                        partner picked this way fills the
                                        very same accountCode/accountName
                                        pair a G/L account would, rather than
                                        the separate Business Partner column
                                        further along the row. */}
                                    <IconButton
                                      type="button"
                                      size="small"
                                      aria-label="find accounts"
                                      onClick={(e) => {
                                        if (e.ctrlKey || e.metaKey) {
                                          setFindBpLineIndex(index);
                                        } else {
                                          setFindAccountsLineIndex(index);
                                        }
                                      }}
                                      title="Click: Find Accounts · Ctrl/Cmd+click: Find Business Partner"
                                    >
                                      <SearchIcon fontSize="small" />
                                    </IconButton>
                                  </Stack>
                                </TableCell>
                                <TableCell sx={{ p: 0.5 }}>
                                  <Typography variant="body2" color="text.secondary" sx={{ px: 0.5, py: 0.75 }}>
                                    {line.accountName || accountByCode.get(line.accountCode)?.accountName || '—'}
                                  </Typography>
                                </TableCell>
                                <TableCell sx={{ p: 0.5 }}>
                                  <FormTextField name={`lines.${index}.description`} label="" placeholder="e.g. Being expense accrued" reserveHelperSpace={false} sx={cellFieldSx} />
                                </TableCell>
                                <TableCell sx={{ p: 0.5 }}>
                                  <FormSelect name={`lines.${index}.branch`} label="" placeholder="Select branch" options={branchOptions} reserveHelperSpace={false} sx={cellFieldSx} />
                                </TableCell>
                                <TableCell sx={{ p: 0.5 }}>
                                  {/* autoWidth: same reasoning as the G/L
                                      Account field above. */}
                                  <FormSelect
                                    name={`lines.${index}.businessPartnerCode`}
                                    label=""
                                    placeholder="Optional"
                                    options={businessPartnerOptions}
                                    autoWidth
                                    popupIcon={null}
                                    reserveHelperSpace={false}
                                    sx={{ ...cellFieldSx, ...noArrowSx }}
                                  />
                                </TableCell>
                                <TableCell sx={{ p: 0.5 }}>
                                  <FormTextField name={`lines.${index}.debit`} label="" type="number" reserveHelperSpace={false} sx={cellFieldSx} onValueChange={(v, p) => mirrorAmount(index, 'debit', v, p)} />
                                </TableCell>
                                <TableCell sx={{ p: 0.5 }}>
                                  <FormTextField name={`lines.${index}.credit`} label="" type="number" reserveHelperSpace={false} sx={cellFieldSx} onValueChange={(v, p) => mirrorAmount(index, 'credit', v, p)} />
                                </TableCell>
                                {/* Per-line Ref 1/2/3 -- plain free text,
                                    distinct from the header's own Ref 1/2/3
                                    fields. */}
                                <TableCell sx={{ p: 0.5 }}>
                                  <FormTextField name={`lines.${index}.ref1`} label="" placeholder="Optional" reserveHelperSpace={false} sx={cellFieldSx} />
                                </TableCell>
                                <TableCell sx={{ p: 0.5 }}>
                                  <FormTextField name={`lines.${index}.ref2`} label="" placeholder="Optional" reserveHelperSpace={false} sx={cellFieldSx} />
                                </TableCell>
                                <TableCell sx={{ p: 0.5 }}>
                                  <FormTextField name={`lines.${index}.ref3`} label="" placeholder="Optional" reserveHelperSpace={false} sx={cellFieldSx} />
                                </TableCell>
                                {/* Base Amount is never an input, even while
                                    editing -- it's always derived from
                                    Debit/Credit (computeLineDerived above),
                                    recomputed live as those change, and the
                                    server recomputes its own authoritative
                                    copy on save regardless. Debit(SC)/
                                    Credit(SC) are still computed here and
                                    still saved by the server/DB on every
                                    line -- only their column on this screen
                                    is hidden, on request. */}
                                <TableCell align="right">
                                  <Typography variant="body2" color="text.secondary">{derived.baseAmount.toFixed(2)}</Typography>
                                </TableCell>
                                <TableCell>
                                  <IconButton type="button" size="small" color="error" onClick={() => removeLine(index)} aria-label="remove line">
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {fields.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={readOnly ? 12 : 13}>
                                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>No journal lines yet</Typography>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                        {fields.length > 0 && (
                          <TableBody>
                            <TableRow>
                              <TableCell colSpan={6} />
                              <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }} align="right">₹{totalDebit.toFixed(2)}</TableCell>
                              <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }} align="right">₹{totalCredit.toFixed(2)}</TableCell>
                              <TableCell colSpan={readOnly ? 4 : 5} />
                            </TableRow>
                          </TableBody>
                        )}
                      </Table>
                    </TableContainer>
                    )}
                    </Box>

                    <FindAccountsDialog
                      open={findAccountsLineIndex !== null}
                      accounts={findAccountsRows}
                      onClose={() => setFindAccountsLineIndex(null)}
                      onSelect={(account) => {
                        if (findAccountsLineIndex !== null) {
                          setValue(`lines.${findAccountsLineIndex}.accountCode`, account.accountCode, { shouldDirty: true, shouldValidate: true });
                          setValue(`lines.${findAccountsLineIndex}.accountName`, account.accountName, { shouldDirty: true });
                        }
                        setFindAccountsLineIndex(null);
                      }}
                    />

                    {/* Ctrl/Cmd+click on the same search icon opens this
                        instead — selecting a partner here fills the same
                        G/L Acct/BP No. / Name pair a Find Accounts pick
                        would (accountCode/accountName), since that column
                        is meant to hold either one. The separate Business
                        Partner column further along the row is a distinct
                        field and is left untouched by this picker. */}
                    <FindBusinessPartnersDialog
                      open={findBpLineIndex !== null}
                      partners={findBusinessPartnersRows}
                      onClose={() => setFindBpLineIndex(null)}
                      onSelect={(partner) => {
                        if (findBpLineIndex !== null) {
                          setValue(`lines.${findBpLineIndex}.accountCode`, partner.partnerCode, { shouldDirty: true, shouldValidate: true });
                          setValue(`lines.${findBpLineIndex}.accountName`, partner.partnerName, { shouldDirty: true });
                        }
                        setFindBpLineIndex(null);
                      }}
                    />

                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                      <Box sx={{ border: '1px solid', borderColor: isBalanced ? 'divider' : 'error.main', borderRadius: 1.5, p: 2, minWidth: 260 }}>
                        <Stack spacing={0.5}>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" color="text.secondary">Total Debit</Typography>
                            <Typography variant="body2" fontWeight={700}>₹{totalDebit.toFixed(2)}</Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" color="text.secondary">Total Credit</Typography>
                            <Typography variant="body2" fontWeight={700}>₹{totalCredit.toFixed(2)}</Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" color={isBalanced ? 'success.main' : 'error.main'} fontWeight={700}>
                              {isBalanced ? 'Balanced' : 'Difference'}
                            </Typography>
                            {!isBalanced && (
                              <Typography variant="body2" color="error.main" fontWeight={700}>₹{Math.abs(difference).toFixed(2)}</Typography>
                            )}
                          </Stack>
                        </Stack>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>

                <Card variant="outlined">
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <Grid container spacing={3}>
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Remarks</Typography>
                        <FormTextField name="remarks" label="" placeholder="Enter any additional remarks (optional)" multiline rows={2} />
                      </Grid>
                    </Grid>

                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1.5}
                      justifyContent={{ xs: 'stretch', sm: 'flex-end' }}
                      sx={{ mt: 3 }}
                    >
                      <Button fullWidth={isMobile} type="button" variant="outlined" color={readOnly ? 'error' : 'inherit'} startIcon={<CloseIcon />} onClick={closeForm} disabled={creating || updating}>
                        {readOnly ? 'Close' : 'Cancel'}
                      </Button>
                      <FormSubmitButton
                        fullWidth={isMobile}
                        variant="outlined"
                        onClick={() => setPendingStatus('Draft')}
                        disabled={creating || updating}
                      >
                        Save as Draft
                      </FormSubmitButton>
                      <FormSubmitButton
                        fullWidth={isMobile}
                        onClick={() => setPendingStatus('Posted')}
                        disabled={creating || updating || !isBalanced}
                        disabledReason="Total debit must equal total credit before this entry can be posted"
                      >
                        Save & Post
                      </FormSubmitButton>
                    </Stack>
                  </CardContent>
                </Card>
              </>
            );
          }}
        </AppForm>
      </Box>
      </Collapse>

      <Card variant="outlined">
          <CardContent sx={{ p: 0 }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              alignItems={{ xs: 'stretch', md: 'center' }}
              justifyContent="space-between"
              flexWrap="wrap"
              gap={1.5}
              sx={{ px: { xs: 2, sm: 3 }, pt: 2.5, pb: 1.5 }}
            >
              <Typography variant="subtitle1" fontWeight={700}>Journal Entry List</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap sx={{ width: { xs: '100%', md: 'auto' } }}>
                <TableSearchFilter table={table} placeholder="Search by entry no., reference..." showFilter={false} />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
                  <Button
                    variant="outlined"
                    color="inherit"
                    startIcon={<FilterListIcon />}
                    onClick={() => setShowFilters((v) => !v)}
                    sx={{ width: { xs: '100%', sm: 'auto' }, height: 40, whiteSpace: 'nowrap' }}
                  >
                    Filter
                  </Button>
                  <CanAdd>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={openCreate}
                      sx={{ width: { xs: '100%', sm: 'auto' }, height: 40, whiteSpace: 'nowrap' }}
                    >
                      New Journal Entry
                    </Button>
                  </CanAdd>
                </Stack>
              </Stack>
            </Stack>

            <Collapse in={showFilters} unmountOnExit>
              <Box sx={{ px: { xs: 2, sm: 3 }, pb: 2 }}>
                <FormGrid columns={4} singleColumnOnMobile>
                  <Autocomplete
                    size="small"
                    options={STATUS_FILTERS}
                    value={statusFilter}
                    onChange={(_e, v) => { setStatusFilter(v || 'All Status'); setPage(0); }}
                    disableClearable
                    renderInput={(params) => <TextField {...params} label="Status" InputLabelProps={{ shrink: true }} />}
                  />
                </FormGrid>
                <TableFilterPanel table={table} embedded open />
              </Box>
            </Collapse>

            {isMobile ? (
              <Box sx={{ px: 2, pb: 1 }}>
                {!isLoading && pagedRows.map((row) => (
                  <MobileRecordCard
                    key={row.id}
                    title={row.journalEntryNo}
                    statusChip={<Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />}
                    fields={[
                      { label: 'Transaction Type', value: row.transactionType || '—' },
                      { label: 'Source Document', value: row.sourceDocNo || 'Manual entry' },
                      { label: 'Posting Date', value: row.postingDate ? dayjs(row.postingDate).format('DD/MM/YYYY') : '—' },
                      { label: 'Reference', value: row.referenceNo || '—' },
                      { label: 'Total Debit', value: `₹${Number(row.totalDebit).toFixed(2)}` },
                      { label: 'Total Credit', value: `₹${Number(row.totalCredit).toFixed(2)}` },
                    ]}
                    onView={() => handleView(row)}
                    onEdit={() => handleEdit(row)}
                    onDelete={() => handleDelete(row)}
                  />
                ))}
                {!isLoading && filteredRows.length === 0 && (
                  <EmptyState icon={<CalculateOutlinedIcon sx={{ fontSize: 48 }} />} title="No journal entries found" message="Add your first journal entry to get started" />
                )}
              </Box>
            ) : (
              <ScrollableTableContainer>
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    '& th, & td': {
                      height: JOURNAL_LIST_TABLE_ROW_HEIGHT,
                      paddingTop: `${JOURNAL_LIST_TABLE_CELL_PADDING_Y}px`,
                      paddingBottom: `${JOURNAL_LIST_TABLE_CELL_PADDING_Y}px`,
                      boxSizing: 'border-box',
                    },
                  }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell width={40}>#</TableCell>
                      <SortableHeaderCell field="journalEntryNo" sort={table.sort} onSort={table.toggleSort}>Journal Entry No.</SortableHeaderCell>
                      <SortableHeaderCell field="transactionType" sort={table.sort} onSort={table.toggleSort}>Transaction Type</SortableHeaderCell>
                      <SortableHeaderCell field="sourceDocNo" sort={table.sort} onSort={table.toggleSort}>Source Document</SortableHeaderCell>
                      <SortableHeaderCell field="postingDate" sort={table.sort} onSort={table.toggleSort}>Posting Date</SortableHeaderCell>
                      <SortableHeaderCell field="referenceNo" sort={table.sort} onSort={table.toggleSort}>Reference</SortableHeaderCell>
                      <SortableHeaderCell field="totalDebit" sort={table.sort} onSort={table.toggleSort}>Total Debit (₹)</SortableHeaderCell>
                      <SortableHeaderCell field="totalCredit" sort={table.sort} onSort={table.toggleSort}>Total Credit (₹)</SortableHeaderCell>
                      <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {!isLoading && pagedRows.map((row, i) => (
                      <TableRow key={row.id} hover>
                        <TableCell>{page * pageSize + i + 1}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.journalEntryNo}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {row.transactionType || '—'}
                          {isReversalTransactionType(row.transactionType) && (
                            <Chip size="small" label="Reversal" color="secondary" variant="outlined" sx={{ ml: 1 }} />
                          )}
                        </TableCell>
                        {/* A manual entry has no source document, and saying
                            so is more useful than an em dash that could mean
                            either "none" or "missing". */}
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {row.sourceDocNo || (
                            <Typography variant="body2" color="text.secondary" component="span">Manual entry</Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.postingDate ? dayjs(row.postingDate).format('DD/MM/YYYY') : '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.referenceNo || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{Number(row.totalDebit).toFixed(2)}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{Number(row.totalCredit).toFixed(2)}</TableCell>
                        <TableCell>
                          <Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />
                        </TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => handleView(row)} aria-label="view">
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={(e) => { setRowMenuAnchor(e.currentTarget); setRowMenuTarget(row); }}
                            aria-label="more actions"
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!isLoading && filteredRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10}>
                          <EmptyState icon={<CalculateOutlinedIcon sx={{ fontSize: 48 }} />} title="No journal entries found" message="Add your first journal entry to get started" />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollableTableContainer>
            )}

            {/* Edit and Delete apply only to manual entries — a
                system-generated one is owned by its source document, and the
                server refuses both regardless. Post to G/L replaces them for
                a parked entry, which is the only action that makes sense on
                one. */}
            <Menu anchorEl={rowMenuAnchor} open={!!rowMenuAnchor} onClose={() => setRowMenuAnchor(null)}>
              {rowMenuTarget?.status === 'Pending G/L' && (
                <MenuItem onClick={() => handlePostToGl(rowMenuTarget)} disabled={postingToGl}>
                  <ListItemIcon><PublishOutlinedIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>Post to G/L</ListItemText>
                </MenuItem>
              )}
              {!isSystemGenerated(rowMenuTarget) && (
                <CanEdit>
                  <MenuItem onClick={() => handleEdit(rowMenuTarget)}>
                    <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Edit</ListItemText>
                  </MenuItem>
                </CanEdit>
              )}
              {!isSystemGenerated(rowMenuTarget) && (
                <CanDelete>
                  <MenuItem onClick={() => handleDelete(rowMenuTarget)}>
                    <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                    <ListItemText>Delete</ListItemText>
                  </MenuItem>
                </CanDelete>
              )}
              {isSystemGenerated(rowMenuTarget) && rowMenuTarget?.status !== 'Pending G/L' && (
                <MenuItem disabled>
                  <ListItemText
                    primary="Generated automatically"
                    secondary={`From ${rowMenuTarget.sourceType} ${rowMenuTarget.sourceDocNo}`}
                  />
                </MenuItem>
              )}
            </Menu>

            <EntityListPagination total={filteredRows.length} page={page} onChange={setPage} pageSize={pageSize} onPageSizeChange={(v) => { setPageSize(v); setPage(0); }} />
          </CardContent>
      </Card>
    </Box>
  );
}
