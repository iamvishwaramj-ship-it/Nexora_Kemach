// backfillOutstanding.js — one-time catch-up for invoices that were created
// or posted BEFORE the Sales Invoice / Purchase Invoice -> Customer/Supplier
// Outstanding sync was added to backend/src/routes/resources.js. That sync
// only fires going forward (on create/update/delete of an invoice); it can't
// retroactively fix rows that already existed. This script scans every
// existing Sales Invoice and Purchase Invoice and creates the matching
// outstanding row for any that don't have one yet, using the same rules as
// the live sync logic:
//   - Draft/Cancelled invoices are skipped (no outstanding row expected).
//   - Anything else (Sent/Posted/Paid/Overdue) gets an outstanding row if
//     one doesn't already exist for that invoiceNo.
//   - Existing outstanding rows are left untouched — this only fills in
//     what's MISSING, it never overwrites paidAmount/balanceAmount that
//     Collection Entry/Payment Entry may have already adjusted.
//
// Run with: node src/prisma/seed/backfillOutstanding.js

require('dotenv').config();
const prisma = require('../client');

async function run() {
  console.log('Backfilling Customer Outstanding from existing Sales Invoices...');
  const salesInvoices = await prisma.salesInvoice.findMany();
  let customerCreated = 0;
  let customerSkipped = 0;

  for (const inv of salesInvoices) {
    if (!inv.invoiceNo) continue;
    const isActive = inv.status && inv.status !== 'Draft' && inv.status !== 'Cancelled';
    if (!isActive) {
      customerSkipped += 1;
      continue;
    }
    const existing = await prisma.customerOutstanding.findFirst({ where: { invoiceNo: inv.invoiceNo } });
    if (existing) {
      customerSkipped += 1;
      continue;
    }
    const invoiceAmount = Number(inv.amount || 0);
    await prisma.customerOutstanding.create({
      data: {
        customerName: inv.customer,
        invoiceNo: inv.invoiceNo,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        invoiceAmount,
        paidAmount: 0,
        balanceAmount: invoiceAmount,
        status: inv.paymentStatus || 'Unpaid',
      },
    });
    customerCreated += 1;
    console.log(`  + Customer Outstanding created for invoice ${inv.invoiceNo}`);
  }

  console.log(`Customer Outstanding: ${customerCreated} created, ${customerSkipped} skipped (already existed or not active).`);

  console.log('Backfilling Supplier Outstanding from existing Purchase Invoices...');
  const purchaseInvoices = await prisma.purchaseInvoice.findMany();
  let supplierCreated = 0;
  let supplierSkipped = 0;

  for (const inv of purchaseInvoices) {
    if (!inv.invoiceNo) continue;
    const isActive = inv.status && inv.status !== 'Draft' && inv.status !== 'Cancelled';
    if (!isActive) {
      supplierSkipped += 1;
      continue;
    }
    const existing = await prisma.supplierOutstanding.findFirst({ where: { invoiceNo: inv.invoiceNo } });
    if (existing) {
      supplierSkipped += 1;
      continue;
    }
    const invoiceAmount = Number(inv.amount || 0);
    await prisma.supplierOutstanding.create({
      data: {
        supplierName: inv.supplier,
        invoiceNo: inv.invoiceNo,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        invoiceAmount,
        paidAmount: 0,
        balanceAmount: invoiceAmount,
        status: inv.paymentStatus || 'Unpaid',
      },
    });
    supplierCreated += 1;
    console.log(`  + Supplier Outstanding created for invoice ${inv.invoiceNo}`);
  }

  console.log(`Supplier Outstanding: ${supplierCreated} created, ${supplierSkipped} skipped (already existed or not active).`);
  console.log('Backfill complete.');
}

run()
  .catch((err) => {
    console.error('Backfill error:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
