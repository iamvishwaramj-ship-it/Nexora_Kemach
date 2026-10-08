/**
 * Advances each master's perpetual numbering series (Branch/Tax Code/Sales
 * Employee/Product Group/Product Sub Group/Brand/Unit of Measure/Product/
 * Customer/Supplier/Transporter) past whatever codes already
 * exist in that master's own table.
 *
 * Why this exists: resolveSeries() in documentNumberService.js self-heals a
 * *missing* master series by creating one and backfilling its counter from
 * existing data. But a series that already exists with a stale counter (for
 * example: it was created — by an earlier version of that self-heal, by
 * seedMasterCodeNumbering.js, or by the original migration — before some
 * records were imported/seeded into the master table) is left alone by
 * design; the self-heal only ever fires when there's no series at all. This
 * script is the manual remedy for that already-exists-but-stale case: it
 * finds every master's default series and moves nextNumber forward to one
 * past the highest numeric code already in that table, exactly like
 * scripts/backfillNumberingCounters.js does for the 16 transaction
 * documents (which this script deliberately does not touch).
 *
 * Symptom this fixes: "Add Tax Code" (or any other master) keeps offering a
 * code that's already taken, e.g. suggesting TAX-000001 again when a
 * TAX-000001 tax code already exists.
 *
 *   node src/scripts/backfillMasterCodeCounters.js            # dry run (default)
 *   node src/scripts/backfillMasterCodeCounters.js --apply    # actually write
 */
const prisma = require('../prisma/client');
const { DOCUMENT_CATALOG, isMasterScope, highestExistingMasterNumber } = require('../services/documentNumberService');

const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(APPLY ? 'Running in APPLY mode — counters will be updated.' : 'Running in DRY-RUN mode — no writes. Pass --apply to write.');
  console.log('');

  const masters = DOCUMENT_CATALOG.filter((d) => isMasterScope(d.code));
  const report = [];

  for (const def of masters) {
    const series = await prisma.documentNumbering.findFirst({
      where: { documentCode: def.code, financialYearId: null, isDefault: true },
    });

    if (!series) {
      report.push({ code: def.code, name: def.name, status: 'skipped', reason: 'no series yet — resolveSeries() will create one on first use' });
      continue;
    }

    const highest = await highestExistingMasterNumber(def.code, prisma);
    const proposedNext = highest + 1;

    if (proposedNext <= series.nextNumber) {
      report.push({ code: def.code, name: def.name, status: 'no-op', reason: `series is already ahead (nextNumber=${series.nextNumber}, highest existing=${highest})` });
      continue;
    }

    if (proposedNext > series.endNumber + 1) {
      report.push({
        code: def.code, name: def.name, status: 'NEEDS ATTENTION',
        reason: `highest existing code (${highest}) is beyond this series' End No. (${series.endNumber}) — extend the range before this series can be used safely`,
      });
      continue;
    }

    if (series.currentNumber !== null && series.currentNumber !== undefined) {
      report.push({ code: def.code, name: def.name, status: 'no-op', reason: `series has already issued numbers through the engine (currentNumber=${series.currentNumber}) — leaving it alone` });
      continue;
    }

    report.push({ code: def.code, name: def.name, status: APPLY ? 'ADVANCED' : 'WOULD ADVANCE', reason: `nextNumber ${series.nextNumber} -> ${proposedNext} (highest existing code found: ${highest})` });

    if (APPLY) {
      await prisma.documentNumbering.update({ where: { id: series.id }, data: { nextNumber: proposedNext } });
    }
  }

  console.log('Code  Name                Status           Detail');
  console.log('----  ------------------  ---------------  ------');
  for (const r of report) {
    console.log(`${r.code.padEnd(6)}${r.name.padEnd(20)}${r.status.padEnd(17)}${r.reason}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
