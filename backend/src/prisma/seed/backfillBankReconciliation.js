// backfillBankReconciliation.js — one-time catch-up for the same reason as
// backfillOutstanding.js: the new syncBankReconciliationTxn() logic in
// backend/src/routes/resources.js only fires going forward (on create/
// update/delete of a BankDeposit/Collection/SupplierPayment/Cheque). It
// can't retroactively create System Transaction rows for vouchers that were
// already posted/printed before that sync existed, and it can't remove the
// disconnected demo reconciliation seeded by mockdataseed.js (one
// "HDFC Bank - 50123456789" reconciliation with 6 fabricated Bank-statement
// lines and 6 fabricated System lines, referencing voucher numbers like
// REC/2026/05/0001 that don't correspond to any real Collection/Payment/
// Deposit/Cheque).
//
// This script:
//   1. Prunes every source: 'System' BankReconciliationTransaction whose
//      voucherNo doesn't match a real, currently-active (Posted/Printed)
//      BankDeposit, Collection, SupplierPayment, or Cheque. This is what
//      removes the seed's fabricated System lines.
//   2. Creates/refreshes a System line for every real active voucher that's
//      missing one, using the same rules as the live sync.
//   3. Leaves every source: 'Bank' line untouched — those represent the
//      actual bank statement and can only ever be entered/imported by hand,
//      never fabricated by this app.
//
// Safe to re-run any time.
//
// Run with: node src/prisma/seed/backfillBankReconciliation.js

require('dotenv').config();
const prisma = require('../client');

async function findOrCreateRecon(bankAccount, txnDate) {
  let recon = await prisma.bankReconciliation.findFirst({ where: { bankAccount }, orderBy: { id: 'desc' } });
  if (!recon) {
    recon = await prisma.bankReconciliation.create({
      data: {
        bankAccount, statementDate: txnDate || new Date(), reconciliationDate: txnDate || new Date(),
        openingBalance: 0, status: 'In Progress',
      },
    });
    console.log(`  + Created Bank Reconciliation for ${bankAccount}`);
  }
  return recon;
}

async function upsertSystemTxn(recon, { voucherType, voucherNo, txnDate, type, amount, description, remarks }) {
  const existing = await prisma.bankReconciliationTransaction.findFirst({
    where: { reconciliationId: recon.id, source: 'System', voucherNo },
  });
  const data = {
    source: 'System', txnDate: txnDate || null, description: description || null,
    voucherType: voucherType || null, voucherNo, type: type || null,
    amount: Number(amount) || 0, remarks: remarks || null,
  };
  if (existing) {
    await prisma.bankReconciliationTransaction.update({ where: { id: existing.id }, data });
  } else {
    await prisma.bankReconciliationTransaction.create({ data: { ...data, reconciliationId: recon.id, status: 'Unreconciled' } });
    console.log(`  + System line created: ${voucherType} ${voucherNo}`);
  }
}

async function run() {
  const [deposits, collections, payments, cheques] = await Promise.all([
    prisma.bankDeposit.findMany(),
    prisma.collection.findMany(),
    prisma.supplierPayment.findMany(),
    prisma.cheque.findMany(),
  ]);

  const activeVoucherNos = new Set();

  console.log('Syncing System Transactions from active Bank Deposits...');
  for (const d of deposits) {
    if (!d.depositNo || d.status !== 'Posted' || !d.depositTo) continue;
    activeVoucherNos.add(d.depositNo);
    const recon = await findOrCreateRecon(d.depositTo, d.depositDate);
    await upsertSystemTxn(recon, {
      voucherType: 'Deposit', voucherNo: d.depositNo, txnDate: d.depositDate, type: 'Credit',
      amount: d.totalDepositAmount, description: 'Deposit', remarks: d.remarks,
    });
  }

  console.log('Syncing System Transactions from active Collections...');
  for (const c of collections) {
    if (!c.collectionNo || c.status !== 'Posted' || !c.depositTo) continue;
    activeVoucherNos.add(c.collectionNo);
    const recon = await findOrCreateRecon(c.depositTo, c.receiptDate);
    await upsertSystemTxn(recon, {
      voucherType: 'Receipt', voucherNo: c.collectionNo, txnDate: c.receiptDate, type: 'Credit',
      amount: c.paymentAmount, description: `Receipt from ${c.customerName || 'customer'}`, remarks: c.notes,
    });
  }

  console.log('Syncing System Transactions from active Supplier Payments...');
  for (const p of payments) {
    if (!p.paymentNo || p.status !== 'Posted' || !p.payFromAccount) continue;
    activeVoucherNos.add(p.paymentNo);
    const recon = await findOrCreateRecon(p.payFromAccount, p.paymentDate);
    await upsertSystemTxn(recon, {
      voucherType: 'Payment', voucherNo: p.paymentNo, txnDate: p.paymentDate, type: 'Debit',
      amount: p.paymentAmount, description: `Payment to ${p.supplierName || 'supplier'}`, remarks: p.notes,
    });
  }

  console.log('Syncing System Transactions from printed Cheques...');
  for (const c of cheques) {
    if (!c.chequeNo || c.status !== 'Printed' || !c.bankAccount) continue;
    activeVoucherNos.add(c.chequeNo);
    const recon = await findOrCreateRecon(c.bankAccount, c.chequeDate);
    await upsertSystemTxn(recon, {
      voucherType: 'Cheque', voucherNo: c.chequeNo, txnDate: c.chequeDate, type: 'Debit',
      amount: c.amount, description: `Cheque to ${c.payTo || 'payee'}`, remarks: c.narration,
    });
  }

  console.log('Pruning System Transactions not tied to any real active voucher...');
  const allSystemTxns = await prisma.bankReconciliationTransaction.findMany({
    where: { source: 'System' }, select: { id: true, voucherNo: true },
  });
  const orphanIds = allSystemTxns
    .filter((t) => !t.voucherNo || !activeVoucherNos.has(t.voucherNo))
    .map((t) => t.id);
  if (orphanIds.length) {
    await prisma.bankReconciliationTransaction.deleteMany({ where: { id: { in: orphanIds } } });
    console.log(`Pruned ${orphanIds.length} orphan System Transaction row(s).`);
  } else {
    console.log('No orphan System Transaction rows found.');
  }

  console.log('Backfill complete.');
}

run()
  .catch((err) => {
    console.error('Backfill error:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
