import React from 'react';
import { createPortal } from 'react-dom';
import dayjs from 'dayjs';
import { amountToWords } from '../../lib/numberToWords';
import { round2, buildDocument, isInterState, taxComponentRows } from '../../lib/documentTotals';
import { branchAddressLines } from '../../lib/branchAddress';
import { warehouseLabel } from '../../lib/useWarehouseOptions';
import {
  LetterheadHeader, LetterheadWatermark, LetterheadFooter, letterheadStyles,
  LETTERHEAD_TOP_MM, LETTERHEAD_BOTTOM_MM,
} from './Letterhead';
import { makeScopedPrint } from './purchaseStationery';
import { useIsActiveTab } from '../navigation/TabPathContext';

// A4 PORTRAIT print screen for Stock Transfer Receipt — visual twin of
// StockTransferPrintable.jsx / StockTransferRequestPrintable.jsx (same
// Letterhead template, same body layout). A Receipt has no toBranch field of
// its own — order.branch is the branch the stock is being RECEIVED INTO,
// same "From Branch" naming convention every other stock document already
// uses for its own branch field — so the page passes down order.transferType
// / order.toBranch computed from whichever source Stock Transfer or Stock
// Transfer Request this receipt was raised against, exactly mirroring how
// isBranchTransfer/toBranch already work on those two documents. Tax is a
// real CGST/SGST/IGST split (same documentTotals.js engine every Sales/
// Purchase document uses), with intra-/inter-state decided by comparing the
// From Branch's (order.branch) state to the To Branch's (order.toBranch,
// computed above) state — see resolveStockTransferReceiptTaxTreatment in
// routes/resources.js and StockTransferPrintable.jsx's identical note.

const GRID_BORDER_PX = 1;
const PAGE_MARGIN_MM = 6;

const RULE_SPACING = {
  headerAbove: 3.5,
  headerBelow: 0,
  footerAbove: 2,
  footerBelow: 1.5,
};

const AREA_CLASS = 'strcp-print-area';
const PRINTING_CLASS = 'strcp-printing';
const PAGE_RULE_ID = 'strcp-print-page-rule';

export const printStockTransferReceipt = makeScopedPrint({ printingClass: PRINTING_CLASS, pageRuleId: PAGE_RULE_ID });

const fmtDate = (d) => (d ? dayjs(d).format('DD-MMM-YYYY') : '');
const fmtNum = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtQty = (n) => {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

// A line's amount is quantity x item cost, same as StockTransferReceipt.jsx's
// own computeTotals.
function lineAmount(it) {
  return round2((Number(it.quantity) || 0) * (Number(it.itemCost ?? it.unitPrice) || 0));
}

function StockTransferReceiptPrintable({ order, company, branches, warehouses }) {
  const isActive = useIsActiveTab();

  React.useEffect(() => {
    if (!isActive) return;
    const onBefore = () => document.body.classList.add(PRINTING_CLASS);
    const onAfter = () => document.body.classList.remove(PRINTING_CLASS);
    window.addEventListener('beforeprint', onBefore);
    window.addEventListener('afterprint', onAfter);
    return () => {
      window.removeEventListener('beforeprint', onBefore);
      window.removeEventListener('afterprint', onAfter);
      document.body.classList.remove(PRINTING_CLASS);
    };
  }, [isActive]);

  if (!order || !isActive) return null;

  const items = order.items || [];
  const isBranchTransfer = order.transferType === 'Branch Transfer';
  const totalQty = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  // Full "CODE — NAME" label for a warehouse code — see
  // StockTransferPrintable.jsx's identical note.
  const warehousesByCode = new Map((warehouses || []).map((w) => [w.whsCode, w]));
  const whseLabel = (code) => {
    if (!code) return '';
    const found = warehousesByCode.get(code);
    return found ? warehouseLabel(found) : String(code);
  };
  // Address lines for the From/To Branch boxes — see
  // StockTransferRequestPrintable.jsx's identical note.
  const fromBranchRecord = (branches || []).find((b) => String(b.branchName || '').trim() === String(order.branch || '').trim());
  const toBranchRecord = (branches || []).find((b) => String(b.branchName || '').trim() === String(order.toBranch || '').trim());
  const fromBranchLines = branchAddressLines(fromBranchRecord);
  const toBranchLines = isBranchTransfer ? branchAddressLines(toBranchRecord) : [];
  // Same interState rule as StockTransferPrintable.jsx.
  const interState = isBranchTransfer
    ? isInterState(toBranchRecord?.state || '', fromBranchRecord?.state || '')
    : false;
  // Same shared engine every Sales/Purchase document's print screen uses —
  // no header Discount % on this document. See StockTransferPrintable.jsx's
  // identical note on why a re-printed saved record won't show a '+TCS' Tax
  // Code's TCS carve-out (taxType isn't persisted per line, only taxPercent/
  // taxCodeId are).
  const lines = items.map((it) => ({
    quantity: it.quantity,
    unitPrice: it.itemCost ?? it.unitPrice,
    taxPercent: it.taxPercent,
    taxType: it.taxType || '',
  }));
  const { totals } = buildDocument(lines, 0, { interState, roundOff: true });
  const taxRows = taxComponentRows(totals, interState);
  const taxableValue = totals.taxableAmount;
  const freightCharges = 0;
  const roundOff = totals.roundOff;
  const grandTotal = round2(totals.amount + freightCharges);
  const totalsRowCount = 1 + taxRows.length + 2 + 1; // Taxable Amount + tax rows + Freight + Round off + Grand Total

  const renderCopy = () => {
    const footer = <LetterheadFooter company={company} />;

    return (
      <div className="strcp-sheet">
      <div className="strcp-page">
        <LetterheadHeader company={company} />
        <LetterheadWatermark />

      <div className="strcp-copy-title">
        <span className="strcp-doc-title">BRANCH TRANSFER - BTA RECEIPT</span>
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
            <th className="num w-price">Unit<br />Price</th>
            <th className="num w-tax">Tax<br />%</th>
            <th className="num w-amt">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={idx}>
              <td>{idx + 1}</td>
              <td>{it.productCode || ''}</td>
              <td>{it.productName || ''}</td>
              <td>{whseLabel(it.fromWarehouse)}</td>
              <td>{whseLabel(it.toWarehouse)}</td>
              <td className="num">{fmtQty(it.quantity)}</td>
              <td className="num">{fmtNum(it.itemCost ?? it.unitPrice)}</td>
              <td className="num">{fmtQty(it.taxPercent)}</td>
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

      {/* Totals — Taxable Amount + CGST/SGST (or IGST) + Freight + Round off
          + Grand Total — see StockTransferPrintable.jsx's identical note. */}
      <table className="strcp-grid">
        <tbody>
          <tr>
            <td rowSpan={totalsRowCount} className="strcp-words-cell">
              <div>Amount in Words. (INR)</div>
              <div className="strcp-words">{amountToWords(grandTotal) || ''}</div>
              <div className="strcp-remarks-title" style={{ marginTop: 8 }}>Remarks</div>
              <div>{order.remarks || ''}</div>
              <div style={{ marginTop: 8 }}><b>Prepared By :</b> {order.preparedBy || ''}</div>
            </td>
            <td className="strcp-total-label">Taxable Amount</td>
            <td className="strcp-total-value">{fmtNum(taxableValue)}</td>
          </tr>
          {taxRows.map((r) => (
            <tr key={r.label}>
              <td className="strcp-total-label">{r.label}</td>
              <td className="strcp-total-value">{fmtNum(r.amount)}</td>
            </tr>
          ))}
          <tr>
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

  const content = (
    <div className={AREA_CLASS}>
      <style>{`
        ${letterheadStyles('.strcp-page', RULE_SPACING)}
        .${AREA_CLASS} { display: none; }
        @media print {
          body.${PRINTING_CLASS} #root { display: none !important; }
          body.${PRINTING_CLASS} .${AREA_CLASS} {
            display: block !important; width: 100%; box-sizing: border-box;
          }
          body.${PRINTING_CLASS} .${AREA_CLASS},
          body.${PRINTING_CLASS} .${AREA_CLASS} * {
            visibility: visible;
          }
          @page { size: 210mm 297mm; margin: 0; }
          .strcp-sheet { page-break-after: always; }
          .strcp-sheet:last-child { page-break-after: auto; }
        }
        .strcp-sheet {
          min-height: 100vh;
          box-sizing: border-box;
          padding: ${PAGE_MARGIN_MM}mm;
        }
        .strcp-page {
          display: flex; flex-direction: column;
          min-height: calc(100vh - ${PAGE_MARGIN_MM * 2}mm);
          box-sizing: border-box;
          padding-top: ${LETTERHEAD_TOP_MM}mm;
          padding-bottom: ${LETTERHEAD_BOTTOM_MM}mm;
        }
        .${AREA_CLASS} { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 15px; }
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
        .strcp-kv .k { flex: 0 0 110px; }
        .strcp-kv .c { flex: 0 0 4px; }
        .strcp-kv .v { flex: 1; font-weight: 600; }

        .stp-addr-title, .strcp-addr-title { font-weight: 700; }
        .stp-addr-name, .strcp-addr-name { font-weight: 600; }
        .stp-addr-line, .strcp-addr-line { font-size: 13px; line-height: 1.4; }

        table.strcp-items th { font-weight: 700; text-align: center; font-size: 14px; }
        table.strcp-items td { font-size: 14px; }
        table.strcp-items .w-sn { width: 5%; }
        table.strcp-items .w-code { width: 11%; }
        table.strcp-items .w-desc { width: 17%; }
        table.strcp-items .w-from { width: 13%; }
        table.strcp-items .w-to { width: 13%; }
        table.strcp-items .w-qty { width: 9%; }
        table.strcp-items .w-price { width: 10%; }
        table.strcp-items .w-tax { width: 8%; }
        table.strcp-items .w-amt { width: 14%; }

        .strcp-total-label { width: 22%; }
        .strcp-total-value { width: 16%; text-align: right; }
        .strcp-words-cell { vertical-align: top; }
        .strcp-words { font-weight: 600; text-transform: uppercase; }

        table.strcp-foot .strcp-foot-left { width: 62%; line-height: 1.5; }
        table.strcp-foot .strcp-foot-right { width: 38%; text-align: right; }
        table.strcp-foot tr:first-child td { border-bottom: none; padding-bottom: 46px; }
        table.strcp-foot tr:last-child td { border-top: none; }
        .strcp-remarks-title { font-weight: 700; margin-bottom: 2px; }
        table.strcp-foot .strcp-sign { height: 46px; vertical-align: bottom; }

        .strcp-pagefoot { display: flex; justify-content: space-between; padding: 4px 2px 0; font-size: 12px; }
      `}</style>

      {renderCopy()}
    </div>
  );

  return typeof document === 'undefined' ? content : createPortal(content, document.body);
}

// Memoized — this whole A4 sheet is rendered unconditionally (hidden via
// display:none, shown only under @media print) so without this it would be
// rebuilt on every keystroke in the live form.
export default React.memo(StockTransferReceiptPrintable);
