// consolidateWarehouses.js — folds the retired warehouse table into the
// surviving master.
//
//   npm run warehouse:consolidate
//   npm run warehouse:consolidate -- --dry-run
//
// The application carried TWO warehouse masters that duplicated each other:
//
//   [dbo].[warehouses]  (Prisma: Warehouse)        code / name / location
//   [dbo].[warehouse]   (Prisma: WarehouseMaster)  the rich master imported
//                                                  from Master Data.xlsx
//
// Warehouse dropdowns across the app were sourced from four unrelated places —
// those two tables, the Branch master, and the distinct free-text values of
// Product.defaultLocation — so no two screens offered the same list. The rich
// master is now the single source, because it holds the real data and is what
// stock documents already reference.
//
// This script makes that switch safe: any warehouse that exists ONLY in the
// retired table is copied across, so nothing disappears from the dropdowns when
// the old table stops being read. It does not delete anything, and it does not
// overwrite a warehouse that already exists in the master — a warehouse present
// in both is left exactly as the master has it, because the master's row is the
// richer and more current of the two.
//
// Safe to re-run: a second run finds nothing left to copy and reports zero.

require('dotenv').config();
// '../prisma/client' — this script lives in src/scripts/, one level above the
// seed scripts in src/prisma/seed/ that use the shorter '../client'.
const prisma = require('../prisma/client');

const DRY_RUN = process.argv.includes('--dry-run');

/**
 * The retired table's location field is a free-text location NAME, while the
 * master keys location by CODE. There is no reliable mapping between them, so
 * the value is carried into `city` — where it is at least visible and
 * correctable — rather than being forced into locationCode, which would
 * fabricate a reference to a Location Master row that may not exist.
 */
function toMasterRow(old) {
  return {
    whsCode: old.warehouseCode,
    whsName: old.warehouseName,
    city: old.warehouseLocation || null,
    branch: old.branch || null,
    status: old.status || 'Active',
  };
}

async function run() {
  const [legacy, master] = await Promise.all([
    prisma.warehouse.findMany(),
    prisma.warehouseMaster.findMany({ select: { whsCode: true } }),
  ]);

  const inMaster = new Set(master.map((m) => String(m.whsCode).trim().toUpperCase()));

  console.log(`Retired table [warehouses]: ${legacy.length} row(s).`);
  console.log(`Surviving master [warehouse]: ${master.length} row(s).`);

  const missing = legacy.filter((w) => !inMaster.has(String(w.warehouseCode).trim().toUpperCase()));
  const alreadyThere = legacy.length - missing.length;

  if (alreadyThere > 0) {
    console.log(`${alreadyThere} already present in the master — left untouched.`);
  }
  if (missing.length === 0) {
    console.log('\nNothing to copy. The master already covers every retired warehouse.');
    return;
  }

  console.log(`\n${missing.length} warehouse(s) exist only in the retired table:`);
  missing.forEach((w) => console.log(`  ${w.warehouseCode} — ${w.warehouseName}`));

  if (DRY_RUN) {
    console.log('\n--dry-run: nothing was written.');
    return;
  }

  let copied = 0;
  const failures = [];
  for (const old of missing) {
    try {
      await prisma.warehouseMaster.create({ data: toMasterRow(old) });
      copied += 1;
    } catch (err) {
      // Reported rather than thrown: one bad row (a code longer than the
      // master's column, say) must not abandon the rest half-copied.
      failures.push({ code: old.warehouseCode, message: err.message });
    }
  }

  console.log(`\nCopied ${copied} warehouse(s) into the master.`);
  if (failures.length) {
    console.warn(`${failures.length} could not be copied:`);
    failures.forEach((f) => console.warn(`  ${f.code}: ${f.message}`));
    process.exitCode = 1;
    return;
  }

  console.log('\nThe retired table has NOT been deleted — its rows are still there.');
  console.log('Check Company Setup > Warehouse Master looks right before dropping it.');
}

run()
  .catch((err) => {
    console.error('Warehouse consolidation failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
