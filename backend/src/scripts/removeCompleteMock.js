// removeCompleteMock.js — FULL DESTRUCTIVE RESET, except two menus.
//
//   npm run removecompletemock
//   npm run removecompletemock -- --yes     (skip the typed confirmation, e.g. CI)
//   npm run removecompletemock -- --dry-run (print the plan, delete nothing)
//
// Deletes every row from every table in the application EXCEPT the tables that
// back:
//
//   1. Login/User Management  (AppUser, UserPermission, UserBranch, RefreshToken)
//      — not a menu the request named, but kept so the app is still usable
//        (loginable) after the reset. See PRESERVE_GROUPS below to change this.
//   2. Company Setup           — every submenu under that sidebar item
//   3. Accounting              — every submenu under that sidebar item
//
// Everything else — Product/Partner masters, Purchase/Sales/Inventory
// documents, Receivables/Payables/Banking, the stock ledger, Enquiry/Follow-up
// — is truncated (via DELETE, not TRUNCATE: several of these tables are
// referenced by FOREIGN KEY constraints, which SQL Server refuses to TRUNCATE
// through even when the constraint is disabled).
//
// Deletion order is children-before-parents throughout (see the numbered
// layers below), matching the same "delete in dependency order" approach
// already used by wipetable.js and removeseed.js in this folder — proven
// against this exact schema, so no raw NOCHECK CONSTRAINT juggling is needed.
// After each table, its auto-increment identity is reseeded to 0 (SQL
// Server's DBCC CHECKIDENT) so new rows start at 1 again, same as a real
// TRUNCATE would leave it — wrapped in try/catch since a handful of tables
// key off a business code rather than an identity column.
//
// Irreversible. Safe to re-run (a second run finds nothing left and reports
// zero everywhere).

require('dotenv').config();
const readline = require('node:readline');
// This script lives in src/scripts/, one level above the seed scripts in
// src/prisma/seed/ that use the shorter '../client' — same convention as
// consolidateWarehouses.js / consolidateLocations.js in this same folder.
const prisma = require('../prisma/client');

const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_PROMPT = process.argv.includes('--yes');
const CONFIRM_PHRASE = 'DELETE ALL MOCK DATA';

// ---------------------------------------------------------------------------
// What is PRESERVED — grouped the way the sidebar groups them, so the printed
// plan reads the same as the menu the user is protecting.
// ---------------------------------------------------------------------------
const PRESERVE_GROUPS = {
  'Login / User Management (kept so the app stays usable — not a named menu)': [
    'appUser', 'userPermission', 'userBranch', 'refreshToken',
  ],
  'Company Setup': [
    'companyDetails', 'branch', 'financialYear', 'documentNumbering', 'taxCode',
    'bankName', 'houseBank', 'salesEmployee', 'approvalFlow', 'approvalFlowLevel',
    'departmentMaster', 'locationMaster', 'warehouseMaster',
  ],
  Accounting: [
    'accountGroup', 'accountType', 'chartOfAccount', 'glAccountDetermination',
    'journalEntry', 'journalEntryLine',
  ],
};

// ---------------------------------------------------------------------------
// What is TRUNCATED — every remaining table, ordered children-first so no
// FOREIGN KEY constraint is ever violated regardless of ON DELETE action.
//
// Layer 1: leaf/junction rows that reference an Item-level row.
// Layer 2: document Item (line) tables.
// Layer 3: document header tables (their Item children are already gone).
// Layer 4: standalone masters/ledgers with no dependents left.
// ---------------------------------------------------------------------------
const TRUNCATE_LAYERS = [
  // --- Layer 1 -------------------------------------------------------------
  ['batchAllocation', 'BatchAllocation'],
  ['serialAllocation', 'SerialAllocation'],
  ['productBatch', 'ProductBatch'],
  ['productSerial', 'ProductSerial'],
  ['collectionInvoiceApplication', 'CollectionInvoiceApplication'],
  ['paymentInvoiceApplication', 'PaymentInvoiceApplication'],
  ['paymentReceiptApplication', 'PaymentReceiptApplication'],
  ['paymentVoucherApplication', 'PaymentVoucherApplication'],
  ['bankReconciliationTransaction', 'BankReconciliationTransaction'],
  ['chequeInvoiceApplication', 'ChequeInvoiceApplication'],
  ['depositItem', 'DepositItem'],
  ['followUp', 'FollowUp'],
  ['businessPartnerContact', 'BusinessPartnerContact'],
  ['businessPartnerAddress', 'BusinessPartnerAddress'],
  ['stock', 'Stock'],
  ['openingBalance', 'OpeningBalance'],

  // --- Layer 2: document lines ----------------------------------------------
  ['goodsReceivedNoteItem', 'GoodsReceivedNoteItem'],
  ['stockReceiptItem', 'StockReceiptItem'],
  ['deliveryChallanItem', 'DeliveryChallanItem'],
  ['stockIssueItem', 'StockIssueItem'],
  ['stockAdjustmentItem', 'StockAdjustmentItem'],
  ['purchaseReturnItem', 'PurchaseReturnItem'],
  ['purchaseCreditMemoItem', 'PurchaseCreditMemoItem'],
  ['salesReturnItem', 'SalesReturnItem'],
  ['salesCreditMemoItem', 'SalesCreditMemoItem'],
  ['stockTransferItem', 'StockTransferItem'],
  ['purchaseQuotationItem', 'PurchaseQuotationItem'],
  ['purchaseOrderItem', 'PurchaseOrderItem'],
  ['purchaseInvoiceItem', 'PurchaseInvoiceItem'],
  ['salesQuotationItem', 'SalesQuotationItem'],
  ['salesOrderItem', 'SalesOrderItem'],
  ['salesInvoiceItem', 'SalesInvoiceItem'],

  // --- Layer 3: document headers --------------------------------------------
  ['goodsReceivedNote', 'GoodsReceivedNote'],
  ['stockReceipt', 'StockReceipt'],
  ['deliveryChallan', 'DeliveryChallan'],
  ['stockIssue', 'StockIssue'],
  ['stockAdjustment', 'StockAdjustment'],
  ['purchaseReturn', 'PurchaseReturn'],
  ['purchaseCreditMemo', 'PurchaseCreditMemo'],
  ['salesReturn', 'SalesReturn'],
  ['salesCreditMemo', 'SalesCreditMemo'],
  ['stockTransfer', 'StockTransfer'],
  ['purchaseQuotation', 'PurchaseQuotation'],
  ['purchaseOrder', 'PurchaseOrder'],
  ['purchaseInvoice', 'PurchaseInvoice'],
  ['salesQuotation', 'SalesQuotation'],
  ['salesOrder', 'SalesOrder'],
  ['salesInvoice', 'SalesInvoice'],
  ['collection', 'Collection'],
  ['supplierPayment', 'SupplierPayment'],
  ['paymentReceipt', 'PaymentReceipt'],
  ['paymentVoucher', 'PaymentVoucher'],
  ['bankReconciliation', 'BankReconciliation'],
  ['cheque', 'Cheque'],
  ['bankDeposit', 'BankDeposit'],
  ['enquiry', 'Enquiry'],

  // --- Layer 4: standalone masters/ledgers ----------------------------------
  ['customerOutstanding', 'CustomerOutstanding'],
  ['supplierOutstanding', 'SupplierOutstanding'],
  ['purchasePrice', 'PurchasePrice'],
  ['salesPrice', 'SalesPrice'],
  ['customerDiscount', 'CustomerDiscount'],
  ['product', 'Product'],
  ['productGroup', 'ProductGroup'],
  ['productSubGroup', 'ProductSubGroup'],
  ['brand', 'Brand'],
  ['uom', 'Uom'],
  ['currencyMaster', 'CurrencyMaster'],
  ['hsnMaster', 'HsnMaster'],
  ['transport', 'Transport'],
  ['businessPartner', 'BusinessPartner'],
  // Retired legacy masters (superseded by WarehouseMaster/LocationMaster,
  // which ARE preserved above) — kept here only because old rows may still
  // exist in these tables; see schema.prisma's notes on Warehouse/Location.
  ['warehouse', 'Warehouse'],
  ['location', 'Location'],
];

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer);
  }));
}

function printPlan() {
  console.log('='.repeat(78));
  console.log('removeCompleteMock — full reset EXCEPT Company Setup and Accounting');
  console.log('='.repeat(78));
  console.log('\nPRESERVED (left untouched):\n');
  for (const [group, models] of Object.entries(PRESERVE_GROUPS)) {
    console.log(`  ${group}:`);
    console.log(`    ${models.join(', ')}`);
  }
  console.log(`\nTRUNCATED (${TRUNCATE_LAYERS.length} tables, every row deleted):\n`);
  console.log(`    ${TRUNCATE_LAYERS.map(([, label]) => label).join(', ')}`);
  console.log('');
}

/** Best-effort identity reseed so the next inserted row starts at 1 again. */
async function reseedIdentity(delegateName) {
  const table = TRUNCATE_LAYERS.find(([d]) => d === delegateName);
  if (!table) return;
  try {
    // dbgenerated table name comes from the model's own @@map in schema.prisma
    // and is not always identical to the delegate name, so ask Prisma's DMMF
    // for it rather than guessing.
    const { Prisma } = require('@prisma/client');
    const model = Prisma.dmmf.datamodel.models.find(
      (m) => m.name.charAt(0).toLowerCase() + m.name.slice(1) === delegateName,
    );
    const dbName = model?.dbName || delegateName;
    await prisma.$executeRawUnsafe(`DBCC CHECKIDENT ('[dbo].[${dbName}]', RESEED, 0);`);
  } catch {
    // No identity column on this table (or it's keyed by a business code) —
    // nothing to reseed, not an error.
  }
}

async function run() {
  printPlan();

  if (DRY_RUN) {
    console.log('--dry-run: nothing was deleted.');
    return;
  }

  if (!SKIP_PROMPT) {
    const answer = await ask(
      `This permanently deletes ALL data in the ${TRUNCATE_LAYERS.length} tables listed above.\n`
      + `Type "${CONFIRM_PHRASE}" to proceed, anything else to cancel: `,
    );
    if (answer.trim() !== CONFIRM_PHRASE) {
      console.log('Cancelled. Nothing was deleted.');
      return;
    }
  }

  console.log('\nDeleting...\n');
  let totalDeleted = 0;
  for (const [delegateName, label] of TRUNCATE_LAYERS) {
    if (!prisma[delegateName]) {
      console.log(`  skip   ${label} (model not present on this Prisma Client — schema drift?)`);
      continue;
    }
    const { count } = await prisma[delegateName].deleteMany({});
    await reseedIdentity(delegateName);
    totalDeleted += count;
    console.log(`  ${String(count).padStart(6)} row(s)  ${label}`);
  }

  console.log(`\nDone. ${totalDeleted} row(s) deleted across ${TRUNCATE_LAYERS.length} tables.`);
  console.log('Company Setup, Accounting, and login/user data are untouched.');
}

run()
  .catch((err) => {
    console.error('\nremoveCompleteMock error:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
