/**
 * Applies the repository's SQL Server baseline migration to a fresh
 * transaction and asserts the resulting schema is the one the application
 * code expects.
 *
 * Before the Postgres -> SQL Server conversion this replayed the full history
 * of 36 incremental Postgres migrations (idempotency-by-replay, applying a
 * named subset to rebuild pre-fix state, ...). That history was collapsed
 * into one SQL Server baseline migration
 * (20260813120000_init_sqlserver/migration.sql) when the project moved off
 * Postgres, so the tests below assert the same end-state properties against
 * that single migration instead of replaying history that no longer exists.
 *
 * Run with:  node --test "src/tests/*.test.js"
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { freshDb } = require('./testDb');

async function columns(db, table) {
  const r = await db.query(
    `SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable
       FROM information_schema.columns WHERE table_name = $1`,
    [table]
  );
  return Object.fromEntries(r.rows.map((c) => [c.column_name, c]));
}

test('the baseline migration applies cleanly and creates the full schema', async () => {
  const db = await freshDb();
  const r = await db.query(
    `SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'dbo' AND table_type = 'BASE TABLE'`
  );
  assert.ok(r.rows[0].n > 40, `expected the full schema, got ${r.rows[0].n} tables`);
  await db.close();
});

test('GRN and delivery challan lines carry their own tax rate', async () => {
  const db = await freshDb();
  for (const table of ['goods_received_note_items', 'delivery_challan_items']) {
    const cols = await columns(db, table);
    assert.ok(cols.tax_percent, `${table}.tax_percent is missing — tax would be hard-coded again`);
    assert.equal(cols.tax_percent.numeric_scale, 2);
    assert.ok(cols.discount_percent, `${table}.discount_percent is missing`);
  }
  await db.close();
});

test('every transaction header can record IGST and a place of supply', async () => {
  const db = await freshDb();
  const headers = [
    'purchase_quotations',
    'purchase_orders',
    'goods_received_notes',
    'purchase_invoices',
    'sales_quotations',
    'sales_orders',
    'delivery_challans',
    'sales_invoices',
  ];
  for (const table of headers) {
    const cols = await columns(db, table);
    assert.ok(cols.igst_amount, `${table}.igst_amount is missing — inter-state supply cannot be billed`);
    assert.equal(cols.igst_amount.numeric_precision, 15);
    assert.equal(cols.igst_amount.numeric_scale, 2);
    assert.ok(cols.place_of_supply, `${table}.place_of_supply is missing`);
  }
  await db.close();
});

test('every document header can carry a round-off line', async () => {
  const db = await freshDb();
  for (const table of ['purchase_quotations', 'purchase_orders', 'goods_received_notes']) {
    const cols = await columns(db, table);
    assert.ok(cols.round_off, `${table}.round_off is missing`);
  }
  const grn = await columns(db, 'goods_received_notes');
  assert.ok(grn.taxable_amount, 'goods_received_notes.taxable_amount is missing');
  await db.close();
});

test('an invoice can have at most one outstanding row', async () => {
  const db = await freshDb();

  await db.exec(`
    INSERT INTO "customer_outstanding" (customer_name, invoice_no, invoice_amount, paid_amount, balance_amount, status)
    VALUES ('Acme', 'SI-26-27-000001', 1000, 0, 1000, 'Unpaid');
  `);

  await assert.rejects(
    () =>
      db.exec(`
        INSERT INTO "customer_outstanding" (customer_name, invoice_no, invoice_amount, paid_amount, balance_amount, status)
        VALUES ('Acme', 'SI-26-27-000001', 1000, 0, 1000, 'Unpaid');
      `),
    /duplicate key|unique/i,
    'a second outstanding row for the same invoice must be rejected'
  );

  // NULL invoice_no is exempt — on-account rows are allowed to repeat.
  await db.exec(`
    INSERT INTO "customer_outstanding" (customer_name, invoice_amount) VALUES ('Acme', 500);
    INSERT INTO "customer_outstanding" (customer_name, invoice_amount) VALUES ('Acme', 500);
  `);

  await db.close();
});

test('at most one default numbering series per document type + year', async () => {
  const db = await freshDb();
  const fy = await db.query(
    `INSERT INTO financial_years (financial_year_name, status) VALUES ('FY26-27','Active') RETURNING id`
  );
  const fyId = fy.rows[0].id;

  await db.exec(`
    INSERT INTO document_numbering
      (document_code, document_name, series_name, is_default, financial_year_id, fy_code,
       prefix, separator, include_fy_in_number, number_length, start_number, next_number, end_number,
       reset_every_fy, auto_generate, manual_entry, status, created_at, updated_at)
    VALUES
      ('SI','Sales Invoice','Default',1,${fyId},'26-27','SI','-',1,6,1,1,999999,1,1,0,'Active',GETDATE(),GETDATE());
  `);

  await assert.rejects(
    () =>
      db.exec(`
        INSERT INTO document_numbering
          (document_code, document_name, series_name, is_default, financial_year_id, fy_code,
           prefix, separator, include_fy_in_number, number_length, start_number, next_number, end_number,
           reset_every_fy, auto_generate, manual_entry, status, created_at, updated_at)
        VALUES
          ('SI','Sales Invoice','Default-2',1,${fyId},'26-27','SI','-',1,6,1,1,999999,1,1,0,'Active',GETDATE(),GETDATE());
      `),
    /duplicate key|unique/i,
    'a second default series for the same document type + year must be rejected'
  );

  await db.close();
});

test('schema.prisma has no model whose table the baseline migration never creates', async () => {
  const db = await freshDb();
  const schema = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'schema.prisma'), 'utf8');
  const mapped = [...schema.matchAll(/@@map\("([^"]+)"\)/g)].map((m) => m[1]);
  const r = await db.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'dbo' AND table_type = 'BASE TABLE'`
  );
  const actual = new Set(r.rows.map((x) => x.table_name));
  const missing = mapped.filter((t) => !actual.has(t));
  assert.deepEqual(missing, [], 'schema.prisma maps to tables the baseline migration does not create');
  await db.close();
});
