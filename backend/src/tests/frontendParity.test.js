/**
 * Frontend/backend calculation parity.
 *
 * The document pages compute totals locally so the totals panel updates as the
 * user types, and the server recomputes them on save. If the two ever
 * disagree, the user sees one grand total and the ledger records another — the
 * kind of defect that is only noticed weeks later when a customer queries an
 * invoice.
 *
 * Before frontend/src/lib/documentTotals.js existed, eight pages each carried
 * their own copy of the arithmetic and several of them had already drifted
 * from the server. This test fails the build if they drift again.
 *
 * Run with:  node --test "src/tests/*.test.js"
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const backend = require('../utils/documentTotals');

const FRONTEND_MODULE = pathToFileURL(
  path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'lib', 'documentTotals.js')
).href;

let frontend;
test.before(async () => {
  frontend = await import(FRONTEND_MODULE);
});

test('the frontend module exports the same surface as the backend one', () => {
  for (const name of ['round2', 'num', 'isInterState', 'normaliseLine', 'computeTotals', 'buildDocument']) {
    assert.equal(typeof frontend[name], 'function', `frontend is missing ${name}`);
  }
});

test('round2 agrees on the values that expose float representation error', () => {
  const cases = [
    1.005, 8.165, 2.675, -1.005, 0.1 + 0.2, 1234567.891, 99999999.999,
    0, -0, 0.004, 0.005, -0.005, 1e-9, 12.345, 1 / 3,
  ];
  for (const v of cases) {
    assert.equal(frontend.round2(v), backend.round2(v), `round2(${v})`);
  }
});

test('inter-state determination agrees', () => {
  const cases = [
    ['Karnataka', 'Tamil Nadu'],
    ['Tamil Nadu', 'tamil nadu'],
    ['  Tamil Nadu  ', 'Tamil Nadu'],
    ['', 'Tamil Nadu'],
    ['Karnataka', ''],
    [null, undefined],
    ['Delhi', 'Delhi'],
  ];
  for (const [a, b] of cases) {
    assert.equal(frontend.isInterState(a, b), backend.isInterState(a, b), `isInterState(${a}, ${b})`);
  }
});

test('the two engines agree on 2000 randomised documents, including TCS-typed lines', () => {
  const rates = [0, 5, 12, 18, 28];
  const taxTypes = ['GST', 'IGST', 'GST+TCS', 'IGST+TCS', '', undefined];
  let seed = 20260807;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  for (let doc = 0; doc < 2000; doc += 1) {
    const items = Array.from({ length: 1 + Math.floor(rnd() * 10) }, () => ({
      quantity: backend.round2(rnd() * 250),
      unitPrice: backend.round2(rnd() * 9999),
      discountPercent: backend.round2(rnd() * 40),
      taxPercent: rates[Math.floor(rnd() * rates.length)],
      taxType: taxTypes[Math.floor(rnd() * taxTypes.length)],
    }));
    const headerDiscount = backend.round2(rnd() * 20);
    const options = { interState: rnd() > 0.5, roundOff: rnd() > 0.3 };

    const be = backend.buildDocument(items, headerDiscount, options);
    const fe = frontend.buildDocument(items, headerDiscount, options);

    assert.deepEqual(fe.totals, be.totals, `doc ${doc}: header totals diverged`);
    assert.deepEqual(fe.lines, be.lines, `doc ${doc}: line amounts diverged`);
  }
});

test('the two engines agree on TCS-specific fixed cases (GST+TCS, IGST+TCS, mixed)', () => {
  const cases = [
    { items: [{ quantity: 1, unitPrice: 1000, taxPercent: 19, taxType: 'GST+TCS' }], discount: 0, options: {} },
    { items: [{ quantity: 1, unitPrice: 1000, taxPercent: 19, taxType: 'IGST+TCS' }], discount: 0, options: { interState: true } },
    {
      items: [
        { quantity: 1, unitPrice: 1000, taxPercent: 18, taxType: 'GST' },
        { quantity: 1, unitPrice: 1000, taxPercent: 19, taxType: 'GST+TCS' },
      ],
      discount: 10,
      options: { roundOff: true },
    },
  ];
  for (const { items, discount, options } of cases) {
    const be = backend.buildDocument(items, discount, options);
    const fe = frontend.buildDocument(items, discount, options);
    assert.deepEqual(fe.totals, be.totals, `${JSON.stringify(items)} header totals diverged`);
  }
});

test('the two engines agree on GRN-shaped documents', () => {
  const items = [
    { receivedQuantity: 7.5, unitPrice: 133.33, taxPercent: 5 },
    { receivedQuantity: 0, unitPrice: 99.99, taxPercent: 18 },
    { receivedQuantity: 12, unitPrice: 1.01, discountPercent: 7.5, taxPercent: 12 },
  ];
  const options = { quantityField: 'receivedQuantity', roundOff: true };
  assert.deepEqual(
    frontend.buildDocument(items, 3, options).totals,
    backend.buildDocument(items, 3, options).totals
  );
});

test('the two engines agree on degenerate and hostile input', () => {
  const cases = [
    [[], 0],
    [[{ quantity: 'abc', unitPrice: null }], 'nope'],
    [[{ quantity: 1, unitPrice: 100, taxPercent: 18 }, { quantity: -1, unitPrice: 100, taxPercent: 18 }], 10],
    [[{ quantity: -2, unitPrice: 500, taxPercent: 18 }], 0],
    [[{ quantity: 1, unitPrice: 500, taxPercent: 18 }], 100],
    [null, 0],
    [undefined, 5],
  ];
  for (const [items, discount] of cases) {
    for (const options of [{}, { interState: true }, { roundOff: true }]) {
      assert.deepEqual(
        frontend.buildDocument(items, discount, options).totals,
        backend.buildDocument(items, discount, options).totals,
        `items=${JSON.stringify(items)} discount=${discount} options=${JSON.stringify(options)}`
      );
    }
  }
});
