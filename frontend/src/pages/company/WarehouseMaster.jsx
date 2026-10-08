import React, { useEffect, useMemo, useState } from 'react';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import {
  Box, Typography, Button, Card, CardContent, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Chip, IconButton, Tabs, Tab, Paper, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import { useUnsavedChangesGuard, FormDirtyTracker } from '../../components/form/useUnsavedChangesGuard';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import { FormCheckbox } from '../../components/form/FormCheckbox';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { warehouseMasterSchema } from '../../lib/validation/partnerSchemas';
import {
  warehouseMasterApi, locationMasterApi, branchApi, chartOfAccountApi, financialYearApi, glAccountDeterminationApi,
} from '../../features/resources';
import { countries, getStateOptions } from '../../lib/constants/locations';
import { getCityOptions } from '../../lib/constants/locationsCities';
// warehouseMasterSchema's own zipCode field is optionalZipcode() — deliberately
// alphanumeric, country-agnostic (see its comment in lib/validation/common.js),
// since this page's Country selector can pick any country and non-Indian
// postal codes legitimately include letters (UK's "SW1A 1AA", for example).
// Layered on top here rather than changed at the source, which every other
// consumer of optionalZipcode() (Branch, Location Master, Business Partner
// Address, ...) also relies on for the same reason: when Country is India
// specifically, enforce the strict numeric 6-digit PIN code format instead.
// Same fix as Location Master's locationMasterFormSchema.
const warehouseMasterFormSchema = warehouseMasterSchema.refine(
  (d) => d.country !== 'India' || !d.zipCode || /^\d{6}$/.test(d.zipCode),
  { message: 'Zipcode must be exactly 6 digits for India', path: ['zipCode'] }
);
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';
// Fields of WarehouseMaster ([dbo].[warehouse]) — the single warehouse master
// the whole application reads from. This page used to edit [dbo].[warehouses],
// a second, near-duplicate table; see the retirement note in schema.prisma for
// why that one lost.
const emptyValues = {
  whsCode: '', whsName: '', locationCode: '', branch: '',
  street: '', streetNo: '', buildingFloorRoom: '', block: '',
  city: '', state: '', country: 'India', zipCode: '',
  expenseAccount: '', revenueAccount: '', inventoryAccount: '', costOfGoodsSoldAccount: '',
  allocationAccount: '', varianceAccount: '', priceDifferenceAccount: '', negativeInventoryAdjustmentAccount: '',
  inventoryOffsetDecreaseAccount: '', inventoryOffsetIncreaseAccount: '', salesReturnsAccount: '',
  purchaseAccount: '', purchaseReturnAccount: '', costOfGoodsPurchasedAccount: '', exchangeRateDifferencesAccount: '',
  goodsClearingAccount: '', glDecreaseAccount: '', glIncreaseAccount: '', wipInventoryAccount: '',
  wipInventoryVarianceAccount: '', wipOffsetPnlAccount: '', inventoryOffsetPnlAccount: '', expenseClearingAccount: '',
  shippedGoodsAccount: '', salesCreditAccount: '', purchaseCreditAccount: '', purchaseBalanceAccount: '',
  incomingCenvatAccount: '', outgoingCenvatAccount: '',
  isTransit: false,
  status: 'Active',
};

// Accounting tab — one row per G/L account determination role, in the order
// the source system (and the SAP Warehouse - Accounting tab it mirrors)
// lists them. `field` must match a warehouseMasterSchema/schema.prisma column
// one-for-one — see the comment on WarehouseMaster.expenseAccount for why
// these are stored by ChartOfAccount code rather than an FK id.
const ACCOUNTING_FIELDS = [
  { field: 'expenseAccount', label: 'Expense Account' },
  { field: 'revenueAccount', label: 'Revenue Account' },
  { field: 'inventoryAccount', label: 'Inventory Account' },
  { field: 'costOfGoodsSoldAccount', label: 'Cost of Goods Sold Account' },
  { field: 'allocationAccount', label: 'Allocation Account' },
  { field: 'varianceAccount', label: 'Variance Account' },
  { field: 'priceDifferenceAccount', label: 'Price Difference Account' },
  { field: 'negativeInventoryAdjustmentAccount', label: 'Negative Inventory Adjustment Acct' },
  { field: 'inventoryOffsetDecreaseAccount', label: 'Inventory Offset - Decrease Account' },
  { field: 'inventoryOffsetIncreaseAccount', label: 'Inventory Offset - Increase Account' },
  { field: 'salesReturnsAccount', label: 'Sales Returns Account' },
  { field: 'purchaseAccount', label: 'Purchase Account' },
  { field: 'purchaseReturnAccount', label: 'Purchase Return Account' },
  { field: 'costOfGoodsPurchasedAccount', label: 'Cost of Goods Purchased Account' },
  { field: 'exchangeRateDifferencesAccount', label: 'Exchange Rate Differences Account' },
  { field: 'goodsClearingAccount', label: 'Goods Clearing Account' },
  { field: 'glDecreaseAccount', label: 'G/L Decrease Account' },
  { field: 'glIncreaseAccount', label: 'G/L Increase Account' },
  { field: 'wipInventoryAccount', label: 'WIP Inventory Account' },
  { field: 'wipInventoryVarianceAccount', label: 'WIP Inventory Variance Account' },
  { field: 'wipOffsetPnlAccount', label: 'WIP Offset P&L Account' },
  { field: 'inventoryOffsetPnlAccount', label: 'Inventory Offset P&L Account' },
  { field: 'expenseClearingAccount', label: 'Expense Clearing Account' },
  { field: 'shippedGoodsAccount', label: 'Shipped Goods Account' },
  { field: 'salesCreditAccount', label: 'Sales Credit Account' },
  { field: 'purchaseCreditAccount', label: 'Purchase Credit Account' },
  { field: 'purchaseBalanceAccount', label: 'Purchase Balance Account' },
  { field: 'incomingCenvatAccount', label: 'Incoming CENVAT Account (WH)' },
  { field: 'outgoingCenvatAccount', label: 'Outgoing CENVAT Account (WH)' },
];

// Maps each Accounting-tab field above to the G/L Account Determination
// field it defaults from (Accounting > G/L Account Determination), so a new
// Warehouse inherits the current Financial Year's account mappings instead
// of every one of these 29 fields starting blank — same pattern and same
// role names as ProductGroup's PRODUCT_GROUP_ACCOUNT_MAP.
const WAREHOUSE_ACCOUNT_MAP = {
  expenseAccount: 'expenseAccountId',
  revenueAccount: 'revenueAccountId',
  inventoryAccount: 'inventoryAccountId',
  costOfGoodsSoldAccount: 'costOfGoodsSoldAccountId',
  allocationAccount: 'allocationAccountId',
  varianceAccount: 'varianceAccountId',
  priceDifferenceAccount: 'priceDifferenceAccountId',
  negativeInventoryAdjustmentAccount: 'negativeInventoryAdjAcctId',
  inventoryOffsetDecreaseAccount: 'inventoryOffsetDecrAcctId',
  inventoryOffsetIncreaseAccount: 'inventoryOffsetIncrAcctId',
  salesReturnsAccount: 'salesReturnsAccountId',
  purchaseAccount: 'purchaseAccountId',
  purchaseReturnAccount: 'purchaseReturnAccountId',
  costOfGoodsPurchasedAccount: 'costOfGoodsPurchasedAccountId',
  exchangeRateDifferencesAccount: 'exchangeRateDifferencesAccountId',
  goodsClearingAccount: 'goodsClearingAccountId',
  glDecreaseAccount: 'glDecreaseAccountId',
  glIncreaseAccount: 'glIncreaseAccountId',
  wipInventoryAccount: 'wipInventoryAccountId',
  wipInventoryVarianceAccount: 'wipInventoryVarianceAccountId',
  wipOffsetPnlAccount: 'wipOffsetPLAccountId',
  inventoryOffsetPnlAccount: 'inventoryOffsetPnlAccountId',
  expenseClearingAccount: 'expenseClearingAccountId',
  shippedGoodsAccount: 'shippedGoodsAccountId',
  salesCreditAccount: 'salesCreditAccountId',
  purchaseCreditAccount: 'purchaseCreditAccountId',
  purchaseBalanceAccount: 'purchaseBalanceAccountId',
  incomingCenvatAccount: 'incomingCenvatClearingActId',
  outgoingCenvatAccount: 'outgoingCenvatClearingActId',
};

// Row sizing/border for the Accounting tab table — same separate-variable
// pattern as Product Master's Inventory tab (see ProductInventoryTab.jsx):
// one constant per knob, each tunable on its own, rather than magic numbers
// scattered through the JSX below.
//   - TABLE_ROW_HEIGHT       floor row height (see the fuller explanation
//                             on ProductInventoryTab's own copy of this
//                             constant — a real row can still grow past it).
//   - TABLE_CELL_PADDING_Y   top/bottom padding inside every cell.
//   - ACCOUNT_SELECT_HEIGHT  height of the Account Code select control
//                             itself, so the input doesn't sit taller than
//                             the row it's in — see its use on the
//                             FormSelect below.
const TABLE_ROW_HEIGHT = 0;
const TABLE_CELL_PADDING_Y = 1;
const ACCOUNT_SELECT_HEIGHT = 32;

// Width (px) of the "#" / row-label column on the Accounting tab (the
// column that shows "Expense Account", "Revenue Account", etc.) — its own
// variable, separate from ACCOUNT_CODE_COLUMN_WIDTH below, so either can be
// resized without touching the other.
const ACCOUNT_LABEL_COLUMN_WIDTH = 320;

// Width (px) of the Account Code column/select on the Accounting tab —
// adjust this one value to resize it, rather than the header cell, body
// cell and FormSelect separately.
const ACCOUNT_CODE_COLUMN_WIDTH = 220;

// Width (px) of the Account Code select's OPEN dropdown — deliberately wider
// than the closed field (ACCOUNT_CODE_COLUMN_WIDTH) so its two-column
// Code/Name layout (see AccountCodeDropdownPaper below) has room to read,
// the way a select2-style combobox does. Adjust this one value to resize the
// dropdown independently of the field.
const ACCOUNT_CODE_DROPDOWN_WIDTH = 380;
// How much of ACCOUNT_CODE_DROPDOWN_WIDTH the Code column takes, both in the
// dropdown's header row and in each option row — the two must stay in sync
// or the header won't line up with the values under it.
const ACCOUNT_CODE_DROPDOWN_CODE_WIDTH = 140;

// The select2-style header row + two-column option layout for the Account
// Code dropdown. MUI's Autocomplete has no "table header inside the popup"
// prop, so this wraps the Paper it renders its listbox in and injects a
// sticky header above `children` (the actual list of options).
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

// One row of the dropdown: code on the left (fixed width, matching the
// header above), name on the right. `option` is an accountOptions entry —
// see the accountName field added there.
function renderAccountCodeOption(liProps, option) {
  return (
    <li {...liProps}>
      <Box sx={{ display: 'flex', width: '100%' }}>
        <Box sx={{ width: ACCOUNT_CODE_DROPDOWN_CODE_WIDTH, flexShrink: 0 }}>{option.value}</Box>
        <Box sx={{ flex: 1, color: 'text.secondary' }}>{option.accountName || '—'}</Box>
      </Box>
    </li>
  );
}

// Row sizing/border for the Warehouse List table below (the main list, not
// the Accounting tab table above) — same separate-variable pattern as
// ProductInventoryTab.jsx: one constant per knob so height, padding and
// border can each be tuned independently instead of magic numbers in the
// JSX. Named WAREHOUSE_LIST_* (rather than reusing the TABLE_ROW_HEIGHT /
// belong to the Accounting tab's table and use a different padding value.
//   - WAREHOUSE_LIST_TABLE_ROW_HEIGHT       floor row height, not a cap —
//                                            WAREHOUSE_LIST_TABLE_CELL_PADDING_Y
//                                            is what actually controls how
//                                            tall a row looks.
//   - WAREHOUSE_LIST_TABLE_CELL_PADDING_Y   top/bottom padding inside every
//                                            cell, in px.
//                                            every cell.
const WAREHOUSE_LIST_TABLE_ROW_HEIGHT = 0;
const WAREHOUSE_LIST_TABLE_CELL_PADDING_Y = 6;
const PAGE_SIZE = 10;

export default function WarehouseMaster() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const { data: warehouses, isLoading } = warehouseMasterApi.useList();
  const { data: locations } = locationMasterApi.useList();
  const { data: branches } = branchApi.useList();
  const { data: accounts } = chartOfAccountApi.useList();
  const { data: financialYears } = financialYearApi.useList();
  const { data: glDeterminations } = glAccountDeterminationApi.useList();
  const [create, { isLoading: creating }] = warehouseMasterApi.useCreate();
  const [update, { isLoading: updating }] = warehouseMasterApi.useUpdate();
  const [remove] = warehouseMasterApi.useDelete();

  // The form lives in a modal — the page itself is the list, and "Add
  // Warehouse" (or an edit action) opens the dialog over it. Same shape as the
  // Branch Details page / shared MasterCrudPage template.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  // Which of the two form tabs (General / Accounting) is showing.
  const [tab, setTab] = useState(0);

  // Accounting-tab defaults pulled from the current Financial Year's G/L
  // Account Determination — see accountingDefaultsFromDetermination below.
  // Populated whenever the dialog opens (create, edit or view) and read by
  // AppForm's defaultValues below: for a brand-new warehouse it supplies
  // every field; for an existing one it only fills in whichever Accounting
  // fields that warehouse never had a value saved for — an already-saved
  // account is never overwritten by it.
  const [determinationDefaults, setDeterminationDefaults] = useState({});

  // Accounting tab options — only real posting accounts (accountNature 'A',
  // i.e. not a Title/heading account) and only Active ones can be assigned as
  // a G/L determination account. accountByCode is unfiltered on purpose: it's
  // used to resolve the read-only Account Name column, and a warehouse whose
  // assigned account has since been made inactive should still show its name
  // rather than go blank.
  // Label is the code alone — the Account Name column right next to this
  // select already shows the resolved name, so repeating it in the dropdown
  // would just be noise.
  // label is the code alone (what the closed field shows once a value is
  // picked); accountName rides along unused by the Autocomplete itself, but
  // renderAccountCodeOption reads it to fill the dropdown's Account Name
  // column — see AccountCodeDropdownPaper above.
  const accountByCode = useMemo(() => new Map((accounts || []).map((a) => [a.accountCode, a])), [accounts]);

  // An editing warehouse's already-saved codes are appended even when they
  // fail the active-posting-account filter (inactive account, non-'A'
  // nature, or since deleted) — same reason locationOptions/branchOptions
  // below keep the current value selectable after its master record is
  // deactivated. Without this, MUI's Autocomplete can't find the saved
  // value in `options` and renders the field as blank, even though
  // defaultValues did carry the code through.
  const accountOptions = useMemo(() => {
    const list = (accounts || [])
      .filter((a) => a.accountNature === 'A' && a.status === 'A')
      .map((a) => ({ label: a.accountCode, value: a.accountCode, accountName: a.accountName }));
    if (editingRow) {
      const seen = new Set(list.map((o) => o.value));
      ACCOUNTING_FIELDS.forEach(({ field }) => {
        const code = editingRow[field];
        if (!code || seen.has(code)) return;
        seen.add(code);
        const account = accountByCode.get(code);
        list.push({ label: code, value: code, accountName: account?.accountName });
      });
    }
    return list;
  }, [accounts, editingRow, accountByCode]);

  // Resolves a G/L Account Determination *Id field (a ChartOfAccount row id)
  // back to the accountCode string this page's Accounting fields are stored
  // by — see the cross-master-by-code convention noted on
  // WarehouseMaster.expenseAccount in schema.prisma.
  const accountCodeById = useMemo(() => new Map((accounts || []).map((a) => [a.id, a.accountCode])), [accounts]);

  // The G/L Account Determination row for whichever Financial Year is
  // currently Active — "currently" meaning FinancialYear.status, the same
  // flag the Financial Year page itself uses. Falls back to the most
  // recently started year if none is flagged Active, so a company that
  // hasn't set that flag yet still gets sensible defaults instead of none.
  const activeFinancialYear = useMemo(() => {
    const years = financialYears || [];
    return years.find((y) => y.status === 'Active')
      || [...years].sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0))[0]
      || null;
  }, [financialYears]);
  const activeDetermination = useMemo(() => {
    if (!activeFinancialYear) return null;
    return (glDeterminations || []).find((d) => d.financialYearId === activeFinancialYear.id) || null;
  }, [glDeterminations, activeFinancialYear]);

  // Every Accounting field the current Financial Year's G/L Account
  // Determination has a mapped, resolvable account for — see
  // WAREHOUSE_ACCOUNT_MAP. A role with no determination row, no value set on
  // it, or an id that no longer resolves to a real account is simply left
  // out, so the field falls back to emptyValues' '' the same as if no
  // determination existed at all — never a broken/blank-looking selection.
  const accountingDefaultsFromDetermination = () => {
    if (!activeDetermination) return {};
    const result = {};
    Object.entries(WAREHOUSE_ACCOUNT_MAP).forEach(([whField, glField]) => {
      const accountId = activeDetermination[glField];
      const code = accountId != null ? accountCodeById.get(accountId) : null;
      if (code) result[whField] = code;
    });
    return result;
  };

  // The form's actual defaultValues: emptyValues as the base, then either
  // determinationDefaults (new warehouse) or the record being edited/viewed
  // — with any Accounting field that record never had a value saved for
  // (blank, null, or missing entirely, e.g. a warehouse created before this
  // field existed) filled in from determinationDefaults too. A field the
  // warehouse already has its own value for is never touched.
  const buildFormDefaultValues = () => {
    if (!editingRow) return { ...emptyValues, ...determinationDefaults };
    const merged = { ...emptyValues, ...editingRow };
    Object.keys(WAREHOUSE_ACCOUNT_MAP).forEach((field) => {
      if (!merged[field] && determinationDefaults[field]) merged[field] = determinationDefaults[field];
    });
    return merged;
  };

  // Warehouse Location is picked from Location Master rather than typed, so
  // every warehouse resolves to a registered location (and its PAN/ECC/GST).
  // Only Active locations are offered, but an already-saved warehouse's
  // location stays selectable even if it has since been deactivated, so
  // editing an old record doesn't blank the field out.
  // Location is stored as the location CODE here, matching the master's own
  // column, rather than as a name — so renaming a location does not orphan
  // every warehouse pointing at it.
  const locationOptions = useMemo(() => {
    const list = (locations || [])
      .filter((l) => l.status === 'Active')
      .map((l) => ({ label: `${l.code} — ${l.locationName}`, value: l.code }));
    if (editingRow?.locationCode && !list.some((o) => o.value === editingRow.locationCode)) {
      list.push({ label: editingRow.locationCode, value: editingRow.locationCode });
    }
    return list;
  }, [locations, editingRow]);

  // Which branch operates this warehouse. Same pattern as Warehouse Location
  // directly above — picked from the Branch master and stored as the branch
  // NAME, so the value means something on its own, and an existing warehouse's
  // branch stays selectable even after that branch is deactivated.
  //
  // Now mandatory (see partnerSchemas.js's warehouseMasterSchema): every
  // branch-scoped warehouse dropdown app-wide reads WarehouseMaster.branch,
  // so a warehouse with none is invisible to all of them. Warehouses
  // imported before this was enforced may still have a blank branch until
  // someone edits them — see the "No Branch" flag on the list/row below.
  const branchOptions = useMemo(() => {
    const names = (branches || [])
      .filter((b) => b.status === 'Active')
      .map((b) => b.branchName);
    if (editingRow?.branch && !names.includes(editingRow.branch)) names.push(editingRow.branch);
    return names.map((name) => ({ label: name, value: name }));
  }, [branches, editingRow]);

  const allRows = warehouses || [];

  // Every branch-scoped warehouse dropdown app-wide reads WarehouseMaster.branch
  // — a warehouse with none is invisible to all of them, not just hard to find
  // here. Surfaced as a count rather than silently discovered one broken
  // dropdown at a time.
  const noBranchCount = useMemo(() => allRows.filter((w) => !w.branch).length, [allRows]);

  const tableColumns = useMemo(() => ([
    { field: 'whsCode', headerName: 'Warehouse Code', filter: 'text' },
    { field: 'whsName', headerName: 'Warehouse Name', filter: 'text' },
    { field: 'locationCode', headerName: 'Location', filter: 'select' },
    { field: 'branch', headerName: 'Branch', filter: 'select' },
    { field: 'city', headerName: 'City', filter: 'text' },
    // Which warehouse is this branch's Transit Warehouse. `value` maps the
    // raw boolean to the words shown in the cell, matching Branch's own
    // isDefault column, so searching "Transit", sorting, and the filter
    // popover's auto-derived options all work on what's actually shown.
    { field: 'isTransit', headerName: 'Transit', filter: 'select', value: (r) => (r.isTransit ? 'Transit' : '—') },
    { field: 'status', headerName: 'Status', filter: 'select' },
  ]), []);
  const table = useTableFeatures(allRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  useEffect(() => { setPage(0); }, [rows.length]);

  const openCreate = () => {
    setEditingRow(null);
    setReadOnly(false);
    setDeterminationDefaults(accountingDefaultsFromDetermination());
    setFormKey((k) => k + 1);
    setDialogOpen(true);
    setTab(0);
  };

  const closeForm = () => {
    setDialogOpen(false);
    setEditingRow(null);
  };

  // Closing a half-filled form asks before throwing the work away. requestClose
  // is what Cancel / the X / Esc go through; forceClose is the save path, which
  // has nothing to lose. Covers edits made on either tab — the tracker sits
  // outside the tab switch, so an Accounting-tab change counts the same as a
  // General-tab one. See useUnsavedChangesGuard.jsx.
  const { requestClose, forceClose, setDirty, dialogCloseProps } = useUnsavedChangesGuard(closeForm);

  // Read-only look at a record — same form, every field disabled
  // and the save button removed (see AppForm's readOnly prop).
  const handleView = (row) => {
    setEditingRow(row);
    setReadOnly(true);
    setDeterminationDefaults(accountingDefaultsFromDetermination());
    setFormKey((k) => k + 1);
    setDialogOpen(true);
    setTab(0);
  };

  const handleEdit = (row) => {
    setEditingRow(row);
    setReadOnly(false);
    setDeterminationDefaults(accountingDefaultsFromDetermination());
    setFormKey((k) => k + 1);
    setDialogOpen(true);
    setTab(0);
  };

  const handleDelete = async (row) => {
    const ok = await confirmDialog({
      title: 'Delete warehouse',
      message: `Are you sure you want to delete "${row.whsName}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Warehouse deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...values }).unwrap();
        notify.success('Warehouse updated');
      } else {
        await create(values).unwrap();
        notify.success('Warehouse added');
      }
      forceClose();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<WarehouseOutlinedIcon />}
        title="Warehouse Master"
        subtitle="Manage your warehouse locations. Add, update or remove warehouses."
        rightContent={
          <CanAdd>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Add Warehouse
            </Button>
          </CanAdd>
        }
      />

      {noBranchCount > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {noBranchCount === 1
            ? '1 warehouse has no Branch assigned — it will not appear on any branch-scoped Warehouse dropdown until you assign one.'
            : `${noBranchCount} warehouses have no Branch assigned — they will not appear on any branch-scoped Warehouse dropdown until you assign one.`}
        </Alert>
      )}

      <Dialog
        open={dialogOpen}
        {...dialogCloseProps}
        maxWidth="lg"
        fullWidth
        sx={{
          // AppForm wraps its children in a <form>, which lands between the
          // dialog's Paper and DialogContent and breaks the flex chain Paper
          // relies on to make DialogContent scroll. Without this the field
          // grid (and the whole Accounting table) is clipped on a short
          // viewport instead of scrolling, and the action buttons go with it.
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
            {readOnly ? 'View Warehouse' : editingRow ? 'Edit Warehouse' : 'New Warehouse'}
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

        {/* Outside AppForm, and so outside the scrolling DialogContent below —
            the General/Accounting switch stays pinned under the title while
            the tab's own content scrolls. */}
        <Tabs
          value={tab}
          onChange={(_e, v) => setTab(v)}
          sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="General" />
          <Tab label="Accounting" />
        </Tabs>

        <AppForm readOnly={readOnly}
          key={formKey}
          schema={warehouseMasterFormSchema}
          defaultValues={buildFormDefaultValues()}
          onSubmit={handleSubmit}
        >
          {({ watch }) => {
            const country = watch('country') || 'India';
            const state = watch('state');
            // Which Accounting fields the caption below should credit to the
            // G/L Account Determination: for a new warehouse, every field
            // determinationDefaults supplied; for an existing one, only the
            // fields it had no saved value for and that determination filled
            // in (see buildFormDefaultValues above) — a warehouse whose
            // accounts were already fully set gets no caption at all.
            const determinationFilledFields = editingRow
              ? Object.keys(WAREHOUSE_ACCOUNT_MAP).filter((field) => !editingRow[field] && determinationDefaults[field])
              : Object.keys(determinationDefaults);
            return (
              <>
                {/* Watches for the first real user edit so the close handlers
                    above know whether there is anything to lose. Rendered
                    outside the tab conditionals so it survives switching
                    between General and Accounting. */}
                <FormDirtyTracker onDirtyChange={setDirty} />
                <DialogContent dividers>
                  {tab === 0 && (
                    // Label-left field layout — same LabeledField concept as
                    // Product Master's add/edit form (see
                    // components/form/LabeledField.jsx): a plain label to
                    // the left of a plain box, instead of this app's usual
                    // MUI floating-label style. Every FormTextField/
                    // FormSelect below is given label="" so LabeledField's
                    // own label is the only one that renders.
                    <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                      {/* Typed, not auto-numbered. The codes in this master are
                          meaningful and already in use across the business
                          (WND220 = Wayanad BHL WH), and every stock document now
                          stores one — so a generated WH-000001 would be both
                          wrong and unrecognisable. Locked after create because
                          changing a code would orphan every document holding it. */}
                      <LabeledField label="Warehouse Code *">
                        <FormTextField
                          name="whsCode"
                          label=""
                          placeholder="e.g. WND220"
                          disabled={!!editingRow}
                        />
                      </LabeledField>
                      <LabeledField label="Warehouse Name *">
                        <FormTextField name="whsName" label="" placeholder="Enter warehouse name" />
                      </LabeledField>
                      <LabeledField label="Location">
                        <FormSelect
                          name="locationCode"
                          label=""
                          placeholder="Select location"
                          options={locationOptions}
                        />
                      </LabeledField>

                      <LabeledField label="Branch *">
                        <FormSelect
                          name="branch"
                          label=""
                          placeholder="Select branch"
                          options={branchOptions}
                        />
                      </LabeledField>
                      <LabeledField label="Street">
                        <FormTextField name="street" label="" placeholder="Enter street" />
                      </LabeledField>
                      <LabeledField label="Street No">
                        <FormTextField name="streetNo" label="" placeholder="Enter street number" />
                      </LabeledField>

                      <LabeledField label="Building/Floor/Room">
                        <FormTextField name="buildingFloorRoom" label="" placeholder="Enter building, floor or room" />
                      </LabeledField>
                      <LabeledField label="Block">
                        <FormTextField name="block" label="" placeholder="Enter block" />
                      </LabeledField>
                      <LabeledField label="Country">
                        <FormSelect name="country" label="" placeholder="Select country" options={countries} />
                      </LabeledField>

                      <LabeledField label="State">
                        <FormSelect name="state" label="" placeholder="Select state" options={getStateOptions(country)} />
                      </LabeledField>
                      <LabeledField label="City">
                        <FormSelect name="city" label="" placeholder="Select city" options={getCityOptions(country, state)} />
                      </LabeledField>
                      <LabeledField label="Zipcode">
                        {/* India's PIN code is strictly numeric (see
                            warehouseMasterFormSchema's refine above) — block
                            letters at the keystroke for that country instead
                            of only rejecting them on save. Other countries
                            keep accepting letters (e.g. UK "SW1A 1AA"),
                            matching what the shared zipcode validator
                            already allows. */}
                        <FormTextField
                          name="zipCode"
                          label=""
                          placeholder={country === 'India' ? 'Enter 6-digit PIN code' : 'Enter zipcode'}
                          maxLength={country === 'India' ? 6 : 20}
                          digitsOnly={country === 'India'}
                        />
                      </LabeledField>

                      {/* At most one warehouse per branch may carry this —
                          ticking it here demotes whichever other warehouse on
                          the SAME branch held it before, enforced server-side
                          in the /warehouse-master route's afterWrite (same
                          "promoting moves the tag" pattern as Branch's own
                          Main Branch checkbox). */}
                      <FormCheckbox name="isTransit" label="Transit Warehouse" />

                      <LabeledField label="Status *">
                        <FormSelect
                          name="status"
                          label=""
                          options={[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]}
                        />
                      </LabeledField>
                    </FormGrid>
                  )}

                  {tab === 1 && (
                    <>
                    {determinationFilledFields.length > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                        {editingRow
                          ? `${determinationFilledFields.length} row${determinationFilledFields.length === 1 ? '' : 's'} below had no account saved, so `
                              + `${determinationFilledFields.length === 1 ? 'it was' : 'they were'} filled in from the `
                              + `${activeFinancialYear?.financialYearName} G/L Account Determination.`
                          : `Pre-filled from the ${activeFinancialYear?.financialYearName} G/L Account Determination — change `
                              + 'any row below before saving if this warehouse needs different accounts.'}
                      </Typography>
                    )}
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
                            <TableCell width={ACCOUNT_LABEL_COLUMN_WIDTH}>#</TableCell>
                            <TableCell width={ACCOUNT_CODE_COLUMN_WIDTH}>Account Code</TableCell>
                            <TableCell>Account Name</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {ACCOUNTING_FIELDS.map((row) => {
                            const selectedCode = watch(row.field);
                            const account = accountByCode.get(selectedCode);
                            return (
                              <TableRow key={row.field} hover>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.label}</TableCell>
                                <TableCell sx={{ width: ACCOUNT_CODE_COLUMN_WIDTH }}>
                                  <FormSelect
                                    name={row.field}
                                    placeholder="Select account"
                                    options={accountOptions}
                                    fullWidth={false}
                                    sx={{
                                      width: ACCOUNT_CODE_COLUMN_WIDTH,
                                      // Shrinks the select itself to
                                      // ACCOUNT_SELECT_HEIGHT and drops the
                                      // helper-text row FormSelect otherwise
                                      // always reserves (for a would-be
                                      // validation message) — these Account
                                      // Code fields are optional, so that
                                      // reserved strip is normally just dead
                                      // space padding out every row.
                                      '& .MuiOutlinedInput-root': {
                                        height: ACCOUNT_SELECT_HEIGHT,
                                        minHeight: ACCOUNT_SELECT_HEIGHT,
                                      },
                                      '& .MuiAutocomplete-input': { py: '2px' },
                                      '& .MuiFormHelperText-root': { display: 'none' },
                                    }}
                                    // select2-style dropdown: a Code/Name header
                                    // row (AccountCodeDropdownPaper) above
                                    // two-column option rows
                                    // (renderAccountCodeOption), widened past
                                    // the field itself so both columns are
                                    // legible. Picking a row still just writes
                                    // the code to this field, same as any other
                                    // select — only the open dropdown looks
                                    // different.
                                    PaperComponent={AccountCodeDropdownPaper}
                                    renderOption={renderAccountCodeOption}
                                    componentsProps={{ popper: { style: { width: ACCOUNT_CODE_DROPDOWN_WIDTH } } }}
                                  />
                                </TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>{account?.accountName || '—'}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </ScrollableTableContainer>
                    </>
                  )}
                </DialogContent>

                <DialogActions sx={{ px: 3, py: 2 }}>
                  <FormSubmitButton disabled={creating || updating}>
                    {readOnly ? 'View' : editingRow ? 'Update Warehouse' : 'Save Warehouse'}
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
            <Typography variant="subtitle1" fontWeight={700}>Warehouse List</Typography>
            <TableSearchFilter table={table} placeholder="Search warehouses..." width={220} />
          </Stack>

          <TableFilterPanel table={table} />

          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {!isLoading && pagedRows.map((row) => (
                <MobileRecordCard
                  key={row.id}
                  title={row.whsName}
                  statusChip={<Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />}
                  fields={[
                    { label: 'Warehouse Code', value: row.whsCode },
                    { label: 'Location', value: row.locationCode || '—' },
                    {
                      label: 'Branch',
                      value: row.branch || (
                        <Chip size="small" label="No Branch" color="warning" variant="outlined" />
                      ),
                    },
                    { label: 'City', value: row.city || '—' },
                    {
                      label: 'Transit',
                      value: row.isTransit
                        ? <Chip size="small" label="Transit" color="primary" />
                        : '—',
                    },
                  ]}
                  onView={() => handleView(row)}
                  onEdit={() => handleEdit(row)}
                  onDelete={() => handleDelete(row)}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                <EmptyState icon={<ApartmentOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No warehouses yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first warehouse to get started'} />
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table
                size="small"
                stickyHeader
                sx={{
                  '& th, & td': {
                    height: WAREHOUSE_LIST_TABLE_ROW_HEIGHT,
                    paddingTop: `${WAREHOUSE_LIST_TABLE_CELL_PADDING_Y}px`,
                    paddingBottom: `${WAREHOUSE_LIST_TABLE_CELL_PADDING_Y}px`,
                    boxSizing: 'border-box',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell width={48}>#</TableCell>
                    <SortableHeaderCell field="whsCode" sort={table.sort} onSort={table.toggleSort}>Warehouse Code</SortableHeaderCell>
                    <SortableHeaderCell field="whsName" sort={table.sort} onSort={table.toggleSort}>Warehouse Name</SortableHeaderCell>
                    <SortableHeaderCell field="locationCode" sort={table.sort} onSort={table.toggleSort}>Location</SortableHeaderCell>
                    <SortableHeaderCell field="branch" sort={table.sort} onSort={table.toggleSort}>Branch</SortableHeaderCell>
                    <SortableHeaderCell field="city" sort={table.sort} onSort={table.toggleSort}>City</SortableHeaderCell>
                    <SortableHeaderCell field="isTransit" sort={table.sort} onSort={table.toggleSort}>Transit</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.whsCode}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.whsName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.locationCode || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {row.branch || <Chip size="small" label="No Branch" color="warning" variant="outlined" />}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.city || '—'}</TableCell>
                      {/* Only ever one row per branch carries this — the
                          server demotes the previous transit warehouse on
                          the same branch whenever another is promoted (see
                          the /warehouse-master route in resources.js). */}
                      <TableCell>
                        {row.isTransit
                          ? <Chip size="small" label="Transit" color="primary" />
                          : <Typography variant="body2" color="text.secondary">—</Typography>}
                      </TableCell>
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
                      <TableCell colSpan={9}>
                        <EmptyState icon={<ApartmentOutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No warehouses yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first warehouse to get started'} />
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
