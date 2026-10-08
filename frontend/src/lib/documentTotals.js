/**
 * Canonical document totals engine — frontend mirror.
 *
 * Eight pages (Purchase Quotation/Order/GRN/Invoice, Sales Quotation/Order/
 * Delivery Challan/Invoice) each carried their own inline copy of this
 * arithmetic to render the totals panel while the user types. The copies had
 * drifted from each other and from the server, so the figures on screen were
 * not always the figures that got saved — and on GRN and Delivery Challan both
 * sides were wrong in the same way, hard-coding CGST and SGST at 9% each
 * regardless of what the goods actually attract.
 *
 * This module is the single source of truth on the client. It is a behavioural
 * mirror of backend/src/utils/documentTotals.js — the two MUST agree, because
 * the server recomputes every total on save and a mismatch means the user sees
 * one number and the ledger records another.
 */

/**
 * Round to 2 decimal places, half away from zero, without binary-float bleed.
 *
 * The naive `Math.round(v * 100) / 100` is wrong for values like 1.005 (really
 * 1.00499999999999989 in IEEE-754). Re-normalising through toPrecision(12)
 * discards the 1e-13-scale residue that decimal-ish values pick up, which is
 * what makes per-line rounding sum back to the header total reliably.
 */
export function round2(value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return 0;
  const sign = v < 0 ? -1 : 1;
  const scaled = Number((Math.abs(v) * 100).toPrecision(12));
  return (sign * Math.round(scaled)) / 100;
}

/** Coerce anything (string from an input, null, undefined) to a finite number. */
export function num(value) {
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
 * TCS_RATE/buildTaxGroupRows in ./taxCodeGroups.js exactly, so GL account
 * setup (what that file drives) and actual document postings (this file)
 * never disagree about how TCS is derived.
 */
const TCS_RATE = 1;

/** True for the two Tax Code types that carry a TCS carve-out. */
export function isTcsTaxType(taxType) {
  const t = String(taxType || '').trim().toUpperCase();
  return t === 'GST+TCS' || t === 'IGST+TCS';
}

/**
 * True when the supply is inter-state and must be taxed as IGST rather than
 * split CGST/SGST. Blank on either side falls back to intra-state, which is
 * how every existing document was saved.
 */
export function isInterState(placeOfSupply, homeState) {
  const a = String(placeOfSupply ?? '').trim().toLowerCase();
  const b = String(homeState ?? '').trim().toLowerCase();
  if (!a || !b) return false;
  return a !== b;
}

/**
 * Normalise one document line. `quantityField` exists because GRN lines carry
 * the received quantity under `receivedQuantity` rather than `quantity`.
 *
 * `taxType` (the resolved Tax Code's taxType — 'GST'/'IGST'/'GST+TCS'/
 * 'IGST+TCS', or blank for a line with no resolvable Tax Code) rides through
 * unchanged; it drives computeTotals's TCS carve-out below and nothing else
 * about line normalisation.
 */
export function normaliseLine(item, { quantityField = 'quantity' } = {}) {
  const quantity = num(item?.[quantityField]);
  const unitPrice = num(item?.unitPrice);
  const discountPercent = item?.discountPercent != null ? num(item.discountPercent) : 0;
  const taxPercent = item?.taxPercent != null ? num(item.taxPercent) : 0;
  const taxType = item?.taxType != null ? String(item.taxType) : '';

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
 * THE TWO DISCOUNTS ARE INDEPENDENT, and deliberately so. A line's own
 * Discount % is applied by normaliseLine to that line alone, reducing its
 * Amount and nothing else. The header Discount % passed in here is a separate
 * deduction taken once, off the Subtotal — which is already the sum of the
 * line-discounted Amounts. So the order is: each line discounts itself, the
 * discounted lines sum to the Subtotal, and the header discount comes off that
 * sum. Neither figure is derived from, overwritten by, or kept equal to the
 * other, and nothing here reads a line's discountPercent back out.
 *
 * That means the two never double-count (a line discount is inside `amount`
 * before Subtotal is formed; the header percentage is applied to the Subtotal
 * exactly once) and never cancel out (each has its own input field and its own
 * step). Do not add code that recomputes one from the other — a two-way sync
 * lived here briefly and was removed for exactly this reason. The server
 * mirrors this same order in backend/src/utils/documentTotals.js.
 *
 * Tax is computed per line, on that line's share of the post-discount taxable
 * amount, at that line's own rate — a document mixing 5% and 18% goods gets
 * the right blended tax rather than one flat rate. The CGST/SGST split assigns
 * the remainder to SGST so an odd number of paise cannot make the two halves
 * differ from the total.
 *
 * TCS is NOT part of that per-line tax at all: a 'GST+TCS'/'IGST+TCS' line's
 * taxPercent is split into CGST/SGST or IGST exactly like a plain GST/IGST
 * line (totalTax is the same figure either way). Once the CGST/SGST/IGST
 * split is known, TCS is computed once for the whole document as a flat 1%
 * of (Subtotal + CGST + SGST + IGST) and added on top of the grand total —
 * only when at least one line carries a TCS-typed Tax Code; a document with
 * no TCS-typed lines gets tcsAmount 0 and an unchanged grand total.
 */
export function computeTotals(lines, discountPercent, { interState = false, roundOff = false, freightAmount = 0 } = {}) {
  const rows = Array.isArray(lines) ? lines : [];
  const subtotal = round2(rows.reduce((sum, l) => sum + num(l.amount), 0));
  const headerDiscount = round2(subtotal * (num(discountPercent) / 100));
  // freightAmount folds Freight Charges' Net Amount into the taxable base so
  // GST is computed on it via the same per-line ratio as everything else.
  // Defaults to 0 so every existing caller that doesn't pass it is unchanged.
  const taxableAmount = round2(subtotal - headerDiscount + num(freightAmount));

  const ratio = subtotal !== 0 ? taxableAmount / subtotal : 0;

  let totalTaxSum = 0;
  let hasTcs = false;
  for (const l of rows) {
    const lineTaxable = round2(num(l.amount) * ratio);
    totalTaxSum += round2(lineTaxable * (num(l.taxPercent) / 100));
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
 * The tax lines to display for a computed document: one IGST row on an
 * inter-state supply, a CGST/SGST pair otherwise, plus a trailing TCS row
 * when the document actually carries any (tcsAmount > 0) — never shown, and
 * never any nonzero, on a document whose lines are all plain GST/IGST.
 *
 * Both the on-screen totals panel and the print templates render from this,
 * so a document can't be described one way on the form and another on paper.
 * TCS is no longer carved out of the GST/IGST rate — it's a separate flat 1%
 * of Subtotal + CGST + SGST + IGST — so the CGST/SGST/IGST label's rate is
 * simply totalTax's own rate, and a trailing "TCS (1%)" row is appended
 * whenever the document actually carries any (tcsAmount > 0).
 *
 * @returns {{label: string, amount: number}[]}
 */
export function taxComponentRows(totals, interState = false) {
  const taxable = num(totals?.taxableAmount);
  const totalTax = num(totals?.totalTax);
  const tcsAmount = num(totals?.tcsAmount);
  const rate = taxable > 0 && totalTax > 0 ? (totalTax / taxable) * 100 : null;
  // Trims what a fixed precision leaves behind: 9.00 -> "9", 2.50 -> "2.5".
  const show = (r) => (r == null ? '' : ` (${Number(r.toFixed(2))}%)`);

  const rows = interState
    ? [{ label: `IGST${show(rate)}`, amount: num(totals?.igstAmount) }]
    : (() => {
        const half = rate == null ? null : rate / 2;
        return [
          { label: `CGST${show(half)}`, amount: num(totals?.cgstAmount) },
          { label: `SGST${show(half)}`, amount: num(totals?.sgstAmount) },
        ];
      })();

  if (tcsAmount > 0) {
    rows.push({ label: 'TCS (1%)', amount: tcsAmount });
  }
  return rows;
}

/**
 * Normalise raw form rows and compute the header in one call — what the
 * document pages use inside their useMemo.
 */
export function buildDocument(items, discountPercent, options = {}) {
  const { quantityField, ...totalsOptions } = options;
  const lines = (Array.isArray(items) ? items : []).map((i) => normaliseLine(i, { quantityField }));
  return { lines, totals: computeTotals(lines, discountPercent, totalsOptions) };
}

/**
 * Freight Charges — shared by every sales document page's own computeTotals
 * wrapper. Mirrors computeFreightGross in backend/src/routes/resources.js
 * exactly: Net Amount and Total Tax Amount are typed directly into the
 * Freight Charges popup (FreightChargesEditor), Gross Amount is always the
 * derived figure, never itself typed. Never negative, same reasoning as the
 * backend twin.
 */
export function computeFreightGross(netAmount, taxAmount) {
  return round2(Math.max(0, num(netAmount) + num(taxAmount)));
}

/**
 * Sum of every line's OWN discount (quantity * unitPrice * discountPercent /
 * 100, rounded per line) — what "Discount" now shows in DocumentTotalsPanel
 * across every sales document, replacing the old editable header Discount %
 * field there (item-level discount already exists per line; the header
 * field duplicated it and the two could disagree). Deliberately independent
 * of any header-level discountPercent — see DocumentTotalsPanel's showDiscount
 * doc comment.
 */
export function computeItemDiscountTotal(items, { quantityField = 'quantity' } = {}) {
  return round2((Array.isArray(items) ? items : []).reduce((sum, item) => {
    const gross = round2(num(item[quantityField]) * num(item.unitPrice));
    return sum + round2(gross * (num(item.discountPercent) / 100));
  }, 0));
}
