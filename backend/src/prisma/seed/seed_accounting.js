// seed_accounting.js — pre-populates the Accounting module with the standard
// reference chart: the full Account Group hierarchy (6 roots, their
// sub-groups and leaf groups) and the 9 Account Types.
//
// Requires the AccountGroups/AccountTypes/ChartOfAccounts tables to already
// exist — run `npx prisma migrate deploy` first. Upserts by code, so
// re-running this is always safe and won't duplicate rows; re-running it also
// repairs names/parents/levels on rows that already exist.
//
// Run with:  npm run accounting:seed

require('dotenv').config();
const prisma = require('../client');

// The org's standard group hierarchy. `parentCode` refers to another row's
// groupCode in this same list — parents are always listed before their
// children so a single top-to-bottom pass can resolve every parent id.
//
// groupType stays the accounting classification of the ROOT the row sits
// under (it drives reporting), which is why 5 Revenue and its Direct/Indirect
// Costs children keep groupType 'Expenses' — only the display name differs.
const ACCOUNT_GROUPS = [
  // 1 Assets
  { groupCode: '1', groupName: 'Assets', groupType: 'Assets', parentCode: null },
  { groupCode: '1.1', groupName: 'Current Assets', groupType: 'Assets', parentCode: '1' },
  { groupCode: '1.1.1', groupName: 'Cash', groupType: 'Assets', parentCode: '1.1' },
  { groupCode: '1.1.2', groupName: 'Cash at Bank', groupType: 'Assets', parentCode: '1.1' },
  { groupCode: '1.1.3', groupName: 'Accounts Receivable', groupType: 'Assets', parentCode: '1.1' },
  { groupCode: '1.1.4', groupName: 'Inventory', groupType: 'Assets', parentCode: '1.1' },

  // 2 Liabilities
  { groupCode: '2', groupName: 'Liabilities', groupType: 'Liabilities', parentCode: null },
  { groupCode: '2.1', groupName: 'Current Liabilities', groupType: 'Liabilities', parentCode: '2' },
  { groupCode: '2.1.1', groupName: 'Accounts Payable', groupType: 'Liabilities', parentCode: '2.1' },
  { groupCode: '2.1.2', groupName: 'GST Payable', groupType: 'Liabilities', parentCode: '2.1' },
  { groupCode: '2.2', groupName: 'Long Term Liabilities', groupType: 'Liabilities', parentCode: '2' },

  // 3 Equity
  { groupCode: '3', groupName: 'Equity', groupType: 'Equity', parentCode: null },
  { groupCode: '3.1', groupName: 'Capital', groupType: 'Equity', parentCode: '3' },
  { groupCode: '3.2', groupName: 'Reserves & Surplus', groupType: 'Equity', parentCode: '3' },

  // 4 Revenue (originally seeded as "5 Cost of Goods Sold")
  { groupCode: '4', groupName: 'Revenue', groupType: 'Expenses', parentCode: null },
  { groupCode: '4.1', groupName: 'Direct Costs', groupType: 'Expenses', parentCode: '4' },
  { groupCode: '4.2', groupName: 'Indirect Costs', groupType: 'Expenses', parentCode: '4' },

  // 5 Expenditure (originally seeded as "6 Expenses")
  { groupCode: '5', groupName: 'Expenditure', groupType: 'Expenses', parentCode: null },
  { groupCode: '5.1', groupName: 'Salary Expenses', groupType: 'Expenses', parentCode: '5' },
  { groupCode: '5.2', groupName: 'Administrative Expenses', groupType: 'Expenses', parentCode: '5' },
  { groupCode: '5.3', groupName: 'Finance Expenses', groupType: 'Expenses', parentCode: '5' },
];

// TypeCode/TypeName/NormalBalance match the "Account Types" panel in the org's
// reference image. Assets/Direct Costs/Indirect Costs/Expenses normally carry
// a Debit balance; Liabilities/Equity/Income normally carry a Credit balance
// — this is what ChartOfAccounts.balanceType auto-derives from.
// FinancialStatement: assets, liabilities and equity are balance-sheet items;
// income, costs and expenses land in the P&L.
const ACCOUNT_TYPES = [
  { typeCode: 'CA', typeName: 'Current Assets', financialStatement: 'Balance Sheet', normalBalance: 'D' },
  { typeCode: 'NCA', typeName: 'Non Current Assets', financialStatement: 'Balance Sheet', normalBalance: 'D' },
  { typeCode: 'CL', typeName: 'Current Liabilities', financialStatement: 'Balance Sheet', normalBalance: 'C' },
  { typeCode: 'LTL', typeName: 'Long Term Liabilities', financialStatement: 'Balance Sheet', normalBalance: 'C' },
  { typeCode: 'EQ', typeName: 'Equity', financialStatement: 'Balance Sheet', normalBalance: 'C' },
  { typeCode: 'INC', typeName: 'Income', financialStatement: 'Profit & Loss', normalBalance: 'C' },
  { typeCode: 'DC', typeName: 'Direct Costs', financialStatement: 'Profit & Loss', normalBalance: 'D' },
  { typeCode: 'IC', typeName: 'Indirect Costs', financialStatement: 'Profit & Loss', normalBalance: 'D' },
  { typeCode: 'EXP', typeName: 'Expenses', financialStatement: 'Profit & Loss', normalBalance: 'D' },
];

// A group with no children below it is a posting group — that's where ledger
// accounts actually hang. Parent groups are roll-up only.
const PARENT_CODES = new Set(ACCOUNT_GROUPS.map((g) => g.parentCode).filter(Boolean));

// Groups an earlier run of this seed created that are no longer wanted.
// Upserting can't remove a row, so retired codes are deleted explicitly.
// Listed children-first so a parent is only deleted once it's empty.
const REMOVED_GROUP_CODES = ['4.1', '4.2', '4'];

// Deletes retired groups, but never destructively: a group still carrying
// ledger accounts, or still holding sub-groups that survived, is left alone
// and reported instead. That way a mis-typed code here can't silently take
// real data with it.
async function removeRetiredGroups() {
  let removed = 0;
  for (const groupCode of REMOVED_GROUP_CODES) {
    const group = await prisma.accountGroup.findUnique({ where: { groupCode } });
    if (!group) continue;

    const accountsOnGroup = await prisma.chartOfAccount.count({ where: { groupId: group.id } });
    if (accountsOnGroup > 0) {
      console.warn(`Skipped removing group ${groupCode} (${group.groupName}) — ${accountsOnGroup} account(s) still reference it. Move those accounts to another group first.`);
      continue;
    }

    const childGroups = await prisma.accountGroup.count({ where: { parentGroupId: group.id } });
    if (childGroups > 0) {
      console.warn(`Skipped removing group ${groupCode} (${group.groupName}) — it still has ${childGroups} sub-group(s).`);
      continue;
    }

    await prisma.accountGroup.delete({ where: { id: group.id } });
    removed += 1;
  }
  if (removed > 0) console.log(`Removed ${removed} retired account group(s).`);
}

// Codes an earlier run of this seed assigned, remapped to their new numbers
// after Income (4) was retired: Revenue moves 5 -> 4 and Expenditure 6 -> 5.
// GroupCode is UNIQUE, so the order here matters — every 5.x is vacated
// before anything tries to claim it, which is why the whole 5 -> 4 block is
// listed ahead of the 6 -> 5 block.
const RENUMBERED_GROUP_CODES = [
  ['5', '4'], ['5.1', '4.1'], ['5.2', '4.2'],
  ['6', '5'], ['6.1', '5.1'], ['6.2', '5.2'], ['6.3', '5.3'],
];

// Renumbers in place so existing groups keep their identity (GroupID) and any
// accounts already hanging off them stay attached — only the code changes.
// A target code that's somehow already taken is reported and skipped rather
// than blowing up on the unique constraint.
async function renumberGroups() {
  let renumbered = 0;
  for (const [fromCode, toCode] of RENUMBERED_GROUP_CODES) {
    const group = await prisma.accountGroup.findUnique({ where: { groupCode: fromCode } });
    if (!group) continue;

    const clash = await prisma.accountGroup.findUnique({ where: { groupCode: toCode } });
    if (clash) {
      console.warn(`Skipped renumbering ${fromCode} -> ${toCode}: code ${toCode} is already in use.`);
      continue;
    }

    await prisma.accountGroup.update({ where: { id: group.id }, data: { groupCode: toCode } });
    renumbered += 1;
  }
  if (renumbered > 0) console.log(`Renumbered ${renumbered} account group(s).`);
}

async function run() {
  await removeRetiredGroups();
  await renumberGroups();

  const idByCode = new Map();
  let groupsCreated = 0;
  let groupsUpdated = 0;

  for (const g of ACCOUNT_GROUPS) {
    const parentGroupId = g.parentCode ? idByCode.get(g.parentCode) ?? null : null;
    // Level is the depth of the code itself ('1.1.1' -> 3), which always
    // matches the parent chain because parents precede children above.
    const groupLevel = g.groupCode.split('.').length;
    const isPostingAllowed = !PARENT_CODES.has(g.groupCode);

    const data = {
      groupName: g.groupName,
      groupType: g.groupType,
      parentGroupId,
      groupLevel,
      isPostingAllowed,
    };

    const existing = await prisma.accountGroup.findUnique({ where: { groupCode: g.groupCode } });
    const saved = await prisma.accountGroup.upsert({
      where: { groupCode: g.groupCode },
      update: data,
      create: { groupCode: g.groupCode, ...data, status: 'A' },
    });
    idByCode.set(g.groupCode, saved.id);
    if (existing) groupsUpdated += 1; else groupsCreated += 1;
  }
  console.log(`Account groups: ${groupsCreated} created, ${groupsUpdated} updated.`);

  let typesCreated = 0;
  let typesUpdated = 0;
  for (const t of ACCOUNT_TYPES) {
    const existing = await prisma.accountType.findUnique({ where: { typeCode: t.typeCode } });
    await prisma.accountType.upsert({
      where: { typeCode: t.typeCode },
      update: { typeName: t.typeName, financialStatement: t.financialStatement, normalBalance: t.normalBalance },
      create: { ...t, status: 'A' },
    });
    if (existing) typesUpdated += 1; else typesCreated += 1;
  }
  console.log(`Account types: ${typesCreated} created, ${typesUpdated} updated.`);
}

if (require.main === module) {
  run()
    .catch((err) => {
      console.error('accounting:seed failed:', err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { run };
