/**
 * Reissuing document numbers freed up by a deletion.
 *
 * The defect: the counter only ever moved forward. Entering SQ-000001 through
 * SQ-000005 and then deleting SQ-000004 and SQ-000005 left the next save
 * taking SQ-000006 — the two deleted numbers were retired permanently, with no
 * way to put them back into circulation.
 *
 * findLowestFreeNumber() is what fixes it: it reads the numbers actually
 * stored in the document's own table and returns the first hole below the
 * counter. These tests pin its behaviour directly, since that function is the
 * whole of the decision — allocateDocumentNumber() just uses what it returns.
 *
 * Run with:  node --test "src/tests/*.test.js"
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractSeriesValue,
  findLowestFreeNumber,
  buildDocumentNumber,
  DOCUMENT_TABLE_SOURCES,
  DOCUMENT_CATALOG,
} = require('../services/documentNumberService');

/** A Sales Quotation series in the app's default shape: SQ-000001, SQ-000002… */
const SQ_SERIES = {
  id: 1,
  prefix: 'SQ',
  suffix: null,
  separator: '-',
  numberLength: 6,
  includeFyInNumber: false,
  fyCode: null,
  startNumber: 1,
  endNumber: 999999,
  currentNumber: 5,
  nextNumber: 6,
};

/**
 * Stand-in for the Prisma client exposing exactly the one call
 * findLowestFreeNumber makes: client[model].findMany({ select }).
 */
function stubClient(model, field, numbers) {
  return {
    [model]: {
      findMany: async () => numbers.map((n) => ({ [field]: n })),
    },
  };
}

// ---------------------------------------------------------------------------
// Reading a stored number back to its counter value
// ---------------------------------------------------------------------------

test('extractSeriesValue reads back a number this series issued', () => {
  assert.equal(extractSeriesValue('SQ-000004', SQ_SERIES), 4);
  assert.equal(extractSeriesValue('SQ-000123', SQ_SERIES), 123);
});

test('extractSeriesValue falls back to trailing digits for foreign formats', () => {
  // Hand-typed before the series existed — not this series' pattern, but the
  // number it occupies still has to count as taken.
  assert.equal(extractSeriesValue('QUOTE/2024/7', SQ_SERIES), 7);
});

test('extractSeriesValue ignores blanks and non-numeric values', () => {
  assert.equal(extractSeriesValue('', SQ_SERIES), null);
  assert.equal(extractSeriesValue(null, SQ_SERIES), null);
  assert.equal(extractSeriesValue('DRAFT', SQ_SERIES), null);
});

test('extractSeriesValue honours a series that carries the FY token', () => {
  const withFy = { ...SQ_SERIES, includeFyInNumber: true, fyCode: '2526' };
  assert.equal(extractSeriesValue('SQ-2526-000004', withFy), 4);
});

// ---------------------------------------------------------------------------
// Finding the hole
// ---------------------------------------------------------------------------

test('the reported case: 5 issued, top 2 deleted, next save reuses the lower hole', async () => {
  const client = stubClient('salesQuotation', 'quotationNo', [
    'SQ-000001', 'SQ-000002', 'SQ-000003',
  ]);
  const free = await findLowestFreeNumber('SQ', SQ_SERIES, client);
  assert.equal(free, 4, 'SQ-000004 was deleted and must be handed out again');
  assert.equal(buildDocumentNumber(SQ_SERIES, free), 'SQ-000004');
});

test('a hole in the middle is reused before an untouched tail', async () => {
  const client = stubClient('salesQuotation', 'quotationNo', [
    'SQ-000001', 'SQ-000003', 'SQ-000004', 'SQ-000005',
  ]);
  assert.equal(await findLowestFreeNumber('SQ', SQ_SERIES, client), 2);
});

test('the lowest of several holes wins', async () => {
  const client = stubClient('salesQuotation', 'quotationNo', ['SQ-000003']);
  assert.equal(await findLowestFreeNumber('SQ', SQ_SERIES, client), 1);
});

test('no hole means no reuse — the ordinary counter takes over', async () => {
  const client = stubClient('salesQuotation', 'quotationNo', [
    'SQ-000001', 'SQ-000002', 'SQ-000003', 'SQ-000004', 'SQ-000005',
  ]);
  assert.equal(
    await findLowestFreeNumber('SQ', SQ_SERIES, client),
    null,
    'every number below the counter is in use, so allocate must move forward instead'
  );
});

test('a series that has never issued anything reports no hole', async () => {
  const fresh = { ...SQ_SERIES, currentNumber: null, nextNumber: 1 };
  const client = stubClient('salesQuotation', 'quotationNo', []);
  assert.equal(await findLowestFreeNumber('SQ', fresh, client), null);
});

test('numbers at or above the counter are never offered', async () => {
  // Nothing stored at all, but the counter has moved to 6 — the scan must stay
  // strictly below it and never propose 6 itself (that is the counter's job,
  // and proposing it here would hand the same number out twice).
  const client = stubClient('salesQuotation', 'quotationNo', []);
  const free = await findLowestFreeNumber('SQ', SQ_SERIES, client);
  assert.ok(free < SQ_SERIES.nextNumber, `${free} must be below nextNumber ${SQ_SERIES.nextNumber}`);
});

test('the scan starts at the series Start No., not at 1', async () => {
  const from100 = { ...SQ_SERIES, startNumber: 100, currentNumber: 102, nextNumber: 103 };
  const client = stubClient('salesQuotation', 'quotationNo', ['SQ-000100', 'SQ-000102']);
  assert.equal(await findLowestFreeNumber('SQ', from100, client), 101);
});

test('a number in a foreign format still blocks its slot', async () => {
  // SQ-000002 was deleted but something else is sitting on the number 2 in a
  // different format. Reusing 2 would collide on the UNIQUE column.
  const client = stubClient('salesQuotation', 'quotationNo', [
    'SQ-000001', 'OLD/2', 'SQ-000003', 'SQ-000004', 'SQ-000005',
  ]);
  assert.equal(await findLowestFreeNumber('SQ', SQ_SERIES, client), null);
});

// ---------------------------------------------------------------------------
// Coverage: this has to work on every page, not just Sales Quotation
// ---------------------------------------------------------------------------

test('every catalog document type has a table to scan', () => {
  const missing = DOCUMENT_CATALOG
    .map((d) => d.code)
    .filter((code) => !DOCUMENT_TABLE_SOURCES[code]);
  assert.deepEqual(missing, [], 'a type with no mapping silently loses gap reuse');
});

test('gap reuse works for a master series too', async () => {
  const cusSeries = { ...SQ_SERIES, prefix: 'CUS', currentNumber: 3, nextNumber: 4 };
  const client = stubClient('customer', 'customerCode', ['CUS-000001', 'CUS-000003']);
  assert.equal(await findLowestFreeNumber('CUS', cusSeries, client), 2);
});

test('an unknown document code degrades to no reuse rather than throwing', async () => {
  assert.equal(await findLowestFreeNumber('NOPE', SQ_SERIES, {}), null);
});
