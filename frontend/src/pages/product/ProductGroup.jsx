import React, { useEffect, useMemo, useState } from 'react';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import {
  Box, Typography, Button, Card, CardContent, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Chip, IconButton, Tabs, Tab, Paper,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import CategoryIcon from '@mui/icons-material/Category';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import { useUnsavedChangesGuard, FormDirtyTracker } from '../../components/form/useUnsavedChangesGuard';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { productGroupSchema } from '../../lib/validation/productSchemas';
import {
  productGroupApi, uomApi, chartOfAccountApi, financialYearApi, glAccountDeterminationApi,
} from '../../features/resources';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import DocumentNoField from '../../components/form/DocumentNoField';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';

const emptyValues = {
  groupCode: '', groupName: '', description: '', uom: '', status: 'Active',
  expenseAccount: '', revenueAccount: '', inventoryAccount: '', costOfGoodsSoldAccount: '',
  allocationAccount: '', varianceAccount: '', priceDifferenceAccount: '', negativeInventoryAdjustmentAccount: '',
  inventoryOffsetDecreaseAccount: '', inventoryOffsetIncreaseAccount: '', salesReturnsAccount: '',
  purchaseAccount: '', purchaseReturnAccount: '', costOfGoodsPurchasedAccount: '', exchangeRateDifferencesAccount: '',
  goodsClearingAccount: '', glDecreaseAccount: '', glIncreaseAccount: '', wipInventoryAccount: '',
  wipInventoryVarianceAccount: '', wipOffsetPnlAccount: '', inventoryOffsetPnlAccount: '', expenseClearingAccount: '',
  shippedGoodsAccount: '', salesCreditAccount: '', purchaseCreditAccount: '', purchaseBalanceAccount: '',
  incomingCenvatAccount: '', outgoingCenvatAccount: '',
};

// Accounting tab — identical set of G/L account determination roles, in the
// same order, as WarehouseMaster's own Accounting tab. `field` must match a
// productGroupSchema/schema.prisma column one-for-one — see the comment on
// ProductGroup.expenseAccount for why these are stored by ChartOfAccount code
// rather than an FK id.
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
// Product Group inherits the current Financial Year's account mappings
// instead of every one of these 29 fields starting blank. Every entry here
// has a real counterpart on that screen — see the comments added alongside
// each new *AccountId field in schema.prisma's GlAccountDetermination model
// for the ones that were added purely to give this map something to read.
const PRODUCT_GROUP_ACCOUNT_MAP = {
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
// pattern as Product Master's Inventory tab (see ProductInventoryTab.jsx)
// and Warehouse Master's / GL Account Determination's own Accounting-style
// tables: one constant per knob, tunable on its own.
//   - TABLE_ROW_HEIGHT       floor row height (a real row can still grow
//                             past it).
//   - TABLE_CELL_PADDING_Y   top/bottom padding inside every cell.
//   - ACCOUNT_SELECT_HEIGHT  height of the Account Code select control
//                             itself, so the input doesn't sit taller than
//                             the row it's in.
const TABLE_ROW_HEIGHT = 0;
const TABLE_CELL_PADDING_Y = 1;
const ACCOUNT_SELECT_HEIGHT = 32;

// Row sizing/border for the main Product Group list table — same grid-line
// treatment as Warehouse Master's list table, kept as its own constants
// since this table's padding is looser than the dense Accounting tab table
// above.
const PRODUCT_GROUP_LIST_TABLE_ROW_HEIGHT = 0;
const PRODUCT_GROUP_LIST_TABLE_CELL_PADDING_Y = 6;
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
// sticky header above `children` (the actual list of options). Same shape as
// WarehouseMaster's own AccountCodeDropdownPaper.
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

const PAGE_SIZE = 10;

export default function ProductGroup() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const { data: groups, isLoading, isFetching, refetch } = productGroupApi.useList();
  const { data: uoms } = uomApi.useList();
  const { data: accounts } = chartOfAccountApi.useList();
  const { data: financialYears } = financialYearApi.useList();
  const { data: glDeterminations } = glAccountDeterminationApi.useList();
  const [create, { isLoading: creating }] = productGroupApi.useCreate();
  const [update, { isLoading: updating }] = productGroupApi.useUpdate();
  const [remove] = productGroupApi.useDelete();

  // The form lives in a modal — the page itself is the list, and "Add
  // Product Group" (or an edit action) opens the dialog over it. Same shape
  // as the Warehouse Master page / shared MasterCrudPage template.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  // Which of the two form tabs (General / Accounting) is showing.
  const [tab, setTab] = useState(0);
  // Accounting-tab defaults for a brand-new group, pulled from the current
  // Financial Year's G/L Account Determination — see openCreate below. Only
  // ever used for the create form; editing an existing group always shows
  // its own saved values, never these.
  const [createAccountingDefaults, setCreateAccountingDefaults] = useState({});

  const uomOptions = useMemo(() => (uoms || [])
    .filter((u) => u.status === 'Active')
    .map((u) => ({ label: u.uomName, value: u.uomName })),
  [uoms]);

  // Accounting tab options — only real posting accounts (accountNature 'A',
  // i.e. not a Title/heading account) and only Active ones can be assigned as
  // a G/L determination account. accountByCode is unfiltered on purpose: it's
  // used to resolve the read-only Account Name column, and a group whose
  // assigned account has since been made inactive should still show its name
  // rather than go blank. Same shape as WarehouseMaster's accountOptions.
  const accountOptions = useMemo(() => (accounts || [])
    .filter((a) => a.accountNature === 'A' && a.status === 'A')
    .map((a) => ({ label: a.accountCode, value: a.accountCode, accountName: a.accountName })),
  [accounts]);
  const accountByCode = useMemo(() => new Map((accounts || []).map((a) => [a.accountCode, a])), [accounts]);
  // Resolves a G/L Account Determination *Id field (a ChartOfAccount row id)
  // back to the accountCode string this page's Accounting fields are stored
  // by — see the cross-master-by-code convention noted on
  // ProductGroup.expenseAccount in schema.prisma.
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

  const allRows = groups || [];

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'groupCode', headerName: 'Group Code', filter: 'text' },
    { field: 'groupName', headerName: 'Group Name', filter: 'text' },
    { field: 'uom', headerName: 'UOM', filter: 'select' },
    { field: 'description', headerName: 'Description', filter: 'text' },
    { field: 'status', headerName: 'Status', filter: 'select' },
  ]), []);
  const table = useTableFeatures(allRows, tableColumns, { onChange: setPage });
  const rows = table.rows;
  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  useEffect(() => { setPage(0); }, [rows.length]);

  // Every Accounting field the current Financial Year's G/L Account
  // Determination has a mapped, resolvable account for — see
  // PRODUCT_GROUP_ACCOUNT_MAP. A role with no determination row, no value
  // set on it, or an id that no longer resolves to a real account is simply
  // left out, so the field falls back to emptyValues' '' the same as if no
  // determination existed at all — never a broken/blank-looking selection.
  const accountingDefaultsFromDetermination = () => {
    if (!activeDetermination) return {};
    const result = {};
    Object.entries(PRODUCT_GROUP_ACCOUNT_MAP).forEach(([pgField, glField]) => {
      const accountId = activeDetermination[glField];
      const code = accountId != null ? accountCodeById.get(accountId) : null;
      if (code) result[pgField] = code;
    });
    return result;
  };

  const openCreate = () => {
    setEditingRow(null);
    setReadOnly(false);
    setCreateAccountingDefaults(accountingDefaultsFromDetermination());
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
    setFormKey((k) => k + 1);
    setDialogOpen(true);
    setTab(0);
  };

  const handleEdit = (row) => {
    setEditingRow(row);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    setDialogOpen(true);
    setTab(0);
  };

  const handleDelete = async (row) => {
    const ok = await confirmDialog({
      title: 'Delete product group',
      message: `Are you sure you want to delete "${row.groupName}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Product group deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...values }).unwrap();
        notify.success('Product group updated');
      } else {
        await create(values).unwrap();
        notify.success('Product group added');
      }
      forceClose();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<CategoryIcon />}
        title="Product Group"
        subtitle="Manage your product groups. Add, update or remove groups."
        rightContent={
          <CanAdd>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Add Product Group
            </Button>
          </CanAdd>
        }
      />

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
            {readOnly ? 'View Product Group' : editingRow ? 'Edit Product Group' : 'New Product Group'}
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
          schema={productGroupSchema}
          defaultValues={editingRow
            ? { ...emptyValues, ...editingRow }
            : { ...emptyValues, ...createAccountingDefaults }}
          onSubmit={handleSubmit}
        >
          {({ watch }) => (
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
                  // components/form/LabeledField.jsx).
                  <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                    {/* Auto-generated from the perpetual PG numbering series (hidden from
                        the Document Numbering page — see hiddenFromNumberingUI in
                        documentNumberService.js). The field is filled and locked on
                        create, and left untouched on edit so an existing record's code
                        is never rewritten. */}
                    <LabeledField label="Group Code *">
                      <DocumentNoField documentCode="PG" name="groupCode" label="" isCreate={!editingRow} />
                    </LabeledField>
                    <LabeledField label="Group Name *">
                      <FormTextField name="groupName" label="" placeholder="Enter group name" />
                    </LabeledField>
                    <LabeledField label="Unit of Measure">
                      <FormSelect name="uom" label="" placeholder="Select unit" options={uomOptions} />
                    </LabeledField>
                    <LabeledField label="Description">
                      <FormTextField name="description" label="" placeholder="Enter description (optional)" />
                    </LabeledField>
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
                    {!editingRow && Object.keys(createAccountingDefaults).length > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                        Pre-filled from the {activeFinancialYear?.financialYearName} G/L Account Determination — change
                        any row below before saving if this group needs different accounts.
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
                  {readOnly ? 'View' : editingRow ? 'Update Group' : 'Save Group'}
                </FormSubmitButton>
                <Button variant={readOnly ? 'outlined' : 'text'} color={readOnly ? 'error' : 'inherit'} onClick={requestClose} disabled={creating || updating}>
                  {readOnly ? 'Close' : 'Cancel'}
                </Button>
              </DialogActions>
            </>
          )}
        </AppForm>
      </Dialog>

      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Product Group List</Typography>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TableSearchFilter table={table} placeholder="Search product groups..." width={220} />
              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => refetch()} disabled={isFetching}>
                Refresh
              </Button>
            </Stack>
          </Stack>

          <TableFilterPanel table={table} />

          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {!isLoading && pagedRows.map((row) => (
                <MobileRecordCard
                  key={row.id}
                  title={row.groupName}
                  statusChip={<Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />}
                  fields={[
                    { label: 'Group Code', value: row.groupCode },
                    { label: 'UOM', value: row.uom || '—' },
                    { label: 'Description', value: row.description || '—' },
                  ]}
                  onView={() => handleView(row)}
                  onEdit={() => handleEdit(row)}
                  onDelete={() => handleDelete(row)}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No product groups yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first product group to get started'} />
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table
                size="small"
                stickyHeader
                sx={{
                  '& th, & td': {
                    height: PRODUCT_GROUP_LIST_TABLE_ROW_HEIGHT,
                    paddingTop: `${PRODUCT_GROUP_LIST_TABLE_CELL_PADDING_Y}px`,
                    paddingBottom: `${PRODUCT_GROUP_LIST_TABLE_CELL_PADDING_Y}px`,
                    boxSizing: 'border-box',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell width={48}>#</TableCell>
                    <SortableHeaderCell field="groupCode" sort={table.sort} onSort={table.toggleSort}>Group Code</SortableHeaderCell>
                    <SortableHeaderCell field="groupName" sort={table.sort} onSort={table.toggleSort}>Group Name</SortableHeaderCell>
                    <SortableHeaderCell field="uom" sort={table.sort} onSort={table.toggleSort}>UOM</SortableHeaderCell>
                    <SortableHeaderCell field="description" sort={table.sort} onSort={table.toggleSort}>Description</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.groupCode}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.groupName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.uom || '—'}</TableCell>
                      <TableCell sx={{ maxWidth: 320 }}>{row.description || '—'}</TableCell>
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
                      <TableCell colSpan={7}>
                        <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title={table.isFiltering ? 'No matches' : 'No product groups yet'} message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first product group to get started'} />
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
