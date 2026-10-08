// listOutstanding.js — read-only diagnostic. Prints every row currently in
// customer_outstanding and supplier_outstanding, plus every real Sales
// Invoice / Purchase Invoice invoice number, so a mismatch between "2 Sales
// Invoices but 16 Customer Outstanding rows" can actually be diagnosed
// instead of guessed at. Makes no changes to the database.
//
// Run with: node src/prisma/seed/listOutstanding.js

require('dotenv').config();
const prisma = require('../client');

async function run() {
  const [salesInvoices, customerOutstanding, purchaseInvoices, supplierOutstanding] = await Promise.all([
    prisma.salesInvoice.findMany({ select: { invoiceNo: true, customer: true, status: true, amount: true } }),
    prisma.customerOutstanding.findMany({ orderBy: { id: 'asc' } }),
    prisma.purchaseInvoice.findMany({ select: { invoiceNo: true, supplier: true, status: true, amount: true } }),
    prisma.supplierOutstanding.findMany({ orderBy: { id: 'asc' } }),
  ]);

  console.log('=== Sales Invoices (%d) ===', salesInvoices.length);
  salesInvoices.forEach((r) => console.log(`  ${r.invoiceNo}  | ${r.customer}  | status=${r.status}  | amount=${r.amount}`));

  console.log('\n=== customer_outstanding rows (%d) ===', customerOutstanding.length);
  const salesInvoiceNos = new Set(salesInvoices.map((r) => r.invoiceNo));
  customerOutstanding.forEach((r) => {
    const matches = r.invoiceNo && salesInvoiceNos.has(r.invoiceNo);
    console.log(`  id=${r.id}  invoiceNo=${r.invoiceNo}  customerName=${r.customerName}  balance=${r.balanceAmount}  status=${r.status}  ${matches ? '' : '<-- NO MATCHING SALES INVOICE'}`);
  });

  console.log('\n=== Purchase Invoices (%d) ===', purchaseInvoices.length);
  purchaseInvoices.forEach((r) => console.log(`  ${r.invoiceNo}  | ${r.supplier}  | status=${r.status}  | amount=${r.amount}`));

  console.log('\n=== supplier_outstanding rows (%d) ===', supplierOutstanding.length);
  const purchaseInvoiceNos = new Set(purchaseInvoices.map((r) => r.invoiceNo));
  supplierOutstanding.forEach((r) => {
    const matches = r.invoiceNo && purchaseInvoiceNos.has(r.invoiceNo);
    console.log(`  id=${r.id}  invoiceNo=${r.invoiceNo}  supplierName=${r.supplierName}  balance=${r.balanceAmount}  status=${r.status}  ${matches ? '' : '<-- NO MATCHING PURCHASE INVOICE'}`);
  });
}

run()
  .catch((err) => {
    console.error('List error:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
