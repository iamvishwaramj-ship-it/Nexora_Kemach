/**
 * Canonical document totals engine.
 *
 * Every sales/purchase document in the app (quotation, order, GRN, delivery
 * challan, invoice) used to carry its own inline copy of the subtotal /
 * discount / tax / round-off arithmetic. Those copies had drifted apart and
 * three separate classes of defect had crept in:
 *
 *   1. GRN and Delivery Challan hard-coded CGST/SGST at 9% + 9%, so a
 *      consignment of 5%- or 12%-rated goods was taxed at 18% regardless of
 *      what the products actually attract, and the GRN never agreed with the
 *      PO or the Purchase Invoice it was matched against.
 *   2. Nothing was rounded. Raw binary floats were handed to Prisma and
 *      truncated into Decimal(15,2) columns at the last moment, so the stored
 *      cgst + sgst + taxable frequently did not add up to the stored grand
 *      total — off-by-a-paisa differences that block reconciliation and make
 *      GST returns fail validation.
 *   3. Inter-state supply was impossible to represent: tax was always split
 *      half into CGST and half into SGST, even when the place of supply is a
 *      different state and Indian GST law requires the whole amount as IGST.
 *
 * This module is the single source of truth for all of it. The frontend
 * mirror lives at frontend/src/lib/documentTotals.js and MUST be kept
 * byte-for-byte equivalent in behaviour — utils/__tests__ asserts parity.
 */

/**
 * Round to 2 decimal places, half away from zero, without binary-float bleed.
 *
 * The naive `Math.round(v * 100) / 100` is wrong for values like 1.005 (which
 * is really 1.00499999999999989 in IEEE-754) and for 8.165 * 100 = 816.4999…
 * Scaling and then re-normalising through toPrecision(12) discards the
 * 1e-13-scale residue that decimal-ish values pick up, which is what makes
 * per-item rounding sum back to the header total reliably.
 */
function round2(value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return 0;
  const sign = v < 0 ? -1 : 1;
  const scaled = Number((Math.abs(v) * 100).toPrecision(12));
  return (sign * Math.round(scaled)) / 100;
}

/** Coerce anything (Prisma Decimal, string, null) to a finite number. */
function num(value) {
  const v = Number(value);
  return Number.isFinite(v) ? v : 0;
}

/**
 * TCS — Tax Collected at Source, a flat 1 percentage point ADDED ON TOP of
 * the document's own Subtotal + CGST + SGST + IGST — never carved out of a
 * Tax Code's rate. A 'GST+TCS'/'IGST+TCS' line's taxPercent is the plain
 * GST/IGST rate (split into CGST/SGST or IGST exactly like a non-TCS line);
 * TCS is then computed once at the document level as 1% of
 * (subtotal + cgstAmount + sgstAmount + igstAmount) and added to the grand
 * total, only when the document carries at least one TCS-typed line. Mirrors
 * TCS_RATE/buildTaxGroupRows in frontend/src/lib/taxCodeGroups.js exactly, so
 * GL account setup (what that file drives) and actual document postings
 * (this file) never disagree about how TCS is derived.
 */
const TCS_RATE = 1;

/** True for the two Tax Code types that carry a TCS carve-out. */
function isTcsTaxType(taxType) {
  const t = String(taxType || '').trim().toUpperCase();
  return t === 'GST+TCS' || t === 'IGST+TCS';
}

/**
 * True when the supply is inter-state and must be taxed as IGST rather than
 * split CGST/SGST.
 *
 * Indian GST determines this by comparing the place of supply against the
 * supplier's registered state. Both are free-text columns here, so the
 * comparison is deliberately forgiving: case- and whitespace-insensitive, and
 * when either side is blank we fall back to intra-state (CGST/SGST), which is
 * the historical behaviour and keeps every existing record's tax split
 * unchanged.
 */
function isInterState(placeOfSupply, homeState) {
  const a = String(placeOfSupply ?? '').trim().toLowerCase();
  const b = String(homeState ?? '').trim().toLowerCase();
  if (!a || !b) return false;
  return a !== b;
}

/**
 * Normalise one document line.
 *
 * `amount` is the line net of its own discount, rounded to 2dp so that the
 * sum of the stored line amounts is exactly the stored subtotal — the header
 * is never allowed to disagree with the sum of what is printed on the lines.
 *
 * `quantityField` exists because GRN lines carry the received quantity under
 * `receivedQuantity` rather than `quantity`.
 *
 * `taxType` (the resolved Tax Code's taxType — 'GST'/'IGST'/'GST+TCS'/
 * 'IGST+TCS', or blank for a line with no resolvable Tax Code) rides through
 * unchanged; it drives computeTotals's TCS carve-out below and nothing else
 * about line normalisation.
 */
function normaliseLine(item, { quantityField = 'quantity' } = {}) {
  const quantity = num(item[quantityField]);
  const unitPrice = num(item.unitPrice);
  const discountPercent = item.discountPercent != null ? num(item.discountPercent) : 0;
  const taxPercent = item.taxPercent != null ? num(item.taxPercent) : 0;
  const taxType = item.taxType != null ? String(item.taxType) : '';

  const gross = round2(quantity * unitPrice);
  const discount = round2(gross * (discountPercent / 100));

  return {
    quantity,
    unitPrice,
    discountPercent,
    taxPercent,
    taxType,
    gross,
    amount: round2(gross - discount),
  };
}

/**
 * Compute header totals from a set of normalised lines.
 *
 * Tax is computed per line, on that line's share of the taxable amount after
 * the header-level discount, at that line's own rate — a document mixing 5%
 * and 18% goods gets the right blended tax rather than a single flat rate.
 * Each line's tax is rounded before being summed, so the header tax equals
 * the sum of the per-line tax figures shown on the printed document.
 *
 * TCS is NOT part of that per-line tax at all: a 'GST+TCS'/'IGST+TCS' line's
 * taxPercent is split into CGST/SGST or IGST exactly like a plain GST/IGST
 * line (totalTax is the same figure either way). Once the CGST/SGST/IGST
 * split is known, TCS is computed once for the whole document as a flat 1%
 * of (Subtotal + CGST + SGST + IGST) and added on top of the grand total —
 * only when at least one line carries a TCS-typed Tax Code; a document with
 * no TCS-typed lines gets tcsAmount 0 and an unchanged grand total.
 *
 * The CGST/SGST split assigns the remainder to SGST (`totalTax - cgst`)
 * rather than rounding both halves independently: an odd number of paise
 * would otherwise make cgst + sgst differ from totalTax by 0.01.
 *
 * @param {object[]} lines      output of normaliseLine
 * @param {number}   discountPercent  header-level discount
 * @param {object}   options
 *   interState: boolean  — tax the whole amount as IGST instead of CGST/SGST
 *   roundOff: boolean    — snap the grand total to a whole currency unit
 */
function computeTotals(lines, discountPercent, { interState = false, roundOff = false, freightAmount = 0 } = {}) {
  const subtotal = round2(lines.reduce((sum, l) => sum + l.amount, 0));
  const headerDiscount = round2(subtotal * (num(discountPercent) / 100));
  // freightAmount folds Freight Charges' Net Amount into the taxable base so
  // GST is computed on it via the same per-line ratio as everything else.
  // Defaults to 0 so every existing caller that doesn't pass it is unchanged.
  const taxableAmount = round2(subtotal - headerDiscount + num(freightAmount));

  // Proportional share of the post-discount taxable amount. Guarded against a
  // zero subtotal, which happens on a document whose lines are all zero-value
  // (free samples) or whose positive and negative lines cancel out.
  const ratio = subtotal !== 0 ? taxableAmount / subtotal : 0;

  let totalTaxSum = 0;
  let hasTcs = false;
  for (const l of lines) {
    const lineTaxable = round2(l.amount * ratio);
    totalTaxSum += round2(lineTaxable * (l.taxPercent / 100));
    if (isTcsTaxType(l.taxType)) {
      hasTcs = true;
    }
  }
  const totalTax = round2(totalTaxSum);

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  if (interState) {
    igstAmount = totalTax;
  } else {
    cgstAmount = round2(totalTax / 2);
    sgstAmount = round2(totalTax - cgstAmount);
  }

  // Flat 1% of Subtotal + CGST + SGST + IGST, added on top of the grand
  // total — see the TCS_RATE doc comment above.
  const tcsAmount = hasTcs
    ? round2((subtotal + cgstAmount + sgstAmount + igstAmount) * (TCS_RATE / 100))
    : 0;

  const preRoundTotal = round2(taxableAmount + totalTax + tcsAmount);
  const amount = roundOff ? Math.round(preRoundTotal) : preRoundTotal;

  return {
    subtotal,
    taxableAmount,
    totalTax,
    cgstAmount,
    sgstAmount,
    igstAmount,
    tcsAmount,
    roundOff: round2(amount - preRoundTotal),
    amount: round2(amount),
  };
}

/**
 * Convenience wrapper: normalise raw request items and compute the header in
 * one call. Returns both so callers can persist the cleaned lines.
 */
function buildDocument(items, discountPercent, options = {}) {
  const { quantityField, ...totalsOptions } = options;
  const lines = (items || []).map((i) => normaliseLine(i, { quantityField }));
  return { lines, totals: computeTotals(lines, discountPercent, totalsOptions) };
}

/**
 * Per-line CGST/SGST/IGST breakdown, in the same order as `lines` — computed
 * with the exact same ratio/rounding computeTotals uses for its own
 * `totalTax`, so summing this array's components always reproduces
 * computeTotals's header totals exactly (same lines/discountPercent/
 * interState in, same numbers out; this never diverges from computeTotals,
 * it's the same formula applied per line instead of once for the header).
 *
 * Used by GL posting (backend/src/utils/glPosting.js's postGst) to route a
 * line's tax to its own Tax Code's account instead of the document-level
 * default, when one is configured — see the Mapping Priority note on the
 * TaxCode model in schema.prisma. Not used by computeTotals itself, which
 * keeps its own simpler single-pass sum; this is an additive twin for
 * callers that need the per-line split, not a replacement.
 *
 * NOTE: does not yet carve out TCS the way computeTotals now does — a
 * '+TCS' line's tax here still lands entirely in cgst/sgst/igst, not split
 * out into its own component. GL posting was deliberately left out of this
 * pass (see the TCS totals/display work this shipped with); wiring TCS
 * postings to TaxCode.tcsSalesAccountId/tcsPurchaseAccountId is follow-up
 * work, and this function is the place that follow-up needs to start.
 */
function computeLineTaxBreakdown(lines, discountPercent, { interState = false } = {}) {
  const subtotal = round2(lines.reduce((sum, l) => sum + l.amount, 0));
  const headerDiscount = round2(subtotal * (num(discountPercent) / 100));
  const taxableAmount = round2(subtotal - headerDiscount);
  const ratio = subtotal !== 0 ? taxableAmount / subtotal : 0;

  return lines.map((l) => {
    const lineTax = round2(round2(l.amount * ratio) * (l.taxPercent / 100));
    if (interState) return { cgst: 0, sgst: 0, igst: lineTax };
    const cgst = round2(lineTax / 2);
    const sgst = round2(lineTax - cgst);
    return { cgst, sgst, igst: 0 };
  });
}

module.exports = {
  round2,
  num,
  isInterState,
  isTcsTaxType,
  normaliseLine,
  computeTotals,
  computeLineTaxBreakdown,
  buildDocument,
};
