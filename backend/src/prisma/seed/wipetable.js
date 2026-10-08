// wipetable.js — FULL DESTRUCTIVE RESET. Deletes every row from every table,
// including the admin user and all reference/config data. Irreversible.
// Requires an explicit --yes flag: `node wipetable.js --yes`

require('dotenv').config();
const prisma = require('../client');

async function run() {
  if (!process.argv.includes('--yes')) {
    console.error('Refusing to wipe the database without confirmation.');
    console.error('Re-run with: node wipetable.js --yes');
    process.exitCode = 1;
    return;
  }

  console.log('WIPING ALL DATA — this cannot be undone...');

  await prisma.refreshToken.deleteMany({});
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
  // Customer Master / Supplier Master are retired — replaced by
  // businessPartners (BusinessPartnerContact/Address cascade with it).
  await prisma.businessPartner.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.brand.deleteMany({});
  await prisma.productSubGroup.deleteMany({});
  await prisma.productGroup.deleteMany({});
  await prisma.uom.deleteMany({});
  await prisma.approvalFlowLevel.deleteMany({});
  await prisma.approvalFlow.deleteMany({});
  await prisma.salesEmployee.deleteMany({});
  await prisma.houseBank.deleteMany({});
  await prisma.bankName.deleteMany({});
  await prisma.documentNumbering.deleteMany({});
  await prisma.taxCode.deleteMany({});
  await prisma.financialYear.deleteMany({});
  await prisma.branch.deleteMany({});
  await prisma.companyDetails.deleteMany({});
  await prisma.appUser.deleteMany({});

  console.log('All tables wiped.');
}

run()
  .catch((err) => {
    console.error('Wipe error:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
