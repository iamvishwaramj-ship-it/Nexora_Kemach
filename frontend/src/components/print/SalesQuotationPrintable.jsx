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
import { useIsActiveTab } from '../navigation/TabPathContext';

// The exact template SalesInvoicePrintable.jsx uses — same letterhead
// branding (drawn into the page rather than assumed pre-printed), same
// ruled-grid-of-tables technique, same ITEM tax-row rowSpan trick, same
// totals/HSN-summary shape, same full-page-coverage flex fill. Prints a
// single copy — no ORIGINAL/DUPLICATE/TRIPLICATE heading and no repeated
// sheets — with this document's own nominal fields substituted for the
// invoice's (Quotation No/Date/Valid
// Till in place of Invoice No/Date/Delivery Note, no e-invoice IRN block,
// etc.). See SalesInvoicePrintable.jsx for the extended reasoning behind each
// technique; the comments here only call out where this document differs.

// One weight for every rule on the sheet.
const GRID_BORDER_PX = 1;

// --- Print activation ------------------------------------------------------
// KeepAliveOutlet keeps every open tab's page MOUNTED (see
// PurchaseOrderPrintable.jsx's own note on this), so this component's
// <style> sits in the DOM whenever a SalesQuotation tab is open -- including
// while the user prints some completely different document from another
// open tab. Without gating, the rules below (`#root { display: none }` /
// `.sqp-print-area { display: block }`) matched the SAME unconditional
// `@media print` as every other un-gated sales printable, so whichever
// document's print area happened to be later in DOM order painted OVER
// whichever document the user actually meant to print -- the reported
// "print Sales Quotation, get Sales Order instead" bug. Reusing
// makeScopedPrint (the exact mechanism the Purchase-side stationery family
// already uses for this) scopes every rule below to a printingClass that is
// only present while THIS document's own print is actually running.
const PRINTING_CLASS = 'sqp-printing';
const PAGE_RULE_ID = 'sqp-print-page-rule';

/**
 * Print THIS Sales Quotation. Call instead of window.print() from
 * SalesQuotation.jsx's own Print controls.
 */
export const printSalesQuotation = makeScopedPrint({ printingClass: PRINTING_CLASS, pageRuleId: PAGE_RULE_ID });
// "Send via WhatsApp"'s PDF source -- see makeScopedCapture in
// purchaseStationery.jsx. '.sqp-sheet' is this document's own per-page
// block (see the .sqp-sheet div further down).
export const captureSalesQuotationPdf = makeScopedCapture({ printingClass: PRINTING_CLASS, pageRuleId: PAGE_RULE_ID, sheetSelector: '.sqp-sheet', areaSelector: '.sqp-print-area' });

// A4 portrait (210mm x 297mm). The sheet itself is NOT sized with this
// constant any more — see .sqp-sheet below, which uses height: 100vh instead
// of a hardcoded mm value, matching PurchaseOrderPrintable.jsx's own
// documented fix for the same "gap under the printed document" symptom: in
// print, a fixed-mm box does not reliably match the real printable area a
// browser/driver actually grants (Chrome's own pipeline and drivers such as
// Windows' "Microsoft Print to PDF" can reserve their own margin or apply a
// print-dialog Scale), so a hardcoded 297mm sheet can fall short of the true
// page edge, leaving the flex-fill's stretch target — and everything below
// it — short of the bottom of the page. 100vh always matches whatever area
// is actually granted. Kept here only as the value the explicit @page size
// below must agree with.
const PAGE_HEIGHT_MM = 297;
// The page inset, as this element's own padding rather than an @page margin
// — matches Purchase Order's 6mm exactly (see .sqp-sheet) so both documents
// share the same physical page outline.
const PAGE_MARGIN_MM = 6;

// Same brand-rule spacing SalesInvoicePrintable.jsx sets — restated here so
// this document's gaps can be tuned independently without touching the
// invoice's.
const RULE_SPACING = {
  headerAbove: 3.5,
  headerBelow: 0,
  footerAbove: 2,
  footerBelow: 1.5,
};

const fmtDate = (d) => (d ? dayjs(d).format('DD-MMM-YYYY') : '');
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
  // Sales Quotation only — the same flat 8.2% Road Tax the form/server
  // compute (see backend/src/routes/resources.js's computeSalesQuotationTotals),
  // plus Freight Charges (Net + Tax, recomputed the same way) — both folded
  // into the printed Grand Total exactly as they are in the saved amount.
  const roadTax = order.roadTaxApplicable ? round2(Number(order.roadTax) || 0) : 0;
  // Road Tax is added after the engine's own whole-number rounding pass, so
  // it can reintroduce fractional cents into the Grand Total. Do a second
  // rounding pass here and fold its delta into the displayed Round Off so
  // Round Off keeps reconciling with Grand Total whenever Road Tax applies —
  // same fix as the on-screen SalesQuotation.jsx form.
  const preRoundWithRoadTax = round2(totals.amount + roadTax);
  const amountWithRoadTax = Math.round(preRoundWithRoadTax);
  const additionalRoundOff = round2(amountWithRoadTax - preRoundWithRoadTax);
  const combinedRoundOff = round2((totals.roundOff || 0) + additionalRoundOff);
  const freightGrossAmount = order.freightGrossAmount != null
    ? round2(Number(order.freightGrossAmount) || 0)
    : computeFreightGross(order.freightNetAmount, order.freightTaxAmount);
  return {
    ...totals,
    discount: round2(totals.subtotal - totals.taxableAmount),
    roadTax,
    roundOff: combinedRoundOff,
    freightGrossAmount,
    grandTotal: round2(amountWithRoadTax + freightGrossAmount),
  };
}

/** Per-line figures — computed once so the item grid and the HSN summary can never disagree. */
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
// around it.
//
// This is the robust alternative: build the document as several explicit,
// self-contained .sqp-sheet page blocks (see renderPage/renderAllPages
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
// FIRST_PAGE_MAX_ITEMS/LAST_PAGE_MAX_ITEMS below are each calibrated for
// ONE of header-only or footer-only overhead -- but the single-page case
// (isFirst && isLast) carries the header cards AND the full footer content
// TOGETHER, which is a much tighter budget than either alone. Raising
// FIRST_PAGE_MAX_ITEMS from 8 to 12 (matching SalesInvoicePrintable.jsx)
// did NOT fix the "footer lands on its own near-blank page" bug, because
// that budget was never the right one to check against for a single page
// in the first place. Rough mm accounting (297mm sheet, minus the 6mm
// PAGE_MARGIN_MM sheet padding twice, minus the 23mm/23.2mm
// LETTERHEAD_TOP_MM/LETTERHEAD_BOTTOM_MM bands = ~238.8mm of actual
// flowing content room on every page), using this file's own font-sizes/
// line-heights (12px body text, 1.45 line-height on every .sqp-kv/.sqp-pre
// row, 10.5px in the item/HSN tables, 3px/4px cell padding on every
// .sqp-grid cell):
//   copy title (17px + 3px margin)                    ~6mm
//   company name/address/logos card (1 row)           ~21mm
//   billing/shipping card (1 row, 2 cols)              ~22-27mm (grows with address length)
//   document-detail card (2 rows: 5 kv fields + Remarks) ~31mm baseline (grows with Remarks length)
//   item table head (2-line column headings)            ~8.5mm
//                                         fixed header total  ~89-94mm
//   totals table (5 rows)                                ~27mm
//   HSN/SAC summary (header + >=1 row)                   ~10mm+ (grows with distinct HSN codes)
//   tax-amount-in-words line                             ~5.5mm
//   bank details table (with QR image)                   ~35mm
//   declarations + signature table (grows with Terms text) ~28mm
//                                         fixed footer total  ~105.5mm
//   page-foot line (Ph/Email/Page X of Y)                 ~4mm
//                                     TOTAL FIXED OVERHEAD  ~199-204mm
// That leaves roughly 238.8 - 204 = ~35mm for item rows when a page carries
// BOTH header and footer -- and each item row (the common CGST+SGST
// intra-state case renders 2 stacked sub-rows) is itself roughly 9.8mm, so
// only about THREE OR FOUR items fit, nowhere near the 12 that
// FIRST_PAGE_MAX_ITEMS allows. SINGLE_PAGE_MAX_ITEMS below is that
// combined-overhead budget, used ONLY for the initial single-vs-multi-page
// decision; FIRST_PAGE_MAX_ITEMS/LAST_PAGE_MAX_ITEMS keep their original,
// larger values for genuine multi-page first/last pages, which only ever
// carry ONE of header or footer and comfortably have ~30-40mm of margin to
// spare.
//
// THIRD ROUND, real screenshot evidence (not a guess): a real 2-item,
// empty-Remarks quotation (SQ-26-27-000001, no long Terms/Hypothecation
// text either) still rendered as ONE logical page (correctly, per
// SINGLE_PAGE_MAX_ITEMS=4) but the LetterheadFooter band was pushed onto a
// second, otherwise-blank physical page -- page 1's real content ran flush
// to the bottom edge with the footer completely absent, so the ~35mm of
// item-row margin this file's own arithmetic above claims was NOT actually
// there for real content. Two rounds of pure mm-constant tuning already
// failed on this exact bug before, so this pass makes two real, provable
// cuts instead of moving another guessed number: cell padding on every
// .sqp-grid cell dropped from 2px to 1px top/bottom (roughly 15-18 stacked
// rows across the page * 2px saved top+bottom ~= 30-36px ~= 8-9.5mm), and
// the bank-details QR code shrunk from 30mm to 22mm square (that row's
// height was QR-bound, not text-bound -- the six Beneficiary/Bank/Branch/
// A/c/IFSC/Type lines only run ~25mm tall at this font-size/line-height --
// so this recovers close to the full 8mm difference). Combined estimate:
// roughly 16-17mm recovered. Note this does NOT require the whole
// FOOTER_CONTENT_MM (~23.2mm) to be found -- an overflowing footer band is
// one atomic block that gets pushed to the next page in full the moment ANY
// part of it doesn't fit, so the real deficit that caused this could well
// have been much smaller than the footer's own total height. If a real
// print/PDF test still shows the footer spilling after this, the next step
// should be measuring the actual rendered .sqp-sheet height in the browser
// (e.g. via a ResizeObserver on the print area once it's made visible for
// printing) and forcing the multi-page layout when it doesn't fit, rather
// than a fourth round of hand-estimated constants -- this file has no way
// to render itself and see real wrapped-text/row heights, so every number
// above is inherently an approximation.
//
// Remarks (header) and Terms & Conditions (footer) are free text with no
// length limit and are NOT counted by items.length at all -- a document
// with very few items but a long note in either field can still overflow
// even this reduced budget on its own. extraTextOverflowItems() below
// estimates how many EXTRA wrapped lines they are likely to add beyond the
// one baseline line each already costs above, and folds that estimate into
// the single-page item budget so a long note pushes a borderline document
// onto its own continuation page instead of silently overflowing.
// Raised a notch (12/18/8 -> 13/19/9) to match the real font-size/
// line-height shrink applied to .sqp-print-area and the items/HSN tables
// below (see MM_PER_ITEM_ROW/MM_PER_TEXT_LINE) -- the identical
// recalibration made to SalesInvoicePrintable.jsx after a real invoice
// with more items was still pushing its footer onto a spurious extra
// page. SINGLE_PAGE_MAX_ITEMS is left untouched -- see its own comment.
const FIRST_PAGE_MAX_ITEMS = 13; // a genuine page 1 of many: header cards only, no footer
const MID_PAGE_MAX_ITEMS = 19;   // a continuation page with nothing but the item grid
const LAST_PAGE_MAX_ITEMS = 9;   // a genuine last page of many: footer only, no header cards
const SINGLE_PAGE_MAX_ITEMS = 4; // header AND footer together -- see the mm accounting above

// Rough characters-per-wrapped-line estimates for Remarks (a full-width row
// in the document-detail card) and Terms & Conditions (the ~62%-wide left
// column of the footer's declarations table). Deliberately on the LOW side
// (i.e. assume MORE wrapped lines than really fit) so this errs toward
// splitting an extra page rather than under-counting -- consistent with
// every other estimate in this file.
const REMARKS_CHARS_PER_LINE = 100;
const TERMS_CHARS_PER_LINE = 70;
// mm cost of one extra wrapped text line (this file's own 1.45 line-height
// at the 12px body font-size) versus one extra item row, so a text-line
// estimate can be folded into the same item-count budget above.
// Shrunk in step with the real font-size/line-height reduction above so
// these keep estimating the ACTUAL printed row/line height rather than a
// now-stale, larger one (mirrors SalesInvoicePrintable.jsx's identical
// change).
const MM_PER_TEXT_LINE = 4.3;
const MM_PER_ITEM_ROW = 9.2;

/** How many wrapped lines a free-text field is likely to add beyond its
 * first line, given an assumed characters-per-line for the column it sits
 * in. Explicit newlines (Terms & Conditions renders with white-space:
 * pre-line) each count as their own line and can themselves wrap again. */
function extraWrappedLines(text, charsPerLine) {
  if (!text) return 0;
  const lines = String(text).split('\n').reduce(
    (sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)),
    0
  );
  return Math.max(0, lines - 1);
}

/** Extra item-row-equivalents to subtract from SINGLE_PAGE_MAX_ITEMS for
 * how much taller Remarks/Terms & Conditions are likely to render than the
 * one baseline line per field SINGLE_PAGE_MAX_ITEMS's own mm budget above
 * already assumes. */
function extraTextOverflowItems(remarksText, termsText) {
  const extraLines = extraWrappedLines(remarksText, REMARKS_CHARS_PER_LINE)
    + extraWrappedLines(termsText, TERMS_CHARS_PER_LINE);
  return Math.ceil((extraLines * MM_PER_TEXT_LINE) / MM_PER_ITEM_ROW);
}

/**
 * Split items into page-sized chunks. remarksText/termsText are the
 * document's own free-text Remarks and Terms & Conditions -- passed in so
 * an unusually long note in either can force a split even when the item
 * count alone would not (see extraTextOverflowItems above).
 *
 * A document short enough to fit the (text-adjusted) single-page budget
 * comes back as one page that is both isFirst and isLast.
 */
function paginateItems(items, remarksText, termsText) {
  const singlePageBudget = Math.max(
    0,
    SINGLE_PAGE_MAX_ITEMS - extraTextOverflowItems(remarksText, termsText)
  );
  if (items.length <= singlePageBudget) {
    return [{ items, isFirst: true, isLast: true }];
  }

  const pages = [{ items: items.slice(0, FIRST_PAGE_MAX_ITEMS), isFirst: true, isLast: false }];
  let rest = items.slice(FIRST_PAGE_MAX_ITEMS);
  while (rest.length > LAST_PAGE_MAX_ITEMS) {
    pages.push({ items: rest.slice(0, MID_PAGE_MAX_ITEMS), isFirst: false, isLast: false });
    rest = rest.slice(MID_PAGE_MAX_ITEMS);
  }
  // Always give the footer its own dedicated last page here, even when
  // rest is empty (a short item list that still didn't fit
  // singlePageBudget above, e.g. because of a long Remarks/Terms note --
  // "first page" would otherwise be the ONLY page and never actually
  // render the footer at all) and even when the loop above consumed every
  // remaining item exactly (rest.length === 0 after a full MID_PAGE_MAX_ITEMS
  // slice). Reusing that MID-sized page as the last page used to be this
  // function's guard against a "spurious near-blank extra page" -- but a
  // MID page is sized for up to MID_PAGE_MAX_ITEMS(18) items with NO
  // footer; stapling the full footer onto one already holding close to 18
  // items reproduces the exact same overflow this rewrite fixes, just at a
  // larger item count. An item-less (or few-item) continuation page with
  // the real footer content on it is a normal, correctly laid out last
  // page, not a bug.
  pages.push({ items: rest, isFirst: false, isLast: true });
  return pages;
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

function SalesQuotationPrintable({ order, company, customerRecord, supplierRecord, branchRecord, houseBank, approverSignatureUrl }) {
  const isActive = useIsActiveTab();
  if (!order || !isActive) return null;

  const items = order.items || [];
  // Legacy documents saved before customerState existed fall back to Place of Supply.
  const interState = isInterState(order.customerState || order.placeOfSupply, company?.state);
  const discPct = Number(order.discountPercent) || 0;
  const totals = computeTotals(items, discPct, interState, order);

  const companyName = (company?.companyName || 'Nexora KEMACH').toUpperCase();
  const companyAddrLine = joinAddressParts([company?.city, company?.state, company?.country, company?.pincode]);
  // The document's own Branch (order.branch, matched against Branch Master
  // by the host page) prints here instead of the company master's
  // head-office address -- see SalesOrderPrintable.jsx's identical
  // branchRecord treatment for the full reasoning. Falls back to the
  // company master address when no branch is selected or matched.
  const branchAddrLine1 = joinAddressParts([branchRecord?.address, branchRecord?.streetNo, branchRecord?.buildingFloorRoom, branchRecord?.block]);
  const branchAddrLine2 = joinAddressParts([branchRecord?.city, branchRecord?.state, branchRecord?.country, branchRecord?.zipCode]);
  const totalQty = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  const taxTotal = round2(totals.cgstAmount + totals.sgstAmount + totals.igstAmount);
  const taxRatePct = totals.taxableAmount > 0 && totals.totalTax > 0 ? (totals.totalTax / totals.taxableAmount) * 100 : 0;

  const billingAddr = cleanAddressText(order.billingAddress || customerRecord?.billingAddress);
  const shippingAddr = cleanAddressText(order.shippingAddress || customerRecord?.shippingAddress);
  const remarks = order.notes || order.remarks || '';

  const pages = paginateItems(items, remarks, order.termsConditions);
  const pageCount = pages.length;

  // Company block + billing/shipping + document-detail cards — page 1 only.
  const renderHeaderCards = () => (
    <>
      {/* Company block — same two-column shape SalesInvoicePrintable uses
          (company text | logos), just with no IRN row in the second column:
          a quotation carries no e-invoice IRN. */}
      <table className="sqp-grid sqp-head">
        <tbody>
          <tr>
            <td className="sqp-head-company">
              <div className="sqp-head-text">
                <div className="sqp-company-name">{companyName}</div>
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
            <td className="sqp-head-irn">
              <div className="sqp-head-logos">
                <img className="sqp-head-logo" src={kemachLogo} alt="KEMACH" />
                {/* Supplier's own logo — printed only when a Supplier is
                    picked on this quotation AND that Business Partner's own
                    Logo Visibility is Yes (see BusinessPartner.jsx). */}
                {order.supplier && supplierRecord?.logoVisible && supplierRecord?.logoUrl && (
                  <img className="sqp-head-supplier-logo" src={supplierRecord.logoUrl} alt={order.supplier} />
                )}
              </div>
              {/* IRN No — same placeholder-blank pattern SalesInvoicePrintable.jsx
                  uses: this application has no e-invoicing IRN column for a
                  quotation yet, so it prints as a labelled blank rather than
                  being left off the layout entirely. */}
              <div className="sqp-kv"><span className="k">IRN No. : </span><span className="v sqp-break">{order.irnNo || ''}</span></div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Billing / shipping addresses */}
      <table className="sqp-grid">
        <tbody>
          <tr>
            <td className="sqp-half">
              <div className="sqp-addr-title">Billing Address To :</div>
              {!order.billToCustomer && customerRecord?.customerCode && <div>Customer Code : {customerRecord.customerCode}</div>}
              <div className="sqp-party">
                {order.billToCustomer ? order.billToCustomer : (order.customer || '')}
              </div>
              {billingAddr && <div className="sqp-pre">{billingAddr}</div>}
              <div>GST Registration Number : {partyIds(order, customerRecord, 'Billing').gst}</div>
              <div>GST Registration Type : {partyIds(order, customerRecord, 'Billing').type}</div>
              <div>PAN Number : {partyIds(order, customerRecord, 'Billing').pan}</div>
            </td>
            <td className="sqp-half">
              <div className="sqp-addr-title">Shipping Address To :</div>
              {!order.shipToCustomer && customerRecord?.customerCode && <div>Customer Code : {customerRecord.customerCode}</div>}
              <div className="sqp-party">
                {order.shipToCustomer ? order.shipToCustomer : (order.customer || '')}
              </div>
              {shippingAddr && <div className="sqp-pre">{shippingAddr}</div>}
              <div>GST Registration Number : {partyIds(order, customerRecord, 'Shipping').gst}</div>
              <div>GST Registration Type : {partyIds(order, customerRecord, 'Shipping').type}</div>
              <div>PAN Number : {partyIds(order, customerRecord, 'Shipping').pan}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Document details */}
      <table className="sqp-grid">
        <tbody>
          <tr>
            <td className="sqp-half">
              <div className="sqp-kv"><span className="k">Quotation No</span><span className="c">:</span><span className="v">{order.quotationNo || ''}</span></div>
              <div className="sqp-kv"><span className="k">Quotation Date</span><span className="c">:</span><span className="v">{fmtDate(order.quotationDate)}</span></div>
              <div className="sqp-kv"><span className="k">Valid Till</span><span className="c">:</span><span className="v">{fmtDate(order.expiryDate)}</span></div>
              <div className="sqp-kv"><span className="k">Machine Serial No.</span><span className="c">:</span><span className="v">{order.machineSerialNo || ''}</span></div>
              <div className="sqp-kv"><span className="k">Hypothecation</span><span className="c">:</span><span className="v">{order.hypothecation || ''}</span></div>
            </td>
            <td className="sqp-half">
              <div className="sqp-kv"><span className="k">Price List</span><span className="c">:</span><span className="v">{order.priceList || ''}</span></div>
              <div className="sqp-kv"><span className="k">Currency</span><span className="c">:</span><span className="v">{order.currency || 'INR'}</span></div>
              <div className="sqp-kv"><span className="k">Sales Employee</span><span className="c">:</span><span className="v">{order.salesPerson || ''}</span></div>
              <div className="sqp-kv"><span className="k">Engine No.</span><span className="c">:</span><span className="v">{order.engineNo || ''}</span></div>
              <div className="sqp-kv"><span className="k">Customer PO No.</span><span className="c">:</span><span className="v">{order.customerRefNo || ''}</span></div>
            </td>
          </tr>
          <tr>
            <td className="sqp-half" colSpan={2}>
              <div className="sqp-kv"><span className="k">Remarks</span><span className="c">:</span><span className="v">{remarks}</span></div>
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );

  // Line items for one page. The table itself is the flex-grow element
  // (sqp-fill, see CSS) — its own last row is an empty spanning cell that
  // absorbs whatever vertical space is left on THIS page, so the item
  // grid's own ruled border runs all the way to the foot of every sheet,
  // not just a short one.
  const renderItemsTable = (pageItems, startIndex) => (
    <table className="sqp-grid sqp-items sqp-fill">
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
                <td className="sqp-taxcell">{components[0].label} {components[0].pct.toFixed(2)}%</td>
                <td className="num">{fmtNum(components[0].amt)}</td>
                <td className="num" rowSpan={components.length}>{fmtNum(f.total)}</td>
              </tr>
              {components.slice(1).map((c) => (
                <tr key={c.label}>
                  <td className="sqp-taxcell">{c.label} {c.pct.toFixed(2)}%</td>
                  <td className="num">{fmtNum(c.amt)}</td>
                </tr>
              ))}
            </React.Fragment>
          );
        })}
        <tr className="sqp-fill-row">
          <td className="sqp-fill-cell" colSpan={12} />
        </tr>
      </tbody>
    </table>
  );

  // Totals / HSN summary / bank details / declarations — last page only.
  const renderFooterContent = () => (
    <>
      {/* Totals */}
      <table className="sqp-grid">
        <tbody>
          <tr>
            <td className="sqp-qty-cell">Total Qty <b>{fmtQty(totalQty)}</b></td>
            <td className="sqp-total-label">Total</td>
            <td className="sqp-total-value">{fmtNum(totals.taxableAmount + taxTotal)}</td>
          </tr>
          <tr>
            <td rowSpan={4} className="sqp-words-cell">
              <div>Amount in Words. ({order.currency || 'INR'})</div>
              <div className="sqp-words">{amountToWords(totals.grandTotal) || ''}</div>
            </td>
            <td className="sqp-total-label">Freight charges</td>
            <td className="sqp-total-value">{fmtNum(totals.freightGrossAmount)}</td>
          </tr>
          <tr>
            <td className="sqp-total-label">Road tax</td>
            <td className="sqp-total-value">{fmtNum(totals.roadTax)}</td>
          </tr>
          <tr>
            <td className="sqp-total-label">Round off</td>
            <td className="sqp-total-value">{fmtNum(totals.roundOff)}</td>
          </tr>
          <tr>
            <td className="sqp-total-label"><b>Grand Total</b></td>
            <td className="sqp-total-value"><b>{fmtNum(totals.grandTotal)}</b></td>
          </tr>
        </tbody>
      </table>

      <table className="sqp-grid sqp-hsn">
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
            {totals.tcsAmount > 0 && <td className="num">1.00</td>}
            {totals.tcsAmount > 0 && <td className="num">{fmtNum(totals.tcsAmount)}</td>}
          </tr>
        </tbody>
      </table>

      <table className="sqp-grid">
        <tbody>
          <tr>
            <td>Tax Amount in Words. ({order.currency || 'INR'}) {amountToWords(taxTotal) || ''}</td>
          </tr>
        </tbody>
      </table>

      {/* Bank details — from the House Bank master */}
      <table className="sqp-grid">
        <tbody>
          <tr>
            <td colSpan={2} className="sqp-bank-title">Company&apos;s Bank Details :</td>
          </tr>
          <tr>
            <td className="sqp-bank-details">
              <div className="sqp-kv"><span className="k">Beneficiary Name</span><span className="c">:</span><span className="v">{houseBank?.accountName || company?.companyName || ''}</span></div>
              <div className="sqp-kv"><span className="k">Bank Name</span><span className="c">:</span><span className="v">{houseBank?.bankName || ''}</span></div>
              <div className="sqp-kv"><span className="k">Branch</span><span className="c">:</span><span className="v">{houseBank?.branchName || ''}</span></div>
              <div className="sqp-kv"><span className="k">A/c No.</span><span className="c">:</span><span className="v">{houseBank?.accountNumber || ''}</span></div>
              <div className="sqp-kv"><span className="k">RTGS/IFSC Code</span><span className="c">:</span><span className="v">{houseBank?.ifscCode || ''}</span></div>
              <div className="sqp-kv"><span className="k">Type</span><span className="c">:</span><span className="v">{houseBank?.accountType || ''}</span></div>
            </td>
            <td className="sqp-bank-qr-cell">
              {houseBank?.qrCodeUrl && (
                <img className="sqp-bank-qr" src={houseBank.qrCodeUrl} alt="Bank QR code" />
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Declarations + signature */}
      <table className="sqp-grid sqp-foot">
        <tbody>
          <tr>
            <td className="sqp-foot-left">Prices are subject to revision without any notice. Validity : {order.validityDays || 30} days from the date of issue.</td>
            <td className="sqp-foot-right">For {companyName}</td>
          </tr>
          <tr>
            <td className="sqp-foot-left">
              {order.termsConditions
                ? <div className="sqp-pre">{order.termsConditions}</div>
                : (
                  <>
                    <div>All agreements contingent upon strikes, accidents and other conditions beyond our control.</div>
                    <div>All contracts are subject to approval by an office of the Company.</div>
                  </>
                )}
            </td>
            <td className="sqp-foot-right sqp-sign">
              {approverSignatureUrl ? <img className="sqp-sign-img" src={approverSignatureUrl} alt="" style={order.salesCategory === 'Machine' ? { height: '96px', maxWidth: '70mm' } : undefined} /> : null}
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
  // comment above renderPage's caller for why this replaced the CSS-only
  // position: fixed approach).
  const renderPage = (page, pageIndex, startIndex) => (
    <div className="sqp-sheet" key={pageIndex}>
      <div className="sqp-page">
        <LetterheadHeader company={company} />
        <LetterheadWatermark />

        {page.isFirst && (
          <div className="sqp-copy-title">
            <span className="sqp-doc-title">SALES QUOTATION</span>
          </div>
        )}

        {page.isFirst && renderHeaderCards()}

        {renderItemsTable(page.items, startIndex)}

        {page.isLast && renderFooterContent()}

        <div className="sqp-pagefoot">
          <span>{company?.phone ? `Ph No : ${company.phone}` : ''}</span>
          <span>{company?.email ? `Email Id : ${company.email}` : ''}</span>
          <span>Page {pageIndex + 1} of {pageCount}</span>
        </div>

        <LetterheadFooter company={company} />
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

  return createPortal(
    <div className="sqp-print-area">
      <style>{`
        ${letterheadStyles('.sqp-page', RULE_SPACING)}
        .sqp-print-area { display: none; }
        @media print {
          /* .sqp-print-area is portaled straight onto <body> (see the
             createPortal call below) — a DIRECT SIBLING of #root, not
             nested inside it. That is what makes this rule safe: hiding
             #root removes the entire rest of the app (sidebar, data table,
             open dialogs) from layout ENTIRELY (display: none, not merely
             invisible), so none of it can contribute stray height for the
             print engine to paginate against, and nothing needs to be
             clamped or clipped to "exactly one viewport" any more. A
             quotation with enough items to run past one page now simply
             flows onto additional physical pages instead of being clipped.
          */
          body.${PRINTING_CLASS} #root { display: none !important; }
          body.${PRINTING_CLASS} .sqp-print-area {
            display: block; width: 100%; box-sizing: border-box;
          }
          body.${PRINTING_CLASS} .sqp-print-area,
          body.${PRINTING_CLASS} .sqp-print-area * {
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
             explicit .sqp-sheet blocks, each with its own header/footer in
             normal flow, rather than relying on any @page-margin/fixed-
             position trick at all. */
          @page { size: 210mm 297mm; margin: 0; }
          .sqp-sheet { page-break-after: always; }
          .sqp-sheet:last-child { page-break-after: auto; }
        }
        /* min-height: 100vh, NOT a fixed height — a short page (few items)
           still fills exactly one visual page, since the item table below
           (.sqp-fill, flex: 1 1 0) stretches into whatever slack is left,
           pinning that page's own footer content to the bottom of its own
           sheet. A page with enough items to exceed one page's worth of
           content is no longer forced to shrink into that same fixed box —
           the sheet grows taller than 100vh instead, and the browser's own
           print pagination (the page-break-after rule above) carries the
           overflow onto the NEXT explicit .sqp-sheet page block rather than
           clipping or overlapping it. NOT a hardcoded ${PAGE_HEIGHT_MM}mm
           either — see the note on PAGE_HEIGHT_MM above. The
           ${PAGE_MARGIN_MM}mm inset is this element's own padding, not an
           @page margin, so it's set in exactly one place and no print
           engine can add a second one on top. */
        .sqp-sheet {
          min-height: 100vh;
          box-sizing: border-box;
          padding: ${PAGE_MARGIN_MM}mm;
        }
        .sqp-page {
          display: flex; flex-direction: column;
          /* min-height: calc(...), NOT height: 100%/min-height: 100% —
             .sqp-sheet above no longer has a DEFINITE height of its own (it
             is min-height: 100vh with no height set, so it can grow with
             content), and a percentage height on a child needs a definite
             height on the parent to resolve against; against an
             indefinite/auto parent height, height: 100% computes to auto
             instead (CSS2.1 10.5). That silently collapsed this flex
             column to its own content's natural height — far short of a
             full page — which pulled .lh-footer (position: absolute;
             bottom: 0 against THIS element) up to sit right under a short
             item table instead of at the true bottom of the sheet.
             .sqp-sheet's own ${PAGE_MARGIN_MM}mm padding (both top and
             bottom) sits OUTSIDE this element, so this element's floor has
             to be 100vh minus that padding, not 100vh itself — otherwise
             this box plus the sheet's padding would together exceed one
             physical page and push part of the footer onto a second page
             even for a short, single-page document. */
          min-height: calc(100vh - ${PAGE_MARGIN_MM * 2}mm);
          box-sizing: border-box;
          padding-top: ${LETTERHEAD_TOP_MM}mm;
          padding-bottom: ${LETTERHEAD_BOTTOM_MM}mm;
        }
        table.sqp-items.sqp-fill { flex: 1 1 0; min-height: 0; }
        .sqp-fill-row, .sqp-fill-cell { height: 100%; }
        .sqp-print-area { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 11.5px; }
        .sqp-copy-title { text-align: center; font-weight: 700; font-size: 16px; margin-bottom: 3px; }

        /* Cell padding trimmed from the original 3px/side to 2px/side, and
           .sqp-kv/.sqp-pre/.sqp-foot-left line-heights trimmed from 1.45 to
           1.3/1.35 below (plus the oversized 64px signature image cut to
           40px) -- real, provable height reductions across every stacked
           .sqp-grid table on the page (roughly 16 table rows on a typical
           single-page quotation), not a guess at a single magic number.
           This -- together with removing Place of Supply/Reference No/
           Enquiry No from the document-detail card -- is what actually
           shrinks the page's real content height; see the pagination
           comment above paginateItems for why a single overflowing
           .sqp-sheet is what pushed the letterhead footer onto its own
           near-blank second page even for a 1-item quotation. */
        table.sqp-grid { width: 100%; border-collapse: collapse; table-layout: fixed; flex-shrink: 0; }
        table.sqp-grid td, table.sqp-grid th {
          border: ${GRID_BORDER_PX}px solid #000; padding: 1px 4px; vertical-align: top;
        }
        table.sqp-grid + table.sqp-grid { margin-top: -${GRID_BORDER_PX}px; }
        .sqp-half { width: 50%; }
        .num { text-align: right; }

        .sqp-company-name { font-weight: 700; font-size: 12.5px; margin-bottom: 1px; }
        /* Company text has the left column to itself, same as
           SalesInvoicePrintable's sinv-head-company. */
        .sqp-head-company { width: 62%; }
        /* KEMACH + Supplier logos side by side, left-aligned in the second
           column — same technique as sinv-head-logos, no IRN row beneath
           since a quotation carries none. */
        .sqp-head-logos {
          display: flex; align-items: center; justify-content: flex-start;
          gap: 3mm; padding-left: 5mm;
        }
        .sqp-head-logo {
          width: 40mm; height: auto;
          /* Sharpen on the way down instead of the browser's default soft
              smoothing — the source asset is high-resolution (2962x812), so
              this is what keeps it crisp at print size rather than blurred. */
          image-rendering: -webkit-optimize-contrast;
          -webkit-print-color-adjust: exact; print-color-adjust: exact;
        }
        .sqp-head-supplier-logo {
          width: 25mm; height: auto; object-fit: contain;
          image-rendering: -webkit-optimize-contrast;
          -webkit-print-color-adjust: exact; print-color-adjust: exact;
        }
        .sqp-head-irn { width: 38%; }
        .sqp-break { word-break: break-all; }

        .sqp-kv { display: flex; gap: 4px; line-height: 1.2; }
        .sqp-kv .k { flex: 0 0 42%; }
        .sqp-kv .c { flex: 0 0 4px; }
        .sqp-kv .v { flex: 1; font-weight: 600; }

        .sqp-addr-title { font-weight: 400; margin-bottom: 2px; }
        .sqp-party { font-weight: 400; }
        .sqp-pre { white-space: pre-line; line-height: 1.25; }

        table.sqp-items th { font-weight: 700; text-align: center; font-size: 10px; }
        table.sqp-items td { font-size: 10px; }
        table.sqp-items td.num { font-size: 8.5px; white-space: nowrap; }
        table.sqp-items .w-sn { width: 3.5%; }
        table.sqp-items .w-code { width: 9%; }
        table.sqp-items .w-desc { width: 22%; }
        table.sqp-items .w-hsn { width: 7%; }
        table.sqp-items .w-um { width: 5%; }
        table.sqp-items .w-qty { width: 5%; }
        table.sqp-items .w-price { width: 8.5%; }
        table.sqp-items .w-disc { width: 5.5%; }
        table.sqp-items .w-ass { width: 9%; }
        table.sqp-items .w-tax { width: 9.5%; }
        table.sqp-items .w-taxamt { width: 8%; }
        table.sqp-items .w-amt { width: 8%; }
        .sqp-taxcell { white-space: nowrap; }

        .sqp-qty-cell { width: 62%; }
        .sqp-total-label { width: 22%; }
        .sqp-total-value { width: 16%; text-align: right; }
        .sqp-words-cell { vertical-align: top; }
        .sqp-words { font-weight: 600; text-transform: uppercase; }

        table.sqp-hsn th, table.sqp-hsn td { font-size: 10px; }
        table.sqp-hsn th { font-weight: 700; }

        .sqp-bank-title { font-weight: 700; border-bottom: none; }
        .sqp-bank-details { width: 70%; }
        .sqp-bank-qr-cell { width: 30%; text-align: center; vertical-align: middle; }
        .sqp-bank-qr { width: 22mm; height: 22mm; object-fit: contain; image-rendering: pixelated; }

        table.sqp-foot .sqp-foot-left { width: 62%; line-height: 1.3; }
        table.sqp-foot .sqp-foot-right { width: 38%; text-align: right; }
        table.sqp-foot .sqp-sign { height: 40px; vertical-align: bottom; }
        /* max-width caps a wide signature image (SalesOrder/SalesInvoice
           draw approverSignatureUrl -- an uploaded image of whatever aspect
           ratio the user supplied, not a fixed stationery asset) so a wide
           source can never overflow the .sqp-foot-right column and throw
           the footer's two columns out of alignment with each other -- the
           same containment PurchaseOrderPrintable.jsx's own .po3-sign-mark
           already applies (width: 30mm there) to its own signature image. */
        .sqp-sign-img { display: block; margin: 0 6mm 2px auto; height: 40px; max-width: 40mm; width: auto; object-fit: contain; }

        .sqp-pagefoot { display: flex; justify-content: space-between; padding: 3px 2px 0; font-size: 9.5px; }
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
// identify it as SalesQuotationPrintable.
export default React.memo(SalesQuotationPrintable);
