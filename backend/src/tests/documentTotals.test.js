/**
 * Test cases for the canonical document totals engine.
 *
 * Run with:  node --test src/tests/
 *
 * Each block is written as an ERP acceptance case — the kind of thing a
 * functional consultant signs off on — rather than a unit test of an
 * implementation detail. The "regression" blocks each pin a defect that was
 * live in the codebase before utils/documentTotals.js existed.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  round2,
  isInterState,
  normaliseLine,
  computeTotals,
  buildDocument,
} = require('../utils/documentTotals');

// ---------------------------------------------------------------------------
// round2 — the foundation everything else depends on
// ---------------------------------------------------------------------------

test('round2 rounds half away from zero and survives float representation error', () => {
  assert.equal(round2(1.005), 1.01, '1.005 is 1.00499999999999989 in IEEE-754');
  assert.equal(round2(8.165), 8.17);
  assert.equal(round2(2.675), 2.68);
  assert.equal(round2(-1.005), -1.01);
  assert.equal(round2(1.004), 1.0);
  assert.equal(round2(0.1 + 0.2), 0.3);
  assert.equal(round2(null), 0);
  assert.equal(round2(undefined), 0);
  assert.equal(round2('12.345'), 12.35);
  assert.equal(round2(NaN), 0);
  assert.equal(round2(Infinity), 0);
});

test('round2 keeps large money values exact', () => {
  assert.equal(round2(1234567.891), 1234567.89);
  assert.equal(round2(99999999.999), 100000000);
});

// ---------------------------------------------------------------------------
// Line normalisation
// ---------------------------------------------------------------------------

test('line amount is quantity x rate less the line discount, rounded to paise', () => {
  const line = normaliseLine({ quantity: 3, unitPrice: 33.33, discountPercent: 10, taxPercent: 18 });
  assert.equal(line.gross, 99.99);
  assert.equal(line.amount, 89.99); // 99.99 - 9.999 -> 99.99 - 10.00
});

test('line with no discount or tax defaults both to zero', () => {
  const line = normaliseLine({ quantity: 2, unitPrice: 50 });
  assert.equal(line.amount, 100);
  assert.equal(line.discountPercent, 0);
  assert.equal(line.taxPercent, 0);
});

test('GRN lines are measured on receivedQuantity, not quantity', () => {
  const line = normaliseLine(
    { receivedQuantity: 7, quantity: 999, unitPrice: 10 },
    { quantityField: 'receivedQuantity' }
  );
  assert.equal(line.amount, 70, 'must use the received qty, not the ordered qty');
});

// ---------------------------------------------------------------------------
// REGRESSION: the stored header must be internally consistent
// ---------------------------------------------------------------------------

test('regression: taxable + cgst + sgst equals the grand total exactly', () => {
  // Three lines chosen so the naive unrounded arithmetic leaves a residue.
  const { totals } = buildDocument(
    [
      { quantity: 1, unitPrice: 33.33, taxPercent: 18 },
      { quantity: 3, unitPrice: 11.11, taxPercent: 5 },
      { quantity: 7, unitPrice: 1.05, taxPercent: 12 },
    ],
    0
  );
  assert.equal(
    round2(totals.taxableAmount + totals.cgstAmount + totals.sgstAmount),
    totals.amount,
    'a document whose parts do not sum to its total cannot be filed'
  );
});

test('regression: cgst + sgst equals total tax even when tax is an odd number of paise', () => {
  const { totals } = buildDocument([{ quantity: 1, unitPrice: 100, taxPercent: 5.01 }], 0);
  assert.equal(round2(totals.cgstAmount + totals.sgstAmount), totals.totalTax);
  assert.notEqual(totals.cgstAmount, totals.sgstAmount, 'the odd paisa lands on one side');
});

test('regression: subtotal equals the sum of the stored line amounts', () => {
  const { lines, totals } = buildDocument(
    Array.from({ length: 25 }, (_, i) => ({ quantity: i + 1, unitPrice: 3.33, taxPercent: 18 })),
    0
  );
  assert.equal(round2(lines.reduce((s, l) => s + l.amount, 0)), totals.subtotal);
});

// ---------------------------------------------------------------------------
// REGRESSION: mixed tax rates (the hard-coded-18% defect)
// ---------------------------------------------------------------------------

test('regression: a document mixing tax rates is not taxed at a single flat rate', () => {
  const { totals } = buildDocument(
    [
      { quantity: 10, unitPrice: 100, taxPercent: 5 },  // 1000 @ 5%  =  50
      { quantity: 10, unitPrice: 100, taxPercent: 18 }, // 1000 @ 18% = 180
    ],
    0
  );
  assert.equal(totals.subtotal, 2000);
  assert.equal(totals.totalTax, 230, 'blended, not 18% of 2000 (=360) nor 5% (=100)');
  assert.equal(totals.amount, 2230);
});

test('regression: zero-rated goods attract no tax', () => {
  const { totals } = buildDocument([{ quantity: 5, unitPrice: 200, taxPercent: 0 }], 0);
  assert.equal(totals.totalTax, 0);
  assert.equal(totals.cgstAmount, 0);
  assert.equal(totals.sgstAmount, 0);
  assert.equal(totals.amount, 1000, 'previously this was billed 1180 by the hard-coded 9%+9%');
});

// ---------------------------------------------------------------------------
// Header discount
// ---------------------------------------------------------------------------

test('header discount reduces the taxable base before tax is computed', () => {
  const { totals } = buildDocument([{ quantity: 1, unitPrice: 1000, taxPercent: 18 }], 10);
  assert.equal(totals.subtotal, 1000);
  assert.equal(totals.taxableAmount, 900);
  assert.equal(totals.totalTax, 162, 'tax is charged on 900, not on 1000');
  assert.equal(totals.amount, 1062);
});

test('line discount and header discount compound, in that order', () => {
  const { totals } = buildDocument(
    [{ quantity: 1, unitPrice: 1000, discountPercent: 20, taxPercent: 18 }],
    10
  );
  assert.equal(totals.subtotal, 800, 'line discount first');
  assert.equal(totals.taxableAmount, 720, 'then the header discount');
  assert.equal(totals.totalTax, 129.6);
});

test('a 100% header discount produces a zero document, not a negative one', () => {
  const { totals } = buildDocument([{ quantity: 1, unitPrice: 500, taxPercent: 18 }], 100);
  assert.equal(totals.taxableAmount, 0);
  assert.equal(totals.totalTax, 0);
  assert.equal(totals.amount, 0);
});

// ---------------------------------------------------------------------------
// REGRESSION: inter-state supply must be IGST
// ---------------------------------------------------------------------------

test('regression: inter-state supply is charged as IGST, not split CGST/SGST', () => {
  const { totals } = buildDocument([{ quantity: 1, unitPrice: 1000, taxPercent: 18 }], 0, {
    interState: true,
  });
  assert.equal(totals.igstAmount, 180);
  assert.equal(totals.cgstAmount, 0);
  assert.equal(totals.sgstAmount, 0);
  assert.equal(totals.amount, 1180, 'the customer pays the same either way');
});

test('intra-state supply is split evenly into CGST and SGST', () => {
  const { totals } = buildDocument([{ quantity: 1, unitPrice: 1000, taxPercent: 18 }], 0);
  assert.equal(totals.cgstAmount, 90);
  assert.equal(totals.sgstAmount, 90);
  assert.equal(totals.igstAmount, 0);
});

// ---------------------------------------------------------------------------
// TCS — a flat 1% of (Subtotal + CGST + SGST + IGST), added ON TOP
// ---------------------------------------------------------------------------

test('GST+TCS taxes the line at its full rate, then adds 1% of Subtotal+CGST+SGST on top', () => {
  // Rate 18% -> CGST 9% + SGST 9% = 180 tax on a 1000 taxable share.
  // TCS = 1% of (1000 subtotal + 90 cgst + 90 sgst) = 1% of 1180 = 11.80.
  const { totals } = buildDocument(
    [{ quantity: 1, unitPrice: 1000, taxPercent: 18, taxType: 'GST+TCS' }],
    0
  );
  assert.equal(totals.totalTax, 180, 'totalTax is the plain GST tax, TCS is not folded into it');
  assert.equal(totals.cgstAmount, 90);
  assert.equal(totals.sgstAmount, 90);
  assert.equal(totals.igstAmount, 0);
  assert.equal(totals.tcsAmount, 11.8, '1% of subtotal + cgst + sgst + igst');
  assert.equal(totals.amount, 1191.8, 'grand total includes TCS on top of taxable + tax');
});

test('IGST+TCS taxes the line at its full rate, then adds 1% of Subtotal+IGST on top', () => {
  const { totals } = buildDocument(
    [{ quantity: 1, unitPrice: 1000, taxPercent: 18, taxType: 'IGST+TCS' }],
    0,
    { interState: true }
  );
  assert.equal(totals.totalTax, 180);
  assert.equal(totals.igstAmount, 180);
  assert.equal(totals.cgstAmount, 0);
  assert.equal(totals.sgstAmount, 0);
  assert.equal(totals.tcsAmount, 11.8, '1% of (1000 subtotal + 180 igst)');
  assert.equal(totals.amount, 1191.8);
});

test('plain GST/IGST lines never add TCS, regardless of rate', () => {
  const gst = buildDocument([{ quantity: 1, unitPrice: 1000, taxPercent: 18, taxType: 'GST' }], 0).totals;
  assert.equal(gst.tcsAmount, 0);
  const igst = buildDocument(
    [{ quantity: 1, unitPrice: 1000, taxPercent: 18, taxType: 'IGST' }],
    0,
    { interState: true }
  ).totals;
  assert.equal(igst.tcsAmount, 0);
  // No taxType at all (every pre-TCS caller/document) behaves identically —
  // the whole feature is additive, never a behaviour change for a line that
  // doesn't opt in.
  const untyped = buildDocument([{ quantity: 1, unitPrice: 1000, taxPercent: 18 }], 0).totals;
  assert.deepEqual(untyped, gst, 'an absent taxType must compute exactly like a plain GST one');
});

test('a document mixing a plain-GST line and a GST+TCS line still adds TCS once, on the whole document', () => {
  const { totals } = buildDocument(
    [
      { quantity: 1, unitPrice: 1000, taxPercent: 18, taxType: 'GST' },
      { quantity: 1, unitPrice: 1000, taxPercent: 18, taxType: 'GST+TCS' },
    ],
    0
  );
  // subtotal 2000, totalTax 360 (180+180), cgst 180, sgst 180.
  assert.equal(totals.totalTax, 360);
  assert.equal(totals.cgstAmount, 180);
  assert.equal(totals.sgstAmount, 180);
  assert.equal(totals.tcsAmount, 23.6, '1% of (2000 + 180 + 180), because any TCS-typed line opts the whole document in');
  assert.equal(totals.amount, round2(totals.taxableAmount + totals.totalTax + totals.tcsAmount));
});

test('regression: a document with zero TCS-typed lines computes cgst/sgst/igst identically to before TCS existed', () => {
  const { totals } = buildDocument(
    [
      { quantity: 10, unitPrice: 100, taxPercent: 5 },
      { quantity: 10, unitPrice: 100, taxPercent: 18 },
    ],
    0
  );
  assert.equal(totals.tcsAmount, 0);
  assert.equal(totals.totalTax, 230);
  assert.equal(totals.amount, 2230);
});

test('place of supply drives the inter-state decision, forgivingly', () => {
  assert.equal(isInterState('Karnataka', 'Tamil Nadu'), true);
  assert.equal(isInterState('Tamil Nadu', 'tamil nadu'), false, 'case-insensitive');
  assert.equal(isInterState('  Tamil Nadu  ', 'Tamil Nadu'), false, 'whitespace-insensitive');
  assert.equal(isInterState('', 'Tamil Nadu'), false, 'unknown place of supply -> intra-state');
  assert.equal(isInterState('Karnataka', ''), false, 'unknown home state -> intra-state');
  assert.equal(isInterState(null, undefined), false);
});

// ---------------------------------------------------------------------------
// Round off
// ---------------------------------------------------------------------------

test('round off snaps the grand total to a whole rupee and records the delta', () => {
  const { totals } = buildDocument([{ quantity: 1, unitPrice: 1000.4, taxPercent: 18 }], 0, {
    roundOff: true,
  });
  assert.equal(totals.amount, Math.round(totals.amount), 'grand total is a whole rupee');
  assert.equal(
    round2(totals.taxableAmount + totals.totalTax + totals.roundOff),
    totals.amount,
    'the round-off line must reconcile the total back to its parts'
  );
  assert.ok(Math.abs(totals.roundOff) <= 0.5);
});

test('documents without round off keep their exact paise', () => {
  const { totals } = buildDocument([{ quantity: 1, unitPrice: 1000.4, taxPercent: 18 }], 0);
  assert.equal(totals.roundOff, 0);
  assert.equal(totals.amount, round2(totals.taxableAmount + totals.totalTax));
});

// ---------------------------------------------------------------------------
// Degenerate and hostile inputs
// ---------------------------------------------------------------------------

test('an empty document is all zeros rather than NaN', () => {
  const { totals } = buildDocument([], 0);
  assert.deepEqual(
    { s: totals.subtotal, t: totals.totalTax, a: totals.amount },
    { s: 0, t: 0, a: 0 }
  );
});

test('lines that cancel to a zero subtotal do not divide by zero', () => {
  const { totals } = buildDocument(
    [
      { quantity: 1, unitPrice: 100, taxPercent: 18 },
      { quantity: -1, unitPrice: 100, taxPercent: 18 },
    ],
    10
  );
  assert.equal(totals.subtotal, 0);
  assert.equal(Number.isFinite(totals.totalTax), true);
  assert.equal(totals.totalTax, 0);
});

test('non-numeric junk from the wire is coerced, not propagated as NaN', () => {
  const { totals } = buildDocument(
    [{ quantity: 'abc', unitPrice: null, taxPercent: undefined }],
    'not-a-number'
  );
  assert.equal(totals.subtotal, 0);
  assert.equal(totals.amount, 0);
  assert.equal(Number.isNaN(totals.amount), false);
});

test('a credit-note shaped document (negative lines) stays coherent', () => {
  const { totals } = buildDocument([{ quantity: -2, unitPrice: 500, taxPercent: 18 }], 0);
  assert.equal(totals.subtotal, -1000);
  assert.equal(totals.totalTax, -180);
  assert.equal(totals.amount, -1180);
  assert.equal(round2(totals.cgstAmount + totals.sgstAmount), totals.totalTax);
});

// ---------------------------------------------------------------------------
// Volume: the sum-of-parts invariant must hold at scale, not just on 3 lines
// ---------------------------------------------------------------------------

test('invariant holds across 500 randomised documents, including a mix of TCS and plain tax types', () => {
  const rates = [0, 5, 12, 18, 28];
  const taxTypes = ['GST', 'IGST', 'GST+TCS', 'IGST+TCS', '', undefined];
  let seed = 42;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  for (let doc = 0; doc < 500; doc += 1) {
    const items = Array.from({ length: 1 + Math.floor(rnd() * 12) }, () => ({
      quantity: round2(rnd() * 100),
      unitPrice: round2(rnd() * 5000),
      discountPercent: round2(rnd() * 25),
      taxPercent: rates[Math.floor(rnd() * rates.length)],
      taxType: taxTypes[Math.floor(rnd() * taxTypes.length)],
    }));
    const headerDiscount = round2(rnd() * 15);
    const interState = rnd() > 0.5;
    const { lines, totals } = buildDocument(items, headerDiscount, { interState, roundOff: true });

    assert.equal(
      round2(lines.reduce((s, l) => s + l.amount, 0)),
      totals.subtotal,
      `doc ${doc}: line amounts must sum to subtotal`
    );
    assert.equal(
      round2(totals.cgstAmount + totals.sgstAmount + totals.igstAmount),
      totals.totalTax,
      `doc ${doc}: cgst/sgst/igst must sum to total tax (TCS is additive, not part of it)`
    );
    assert.equal(
      round2(totals.taxableAmount + totals.totalTax + totals.tcsAmount + totals.roundOff),
      totals.amount,
      `doc ${doc}: header must reconcile including TCS on top`
    );
    assert.equal(totals.amount, Math.round(totals.amount), `doc ${doc}: round-off applied`);
    assert.ok(totals.tcsAmount >= 0, `doc ${doc}: tcsAmount is never negative`);
    // A document with no '+TCS' line must carry zero TCS, whatever its rates.
    if (!lines.some((l) => /\+TCS$/i.test(String(l.taxType || '').toUpperCase()))) {
      assert.equal(totals.tcsAmount, 0, `doc ${doc}: no TCS-typed line means no TCS amount`);
    }
    // Every stored figure must be a legal Decimal(15,2) value.
    for (const [k, v] of Object.entries(totals)) {
      assert.equal(round2(v), v, `doc ${doc}: ${k} carries sub-paise precision`);
    }
  }
});
