#!/usr/bin/env node
/**
 * Finds (and, with --yes, repairs) document_numbering rows for master-scope
 * document types — Branch, Tax Code, Sales Employee, Account Group, Account
 * Type, Chart Of Accounts, Product Group, Product Sub Group, Brand, Unit of
 * Measure, Product, Transporter, Warehouse, Location, Bank Details — that
 * were saved with a real financial_year_id instead of NULL.
 *
 * A master series is supposed to be perpetual: financial_year_id IS NULL,
 * reset_every_fy = 0, include_fy_in_number = 0 (see the 'master' scope doc
 * comment on DOCUMENT_CATALOG in services/documentNumberService.js).
 * resolveDocumentNumber()/resolveSeries() always look up a master series by
 * `financialYearId: null` — a row with a real FY id is never read by actual
 * number allocation no matter what it shows. It is dead data that most likely
 * only existed to be visible in the Document Numbering admin table, because
 * GET /document-numbers used to filter strictly by the selected financial
 * year and so could never show the real perpetual row (that filter is now
 * fixed in routes/company.js to include master rows regardless of the
 * selected year).
 *
 * Left in place, a stray row like this collides with the real perpetual row
 * the moment anyone edits either one: both default to the same seriesName
 * ("Series 1") and range (1-999999), so validateSeriesPayload's sibling-
 * overlap check rejects the save with "A series named 'Series 1' already
 * exists ... overlaps series 'Series 1' (1-999999)".
 *
 * For each master document code this reports every stray row found, and:
 *   - if no perpetual (financial_year_id IS NULL) row exists yet for that
 *     code, converts the stray in place (financialYearId/fyCode -> null,
 *     resetEveryFy/includeFyInNumber -> false) instead of losing its
 *     prefix/range/counter;
 *   - if a perpetual row already exists and the stray has never issued a
 *     number (current_number IS NULL), deletes the stray — it is redundant,
 *     since the perpetual row is the one actually used for allocation;
 *   - if the stray HAS already issued numbers, it is left untouched and
 *     flagged for manual review rather than silently deleted or merged.
 *
 * Usage:
 *   node src/scripts/repairMasterNumberingScope.js            (dry run — report only, default)
 *   node src/scripts/repairMasterNumberingScope.js --yes      (apply the fixes described above)
 */

const prisma = require('../prisma/client');
const { DOCUMENT_CATALOG } = require('../services/documentNumberService');

const EXECUTE = process.argv.includes('--yes');

async function main() {
  const masterCodes = DOCUMENT_CATALOG.filter((d) => d.scope === 'master').map((d) => d.code);

  let strayTotal = 0;
  let fixedTotal = 0;
  let flaggedTotal = 0;

  for (const code of masterCodes) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await prisma.documentNumbering.findMany({
      where: { documentCode: code },
      orderBy: { id: 'asc' },
    });
    const strays = rows.filter((r) => r.financialYearId !== null);
    const proper = rows.filter((r) => r.financialYearId === null);
    if (!strays.length) continue;

    strayTotal += strays.length;
    console.log(`\n[${code}] ${rows.length} row(s) total — ${strays.length} stray (financial_year_id set), ${proper.length} perpetual (financial_year_id NULL).`);

    for (const stray of strays) {
      const issued = stray.currentNumber != null;

      if (!proper.length) {
        console.log(`  - id=${stray.id} "${stray.seriesName}" (FY id ${stray.financialYearId}, current ${stray.currentNumber ?? '—'}) -> ${EXECUTE ? 'CONVERTING' : 'would CONVERT'} to perpetual (no perpetual row exists yet for this code).`);
        // eslint-disable-next-line no-await-in-loop
        if (EXECUTE) {
          await prisma.documentNumbering.update({
            where: { id: stray.id },
            data: { financialYearId: null, fyCode: null, resetEveryFy: false, includeFyInNumber: false },
          });
          fixedTotal++;
        }
      } else if (!issued) {
        console.log(`  - id=${stray.id} "${stray.seriesName}" (FY id ${stray.financialYearId}, never issued) -> ${EXECUTE ? 'DELETING' : 'would DELETE'} (redundant — a perpetual row already handles allocation for this code).`);
        // eslint-disable-next-line no-await-in-loop
        if (EXECUTE) {
          await prisma.documentNumbering.delete({ where: { id: stray.id } });
          fixedTotal++;
        }
      } else {
        console.log(`  ! id=${stray.id} "${stray.seriesName}" (FY id ${stray.financialYearId}, ALREADY ISSUED up to ${stray.currentNumber}) -> left untouched, needs manual review.`);
        flaggedTotal++;
      }
    }
  }

  if (!strayTotal) {
    console.log('No stray master-scope rows found. Nothing to do.');
  } else if (!EXECUTE) {
    console.log(`\n${strayTotal} stray row(s) found. Dry run only — nothing changed. Re-run with --yes to apply the fixes above.`);
  } else {
    console.log(`\n${strayTotal} stray row(s) found — ${fixedTotal} fixed, ${flaggedTotal} flagged for manual review (already issued numbers).`);
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
