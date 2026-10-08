import React from 'react';
import dayjs from 'dayjs';
import { amountToWords } from '../../lib/numberToWords';
import { round2 } from '../../lib/documentTotals';
import { branchAddressLines } from '../../lib/branchAddress';
import {
  LetterheadHeader, LetterheadWatermark, LetterheadFooter, letterheadStyles,
  LETTERHEAD_TOP_MM, LETTERHEAD_BOTTOM_MM,
} from './Letterhead';

// A4 PORTRAIT print screen for Stock Transfer Receipt — visual twin of
// StockTransferPrintable.jsx / StockTransferRequestPrintable.jsx (same
// Letterhead template, same body layout). A Receipt has no toBranch field of
// its own — order.branch is the branch the stock is being RECEIVED INTO,
// same "From Branch" naming convention every other stock document already
// uses for its own branch field — so the page passes down order.transferType
// / order.toBranch computed from whichever source Stock Transfer or Stock
// Transfer Request this receipt was raised against, exactly mirroring how
// isBranchTransfer/toBranch already work on those two documents. No GST/tax
// fields exist here either — see StockTransferPrintable.jsx's identical note.

const GRID_BORDER_PX = 1;
const PAGE_MARGIN_MM = 6;

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

// A line's amount is quantity x item cost — no tax engine involved, same as
// StockTransferReceipt.jsx's own computeTotals.
function lineAmount(it) {
  return round2((Number(it.quantity) || 0) * (Number(it.itemCost ?? it.unitPrice) || 0));
}

function StockTransferReceiptPrintable({ order, company, branches }) {
  if (!order) return null;

  const items = order.items || [];
  const isBranchTransfer = order.transferType === 'Branch Transfer';
  const totalQty = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  // Address lines for the From/To Branch boxes — see
  // StockTransferRequestPrintable.jsx's identical note.
  const fromBranchRecord = (branches || []).find((b) => String(b.branchName || '').trim() === String(order.branch || '').trim());
  const toBranchRecord = (branches || []).find((b) => String(b.branchName || '').trim() === String(order.toBranch || '').trim());
  const fromBranchLines = branchAddressLines(fromBranchRecord);
  const toBranchLines = isBranchTransfer ? branchAddressLines(toBranchRecord) : [];
  const taxableValue = round2(items.reduce((s, i) => s + lineAmount(i), 0));
  // No tax/freight fields exist on a Stock Transfer Receipt — kept as named,
  // computed variables so a future field on the document flows through here
  // without hunting for magic numbers, but both are honestly 0 today.
  const taxAmount = 0;
  const freightCharges = 0;
  const roundOff = round2(Math.round(taxableValue + taxAmount + freightCharges) - (taxableValue + taxAmount + freightCharges));
  const grandTotal = round2(taxableValue + taxAmount + freightCharges + roundOff);

  const renderCopy = () => {
    const footer = <LetterheadFooter company={company} />;

    return (
      <div className="strcp-sheet">
      <div className="strcp-page">
        <LetterheadHeader company={company} />
        <LetterheadWatermark />

      <div className="strcp-copy-title">
        <span className="strcp-doc-title">STOCK TRANSFER RECEIPT</span>
      </div>

      {/* Document details */}
      <table className="strcp-grid">
        <tbody>
          <tr>
            <td className="strcp-half">
              <div className="strcp-addr-title">From Branch</div>
              <div className="strcp-addr-name">{order.branch || ''}</div>
              {fromBranchLines.map((line, i) => (<div key={i} className="strcp-addr-line">{line}</div>))}
            </td>
            <td className="strcp-half">
              <div className="strcp-addr-title">To Branch</div>
              <div className="strcp-addr-name">{isBranchTransfer ? (order.toBranch || '') : '—'}</div>
              {toBranchLines.map((line, i) => (<div key={i} className="strcp-addr-line">{line}</div>))}
            </td>
          </tr>
          <tr>
            <td className="strcp-half" colSpan={2}>
              <div className="strcp-kv"><span className="k">Type</span><span className="c">:</span><span className="v">{order.transferType || ''}</span></div>
              <div className="strcp-kv"><span className="k">Receipt No</span><span className="c">:</span><span className="v">{order.receiptNo || ''}</span></div>
              <div className="strcp-kv"><span className="k">Receipt Date</span><span className="c">:</span><span className="v">{fmtDate(order.transferDate)}</span></div>
              <div className="strcp-kv"><span className="k">Document Date</span><span className="c">:</span><span className="v">{fmtDate(order.documentDate)}</span></div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Line items — sized to its own rows, not stretched to fill the
          page itself (see strcp-spacer below, which is what pushes the
          totals/remarks/signature block down to the bottom of the sheet). */}
      <table className="strcp-grid strcp-items">
        <thead>
          <tr>
            <th className="w-sn">S.<br />No</th>
            <th className="w-code">Item No.</th>
            <th className="w-desc">Item Name / Description</th>
            <th className="w-from">From<br />Whse</th>
            <th className="w-to">To<br />Whse</th>
            <th className="num w-qty">Qty</th>
            <th className="num w-price">Item<br />Cost</th>
            <th className="num w-amt">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={idx}>
              <td>{idx + 1}</td>
              <td>{it.productCode || ''}</td>
              <td>{it.productName || ''}</td>
              <td>{it.fromWarehouse || ''}</td>
              <td>{it.toWarehouse || ''}</td>
              <td className="num">{fmtQty(it.quantity)}</td>
              <td className="num">{fmtNum(it.itemCost ?? it.unitPrice)}</td>
              <td className="num">{fmtNum(lineAmount(it))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Flex spacer — absorbs whatever vertical space the item table
          didn't use, so the totals/remarks/signature block below it sits at
          the bottom of the sheet, right above the footer. */}
      <div className="strcp-spacer" />

      {/* Total Qty / Total line, directly above Amount in Words. */}
      <table className="strcp-grid">
        <tbody>
          <tr>
            <td className="strcp-half"><b>Total Qty</b> : {fmtQty(totalQty)}</td>
            <td className="strcp-half num"><b>Total</b> : {fmtNum(taxableValue)}</td>
          </tr>
        </tbody>
      </table>

      {/* Totals — no HSN breakup, just quantity and value. */}
      <table className="strcp-grid">
        <tbody>
          <tr>
            <td rowSpan={3} className="strcp-words-cell">
              <div className="strcp-words-section">
                <div>Amount in Words. (INR)</div>
                <div className="strcp-words">{amountToWords(grandTotal) || ''}</div>
              </div>
              <div className="strcp-words-section">
                <div className="strcp-remarks-title">Remarks</div>
                <div>{order.remarks || ''}</div>
              </div>
              <div>
                <div className="strcp-remarks-title">Prepared By</div>
                <div>{order.preparedBy || ''}</div>
              </div>
            </td>
            <td className="strcp-total-label">Freight charges</td>
            <td className="strcp-total-value">{fmtNum(freightCharges)}</td>
          </tr>
          <tr>
            <td className="strcp-total-label">Round off</td>
            <td className="strcp-total-value">{fmtNum(roundOff)}</td>
          </tr>
          <tr>
            <td className="strcp-total-label"><b>GRAND TOTAL</b></td>
            <td className="strcp-total-value"><b>{fmtNum(grandTotal)}</b></td>
          </tr>
        </tbody>
      </table>

      {/* Signature */}
      <table className="strcp-grid strcp-foot">
        <tbody>
          <tr>
            <td className="strcp-foot-left" />
            <td className="strcp-foot-right">For {(company?.companyName || 'KEMACH EQUIPMENTS PRIVATE LIMITED').toUpperCase()}</td>
          </tr>
          <tr>
            <td className="strcp-foot-left" />
            <td className="strcp-foot-right strcp-sign">
              <div>Authorized Signatory</div>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="strcp-pagefoot">
        <span>{company?.phone ? `Ph No : ${company.phone}` : ''}</span>
        <span>{company?.email ? `Email Id : ${company.email}` : ''}</span>
        <span>Page 1 of 1</span>
      </div>

      {footer}
      </div>
      </div>
    );
  };

  return (
    <div className="strcp-print-area">
      <style>{`
        ${letterheadStyles('.strcp-page', RULE_SPACING)}
        .strcp-print-area { display: none; }
        @media print {
          html, body {
            width: 100vw !important; height: 100vh !important;
            margin: 0 !important; overflow: hidden !important;
          }
          body * { visibility: hidden; }
          .strcp-print-area, .strcp-print-area * { visibility: visible; }
          .strcp-print-area {
            display: block; position: absolute; top: 0; left: 0; width: 100%;
            box-sizing: border-box;
          }
          @page { size: 210mm 297mm; margin: 0; }
          .strcp-sheet { page-break-after: always; }
          .strcp-sheet:last-child { page-break-after: auto; }
        }
        .strcp-sheet {
          height: 100vh;
          box-sizing: border-box;
          padding: ${PAGE_MARGIN_MM}mm;
        }
        .strcp-page {
          display: flex; flex-direction: column;
          height: 100%;
          min-height: 100%;
          box-sizing: border-box;
          padding-top: ${LETTERHEAD_TOP_MM}mm;
          padding-bottom: ${LETTERHEAD_BOTTOM_MM}mm;
        }
        .strcp-print-area { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 15px; }
        .strcp-copy-title { text-align: center; font-weight: 700; font-size: 20px; margin-bottom: 4px; }

        /* Spacer between the item table and the totals block — see
           StockTransferPrintable.jsx's identical note. */
        .strcp-spacer {
          flex: 1 1 auto; min-height: 0;
          border: ${GRID_BORDER_PX}px solid #000; border-top: none;
          box-sizing: border-box;
        }

        table.strcp-grid { width: 100%; border-collapse: collapse; table-layout: fixed; flex-shrink: 0; }
        table.strcp-grid td, table.strcp-grid th {
          border: ${GRID_BORDER_PX}px solid #000; padding: 5px 6px; vertical-align: top;
        }
        table.strcp-grid + table.strcp-grid { margin-top: -${GRID_BORDER_PX}px; }
        .strcp-items + .strcp-spacer,
        table.strcp-grid + .strcp-spacer { margin-top: -${GRID_BORDER_PX}px; }
        .strcp-spacer + table.strcp-grid { margin-top: -${GRID_BORDER_PX}px; }
        .strcp-half { width: 50%; }
        .num { text-align: right; }

        .strcp-kv { display: flex; gap: 4px; line-height: 1.5; }
        .strcp-kv .k { flex: 0 0 42%; }
        .strcp-kv .c { flex: 0 0 4px; }
        .strcp-kv .v { flex: 1; font-weight: 600; }

        .strcp-addr-title { font-weight: 700; }
        .strcp-addr-name { font-weight: 600; }
        .strcp-addr-line { font-size: 13px; line-height: 1.4; }

        table.strcp-items th { font-weight: 700; text-align: center; font-size: 14px; }
        table.strcp-items td { font-size: 14px; }
        table.strcp-items .w-sn { width: 5%; }
        table.strcp-items .w-code { width: 12%; }
        table.strcp-items .w-desc { width: 25%; }
        table.strcp-items .w-from { width: 14%; }
        table.strcp-items .w-to { width: 14%; }
        table.strcp-items .w-qty { width: 10%; }
        table.strcp-items .w-price { width: 10%; }
        table.strcp-items .w-amt { width: 10%; }

        .strcp-total-label { width: 22%; }
        .strcp-total-value { width: 16%; text-align: right; }
        .strcp-words-cell { vertical-align: top; }
        .strcp-words { font-weight: 600; text-transform: uppercase; }
        .strcp-words-section { border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 4px; }

        table.strcp-foot .strcp-foot-left { width: 62%; line-height: 1.5; }
        table.strcp-foot .strcp-foot-right { width: 38%; text-align: right; }
        table.strcp-foot tr:last-child td { border-top: none; }
        .strcp-remarks-title { font-weight: 700; margin-bottom: 2px; }
        table.strcp-foot .strcp-sign { height: 46px; vertical-align: bottom; }

        .strcp-pagefoot { display: flex; justify-content: space-between; padding: 4px 2px 0; font-size: 12px; }
      `}</style>

      {renderCopy()}
    </div>
  );
}

// Memoized — this whole A4 sheet is rendered unconditionally (hidden via
// display:none, shown only under @media print) so without this it would be
// rebuilt on every keystroke in the live form.
export default React.memo(StockTransferReceiptPrintable);
