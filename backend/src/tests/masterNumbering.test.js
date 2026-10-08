/**
 * Auto-generated master codes.
 *
 * Thirteen master records — Branch, Tax Code, Sales Employee, Product Group,
 * Product Sub Group, Brand, Unit of Measure, Product,
 * Customer, Supplier, Transporter, Warehouse and Location — had a UNIQUE code
 * column the user typed by hand. They now draw from the same numbering engine
 * the sixteen transaction documents use.
 *
 * The behaviour that matters, and that these tests pin, is the difference
 * between the two scopes: a transaction series is per financial year and may
 * carry the year token, while a master series is **perpetual**. A customer
 * code identifies one customer forever, so if the counter reset each April the
 * next new customer would be handed a code that already belongs to somebody —
 * and since the column is UNIQUE, the save would fail.
 *
 * Run with:  node --test "src/tests/*.test.js"
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DOCUMENT_CATALOG,
  CATALOG_BY_CODE,
  isMasterScope,
  buildDocumentNumber,
} = require('../services/documentNumberService');

const { freshDb } = require('./testDb');

const MASTER_CODES = ['BRN', 'TAX', 'EMP', 'PG', 'PSG', 'BRD', 'UOM', 'PRD', 'CUS', 'SUP', 'TRN', 'WH', 'LOC'];
const TRANSACTION_CODES = [
  'ENQ', 'PQ', 'PO', 'GRN', 'PI', 'SQ', 'SO', 'DC', 'SI',
  'SRC', 'SIG', 'ADJ', 'RV', 'PV', 'DEP', 'CHQ',
];

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

test('the catalog covers all thirteen masters alongside the sixteen transactions', () => {
  assert.equal(DOCUMENT_CATALOG.length, 29);
  for (const code of MASTER_CODES) {
    assert.ok(CATALOG_BY_CODE.has(code), `${code} missing from the catalog`);
  }
  for (const code of TRANSACTION_CODES) {
    assert.ok(CATALOG_BY_CODE.has(code), `${code} missing from the catalog`);
  }
});

test('every catalog entry declares a scope, and the scopes are correct', () => {
  for (const entry of DOCUMENT_CATALOG) {
    assert.ok(['master', 'transaction'].includes(entry.scope), `${entry.code} has no valid scope`);
  }
  for (const code of MASTER_CODES) assert.equal(isMasterScope(code), true, `${code} should be a master`);
  for (const code of TRANSACTION_CODES) assert.equal(isMasterScope(code), false, `${code} should be a transaction`);
});

test('document codes are unique and the thirteen new ones do not collide', () => {
  const codes = DOCUMENT_CATALOG.map((d) => d.code);
  assert.equal(new Set(codes).size, codes.length, 'duplicate document code in the catalog');
});

test('an unknown code is not treated as a master by accident', () => {
  assert.equal(isMasterScope('NOPE'), false);
  assert.equal(isMasterScope(undefined), false);
});

// ---------------------------------------------------------------------------
// Number shape
// ---------------------------------------------------------------------------

test('a master code carries no financial-year token', () => {
  const series = {
    prefix: 'CUS', separator: '-', numberLength: 6,
    fyCode: '26-27', includeFyInNumber: false,
  };
  assert.equal(buildDocumentNumber(series, 1), 'CUS-000001');
  assert.equal(buildDocumentNumber(series, 4321), 'CUS-004321');
});

test('a transaction number still carries the year, for contrast', () => {
  const series = {
    prefix: 'SI', separator: '-', numberLength: 6,
    fyCode: '26-27', includeFyInNumber: true,
  };
  assert.equal(buildDocumentNumber(series, 1), 'SI-26-27-000001');
});

// ---------------------------------------------------------------------------
// The seeded series
// ---------------------------------------------------------------------------

test('the migration seeds one perpetual default series per master', async () => {
  const db = await freshDb();
  const r = await db.query(
    `SELECT document_code, series_name, is_default, financial_year_id,
            reset_every_fy, include_fy_in_number, auto_generate, manual_entry,
            status, start_number, next_number, end_number, prefix
       FROM "document_numbering"
      WHERE financial_year_id IS NULL
      ORDER BY document_code`
  );

  assert.equal(r.rows.length, MASTER_CODES.length, 'expected exactly one series per master');
  assert.deepEqual(r.rows.map((x) => x.document_code).sort(), [...MASTER_CODES].sort());

  for (const row of r.rows) {
    assert.equal(row.is_default, true, `${row.document_code} must be the default series`);
    assert.equal(row.financial_year_id, null, `${row.document_code} must not be tied to a year`);
    assert.equal(row.reset_every_fy, false, `${row.document_code} must never reset`);
    assert.equal(row.include_fy_in_number, false, `${row.document_code} must not carry the FY token`);
    assert.equal(row.auto_generate, true);
    assert.equal(row.manual_entry, false);
    assert.equal(row.status, 'Active');
    assert.equal(Number(row.start_number), 1);
    assert.equal(Number(row.next_number), 1);
    assert.ok(Number(row.end_number) > 1);
    assert.ok(row.prefix, `${row.document_code} needs a prefix`);
  }
  await db.close();
});

test('re-seeding a master series is a no-op when one already exists', async () => {
  // The baseline migration seeds one perpetual default series per master with
  // a plain WHERE NOT EXISTS guard (the same idiom the old per-migration seed
  // used), specifically so a retried deploy never duplicates a series. Pin
  // that guard directly rather than depending on migration-file layout.
  const db = await freshDb();
  const seed = `
    INSERT INTO "document_numbering" (
      document_code, document_name, series_name, is_default,
      financial_year_id, prefix, separator, include_fy_in_number, number_length,
      start_number, current_number, next_number, end_number,
      reset_every_fy, auto_generate, manual_entry, status, created_at, updated_at
    )
    SELECT 'CUS', 'Customer', 'Series 1', 1, NULL, 'CUS', '-', 0, 6, 1, NULL, 1, 999999, 0, 1, 0, 'Active', GETDATE(), GETDATE()
    WHERE NOT EXISTS (
      SELECT 1 FROM "document_numbering" WHERE document_code = 'CUS' AND financial_year_id IS NULL
    );
  `;
  await db.exec(seed);
  await db.exec(seed);

  const r = await db.query(
    `SELECT COUNT(*)::int AS n FROM "document_numbering" WHERE financial_year_id IS NULL`);
  assert.equal(r.rows[0].n, MASTER_CODES.length, 'the seed must be idempotent');
  await db.close();
});

test('a second series for the same master with the same name is rejected', async () => {
  const db = await freshDb();
  await assert.rejects(
    () => db.exec(`
      INSERT INTO "document_numbering"
        (document_code, document_name, series_name, is_default, financial_year_id,
         prefix, separator, include_fy_in_number, number_length,
         start_number, next_number, end_number, reset_every_fy, auto_generate,
         manual_entry, status, created_at, updated_at)
      VALUES ('CUS','Customer','Series 1',FALSE,NULL,'CUS','-',FALSE,6,1,1,999999,
              FALSE,TRUE,FALSE,'Active',NOW(),NOW());
    `),
    /duplicate key|unique/i,
    'NULL financial years compare as distinct, so this needs a partial unique index'
  );
  await db.close();
});

test('a master cannot have two default series', async () => {
  const db = await freshDb();
  await assert.rejects(
    () => db.exec(`
      INSERT INTO "document_numbering"
        (document_code, document_name, series_name, is_default, financial_year_id,
         prefix, separator, include_fy_in_number, number_length,
         start_number, next_number, end_number, reset_every_fy, auto_generate,
         manual_entry, status, created_at, updated_at)
      VALUES ('CUS','Customer','Series 2',TRUE,NULL,'CUS','-',FALSE,6,2000,2000,999999,
              FALSE,TRUE,FALSE,'Active',NOW(),NOW());
    `),
    /duplicate key|unique/i
  );
  await db.close();
});

test('a second NON-default series for the same master is allowed', async () => {
  // Staging a reserve series is the whole point of the multi-series model.
  const db = await freshDb();
  await db.exec(`
    INSERT INTO "document_numbering"
      (document_code, document_name, series_name, is_default, financial_year_id,
       prefix, separator, include_fy_in_number, number_length,
       start_number, next_number, end_number, reset_every_fy, auto_generate,
       manual_entry, status, created_at, updated_at)
    VALUES ('CUS','Customer','Series 2',FALSE,NULL,'CUS','-',FALSE,6,2000,2000,999999,
            FALSE,TRUE,FALSE,'Active',NOW(),NOW());
  `);
  const r = await db.query(
    `SELECT COUNT(*)::int AS n FROM "document_numbering" WHERE document_code = 'CUS'`);
  assert.equal(r.rows[0].n, 2);
  await db.close();
});

test('a perpetual series that claims to reset is rejected by the database', async () => {
  // The guard is structural, not a convention somebody has to remember: a
  // master series that reset each year would reissue codes already in use.
  const db = await freshDb();
  await assert.rejects(
    () => db.exec(`UPDATE "document_numbering" SET reset_every_fy = TRUE WHERE document_code = 'CUS';`),
    /check constraint|violates/i
  );
  await assert.rejects(
    () => db.exec(`UPDATE "document_numbering" SET include_fy_in_number = TRUE WHERE document_code = 'CUS';`),
    /check constraint|violates/i
  );
  await db.close();
});

test('transaction series are still allowed to reset and carry the year', async () => {
  const db = await freshDb();
  await db.exec(`
    INSERT INTO "financial_years" (financial_year_name, start_date, end_date, status)
    VALUES ('2026-27','2026-04-01','2027-03-31','Active');
  `);
  await db.exec(`
    INSERT INTO "document_numbering"
      (document_code, document_name, series_name, is_default, financial_year_id, fy_code,
       prefix, separator, include_fy_in_number, number_length,
       start_number, next_number, end_number, reset_every_fy, auto_generate,
       manual_entry, status, created_at, updated_at)
    VALUES ('SI','Sales Invoice','Series 1',TRUE,
            (SELECT TOP 1 id FROM financial_years),'26-27',
            'SI','-',TRUE,6,1,1,999999,TRUE,TRUE,FALSE,'Active',NOW(),NOW());
  `);
  const r = await db.query(
    `SELECT reset_every_fy, include_fy_in_number FROM "document_numbering" WHERE document_code = 'SI'`);
  assert.equal(r.rows[0].reset_every_fy, true);
  assert.equal(r.rows[0].include_fy_in_number, true);
  await db.close();
});

test('the allocator hands out sequential codes with no duplicates', async () => {
  // The conditional UPDATE is what makes concurrent creates safe; exercise it
  // directly against the seeded customer series.
  const db = await freshDb();
  const issued = [];
  for (let i = 0; i < 25; i += 1) {
    const r = await db.query(`
      UPDATE "document_numbering"
         SET current_number = next_number, next_number = next_number + 1
       WHERE document_code = 'CUS' AND financial_year_id IS NULL
         AND status = 'Active' AND auto_generate = TRUE
         AND next_number <= end_number
      RETURNING current_number
    `);
    issued.push(Number(r.rows[0].current_number));
  }
  assert.equal(new Set(issued).size, 25, 'no number may be issued twice');
  assert.deepEqual(issued, Array.from({ length: 25 }, (_, i) => i + 1));
  await db.close();
});
