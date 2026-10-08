import React from 'react';
import { joinAddressParts, cleanAddressText } from '../../lib/addressFormat';
import { createPortal } from 'react-dom';
import dayjs from 'dayjs';
import { amountToWords } from '../../lib/numberToWords';
import { buildDocument, round2, isInterState, computeFreightGross, isTcsTaxType } from '../../lib/documentTotals';
import kemachLogo from '../../../assets/kemach.png';
import {
  LetterheadHeader, LetterheadWatermark, LetterheadFooter, letterheadStyles,
  LETTERHEAD_TOP_MM, LETTERHEAD_BOTTOM_MM,
} from './Letterhead';
import { makeScopedPrint, makeScopedCapture } from './purchaseStationery';
import { buildQrPath } from './eInvoiceQr';
import { useIsActiveTab } from '../navigation/TabPathContext';

// Statutory GST tax invoice: company and e-invoice block, billing/shipping
// addresses side by side, document details, the line-item grid, an HSN/SAC tax
// summary, amounts in words, bank details, and the jurisdiction notes. The
// invoice itself stays plain — black text on ruled boxes — because it is
// produced for assessment and follows the standard arrangement.
//
// The BRANDING around it is the letterhead (see ./Letterhead.jsx), drawn into
// the top and bottom bands. Those bands used to be left blank on the
// assumption that pre-printed stationery would be in the tray. That only holds
// when someone remembers to load it: email the PDF, or print on plain A4, and
// the invoice goes out with two unexplained empty strips. Drawing it means one
// artefact is right everywhere.
//
// Prints a single copy — no ORIGINAL/DUPLICATE/TRIPLICATE heading and no
// repeated sheets.

// One weight for every rule on the sheet — the outer box, the block
// separators and the lines inside the item grid alike. Change this single
// number to make the whole grid heavier or lighter; nothing else specifies a
// border width, so they cannot drift apart again.
const GRID_BORDER_PX = 1;

// --- Print activation ------------------------------------------------------
// KeepAliveOutlet keeps every open tab's page MOUNTED (see
// PurchaseOrderPrintable.jsx's own note on this), so this component's
// <style> sits in the DOM whenever a SalesInvoice tab is open -- including
// while the user prints some completely different document from another
// open tab. Without gating, the rules below (`#root { display: none }` /
// `.sinv-print-area { display: block }`) matched the SAME unconditional
// `@media print` as every other un-gated sales printable, so whichever
// document's print area happened to be later in DOM order painted OVER
// whichever document the user actually meant to print -- the reported
// "print Sales Quotation, get Sales Order instead" bug. Reusing
// makeScopedPrint (the exact mechanism the Purchase-side stationery family
// already uses for this) scopes every rule below to a printingClass that is
// only present while THIS document's own print is actually running.
const PRINTING_CLASS = 'sinv-printing';
const PAGE_RULE_ID = 'sinv-print-page-rule';

/**
 * Print THIS Sales Invoice. Call instead of window.print() from
 * SalesInvoice.jsx's own Print controls.
 */
export const printSalesInvoice = makeScopedPrint({ printingClass: PRINTING_CLASS, pageRuleId: PAGE_RULE_ID });
// "Send via WhatsApp"'s PDF source -- see makeScopedCapture in
// purchaseStationery.jsx. '.sinv-sheet' is this document's own per-page
// block (see the .sinv-sheet div further down).
export const captureSalesInvoicePdf = makeScopedCapture({ printingClass: PRINTING_CLASS, pageRuleId: PAGE_RULE_ID, sheetSelector: '.sinv-sheet', areaSelector: '.sinv-print-area' });

// A4 portrait (210mm x 297mm). The sheet itself is NOT sized with this
// constant any more — see .sinv-sheet below, which uses min-height: 100vh
// instead of a hardcoded mm value, matching SalesQuotationPrintable.jsx's own
// documented fix for the same "gap under the printed document" symptom: in
// print, a fixed-mm box does not reliably match the real printable area a
// browser/driver actually grants (Chrome's own pipeline and drivers such as
// Windows' "Microsoft Print to PDF" can reserve their own margin or apply a
// print-dialog Scale), so a hardcoded 297mm sheet can fall short of the true
// page edge, leaving the flex-fill's stretch target — and everything below
// it — short of the bottom of the page. 100vh always matches whatever area
// is actually granted. Kept here only as the value the explicit @page size
// below must agree with. The usable content height is the sheet less the
// margins below less the letterhead reserves.
const PAGE_HEIGHT_MM = 297;
// The page inset, as this element's own padding rather than an @page margin
// — matches Purchase Order's 6mm exactly (see .sinv-sheet) so both documents
// share the same physical page outline.
const PAGE_MARGIN_MM = 6;

// --- Brand rule spacing, for THIS document ---------------------------------
// Clear space above and below the red rule, in millimetres. The header's rule
// and the footer's rule are tuned independently — four separate numbers — so
// tightening the gap under the masthead cannot quietly shift the registered
// office line at the foot, and vice versa.
//
// Only the keys set here override the shared letterhead defaults
// (RULE_SPACING_MM in ./Letterhead.jsx); all four are restated so every gap on
// the sheet is visible in one place while the layout is being tuned.
//
// These change how the bands LOOK, not how tall they are: the bands stay
// LETTERHEAD_TOP_MM / LETTERHEAD_BOTTOM_MM and the body's reserve is
// untouched, so nudging them cannot push the invoice onto another page. Keep
// the sums inside the bands though — the masthead plus headerAbove plus
// headerBelow has to stay under LETTERHEAD_TOP_MM, or the rule rides out of
// the reserved strip and over the body.
const RULE_SPACING = {
  headerAbove: 3.5,
  headerBelow: 0,
  footerAbove: 2,
  footerBelow: 1.5,
};

const fmtDate = (d) => (d ? dayjs(d).format('DD-MMM-YYYY') : '');
// Plain grouped numbers, no currency symbol: the column headings already say
// the amounts are in the document's currency, and a symbol in every cell makes
// the grid harder to scan.
const fmtNum = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtQty = (n) => {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

// Totals come from the shared engine in lib/documentTotals.js — the same
// module the form uses and a behavioural mirror of the server's own, so the
// printed figures always match what was saved.
function computeTotals(items, discountPercent, interState = false, order = {}) {
  const { totals } = buildDocument(items, discountPercent, { interState, roundOff: true });
  // Company policy: Road Tax never affects Sales Invoice's Grand Total,
  // no matter how the field gets a value. It's still surfaced below for any
  // informational display, but deliberately left out of the grandTotal sum.
  // Freight Charges (Net + Tax) are still folded in exactly as saved. See
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
    grandTotal: round2(totals.amount + freightGrossAmount),
  };
}

/**
 * Per-line figures, derived the same way the item grid and the tax summary
 * both need them — computed once here so the two can never disagree.
 */
function lineFigures(it, headerDiscPct) {
  const qty = Number(it.quantity) || 0;
  const price = Number(it.unitPrice) || 0;
  const itemDiscPct = Number(it.discountPercent) || 0;
  const gross = qty * price;
  const afterItemDisc = gross - gross * (itemDiscPct / 100);
  const taxable = afterItemDisc * (1 - headerDiscPct / 100);
  const taxPct = Number(it.taxPercent) || 0;
  const taxAmount = taxable * (taxPct / 100);
  return { qty, price, itemDiscPct, taxable, taxPct, taxAmount, total: taxable + taxAmount };
}

// GST No. / GST Type / PAN of the address actually printed. The document carries
// a snapshot of the selected address (billTo*/shipTo* GstNo/GstType/PanNo) so a
// "different customer" address prints ITS numbers; older documents without a
// snapshot fall back to the customer's default address of that type.
function partyIds(order, partner, side) {
  const bill = side === 'Billing';
  const gst = (bill ? order.billToGstNo : order.shipToGstNo) || '';
  const type = (bill ? order.billToGstType : order.shipToGstType) || '';
  const pan = (bill ? order.billToPanNo : order.shipToPanNo) || '';
  const different = bill ? (order.billToDifferentCustomer || order.billToCustomer) : (order.shipToDifferentCustomer || order.shipToCustomer);
  if (gst || type || pan || different) return { gst, type, pan };
  const rows = (t) => (partner?.addresses || []).filter((a) => a.addressType === t);
  const pickOf = (t) => rows(t).find((a) => a.isDefault) || rows(t)[0] || null;
  const other = bill ? 'Shipping' : 'Billing';
  const addr = pickOf(side) || pickOf(other);
  return {
    gst: addr?.gstNumber || partner?.gstin || partner?.gstNumber || '',
    type: addr?.gstType || partner?.gstRegistrationType || partner?.gstType || 'Regular/TDS/ISD',
    pan: partnerPan(partner, side),
  };
}

// PAN Card Number of the partner's default Billing/Shipping address (falls back
// to the other address type, then a partner-level PAN if the record has one).
function partnerPan(partner, addressType) {
  const pick = (t) => {
    const rows = (partner?.addresses || []).filter((a) => a.addressType === t);
    return (rows.find((a) => a.isDefault) || rows[0] || null)?.panNo || '';
  };
  const other = addressType === 'Billing' ? 'Shipping' : 'Billing';
  return pick(addressType) || pick(other) || partner?.panNo || partner?.pan || '';
}

function defaultAddressOf(partner, addressType) {
  const rows = (partner?.addresses || []).filter((a) => a.addressType === addressType);
  return rows.find((a) => a.isDefault) || rows[0] || null;
}

// --- Per-physical-page pagination --------------------------------------
//
// The KEMACH letterhead header and footer must repeat on every PRINTED
// PAGE, not just once at the top/bottom of the whole document. The first
// attempt at that used pure CSS (an @page margin reserving a top/bottom
// band, with the letterhead bands switched to position: fixed so Chrome
// redraws them once per physical page) — the textbook approach, but it
// failed in this app's actual print/PDF pipeline: the @page margin did not
// reflow the ordinary document content out of the reserved band, so the
// fixed header/footer were drawn ON TOP of the normal content instead of
// around it. This is the exact fix SalesQuotationPrintable.jsx shipped for
// the same symptom — see that file for the fuller reasoning.
//
// This is the robust alternative: build the document as several explicit,
// self-contained .sinv-sheet page blocks (see renderPage/renderAllPages
// below), each one carrying its OWN complete LetterheadHeader/Watermark/
// Footer in normal document flow — no position:fixed and no @page margin
// involved at all. The already-proven page-break-after: always rule (see
// the @media print block below) is what turns each block into its own
// physical page; nothing about that rule changes here.
//
// Item counts per page are a fixed estimate, not a live measurement — this
// environment has no way to render the page and see exactly where text
// wraps. The constants below are deliberately conservative (biased toward
// splitting one extra page rather than risking an overflow that reproduces
// the original clipping/overlap bug), and are the one place to retune if a
// real print/PDF comes back with a page ending noticeably early.
//
// FIRST_PAGE_MAX_ITEMS was originally set a notch below
// SalesQuotationPrintable's own 8 (reasoning: page 1 here carries the same
// three header-card tables — company+logos, billing/shipping,
// document-details — PLUS the e-invoice IRN row folded into the
// company/logos table). In practice that undershot: real invoices with
// 8-10 items were still splitting onto a near-empty second page just to
// print the footer, which the IRN row (one extra row inside an existing
// table, not a whole extra table) does not actually cost. Raised to
// comfortably cover that range with margin to spare.
// Raised another notch (12/18/8 -> 13/19/9) alongside the font-size/
// line-height reduction applied to .sinv-print-area and the items/HSN
// tables above (see MM_PER_ITEM_ROW/MM_PER_TEXT_LINE below) -- a real
// invoice with more items than the 4-item single-page case still pushed
// its footer onto a spurious extra page even after the earlier
// FIRST_PAGE_MM_BUDGET fix, so this round shrinks the real, physical size
// of each row instead of just re-tuning the split-decision constants
// again on their own.
const FIRST_PAGE_MAX_ITEMS = 13; // a genuine page 1 of many: header cards only, no footer
const MID_PAGE_MAX_ITEMS = 19;  // a continuation page with nothing but the item grid
const LAST_PAGE_MAX_ITEMS = 9;  // a genuine last page of many: footer only, no header cards
// The single-page case (isFirst && isLast) carries the header cards AND the
// full footer content TOGETHER -- a much tighter budget than either alone.
// See SalesQuotationPrintable.jsx's own mm-by-mm accounting for the full
// reasoning (this file shares the identical .sinv-page layout, letterhead
// bands and footer content, so the same budget applies here): roughly
// 200mm of a 297mm sheet's ~238.8mm of usable content height is fixed
// header+footer overhead when both are on the same page, leaving room for
// only about 3-4 item rows -- nowhere near FIRST_PAGE_MAX_ITEMS/
// LAST_PAGE_MAX_ITEMS's 12/8, which are each calibrated for only ONE of
// header-only or footer-only overhead (a genuine multi-page first/last
// page). Raising FIRST_PAGE_MAX_ITEMS alone (this file's own earlier fix)
// did not address this, because that was never the right budget to check
// the single-page decision against.
const SINGLE_PAGE_MAX_ITEMS = 4;

// Remarks (header) and Terms & Conditions (footer) are free text with no
// length limit and are not counted by items.length at all -- a long note
// in either can overflow even the reduced single-page budget above on its
// own, regardless of item count. Same estimate SalesQuotationPrintable.jsx
// uses: assume more wrapped lines than really fit, err toward an extra
// page rather than under-counting.
const REMARKS_CHARS_PER_LINE = 100;
const TERMS_CHARS_PER_LINE = 70;
// Shrunk in step with the real font-size/line-height reduction above
// (line-height 1.45->1.35 on .sinv-kv/.sinv-pre, item/HSN table font-size
// 10.5px->10px) so these keep estimating the ACTUAL printed row height
// rather than a now-stale, larger one. FIRST/MID/LAST_PAGE_MAX_ITEMS above
// were raised in the same step to keep each page's total mm budget
// (MAX_ITEMS x MM_PER_ITEM_ROW) roughly where it was, while correctly
// allowing more of these now-smaller rows to fit on one real page.
const MM_PER_TEXT_LINE = 4.3;
const MM_PER_ITEM_ROW = 9.2;

// The document-detail card's right-hand column gained a "Customer PO No."
// row (below Engine No.), one sinv-kv line taller than when
// SINGLE_PAGE_MAX_ITEMS/FIRST_PAGE_MAX_ITEMS were calibrated. This was
// first applied to BOTH the single-page budget and FIRST_PAGE_MM_BUDGET,
// but a real print came back showing the single-page case had regressed: a
// plain 4-item invoice that used to render as one page (with real headroom
// to spare, per that print -- SINGLE_PAGE_MAX_ITEMS(4) was previously
// tuned from actual print feedback, see the comment above it) started
// splitting into a near-empty page 1 and an orphaned footer-only page 2,
// which is a worse outcome than the one row of extra height it was meant
// to guard against. So this deduction now applies only to
// FIRST_PAGE_MM_BUDGET below, which has ample headroom (12 items' worth)
// to absorb it harmlessly; the single-page path keeps its own
// already-print-validated boundary untouched. One sinv-kv line is the same
// height class as one wrapped Remarks/Terms line, so it borrows
// MM_PER_TEXT_LINE rather than inventing a third similar-but-different
// constant.
const EXTRA_HEADER_ROW_MM = MM_PER_TEXT_LINE;

function extraWrappedLines(text, charsPerLine) {
  if (!text) return 0;
  const lines = String(text).split('\n').reduce(
    (sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)),
    0
  );
  return Math.max(0, lines - 1);
}

function extraTextOverflowItems(remarksText, termsText) {
  const extraLines = extraWrappedLines(remarksText, REMARKS_CHARS_PER_LINE)
    + extraWrappedLines(termsText, TERMS_CHARS_PER_LINE);
  return Math.ceil((extraLines * MM_PER_TEXT_LINE) / MM_PER_ITEM_ROW);
}

// MM_PER_ITEM_ROW (9.8mm) was calibrated against "the common CGST+SGST
// intra-state case", i.e. TWO stacked sub-rows per item (see the constant's
// own comment above). renderItemsTable below adds a THIRD stacked sub-row
// -- its own TCS line, aligned to the same row height/columns as CGST/SGST
// -- under any item whose taxType carries the 1% TCS carve-out
// (isTcsTaxType), on top of either the 2 intra-state sub-rows OR the 1
// inter-state IGST sub-row. Counting each item's real sub-row count here
// (rather than a flat 2) is what keeps the page budget honest once a TCS
// row is added, so it lands on the page it's budgeted for instead of
// silently overflowing onto a spurious extra page.
const MM_PER_SUBROW = MM_PER_ITEM_ROW / 2; // the 9.8mm budget IS 2 sub-rows worth
function itemRowCount(it, interState) {
  const baseRows = interState ? 1 : 2; // single IGST row vs stacked CGST+SGST
  return baseRows + (isTcsTaxType(it?.taxType) ? 1 : 0);
}
function itemRowMm(it, interState) {
  return itemRowCount(it, interState) * MM_PER_SUBROW;
}

/**
 * Split items into page-sized chunks. remarksText/termsText are the
 * document's own free-text Remarks and Terms & Conditions -- see
 * extraTextOverflowItems above for why they matter here. interState decides
 * whether each item renders one IGST sub-row or two stacked CGST+SGST
 * sub-rows (itemRowMm above); a TCS-flagged item always adds one more on
 * top of either. A document short enough to fit the (text-adjusted)
 * single-page budget comes back as one page that is both isFirst and
 * isLast.
 *
 * Pages are packed by estimated real height (each item's own itemRowMm),
 * not by a flat item count -- a flat count under-budgets any page carrying
 * TCS-flagged lines, which each cost 50% more height than a plain
 * intra-state line. FIRST/MID/LAST/SINGLE_PAGE_MAX_ITEMS keep meaning "this
 * many plain (2-sub-row) items' worth of room"; they're converted to an mm
 * budget once, up front, and items are greedily added to a page while they
 * still fit that budget -- so a page of all-TCS lines simply holds fewer of
 * them than a page of plain lines, instead of silently overflowing.
 */
function packPage(items, startIdx, budgetMm, interState) {
  let usedMm = 0;
  let end = startIdx;
  while (end < items.length) {
    const rowMm = itemRowMm(items[end], interState);
    // Always place at least one item on a page, even if that single item's
    // own height already exceeds the budget -- an empty page helps no one.
    if (end > startIdx && usedMm + rowMm > budgetMm) break;
    usedMm += rowMm;
    end += 1;
  }
  return end;
}

function paginateItems(items, remarksText, termsText, interState = false) {
  const singlePageBudgetItems = Math.max(
    0,
    SINGLE_PAGE_MAX_ITEMS - extraTextOverflowItems(remarksText, termsText)
  );
  const singlePageBudgetMm = singlePageBudgetItems * MM_PER_ITEM_ROW;
  const totalItemsMm = items.reduce((sum, it) => sum + itemRowMm(it, interState), 0);
  if (totalItemsMm <= singlePageBudgetMm) {
    return [{ items, isFirst: true, isLast: true }];
  }

  const FIRST_PAGE_MM_BUDGET = FIRST_PAGE_MAX_ITEMS * MM_PER_ITEM_ROW - EXTRA_HEADER_ROW_MM;
  const MID_PAGE_MM_BUDGET = MID_PAGE_MAX_ITEMS * MM_PER_ITEM_ROW;
  const LAST_PAGE_MM_BUDGET = LAST_PAGE_MAX_ITEMS * MM_PER_ITEM_ROW;

  const firstEnd = packPage(items, 0, FIRST_PAGE_MM_BUDGET, interState);
  const pages = [{ items: items.slice(0, firstEnd), isFirst: true, isLast: false }];
  let rest = items.slice(firstEnd);
  const restMmFrom = (arr) => arr.reduce((sum, it) => sum + itemRowMm(it, interState), 0);
  while (restMmFrom(rest) > LAST_PAGE_MM_BUDGET) {
    const midEnd = packPage(rest, 0, MID_PAGE_MM_BUDGET, interState);
    pages.push({ items: rest.slice(0, midEnd), isFirst: false, isLast: false });
    rest = rest.slice(midEnd);
  }
  // Always give the footer its own dedicated last page, even when rest is
  // empty -- either because a short item list still didn't fit
  // singlePageBudget (a long Remarks/Terms note), or because the loop above
  // consumed every remaining item exactly. Reusing the last MID-sized page
  // (sized for up to MID_PAGE_MAX_ITEMS(18) items with NO footer) as the
  // last page in that second case used to be this function's guard against
  // a "spurious near-blank extra page" -- but stapling the full footer onto
  // a page already holding close to 18 items reproduces the same overflow
  // this rewrite fixes, just at a larger item count. An item-less (or
  // few-item) continuation page with the real footer content on it is a
  // normal, correctly laid out last page, not a bug.
  pages.push({ items: rest, isFirst: false, isLast: true });
  return pages;
}

function SalesInvoicePrintable({
  order, company, customerRecord, supplierRecord, salesEmployeeRecord, branchRecord, houseBank,
  approverSignatureUrl,
  // Print copies — an array of labels, one full set of pages per label, each
  // label printed to the left of the "TAX INVOICE" title (e.g. ['Original
  // (Finance Copy)', 'Customer Copy', 'Duplicate'], or just ['Duplicate']).
  // null/empty prints a single unlabelled set, which is what the on-screen
  // preview and the WhatsApp PDF capture use.
  copyLabels = null,
}) {
  const isActive = useIsActiveTab();
  if (!order || !isActive) return null;

  const items = order.items || [];
  // Legacy documents saved before customerState existed fall back to Place of Supply.
  const interState = isInterState(order.customerState || order.placeOfSupply, company?.state);
  const discPct = Number(order.discountPercent) || 0;
  const totals = computeTotals(items, discPct, interState, order);

  const companyName = (company?.companyName || 'Nexora KEMACH').toUpperCase();
  const companyAddrLine = joinAddressParts([company?.city, company?.state, company?.country, company?.pincode]);
  // The document's own Branch, resolved against Branch Master by the host
  // page — see SalesOrderPrintable.jsx's identical branchRecord treatment for
  // the full reasoning. Falls back to the company master address below when
  // no branch is selected or matched.
  const branchAddrLine1 = joinAddressParts([branchRecord?.address, branchRecord?.streetNo, branchRecord?.buildingFloorRoom, branchRecord?.block]);
  const branchAddrLine2 = joinAddressParts([branchRecord?.city, branchRecord?.state, branchRecord?.country, branchRecord?.zipCode]);
  const totalQty = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  // The government-issued signed QR string (order.qrCode), rendered as an
  // actual scannable QR -- see eInvoiceQr.js for why this is synchronous.
  // null (no IRN generated yet, or the field is empty) prints nothing.
  const einvoiceQr = buildQrPath(order.qrCode);
  // IRN (64 chars) printed as exactly three even lines rather than however
  // many the box width happens to wrap it into.
  const irnText = String(order.irn || '');
  const irnLineLen = Math.ceil(irnText.length / 3) || 1;
  const irnLines = irnText ? [0, 1, 2].map((i) => irnText.slice(i * irnLineLen, (i + 1) * irnLineLen)).filter(Boolean) : [];
  const taxTotal = round2(totals.cgstAmount + totals.sgstAmount + totals.igstAmount);
  const taxRatePct = totals.taxableAmount > 0 && totals.totalTax > 0 ? (totals.totalTax / totals.taxableAmount) * 100 : 0;

  const billingAddr = cleanAddressText(order.billingAddress || customerRecord?.billingAddress);
  const shippingAddr = cleanAddressText(order.shippingAddress || customerRecord?.shippingAddress);

  const customerBillingAddr = defaultAddressOf(customerRecord, 'Billing');
  const customerShippingAddr = defaultAddressOf(customerRecord, 'Shipping');

  const billingGstNumber = customerBillingAddr?.gstNumber || customerRecord?.gstin || customerRecord?.gstNumber || customerShippingAddr?.gstNumber || '';
  const billingGstType = customerBillingAddr?.gstType || customerRecord?.gstRegistrationType || customerRecord?.gstType || 'Regular/TDS/ISD';

  const shippingGstNumber = customerShippingAddr?.gstNumber || customerBillingAddr?.gstNumber || customerRecord?.gstin || customerRecord?.gstNumber || '';
  const shippingGstType = customerShippingAddr?.gstType || customerBillingAddr?.gstType || customerRecord?.gstRegistrationType || customerRecord?.gstType || 'Regular/TDS/ISD';

  const pages = paginateItems(items, order.remarks, order.termsConditions, interState);
  const pageCount = pages.length;

  // Company + e-invoice block, billing/shipping addresses, document details
  // — page 1 only. Despatch details still have no column on this document
  // and print as labelled blanks (order.* falling back to ''), same as
  // before. The IRN itself DOES have a real column (SalesInvoice.irn, set
  // by taxproGsp.service.js's generateEInvoice) — it just used to be read
  // here under a field name ("irnNo") the row never actually had, so the
  // box was permanently blank regardless of whether an IRN existed.
  const renderHeaderCards = () => (
    <>
      {/* Company + e-invoice block */}
      <table className="sinv-grid sinv-head">
        <tbody>
          <tr>
            <td className="sinv-head-company">
              <div className="sinv-head-text">
                <div className="sinv-company-name">{companyName}</div>
                {branchRecord ? (
                  <>
                    {branchAddrLine1 && <div>{branchAddrLine1}</div>}
                    {branchAddrLine2 && <div>{branchAddrLine2}</div>}
                  </>
                ) : (
                  <>
                    {cleanAddressText(company?.address) && <div>{cleanAddressText(company?.address)}</div>}
                    {companyAddrLine && <div>{companyAddrLine}</div>}
                  </>
                )}
                {company?.gstin && <div>GSTN No:{company.gstin}</div>}
                <div>GSTN Type:{company?.gstnType || 'Regular/TDS/ISD'}</div>
              </div>
            </td>
            {/* KEMACH logo + (when present) the Supplier's own logo, then the
                e-invoice QR, then IRN No -- all sharing this cell's own
                single left inset (sinv-head-irn itself, not each child) so
                the three stay aligned with each other rather than each
                needing its own matching padding. IRN Ack. No dropped: this
                document has no column for it to come from. */}
            <td className="sinv-head-irn">
              <div className="sinv-head-logos">
                <img className="sinv-head-logo" src={kemachLogo} alt="KEMACH" />
                {order.supplier && supplierRecord?.logoVisible && supplierRecord?.logoUrl && (
                  <img className="sinv-head-supplier-logo" src={supplierRecord.logoUrl} alt={order.supplier} />
                )}
              </div>
              {/* IRN No + value on the left, QR on the right of the same row.
                  The IRN block takes only the space left of the QR (flex: 1,
                  min-width: 0) and wraps inside it, so it can never overlap
                  or push the QR, which keeps its own fixed size. */}
              <div className="sinv-irn-row">
                <div className="sinv-irn-left">
                  <div className="sinv-kv sinv-irn-kv">
                    <span className="k">IRN No : </span>
                    <span className="v">{irnLines.map((line, i) => <div key={i} className="sinv-irn-line">{line}</div>)}</span>
                  </div>
                  <div className="sinv-kv sinv-irn-kv">
                    <span className="k">Ack. No. : </span>
                    <span className="v">{order.ackNo || ''}</span>
                  </div>
                  <div className="sinv-kv sinv-irn-kv">
                    <span className="k">Ack. Date : </span>
                    <span className="v">{order.ackDate ? dayjs(order.ackDate).format('DD-MMM-YYYY HH:mm') : ''}</span>
                  </div>
                </div>
                {einvoiceQr && (
                  <svg
                    className="sinv-einvoice-qr"
                    viewBox={`0 0 ${einvoiceQr.size} ${einvoiceQr.size}`}
                    shapeRendering="crispEdges"
                  >
                    <rect width={einvoiceQr.size} height={einvoiceQr.size} fill="#fff" />
                    <path d={einvoiceQr.path} fill="#000" />
                  </svg>
                )}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Billing / shipping addresses */}
      <table className="sinv-grid">
        <tbody>
          <tr>
            <td className="sinv-half">
              <div className="sinv-addr-title">Billing Address To :</div>
              {!order.billToCustomer && customerRecord?.customerCode && <div>Customer Code : {customerRecord.customerCode}</div>}
              <div className="sinv-party">
                {order.billToCustomer ? order.billToCustomer : (order.customer || '')}
              </div>
              {billingAddr && <div className="sinv-pre">{billingAddr}</div>}
              <div>GST Registration Number : {partyIds(order, customerRecord, 'Billing').gst}</div>
              <div>GST Registration Type : {partyIds(order, customerRecord, 'Billing').type}</div>
              <div>PAN Number : {partyIds(order, customerRecord, 'Billing').pan}</div>
            </td>
            <td className="sinv-half">
              <div className="sinv-addr-title">Shipping Address To :</div>
              {!order.shipToCustomer && customerRecord?.customerCode && <div>Customer Code : {customerRecord.customerCode}</div>}
              <div className="sinv-party">
                {order.shipToCustomer ? order.shipToCustomer : (order.customer || '')}
              </div>
              {shippingAddr && <div className="sinv-pre">{shippingAddr}</div>}
              <div>GST Registration Number : {partyIds(order, customerRecord, 'Shipping').gst}</div>
              <div>GST Registration Type : {partyIds(order, customerRecord, 'Shipping').type}</div>
              <div>PAN Number : {partyIds(order, customerRecord, 'Shipping').pan}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Document details */}
      <table className="sinv-grid">
        <tbody>
          <tr>
            <td className="sinv-half">
              <div className="sinv-kv"><span className="k">Invoice No</span><span className="c">:</span><span className="v">{order.invoiceNo || ''}</span></div>
              <div className="sinv-kv"><span className="k">Invoice Date</span><span className="c">:</span><span className="v">{fmtDate(order.invoiceDate)}</span></div>
              <div className="sinv-kv"><span className="k">Delivery Note</span><span className="c">:</span><span className="v">{order.deliveryChallanNo || ''}</span></div>
              <div className="sinv-kv"><span className="k">Buyer&apos;s Order No</span><span className="c">:</span><span className="v">{order.orderNo || ''}</span></div>
              <div className="sinv-kv"><span className="k">Machine Serial No.</span><span className="c">:</span><span className="v">{order.machineSerialNo || ''}</span></div>
              <div className="sinv-kv"><span className="k">Hypothecation</span><span className="c">:</span><span className="v">{order.hypothecation || ''}</span></div>
            </td>
            <td className="sinv-half">
              <div className="sinv-kv"><span className="k">Ship Via</span><span className="c">:</span><span className="v">{order.shipVia || ''}</span></div>
              <div className="sinv-kv"><span className="k">Carrier Name</span><span className="c">:</span><span className="v">{order.carrierName || ''}</span></div>
              <div className="sinv-kv"><span className="k">Payment Terms</span><span className="c">:</span><span className="v">{order.paymentTerms || ''}</span></div>
              <div className="sinv-kv"><span className="k">Sales Employee</span><span className="c">:</span><span className="v">{order.salesPerson || ''}</span></div>
              <div className="sinv-kv"><span className="k">Engine No.</span><span className="c">:</span><span className="v">{order.engineNo || ''}</span></div>
              <div className="sinv-kv"><span className="k">Customer PO No.</span><span className="c">:</span><span className="v">{order.customerRefNo || ''}</span></div>
            </td>
          </tr>
          <tr>
            <td className="sinv-half" colSpan={2}>
              <div className="sinv-kv"><span className="k">Remarks</span><span className="c">:</span><span className="v">{order.remarks || ''}</span></div>
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );

  // Line items for one page. The table itself is the flex-grow element
  // (sinv-fill, see CSS) — its own last row is an empty spanning cell that
  // absorbs whatever vertical space is left on THIS page, so the item
  // grid's own ruled border runs all the way to the foot of every sheet,
  // not just a short one.
  const renderItemsTable = (pageItems, startIndex) => (
    <table className="sinv-grid sinv-items sinv-fill">
      <thead>
        <tr>
          <th className="w-sn">S.<br />No</th>
          <th className="w-code">Item Code</th>
          <th className="w-desc">Description</th>
          <th className="w-hsn">HSN/<br />SAC</th>
          <th className="w-um">UM</th>
          <th className="num w-qty">Qty</th>
          <th className="num w-price">Unit<br />Price</th>
          <th className="num w-disc">Disc<br />%</th>
          <th className="num w-ass">Ass.<br />Value</th>
          <th className="w-tax">Tax<br />%</th>
          <th className="num w-taxamt">Tax<br />Amount</th>
          <th className="num w-amt">Amount</th>
        </tr>
      </thead>
      <tbody>
        {pageItems.map((it, i) => {
          const idx = startIndex + i;
          const f = lineFigures(it, discPct);
          // Intra-state shows CGST and SGST as two stacked sub-rows against
          // one line, exactly as the sample does; inter-state is a single
          // IGST row.
          const components = interState
            ? [{ label: 'IGST', pct: f.taxPct, amt: f.taxAmount }]
            : [
                { label: 'CGST', pct: f.taxPct / 2, amt: f.taxAmount / 2 },
                { label: 'SGST', pct: f.taxPct / 2, amt: f.taxAmount / 2 },
              ];
          // A line whose own Tax Code is 'GST+TCS'/'IGST+TCS' shows its 1%
          // TCS carve-out as its own row directly under CGST/SGST (or IGST),
          // aligned to the SAME row height/columns as CGST/SGST -- so a
          // mixed-cart document makes clear which line actually triggered
          // TCS instead of only surfacing it in the document totals further
          // down the page.
          if (isTcsTaxType(it.taxType)) {
            components.push({ label: 'TCS', pct: 1, amt: round2((f.taxable + f.taxAmount) * 0.01) });
          }
          return (
            <React.Fragment key={idx}>
              <tr>
                <td rowSpan={components.length}>{idx + 1}</td>
                <td rowSpan={components.length}>{it.productCode || ''}</td>
                <td rowSpan={components.length}>{it.description || it.productName || ''}</td>
                <td rowSpan={components.length}>{it.hsnCode || ''}</td>
                <td rowSpan={components.length}>{it.uom || ''}</td>
                <td className="num" rowSpan={components.length}>{fmtQty(f.qty)}</td>
                <td className="num" rowSpan={components.length}>{fmtNum(f.price)}</td>
                <td className="num" rowSpan={components.length}>{f.itemDiscPct.toFixed(2)}</td>
                <td className="num" rowSpan={components.length}>{fmtNum(f.taxable)}</td>
                <td className="sinv-taxcell">{components[0].label} {components[0].pct.toFixed(2)}%</td>
                <td className="num">{fmtNum(components[0].amt)}</td>
                <td className="num" rowSpan={components.length}>{fmtNum(f.total)}</td>
              </tr>
              {components.slice(1).map((c) => (
                <tr key={c.label}>
                  <td className="sinv-taxcell">{c.label} {c.pct.toFixed(2)}%</td>
                  <td className="num">{fmtNum(c.amt)}</td>
                </tr>
              ))}
            </React.Fragment>
          );
        })}
        <tr className="sinv-fill-row">
          <td className="sinv-fill-cell" colSpan={12} />
        </tr>
      </tbody>
    </table>
  );

  // Totals / HSN summary / bank details / declarations — last page only.
  const renderFooterContent = () => (
    <>
      {/* Totals */}
      <table className="sinv-grid">
        <tbody>
          <tr>
            <td className="sinv-qty-cell">Total Qty <b>{fmtQty(totalQty)}</b></td>
            <td className="sinv-total-label">Total</td>
            <td className="sinv-total-value">{fmtNum(totals.taxableAmount + taxTotal)}</td>
          </tr>
          <tr>
            <td rowSpan={4} className="sinv-words-cell">
              <div>Amount in Words. ({order.currency || 'INR'})</div>
              <div className="sinv-words">{amountToWords(totals.grandTotal) || ''}</div>
            </td>
            <td className="sinv-total-label">Freight charges</td>
            <td className="sinv-total-value">{fmtNum(totals.freightGrossAmount)}</td>
          </tr>
          <tr>
            <td className="sinv-total-label">Round off</td>
            <td className="sinv-total-value">{fmtNum(totals.roundOff)}</td>
          </tr>
          <tr>
            <td className="sinv-total-label"><b>Grand Total</b></td>
            <td className="sinv-total-value"><b>{fmtNum(totals.grandTotal)}</b></td>
          </tr>
        </tbody>
      </table>

      <table className="sinv-grid sinv-hsn">
        <thead>
          <tr>
            <th className="num">TAXABLE VALUE</th>
            <th className="num">{interState ? 'INTEGRATED TAX %' : 'CENTRAL TAX %'}</th>
            <th className="num">{interState ? 'INTEGRATED TAX AMT' : 'CENTRAL TAX AMT'}</th>
            {!interState && <th className="num">STATE TAX %</th>}
            {!interState && <th className="num">STATE TAX AMT</th>}
            {totals.tcsAmount > 0 && <th className="num">TCS %</th>}
            {totals.tcsAmount > 0 && <th className="num">TCS AMT</th>}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="num">{fmtNum(totals.taxableAmount)}</td>
            <td className="num">{(interState ? taxRatePct : taxRatePct / 2).toFixed(2)}</td>
            <td className="num">{fmtNum(interState ? totals.igstAmount : totals.cgstAmount)}</td>
            {!interState && <td className="num">{(taxRatePct / 2).toFixed(2)}</td>}
            {!interState && <td className="num">{fmtNum(totals.sgstAmount)}</td>}
            {totals.tcsAmount > 0 && <td className="num">{(1).toFixed(2)}</td>}
            {totals.tcsAmount > 0 && <td className="num">{fmtNum(totals.tcsAmount)}</td>}
          </tr>
        </tbody>
      </table>

      <table className="sinv-grid">
        <tbody>
          <tr>
            <td>Tax Amount in Words. ({order.currency || 'INR'}) {amountToWords(taxTotal) || ''}</td>
          </tr>
        </tbody>
      </table>

      {/* Bank details — from the House Bank master */}
      <table className="sinv-grid">
        <tbody>
          <tr>
            <td colSpan={2} className="sinv-bank-title">Company&apos;s Bank Details :</td>
          </tr>
          <tr>
            <td className="sinv-bank-details">
              <div className="sinv-kv"><span className="k">Beneficiary Name</span><span className="c">:</span><span className="v">{houseBank?.accountName || company?.companyName || ''}</span></div>
              <div className="sinv-kv"><span className="k">Bank Name</span><span className="c">:</span><span className="v">{houseBank?.bankName || ''}</span></div>
              <div className="sinv-kv"><span className="k">Branch</span><span className="c">:</span><span className="v">{houseBank?.branchName || ''}</span></div>
              <div className="sinv-kv"><span className="k">A/c No.</span><span className="c">:</span><span className="v">{houseBank?.accountNumber || ''}</span></div>
              <div className="sinv-kv"><span className="k">RTGS/IFSC Code</span><span className="c">:</span><span className="v">{houseBank?.ifscCode || ''}</span></div>
              <div className="sinv-kv"><span className="k">Type</span><span className="c">:</span><span className="v">{houseBank?.accountType || ''}</span></div>
            </td>
            <td className="sinv-bank-qr-cell">
              {houseBank?.qrCodeUrl && (
                <img className="sinv-bank-qr" src={houseBank.qrCodeUrl} alt="Bank QR code" />
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Declarations + signature */}
      <table className="sinv-grid sinv-foot">
        <tbody>
          <tr>
            <td className="sinv-foot-left">Interest at 24% p.a. will be charged on all overdue payments</td>
            <td className="sinv-foot-right">For {companyName}</td>
          </tr>
          <tr>
            <td className="sinv-foot-left">
              {order.termsConditions
                ? <div className="sinv-pre">{order.termsConditions}</div>
                : (
                  <>
                    <div>All agreements contingent upon strikes, accidents and other conditions beyond our control.</div>
                    <div>All contracts are subject to approval by an office of the Company.</div>
                  </>
                )}
            </td>
            <td className="sinv-foot-right sinv-sign">
              {approverSignatureUrl ? <img className="sinv-sign-img" src={approverSignatureUrl} alt="" style={order.salesCategory === 'Machine' ? { height: '96px', maxWidth: '70mm' } : undefined} /> : null}
              {order.salesCategory !== 'Machine' && <div>Authorized Signatory</div>}
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );

  // One physical page — its own complete letterhead header/watermark/footer
  // in normal document flow, so the browser draws them on THIS page
  // regardless of how many pages the document has (see the pagination
  // comment above paginateItems for why this replaced the CSS-only
  // position: fixed approach).
  const renderPage = (page, pageIndex, startIndex, copyLabel = null, copyIndex = 0) => (
    <div className="sinv-sheet" key={`${copyIndex}-${pageIndex}`}>
      <div className="sinv-page">
        <LetterheadHeader company={company} />
        <LetterheadWatermark />

        {page.isFirst && (
          <div className="sinv-copy-title">
            {copyLabel ? <span className="sinv-copy-label">{copyLabel}</span> : null}
            <span className="sinv-doc-title">TAX INVOICE</span>
          </div>
        )}

        {page.isFirst && renderHeaderCards()}

        {renderItemsTable(page.items, startIndex)}

        {page.isLast && renderFooterContent()}

        <div className="sinv-pagefoot">
          <span>{company?.phone ? `Ph No : ${company.phone}` : ''}</span>
          <span>{company?.email ? `Email Id : ${company.email}` : ''}</span>
          <span>Page {pageIndex + 1} of {pageCount}</span>
        </div>

        <LetterheadFooter company={company} />
      </div>
    </div>
  );

  const renderAllPages = () => {
    const copies = copyLabels && copyLabels.length ? copyLabels : [null];
    return copies.flatMap((copyLabel, copyIndex) => {
      let startIndex = 0;
      return pages.map((page, i) => {
        const el = renderPage(page, i, startIndex, copyLabel, copyIndex);
        startIndex += page.items.length;
        return el;
      });
    });
  };

  return createPortal(
    <div className="sinv-print-area">
      <style>{`
        ${letterheadStyles('.sinv-page', RULE_SPACING)}
        .sinv-print-area { display: none; }
        @media print {
          /* .sinv-print-area is portaled straight onto <body> (see the
             createPortal call below) — a DIRECT SIBLING of #root, not
             nested inside it. That is what makes this rule safe: hiding
             #root removes the entire rest of the app (sidebar, data table,
             open dialogs) from layout ENTIRELY (display: none, not merely
             invisible), so none of it can contribute stray height for the
             print engine to paginate against, and nothing needs to be
             clamped or clipped to "exactly one viewport" any more. An
             invoice with enough items to run past one page now simply
             flows onto additional physical pages instead of being clipped
             — see the pagination comment above paginateItems for the fuller
             reasoning, and SalesQuotationPrintable.jsx for the sibling
             fix this mirrors.
          */
          body.${PRINTING_CLASS} #root { display: none !important; }
          body.${PRINTING_CLASS} .sinv-print-area {
            display: block; width: 100%; box-sizing: border-box;
          }
          body.${PRINTING_CLASS} .sinv-print-area,
          body.${PRINTING_CLASS} .sinv-print-area * {
            visibility: visible;
          }
          /* Explicit millimetres rather than the "A4" size keyword — print
             pipelines that only loosely implement the size keyword (notably
             the Windows "Microsoft Print to PDF" driver reached through a
             browser's "Print using system dialog" path) honour explicit
             physical dimensions far more reliably. Matches
             PurchaseOrderPrintable.jsx's own @page rule verbatim.

             margin: 0 — an @page margin that reserves a top/bottom band for
             the letterhead (with position: fixed bands drawn into it,
             repeating per physical page) was tried here and reverted: on
             this app's actual print/PDF pipeline the @page margin did not
             reflow the normal document content down out of that band at
             all, so the fixed-position header ended up drawn on TOP of the
             ordinary flowing content instead of above it. The letterhead
             now repeats per page a different way — see the pagination
             comment above paginateItems: the document is built as several
             explicit .sinv-sheet blocks, each with its own header/footer in
             normal flow, rather than relying on any @page-margin/fixed-
             position trick at all. */
          @page { size: 210mm 297mm; margin: 0; }
          /* Each page is its own sheet; the last must not emit a trailing blank page. */
          .sinv-sheet { page-break-after: always; }
          .sinv-sheet:last-child { page-break-after: auto; }
        }
        /* min-height: 100vh, NOT a fixed height — a short page (few items)
           still fills exactly one visual page, since the item table below
           (.sinv-fill, flex: 1 1 0) stretches into whatever slack is left,
           pinning that page's own footer content to the bottom of its own
           sheet. A page with enough items to exceed one page's worth of
           content is no longer forced to shrink into that same fixed box —
           the sheet grows taller than 100vh instead, and the browser's own
           print pagination (the page-break-after rule above) carries the
           overflow onto the NEXT explicit .sinv-sheet page block rather than
           clipping or overlapping it. NOT a hardcoded ${PAGE_HEIGHT_MM}mm
           either — see the note on PAGE_HEIGHT_MM above. The
           ${PAGE_MARGIN_MM}mm inset is this element's own padding, not an
           @page margin, so it's set in exactly one place and no print
           engine can add a second one on top. */
        .sinv-sheet {
          min-height: 100vh;
          box-sizing: border-box;
          padding: ${PAGE_MARGIN_MM}mm;
        }
        /* Each page fills the sheet's content box. As a column flexbox with
           a growing spacer in the middle, a short page pushes its footer
           content down to the foot of the page instead of leaving the
           bottom half empty, while a long one simply overflows onto the
           next explicit .sinv-sheet page block as normal.

           min-height: calc(...), NOT height: 100%/min-height: 100% —
           .sinv-sheet above no longer has a DEFINITE height of its own (it
           is min-height: 100vh with no height set, so it can grow with
           content), and a percentage height on a child needs a definite
           height on the parent to resolve against; against an
           indefinite/auto parent height, height: 100% computes to auto
           instead (CSS2.1 10.5). That silently collapsed this flex column
           to its own content's natural height — far short of a full page —
           which pulled .lh-footer (position: absolute; bottom: 0 against
           THIS element) up to sit right under a short item table instead of
           at the true bottom of the sheet. .sinv-sheet's own
           ${PAGE_MARGIN_MM}mm padding (both top and bottom) sits OUTSIDE
           this element, so this element's floor has to be 100vh minus that
           padding, not 100vh itself — otherwise this box plus the sheet's
           padding would together exceed one physical page and push part of
           the footer onto a second page even for a short, single-page
           document.

           The letterhead reserves are padding rather than margin: with
           box-sizing: border-box they come out of the reserved floor, so
           each page still ends where it should. A margin would add to that
           height and push the footer onto an extra page. */
        .sinv-page {
          display: flex; flex-direction: column;
          min-height: calc(100vh - ${PAGE_MARGIN_MM * 2}mm);
          box-sizing: border-box;
          padding-top: ${LETTERHEAD_TOP_MM}mm;
          padding-bottom: ${LETTERHEAD_BOTTOM_MM}mm;
        }
        /* The one element allowed to grow — every other block keeps its natural
           height (flex-shrink: 0 below), so all the slack lands here. Overrides
           that shared flex-shrink because this table is meant to flex; it's
           the item grid itself now (see the JSX), not a separate table after
           it, so the grid's own ruled border is what extends down the page. */
        table.sinv-items.sinv-fill { flex: 1 1 0; min-height: 0; }
        /* Its trailing filler row inherits the table's stretched height. */
        .sinv-fill-row, .sinv-fill-cell { height: 100%; }
        .sinv-print-area { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 10.5px; }
        /* "TAX INVOICE" centred on the sheet; the copy label (Original /
           Customer Copy / Duplicate), when printing copies, sits at the left
           edge of the same line. */
        .sinv-copy-title { position: relative; text-align: center; font-weight: 700; font-size: 15px; margin-bottom: 2px; }
        .sinv-copy-label { position: absolute; left: 0; top: 50%; transform: translateY(-50%); font-size: 11px; font-weight: 700; text-align: left; }

        /* One ruled grid for the whole document — every block is a table so the
           vertical rules line up down the page. */
        /* flex-shrink: 0 — as flex items inside .sinv-page these would otherwise
           be compressed to fit the fixed page height, squashing the rows. */
        table.sinv-grid { width: 100%; border-collapse: collapse; table-layout: fixed; flex-shrink: 0; }
        table.sinv-grid td, table.sinv-grid th {
          border: ${GRID_BORDER_PX}px solid #000; padding: 1px 4px; vertical-align: top;
        }
        /* Top/bottom cell padding dropped from 3px to 1px -- matching
           SalesQuotationPrintable.jsx's own PROVEN fix (verified against a
           real screenshot, not another guess) for the identical "footer
           pushed onto its own near-blank extra page" bug on that sibling
           file, which shares this exact .sinv-grid rule structure and the
           same overall page layout. This file's own padding was still at
           3px -- a full 1px MORE than quotation's own PRE-FIX value of 2px
           -- so every one of the ~15-18 stacked rows on a page (header
           cards, item rows, HSN summary, bank details, declarations) was
           costing 2px more top+bottom than what already needed fixing on
           the sibling file, roughly 30-36px (~8-9.5mm) of real, provable
           height this file was never entitled to. See the sinv-bank-qr
           shrink just below for the other half of the same proven fix. */
        /* Every rule on the sheet is one weight, including the ones between
           blocks.
           border-collapse merges adjacent borders WITHIN a table, but the
           document is a stack of separate tables, and collapsing does not
           reach across two of them. So where one block ended and the next
           began, the bottom rule of the first and the top rule of the second
           printed one under the other and came out at double weight — the band
           separators looked heavier than the lines inside the item grid.
           Pulling each table up by exactly one border width lands the two rules
           on the same pixel row, which is what collapsing would have done had
           they been in the same table.
           (The old rule here removed border-top from the TABLE element. That
           element carries no border of its own — the cells do — so it never had
           any effect.) */
        table.sinv-grid + table.sinv-grid { margin-top: -${GRID_BORDER_PX}px; }
        .sinv-half { width: 50%; }
        .num { text-align: right; }

        .sinv-company-name { font-weight: 700; font-size: 11.5px; margin-bottom: 1px; }
        /* Company text now has the whole left column to itself — no logo
           sharing this box any more, so no max-width carve-out is needed. */
        .sinv-head-company { width: 62%; }
        /* KEMACH + Supplier logos side by side, centred in the IRN column,
           with IRN No underneath — see the file-level note above. */
        /* One inset for the whole cell -- logos, QR and IRN No all sit at the
           same left edge as each other instead of each carrying its own. */
        /* Everything in this cell stays inside it: top-aligned, no negative
           offsets, so the logos / IRN / QR never ride up over the letterhead. */
        .sinv-head-irn { padding-left: 5mm; vertical-align: top; }
        .sinv-head-logos {
          display: flex; align-items: center; justify-content: flex-start;
          gap: 3mm; margin-bottom: 0;
        }
        .sinv-einvoice-qr {
          display: block; width: 21mm; height: 21mm; margin-bottom: 0; margin-left: auto;
        }
        .sinv-head-logo {
          width: 32mm; height: auto;
          /* Sharpen on the way down instead of the browser's default soft
              smoothing — the source asset is high-resolution (2962x812), so
              this is what keeps it crisp at print size rather than blurred. */
          image-rendering: -webkit-optimize-contrast;
          -webkit-print-color-adjust: exact; print-color-adjust: exact;
        }
        .sinv-head-supplier-logo {
          width: 20mm; height: auto; object-fit: contain;
          image-rendering: -webkit-optimize-contrast;
          -webkit-print-color-adjust: exact; print-color-adjust: exact;
        }
        .sinv-head-irn { width: 38%; }
        /* IRN row: text block left, QR right (QR size/spacing unchanged). */
        .sinv-irn-row { display: flex; align-items: flex-start; gap: 3mm; }
        .sinv-irn-row .sinv-einvoice-qr { flex: 0 0 21mm; margin-top: -1mm; }
        .sinv-irn-left { flex: 1 1 auto; min-width: 0; }
        /* Compact type for the IRN / Ack block -- this cell is now the
           tallest thing in the header row, so every mm here is a mm the
           footer gets back. */
        .sinv-irn-kv { min-width: 0; font-size: 10px; }
        .sinv-kv.sinv-irn-kv { line-height: 1.2; }
        /* Value starts right after the label instead of at the shared 42%
           label column the other key/value rows use. */
        /* .sinv-kv.sinv-irn-kv (two classes on one element) so this beats
           the generic .sinv-kv .k { flex: 0 0 42% } declared further down —
           that 42% label column was the big gap before the IRN value. */
        .sinv-kv.sinv-irn-kv .k { flex: 0 0 auto; white-space: nowrap; }
        .sinv-kv.sinv-irn-kv .v { min-width: 0; }
        .sinv-irn-line { white-space: nowrap; }
        .sinv-break { word-break: break-all; }

        .sinv-kv { display: flex; gap: 4px; line-height: 1.35; }
        .sinv-kv .k { flex: 0 0 42%; }
        .sinv-kv .c { flex: 0 0 4px; }
        .sinv-kv .v { flex: 1; font-weight: 600; }

        .sinv-addr-title { font-weight: 400; margin-bottom: 2px; }
        .sinv-party { font-weight: 400; }
        .sinv-pre { white-space: pre-line; line-height: 1.35; }

        table.sinv-items th { font-weight: 700; text-align: center; font-size: 9.5px; }
        table.sinv-items td { font-size: 9.5px; }
        table.sinv-items td.num { font-size: 8px; white-space: nowrap; }
        table.sinv-items .w-sn { width: 3.5%; }
        table.sinv-items .w-code { width: 9%; }
        table.sinv-items .w-desc { width: 22%; }
        table.sinv-items .w-hsn { width: 7%; }
        table.sinv-items .w-um { width: 5%; }
        table.sinv-items .w-qty { width: 5%; }
        table.sinv-items .w-price { width: 8.5%; }
        table.sinv-items .w-disc { width: 5.5%; }
        table.sinv-items .w-ass { width: 9%; }
        table.sinv-items .w-tax { width: 9.5%; }
        table.sinv-items .w-taxamt { width: 8%; }
        table.sinv-items .w-amt { width: 8%; }
        .sinv-taxcell { white-space: nowrap; }

        .sinv-qty-cell { width: 62%; }
        .sinv-total-label { width: 22%; }
        .sinv-total-value { width: 16%; text-align: right; }
        .sinv-words-cell { vertical-align: top; }
        .sinv-words { font-weight: 600; text-transform: uppercase; }

        table.sinv-hsn th, table.sinv-hsn td { font-size: 9.5px; }
        table.sinv-hsn th { font-weight: 700; }

        .sinv-bank-title { font-weight: 700; border-bottom: none; }
        .sinv-bank-details { width: 70%; }
        .sinv-bank-qr-cell { width: 30%; text-align: center; vertical-align: middle; }
        .sinv-bank-qr { width: 22mm; height: 22mm; object-fit: contain; image-rendering: pixelated; }

        table.sinv-foot .sinv-foot-left { width: 62%; line-height: 1.45; }
        table.sinv-foot .sinv-foot-right { width: 38%; text-align: right; }
        table.sinv-foot .sinv-sign { height: 46px; vertical-align: bottom; }
        /* max-width caps a wide signature image (SalesOrder/SalesInvoice
           draw approverSignatureUrl -- an uploaded image of whatever aspect
           ratio the user supplied, not a fixed stationery asset) so a wide
           source can never overflow the .sinv-foot-right column and throw
           the footer's two columns out of alignment with each other -- the
           same containment PurchaseOrderPrintable.jsx's own .po3-sign-mark
           already applies (width: 30mm there) to its own signature image. */
        .sinv-sign-img { display: block; margin: 0 6mm 2px auto; height: 52px; max-width: 40mm; width: auto; object-fit: contain; }

        .sinv-pagefoot { display: flex; justify-content: space-between; padding: 3px 2px 0; font-size: 9px; }
      `}</style>

      {renderAllPages()}
    </div>,
    document.body
  );
}

// Memoized: each document form renders this whole A4 sheet unconditionally
// (hidden with display:none rather than conditionally rendered), so without
// this the item table, HSN summary, totals and the long generated inline
// <style> string were rebuilt on every keystroke in the form. The inner
// function keeps its name so React DevTools and debug output still
// identify it as SalesInvoicePrintable.
export default React.memo(SalesInvoicePrintable);
