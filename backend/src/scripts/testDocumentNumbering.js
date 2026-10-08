/**
 * Test harness for the document numbering engine.
 *
 *   node src/scripts/testDocumentNumbering.js
 *
 * Covers the pure half of services/documentNumberService.js — number
 * assembly, padding, FY-code derivation, previews, validation rules and
 * manual-entry parsing. No database required.
 *
 * The persistence half (allocateDocumentNumber) is deliberately not mocked:
 * its correctness rests entirely on PostgreSQL evaluating a single conditional
 * UPDATE, which a fake client would not reproduce. See the concurrency note at
 * the bottom for how to exercise it against a real database.
 */

const N = require('../services/documentNumberService');

let passed = 0;
let failed = 0;
const failures = [];

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

function section(title) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
}

// ---------------------------------------------------------------------------
section('1. Number assembly — the pattern from the mockups');
// ---------------------------------------------------------------------------
const po = { prefix: 'PO', separator: '-', fyCode: '26-27', includeFyInNumber: true, numberLength: 6, suffix: null };

check('PO first number                ', N.buildDocumentNumber(po, 1), 'PO-26-27-000001');
check('PO current (mockup row 1)      ', N.buildDocumentNumber(po, 125), 'PO-26-27-000125');
check('PO next (mockup row 1)         ', N.buildDocumentNumber(po, 126), 'PO-26-27-000126');
check('GRN next (mockup row 2)        ', N.buildDocumentNumber({ ...po, prefix: 'GRN' }, 83), 'GRN-26-27-000083');
check('PI next (mockup row 3)         ', N.buildDocumentNumber({ ...po, prefix: 'PI' }, 135), 'PI-26-27-000135');
check('SO next (mockup row 4)         ', N.buildDocumentNumber({ ...po, prefix: 'SO' }, 216), 'SO-26-27-000216');
check('DC next (mockup row 5)         ', N.buildDocumentNumber({ ...po, prefix: 'DC' }, 199), 'DC-26-27-000199');
check('SI next (mockup row 6)         ', N.buildDocumentNumber({ ...po, prefix: 'SI' }, 1257), 'SI-26-27-001257');
check('SRC next (mockup row 7)        ', N.buildDocumentNumber({ ...po, prefix: 'SRC' }, 46), 'SRC-26-27-000046');
check('SIG next (mockup row 8)        ', N.buildDocumentNumber({ ...po, prefix: 'SIG' }, 68), 'SIG-26-27-000068');
check('RV next (mockup row 9)         ', N.buildDocumentNumber({ ...po, prefix: 'RV' }, 543), 'RV-26-27-000543');
check('PV next (mockup row 10)        ', N.buildDocumentNumber({ ...po, prefix: 'PV' }, 488), 'PV-26-27-000488');

// ---------------------------------------------------------------------------
section('2. Separator variants');
// ---------------------------------------------------------------------------
check('slash                          ', N.buildDocumentNumber({ ...po, separator: '/' }, 1), 'PO/26-27/000001');
check('underscore                     ', N.buildDocumentNumber({ ...po, separator: '_' }, 1), 'PO_26-27_000001');
check('dot                            ', N.buildDocumentNumber({ ...po, separator: '.' }, 1), 'PO.26-27.000001');
check('none                           ', N.buildDocumentNumber({ ...po, separator: '' }, 1), 'PO26-27000001');
check('unknown separator falls to "-" ', N.buildDocumentNumber({ ...po, separator: '#' }, 1), 'PO-26-27-000001');

// ---------------------------------------------------------------------------
section('3. Optional segments — no doubled separators');
// ---------------------------------------------------------------------------
check('FY switched off                ', N.buildDocumentNumber({ ...po, includeFyInNumber: false }, 1), 'PO-000001');
check('no prefix                      ', N.buildDocumentNumber({ ...po, prefix: '' }, 1), '26-27-000001');
check('no prefix, no FY               ', N.buildDocumentNumber({ ...po, prefix: '', includeFyInNumber: false }, 1), '000001');
check('with suffix                    ', N.buildDocumentNumber({ ...po, suffix: 'A' }, 1), 'PO-26-27-000001-A');
check('null fyCode drops the segment  ', N.buildDocumentNumber({ ...po, fyCode: null }, 7), 'PO-000007');
check('whitespace prefix is dropped   ', N.buildDocumentNumber({ ...po, prefix: '   ' }, 7), '26-27-000007');

// ---------------------------------------------------------------------------
section('4. Zero padding');
// ---------------------------------------------------------------------------
check('3 digits                       ', N.padNumber(7, 3), '007');
check('4 digits                       ', N.padNumber(7, 4), '0007');
check('6 digits                       ', N.padNumber(7, 6), '000007');
check('8 digits                       ', N.padNumber(1234, 8), '00001234');
check('exact width, no change         ', N.padNumber(123456, 6), '123456');
check('overflow is NOT truncated      ', N.padNumber(1234567, 6), '1234567');
check('zero                           ', N.padNumber(0, 6), '000000');
check('length below min clamps to 1   ', N.padNumber(5, 0), '5');
check('length above max clamps to 12  ', N.padNumber(5, 99), '000000000005');
check('non-numeric length -> 6        ', N.padNumber(5, 'abc'), '000005');
check('max for 6 digits               ', N.maxValueForLength(6), 999999);
check('max for 4 digits               ', N.maxValueForLength(4), 9999);
check('max for 8 digits               ', N.maxValueForLength(8), 99999999);

// ---------------------------------------------------------------------------
section('5. Financial-year code derivation');
// ---------------------------------------------------------------------------
check('from dates (Apr-Mar)           ', N.deriveFyCode({ startDate: '2026-04-01', endDate: '2027-03-31' }), '26-27');
check('from dates (calendar year)     ', N.deriveFyCode({ startDate: '2026-01-01', endDate: '2026-12-31' }), '26-26');
check('century rollover               ', N.deriveFyCode({ startDate: '2099-04-01', endDate: '2100-03-31' }), '99-00');
check('from name "2026-2027"          ', N.deriveFyCode({ financialYearName: '2026-2027' }), '26-27');
check('from name "2026 - 2027"        ', N.deriveFyCode({ financialYearName: '2026 - 2027' }), '26-27');
check('from name "FY2026-27"          ', N.deriveFyCode({ financialYearName: 'FY2026-27' }), '26-27');
check('from name "2026-27 (26-27)"    ', N.deriveFyCode({ financialYearName: '2026 - 2027 (26-27)' }), '26-27');
check('single year infers the next    ', N.deriveFyCode({ financialYearName: '2026' }), '26-27');
check('dates win over the name        ', N.deriveFyCode({ startDate: '2025-04-01', endDate: '2026-03-31', financialYearName: '2030-2031' }), '25-26');
check('no usable input                ', N.deriveFyCode({ financialYearName: 'Current Year' }), null);
check('null input                     ', N.deriveFyCode(null), null);

// ---------------------------------------------------------------------------
section('6. Counter state — current / next / exhaustion');
// ---------------------------------------------------------------------------
const fresh = { ...po, startNumber: 1, currentNumber: null, nextNumber: 1, endNumber: 999999 };
const live = { ...po, startNumber: 1, currentNumber: 125, nextNumber: 126, endNumber: 999999 };
const spent = { ...po, startNumber: 1, currentNumber: 999999, nextNumber: 1000000, endNumber: 999999 };

check('fresh: nothing issued yet      ', N.currentNumber(fresh), null);
check('fresh: next is the start       ', N.peekNumber(fresh), 'PO-26-27-000001');
check('fresh: not consumed            ', N.isConsumed(fresh), false);
check('live: current                  ', N.currentNumber(live), 'PO-26-27-000125');
check('live: next                     ', N.peekNumber(live), 'PO-26-27-000126');
check('live: consumed                 ', N.isConsumed(live), true);
check('live: remaining capacity       ', N.remainingCapacity(live), 999874);
check('exhausted: current is last     ', N.currentNumber(spent), 'PO-26-27-999999');
check('exhausted: no next number      ', N.peekNumber(spent), null);
check('exhausted: remaining is 0      ', N.remainingCapacity(spent), 0);

const decorated = N.decorateSeries(live);
check('decorate: currentNumberFormatted', decorated.currentNumberFormatted, 'PO-26-27-000125');
check('decorate: nextNumberFormatted  ', decorated.nextNumberFormatted, 'PO-26-27-000126');
check('decorate: preview              ', decorated.preview, 'PO-26-27-000126');
check('decorate: isExhausted false    ', decorated.isExhausted, false);
check('decorate: exhausted preview    ', N.decorateSeries(spent).nextNumberFormatted, null);
check('decorate: fresh preview        ', N.decorateSeries(fresh).preview, 'PO-26-27-000001');

// ---------------------------------------------------------------------------
section('7. A full sequence — 1 through the end of the range');
// ---------------------------------------------------------------------------
// Simulates what allocateDocumentNumber does to the counter, verifying the
// sequence is gapless, strictly increasing and stops exactly at End No.
function simulate(series, count) {
  const s = { ...series };
  const issued = [];
  for (let i = 0; i < count; i += 1) {
    if (s.nextNumber > s.endNumber) break; // the SQL guard
    s.currentNumber = s.nextNumber;
    s.nextNumber += 1;
    issued.push(N.buildDocumentNumber(s, s.currentNumber));
  }
  return { issued, series: s };
}

const smallRange = { prefix: 'TST', separator: '-', fyCode: '26-27', includeFyInNumber: true, numberLength: 3, startNumber: 1, currentNumber: null, nextNumber: 1, endNumber: 5 };
const run = simulate(smallRange, 10);
check('stops at End No.               ', run.issued.length, 5);
check('sequence is exactly right      ', run.issued, ['TST-26-27-001', 'TST-26-27-002', 'TST-26-27-003', 'TST-26-27-004', 'TST-26-27-005']);
check('counter parked past the end    ', run.series.nextNumber, 6);
check('further peeks return null      ', N.peekNumber(run.series), null);

const big = simulate({ ...po, startNumber: 1, currentNumber: null, nextNumber: 1, endNumber: 999999 }, 2000);
check('2000 issued, no gaps           ', new Set(big.issued).size, 2000);
check('2000th number                  ', big.issued[1999], 'PO-26-27-002000');
check('padding holds at 4 digits      ', big.issued[1233], 'PO-26-27-001234');

// A range that starts mid-way, as an admin might set after a data migration.
const midStart = simulate({ ...po, numberLength: 6, startNumber: 5000, currentNumber: null, nextNumber: 5000, endNumber: 5002 }, 5);
check('honours a non-1 Start No.      ', midStart.issued, ['PO-26-27-005000', 'PO-26-27-005001', 'PO-26-27-005002']);

// ---------------------------------------------------------------------------
section('8. Validation — accepting good series');
// ---------------------------------------------------------------------------
const validPayload = {
  documentCode: 'PO', financialYearId: 1, seriesName: 'Default', prefix: 'PO', separator: '-',
  numberLength: 6, startNumber: 1, nextNumber: 1, endNumber: 999999,
  autoGenerate: true, manualEntry: false, status: 'Active',
};
// validateSeriesPayload returns { field, message } objects so the frontend
// can show each one under its own input — compare on .message here.
const hasError = (payload, fragment, opts) =>
  N.validateSeriesPayload(payload, opts).some((e) => e.message.toLowerCase().includes(fragment.toLowerCase()));

check('the mockup form payload        ', N.validateSeriesPayload(validPayload), []);
check('manual-only series is fine     ', N.validateSeriesPayload({ ...validPayload, autoGenerate: false, manualEntry: true }), []);
check('no prefix is fine              ', N.validateSeriesPayload({ ...validPayload, prefix: '' }), []);
check('4-digit series to 9999         ', N.validateSeriesPayload({ ...validPayload, numberLength: 4, endNumber: 9999 }), []);
// A series needs room for at least 3 numbers (Start, Start+1, Start+2) — a
// single-number range no longer validates now that MIN_SERIES_RANGE_GAP
// enforces that gap.
check('start == end is now rejected   ', hasError({ ...validPayload, startNumber: 7, nextNumber: 7, endNumber: 7 }, 'gap of at least'), true);
check('gap of exactly 2 is fine       ', N.validateSeriesPayload({ ...validPayload, startNumber: 7, nextNumber: 7, endNumber: 9 }), []);

// ---------------------------------------------------------------------------
section('9. Validation — rejecting bad series');
// ---------------------------------------------------------------------------
check('unknown document code          ', hasError({ ...validPayload, documentCode: 'NOPE' }, 'Unknown document type'), true);
check('missing document code          ', hasError({ ...validPayload, documentCode: '' }, 'Document name is required'), true);
check('missing financial year         ', hasError({ ...validPayload, financialYearId: null }, 'Financial year is required'), true);
check('end below start                ', hasError({ ...validPayload, startNumber: 500, endNumber: 100 }, 'End No. must be greater'), true);
check('end exceeds 6-digit capacity   ', hasError({ ...validPayload, numberLength: 6, endNumber: 1000000 }, 'cannot exceed 999999'), true);
check('end exceeds 4-digit capacity   ', hasError({ ...validPayload, numberLength: 4, endNumber: 10000 }, 'cannot exceed 9999'), true);
check('negative start                 ', hasError({ ...validPayload, startNumber: -1 }, 'Start No.'), true);
check('fractional start               ', hasError({ ...validPayload, startNumber: 1.5 }, 'Start No.'), true);
check('length 0                       ', hasError({ ...validPayload, numberLength: 0 }, 'Number length'), true);
check('length 13                      ', hasError({ ...validPayload, numberLength: 13 }, 'Number length'), true);
check('prefix with a space            ', hasError({ ...validPayload, prefix: 'P O' }, 'Prefix must be'), true);
check('prefix with punctuation        ', hasError({ ...validPayload, prefix: 'PO-' }, 'Prefix must be'), true);
check('prefix over 10 chars           ', hasError({ ...validPayload, prefix: 'ABCDEFGHIJK' }, 'Prefix must be'), true);
check('bad separator                  ', hasError({ ...validPayload, separator: '|' }, 'Separator must be'), true);
check('bad status                     ', hasError({ ...validPayload, status: 'Archived' }, 'Status must be'), true);
check('next below start               ', hasError({ ...validPayload, startNumber: 100, nextNumber: 50, endNumber: 999 }, 'Next No. cannot be lower'), true);
check('next beyond end                ', hasError({ ...validPayload, startNumber: 1, nextNumber: 500, endNumber: 100 }, 'Next No. cannot be beyond'), true);
check('auto off AND manual off        ', hasError({ ...validPayload, autoGenerate: false, manualEntry: false }, 'can never produce a number'), true);

// ---------------------------------------------------------------------------
section('10. Locked-series rules — editing after numbers were issued');
// ---------------------------------------------------------------------------
const consumed = {
  documentCode: 'PO', financialYearId: 1, seriesName: 'Default', prefix: 'PO', suffix: null, separator: '-',
  numberLength: 6, includeFyInNumber: true, fyCode: '26-27',
  startNumber: 1, currentNumber: 125, nextNumber: 126, endNumber: 999999,
  autoGenerate: true, manualEntry: false, status: 'Active',
};
const untouched = { ...consumed, currentNumber: null, nextNumber: 1 };

check('locked: prefix change blocked  ', hasError({ prefix: 'PUR' }, 'cannot be changed after', { existing: consumed }), true);
check('locked: separator blocked      ', hasError({ separator: '/' }, 'cannot be changed after', { existing: consumed }), true);
check('locked: length blocked         ', hasError({ numberLength: 8 }, 'cannot be changed after', { existing: consumed }), true);
check('locked: FY toggle blocked      ', hasError({ includeFyInNumber: false }, 'cannot be changed after', { existing: consumed }), true);
check('locked: moving FY blocked      ', hasError({ financialYearId: 2 }, 'cannot be changed after', { existing: consumed }), true);
check('locked: Start No. blocked      ', hasError({ startNumber: 500 }, 'Start No. cannot be changed', { existing: consumed }), true);
check('locked: lowering End No. below issued', hasError({ endNumber: 100 }, 'cannot be lowered below', { existing: consumed }), true);
check('locked: raising End No. allowed', N.validateSeriesPayload({ endNumber: 999999 }, { existing: consumed }), []);
check('locked: status change allowed  ', N.validateSeriesPayload({ status: 'Inactive' }, { existing: consumed }), []);
check('locked: toggles allowed        ', N.validateSeriesPayload({ manualEntry: true }, { existing: consumed }), []);
check('unlocked: prefix change fine   ', N.validateSeriesPayload({ prefix: 'PUR' }, { existing: untouched }), []);
check('unlocked: Start No. fine       ', N.validateSeriesPayload({ startNumber: 500, nextNumber: 500 }, { existing: untouched }), []);
check('unlocked: length change fine   ', N.validateSeriesPayload({ numberLength: 8 }, { existing: untouched }), []);

// ---------------------------------------------------------------------------
section('11. Manual entry parsing');
// ---------------------------------------------------------------------------
const manual = { ...consumed, manualEntry: true, startNumber: 1, endNumber: 999999 };

check('accepts a well-formed number   ', N.validateManualNumber(manual, 'PO-26-27-000200').valid, true);
check('  ...and extracts the value    ', N.validateManualNumber(manual, 'PO-26-27-000200').value, 200);
check('accepts unpadded digits        ', N.validateManualNumber(manual, 'PO-26-27-200').value, 200);
check('trims surrounding whitespace   ', N.validateManualNumber(manual, '  PO-26-27-000200  ').value, 200);
check('rejects a wrong prefix         ', N.validateManualNumber(manual, 'XX-26-27-000200').valid, false);
check('rejects a wrong FY             ', N.validateManualNumber(manual, 'PO-25-26-000200').valid, false);
check('rejects a wrong separator      ', N.validateManualNumber(manual, 'PO/26-27/000200').valid, false);
check('rejects free text              ', N.validateManualNumber(manual, 'whatever').valid, false);
check('rejects an empty string        ', N.validateManualNumber(manual, '').valid, false);
check('rejects above End No.          ', N.validateManualNumber({ ...manual, endNumber: 100 }, 'PO-26-27-000200').valid, false);
check('rejects below Start No.        ', N.validateManualNumber({ ...manual, startNumber: 500 }, 'PO-26-27-000200').valid, false);
check('rejects when manual is off     ', N.validateManualNumber({ ...manual, manualEntry: false }, 'PO-26-27-000200').valid, false);
check('rejects with no series at all  ', N.validateManualNumber(null, 'PO-26-27-000200').valid, false);
// A dot separator is a regex metacharacter — make sure it is escaped, not
// treated as "any character".
const dotted = { ...manual, separator: '.' };
check('dot separator is escaped       ', N.validateManualNumber(dotted, 'POX26-27X000200').valid, false);
check('dot separator accepts real dots', N.validateManualNumber(dotted, 'PO.26-27.000200').value, 200);

// ---------------------------------------------------------------------------
section('12. FY rollover arithmetic');
// ---------------------------------------------------------------------------
// resetEveryFy = true  -> new year restarts at Start No.
// resetEveryFy = false -> new year continues from where the old one stopped.
const rolloverStart = (s) => (s.resetEveryFy ? s.startNumber : Math.max(s.startNumber, s.nextNumber));

check('reset ON restarts at Start No. ', rolloverStart({ resetEveryFy: true, startNumber: 1, nextNumber: 126 }), 1);
check('reset OFF carries forward      ', rolloverStart({ resetEveryFy: false, startNumber: 1, nextNumber: 126 }), 126);
check('reset OFF on an unused series  ', rolloverStart({ resetEveryFy: false, startNumber: 1, nextNumber: 1 }), 1);
check('reset ON with a non-1 start    ', rolloverStart({ resetEveryFy: true, startNumber: 5000, nextNumber: 5300 }), 5000);
check('new FY number after reset      ', N.buildDocumentNumber({ ...po, fyCode: '27-28' }, 1), 'PO-27-28-000001');
check('new FY number after carry      ', N.buildDocumentNumber({ ...po, fyCode: '27-28' }, 126), 'PO-27-28-000126');

// ---------------------------------------------------------------------------
section('13. Catalog integrity');
// ---------------------------------------------------------------------------
const codes = N.DOCUMENT_CATALOG.map((d) => d.code);
check('codes are unique               ', new Set(codes).size, codes.length);
check('names are unique               ', new Set(N.DOCUMENT_CATALOG.map((d) => d.name)).size, codes.length);
check('every entry has a prefix       ', N.DOCUMENT_CATALOG.every((d) => d.prefix && d.prefix.length), true);
check('every prefix is pattern-legal  ', N.DOCUMENT_CATALOG.every((d) => /^[A-Za-z0-9]{1,10}$/.test(d.prefix)), true);
check('every mockup doc is present    ', ['PO', 'GRN', 'PI', 'SO', 'DC', 'SI', 'SRC', 'SIG', 'RV', 'PV'].every((c) => codes.includes(c)), true);
check('lookup map matches the list    ', N.CATALOG_BY_CODE.size, codes.length);

// ---------------------------------------------------------------------------
section('14. Derived status — Active / Inactive / Completed');
// ---------------------------------------------------------------------------
// 'Completed' is never stored. It is what Active means once the counter has
// run past End No., so it can't drift out of sync with the numbers.
const base = { startNumber: 1, endNumber: 999, status: 'Active' };

check('active with room left          ', N.displayStatus({ ...base, nextNumber: 500 }), 'Active');
check('active on the very last number ', N.displayStatus({ ...base, nextNumber: 999 }), 'Active');
check('active, counter past the end   ', N.displayStatus({ ...base, nextNumber: 1000 }), 'Completed');
check('inactive with room left        ', N.displayStatus({ ...base, status: 'Inactive', nextNumber: 500 }), 'Inactive');
// Exhaustion is a fact about the counter, so it outranks the stored flag.
check('inactive AND exhausted         ', N.displayStatus({ ...base, status: 'Inactive', nextNumber: 1000 }), 'Completed');
check('null series                    ', N.displayStatus(null), 'Inactive');

// Matches the mockup: Default 000001-000999 at 000999 reads Completed.
check('mockup row 1 (Default)         ', N.displayStatus({ startNumber: 1, endNumber: 999, nextNumber: 1000, status: 'Active' }), 'Completed');
check('mockup row 2 (Default-2)       ', N.displayStatus({ startNumber: 1000, endNumber: 999999, nextNumber: 1000, status: 'Active' }), 'Active');
check('mockup row 3 (Default-3)       ', N.displayStatus({ startNumber: 2000, endNumber: 999999, nextNumber: 2000, status: 'Inactive' }), 'Inactive');

// ---------------------------------------------------------------------------
section('15. Range overlap detection');
// ---------------------------------------------------------------------------
const r = (startNumber, endNumber) => ({ startNumber, endNumber });

check('disjoint, below                ', N.rangesOverlap(r(1, 999), r(1000, 1999)), false);
check('disjoint, above                ', N.rangesOverlap(r(2000, 2999), r(1000, 1999)), false);
check('touching at a single number    ', N.rangesOverlap(r(1, 1000), r(1000, 1999)), true);
check('fully contained                ', N.rangesOverlap(r(1200, 1300), r(1000, 1999)), true);
check('fully containing               ', N.rangesOverlap(r(1, 99999), r(1000, 1999)), true);
check('identical                      ', N.rangesOverlap(r(1, 999), r(1, 999)), true);
check('partial, overlapping the tail  ', N.rangesOverlap(r(900, 1500), r(1000, 1999)), true);
check('single-number vs single-number ', N.rangesOverlap(r(5, 5), r(5, 5)), true);
check('adjacent single numbers        ', N.rangesOverlap(r(5, 5), r(6, 6)), false);

// The mockup's Series 2 (001000-999999) and Series 3 (002000-999999) overlap,
// which is exactly what the save-time check has to catch.
check('mockup rows 2 and 3 overlap    ', N.rangesOverlap(r(1000, 999999), r(2000, 999999)), true);

const poSiblings = [
  { id: 1, documentCode: 'PO', financialYearId: 1, seriesName: 'Default', startNumber: 1, endNumber: 999 },
  { id: 2, documentCode: 'PO', financialYearId: 1, seriesName: 'Default-2', startNumber: 1000, endNumber: 1999 },
  { id: 3, documentCode: 'SO', financialYearId: 1, seriesName: 'Default', startNumber: 1, endNumber: 999 },
  { id: 4, documentCode: 'PO', financialYearId: 2, seriesName: 'Default', startNumber: 1, endNumber: 999 },
];
const candidate = (startNumber, endNumber) => ({ documentCode: 'PO', financialYearId: 1, startNumber, endNumber });

check('finds the clashing sibling     ', N.findOverlappingSeries(candidate(500, 1500), poSiblings).map((s) => s.seriesName), ['Default', 'Default-2']);
check('a clean gap clashes with none  ', N.findOverlappingSeries(candidate(2000, 2999), poSiblings), []);
check('ignores other document types   ', N.findOverlappingSeries({ documentCode: 'SO', financialYearId: 1, startNumber: 1, endNumber: 999 }, poSiblings).map((s) => s.id), [3]);
check('ignores other financial years  ', N.findOverlappingSeries({ documentCode: 'PO', financialYearId: 2, startNumber: 1, endNumber: 999 }, poSiblings).map((s) => s.id), [4]);
check('a series does not clash w/ self', N.findOverlappingSeries(candidate(1, 999), poSiblings, { ignoreId: 1 }), []);

// ---------------------------------------------------------------------------
section('16. Series naming');
// ---------------------------------------------------------------------------
check('first series is "Series 1"     ', N.suggestSeriesName([]), 'Series 1');
check('second is "Series 2"           ', N.suggestSeriesName(['Series 1']), 'Series 2');
check('third is "Series 3"            ', N.suggestSeriesName(['Series 1', 'Series 2']), 'Series 3');
check('fills a gap in the sequence    ', N.suggestSeriesName(['Series 1', 'Series 3']), 'Series 2');
check('case-insensitive               ', N.suggestSeriesName(['series 1']), 'Series 2');
check('ignores surrounding whitespace ', N.suggestSeriesName([' Series 1 ']), 'Series 2');
check('sidesteps custom names         ', N.suggestSeriesName(['Export', 'Domestic']), 'Series 1');

// ---------------------------------------------------------------------------
section('17. Multi-series validation');
// ---------------------------------------------------------------------------
const multiPayload = {
  documentCode: 'PO', financialYearId: 1, seriesName: 'Default-3', prefix: 'PO', separator: '-',
  numberLength: 6, startNumber: 2000, nextNumber: 2000, endNumber: 2999,
  autoGenerate: true, manualEntry: false, status: 'Active',
};

check('a clean new block validates    ', N.validateSeriesPayload(multiPayload, { siblings: poSiblings }), []);
check('no siblings, no overlap check  ', N.validateSeriesPayload({ ...multiPayload, startNumber: 1, nextNumber: 1, endNumber: 999 }), []);
check('missing series name rejected   ', hasError({ ...multiPayload, seriesName: '' }, 'Series name is required'), true);
check('blank series name rejected     ', hasError({ ...multiPayload, seriesName: '   ' }, 'Series name is required'), true);
check('over-long series name rejected ', hasError({ ...multiPayload, seriesName: 'x'.repeat(101) }, 'cannot exceed 100'), true);
check('duplicate name rejected        ', hasError({ ...multiPayload, seriesName: 'Default-2' }, 'already exists', { siblings: poSiblings }), true);
check('duplicate name is case-blind   ', hasError({ ...multiPayload, seriesName: 'DEFAULT-2' }, 'already exists', { siblings: poSiblings }), true);
check('overlapping range rejected     ', hasError({ ...multiPayload, startNumber: 500, endNumber: 1500 }, 'overlaps series', { siblings: poSiblings }), true);
check('  ...and names the clash       ', N.validateSeriesPayload({ ...multiPayload, startNumber: 500, endNumber: 1500 }, { siblings: poSiblings }).some((e) => e.message.includes('"Default"')), true);
// Names and ranges are scoped per document type, so 'Default' being taken on
// PO says nothing about SI — and the ranges are compared per document type too.
check('same name in another doc is ok ', N.validateSeriesPayload(
  { ...multiPayload, documentCode: 'SI', seriesName: 'Default', startNumber: 1, nextNumber: 1, endNumber: 999 },
  { siblings: poSiblings }
), []);
// ...but a genuine clash within that other document type is still caught:
// poSiblings already holds an SO series named 'Default' covering 1-999.
check('clash inside another doc caught', hasError(
  { ...multiPayload, documentCode: 'SO', seriesName: 'Default', startNumber: 5000, nextNumber: 5000, endNumber: 5999 },
  'already exists', { siblings: poSiblings }
), true);
check('editing itself: no self-clash  ', N.validateSeriesPayload(
  { seriesName: 'Default-2', endNumber: 1999 },
  { existing: { ...poSiblings[1], documentCode: 'PO', financialYearId: 1, numberLength: 6, currentNumber: null, nextNumber: 1000, autoGenerate: true, manualEntry: false, status: 'Active' }, siblings: poSiblings }
), []);

// ---------------------------------------------------------------------------
section('18. The mockup, reproduced');
// ---------------------------------------------------------------------------
// Three PO series in FY 26-27, as pictured — with Series 3 moved above
// Series 2's End No., since the pictured overlap is what the rule forbids.
const mockup = [
  { id: 1, documentCode: 'PO', financialYearId: 1, seriesName: 'Default',   prefix: 'PO', separator: '-', fyCode: '26-27', includeFyInNumber: true, numberLength: 6, startNumber: 1,    endNumber: 999,    currentNumber: 999,  nextNumber: 1000,  status: 'Active',   isDefault: false },
  { id: 2, documentCode: 'PO', financialYearId: 1, seriesName: 'Default-2', prefix: 'PO', separator: '-', fyCode: '26-27', includeFyInNumber: true, numberLength: 6, startNumber: 1000, endNumber: 1999,   currentNumber: null, nextNumber: 1000,  status: 'Active',   isDefault: true  },
  { id: 3, documentCode: 'PO', financialYearId: 1, seriesName: 'Default-3', prefix: 'PO', separator: '-', fyCode: '26-27', includeFyInNumber: true, numberLength: 6, startNumber: 2000, endNumber: 999999, currentNumber: null, nextNumber: 2000,  status: 'Inactive', isDefault: false },
];
const decoratedMockup = mockup.map(N.decorateSeries);

check('row 1 status                   ', decoratedMockup[0].displayStatus, 'Completed');
check('row 1 current                  ', decoratedMockup[0].currentNumberFormatted, 'PO-26-27-000999');
check('row 1 has no next number       ', decoratedMockup[0].nextNumberFormatted, null);
check('row 1 preview falls back       ', decoratedMockup[0].preview, 'PO-26-27-000999');
check('row 2 status                   ', decoratedMockup[1].displayStatus, 'Active');
check('row 2 preview                  ', decoratedMockup[1].preview, 'PO-26-27-001000');
check('row 2 is the default           ', decoratedMockup[1].isDefault, true);
check('row 3 status                   ', decoratedMockup[2].displayStatus, 'Inactive');
check('row 3 preview                  ', decoratedMockup[2].preview, 'PO-26-27-002000');
check('exactly one default            ', mockup.filter((s) => s.isDefault).length, 1);
check('no two series overlap          ', mockup.some((a, i) => mockup.slice(i + 1).some((b) => N.rangesOverlap(a, b))), false);
// suggestSeriesName fills the first free 'Series N' ordinal rather than
// appending after the highest one in use. These three rows carry the
// pre-20260806090000 names ('Default', 'Default-2', 'Default-3'), none of
// which occupies a 'Series N' slot, so the first free ordinal is 1.
//
// This assertion expected 'Series 4', which was the old append-at-the-end
// behaviour; it has been failing since the fill-the-first-gap rule replaced
// it. The code is correct and documented — the expectation was stale.
check('next name is the first free one', N.suggestSeriesName(mockup.map((s) => s.seriesName)), 'Series 1');
check('...and skips the ones in use   ', N.suggestSeriesName(['Series 1', 'Series 3']), 'Series 2');
check('...appending when 1..n are used', N.suggestSeriesName(['Series 1', 'Series 2', 'Series 3']), 'Series 4');

// ---------------------------------------------------------------------------
section('Summary');
// ---------------------------------------------------------------------------
console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed) {
  console.log('Failures:');
  failures.forEach((f) => console.log(`  - ${f}`));
}

console.log(`
  Not covered here (needs a live PostgreSQL):
    allocateDocumentNumber() relies on a single conditional UPDATE ... RETURNING
    for its concurrency guarantee. To verify it, point DATABASE_URL at a test
    database, seed a series, then fire N parallel allocations:

      const jobs = Array.from({ length: 50 }, () => N.allocateDocumentNumber('PO'));
      const out  = await Promise.all(jobs);
      new Set(out.map(o => o.value)).size === 50   // no duplicates
`);

process.exitCode = failed ? 1 : 0;
