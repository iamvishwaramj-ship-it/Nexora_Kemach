/**
 * Document Numbering — CRUD integration tests.
 *
 * Companion to testDocumentNumbering.js, which covers the pure formatting and
 * validation helpers in isolation. This one drives the *routes*: real Express
 * router, real auth middleware, real error handler, real service layer — with
 * only the Prisma client swapped for an in-memory double (scripts/fakePrisma.js).
 *
 * That boundary is deliberate. Everything the app actually runs in a request is
 * under test; the only thing faked is the database, and the fake enforces the
 * same unique indexes the real schema does, so a route that forgets to demote
 * the incumbent default (or reuses a series name) fails here exactly as it
 * would against PostgreSQL.
 *
 *   npm run test:crud
 */

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
process.env.NODE_ENV = 'test';

const path = require('path');
const express = require('express');
const { createFakePrisma } = require('./fakePrisma');

// The error handler logs every error it formats. Most of this suite is
// deliberately provoking 400s and 409s, so that logging would bury the actual
// results. Silenced here rather than in the handler — production wants it.
console.error = () => {};

// ---------------------------------------------------------------------------
// Wire the fake DB in before anything requires the real one.
// ---------------------------------------------------------------------------
const PRISMA_PATH = require.resolve(path.join(__dirname, '..', 'prisma', 'client.js'));

const FY_2026 = { id: 1, financialYearName: '2026-2027', startDate: '2026-04-01T00:00:00.000Z', endDate: '2027-03-31T00:00:00.000Z', status: 'Active' };
const FY_2027 = { id: 2, financialYearName: '2027-2028', startDate: '2027-04-01T00:00:00.000Z', endDate: '2028-03-31T00:00:00.000Z', status: 'Active' };

let fake;

/** Fresh database for each section, so tests never leak into one another. */
function resetDb(seed = {}) {
  fake = createFakePrisma({ financialYear: [FY_2026, FY_2027], ...seed });
  require.cache[PRISMA_PATH] = { id: PRISMA_PATH, filename: PRISMA_PATH, loaded: true, exports: fake };
  // Drop the route + service modules so they re-require the new fake.
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}routes${path.sep}`) || key.includes(`${path.sep}services${path.sep}`)) {
      delete require.cache[key];
    }
  }
}

resetDb();

const { signAccessToken } = require('../utils/jwt');
const TOKEN = signAccessToken({ id: 1, email: 'admin@nexora.com', role: 'admin' });

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
const failures = [];

function section(title) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
}

function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failed += 1;
    failures.push(`${label}\n         expected: ${e}\n         actual:   ${a}`);
    console.log(`  FAIL ${label}\n         expected: ${e}\n         actual:   ${a}`);
  }
}

/** Assert an error response mentions something, without pinning exact wording. */
function checkErr(label, res, status, fragment) {
  const okStatus = res.status === status;
  const body = JSON.stringify(res.body?.message || '') + JSON.stringify(res.body?.errors || '');
  const okText = fragment ? body.toLowerCase().includes(fragment.toLowerCase()) : true;
  if (okStatus && okText) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failed += 1;
    const detail = `status ${res.status} body ${body.slice(0, 300)}`;
    failures.push(`${label}\n         expected: ${status} containing "${fragment}"\n         actual:   ${detail}`);
    console.log(`  FAIL ${label}\n         expected: ${status} containing "${fragment}"\n         actual:   ${detail}`);
  }
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
let server;
let baseUrl;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/company', require('../routes/company'));
  app.use(require('../middleware/errorHandler').errorHandler);
  return app;
}

async function api(method, url, body) {
  const res = await fetch(`${baseUrl}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let parsed = null;
  const text = await res.text();
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
  return { status: res.status, body: parsed };
}

/** Restart the app so it picks up a freshly reset database. */
async function restart(seed) {
  if (server) await new Promise((r) => server.close(r));
  resetDb(seed);
  const app = buildApp();
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}

const BASE = '/api/company/document-numbers';

/** A valid create payload, overridable per test. */
const payload = (over = {}) => ({
  documentCode: 'PO',
  seriesName: 'Default',
  financialYearId: 1,
  prefix: 'PO',
  suffix: null,
  separator: '-',
  includeFyInNumber: true,
  numberLength: 6,
  startNumber: 1,
  endNumber: 999999,
  resetEveryFy: true,
  autoGenerate: true,
  manualEntry: false,
  status: 'Active',
  ...over,
});

// ---------------------------------------------------------------------------
(async function run() {
  // =========================================================================
  section('1. CREATE');
  // =========================================================================
  await restart();

  let res = await api('POST', BASE, payload());
  check('creates the first series          ', res.status, 201);
  check('  ...and it is the default        ', res.body?.data?.isDefault, true);
  check('  ...currentNumber starts null    ', res.body?.data?.currentNumber, null);
  check('  ...nextNumber tracks startNumber', res.body?.data?.nextNumber, 1);
  check('  ...documentName is filled in    ', res.body?.data?.documentName, 'Purchase Order');
  check('  ...fyCode is derived            ', res.body?.data?.fyCode, '26-27');
  const firstId = res.body?.data?.id;

  res = await api('POST', BASE, payload({ seriesName: 'Default', startNumber: 2000, endNumber: 2999 }));
  checkErr('rejects a duplicate series name  ', res, 400, 'already exists');

  res = await api('POST', BASE, payload({ seriesName: 'Default-2', startNumber: 500, endNumber: 1500 }));
  checkErr('rejects an overlapping range     ', res, 400, 'overlaps');

  res = await api('POST', BASE, payload({ seriesName: 'Tiny', startNumber: 1000000, endNumber: 1000001 }));
  checkErr('rejects a too-small range        ', res, 400, 'gap of at least');

  res = await api('POST', BASE, payload({ documentCode: 'NOPE' }));
  checkErr('rejects an unknown document type ', res, 400, 'unknown document type');

  res = await api('POST', BASE, payload({ financialYearId: 999 }));
  checkErr('rejects an unknown financial year', res, 400, 'valid financial year');

  res = await api('POST', BASE, payload({ seriesName: 'Bad', startNumber: 10, endNumber: 20, numberLength: 1 }));
  checkErr('rejects End No. past its padding ', res, 400, 'cannot exceed');

  res = await api('POST', BASE, payload({ seriesName: 'Both Off', startNumber: 3000, endNumber: 3999, autoGenerate: false, manualEntry: false }));
  checkErr('rejects auto-off + manual-off    ', res, 400, 'never produce a number');

  // A second, non-overlapping series is the normal multi-block case.
  res = await api('POST', BASE, payload({ seriesName: 'Default-2', startNumber: 1000000, endNumber: 1999999, numberLength: 7 }));
  check('accepts a clean second block     ', res.status, 201);
  check('  ...second series is NOT default', res.body?.data?.isDefault, false);
  const secondId = res.body?.data?.id;

  // Field-tagged errors are what let the form show a message under the input.
  res = await api('POST', BASE, payload({ seriesName: 'X', startNumber: 500, endNumber: 1500 }));
  check('errors are tagged with a field   ', Array.isArray(res.body?.errors) && res.body.errors.every((e) => 'field' in e && 'message' in e), true);

  // =========================================================================
  section('2. READ');
  // =========================================================================
  res = await api('GET', `${BASE}?financialYearId=1`);
  check('lists both series                ', res.body?.data?.length, 2);
  check('  ...decorated with next number  ', res.body?.data?.[0]?.nextNumberFormatted, 'PO-26-27-000001');
  check('  ...and a displayStatus         ', res.body?.data?.[0]?.displayStatus, 'Active');

  res = await api('GET', `${BASE}/${firstId}`);
  check('fetches one series by id         ', res.body?.data?.id, firstId);

  res = await api('GET', `${BASE}/999999`);
  check('404s an unknown id               ', res.status, 404);

  res = await api('GET', `${BASE}/catalog?financialYearId=1`);
  const poDoc = res.body?.data?.documents?.find((d) => d.code === 'PO');
  check('catalog counts existing series   ', poDoc?.seriesCount, 2);
  check('catalog marks it configured      ', poDoc?.configured, true);
  const enqDoc = res.body?.data?.documents?.find((d) => d.code === 'ENQ');
  check('catalog leaves others at zero    ', enqDoc?.seriesCount, 0);

  res = await api('GET', `${BASE}/by-document/PO?financialYearId=1`);
  check('by-document returns both series  ', res.body?.data?.series?.length, 2);
  check('  ...suggests the next free start', res.body?.data?.suggestion?.startNumber, 2000000);
  check('  ...suggests a valid End No.    ', res.body?.data?.suggestion?.endNumber > res.body?.data?.suggestion?.startNumber, true);
  check('  ...drops exhausted digit counts', res.body?.data?.availableNumberLengths?.includes(6), false);
  check('  ...keeps usable digit counts   ', res.body?.data?.availableNumberLengths?.includes(8), true);

  res = await api('GET', `${BASE}/by-document/ENQ?financialYearId=1`);
  check('by-document on a fresh doc       ', res.body?.data?.series?.length, 0);
  check('  ...suggests Start No. 1        ', res.body?.data?.suggestion?.startNumber, 1);
  check('  ...and offers every length     ', res.body?.data?.availableNumberLengths?.includes(3), true);

  res = await api('GET', `${BASE}/by-document/NOPE?financialYearId=1`);
  checkErr('by-document rejects a bad code   ', res, 400, 'unknown document type');

  // =========================================================================
  section('3. UPDATE');
  // =========================================================================
  res = await api('PUT', `${BASE}/${firstId}`, { seriesName: 'Renamed' });
  check('renames a series                 ', res.body?.data?.seriesName, 'Renamed');

  res = await api('PUT', `${BASE}/${firstId}`, { endNumber: 500000 });
  check('shrinks End No. while unissued   ', res.body?.data?.endNumber, 500000);

  res = await api('PUT', `${BASE}/${firstId}`, { startNumber: 10 });
  check('moves Start No. while unissued   ', res.body?.data?.startNumber, 10);
  check('  ...and nextNumber follows it   ', res.body?.data?.nextNumber, 10);

  res = await api('PUT', `${BASE}/${firstId}`, { isDefault: false });
  check('ignores isDefault on a plain PUT ', res.body?.data?.isDefault, true);

  res = await api('PUT', `${BASE}/${firstId}`, { seriesName: 'Default-2' });
  checkErr('rejects renaming onto a sibling  ', res, 400, 'already exists');

  res = await api('PUT', `${BASE}/${firstId}`, { endNumber: 1500000 });
  checkErr('rejects growing into a sibling   ', res, 400, 'overlaps');

  res = await api('PUT', `${BASE}/${secondId}`, { autoGenerate: false, manualEntry: false });
  checkErr('rejects turning both switches off', res, 400, 'never produce a number');

  res = await api('PUT', `${BASE}/999999`, { seriesName: 'Ghost' });
  check('404s updating an unknown id      ', res.status, 404);

  // Toggling one field must not clobber the others (the inline switches
  // in the list send exactly one key).
  res = await api('PUT', `${BASE}/${firstId}`, { manualEntry: true });
  check('single-field PUT keeps the prefix', res.body?.data?.prefix, 'PO');
  check('  ...and keeps the series name   ', res.body?.data?.seriesName, 'Renamed');
  check('  ...and applies the change      ', res.body?.data?.manualEntry, true);

  // =========================================================================
  section('4. Locked series — after a number has been issued');
  // =========================================================================
  await restart();
  await api('POST', BASE, payload({ startNumber: 1, endNumber: 999 }));
  let alloc = await api('POST', `${BASE}/next`, { documentCode: 'PO', financialYearId: 1 });
  check('allocates the first number       ', alloc.body?.data?.documentNumber, 'PO-26-27-000001');

  res = await api('GET', `${BASE}?financialYearId=1`);
  const live = res.body?.data?.[0];
  check('  ...counter advanced            ', [live?.currentNumber, live?.nextNumber], [1, 2]);
  check('  ...and it reads as consumed    ', live?.isConsumed, true);

  res = await api('PUT', `${BASE}/${live.id}`, { prefix: 'PUR' });
  checkErr('locks the prefix once issued     ', res, 400, 'cannot be changed');

  res = await api('PUT', `${BASE}/${live.id}`, { numberLength: 8 });
  checkErr('locks the number length          ', res, 400, 'cannot be changed');

  res = await api('PUT', `${BASE}/${live.id}`, { startNumber: 50 });
  checkErr('locks Start No.                  ', res, 400, 'cannot be changed');

  res = await api('PUT', `${BASE}/${live.id}`, { endNumber: 0 });
  checkErr('refuses End No. below last issued', res, 400, 'lowered below');

  res = await api('PUT', `${BASE}/${live.id}`, { endNumber: 5000 });
  check('still allows extending End No.   ', res.body?.data?.endNumber, 5000);
  check('  ...without rewinding the counter', res.body?.data?.nextNumber, 2);

  res = await api('PUT', `${BASE}/${live.id}`, { status: 'Inactive' });
  check('still allows retiring the series ', res.body?.data?.status, 'Inactive');

  res = await api('DELETE', `${BASE}/${live.id}`);
  checkErr('refuses to delete a used series  ', res, 409, 'cannot be deleted');

  // =========================================================================
  section('5. DELETE');
  // =========================================================================
  await restart();
  res = await api('POST', BASE, payload({ seriesName: 'A', startNumber: 1, endNumber: 999 }));
  const delA = res.body?.data?.id;
  res = await api('POST', BASE, payload({ seriesName: 'B', startNumber: 1000, endNumber: 1999 }));
  const delB = res.body?.data?.id;

  check('A starts as the default          ', (await api('GET', `${BASE}/${delA}`)).body?.data?.isDefault, true);

  res = await api('DELETE', `${BASE}/${delA}`);
  check('deletes an unused series         ', res.status, 200);
  check('  ...and hands the default over  ', (await api('GET', `${BASE}/${delB}`)).body?.data?.isDefault, true);

  res = await api('DELETE', `${BASE}/${delB}`);
  check('deletes the last one too         ', res.status, 200);
  check('  ...leaving nothing behind      ', (await api('GET', `${BASE}?financialYearId=1`)).body?.data?.length, 0);

  res = await api('DELETE', `${BASE}/999999`);
  check('404s deleting an unknown id      ', res.status, 404);

  // =========================================================================
  section('6. Default series handover');
  // =========================================================================
  await restart();
  res = await api('POST', BASE, payload({ seriesName: 'A', startNumber: 1, endNumber: 999 }));
  const setA = res.body?.data?.id;
  res = await api('POST', BASE, payload({ seriesName: 'B', startNumber: 1000, endNumber: 1999 }));
  const setB = res.body?.data?.id;

  res = await api('POST', `${BASE}/${setB}/set-default`);
  check('promotes B to default            ', res.body?.data?.isDefault, true);
  check('  ...and demotes A               ', (await api('GET', `${BASE}/${setA}`)).body?.data?.isDefault, false);
  check('  ...exactly one default remains ', (await api('GET', `${BASE}?financialYearId=1`)).body.data.filter((r) => r.isDefault).length, 1);

  await api('PUT', `${BASE}/${setA}`, { status: 'Inactive' });
  res = await api('POST', `${BASE}/${setA}/set-default`);
  checkErr('refuses to promote an inactive   ', res, 409, 'inactive');

  // =========================================================================
  section('7. Allocation and exhaustion');
  // =========================================================================
  await restart();
  await api('POST', BASE, payload({ startNumber: 1, endNumber: 3, numberLength: 3 }));

  const issued = [];
  for (let i = 0; i < 3; i += 1) {
    const r = await api('POST', `${BASE}/next`, { documentCode: 'PO', financialYearId: 1 });
    issued.push(r.body?.data?.documentNumber);
  }
  check('issues the full range in order   ', issued, ['PO-26-27-001', 'PO-26-27-002', 'PO-26-27-003']);

  res = await api('POST', `${BASE}/next`, { documentCode: 'PO', financialYearId: 1 });
  checkErr('then reports the series spent    ', res, 409, 'end no.');

  res = await api('POST', `${BASE}/peek`, { documentCode: 'PO', financialYearId: 1 });
  checkErr('peek reports it too              ', res, 409, 'end no.');

  res = await api('GET', `${BASE}?financialYearId=1`);
  check('exhausted series reads Completed ', res.body?.data?.[0]?.displayStatus, 'Completed');
  check('  ...and has nothing remaining   ', res.body?.data?.[0]?.remaining, 0);

  // A reserve series is the documented way out of an exhausted block.
  await api('POST', BASE, payload({ seriesName: 'Reserve', startNumber: 100, endNumber: 199, numberLength: 3 }));
  res = await api('POST', `${BASE}/next`, { documentCode: 'PO', financialYearId: 1 });
  checkErr('  ...and names the reserve       ', res, 409, 'Reserve');

  res = await api('GET', `${BASE}/by-document/PO?financialYearId=1`);
  const reserve = res.body.data.series.find((s) => s.seriesName === 'Reserve');
  await api('POST', `${BASE}/${reserve.id}/set-default`);
  res = await api('POST', `${BASE}/next`, { documentCode: 'PO', financialYearId: 1 });
  check('promoting the reserve resumes it ', res.body?.data?.documentNumber, 'PO-26-27-100');

  // =========================================================================
  section('8. Peek does not consume');
  // =========================================================================
  await restart();
  await api('POST', BASE, payload({ startNumber: 1, endNumber: 999 }));
  const peek1 = await api('POST', `${BASE}/peek`, { documentCode: 'PO', financialYearId: 1 });
  const peek2 = await api('POST', `${BASE}/peek`, { documentCode: 'PO', financialYearId: 1 });
  check('peek is stable across calls      ', [peek1.body?.data?.documentNumber, peek2.body?.data?.documentNumber], ['PO-26-27-000001', 'PO-26-27-000001']);
  check('  ...and left the counter alone  ', (await api('GET', `${BASE}?financialYearId=1`)).body?.data?.[0]?.currentNumber, null);

  // =========================================================================
  section('9. No usable series');
  // =========================================================================
  await restart();
  res = await api('POST', `${BASE}/next`, { documentCode: 'PO', financialYearId: 1 });
  checkErr('allocation with no series at all ', res, 409, 'no numbering series');

  await api('POST', BASE, payload({ startNumber: 1, endNumber: 999 }));
  res = await api('GET', `${BASE}?financialYearId=1`);
  const only = res.body.data[0];
  await api('PUT', `${BASE}/${only.id}`, { status: 'Inactive' });
  res = await api('POST', `${BASE}/next`, { documentCode: 'PO', financialYearId: 1 });
  checkErr('allocation from an inactive one  ', res, 409, 'inactive');

  await api('PUT', `${BASE}/${only.id}`, { status: 'Active', autoGenerate: false, manualEntry: true });
  res = await api('POST', `${BASE}/next`, { documentCode: 'PO', financialYearId: 1 });
  checkErr('allocation with auto-generate off', res, 409, 'auto generate');

  // =========================================================================
  section('10. Reset to default');
  // =========================================================================
  await restart();
  res = await api('POST', `${BASE}/reset`, { financialYearId: 1 });
  check('reset builds the standard set    ', res.body?.data?.length, 16);
  check('  ...one per catalog document    ', new Set(res.body.data.map((r) => r.documentCode)).size, 16);
  check('  ...each marked default         ', res.body.data.every((r) => r.isDefault), true);
  check('  ...each starting at 1          ', res.body.data.every((r) => r.startNumber === 1 && r.nextNumber === 1), true);

  res = await api('POST', `${BASE}/reset`, { financialYearId: 1 });
  check('reset is idempotent              ', res.body?.data?.length, 16);
  check('  ...still exactly one default   ', res.body.data.filter((r) => r.documentCode === 'PO' && r.isDefault).length, 1);

  // A consumed series must survive a reset untouched.
  await api('POST', `${BASE}/next`, { documentCode: 'PO', financialYearId: 1 });
  res = await api('POST', `${BASE}/reset`, { financialYearId: 1 });
  check('reset skips a consumed series    ', /skipped/i.test(res.body?.message || ''), true);
  res = await api('GET', `${BASE}?financialYearId=1`);
  const poAfter = res.body.data.find((r) => r.documentCode === 'PO');
  check('  ...and left its counter alone  ', [poAfter.currentNumber, poAfter.nextNumber], [1, 2]);

  // =========================================================================
  section('11. Rollover to the next financial year');
  // =========================================================================
  await restart();
  await api('POST', BASE, payload({ seriesName: 'Default', startNumber: 1, endNumber: 999, resetEveryFy: true }));
  await api('POST', BASE, payload({ documentCode: 'SI', prefix: 'SI', seriesName: 'Default', startNumber: 1, endNumber: 999, resetEveryFy: false }));
  await api('POST', `${BASE}/next`, { documentCode: 'PO', financialYearId: 1 });
  await api('POST', `${BASE}/next`, { documentCode: 'SI', financialYearId: 1 });
  await api('POST', `${BASE}/next`, { documentCode: 'SI', financialYearId: 1 });

  res = await api('POST', `${BASE}/rollover`, { targetFinancialYearId: 2, sourceFinancialYearId: 1 });
  check('rolls both series forward        ', res.body?.data?.length, 2);

  res = await api('GET', `${BASE}?financialYearId=2`);
  const newPo = res.body.data.find((r) => r.documentCode === 'PO');
  const newSi = res.body.data.find((r) => r.documentCode === 'SI');
  check('  ...reset-every-FY restarts at 1', [newPo.startNumber, newPo.nextNumber], [1, 1]);
  check('  ...carry-forward continues     ', [newSi.startNumber, newSi.nextNumber], [3, 3]);
  check('  ...both start unissued         ', [newPo.currentNumber, newSi.currentNumber], [null, null]);
  check('  ...both become the new default ', [newPo.isDefault, newSi.isDefault], [true, true]);
  check('  ...and pick up the new FY code ', newPo.fyCode, '27-28');

  res = await api('POST', `${BASE}/rollover`, { targetFinancialYearId: 2, sourceFinancialYearId: 1 });
  check('rollover is idempotent           ', res.body?.data?.length, 0);

  res = await api('POST', `${BASE}/rollover`, {});
  checkErr('rollover needs a target year     ', res, 400, 'target financial year');

  // Last year's rows must survive untouched — they are the audit trail.
  res = await api('GET', `${BASE}?financialYearId=1`);
  const oldSi = res.body.data.find((r) => r.documentCode === 'SI');
  check('prior year is left intact        ', [oldSi.currentNumber, oldSi.nextNumber], [2, 3]);

  // =========================================================================
  section('12. Preview');
  // =========================================================================
  res = await api('POST', `${BASE}/preview`, { financialYearId: 1, prefix: 'PO', separator: '-', numberLength: 6, startNumber: 42, includeFyInNumber: true });
  check('previews without persisting      ', res.body?.data?.preview, 'PO-26-27-000042');
  check('  ...and reports the FY code     ', res.body?.data?.fyCode, '26-27');
  check('  ...and the capacity            ', res.body?.data?.maxForLength, 999999);

  res = await api('POST', `${BASE}/preview`, { financialYearId: 1, prefix: 'PO', separator: '-', numberLength: 6, startNumber: 42, includeFyInNumber: false });
  check('previews without the FY segment  ', res.body?.data?.preview, 'PO-000042');

  // =========================================================================
  section('13. Auth');
  // =========================================================================
  const noAuth = await fetch(`${baseUrl}${BASE}?financialYearId=1`);
  check('rejects an unauthenticated read  ', noAuth.status, 401);

  // =========================================================================
  section('14. Full lifecycle — create, use, extend, succeed, retire');
  // =========================================================================
  await restart();

  // 1. Configure a small first block and use it up.
  res = await api('POST', BASE, payload({ seriesName: 'Block-1', startNumber: 1, endNumber: 3, numberLength: 4 }));
  const b1 = res.body.data.id;
  check('lifecycle: block 1 created       ', res.status, 201);

  const b1Numbers = [];
  for (let i = 0; i < 3; i += 1) {
    b1Numbers.push((await api('POST', `${BASE}/next`, { documentCode: 'PO', financialYearId: 1 })).body?.data?.documentNumber);
  }
  check('lifecycle: block 1 fully issued  ', b1Numbers, ['PO-26-27-0001', 'PO-26-27-0002', 'PO-26-27-0003']);

  // 2. Stage the follow-on block from the suggestion the form would use.
  res = await api('GET', `${BASE}/by-document/PO?financialYearId=1`);
  const sug = res.body.data.suggestion;
  check('lifecycle: suggestion continues  ', sug.startNumber, 4);
  check('lifecycle: suggestion keeps prefix', sug.prefix, 'PO');
  check('lifecycle: suggestion names it   ', sug.seriesName, 'Series 1');

  res = await api('POST', BASE, {
    ...payload(),
    seriesName: sug.seriesName,
    prefix: sug.prefix,
    separator: sug.separator,
    numberLength: sug.numberLength,
    includeFyInNumber: sug.includeFyInNumber,
    startNumber: sug.startNumber,
    endNumber: sug.endNumber,
  });
  check('lifecycle: block 2 saves clean   ', res.status, 201);
  const b2 = res.body.data.id;

  // 3. Promote it and confirm numbering continues without a gap or repeat.
  await api('POST', `${BASE}/${b2}/set-default`);
  res = await api('POST', `${BASE}/next`, { documentCode: 'PO', financialYearId: 1 });
  check('lifecycle: numbering continues   ', res.body?.data?.documentNumber, 'PO-26-27-0004');

  // 4. Retire the spent block; the live one is untouched.
  await api('PUT', `${BASE}/${b1}`, { status: 'Inactive' });
  res = await api('GET', `${BASE}?financialYearId=1`);
  const spent = res.body.data.find((r) => r.id === b1);
  const liveB2 = res.body.data.find((r) => r.id === b2);
  // 'Completed' outranks 'Inactive' in displayStatus: once the counter is past
  // End No. the range is spent regardless of the stored status, and that is
  // the more useful thing to show. The stored value is still Inactive.
  check('lifecycle: spent block retired   ', [spent.displayStatus, spent.status], ['Completed', 'Inactive']);
  check('lifecycle: live block still fine ', liveB2.displayStatus, 'Active');
  check('lifecycle: exactly one default   ', res.body.data.filter((r) => r.isDefault).length, 1);

  // 5. No number was ever issued twice.
  const all = [...b1Numbers, 'PO-26-27-0004'];
  check('lifecycle: no duplicate numbers  ', new Set(all).size, all.length);

  // =========================================================================
  section('15. Edge cases and input coercion');
  // =========================================================================
  await restart();

  // The form sends zero-padded strings once No. of Length in Series is
  // changed ("001100"), so the API has to accept them as numbers.
  res = await api('POST', BASE, payload({ seriesName: 'Padded', startNumber: '001100', endNumber: '001998', numberLength: '6' }));
  check('accepts zero-padded string input ', res.status, 201);
  check('  ...coerced to real numbers     ', [res.body?.data?.startNumber, res.body?.data?.endNumber], [1100, 1998]);
  check('  ...and numberLength too        ', res.body?.data?.numberLength, 6);
  const paddedId = res.body?.data?.id;

  // A prefix must be stored canonically, or 'PO' and 'po' become two series
  // whose issued numbers are indistinguishable on paper.
  res = await api('POST', BASE, payload({ seriesName: 'Lower', prefix: 'po', startNumber: 5000, endNumber: 5999 }));
  check('normalises prefix to upper case  ', res.body?.data?.prefix, 'PO');

  res = await api('POST', BASE, payload({ seriesName: 'Sfx', prefix: 'PO', suffix: 'ab', startNumber: 7000, endNumber: 7999 }));
  check('normalises suffix to upper case  ', res.body?.data?.suffix, 'AB');
  const sfxId = res.body?.data?.id;

  res = await api('PUT', `${BASE}/${sfxId}`, { suffix: '' });
  check('clearing the suffix nulls it     ', res.body?.data?.suffix, null);

  // Series names are compared case-insensitively, so this is a duplicate.
  res = await api('POST', BASE, payload({ seriesName: 'PADDED', startNumber: 8000, endNumber: 8999 }));
  checkErr('duplicate name is case-blind     ', res, 400, 'already exists');

  res = await api('POST', BASE, payload({ seriesName: '   Padded   ', startNumber: 8000, endNumber: 8999 }));
  checkErr('  ...and whitespace-blind        ', res, 400, 'already exists');

  // Explicitly asking for default on create must demote the incumbent rather
  // than leave two rows claiming it.
  res = await api('POST', BASE, { ...payload({ seriesName: 'Promoted', startNumber: 9000, endNumber: 9999 }), isDefault: true });
  check('create with isDefault promotes   ', res.body?.data?.isDefault, true);
  res = await api('GET', `${BASE}?financialYearId=1`);
  check('  ...and leaves exactly one       ', res.body.data.filter((r) => r.isDefault).length, 1);
  check('  ...demoting the previous one    ', res.body.data.find((r) => r.id === paddedId)?.isDefault, false);

  // Shrinking the padding below what End No. needs must be refused.
  res = await api('PUT', `${BASE}/${paddedId}`, { numberLength: 3 });
  checkErr('rejects padding too small to fit ', res, 400, 'cannot exceed');

  // Moving a series to another financial year re-checks it against that
  // year's siblings, not the old year's.
  res = await api('PUT', `${BASE}/${paddedId}`, { financialYearId: 2 });
  check('moves a series to another FY     ', res.body?.data?.financialYearId, 2);
  check('  ...and restamps the FY code    ', res.body?.data?.fyCode, '27-28');

  // Reset must not overwrite a hand-made series sitting in the default range.
  await restart();
  await api('POST', BASE, payload({ seriesName: 'Custom', startNumber: 1, endNumber: 999 }));
  res = await api('POST', `${BASE}/reset`, { financialYearId: 1 });
  check('reset skips an occupied range    ', /custom series in range/i.test(res.body?.message || ''), true);
  res = await api('GET', `${BASE}?financialYearId=1`);
  const custom = res.body.data.find((r) => r.documentCode === 'PO');
  check('  ...leaving the custom series   ', [custom.seriesName, custom.endNumber], ['Custom', 999]);
  check('  ...and still one PO series     ', res.body.data.filter((r) => r.documentCode === 'PO').length, 1);

  // Regression: a row still named 'Default' (the naming convention before it
  // was renamed to 'Series 1') is what Reset itself created and must still
  // recognise as its own baseline series — not mistake for a hand-made
  // 'Custom' series occupying the same range and skip touching it, which is
  // exactly what silently broke Reset to Default for every database that
  // hadn't had the rename migration applied.
  await restart();
  await api('POST', BASE, payload({ seriesName: 'Default', startNumber: 1, endNumber: 999999 }));
  res = await api('POST', `${BASE}/reset`, { financialYearId: 1 });
  check('reset recognises a legacy "Default" row', /custom series in range/i.test(res.body?.message || ''), false);
  res = await api('GET', `${BASE}?financialYearId=1`);
  const renamed = res.body.data.find((r) => r.documentCode === 'PO');
  check('  ...and renames it to "Series 1"  ', renamed.seriesName, 'Series 1');
  check('  ...still just one PO series      ', res.body.data.filter((r) => r.documentCode === 'PO').length, 1);

  // =========================================================================
  section('16. Legacy rows and no-op updates');
  // =========================================================================
  // Rows written before prefixes were canonicalised still exist in the wild.
  // Editing anything on such a row must not trip the locked-pattern rule just
  // because the incoming value is now upper-cased on its way through.
  await restart({
    documentNumbering: [{
      id: 50, documentCode: 'PO', documentName: 'Purchase Order', seriesName: 'Legacy',
      financialYearId: 1, fyCode: '26-27', prefix: 'po', suffix: 'x', separator: '-',
      includeFyInNumber: true, numberLength: 6, startNumber: 1, currentNumber: 5,
      nextNumber: 6, endNumber: 999, resetEveryFy: true, autoGenerate: true,
      manualEntry: false, status: 'Active', isDefault: true, lastNumberAt: new Date(),
    }],
  });

  res = await api('PUT', `${BASE}/50`, { status: 'Inactive' });
  check('retires a legacy lowercase row   ', res.status, 200);
  check('  ...without a false lock error  ', res.body?.data?.status, 'Inactive');

  await api('PUT', `${BASE}/50`, { status: 'Active' });
  res = await api('PUT', `${BASE}/50`, { manualEntry: true });
  check('toggles a switch on a legacy row ', res.status, 200);

  res = await api('PUT', `${BASE}/50`, { endNumber: 5000 });
  check('extends End No. on a legacy row  ', res.body?.data?.endNumber, 5000);

  // An empty PUT is a no-op, not a validation failure.
  res = await api('PUT', `${BASE}/50`, {});
  check('an empty PUT is a no-op          ', res.status, 200);

  // ...but a genuine pattern change on a consumed row is still refused.
  res = await api('PUT', `${BASE}/50`, { prefix: 'PUR' });
  checkErr('and a real prefix change is kept ', res, 400, 'cannot be changed');

  // The consumed row still allocates — and keeps its original casing. Numbers
  // 1-5 already went out as 'po-...', so the pattern must not switch to
  // 'PO-...' partway through just because the row was edited.
  res = await api('POST', `${BASE}/next`, { documentCode: 'PO', financialYearId: 1 });
  check('legacy row keeps its own pattern ', res.body?.data?.documentNumber, 'po-26-27-000006-x');

  res = await api('GET', `${BASE}/50`);
  check('  ...and its stored prefix       ', [res.body?.data?.prefix, res.body?.data?.suffix], ['po', 'x']);

  // =========================================================================
  console.log('\nSummary');
  console.log('-------\n');
  console.log(`  ${passed} passed, ${failed} failed\n`);
  if (failures.length) {
    console.log('Failures:');
    failures.forEach((f) => console.log(`  - ${f}\n`));
  }

  await new Promise((r) => server.close(r));
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error('\nHarness crashed:\n', err);
  process.exit(1);
});
