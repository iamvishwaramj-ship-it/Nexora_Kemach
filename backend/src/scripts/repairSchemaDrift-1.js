// Brings an existing database up to date with schema.prisma without replaying
// migrations.
//
// Why this exists: the baseline migration is a single "fresh install" file
// that gets edited in place as features land. Prisma records it as applied
// once, so a database created before a column was added to that file never
// receives it — `prisma migrate deploy` sees the migration as already done and
// does nothing. The symptom is a runtime error like:
//
//     Invalid column name 'branch'.
//     The column `branch` does not exist in the current database.  (P2022)
//
// This script closes that gap by reading schema.prisma, asking SQL Server what
// actually exists, and adding only what's missing. It is idempotent — running
// it on an up-to-date database reports "nothing to do".
//
// Safety: it only ever ADDs. It never drops or retypes an existing column, so
// it cannot destroy data. Columns are added nullable, or NOT NULL with a
// DEFAULT when the schema declares one, which is what makes adding them to a
// table that already has rows safe.
//
// Run with:  npm run db:repair

require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');

const SCHEMA_PATH = path.join(__dirname, '..', 'prisma', 'schema.prisma');

// Resolved lazily rather than at module load: parseSchema() below is pure
// string work and useful to exercise on its own (and from a machine with no
// database), which requiring the client eagerly would make impossible —
// merely importing this file would try to spin up a query engine.
let cachedPrisma = null;
function db() {
  if (!cachedPrisma) cachedPrisma = require('../prisma/client');
  return cachedPrisma;
}

/**
 * Maps a Prisma field's type + native attribute to its SQL Server type.
 * Covers the subset this schema actually uses; anything unrecognised returns
 * null and the field is reported rather than guessed at.
 */
function sqlTypeFor(prismaType, nativeAttr) {
  if (nativeAttr) {
    const m = nativeAttr.match(/@db\.(\w+)(?:\(([^)]*)\))?/);
    if (m) {
      const [, kind, args] = m;
      switch (kind) {
        case 'NVarChar': return `NVARCHAR(${(args || '').toLowerCase() === 'max' ? 'MAX' : args})`;
        case 'VarChar': return `VARCHAR(${(args || '').toLowerCase() === 'max' ? 'MAX' : args})`;
        case 'Decimal': return `DECIMAL(${args})`;
        case 'Date': return 'DATE';
        case 'Time': return 'TIME';
        case 'DateTime2': return 'DATETIME2';
        case 'Bit': return 'BIT';
        default: return null;
      }
    }
  }
  switch (prismaType) {
    case 'String': return 'NVARCHAR(1000)';
    case 'Int': return 'INT';
    case 'BigInt': return 'BIGINT';
    case 'Float': return 'FLOAT';
    case 'Decimal': return 'DECIMAL(18,2)';
    case 'Boolean': return 'BIT';
    case 'DateTime': return 'DATETIME2';
    default: return null;
  }
}

/** Renders a Prisma @default(...) as a SQL Server DEFAULT expression. */
function sqlDefaultFor(rawDefault, prismaType) {
  if (rawDefault == null) return null;
  const value = rawDefault.trim();
  if (value === 'now()') return 'GETDATE()';
  if (value === 'autoincrement()' || value === 'uuid()' || value === 'cuid()') return null;
  if (value === 'true') return '1';
  if (value === 'false') return '0';
  if (/^".*"$/.test(value)) return `N'${value.slice(1, -1).replace(/'/g, "''")}'`;
  if (/^-?\d+(\.\d+)?$/.test(value)) return value;
  if (prismaType === 'String') return `N'${value.replace(/'/g, "''")}'`;
  return null;
}

/**
 * Parses schema.prisma into [{ table, columns: [{ name, sqlType, nullable,
 * sqlDefault }] }]. Relation fields (no native scalar) and list fields are
 * skipped — they aren't columns.
 */
function parseSchema() {
  const src = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const models = [...src.matchAll(/\nmodel\s+(\w+)\s*\{([\s\S]*?)\n\}/g)];
  const scalarTypes = new Set(['String', 'Int', 'BigInt', 'Float', 'Decimal', 'Boolean', 'DateTime', 'Bytes', 'Json']);

  return models.map(([, modelName, body]) => {
    // Scan real (non-comment) lines only. A naive body.match() here used to
    // pick up the FIRST @@map("...") text anywhere in the body — including
    // one mentioned inside a `//` doc comment (e.g. ProductGroup's own
    // comment referencing "WarehouseMaster's own Accounting tab
    // (@@map("warehouse") below)") — and mistook that model's own table for
    // "warehouse", silently trying to add ProductGroup's columns
    // (group_code, group_name, description, uom) to the warehouse table
    // instead of product_groups. Walking real lines only, same convention
    // the field-parsing loop below already uses, finds the model's actual
    // @@map directive and ignores anything a comment happens to mention.
    let table = modelName;
    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) continue;
      const m = trimmed.match(/@@map\("([^"]+)"\)/);
      if (m) { table = m[1]; break; }
    }

    const columns = [];
    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;

      const m = trimmed.match(/^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/);
      if (!m) continue;
      const [, fieldName, fieldType, isList, isOptional, rest] = m;
      if (isList) continue;                       // relation list, not a column
      if (!scalarTypes.has(fieldType)) continue;  // relation object, not a column
      if (/@relation\b/.test(rest)) continue;

      const colMatch = rest.match(/@map\("([^"]+)"\)/);
      const column = colMatch ? colMatch[1] : fieldName;

      const nativeAttr = (rest.match(/@db\.\w+(\([^)]*\))?/) || [null])[0];
      const sqlType = sqlTypeFor(fieldType, nativeAttr);
      if (!sqlType) continue;

      const defMatch = rest.match(/@default\(([^)]*(?:\([^)]*\))?[^)]*)\)/);
      const isId = /@id\b/.test(rest);
      // An identity/PK column can't be bolted on afterwards anyway.
      if (isId) continue;

      columns.push({
        name: column,
        sqlType,
        nullable: Boolean(isOptional),
        sqlDefault: sqlDefaultFor(defMatch ? defMatch[1] : null, fieldType),
        constraintBase: `DF_${table}_${column}`,
      });
    }
    return { model: modelName, table, columns };
  });
}

async function existingTables() {
  const rows = await db().$queryRawUnsafe('SELECT name FROM sys.tables');
  return new Set(rows.map((r) => r.name));
}

async function existingColumns(table) {
  const rows = await db().$queryRawUnsafe(
    `SELECT c.name AS name
       FROM sys.columns c
       JOIN sys.tables t ON t.object_id = c.object_id
      WHERE t.name = '${table.replace(/'/g, "''")}'`
  );
  return new Set(rows.map((r) => r.name));
}

async function run() {
  const models = parseSchema();
  const tables = await existingTables();

  const missingTables = [];
  const added = [];
  const unaddable = [];

  for (const { model, table, columns } of models) {
    if (!tables.has(table)) {
      missingTables.push({ model, table });
      continue;
    }

    const present = await existingColumns(table);
    for (const col of columns) {
      if (present.has(col.name)) continue;

      // A NOT NULL column with no default can't be added to a table that
      // already has rows — report it instead of failing the whole run.
      if (!col.nullable && !col.sqlDefault) {
        unaddable.push(`${table}.${col.name} (${col.sqlType}, NOT NULL, no default)`);
        continue;
      }

      const nullClause = col.nullable ? 'NULL' : 'NOT NULL';
      const defaultClause = col.sqlDefault
        ? ` CONSTRAINT [${col.constraintBase}] DEFAULT ${col.sqlDefault}`
        : '';
      const sql = `ALTER TABLE [dbo].[${table}] ADD [${col.name}] ${col.sqlType} ${nullClause}${defaultClause}`;

      try {
        await db().$executeRawUnsafe(sql);
        added.push(`${table}.${col.name} (${col.sqlType})`);
      } catch (err) {
        unaddable.push(`${table}.${col.name} — ${err.message}`);
      }
    }
  }

  console.log('');
  if (added.length) {
    console.log(`Added ${added.length} missing column(s):`);
    added.forEach((c) => console.log(`  + ${c}`));
  } else {
    console.log('No missing columns — every table matches schema.prisma.');
  }

  if (missingTables.length) {
    console.log(`\n${missingTables.length} table(s) in schema.prisma do not exist in the database:`);
    missingTables.forEach((t) => console.log(`  - ${t.table}  (model ${t.model})`));
    console.log('\n  Creating tables is not automated here because of foreign-key ordering.');
    console.log('  Each missing table has a script that creates it:');
    console.log('    warehouses, locations                  -> npm run warehouse_location:ensure');
    console.log('    Stock                                  -> npm run stock_table:ensure');
    console.log('    warehouse, location_master,');
    console.log('    opening_balance                        -> npm run current_stock:seed');
  }

  if (unaddable.length) {
    console.log(`\n${unaddable.length} column(s) could not be added automatically:`);
    unaddable.forEach((c) => console.log(`  ! ${c}`));
  }
  console.log('');
}

if (require.main === module) {
  run()
    .catch((err) => {
      console.error('db:repair failed:', err);
      process.exitCode = 1;
    })
    .finally(() => db().$disconnect());
}

module.exports = { run, parseSchema };
