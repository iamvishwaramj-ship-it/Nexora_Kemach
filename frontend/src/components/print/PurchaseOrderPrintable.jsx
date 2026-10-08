import React from 'react';
import { partnerAddressLines, cleanAddressText } from '../../lib/addressFormat';
import { createPortal } from 'react-dom';
import dayjs from 'dayjs';
import { buildDocument, round2, num, isInterState, computeFreightGross, isTcsTaxType } from '../../lib/documentTotals';
import { branchAddressLines } from '../../lib/branchAddress';
import { useIsActiveTab } from '../navigation/TabPathContext';

// --- Print activation ------------------------------------------------------
// Every print rule this component installs is gated on these two classes, and
// the @page rule is injected only while a print is actually running. That is
// deliberate: KeepAliveOutlet keeps every open tab's page MOUNTED, so this
// component's <style> sits in the DOM whenever a Purchase Order tab is open —
// including while the user prints some completely different document. An
// ungated `body > *:not(.po-print-area) { display: none }` would blank THEIR
// print, and an ungated `@page` would fight the one belonging to whichever
// printable they were actually using (ReportPrintable's is `A4 landscape` for
// wide reports, PurchaseInvoicePrintable's carries an 8mm margin). Gating on
// an explicit action means these rules exist only for the print this module
// itself started.
const PRINT_CLASS = 'po-printing';
const PAGE_RULE_ID = 'po-print-page-rule';

/**
 * Print THIS Purchase Order. Call instead of window.print() from the Purchase
 * Order page's own Print controls.
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
export function printPurchaseOrder() {
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
  // Freight Charges (Net + Tax) is folded into the printed Grand Total
  // exactly as it is in the saved amount. See backend/src/routes/resources.js's
  // compute*Totals for this document. Road Tax Amount has been removed from
  // Purchase documents' UI/print and no longer feeds this total.
  const freightGrossAmount = order.freightGrossAmount != null
    ? round2(Number(order.freightGrossAmount) || 0)
    : computeFreightGross(order.freightNetAmount, order.freightTaxAmount);
  return {
    ...totals,
    discount: round2(totals.subtotal - totals.taxableAmount),
    freightGrossAmount,
    grandTotal: round2(totals.amount + freightGrossAmount),
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
// `tcs` (optional) is `{ taxable, taxType }` for ONE ITEM LINE — when that
// line's own Tax Code is 'GST+TCS'/'IGST+TCS' (isTcsTaxType), a trailing TCS
// sub-row is appended, same convention as SalesInvoicePrintable.jsx's own
// components.push(...) in its renderItemsTable. The HSN/SAC summary calls
// this with no 4th argument — TCS there is a document-level figure shown via
// its own dedicated TCS %/TCS AMT columns instead (see totals.tcsAmount).
function displayTaxRows(taxPercent, trueTax, interState, tcs = {}) {
  const rows = interState
    ? [{ label: 'IGST', pct: num(taxPercent), amount: trueTax }]
    : (() => {
        const half = round2(trueTax / 2);
        const halfPct = round2(num(taxPercent) / 2);
        return [
          { label: 'CGST', pct: halfPct, amount: half },
          { label: 'SGST', pct: halfPct, amount: half },
        ];
      })();
  if (isTcsTaxType(tcs.taxType)) {
    rows.push({ label: 'TCS', pct: 1, amount: round2((num(tcs.taxable) + num(trueTax)) * 0.01) });
  }
  return rows;
}

// Tax-summary column widths for the footer tax table — see the matching
// buildTaxColWidths in purchaseStationery.jsx (PO does not import from that
// module, so this is its own copy, kept in sync by hand). No HSN/SAC column
// any more — see the matching removal in renderFooterContent below.
function buildTaxColWidths(interState, hasTcs) {
  if (interState) {
    return hasTcs
      ? ['24%', '19%', '21%', '17%', '19%']
      : ['33%', '34%', '33%'];
  }
  return hasTcs
    ? ['16%', '13%', '15%', '12%', '14%', '13%', '17%']
    : ['23%', '19%', '21%', '16%', '21%'];
}

// The item table's column widths, as percentages of the sheet width. Held in
// one place and emitted as a <colgroup> so the header, the body and the
// Total Qty/Total row can never drift out of alignment with each other.
// Matches the signed-off PurchaseOrderPrintTemplate.jsx mock exactly.
const ITEM_COL_WIDTHS = ['4%', '9%', '20%', '8%', '4%', '4%', '9%', '5%', '9%', '7%', '9%', '12%'];

// The page inset, as this element's own padding rather than an @page margin
// — see .po3-sheet below. Matches SalesQuotationPrintable.jsx's own
// PAGE_MARGIN_MM (6mm) so every print template shares the same physical page
// outline.
const PAGE_MARGIN_MM = 6;

// --- Per-physical-page pagination --------------------------------------
//
// This document's own header content (the "To" + logos band, the
// billing/shipping split, the ref/order-date/transport split and the
// Comments line) and footer content (Amount-in-words + totals, the HSN/SAC
// summary, tax-in-words, Terms & Conditions and the signature band) used to
// be drawn only once, at the top/bottom of a single, potentially very tall
// .po3-page — fine for a short order, but a long item list simply grew the
// page past 297mm and printed past the edge of the physical sheet with no
// header/footer at all on the overflow.
//
// A pure-CSS fix (an @page margin reserving a top/bottom band, with the
// bands switched to position: fixed so Chrome redraws them once per physical
// page) was tried elsewhere in this app (see SalesQuotationPrintable.jsx's
// own note) and failed: the @page margin did not reflow the ordinary
// document content out of the reserved band, so the fixed content painted ON
// TOP of the normal flow instead of around it.
//
// This is the same working alternative SalesQuotationPrintable.jsx now uses:
// build the document as several explicit, self-contained .po3-sheet page
// blocks (see renderPage/renderAllPages below), each one carrying its own
// complete copy of this document's header/footer content in normal document
// flow — no position: fixed, no @page margin. The already-working
// page-break-after: always rule (see the @media print block below) is what
// turns each block into its own physical page.
//
// Item counts per page are a fixed estimate, not a live measurement — this
// environment has no way to render the page and see exactly where text
// wraps. The constants below are deliberately conservative (biased toward
// splitting one extra page rather than risking an overflow that reproduces
// the original clipping bug), and are the one place to retune if a real
// print/PDF comes back with a page ending noticeably early or a page still
// overflowing.
//
// Compared with SalesQuotationPrintable.jsx (FIRST=8/MID=18/LAST=8 for
// ~3 header tables and ~5 footer blocks): this document's header carries one
// extra band (the To/logos block, the billing/shipping split, the ref/date/
// transport split AND a Comments line — 4 bands, and the To/logos band is
// tall enough to include two ~15-17mm logo images), so page 1 gets one item
// less room than the quotation's. This document's footer has the same
// number of blocks (amount-in-words+totals, HSN/SAC summary, tax-in-words,
// Terms & Conditions, signature) but no bank-details/QR block (which is the
// tallest single block in the quotation's footer), so it is not obviously
// shorter — kept at the same conservative reduction as the first page rather
// than assumed to have more room. The continuation-page estimate is trimmed
// two items below the quotation's own 18, since this table's Description
// column can wrap to multiple lines (word-wrap: break-word) where the
// quotation's per-item rows have a more fixed shape.
const FIRST_PAGE_MAX_ITEMS = 7; // page 1 also carries the To/logos, billing/shipping, ref/date/transport and Comments bands
const MID_PAGE_MAX_ITEMS = 16;  // a continuation page with nothing but the item grid
const LAST_PAGE_MAX_ITEMS = 7;  // the last page also carries totals/HSN/tax-words/terms/signature

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
 * The live, data-driven Purchase Order print — a pixel-faithful match of the
 * reference ERP stationery (see PurchaseOrderPrintTemplate.jsx, the signed-off
 * static mock this markup and CSS were copied from). One continuous ruled
 * frame: the outer box draws the page border, and every section is a band
 * inside it separated by a full-width rule, so all the vertical dividers
 * (billing/shipping, meta, signature) line up down the sheet exactly as the
 * reference prints it.
 *
 * A document whose item list runs past one physical page is rendered as
 * several such frames — see the pagination comment above paginateItems.
 *
 * Only ever rendered inside a `.po-print-area` wrapper that's invisible on
 * screen and shown exclusively via the `@media print` rules below.
 */
export default function PurchaseOrderPrintable({ order, company, supplierRecord, branchRecord, shipToCustomerRecord, approverSignatureUrl }) {
  const isActive = useIsActiveTab();
  if (!order || !isActive) return null;

  const items = order.items || [];
  // GST treatment (CGST/SGST vs IGST) is decided by the SUPPLIER's state vs
  // the company's own registered state -- supplierState, not placeOfSupply
  // (which tracks the buying BRANCH's state, for ITC purposes, and is
  // usually the same as the company's own state). This must match exactly
  // what the create/edit form uses (see the `interState` computation in
  // PurchaseOrder.jsx) so a line's printed tax split always matches the Tax
  // Code actually selected on that line -- using placeOfSupply here made an
  // interstate purchase (different supplier state) print as CGST+SGST
  // whenever the receiving branch happened to be in the company's own state,
  // even though IGST was the tax code actually chosen and saved.
  const interState = isInterState(order.supplierState, company?.state);
  const totals = computeTotals(items, order.discountPercent, interState, order);
  const discPct = Number(order.discountPercent) || 0;
  // The item table's own "Total" row is the pre-round-off, post-tax sum
  // (matches summing every line's own Amount column) — the Grand Total box
  // below is the same figure after round-off is applied.
  const itemsTotal = round2(totals.taxableAmount + totals.totalTax);
  const totalQty = items.reduce((sum, it) => sum + num(it.quantity), 0);

  // One <colgroup> element, reused by every item table on every page (head+
  // body, filler, totals) so their columns stay locked to ITEM_COL_WIDTHS
  // together.
  const itemColGroup = (
    <colgroup>
      {ITEM_COL_WIDTHS.map((w, i) => <col key={i} style={{ width: w }} />)}
    </colgroup>
  );

  const companyName = (company?.companyName || 'Nexora KEMACH').toUpperCase();

  // Shipping Address box.
  //
  // Address lines: whatever text is actually saved in shipTo, verbatim,
  // split on newlines — covers every case that fills it today (the ordinary
  // branch default, a "ship to a different customer" selection, or a
  // hand-typed edit of either) with no need for this template to know or
  // branch on which. Falls back to the selected branch's own address only
  // when shipTo is empty (an order saved before Branch was mandatory, or
  // before this field could be filled at all), then the company's own
  // address. This box used to ignore order.shipTo entirely and always print
  // the selected branch's own address (or the company's, with no branch) —
  // the reference stationery named the company itself on both sides, so
  // there was nothing on this order to prefer over the branch. shipTo now
  // taking priority is the fix that makes editing Ship To -- by hand, or via
  // "ship to a different customer" -- actually change what prints; without
  // it, "ship to a different customer" would save correctly but never show
  // up on the printed Purchase Order. See the identical fix/comment on
  // PurchaseInvoicePrintable/PurchaseGRNPrintable. In practice this is a
  // no-op for every order saved before this feature existed: their shipTo
  // already holds exactly the branch's own address (it was the only thing
  // that could ever auto-fill it), so shipTo-first reproduces the same
  // lines byte for byte.
  //
  // branchAddressLines() reads Branch's split Street No / Building / Block
  // fields too — the old inline version here only ever read `address` +
  // city/state/zipCode, so a branch that used the split fields printed a
  // half-empty address; kept as the fallback source.
  //
  // Name line: NOT parsed out of shipTo's own text (see the identical
  // reasoning on PurchaseInvoicePrintable) -- resolved instead from
  // order.shipToCustomer, the customer this order was explicitly saved as
  // shipping to, when "ship to a different customer" was used. Falls back to
  // the company + branch name exactly as before this feature existed when
  // shipToCustomer is blank (every pre-existing order, and any order left on
  // the ordinary branch-default path).
  const branchLines = branchAddressLines(branchRecord);
  const shipToLines = cleanAddressText(order.shipTo).split('\n').filter(Boolean);
  const deliveryFallback = [cleanAddressText(company?.address).replace(/\n/g, ', ')].filter(Boolean);
  const shippingLines = shipToLines.length ? shipToLines : (branchLines.length ? branchLines : deliveryFallback);

  // Company name + branch code merged into the address box name line, e.g.
  // "KEMACH EQUIPMENTS PRIVATE LIMITED - BR001", so the branch is identified
  // right on the "Billing Address :" / "Shipping Address :" name line above.
  const companyNameWithBranch = `${companyName || ''}${branchRecord?.branchCode ? ` - ${branchRecord.branchCode}` : ''}`;
  const shippingBoxName = order.shipToCustomer || companyNameWithBranch;
  const billingDisplayLines = [cleanAddressText(company?.address).replace(/\n/g, ', ')].filter(Boolean);
  const shippingDisplayLines = shippingLines.length ? shippingLines : ['Branch address not set'];

  const supplierBillingAddr = defaultAddressOf(supplierRecord, 'Billing');
  const supplierAddrLines = formatPartnerAddressLines(supplierBillingAddr);
  const supplierGstNumber = supplierBillingAddr?.gstNumber || '—';
  const supplierGstType = supplierBillingAddr?.gstType || DEFAULT_GST_TYPE;

  // Shipping Address box's own GST line: the customer's own registration
  // when this order was actually saved shipping to a different customer,
  // not the branch's/company's -- see the shipToCustomerRecord comment on
  // PurchaseOrder.jsx. Falls back to the company's GST (the previous,
  // only, behaviour) for every order still on the ordinary branch-default
  // path, where the "Shipping Address" IS the company/branch itself.
  const shipToCustomerBillingAddr = order.shipToCustomer ? defaultAddressOf(shipToCustomerRecord, 'Billing') : null;
  const shippingGstNumber = order.shipToCustomer
    ? (shipToCustomerBillingAddr?.gstNumber || shipToCustomerRecord?.gstin || '—')
    : (company?.gstin || '—');
  const shippingGstType = order.shipToCustomer
    ? (shipToCustomerBillingAddr?.gstType || shipToCustomerRecord?.gstRegistrationType || DEFAULT_GST_TYPE)
    : DEFAULT_GST_TYPE;

  // HSN/SAC-wise summary — grouped by HSN code and rate so a multi-rate
  // order still gets a correct row per group instead of one blended row.
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
  const taxColWidths = buildTaxColWidths(interState, totals.tcsAmount > 0);

  const pages = paginateItems(items);
  const pageCount = pages.length;

  // 1 — To/logos, 2 — Billing/Shipping, 3 — Ref No/Order Date/Transport/
  // Carrier, 4 — Comments. Page 1 only.
  const renderHeaderCards = () => (
    <>
      {/* 1 — Supplier "To" block and the two logo slots */}
      <div className="po3-band po3-head">
        <div>
          <div className="po3-to-line"><span>To :</span>{order.supplier || '—'}{supplierRecord?.supplierCode ? ` - ${supplierRecord.supplierCode}` : ''}</div>
          <div className="po3-vendor-block">
            {supplierAddrLines.length
              ? supplierAddrLines.map((line, i) => <div key={i}>{line}</div>)
              : <div>—</div>}
            <div>GST No : {supplierGstNumber} / GST Type : {supplierGstType}</div>
          </div>
        </div>
        <div className="po3-logos">
          {company?.logoUrl && (
            <img
              id="companyLogo"
              className="po3-logo po3-logo-company"
              src={company.logoUrl}
              alt={company?.companyName || 'Company logo'}
            />
          )}
          {supplierRecord?.logoUrl && (
            <img
              id="vendorLogo"
              className="po3-logo po3-logo-vendor"
              src={supplierRecord.logoUrl}
              alt={order.supplier || 'Supplier logo'}
            />
          )}
        </div>
      </div>

      {/* 2 — Billing / Shipping */}
      <div className="po3-band po3-split">
        <div className="po3-half">
          <div className="po3-addr-label">Billing Address :</div>
          <div className="po3-addr-name">{companyName}</div>
          <div className="po3-addr-lines">
            {billingDisplayLines.map((line, i) => <div key={i}>{line}</div>)}
          </div>
          <div className="po3-addr-gst">
            GSTN No: {company?.gstin || '—'} / GSTN Type: {DEFAULT_GST_TYPE}
          </div>
        </div>
        <div className="po3-half">
          <div className="po3-addr-label">Shipping Address :</div>
          <div className="po3-addr-name">{shippingBoxName}</div>
          <div className="po3-addr-lines">
            {shippingDisplayLines.map((line, i) => <div key={i}>{line}</div>)}
          </div>
          <div className="po3-addr-gst">
            GSTN No: {shippingGstNumber} / GSTN Type: {shippingGstType}
          </div>
        </div>
      </div>

      {/* 3 — Ref No / Order Date / Transport / Carrier Name */}
      <div className="po3-band po3-split">
        <div className="po3-half">
          <div className="po3-meta-row">
            <div className="po3-meta-label">Order No.</div>
            <div className="po3-meta-colon">:</div>
            <div className="po3-meta-value">{order.referenceNo || order.poNo || '—'}</div>
          </div>
          <div className="po3-meta-row">
            <div className="po3-meta-label">Order Date</div>
            <div className="po3-meta-colon">:</div>
            <div className="po3-meta-value">{fmtDate(order.poDate)}</div>
          </div>
          {/* Always printed, with the same "—" placeholder every other
          meta row here falls back to when empty — no longer a
          conditionally-hidden row. */}
          <div className="po3-meta-row">
            <div className="po3-meta-label">Vendor Reference No. </div>
            <div className="po3-meta-colon">:</div>
            <div className="po3-meta-value">{order.vendorRefNo || ':  —'}</div>
          </div>
        </div>
        <div className="po3-half">
          <div className="po3-meta-row">
            <div className="po3-meta-label">Transport</div>
            <div className="po3-meta-colon">:</div>
            <div className="po3-meta-value">{order.transportMode || '—'}</div>
          </div>
          <div className="po3-meta-row">
            <div className="po3-meta-label">Carrier Name</div>
            <div className="po3-meta-colon">:</div>
            <div className="po3-meta-value">{order.carrierName || '—'}</div>
          </div>
        </div>
      </div>

      {/* 4 — Comments */}
      <div className="po3-band po3-comments">Comments :&nbsp;{order.remarks || ''}</div>
    </>
  );

  // 5 + 6 — Item table for one page, closing with the Total Qty / Total row
  // on the last page only (that row sums ALL items, not just this page's —
  // it is this document's grand item-total, the same role
  // SalesQuotationPrintable.jsx's own totals table plays in its footer
  // content). Three tables sharing one <colgroup>: header + this page's item
  // rows, a filler that stretches to fill this page's spare height with
  // ruled empty columns, and — only on the last page — the Total Qty/Total
  // row pinned to the bottom of the band.
  const renderItemsBand = (pageItems, startIndex, isLastPage) => (
    <div className="po3-band po3-items-band">
      <table className="po3-items">
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
            <th className="end">Amount</th>
          </tr>
        </thead>
        <tbody>
          {pageItems.map((it, i) => {
            const idx = startIndex + i;
            const taxable = lineTaxable(it, discPct);
            const trueTax = lineTrueTax(taxable, it.taxPercent);
            const displayRows = displayTaxRows(it.taxPercent, trueTax, interState, { taxable, taxType: it.taxType });
            const lineAmount = round2(taxable + trueTax);
            // Each tax component (CGST/SGST, or IGST, plus a trailing TCS
            // when displayRows carries one) gets its own bordered sub-row
            // stacked inside the Tax %/Tax Amount column, exactly like
            // SalesInvoicePrintable.jsx's own renderItemsTable: the first
            // component rides on the item's main <tr> (every other column
            // spanning every sub-row via rowSpan), and any further
            // components are separate <tr>s with only the two tax cells —
            // the ordinary table.po3-items td border-right/border-bottom
            // rules already draw the rule between them.
            const n = displayRows.length;
            return (
              <React.Fragment key={idx}>
                <tr>
                  <td className="ctr" rowSpan={n}>{idx + 1}</td>
                  <td rowSpan={n}>{it.productCode || '—'}</td>
                  <td rowSpan={n}>{it.description || it.productName || '—'}</td>
                  <td rowSpan={n}>{it.hsnCode || '—'}</td>
                  <td className="ctr" rowSpan={n}>{it.uom || '—'}</td>
                  <td className="ctr" rowSpan={n}>{num(it.quantity)}</td>
                  <td className="num" rowSpan={n}>{fmt2(it.unitPrice)}</td>
                  <td className="num" rowSpan={n}>{fmt2(discPct)}</td>
                  <td className="num" rowSpan={n}>{fmt2(taxable)}</td>
                  <td>{displayRows[0].label} {fmt1(displayRows[0].pct)}%</td>
                  <td className="num">{fmt2(displayRows[0].amount)}</td>
                  <td className="num end" rowSpan={n}>{fmt2(lineAmount)}</td>
                </tr>
                {displayRows.slice(1).map((r, j) => (
                  <tr key={j}>
                    <td>{r.label} {fmt1(r.pct)}%</td>
                    <td className="num">{fmt2(r.amount)}</td>
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {/* Ruled empty space — a single row that takes every pixel left in
          this page's band, so the column dividers carry on down to the
          totals row (or the bottom of the frame, on a page with no totals
          row) instead of stopping under the last item on THIS page. */}
      <div className="po3-items-fill">
        <table className="po3-items po3-items-filler">
          {itemColGroup}
          <tbody>
            <tr>
              {ITEM_COL_WIDTHS.map((_, i) => <td key={i} />)}
            </tr>
          </tbody>
        </table>
      </div>

      {isLastPage && (
        <table className="po3-items">
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

  // 7 + 8 — Amount in Words / Freight / Round off / Grand Total, 9 — HSN/SAC
  // tax summary, 10 — Tax Amount in Words, 11 — Terms & Conditions, 12 —
  // Authorised signature. Last page only.
  const renderFooterContent = () => (
    <>
      {/* 7 + 8 — Amount in Words, and Freight / Round off / Grand Total */}
      <div className="po3-band po3-sum">
        <div className="po3-sum-words">
          Amount in Words. (INR)<span className="v">{wordsInr(totals.grandTotal)}</span>
        </div>
        <div className="po3-sum-figures">
          <div className="r"><div className="l">Freight charges</div><div className="a">{fmt2(totals.freightGrossAmount)}</div></div>
          <div className="r"><div className="l">Round off</div><div className="a">{fmt2(totals.roundOff)}</div></div>
          <div className="r grand"><div className="l">Grand Total</div><div className="a">{fmt2(totals.grandTotal)}</div></div>
        </div>
      </div>

      {/* 9 — Tax summary */}
      <div className="po3-band">
        <table className="po3-tax">
          <colgroup>
            {taxColWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
          </colgroup>
          <thead>
            <tr>
              {/* No HSN/SAC column — hidden on every purchase document's
                  printed tax summary; hsnGroups below is still grouped by
                  HSN/tax-rate internally, just not labelled here any more. */}
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
              {totals.tcsAmount > 0 && <th>TCS %</th>}
              {totals.tcsAmount > 0 && <th>TCS AMT</th>}
            </tr>
          </thead>
          <tbody>
            {hsnGroups.length === 0 ? (
              <tr><td colSpan={(interState ? 3 : 5) + (totals.tcsAmount > 0 ? 2 : 0)}>—</td></tr>
            ) : hsnGroups.map((g, i) => {
              const rows = displayTaxRows(g.taxPercent, g.trueTax, interState);
              return (
                <tr key={i}>
                  <td>{fmtMoney(g.taxable)}</td>
                  {rows.map((r, j) => (
                    <React.Fragment key={j}>
                      <td>{fmt2(r.pct)}</td>
                      <td>{fmtMoney(r.amount)}</td>
                    </React.Fragment>
                  ))}
                  {/* TCS is a document-level figure (1% of Subtotal + CGST +
                      SGST + IGST, computed once — see totals.tcsAmount), not
                      tied to any one HSN/tax-rate group, so it is shown once,
                      on the first group row, rather than repeated on every
                      row. */}
                  {totals.tcsAmount > 0 && <td>{i === 0 ? fmt2(1) : ''}</td>}
                  {totals.tcsAmount > 0 && <td>{i === 0 ? fmtMoney(totals.tcsAmount) : ''}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 10 — Tax Amount in Words */}
      <div className="po3-band po3-tax-words">
        Tax Amount in Words. (INR)<span className="v">{wordsInr(totals.totalTax)}</span>
      </div>

      {/* 11 — Terms & Conditions (absorbs the sheet's spare height) */}
      <div className="po3-band po3-terms">
        <div className="po3-terms-title">Terms &amp; Conditions :</div>
        <div className="po3-terms-body">{order.termsConditions || '—'}</div>
      </div>

      {/* 12 — Authorised signature */}
      <div className="po3-band po3-sign">
        <div className="po3-sign-left" />
        <div className="po3-sign-right">
          {!(order.purchaseType === 'Machine') && <div className="po3-sign-for">For&nbsp;&nbsp;{companyName}</div>}
          <div className="po3-sign-spacer" style={order.purchaseType === 'Machine' ? { height: '20mm' } : undefined}>
            {approverSignatureUrl ? <img className="po3-sign-mark" src={approverSignatureUrl} alt="" style={order.purchaseType === 'Machine' ? { width: '50mm', height: '22mm' } : undefined} /> : null}
          </div>
          {!(order.purchaseType === 'Machine') && <div className="po3-sign-label">Signature of the Authorized Person</div>}
        </div>
      </div>
    </>
  );

  // One physical page — its own complete copy of this document's header/
  // footer content in normal document flow, so the browser draws them on
  // THIS page regardless of how many pages the document has (see the
  // pagination comment above paginateItems for why this replaced rendering
  // a single, potentially page-overflowing .po3-page).
  const renderPage = (page, pageIndex, startIndex) => (
    <div className="po3-sheet" key={pageIndex}>
      <div className="po3-page">
        {page.isFirst && <div className="po3-title">PURCHASE ORDER</div>}

        <div className="po3-frame">
          {page.isFirst && renderHeaderCards()}

          {renderItemsBand(page.items, startIndex, page.isLast)}

          {page.isLast && renderFooterContent()}

          {/* 13 — Footer, repeated on every physical page (jurisdiction +
              contact line, same as every other section's rules), with a
              running Page X of Y line so a multi-page order reads the same
              way the letterhead-based templates do. */}
          <div className="po3-footer">
            <div>Subject to &apos;{JURISDICTION_CITY} Jurisdiction&apos;</div>
            <div>Ph No : {company?.phone || '—'} &nbsp; Email Id : {company?.email || '—'}</div>
            <div>Page {pageIndex + 1} of {pageCount}</div>
          </div>
        </div>
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
  //   1. It makes .po-print-area a DIRECT child of <body>, which is what lets
  //      the print CSS above remove the app shell with `display: none` instead
  //      of `visibility: hidden`. Inline, this sits deep inside
  //      #root > MainLayout > ... , and hiding `body > *:not(.po-print-area)`
  //      would hide its own ancestors and print a blank sheet. Leaving the
  //      shell in layout (merely invisible) is what makes Chrome flip the job
  //      to landscape.
  //   2. Portal children are appended after #root, so this component's <style>
  //      comes later in document order than any other printable mounted in a
  //      background KeepAlive tab — its rules win the cascade rather than
  //      losing to whichever page happened to mount last.
  const sheet = (
    <div className="po-print-area">
      <style>{`
        .po-print-area { display: none; }
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
             .po-print-area is a direct child of <body>, so hiding
             "body > *:not(.po-print-area)" cannot hide the sheet's own
             ancestors. Rendered inline it sits deep inside #root > MainLayout
             > ... , and the same selector would have hidden the whole chain
             containing it — printing a blank page.

             No forced height/overflow:hidden on html/body any more — a
             multi-page order (see the pagination comment above
             paginateItems) is now taller than one 297mm sheet by design, and
             clamping the body to exactly one page's height with
             overflow: hidden would silently clip every page past the first
             back to nothing. Width stays forced to 210mm: that alone still
             keeps the laid-out box narrower than it is tall (even across
             several stacked physical pages), which is what keeps Chrome's
             own orientation heuristic on portrait. */
          html.po-printing, body.po-printing {
            width: 210mm !important;
            margin: 0 !important; padding: 0 !important;
            background: #fff !important;
          }
          body.po-printing > *:not(.po-print-area) { display: none !important; }
          body.po-printing #root > *:not(.po-print-area) { display: none !important; }
          body.po-printing .po-print-area {
            display: block !important; position: absolute; top: 0; left: 0;
            width: 100%; margin: 0; padding: 0;
          }
          body.po-printing .po-print-area,
          body.po-printing .po-print-area * { visibility: visible; }

          /* Turns each explicit .po3-sheet block below into its own physical
             page — the proven mechanism SalesQuotationPrintable.jsx also
             uses for the same per-physical-page repeat. */
          .po3-sheet { page-break-after: always; }
          .po3-sheet:last-child { page-break-after: auto; }
        }

        /* ==== Layout — the signed-off PurchaseOrderPrintTemplate.jsx mock's
           own markup and CSS, wired to live data instead of static MOCK
           constants, now built as one .po3-sheet/.po3-page pair PER PHYSICAL
           PAGE instead of a single pair for the whole document — see the
           pagination comment above paginateItems. Keep the two in sync. */

        /* The physical sheet. min-height: 100vh, NOT a hardcoded 297mm — the
           same hard-won rule ReportPrintable.jsx documents at length: in
           print, 1vh is 1% of whatever printable area the browser/driver
           actually hands the page, and that is NOT reliably the full 297mm
           sheet even with @page { margin: 0 }. Chrome's own pipeline, and
           real drivers such as Windows' "Microsoft Print to PDF", can still
           reserve their own margin or apply a print-dialog Scale. Sizing to
           100vh means the sheet always matches whatever area is actually
           granted, so the frame reaches the real edge under every driver.
           min-height rather than height (the single-page version's own
           earlier rule) so a page whose content runs past one viewport's
           worth — this page's OWN slice of items plus its header/footer
           content — grows instead of clipping; that should not normally
           happen given the conservative per-page item counts above, but
           growing is a far safer failure than clipping if it ever does.
           The ${PAGE_MARGIN_MM}mm inset is this element's own padding rather
           than an @page margin, so it is decided in exactly one place and no
           print engine can add a second one on top. */
        .po3-sheet {
          min-height: 100vh;
          box-sizing: border-box;
          padding: ${PAGE_MARGIN_MM}mm;
        }
        .po3-page {
          width: 100%;
          /* min-height: calc(...), NOT height: 100vh — .po3-sheet above no
             longer has a fixed height of its own (min-height: 100vh, so it
             can grow with content), and this element's floor has to be
             100vh minus the sheet's own ${PAGE_MARGIN_MM}mm padding (top AND
             bottom), not 100vh itself — otherwise this box plus the sheet's
             padding would together exceed one physical page and push part
             of the frame onto a second page even for a short, single-page
             order. */
          min-height: calc(100vh - ${PAGE_MARGIN_MM * 2}mm);
          background: #fff;
          color: #000;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 11px;
          line-height: 1.28;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }

        .po3-title {
          text-align: center;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.5px;
          padding-bottom: 4px;
        }

        /* The single ruled frame everything below the title sits in. flex: 1
           makes it take all the height left on the sheet, so the terms band
           stretches and the signature + footer always land on the bottom
           edge — the document fills the page for a 1-line order exactly as
           it does for a full one. */
        .po3-frame {
          flex: 1;
          border: 1px solid #000;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .po3-band { border-bottom: 1px solid #000; }
        .po3-split { display: flex; }
        .po3-split > .po3-half { width: 50%; padding: 3px 6px; }
        .po3-split > .po3-half:first-child { border-right: 1px solid #000; }

        /* ---- 1. Vendor "To" + the two logos ---------------------------- */
        .po3-head { display: flex; justify-content: space-between; align-items: flex-start; padding: 4px 6px 5px; gap: 10px; }
        /* Purchase Order print only: put the party name on its own line
        under "To :" (was inline on the same line), then indent the
        address/GST lines below to sit flush left under it — same alignment
        fix already applied to Purchase Invoice's own print (see the
        matching comment on PurchaseInvoicePrintable.jsx). Per the request:
        "only change this alignment do not change others" — every other
        rule in this stylesheet is untouched. */
        .po3-to-line { font-weight: 700; margin-bottom: 7px; }
        .po3-to-line span { display: block; margin-bottom: 2px; }
        .po3-vendor-block { padding-left: 0; }
        .po3-vendor-block div { line-height: 1.45; }
        /* Two SEPARATE logo slots: company first, vendor second. */
        .po3-logos { display: flex; align-items: flex-start; gap: 14px; flex-shrink: 0; padding-top: 2px; }
        .po3-logo { object-fit: contain; }
        .po3-logo-company { height: 15mm; max-width: 46mm; }
        .po3-logo-vendor { height: 17mm; max-width: 46mm; }

        /* ---- 2. Billing / Shipping ------------------------------------ */
        .po3-addr-label { margin-bottom: 3px; }
        .po3-addr-name { font-weight: 700; font-size: 11.5px; margin-bottom: 3px; }
        .po3-addr-lines div { line-height: 1.45; }
        .po3-addr-gst { margin-top: 2px; }

        /* ---- 3. Ref No / Order Date / Transport / Carrier -------------- */
        .po3-meta-row { display: flex; align-items: baseline; }
        .po3-meta-row + .po3-meta-row { margin-top: 4px; }
        /* 'Vendor Reference No.' is longer than every other label in
           this column (Order No. / Order Date / Transport / Carrier
           Name) and was wrapping onto a second line at the old fixed
           30% width -- nowrap keeps every meta row on one line; the
           label column simply grows to fit whichever row is longest
           instead of wrapping it. */
        .po3-meta-label { font-weight: 700; width: 30%; white-space: nowrap; }
        .po3-meta-colon { width: 8px; }
        .po3-meta-value { font-weight: 700; }

        /* ---- 4. Comments ---------------------------------------------- */
        .po3-comments { padding: 4px 6px 6px; font-weight: 700; }

        /* ---- 5. Item table -------------------------------------------- */
        table.po3-items { width: 100%; border-collapse: collapse; table-layout: fixed; }
        table.po3-items th, table.po3-items td {
          border-right: 1px solid #000;
          border-bottom: 1px solid #000;
          padding: 2px 4px;
          font-size: 9.5px;
          vertical-align: top;
          word-wrap: break-word;
        }
        /* The frame already draws the outer edge — dropping the last column's
           right border keeps every rule a single hairline, never a double.
           Uses an explicit .end class rather than :last-child because the
           CGST/SGST tax sub-rows only render two <td>s (Tax %/Tax Amount —
           the Amount column is rowSpanned from the item's main row), which
           would make Tax Amount the CSS :last-child and wrongly strip its
           right border. */
        table.po3-items th.end, table.po3-items td.end,
        table.po3-items tfoot td:last-child { border-right: none; }
        table.po3-items thead th { text-align: center; font-weight: 700; vertical-align: middle; }
        table.po3-items td.ctr { text-align: center; }
        /* Rate/Amount cells hold the widest numbers in the row (with
           commas and two decimals) but sit in the narrowest columns --
           at the table's base 9.5px they were wide enough to spill past
           the column's right border instead of wrapping (word-wrap:
           break-word only breaks between characters, which for a plain
           number never kicks in). Matching the sales printables' own
           fix for the identical problem: shrink just the numeric cells
           to 8.5px and force a single line, so the number fits inside
           its column instead of overflowing it. */
        table.po3-items td.num { text-align: right; font-size: 8.5px; white-space: nowrap; }
        table.po3-items tfoot td { font-weight: 700; border-bottom: none; }
        table.po3-items tfoot td.ctr { text-align: center; }

        /* The item band is what absorbs each page's spare height (the
           Terms band used to, on the last page). Splitting the one table
           into head+body, a stretchable filler and — last page only — the
           Total Qty/Total foot is what lets the totals row sit at the
           BOTTOM of the band with ruled, empty column space above it — the
           way the Tax Invoice stationery prints it. All three tables share
           ITEM_COL_WIDTHS through the same <colgroup> element, so their
           columns can never drift apart.
           flex: 1 0 auto, not flex: 1 — a zero flex-basis would let a long
           page's rows be squeezed below their natural height and spill out
           of the frame; auto keeps the rows at full height and only the
           SPARE space is handed to the filler. */
        .po3-items-band { flex: 1 0 auto; display: flex; flex-direction: column; }
        .po3-items-fill { flex: 1 1 auto; display: flex; flex-direction: column; min-height: 0; }
        /* height: 100% on a ONE-row table hands every spare pixel to that row,
           so each cell's border-right runs the full depth of the empty space
           and its border-bottom draws the rule directly above Total Qty (or
           the bottom of the frame, on a page with no totals row).
           margin-top: -1px overlaps the body table's own bottom rule: these
           are separate tables, so their borders cannot collapse into one and
           would otherwise print as a 2px double line. */
        table.po3-items-filler { flex: 1 1 auto; height: 100%; margin-top: -1px; }
        table.po3-items-filler td { padding: 0; }

        /* ---- 6. Amount in words + Freight / Round off / Grand Total ---- */
        .po3-sum { display: flex; }
        .po3-sum-words { width: 62%; border-right: 1px solid #000; padding: 5px 6px; font-weight: 700; }
        .po3-sum-words .v { font-weight: 400; padding-left: 10px; }
        .po3-sum-figures { width: 38%; }
        .po3-sum-figures .r { display: flex; border-bottom: 1px solid #000; }
        .po3-sum-figures .r:last-child { border-bottom: none; }
        .po3-sum-figures .r .l { width: 62%; padding: 3px 6px; border-right: 1px solid #000; }
        .po3-sum-figures .r .a { width: 38%; padding: 3px 6px; text-align: right; }
        .po3-sum-figures .r.grand .l, .po3-sum-figures .r.grand .a { font-weight: 700; }

        /* ---- 7. HSN/SAC tax summary ----------------------------------- */
        table.po3-tax { width: 100%; border-collapse: collapse; table-layout: fixed; }
        table.po3-tax th, table.po3-tax td {
          border-right: 1px solid #000;
          border-bottom: 1px solid #000;
          padding: 3px 5px;
          font-size: 9.5px;
          text-align: center;
        }
        table.po3-tax th:last-child, table.po3-tax td:last-child { border-right: none; }
        table.po3-tax th { font-weight: 700; }
        table.po3-tax tr:last-child td { border-bottom: none; }

        /* ---- 8. Tax amount in words ----------------------------------- */
        .po3-tax-words { padding: 4px 6px; font-weight: 700; }
        .po3-tax-words .v { font-weight: 400; padding-left: 10px; }

        /* ---- 9. Terms & Conditions ------------------------------------ */
        /* Sized to its own content. The item band above absorbs the sheet's
           spare height instead, so the signature band sits directly beneath
           the last term rather than after a tall empty gap. */
        .po3-terms { padding: 5px 6px; }
        .po3-terms-title { font-weight: 700; font-size: 11.5px; margin-bottom: 4px; }
        .po3-terms-body { white-space: pre-line; }

        /* ---- 10. Authorised signature --------------------------------- */
        .po3-sign { display: flex; }
        .po3-sign-left { width: 62%; border-right: 1px solid #000; }
        .po3-sign-right { width: 38%; padding: 5px 8px 3px; text-align: center; }
        .po3-sign-for { font-weight: 700; text-align: left; }
        .po3-sign-mark { display: block; margin: 2px auto 0; width: 30mm; height: 12mm; object-fit: contain; }
        .po3-sign-spacer { height: 10mm; }
        .po3-sign-label { padding-top: 2px; }

        /* ---- 11. Footer ------------------------------------------------ */
        .po3-footer { padding: 3px 6px 4px; text-align: center; font-size: 9px; }
        .po3-footer div + div { margin-top: 2px; }

        /* Keep the browser from tinting or dropping the ruled borders. */
        .po-print-area, .po-print-area * {
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
