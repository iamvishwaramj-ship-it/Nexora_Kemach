import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import {
  Box, Typography, Button, Card, CardContent, Stack, IconButton, Tooltip,
  List, ListItemButton, ListItemText, Divider, Chip, Alert, TextField, InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFileOutlined';
import DownloadIcon from '@mui/icons-material/DownloadOutlined';
import AppForm, { FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import { FormCheckbox } from '../../components/form/FormCheckbox';
import FormRadioGroup from '../../components/form/FormRadioGroup';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import {
  chartOfAccountSchema, STATUS_AI_OPTIONS, BALANCE_TYPE_WITH_ALL_OPTIONS,
  GL_ACCOUNT_NATURE_OPTIONS,
} from '../../lib/validation/accountingSchemas';
import { useCurrencyOptions } from '../../lib/currencyOptions';
import {
  chartOfAccountApi, accountGroupApi, useGetChartOfAccountBalancesQuery,
  useImportChartOfAccountsXlsxMutation, useDownloadChartOfAccountsTemplateMutation,
} from '../../features/resources';
import { buildTreeRows, attachTreeGuides } from '../../lib/tree';
import {
  DRAWER_LEVEL, MAX_ACCOUNT_LEVEL, FIRST_ACCOUNT_LEVEL, buildLevelMap, buildChildCountMap,
  buildGroupLevelMap, childLevelOf, canParentChildren, isLegacyActiveParent,
  accountLevelOptions, countByLevel, sameDrawer, rootGroupIdOf,
} from '../../lib/accountHierarchy';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
// Vertical gap between every field in the Add Account card — text inputs,
// selects and checkboxes alike. Change this one value to re-space the whole
// form; it replaces FormGrid's own responsive spacing, which varied by
// breakpoint and differed between a checkbox row and an input row.
const account_field_gap = '1px';

// Width of the Add Account / Account Details card on desktop, in pixels.
// Lower this to narrow the card — the account tree beside it is flex:1, so it
// simply takes back whatever space the card gives up and nothing else needs
// touching. On phones/tablets the card still spans the full width regardless.
const account_card_width = 350;

// Typography of the drawer NUMBER on each Account Groups face — the 1/2/3/4/5
// in "1 Assets", "2 Liabilities". Only the digits take this; the group name
// beside them keeps whatever body font is configured.
//
// Monospace because the number is an index rather than prose: fixed-width
// digits sit at the same optical position on every drawer, so the row scans as
// a numbered sequence instead of five differently-nudged labels. It also stays
// aligned once a two-digit code (10, 11) appears.
//
// Settings > Fonts only overrides weight/style for the body scope, never the
// family (see theme/createAppTheme.js), so a plain value is enough here — no
// !important needed to survive a custom font choice.
const drawer_code_font_family = '"Roboto Mono", "Courier New", monospace';
// Bumped from the caption size the name uses (~0.75rem), so the number leads.
const drawer_code_font_size = '1.05rem';

// The account tree's connector lines (see TreeGuides at the bottom of this
// file). tree_guide_width is one level of indent AND the rail the vertical line
// runs down, so widening it indents the tree and spaces the lines in one go.
// tree_row_padding_y must match the row's own py — the rails cancel it out with
// a negative margin so the lines run unbroken between rows.
const tree_guide_width = 20;
const tree_row_padding_y = 4;
const tree_guide_stroke = '1px solid';
// Width of the expand/collapse chevron column. Every row reserves it — even a
// leaf with no chevron to show — so the icons and labels keep one straight
// left edge per level instead of shifting by whether a row has children.
const tree_toggle_width = 24;

// Title accounts are set in blue so the headings separate from the posting
// accounts at a glance — weight alone stops carrying that once the tree is
// deep and most rows are bold.
//
// Two values rather than one hard-coded hex: a blue dark enough to read on
// white goes muddy and low-contrast on the dark theme's slate background, so
// the dark mode gets a lighter tint of the same hue. Not a palette entry
// because the theme's `info` is a light blue chosen for alert surfaces, not
// for body text on white.
const title_account_color = { light: '#1565C0', dark: '#90CAF9' };
const titleAccountColor = (t) => (t.palette.mode === 'dark' ? title_account_color.dark : title_account_color.light);

// BalanceType is CHAR(1): 'D' Debit, 'C' Credit, 'A' All.
const BALANCE_TYPE_LABEL = { D: 'Debit', C: 'Credit', A: 'All' };
const BALANCE_TYPE_SHORT = { D: 'Dr', C: 'Cr', A: 'All' };

const emptyValues = {
  accountNature: 'A',
  // Level is a real form field, the way SAP asks you which of its five level
  // columns an account belongs in. It drives the Parent list rather than being
  // a read-only consequence of it — see AccountFormFields. The server
  // recomputes it from the saved parent regardless (see
  // backend/src/utils/chartOfAccountRules.js), so it can't be used to lie
  // about where an account sits.
  accountLevel: FIRST_ACCOUNT_LEVEL + 1,
  accountCode: '', accountName: '', groupId: null, parentAccountId: null,
  currency: 'INR', openingBalance: '', balanceType: 'D', isControlAccount: false, isBankAccount: false,
  allowManualEntry: true, costCenterRequired: false, status: 'A', remarks: '',
};

// Every descendant of `id` (its children, their children, ...) — walked from
// the flat list rather than a pre-built tree. Used both for Parent Account's
// dropdown (an account can't become its own descendant) and for the group
// tree's "include sub-groups" account count/filter.
function getDescendantIds(rows, startValue, parentField, keyField = 'id') {
  const result = new Set();
  const stack = [startValue];
  while (stack.length) {
    const current = stack.pop();
    rows.forEach((r) => {
      if (r[parentField] === current && !result.has(r.id)) {
        result.add(r.id);
        stack.push(r[keyField]);
      }
    });
  }
  return result;
}

// Folds a flat depth-first tree, and tells every node what it needs to draw
// its own toggle.
//
// Two passes, because those are two different questions:
//
//   1. How big is each node's subtree? Answered backwards, jumping a whole
//      subtree at a time — desc[j] is already known for anything below, so the
//      scan skips over it rather than re-walking it. That keeps a deep chart
//      linear instead of quadratic, and gives every node a descendant count to
//      show while it's shut ("4 hidden"), which is what distinguishes a folded
//      node from a genuinely empty one.
//   2. Which rows survive? Answered forwards with a single cutoff depth: once
//      a collapsed node is passed, everything deeper is dropped until the
//      depth comes back up to it. One variable is enough because the list is
//      depth-first — a subtree is always contiguous.
//
// `hasChildren` is read from the FULL list, so a node that is currently shut
// still knows to render a chevron. Deriving it from the visible rows instead
// would make the chevron vanish the moment it was used.
function applyCollapse(rows, collapsedKeys) {
  const descendants = new Array(rows.length).fill(0);
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    let count = 0;
    let j = i + 1;
    while (j < rows.length && rows[j].depth > rows[i].depth) {
      count += 1 + descendants[j];
      j += 1 + descendants[j];
    }
    descendants[i] = count;
  }

  const visible = [];
  let cutoffDepth = null;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (cutoffDepth != null) {
      if (row.depth > cutoffDepth) continue;
      cutoffDepth = null;
    }
    const hasChildren = descendants[i] > 0;
    const collapsed = hasChildren && collapsedKeys.has(row.collapseKey);
    visible.push({ ...row, hasChildren, descendantCount: descendants[i], collapsed });
    if (collapsed) cutoffDepth = row.depth;
  }
  return visible;
}

export default function ChartOfAccounts() {
  // Every currency dropdown reads live from Currency Master instead of a
  // hardcoded list — see lib/currencyOptions.js.
  const currencyOptions = useCurrencyOptions();
  const notify = useNotify();
  const confirmDialog = useConfirm();
  // error is destructured here (and surfaced below, near the empty-state
  // message) because a failed fetch previously looked IDENTICAL to "no
  // accounts exist yet" — `data` comes back undefined either way, so
  // `allRows` becomes [] and the page silently showed the friendly empty
  // state with no hint that the request never actually succeeded.
  const { data: accounts, isLoading, error: accountsError, refetch: refetchAccounts } = chartOfAccountApi.useList();
  const { data: groups, error: groupsError, refetch: refetchGroups } = accountGroupApi.useList();
  // Posted journal movement per account (every Sales/Purchase/Banking posting lands
  // here). Re-fetched each time the page opens so the Balance is never stale.
  const { data: ledgerMovement, refetch: refetchBalances } = useGetChartOfAccountBalancesQuery(undefined, { refetchOnMountOrArgChange: true });
  // This page lives inside KeepAliveOutlet: switching to another tab only
  // hides it (display: none), it never unmounts, so the on-mount refetch above
  // fires exactly once per session. A Sales Invoice, Payment or Opening Balance
  // posted in another tab then left this Balance stale until a hard reload.
  // Re-read whenever the page becomes visible again (a display:none -> shown
  // change flips IntersectionObserver's isIntersecting).
  const pageRootRef = useRef(null);
  const wasVisibleRef = useRef(true);
  useEffect(() => {
    const el = pageRootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((e) => e.isIntersecting);
      if (visible && !wasVisibleRef.current) refetchBalances();
      wasVisibleRef.current = visible;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [refetchBalances]);
  const [create, { isLoading: creating }] = chartOfAccountApi.useCreate();
  const [update, { isLoading: updating }] = chartOfAccountApi.useUpdate();
  const [remove] = chartOfAccountApi.useDelete();
  const [importXlsx, { isLoading: importing }] = useImportChartOfAccountsXlsxMutation();
  const [downloadTemplate, { isLoading: downloadingTemplate }] = useDownloadChartOfAccountsTemplateMutation();
  const importFileInputRef = useRef(null);

  const allRows = accounts || [];
  const allGroups = groups || [];
  const accountById = useMemo(() => new Map(allRows.map((a) => [a.id, a])), [allRows]);
  // parentAccountId stores the parent's AccountCode, not its numeric id (see
  // model ChartOfAccount in schema.prisma) — every parent lookup below reads
  // this map instead of accountById.
  const accountByCode = useMemo(() => new Map(allRows.map((a) => [a.accountCode, a])), [allRows]);

  // Live balance per account, signed (+ Debit / - Credit): the account's stored
  // opening balance (on its Balance Type side) plus everything posted to it, so tax
  // accounts such as "CGST - INPUT" move as soon as an invoice posts. A Title
  // account shows the roll-up of everything under it.
  const signedBalanceByCode = useMemo(() => {
    const movement = new Map((ledgerMovement || []).map((m) => [m.accountCode, (Number(m.debit) || 0) - (Number(m.credit) || 0)]));
    const own = new Map();
    const kids = new Map();
    allRows.forEach((a) => {
      const opening = Number(a.openingBalance) || 0;
      own.set(a.accountCode, (a.balanceType === 'C' ? -opening : opening) + (movement.get(a.accountCode) || 0));
      if (a.parentAccountId) {
        if (!kids.has(a.parentAccountId)) kids.set(a.parentAccountId, []);
        kids.get(a.parentAccountId).push(a.accountCode);
      }
    });
    const total = new Map();
    const visit = (code, trail) => {
      if (total.has(code)) return total.get(code);
      if (trail.has(code)) return 0; // guards a (bad-data) parent loop
      trail.add(code);
      let sum = own.get(code) || 0;
      (kids.get(code) || []).forEach((k) => { sum += visit(k, trail); });
      trail.delete(code);
      total.set(code, sum);
      return sum;
    };
    allRows.forEach((a) => visit(a.accountCode, new Set()));
    return total;
  }, [allRows, ledgerMovement]);
  const formatBalance = (code) => {
    const v = Math.round(((signedBalanceByCode.get(code) || 0) + Number.EPSILON) * 100) / 100;
    const text = Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return v === 0 ? text : `${text} ${v > 0 ? 'Dr' : 'Cr'}`;
  };
  const groupById = useMemo(() => new Map(allGroups.map((g) => [g.id, g])), [allGroups]);

  // Derived depth (see lib/accountHierarchy) and direct-child counts. Both are
  // computed from the flat list rather than read off the row, so a level that
  // was written by an older build — or a parent repointed outside the app —
  // still displays and validates against the account's real position.
  const levelById = useMemo(() => buildLevelMap(allRows), [allRows]);
  const childCountById = useMemo(() => buildChildCountMap(allRows), [allRows]);

  // Account Groups cabinet — one drawer face per ROOT group. Picking a drawer
  // sets the group a new account defaults into; there is no expandable
  // sub-group list underneath any more.
  const [selectedGroupId, setSelectedGroupId] = useState(null); // null = All Accounts

  // Free-text search across the whole chart — not scoped to the selected
  // drawer, so typing here searches every account regardless of which drawer
  // face happens to be open. Every field a user might plausibly search by is
  // folded into one haystack per account: code, name, remarks, currency,
  // nature, balance type, status, its own group's code/name, and its
  // parent's code/name.
  const [search, setSearch] = useState('');
  const searchQuery = search.trim().toLowerCase();

  // Sorted by Group Code, so the standard accounting order (1 Assets,
  // 2 Liabilities, 3 Equity, 4 Revenue, 5 Expenditure) always reads left to
  // right regardless of the order the API hands rows back in. numeric:true so
  // '10' sorts after '9' rather than after '1'.
  const rootGroups = useMemo(() => (
    allGroups
      .filter((g) => g.parentGroupId == null)
      .sort((a, b) => String(a.groupCode || '').localeCompare(String(b.groupCode || ''), undefined, { numeric: true }))
  ), [allGroups]);

  // Accounts shown in the tree beside the form: those posted to the selected
  // drawer's group, or to any group beneath it. null = no filter (All
  // Accounts).
  const visibleGroupIds = useMemo(() => {
    if (selectedGroupId == null) return null;
    return new Set([selectedGroupId, ...getDescendantIds(allGroups, selectedGroupId, 'parentGroupId')]);
  }, [selectedGroupId, allGroups]);

  // Depth-first, parent-then-children order — the same shape SAP's G/L account
  // tree shows, and the same shape the org's recursive AccountTree CTE
  // produces.
  //
  // Filtering happens BEFORE the tree is built, so a row whose parent sits in
  // another group is lifted to depth 0 rather than vanishing. That keeps every
  // account visible, but on its own it MISREPRESENTS the row: an account drawn
  // flush with the roots reads as a top-level, level-2 account when it is
  // really a level-3 child of something off-screen. That mismatch is what made
  // an apparently top-level Title disappear from the level-2 parent list.
  //
  // So each row now carries `parentOutsideView` — its parent exists but isn't
  // in this filtered view — and the list draws it differently instead of
  // letting the indentation quietly lie. The level chip beside it always shows
  // the DERIVED level, which is the number the parent dropdown actually
  // filters on.
  // Which nodes are folded shut — level-1 drawers and Title accounts alike.
  // Keys are namespaced ('g:12', 'a:12') because a group and an account can
  // share an id and must not fold each other.
  //
  // Held as the COLLAPSED set rather than the expanded one so a node that
  // appears later — a new drawer, a Title that just gained its first
  // sub-account — opens by default instead of hiding until someone thinks to
  // click it.
  const [collapsedNodes, setCollapsedNodes] = useState(() => new Set());
  const toggleNode = (key) => setCollapsedNodes((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  // In All Accounts the DRAWER itself is shown as the level-1 node with its
  // accounts nested beneath, so the tree reads 1 -> 2 -> 3 -> 4 -> 5 the whole
  // way down instead of starting at level 2 with the level-1 context living
  // only in the row of buttons above. With a single drawer selected the card
  // header already names it, so it isn't repeated as a node.
  const accountTreeRows = useMemo(() => {
    const rows = visibleGroupIds
      ? allRows.filter((a) => visibleGroupIds.has(a.groupId))
      : allRows;
    const sorted = [...rows].sort((a, b) =>
      String(a.accountCode || '').localeCompare(String(b.accountCode || ''), undefined, { numeric: true })
    );
    // Keyed by accountCode, not id: parentOutsideView below checks a row's
    // OWN parentAccountId (a code) against this set.
    const visibleIds = new Set(sorted.map((a) => a.accountCode));
    const asAccount = (row, extraDepth = 0) => ({
      ...row,
      kind: 'account',
      depth: row.depth + extraDepth,
      parentOutsideView: row.parentAccountId != null && !visibleIds.has(row.parentAccountId),
      collapseKey: `a:${row.id}`,
    });
    const treeOf = (subset) => buildTreeRows(subset, { idField: 'accountCode', parentField: 'parentAccountId' });

    // The FULL tree first — every node, nothing folded. Collapsing is applied
    // to this complete list afterwards, because a folded node still has to
    // know it has children in order to draw a chevron at all.
    const full = [];
    if (selectedGroupId != null) {
      treeOf(sorted).forEach((r) => full.push(asAccount(r)));
    } else {
      const placed = new Set();
      rootGroups.forEach((g) => {
        // A drawer owns its own group and every sub-group beneath it, so an
        // account filed into 1.1.1 Cash still hangs under the Assets node.
        const drawerGroupIds = new Set([g.id, ...getDescendantIds(allGroups, g.id, 'parentGroupId')]);
        const mine = sorted.filter((a) => drawerGroupIds.has(a.groupId));
        mine.forEach((a) => placed.add(a.id));
        full.push({
          kind: 'group', id: `group-${g.id}`, groupId: g.id, collapseKey: `g:${g.id}`,
          groupCode: g.groupCode, groupName: g.groupName, depth: 0,
        });
        treeOf(mine).forEach((r) => full.push(asAccount(r, 1)));
      });

      // Accounts whose group is missing or sits outside every drawer would
      // otherwise vanish from All Accounts entirely — which is the one thing
      // that view must never do.
      const stranded = sorted.filter((a) => !placed.has(a.id));
      if (stranded.length) {
        full.push({
          kind: 'group', id: 'group-none', groupId: null, collapseKey: 'g:none',
          groupCode: '—', groupName: 'Ungrouped', depth: 0,
        });
        treeOf(stranded).forEach((r) => full.push(asAccount(r, 1)));
      }
    }

    // Guides are computed LAST, on what survives the fold. Doing it the other
    // way round would leave elbows pointing at children that aren't on screen.
    return attachTreeGuides(applyCollapse(full, collapsedNodes));
  }, [allRows, allGroups, rootGroups, visibleGroupIds, selectedGroupId, collapsedNodes]);

  // Counted from the source rows, not the rendered tree: the header states how
  // many accounts this view covers, which shouldn't drop every time a drawer
  // is folded shut.
  const accountRowCount = useMemo(() => (
    visibleGroupIds ? allRows.filter((a) => visibleGroupIds.has(a.groupId)).length : allRows.length
  ), [allRows, visibleGroupIds]);

  // Search results, shown flat (no drawer grouping, no fold/collapse) instead
  // of the tree — searching across the whole chart cuts across drawers, so
  // nesting the matches back under their groups would mean re-deriving the
  // same tree machinery twice. null (not searching) falls back to the normal
  // drawer tree below.
  const searchMatches = useMemo(() => {
    if (!searchQuery) return null;
    return allRows
      .filter((a) => {
        const group = groupById.get(a.groupId);
        const parent = a.parentAccountId ? accountByCode.get(a.parentAccountId) : null;
        const haystack = [
          a.accountCode, a.accountName, a.remarks, a.currency,
          a.accountNature === 'T' ? 'Title' : 'Active Account',
          BALANCE_TYPE_LABEL[a.balanceType],
          a.status === 'A' ? 'Active' : 'Inactive',
          group?.groupCode, group?.groupName,
          parent?.accountCode, parent?.accountName,
          a.isControlAccount ? 'control account' : '',
          a.isBankAccount ? 'bank' : '',
          a.openingBalance,
        ].filter((v) => v != null && v !== '').join(' ').toLowerCase();
        return haystack.includes(searchQuery);
      })
      .sort((a, b) => String(a.accountCode || '').localeCompare(String(b.accountCode || ''), undefined, { numeric: true }))
      .map((a) => ({
        ...a,
        kind: 'account',
        depth: 0,
        hasChildren: false,
        collapsed: false,
        collapseKey: `search:${a.id}`,
        parentOutsideView: false,
      }));
  }, [searchQuery, allRows, groupById, accountByCode]);

  const displayedRows = searchMatches ?? accountTreeRows;

  // Account details / add-edit panel.
  const [panelMode, setPanelMode] = useState('empty'); // 'empty' | 'view' | 'create' | 'edit'
  const [selectedId, setSelectedId] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const selectedRow = selectedId ? accountById.get(selectedId) : null;

  const openCreate = () => {
    setSelectedId(null);
    setFormKey((k) => k + 1);
    setPanelMode('create');
  };
  const openView = (row) => {
    setSelectedId(row.id);
    setPanelMode('view');
  };
  const openEdit = (row) => {
    setSelectedId(row.id);
    setFormKey((k) => k + 1);
    setPanelMode('edit');
  };
  const closePanel = () => {
    setSelectedId(null);
    setPanelMode('empty');
  };

  // parentAccountId stores the parent's AccountCode, so an account's own
  // accountCode (not its id) is what shows up in a child's parentAccountId.
  const hasChildren = (id) => {
    const acc = accountById.get(id);
    return acc ? allRows.some((a) => a.parentAccountId === acc.accountCode) : false;
  };

  // Saves the server-generated template — same "Yes"/"No"/code-column shape
  // the upload below expects — as a real file download via a throwaway
  // object URL, since the browser has no other route from a Blob to disk.
  const handleDownloadTemplate = async () => {
    try {
      const blob = await downloadTemplate().unwrap();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chart-of-accounts-template.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      notify.error(err?.data?.message || 'Could not download the template. Try again.');
    }
  };

  const handleImportClick = () => importFileInputRef.current?.click();

  // The server does all the real validation (header wording, account group/
  // parent lookups, the same hierarchy rules a single Add Account save goes
  // through) — this just gets the file there and surfaces the resulting
  // summary, same pattern as Opening Balance's Import from Excel.
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file after a failed attempt
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const result = await importXlsx(formData).unwrap();
      if (result.skipped > 0) {
        notify.warning(result.message, { duration: 8000 });
        // eslint-disable-next-line no-console
        console.warn('Chart of Accounts import — skipped rows:', result.errors);
      } else {
        notify.success(result.message);
      }
    } catch (err) {
      notify.error(err?.data?.message || 'Import failed. Check the file and try again.');
    }
  };

  const handleDelete = async (row) => {
    if (hasChildren(row.id)) {
      notify.error('This account has sub-accounts under it — move or delete those first.');
      return;
    }
    const ok = await confirmDialog({
      title: 'Delete account',
      message: `Are you sure you want to delete "${row.accountName}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Account deleted');
      if (selectedId === row.id) closePanel();
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  // Account Group now offers the WHOLE group tree, not just the level-1
  // drawers: 1 Assets > 1.1 Current Assets > 1.1.1 Cash. That's how the groups
  // are actually modelled (AccountGroup carries parentGroupId and GroupLevel)
  // and how SAP files accounts — into the specific posting group, with the
  // drawer as the roll-up above it. Restricting the dropdown to roots meant
  // the sub-groups existed in the data and were unreachable from this screen.
  //
  // Rendered depth-first with an indent prefix and the group's level, so the
  // hierarchy is legible in a flat Autocomplete list.
  const groupLevelById = useMemo(() => buildGroupLevelMap(allGroups), [allGroups]);
  const groupTreeRows = useMemo(() => {
    const sorted = [...allGroups].sort((a, b) =>
      String(a.groupCode || '').localeCompare(String(b.groupCode || ''), undefined, { numeric: true })
    );
    return buildTreeRows(sorted, { idField: 'id', parentField: 'parentGroupId' });
  }, [allGroups]);
  const groupOptions = useMemo(
    () => groupTreeRows.map((g) => ({
      label: `${' '.repeat(g.depth)}${g.depth ? '└ ' : ''}${g.groupCode} ${g.groupName}  (L${groupLevelById.get(g.id) ?? 1})`,
      value: g.id,
    })),
    [groupTreeRows, groupLevelById]
  );
  // Accounts that are structurally eligible to be a parent, before the
  // group filter (which depends on the form's own Account Group field and so
  // is applied inside AccountFormFields):
  //
  //   - not the account being edited, nor any of its descendants (a cycle);
  //   - a Title account — only Titles take sub-accounts in SAP;
  //   - not already at MAX_ACCOUNT_LEVEL, since a child of it would be one
  //     level deeper than the chart allows.
  const parentCandidates = useMemo(() => {
    const excludeIds = selectedRow && panelMode === 'edit'
      ? new Set([selectedRow.id, ...getDescendantIds(allRows, selectedRow.accountCode, 'parentAccountId', 'accountCode')])
      : new Set();
    return allRows.filter((a) => (
      !excludeIds.has(a.id) && canParentChildren(a, levelById.get(a.id))
    ));
  }, [allRows, selectedRow, panelMode, levelById]);

  const handleSubmit = async (values, formMethods) => {
    // Business rule: a Control Account never allows direct manual entry
    // (postings only reach it through its sub-accounts), and neither does any
    // account that already has children — both are enforced here regardless
    // of what the (disabled) checkbox shows, so a stale value can't slip
    // through.
    //
    // AccountLevel follows SAP's drawer-relative depth: the drawer is level 1,
    // so an account with no parent is level 2 and each nesting adds one. The
    // parent's own level is derived rather than read off its row (see
    // lib/accountHierarchy) so a stale stored level can't propagate.
    const parent = values.parentAccountId ? accountByCode.get(values.parentAccountId) : null;
    const accountLevel = childLevelOf(parent, levelById.get(parent?.id));
    if (accountLevel > MAX_ACCOUNT_LEVEL) {
      notify.error(`The chart is limited to ${MAX_ACCOUNT_LEVEL} levels — this account would be level ${accountLevel}.`);
      return;
    }
    // The parent has to live in the same DRAWER — the level-1 group at the top
    // of the tree. Not the same exact group: an account filed into
    // 1.1.1 Cash may legitimately sit under a Title in 1.1 Current Assets,
    // because both roll up into Assets. What's forbidden is crossing drawers,
    // which is what "a Liability under an Asset" means.
    if (parent && values.groupId != null && !sameDrawer(parent.groupId, values.groupId, groupById)) {
      notify.error('The parent account belongs to a different drawer. Pick a parent inside the same drawer.');
      return;
    }
    const editingId = panelMode === 'edit' ? selectedId : null;
    // A Title that already carries sub-accounts cannot be demoted to an Active
    // (posting) account: its children's balances roll up into it, and a
    // posting account is a leaf by definition. Move the children out first.
    if (editingId != null && values.accountNature === 'A' && hasChildren(editingId)) {
      notify.error('This account has sub-accounts, so it must stay a Title. Move its sub-accounts elsewhere first.');
      return;
    }
    const forceNoManualEntry = values.isControlAccount || (editingId != null && hasChildren(editingId));
    const payload = { ...values, accountLevel, allowManualEntry: forceNoManualEntry ? false : values.allowManualEntry };
    try {
      if (editingId) {
        await update({ id: editingId, ...payload }).unwrap();
        notify.success('Account updated');
        setPanelMode('view');
      } else {
        const created = await create(payload).unwrap();
        notify.success('Account added');
        setSelectedId(created?.id ?? null);
        setPanelMode(created?.id ? 'view' : 'empty');
      }
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  // Picking a drawer selects that group — a new account then defaults into it,
  // so the cabinet acts as "which group am I adding to".
  const handleDrawerClick = (rootId) => {
    if (rootId == null) {
      setSelectedGroupId(null);
      return;
    }
    // Clicking the already-selected drawer shuts it again, back to All Accounts.
    setSelectedGroupId(selectedGroupId === rootId ? null : rootId);
  };

  return (
    <Box ref={pageRootRef}>
      {/* compact: this page needs the vertical space for the drawer cabinet
          directly below. Only this page opts in — every other page's header
          is unchanged. */}
      <EntityHeaderCard
        compact
        icon={<MenuBookOutlinedIcon />}
        title="Chart Of Accounts"
        subtitle="Create and manage the ledger account hierarchy used across the books."
        rightContent={<CompanyBadge compact />}
      />

      {/* Account Groups — a horizontal cabinet of drawer faces, sitting
          directly under the page header and sharing its row with New Account.
          One drawer open at a time; its contents slide out underneath. */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between"
            spacing={1.5} sx={{ mb: 1.5 }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <AccountTreeOutlinedIcon fontSize="small" color="action" />
              <Typography variant="subtitle2" fontWeight={700}>Account Groups</Typography>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap" useFlexGap alignItems={{ xs: 'stretch', sm: 'center' }}>
              {/* Searches every account's own fields (code, name, remarks,
                  currency, ...) plus its group and parent — not gated behind
                  CanAdd, since looking something up isn't an add action. */}
              <TextField
                size="small"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search accounts..."
                sx={{ width: { xs: '100%', sm: 220 } }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
                  ),
                  endAdornment: search ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearch('')} aria-label="clear search">
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
              />
              <CanAdd>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
                  <input
                    ref={importFileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    hidden
                    onChange={handleImportFile}
                  />
                  <Button
                    variant="outlined"
                    color="inherit"
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={handleDownloadTemplate}
                    disabled={downloadingTemplate}
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                  >
                    Download Template
                  </Button>
                <Button
                  variant="outlined"
                  color="inherit"
                  size="small"
                  startIcon={<UploadFileIcon />}
                  onClick={handleImportClick}
                  disabled={importing}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  {importing ? 'Importing...' : 'Import from Excel'}
                </Button>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                  New Account
                </Button>
              </Stack>
            </CanAdd>
            </Stack>
          </Stack>

          {/* Drawer faces. Horizontally scrollable rather than wrapping, so the
              cabinet stays one clean row however many roots exist. */}
          <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
            <DrawerFace
              label="All Accounts"
              open={selectedGroupId == null}
              onClick={() => handleDrawerClick(null)}
            />
            {rootGroups.map((g) => (
              <DrawerFace
                key={g.id}
                // Code and name are passed separately, not pre-joined into one
                // string, so the drawer number can be typeset differently from
                // the name beside it — see DrawerFace.
                code={g.groupCode}
                label={g.groupName}
                open={selectedGroupId === g.id}
                onClick={() => handleDrawerClick(g.id)}
              />
            ))}
            {rootGroups.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                No account groups yet — add one from Accounting &gt; Account Group first.
              </Typography>
            )}
          </Stack>

        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: { xs: 'wrap', lg: 'nowrap' } }}>
        {/* Account Details / Add / Edit — left-aligned now that the account
            list card next to it is gone, so it isn't stranded on the far right. */}
        <Card variant="outlined" sx={{ width: { xs: '100%', lg: account_card_width }, flexShrink: 0 }}>
          <CardContent sx={{ p: 3 }}>
            {panelMode === 'empty' && (
              <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ py: 6 }}>
                <MenuBookOutlinedIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
                <Typography variant="body2" color="text.secondary" align="center">
                  Click "New Account" to add an account.
                </Typography>
              </Stack>
            )}

            {panelMode === 'view' && selectedRow && (
              <Box>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={700}>Account Details</Typography>
                  <Stack direction="row" spacing={0.5}>
                    <CanEdit>
                      <IconButton size="small" color="primary" onClick={() => openEdit(selectedRow)} aria-label="edit"><EditIcon fontSize="small" /></IconButton>
                    </CanEdit>
                    <CanDelete>
                      <IconButton size="small" color="error" onClick={() => handleDelete(selectedRow)} aria-label="delete"><DeleteIcon fontSize="small" /></IconButton>
                    </CanDelete>
                    <IconButton size="small" onClick={closePanel} aria-label="close"><CloseIcon fontSize="small" /></IconButton>
                  </Stack>
                </Stack>
                <Stack spacing={1.25}>
                  <DetailRow label="Account Code" value={selectedRow.accountCode} />
                  <DetailRow label="Account Name" value={selectedRow.accountName} />
                  <DetailRow label="Account Group" value={groupById.get(selectedRow.groupId)?.groupName || '—'} />
                  <DetailRow label="Parent Account" value={selectedRow.parentAccountId ? (accountByCode.get(selectedRow.parentAccountId)?.accountName || '—') : '— (top-level)'} />
                  <DetailRow label="Account Nature" value={selectedRow.accountNature === 'T' ? 'Title' : 'Active Account'} />
                  {/* Derived, not the stored column — see lib/accountHierarchy. */}
                  <DetailRow
                    label="Account Level"
                    value={`${levelById.get(selectedRow.id) ?? FIRST_ACCOUNT_LEVEL} of ${MAX_ACCOUNT_LEVEL}`}
                  />
                  <DetailRow label="Sub-Accounts" value={childCountById.get(selectedRow.id) || 0} />
                  <DetailRow label="Currency" value={selectedRow.currency} />
                  <DetailRow label="Balance" value={formatBalance(selectedRow.accountCode)} />
                  <DetailRow label="Balance Type" value={BALANCE_TYPE_LABEL[selectedRow.balanceType] || '—'} />
                  <DetailRow label="Control Account" value={selectedRow.isControlAccount ? 'Yes' : 'No'} />
                  <DetailRow label="Bank" value={selectedRow.isBankAccount ? 'Yes' : 'No'} />
                  <DetailRow label="Allow Manual Entry" value={selectedRow.allowManualEntry ? 'Yes' : 'No'} />
                  <DetailRow label="Cost Center Required" value={selectedRow.costCenterRequired ? 'Yes' : 'No'} />
                  <DetailRow label="Status" value={selectedRow.status === 'A' ? 'Active' : 'Inactive'} />
                  <DetailRow label="Remarks" value={selectedRow.remarks || '—'} />
                </Stack>
              </Box>
            )}

            {(panelMode === 'create' || panelMode === 'edit') && (
              <Box>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                  {panelMode === 'edit' ? 'Edit Account' : 'Add Account'}
                </Typography>
                <AppForm
                  key={formKey}
                  schema={chartOfAccountSchema}
                  // On create, Account Group pre-fills from whichever drawer is
                  // selected — the cabinet is the only thing that group choice
                  // drives now, and it stays editable in the form.
                  // accountLevel is overridden with the DERIVED level rather
                  // than the stored column, so editing a row saved by an older
                  // build starts from where the account actually sits.
                  defaultValues={panelMode === 'edit' && selectedRow
                    ? {
                      ...emptyValues,
                      ...selectedRow,
                      accountLevel: levelById.get(selectedRow.id) ?? FIRST_ACCOUNT_LEVEL,
                    }
                    : { ...emptyValues, groupId: selectedGroupId ?? null }}
                  onSubmit={handleSubmit}
                >
                  <AccountFormFields
                    isEdit={panelMode === 'edit'}
                    editingHasChildren={panelMode === 'edit' && !!selectedRow && hasChildren(selectedRow.id)}
                    groupOptions={groupOptions}
                    parentCandidates={parentCandidates}
                    levelById={levelById}
                    groupById={groupById}
                    groupLevelById={groupLevelById}
                    saving={creating || updating}
                    selectedGroupId={selectedGroupId}
                    currencyOptions={currencyOptions}
                    onCancel={() => (panelMode === 'edit' && selectedRow ? setPanelMode('view') : closePanel())}
                  />
                </AppForm>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Accounts under the selected drawer, as SAP's G/L account tree:
            indented parent-then-children, Title accounts drawn as folders and
            Active accounts as documents. Clicking a row shows it in the panel
            on the left. */}
        <Card variant="outlined" sx={{ flex: 1, minWidth: 0 }}>
          <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, pt: 2, pb: 1 }}>
              <AccountTreeOutlinedIcon fontSize="small" color="action" />
              <Typography variant="subtitle2" fontWeight={700}>
                {searchMatches
                  ? 'Search Results'
                  : selectedGroupId == null
                    ? 'All Accounts'
                    : `${groupById.get(selectedGroupId)?.groupCode || ''} ${groupById.get(selectedGroupId)?.groupName || ''}`}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ({searchMatches ? searchMatches.length : accountRowCount})
              </Typography>
            </Stack>
            <Divider />

            <List dense sx={{ maxHeight: 560, overflowY: 'auto', py: 0.5 }}>
              {displayedRows.map((row) => {
                // The level-1 drawer node in All Accounts. Clicking it folds
                // its subtree open or shut, the way a tree node should behave
                // — it used to jump to that drawer's filtered view instead,
                // which is what the row of drawer faces above the card is for.
                // Two different things happening on one click is one too many.
                if (row.kind === 'group') {
                  return (
                    <ListItemButton
                      key={row.id}
                      // A drawer has no detail panel of its own, so the whole
                      // row is the toggle. (Account rows differ — see below.)
                      onClick={() => row.hasChildren && toggleNode(row.collapseKey)}
                      // A drawer with nothing in it has nothing to unfold, so
                      // it stays inert rather than offering a control that
                      // would visibly do nothing.
                      disableRipple={!row.hasChildren}
                      sx={{ py: `${tree_row_padding_y}px`, cursor: row.hasChildren ? 'pointer' : 'default' }}
                    >
                      <TreeGuides row={row} />
                      <NodeToggle row={row} />
                      <AccountTreeOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                      <ListItemText
                        primary={`${row.groupCode} ${row.groupName}`}
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 700, noWrap: true }}
                      />
                      {/* The count is what makes a folded drawer legible —
                          otherwise a folded branch and an empty one look the
                          same. */}
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        {!row.hasChildren
                          ? 'empty'
                          : `${row.descendantCount} account${row.descendantCount === 1 ? '' : 's'}`}
                      </Typography>
                      <Chip size="small" variant="outlined" label={`L${DRAWER_LEVEL}`} sx={{ ml: 1 }} />
                    </ListItemButton>
                  );
                }

                const isTitle = row.accountNature === 'T';
                const level = levelById.get(row.id) ?? FIRST_ACCOUNT_LEVEL;
                // Predates the Title-only-parents rule: a posting account that
                // still has children. Left alone rather than auto-migrated —
                // changing an account's nature changes what it means in the
                // ledger, so it's surfaced for a deliberate fix.
                const legacyParent = isLegacyActiveParent(row, childCountById.get(row.id));
                // Its parent is real but lives outside this drawer's view, so
                // the row is drawn at depth 0 and would otherwise pass for a
                // top-level account. Say where it actually hangs.
                const hiddenParent = row.parentOutsideView
                  ? accountByCode.get(row.parentAccountId)
                  : null;
                // Worse than merely off-screen: the parent is in a different
                // drawer entirely, which this build no longer permits. Legacy
                // rows from before the drawer rule was enforced.
                const crossDrawer = Boolean(
                  hiddenParent && !sameDrawer(hiddenParent.groupId, row.groupId, groupById)
                );
                return (
                  <ListItemButton
                    key={row.id}
                    selected={selectedId === row.id}
                    onClick={() => openView(row)}
                    // Depth is drawn by TreeGuides' rails rather than by left
                    // padding, so the connector lines occupy the same space
                    // the indent used to.
                    sx={{ py: `${tree_row_padding_y}px` }}
                  >
                    <TreeGuides row={row} />
                    {/* A Title with sub-accounts folds too. Unlike a drawer,
                        an account row already means something when clicked —
                        it opens the detail panel — so the chevron takes the
                        click for itself rather than the row doing two jobs. */}
                    <NodeToggle
                      row={row}
                      onToggle={(e) => { e.stopPropagation(); toggleNode(row.collapseKey); }}
                    />
                    {/* The folder takes the label's blue so the icon and name
                        read as one thing. Drop the sx back to
                        'text.secondary' if the icon should stay neutral. */}
                    {isTitle
                      ? <FolderOutlinedIcon fontSize="small" sx={{ mr: 1, color: titleAccountColor }} />
                      : <DescriptionOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} />}
                    <ListItemText
                      primary={`${row.accountCode} — ${row.accountName}`}
                      // The indentation can't show a parent that isn't in this
                      // view, so the secondary line does instead — otherwise
                      // the row reads as top-level when it isn't.
                      secondary={hiddenParent
                        ? `under ${hiddenParent.accountCode} — ${hiddenParent.accountName}${crossDrawer ? ' (different drawer)' : ' (other group)'}`
                        : null}
                      primaryTypographyProps={{
                        variant: 'body2',
                        // Title accounts are headings, so they read heavier
                        // AND in blue — the two cues together survive a deep
                        // tree where a lot of rows are bold.
                        fontWeight: isTitle ? 700 : 400,
                        noWrap: true,
                        sx: isTitle ? { color: titleAccountColor } : undefined,
                      }}
                      secondaryTypographyProps={{
                        variant: 'caption',
                        color: crossDrawer ? 'warning.main' : 'text.disabled',
                        noWrap: true,
                      }}
                    />
                    {/* Says what folding this Title took off screen. Without
                        it a folded Title is indistinguishable from a leaf —
                        the chevron is small and easy to miss once the row is
                        scrolled away from where it was clicked. */}
                    {row.collapsed && (
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1, whiteSpace: 'nowrap' }}>
                        {row.descendantCount} hidden
                      </Typography>
                    )}
                    {crossDrawer && (
                      <Tooltip title="This account's parent is in a different drawer, which isn't allowed — a Liability can't roll up into an Asset. Edit it and pick a parent inside its own drawer.">
                        <WarningAmberOutlinedIcon fontSize="small" color="warning" sx={{ ml: 1 }} />
                      </Tooltip>
                    )}
                    {legacyParent && (
                      <Tooltip title="This is a posting (Active) account with sub-accounts under it, which SAP's model doesn't allow — change it to a Title, or move its sub-accounts elsewhere.">
                        <WarningAmberOutlinedIcon fontSize="small" color="warning" sx={{ ml: 1 }} />
                      </Tooltip>
                    )}
                    {row.status === 'I' && (
                      <Chip size="small" label="Inactive" variant="outlined" sx={{ ml: 1 }} />
                    )}
                    {/* Depth in the chart — SAP shows this as a column; here
                        it's a chip so the 5-level ceiling is always visible. */}
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`L${level}`}
                      sx={{ ml: 1 }}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={BALANCE_TYPE_SHORT[row.balanceType] || 'Dr'}
                      color={row.balanceType === 'C' ? 'secondary' : 'primary'}
                      sx={{ ml: 1 }}
                    />
                  </ListItemButton>
                );
              })}

              {(accountsError || groupsError) && (
                <Alert
                  severity="error"
                  sx={{ m: 2 }}
                  action={(
                    <Button color="inherit" size="small" onClick={() => { refetchAccounts(); refetchGroups(); }}>
                      Retry
                    </Button>
                  )}
                >
                  {accountsError?.data?.message || groupsError?.data?.message
                    || 'Could not load the chart of accounts — the account list and this list may be out of sync until this succeeds.'}
                </Alert>
              )}

              {!isLoading && !accountsError && !groupsError && displayedRows.length === 0 && (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                  {searchMatches
                    ? 'No accounts match your search.'
                    : selectedGroupId == null
                      ? 'No accounts yet — click "New Account" to add one.'
                      : 'No accounts in this group yet.'}
                </Typography>
              )}
            </List>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

// The account form's fields live in their own component rather than in an
// inline render-prop callback: that callback runs as part of AppForm's own
// render, so any hook called inside it would be counted against AppForm and
// would change AppForm's hook count whenever the panel switches between
// view/create/edit — which React treats as a fatal error. As a real
// component it reads the form via useFormContext (AppForm renders a
// FormProvider around its children) and owns its own hooks legally.
function AccountFormFields({
  isEdit, editingHasChildren, groupOptions, parentCandidates, levelById, groupById,
  groupLevelById, saving, onCancel, selectedGroupId, currencyOptions,
}) {
  const { watch, setValue, getValues } = useFormContext();
  const isControlAccount = watch('isControlAccount');

  // Title = a heading that groups the accounts beneath it and is never posted
  // to. Active Account = a posting account, always a leaf.
  const accountNature = watch('accountNature');
  const isTitle = accountNature === 'T';

  // THE DRAWER FILTER. The parent list is scoped to the drawer this account is
  // being filed into — you cannot park a Liability under an Asset, and
  // offering every account regardless of drawer was what let that happen.
  //
  // It watches the Account Group FIELD rather than the drawer face up top, so
  // changing the group by hand re-scopes the list too. And it compares
  // DRAWERS, not exact groups: an account in 1.1.1 Cash may sit under a Title
  // in 1.1 Current Assets, since both roll up into Assets.
  const formGroupId = watch('groupId');
  const drawerParents = useMemo(() => (
    formGroupId == null
      ? []
      : parentCandidates.filter((a) => sameDrawer(a.groupId, formGroupId, groupById))
  ), [parentCandidates, formGroupId, groupById]);

  // THE LEVEL FIELD. SAP lays the chart out as five level columns and you
  // place an account by saying which column it goes in; the parent follows
  // from that. Same here — Level narrows Parent to the Titles one level above,
  // instead of the user having to infer the depth from whichever parent they
  // happened to pick.
  const accountLevel = watch('accountLevel') ?? FIRST_ACCOUNT_LEVEL;

  // An Active account must sit under a Title, so it can never occupy the
  // drawer's own first account level. A Title can.
  const minLevel = isTitle ? FIRST_ACCOUNT_LEVEL : FIRST_ACCOUNT_LEVEL + 1;
  const parentCountByLevel = useMemo(
    () => countByLevel(drawerParents, levelById),
    [drawerParents, levelById]
  );
  const levelOptions = useMemo(
    () => accountLevelOptions({ min: minLevel, parentsByLevel: parentCountByLevel }),
    [minLevel, parentCountByLevel]
  );

  // Parents legal for the chosen level: Titles exactly one level above it.
  const availableParents = useMemo(() => (
    accountLevel <= FIRST_ACCOUNT_LEVEL
      ? []
      : drawerParents.filter((a) => (levelById.get(a.id) ?? FIRST_ACCOUNT_LEVEL) === accountLevel - 1)
  ), [drawerParents, levelById, accountLevel]);

  const availableParentOptions = useMemo(() => availableParents.map((a) => ({
    label: `${a.accountCode} — ${a.accountName}  (L${levelById.get(a.id) ?? FIRST_ACCOUNT_LEVEL})`,
    // The stored value is the parent's AccountCode, not its id — that's what
    // ParentAccountID actually holds (see model ChartOfAccount in
    // schema.prisma).
    value: a.accountCode,
  })), [availableParents, levelById]);

  const parentAccountId = watch('parentAccountId');
  // parentAccountId is the parent's accountCode now, not its id.
  const chosenParent = availableParents.find((a) => a.accountCode === parentAccountId) || null;

  const drawerId = formGroupId != null ? rootGroupIdOf(formGroupId, groupById) : null;
  const drawerName = drawerId != null
    ? `${groupById.get(drawerId)?.groupCode || ''} ${groupById.get(drawerId)?.groupName || ''}`.trim()
    : null;

  // Level and Parent are two views of the same fact, so each corrects the
  // other: choosing a parent snaps Level to parent + 1, and choosing a Level
  // that the current parent doesn't satisfy clears the parent.
  useEffect(() => {
    if (parentAccountId == null) return;
    // levelById is id-keyed; parentAccountId (a code) is resolved to the
    // parent row first via chosenParent.
    const parentLevel = levelById.get(chosenParent?.id);
    if (parentLevel != null && parentLevel + 1 !== accountLevel) {
      setValue('accountLevel', parentLevel + 1, { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentAccountId]);

  // Level 2 means "directly in the drawer", which is by definition parentless.
  useEffect(() => {
    if (accountLevel <= FIRST_ACCOUNT_LEVEL && getValues('parentAccountId') != null) {
      setValue('parentAccountId', null, { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountLevel]);

  // Switching to Active raises the floor to level 3 (it needs a Title above
  // it), so a Title sitting at level 2 has to move down when it's converted.
  useEffect(() => {
    if (accountLevel < minLevel) {
      setValue('accountLevel', minLevel, { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minLevel]);

  // A parent that's no longer on offer — because the group changed, or because
  // it's a legacy Active-account parent this build won't accept — is dropped
  // rather than submitted as a value the dropdown doesn't even list. That's
  // silent on its own, so `droppedParent` records it and the form says so.
  const [droppedParent, setDroppedParent] = useState(null);
  useEffect(() => {
    const current = getValues('parentAccountId');
    if (current != null && !availableParentOptions.some((o) => o.value === current)) {
      setDroppedParent(current);
      setValue('parentAccountId', null, { shouldValidate: true });
    } else if (current != null) {
      setDroppedParent(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formGroupId, accountNature, accountLevel]);

  useEffect(() => {
    // The posting-behaviour fields are hidden for a Title, so whatever was set
    // before the switch is reset — otherwise values the user can no longer see
    // would still be saved. balanceType goes back to its 'D' default rather
    // than null because the column is NOT NULL and the field is required.
    if (accountNature === 'T') {
      setValue('openingBalance', '', { shouldValidate: true });
      setValue('balanceType', 'D', { shouldValidate: true });
      setValue('isControlAccount', false);
      setValue('isBankAccount', false);
      setValue('allowManualEntry', false);
      setValue('costCenterRequired', false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountNature]);

  // Keep Account Group in step with the drawer cabinet while the form is open:
  // switching from 1 Assets to 5 Expenditure up top re-points the field
  // immediately, rather than only applying to the next form that's opened.
  //
  // This fires only when selectedGroupId actually changes, so a group the user
  // picked by hand in the dropdown survives — it's overridden on the next
  // drawer click, not on every keystroke elsewhere in the form. Skipped while
  // editing: an existing account's group shouldn't be rewritten just because
  // someone browsed a different drawer.
  useEffect(() => {
    if (isEdit || selectedGroupId == null) return;
    setValue('groupId', selectedGroupId, { shouldValidate: true, shouldDirty: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId]);


  const manualEntryDisabled = Boolean(isControlAccount || editingHasChildren);

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: account_field_gap }}>
        {/* G/L Account Details — Title vs Active Account, above Account Code
            exactly as it sits in the SAP G/L account screen. */}
        <Box>
          <Typography
            variant="subtitle2"
            fontWeight={700}
            sx={{ textDecoration: 'underline', mb: 0.25 }}
          >
            G/L Account Details
          </Typography>
          <FormRadioGroup
            name="accountNature"
            // A Title carrying sub-accounts can't be demoted to a posting
            // account — greyed out here so the rule is visible before Save
            // rather than only as an error afterwards.
            options={GL_ACCOUNT_NATURE_OPTIONS.map((o) => (
              o.value === 'A' && editingHasChildren
                ? { ...o, disabled: true }
                : o
            ))}
          />
          {editingHasChildren && (
            <Typography variant="caption" color="text.secondary">
              Has sub-accounts, so it must remain a Title.
            </Typography>
          )}
        </Box>
        {/* Always a plain manual field — Chart of Accounts does not use the
            numbering-series auto-generate flow other document types do
            (see resources.js: the chart-of-accounts crudRouter mount has no
            `autoNumber`). The person filling in the form types the real code
            directly, on both create and edit. */}
        <FormTextField name="accountCode" label="Account Code *" placeholder="e.g. 1000, AST-001" />
        <FormTextField name="accountName" label="Account Name *" placeholder="Enter account name" />
        <FormSelect name="groupId" label="Account Group *" placeholder="Select account group" options={groupOptions} />
        {/* Level, then Parent — the same order SAP asks for them in. Choosing
            the level first is what makes the parent list short and obviously
            correct, instead of a flat list of every account in the company. */}
        <FormSelect
          name="accountLevel"
          label="Level *"
          placeholder="Select the level this account sits on"
          options={levelOptions}
          disabled={formGroupId == null}
          getOptionDisabled={(o) => Boolean(o.disabled)}
        />
        <FormSelect
          name="parentAccountId"
          label={accountLevel <= FIRST_ACCOUNT_LEVEL ? 'Parent Title' : 'Parent Title *'}
          placeholder={
            formGroupId == null
              ? 'Pick an account group first'
              : accountLevel <= FIRST_ACCOUNT_LEVEL
                ? 'None — sits directly in the drawer'
                : `Select the level ${accountLevel - 1} Title this account sits under`
          }
          options={availableParentOptions}
          disabled={formGroupId == null || accountLevel <= FIRST_ACCOUNT_LEVEL}
        />

        {/* The parent was cleared out from under the user — say so, rather
            than letting a saved account quietly change where it sits. */}
        {droppedParent != null && (
          <Alert severity="warning" sx={{ py: 0.5 }}>
            <Typography variant="caption">
              The previous parent no longer fits — a parent must be a Title account in
              the {drawerName || 'same'} drawer, sitting exactly one level above this
              one. Pick a new one, or change the Level.
            </Typography>
          </Alert>
        )}

        {/* Why the list can be empty, spelled out. An Active Account is
            required to have a parent here, so an empty list is a dead end
            unless the user knows a Title has to exist first. */}
        {formGroupId != null && accountLevel > FIRST_ACCOUNT_LEVEL && availableParentOptions.length === 0 && (
          <Alert severity="warning" sx={{ py: 0.5 }}>
            <Typography variant="caption">
              The {drawerName} drawer has no Title account at level {accountLevel - 1} to file
              this under. Add a Title there first, then create accounts beneath it
              {isTitle ? ', or drop this one to a shallower level.' : '.'}
            </Typography>
          </Alert>
        )}

        <FormSelect name="currency" label="Currency *" options={currencyOptions} />
        {/* Everything from Balance down to Cost Center Required describes how a
            POSTING account behaves. A Title is only a heading in the tree — it
            carries no balance, is never posted to and has no cost-centre rule
            — so the whole block is hidden for it rather than shown as fields
            that would have no effect. Their stored values are reset when the
            radio flips (see the accountNature effect above), so nothing the
            user can no longer see gets saved. */}
        {!isTitle && (
          <>
            <FormTextField name="openingBalance" label="Balance" placeholder="0.00" />
            <FormSelect name="balanceType" label="Balance Type *" options={BALANCE_TYPE_WITH_ALL_OPTIONS} />
          </>
        )}
        <FormSelect name="status" label="Status *" options={STATUS_AI_OPTIONS} />
        {!isTitle && (
          <>
            <FormCheckbox name="isControlAccount" label="Control Account" />
            <FormCheckbox name="isBankAccount" label="Bank" />
            <Tooltip title={manualEntryDisabled ? 'Disabled for control accounts and accounts with sub-accounts — postings must go to a sub-account instead.' : ''}>
              <Box>
                <FormCheckbox name="allowManualEntry" label="Allow Manual Entry" disabled={manualEntryDisabled} />
              </Box>
            </Tooltip>
            <FormCheckbox name="costCenterRequired" label="Cost Center Required" />
          </>
        )}
        <FormTextField name="remarks" label="Remarks" placeholder="Enter remarks (optional)" />
      </Box>

      <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 3 }}>
        <Button variant="outlined" color="inherit" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <FormSubmitButton disabled={saving}>
          {isEdit ? 'Update' : 'Save'}
        </FormSubmitButton>
      </Stack>
    </>
  );
}

// The fold chevron, and — just as importantly — the fixed-width column it
// lives in. Every row renders one whether or not it has children, because a
// column that appears only on foldable rows would shift each row's icon and
// label sideways depending on whether it happened to have sub-accounts. The
// tree has to hold one straight left edge per level.
//
// Sits AFTER the guide rails so the chevron lands at the node's own indent,
// next to what it folds, rather than out at the far left of the row.
//
// `onToggle` is supplied only where the row itself does something else on
// click (an account opens its detail panel); a drawer row has no such
// conflict and lets the whole row toggle instead.
function NodeToggle({ row, onToggle }) {
  return (
    <Box
      onClick={row.hasChildren && onToggle ? onToggle : undefined}
      sx={{
        width: tree_toggle_width,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        color: 'text.secondary',
        cursor: row.hasChildren && onToggle ? 'pointer' : 'inherit',
        '&:hover': row.hasChildren && onToggle ? { color: 'primary.main' } : undefined,
      }}
    >
      {row.hasChildren && (row.collapsed
        ? <ChevronRightIcon fontSize="small" />
        : <ExpandMoreIcon fontSize="small" />)}
    </Box>
  );
}

// The connector lines down the left of the account tree — one vertical rail
// per level of depth, with an elbow into the row itself.
//
// Indentation alone shows how deep a row is but not what it belongs to: once a
// parent scrolls out of view, two rows at the same indent are indistinguishable
// whether they're siblings or in completely different branches. The trunk lines
// answer that, which is why a file explorer has always drawn them.
//
// Geometry, per rail:
//   - every rail whose ancestor still has a sibling below draws a full-height
//     vertical line, so the branch stays connected past this row;
//   - the LAST rail is the row's own elbow: vertical from the top down to the
//     middle, then a horizontal stub across to the icon. If the row is the last
//     child, the vertical stops at the middle (a closing corner); if not, it
//     carries on to the bottom to reach the next sibling.
//
// `attachTreeGuides` (lib/tree.js) supplies isLastChild and ancestorLines; this
// component only draws what it's told.
//
// The negative vertical margin is load-bearing: the row's own padding sits
// outside its content box, so without pulling the rails back over it the lines
// would break at every row boundary instead of running continuously.
function TreeGuides({ row }) {
  const depth = row.depth || 0;
  if (!depth) return null;
  const ancestorLines = row.ancestorLines || [];

  return (
    <Box
      sx={{
        display: 'flex',
        alignSelf: 'stretch',
        flexShrink: 0,
        my: `-${tree_row_padding_y}px`,
        mr: 0.5,
      }}
    >
      {Array.from({ length: depth }, (_, i) => {
        const isElbow = i === depth - 1;
        const showTrunk = isElbow || ancestorLines[i];
        return (
          <Box key={i} sx={{ position: 'relative', width: tree_guide_width, alignSelf: 'stretch' }}>
            {showTrunk && (
              <Box
                sx={{
                  position: 'absolute',
                  left: '50%',
                  top: 0,
                  height: isElbow && row.isLastChild ? '50%' : '100%',
                  borderLeft: tree_guide_stroke,
                  borderColor: 'divider',
                }}
              />
            )}
            {isElbow && (
              <Box
                sx={{
                  position: 'absolute',
                  left: '50%',
                  right: 0,
                  top: '50%',
                  borderTop: tree_guide_stroke,
                  borderColor: 'divider',
                }}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
}

// One drawer face in the Account Groups cabinet — modelled on the SAP filing
// cabinet: a brushed-metal panel with a pull handle above the label. Closed
// drawers sit slightly proud (drop shadow); the open one is pushed in (inset
// shadow) and tinted with the theme's primary colour so it's obvious which
// drawer the list below belongs to.
function DrawerFace({ code, label, open, selected, onClick }) {
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      aria-pressed={open}
      sx={{
        minWidth: 132,
        flexShrink: 0,
        px: 1.5,
        py: 1.25,
        borderRadius: 1,
        cursor: 'pointer',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.75,
        border: '1px solid',
        borderColor: open || selected ? 'primary.main' : 'grey.400',
        background: open
          ? 'linear-gradient(180deg, #e4e4e4 0%, #f2f2f2 55%, #fafafa 100%)'
          : 'linear-gradient(180deg, #fcfcfc 0%, #efefef 50%, #dedede 100%)',
        boxShadow: open
          ? 'inset 0 3px 8px rgba(0,0,0,0.22)'
          : '0 1px 2px rgba(0,0,0,0.18)',
        transform: open ? 'translateY(1px)' : 'none',
        transition: 'box-shadow 150ms, transform 150ms, border-color 150ms',
        '&:hover': { borderColor: 'primary.main' },
      }}
    >
      {/* The pull handle — takes the primary colour on the selected drawer, so
          the selection reads from the handle itself and not just the border. */}
      <Box
        sx={{
          width: 34, height: 6, borderRadius: 3, flexShrink: 0,
          bgcolor: open ? 'primary.main' : '#b5b5b5',
          boxShadow: open
            ? '0 1px 2px rgba(0,0,0,0.22)'
            : 'inset 0 1px 1px rgba(255,255,255,0.85), 0 1px 1px rgba(0,0,0,0.18)',
          transition: 'background-color 150ms',
        }}
      />
      {/* The drawer number is set in a monospace face and a size up from the
          name — it's an index, not prose, and the fixed-width digits line the
          drawers up with each other the way a filing cabinet's labels would.
          Rendered as its own span rather than baked into the label string so
          only the digits pick up the treatment, never the name. */}
      <Typography
        variant="caption"
        align="center"
        // The drawer face is a fixed light metal gradient in both themes, so the
        // label is pinned to black rather than text.primary — which resolves to
        // near-white under the dark theme and left these labels unreadable.
        sx={{ fontWeight: open || selected ? 700 : 500, lineHeight: 1.25, color: 'common.black' }}
      >
        {code != null && code !== '' && (
          <Box
            component="span"
            sx={{
              fontFamily: drawer_code_font_family,
              fontSize: drawer_code_font_size,
              fontWeight: 700,
              mr: 0.75,
            }}
          >
            {code}
          </Box>
        )}
        {label}
      </Typography>
    </Box>
  );
}

function DetailRow({ label, value }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={500} sx={{ textAlign: 'right' }}>{String(value)}</Typography>
    </Stack>
  );
}
