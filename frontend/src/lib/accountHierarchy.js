// SAP-style level rules for the Chart of Accounts.
//
// SAP Business One models the chart as a fixed-depth tree rather than a free
// parent/child graph, and every rule below comes from that model:
//
//   Level 1  the DRAWER — Assets, Liabilities, Equity, Revenue, Expenditure.
//            A drawer is an AccountGroup here, not a ChartOfAccount row, which
//            is why no account ever carries level 1.
//   Level 2  accounts sitting directly inside a drawer.
//   Level 3..MAX_ACCOUNT_LEVEL  accounts nested under a Title above them.
//
// Two structural rules ride on top of the depth:
//
//   1. Only a TITLE account may have sub-accounts. An Active account is a
//      posting account and is always a leaf — in SAP you cannot post to a node
//      that has children, because the children's balances are what roll up.
//   2. A parent must live in the same drawer as its child. A liability cannot
//      hang off an asset; the drawer is the account's classification and the
//      hierarchy has to stay inside it.
//
// Levels are DERIVED by walking the parent chain rather than read from the
// stored AccountLevel column. The column is still written on save (it's what
// reports group on), but deriving it for display means a row saved by an older
// build — or repointed by a hand-run SQL update — shows its true depth instead
// of a stale number.

/** The drawer (AccountGroup root) occupies level 1; no account does. */
export const DRAWER_LEVEL = 1;

/** An account with no parent sits directly in the drawer, at level 2. */
export const FIRST_ACCOUNT_LEVEL = DRAWER_LEVEL + 1;

/**
 * Deepest account level allowed. SAP Business One ships with 5 and can be
 * extended to 10; this app follows the stock default. Raising it is a
 * one-line change here — nothing else hard-codes a depth.
 */
export const MAX_ACCOUNT_LEVEL = 5;

/**
 * Account GROUPS have their own hierarchy, separate from the account tree:
 * 1 Assets > 1.1 Current Assets > 1.1.1 Cash. Level 1 is a drawer (the faces
 * across the top of the Chart of Accounts page); anything below is a
 * sub-group. Same 5-level ceiling, for the same reason — a chart nobody can
 * read isn't a chart.
 */
export const FIRST_GROUP_LEVEL = 1;
export const MAX_GROUP_LEVEL = 5;

/**
 * Depth of `account`, counted from its drawer. Walks up parentAccountId and
 * stops at the first row with no parent (or a parent that isn't in the map,
 * e.g. filtered out or deleted), which lands at FIRST_ACCOUNT_LEVEL.
 *
 * `seen` guards against a cyclic chain — the FK can't produce one, but a
 * corrupt row must not spin the UI forever.
 */
export function deriveAccountLevel(account, accountById) {
  if (!account) return FIRST_ACCOUNT_LEVEL;
  let level = FIRST_ACCOUNT_LEVEL;
  let current = account;
  const seen = new Set([current.id]);
  while (current?.parentAccountId != null) {
    const parent = accountById.get(current.parentAccountId);
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    level += 1;
    current = parent;
  }
  return level;
}

/**
 * Every account's derived level, keyed by id.
 *
 * deriveAccountLevel walks parentAccountId, which stores the PARENT's
 * AccountCode (not its id — see model ChartOfAccount in schema.prisma), so
 * the lookup map handed to it has to be keyed by accountCode too. The
 * returned level map itself stays id-keyed — every call site looks a level
 * up by an account's own id, which hasn't changed.
 */
export function buildLevelMap(accounts) {
  const accountByCode = new Map(accounts.map((a) => [a.accountCode, a]));
  return new Map(accounts.map((a) => [a.id, deriveAccountLevel(a, accountByCode)]));
}

/**
 * How many direct children each account has, keyed by id.
 *
 * parentAccountId holds the parent's AccountCode, so each child is resolved
 * back to its parent ROW first and counted against that parent's id — every
 * call site looks this up by an account's own id, same as before.
 */
export function buildChildCountMap(accounts) {
  const accountByCode = new Map(accounts.map((a) => [a.accountCode, a]));
  const counts = new Map();
  accounts.forEach((a) => {
    if (a.parentAccountId == null) return;
    const parent = accountByCode.get(a.parentAccountId);
    if (!parent) return;
    counts.set(parent.id, (counts.get(parent.id) || 0) + 1);
  });
  return counts;
}

/** The level a child would land on if it were filed under `parent`. */
export function childLevelOf(parent, level) {
  if (!parent) return FIRST_ACCOUNT_LEVEL;
  return (level ?? FIRST_ACCOUNT_LEVEL) + 1;
}

/**
 * Can `account` take sub-accounts? Title-only (rule 1) and not already at the
 * bottom of the tree (a child would exceed MAX_ACCOUNT_LEVEL).
 */
export function canParentChildren(account, level) {
  if (!account) return false;
  if (account.accountNature !== 'T') return false;
  return (level ?? FIRST_ACCOUNT_LEVEL) < MAX_ACCOUNT_LEVEL;
}

/**
 * Rows that predate the Title-only-parents rule: an Active account that
 * nonetheless has children. These are left in place rather than migrated —
 * they're flagged in the tree so they can be corrected deliberately, since
 * flipping an account's nature changes what it means in the ledger.
 */
export function isLegacyActiveParent(account, childCount) {
  return Boolean(account) && account.accountNature !== 'T' && (childCount || 0) > 0;
}

// --- Account groups (drawers and their sub-groups) -------------------------

/** Depth of a group, walked up parentGroupId. Drawers are level 1. */
export function deriveGroupLevel(group, groupById) {
  if (!group) return FIRST_GROUP_LEVEL;
  let level = FIRST_GROUP_LEVEL;
  let current = group;
  const seen = new Set([current.id]);
  while (current?.parentGroupId != null) {
    const parent = groupById.get(current.parentGroupId);
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    level += 1;
    current = parent;
  }
  return level;
}

/** Every group's derived level, keyed by id. */
export function buildGroupLevelMap(groups) {
  const groupById = new Map(groups.map((g) => [g.id, g]));
  return new Map(groups.map((g) => [g.id, deriveGroupLevel(g, groupById)]));
}

/**
 * The DRAWER a group ultimately belongs to — its level-1 ancestor. This is the
 * unit an account's classification actually hangs off: 1.1.1 Cash and
 * 1.1 Current Assets are both inside the Assets drawer, so an account in one
 * may legitimately sit under a Title in the other.
 *
 * Comparing exact groupIds instead would forbid that, and would fragment the
 * hierarchy the moment anyone used sub-groups at all.
 */
export function rootGroupIdOf(groupId, groupById) {
  let current = groupById.get(groupId);
  const seen = new Set();
  while (current?.parentGroupId != null) {
    if (seen.has(current.id)) break;
    seen.add(current.id);
    const parent = groupById.get(current.parentGroupId);
    if (!parent) break;
    current = parent;
  }
  return current?.id ?? groupId ?? null;
}

/** True when both groups live under the same drawer. */
export function sameDrawer(groupIdA, groupIdB, groupById) {
  if (groupIdA == null || groupIdB == null) return false;
  return rootGroupIdOf(groupIdA, groupById) === rootGroupIdOf(groupIdB, groupById);
}

/**
 * Whether `candidate` may be chosen as the parent of the account being
 * edited/created. Returns a reason string when it may not, or null when it
 * may — the reason is what the UI shows so a missing option is explainable
 * rather than mysterious.
 *
 * `excludeIds` is the account itself plus its descendants (a cycle), computed
 * by the caller which owns the flat row list.
 */
export function parentRejectionReason(candidate, { groupId, groupById, excludeIds, level }) {
  if (!candidate) return 'No account selected';
  if (excludeIds?.has(candidate.id)) return 'An account cannot sit under itself or its own sub-accounts';
  if (groupId != null && groupById && !sameDrawer(candidate.groupId, groupId, groupById)) {
    return 'Parent must be in the same drawer';
  }
  if (candidate.accountNature !== 'T') return 'Only Title accounts can have sub-accounts';
  if ((level ?? FIRST_ACCOUNT_LEVEL) >= MAX_ACCOUNT_LEVEL) {
    return `Already at level ${MAX_ACCOUNT_LEVEL} — the deepest level allowed`;
  }
  return null;
}

/**
 * The Level dropdown's options, SAP-style.
 *
 * SAP's Chart of Accounts is laid out as five level columns and you place an
 * account by choosing which column it belongs in; the parent follows from
 * that. This reproduces the same idea: a level is only offered when there's
 * somewhere for it to attach — level N needs at least one Title sitting at
 * N-1 in the same drawer — so an unreachable level can't be picked and then
 * silently rejected on Save.
 *
 * `min` is FIRST_ACCOUNT_LEVEL for a Title (it may stand alone in the drawer)
 * and FIRST_ACCOUNT_LEVEL + 1 for an Active account, which must sit under a
 * Title and so can never occupy the drawer's own first level.
 */
export function accountLevelOptions({ min = FIRST_ACCOUNT_LEVEL, parentsByLevel = new Map() } = {}) {
  const options = [];
  for (let level = min; level <= MAX_ACCOUNT_LEVEL; level += 1) {
    const parentsAvailable = level === FIRST_ACCOUNT_LEVEL
      ? true
      : (parentsByLevel.get(level - 1) || 0) > 0;
    options.push({
      label: level === FIRST_ACCOUNT_LEVEL
        ? `Level ${level} — directly in the drawer`
        : `Level ${level}${parentsAvailable ? '' : ' — no Title available at this depth'}`,
      value: level,
      disabled: !parentsAvailable,
    });
  }
  return options;
}

/** How many eligible parents sit at each level. Keyed level -> count. */
export function countByLevel(accounts, levelById) {
  const counts = new Map();
  accounts.forEach((a) => {
    const level = levelById.get(a.id) ?? FIRST_ACCOUNT_LEVEL;
    counts.set(level, (counts.get(level) || 0) + 1);
  });
  return counts;
}
