/**
 * Ensures every master document type (Branch, Tax Code, Sales Employee,
 * Product Group, Product Sub Group, Brand, Unit of Measure, Product,
 * Customer, Supplier, Transporter) has its perpetual
 * numbering series row, independent of whether migration
 * 20260809090000_master_code_numbering has actually run against this
 * database.
 *
 * Why this exists: that migration inserts the twelve rows with
 * `financial_year_id IS NULL` via `WHERE NOT EXISTS`, so it's normally
 * enough on its own. But a database that was migrated before that file was
 * added — or where the migrations table and the actual schema drifted for
 * any other reason — can be missing one or all of these rows even though
 * `prisma migrate status` reports nothing pending. When that happens,
 * DocumentNoField's peek on the Branch/Tax Code/... pages fails with
 * DocumentNumberError SERIES_NOT_FOUND, because resolveSeries() has nothing
 * to resolve to.
 *
 * Safe to run any number of times: it only creates a series for a master
 * code that has none yet (`financialYearId: null`), it never touches an
 * existing perpetual series or any transaction (FY-scoped) series.
 *
 *   node src/scripts/seedMasterCodeNumbering.js
 */
const prisma = require('../prisma/client');
const { DOCUMENT_CATALOG, isMasterScope } = require('../services/documentNumberService');

async function main() {
  const masters = DOCUMENT_CATALOG.filter((d) => isMasterScope(d.code));
  let created = 0;

  for (const def of masters) {
    const existing = await prisma.documentNumbering.findFirst({
      where: { documentCode: def.code, financialYearId: null },
    });
    if (existing) {
      console.log(`skip  ${def.code} (${def.name}) — series already exists`);
      continue;
    }

    await prisma.documentNumbering.create({
      data: {
        documentCode: def.code,
        documentName: def.name,
        seriesName: 'Series 1',
        isDefault: true,
        financialYearId: null,
        fyCode: null,
        prefix: def.prefix,
        suffix: null,
        separator: '-',
        includeFyInNumber: false,
        numberLength: 6,
        startNumber: 1,
        currentNumber: null,
        nextNumber: 1,
        endNumber: 999999,
        resetEveryFy: false,
        autoGenerate: true,
        manualEntry: false,
        status: 'Active',
      },
    });
    created += 1;
    console.log(`created ${def.code} (${def.name}) — Series 1, ${def.prefix}-000001..999999`);
  }

  console.log(`\nDone. ${created} series created, ${masters.length - created} already present.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
