/**
 * One-off remedy for the "Pending G/L" symptom on Sales Invoice posting.
 *
 * Root cause (confirmed from the actual glError on a parked Journal Entry):
 * six roles in G/L Account Determination — Domestic Accounts Receivable,
 * Revenue Account, Output CGST Payable, Output SGST Payable, Inventory
 * Account and Cost of Goods Sold Account — were all pointed at the same
 * Chart Of Accounts row, "demo" (COA-000002), which is a Title account (a
 * heading, not a postable account). glPosting.js's assertPostable()
 * correctly refuses to post to a Title, so every Sales Invoice parks as
 * "Pending G/L" instead of generating a real journal entry.
 *
 * This script does NOT touch "demo" or anything else already configured —
 * it creates six new, dedicated, properly-filed posting accounts (each
 * under its own Title/Group, exactly the way Chart Of Accounts requires —
 * see utils/chartOfAccountRules.js) and repoints the ACTIVE financial
 * year's G/L Account Determination row at them. A role that's already
 * pointed at a real Active, non-Title account is left alone.
 *
 * Chart Of Accounts codes are allocated from the app's own 'COA' numbering
 * series (resolveDocumentNumber — the same call ChartOfAccounts' own Add
 * screen makes), so the new rows look exactly like ones created by hand.
 *
 * SAFE BY DEFAULT: everything below runs inside one Prisma transaction. In
 * dry-run mode (the default) the transaction is deliberately rolled back
 * after every lookup/create/update has run for real against your database
 * — so the report you see is exactly what would happen, not a guess, but
 * nothing is actually kept unless you pass --apply.
 *
 *   node src/scripts/fixGlAccountDetermination.js            # dry run
 *   node src/scripts/fixGlAccountDetermination.js --apply    # actually write
 *
 * After it applies, go to Journal Entry, open the Pending G/L entry from
 * your Sales Invoice, and click "Post to G/L" (or use the row menu's same
 * action) — that re-runs posting against the corrected determination
 * without needing to touch the invoice itself.
 */
const prisma = require('../prisma/client');
const { resolveDocumentNumber } = require('../utils/documentNumber');

const APPLY = process.argv.includes('--apply');

// A sentinel thrown to deliberately roll back the dry-run transaction —
// distinguished from a real failure so main() knows not to report it as one.
class DryRunAbort extends Error {}

// One posting account per broken role, each filed under its own Title so it
// never collides with whatever else already lives in the real chart.
const ROLE_PLAN = [
  {
    field: 'domesticAccountsReceivableId',
    label: 'Domestic Accounts Receivable',
    groupCode: 'GRP-ASSETS', groupName: 'Assets', groupType: 'Assets',
    titleName: 'Trade Receivables',
    leafName: 'Trade Receivables - Domestic',
    balanceType: 'D',
  },
  {
    field: 'revenueAccountId',
    label: 'Revenue Account',
    groupCode: 'GRP-INCOME', groupName: 'Income', groupType: 'Income',
    titleName: 'Revenue',
    leafName: 'Sales Revenue',
    balanceType: 'C',
  },
  {
    field: 'outputCgstPayableId',
    label: 'Output CGST Payable',
    groupCode: 'GRP-LIAB', groupName: 'Liabilities', groupType: 'Liabilities',
    titleName: 'Duties & Taxes',
    leafName: 'Output CGST Payable',
    balanceType: 'C',
  },
  {
    field: 'outputSgstPayableId',
    label: 'Output SGST Payable',
    groupCode: 'GRP-LIAB', groupName: 'Liabilities', groupType: 'Liabilities',
    titleName: 'Duties & Taxes',
    leafName: 'Output SGST Payable',
    balanceType: 'C',
  },
  {
    field: 'inventoryAccountId',
    label: 'Inventory Account',
    groupCode: 'GRP-ASSETS', groupName: 'Assets', groupType: 'Assets',
    titleName: 'Inventory',
    leafName: 'Inventory',
    balanceType: 'D',
  },
  {
    field: 'costOfGoodsSoldAccountId',
    label: 'Cost of Goods Sold Account',
    groupCode: 'GRP-EXP', groupName: 'Expenses', groupType: 'Expenses',
    titleName: 'Cost of Sales',
    leafName: 'Cost of Goods Sold',
    balanceType: 'D',
  },
];

const FIRST_ACCOUNT_LEVEL = 2; // matches DRAWER_LEVEL + 1 in chartOfAccountRules.js
const REMARK = 'Auto-created by fixGlAccountDetermination.js — replace with a real account if you have one.';

async function isUsablePostingAccount(tx, id) {
  if (!id) return null;
  const account = await tx.chartOfAccount.findUnique({ where: { id } });
  if (!account) return null;
  if (account.accountNature !== 'A') return null; // Title — the exact bug we're fixing
  if (account.status !== 'A') return null; // Inactive
  return account;
}

async function findOrCreateGroup(tx, plan, log) {
  let group = await tx.accountGroup.findFirst({
    where: { OR: [{ groupCode: plan.groupCode }, { groupName: plan.groupName }] },
  });
  if (group) return group;
  group = await tx.accountGroup.create({
    data: {
      groupCode: plan.groupCode,
      groupName: plan.groupName,
      groupType: plan.groupType,
      parentGroupId: null,
      groupLevel: 1,
      isPostingAllowed: true,
      status: 'A',
    },
  });
  log(`    + created Account Group "${group.groupName}" (${group.groupCode})`);
  return group;
}

async function findOrCreateTitle(tx, plan, group, log) {
  let title = await tx.chartOfAccount.findFirst({
    where: { accountName: plan.titleName, accountNature: 'T', groupId: group.id },
  });
  if (title) return title;
  const { documentNumber } = await resolveDocumentNumber('COA', undefined, tx);
  title = await tx.chartOfAccount.create({
    data: {
      accountCode: documentNumber,
      accountName: plan.titleName,
      groupId: group.id,
      parentAccountId: null,
      accountLevel: FIRST_ACCOUNT_LEVEL,
      accountNature: 'T',
      status: 'A',
      remarks: REMARK,
    },
  });
  log(`    + created Title "${title.accountName}" (${title.accountCode})`);
  return title;
}

async function findOrCreateLeaf(tx, plan, group, title, log) {
  let leaf = await tx.chartOfAccount.findFirst({
    where: { accountName: plan.leafName, accountNature: 'A', status: 'A' },
  });
  if (leaf) return leaf;
  const { documentNumber } = await resolveDocumentNumber('COA', undefined, tx);
  leaf = await tx.chartOfAccount.create({
    data: {
      accountCode: documentNumber,
      accountName: plan.leafName,
      groupId: group.id,
      // parentAccountId stores the parent's AccountCode, not its numeric id
      // (see model ChartOfAccount in schema.prisma).
      parentAccountId: title.accountCode,
      accountLevel: title.accountLevel + 1,
      accountNature: 'A',
      balanceType: plan.balanceType,
      status: 'A',
      remarks: REMARK,
    },
  });
  log(`    + created Account "${leaf.accountName}" (${leaf.accountCode})`);
  return leaf;
}

async function main() {
  console.log(APPLY ? 'Running in APPLY mode — changes will be written.' : 'Running in DRY-RUN mode — no writes. Pass --apply to write.');
  console.log('');

  const report = [];
  const log = (line) => report.push(line);

  try {
    await prisma.$transaction(async (tx) => {
      const activeFy = await tx.financialYear.findFirst({ where: { status: 'Active' } });
      if (!activeFy) {
        throw new Error('No Financial Year is marked Active — set one under Company Setup > Financial Years first.');
      }
      log(`Active financial year: ${activeFy.yearName || activeFy.name || activeFy.id}`);

      let determination = await tx.glAccountDetermination.findFirst({ where: { financialYearId: activeFy.id } });
      if (!determination) {
        throw new Error(
          `No G/L Account Determination row exists for the active financial year (id ${activeFy.id}). `
          + 'Open Accounting > G/L Account Determination, select this period, and Save once to create it, then re-run this script.'
        );
      }
      log(`G/L Account Determination row: id ${determination.id}`);
      log('');

      const updateData = {};

      for (const plan of ROLE_PLAN) {
        const currentId = determination[plan.field];
        const currentAccount = await isUsablePostingAccount(tx, currentId);
        if (currentAccount) {
          log(`${plan.label}: OK — already "${currentAccount.accountName}" (${currentAccount.accountCode}), left untouched.`);
          continue;
        }

        // Broken (Title/Inactive) or entirely unset — resolve a real account.
        let brokenNote = 'not configured';
        if (currentId) {
          const broken = await tx.chartOfAccount.findUnique({ where: { id: currentId } });
          if (broken) {
            brokenNote = broken.accountNature === 'T'
              ? `was "${broken.accountName}" (${broken.accountCode}), a Title account`
              : `was "${broken.accountName}" (${broken.accountCode}), Inactive`;
          }
        }
        log(`${plan.label}: ${brokenNote} — fixing:`);

        const group = await findOrCreateGroup(tx, plan, log);
        const title = await findOrCreateTitle(tx, plan, group, log);
        const leaf = await findOrCreateLeaf(tx, plan, group, title, log);

        updateData[plan.field] = leaf.id;
        log(`    -> now "${leaf.accountName}" (${leaf.accountCode})`);
      }

      log('');
      if (Object.keys(updateData).length === 0) {
        log('Nothing to change — every role already points at a valid posting account.');
      } else {
        await tx.glAccountDetermination.update({ where: { id: determination.id }, data: updateData });
        log(`Updated G/L Account Determination row ${determination.id}: ${Object.keys(updateData).join(', ')}`);
      }

      if (!APPLY) {
        throw new DryRunAbort();
      }
    });
  } catch (err) {
    if (!(err instanceof DryRunAbort)) throw err;
  }

  console.log(report.join('\n'));
  console.log('');
  console.log(APPLY
    ? 'Applied. Now go to Journal Entry, open the Pending G/L entry from your Sales Invoice, and click "Post to G/L".'
    : 'Dry run only — nothing was written. Re-run with --apply to make these changes for real.');
}

main()
  .catch((err) => {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
