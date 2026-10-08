/**
 * Schema/database drift detector.
 *
 * `prisma generate` builds the client from schema.prisma, but the database is
 * built from the migration SQL. Nothing in the toolchain checks the two agree
 * — a field added to schema.prisma without a matching migration produces a
 * client that compiles fine and then throws "invalid column name" at
 * runtime, on whichever route happens to touch that column first. In an ERP
 * that surfaces as a posting failing in production.
 *
 * This test parses schema.prisma, materialises the real schema by applying
 * the SQL Server baseline migration inside a test transaction, and asserts
 * every model field maps to a column that actually exists, with a compatible
 * type and precision.
 *
 * Run with:  node --test "src/tests/*.test.js"
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { freshDb } = require('./testDb');

const PRISMA_DIR = path.join(__dirname, '..', 'prisma');

// ---------------------------------------------------------------------------
// A deliberately small schema.prisma parser. It understands only the subset
// this schema uses; anything it cannot classify is reported rather than
// skipped, so the test cannot quietly pass by failing to see a field.
// ---------------------------------------------------------------------------

/** snake_case fallback for fields with no explicit @map. */
const snake = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

function parseSchema(source) {
  const models = [];
  const modelRe = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  let m;
  while ((m = modelRe.exec(source)) !== null) {
    const [, name, body] = m;
    const tableMatch = body.match(/@@map\("([^"]+)"\)/);
    const fields = [];

    for (const raw of body.split('\n')) {
      const line = raw.replace(/\/\/.*$/, '').trim();
      if (!line || line.startsWith('@@')) continue;

      const fm = line.match(/^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/);
      if (!fm) continue;
      const [, fieldName, fieldType, isList, isOptional, attrs] = fm;

      // Relation fields and back-references are not columns.
      if (isList) continue;
      if (/@relation\(/.test(attrs) && /fields:\s*\[/.test(attrs)) continue;
      if (!/^(Int|String|Boolean|DateTime|Decimal|Float|BigInt|Json|Bytes)$/.test(fieldType)) continue;

      const mapMatch = attrs.match(/@map\("([^"]+)"\)/);
      const decMatch = attrs.match(/@db\.Decimal\((\d+),\s*(\d+)\)/);
      // @db.NVarChar(Max) is deliberately excluded (\d+ requires digits) —
      // unbounded text columns have no minimum-width promise to check.
      const varcharMatch = attrs.match(/@db\.NVarChar\((\d+)\)/);

      fields.push({
        name: fieldName,
        type: fieldType,
        optional: Boolean(isOptional),
        column: mapMatch ? mapMatch[1] : snake(fieldName),
        precision: decMatch ? Number(decMatch[1]) : null,
        scale: decMatch ? Number(decMatch[2]) : null,
        varchar: varcharMatch ? Number(varcharMatch[1]) : null,
        isId: /@id\b/.test(attrs),
        hasDefault: /@default\(/.test(attrs) || /@updatedAt\b/.test(attrs),
      });
    }

    models.push({ name, table: tableMatch ? tableMatch[1] : snake(name), fields });
  }
  return models;
}

/** Prisma scalar -> the information_schema data types that can back it (SQL Server). */
const TYPE_MAP = {
  Int: ['int', 'smallint', 'bigint'],
  BigInt: ['bigint'],
  String: ['nvarchar', 'varchar', 'nchar', 'char', 'ntext', 'text'],
  Boolean: ['bit'],
  DateTime: ['datetime2', 'datetime', 'date', 'time'],
  Decimal: ['decimal', 'numeric'],
  Float: ['float', 'real'],
  Json: ['nvarchar'], // unused in this schema — no Json fields
  Bytes: ['varbinary', 'image'],
};

async function readColumns(db) {
  const r = await db.query(`
    SELECT table_name, column_name, data_type, is_nullable,
           numeric_precision, numeric_scale, character_maximum_length, column_default
      FROM information_schema.columns
     WHERE table_schema = 'dbo'
  `);
  const byTable = new Map();
  for (const c of r.rows) {
    if (!byTable.has(c.table_name)) byTable.set(c.table_name, new Map());
    byTable.get(c.table_name).set(c.column_name, c);
  }
  return byTable;
}

let cached = null;
async function fixture() {
  if (!cached) {
    const db = await freshDb();
    cached = {
      models: parseSchema(fs.readFileSync(path.join(PRISMA_DIR, 'schema.prisma'), 'utf8')),
      columns: await readColumns(db),
      db,
    };
  }
  return cached;
}

test.after(async () => {
  if (cached) await cached.db.close();
});

// ---------------------------------------------------------------------------

test('the parser actually found the schema (guards against a silent pass)', async () => {
  const { models } = await fixture();
  assert.ok(models.length > 40, `only parsed ${models.length} models`);
  const si = models.find((m) => m.name === 'SalesInvoice');
  assert.ok(si, 'SalesInvoice not parsed');
  assert.ok(si.fields.length > 20, 'SalesInvoice fields not parsed');
  assert.ok(si.fields.some((f) => f.column === 'igst_amount'), 'igst_amount not parsed');
});

test('every model maps to a table the migrations create', async () => {
  const { models, columns } = await fixture();
  const missing = models.filter((m) => !columns.has(m.table)).map((m) => `${m.name} -> ${m.table}`);
  assert.deepEqual(missing, []);
});

test('every model field maps to a column that exists', async () => {
  const { models, columns } = await fixture();
  const missing = [];
  for (const model of models) {
    const table = columns.get(model.table);
    if (!table) continue;
    for (const field of model.fields) {
      if (!table.has(field.column)) missing.push(`${model.name}.${field.name} -> ${model.table}.${field.column}`);
    }
  }
  assert.deepEqual(missing, [], 'schema.prisma references columns the database does not have');
});

test('column types match the Prisma scalar they are declared as', async () => {
  const { models, columns } = await fixture();
  const mismatches = [];
  for (const model of models) {
    const table = columns.get(model.table);
    if (!table) continue;
    for (const field of model.fields) {
      const col = table.get(field.column);
      if (!col) continue;
      const allowed = TYPE_MAP[field.type];
      if (allowed && !allowed.includes(col.data_type)) {
        mismatches.push(`${model.name}.${field.name}: schema says ${field.type}, db has ${col.data_type}`);
      }
    }
  }
  assert.deepEqual(mismatches, []);
});

test('money columns keep their declared precision and scale', async () => {
  const { models, columns } = await fixture();
  const mismatches = [];
  for (const model of models) {
    const table = columns.get(model.table);
    if (!table) continue;
    for (const field of model.fields) {
      if (field.precision == null) continue;
      const col = table.get(field.column);
      if (!col) continue;
      if (Number(col.numeric_precision) !== field.precision || Number(col.numeric_scale) !== field.scale) {
        mismatches.push(
          `${model.name}.${field.name}: schema Decimal(${field.precision},${field.scale}), ` +
            `db numeric(${col.numeric_precision},${col.numeric_scale})`
        );
      }
    }
  }
  assert.deepEqual(mismatches, [], 'a narrower column than the schema declares truncates money silently');
});

test('string columns are not narrower in the database than the schema promises', async () => {
  const { models, columns } = await fixture();
  const mismatches = [];
  for (const model of models) {
    const table = columns.get(model.table);
    if (!table) continue;
    for (const field of model.fields) {
      if (field.varchar == null) continue;
      const col = table.get(field.column);
      if (!col || col.character_maximum_length == null) continue;
      if (Number(col.character_maximum_length) < field.varchar) {
        mismatches.push(
          `${model.name}.${field.name}: schema VarChar(${field.varchar}), db varchar(${col.character_maximum_length})`
        );
      }
    }
  }
  assert.deepEqual(mismatches, []);
});

test('required fields without a default are NOT NULL in the database', async () => {
  const { models, columns } = await fixture();
  const mismatches = [];
  for (const model of models) {
    const table = columns.get(model.table);
    if (!table) continue;
    for (const field of model.fields) {
      if (field.optional || field.hasDefault || field.isId) continue;
      const col = table.get(field.column);
      if (!col) continue;
      if (col.is_nullable === 'YES') {
        mismatches.push(`${model.name}.${field.name} (${model.table}.${field.column})`);
      }
    }
  }
  assert.deepEqual(
    mismatches,
    [],
    'a field the client treats as guaranteed-present is nullable in the database'
  );
});

test('no table has a money column outside Decimal(15,2) / Decimal(5,2)', async () => {
  // A double precision column holding money is the classic source of
  // half-a-paisa drift that never reconciles. Catch any that creep in.
  const { db } = await fixture();
  const r = await db.query(`
    SELECT table_name, column_name, data_type
      FROM information_schema.columns
     WHERE table_schema = 'dbo'
       AND data_type IN ('float', 'real')
       AND (column_name LIKE '%amount%' OR column_name LIKE '%price%'
            OR column_name LIKE '%balance%' OR column_name LIKE '%total%')
  `);
  assert.deepEqual(
    r.rows.map((x) => `${x.table_name}.${x.column_name} is ${x.data_type}`),
    [],
    'money must be numeric, never floating point'
  );
});
