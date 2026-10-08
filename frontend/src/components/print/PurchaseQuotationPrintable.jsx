import React from 'react';
import { partnerAddressLines, joinAddressParts, cleanAddressText } from '../../lib/addressFormat';
import { createPortal } from 'react-dom';
import dayjs from 'dayjs';
import { buildDocument, round2, num, isInterState, computeFreightGross } from '../../lib/documentTotals';
import { branchAddressLines } from '../../lib/branchAddress';
import { useIsActiveTab } from '../navigation/TabPathContext';

// =========================================================================
// CLONE NOTICE
// This file is a deliberate, near-mechanical clone of
// components/print/PurchaseOrderPrintable.jsx — same ruled-frame layout, same
// number formatting, same amount-in-words converter, same print activation
// mechanics. KEEP THE TWO IN SYNC: a fix to the frame, the @page handling or
// the totals wiring in one belongs in the other as well.
//
// Everything that is scoped per-document is renamed so two mounted printables
// can never fight each other: PRINT_CLASS, PAGE_RULE_ID, the print-area class
// and every layout class (`pq3-` here, `po3-` there). See the PRINT_CLASS
// comment below for why that matters.
//
// Differences from the Purchase Order sheet, all forced by the data that
// actually exists on PurchaseQuotation (see schema.prisma):
//   - Heading reads "PURCHASE QUOTATION".
//   - Ref No falls back to `quotationNo` (not `poNo`); the date row is
//     "Quotation Date" (`quotationDate`, not `poDate`).
//   - The right-hand meta half prints "Valid Upto" (`validUpto`) and
//     "Delivery Date" (`deliveryDate`) instead of the Purchase Order's
//     Transport / Carrier Name — this model has no transportMode and no
//     carrier field of any kind, and both of these are real, always-populated
//     quotation header dates.
//   - The Purchase Order's full-width "Comments :" band is DROPPED outright:
//     PurchaseQuotation has no `remarks` (or any other free-text note beyond
//     termsConditions), so the band could only ever have printed an empty
//     label.
// =========================================================================

// --- Print activation ------------------------------------------------------
// Every print rule this component installs is gated on these two classes, and
// the @page rule is injected only while a print is actually running. That is
// deliberate: KeepAliveOutlet keeps every open tab's page MOUNTED, so this
// component's <style> sits in the DOM whenever a Purchase Quotation tab is
// open — including while the user prints some completely different document.
// An ungated `body > *:not(.pq-print-area) { display: none }` would blank
// THEIR print, and an ungated `@page` would fight the one belonging to
// whichever printable they were actually using (ReportPrintable's is
// `A4 landscape` for wide reports, PurchaseInvoicePrintable's carries an 8mm
// margin). Gating on an explicit action means these rules exist only for the
// print this module itself started.
//
// These four identifiers are unique to this file — sharing any of them with
// PurchaseOrderPrintable/PurchaseGRNPrintable/PurchaseInvoicePrintable is
// exactly the collision the gating exists to prevent.
const PRINT_CLASS = 'pq-printing';
const PAGE_RULE_ID = 'pq-print-page-rule';

/**
 * Print THIS Purchase Quotation. Call instead of window.print() from the
 * Purchase Quotation page's own Print controls.
 *
 * The class toggle and the @page injection are plain synchronous DOM writes,
 * not React state, so they are guaranteed to be in effect for the layout
 * Chromium snapshots — a setState here would be batched and could miss the
 * snapshot entirely.
 *
 * The @page rule goes in as the LAST stylesheet in <head> so its `size`
 * descriptor wins the cascade over any other printable's @page that happens to
 * be mounted in a background tab; it is removed again on afterprint, so it
 * never outlives this print job.
 */
export function printPurchaseQuotation() {
  const root = document.documentElement;
  root.classList.add(PRINT_CLASS);
  document.body.classList.add(PRINT_CLASS);

  if (!document.getElementById(PAGE_RULE_ID)) {
    const rule = document.createElement('style');
    rule.id = PAGE_RULE_ID;
    // Explicit millimetres rather than the `A4 portrait` keyword pair: print
    // pipelines that only loosely implement the size keywords (notably the
    // Windows "Microsoft Print to PDF" driver reached through a browser's
    // "Print using system dialog" path) honour explicit physical dimensions
    // far more reliably, and that is what keeps the job portrait there.
    rule.textContent = '@page { size: 210mm 297mm; margin: 0; }';
    document.head.appendChild(rule);
  }

  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    root.classList.remove(PRINT_CLASS);
    document.body.classList.remove(PRINT_CLASS);
    const rule = document.getElementById(PAGE_RULE_ID);
    if (rule) rule.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  // Some PDF drivers never fire afterprint; without this the app would be
  // left with its shell hidden the next time anything printed.
  setTimeout(cleanup, 60000);

  window.print();
}

// Registered-office jurisdiction named in the footer ("Subject to 'Coimbatore
// Jurisdiction'") — fixed legal stationery text, not a per-company field, the
// same way Letterhead.jsx hardcodes REG_OFFICE as Coimbatore regardless of
// which branch (Ernakulam, Kannur, ...) actually raised the document.
const JURISDICTION_CITY = 'Coimbatore';

// GST registration category shown next to a GSTIN when the record itself
// doesn't carry one — "Regular/TDS/ISD" is the common-case value in
// GST_TYPE_OPTIONS (see lib/validation/partnerSchemas.js), used only as a
// display fallback so the line still reads like the reference document
// instead of going blank.
const DEFAULT_GST_TYPE = 'Regular/TDS/ISD';

const fmtDate = (d) => (d ? dayjs(d).format('DD-MMM-YYYY') : '—');
// No thousands grouping anywhere in this template — the legacy reference
// document prints "254237.28", never "2,54,237.28". Used only on the
// HSN/SAC summary table; the Freight/Round off/Grand Total box uses plain
// fmt2() with no "(INR)" prefix at all (see the reference PDF).
const fmtMoney = (n) => `(INR)${(Number(n) || 0).toFixed(2)}`;
const fmt2 = (n) => (Number(n) || 0).toFixed(2);
// The item table's own Tax % cell prints one decimal place with a trailing
// "%" ("CGST 9.0%") — a different precision than every other percent in the
// document (the HSN/SAC summary's Tax % columns print two decimals with no
// "%": "9.00"). Reproduced verbatim from the reference stationery rather
// than "corrected" to match fmt2.
const fmt1 = (n) => (Number(n) || 0).toFixed(1);

// --- Amount in words, matching the legacy system's exact wording ----------
// Deliberately NOT lib/numberToWords.js's amountToWords() — Cheque Print
// depends on that function's own wording (space-separated tens, "Rupees ...
// Paise Only") and must not change. This is a separate, local converter that
// reproduces the legacy print system's own quirks verbatim:
//   - compound tens are hyphenated ("Forty-Five", "Seventy-One")
//   - "lakh"/"lakhs" (and "crore"/"crores") print lower-case; "Thousand" and
//     "Hundred" stay capitalised — an inconsistency in the legacy output,
//     reproduced as-is rather than "corrected"
//   - the fractional label is "Pisa" (the legacy system's own misspelling of
//     Paise), and the trailing "only" is lower-case
// Copied (not imported) from PurchaseOrderPrintable.jsx, which does not
// export it — the two copies must stay byte-identical in behaviour.
const WORDS_ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const WORDS_TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigitWords(n) {
  if (n < 20) return WORDS_ONES[n];
  const tens = WORDS_TENS[Math.floor(n / 10)];
  const one = n % 10;
  return one ? `${tens}-${WORDS_ONES[one]}` : tens;
}

function threeDigitWords(n) {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return `${h ? `${WORDS_ONES[h]} Hundred` : ''}${h && rest ? ' ' : ''}${rest ? twoDigitWords(rest) : ''}`;
}

function wordsInr(value) {
  const abs = Math.abs(Number(value) || 0);
  const rupees = Math.floor(abs);
  const paise = Math.round((abs - rupees) * 100);
  if (rupees === 0 && paise === 0) return 'Zero only';

  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const rest = rupees % 1000;

  const parts = [];
  if (crore) parts.push(`${threeDigitWords(crore)} crore${crore > 1 ? 's' : ''}`);
  if (lakh) parts.push(`${twoDigitWords(lakh)} lakh${lakh > 1 ? 's' : ''}`);
  if (thousand) parts.push(`${twoDigitWords(thousand)} Thousand`);
  if (rest) parts.push(threeDigitWords(rest));

  const rupeeWords = parts.length ? parts.join(' ') : 'Zero';
  return paise ? `${rupeeWords} and ${twoDigitWords(paise)} Pisa only` : `${rupeeWords} only`;
}

// One postal address line from a Business Partner address row (see
// BusinessPartnerAddress in schema.prisma) — its fields are all optional and
// sparsely filled in practice (the reference document's own vendor address
// is just city/state), so each line is built from whatever is actually set
// rather than assuming every field is present.
function formatPartnerAddressLines(addr) {
  // Standard order, no double commas -- lib/addressFormat.js.
  return partnerAddressLines(addr);
}

function defaultAddressOf(partner, addressType) {
  const rows = (partner?.addresses || []).filter((a) => a.addressType === addressType);
  return rows.find((a) => a.isDefault) || rows[0] || null;
}

// Totals come from the shared engine in lib/documentTotals.js — the same
// module the form uses and a behavioural mirror of the server's own, so the
// printed figures always match what's shown on screen and saved to the DB.
function computeTotals(items, discountPercent, interState = false, order = {}) {
  const { totals } = buildDocument(items, discountPercent, { interState, roundOff: true });
  // Manually-entered Road Tax (same convention as the Sales documents' own
  // roadTax) and Freight Charges (Net + Tax) — both folded into the printed
  // Grand Total exactly as they are in the saved amount. See
  // backend/src/routes/resources.js's compute*Totals for this document.
  const roadTax = round2(Number(order.roadTax) || 0);
  const freightGrossAmount = order.freightGrossAmount != null
    ? round2(Number(order.freightGrossAmount) || 0)
    : computeFreightGross(order.freightNetAmount, order.freightTaxAmount);
  return {
    ...totals,
    discount: round2(totals.subtotal - totals.taxableAmount),
    roadTax,
    freightGrossAmount,
    grandTotal: round2(totals.amount + roadTax + freightGrossAmount),
  };
}

// One line's own taxable value and true tax — same arithmetic
// computeTotals() applies per line internally, so summing these across every
// line reproduces totals.taxableAmount/totals.totalTax exactly (which is
// what the item table's own Total row, Round off and Grand Total all rely
// on tying out to).
function lineTaxable(item, discountPercent) {
  const gross = round2(num(item.quantity) * num(item.unitPrice));
  const discount = round2(gross * (num(discountPercent) / 100));
  return round2(gross - discount);
}
function lineTrueTax(taxable, taxPercent) {
  return round2(taxable * (num(taxPercent) / 100));
}

// Display-only CGST/SGST (or IGST) split for the item table's Tax %/Tax
// Amount columns and the HSN/SAC summary. The reference document shows BOTH
// halves as the same rounded round2(tax / 2) — not a remainder-safe
// half+remainder split — so e.g. two 9% halves of a 45762.71 total both
// print as 22881.36 even though that's a paisa more than the true total.
// This is display-only: the item's own Amount column, the Total row, Round
// off and Grand Total all use the true tax (lineTrueTax / totals.totalTax)
// instead, so those figures still tie out to the paisa.
function displayTaxRows(taxPercent, trueTax, interState) {
  if (interState) {
    return [{ label: 'IGST', pct: num(taxPercent), amount: trueTax }];
  }
  const half = round2(trueTax / 2);
  const halfPct = round2(num(taxPercent) / 2);
  return [
    { label: 'CGST', pct: halfPct, amount: half },
    { label: 'SGST', pct: halfPct, amount: half },
  ];
}

// The item table's column widths, as percentages of the sheet width. Held in
// one place and emitted as a <colgroup> so the header, the body and the
// Total Qty/Total row can never drift out of alignment with each other.
// Matches the signed-off PurchaseOrderPrintTemplate.jsx mock exactly.
const ITEM_COL_WIDTHS = ['4%', '9%', '20%', '8%', '4%', '4%', '9%', '5%', '9%', '7%', '9%', '12%'];

// --- Per-physical-page pagination --------------------------------------
//
// This sheet used to be one continuous ruled frame rendered ONCE, sized to
// exactly 100vh — correct for a short quotation, but a quotation with enough
// items to run past a single physical page had nowhere to go: the frame's
// own flex-fill would simply be squeezed to nothing and the extra rows
// either overflowed the ruled border or were clipped outright, with no
// second page's worth of frame/border to receive them.
//
// The fix (already shipped on SalesQuotationPrintable.jsx/
// SalesInvoicePrintable.jsx for the same symptom) is to build the document
// as several explicit, self-contained .pq3-sheet page blocks (see
// renderPage/renderAllPages below), each one carrying its own complete ruled
// frame in normal document flow. The already-proven page-break-after: always
// rule (see the @media print block below) is what turns each block into its
// own physical page.
//
// Unlike the Sales/Invoice documents, this template carries no repeating
// KEMACH letterhead band of its own (see the CLONE NOTICE at the top of this
// file — it is cloned from PurchaseOrderPrintable.jsx's own plain ruled-
// frame stationery, not from Letterhead.jsx), so nothing here is a
// LetterheadHeader/Footer — what repeats per PAGE is simply the frame's own
// border and the item grid's own <thead>. The title and the vendor/billing/
// meta cards above the item table, and the totals/tax-summary/terms/
// signature/footer content below it, are exactly the kind of content that
// belongs once per DOCUMENT rather than once per page, so — same as every
// other print component using this per-page-block technique — they render
// on the first and last page respectively.
//
// Item counts per page are a fixed estimate, not a live measurement — this
// environment has no way to render the page and see exactly where text
// wraps. The constants below are deliberately conservative (biased toward
// splitting one extra page rather than risking an overflow that reproduces
// the original clipping bug), and are the one place to retune if a real
// print/PDF comes back with a page ending noticeably early.
const FIRST_PAGE_MAX_ITEMS = 7; // page 1 also carries the title + vendor/billing/meta bands
const MID_PAGE_MAX_ITEMS = 16;  // a continuation page with nothing but the item grid
const LAST_PAGE_MAX_ITEMS = 6;  // the last page also carries totals/tax-summary/terms/signature/footer

/**
 * Split items into page-sized chunks. A document short enough to fit
 * FIRST_PAGE_MAX_ITEMS on its own comes back as a single page that is both
 * isFirst and isLast — i.e. today's single-page layout, unchanged.
 */
function paginateItems(items) {
  if (items.length <= FIRST_PAGE_MAX_ITEMS) {
    return [{ items, isFirst: true, isLast: true }];
  }
  const pages = [{ items: items.slice(0, FIRST_PAGE_MAX_ITEMS), isFirst: true, isLast: false }];
  let rest = items.slice(FIRST_PAGE_MAX_ITEMS);
  while (rest.length > LAST_PAGE_MAX_ITEMS) {
    pages.push({ items: rest.slice(0, MID_PAGE_MAX_ITEMS), isFirst: false, isLast: false });
    rest = rest.slice(MID_PAGE_MAX_ITEMS);
  }
  // If the last MID-sized slice above consumed every remaining item
  // exactly (rest.length === 0), don't push a further page for the
  // leftover empty array — that produced a real, observed bug: a
  // spurious extra page with no items at all, just the repeating
  // letterhead header/footer band and a lot of blank space. Instead,
  // the LAST page already pushed by the loop is the true last page.
  if (rest.length > 0) {
    pages.push({ items: rest, isFirst: false, isLast: true });
  } else {
    pages[pages.length - 1].isLast = true;
  }
  return pages;
}

/**
 * The live, data-driven Purchase Quotation print — the Purchase Order sheet's
 * ruled stationery (see PurchaseOrderPrintable.jsx and the signed-off
 * PurchaseOrderPrintTemplate.jsx mock behind it) wired to a Purchase
 * Quotation instead. One continuous ruled frame: the outer box draws the page
 * border, and every section is a band inside it separated by a full-width
 * rule, so all the vertical dividers (billing/shipping, meta, signature) line
 * up down the sheet exactly as the reference prints it.
 *
 * Only ever rendered inside a `.pq-print-area` wrapper that's invisible on
 * screen and shown exclusively via the `@media print` rules below.
 */
function PurchaseQuotationPrintable({ order, company, supplierRecord, branchRecord, approverSignatureUrl }) {
  const isActive = useIsActiveTab();
  if (!order || !isActive) return null;

  const items = order.items || [];
  // Legacy documents saved before supplierState existed fall back to Place of Supply.
  const interState = isInterState(order.supplierState || order.placeOfSupply, company?.state);
  const totals = computeTotals(items, order.discountPercent, interState, order);
  const discPct = Number(order.discountPercent) || 0;
  // The item table's own "Total" row is the pre-round-off, post-tax sum
  // (matches summing every line's own Amount column) — the Grand Total box
  // below is the same figure after round-off is applied.
  const itemsTotal = round2(totals.taxableAmount + totals.totalTax);
  const totalQty = items.reduce((sum, it) => sum + num(it.quantity), 0);

  const pages = paginateItems(items);
  const pageCount = pages.length;

  // One <colgroup> element, reused by every item table on every page (head+
  // body, filler, totals) so their columns stay locked to ITEM_COL_WIDTHS
  // together.
  const itemColGroup = (
    <colgroup>
      {ITEM_COL_WIDTHS.map((w, i) => <col key={i} style={{ width: w }} />)}
    </colgroup>
  );

  const companyName = (company?.companyName || 'Nexora KEMACH').toUpperCase();
  const companyAddrLine2 = joinAddressParts([company?.city, company?.state, company?.country, company?.pincode]);

  // Shipping Address box: the reference document names this company itself
  // (the buyer) on both sides, not the document's Ship To / branch name — the
  // branch only supplies the delivery address lines below it.
  //
  // Kept in sync with PurchaseOrderPrintable (see the CLONE NOTICE above):
  // branchRecord is the row for this document's own "Branch *" field, so it
  // supplies every line here and switching branches actually changes what
  // prints; the company's own address is only the fallback for a document
  // with no branch picked. branchAddressLines() also reads Branch's split
  // Street No / Building / Block fields, which the previous inline version
  // ignored — a branch using those printed a half-empty address.
  const deliveryLines = branchAddressLines(branchRecord);
  const shippingLines = deliveryLines.length
    ? deliveryLines
    : [cleanAddressText(company?.address).replace(/\n/g, ', '), companyAddrLine2].filter(Boolean);

  // Company name + branch code merged into the address box name line, e.g.
  // "KEMACH EQUIPMENTS PRIVATE LIMITED - BR001", so the branch is identified
  // right on the "Billing Address :" / "Shipping Address :" name line above.
  const companyNameWithBranch = `${companyName || ''}${branchRecord?.branchCode ? ` - ${branchRecord.branchCode}` : ''}`;
  const billingDisplayLines = [cleanAddressText(company?.address).replace(/\n/g, ', '), companyAddrLine2].filter(Boolean);
  const shippingDisplayLines = shippingLines.length ? shippingLines : ['Branch address not set'];

  const supplierBillingAddr = defaultAddressOf(supplierRecord, 'Billing');
  const supplierAddrLines = formatPartnerAddressLines(supplierBillingAddr);
  const supplierGstNumber = supplierBillingAddr?.gstNumber || '—';
  const supplierGstType = supplierBillingAddr?.gstType || DEFAULT_GST_TYPE;

  // HSN/SAC-wise summary — grouped by HSN code and rate so a multi-rate
  // quotation still gets a correct row per group instead of one blended row.
  // Grouped on the TRUE per-line tax (so the group total ties out); the
  // equal-halves display split is applied once, at render time, from that
  // grouped true total — see displayTaxRows()'s own comment.
  const hsnGroups = [];
  const hsnIndex = new Map();
  items.forEach((it) => {
    const taxable = lineTaxable(it, discPct);
    const trueTax = lineTrueTax(taxable, it.taxPercent);
    const key = `${it.hsnCode || '—'}|${num(it.taxPercent)}`;
    if (!hsnIndex.has(key)) {
      const group = { hsnCode: it.hsnCode || '—', taxPercent: num(it.taxPercent), taxable: 0, trueTax: 0 };
      hsnIndex.set(key, group);
      hsnGroups.push(group);
    }
    const group = hsnIndex.get(key);
    group.taxable = round2(group.taxable + taxable);
    group.trueTax = round2(group.trueTax + trueTax);
  });

  // Tax summary column widths, matching the reference: 6 columns for
  // intra-state (CGST + SGST split), 4 for inter-state (single IGST).
  const taxColWidths = interState
    ? ['22%', '26%', '26%', '26%']
    : ['20%', '18%', '15%', '17%', '13%', '17%'];

  // Vendor "To" block + the two logo slots, billing/shipping addresses and
  // the Ref No/Quotation Date/Valid Upto/Delivery Date meta bands — page 1
  // only (see the pagination comment above paginateItems).
  const renderHeaderCards = () => (
    <>
      {/* 2 + 3 — Supplier "To" block and the two logo slots */}
      <div className="pq3-band pq3-head">
        <div>
          <div className="pq3-to-line"><span>To :</span>{order.supplier || '—'}{supplierRecord?.supplierCode ? ` - ${supplierRecord.supplierCode}` : ''}</div>
          <div className="pq3-vendor-block">
            {supplierAddrLines.length
              ? supplierAddrLines.map((line, i) => <div key={i}>{line}</div>)
              : <div>—</div>}
            <div>GST No : {supplierGstNumber} / GST Type : {supplierGstType}</div>
          </div>
        </div>
        <div className="pq3-logos">
          {company?.logoUrl && (
            <img
              id="companyLogo"
              className="pq3-logo pq3-logo-company"
              src={company.logoUrl}
              alt={company?.companyName || 'Company logo'}
            />
          )}
          {supplierRecord?.logoUrl && (
            <img
              id="vendorLogo"
              className="pq3-logo pq3-logo-vendor"
              src={supplierRecord.logoUrl}
              alt={order.supplier || 'Supplier logo'}
            />
          )}
        </div>
      </div>

      {/* 4 — Billing / Shipping */}
      <div className="pq3-band pq3-split">
        <div className="pq3-half">
          <div className="pq3-addr-label">Billing Address :</div>
          <div className="pq3-addr-name">{companyName}</div>
          <div className="pq3-addr-lines">
            {billingDisplayLines.map((line, i) => <div key={i}>{line}</div>)}
          </div>
          <div className="pq3-addr-gst">
            GSTN No: {company?.gstin || '—'} / GSTN Type: {DEFAULT_GST_TYPE}
          </div>
        </div>
        <div className="pq3-half">
          <div className="pq3-addr-label">Shipping Address :</div>
          <div className="pq3-addr-name">{companyNameWithBranch}</div>
          <div className="pq3-addr-lines">
            {shippingDisplayLines.map((line, i) => <div key={i}>{line}</div>)}
          </div>
          <div className="pq3-addr-gst">
            GSTN No: {company?.gstin || '—'} / GSTN Type: {DEFAULT_GST_TYPE}
          </div>
        </div>
      </div>

      {/* 5 — Ref No / Quotation Date / Valid Upto / Delivery Date.
          The Purchase Order sheet's right-hand half prints Transport and
          Carrier Name; PurchaseQuotation has no transport or carrier
          column at all, so this half carries the two remaining quotation
          header dates instead (both real, both on the form). */}
      <div className="pq3-band pq3-split">
        <div className="pq3-half">
          <div className="pq3-meta-row">
            <div className="pq3-meta-label">Ref No</div>
            <div className="pq3-meta-colon">:</div>
            <div className="pq3-meta-value">{order.referenceNo || order.quotationNo || '—'}</div>
          </div>
          <div className="pq3-meta-row">
            <div className="pq3-meta-label">Quotation Date</div>
            <div className="pq3-meta-colon">:</div>
            <div className="pq3-meta-value">{fmtDate(order.quotationDate)}</div>
          </div>
        </div>
        <div className="pq3-half">
          <div className="pq3-meta-row">
            <div className="pq3-meta-label">Valid Upto</div>
            <div className="pq3-meta-colon">:</div>
            <div className="pq3-meta-value">{fmtDate(order.validUpto)}</div>
          </div>
          <div className="pq3-meta-row">
            <div className="pq3-meta-label">Delivery Date</div>
            <div className="pq3-meta-colon">:</div>
            <div className="pq3-meta-value">{fmtDate(order.deliveryDate)}</div>
          </div>
        </div>
      </div>

      {/* The Purchase Order sheet's "Comments :" band sits here. It is
          deliberately absent: PurchaseQuotation carries no `remarks` (or
          any other free-text note beyond termsConditions), so the band
          could only ever have printed a bare label. */}
    </>
  );

  // 6 + 7 — Item table for one page, closing with the Total Qty / Total row
  // on the LAST page only (that row is the DOCUMENT's grand total, not a
  // per-page subtotal, so it cannot print correctly until every item on
  // every page has been counted). Three tables sharing one <colgroup>:
  // header + item rows for this page's own slice, a filler that stretches to
  // fill whatever's left of THIS sheet with ruled empty columns (so the
  // frame's grid lines reach the bottom of every physical page, not just a
  // short one), and — on the last page — the Total Qty / Total row pinned to
  // the bottom of the band. See .pq3-items-band in the CSS above.
  const renderItemsBand = (pageItems, startIndex, isLast) => (
    <div className="pq3-band pq3-items-band">
      <table className="pq3-items">
        {itemColGroup}
        <thead>
          <tr>
            <th>S.<br />No</th>
            <th>Item<br />Code</th>
            <th>Description</th>
            <th>HSN/<br />SAC</th>
            <th>UM</th>
            <th>Qty</th>
            <th>Unit<br />Price</th>
            <th>Disc<br />%</th>
            <th>Ass.<br />Value</th>
            <th>Tax<br />%</th>
            <th>Tax<br />Amount</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {pageItems.map((it, i) => {
            const idx = startIndex + i;
            const taxable = lineTaxable(it, discPct);
            const trueTax = lineTrueTax(taxable, it.taxPercent);
            const displayRows = displayTaxRows(it.taxPercent, trueTax, interState);
            const lineAmount = round2(taxable + trueTax);
            return (
              <tr key={idx}>
                <td className="ctr">{idx + 1}</td>
                <td>{it.productCode || '—'}</td>
                <td>{it.description || it.productName || '—'}</td>
                <td>{it.hsnCode || '—'}</td>
                <td className="ctr">{it.uom || '—'}</td>
                <td className="ctr">{num(it.quantity)}</td>
                <td className="num">{fmt2(it.unitPrice)}</td>
                <td className="num">{fmt2(discPct)}</td>
                <td className="num">{fmt2(taxable)}</td>
                <td>{displayRows.map((r, j) => <div key={j}>{r.label} {fmt1(r.pct)}%</div>)}</td>
                <td className="num">{displayRows.map((r, j) => <div key={j}>{fmt2(r.amount)}</div>)}</td>
                <td className="num">{fmt2(lineAmount)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Ruled empty space — a single row that takes every pixel left
          in the band, so the column dividers carry on down to the
          totals row (or, on a non-last page, all the way to the sheet's
          own bottom edge) instead of stopping under the last item. */}
      <div className="pq3-items-fill">
        <table className="pq3-items pq3-items-filler">
          {itemColGroup}
          <tbody>
            <tr>
              {ITEM_COL_WIDTHS.map((_, i) => <td key={i} />)}
            </tr>
          </tbody>
        </table>
      </div>

      {isLast && (
        <table className="pq3-items">
          {itemColGroup}
          <tfoot>
            <tr>
              <td colSpan={3} />
              {/* The label spans HSN/SAC + UM (12% together) rather than
                  sitting in the 4%-wide UM column alone: at 4% "Total Qty"
                  broke mid-word ("Tota l Qty"). The quantity itself still
                  lands in the Qty column, so no figure moves. */}
              <td colSpan={2} className="ctr">Total Qty</td>
              <td className="ctr">{totalQty}</td>
              <td colSpan={4} className="ctr">Total</td>
              <td />
              <td className="num">{fmt2(itemsTotal)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );

  // Amount in Words / Freight / Round off / Grand Total, HSN/SAC tax
  // summary, Tax Amount in Words, Terms & Conditions, signature and the
  // jurisdiction/contact footer — last page only.
  const renderFooterContent = () => (
    <>
      {/* 8 + 9 — Amount in Words, and Freight / Round off / Grand Total */}
      <div className="pq3-band pq3-sum">
        <div className="pq3-sum-words">
          Amount in Words. (INR)<span className="v">{wordsInr(totals.grandTotal)}</span>
        </div>
        <div className="pq3-sum-figures">
          <div className="r"><div className="l">Freight charges</div><div className="a">{fmt2(totals.freightGrossAmount)}</div></div>
          <div className="r"><div className="l">Road Tax</div><div className="a">{fmt2(totals.roadTax)}</div></div>
          <div className="r"><div className="l">Round off</div><div className="a">{fmt2(totals.roundOff)}</div></div>
          <div className="r grand"><div className="l">Grand Total</div><div className="a">{fmt2(totals.grandTotal)}</div></div>
        </div>
      </div>

      {/* 10 — Tax summary */}
      <div className="pq3-band">
        <table className="pq3-tax">
          <colgroup>
            {taxColWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
          </colgroup>
          <thead>
            <tr>
              <th>HSN/SAC</th>
              <th>TAXABLE VALUE</th>
              {interState ? (
                <>
                  <th>INTEGRATED TAX %</th>
                  <th>INTEGRATED TAX AMT</th>
                </>
              ) : (
                <>
                  <th>CENTRAL TAX %</th>
                  <th>CENTRAL TAX AMT</th>
                  <th>STATE TAX %</th>
                  <th>STATE TAX AMT</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {hsnGroups.length === 0 ? (
              <tr><td colSpan={interState ? 4 : 6}>—</td></tr>
            ) : hsnGroups.map((g, i) => {
              const rows = displayTaxRows(g.taxPercent, g.trueTax, interState);
              return (
                <tr key={i}>
                  <td>{g.hsnCode}</td>
                  <td>{fmtMoney(g.taxable)}</td>
                  {rows.map((r, j) => (
                    <React.Fragment key={j}>
                      <td>{fmt2(r.pct)}</td>
                      <td>{fmtMoney(r.amount)}</td>
                    </React.Fragment>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 11 — Tax Amount in Words */}
      <div className="pq3-band pq3-tax-words">
        Tax Amount in Words. (INR)<span className="v">{wordsInr(totals.totalTax)}</span>
      </div>

      {/* 12 — Terms & Conditions */}
      <div className="pq3-band pq3-terms">
        <div className="pq3-terms-title">Terms &amp; Conditions :</div>
        <div className="pq3-terms-body">{order.termsConditions || '—'}</div>
      </div>

      {/* 13 — Authorised signature */}
      <div className="pq3-band pq3-sign">
        <div className="pq3-sign-left" />
        <div className="pq3-sign-right">
          {!(order.purchaseType === 'Machine') && <div className="pq3-sign-for">For&nbsp;&nbsp;{companyName}</div>}
          <div className="pq3-sign-spacer" style={order.purchaseType === 'Machine' ? { height: '20mm' } : undefined}>
            {approverSignatureUrl ? <img className="pq3-sign-mark" src={approverSignatureUrl} alt="" style={order.purchaseType === 'Machine' ? { width: '50mm', height: '22mm' } : undefined} /> : null}
          </div>
          {!(order.purchaseType === 'Machine') && <div className="pq3-sign-label">Signature of the Authorized Person</div>}
        </div>
      </div>

      {/* 14 — Footer */}
      <div className="pq3-footer">
        <div>Subject to &apos;{JURISDICTION_CITY} Jurisdiction&apos;</div>
        <div>Ph No : {company?.phone || '—'} &nbsp; Email Id : {company?.email || '—'}</div>
      </div>
    </>
  );

  // One physical page — its own complete ruled frame in normal document
  // flow, so the browser draws it on THIS page regardless of how many pages
  // the document has (see the pagination comment above paginateItems for why
  // this replaced the single fixed-100vh sheet).
  const renderPage = (page, pageIndex, startIndex) => (
    <div className="pq3-sheet" key={pageIndex}>
      <div className="pq3-page">
        {/* 1 — Title */}
        {page.isFirst && <div className="pq3-title">PURCHASE QUOTATION</div>}

        <div className="pq3-frame">
          {page.isFirst && renderHeaderCards()}
          {renderItemsBand(page.items, startIndex, page.isLast)}
          {page.isLast && renderFooterContent()}
        </div>

        <div className="pq3-pagefoot">Page {pageIndex + 1} of {pageCount}</div>
      </div>
    </div>
  );

  const renderAllPages = () => {
    let startIndex = 0;
    return pages.map((page, i) => {
      const el = renderPage(page, i, startIndex);
      startIndex += page.items.length;
      return el;
    });
  };

  // Portaled to <body> rather than rendered inline. Two reasons, both
  // load-bearing:
  //   1. It makes .pq-print-area a DIRECT child of <body>, which is what lets
  //      the print CSS above remove the app shell with `display: none` instead
  //      of `visibility: hidden`. Inline, this sits deep inside
  //      #root > MainLayout > ... , and hiding `body > *:not(.pq-print-area)`
  //      would hide its own ancestors and print a blank sheet. Leaving the
  //      shell in layout (merely invisible) is what makes Chrome flip the job
  //      to landscape.
  //   2. Portal children are appended after #root, so this component's <style>
  //      comes later in document order than any other printable mounted in a
  //      background KeepAlive tab — its rules win the cascade rather than
  //      losing to whichever page happened to mount last.
  const sheet = (
    <div className="pq-print-area">
      <style>{`
        .pq-print-area { display: none; }
        @media print {
          /* Chrome (unlike Edge, on the same Chromium engine) picks the print
             orientation partly from the actual laid-out size of <html>/<body>
             at print time, not only from @page. The old approach here was
             "body * { visibility: hidden }", which hides the app shell
             VISUALLY but leaves it in layout at its full desktop width —
             Chrome measures that leftover footprint, sees something far wider
             than an A4 portrait page, and silently swaps the job to landscape
             "to fit". display: none removes it from layout outright, so there
             is no oversized footprint left to react to.
             That is only expressible because the sheet is PORTALED to
             <body> (see the createPortal call at the bottom of this file):
             .pq-print-area is a direct child of <body>, so hiding
             "body > *:not(.pq-print-area)" cannot hide the sheet's own
             ancestors. Rendered inline it sits deep inside #root > MainLayout
             > ... , and the same selector would have hidden the whole chain
             containing it — printing a blank page. */
          html.pq-printing, body.pq-printing {
            width: 210mm !important; height: 297mm !important;
            margin: 0 !important; padding: 0 !important;
            overflow: hidden !important; background: #fff !important;
          }
          body.pq-printing > *:not(.pq-print-area) { display: none !important; }
          body.pq-printing #root > *:not(.pq-print-area) { display: none !important; }
          body.pq-printing .pq-print-area {
            display: block !important; position: absolute; top: 0; left: 0;
            width: 100%; margin: 0; padding: 0;
          }
          body.pq-printing .pq-print-area,
          body.pq-printing .pq-print-area * { visibility: visible; }

          /* This ruled-frame masthead has no repeating letterhead band of
             its own (see the pagination comment above paginateItems), but
             the document itself must still repeat once per PHYSICAL PAGE
             when it runs past one: the document is now built as several
             explicit .pq3-sheet blocks (see renderPage/renderAllPages), and
             this is what turns each one into its own page rather than
             letting them all flow onto a single overlong sheet. */
          .pq3-sheet { page-break-after: always; }
          .pq3-sheet:last-child { page-break-after: auto; }
        }

        /* ==== Layout — the signed-off PurchaseOrderPrintTemplate.jsx mock's
           own markup and CSS (by way of PurchaseOrderPrintable.jsx), wired to
           live Purchase Quotation data. Keep all three in sync. */

        /* The physical sheet. min-height: 100vh, NOT height: 100vh and NOT a
           hardcoded 297mm — the same hard-won rule ReportPrintable.jsx
           documents at length: in print, 1vh is 1% of whatever printable
           area the browser/driver actually hands the page, and that is NOT
           reliably the full 297mm sheet even with @page { margin: 0 }.
           Chrome's own pipeline, and real drivers such as Windows'
           "Microsoft Print to PDF", can still reserve their own margin or
           apply a print-dialog Scale. When they do, a fixed-mm sheet no
           longer matches the real printable area: .pq3-frame's flex-fill
           stretches to the wrong box, and the frame's bottom rule lands
           short of the true bottom edge with a dead, unbordered strip of
           paper beneath it — which is exactly the gap this template used to
           print. Sizing to 100vh means the sheet always matches whatever
           area is actually granted, so the frame reaches the real edge under
           every driver. min-height rather than a fixed height, on top of
           that, is what lets a page with more items than FIRST/MID/
           LAST_PAGE_MAX_ITEMS grow taller than 100vh instead of clipping —
           the browser's own print pagination (the page-break-after rule
           above) then carries the overflow onto the NEXT explicit
           .pq3-sheet block rather than clipping or overlapping it; in
           practice this should rarely if ever fire, since the whole point
           of paginateItems() is to keep each page's own content within one
           sheet's worth of room, but it is what keeps a mis-tuned constant
           from reproducing the original clipping bug instead of just
           shifting rows onto a slightly early page break.
           The 6mm page inset is this element's own padding rather than an
           @page margin, so it is decided in exactly one place and no print
           engine can add a second one on top. box-sizing: border-box keeps
           that padding inside the box. */
        .pq3-sheet {
          min-height: 100vh;
          padding: 6mm;
          box-sizing: border-box;
        }
        /* min-height: calc(...), NOT height: 100vh/100% — .pq3-sheet above
           no longer has a DEFINITE height of its own (it is min-height: 100vh
           with no height set, so it can grow with content), and a percentage
           height on a child needs a definite height on the parent to resolve
           against; against an indefinite/auto parent height, height: 100%
           computes to auto instead (CSS2.1 10.5), which would silently
           collapse this flex column to its own content's natural height —
           far short of a full page — and pull .pq3-frame's own bottom rule
           up to sit right under a short item table instead of at the true
           bottom of the sheet. 100vh minus .pq3-sheet's own 6mm top+bottom
           padding is this element's true floor — not 100vh itself, or this
           box plus the sheet's padding would together exceed one physical
           page and push part of the frame onto a second page even for a
           short, single-page document. */
        .pq3-page {
          min-height: calc(100vh - 12mm);
          background: #fff;
          color: #000;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 11px;
          line-height: 1.28;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }

        .pq3-title {
          text-align: center;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.5px;
          padding-bottom: 4px;
        }

        /* The single ruled frame everything below the title sits in. flex: 1
           makes it take all the height left on the sheet, so the terms band
           stretches and the signature + footer always land on the bottom
           edge — the document fills the page for a 1-line quotation exactly
           as it does for a full one. */
        .pq3-frame {
          flex: 1;
          border: 1px solid #000;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .pq3-band { border-bottom: 1px solid #000; }
        .pq3-split { display: flex; }
        .pq3-split > .pq3-half { width: 50%; padding: 3px 6px; }
        .pq3-split > .pq3-half:first-child { border-right: 1px solid #000; }

        /* ---- 1. Vendor "To" + the two logos ---------------------------- */
        .pq3-head { display: flex; justify-content: space-between; align-items: flex-start; padding: 4px 6px 5px; gap: 10px; }
        .pq3-to-line { font-weight: 700; margin-bottom: 7px; }
        .pq3-to-line span { display: inline-block; min-width: 34px; }
        .pq3-vendor-block { padding-left: 34px; }
        .pq3-vendor-block div { line-height: 1.45; }
        /* Two SEPARATE logo slots: company first, vendor second. */
        .pq3-logos { display: flex; align-items: flex-start; gap: 14px; flex-shrink: 0; padding-top: 2px; }
        .pq3-logo { object-fit: contain; }
        .pq3-logo-company { height: 15mm; max-width: 46mm; }
        .pq3-logo-vendor { height: 17mm; max-width: 46mm; }

        /* ---- 2. Billing / Shipping ------------------------------------ */
        .pq3-addr-label { margin-bottom: 3px; }
        .pq3-addr-name { font-weight: 700; font-size: 11.5px; margin-bottom: 3px; }
        .pq3-addr-lines div { line-height: 1.45; }
        .pq3-addr-gst { margin-top: 2px; }

        /* ---- 3. Ref No / Quotation Date / Valid Upto / Delivery Date --- */
        .pq3-meta-row { display: flex; align-items: baseline; }
        .pq3-meta-row + .pq3-meta-row { margin-top: 4px; }
        .pq3-meta-label { font-weight: 700; width: 30%; }
        .pq3-meta-colon { width: 8px; }
        .pq3-meta-value { font-weight: 700; }

        /* ---- 4. Item table -------------------------------------------- */
        table.pq3-items { width: 100%; border-collapse: collapse; table-layout: fixed; }
        table.pq3-items th, table.pq3-items td {
          border-right: 1px solid #000;
          border-bottom: 1px solid #000;
          padding: 2px 4px;
          font-size: 9.5px;
          vertical-align: top;
          word-wrap: break-word;
        }
        /* The frame already draws the outer edge — dropping the last cell's
           right border keeps every rule a single hairline, never a double. */
        table.pq3-items th:last-child, table.pq3-items td:last-child { border-right: none; }
        table.pq3-items thead th { text-align: center; font-weight: 700; vertical-align: middle; }
        table.pq3-items td.ctr { text-align: center; }
        /* Rate/Amount cells hold the widest numbers in the row (with
           commas and two decimals) but sit in the narrowest columns --
           at the table's base 9.5px they were wide enough to spill past
           the column's right border instead of wrapping (word-wrap:
           break-word only breaks between characters, which for a plain
           number never kicks in). Matching the sales printables' own
           fix for the identical problem: shrink just the numeric cells
           to 8.5px and force a single line, so the number fits inside
           its column instead of overflowing it. */
        table.pq3-items td.num { text-align: right; font-size: 8.5px; white-space: nowrap; }
        table.pq3-items tfoot td { font-weight: 700; border-bottom: none; }
        table.pq3-items tfoot td.ctr { text-align: center; }

        /* The item band is what absorbs the sheet's spare height now (the
           Terms band used to). Splitting the one table into head+body, a
           stretchable filler and the Total Qty/Total foot is what lets the
           totals row sit at the BOTTOM of the band with ruled, empty column
           space above it — the way the Tax Invoice stationery prints it. All
           three tables share ITEM_COL_WIDTHS through the same <colgroup>
           element, so their columns can never drift apart.
           flex: 1 0 auto, not flex: 1 — a zero flex-basis would let a long
           quotation's rows be squeezed below their natural height and spill
           out of the frame; auto keeps the rows at full height and only the
           SPARE space is handed to the filler. */
        .pq3-items-band { flex: 1 0 auto; display: flex; flex-direction: column; }
        .pq3-items-fill { flex: 1 1 auto; display: flex; flex-direction: column; min-height: 0; }
        /* height: 100% on a ONE-row table hands every spare pixel to that row,
           so each cell's border-right runs the full depth of the empty space
           and its border-bottom draws the rule directly above Total Qty.
           margin-top: -1px overlaps the body table's own bottom rule: these
           are separate tables, so their borders cannot collapse into one and
           would otherwise print as a 2px double line. */
        table.pq3-items-filler { flex: 1 1 auto; height: 100%; margin-top: -1px; }
        table.pq3-items-filler td { padding: 0; }

        /* ---- 5. Amount in words + Freight / Round off / Grand Total ---- */
        .pq3-sum { display: flex; }
        .pq3-sum-words { width: 62%; border-right: 1px solid #000; padding: 5px 6px; font-weight: 700; }
        .pq3-sum-words .v { font-weight: 400; padding-left: 10px; }
        .pq3-sum-figures { width: 38%; }
        .pq3-sum-figures .r { display: flex; border-bottom: 1px solid #000; }
        .pq3-sum-figures .r:last-child { border-bottom: none; }
        .pq3-sum-figures .r .l { width: 62%; padding: 3px 6px; border-right: 1px solid #000; }
        .pq3-sum-figures .r .a { width: 38%; padding: 3px 6px; text-align: right; }
        .pq3-sum-figures .r.grand .l, .pq3-sum-figures .r.grand .a { font-weight: 700; }

        /* ---- 6. HSN/SAC tax summary ----------------------------------- */
        table.pq3-tax { width: 100%; border-collapse: collapse; table-layout: fixed; }
        table.pq3-tax th, table.pq3-tax td {
          border-right: 1px solid #000;
          border-bottom: 1px solid #000;
          padding: 3px 5px;
          font-size: 9.5px;
          text-align: center;
        }
        table.pq3-tax th:last-child, table.pq3-tax td:last-child { border-right: none; }
        table.pq3-tax th { font-weight: 700; }
        table.pq3-tax tr:last-child td { border-bottom: none; }

        /* ---- 7. Tax amount in words ----------------------------------- */
        .pq3-tax-words { padding: 4px 6px; font-weight: 700; }
        .pq3-tax-words .v { font-weight: 400; padding-left: 10px; }

        /* ---- 8. Terms & Conditions ------------------------------------ */
        /* Sized to its own content. The item band above absorbs the sheet's
           spare height instead, so the signature band sits directly beneath
           the last term rather than after a tall empty gap. */
        .pq3-terms { padding: 5px 6px; }
        .pq3-terms-title { font-weight: 700; font-size: 11.5px; margin-bottom: 4px; }
        .pq3-terms-body { white-space: pre-line; }

        /* ---- 9. Authorised signature ---------------------------------- */
        .pq3-sign { display: flex; }
        .pq3-sign-left { width: 62%; border-right: 1px solid #000; }
        .pq3-sign-right { width: 38%; padding: 5px 8px 3px; text-align: center; }
        .pq3-sign-for { font-weight: 700; text-align: left; }
        .pq3-sign-mark { display: block; margin: 2px auto 0; width: 30mm; height: 12mm; object-fit: contain; }
        .pq3-sign-spacer { height: 10mm; }
        .pq3-sign-label { padding-top: 2px; }

        /* ---- 10. Footer ----------------------------------------------- */
        .pq3-footer { padding: 3px 6px 4px; text-align: center; font-size: 9px; }
        .pq3-footer div + div { margin-top: 2px; }

        /* ---- 11. Per-page footer line ("Page X of Y") ------------------
           Outside .pq3-frame's own border, one per physical page — every
           .pq3-sheet block carries its own, so a multi-page quotation still
           tells the reader which page of how many they're holding even
           though the jurisdiction/contact footer above only prints once, on
           the last page. */
        .pq3-pagefoot { text-align: right; font-size: 9px; padding: 2px 6px 0; flex-shrink: 0; }

        /* Keep the browser from tinting or dropping the ruled borders. */
        .pq-print-area, .pq-print-area * {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      `}</style>

      {renderAllPages()}
    </div>
  );

  // document.body is always present by the time a React effect/render runs in
  // the browser; the guard keeps this safe under any SSR/test renderer that
  // has no DOM.
  return typeof document === 'undefined' ? sheet : createPortal(sheet, document.body);
}

// Memoized: each document form renders this whole A4 sheet unconditionally
// (hidden with display:none rather than conditionally rendered), so without
// this the item table, HSN summary, totals and the long generated inline
// <style> string were rebuilt on every keystroke in the form. The inner
// function keeps its name so React DevTools and debug output still
// identify it as PurchaseQuotationPrintable.
export default React.memo(PurchaseQuotationPrintable);
