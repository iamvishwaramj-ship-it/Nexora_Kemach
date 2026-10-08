import React, { useEffect, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Stack, Tabs, Tab, Table, TableHead, TableBody,
  TableRow, TableCell, TableContainer, Paper, Autocomplete, TextField, Button,
} from '@mui/material';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import AppForm, { FormSubmitButton } from '../../components/form/AppForm';
import FormSelect from '../../components/form/FormSelect';
import { FormCheckbox } from '../../components/form/FormCheckbox';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import {
  financialYearApi, chartOfAccountApi, businessPartnerApi, glAccountDeterminationApi,
} from '../../features/resources';

const LIST_PATH = '/accounting/gl-account-determination';

// Row sizing/border for the "# / Type of Account / Account Code / Account
// Name" table below — same separate-variable pattern as Product Master's
// Inventory tab (see ProductInventoryTab.jsx) and Warehouse Master's
// Accounting tab (see WarehouseMaster.jsx): one constant per knob, each
// tunable on its own instead of magic numbers scattered through the JSX.
//   - TABLE_ROW_HEIGHT       floor row height (a real row can still grow
//                             past it — see the fuller explanation on
//                             ProductInventoryTab's own copy of this
//                             constant).
//   - TABLE_CELL_PADDING_Y   top/bottom padding inside every cell.
//   - ACCOUNT_SELECT_HEIGHT  height of the Account Code select control
//                             itself, so the input doesn't sit taller than
//                             the row it's in.
const TABLE_ROW_HEIGHT = 0;
const TABLE_CELL_PADDING_Y = 1;
const ACCOUNT_SELECT_HEIGHT = 32;

// Column widths — each independently adjustable, rather than one hardcoded
// width={220} shared between the header cell and nothing else.
const INDEX_COLUMN_WIDTH = 48;
const ACCOUNT_CODE_COLUMN_WIDTH = 220;

// Width (px) of the Account Code select's OPEN dropdown — deliberately
// wider than the closed field (ACCOUNT_CODE_COLUMN_WIDTH) so its two-column
// Code/Name layout (see AccountCodeDropdownPaper below) has room to read,
// the way a select2-style combobox does. Same pattern as WarehouseMaster's
// own Accounting tab.
const ACCOUNT_CODE_DROPDOWN_WIDTH = 380;
// How much of ACCOUNT_CODE_DROPDOWN_WIDTH the Code column takes, both in
// the dropdown's header row and in each option row.
const ACCOUNT_CODE_DROPDOWN_CODE_WIDTH = 140;

// The select2-style header row + two-column option layout for the Account
// Code dropdown. MUI's Autocomplete has no "table header inside the popup"
// prop, so this wraps the Paper it renders its listbox in and injects a
// sticky header above `children` (the actual list of options). Same shape
// as WarehouseMaster's own AccountCodeDropdownPaper.
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
// value is the ChartOfAccount id this form stores, so the code shown here
// comes from `option.code`, a separate field added alongside it.
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

// Type-to-filter for the Account Code select: matches the typed text against
// BOTH the account code and the account name, not just the code (MUI
// Autocomplete's default filter only checks getOptionLabel, which here is
// just `option.code`). Used on every Account Code picker on this form, not
// only the Tax rows, so typing a name works everywhere a code would.
function filterAccountOptions(options, { inputValue }) {
  const q = inputValue.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) => (
    String(o.code || '').toLowerCase().includes(q)
    || String(o.accountName || '').toLowerCase().includes(q)
  ));
}

// Sales > General account rows, in the order SAP's own "Add GL Account
// Determination" screen lists them. `field` is the form/DB field storing the
// chosen ChartOfAccount id.
const SALES_GENERAL_ROWS = [
  { field: 'domesticAccountsReceivableId', label: 'Domestic Accounts Receivable' },
  { field: 'foreignAccountsReceivableId', label: 'Foreign Accounts Receivable' },
  { field: 'checksReceivedId', label: 'Checks Received' },
  { field: 'cashOnHandId', label: 'Cash on Hand' },
  { field: 'overpaymentARId', label: 'Overpayment A/R Account' },
  { field: 'underpaymentARId', label: 'Underpayment A/R Account' },
  { field: 'downPaymentClearingId', label: 'Down Payment Clearing Account' },
  { field: 'realizedExchangeDiffGainId', label: 'Realized Exchange Diff. Gain' },
  { field: 'realizedExchangeDiffLossId', label: 'Realized Exchange Diff. Loss' },
  { field: 'realizedConversionDiffGainId', label: 'Realized Conversion Diff. Gain' },
  { field: 'realizedConversionDiffLossId', label: 'Realized Conversion Diff. Loss' },
  // Feeds Product Group's Accounting tab (see PRODUCT_GROUP_ACCOUNT_MAP in
  // ProductGroup.jsx) — not part of the original reference screen.
  { field: 'revenueAccountId', label: 'Revenue Account' },
  { field: 'salesCreditAccountId', label: 'Sales Credit Account' },
];

// Sales > Tax -- the company-wide DEFAULT account each tax type posts to on
// a sales document. Always exactly these 3 rows (never one per Tax Code --
// a specific Tax Code's own Sales/Purchase/RCM mapping, set on the Tax Code
// Master screen, takes priority over this default when both are set).
const SALES_TAX_ROWS = [
  { field: 'salesCgstAccountId', label: 'CGST' },
  { field: 'salesSgstAccountId', label: 'SGST' },
  { field: 'salesIgstAccountId', label: 'IGST' },
];

const PURCHASING_ROWS = [
  { field: 'domesticAccountsPayableId', label: 'Domestic Accounts Payable' },
  { field: 'foreignAccountsPayableId', label: 'Foreign Accounts Payable' },
  { field: 'purchRealizedExchangeDiffGainId', label: 'Realized Exchange Diff. Gain' },
  { field: 'purchRealizedExchangeDiffLossId', label: 'Realized Exchange Diff. Loss' },
  { field: 'purchRealizedConversionDiffGainId', label: 'Realized Conversion Diff. Gain' },
  { field: 'purchRealizedConversionDiffLossId', label: 'Realized Conversion Diff. Loss' },
  { field: 'bankTransferId', label: 'Bank Transfer' },
  { field: 'cashDiscountId', label: 'Cash Discount' },
  { field: 'cashDiscountClearingId', label: 'Cash Discount Clearing' },
  { field: 'expenseAccountId', label: 'Expense Account' },
  { field: 'purchaseCreditAccountId', label: 'Purchase Credit Account' },
  { field: 'overpaymentAPId', label: 'Overpayment A/P Account' },
  // Feeds Product Group's Accounting tab (see PRODUCT_GROUP_ACCOUNT_MAP in
  // ProductGroup.jsx) — not part of the original reference screen.
  { field: 'purchaseAccountId', label: 'Purchase Account' },
  { field: 'purchaseReturnAccountId', label: 'Purchase Return Account' },
  { field: 'costOfGoodsPurchasedAccountId', label: 'Cost of Goods Purchased Account' },
  { field: 'purchaseBalanceAccountId', label: 'Purchase Balance Account' },
];

// Purchasing > Tax -- same idea as Sales > Tax above: the company-wide
// DEFAULT account each tax type posts to on a purchase document, always
// exactly 3 rows.
const PURCHASE_TAX_ROWS = [
  { field: 'purchaseCgstAccountId', label: 'CGST' },
  { field: 'purchaseSgstAccountId', label: 'SGST' },
  { field: 'purchaseIgstAccountId', label: 'IGST' },
];

const GENERAL_ROWS = [
  { field: 'creditCardDepositFeeId', label: 'Credit Card Deposit Fee' },
  { field: 'roundingAccountId', label: 'Rounding Account' },
  { field: 'automaticReconciliationDiffId', label: 'Automatic Reconciliation Diff' },
  { field: 'periodEndClosingAccountId', label: 'Period-End Closing Account' },
  { field: 'genRealizedExchangeDiffGainId', label: 'Realized Exchange Diff. Gain' },
  { field: 'genRealizedExchangeDiffLossId', label: 'Realized Exchange Diff. Loss' },
  { field: 'genRealizedConversionDiffGainId', label: 'Realized Conversion Diff. Gain' },
  { field: 'genRealizedConversionDiffLossId', label: 'Realized Conversion Diff. Loss' },
  { field: 'openingBalanceAccountId', label: 'Opening Balance Account' },
  { field: 'bankChargesAccountId', label: 'Bank Charges Account' },
  { field: 'incomingCenvatClearingActId', label: 'Incoming CENVAT Clearing Act' },
  { field: 'outgoingCenvatClearingActId', label: 'Outgoing CENVAT Clearing Act' },
  { field: 'plaId', label: 'PLA' },
  { field: 'tdsInterestActId', label: 'TDS Interest Act' },
  { field: 'tdsOtherChargesActId', label: 'TDS Other Charges Act' },
  { field: 'tdsFeeActId', label: 'TDS Fee Act' },
  { field: 'gstInterestAccountId', label: 'GST Interest Account' },
  // GST control accounts — where the CGST/SGST/IGST split computed on every
  // invoice lands in the ledger when its journal entry is generated
  // (backend/src/utils/glPosting.js). Output = tax collected on a sale, a
  // liability; Input = tax paid on a purchase, recoverable against it.
  //
  // Three per side rather than one lumped tax account because GSTR-1/GSTR-3B
  // report the three separately — collapse them and the returns can no longer
  // be derived from the ledger. An unconfigured one parks that document's
  // journal entry with a message naming it; it never blocks the document.
  { field: 'outputCgstPayableId', label: 'Output CGST Payable' },
  { field: 'outputSgstPayableId', label: 'Output SGST Payable' },
  { field: 'outputIgstPayableId', label: 'Output IGST Payable' },
  { field: 'inputCgstReceivableId', label: 'Input CGST Receivable' },
  { field: 'inputSgstReceivableId', label: 'Input SGST Receivable' },
  { field: 'inputIgstReceivableId', label: 'Input IGST Receivable' },
  // Feeds Product Group's Accounting tab (see PRODUCT_GROUP_ACCOUNT_MAP in
  // ProductGroup.jsx) — not part of the original reference screen.
  { field: 'expenseClearingAccountId', label: 'Expense Clearing Account' },
];

const INVENTORY_ROWS = [
  { field: 'inventoryAccountId', label: 'Inventory Account' },
  { field: 'costOfGoodsSoldAccountId', label: 'Cost of Goods Sold Account' },
  { field: 'allocationAccountId', label: 'Allocation Account' },
  { field: 'varianceAccountId', label: 'Variance Account' },
  { field: 'priceDifferenceAccountId', label: 'Price Difference Account' },
  { field: 'negativeInventoryAdjAcctId', label: 'Negative Inventory Adj. Acct' },
  { field: 'inventoryOffsetDecrAcctId', label: 'Inventory Offset - Decr. Acct' },
  { field: 'inventoryOffsetIncrAcctId', label: 'Inventory Offset - Incr. Acct' },
  { field: 'salesReturnsAccountId', label: 'Sales Returns Account' },
  { field: 'exchangeRateDifferencesAccountId', label: 'Exchange Rate Differences Account' },
  { field: 'goodsClearingAccountId', label: 'Goods Clearing Account' },
  { field: 'glDecreaseAccountId', label: 'G/L Decrease Account' },
  { field: 'glIncreaseAccountId', label: 'G/L Increase Account' },
  { field: 'wipInventoryAccountId', label: 'WIP Inventory Account' },
  { field: 'wipInventoryVarianceAccountId', label: 'WIP Inventory Variance Account' },
  { field: 'wipOffsetPLAccountId', label: 'WIP Offset P&L Account' },
  // Feeds Product Group's Accounting tab (see PRODUCT_GROUP_ACCOUNT_MAP in
  // ProductGroup.jsx) — not part of the original reference screen.
  { field: 'inventoryOffsetPnlAccountId', label: 'Inventory Offset P&L Account' },
  { field: 'shippedGoodsAccountId', label: 'Shipped Goods Account' },
];

const ALL_ROW_GROUPS = [
  SALES_GENERAL_ROWS, SALES_TAX_ROWS, PURCHASING_ROWS, PURCHASE_TAX_ROWS, GENERAL_ROWS, INVENTORY_ROWS,
];

const emptyValues = {
  accountsReceivableId: null,
  permitChangeOfControlAccounts: false,
  defaultCustomerCode: null,
  ...Object.fromEntries(ALL_ROW_GROUPS.flat().map((r) => [r.field, null])),
};

// Reached at /accounting/gl-account-determination/new (create) or
// /accounting/gl-account-determination/:id/edit (edit an existing row — one
// per Financial Year). The list page (GLAccountDetermination.jsx) is what
// links here; this component only ever handles one record at a time.
export default function GLAccountDeterminationForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const notify = useNotify();
  const { data: years } = financialYearApi.useList();
  const { data: accounts } = chartOfAccountApi.useList();
  const { data: customers } = businessPartnerApi.useList({ partnerType: 'Customer' });
  const { data: determinations } = glAccountDeterminationApi.useList();
  const [create, { isLoading: creating }] = glAccountDeterminationApi.useCreate();
  const [update, { isLoading: updating }] = glAccountDeterminationApi.useUpdate();

  const yearOptions = useMemo(
    () => (years || []).map((y) => ({ label: y.financialYearName, value: y.id })),
    [years]
  );
  const accountOptions = useMemo(
    () => (accounts || []).map((a) => ({
      label: a.accountCode, value: a.id, code: a.accountCode, accountName: a.accountName,
    })),
    [accounts]
  );
  const accountById = useMemo(() => new Map((accounts || []).map((a) => [a.id, a])), [accounts]);
  // Sales > Tax / Purchasing > Tax Account Code options.
  //
  // Source of truth (exact, no other filtering logic):
  //   SELECT * FROM ChartOfAccounts
  //   WHERE AccountName LIKE '%GST%' AND AccountNature = 'A';
  //
  // i.e. "GST" anywhere in the account name (start/middle/end, case-
  // insensitive — names are free-typed on Chart of Accounts) AND
  // accountNature = 'A' (Active/postable, not a Title roll-up header).
  // Deliberately does NOT check Account Group / Liabilities classification —
  // this list is exactly this query's result set, nothing more.
  const taxAccountOptions = useMemo(
    () => accountOptions.filter((o) => {
      const account = accountById.get(o.value);
      const nameHasGst = /gst/i.test(account?.accountName || '');
      const isActive = account?.accountNature === 'A';
      return nameHasGst && isActive;
    }),
    [accountOptions, accountById]
  );
  const taxAccountsNoOptionsText = 'No GST Accounts Found';
  // value is the Business Partner's code (see the schema comment on
  // GlAccountDetermination.defaultCustomerCode) — Business Partner replaced
  // the retired Customer Master as the source for this dropdown.
  const customerOptions = useMemo(
    () => (customers || []).map((c) => ({ label: `${c.partnerCode} — ${c.partnerName}`, value: c.partnerCode })),
    [customers]
  );

  // The row being edited (edit mode), found by route id — vs. `periodId`
  // below, which drives create mode and is otherwise derived from it once
  // it loads.
  const editingRow = useMemo(
    () => (isEdit ? (determinations || []).find((d) => String(d.id) === String(id)) || null : null),
    [isEdit, determinations, id]
  );

  // Which Financial Year the screen is editing. In edit mode this is fixed
  // to the record's own year (see effect below); in create mode it's a live
  // choice that decides whether Save creates or — if a row for that year
  // somehow already exists — updates it instead of colliding with the
  // table's one-row-per-year constraint.
  const [periodId, setPeriodId] = useState(null);
  useEffect(() => {
    if (editingRow) setPeriodId(editingRow.financialYearId);
  }, [editingRow]);

  const existing = isEdit
    ? editingRow
    : (determinations || []).find((d) => d.financialYearId === periodId) || null;

  // Top-level Sales / Purchasing / General / Inventory tabs. Resources and
  // WIP Mapping — present on the reference screen — are intentionally left
  // out; nothing in this build maps to them yet.
  const [mainTab, setMainTab] = useState(0);
  // Sales' own General / Tax sub-tabs.
  const [salesTab, setSalesTab] = useState(0);
  // Purchasing's own General / Tax sub-tabs — same pattern as Sales above.
  const [purchaseTab, setPurchaseTab] = useState(0);

  const handleSubmit = async (values, formMethods) => {
    if (!periodId) {
      notify.error('Select a Period first.');
      return;
    }
    const payload = { ...values, financialYearId: periodId };
    try {
      if (existing) {
        await update({ id: existing.id, ...payload }).unwrap();
        notify.success('GL Account Determination updated');
      } else {
        await create(payload).unwrap();
        notify.success('GL Account Determination saved');
      }
      navigate(LIST_PATH);
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  // In edit mode, wait for the record to actually load before rendering the
  // form — otherwise it would briefly mount with emptyValues and a formKey
  // that then has to change again once editingRow arrives.
  if (isEdit && !editingRow && determinations === undefined) {
    return null;
  }

  return (
    <Box>
      <EntityHeaderCard
        icon={<RuleOutlinedIcon />}
        title={isEdit ? 'Edit GL Account Determination' : 'Add GL Account Determination'}
        subtitle="Map default G/L accounts used when posting sales, purchasing, and inventory documents."
        rightContent={<CompanyBadge compact />}
      />

      <Card variant="outlined">
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ maxWidth: 320, mb: 2 }}>
            <FormSelectStandalone
              label="Period Selection *"
              options={yearOptions}
              value={periodId}
              onChange={setPeriodId}
              disabled={isEdit}
            />
          </Box>

          <AppForm
            key={existing?.id ?? periodId ?? 'none'}
            defaultValues={existing ? { ...emptyValues, ...existing } : emptyValues}
            onSubmit={handleSubmit}
          >
            <Tabs
              value={mainTab}
              onChange={(_e, v) => setMainTab(v)}
              variant="scrollable"
              allowScrollButtonsMobile
              sx={{ mb: 1, borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab label="Sales" />
              <Tab label="Purchasing" />
              <Tab label="General" />
              <Tab label="Inventory" />
            </Tabs>

            {mainTab === 0 && (
              <Box sx={{ pt: 1 }}>
                <Tabs
                  value={salesTab}
                  onChange={(_e, v) => setSalesTab(v)}
                  sx={{ mb: 2, minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5 } }}
                >
                  <Tab label="General" />
                  <Tab label="Tax" />
                </Tabs>

                {salesTab === 0 && (
                  <SalesGeneralTab
                    accountOptions={accountOptions}
                    accountById={accountById}
                    customerOptions={customerOptions}
                  />
                )}
                {salesTab === 1 && (
                  <AccountRowsTable
                    rows={SALES_TAX_ROWS}
                    accountOptions={taxAccountOptions}
                    accountById={accountById}
                    typeLabel="Type of Tax"
                    filterOptions={filterAccountOptions}
                    noOptionsText={taxAccountsNoOptionsText}
                  />
                )}
              </Box>
            )}

            {mainTab === 1 && (
              <Box sx={{ pt: 1 }}>
                <Tabs
                  value={purchaseTab}
                  onChange={(_e, v) => setPurchaseTab(v)}
                  sx={{ mb: 2, minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5 } }}
                >
                  <Tab label="General" />
                  <Tab label="Tax" />
                </Tabs>

                {purchaseTab === 0 && (
                  <AccountRowsTable rows={PURCHASING_ROWS} accountOptions={accountOptions} accountById={accountById} />
                )}
                {purchaseTab === 1 && (
                  <AccountRowsTable
                    rows={PURCHASE_TAX_ROWS}
                    accountOptions={taxAccountOptions}
                    accountById={accountById}
                    typeLabel="Type of Tax"
                    filterOptions={filterAccountOptions}
                    noOptionsText={taxAccountsNoOptionsText}
                  />
                )}
              </Box>
            )}
            {mainTab === 2 && (
              <Box sx={{ pt: 1 }}>
                <AccountRowsTable rows={GENERAL_ROWS} accountOptions={accountOptions} accountById={accountById} />
              </Box>
            )}
            {mainTab === 3 && (
              <Box sx={{ pt: 1 }}>
                <AccountRowsTable rows={INVENTORY_ROWS} accountOptions={accountOptions} accountById={accountById} />
              </Box>
            )}

            <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 3 }}>
              <Button variant="outlined" color="error" disabled={creating || updating} onClick={() => navigate(LIST_PATH)}>
                Cancel
              </Button>
              <FormSubmitButton disabled={creating || updating}>
                Save
              </FormSubmitButton>
            </Stack>
          </AppForm>
        </CardContent>
      </Card>
    </Box>
  );
}

// Sales > General — Accounts Receivable / Permit Change of Control Accounts /
// Default Customer, then the Type of Account table. Split out of the main
// component only so its fields sit inside AppForm's FormProvider tree, same
// as ChartOfAccounts' AccountFormFields.
function SalesGeneralTab({ accountOptions, accountById, customerOptions }) {
  return (
    <Box>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={3}
        alignItems={{ md: 'flex-start' }}
        sx={{ mb: 3 }}
      >
        <Box sx={{ width: { xs: '100%', md: 320 } }}>
          {/* Same select2-style Code/Name dropdown as the Type of Account
              table below (AccountRowsTable/DeterminationRow) — this control
              account picker is a standalone field outside that table, but
              it's still an Account Code select and should look like every
              other one on this form. */}
          <FormSelect
            name="accountsReceivableId"
            label="Accounts Receivable"
            options={accountOptions}
            PaperComponent={AccountCodeDropdownPaper}
            renderOption={renderAccountCodeOption}
            componentsProps={{ popper: { style: { width: ACCOUNT_CODE_DROPDOWN_WIDTH } } }}
          />
        </Box>
        <Box sx={{ pt: { md: 1 } }}>
          <FormCheckbox name="permitChangeOfControlAccounts" label="Permit Change of Control Accounts" />
        </Box>
      </Stack>

      <Box sx={{ width: { xs: '100%', md: 420 }, mb: 3 }}>
        <FormSelect
          name="defaultCustomerCode"
          label="Default Customer for A/R Invoice and Payment"
          options={customerOptions}
        />
      </Box>

      <AccountRowsTable rows={SALES_GENERAL_ROWS} accountOptions={accountOptions} accountById={accountById} />
    </Box>
  );
}

// The "# / Type of Account / Account Code / Account Name" table shared by
// every tab (Sales > General, Purchasing, General, Inventory) — only the row
// list differs per tab.
function AccountRowsTable({
  rows, accountOptions, accountById, typeLabel = 'Type of Account', filterOptions, noOptionsText,
}) {
  return (
    <TableContainer component={Paper} variant="outlined">
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
            <TableCell width={INDEX_COLUMN_WIDTH}>#</TableCell>
            <TableCell>{typeLabel}</TableCell>
            <TableCell width={ACCOUNT_CODE_COLUMN_WIDTH}>Account Code</TableCell>
            <TableCell>Account Name</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, idx) => (
            <DeterminationRow
              key={row.field}
              index={idx + 1}
              row={row}
              accountOptions={accountOptions}
              accountById={accountById}
              filterOptions={filterOptions}
              noOptionsText={noOptionsText}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// One table row: the account picker plus a read-only Account Name cell that
// follows whatever was picked — mirrors the reference screen, where Account
// Name is filled in by the system once a code is chosen, not typed.
function DeterminationRow({ index, row, accountOptions, accountById, filterOptions, noOptionsText }) {
  const { watch } = useFormContext();
  const selectedId = watch(row.field);
  const account = selectedId ? accountById.get(selectedId) : null;
  return (
    <TableRow hover>
      <TableCell>{index}</TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.label}</TableCell>
      <TableCell sx={{ width: ACCOUNT_CODE_COLUMN_WIDTH }}>
        <FormSelect
          name={row.field}
          label=""
          options={accountOptions}
          size="small"
          fullWidth={false}
          sx={{
            width: ACCOUNT_CODE_COLUMN_WIDTH,
            // Shrinks the select itself to ACCOUNT_SELECT_HEIGHT and drops
            // the helper-text row FormSelect otherwise always reserves (for
            // a would-be validation message) — these Account Code fields
            // are optional, so that reserved strip is normally just dead
            // space padding out every row.
            '& .MuiOutlinedInput-root': {
              height: ACCOUNT_SELECT_HEIGHT,
              minHeight: ACCOUNT_SELECT_HEIGHT,
            },
            '& .MuiAutocomplete-input': { py: '2px' },
            '& .MuiFormHelperText-root': { display: 'none' },
          }}
          // select2-style dropdown: a Code/Name header row
          // (AccountCodeDropdownPaper) above two-column option rows
          // (renderAccountCodeOption), widened past the field itself so
          // both columns are legible — same as WarehouseMaster's Accounting
          // tab. Picking a row still just writes the account id to this
          // field, same as any other select — only the open dropdown looks
          // different.
          PaperComponent={AccountCodeDropdownPaper}
          renderOption={renderAccountCodeOption}
          componentsProps={{ popper: { style: { width: ACCOUNT_CODE_DROPDOWN_WIDTH } } }}
          filterOptions={filterOptions}
          noOptionsText={noOptionsText}
        />
      </TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>{account?.accountName || '—'}</TableCell>
    </TableRow>
  );
}


// A plain (non-RHF) Autocomplete-style select for Period Selection, which
// lives outside the form — it decides WHICH saved record the form loads
// rather than being a value the form itself submits. Locked in edit mode:
// a saved row's year isn't something Save is allowed to move.
function FormSelectStandalone({ label, options, value, onChange, disabled }) {
  const selected = options.find((o) => o.value === value) || null;
  return (
    <Autocomplete
      options={options}
      value={selected}
      size="small"
      disabled={disabled}
      isOptionEqualToValue={(o, v) => o.value === v.value}
      getOptionLabel={(o) => o.label || ''}
      onChange={(_e, newValue) => onChange(newValue?.value ?? null)}
      // `label` already carries its own literal " *" (see "Period Selection
      // *" below), matching every other required field's label in this app —
      // MUI's `required` prop on TextField adds a second, auto-generated "*"
      // to the rendered label on top of that, which is what showed as "**".
      // No `required` prop here; the one asterisk already in the text is
      // enough, same as everywhere else.
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  );
}
