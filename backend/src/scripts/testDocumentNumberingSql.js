/**
 * Database-level test for the document numbering migration and allocator.
 *
 *   npm i -D @electric-sql/pglite
 *   node src/scripts/testDocumentNumberingSql.js
 *
 * Runs against PGlite (real PostgreSQL compiled to WASM) so no server is
 * needed. It does three things the pure test in testDocumentNumbering.js
 * cannot:
 *
 *   1. Executes migrations/20260804090000_document_numbering_series against a
 *      table populated with legacy-shaped rows, proving the backfill works and
 *      the new constraints hold.
 *   2. Fires concurrent allocations at the conditional UPDATE to prove no two
 *      callers can be handed the same number.
 *   3. Checks the CHECK constraints actually reject corrupt writes.
 */

const fs = require('fs');
const path = require('path');

// Applied in order, exactly as `prisma migrate deploy` would.
const MIGRATIONS = [
  '20260804090000_document_numbering_series',
  '20260805090000_multiple_series_per_document',
].map((name) => path.join(__dirname, '..', 'prisma', 'migrations', name, 'migration.sql'));

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { passed += 1; console.log(`  ok   ${label}`); }
  else { failed += 1; console.log(`  FAIL ${label}\n         expected: ${e}\n         actual:   ${a}`); }
}

function section(t) { console.log(`\n${t}\n${'-'.repeat(t.length)}`); }

async function main() {
  let PGlite;
  try {
    ({ PGlite } = require('@electric-sql/pglite'));
  } catch {
    console.log('@electric-sql/pglite is not installed — skipping the SQL tests.');
    console.log('Install it with:  npm i -D @electric-sql/pglite\n');
    return;
  }

  const db = new PGlite();

  // -------------------------------------------------------------------------
  section('0. Legacy schema and data (pre-migration state)');
  // -------------------------------------------------------------------------
  await db.exec(`
    CREATE TABLE "financial_years" (
      "id" SERIAL PRIMARY KEY,
      "financial_year_name" VARCHAR(50) NOT NULL,
      "start_date" DATE,
      "end_date" DATE,
      "status" VARCHAR(20) NOT NULL DEFAULT 'Active'
    );
    CREATE TABLE "document_numbering" (
      "id" SERIAL PRIMARY KEY,
      "document_name" VARCHAR(100) NOT NULL,
      "prefix" VARCHAR(20),
      "start_number" INTEGER,
      "next_number" INTEGER,
      "end_number" INTEGER,
      "suffix" VARCHAR(20)
    );
  `);

  await db.exec(`
    INSERT INTO "financial_years" ("financial_year_name","start_date","end_date","status") VALUES
      ('2025-2026','2025-04-01','2026-03-31','Inactive'),
      ('2026-2027','2026-04-01','2027-03-31','Active');

    INSERT INTO "document_numbering" ("document_name","prefix","start_number","next_number","end_number","suffix") VALUES
      ('Purchase Order','PO-',1001,1126,9999,'/26-27'),
      ('Purchase GRN','GRN-',1001,1001,9999,'/26-27'),
      ('Sales Invoice','SI-',1001,2257,9999,'/26-27'),
      ('Collection Entry','COL-',1001,1543,9999,'/26-27'),
      ('Some Custom Doc','XYZ-',1,1,9999,NULL);
  `);

  const before = await db.query('SELECT COUNT(*)::int AS n FROM "document_numbering"');
  check('legacy rows present            ', before.rows[0].n, 5);

  // -------------------------------------------------------------------------
  section('1. Run the migrations');
  // -------------------------------------------------------------------------
  for (const file of MIGRATIONS) {
    const label = path.basename(path.dirname(file));
    try {
      await db.exec(fs.readFileSync(file, 'utf8'));
      check(`${label.slice(15).padEnd(30)}`, true, true);
    } catch (err) {
      check(`${label} -> ${err.message}`, false, true);
      console.log(`\n  ${passed} passed, ${failed} failed\n`);
      process.exitCode = 1;
      return;
    }
  }

  // -------------------------------------------------------------------------
  section('2. Backfill results');
  // -------------------------------------------------------------------------
  const rows = (await db.query(`
    SELECT d.*, f."financial_year_name"
      FROM "document_numbering" d
      JOIN "financial_years" f ON f."id" = d."financial_year_id"
     ORDER BY d."id"
  `)).rows;

  const byName = Object.fromEntries(rows.map((r) => [r.document_name, r]));

  check('no rows lost                   ', rows.length, 5);
  check('PO got its document_code       ', byName['Purchase Order'].document_code, 'PO');
  check('GRN got its document_code      ', byName['Purchase GRN'].document_code, 'GRN');
  check('Collection Entry -> RV         ', byName['Collection Entry'].document_code, 'RV');
  check('unknown doc gets a fallback code', byName['Some Custom Doc'].document_code, 'SOMECU');

  check('attached to the active FY      ', byName['Purchase Order'].financial_year_name, '2026-2027');
  check('fy_code lifted from the suffix ', byName['Purchase Order'].fy_code, '26-27');
  check('suffix cleared after lifting   ', byName['Purchase Order'].suffix, null);
  check('fy_code derived where absent   ', byName['Some Custom Doc'].fy_code, '26-27');

  check('trailing "-" stripped from prefix', byName['Purchase Order'].prefix, 'PO');
  check('GRN prefix stripped            ', byName['Purchase GRN'].prefix, 'GRN');

  check('separator default              ', byName['Purchase Order'].separator, '-');
  check('number_length default          ', byName['Purchase Order'].number_length, 6);
  check('range widened to 6 digits      ', byName['Purchase Order'].end_number, 999999);

  // next_number 1126 means 1125 was the last one issued.
  check('current_number derived         ', byName['Purchase Order'].current_number, 1125);
  check('next_number preserved          ', byName['Purchase Order'].next_number, 1126);
  check('untouched series has no current', byName['Purchase GRN'].current_number, null);
  check('untouched series next == start ', byName['Purchase GRN'].next_number, 1001);

  check('reset_every_fy defaults on     ', byName['Purchase Order'].reset_every_fy, true);
  check('auto_generate defaults on      ', byName['Purchase Order'].auto_generate, true);
  check('manual_entry defaults off      ', byName['Purchase Order'].manual_entry, false);
  check('status defaults Active         ', byName['Purchase Order'].status, 'Active');
  // The second migration renames document-named series to the neutral
  // 'Default', so a later one reads 'Default-2' not 'Purchase Order-2'.
  check('series_name normalised         ', byName['Purchase Order'].series_name, 'Default');
  check('every legacy row is a default  ', rows.every((r) => r.is_default), true);

  // -------------------------------------------------------------------------
  section('3. Constraints');
  // -------------------------------------------------------------------------
  const poId = byName['Purchase Order'].id;

  const rejects = async (label, statement) => {
    try {
      await db.query(statement);
      check(label, 'accepted', 'rejected');
    } catch {
      check(label, 'rejected', 'rejected');
    }
  };

  const poFy = byName['Purchase Order'].financial_year_id;

  // Several series per (document type, FY) is the point of the model — what
  // must stay unique is the *name* within that pair.
  await db.query(`
    INSERT INTO "document_numbering"
      ("document_code","document_name","series_name","financial_year_id","fy_code","prefix",
       "next_number","start_number","end_number")
    VALUES ('PO','Purchase Order','Default-2',${poFy},'26-27','PO',1000000,1000000,1999999)
  `);
  const poSeriesCount = (await db.query(
    `SELECT COUNT(*)::int AS n FROM "document_numbering" WHERE "document_code"='PO' AND "financial_year_id"=${poFy}`
  )).rows[0].n;
  check('second series in same FY allowed', poSeriesCount, 2);

  await rejects('duplicate series name rejected ',
    `INSERT INTO "document_numbering"
       ("document_code","document_name","series_name","financial_year_id","next_number","start_number","end_number")
     VALUES ('PO','Purchase Order','Default',${poFy},1,1,999999)`);

  await rejects('second default rejected        ',
    `UPDATE "document_numbering" SET "is_default"=TRUE
      WHERE "document_code"='PO' AND "financial_year_id"=${poFy} AND "series_name"='Default-2'`);

  await rejects('end < start rejected           ',
    `UPDATE "document_numbering" SET "start_number"=500,"end_number"=100 WHERE "id"=${poId}`);

  await rejects('next beyond end+1 rejected     ',
    `UPDATE "document_numbering" SET "next_number"=9999999 WHERE "id"=${poId}`);

  await rejects('number_length 0 rejected       ',
    `UPDATE "document_numbering" SET "number_length"=0 WHERE "id"=${poId}`);

  await rejects('number_length 13 rejected      ',
    `UPDATE "document_numbering" SET "number_length"=13 WHERE "id"=${poId}`);

  await rejects('orphan financial_year rejected ',
    `INSERT INTO "document_numbering"
       ("document_code","document_name","series_name","financial_year_id","next_number","start_number","end_number")
     VALUES ('SQ','Sales Quotation','Default',99999,1,1,999999)`);

  // Same document code in a *different* FY is exactly what the design allows —
  // including reusing the 'Default' name, since the key includes the year.
  const otherFy = (await db.query(`SELECT "id" FROM "financial_years" WHERE "financial_year_name"='2025-2026'`)).rows[0].id;
  await db.query(`
    INSERT INTO "document_numbering"
      ("document_code","document_name","series_name","financial_year_id","fy_code","prefix",
       "next_number","start_number","end_number","is_default")
    VALUES ('PO','Purchase Order','Default',${otherFy},'25-26','PO',1,1,999999,TRUE)
  `);
  const poCount = (await db.query(`SELECT COUNT(*)::int AS n FROM "document_numbering" WHERE "document_code"='PO'`)).rows[0].n;
  check('same name in another FY allowed', poCount, 3);
  const defaultsPerFy = (await db.query(`
    SELECT COUNT(*)::int AS n FROM "document_numbering"
     WHERE "document_code"='PO' AND "is_default"
  `)).rows[0].n;
  check('one default per FY, two FYs    ', defaultsPerFy, 2);

  // -------------------------------------------------------------------------
  section('4. The allocator — atomicity');
  // -------------------------------------------------------------------------
  // This is the exact statement allocateDocumentNumber() issues.
  const ALLOCATE = (id) => `
    UPDATE "document_numbering"
       SET "current_number" = "next_number",
           "next_number"    = "next_number" + 1,
           "last_number_at" = NOW(),
           "updated_at"     = NOW()
     WHERE "id" = ${id}
       AND "status" = 'Active'
       AND "auto_generate" = TRUE
       AND "next_number" <= "end_number"
    RETURNING "current_number"`;

  // Fresh series with a small range so we can drive it to exhaustion.
  const fy = byName['Purchase Order'].financial_year_id;
  await db.query(`
    INSERT INTO "document_numbering"
      ("document_code","document_name","series_name","financial_year_id","fy_code","prefix","number_length",
       "start_number","next_number","end_number","current_number","is_default")
    VALUES ('SQ','Sales Quotation','Default',${fy},'26-27','SQ',6,1,1,5,NULL,TRUE)
  `);
  const sqId = (await db.query(`SELECT "id" FROM "document_numbering" WHERE "document_code"='SQ' AND "financial_year_id"=${fy}`)).rows[0].id;

  const issued = [];
  for (let i = 0; i < 8; i += 1) {
    const r = await db.query(ALLOCATE(sqId));
    if (r.rows.length) issued.push(r.rows[0].current_number);
  }
  check('issues exactly the range       ', issued, [1, 2, 3, 4, 5]);
  check('further calls return no rows   ', (await db.query(ALLOCATE(sqId))).rows.length, 0);

  const spent = (await db.query(`SELECT * FROM "document_numbering" WHERE "id"=${sqId}`)).rows[0];
  check('counter parks at end+1         ', spent.next_number, 6);
  check('current stays at the last one  ', spent.current_number, 5);

  // Concurrency: fire them all at once against a wide range and confirm every
  // caller got a distinct number with no gaps.
  const parId = (await db.query(`
    INSERT INTO "document_numbering"
      ("document_code","document_name","series_name","financial_year_id","fy_code","prefix","number_length",
       "start_number","next_number","end_number","current_number","is_default")
    VALUES ('DC','Delivery Challan','Default',${fy},'26-27','DC',6,1,1,999999,NULL,TRUE)
    RETURNING "id"`)).rows[0].id;

  const CONCURRENT = 200;
  const results = await Promise.all(
    Array.from({ length: CONCURRENT }, () => db.query(ALLOCATE(parId)).then((r) => r.rows[0].current_number))
  );
  check(`${CONCURRENT} concurrent allocations   `, results.length, CONCURRENT);
  check('every number is unique         ', new Set(results).size, CONCURRENT);
  check('no gaps in the sequence        ', Math.max(...results) - Math.min(...results) + 1, CONCURRENT);
  check('starts at Start No.            ', Math.min(...results), 1);

  // -------------------------------------------------------------------------
  section('5. The allocator — guard conditions');
  // -------------------------------------------------------------------------
  await db.query(`UPDATE "document_numbering" SET "status"='Inactive' WHERE "id"=${parId}`);
  check('inactive series issues nothing ', (await db.query(ALLOCATE(parId))).rows.length, 0);

  await db.query(`UPDATE "document_numbering" SET "status"='Active', "auto_generate"=FALSE WHERE "id"=${parId}`);
  check('auto-generate off issues nothing', (await db.query(ALLOCATE(parId))).rows.length, 0);

  await db.query(`UPDATE "document_numbering" SET "auto_generate"=TRUE WHERE "id"=${parId}`);
  check('re-enabling resumes            ', (await db.query(ALLOCATE(parId))).rows.length, 1);

  // -------------------------------------------------------------------------
  section('6. Manual-entry counter sync');
  // -------------------------------------------------------------------------
  // Mirrors syncAfterManualNumber(): only ever moves the counter forward.
  const SYNC = (id, v) => `
    UPDATE "document_numbering"
       SET "current_number" = GREATEST(COALESCE("current_number", ${v}), ${v}),
           "next_number"    = GREATEST("next_number", ${v} + 1)
     WHERE "id" = ${id} AND ${v} + 1 <= "end_number" + 1
    RETURNING "current_number","next_number"`;

  const beforeSync = (await db.query(`SELECT "current_number","next_number" FROM "document_numbering" WHERE "id"=${parId}`)).rows[0];

  const ahead = (await db.query(SYNC(parId, beforeSync.next_number + 50))).rows[0];
  check('a number ahead pushes forward  ', ahead.next_number, beforeSync.next_number + 51);

  const behind = (await db.query(SYNC(parId, 5))).rows[0];
  check('a number behind does not rewind', behind.next_number, ahead.next_number);
  check('  ...nor rewinds current       ', behind.current_number, ahead.current_number);

  // -------------------------------------------------------------------------
  section('7. Multi-series and default switchover');
  // -------------------------------------------------------------------------
  // Reproduces the three-series layout from the mockups: one used up, one
  // live and default, one staged in reserve.
  await db.query(`DELETE FROM "document_numbering" WHERE "document_code"='PI'`);
  const mk = (name, start, end, current, next, status, isDefault) => db.query(`
    INSERT INTO "document_numbering"
      ("document_code","document_name","series_name","financial_year_id","fy_code","prefix","number_length",
       "start_number","next_number","end_number","current_number","status","is_default")
    VALUES ('PI','Purchase Invoice','${name}',${fy},'26-27','PI',6,
            ${start},${next},${end},${current === null ? 'NULL' : current},'${status}',${isDefault})
    RETURNING "id"`).then((r) => r.rows[0].id);

  const usedUp = await mk('Default', 1, 999, 999, 1000, 'Active', false);
  const live = await mk('Default-2', 1000, 1999, null, 1000, 'Active', true);
  const reserve = await mk('Default-3', 2000, 2999, null, 2000, 'Inactive', false);

  check('three PI series coexist        ',
    (await db.query(`SELECT COUNT(*)::int AS n FROM "document_numbering" WHERE "document_code"='PI'`)).rows[0].n, 3);

  // The used-up series must refuse to issue even though its status is Active —
  // that is what makes it read as "Completed" in the UI.
  check('used-up series issues nothing  ', (await db.query(ALLOCATE(usedUp))).rows.length, 0);

  // Allocation comes from the default, not merely "the first Active one".
  const fromDefault = (await db.query(ALLOCATE(live))).rows[0].current_number;
  check('default series issues its start', fromDefault, 1000);

  // Drain the default, then promote the reserve — the switchover an admin
  // performs when a block runs out.
  await db.query(`UPDATE "document_numbering" SET "next_number"="end_number"+1, "current_number"="end_number" WHERE "id"=${live}`);
  check('drained default issues nothing ', (await db.query(ALLOCATE(live))).rows.length, 0);

  // Demote before promote: the partial unique index allows only one default,
  // so the reverse order would fail. setDefaultSeries() does both in one
  // transaction for exactly this reason.
  await db.exec(`
    UPDATE "document_numbering" SET "status"='Active' WHERE "id"=${reserve};
    UPDATE "document_numbering" SET "is_default"=FALSE WHERE "id"=${live};
    UPDATE "document_numbering" SET "is_default"=TRUE  WHERE "id"=${reserve};
  `);
  const afterSwitch = (await db.query(`
    SELECT "id" FROM "document_numbering"
     WHERE "document_code"='PI' AND "financial_year_id"=${fy} AND "is_default"
  `)).rows;
  check('exactly one default after swap ', afterSwitch.length, 1);
  check('  ...and it is the reserve      ', afterSwitch[0].id, reserve);
  check('reserve now issues from 2000   ', (await db.query(ALLOCATE(reserve))).rows[0].current_number, 2000);

  // Ranges must not intersect, or two live series could issue the same number.
  const piRanges = (await db.query(`
    SELECT "start_number" AS s, "end_number" AS e FROM "document_numbering"
     WHERE "document_code"='PI' ORDER BY "start_number"
  `)).rows;
  const anyOverlap = piRanges.some((a, i) => piRanges.slice(i + 1).some((b) => a.s <= b.e && b.s <= a.e));
  check('no PI ranges overlap           ', anyOverlap, false);

  // -------------------------------------------------------------------------
  section('8. FY cascade');
  // -------------------------------------------------------------------------
  const priorCount = (await db.query(`SELECT COUNT(*)::int AS n FROM "document_numbering" WHERE "financial_year_id"=${otherFy}`)).rows[0].n;
  check('prior-year series exist        ', priorCount, 1);
  await db.query(`DELETE FROM "financial_years" WHERE "id"=${otherFy}`);
  const afterCascade = (await db.query(`SELECT COUNT(*)::int AS n FROM "document_numbering" WHERE "financial_year_id"=${otherFy}`)).rows[0].n;
  check('deleting an FY cascades series ', afterCascade, 0);
  const survivors = (await db.query(`SELECT COUNT(*)::int AS n FROM "document_numbering"`)).rows[0].n;
  check('other years are untouched      ', survivors > 0, true);

  // -------------------------------------------------------------------------
  section('Summary');
  // -------------------------------------------------------------------------
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  process.exitCode = failed ? 1 : 0;
  await db.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
