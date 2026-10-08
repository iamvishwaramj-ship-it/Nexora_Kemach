// removeseed.js — deletes ONLY the mock/demo data added by mockdataseed.js.
// Leaves the admin user and core/reference data (tax codes, document numbering,
// company profile, bank names, units of measure) intact.
// Safe to re-run.

require('dotenv').config();
const prisma = require('../client');

async function run() {
  console.log('Removing mock/demo data (core/reference data + admin user are preserved)...');

  // Delete in dependency order (children before parents)
  await prisma.stockTransfer.deleteMany({});
  await prisma.stockAdjustment.deleteMany({});
  await prisma.stockIssue.deleteMany({});
  await prisma.stockReceipt.deleteMany({});
  await prisma.cheque.deleteMany({});
  await prisma.bankReconciliation.deleteMany({});
  await prisma.bankDeposit.deleteMany({});
  await prisma.paymentReceipt.deleteMany({});
  await prisma.paymentVoucher.deleteMany({});
  await prisma.supplierPayment.deleteMany({});
  await prisma.supplierOutstanding.deleteMany({});
  await prisma.collection.deleteMany({});
  await prisma.customerOutstanding.deleteMany({});
  await prisma.salesInvoice.deleteMany({});
  await prisma.deliveryChallan.deleteMany({});
  await prisma.salesOrder.deleteMany({});
  await prisma.salesQuotation.deleteMany({});
  await prisma.purchaseInvoice.deleteMany({});
  await prisma.purchasePrice.deleteMany({});
  await prisma.goodsReceivedNote.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.purchaseQuotation.deleteMany({});
  // Customer Master / Supplier Master are retired — the demo customer/vendor
  // rows mockdataseed.js writes now live in businessPartners instead.
  await prisma.businessPartner.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.brand.deleteMany({});
  await prisma.productSubGroup.deleteMany({});
  await prisma.productGroup.deleteMany({});
  await prisma.approvalFlowLevel.deleteMany({});
  await prisma.approvalFlow.deleteMany({});
  await prisma.salesEmployee.deleteMany({});
  await prisma.houseBank.deleteMany({});
  await prisma.financialYear.deleteMany({});
  await prisma.branch.deleteMany({});

  console.log('Mock data removed. Admin user + core/reference data are untouched.');
}

run()
  .catch((err) => {
    console.error('Remove mock data error:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
