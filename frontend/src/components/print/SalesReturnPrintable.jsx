import React from 'react';
import { joinAddressParts, cleanAddressText } from '../../lib/addressFormat';
import { createPortal } from 'react-dom';
import dayjs from 'dayjs';
import { amountToWords } from '../../lib/numberToWords';
import { buildDocument, round2, isInterState, computeFreightGross, isTcsTaxType } from '../../lib/documentTotals';
// Same dedicated bank/payment QR SalesQuotationPrintable.jsx and
// PurchaseInvoicePrintable use in their own "Company's Bank Details" block —
// not the general-purpose assets/qr.png the Letterhead uses for itself.
import qrCode from '../../../assets/bankQR.jpeg';
import kemachLogo from '../../../assets/kemach.png';
import {
  LetterheadHeader, LetterheadWatermark, LetterheadFooter, letterheadStyles,
  LETTERHEAD_TOP_MM, LETTERHEAD_BOTTOM_MM,
} from './Letterhead';
import { useIsActiveTab } from '../navigation/TabPathContext';
import { makeScopedPrint, makeScopedCapture } from './purchaseStationery';

const PRINTING_CLASS = 'sret-printing';
const PAGE_RULE_ID = 'sret-print-page-rule';

export const printSalesReturn = makeScopedPrint({ printingClass: PRINTING_CLASS, pageRuleId: PAGE_RULE_ID });
export const captureSalesReturnPdf = makeScopedCapture({ printingClass: PRINTING_CLASS, pageRuleId: PAGE_RULE_ID, sheetSelector: '.srp-sheet', areaSelector: '.srp-print-area' });

// GST Credit Note — the statutory document a Sales Return is issued as. Built
// from a reference credit note PDF (a customer-facing "GST SALES AR CREDIT
// NOTE"), and structurally a close sibling of SalesQuotationPrintable.jsx and
// SalesInvoicePrintable.jsx: same ruled-grid-of-tables technique, same ITEM
// tax-row rowSpan trick, same totals/HSN-summary shape, same QR-in-the-bank-
// block placement as the quotation. Two things the reference carries that
// neither sibling has:
//
//   - an e-invoice IRN column beside the company block, same idea as
//     SalesInvoicePrintable's but with this document's own field labels
//     ("IRN Number" / "Ack. No./Dt" rather than "IRN Ack. No" / "IRN No").
//     SalesReturn has no irnNo/irnAckNo/irnAckDate columns yet, so these
//     print as labelled blanks — the same "additive" pattern every sibling
//     template uses for a field its own reference carries that this
//     application has no column for yet.
//   - the reference's Remarks line names the documents the credit note was
//     raised against ("Based On Deliveries .... Based On A/R Invoices ....")
//     rather than carrying that in the Delivery Note / Buyer's Order No
//     fields (both blank in the reference) — see remarksLine() below, which
//     reproduces exactly that: the challan this return was raised against,
//     plus the invoice billed on that challan if one exists.
//
// A Sales Return item line has no `quantity` column — the field is
// `returnQuantity` throughout this schema (see SalesReturn.jsx's own note on
// why) — so every quantity read below goes through `returnQuantity`
// explicitly rather than the `quantity` fallback the sibling templates use.

// One weight for every rule on the sheet.
const GRID_BORDER_PX = 1;

// A4 portrait (210mm x 297mm). The sheet itself is NOT sized with this
// constant any more — see .srp-sheet below, which uses min-height: 100vh
// instead of a hardcoded mm value, matching SalesQuotationPrintable.jsx's own
// documented fix for the same "gap under / clipped end of the printed
// document" symptom: in print, a fixed-mm box does not reliably match the
// real printable area a browser/driver actually grants (Chrome's own
// pipeline and drivers such as Windows' "Microsoft Print to PDF" can reserve
// their own margin or apply a print-dialog Scale), so a hardcoded 297mm sheet
// can fall short of the true page edge. Kept here only as the value the
// explicit @page size below must agree with.
const PAGE_HEIGHT_MM = 297;
// Matches every sibling template's page inset (SalesInvoicePrintable.jsx's
// .sinv-sheet and its own siblings all use 6mm) now that this document draws
// the same letterhead bands they do — see the Letterhead import above.
const PAGE_MARGIN_MM = 6;

// Same brand-rule spacing every sibling template sets — restated here so
// this document's gaps can be tuned independently without touching theirs.
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

const DEFAULT_GST_TYPE = 'Regular/TDS/ISD';

// Same reshaping SalesQuotationPrintable.jsx/DeliveryChallanPrintable.jsx
// apply: the reference prints amounts in words without the "Rupees" prefix
// and with a lower-case "only". Kept local rather than in the shared helper
// because Cheque Print depends on that function's exact cheque-style wording.
const wordsPlain = (n) =>
  (amountToWords(n) || '')
    .replace(/^\s*Rupees\s+/i, '')
    .replace(/\bOnly\s*$/, 'only');

// Totals come from the shared engine in lib/documentTotals.js — the same
// module the form's DocumentTotalsPanel uses and a behavioural mirror of the
// server's own, so the printed figures always match what was saved.
// quantityField: 'returnQuantity' — see the file-level note above.
function computeTotals(items, discountPercent, interState = false, order = {}) {
  const { totals } = buildDocument(items, discountPercent, {
    quantityField: 'returnQuantity', interState, roundOff: true,
  });
  // Manually-entered Road Tax and Freight Charges (Net + Tax) — both folded
  // into the printed Grand Total exactly as they are in the saved amount.
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

/** Per-line figures — computed once so the item grid and the HSN summary can never disagree. */
function lineFigures(it, headerDiscPct) {
  const qty = Number(it.returnQuantity) || 0;
  const price = Number(it.unitPrice) || 0;
  const itemDiscPct = Number(it.discountPercent) || 0;
  const gross = qty * price;
  const afterItemDisc = gross - gross * (itemDiscPct / 100);
  const taxable = afterItemDisc * (1 - headerDiscPct / 100);
  const taxPct = Number(it.taxPercent) || 0;
  const taxAmount = taxable * (taxPct / 100);
  return { qty, price, itemDiscPct, taxable, taxPct, taxAmount, total: taxable + taxAmount };
}

// The reference's own Remarks line: which document(s) this credit note was
// raised against, not a free-text note. `invoiceRecord` is the Sales Invoice
// billed on this return's challan, if one exists yet — a challan can be
// returned against before it's ever invoiced, so this is optional.
function remarksLine(order, invoiceRecord) {
  const parts = [];
  if (order.challanNo) parts.push(`Based On Delivery Challan ${order.challanNo}.`);
  if (invoiceRecord?.invoiceNo) parts.push(`Based On Sales Invoice ${invoiceRecord.invoiceNo}.`);
  // Reason falls in behind the document linkage rather than replacing it —
  // the reference's own Remarks slot is document provenance, and a reason
  // the user typed is additional to that, not instead of it.
  if (order.reason) parts.push(order.reason);
  return parts.join(' ');
}

// --- Per-physical-page pagination --------------------------------------
//
// The KEMACH letterhead header and footer must repeat on every PRINTED
// PAGE, not just once at the top/bottom of the whole document. This
// document used to split its items with a flat, fixed ITEMS_PER_PAGE and
// repeat the FULL header-card block (company/billing/document-detail) and
// the declarations block on every single item page regardless — a
// carry-over from before the letterhead was drawn on every sheet, when
// that repetition was how a reader on any given page could still see who
// the document was from/to. Now that LetterheadHeader/LetterheadFooter
// already repeat per page on their own, that full-card repetition is no
// longer needed and wastes room that could hold more items per page — see
// renderPage/renderAllPages below, which follow SalesQuotationPrintable.jsx's
// approach instead: build the document as several explicit, self-contained
// .srp-sheet page blocks, each with its OWN complete
// LetterheadHeader/Watermark/Footer in normal document flow (no
// position: fixed, no @page margin trick — see the @media print block
// below for why that pure-CSS approach was tried and reverted). The
// company/billing/document-detail header cards render ONLY on the first
// page; the totals/HSN-summary/bank/declarations footer content renders
// ONLY on the last page; the item grid (with its own <thead> reprinted on
// every page) renders on every page, sliced to that page's chunk of items
// with the running S.No/index carried across pages via startIndex.
//
// Item counts per page are a fixed estimate, not a live measurement — this
// environment has no way to render the page and see exactly where text
// wraps. The constants below are deliberately conservative (biased toward
// splitting one extra page rather than risking an overflow that reproduces
// the original clipping/overlap bug), scaled off
// SalesQuotationPrintable.jsx's own FIRST=8/MID=18/LAST=8 (3 header-card
// tables before its items, ~5 footer blocks after): this document's header
// cards are much the same size (company+IRN table, billing/shipping table,
// document-detail table — one row taller, for the Outstanding Due line),
// but its footer carries one extra block (a quick "Total" row ahead of the
// full totals/HSN/bank breakdown) — so FIRST stays close to the quotation's
// figure and LAST is trimmed down a little further. Retune here first if a
// real print/PDF comes back with a page ending noticeably early.
// Raised a notch (7/16/6 -> 8/17/7) to match the real font-size/
// line-height shrink applied to .srp-print-area and the items/HSN
// tables below -- the identical recalibration made to
// SalesInvoicePrintable.jsx (mm-budget version of this same fix) after
// a real invoice with more items was still pushing its footer onto a
// spurious extra page.
const FIRST_PAGE_MAX_ITEMS = 8; // page 1 also carries the company/billing/document-detail cards
const MID_PAGE_MAX_ITEMS = 17;  // a continuation page with nothing but the item grid
const LAST_PAGE_MAX_ITEMS = 7;  // the last page also carries the total row, totals/HSN/bank/declarations

/**
 * Split items into page-sized chunks. A document short enough to fit
 * FIRST_PAGE_MAX_ITEMS on its own comes back as a single page that is both
 * isFirst and isLast — i.e. today's single-page layout, unchanged.
 */
function paginateItems(items) {
  if (items.length <= FIRST_PAGE_MAX_ITEMS) {
    return [{ items, isFirst: true, isLast: true }];
  }
  const rest = items.slice(FIRST_PAGE_MAX_ITEMS);
  const pages = [{ items: items.slice(0, FIRST_PAGE_MAX_ITEMS), isFirst: true, isLast: false }];

  // Reserve the tail that becomes the true last page (it carries the
  // footer, so it must never exceed LAST_PAGE_MAX_ITEMS) and split
  // whatever's left BETWEEN page 1 and that tail across as few mid pages
  // as MID_PAGE_MAX_ITEMS allows -- spread EVENLY rather than greedily
  // filling each mid page to the brim and leaving a small, lopsided
  // remainder for the next one. The greedy version (front-load a full
  // MID_PAGE_MAX_ITEMS page, then whatever's left) was correct -- no page
  // ever overflowed its budget -- but on a real document it produced an
  // oddly thin page (e.g. a lone 2-item page) sitting right before the
  // last page, which reads as broken even though it isn't. Even
  // distribution removes that without reintroducing the earlier overflow
  // bug: every mid page here still stays at or under MID_PAGE_MAX_ITEMS,
  // and the reserved last-page tail is untouched.
  const lastCount = Math.min(LAST_PAGE_MAX_ITEMS, rest.length);
  const middleCount = rest.length - lastCount;
  if (middleCount > 0) {
    const numMidPages = Math.ceil(middleCount / MID_PAGE_MAX_ITEMS);
    const base = Math.floor(middleCount / numMidPages);
    let extra = middleCount % numMidPages;
    let idx = 0;
    for (let i = 0; i < numMidPages; i += 1) {
      const size = base + (extra > 0 ? 1 : 0);
      if (extra > 0) extra -= 1;
      pages.push({ items: rest.slice(idx, idx + size), isFirst: false, isLast: false });
      idx += size;
    }
  }
  pages.push({ items: rest.slice(middleCount), isFirst: false, isLast: true });
  return pages;
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

function SalesReturnPrintable({
  order, company, customerRecord, invoiceRecord, branchRecord, houseBank,
  approverSignatureUrl,
}) {
  const isActiveTab = useIsActiveTab();
  if (!isActiveTab || !order) return null;

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
  const totalQty = items.reduce((s, i) => s + (Number(i.returnQuantity) || 0), 0);
  const taxTotal = round2(totals.totalTax);
  const taxRatePct = totals.taxableAmount > 0 && totals.totalTax > 0 ? (totals.totalTax / totals.taxableAmount) * 100 : 0;

  const billingAddr = cleanAddressText(order.billingAddress || customerRecord?.billingAddress);
  // Ship To on a return is the receiving branch's own address, not the
  // customer's - falls back to the branchRecord-derived lines above rather
  // than any customer field.
  const shippingAddr = cleanAddressText(order.shippingAddress) || joinAddressParts([branchAddrLine1, branchAddrLine2]);
  const remarks = remarksLine(order, invoiceRecord);

  const pages = paginateItems(items);
  const pageCount = pages.length;

  // Company + e-invoice, billing/shipping, document-detail cards — page 1
  // only.
  const renderHeader = () => (
    <>
      {/* Company + e-invoice block. See the file-level note on why the IRN
          column prints blank — matches SalesInvoicePrintable's own
          sinv-head-irn treatment, just with this document's field labels. */}
      <table className="srp-grid srp-head">
        <tbody>
          <tr>
            <td className="srp-head-company">
              <div className="srp-company-name">{companyName}</div>
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
              <div>GSTN Type:{company?.gstnType || DEFAULT_GST_TYPE}</div>
            </td>
            <td className="srp-head-irn">
              {/* KEMACH logo — same sinv-head-logos placement
                  SalesInvoicePrintable.jsx uses in this column. No Supplier
                  logo here: this document has no supplierRecord prop to
                  gate one on. */}
              <div className="srp-head-logos">
                <img className="srp-head-logo" src={kemachLogo} alt="KEMACH" />
              </div>
              <div className="srp-kv"><span className="k">IRN No. : </span><span className="v srp-break">{order.irnNo || ''}</span></div>
              <div className="srp-kv">
                <span className="k">Ack. No./Dt. : </span>
                <span className="v">{order.irnAckNo || ''}{order.irnAckNo && order.irnAckDate ? ' /' : ''}{fmtDate(order.irnAckDate)}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Billing / Shipping addresses */}
      <table className="srp-grid">
        <tbody>
          <tr>
            <td className="srp-half">
              <div className="srp-addr-title">Billing Address To :</div>
              {customerRecord?.customerCode && <div>Customer Code : {customerRecord.customerCode}</div>}
              <div className="srp-party">
                {order.customer || order.customerName || ''}
              </div>
              {billingAddr && <div className="srp-pre">{billingAddr}</div>}
              <div>GST Registration Number : {customerRecord?.gstin || ''}</div>
              <div>GST Registration Type : {customerRecord?.gstRegistrationType || DEFAULT_GST_TYPE}</div>
              <div>PAN Number : {partnerPan(customerRecord, 'Billing')}</div>
            </td>
            <td className="srp-half">
              <div className="srp-addr-title">Shipping Address To :</div>
              <div className="srp-party">
                {branchRecord?.branchName || order.branch || ''}{branchRecord?.branchCode ? ` - ${branchRecord.branchCode}` : ''}
              </div>
              {shippingAddr && <div className="srp-pre">{shippingAddr}</div>}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Document details. Delivery Note / Buyer's Order No print blank, same
          as the reference — it names the source documents in the Remarks row
          instead (see remarksLine above), not here. Sales Employee / Carrier
          Name have no column on this form yet and print as labelled blanks,
          same additive pattern the sibling templates use. */}
      <table className="srp-grid">
        <tbody>
          <tr>
            <td className="srp-half">
              <div className="srp-kv"><span className="k">Credit Note No</span><span className="c">:</span><span className="v">{order.returnNo || ''}</span></div>
              <div className="srp-kv"><span className="k">Credit Note Date</span><span className="c">:</span><span className="v">{fmtDate(order.documentDate)}</span></div>
              <div className="srp-kv"><span className="k">Delivery Note</span><span className="c">:</span><span className="v"></span></div>
              <div className="srp-kv"><span className="k">Buyer&apos;s Order No</span><span className="c">:</span><span className="v"></span></div>
              <div className="srp-kv"><span className="k">Machine Serial No.</span><span className="c">:</span><span className="v">{order.machineSerialNo || ''}</span></div>
              <div className="srp-kv"><span className="k">Hypothecation</span><span className="c">:</span><span className="v">{order.hypothecation || ''}</span></div>
            </td>
            <td className="srp-half">
              <div className="srp-kv"><span className="k">Place of Supply</span><span className="c">:</span><span className="v">{order.placeOfSupply || ''}</span></div>
              <div className="srp-kv"><span className="k">Sales Employee</span><span className="c">:</span><span className="v">{order.salesEmployee || ''}</span></div>
              <div className="srp-kv"><span className="k">Engine No.</span><span className="c">:</span><span className="v">{order.engineNo || ''}</span></div>
              <div className="srp-kv"><span className="k">Customer PO No.</span><span className="c">:</span><span className="v">{order.customerRefNo || ''}</span></div>
              <div className="srp-kv"><span className="k">Carrier Name</span><span className="c">:</span><span className="v">{order.carrierName || ''}</span></div>
              <div className="srp-kv"><span className="k">Payment Terms</span><span className="c">:</span><span className="v">{order.paymentTerms || ''}</span></div>
              <div className="srp-kv"><span className="k">Outstanding Due</span><span className="c">:</span><span className="v">{order.outstandingDue != null ? fmtNum(order.outstandingDue) : ''}</span></div>
            </td>
          </tr>
          <tr>
            <td className="srp-half" colSpan={2}>
              <div className="srp-kv"><span className="k">Remarks</span><span className="c">:</span><span className="v">{remarks}</span></div>
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );

  // Line items for one page.
  const renderItemsTable = (pageItems, startIndex) => (
    <table className="srp-grid srp-items">
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
                <td className="srp-taxcell">{components[0].label} {components[0].pct.toFixed(2)}%</td>
                <td className="num">{fmtNum(components[0].amt)}</td>
                <td className="num" rowSpan={components.length}>{fmtNum(f.total)}</td>
              </tr>
              {components.slice(1).map((c) => (
                <tr key={c.label}>
                  <td className="srp-taxcell">{c.label} {c.pct.toFixed(2)}%</td>
                  <td className="num">{fmtNum(c.amt)}</td>
                </tr>
              ))}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );

  // Continuation of the item grid — same class, so table-layout: fixed keeps
  // identical column widths and the vertical rules run straight down through
  // the blank space below a page's own items, so the grid's ruled border
  // still reaches the bottom of every sheet even on a short page. Renders on
  // every page (it is what absorbs whatever room that page's own item chunk
  // didn't use), same as before.
  const renderItemsFiller = () => (
    <table className="srp-grid srp-items srp-fill">
      <tbody>
        <tr>
          <td className="w-sn" /><td className="w-code" /><td className="w-desc" /><td className="w-hsn" />
          <td className="w-um" /><td className="w-qty" /><td className="w-price" /><td className="w-disc" />
          <td className="w-ass" /><td className="w-tax" /><td className="w-taxamt" /><td className="w-amt" />
        </tr>
      </tbody>
    </table>
  );

  const renderTotalRow = () => (
    <table className="srp-grid">
      <tbody>
        <tr>
          <td className="srp-qty-cell">Total Qty <b>{fmtQty(totalQty)}</b></td>
          <td className="srp-total-label">Total</td>
          <td className="srp-total-value">{fmtNum(totals.taxableAmount + taxTotal)}</td>
        </tr>
      </tbody>
    </table>
  );

  const renderSummary = () => (
    <>
      <table className="srp-grid">
        <tbody>
          <tr>
            <td rowSpan={4} className="srp-words-cell">
              <b>Amount in Words. ({order.currency || 'INR'})</b>{' '}
              <span className="srp-words">{wordsPlain(totals.grandTotal)}</span>
            </td>
            <td className="srp-sum-label">Freight charges</td>
            <td className="srp-sum-value">{fmtNum(totals.freightGrossAmount)}</td>
          </tr>
          <tr>
            <td className="srp-sum-label">Road tax</td>
            <td className="srp-sum-value">{fmtNum(totals.roadTax)}</td>
          </tr>
          <tr>
            <td className="srp-sum-label">Round off</td>
            <td className="srp-sum-value">{fmtNum(totals.roundOff)}</td>
          </tr>
          <tr>
            <td className="srp-sum-label"><b>Grand Total</b></td>
            <td className="srp-sum-value"><b>{fmtNum(totals.grandTotal)}</b></td>
          </tr>
        </tbody>
      </table>

      <table className="srp-grid srp-hsn">
        <thead>
          <tr>
            <th>TAXABLE VALUE</th>
            <th>{interState ? 'INTEGRATED TAX %' : 'CENTRAL TAX %'}</th>
            <th>{interState ? 'INTEGRATED TAX AMT' : 'CENTRAL TAX AMT'}</th>
            {!interState && <th>STATE TAX %</th>}
            {!interState && <th>STATE TAX AMT</th>}
            {totals.tcsAmount > 0 && <th>TCS %</th>}
            {totals.tcsAmount > 0 && <th>TCS AMT</th>}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{fmtNum(totals.taxableAmount)}</td>
            <td>{(interState ? taxRatePct : taxRatePct / 2).toFixed(2)}</td>
            <td>{fmtNum(interState ? totals.igstAmount : totals.cgstAmount)}</td>
            {!interState && <td>{(taxRatePct / 2).toFixed(2)}</td>}
            {!interState && <td>{fmtNum(totals.sgstAmount)}</td>}
            {totals.tcsAmount > 0 && <td>{(1).toFixed(2)}</td>}
            {totals.tcsAmount > 0 && <td>{fmtNum(totals.tcsAmount)}</td>}
          </tr>
        </tbody>
      </table>

      <table className="srp-grid">
        <tbody>
          <tr>
            <td><b>Tax Amount in Words. ({order.currency || 'INR'})</b> {wordsPlain(taxTotal)}</td>
          </tr>
        </tbody>
      </table>

      {/* Bank details — same two-column shape (details | QR cell)
          SalesInvoicePrintable.jsx's sinv-bank-details/sinv-bank-qr-cell
          use. The QR itself stays this document's own dedicated
          assets/bankQR.jpeg (see the file-level import note above), printed
          unconditionally rather than gated on houseBank?.qrCodeUrl the way
          the siblings gate theirs — that is this document's existing
          behaviour, unchanged here. */}
      <table className="srp-grid">
        <tbody>
          <tr>
            <td colSpan={2} className="srp-bank-title">Company&apos;s Bank Details :</td>
          </tr>
          <tr>
            <td className="srp-bank-details">
              <div className="srp-kv"><span className="k">Beneficiary Name</span><span className="c">:</span><span className="v">{houseBank?.accountName || company?.companyName || ''}</span></div>
              <div className="srp-kv"><span className="k">Bank Name</span><span className="c">:</span><span className="v">{houseBank?.bankName || ''}</span></div>
              <div className="srp-kv"><span className="k">Branch</span><span className="c">:</span><span className="v">{houseBank?.branchName || ''}</span></div>
              <div className="srp-kv"><span className="k">A/c No.</span><span className="c">:</span><span className="v">{houseBank?.accountNumber || ''}</span></div>
              <div className="srp-kv"><span className="k">RTGS/IFSC Code</span><span className="c">:</span><span className="v">{houseBank?.ifscCode || ''}</span></div>
              <div className="srp-kv"><span className="k">Type</span><span className="c">:</span><span className="v">{houseBank?.accountType || ''}</span></div>
            </td>
            <td className="srp-bank-qr-cell">
              <img className="srp-qr" src={qrCode} alt="Bank QR code" />
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );

  const renderDeclarations = () => (
    <table className="srp-grid srp-foot">
      <tbody>
        <tr>
          <td className="srp-foot-left">Interest at 24% p.a. will be charged on all overdue payments</td>
          <td className="srp-foot-right">For {companyName}</td>
        </tr>
        <tr>
          <td className="srp-foot-left">
            {/* Regd. Office / CIN dropped from here — LetterheadFooter (see
                below) now draws it on every sheet, so restating it here would
                print it twice. */}
            {order.termsConditions
              ? <div className="srp-pre">{order.termsConditions}</div>
              : (
                <>
                  <div>All agreements contingent upon strikes, accidents and other conditions beyond our control.</div>
                  <div>All contracts are subject to approval by an office of the Company .</div>
                  <div>All disputes arising in respect of this invoice shall be decided by a Competent Court at Coimbatore and shall be subject to the jurisdiction of Coimbatore Courts only.</div>
                </>
              )}
          </td>
          <td className="srp-foot-right srp-sign">
            {approverSignatureUrl ? <img className="srp-sign-img" src={approverSignatureUrl} alt="" style={order.salesCategory === 'Machine' ? { height: '96px', maxWidth: '70mm' } : undefined} /> : null}
            {order.salesCategory !== 'Machine' && <div>Authorized Signatory</div>}
          </td>
        </tr>
      </tbody>
    </table>
  );

  const renderPageFoot = (pageNo) => (
    <div className="srp-pagefoot">
      <span />
      <span className="srp-pagefoot-contact">
        {company?.phone ? `Ph No : ${company.phone}` : ''}
        {company?.phone && company?.email ? '  ' : ''}
        {company?.email ? `Email Id : ${company.email}` : ''}
      </span>
      <span className="srp-pagefoot-page">Page {pageNo} of {pageCount}</span>
    </div>
  );

  // One physical page — its own complete letterhead header/watermark/footer
  // in normal document flow, so the browser draws them on THIS page
  // regardless of how many pages the document has (see the pagination
  // comment above paginateItems for why this replaced repeating the whole
  // header-card block on every page).
  const renderPage = (page, pageIndex, startIndex) => (
    <div className="srp-sheet" key={pageIndex}>
      <div className="srp-page">
        <LetterheadHeader company={company} />
        <LetterheadWatermark />
        <div className="srp-title">CREDIT NOTE</div>

        {page.isFirst && renderHeader()}

        {renderItemsTable(page.items, startIndex)}

        {page.isLast && renderTotalRow()}

        {renderItemsFiller()}

        {page.isLast && renderSummary()}
        {page.isLast && renderDeclarations()}

        {renderPageFoot(pageIndex + 1)}

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
    <div className="srp-print-area">
      <style>{`
        ${letterheadStyles('.srp-page', RULE_SPACING)}
        .srp-print-area { display: none; }
        @media print {
          /* .srp-print-area is portaled straight onto <body> (see the
             createPortal call below) — a DIRECT SIBLING of #root, not
             nested inside it. That is what makes this rule safe: hiding
             #root removes the entire rest of the app (sidebar, data table,
             open dialogs) from layout ENTIRELY (display: none, not merely
             invisible), so none of it can contribute stray height for the
             print engine to paginate against, and nothing needs to be
             clamped or clipped to "exactly one viewport" any more. A credit
             note with enough items to run past one page now simply flows
             onto additional physical pages instead of being clipped — see
             SalesQuotationPrintable.jsx's identical comment for the full
             story of why this replaced the previous
             visibility:hidden/body-clamp approach. */
          body.${PRINTING_CLASS} #root { display: none !important; }
          body.${PRINTING_CLASS} .srp-print-area {
            display: block; width: 100%; box-sizing: border-box;
          }
          body.${PRINTING_CLASS} .srp-print-area,
          body.${PRINTING_CLASS} .srp-print-area * {
            visibility: visible;
          }
          /* Explicit millimetres rather than the "A4" size keyword — print
             pipelines that only loosely implement the size keyword (notably
             the Windows "Microsoft Print to PDF" driver reached through a
             browser's "Print using system dialog" path) honour explicit
             physical dimensions far more reliably.

             margin: 0 — an @page margin that reserves a top/bottom band for
             the letterhead (with position: fixed bands drawn into it,
             repeating per physical page) was tried here and reverted: on
             this app's actual print/PDF pipeline the @page margin did not
             reflow the normal document content down out of that band at
             all, so the fixed-position header ended up drawn on TOP of the
             ordinary flowing content instead of above it. The letterhead
             now repeats per page a different way — see the pagination
             comment above paginateItems: the document is built as several
             explicit .srp-sheet blocks, each with its own header/footer in
             normal flow, rather than relying on any @page-margin/fixed-
             position trick at all. */
          @page { size: 210mm 297mm; margin: 0; }
          .srp-sheet { page-break-after: always; }
          .srp-sheet:last-child { page-break-after: auto; }
        }
        /* min-height: 100vh, NOT a fixed height — a short page (few items)
           still fills exactly one visual page, since the item filler table
           below (.srp-fill, flex: 1 1 auto) stretches into whatever slack is
           left, pinning that page's own footer content to the bottom of its
           own sheet. A page with enough items to exceed one page's worth of
           content is no longer forced to shrink into that same fixed box —
           the sheet grows taller than 100vh instead, and the browser's own
           print pagination (the page-break-after rule above) carries the
           overflow onto the NEXT explicit .srp-sheet page block rather than
           clipping or overlapping it. NOT a hardcoded ${PAGE_HEIGHT_MM}mm
           either — see the note on PAGE_HEIGHT_MM above. The
           ${PAGE_MARGIN_MM}mm inset is this element's own padding, not an
           @page margin, so it's set in exactly one place and no print
           engine can add a second one on top. */
        .srp-sheet {
          min-height: 100vh;
          box-sizing: border-box;
          padding: ${PAGE_MARGIN_MM}mm;
        }
        .srp-page {
          display: flex;
          flex-direction: column;
          /* min-height: calc(...), NOT height: 100%/min-height: 100% —
             .srp-sheet above no longer has a DEFINITE height of its own (it
             is min-height: 100vh with no height set, so it can grow with
             content), and a percentage height on a child needs a definite
             height on the parent to resolve against; against an
             indefinite/auto parent height, height: 100% computes to auto
             instead (CSS2.1 10.5). That silently collapsed this flex column
             to its own content's natural height — far short of a full page
             — which pulled .lh-footer (position: absolute; bottom: 0
             against THIS element) up to sit right under a short item table
             instead of at the true bottom of the sheet. .srp-sheet's own
             ${PAGE_MARGIN_MM}mm padding (both top and bottom) sits OUTSIDE
             this element, so this element's floor has to be 100vh minus
             that padding, not 100vh itself — otherwise this box plus the
             sheet's padding would together exceed one physical page and
             push part of the footer onto a second page even for a short,
             single-page document. */
          min-height: calc(100vh - ${PAGE_MARGIN_MM * 2}mm);
          box-sizing: border-box;
          padding-top: ${LETTERHEAD_TOP_MM}mm;
          padding-bottom: ${LETTERHEAD_BOTTOM_MM}mm;
        }
        table.srp-fill { flex: 1 1 auto; min-height: 0; }
        table.srp-fill td { height: 100%; }

        .srp-print-area { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 11.5px; }
        .srp-title { text-align: center; font-weight: 700; font-size: 16px; letter-spacing: 0.5px; margin-bottom: 3px; flex-shrink: 0; }

        table.srp-grid { width: 100%; border-collapse: collapse; table-layout: fixed; flex-shrink: 0; }
        table.srp-grid td, table.srp-grid th {
          border: ${GRID_BORDER_PX}px solid #000; padding: 2px 4px; vertical-align: top;
        }
        table.srp-grid + table.srp-grid { margin-top: -${GRID_BORDER_PX}px; }
        .srp-half { width: 50%; }
        .num { text-align: right; }

        .srp-company-name { font-weight: 700; font-size: 12.5px; margin-bottom: 1px; }
        .srp-head-company { width: 62%; }
        .srp-head-irn { width: 38%; }
        /* KEMACH logo above the IRN kv rows — same sinv-head-logos technique
           SalesInvoicePrintable.jsx uses in its own IRN column. */
        .srp-head-logos {
          display: flex; align-items: center; justify-content: flex-start;
          gap: 3mm; margin-bottom: 2mm; padding-left: 5mm;
        }
        .srp-head-logo {
          width: 40mm; height: auto;
          image-rendering: -webkit-optimize-contrast;
          -webkit-print-color-adjust: exact; print-color-adjust: exact;
        }
        .srp-break { word-break: break-all; }

        .srp-kv { display: flex; gap: 4px; line-height: 1.2; }
        .srp-kv .k { flex: 0 0 42%; }
        .srp-kv .c { flex: 0 0 4px; }
        .srp-kv .v { flex: 1; font-weight: 600; }

        .srp-addr-title { font-weight: 400; margin-bottom: 2px; }
        .srp-party { font-weight: 400; }
        .srp-pre { white-space: pre-line; line-height: 1.2; }

        table.srp-items th { font-weight: 700; text-align: center; font-size: 10px; }
        table.srp-items td { font-size: 10px; }
        table.srp-items td.num { font-size: 8.5px; white-space: nowrap; }
        table.srp-items .w-sn { width: 3.5%; }
        table.srp-items .w-code { width: 9%; }
        table.srp-items .w-desc { width: 22%; }
        table.srp-items .w-hsn { width: 7%; }
        table.srp-items .w-um { width: 5%; }
        table.srp-items .w-qty { width: 5%; }
        table.srp-items .w-price { width: 8.5%; }
        table.srp-items .w-disc { width: 5.5%; }
        table.srp-items .w-ass { width: 9%; }
        table.srp-items .w-tax { width: 9.5%; }
        table.srp-items .w-taxamt { width: 8%; }
        table.srp-items .w-amt { width: 8%; }
        .srp-taxcell { white-space: nowrap; }

        .srp-qty-cell { width: 62%; }
        .srp-total-label { width: 22%; }
        .srp-total-value { width: 16%; text-align: right; }
        .srp-sum-label { width: 20%; }
        .srp-sum-value { width: 12%; text-align: right; }
        .srp-words-cell { width: 68%; vertical-align: top; }
        .srp-words { font-weight: 700; }

        table.srp-hsn th, table.srp-hsn td { font-size: 10px; text-align: center; }
        table.srp-hsn th { font-weight: 700; }

        /* Bank details — same two-column shape (details | QR cell)
           SalesInvoicePrintable.jsx's sinv-bank-details/sinv-bank-qr-cell
           use. */
        .srp-bank-title { font-weight: 700; border-bottom: none; }
        .srp-bank-details { width: 70%; }
        .srp-bank-qr-cell { width: 30%; text-align: center; vertical-align: middle; }
        .srp-qr { width: 30mm; height: 30mm; object-fit: contain; image-rendering: pixelated; }

        table.srp-foot .srp-foot-left { width: 62%; line-height: 1.35; }
        table.srp-foot .srp-foot-right { width: 38%; text-align: right; }
        table.srp-foot .srp-sign { height: 46px; vertical-align: bottom; }
        /* max-width caps a wide signature image (an uploaded image of
           whatever aspect ratio the user supplied, not a fixed stationery
           asset) so a wide source can never overflow the .srp-foot-right
           column and throw the footer's two columns out of alignment with
           each other -- same containment SalesInvoicePrintable.jsx's own
           .sinv-sign-img already applies. */
        .srp-sign-img { display: block; margin: 0 6mm 2px auto; height: 64px; max-width: 40mm; width: auto; object-fit: contain; }

        .srp-pagefoot {
          display: grid; grid-template-columns: 1fr auto 1fr;
          align-items: baseline; padding: 3px 2px 0; font-size: 9.5px; flex-shrink: 0;
        }
        .srp-pagefoot-contact { text-align: center; white-space: pre; }
        .srp-pagefoot-page { text-align: right; }

        .srp-print-area, .srp-print-area * {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
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
// identify it as SalesReturnPrintable.
export default React.memo(SalesReturnPrintable);
