/**
 * Manual Entry means genuinely free-form — bug fix.
 *
 * Reported symptom: on Product Master, with Manual Entry toggled ON for the
 * Product (PRD) numbering series, typing any product code that didn't
 * exactly fit that series' own prefix/digit pattern (e.g. "SHOE-RED-42",
 * with no "PRD-" prefix at all) was rejected on save with "Number must
 * match the series pattern PRD-000001".
 *
 * Root cause: validateManualNumber (services/documentNumberService.js) still
 * enforced the series' own regex pattern and start/end range on a manually
 * typed number — mirroring SAP B1's "manual" mode, which only lets the user
 * PICK a number from the series rather than type anything. This app's
 * Manual Entry toggle, though, is documented (see DocumentNoField.jsx) as
 * "the field is left blank and fully editable so the user types the number
 * themselves" — nothing there says it still has to fit the series' pattern,
 * and every user-facing hint (a blank, unrestricted text field) says
 * otherwise. Confirmed with the user: Manual Entry should accept any
 * non-empty value, verbatim, across every document type this numbering
 * engine serves (masters and transactions alike) — not just Product.
 *
 * These tests exercise validateManualNumber directly — a pure, DB-independent
 * function — against fabricated series rows, the same "small pure function,
 * no fake db needed" idiom seriesSelection.test.js/masterNumbering.test.js
 * already use for the rest of this module.
 *
 * Run with:  node --test "src/tests/*.test.js"
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { validateManualNumber } = require('../services/documentNumberService');

function makeSeries(overrides = {}) {
  return {
    id: 1,
    documentCode: 'PRD',
    seriesName: 'Series 1',
    manualEntry: true,
    prefix: 'PRD',
    separator: '-',
    fyCode: '',
    includeFyInNumber: false,
    suffix: '',
    numberLength: 6,
    startNumber: 1,
    endNumber: 999999,
    ...overrides,
  };
}

test('a manually typed value that does not fit the series pattern at all is still accepted verbatim (the reported bug)', () => {
  const series = makeSeries();
  const result = validateManualNumber(series, 'SHOE-RED-42');
  assert.equal(result.valid, true);
  assert.equal(result.documentNumber, 'SHOE-RED-42');
});

test('a manually typed value outside the series start/end range is still accepted (range no longer enforced)', () => {
  const series = makeSeries({ startNumber: 1, endNumber: 100 });
  const result = validateManualNumber(series, 'PRD-999999');
  assert.equal(result.valid, true);
  assert.equal(result.documentNumber, 'PRD-999999');
  // Still parses a numeric value for the counter-sync path below, even
  // though it is out of the configured range — syncAfterManualNumber's own
  // WHERE clause is what actually no-ops safely on an out-of-range value.
  assert.equal(result.value, 999999);
});

test('a value that DOES fit the series pattern still yields its parsed numeric value, for counter-sync', () => {
  const series = makeSeries();
  const result = validateManualNumber(series, 'PRD-000025');
  assert.equal(result.valid, true);
  assert.equal(result.documentNumber, 'PRD-000025');
  assert.equal(result.value, 25);
});

test('a genuinely free-form value with no digits at all has nothing to sync, but still saves', () => {
  const series = makeSeries();
  const result = validateManualNumber(series, 'ACME-WIDGET');
  assert.equal(result.valid, true);
  assert.equal(result.documentNumber, 'ACME-WIDGET');
  assert.equal(result.value, null);
});

test('an empty/blank manual number is still rejected — free-form does not mean optional', () => {
  const series = makeSeries();
  assert.equal(validateManualNumber(series, '   ').valid, false);
  assert.equal(validateManualNumber(series, '').valid, false);
  assert.equal(validateManualNumber(series, null).valid, false);
});

test('Manual Entry actually being off is still rejected regardless of what was typed', () => {
  const series = makeSeries({ manualEntry: false });
  const result = validateManualNumber(series, 'PRD-000001');
  assert.equal(result.valid, false);
  assert.match(result.reason, /Manual entry is turned off/);
});

test('no series configured is still rejected', () => {
  const result = validateManualNumber(null, 'PRD-000001');
  assert.equal(result.valid, false);
  assert.match(result.reason, /No numbering series is configured/);
});
