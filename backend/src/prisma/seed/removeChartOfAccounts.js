// removeChartOfAccounts.js — deletes ONLY the rows in ChartOfAccounts.
//
//   npm run removechartofacc
//
// What it does NOT touch: AccountGroups, AccountTypes, and everything outside
// the accounting module. Those are reference data the accounts merely point
// at; wiping them alongside would take the drawer structure with it, which is
// almost never what "clear the chart of accounts" means. Use
// `npm run accounting:seed` to (re)build the groups and types.
//
// Deletion order matters. ChartOfAccounts.ParentAccountID is a self-referencing
// FK declared ON DELETE NO ACTION (SQL Server forbids cascade on a
// self-relation — see the comment on the model in schema.prisma), so a blanket
// deleteMany fails the moment it tries to remove a parent before its children.
// Rows are therefore removed deepest-level-first: every account whose id is not
// referenced as anyone's parent, repeatedly, until nothing is left. That
// naturally peels the tree from the leaves up whatever shape it has.
//
// On a full successful clear, ChartOfAccounts.AccountID's IDENTITY seed is also reset to 0
// so the next row created starts back at 1 instead of continuing from
// wherever it last left off.
//
// Safe to re-run: on an already-empty table it reports 0 and exits.

require('dotenv').config();
const prisma = require('../client');

// Set to true to also reset the COA numbering series, so the next account
// created is COA-000001 again rather than continuing past the deleted ones.
// Off by default: a code identifies a record for as long as it exists, and
// re-issuing codes that appear in exported reports or printed documents is the
// kind of thing an auditor asks pointed questions about.
const RESET_NUMBERING = process.argv.includes('--reset-numbering');

async function deleteLeavesRepeatedly() {
  let removed = 0;
  // Bounded rather than while(true): the loop can only run as deep as the tree
  // is tall, and a bound means a corrupt cyclic chain reports instead of
  // spinning forever.
  for (let pass = 0; pass < 50; pass += 1) {
    const remaining = await prisma.chartOfAccount.findMany({ select: { id: true, accountCode: true, parentAccountId: true } });
    if (remaining.length === 0) return { removed, stuck: 0 };

    // parentAccountId stores the parent's AccountCode, not its numeric id
    // (see model ChartOfAccount in schema.prisma) — "referenced as a parent"
    // has to be checked by accountCode, or every row looks like a leaf on
    // every pass and the deleteMany below hits the still-live FK.
    const parentCodes = new Set(remaining.map((a) => a.parentAccountId).filter((v) => v != null));
    const leafIds = remaining.filter((a) => !parentCodes.has(a.accountCode)).map((a) => a.id);

    if (leafIds.length === 0) {
      // Nothing is a leaf, so every remaining row is referenced by another —
      // only possible if the parent chain contains a cycle.
      return { removed, stuck: remaining.length };
    }

    const result = await prisma.chartOfAccount.deleteMany({ where: { id: { in: leafIds } } });
    removed += result.count;
    console.log(`  pass ${pass + 1}: removed ${result.count} account(s)`);
  }
  const left = await prisma.chartOfAccount.count();
  return { removed, stuck: left };
}

async function resetNumbering() {
  // The COA series is perpetual (financialYearId is NULL for master codes),
  // so there is normally exactly one row to reset.
  const series = await prisma.documentNumbering.findMany({ where: { documentCode: 'COA' } });
  if (series.length === 0) {
    console.log('No COA numbering series found — nothing to reset.');
    return;
  }
  for (const s of series) {
    await prisma.documentNumbering.update({
      where: { id: s.id },
      // currentNumber NULL means "nothing issued yet", which is what makes the
      // series look genuinely fresh rather than merely rewound.
      data: { currentNumber: null, nextNumber: s.startNumber ?? 1 },
    });
    console.log(`Reset numbering series "${s.seriesName}" — next account code will be ${s.startNumber ?? 1}.`);
  }
}

async function run() {
  const before = await prisma.chartOfAccount.count();
  console.log(`Removing chart of accounts entries (${before} row(s) found)...`);
  console.log('Account groups and account types are NOT touched.');

  if (before === 0) {
    console.log('Nothing to remove.');
    return;
  }

  const { removed, stuck } = await deleteLeavesRepeatedly();

  if (stuck > 0) {
    console.warn(
      `\nRemoved ${removed} account(s), but ${stuck} could not be deleted — every one of them is still referenced as another account's parent, which means the ParentAccountID chain contains a cycle. Break the loop (set one row's ParentAccountID to NULL) and re-run.`
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\nRemoved ${removed} chart of accounts entry(ies).`);

  // DELETE (used above, not TRUNCATE — a self-referencing FK blocks TRUNCATE
  // in SQL Server) never resets an IDENTITY column, so with the table now
  // genuinely empty, AccountID would otherwise keep counting up from
  // wherever it last left off instead of starting back at 1. RESEEDing to 0
  // makes the NEXT insert land on 1, which is only correct because the table
  // is empty here — reseeding a table that still has rows would let a
  // future insert collide with an existing AccountID.
  await prisma.$executeRawUnsafe("DBCC CHECKIDENT ('dbo.ChartOfAccounts', RESEED, 0)");
  console.log('Identity counter reset — the next chart of accounts row created will be AccountID 1.');

  if (RESET_NUMBERING) {
    await resetNumbering();
  } else {
    console.log('Numbering series left as-is — re-run with --reset-numbering to restart account codes at COA-000001.');
  }
}

run()
  .catch((err) => {
    console.error('Failed to remove chart of accounts entries:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
