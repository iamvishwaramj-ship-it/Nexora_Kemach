// removeWarehouses.js — deletes ALL rows from Warehouse Master (table
// "warehouse", the table Company Setup > Warehouse Master reads/writes —
// see the retirement note on the legacy `Warehouse` model, @@map("warehouses"),
// in schema.prisma; that duplicate table is untouched by this script).
//
// OpeningBalance.warehouseRef is a real, required foreign key into
// WarehouseMaster.whsCode (see schema.prisma), so a warehouse with Opening
// Balance rows against it cannot be deleted while they exist. This script
// deletes those Opening Balance rows first — there is no way to keep an
// Opening Balance row once the warehouse it belongs to is gone.
//
// Every other module that references a warehouse (Stock Receipt/Issue/
// Adjustment/Transfer, GRN, Purchase/Sales Invoice, Delivery Challan, ...)
// stores the warehouse CODE as a plain string, not a foreign key — the same
// by-code/by-name convention used everywhere else in this schema so a
// rename never silently rewrites history. Deleting Warehouse Master rows
// does NOT touch those documents; their warehouse column just becomes a
// code that no longer resolves to a live warehouse (the same state a
// deactivated warehouse already leaves behind).
//
// Requires an explicit --yes flag: `node removeWarehouses.js --yes`

require('dotenv').config();
const prisma = require('../client');

async function run() {
  if (!process.argv.includes('--yes')) {
    console.error('Refusing to delete Warehouse Master data without confirmation.');
    console.error('Re-run with: node removeWarehouses.js --yes');
    process.exitCode = 1;
    return;
  }

  const warehouseCount = await prisma.warehouseMaster.count();
  const openingBalanceCount = await prisma.openingBalance.count();

  if (warehouseCount === 0) {
    console.log('Warehouse Master is already empty — nothing to do.');
    return;
  }

  console.log(`Deleting ${warehouseCount} warehouse(s)` +
    (openingBalanceCount > 0 ? ` and ${openingBalanceCount} dependent Opening Balance row(s)...` : '...'));

  // Children before parent: Opening Balance's FK into Warehouse Master
  // blocks the warehouse delete below until its rows are gone.
  await prisma.openingBalance.deleteMany({});
  await prisma.warehouseMaster.deleteMany({});

  console.log('Warehouse Master cleared.');
}

run()
  .catch((err) => {
    console.error('Remove warehouses error:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
