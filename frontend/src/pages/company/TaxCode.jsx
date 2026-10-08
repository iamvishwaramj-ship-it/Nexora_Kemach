import React, { useEffect, useMemo, useState } from 'react';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import { useFormContext } from 'react-hook-form';
import {
  Box, Typography, Button, Card, CardContent, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Paper,
} from '@mui/material';
import PercentIcon from '@mui/icons-material/Percent';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { z } from 'zod';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import { useUnsavedChangesGuard, FormDirtyTracker } from '../../components/form/useUnsavedChangesGuard';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { requiredString, optionalString, nonNegativeNumber, statusEnum, optionalDate, taxLabel } from '../../lib/validation/common';
import { taxCodeApi, chartOfAccountApi, financialYearApi, glAccountDeterminationApi } from '../../features/resources';
import { useResetTaxCodesMutation, useListTaxGLAccountsQuery } from '../../features/company/taxCodeExtraApi';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import { buildTaxGroupRows } from '../../lib/taxCodeGroups';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';

// SAP Business One (India) "Tax Code" screen, adapted to this app's naming
// (its "Tax Category" is our "Tax Type"): a header (Code / Name / Tax Type /
// Rate % / Effective From / Status) plus a table of tax-group rows that's
// GENERATED, not hand-entered -- GST expands to SGST + CGST at half the rate
// each, IGST stays a single row at the full rate. See buildTaxGroupRows in
// lib/taxCodeGroups.js (shared with GLAccountDeterminationForm.jsx, which
// renders the same rows across every Tax Code for the Sales/Purchasing Tax
// tabs there).
//
// Every visible tax-group row requires its Sales and Purchase account before
// save (validated below) -- those are what GL posting actually needs. RCM
// (reverse charge) is left optional for now: the field exists so it can be
// mapped, but nothing in this app posts reverse-charge entries yet, so
// forcing every tax code to have one on day one would just be busywork.
// Every Sales/Purchase/RCM tax account field on the record — see the
// TaxCode model comment in schema.prisma.
const TAX_ACCOUNT_FIELDS = [
  'sgstSalesAccountId', 'sgstPurchaseAccountId', 'sgstRcmAccountId',
  'cgstSalesAccountId', 'cgstPurchaseAccountId', 'cgstRcmAccountId',
  'igstSalesAccountId', 'igstPurchaseAccountId', 'igstRcmAccountId',
  'tcsSalesAccountId', 'tcsPurchaseAccountId', 'tcsRcmAccountId',
];

const INVALID_TAX_ACCOUNT_MESSAGE = 'Invalid Tax Account. Please select a GST account (Chart of Account name contains "GST" and is Active).';

// A factory rather than a module-level constant: which account ids are valid
// is dynamic — Chart of Account rows whose name contains "GST" and are
// Active (see backend/src/utils/taxGlAccountFilter.js, the server-side twin
// of this check) — so the schema has to be rebuilt whenever that set changes.
// `allowedAccountIds` is a Set<number>; this is what turns "loaded an
// existing record whose saved account no longer qualifies" into a blocked
// save rather than a silent pass-through — the same rule the server
// re-enforces regardless of what this schema already caught.
function buildTaxCodeDetailsSchema(allowedAccountIds) {
  return z.object({
    taxCode: taxLabel('Tax code'),
    taxName: taxLabel('Tax name'),
    taxType: requiredString('Tax type'),
    taxRate: nonNegativeNumber('Rate', 100),
    effectiveFrom: optionalDate('Effective from'),
    description: optionalString(),
    status: statusEnum(),
    sgstSalesAccountId: z.union([z.number(), z.null()]).optional(),
    sgstPurchaseAccountId: z.union([z.number(), z.null()]).optional(),
    sgstRcmAccountId: z.union([z.number(), z.null()]).optional(),
    cgstSalesAccountId: z.union([z.number(), z.null()]).optional(),
    cgstPurchaseAccountId: z.union([z.number(), z.null()]).optional(),
    cgstRcmAccountId: z.union([z.number(), z.null()]).optional(),
    igstSalesAccountId: z.union([z.number(), z.null()]).optional(),
    igstPurchaseAccountId: z.union([z.number(), z.null()]).optional(),
    igstRcmAccountId: z.union([z.number(), z.null()]).optional(),
    tcsSalesAccountId: z.union([z.number(), z.null()]).optional(),
    tcsPurchaseAccountId: z.union([z.number(), z.null()]).optional(),
    tcsRcmAccountId: z.union([z.number(), z.null()]).optional(),
  }).superRefine((values, ctx) => {
    for (const row of buildTaxGroupRows(values)) {
      if (values[row.salesField] == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [row.salesField], message: `${row.group} Sales Tax Account is required` });
      }
      if (values[row.purchaseField] == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [row.purchaseField], message: `${row.group} Purchase Tax Account is required` });
      }
    }
    for (const field of TAX_ACCOUNT_FIELDS) {
      const v = values[field];
      if (v != null && !allowedAccountIds.has(v)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: INVALID_TAX_ACCOUNT_MESSAGE });
      }
    }
  });
}

const emptyValues = {
  taxCode: '', taxName: '', taxType: '', taxRate: '', effectiveFrom: null, description: '', status: 'Active',
  sgstSalesAccountId: null, sgstPurchaseAccountId: null, sgstRcmAccountId: null,
  cgstSalesAccountId: null, cgstPurchaseAccountId: null, cgstRcmAccountId: null,
  igstSalesAccountId: null, igstPurchaseAccountId: null, igstRcmAccountId: null,
  tcsSalesAccountId: null, tcsPurchaseAccountId: null, tcsRcmAccountId: null,
};

// "GST 12%" and "GST12%" read as the same tax code to a person even though
// they're different strings byte-for-byte — collapse whitespace and case
// before comparing so a re-typed duplicate with different spacing is still
// caught client-side before it ever reaches the server. `%`, `_` and `-` are
// stripped too, not just whitespace/case, now that the Tax Code/Tax Name
// fields allow them as real characters — "GST 18%", "GST_18%" and "GST-18%"
// all read as the same tax code to a person. Mirrors the same normalisation
// the backend applies in routes/company.js (normaliseTaxLabel /
// findDuplicateTaxCode) — the two are duplicated, not shared, so keep them
// in sync by hand if either changes.
const normaliseTaxLabel = (v) => String(v ?? '').replace(/[\s%_-]+/g, '').toLowerCase();

function findDuplicateTaxCode(values, existingRows, ignoreId) {
  const normCode = normaliseTaxLabel(values.taxCode);
  const normName = normaliseTaxLabel(values.taxName);
  return existingRows.find((r) => {
    if (ignoreId != null && r.id === ignoreId) return false;
    return (normCode && normaliseTaxLabel(r.taxCode) === normCode)
        || (normName && normaliseTaxLabel(r.taxName) === normName);
  });
}

// Tax Type is GST (splits SGST+CGST), IGST (posts as-is), or the two with a
// flat 1% TCS row added on top — GST+TCS / IGST+TCS. See the TaxCode model
// comment in schema.prisma and buildTaxGroupRows (lib/taxCodeGroups.js),
// which is what actually expands whichever of these four is picked into the
// Tax Details table's rows below.
const TAX_TYPE_OPTIONS = [
  { label: 'GST', value: 'GST' },
  { label: 'IGST', value: 'IGST' },
  { label: 'GST+TCS', value: 'GST+TCS' },
  { label: 'IGST+TCS', value: 'IGST+TCS' },
];

// This form's labels (Tax Code, Tax Name, Tax Type, Rate, Effective From,
// Status) are all short — the shared FIELD_LABEL_WIDTH is sized for the
// app's longest labels elsewhere, which on this page just left a wide gap
// of blank space between each label and its input. Narrowed here via
// LabeledField's own labelWidth prop rather than lowering the shared
// constant, so other pages with longer labels are unaffected.
const TAX_CODE_LABEL_WIDTH = 100;

// Width (px) of the G/L Account select's OPEN dropdown, and how much of it
// the Code column takes — same select2-style Code/Name popup as GL Account
// Determination (see AccountCodeDropdownPaper there); duplicated here rather
// than shared since neither file imports from the other today.
const ACCOUNT_CODE_DROPDOWN_WIDTH = 340;
const ACCOUNT_CODE_DROPDOWN_CODE_WIDTH = 120;
const ACCOUNT_SELECT_HEIGHT = 32;

function AccountCodeDropdownPaper({ children, ...paperProps }) {
  return (
    <Paper {...paperProps}>
      <Box
        sx={{
          display: 'flex',
          px: 2,
          py: 0.75,
          borderBottom: 1,
          borderColor: 'divider',
          typography: 'caption',
          fontWeight: 700,
          color: 'text.secondary',
        }}
      >
        <Box sx={{ width: ACCOUNT_CODE_DROPDOWN_CODE_WIDTH, flexShrink: 0 }}>Account Code</Box>
        <Box sx={{ flex: 1 }}>Account Name</Box>
      </Box>
      {children}
    </Paper>
  );
}

function renderAccountCodeOption(liProps, option) {
  return (
    <li {...liProps}>
      <Box sx={{ display: 'flex', width: '100%' }}>
        <Box sx={{ width: ACCOUNT_CODE_DROPDOWN_CODE_WIDTH, flexShrink: 0 }}>{option.code}</Box>
        <Box sx={{ flex: 1, color: 'text.secondary' }}>{option.accountName || '—'}</Box>
      </Box>
    </li>
  );
}

// A single Sales/Purchase/RCM account cell inside the tax-group table —
// same compact select2-style Account Code picker as GL Account
// Determination's DeterminationRow, just parameterised by field name.
//
// `accountOptions` is already filtered to GST accounts (name contains "GST",
// Active — see TaxCode() below and backend/src/utils/taxGlAccountFilter.js)
// — it is NEVER the full chart of accounts. `accountsById` (the full,
// unfiltered chart of accounts, used for display only) is what lets an
// existing record's saved account still be shown even if it no longer
// qualifies: the field's current value may point at an id that isn't in
// accountOptions (the account's name or Active status changed since this
// Tax Code was last saved). Rather than rendering a
// blank box in that case, the stale account is appended as a one-off,
// clearly-flagged option so it stays visible — and the schema's own
// superRefine (see buildTaxCodeDetailsSchema) blocks Save until the user
// swaps it for a valid one.
function TaxGroupAccountCell({ name, accountOptions, accountsById }) {
  const { watch } = useFormContext();
  const value = watch(name);
  const isValidSelection = value == null || accountOptions.some((o) => o.value === value);
  const staleAccount = !isValidSelection ? accountsById.get(value) : null;
  const options = staleAccount
    ? [...accountOptions, {
        label: staleAccount.accountCode,
        value: staleAccount.id,
        code: staleAccount.accountCode,
        accountName: staleAccount.accountName,
        invalid: true,
      }]
    : accountOptions;

  return (
    <TableCell sx={{ minWidth: 170 }}>
      <FormSelect
        name={name}
        label=""
        placeholder="Search…"
        options={options}
        size="small"
        fullWidth
        sx={{
          '& .MuiOutlinedInput-root': { height: ACCOUNT_SELECT_HEIGHT, minHeight: ACCOUNT_SELECT_HEIGHT },
          '& .MuiAutocomplete-input': { py: '2px' },
          '& .MuiFormHelperText-root': { display: 'none' },
          ...(value != null && !isValidSelection
            ? { '& .MuiOutlinedInput-root, & .MuiOutlinedInput-notchedOutline': { borderColor: 'error.main' } }
            : {}),
        }}
        PaperComponent={AccountCodeDropdownPaper}
        renderOption={renderAccountCodeOption}
        componentsProps={{ popper: { style: { width: ACCOUNT_CODE_DROPDOWN_WIDTH } } }}
        noOptionsText="No GST Accounts Found"
      />
      {value != null && !isValidSelection && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
          <WarningAmberIcon color="error" sx={{ fontSize: 14 }} />
          <Typography variant="caption" color="error.main" sx={{ lineHeight: 1.2 }}>
            Not a valid GST tax account — pick another
          </Typography>
        </Box>
      )}
    </TableCell>
  );
}

// The "Sl.No / Tax Group / Rate (%) / Sales Tax Account / Purchase Tax
// Account / RCM Tax Account" table — SAP B1's own layout. Rows are entirely
// derived from Tax Type + Rate (buildTaxGroupRows), so there's no add/remove
// row control here: change Tax Type or Rate above and the table follows.
function TaxGroupTable({ accountOptions, accountsById }) {
  const { watch } = useFormContext();
  const taxType = watch('taxType');
  const taxRate = watch('taxRate');
  const rows = useMemo(() => buildTaxGroupRows({ taxType, taxRate }), [taxType, taxRate]);

  return (
    <Box sx={{ mt: 1 }}>
      <ScrollableTableContainer>
        <Table
          size="small"
          sx={{
            '& th, & td': {
              paddingTop: '4px',
              paddingBottom: '4px',
              boxSizing: 'border-box',
            },
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell width={56}>Sl.No</TableCell>
              <TableCell width={110}>Tax Group</TableCell>
              <TableCell width={90}>Rate (%)</TableCell>
              <TableCell>Sales Tax Account</TableCell>
              <TableCell>Purchase Tax Account</TableCell>
              <TableCell>RCM Tax Account</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={row.group} hover>
                <TableCell>{idx + 1}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{row.group}</TableCell>
                <TableCell>{row.rate}</TableCell>
                <TaxGroupAccountCell name={row.salesField} accountOptions={accountOptions} accountsById={accountsById} />
                <TaxGroupAccountCell name={row.purchaseField} accountOptions={accountOptions} accountsById={accountsById} />
                <TaxGroupAccountCell name={row.rcmField} accountOptions={accountOptions} accountsById={accountsById} />
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                    Select a Tax Type and Rate above to generate tax group rows.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollableTableContainer>
    </Box>
  );
}

const PAGE_SIZE = 10;

const TABLE_ROW_HEIGHT = 0;         // floor, not a cap
const TABLE_CELL_PADDING_Y = 6;     // the actual top/bottom gap per cell, in px — this is what actually controls row height
const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function TaxCode() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const { data: taxCodes, isLoading } = taxCodeApi.useList();
  const [create, { isLoading: creating }] = taxCodeApi.useCreate();
  const [update, { isLoading: updating }] = taxCodeApi.useUpdate();
  const [remove] = taxCodeApi.useDelete();
  const [resetTaxCodes, { isLoading: resetting }] = useResetTaxCodesMutation();
  // Options for the tax-group account pickers below (Sales/Purchase/RCM per
  // SGST/CGST/IGST row) — server-filtered to GST accounts (Chart of Account
  // name contains "GST", Active) via /company/tax-codes/gl-accounts, same
  // rule as G/L Account Determination's own Tax Account Code picker (see
  // backend/src/utils/taxGlAccountFilter.js). This is deliberately NOT the
  // full chart-of-accounts list.
  const { data: taxGlAccounts } = useListTaxGLAccountsQuery();
  const accountOptions = useMemo(
    () => (taxGlAccounts || []).map((a) => ({
      label: a.accountCode, value: a.id, code: a.accountCode, accountName: a.accountName,
    })),
    [taxGlAccounts]
  );
  const allowedAccountIds = useMemo(
    () => new Set((taxGlAccounts || []).map((a) => a.id)),
    [taxGlAccounts]
  );
  const taxCodeDetailsSchema = useMemo(() => buildTaxCodeDetailsSchema(allowedAccountIds), [allowedAccountIds]);

  // The current period's G/L Account Determination row — Sales > Tax /
  // Purchasing > Tax there already map company-wide CGST/SGST/IGST default
  // accounts (GLAccountDeterminationForm.jsx's SALES_TAX_ROWS/
  // PURCHASE_TAX_ROWS). A brand-new Tax Code should start from those
  // defaults instead of blank pickers — same "active year, else the only
  // row" resolution backend/src/utils/glPosting.js's own determination()
  // lookup uses, so this always matches whatever period GL posting itself
  // would use right now.
  const { data: financialYears } = financialYearApi.useList();
  const { data: glDeterminations } = glAccountDeterminationApi.useList();
  const currentDetermination = useMemo(() => {
    const activeFy = (financialYears || []).find((fy) => fy.status === 'Active');
    const forActiveYear = activeFy
      ? (glDeterminations || []).find((d) => d.financialYearId === activeFy.id)
      : null;
    return forActiveYear || (glDeterminations || [])[0] || null;
  }, [financialYears, glDeterminations]);
  // Pre-fills the New Tax Code form's Sales/Purchase Tax Account pickers from
  // the mapping above. RCM has no equivalent on G/L Account Determination
  // (it only has Sales/Purchase Tax rows, never RCM — see SALES_TAX_ROWS/
  // PURCHASE_TAX_ROWS), so RCM fields stay unset here, same as emptyValues.
  const createDefaultValues = useMemo(() => ({
    ...emptyValues,
    sgstSalesAccountId: currentDetermination?.salesSgstAccountId ?? null,
    sgstPurchaseAccountId: currentDetermination?.purchaseSgstAccountId ?? null,
    cgstSalesAccountId: currentDetermination?.salesCgstAccountId ?? null,
    cgstPurchaseAccountId: currentDetermination?.purchaseCgstAccountId ?? null,
    igstSalesAccountId: currentDetermination?.salesIgstAccountId ?? null,
    igstPurchaseAccountId: currentDetermination?.purchaseIgstAccountId ?? null,
  }), [currentDetermination]);

  // Full, unfiltered chart of accounts — used ONLY to display the account
  // code/name of a field whose saved value has fallen outside the allowed
  // set above (e.g. an account's classification changed, or it was removed
  // from G/L Account Determination's Tax section after this Tax Code was
  // saved). Never used to populate the picker's own options.
  const { data: allAccounts } = chartOfAccountApi.useList();
  const accountsById = useMemo(
    () => new Map((allAccounts || []).map((a) => [a.id, a])),
    [allAccounts]
  );

  // The form lives in a modal — the page itself is the list, and the Add
  // button (or an edit action) opens the dialog over it. Same shape as the
  // Branch Details page / shared MasterCrudPage template.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const [search, setSearch] = useState('');
  const allRows = taxCodes || [];
  const baseTableRows = useMemo(() => {
    const q = '';
    if (!q) return allRows;
    return allRows.filter((r) => [r.taxCode, r.taxName, r.taxType].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [allRows]);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'taxCode', headerName: 'Tax Code', filter: 'text' },
    { field: 'taxName', headerName: 'Tax Name', filter: 'text' },
    { field: 'taxType', headerName: 'Tax Type', filter: 'text' },
    { field: 'taxRate', headerName: 'Rate (%)', filter: 'numberRange', sortValue: (row) => (row.taxRate == null || row.taxRate === '' ? null : Number(row.taxRate)) },
    { field: 'effectiveFrom', headerName: 'Effective From', filter: 'dateRange', sortValue: (r) => (r.effectiveFrom ? new Date(r.effectiveFrom).getTime() : null), searchValue: (r) => formatDate(r.effectiveFrom) },
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

  // Closing a half-filled form asks before throwing the work away.
  // requestClose is what Cancel / the X / Esc go through; forceClose is the
  // save path, which has nothing to lose. See useUnsavedChangesGuard.jsx.
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
      title: 'Delete tax code',
      message: `Are you sure you want to delete "${row.taxCode}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Tax code deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  // Captured from AppForm's render prop once its RHF instance exists (see
  // the `key={formKey}` AppForm below) — lets handleSubmit attach a
  // duplicate-tax-code error to the exact field it belongs to, the same
  // pattern DocumentNumberingForm.jsx uses for its own server-side errors.
  const setErrorRef = React.useRef(() => {});

  const handleSubmit = async (values, formMethods) => {
    // Client-side check first: catches a duplicate immediately, without a
    // round trip, using the same "ignore spacing/case" comparison as the
    // server (findDuplicateTaxCode in routes/company.js) — "GST 12%" already
    // in the list blocks "GST12%" from saving as if it were new.
    const clientDupe = findDuplicateTaxCode(values, allRows, editingRow?.id ?? null);
    if (clientDupe) {
      const field = normaliseTaxLabel(clientDupe.taxCode) === normaliseTaxLabel(values.taxCode) ? 'taxCode' : 'taxName';
      const message = `"${clientDupe.taxCode} — ${clientDupe.taxName}" already covers this — differing only by spacing/case does not make it a new tax code`;
      setErrorRef.current(field, { type: 'duplicate', message });
      notify.error(message);
      return;
    }

    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...values }).unwrap();
        notify.success('Tax code updated');
      } else {
        await create(values).unwrap();
        notify.success('Tax code added');
      }
      forceClose();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
      // Field-tagged errors from the server's own duplicate check (badRequest
      // in routes/company.js) — covers the race where two people add the
      // same tax code between this page's load and this save.
      const fieldErrors = err?.data?.errors;
      if (Array.isArray(fieldErrors)) {
        for (const fe of fieldErrors) {
          if (fe.field) setErrorRef.current(fe.field, { type: 'server', message: fe.message });
        }
      }
    }
  };

  const handleReset = async () => {
    const ok = await confirmDialog({
      title: 'Reset to default',
      message: 'This restores the standard GST tax code set (GST5, GST12, GST18, GST28, IGST18). Continue?',
      confirmLabel: 'Reset',
      severity: 'warning',
    });
    if (!ok) return;
    try {
      await resetTaxCodes().unwrap();
      table.resetAll();
      setPage(0);
      notify.success('Tax codes reset to defaults');
    } catch (err) {
      notify.error(err?.data?.message || 'Reset failed');
    }
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<PercentIcon />}
        title="Tax Code"
        subtitle="Create and manage GST/IGST (and GST+TCS/IGST+TCS) tax codes for your business."
        rightContent={
          <CanAdd>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Add Tax Code
            </Button>
          </CanAdd>
        }
      />

      <Dialog
        open={dialogOpen}
        {...dialogCloseProps}
        maxWidth="md"
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
            {readOnly ? 'View Tax Code' : editingRow ? 'Edit Tax Code' : 'New Tax Code'}
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
          schema={taxCodeDetailsSchema}
          defaultValues={editingRow ? { ...emptyValues, ...editingRow } : createDefaultValues}
          onSubmit={handleSubmit}
        >
          {({ setError }) => {
            setErrorRef.current = setError;
            return (
            <>
              {/* Watches for the first real user edit so the close handlers
                  above know whether there is anything to lose. */}
              <FormDirtyTracker onDirtyChange={setDirty} />
              <DialogContent dividers>
                <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                  {/* Manually entered — like UOM Code, nothing elsewhere in
                      the schema references a Tax Code by this value via an
                      FK, so there's no numbering series to keep in sync and
                      no risk in leaving it editable on Edit too. See the
                      matching backend change in routes/company.js's POST
                      /tax-codes handler, which used to silently overwrite
                      whatever was typed here with the next number off the
                      hidden 'TAX' series. */}
                  <LabeledField label="Code *" labelWidth={TAX_CODE_LABEL_WIDTH}>
                    <FormTextField name="taxCode" label="" placeholder="Enter tax code" maxLength={50} />
                  </LabeledField>
                  <LabeledField label="Name *" labelWidth={TAX_CODE_LABEL_WIDTH}>
                    <FormTextField name="taxName" label="" placeholder="Name" />
                  </LabeledField>
                  <LabeledField label="Tax Type *" labelWidth={TAX_CODE_LABEL_WIDTH}>
                    <FormSelect name="taxType" label="" placeholder="Select tax type" options={TAX_TYPE_OPTIONS} />
                  </LabeledField>
                  <LabeledField label="Rate % *" labelWidth={TAX_CODE_LABEL_WIDTH}>
                    <FormTextField name="taxRate" label="" type="number" placeholder="18" />
                  </LabeledField>
                  <LabeledField label="Effective From" labelWidth={TAX_CODE_LABEL_WIDTH}>
                    <FormDatePicker name="effectiveFrom" label="" />
                  </LabeledField>
                  <LabeledField label="Status *" labelWidth={TAX_CODE_LABEL_WIDTH}>
                    <FormSelect
                      name="status"
                      label=""
                      options={[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]}
                    />
                  </LabeledField>
                </FormGrid>

                {/* Dynamic Tax Details table -- SGST + CGST (GST) or IGST
                    alone, generated from Tax Type + Rate above. */}
                <TaxGroupTable accountOptions={accountOptions} accountsById={accountsById} />
              </DialogContent>

              <DialogActions sx={{ px: 3, py: 2 }}>
                <FormSubmitButton disabled={creating || updating}>
                  {readOnly ? 'View' : editingRow ? 'Update Tax Code' : 'Save Tax Code'}
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
            <Typography variant="subtitle1" fontWeight={700}>Tax Code List</Typography>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TableSearchFilter table={table} placeholder="Search tax codes..." width={220} />
              <Button variant="outlined" startIcon={<RestartAltIcon />} onClick={handleReset} disabled={resetting}>
                Reset to Default
              </Button>
            </Stack>

            <TableFilterPanel table={table} />
          </Stack>

          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {!isLoading && pagedRows.map((row) => (
                <MobileRecordCard
                  key={row.id}
                  title={`${row.taxCode} — ${row.taxName}`}
                  statusChip={<Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />}
                  fields={[
                    { label: 'Tax Type', value: row.taxType || '—' },
                    { label: 'Rate (%)', value: row.taxRate != null ? Number(row.taxRate).toFixed(2) : '—' },
                    { label: 'Effective From', value: formatDate(row.effectiveFrom) },
                  ]}
                  onView={() => handleView(row)}
                  onEdit={() => handleEdit(row)}
                  onDelete={() => handleDelete(row)}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                <EmptyState icon={<ApartmentOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No tax codes yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first tax code to get started'} />
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
                    <SortableHeaderCell field="taxCode" sort={table.sort} onSort={table.toggleSort}>Tax Code</SortableHeaderCell>
                    <SortableHeaderCell field="taxName" sort={table.sort} onSort={table.toggleSort}>Tax Name</SortableHeaderCell>
                    <SortableHeaderCell field="taxType" sort={table.sort} onSort={table.toggleSort}>Tax Type</SortableHeaderCell>
                    <SortableHeaderCell field="taxRate" sort={table.sort} onSort={table.toggleSort}>Rate (%)</SortableHeaderCell>
                    <SortableHeaderCell field="effectiveFrom" sort={table.sort} onSort={table.toggleSort}>Effective From</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.taxCode}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.taxName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.taxType || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.taxRate != null ? Number(row.taxRate).toFixed(2) : '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.effectiveFrom)}</TableCell>
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
                      <TableCell colSpan={8}>
                        <EmptyState icon={<ApartmentOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No tax codes yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first tax code to get started'} />
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
