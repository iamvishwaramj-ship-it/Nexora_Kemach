/**
 * Account Group hierarchy rules — the group-tree counterpart to
 * chartOfAccountRules.js.
 *
 * Groups are a tree in their own right: 1 Assets > 1.1 Current Assets >
 * 1.1.1 Cash. The schema and the seed have always modelled that (ParentGroupID,
 * GroupLevel), but nothing enforced it, so a client could file a group under
 * itself, invent a GroupLevel unrelated to its actual depth, or reclassify a
 * sub-group of Assets as a Liability — which would misfile every account
 * beneath it in the financial statements.
 *
 * The rules:
 *
 *   1. GroupLevel is DERIVED — parent level + 1, or 1 for a drawer. Never
 *      taken from the client.
 *   2. Capped at MAX_GROUP_LEVEL.
 *   3. A level-1 group is a drawer and has no parent; anything deeper must
 *      have one.
 *   4. No cycles — a group can't sit under itself or its own descendants.
 *   5. GroupType is inherited from the drawer, so a branch can't be split
 *      across two classifications.
 *   6. IsPostingAllowed means "is a leaf": a group with sub-groups is roll-up
 *      only, accounts hang off the leaves. Recomputed on write, and the new
 *      parent is flipped to non-posting when a child appears under it.
 *   7. A group holding accounts, or holding sub-groups, can't be deleted.
 */

const prisma = require('../prisma/client');

const FIRST_GROUP_LEVEL = 1;
const MAX_GROUP_LEVEL = 5;

function badRequest(message, field) {
  const err = new Error(message);
  err.status = 400;
  if (field) err.errors = { [field]: message };
  return err;
}

/** Depth of a group, walked up ParentGroupID from the database. */
async function deriveGroupLevel(groupId, client = prisma) {
  let level = FIRST_GROUP_LEVEL;
  let currentId = groupId;
  const seen = new Set();
  while (currentId != null) {
    if (seen.has(currentId)) break;
    seen.add(currentId);
    const row = await client.accountGroup.findUnique({
      where: { id: currentId },
      select: { parentGroupId: true },
    });
    if (!row || row.parentGroupId == null) break;
    level += 1;
    currentId = row.parentGroupId;
  }
  return level;
}

/** The level-1 ancestor of a group — the drawer its whole branch rolls into. */
async function rootGroupOf(groupId, client = prisma) {
  let currentId = groupId;
  const seen = new Set();
  while (currentId != null) {
    if (seen.has(currentId)) break;
    seen.add(currentId);
    const row = await client.accountGroup.findUnique({ where: { id: currentId } });
    if (!row || row.parentGroupId == null) return row;
    currentId = row.parentGroupId;
  }
  return null;
}

/** Every descendant group id of `groupId`, breadth-first. */
async function collectDescendantGroupIds(groupId, client = prisma) {
  const found = new Set();
  let frontier = [groupId];
  while (frontier.length) {
    const children = await client.accountGroup.findMany({
      where: { parentGroupId: { in: frontier } },
      select: { id: true },
    });
    frontier = [];
    children.forEach(({ id }) => {
      if (found.has(id)) return;
      found.add(id);
      frontier.push(id);
    });
  }
  return found;
}

async function validateAccountGroup({ data, id }) {
  const existing = id != null
    ? await prisma.accountGroup.findUnique({ where: { id } })
    : null;
  if (id != null && !existing) throw badRequest('Account group not found');

  const pick = (field) => (
    Object.prototype.hasOwnProperty.call(data, field) ? data[field] : existing?.[field]
  );

  const rawParentId = pick('parentGroupId');
  const parentGroupId = rawParentId == null || rawParentId === '' ? null : Number(rawParentId);

  // Rule 3 (drawer half) — no parent means level 1, and a drawer keeps
  // whatever classification it was given.
  if (parentGroupId == null) {
    return {
      ...data,
      parentGroupId: null,
      groupLevel: FIRST_GROUP_LEVEL,
      isPostingAllowed: id != null
        ? (await prisma.accountGroup.count({ where: { parentGroupId: id } })) === 0
        : true,
    };
  }

  const parent = await prisma.accountGroup.findUnique({ where: { id: parentGroupId } });
  if (!parent) throw badRequest('The selected parent group does not exist', 'parentGroupId');

  // Rule 4 — no cycles.
  if (id != null) {
    if (parentGroupId === id) {
      throw badRequest('A group cannot be its own parent', 'parentGroupId');
    }
    const descendants = await collectDescendantGroupIds(id);
    if (descendants.has(parentGroupId)) {
      throw badRequest('A group cannot sit under one of its own sub-groups', 'parentGroupId');
    }
  }

  // Rules 1 and 2 — derive the level, hold it to the cap.
  const groupLevel = (await deriveGroupLevel(parentGroupId)) + 1;
  if (groupLevel > MAX_GROUP_LEVEL) {
    throw badRequest(
      `Account groups are limited to ${MAX_GROUP_LEVEL} levels — this group would be level ${groupLevel}`,
      'parentGroupId'
    );
  }

  // Rule 5 — the drawer owns the classification.
  const drawer = await rootGroupOf(parentGroupId);
  const groupType = drawer?.groupType || parent.groupType || existing?.groupType || '';

  // Rule 6 — the new parent now has a child, so it stops being a posting
  // group. Done here rather than left to drift, since the flag is what tells
  // the Chart of Accounts screen where accounts may legally hang.
  if (parent.isPostingAllowed) {
    await prisma.accountGroup.update({
      where: { id: parentGroupId },
      data: { isPostingAllowed: false },
    });
  }

  const childCount = id != null
    ? await prisma.accountGroup.count({ where: { parentGroupId: id } })
    : 0;

  return {
    ...data,
    parentGroupId,
    groupLevel,
    groupType,
    isPostingAllowed: childCount === 0,
  };
}

/**
 * Rule 7. The FK is ON DELETE NO ACTION, so both of these fail at the database
 * anyway — but as an opaque constraint error rather than a sentence saying
 * which records are in the way.
 */
async function guardAccountGroupDelete({ id, delegate }) {
  const [childGroups, accounts] = await Promise.all([
    prisma.accountGroup.count({ where: { parentGroupId: id } }),
    prisma.chartOfAccount.count({ where: { groupId: id } }),
  ]);
  if (childGroups > 0) {
    throw badRequest(`This group has ${childGroups} sub-group(s) under it — move or delete those first.`);
  }
  if (accounts > 0) {
    throw badRequest(`This group still holds ${accounts} account(s) — move them to another group first.`);
  }
  await delegate.delete({ where: { id } });
}

module.exports = {
  validateAccountGroup,
  guardAccountGroupDelete,
  FIRST_GROUP_LEVEL,
  MAX_GROUP_LEVEL,
};
