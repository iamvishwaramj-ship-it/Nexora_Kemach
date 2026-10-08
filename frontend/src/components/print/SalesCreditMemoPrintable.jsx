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

// Sales Credit Memo's own print stationery -- a close adaptation of
// SalesInvoicePrintable.jsx (same letterhead-based, ruled-grid-of-tables
// GST layout and per-physical-page pagination technique), per the user's
// request to make this document's print screen match Sales Invoice's.
// Differences from Sales Invoice, all because this document's own schema
// (SalesCreditMemo / SalesCreditMemoItem in schema.prisma) has no e-invoice
// columns and a different set of document-detail fields:
//   - No IRN/QR/Ack block at all -- there is no irn/qrCode/ackNo/ackDate
//     column on this document, so the company header cell shows only the
//     KEMACH logo (and no Supplier logo either -- a credit memo has no
//     Supplier concept).
//   - Document title is "CREDIT NOTE", not "TAX INVOICE".
//   - The document-details card is remapped to this document's own fields
//     (Credit Memo No/Date, Invoice No as a reference, Due Date, Reason for
//     Credit in place of Remarks, etc.) -- see renderHeaderCards below.
//   - Grand Total INCLUDES Road Tax, matching SalesCreditMemo.jsx's own
//     computeMemoTotals (Sales Invoice's Grand Total excludes Road Tax by
//     company policy; this document does not).
//
// One weight for every rule on the sheet, same convention as the sibling
// printables.
const GRID_BORDER_PX = 1;

// --- Print activation ------------------------------------------------------
// Scoped the same way every other sales printable is (see
// SalesInvoicePrintable.jsx's own note on why this is required rather than
// an unconditional #root/.xxx-print-area toggle): KeepAliveOutlet keeps every
// open tab's printable mounted, so without scoping, whichever document's
// print area happened to be later in DOM order would paint over whatever the
// user actually meant to print.
const PRINTING_CLASS = 'scm-printing';
const PAGE_RULE_ID = 'scm-print-page-rule';

/**
 * Print THIS Sales Credit Memo. Call instead of window.print() from
 * SalesCreditMemo.jsx's own Print control.
 */
export const printSalesCreditMemo = makeScopedPrint({ printingClass: PRINTING_CLASS, pageRuleId: PAGE_RULE_ID });
// "Send via WhatsApp"'s PDF source, if/when this page grows one -- see
// makeScopedCapture in purchaseStationery.jsx. '.scm-sheet' is this
// document's own per-page block (see the .scm-sheet div further down).
export const captureSalesCreditMemoPdf = makeScopedCapture({ printingClass: PRINTING_CLASS, pageRuleId: PAGE_RULE_ID, sheetSelector: '.scm-sheet', areaSelector: '.scm-print-area' });

// A4 portrait (210mm x 297mm) -- see SalesInvoicePrintable.jsx's own note on
// why .scm-sheet uses min-height: 100vh rather than a hardcoded mm value.
const PAGE_HEIGHT_MM = 297;
const PAGE_MARGIN_MM = 6;

// --- Brand rule spacing, for THIS document ---------------------------------
// Same four independently-tuned gaps as SalesInvoicePrintable.jsx's own
// RULE_SPACING -- see that file's comment for the full reasoning. This
// document's header card is a little shorter (no IRN/QR row), so these are
// free to be retuned independently without touching Sales Invoice's own.
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

// Totals come from the shared engine in lib/documentTotals.js -- the same
// module SalesCreditMemo.jsx's own computeMemoTotals uses, so the printed
// figures always match what's on screen/saved. Grand Total here INCLUDES
// Road Tax -- unlike Sales Invoice's own wrapper, which deliberately
// excludes it by company policy. Must stay in lockstep with
// computeMemoTotals in SalesCreditMemo.jsx and computeSalesCreditMemoTotals
// in backend/src/routes/resources.js.
function computeTotals(items, discountPercent, interState = false, order = {}) {
  const { totals } = buildDocument(items, discountPercent, { interState, roundOff: true });
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

/**
 * Per-line figures, derived the same way the item grid and the tax summary
 * both need them -- computed once here so the two can never disagree.
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
// Identical technique to SalesInvoicePrintable.jsx's own (see that file for
// the full history/reasoning) -- built as several explicit .scm-sheet page
// blocks, each carrying its own complete letterhead in normal document flow.
// This document's header card is a little shorter (no IRN/QR row -- see
// FIRST_PAGE_MAX_ITEMS below), so the first-page budget is a notch more
// generous than Sales Invoice's own.
const FIRST_PAGE_MAX_ITEMS = 14; // page 1 of many: header cards only, no IRN/QR row to budget for
const MID_PAGE_MAX_ITEMS = 19;   // a continuation page with nothing but the item grid
const LAST_PAGE_MAX_ITEMS = 9;   // last page of many: footer only, no header cards
const SINGLE_PAGE_MAX_ITEMS = 5; // header cards AND full footer together on one page

const REMARKS_CHARS_PER_LINE = 100;
const TERMS_CHARS_PER_LINE = 70;
const MM_PER_TEXT_LINE = 4.3;
const MM_PER_ITEM_ROW = 9.2;
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

// Same TCS-aware row accounting as SalesInvoicePrintable.jsx -- see that
// file's comment above its own MM_PER_SUBROW for the full reasoning.
const MM_PER_SUBROW = MM_PER_ITEM_ROW / 2;
function itemRowCount(it, interState) {
  const baseRows = interState ? 1 : 2;
  return baseRows + (isTcsTaxType(it?.taxType) ? 1 : 0);
}
function itemRowMm(it, interState) {
  return itemRowCount(it, interState) * MM_PER_SUBROW;
}

function packPage(items, startIdx, budgetMm, interState) {
  let usedMm = 0;
  let end = startIdx;
  while (end < items.length) {
    const rowMm = itemRowMm(items[end], interState);
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
  pages.push({ items: rest, isFirst: false, isLast: true });
  return pages;
}

function SalesCreditMemoPrintable({
  order, company, customerRecord, branchRecord, houseBank, approverSignatureUrl,
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
  const branchAddrLine1 = joinAddressParts([branchRecord?.address, branchRecord?.streetNo, branchRecord?.buildingFloorRoom, branchRecord?.block]);
  const branchAddrLine2 = joinAddressParts([branchRecord?.city, branchRecord?.state, branchRecord?.country, branchRecord?.zipCode]);
  const totalQty = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  const taxTotal = round2(totals.cgstAmount + totals.sgstAmount + totals.igstAmount);
  const taxRatePct = totals.taxableAmount > 0 && totals.totalTax > 0 ? (totals.totalTax / totals.taxableAmount) * 100 : 0;

  const billingAddr = cleanAddressText(order.billingAddress || customerRecord?.billingAddress);
  const shippingAddr = cleanAddressText(order.shippingAddress || customerRecord?.shippingAddress);

  const customerBillingAddr = defaultAddressOf(customerRecord, 'Billing');
  const customerShippingAddr = defaultAddressOf(customerRecord, 'Shipping');

  const billingGstNumber = customerBillingAddr?.gstNumber || customerRecord?.gstin || customerRecord?.gstNumber || customerShippingAddr?.gstNumber || order.gstNo || '';
  const billingGstType = customerBillingAddr?.gstType || customerRecord?.gstRegistrationType || customerRecord?.gstType || 'Regular/TDS/ISD';

  const shippingGstNumber = customerShippingAddr?.gstNumber || customerBillingAddr?.gstNumber || customerRecord?.gstin || customerRecord?.gstNumber || order.gstNo || '';
  const shippingGstType = customerShippingAddr?.gstType || customerBillingAddr?.gstType || customerRecord?.gstRegistrationType || customerRecord?.gstType || 'Regular/TDS/ISD';

  const pages = paginateItems(items, order.reason, order.narration, interState);
  const pageCount = pages.length;

  // Company block, billing/shipping addresses, document details -- page 1
  // only. No IRN/QR block: this document has no such columns at all -- see
  // the file-level note above.
  const renderHeaderCards = () => (
    <>
      {/* Company + logo block */}
      <table className="scm-grid scm-head">
        <tbody>
          <tr>
            <td className="scm-head-company">
              <div className="scm-head-text">
                <div className="scm-company-name">{companyName}</div>
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
            <td className="scm-head-logo-cell">
              <div className="scm-head-logos">
                <img className="scm-head-logo" src={kemachLogo} alt="KEMACH" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Billing / shipping addresses */}
      <table className="scm-grid">
        <tbody>
          <tr>
            <td className="scm-half">
              <div className="scm-addr-title">Billing Address To :</div>
              {customerRecord?.customerCode && <div>Customer Code : {customerRecord.customerCode}</div>}
              <div className="scm-party">
                {order.customer || ''}
              </div>
              {billingAddr && <div className="scm-pre">{billingAddr}</div>}
              <div>GST Registration Number : {billingGstNumber}</div>
              <div>GST Registration Type : {billingGstType}</div>
              <div>PAN Number : {partnerPan(customerRecord, 'Billing')}</div>
            </td>
            <td className="scm-half">
              <div className="scm-addr-title">Shipping Address To :</div>
              {customerRecord?.customerCode && <div>Customer Code : {customerRecord.customerCode}</div>}
              <div className="scm-party">
                {order.customer || ''}
              </div>
              {shippingAddr && <div className="scm-pre">{shippingAddr}</div>}
              <div>GST Registration Number : {shippingGstNumber}</div>
              <div>GST Registration Type : {shippingGstType}</div>
              <div>PAN Number : {partnerPan(customerRecord, 'Shipping')}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Document details -- Sales Credit Memo's own fields. Invoice No is
          carried purely as a reference to the invoice this memo credits
          back against (there is no despatch/Buyer's Order/Ship Via concept
          on this document). Sales Employee prints blank on a reloaded
          record: SalesCreditMemo has no own salesPerson column in the
          schema, so nothing is there to read back after a save -- a
          pre-existing limitation of the underlying data, not this
          template. */}
      <table className="scm-grid">
        <tbody>
          <tr>
            <td className="scm-half">
              <div className="scm-kv"><span className="k">Credit Memo No</span><span className="c">:</span><span className="v">{order.creditNo || ''}</span></div>
              <div className="scm-kv"><span className="k">Credit Memo Date</span><span className="c">:</span><span className="v">{fmtDate(order.documentDate)}</span></div>
              <div className="scm-kv"><span className="k">Against Invoice No</span><span className="c">:</span><span className="v">{order.invoiceNo || ''}</span></div>
              <div className="scm-kv"><span className="k">Machine Serial No.</span><span className="c">:</span><span className="v">{order.machineSerialNo || ''}</span></div>
              <div className="scm-kv"><span className="k">Hypothecation</span><span className="c">:</span><span className="v">{order.hypothecation || ''}</span></div>
            </td>
            <td className="scm-half">
              <div className="scm-kv"><span className="k">Payment Terms</span><span className="c">:</span><span className="v">{order.paymentTerms || ''}</span></div>
              <div className="scm-kv"><span className="k">Sales Employee</span><span className="c">:</span><span className="v">{order.salesPerson || ''}</span></div>
              <div className="scm-kv"><span className="k">Engine No.</span><span className="c">:</span><span className="v">{order.engineNo || ''}</span></div>
              <div className="scm-kv"><span className="k">Customer PO No.</span><span className="c">:</span><span className="v">{order.customerRefNo || ''}</span></div>
              <div className="scm-kv"><span className="k">Due Date</span><span className="c">:</span><span className="v">{fmtDate(order.dueDate)}</span></div>
            </td>
          </tr>
          <tr>
            <td className="scm-half" colSpan={2}>
              <div className="scm-kv"><span className="k">Reason for Credit</span><span className="c">:</span><span className="v">{order.reason || ''}</span></div>
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );

  // Line items for one page -- same HSN/SAC grid and CGST/SGST/IGST/TCS
  // sub-row technique as SalesInvoicePrintable.jsx's own renderItemsTable.
  const renderItemsTable = (pageItems, startIndex) => (
    <table className="scm-grid scm-items scm-fill">
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
                <td className="scm-taxcell">{components[0].label} {components[0].pct.toFixed(2)}%</td>
                <td className="num">{fmtNum(components[0].amt)}</td>
                <td className="num" rowSpan={components.length}>{fmtNum(f.total)}</td>
              </tr>
              {components.slice(1).map((c) => (
                <tr key={c.label}>
                  <td className="scm-taxcell">{c.label} {c.pct.toFixed(2)}%</td>
                  <td className="num">{fmtNum(c.amt)}</td>
                </tr>
              ))}
            </React.Fragment>
          );
        })}
        <tr className="scm-fill-row">
          <td className="scm-fill-cell" colSpan={12} />
        </tr>
      </tbody>
    </table>
  );

  // Totals / HSN summary / bank details / declarations -- last page only.
  // Grand Total here INCLUDES Road Tax -- see computeTotals above.
  const renderFooterContent = () => (
    <>
      <table className="scm-grid">
        <tbody>
          <tr>
            <td className="scm-qty-cell">Total Qty <b>{fmtQty(totalQty)}</b></td>
            <td className="scm-total-label">Total</td>
            <td className="scm-total-value">{fmtNum(totals.taxableAmount + taxTotal)}</td>
          </tr>
          <tr>
            <td rowSpan={5} className="scm-words-cell">
              <div>Amount in Words. ({order.currency || 'INR'})</div>
              <div className="scm-words">{amountToWords(totals.grandTotal) || ''}</div>
            </td>
            <td className="scm-total-label">Road Tax</td>
            <td className="scm-total-value">{fmtNum(totals.roadTax)}</td>
          </tr>
          <tr>
            <td className="scm-total-label">Freight charges</td>
            <td className="scm-total-value">{fmtNum(totals.freightGrossAmount)}</td>
          </tr>
          <tr>
            <td className="scm-total-label">Round off</td>
            <td className="scm-total-value">{fmtNum(totals.roundOff)}</td>
          </tr>
          <tr>
            <td className="scm-total-label"><b>Grand Total</b></td>
            <td className="scm-total-value"><b>{fmtNum(totals.grandTotal)}</b></td>
          </tr>
        </tbody>
      </table>

      <table className="scm-grid scm-hsn">
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

      <table className="scm-grid">
        <tbody>
          <tr>
            <td>Tax Amount in Words. ({order.currency || 'INR'}) {amountToWords(taxTotal) || ''}</td>
          </tr>
        </tbody>
      </table>

      {/* Bank details -- from the House Bank master */}
      <table className="scm-grid">
        <tbody>
          <tr>
            <td colSpan={2} className="scm-bank-title">Company&apos;s Bank Details :</td>
          </tr>
          <tr>
            <td className="scm-bank-details">
              <div className="scm-kv"><span className="k">Beneficiary Name</span><span className="c">:</span><span className="v">{houseBank?.accountName || company?.companyName || ''}</span></div>
              <div className="scm-kv"><span className="k">Bank Name</span><span className="c">:</span><span className="v">{houseBank?.bankName || ''}</span></div>
              <div className="scm-kv"><span className="k">Branch</span><span className="c">:</span><span className="v">{houseBank?.branchName || ''}</span></div>
              <div className="scm-kv"><span className="k">A/c No.</span><span className="c">:</span><span className="v">{houseBank?.accountNumber || ''}</span></div>
              <div className="scm-kv"><span className="k">RTGS/IFSC Code</span><span className="c">:</span><span className="v">{houseBank?.ifscCode || ''}</span></div>
              <div className="scm-kv"><span className="k">Type</span><span className="c">:</span><span className="v">{houseBank?.accountType || ''}</span></div>
            </td>
            <td className="scm-bank-qr-cell">
              {houseBank?.qrCodeUrl && (
                <img className="scm-bank-qr" src={houseBank.qrCodeUrl} alt="Bank QR code" />
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Declarations + signature */}
      <table className="scm-grid scm-foot">
        <tbody>
          <tr>
            <td className="scm-foot-left">This is a Credit Note issued against the invoice referenced above.</td>
            <td className="scm-foot-right">For {companyName}</td>
          </tr>
          <tr>
            <td className="scm-foot-left">
              {order.narration
                ? <div className="scm-pre">{order.narration}</div>
                : (
                  <>
                    <div>All agreements contingent upon strikes, accidents and other conditions beyond our control.</div>
                    <div>All contracts are subject to approval by an office of the Company.</div>
                  </>
                )}
            </td>
            <td className="scm-foot-right scm-sign">
              {approverSignatureUrl ? <img className="scm-sign-img" src={approverSignatureUrl} alt="" style={order.salesCategory === 'Machine' ? { height: '96px', maxWidth: '70mm' } : undefined} /> : null}
              {order.salesCategory !== 'Machine' && <div>Authorized Signatory</div>}
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );

  // One physical page -- its own complete letterhead header/watermark/footer
  // in normal document flow. Same technique as SalesInvoicePrintable.jsx's
  // own renderPage.
  const renderPage = (page, pageIndex, startIndex) => (
    <div className="scm-sheet" key={pageIndex}>
      <div className="scm-page">
        <LetterheadHeader company={company} />
        <LetterheadWatermark />

        {page.isFirst && (
          <div className="scm-copy-title">
            <span className="scm-doc-title">CREDIT NOTE</span>
          </div>
        )}

        {page.isFirst && renderHeaderCards()}

        {renderItemsTable(page.items, startIndex)}

        {page.isLast && renderFooterContent()}

        <div className="scm-pagefoot">
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
    <div className="scm-print-area">
      <style>{`
        ${letterheadStyles('.scm-page', RULE_SPACING)}
        .scm-print-area { display: none; }
        @media print {
          body.${PRINTING_CLASS} #root { display: none !important; }
          body.${PRINTING_CLASS} .scm-print-area {
            display: block; width: 100%; box-sizing: border-box;
          }
          body.${PRINTING_CLASS} .scm-print-area,
          body.${PRINTING_CLASS} .scm-print-area * {
            visibility: visible;
          }
          @page { size: 210mm 297mm; margin: 0; }
          .scm-sheet { page-break-after: always; }
          .scm-sheet:last-child { page-break-after: auto; }
        }
        .scm-sheet {
          min-height: 100vh;
          box-sizing: border-box;
          padding: ${PAGE_MARGIN_MM}mm;
        }
        .scm-page {
          display: flex; flex-direction: column;
          min-height: calc(100vh - ${PAGE_MARGIN_MM * 2}mm);
          box-sizing: border-box;
          padding-top: ${LETTERHEAD_TOP_MM}mm;
          padding-bottom: ${LETTERHEAD_BOTTOM_MM}mm;
        }
        table.scm-items.scm-fill { flex: 1 1 0; min-height: 0; }
        .scm-fill-row, .scm-fill-cell { height: 100%; }
        .scm-print-area { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 10.5px; }
        .scm-copy-title { text-align: center; font-weight: 700; font-size: 15px; margin-bottom: 2px; }

        table.scm-grid { width: 100%; border-collapse: collapse; table-layout: fixed; flex-shrink: 0; }
        table.scm-grid td, table.scm-grid th {
          border: ${GRID_BORDER_PX}px solid #000; padding: 1px 4px; vertical-align: top;
        }
        table.scm-grid + table.scm-grid { margin-top: -${GRID_BORDER_PX}px; }
        .scm-half { width: 50%; }
        .num { text-align: right; }

        .scm-company-name { font-weight: 700; font-size: 11.5px; margin-bottom: 1px; }
        .scm-head-company { width: 62%; }
        .scm-head-logo-cell { padding-left: 5mm; vertical-align: middle; width: 38%; }
        .scm-head-logos {
          display: flex; align-items: center; justify-content: flex-start;
          gap: 3mm; margin-bottom: 0;
        }
        .scm-head-logo {
          width: 32mm; height: auto;
          image-rendering: -webkit-optimize-contrast;
          -webkit-print-color-adjust: exact; print-color-adjust: exact;
        }

        .scm-kv { display: flex; gap: 4px; line-height: 1.35; }
        .scm-kv .k { flex: 0 0 42%; }
        .scm-kv .c { flex: 0 0 4px; }
        .scm-kv .v { flex: 1; font-weight: 600; }

        .scm-addr-title { font-weight: 400; margin-bottom: 2px; }
        .scm-party { font-weight: 400; }
        .scm-pre { white-space: pre-line; line-height: 1.35; }

        table.scm-items th { font-weight: 700; text-align: center; font-size: 9.5px; }
        table.scm-items td { font-size: 9.5px; }
        table.scm-items td.num { font-size: 8px; white-space: nowrap; }
        table.scm-items .w-sn { width: 3.5%; }
        table.scm-items .w-code { width: 9%; }
        table.scm-items .w-desc { width: 22%; }
        table.scm-items .w-hsn { width: 7%; }
        table.scm-items .w-um { width: 5%; }
        table.scm-items .w-qty { width: 5%; }
        table.scm-items .w-price { width: 8.5%; }
        table.scm-items .w-disc { width: 5.5%; }
        table.scm-items .w-ass { width: 9%; }
        table.scm-items .w-tax { width: 9.5%; }
        table.scm-items .w-taxamt { width: 8%; }
        table.scm-items .w-amt { width: 8%; }
        .scm-taxcell { white-space: nowrap; }

        .scm-qty-cell { width: 62%; }
        .scm-total-label { width: 22%; }
        .scm-total-value { width: 16%; text-align: right; }
        .scm-words-cell { vertical-align: top; }
        .scm-words { font-weight: 600; text-transform: uppercase; }

        table.scm-hsn th, table.scm-hsn td { font-size: 9.5px; }
        table.scm-hsn th { font-weight: 700; }

        .scm-bank-title { font-weight: 700; border-bottom: none; }
        .scm-bank-details { width: 70%; }
        .scm-bank-qr-cell { width: 30%; text-align: center; vertical-align: middle; }
        .scm-bank-qr { width: 22mm; height: 22mm; object-fit: contain; image-rendering: pixelated; }

        table.scm-foot .scm-foot-left { width: 62%; line-height: 1.45; }
        table.scm-foot .scm-foot-right { width: 38%; text-align: right; }
        table.scm-foot .scm-sign { height: 46px; vertical-align: bottom; }
        .scm-sign-img { display: block; margin: 0 6mm 2px auto; height: 52px; max-width: 40mm; width: auto; object-fit: contain; }

        .scm-pagefoot { display: flex; justify-content: space-between; padding: 3px 2px 0; font-size: 9px; }
      `}</style>

      {renderAllPages()}
    </div>,
    document.body
  );
}

// Memoized -- same reasoning as SalesInvoicePrintable.jsx's own default
// export: this whole A4 sheet is rendered unconditionally (hidden via CSS
// rather than conditionally mounted), so without this it would rebuild on
// every keystroke in the form.
export default React.memo(SalesCreditMemoPrintable);
