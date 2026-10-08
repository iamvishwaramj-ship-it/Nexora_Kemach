/**
 * Shared SQL Server test-database harness.
 *
 * The test suite used to spin up a brand-new @electric-sql/pglite (an
 * in-process, in-memory Postgres compiled to WASM) per test, apply every
 * migration to it, and throw it away when the test finished — total
 * isolation with zero setup on the developer's machine. SQL Server has no
 * equivalent embeddable engine, so this harness instead talks to a real SQL
 * Server database (DATABASE_URL_TEST in backend/.env, the "test" database
 * visible in SSMS) and gets the same isolation a different way: the schema
 * is created once per process, and every individual test runs inside its own
 * transaction that is rolled back when the test calls db.close(). Because
 * nothing a test does is ever committed, concurrently-running tests never see
 * each other's rows (READ COMMITTED) and the database is left exactly as it
 * started no matter how many suites run against it.
 *
 * Each test-file's own buildClient()/freshDb() helper still writes
 * Postgres-flavoured SQL ($1 placeholders, ::float8 casts, RETURNING,
 * ANY($n)/ALL($n) array comparisons) because that was the shape PGlite spoke.
 * translateSql() below rewrites that text to T-SQL on every query so the
 * individual test files did not all need hand-editing statement by statement.
 */

const sql = require('mssql');
const fs = require('node:fs');
const path = require('node:path');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const MIGRATIONS_DIR = path.join(__dirname, '..', 'prisma', 'migrations');

function parseConnectionString(url) {
  // sqlserver://host:port;database=name;user=x;password=y;trustServerCertificate=true;encrypt=true
  const withoutScheme = url.replace(/^sqlserver:\/\//i, '');
  const [hostPort, ...rest] = withoutScheme.split(';');
  const [server, port] = hostPort.split(':');
  const opts = {};
  for (const part of rest) {
    if (!part) continue;
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    opts[part.slice(0, eq).toLowerCase()] = part.slice(eq + 1);
  }
  return {
    server,
    port: port ? Number(port) : 1433,
    database: opts.database,
    user: opts.user,
    password: opts.password,
    options: {
      trustServerCertificate: String(opts.trustservercertificate).toLowerCase() !== 'false',
      encrypt: String(opts.encrypt).toLowerCase() === 'true',
      enableArithAbort: true,
    },
  };
}

const CONN_STRING = process.env.DATABASE_URL_TEST;
if (!CONN_STRING) {
  throw new Error(
    'DATABASE_URL_TEST is not set in backend/.env — point it at a scratch SQL Server ' +
    'database (e.g. the "test" database) before running the test suite.'
  );
}

let poolPromise = null;
let schemaReadyPromise = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(parseConnectionString(CONN_STRING)).connect();
  }
  return poolPromise;
}

async function ensureSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      const pool = await getPool();
      const check = await pool.request().query(
        `SELECT COUNT(*) AS n FROM sys.tables WHERE name = 'document_numbering'`
      );
      if (check.recordset[0].n > 0) return; // already applied by a previous run/process

      const dirs = fs.readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
        .filter((e) => e.isDirectory()).map((e) => e.name).sort();
      for (const name of dirs) {
        const file = path.join(MIGRATIONS_DIR, name, 'migration.sql');
        if (fs.existsSync(file)) {
          await pool.request().batch(fs.readFileSync(file, 'utf8'));
        }
      }
    })();
  }
  return schemaReadyPromise;
}

/**
 * Rewrite one PGlite/Postgres-flavoured statement + its $n-style params into
 * T-SQL + @pN-style params. Array-valued params (used with ANY($n)/ALL($n))
 * are expanded into their own (@p1,@p2,...) parameter lists.
 */
function expandParams(text, params) {
  const finalParams = [];
  const paramMap = {};
  let n = 0;
  params.forEach((v, i) => {
    const orig = i + 1;
    if (Array.isArray(v)) {
      if (v.length === 0) {
        paramMap[orig] = '(SELECT TOP 0 1 WHERE 1 = 0)'; // empty IN-list, matches nothing
      } else {
        const names = v.map((item) => {
          n += 1;
          finalParams.push(item);
          return `@p${n}`;
        });
        paramMap[orig] = `(${names.join(',')})`;
      }
    } else {
      n += 1;
      finalParams.push(v);
      paramMap[orig] = `@p${n}`;
    }
  });

  text = text.replace(/=\s*ANY\(\$(\d+)\)/g, (_, i) => `IN ${paramMap[i]}`);
  text = text.replace(/<>\s*ALL\(\$(\d+)\)/g, (_, i) => `NOT IN ${paramMap[i]}`);
  text = text.replace(/\$(\d+)/g, (_, i) => paramMap[i] ?? `@p${i}`);
  return { text, params: finalParams };
}

/** Move a trailing `RETURNING col[, col...]` into an OUTPUT INSERTED.col clause. */
function translateReturning(text) {
  const m = text.match(/^([\s\S]*?)\s+RETURNING\s+([\s\S]+?)\s*$/i);
  if (!m) return text;
  const [, before, colsRaw] = m;
  const outCols = colsRaw.split(',').map((c) => `INSERTED.${c.trim()}`).join(', ');

  const valuesIdx = before.search(/\bVALUES\b/i);
  if (valuesIdx !== -1) {
    return `${before.slice(0, valuesIdx)}OUTPUT ${outCols} ${before.slice(valuesIdx)}`;
  }
  const whereIdx = before.search(/\bWHERE\b/i);
  if (whereIdx !== -1) {
    return `${before.slice(0, whereIdx)}OUTPUT ${outCols} ${before.slice(whereIdx)}`;
  }
  return `${before} OUTPUT ${outCols}`;
}

/** Trailing `LIMIT n` (always used at the very end of a SELECT here) -> `SELECT TOP (n)`. */
function translateLimit(text) {
  const m = text.match(/^([\s\S]*?)\bLIMIT\s+(\d+)\s*$/i);
  if (!m) return text;
  const [, before, count] = m;
  return before.replace(/^(\s*SELECT\s+)/i, `$1TOP (${count}) `);
}

function translateLiterals(text) {
  return text
    .replace(/\bNOW\(\)/gi, 'GETDATE()')
    .replace(/([A-Za-z0-9_."'()*]+)::float8/gi, 'CAST($1 AS FLOAT)')
    .replace(/([A-Za-z0-9_."'()*]+)::int\b/gi, 'CAST($1 AS INT)')
    .replace(/([A-Za-z0-9_."'()*]+)::text\b/gi, 'CAST($1 AS NVARCHAR(MAX))')
    .replace(/=\s*TRUE\b/gi, '= 1')
    .replace(/=\s*FALSE\b/gi, '= 0')
    .replace(/,\s*TRUE\s*,/g, ', 1,')
    .replace(/,\s*FALSE\s*,/g, ', 0,')
    .replace(/\bTRUE\)/g, '1)')
    .replace(/\bFALSE\)/g, '0)')
    .replace(/\|\|/g, '+');
}

function translateSql(text) {
  return translateLimit(translateReturning(translateLiterals(text)));
}

/**
 * A fresh, isolated "connection" for one test: same interface the test files
 * already coded against (`.query(text, params)` -> `{ rows, affectedRows }`,
 * `.exec(text)` for raw multi-statement setup SQL, `.close()`), but backed by
 * a real SQL Server transaction that is always rolled back, never committed.
 */
async function freshDb() {
  await ensureSchema();
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();

  return {
    async query(text, params = []) {
      const { text: sqlText, params: flatParams } = expandParams(translateSql(text), params);
      const request = new sql.Request(tx);
      flatParams.forEach((v, i) => request.input(`p${i + 1}`, v));
      const result = await request.query(sqlText);
      return { rows: result.recordset || [], affectedRows: result.rowsAffected?.[0] ?? 0 };
    },
    async exec(text) {
      const request = new sql.Request(tx);
      await request.batch(translateLiterals(text));
    },
    async close() {
      try {
        await tx.rollback();
      } catch {
        // Already rolled back (e.g. a failing test left the transaction
        // aborted) — nothing left to clean up.
      }
    },
  };
}

module.exports = { freshDb, translateSql, expandParams };
