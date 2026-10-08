// removeAccountGroups.js — deletes ONLY the rows in AccountGroups (the
// Account Group master — Accounting > Account Group, the drawers/sub-groups
// Chart of Accounts files into).
//
//   npm run removeaccountgroups
//
// What it does NOT touch: AccountTypes and ChartOfAccounts. A group that
// still has one or more Chart of Accounts rows filed under it
// (FK_ChartOfAccounts_Group) cannot be deleted — SQL Server enforces that ON
// DELETE NO ACTION, same as the self-referencing parent/child FK below — so
// those groups are reported and left alone rather than silently cascading
// into a Chart of Accounts wipe nobody asked for. Run `npm run
// removechartofacc` first (or move those accounts to a different group) if
// the goal is to clear every group.
//
// Deletion order matters. AccountGroups.ParentGroupID is a self-referencing
// FK declared ON DELETE NO ACTION (SQL Server forbids cascade on a
// self-relation — see the comment on the model in schema.prisma), so a
// blanket deleteMany fails the moment it tries to remove a parent before its
// children. Rows are therefore removed deepest-level-first: every group
// whose id is not referenced as anyone's parent AND has no Chart of Accounts
// filed under it, repeatedly, until nothing removable is left. That
// naturally peels the tree from the leaves up whatever shape it has — same
// approach as removeChartOfAccounts.js.
//
// On a full successful clear, AccountGroups.GroupID's IDENTITY seed is also reset to 0
// so the next row created starts back at 1 instead of continuing from
// wherever it last left off.
//
// Safe to re-run: on an already-empty table it reports 0 and exits.

require('dotenv').config();
const prisma = require('../client');

async function deleteLeavesRepeatedly() {
  let removed = 0;
  const blockedByAccounts = new Set();

  // Bounded rather than while(true): the loop can only run as deep as the
  // tree is tall, and a bound means a corrupt cyclic chain reports instead
  // of spinning forever.
  for (let pass = 0; pass < 50; pass += 1) {
    const remaining = await prisma.accountGroup.findMany({
      select: { id: true, groupCode: true, parentGroupId: true },
    });
    if (remaining.length === 0) return { removed, stuck: 0, blockedByAccounts };

    const parentIds = new Set(remaining.map((g) => g.parentGroupId).filter((v) => v != null));

    // A group still carrying at least one Chart of Accounts row can't be
    // deleted either — same NO ACTION FK as the parent/child one above
    // (FK_ChartOfAccounts_Group).
    const inUse = await prisma.chartOfAccount.findMany({
      where: { groupId: { in: remaining.map((g) => g.id) } },
      select: { groupId: true },
      distinct: ['groupId'],
    });
    const inUseIds = new Set(inUse.map((r) => r.groupId));
    remaining.forEach((g) => { if (inUseIds.has(g.id)) blockedByAccounts.add(g.groupCode); });

    const removableIds = remaining
      .filter((g) => !parentIds.has(g.id) && !inUseIds.has(g.id))
      .map((g) => g.id);

    if (removableIds.length === 0) {
      // Nothing is removable, so every remaining row is either still
      // referenced by another group's ParentGroupID (only possible if that
      // chain contains a cycle) or still has accounts filed under it.
      return { removed, stuck: remaining.length, blockedByAccounts };
    }

    const result = await prisma.accountGroup.deleteMany({ where: { id: { in: removableIds } } });
    removed += result.count;
    console.log(`  pass ${pass + 1}: removed ${result.count} group(s)`);
  }
  const left = await prisma.accountGroup.count();
  return { removed, stuck: left, blockedByAccounts };
}

async function run() {
  const before = await prisma.accountGroup.count();
  console.log(`Removing account group entries (${before} row(s) found)...`);
  console.log('Account types and Chart of Accounts are NOT touched.');

  if (before === 0) {
    console.log('Nothing to remove.');
    return;
  }

  const { removed, stuck, blockedByAccounts } = await deleteLeavesRepeatedly();

  if (stuck > 0) {
    if (blockedByAccounts.size > 0) {
      console.warn(
        `\nRemoved ${removed} group(s), but ${stuck} could not be deleted — ${blockedByAccounts.size} of them still have Chart of Accounts filed under them (${[...blockedByAccounts].join(', ')}). Run "npm run removechartofacc" first, or move those accounts to a different group, then re-run.`
      );
    } else {
      console.warn(
        `\nRemoved ${removed} group(s), but ${stuck} could not be deleted — every one of them is still referenced as another group's parent, which means the ParentGroupID chain contains a cycle. Break the loop (set one row's ParentGroupID to NULL) and re-run.`
      );
    }
    process.exitCode = 1;
    return;
  }

  console.log(`\nDone. Removed ${removed} account group(s).`);

  // DELETE (used above, not TRUNCATE — a self-referencing FK blocks TRUNCATE
  // in SQL Server) never resets an IDENTITY column, so with the table now
  // genuinely empty, GroupID would otherwise keep counting up from wherever
  // it last left off instead of starting back at 1. RESEEDing to 0 makes the
  // NEXT insert land on 1, which is only correct because the table is empty
  // here — reseeding a table that still has rows would let a future insert
  // collide with an existing GroupID.
  await prisma.$executeRawUnsafe("DBCC CHECKIDENT ('dbo.AccountGroups', RESEED, 0)");
  console.log('Identity counter reset — the next account group created will be GroupID 1.');
}

run()
  .catch((err) => {
    console.error('Remove error:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
