// recomputeOutstanding.js — repairs Customer/Supplier Outstanding rows whose
// paidAmount/balanceAmount drifted from reality because of a bug in
// backend/src/routes/resources.js: re-saving an already-Posted Collection
// (or SupplierPayment) re-subtracted its invoiceApplications a second time
// instead of only applying the net change, silently over-decrementing the
// invoice's balance on every re-save — eventually driving it to 0/'Paid' and
// making it vanish from the Outstanding pages even though money was still
// owed. That bug is now fixed for anything saved going forward, but it can't
// undo drift that already happened to existing rows — this script does that
// by recomputing paidAmount straight from the source of truth (the sum of
// amountApplied across every POSTED Collection/SupplierPayment referencing
// that invoice), rather than trusting the incrementally-updated field.
//
// It also PRUNES orphan rows — any Customer/Supplier Outstanding row whose
// invoiceNo doesn't match a real, currently-active Sales/Purchase Invoice.
// mockdataseed.js used to seed a handful of standalone demo rows (invoice
// numbers like SI/2025/1001, PI/2025/1001) that were never linked to any
// real invoice; those show up as extra, unexplained rows on the Customer/
// Supplier Outstanding pages alongside genuinely invoice-derived ones. This
// prune removes exactly that kind of stray row (and equally, any row left
// behind for an invoice that's since been deleted or reverted to Draft).
//
// Safe to re-run any time — it always recomputes from scratch rather than
// applying a delta.
//
// Run with: node src/prisma/seed/recomputeOutstanding.js

require('dotenv').config();
const prisma = require('../client');

async function run() {
  console.log('Recomputing Customer Outstanding from posted Collections...');
  const [salesInvoices, collections] = await Promise.all([
    prisma.salesInvoice.findMany(),
    prisma.collection.findMany({ where: { status: 'Posted' }, include: { invoiceApplications: true } }),
  ]);

  // invoiceNo -> total amount actually applied against it by posted collections
  const appliedByInvoice = {};
  for (const c of collections) {
    for (const app of c.invoiceApplications) {
      if (!app.invoiceNo) continue;
      appliedByInvoice[app.invoiceNo] = (appliedByInvoice[app.invoiceNo] || 0) + Number(app.amountApplied || 0);
    }
  }

  let customerFixed = 0;
  let customerSkipped = 0;

  for (const inv of salesInvoices) {
    if (!inv.invoiceNo) continue;
    const isActive = inv.status && inv.status !== 'Draft' && inv.status !== 'Cancelled';
    if (!isActive) {
      customerSkipped += 1;
      continue;
    }
    const invoiceAmount = Number(inv.amount || 0);
    const paidAmount = Math.min(invoiceAmount, appliedByInvoice[inv.invoiceNo] || 0);
    const balanceAmount = Math.max(0, invoiceAmount - paidAmount);
    const status = balanceAmount <= 0 ? 'Paid' : (paidAmount > 0 ? 'Partial' : (inv.paymentStatus || 'Unpaid'));

    const existing = await prisma.customerOutstanding.findFirst({ where: { invoiceNo: inv.invoiceNo } });
    const data = {
      customerName: inv.customer,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      invoiceAmount,
      paidAmount,
      balanceAmount,
      status,
    };
    if (existing) {
      // Only touch it if something actually changed, so re-runs don't spam
      // "fixed" for rows that were already correct.
      const before = {
        paidAmount: Number(existing.paidAmount || 0),
        balanceAmount: Number(existing.balanceAmount || 0),
        status: existing.status,
      };
      const changed = before.paidAmount !== paidAmount || before.balanceAmount !== balanceAmount || before.status !== status;
      await prisma.customerOutstanding.update({ where: { id: existing.id }, data });
      if (changed) {
        customerFixed += 1;
        console.log(`  ~ Fixed ${inv.invoiceNo}: paid ${before.paidAmount} -> ${paidAmount}, balance ${before.balanceAmount} -> ${balanceAmount} (${before.status} -> ${status})`);
      }
    } else {
      await prisma.customerOutstanding.create({ data: { ...data, invoiceNo: inv.invoiceNo } });
      customerFixed += 1;
      console.log(`  + Created ${inv.invoiceNo}: balance ${balanceAmount}`);
    }
  }
  console.log(`Customer Outstanding: ${customerFixed} created/fixed, ${customerSkipped} skipped (not active).`);

  // Prune: delete any Customer Outstanding row whose invoiceNo isn't one of
  // the currently-active Sales Invoice numbers just processed above (stray
  // seed data, or a row left over from a deleted/un-posted invoice).
  const activeSalesInvoiceNos = new Set(
    salesInvoices
      .filter((inv) => inv.invoiceNo && inv.status && inv.status !== 'Draft' && inv.status !== 'Cancelled')
      .map((inv) => inv.invoiceNo)
  );
  const allCustomerOutstanding = await prisma.customerOutstanding.findMany({ select: { id: true, invoiceNo: true } });
  const orphanCustomerIds = allCustomerOutstanding
    .filter((row) => !row.invoiceNo || !activeSalesInvoiceNos.has(row.invoiceNo))
    .map((row) => row.id);
  if (orphanCustomerIds.length) {
    await prisma.customerOutstanding.deleteMany({ where: { id: { in: orphanCustomerIds } } });
    console.log(`Customer Outstanding: pruned ${orphanCustomerIds.length} orphan row(s) not tied to a real active invoice.`);
  }

  console.log('Recomputing Supplier Outstanding from posted Payments...');
  const [purchaseInvoices, payments] = await Promise.all([
    prisma.purchaseInvoice.findMany(),
    prisma.supplierPayment.findMany({ where: { status: 'Posted' }, include: { invoiceApplications: true } }),
  ]);

  const appliedByPurchaseInvoice = {};
  for (const p of payments) {
    for (const app of p.invoiceApplications) {
      if (!app.invoiceNo) continue;
      appliedByPurchaseInvoice[app.invoiceNo] = (appliedByPurchaseInvoice[app.invoiceNo] || 0) + Number(app.amountApplied || 0);
    }
  }

  let supplierFixed = 0;
  let supplierSkipped = 0;

  for (const inv of purchaseInvoices) {
    if (!inv.invoiceNo) continue;
    const isActive = inv.status && inv.status !== 'Draft' && inv.status !== 'Cancelled';
    if (!isActive) {
      supplierSkipped += 1;
      continue;
    }
    const invoiceAmount = Number(inv.amount || 0);
    const paidAmount = Math.min(invoiceAmount, appliedByPurchaseInvoice[inv.invoiceNo] || 0);
    const balanceAmount = Math.max(0, invoiceAmount - paidAmount);
    const status = balanceAmount <= 0 ? 'Paid' : (paidAmount > 0 ? 'Partial' : (inv.paymentStatus || 'Unpaid'));

    const existing = await prisma.supplierOutstanding.findFirst({ where: { invoiceNo: inv.invoiceNo } });
    const data = {
      supplierName: inv.supplier,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      invoiceAmount,
      paidAmount,
      balanceAmount,
      status,
    };
    if (existing) {
      const before = {
        paidAmount: Number(existing.paidAmount || 0),
        balanceAmount: Number(existing.balanceAmount || 0),
        status: existing.status,
      };
      const changed = before.paidAmount !== paidAmount || before.balanceAmount !== balanceAmount || before.status !== status;
      await prisma.supplierOutstanding.update({ where: { id: existing.id }, data });
      if (changed) {
        supplierFixed += 1;
        console.log(`  ~ Fixed ${inv.invoiceNo}: paid ${before.paidAmount} -> ${paidAmount}, balance ${before.balanceAmount} -> ${balanceAmount} (${before.status} -> ${status})`);
      }
    } else {
      await prisma.supplierOutstanding.create({ data: { ...data, invoiceNo: inv.invoiceNo } });
      supplierFixed += 1;
      console.log(`  + Created ${inv.invoiceNo}: balance ${balanceAmount}`);
    }
  }
  console.log(`Supplier Outstanding: ${supplierFixed} created/fixed, ${supplierSkipped} skipped (not active).`);

  // Same prune, mirrored for Supplier Outstanding.
  const activePurchaseInvoiceNos = new Set(
    purchaseInvoices
      .filter((inv) => inv.invoiceNo && inv.status && inv.status !== 'Draft' && inv.status !== 'Cancelled')
      .map((inv) => inv.invoiceNo)
  );
  const allSupplierOutstanding = await prisma.supplierOutstanding.findMany({ select: { id: true, invoiceNo: true } });
  const orphanSupplierIds = allSupplierOutstanding
    .filter((row) => !row.invoiceNo || !activePurchaseInvoiceNos.has(row.invoiceNo))
    .map((row) => row.id);
  if (orphanSupplierIds.length) {
    await prisma.supplierOutstanding.deleteMany({ where: { id: { in: orphanSupplierIds } } });
    console.log(`Supplier Outstanding: pruned ${orphanSupplierIds.length} orphan row(s) not tied to a real active invoice.`);
  }

  console.log('Recompute complete.');
}

run()
  .catch((err) => {
    console.error('Recompute error:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
