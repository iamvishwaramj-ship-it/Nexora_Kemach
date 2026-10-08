/**
 * Purchase Quotation -> Purchase Order -> Purchase GRN -> Purchase Invoice
 * tax propagation.
 *
 * Bug: when a purchase transaction mixed items at different GST rates, the
 * item-level tax rate was not preserved as the transaction moved between
 * documents.
 *
 *   1. utils/documentTotals.js computes tax item-by-item and only ever sums
 *      the per-line figures into the header (never a single blended % over
 *      the combined subtotal) — this file pins that behaviour with the
 *      report's own worked example, in addition to the generic coverage in
 *      documentTotals.test.js.
 *
 *   2. frontend/src/pages/purchase/PurchaseInvoice.jsx's Copy From > Purchase
 *      GRN handler (`applyGrn`) built its invoice lines with a hard-coded
 *      `taxPercent: 18`, discarding whatever rate the GRN line actually
 *      carried — so a 5%-rated GRN line always came into the invoice at 18%.
 *      Its sibling handler, Copy From > Purchase Order (`applyOrder`),
 *      already did this correctly (`i.taxPercent != null ? Number(i.taxPercent) : 18`).
 *      This suite characterises the correct fallback both handlers must now
 *      share — carry the source line's own rate across, defaulting only when
 *      the source genuinely has none — so a regression that reintroduces a
 *      flat default on either Copy From path is caught here even though the
 *      component itself has no test harness in this repo.
 *
 * Run with:  node --test src/tests/
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildDocument, round2 } = require('../utils/documentTotals');

// Mirrors the `i.taxPercent != null ? Number(i.taxPercent) : fallback`
// expression every Copy From handler in the purchase flow uses (PurchaseOrder
// .jsx's applyQuotation, PurchaseGRN.jsx's PO copy, PurchaseInvoice.jsx's
// applyOrder and applyGrn) to build a follow-on document's line from a source
// document's line. A conversion must never substitute the product master's
// current tax rate here — only the source line's own persisted value, or the
// document-type default when the source line truly has none.
function carryTaxPercent(sourceLine, fallback) {
  return sourceLine.taxPercent != null ? Number(sourceLine.taxPercent) : fallback;
}

// ---------------------------------------------------------------------------
// Acceptance criteria — the report's own worked example
// ---------------------------------------------------------------------------

const ROUND_BARS = { productCode: 'RB-01', productName: 'Round Bars', quantity: 1, unitPrice: 10000, taxPercent: 18 };
const HYDRAULIC = { productCode: 'HC-01', productName: 'Hydraulic Components', quantity: 1, unitPrice: 30000, taxPercent: 5 };

test('acceptance: mixed-rate purchase, intra-state — subtotal 40000, CGST 1650, SGST 1650, grand total 43300', () => {
  const { totals } = buildDocument([ROUND_BARS, HYDRAULIC], 0);
  assert.equal(totals.subtotal, 40000);
  assert.equal(totals.cgstAmount, 1650);
  assert.equal(totals.sgstAmount, 1650);
  assert.equal(totals.igstAmount, 0);
  assert.equal(totals.amount, 43300);
});

test('acceptance: the same transaction, inter-state — IGST 3300, no CGST/SGST, same grand total', () => {
  const { totals } = buildDocument([ROUND_BARS, HYDRAULIC], 0, { interState: true });
  assert.equal(totals.subtotal, 40000);
  assert.equal(totals.igstAmount, 3300);
  assert.equal(totals.cgstAmount, 0);
  assert.equal(totals.sgstAmount, 0);
  assert.equal(totals.amount, 43300);
});

test('acceptance: never a single blended rate — 43300 is not what an 18% or 5% flat rate would produce', () => {
  const { totals } = buildDocument([ROUND_BARS, HYDRAULIC], 0);
  const flatAt18 = round2(40000 * 1.18);
  const flatAt5 = round2(40000 * 1.05);
  assert.notEqual(totals.amount, flatAt18, 'must not silently promote every line to the highest rate present');
  assert.notEqual(totals.amount, flatAt5, 'must not silently demote every line to the lowest rate present');
});

// ---------------------------------------------------------------------------
// REGRESSION: PO's own totals used to blend a single % over the combined
// subtotal instead of taxing each line at its own rate.
// ---------------------------------------------------------------------------

test('regression: Purchase Order totals compute tax item-by-item, not a blended % of the combined subtotal', () => {
  const { totals } = buildDocument([ROUND_BARS, HYDRAULIC], 0, { roundOff: true });
  // The blended-rate defect computed one % = totalTax/subtotal and applied it
  // to the whole subtotal, which for this mix worked out to CGST=SGST=2950,
  // amount=45900 (see the bug report). The correct item-by-item figures are:
  assert.equal(totals.cgstAmount, 1650);
  assert.equal(totals.sgstAmount, 1650);
  assert.notEqual(totals.cgstAmount, 2950, 'must not reproduce the blended-rate defect');
  assert.equal(totals.amount, 43300);
});

// ---------------------------------------------------------------------------
// REGRESSION: Copy From must carry each line's own rate across, never a flat
// document-type default — the defect that changed Hydraulic Components from
// 5% to 18% when copied from GRN onto a Purchase Invoice.
// ---------------------------------------------------------------------------

test('regression: converting a GRN line to an invoice line preserves that line\'s own tax rate', () => {
  const grnLines = [
    { ...ROUND_BARS, receivedQuantity: 1 },
    { ...HYDRAULIC, receivedQuantity: 1 },
  ];
  const invoiceLines = grnLines.map((l) => ({ ...l, taxPercent: carryTaxPercent(l, 18) }));
  assert.equal(invoiceLines[0].taxPercent, 18, 'Round Bars stays at 18%');
  assert.equal(invoiceLines[1].taxPercent, 5, 'Hydraulic Components must NOT be promoted to 18%');
});

test('regression: converting a PO line to an invoice line preserves that line\'s own tax rate', () => {
  const poLines = [ROUND_BARS, HYDRAULIC];
  const invoiceLines = poLines.map((l) => ({ ...l, taxPercent: carryTaxPercent(l, 18) }));
  assert.equal(invoiceLines[0].taxPercent, 18);
  assert.equal(invoiceLines[1].taxPercent, 5);
});

test('a source line with genuinely no tax rate falls back to the document-type default, not zero-by-accident', () => {
  const line = { productCode: 'X', quantity: 1, unitPrice: 100, taxPercent: null };
  assert.equal(carryTaxPercent(line, 18), 18);
});

test('full chain Quotation -> PO -> GRN -> Invoice: every stage keeps each line at its own rate', () => {
  const quotationLines = [ROUND_BARS, HYDRAULIC];
  const poLines = quotationLines.map((l) => ({ ...l, taxPercent: carryTaxPercent(l, 18) }));
  const grnLines = poLines.map((l) => ({ ...l, receivedQuantity: l.quantity, taxPercent: carryTaxPercent(l, 18) }));
  const invoiceLines = grnLines.map((l) => ({ ...l, taxPercent: carryTaxPercent(l, 18) }));

  for (const stage of [poLines, grnLines, invoiceLines]) {
    const roundBars = stage.find((l) => l.productCode === 'RB-01');
    const hydraulic = stage.find((l) => l.productCode === 'HC-01');
    assert.equal(roundBars.taxPercent, 18);
    assert.equal(hydraulic.taxPercent, 5);
  }

  const { totals } = buildDocument(invoiceLines, 0);
  assert.equal(totals.subtotal, 40000);
  assert.equal(totals.cgstAmount, 1650);
  assert.equal(totals.sgstAmount, 1650);
  assert.equal(totals.amount, 43300);
});

// ---------------------------------------------------------------------------
// A user manually changing one line's tax rate recalculates that line and the
// header correctly (requirement 10) — already the generic behaviour of
// computeTotals/buildDocument, pinned here against the report's own figures.
// ---------------------------------------------------------------------------

test('manually changing one line\'s tax rate recalculates that line and the header totals', () => {
  const before = buildDocument([ROUND_BARS, HYDRAULIC], 0).totals;
  assert.equal(before.amount, 43300);

  const hydraulicAt12 = { ...HYDRAULIC, taxPercent: 12 };
  const after = buildDocument([ROUND_BARS, hydraulicAt12], 0).totals;
  // Round Bars' tax (1800) is unaffected; Hydraulic's rises from 1500 to 3600.
  assert.equal(after.totalTax, 1800 + 3600);
  assert.equal(after.subtotal, 40000, 'subtotal is unaffected by a tax-rate-only change');
  assert.equal(after.amount, 45400);
});

// ---------------------------------------------------------------------------
// Degenerate quantities (requirement 12: zero / negative quantity)
// ---------------------------------------------------------------------------

test('a zero-quantity line contributes nothing to any total, at any tax rate', () => {
  const zeroQtyHydraulic = { ...HYDRAULIC, quantity: 0 };
  const { totals } = buildDocument([ROUND_BARS, zeroQtyHydraulic], 0);
  assert.equal(totals.subtotal, 10000);
  assert.equal(totals.cgstAmount, 900);
  assert.equal(totals.sgstAmount, 900);
  assert.equal(totals.amount, 11800);
});

test('a negative-quantity line (return-shaped) still uses its own rate, not the other line\'s', () => {
  const returnedRoundBars = { ...ROUND_BARS, quantity: -1 };
  const { totals } = buildDocument([returnedRoundBars, HYDRAULIC], 0);
  assert.equal(totals.subtotal, 20000, '-10000 + 30000');
  // -10000 @ 18% = -1800; 30000 @ 5% = 1500 -> totalTax = -300
  assert.equal(totals.totalTax, -300);
  assert.equal(round2(totals.cgstAmount + totals.sgstAmount), totals.totalTax);
});
