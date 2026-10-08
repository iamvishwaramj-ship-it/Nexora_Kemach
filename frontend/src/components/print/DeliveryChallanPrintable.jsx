import React from 'react';
import { joinAddressParts, cleanAddressText } from '../../lib/addressFormat';
import { createPortal } from 'react-dom';
import dayjs from 'dayjs';
import { amountToWords } from '../../lib/numberToWords';
import { buildDocument, round2, isInterState, isTcsTaxType } from '../../lib/documentTotals';
import kemachLogo from '../../../assets/kemach.png';
import {
  LetterheadHeader, LetterheadWatermark, LetterheadFooter, letterheadStyles,
  LETTERHEAD_TOP_MM, LETTERHEAD_BOTTOM_MM,
} from './Letterhead';
import { useIsActiveTab } from '../navigation/TabPathContext';
import { makeScopedPrint, makeScopedCapture } from './purchaseStationery';

const PRINTING_CLASS = 'dcp-printing';
const PAGE_RULE_ID = 'dcp-print-page-rule';

export const printDeliveryChallan = makeScopedPrint({ printingClass: PRINTING_CLASS, pageRuleId: PAGE_RULE_ID });
export const captureDeliveryChallanPdf = makeScopedCapture({ printingClass: PRINTING_CLASS, pageRuleId: PAGE_RULE_ID, sheetSelector: '.dcp-sheet', areaSelector: '.dcp-print-area' });

// The exact template SalesInvoicePrintable.jsx uses — same letterhead
// branding, same ruled-grid-of-tables technique, same ITEM tax-row rowSpan
// trick, same totals/HSN-summary shape, same full-page-coverage flex fill,
// and prints a single copy — no ORIGINAL/DUPLICATE/TRIPLICATE heading and no
// repeated sheets — with this document's own nominal fields substituted for
// the invoice's (Challan
// No/Date in place of Invoice No/Date, no e-invoice IRN block, no discount/
// currency header fields since a Delivery Challan carries neither). See
// SalesInvoicePrintable.jsx for the extended reasoning behind each technique;
// the comments here only call out where this document differs.

// One weight for every rule on the sheet.
const GRID_BORDER_PX = 1;

// A4 portrait (210mm x 297mm). The sheet itself is NOT sized with this
// constant any more — see .dcp-sheet below, which uses min-height: 100vh
// instead of a hardcoded mm value, matching SalesQuotationPrintable.jsx's own
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
// — matches Purchase Order's 6mm exactly (see .dcp-sheet) so both documents
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
// printed figures always match what was saved. A Delivery Challan carries no
// header discount (see DeliveryChallan.jsx's own emptyItem — no discount
// column on the item rows either), so discPct is always 0 here; kept as a
// variable rather than a literal so this stays a straight copy of the
// invoice's own computation shape.
function computeTotals(items, discountPercent, interState = false, extraCharges = {}) {
  const { totals } = buildDocument(items, discountPercent, { interState, roundOff: true });
  // No visible Road Tax line on this printable (same as the on-screen form
  // -- see DeliveryChallan.jsx's own computeTotals) -- only ever nonzero as
  // a Copy From/To carry-through, folded straight into the printed Grand
  // Total so it matches what the form (and what got saved) shows.
  const roadTax = extraCharges.roadTaxApplicable ? round2(Number(extraCharges.roadTax) || 0) : 0;
  const amountWithRoadTax = Math.round(round2(totals.amount + roadTax));
  return {
    ...totals,
    discount: round2(totals.subtotal - totals.taxableAmount),
    grandTotal: amountWithRoadTax,
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
// This is the robust alternative — the same one SalesQuotationPrintable.jsx
// uses: build the document as several explicit, self-contained .dcp-sheet
// page blocks (see renderPage/renderAllPages below), each one carrying its
// OWN complete LetterheadHeader/Watermark/Footer in normal document flow —
// no position:fixed and no @page margin involved at all. The already-proven
// page-break-after: always rule (see the @media print block below) is what
// turns each block into its own physical page; nothing about that rule
// changes here.
//
// This also replaces the old "clamp html/body to exactly one viewport with
// overflow: hidden" trick this file used to isolate its printed content from
// the rest of the app's (invisible but still laid-out) screen — that clamp
// is exactly why the old single .dcp-sheet was limited to one page's worth
// of content: an overflow: hidden ancestor at 100vh would have clipped any
// additional page grown past it. The portal below (and hiding #root
// entirely rather than merely making it invisible) removes the rest of the
// app from layout altogether, so there is no leftover height to clamp and no
// ceiling on how many .dcp-sheet pages this document can grow to.
//
// Item counts per page are a fixed estimate, not a live measurement — this
// environment has no way to render the page and see exactly where text
// wraps. The constants below are deliberately conservative (biased toward
// splitting one extra page rather than risking an overflow that reproduces
// the original clipping/overlap bug), and are the one place to retune if a
// real print/PDF comes back with a page ending noticeably early. Modelled on
// SalesQuotationPrintable.jsx's own constants (8/18/8) — this document's
// header cards are the same three tables (company, billing/shipping,
// document detail), so FIRST_PAGE_MAX_ITEMS and MID_PAGE_MAX_ITEMS carry
// over unchanged; its footer (totals/HSN/bank/declarations) is very slightly
// lighter — one fewer totals row (no Road Tax/Freight-split line a
// quotation carries) — so LAST_PAGE_MAX_ITEMS is nudged up by one rather
// than left equal, kept modest since the two footers are close in weight.
// FIRST_PAGE_MAX_ITEMS nudged down from 8 to 7: the document-detail card's
// right-hand column gained a "Customer PO No." row (below Engine No.), one
// line taller than when this budget was first calibrated. Left uncorrected,
// an 8-item document that used to fit page 1 exactly now overflows past the
// physical page edge -- since page 1's own .dcp-sheet has no page-break of
// its own mid-content, that overflow spills onto a second, blank page
// carrying nothing but the orphaned footer (no repeating header, since only
// page.isFirst renders the header cards). MID_PAGE_MAX_ITEMS/
// LAST_PAGE_MAX_ITEMS are untouched -- neither continuation nor last pages
// render the header cards, so this row never affects their budget.
// Raised a notch (7/18/9 -> 8/19/10) to match the real font-size/
// line-height shrink applied to .dcp-print-area and the items/HSN
// tables below -- the identical recalibration made to
// SalesInvoicePrintable.jsx (mm-budget version of this same fix) after
// a real invoice with more items was still pushing its footer onto a
// spurious extra page.
//
// FIRST_PAGE_MAX_ITEMS nudged back down from 8 to 7: the document-detail
// card's LEFT-hand column gained two more rows below Hypothecation --
// "Type of DC" (always) and "BOB Link No." (Warranty documents only).
// The card's total height is governed by whichever column has more
// rows; the right column still tops out at 7 (through Customer PO No.),
// so a non-Warranty document's left column (now 7 rows) does not grow
// the card at all, but a Warranty document's left column (8 rows) is
// one row taller than either column has ever been before. Budgeting for
// that worst case the same way the earlier "Customer PO No." row was
// budgeted for -- see the comment above -- keeps a Warranty challan's
// footer from spilling onto a spurious extra page the way a plain
// "footer is going to next page" report showed it doing.
const FIRST_PAGE_MAX_ITEMS = 7; // page 1 also carries the company/billing/document-detail cards
const MID_PAGE_MAX_ITEMS = 15;  // a continuation page with nothing but the item grid
const LAST_PAGE_MAX_ITEMS = 9;  // the last page also carries totals/HSN/bank/declarations

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

function DeliveryChallanPrintable({ order, company, customerRecord, supplierRecord, salesOrderRecord, branchRecord, houseBank, approverSignatureUrl }) {
  const isActiveTab = useIsActiveTab();
  if (!isActiveTab || !order) return null;

  const items = order.items || [];
  // Legacy documents saved before customerState existed fall back to Place of Supply.
  const interState = isInterState(order.customerState || order.placeOfSupply, company?.state);
  const discPct = Number(order.discountPercent) || 0;
  const totals = computeTotals(items, discPct, interState, { roadTax: order.roadTax, roadTaxApplicable: order.roadTaxApplicable });

  const companyName = (company?.companyName || 'Nexora KEMACH').toUpperCase();
  const companyAddrLine = joinAddressParts([company?.city, company?.state, company?.country, company?.pincode]);
  // The document's own Branch, resolved against Branch Master by the host
  // page — see SalesOrderPrintable.jsx's identical branchRecord treatment for
  // the full reasoning. Falls back to the company master address below when
  // no branch is selected or matched.
  const branchAddrLine1 = joinAddressParts([branchRecord?.address, branchRecord?.streetNo, branchRecord?.buildingFloorRoom, branchRecord?.block]);
  const branchAddrLine2 = joinAddressParts([branchRecord?.city, branchRecord?.state, branchRecord?.country, branchRecord?.zipCode]);
  const totalQty = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  const taxTotal = round2(totals.cgstAmount + totals.sgstAmount + totals.igstAmount);
  const taxRatePct = totals.taxableAmount > 0 && totals.totalTax > 0 ? (totals.totalTax / totals.taxableAmount) * 100 : 0;

  const billingAddr = cleanAddressText(order.billingAddress || customerRecord?.billingAddress);
  const shippingAddr = cleanAddressText(order.shippingAddress || customerRecord?.shippingAddress);
  const remarks = order.remarks || '';

  const pages = paginateItems(items);
  const pageCount = pages.length;

  // Company block + billing/shipping + document-detail cards — page 1 only.
  const renderHeaderCards = () => (
    <>
      {/* Company block — same two-column shape SalesInvoicePrintable uses
          (company text | logos), just with no IRN row in the second column:
          a delivery challan carries no e-invoice IRN. */}
      <table className="dcp-grid dcp-head">
        <tbody>
          <tr>
            <td className="dcp-head-company">
              <div className="dcp-head-text">
                <div className="dcp-company-name">{companyName}</div>
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
            <td className="dcp-head-irn">
              <div className="dcp-head-logos">
                <img className="dcp-head-logo" src={kemachLogo} alt="KEMACH" />
                {/* Supplier's own logo — printed only when a Supplier is
                    picked on this challan AND that Business Partner's own
                    Logo Visibility is Yes (see BusinessPartner.jsx). */}
                {order.supplier && supplierRecord?.logoVisible && supplierRecord?.logoUrl && (
                  <img className="dcp-head-supplier-logo" src={supplierRecord.logoUrl} alt={order.supplier} />
                )}
              </div>
              {/* IRN No — same placeholder-blank pattern SalesInvoicePrintable.jsx
                  uses: this application has no e-invoicing IRN column for a
                  delivery challan yet, so it prints as a labelled blank rather
                  than being left off the layout entirely. */}
              <div className="dcp-kv"><span className="k">IRN No. : </span><span className="v dcp-break">{order.irnNo || ''}</span></div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Billing / shipping addresses */}
      <table className="dcp-grid">
        <tbody>
          <tr>
            <td className="dcp-half">
              <div className="dcp-addr-title">Billing Address To :</div>
              {!order.billToCustomer && customerRecord?.customerCode && <div>Customer Code : {customerRecord.customerCode}</div>}
              <div className="dcp-party">
                {order.billToCustomer ? order.billToCustomer : (order.customer || '')}
              </div>
              {billingAddr && <div className="dcp-pre">{billingAddr}</div>}
              <div>GST Registration Number : {partyIds(order, customerRecord, 'Billing').gst}</div>
              <div>GST Registration Type : {partyIds(order, customerRecord, 'Billing').type}</div>
              <div>PAN Number : {partyIds(order, customerRecord, 'Billing').pan}</div>
            </td>
            <td className="dcp-half">
              <div className="dcp-addr-title">Shipping Address To :</div>
              {!order.shipToCustomer && customerRecord?.customerCode && <div>Customer Code : {customerRecord.customerCode}</div>}
              <div className="dcp-party">
                {order.shipToCustomer ? order.shipToCustomer : (order.customer || '')}
              </div>
              {shippingAddr && <div className="dcp-pre">{shippingAddr}</div>}
              <div>GST Registration Number : {partyIds(order, customerRecord, 'Shipping').gst}</div>
              <div>GST Registration Type : {partyIds(order, customerRecord, 'Shipping').type}</div>
              <div>PAN Number : {partyIds(order, customerRecord, 'Shipping').pan}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Document details */}
      <table className="dcp-grid">
        <tbody>
          <tr>
            <td className="dcp-half">
              <div className="dcp-kv"><span className="k">Challan No</span><span className="c">:</span><span className="v">{order.challanNo || ''}</span></div>
              <div className="dcp-kv"><span className="k">Challan Date</span><span className="c">:</span><span className="v">{fmtDate(order.challanDate)}</span></div>
              <div className="dcp-kv"><span className="k">Delivery Date</span><span className="c">:</span><span className="v">{fmtDate(order.deliveryDate)}</span></div>
              <div className="dcp-kv"><span className="k">Machine Serial No.</span><span className="c">:</span><span className="v">{order.machineSerialNo || ''}</span></div>   
              <div className="dcp-kv"><span className="k">Type of DC</span><span className="c">:</span><span className="v">{order.typeOfDc || ''}</span></div>
              {/* Mirrors the form's own rule (see DeliveryChallan.jsx's
              typeOfDcValue effect, which blanks bobLinkNo the moment Type
              of DC leaves 'Warranty') -- printed only for a Warranty DC,
              never as an empty row otherwise. */}
              {order.typeOfDc === 'Warranty' && (
                <div className="dcp-kv"><span className="k">BOB Link No.</span><span className="c">:</span><span className="v">{order.bobLinkNo || ''}</span></div>
              )}
            </td>
            <td className="dcp-half">
              <div className="dcp-kv"><span className="k">Ship Via</span><span className="c">:</span><span className="v">{order.shipVia || order.transportMode || ''}</span></div>
              <div className="dcp-kv"><span className="k">Sales Employee</span><span className="c">:</span><span className="v">{order.salesPerson || ''}</span></div>
              <div className="dcp-kv"><span className="k">Engine No.</span><span className="c">:</span><span className="v">{order.engineNo || ''}</span></div>
              <div className="dcp-kv"><span className="k">Hypothecation</span><span className="c">:</span><span className="v">{order.hypothecation || ''}</span></div>
              <div className="dcp-kv"><span className="k">Customer PO No.</span><span className="c">:</span><span className="v">{order.customerRefNo || ''}</span></div>
            </td>
          </tr>
          <tr>
            <td className="dcp-half" colSpan={2}>
              <div className="dcp-kv"><span className="k">Remarks</span><span className="c">:</span><span className="v">{remarks}</span></div>
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );

  // Line items for one page. The table itself is the flex-grow element
  // (dcp-fill, see CSS) — its own last row is an empty spanning cell that
  // absorbs whatever vertical space is left on THIS page, so the item
  // grid's own ruled border runs all the way to the foot of every sheet,
  // not just a short one.
  const renderItemsTable = (pageItems, startIndex) => (
    <table className="dcp-grid dcp-items dcp-fill">
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
          // so a mixed-cart document makes clear which line actually
          // triggered TCS instead of only surfacing it in the document
          // totals further down the page.
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
                <td className="dcp-taxcell">{components[0].label} {components[0].pct.toFixed(2)}%</td>
                <td className="num">{fmtNum(components[0].amt)}</td>
                <td className="num" rowSpan={components.length}>{fmtNum(f.total)}</td>
              </tr>
              {components.slice(1).map((c) => (
                <tr key={c.label}>
                  <td className="dcp-taxcell">{c.label} {c.pct.toFixed(2)}%</td>
                  <td className="num">{fmtNum(c.amt)}</td>
                </tr>
              ))}
            </React.Fragment>
          );
        })}
        <tr className="dcp-fill-row">
          <td className="dcp-fill-cell" colSpan={12} />
        </tr>
      </tbody>
    </table>
  );

  // Totals / HSN summary / bank details / declarations — last page only.
  const renderFooterContent = () => (
    <>
      {/* Totals */}
      <table className="dcp-grid">
        <tbody>
          <tr>
            <td className="dcp-qty-cell">Total Qty <b>{fmtQty(totalQty)}</b></td>
            <td className="dcp-total-label">Total</td>
            <td className="dcp-total-value">{fmtNum(totals.taxableAmount + taxTotal)}</td>
          </tr>
          <tr>
            <td rowSpan={3} className="dcp-words-cell">
              <div>Amount in Words. ({order.currency || 'INR'})</div>
              <div className="dcp-words">{amountToWords(totals.grandTotal) || ''}</div>
            </td>
            <td className="dcp-total-label">Freight charges</td>
            <td className="dcp-total-value">{fmtNum(order.freightCharges || 0)}</td>
          </tr>
          <tr>
            <td className="dcp-total-label">Round off</td>
            <td className="dcp-total-value">{fmtNum(totals.roundOff)}</td>
          </tr>
          <tr>
            <td className="dcp-total-label"><b>Grand Total</b></td>
            <td className="dcp-total-value"><b>{fmtNum(totals.grandTotal)}</b></td>
          </tr>
        </tbody>
      </table>

      <table className="dcp-grid dcp-hsn">
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

      <table className="dcp-grid">
        <tbody>
          <tr>
            <td>Tax Amount in Words. ({order.currency || 'INR'}) {amountToWords(taxTotal) || ''}</td>
          </tr>
        </tbody>
      </table>

      {/* Bank details — from the House Bank master */}
      <table className="dcp-grid">
        <tbody>
          <tr>
            <td colSpan={2} className="dcp-bank-title">Company&apos;s Bank Details :</td>
          </tr>
          <tr>
            <td className="dcp-bank-details">
              <div className="dcp-kv"><span className="k">Beneficiary Name</span><span className="c">:</span><span className="v">{houseBank?.accountName || company?.companyName || ''}</span></div>
              <div className="dcp-kv"><span className="k">Bank Name</span><span className="c">:</span><span className="v">{houseBank?.bankName || ''}</span></div>
              <div className="dcp-kv"><span className="k">Branch</span><span className="c">:</span><span className="v">{houseBank?.branchName || ''}</span></div>
              <div className="dcp-kv"><span className="k">A/c No.</span><span className="c">:</span><span className="v">{houseBank?.accountNumber || ''}</span></div>
              <div className="dcp-kv"><span className="k">RTGS/IFSC Code</span><span className="c">:</span><span className="v">{houseBank?.ifscCode || ''}</span></div>
              <div className="dcp-kv"><span className="k">Type</span><span className="c">:</span><span className="v">{houseBank?.accountType || ''}</span></div>
            </td>
            <td className="dcp-bank-qr-cell">
              {houseBank?.qrCodeUrl && (
                <img className="dcp-bank-qr" src={houseBank.qrCodeUrl} alt="Bank QR code" />
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Declarations + signature */}
      <table className="dcp-grid dcp-foot">
        <tbody>
          <tr>
            <td className="dcp-foot-left">Goods once delivered are received in good condition against this challan</td>
            <td className="dcp-foot-right">For {companyName}</td>
          </tr>
          <tr>
            <td className="dcp-foot-left">
              {order.termsConditions
                ? <div className="dcp-pre">{order.termsConditions}</div>
                : (
                  <>
                    <div>All agreements contingent upon strikes, accidents and other conditions beyond our control.</div>
                    <div>All contracts are subject to approval by an office of the Company.</div>
                  </>
                )}
            </td>
            <td className="dcp-foot-right dcp-sign">
              {approverSignatureUrl ? <img className="dcp-sign-img" src={approverSignatureUrl} alt="" style={order.salesCategory === 'Machine' ? { height: '96px', maxWidth: '70mm' } : undefined} /> : null}
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
  // comment above paginateItems for why this replaced both the CSS-only
  // position: fixed approach and the old single-sheet-clamped-to-100vh
  // approach).
  const renderPage = (page, pageIndex, startIndex) => (
    <div className="dcp-sheet" key={pageIndex}>
      <div className="dcp-page">
        <LetterheadHeader company={company} />
        <LetterheadWatermark />

        {page.isFirst && (
          <div className="dcp-copy-title">
            <span className="dcp-doc-title">DELIVERY CHALLAN</span>
          </div>
        )}

        {page.isFirst && renderHeaderCards()}

        {renderItemsTable(page.items, startIndex)}

        {page.isLast && renderFooterContent()}

        <div className="dcp-pagefoot">
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
    <div className="dcp-print-area">
      <style>{`
        ${letterheadStyles('.dcp-page', RULE_SPACING)}
        .dcp-print-area { display: none; }
        @media print {
          /* .dcp-print-area is portaled straight onto <body> (see the
             createPortal call below) — a DIRECT SIBLING of #root, not
             nested inside it. That is what makes this rule safe: hiding
             #root removes the entire rest of the app (sidebar, data table,
             open dialogs) from layout ENTIRELY (display: none, not merely
             invisible), so none of it can contribute stray height for the
             print engine to paginate against, and nothing needs to be
             clamped or clipped to "exactly one viewport" any more. This
             replaces the old visibility:hidden + clamp-html/body-to-100vh-
             with-overflow:hidden trick that used to isolate this document's
             printed area from the rest of the (invisible but still laid
             out) app screen — that clamp had a hard ceiling of one page's
             worth of content, since anything grown past 100vh inside an
             overflow: hidden ancestor would simply be clipped. A challan
             with enough items to run past one page now simply flows onto
             additional physical pages instead of being clipped or
             overlapping the rest of the app. */
          body.${PRINTING_CLASS} #root { display: none !important; }
          body.${PRINTING_CLASS} .dcp-print-area {
            display: block; width: 100%; box-sizing: border-box;
          }
          body.${PRINTING_CLASS} .dcp-print-area,
          body.${PRINTING_CLASS} .dcp-print-area * {
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
             explicit .dcp-sheet blocks, each with its own header/footer in
             normal flow, rather than relying on any @page-margin/fixed-
             position trick at all. */
          @page { size: 210mm 297mm; margin: 0; }
          .dcp-sheet { page-break-after: always; }
          .dcp-sheet:last-child { page-break-after: auto; }
        }
        /* min-height: 100vh, NOT a fixed height — a short page (few items)
           still fills exactly one visual page, since the item table below
           (.dcp-fill, flex: 1 1 0) stretches into whatever slack is left,
           pinning that page's own footer content to the bottom of its own
           sheet. A page with enough items to exceed one page's worth of
           content is no longer forced to shrink into that same fixed box —
           the sheet grows taller than 100vh instead, and the browser's own
           print pagination (the page-break-after rule above) carries the
           overflow onto the NEXT explicit .dcp-sheet page block rather than
           clipping or overlapping it. NOT a hardcoded ${PAGE_HEIGHT_MM}mm
           either — see the note on PAGE_HEIGHT_MM above. The
           ${PAGE_MARGIN_MM}mm inset is this element's own padding, not an
           @page margin, so it's set in exactly one place and no print
           engine can add a second one on top. */
        .dcp-sheet {
          min-height: 100vh;
          box-sizing: border-box;
          padding: ${PAGE_MARGIN_MM}mm;
        }
        .dcp-page {
          display: flex; flex-direction: column;
          /* min-height: calc(...), NOT height: 100%/min-height: 100% —
             .dcp-sheet above no longer has a DEFINITE height of its own (it
             is min-height: 100vh with no height set, so it can grow with
             content), and a percentage height on a child needs a definite
             height on the parent to resolve against; against an
             indefinite/auto parent height, height: 100% computes to auto
             instead (CSS2.1 10.5). That silently collapsed this flex
             column to its own content's natural height — far short of a
             full page — which pulled .lh-footer (position: absolute;
             bottom: 0 against THIS element) up to sit right under a short
             item table instead of at the true bottom of the sheet.
             .dcp-sheet's own ${PAGE_MARGIN_MM}mm padding (both top and
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
        table.dcp-items.dcp-fill { flex: 1 1 0; min-height: 0; }
        .dcp-fill-row, .dcp-fill-cell { height: 100%; }
        .dcp-print-area { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 11.5px; }
        .dcp-copy-title { text-align: center; font-weight: 700; font-size: 16px; margin-bottom: 3px; }

        table.dcp-grid { width: 100%; border-collapse: collapse; table-layout: fixed; flex-shrink: 0; }
        table.dcp-grid td, table.dcp-grid th {
          border: ${GRID_BORDER_PX}px solid #000; padding: 3px 4px; vertical-align: top;
        }
        table.dcp-grid + table.dcp-grid { margin-top: -${GRID_BORDER_PX}px; }
        .dcp-half { width: 50%; }
        .num { text-align: right; }

        .dcp-company-name { font-weight: 700; font-size: 12.5px; margin-bottom: 1px; }
        /* Company text has the left column to itself, same as
           SalesInvoicePrintable's sinv-head-company. */
        .dcp-head-company { width: 62%; }
        /* KEMACH + Supplier logos side by side, left-aligned in the second
           column — same technique as sinv-head-logos, no IRN row beneath
           since a delivery challan carries none. */
        .dcp-head-logos {
          display: flex; align-items: center; justify-content: flex-start;
          gap: 3mm; padding-left: 5mm;
        }
        .dcp-head-logo {
          width: 40mm; height: auto;
          /* Sharpen on the way down instead of the browser's default soft
              smoothing — the source asset is high-resolution (2962x812), so
              this is what keeps it crisp at print size rather than blurred. */
          image-rendering: -webkit-optimize-contrast;
          -webkit-print-color-adjust: exact; print-color-adjust: exact;
        }
        .dcp-head-supplier-logo {
          width: 25mm; height: auto; object-fit: contain;
          image-rendering: -webkit-optimize-contrast;
          -webkit-print-color-adjust: exact; print-color-adjust: exact;
        }
        .dcp-head-irn { width: 38%; }
        .dcp-break { word-break: break-all; }

        .dcp-kv { display: flex; gap: 4px; line-height: 1.35; }
        .dcp-kv .k { flex: 0 0 42%; }
        .dcp-kv .c { flex: 0 0 4px; }
        .dcp-kv .v { flex: 1; font-weight: 600; }

        .dcp-addr-title { font-weight: 400; margin-bottom: 2px; }
        .dcp-party { font-weight: 400; }
        .dcp-pre { white-space: pre-line; line-height: 1.35; }

        table.dcp-items th { font-weight: 700; text-align: center; font-size: 10px; }
        table.dcp-items td { font-size: 10px; }
        table.dcp-items td.num { font-size: 8.5px; white-space: nowrap; }
        table.dcp-items .w-sn { width: 3.5%; }
        table.dcp-items .w-code { width: 9%; }
        table.dcp-items .w-desc { width: 22%; }
        table.dcp-items .w-hsn { width: 7%; }
        table.dcp-items .w-um { width: 5%; }
        table.dcp-items .w-qty { width: 5%; }
        table.dcp-items .w-price { width: 8.5%; }
        table.dcp-items .w-disc { width: 5.5%; }
        table.dcp-items .w-ass { width: 9%; }
        table.dcp-items .w-tax { width: 9.5%; }
        table.dcp-items .w-taxamt { width: 8%; }
        table.dcp-items .w-amt { width: 8%; }
        .dcp-taxcell { white-space: nowrap; }

        .dcp-qty-cell { width: 62%; }
        .dcp-total-label { width: 22%; }
        .dcp-total-value { width: 16%; text-align: right; }
        .dcp-words-cell { vertical-align: top; }
        .dcp-words { font-weight: 600; text-transform: uppercase; }

        table.dcp-hsn th, table.dcp-hsn td { font-size: 10px; }
        table.dcp-hsn th { font-weight: 700; }

        .dcp-bank-title { font-weight: 700; border-bottom: none; }
        .dcp-bank-details { width: 70%; }
        .dcp-bank-qr-cell { width: 30%; text-align: center; vertical-align: middle; }
        .dcp-bank-qr { width: 30mm; height: 30mm; object-fit: contain; image-rendering: pixelated; }

        table.dcp-foot .dcp-foot-left { width: 62%; line-height: 1.45; }
        table.dcp-foot .dcp-foot-right { width: 38%; text-align: right; }
        table.dcp-foot .dcp-sign { height: 46px; vertical-align: bottom; }
        /* max-width caps a wide signature image (an uploaded image of
           whatever aspect ratio the user supplied, not a fixed stationery
           asset) so a wide source can never overflow the .dcp-foot-right
           column and throw the footer's two columns out of alignment with
           each other -- same containment SalesInvoicePrintable.jsx's own
           .sinv-sign-img already applies. */
        .dcp-sign-img { display: block; margin: 0 6mm 2px auto; height: 64px; max-width: 40mm; width: auto; object-fit: contain; }

        .dcp-pagefoot { display: flex; justify-content: space-between; padding: 3px 2px 0; font-size: 9.5px; }
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
// identify it as DeliveryChallanPrintable.
export default React.memo(DeliveryChallanPrintable);
