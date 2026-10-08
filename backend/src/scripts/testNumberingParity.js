/**
 * Front-end / back-end numbering parity.
 *
 * frontend/src/lib/documentNumbering.js exists so the Add/Edit form can render
 * its Preview on every keystroke without a round trip, and its header says it
 * mirrors backend/src/services/documentNumberService.js. Nothing enforced that
 * claim until this script: if the two drift, the number a user is shown in the
 * Preview stops matching the number the server actually issues, which is the
 * one bug in this module a user cannot possibly diagnose.
 *
 * Fuzzes both implementations over the same inputs and asserts identical output.
 *
 *   npm run test:parity
 */

const path = require('path');
const { pathToFileURL } = require('url');

const be = require('../services/documentNumberService');

const FRONTEND_LIB = path.resolve(
  __dirname, '..', '..', '..', 'frontend', 'src', 'lib', 'documentNumbering.js'
);

let passed = 0;
let failed = 0;
const failures = [];

function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(`${label}\n         expected: ${e}\n         actual:   ${a}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
}

(async function run() {
  let fe;
  try {
    fe = await import(pathToFileURL(FRONTEND_LIB).href);
  } catch (err) {
    console.error(`Could not load the frontend lib at ${FRONTEND_LIB}\n`, err.message);
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  section('1. Constants agree');
  // -------------------------------------------------------------------------
  check('separator values', fe.SEPARATOR_VALUES, be.SEPARATOR_VALUES);
  check('min number length', fe.MIN_NUMBER_LENGTH, be.MIN_NUMBER_LENGTH);
  check('max number length', fe.MAX_NUMBER_LENGTH, be.MAX_NUMBER_LENGTH);
  check('number length options', fe.NUMBER_LENGTH_OPTIONS.map((o) => o.value), be.NUMBER_LENGTH_OPTIONS);
  console.log(`  ${failed === 0 ? 'ok' : 'see failures'} — ${passed} constant checks`);

  // -------------------------------------------------------------------------
  section('2. maxValueForLength / clampLength / padNumber');
  // -------------------------------------------------------------------------
  const lengths = [-3, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 20, NaN, undefined, null, '6'];
  for (const len of lengths) {
    check(`maxValueForLength(${JSON.stringify(len)})`, fe.maxValueForLength(len), be.maxValueForLength(len));
    check(`clampLength(${JSON.stringify(len)})`, fe.clampLength(len), be.clampLength(len));
  }

  const values = [0, 1, 7, 99, 100, 999, 1000, 123456, 999999, 1000000, 999999999999];
  for (const len of [1, 3, 4, 6, 8, 12]) {
    for (const v of values) {
      check(`padNumber(${v}, ${len})`, fe.padNumber(v, len), be.padNumber(v, len));
    }
  }
  console.log(`  ${failures.length === 0 ? 'ok' : 'see failures'} — padding and clamping agree`);

  // -------------------------------------------------------------------------
  section('3. deriveFyCode');
  // -------------------------------------------------------------------------
  const fys = [
    null,
    undefined,
    { startDate: '2026-04-01', endDate: '2027-03-31' },
    { startDate: '2027-04-01T00:00:00.000Z', endDate: '2028-03-31T00:00:00.000Z' },
    { financialYearName: '2026-2027' },
    { financialYearName: '2026 - 2027' },
    { financialYearName: '26-27' },
    { financialYearName: '2026' },
    { financialYearName: 'FY 2099-2100' },
    { financialYearName: 'no digits here' },
    { financialYearName: '', startDate: null, endDate: null },
    { startDate: 'not-a-date', endDate: 'also-bad', financialYearName: '2030-2031' },
  ];
  for (const fy of fys) {
    check(`deriveFyCode(${JSON.stringify(fy)})`, fe.deriveFyCode(fy), be.deriveFyCode(fy));
  }
  console.log(`  ${failures.length === 0 ? 'ok' : 'see failures'} — FY codes agree`);

  // -------------------------------------------------------------------------
  section('4. buildDocumentNumber — exhaustive over realistic shapes');
  // -------------------------------------------------------------------------
  const prefixes = ['PO', '', null, undefined, 'INVOICE123', '  PO  '];
  const suffixes = ['', null, undefined, 'A', 'XYZ'];
  const separators = ['-', '/', '_', '.', '', '|', undefined, null];
  const fyCodes = ['26-27', '', null, undefined];
  const includeFy = [true, false];
  const lens = [1, 3, 6, 12];
  const nums = [0, 1, 42, 999999, 1000000];

  let combos = 0;
  for (const prefix of prefixes) {
    for (const suffix of suffixes) {
      for (const separator of separators) {
        for (const fyCode of fyCodes) {
          for (const includeFyInNumber of includeFy) {
            for (const numberLength of lens) {
              for (const value of nums) {
                const shape = { prefix, suffix, separator, fyCode, includeFyInNumber, numberLength };
                combos += 1;
                check(
                  `buildDocumentNumber(${JSON.stringify(shape)}, ${value})`,
                  fe.buildDocumentNumber(shape, value),
                  be.buildDocumentNumber(shape, value)
                );
              }
            }
          }
        }
      }
    }
  }
  console.log(`  ${failures.length === 0 ? 'ok' : 'see failures'} — ${combos} shape/value combinations agree`);

  // An empty shape and a missing shape must not throw in either place.
  check('buildDocumentNumber(null, 5)', fe.buildDocumentNumber(null, 5), be.buildDocumentNumber(null, 5));
  check('buildDocumentNumber({}, 5)', fe.buildDocumentNumber({}, 5), be.buildDocumentNumber({}, 5));

  // -------------------------------------------------------------------------
  section('5. Preview matches what the server would actually issue');
  // -------------------------------------------------------------------------
  // The real risk this file guards against: the form previews one string and
  // the allocator writes a different one. Compare the form's preview call
  // against the backend's own peek for the same row.
  const series = [
    { prefix: 'PO', suffix: null, separator: '-', fyCode: '26-27', includeFyInNumber: true, numberLength: 6, startNumber: 1, currentNumber: null, nextNumber: 1, endNumber: 999999 },
    { prefix: 'SI', suffix: 'A', separator: '/', fyCode: '27-28', includeFyInNumber: true, numberLength: 4, startNumber: 100, currentNumber: 104, nextNumber: 105, endNumber: 999 },
    { prefix: null, suffix: null, separator: '', fyCode: null, includeFyInNumber: false, numberLength: 3, startNumber: 1, currentNumber: null, nextNumber: 7, endNumber: 999 },
    { prefix: 'DC', suffix: null, separator: '.', fyCode: '26-27', includeFyInNumber: false, numberLength: 8, startNumber: 5, currentNumber: null, nextNumber: 5, endNumber: 99999999 },
  ];
  for (const s of series) {
    const decorated = be.decorateSeries(s);
    check(
      `preview vs peek ${s.prefix}/${s.separator}/${s.numberLength}`,
      fe.buildDocumentNumber(s, s.nextNumber),
      decorated.nextNumberFormatted
    );
  }
  console.log(`  ${failures.length === 0 ? 'ok' : 'see failures'} — previews match issued numbers`);

  // -------------------------------------------------------------------------
  section('6. Consumption colouring');
  // -------------------------------------------------------------------------
  const rows = [
    { startNumber: 1, endNumber: 100, currentNumber: null, pct: 0, colour: 'text.primary' },
    { startNumber: 1, endNumber: 100, currentNumber: 1, pct: 1, colour: 'text.primary' },
    { startNumber: 1, endNumber: 100, currentNumber: 50, pct: 50, colour: 'text.primary' },
    { startNumber: 1, endNumber: 100, currentNumber: 79, pct: 79, colour: 'text.primary' },
    { startNumber: 1, endNumber: 100, currentNumber: 80, pct: 80, colour: 'warning.main' },
    { startNumber: 1, endNumber: 100, currentNumber: 89, pct: 89, colour: 'warning.main' },
    { startNumber: 1, endNumber: 100, currentNumber: 90, pct: 90, colour: 'error.main' },
    { startNumber: 1, endNumber: 100, currentNumber: 100, pct: 100, colour: 'error.main' },
    // Ranges that don't start at 1 must be measured against their own span.
    { startNumber: 1000, endNumber: 1099, currentNumber: 1089, pct: 90, colour: 'error.main' },
    { startNumber: 1000, endNumber: 1099, currentNumber: 1000, pct: 1, colour: 'text.primary' },
    // Degenerate range must not divide by zero or go negative.
    { startNumber: 10, endNumber: 5, currentNumber: null, pct: 0, colour: 'text.primary' },
  ];
  for (const r of rows) {
    check(`consumption ${r.startNumber}-${r.endNumber}@${r.currentNumber}`, Math.round(fe.consumptionPercent(r)), r.pct);
    check(`colour ${r.startNumber}-${r.endNumber}@${r.currentNumber}`, fe.currentNumberColor(r), r.colour);
  }
  console.log(`  ${failures.length === 0 ? 'ok' : 'see failures'} — thresholds behave at the boundaries`);

  // -------------------------------------------------------------------------
  console.log('\nSummary');
  console.log('-------\n');
  console.log(`  ${passed} passed, ${failed} failed\n`);
  if (failures.length) {
    console.log('Failures:');
    failures.slice(0, 40).forEach((f) => console.log(`  - ${f}\n`));
    if (failures.length > 40) console.log(`  ...and ${failures.length - 40} more\n`);
  }
  process.exit(failed ? 1 : 0);
})();
