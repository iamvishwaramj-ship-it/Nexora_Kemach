// consolidateLocations.js — folds the retired location table into the
// surviving master.
//
//   npm run location:consolidate
//   npm run location:consolidate -- --dry-run
//
// Same duplication the warehouses had (see consolidateWarehouses.js):
//
//   [dbo].[locations]        (Prisma: Location)        what Company Setup >
//                                                      Location Master wrote to
//   [dbo].[location_master]  (Prisma: LocationMaster)  what the Warehouse
//                                                      Master's Location
//                                                      dropdown read from
//
// Those being different tables is why a location added on the Location Master
// page never appeared when adding a warehouse — the page filled one table and
// the dropdown read the other. The rich master is now the single source, for
// the same reason it won for warehouses: WarehouseMaster.locationCode already
// references its codes.
//
// This copies across any location that exists ONLY in the retired table, so
// nothing disappears from the dropdown once the old table stops being read. It
// deletes nothing, and it does not overwrite a location already in the master.
//
// It also reports any location a warehouse points at that is missing from the
// master entirely — those are the ones that will show as an unrecognised code
// on the Warehouse Master form, and no script can invent them.
//
// It writes to exactly one table: [dbo].[location_master]. The retired table is
// read and never modified, and no numbering counter is touched — location codes
// are plain running integers computed on the Location Master page, not drawn
// from the LOC series.
//
// Safe to re-run.

require('dotenv').config();
// '../prisma/client' — this script lives in src/scripts/, one level above the
// seed scripts in src/prisma/seed/ that use the shorter '../client'.
const prisma = require('../prisma/client');

const DRY_RUN = process.argv.includes('--dry-run');

/**
 * The two tables agree on everything except names: the retired one keys on
 * `locationCode`, the master on `code`. regType has no counterpart in the
 * retired table and is left null rather than guessed.
 */
function toMasterRow(old) {
  return {
    code: old.locationCode,
    locationName: old.locationName,
    panNo: old.panNo || null,
    eccNo: old.eccNo || null,
    gstRegistrationNo: old.gstRegistrationNo || null,
    status: old.status || 'Active',
  };
}

const key = (v) => String(v ?? '').trim().toUpperCase();

async function run() {
  const [legacy, master, warehouses] = await Promise.all([
    prisma.location.findMany(),
    prisma.locationMaster.findMany({ select: { code: true } }),
    prisma.warehouseMaster.findMany({ select: { whsCode: true, whsName: true, locationCode: true } }),
  ]);

  const inMaster = new Set(master.map((m) => key(m.code)));

  console.log(`Retired table [locations]: ${legacy.length} row(s).`);
  console.log(`Surviving master [location_master]: ${master.length} row(s).`);

  const missing = legacy.filter((l) => !inMaster.has(key(l.locationCode)));
  const alreadyThere = legacy.length - missing.length;
  if (alreadyThere > 0) {
    console.log(`${alreadyThere} already present in the master — left untouched.`);
  }

  let copied = 0;
  const failures = [];

  if (missing.length === 0) {
    console.log('\nNothing to copy. The master already covers every retired location.');
  } else {
    console.log(`\n${missing.length} location(s) exist only in the retired table:`);
    missing.forEach((l) => console.log(`  ${l.locationCode} — ${l.locationName}`));

    if (DRY_RUN) {
      console.log('\n--dry-run: nothing was written.');
    } else {
      for (const old of missing) {
        try {
          await prisma.locationMaster.create({ data: toMasterRow(old) });
          copied += 1;
        } catch (err) {
          // Reported rather than thrown: one bad row must not abandon the rest
          // half-copied.
          failures.push({ code: old.locationCode, message: err.message });
        }
      }
      console.log(`\nCopied ${copied} location(s) into the master.`);
    }
  }

  // Anything a warehouse points at that no longer resolves. Reported, never
  // fabricated — a location row invented from nothing but a code would carry no
  // PAN, ECC or GST registration, and would look authoritative while being
  // empty.
  const knownAfter = new Set([
    ...inMaster,
    ...(DRY_RUN ? missing : missing.slice(0, copied)).map((l) => key(l.locationCode)),
  ]);
  const dangling = warehouses.filter(
    (w) => w.locationCode && !knownAfter.has(key(w.locationCode)),
  );
  if (dangling.length) {
    console.warn(`\n${dangling.length} warehouse(s) point at a location that is not in the master:`);
    dangling.forEach((w) => console.warn(`  ${w.whsCode} — ${w.whsName}  ->  ${w.locationCode}`));
    console.warn('These show as an unrecognised code on the Warehouse Master form.');
    console.warn('Add them under Company Setup > Location Master, or repoint those warehouses.');
  }

  if (failures.length) {
    console.warn(`\n${failures.length} could not be copied:`);
    failures.forEach((f) => console.warn(`  ${f.code}: ${f.message}`));
    process.exitCode = 1;
    return;
  }

  if (!DRY_RUN && copied > 0) {
    console.log('\nThe retired table has NOT been deleted — its rows are still there.');
    console.log('Check Company Setup > Location Master looks right before dropping it.');
  }
}

run()
  .catch((err) => {
    console.error('Location consolidation failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
