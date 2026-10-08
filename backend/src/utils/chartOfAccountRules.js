/**
 * Chart of Accounts hierarchy rules — the server-side half of the SAP-style
 * level model described in frontend/src/lib/accountHierarchy.js.
 *
 * The form already applies these rules, but a form is a convenience, not a
 * control: the API is reachable directly, and an ERP's account tree is exactly
 * the kind of structure that must not be corruptible by a hand-rolled POST.
 * Everything here is therefore checked against what's actually in the database
 * rather than against what the client claims.
 *
 * The rules, and why each exists:
 *
 *   1. AccountLevel is DERIVED, never accepted from the client. It's parent
 *      level + 1, or FIRST_ACCOUNT_LEVEL for an account sitting straight in
 *      its drawer. Reports group on this column; a client-supplied value would
 *      let a row lie about where it sits.
 *   2. The chart is capped at MAX_ACCOUNT_LEVEL levels (SAP Business One's
 *      stock default).
 *   3. Only a Title account may have sub-accounts. An Active account is a
 *      posting account and is always a leaf — its balance is its own, not a
 *      roll-up.
 *   4. An Active account must have a parent; a Title may stand alone in its
 *      drawer.
 *   5. A parent must belong to the same DRAWER as its child — the level-1
 *      AccountGroup at the top of its group chain, not necessarily the same
 *      exact group. An account in 1.1.1 Cash may sit under a Title in
 *      1.1 Current Assets, because both roll up into Assets; what's forbidden
 *      is crossing drawers, i.e. a liability rolling up into an asset.
 *   6. No cycles: an account can't be filed under itself or under one of its
 *      own descendants.
 *   7. A Title that already has children can't be demoted to Active (rule 3
 *      applied to an edit), and an account with children can't be deleted.
 *
 * Pre-existing rows that break rule 3 are left alone deliberately — flipping
 * an account's nature changes what it means in the ledger, so the frontend
 * flags them for a human to correct rather than migrating them silently. Only
 * new writes are held to the rule.
 */

const prisma = require('../prisma/client');

/** The drawer (AccountGroup root) is level 1; no ChartOfAccount row is. */
const DRAWER_LEVEL = 1;
/** An account with no parent sits directly in its drawer. */
const FIRST_ACCOUNT_LEVEL = DRAWER_LEVEL + 1;
/** SAP Business One's stock maximum. Raise here if the org extends it. */
const MAX_ACCOUNT_LEVEL = 5;

/** A 400 rather than a 500 — these are user-correctable, not server faults. */
function badRequest(message, field) {
  const err = new Error(message);
  err.status = 400;
  if (field) err.errors = { [field]: message };
  return err;
}

/**
 * Depth of `account`, walked up the parent chain from the database rather than
 * read off its AccountLevel column, so a stale stored value can't propagate
 * into its new children. `seen` guards a corrupt cyclic chain.
 */
// `startAccountCode` is a parent's AccountCode (parentAccountId now stores
// the code, not the numeric id — see model ChartOfAccount in schema.prisma),
// so the walk up the chain matches on accountCode throughout.
async function deriveLevel(startAccountCode, client = prisma) {
  let level = FIRST_ACCOUNT_LEVEL;
  let currentCode = startAccountCode;
  const seen = new Set();
  while (currentCode != null) {
    if (seen.has(currentCode)) break;
    seen.add(currentCode);
    const row = await client.chartOfAccount.findUnique({
      where: { accountCode: currentCode },
      select: { parentAccountId: true },
    });
    if (!row || row.parentAccountId == null) break;
    level += 1;
    currentCode = row.parentAccountId;
  }
  return level;
}

/**
 * The DRAWER a group belongs to — its level-1 ancestor, found by walking
 * ParentGroupID up. This is the unit an account's classification hangs off:
 * two groups sharing a drawer are the same branch of the chart, whatever
 * depth they sit at.
 */
async function rootGroupIdOf(groupId, client = prisma) {
  let currentId = groupId;
  const seen = new Set();
  while (currentId != null) {
    if (seen.has(currentId)) break;
    seen.add(currentId);
    const row = await client.accountGroup.findUnique({
      where: { id: currentId },
      select: { parentGroupId: true },
    });
    if (!row || row.parentGroupId == null) return currentId;
    currentId = row.parentGroupId;
  }
  return currentId;
}

/**
 * Every descendant AccountCode of `accountCode`, breadth-first from the
 * database. Returns codes, not ids, because parentAccountId is matched
 * against AccountCode now (see model ChartOfAccount in schema.prisma) —
 * callers comparing against a candidate parent's own accountCode.
 */
async function collectDescendantAccountCodes(accountCode, client = prisma) {
  const found = new Set();
  let frontier = [accountCode];
  while (frontier.length) {
    const children = await client.chartOfAccount.findMany({
      where: { parentAccountId: { in: frontier } },
      select: { accountCode: true },
    });
    frontier = [];
    children.forEach(({ accountCode: code }) => {
      if (found.has(code)) return;
      found.add(code);
      frontier.push(code);
    });
  }
  return found;
}

/**
 * Validate a create or update and return the data to actually write, with
 * accountLevel replaced by the derived value.
 *
 * Called by crudFactory's `validate` hook for both POST and PUT. `id` is null
 * on create; on update it's the row being changed, which is what lets rules 6
 * and 7 be checked.
 */
async function validateChartOfAccount({ data, id }) {
  // On update the client may send a partial body, so the existing row supplies
  // whatever isn't being changed — otherwise omitting parentAccountId from a
  // PUT would read as "move this to the top of the drawer".
  const existing = id != null
    ? await prisma.chartOfAccount.findUnique({ where: { id } })
    : null;
  if (id != null && !existing) throw badRequest('Account not found');

  const pick = (field) => (
    Object.prototype.hasOwnProperty.call(data, field) ? data[field] : existing?.[field]
  );

  const accountNature = pick('accountNature') || 'A';
  const groupId = pick('groupId');
  // parentAccountId is the PARENT's AccountCode (a string), not a numeric FK
  // id — see model ChartOfAccount in schema.prisma. No Number() coercion.
  const rawParentCode = pick('parentAccountId');
  const parentAccountId = rawParentCode == null || String(rawParentCode).trim() === ''
    ? null : String(rawParentCode).trim();

  // Account Code is always typed by hand for this master — there is no
  // numbering-series fallback to fill it in if it's missing (see the
  // crudRouter mount in routes/resources.js, which has no `autoNumber`, and
  // the bulk import route, which requires its Account Code column). Checked
  // here rather than left to the frontend's zod schema so a direct API call
  // or a future caller can't slip a blank code past validation.
  const accountCode = pick('accountCode');
  if (id == null && (accountCode == null || String(accountCode).trim() === '')) {
    throw badRequest('Account code is required', 'accountCode');
  }

  if (groupId == null) throw badRequest('Account group is required', 'groupId');

  // Rule 7 — a Title with children stays a Title.
  if (id != null && accountNature === 'A' && existing.accountNature === 'T') {
    const childCount = await prisma.chartOfAccount.count({ where: { parentAccountId: existing.accountCode } });
    if (childCount > 0) {
      throw badRequest(
        'This account has sub-accounts, so it must stay a Title. Move its sub-accounts elsewhere first.',
        'accountNature'
      );
    }
  }

  // Rule 4 — a posting account is always filed under something.
  if (accountNature === 'A' && parentAccountId == null) {
    throw badRequest('An Active Account must sit under a Title account', 'parentAccountId');
  }

  if (parentAccountId == null) {
    return { ...data, accountLevel: FIRST_ACCOUNT_LEVEL };
  }

  const parent = await prisma.chartOfAccount.findUnique({ where: { accountCode: parentAccountId } });
  if (!parent) throw badRequest('The selected parent account does not exist', 'parentAccountId');

  // Rule 6 — no cycles. Compared by accountCode throughout, since that's what
  // parentAccountId now holds — `existing.accountCode` (not `id`) is this
  // account's own identity in that space.
  if (id != null) {
    if (parentAccountId === existing.accountCode) {
      throw badRequest('An account cannot be its own parent', 'parentAccountId');
    }
    const descendants = await collectDescendantAccountCodes(existing.accountCode);
    if (descendants.has(parentAccountId)) {
      throw badRequest('An account cannot sit under one of its own sub-accounts', 'parentAccountId');
    }
  }

  // Rule 3 — Titles only.
  if (parent.accountNature !== 'T') {
    throw badRequest(
      'Only Title accounts can have sub-accounts — pick a Title as the parent',
      'parentAccountId'
    );
  }

  // Rule 5 — same drawer. Compared at the drawer, not the exact group, so
  // sub-groups of one drawer can share a Title.
  if (parent.groupId !== groupId) {
    const [parentDrawer, childDrawer] = await Promise.all([
      rootGroupIdOf(parent.groupId),
      rootGroupIdOf(groupId),
    ]);
    if (parentDrawer !== childDrawer) {
      throw badRequest(
        'The parent account belongs to a different drawer',
        'parentAccountId'
      );
    }
  }

  // Rules 1 and 2 — derive the level, then hold it to the cap.
  const accountLevel = (await deriveLevel(parentAccountId)) + 1;
  if (accountLevel > MAX_ACCOUNT_LEVEL) {
    throw badRequest(
      `The chart of accounts is limited to ${MAX_ACCOUNT_LEVEL} levels — this account would be level ${accountLevel}`,
      'parentAccountId'
    );
  }

  return { ...data, accountLevel };
}

/**
 * Refuse to delete an account that still has sub-accounts. Without this the FK
 * is ON DELETE NO ACTION, so the delete fails anyway — but as an opaque
 * database error rather than a sentence explaining what to do about it.
 */
async function guardChartOfAccountDelete({ id, delegate }) {
  // parentAccountId stores a code, not this row's numeric id — resolve the
  // account's own accountCode first so the child count matches on the same
  // field children actually point at.
  const account = await prisma.chartOfAccount.findUnique({ where: { id }, select: { accountCode: true } });
  const childCount = account
    ? await prisma.chartOfAccount.count({ where: { parentAccountId: account.accountCode } })
    : 0;
  if (childCount > 0) {
    throw badRequest(
      `This account has ${childCount} sub-account(s) under it — move or delete those first.`
    );
  }
  // An account that books already use must stay: deleting it would orphan the
  // journal lines posted to it and the opening-balance documents that name it
  // as their Opening Balance Account (Inventory / Business Partner).
  if (account) {
    const [journalLines, inventoryOpening, bpOpening] = await Promise.all([
      prisma.journalEntryLine.count({ where: { accountCode: account.accountCode } }),
      prisma.openingBalance.count({ where: { openingBalanceAccount: account.accountCode } }),
      prisma.businessPartnerOpeningBalance.count({ where: { openingBalanceAccount: account.accountCode } }),
    ]);
    if (journalLines > 0) {
      throw badRequest(`This account has ${journalLines} journal entry line(s) posted to it, so it cannot be deleted. Make it Inactive instead.`);
    }
    if (inventoryOpening > 0 || bpOpening > 0) {
      throw badRequest('This account is the Opening Balance Account of an opening balance document, so it cannot be deleted. Make it Inactive instead.');
    }
  }
  await delegate.delete({ where: { id } });
}

module.exports = {
  validateChartOfAccount,
  guardChartOfAccountDelete,
  DRAWER_LEVEL,
  FIRST_ACCOUNT_LEVEL,
  MAX_ACCOUNT_LEVEL,
};
