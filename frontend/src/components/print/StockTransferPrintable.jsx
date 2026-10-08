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

// A4 PORTRAIT print screen for Stock Transfer — same template as
// DeliveryChallanPrintable.jsx: the shared Letterhead header (KEMACH logo
// left, company name/address centre, QR right, red brand rule), the same
// watermark, and the same footer (registered office + CIN, email/branches,
// the four partner logos). Only the document body differs — Stock Transfer
// moves stock between this company's own warehouses, not to a customer, so
// Freight Charges stays 0.00 — but its tax IS a real CGST/SGST/IGST split
// (same documentTotals.js engine every Sales/Purchase document uses), with
// intra-/inter-state decided by comparing the From Branch's state to the To
// Branch's state instead of a customer's place of supply — see
// resolveStockTransferTaxTreatment in routes/resources.js and the identical
// interState calc in StockTransfer.jsx's own computeTotals.

const GRID_BORDER_PX = 1;
const PAGE_MARGIN_MM = 6;

const RULE_SPACING = {
  headerAbove: 3.5,
  headerBelow: 0,
  footerAbove: 2,
  footerBelow: 1.5,
};

const AREA_CLASS = 'stp-print-area';
const PRINTING_CLASS = 'stp-printing';
const PAGE_RULE_ID = 'stp-print-page-rule';

export const printStockTransfer = makeScopedPrint({ printingClass: PRINTING_CLASS, pageRuleId: PAGE_RULE_ID });

const fmtDate = (d) => (d ? dayjs(d).format('DD-MMM-YYYY') : '');
const fmtNum = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtQty = (n) => {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

// A line's amount is tax-inclusive: quantity x item cost x (1 + tax% / 100),
// matching StockTransfer.jsx's own lineTotal (the on-screen Total (LC) cell).
function lineAmount(it) {
  const quantity = Number(it.quantity) || 0;
  const unitPrice = Number(it.itemCost ?? it.unitPrice) || 0;
  const taxPercent = Number(it.taxPercent) || 0;
  return round2(quantity * unitPrice * (1 + taxPercent / 100));
}

function StockTransferPrintable({ order, company, branches, warehouses }) {
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
  // useWarehouseOptions.js's own warehouseLabel. Falls back to the raw code
  // when the warehouse isn't found, same as useWarehouseLabeller's own rule,
  // so a legacy/removed warehouse still prints something rather than blank.
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
  // Same interState rule as StockTransfer.jsx's own computeTotals — a plain
  // Stock Transfer (no To Branch) always falls back to intra-state.
  const interState = isBranchTransfer
    ? isInterState(toBranchRecord?.state || '', fromBranchRecord?.state || '')
    : false;
  // Same shared engine every Sales/Purchase document's print screen uses —
  // no header Discount % on this document, so 0 is passed for it. A line's
  // own taxType only rides along when the order came straight off the live
  // form (StockTransfer.jsx's watch()); a reloaded/saved record has no
  // persisted taxType (see toStockTransferItemData — only taxPercent/
  // taxCodeId are stored), so a '+TCS' Tax Code's TCS carve-out won't show
  // on a re-printed saved document, only CGST/SGST/IGST will — an accepted
  // gap, not a bug, same reasoning as every other print screen that only
  // reads what's actually persisted.
  const lines = items.map((it) => ({
    quantity: it.quantity,
    unitPrice: it.itemCost ?? it.unitPrice,
    taxPercent: it.taxPercent,
    taxType: it.taxType || '',
  }));
  const { totals } = buildDocument(lines, 0, { interState, roundOff: true });
  const taxRows = taxComponentRows(totals, interState);
  const taxableValue = totals.taxableAmount;
  // Sum of the tax-inclusive per-line Totals shown in the item table above —
  // what the "Total Qty / Total" recap line below should show, not the
  // pre-tax taxableValue (which belongs in the Taxable Amount row of the
  // CGST/SGST/IGST breakdown further down).
  const totalInclusive = items.reduce((s, it) => s + lineAmount(it), 0);
  const freightCharges = 0;
  const roundOff = totals.roundOff;
  const grandTotal = round2(totals.amount + freightCharges);
  // Amount-in-words / Remarks / Prepared By all sit in one rowSpan cell
  // (same pattern as DeliveryChallanPrintable.jsx) so the totals column can
  // carry however many rows CGST/SGST (or IGST) need without the left side
  // repeating or leaving blank rows.
  const totalsRowCount = 1 + taxRows.length + 2 + 1; // Taxable Amount + tax rows + Freight + Round off + Grand Total

  const renderCopy = () => {
    const footer = <LetterheadFooter company={company} />;

    return (
      <div className="stp-sheet">
      <div className="stp-page">
        <LetterheadHeader company={company} />
        <LetterheadWatermark />

      <div className="stp-copy-title">
        <span className="stp-doc-title">BRANCH TRANSFER - BTA</span>
      </div>

      {/* Document details */}
      <table className="stp-grid">
        <tbody>
          <tr>
            <td className="stp-half">
              <div className="stp-addr-title">From Branch</div>
              <div className="stp-addr-name">{order.branch || ''}</div>
              {fromBranchLines.map((line, i) => (<div key={i} className="stp-addr-line">{line}</div>))}
            </td>
            <td className="stp-half">
              <div className="stp-addr-title">To Branch</div>
              <div className="stp-addr-name">{isBranchTransfer ? (order.toBranch || '') : '—'}</div>
              {toBranchLines.map((line, i) => (<div key={i} className="stp-addr-line">{line}</div>))}
            </td>
          </tr>
          <tr>
            <td className="stp-half" colSpan={2}>
              <div className="stp-kv"><span className="k">Type</span><span className="c">:</span><span className="v">{order.transferType || ''}</span></div>
              <div className="stp-kv"><span className="k">Transfer No</span><span className="c">:</span><span className="v">{order.transferNo || ''}</span></div>
              <div className="stp-kv"><span className="k">Transfer Date</span><span className="c">:</span><span className="v">{fmtDate(order.requestDate)}</span></div>
              <div className="stp-kv"><span className="k">Document Date</span><span className="c">:</span><span className="v">{fmtDate(order.documentDate)}</span></div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Line items — sized to its own rows, not stretched to fill the
          page itself (see stp-spacer below, which is what pushes the
          totals/remarks/signature block down to the bottom of the sheet). */}
      <table className="stp-grid stp-items">
        <thead>
          <tr>
            <th className="w-sn">S.<br />No</th>
            <th className="w-code">Item No.</th>
            <th className="w-desc">Item Name / Description</th>
            <th className="w-from">From<br />Whse</th>
            <th className="w-to">To<br />Whse</th>
            <th className="num w-stock">Total<br />Stock</th>
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
              <td className="num">{fmtQty(it.totalStock)}</td>
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
          the bottom of the sheet, right above the footer, instead of
          bunching up immediately under a short item table with a dead gap
          left dangling before the footer. */}
      <div className="stp-spacer" />

      {/* Total Qty / Total line, directly above Amount in Words. */}
      <table className="stp-grid">
        <tbody>
          <tr>
            <td className="stp-half"><b>Total Qty</b> : {fmtQty(totalQty)}</td>
            <td className="stp-half num"><b>Total</b> : {fmtNum(totalInclusive)}</td>
          </tr>
        </tbody>
      </table>

      {/* Totals — Taxable Amount + CGST/SGST (or IGST) + Freight + Round off
          + Grand Total, same shape as every Sales/Purchase print screen's
          own totals block (see StockTransfer.jsx's computeTotals/
          DocumentTotalsPanel for the on-screen twin of this). The words/
          remarks/prepared-by column spans every one of these rows (same
          rowSpan pattern as DeliveryChallanPrintable.jsx) so it never
          repeats or leaves a blank cell regardless of how many tax rows
          there are. */}
      <table className="stp-grid">
        <tbody>
          <tr>
            <td rowSpan={totalsRowCount} className="stp-words-cell">
              <div>Amount in Words. (INR)</div>
              <div className="stp-words">{amountToWords(grandTotal) || ''}</div>
              <div className="stp-remarks-title" style={{ marginTop: 8 }}>Remarks</div>
              <div>{order.remarks || ''}</div>
              <div style={{ marginTop: 8 }}><b>Prepared By :</b> {order.preparedBy || ''}</div>
            </td>
            <td className="stp-total-label">Taxable Amount</td>
            <td className="stp-total-value">{fmtNum(taxableValue)}</td>
          </tr>
          {taxRows.map((r) => (
            <tr key={r.label}>
              <td className="stp-total-label">{r.label}</td>
              <td className="stp-total-value">{fmtNum(r.amount)}</td>
            </tr>
          ))}
          <tr>
            <td className="stp-total-label">Freight charges</td>
            <td className="stp-total-value">{fmtNum(freightCharges)}</td>
          </tr>
          <tr>
            <td className="stp-total-label">Round off</td>
            <td className="stp-total-value">{fmtNum(roundOff)}</td>
          </tr>
          <tr>
            <td className="stp-total-label"><b>GRAND TOTAL</b></td>
            <td className="stp-total-value"><b>{fmtNum(grandTotal)}</b></td>
          </tr>
        </tbody>
      </table>

      {/* Signature */}
      <table className="stp-grid stp-foot">
        <tbody>
          <tr>
            <td className="stp-foot-left" />
            <td className="stp-foot-right">For {(company?.companyName || 'KEMACH EQUIPMENTS PRIVATE LIMITED').toUpperCase()}</td>
          </tr>
          <tr>
            <td className="stp-foot-left" />
            <td className="stp-foot-right stp-sign">
              <div>Authorized Signatory</div>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="stp-pagefoot">
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
        ${letterheadStyles('.stp-page', RULE_SPACING)}
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
          .stp-sheet { page-break-after: always; }
          .stp-sheet:last-child { page-break-after: auto; }
        }
        .stp-sheet {
          min-height: 100vh;
          box-sizing: border-box;
          padding: ${PAGE_MARGIN_MM}mm;
        }
        .stp-page {
          display: flex; flex-direction: column;
          min-height: calc(100vh - ${PAGE_MARGIN_MM * 2}mm);
          box-sizing: border-box;
          padding-top: ${LETTERHEAD_TOP_MM}mm;
          padding-bottom: ${LETTERHEAD_BOTTOM_MM}mm;
        }
        .${AREA_CLASS} { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 15px; }
        .stp-copy-title { text-align: center; font-weight: 700; font-size: 20px; margin-bottom: 4px; }

        /* Spacer between the item table and the totals block — flex:1
           absorbs whatever room the item table's own rows didn't use, so
           everything after it (totals, amount in words, remarks, signature)
           settles at the bottom of the sheet, right above the footer. It
           carries the same left/right/bottom rule as every grid table, and a
           negative top margin so its border collapses against the item
           table's bottom border instead of doubling up — keeping the sheet
           reading as one continuous ruled form rather than a blank gap. */
        .stp-spacer {
          flex: 1 1 auto; min-height: 0;
          border: ${GRID_BORDER_PX}px solid #000; border-top: none;
          box-sizing: border-box;
        }

        table.stp-grid { width: 100%; border-collapse: collapse; table-layout: fixed; flex-shrink: 0; }
        table.stp-grid td, table.stp-grid th {
          border: ${GRID_BORDER_PX}px solid #000; padding: 5px 6px; vertical-align: top;
        }
        table.stp-grid + table.stp-grid { margin-top: -${GRID_BORDER_PX}px; }
        .stp-items + .stp-spacer,
        table.stp-grid + .stp-spacer { margin-top: -${GRID_BORDER_PX}px; }
        .stp-spacer + table.stp-grid { margin-top: -${GRID_BORDER_PX}px; }
        .stp-half { width: 50%; }
        .num { text-align: right; }

        .stp-kv { display: flex; gap: 4px; line-height: 1.5; }
        .stp-kv .k { flex: 0 0 110px; }
        .stp-kv .c { flex: 0 0 4px; }
        .stp-kv .v { flex: 1; font-weight: 600; }

        .stp-addr-title { font-weight: 700; }
        .stp-addr-name { font-weight: 600; }
        .stp-addr-line { font-size: 13px; line-height: 1.4; }

        table.stp-items th { font-weight: 700; text-align: center; font-size: 14px; }
        table.stp-items td { font-size: 14px; }
        table.stp-items .w-sn { width: 4%; }
        table.stp-items .w-code { width: 10%; }
        table.stp-items .w-desc { width: 18%; }
        table.stp-items .w-from { width: 10%; }
        table.stp-items .w-to { width: 10%; }
        table.stp-items .w-stock { width: 9%; }
        table.stp-items .w-qty { width: 8%; }
        table.stp-items .w-price { width: 10%; }
        table.stp-items .w-tax { width: 8%; }
        table.stp-items .w-amt { width: 13%; }

        .stp-total-label { width: 22%; }
        .stp-total-value { width: 16%; text-align: right; }
        .stp-words-cell { vertical-align: top; }
        .stp-words { font-weight: 600; text-transform: uppercase; }

        table.stp-foot .stp-foot-left { width: 62%; line-height: 1.5; }
        table.stp-foot .stp-foot-right { width: 38%; text-align: right; }
        table.stp-foot tr:first-child td { border-bottom: none; padding-bottom: 46px; }
        table.stp-foot tr:last-child td { border-top: none; }
        .stp-remarks-title { font-weight: 700; margin-bottom: 2px; }
        table.stp-foot .stp-sign { height: 46px; vertical-align: bottom; }

        .stp-pagefoot { display: flex; justify-content: space-between; padding: 4px 2px 0; font-size: 12px; }
      `}</style>

      {renderCopy()}
    </div>
  );

  return typeof document === 'undefined' ? content : createPortal(content, document.body);
}

// Memoized — this whole A4 sheet is rendered unconditionally (hidden via
// display:none, shown only under @media print) so without this it would be
// rebuilt on every keystroke in the live form.
export default React.memo(StockTransferPrintable);
