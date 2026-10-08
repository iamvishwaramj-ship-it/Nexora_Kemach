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

// Visual twin of StockTransferPrintable.jsx — same Letterhead template as
// DeliveryChallanPrintable.jsx (see that file for the extended reasoning
// behind each CSS technique and the tax-related fields). A request carries a
// single Warehouse per line (the destination it's being requested for, not
// a From/To pair) and no Total Stock figure of its own — the item table is
// shaped to match what StockTransferRequest.jsx actually stores rather than
// repeating StockTransferPrintable's columns verbatim. Its tax IS a real
// CGST/SGST/IGST split (same documentTotals.js engine every Sales/Purchase
// document uses), with intra-/inter-state decided by comparing the From
// Branch's state to the To Branch's state instead of a customer's place of
// supply — see resolveStockTransferRequestTaxTreatment in
// routes/resources.js and the identical interState calc in
// StockTransferRequest.jsx's own computeTotals.

const GRID_BORDER_PX = 1;
const PAGE_MARGIN_MM = 6;

const RULE_SPACING = {
  headerAbove: 3.5,
  headerBelow: 0,
  footerAbove: 2,
  footerBelow: 1.5,
};

const AREA_CLASS = 'strp-print-area';
const PRINTING_CLASS = 'strp-printing';
const PAGE_RULE_ID = 'strp-print-page-rule';

export const printStockTransferRequest = makeScopedPrint({ printingClass: PRINTING_CLASS, pageRuleId: PAGE_RULE_ID });

const fmtDate = (d) => (d ? dayjs(d).format('DD-MMM-YYYY') : '');
const fmtNum = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtQty = (n) => {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

// A line's own final amount — quantity x unit price, grossed up by that
// line's own Tax % — same convention as StockTransferRequest.jsx's own
// lineTotal (see that file's doc comment for why this reconciles exactly
// with the Taxable Amount/CGST/SGST/Grand Total breakdown below, up to the
// Round Off line).
function lineAmount(it) {
  const quantity = Number(it.quantity) || 0;
  const unitPrice = Number(it.itemCost ?? it.unitPrice) || 0;
  const taxPercent = Number(it.taxPercent) || 0;
  return round2(quantity * unitPrice * (1 + taxPercent / 100));
}

function StockTransferRequestPrintable({ order, company, branches, warehouses }) {
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
  // Address lines for the From/To Branch boxes — resolved from the full
  // Branch list (branchAddressLines returns [] for a branch it can't find,
  // which is the caller's cue to just print the name with no address lines
  // rather than an empty box).
  const fromBranchRecord = (branches || []).find((b) => String(b.branchName || '').trim() === String(order.branch || '').trim());
  const toBranchRecord = (branches || []).find((b) => String(b.branchName || '').trim() === String(order.toBranch || '').trim());
  const fromBranchLines = branchAddressLines(fromBranchRecord);
  const toBranchLines = isBranchTransfer ? branchAddressLines(toBranchRecord) : [];
  // Same interState rule as StockTransferRequest.jsx's own computeTotals — a
  // plain Stock Transfer request (no To Branch) always falls back to
  // intra-state.
  const interState = isBranchTransfer
    ? isInterState(toBranchRecord?.state || '', fromBranchRecord?.state || '')
    : false;
  // Same shared engine every Sales/Purchase document's print screen uses —
  // no header Discount % on this document, so 0 is passed for it. A line's
  // own taxType only rides along when the order came straight off the live
  // form (StockTransferRequest.jsx's watch()); a reloaded/saved record has no
  // persisted taxType (see toStockTransferRequestItemData — only
  // taxPercent/taxCodeId are stored), so only CGST/SGST/IGST show on a
  // re-printed saved document — an accepted gap, same as StockTransferPrintable.jsx.
  const lines = items.map((it) => ({
    quantity: it.quantity,
    unitPrice: it.itemCost ?? it.unitPrice,
    taxPercent: it.taxPercent,
    taxType: it.taxType || '',
  }));
  const { totals } = buildDocument(lines, 0, { interState, roundOff: true });
  const taxRows = taxComponentRows(totals, interState);
  const taxableValue = totals.taxableAmount;
  // Sum of each row's own tax-inclusive lineAmount — what the "Total" recap
  // next to Total Qty reconciles against (each row above it is shown the
  // same tax-inclusive way), distinct from Taxable Amount below (the
  // pre-tax figure GST is computed on).
  const totalInclusive = round2(items.reduce((s, i) => s + lineAmount(i), 0));
  const freightCharges = 0;
  const roundOff = totals.roundOff;
  const grandTotal = round2(totals.amount + freightCharges);
  // Amount-in-words / Remarks / Prepared By all sit in one rowSpan cell
  // (same pattern as StockTransferPrintable.jsx) so the totals column can
  // carry however many rows CGST/SGST (or IGST) need without the left side
  // repeating or leaving blank rows.
  const totalsRowCount = 1 + taxRows.length + 2 + 1; // Taxable Amount + tax rows + Freight + Round off + Grand Total

  const renderCopy = () => {
    const footer = <LetterheadFooter company={company} />;

    return (
      <div className="strp-sheet">
      <div className="strp-page">
        <LetterheadHeader company={company} />
        <LetterheadWatermark />

      <div className="strp-copy-title">
        <span className="strp-doc-title">BRANCH TRANSFER - BTA REQUEST</span>
      </div>

      <table className="strp-grid">
        <tbody>
          <tr>
            <td className="strp-half">
              <div className="strp-addr-title">From Branch</div>
              <div className="strp-addr-name">{order.branch || ''}</div>
              {fromBranchLines.map((line, i) => (<div key={i} className="strp-addr-line">{line}</div>))}
            </td>
            <td className="strp-half">
              <div className="strp-addr-title">To Branch</div>
              <div className="strp-addr-name">{isBranchTransfer ? (order.toBranch || '') : '—'}</div>
              {toBranchLines.map((line, i) => (<div key={i} className="strp-addr-line">{line}</div>))}
            </td>
          </tr>
          <tr>
            <td className="strp-half" colSpan={2}>
              <div className="strp-kv"><span className="k">Type</span><span className="c">:</span><span className="v">{order.transferType || ''}</span></div>
              <div className="strp-kv"><span className="k">Request No</span><span className="c">:</span><span className="v">{order.requestNo || ''}</span></div>
              <div className="strp-kv"><span className="k">Request Date</span><span className="c">:</span><span className="v">{fmtDate(order.requestDate)}</span></div>
              <div className="strp-kv"><span className="k">Document Date</span><span className="c">:</span><span className="v">{fmtDate(order.documentDate)}</span></div>
            </td>
          </tr>
        </tbody>
      </table>

      <table className="strp-grid strp-items">
        <thead>
          <tr>
            <th className="w-sn">S.<br />No</th>
            <th className="w-code">Item No.</th>
            <th className="w-desc">Item Name / Description</th>
            <th className="w-wh">Warehouse</th>
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
      <div className="strp-spacer" />

      {/* Total Qty / Total line, directly above Amount in Words. */}
      <table className="strp-grid">
        <tbody>
          <tr>
            <td className="strp-half"><b>Total Qty</b> : {fmtQty(totalQty)}</td>
            <td className="strp-half num"><b>Total</b> : {fmtNum(totalInclusive)}</td>
          </tr>
        </tbody>
      </table>

      <table className="strp-grid">
        <tbody>
          <tr>
            <td rowSpan={totalsRowCount} className="strp-words-cell">
              <div>Amount in Words. (INR)</div>
              <div className="strp-words">{amountToWords(grandTotal) || ''}</div>
              <div className="strp-remarks-title" style={{ marginTop: 8 }}>Remarks</div>
              <div>{order.remarks || ''}</div>
              <div style={{ marginTop: 8 }}><b>Prepared By :</b> {order.preparedBy || ''}</div>
            </td>
            <td className="strp-total-label">Taxable Amount</td>
            <td className="strp-total-value">{fmtNum(taxableValue)}</td>
          </tr>
          {taxRows.map((r) => (
            <tr key={r.label}>
              <td className="strp-total-label">{r.label}</td>
              <td className="strp-total-value">{fmtNum(r.amount)}</td>
            </tr>
          ))}
          <tr>
            <td className="strp-total-label">Freight charges</td>
            <td className="strp-total-value">{fmtNum(freightCharges)}</td>
          </tr>
          <tr>
            <td className="strp-total-label">Round off</td>
            <td className="strp-total-value">{fmtNum(roundOff)}</td>
          </tr>
          <tr>
            <td className="strp-total-label"><b>GRAND TOTAL</b></td>
            <td className="strp-total-value"><b>{fmtNum(grandTotal)}</b></td>
          </tr>
        </tbody>
      </table>

      <table className="strp-grid strp-foot">
        <tbody>
          <tr>
            <td className="strp-foot-left" />
            <td className="strp-foot-right">For {(company?.companyName || 'KEMACH EQUIPMENTS PRIVATE LIMITED').toUpperCase()}</td>
          </tr>
          <tr>
            <td className="strp-foot-left" />
            <td className="strp-foot-right strp-sign">
              <div>Authorized Signatory</div>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="strp-pagefoot">
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
        ${letterheadStyles('.strp-page', RULE_SPACING)}
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
          .strp-sheet { page-break-after: always; }
          .strp-sheet:last-child { page-break-after: auto; }
        }
        .strp-sheet {
          min-height: 100vh;
          box-sizing: border-box;
          padding: ${PAGE_MARGIN_MM}mm;
        }
        .strp-page {
          display: flex; flex-direction: column;
          min-height: calc(100vh - ${PAGE_MARGIN_MM * 2}mm);
          box-sizing: border-box;
          padding-top: ${LETTERHEAD_TOP_MM}mm;
          padding-bottom: ${LETTERHEAD_BOTTOM_MM}mm;
        }
        .${AREA_CLASS} { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 15px; }
        .strp-copy-title { text-align: center; font-weight: 700; font-size: 20px; margin-bottom: 4px; }

        /* Spacer between the item table and the totals block — see
           StockTransferPrintable.jsx's identical note (bordered to match the
           grid tables so the sheet stays one continuous ruled form). */
        .strp-spacer {
          flex: 1 1 auto; min-height: 0;
          border: ${GRID_BORDER_PX}px solid #000; border-top: none;
          box-sizing: border-box;
        }

        table.strp-grid { width: 100%; border-collapse: collapse; table-layout: fixed; flex-shrink: 0; }
        table.strp-grid td, table.strp-grid th {
          border: ${GRID_BORDER_PX}px solid #000; padding: 5px 6px; vertical-align: top;
        }
        table.strp-grid + table.strp-grid { margin-top: -${GRID_BORDER_PX}px; }
        .strp-items + .strp-spacer,
        table.strp-grid + .strp-spacer { margin-top: -${GRID_BORDER_PX}px; }
        .strp-spacer + table.strp-grid { margin-top: -${GRID_BORDER_PX}px; }
        .strp-half { width: 50%; }
        .num { text-align: right; }

        .strp-kv { display: flex; gap: 4px; line-height: 1.5; }
        .strp-kv .k { flex: 0 0 110px; }
        .strp-kv .c { flex: 0 0 4px; }
        .strp-kv .v { flex: 1; font-weight: 600; }

        .strp-addr-title { font-weight: 700; }
        .strp-addr-name { font-weight: 600; }
        .strp-addr-line { font-size: 13px; line-height: 1.4; }

        table.strp-items th { font-weight: 700; text-align: center; font-size: 14px; }
        table.strp-items td { font-size: 14px; }
        table.strp-items .w-sn { width: 5%; }
        table.strp-items .w-code { width: 13%; }
        table.strp-items .w-desc { width: 25%; }
        table.strp-items .w-wh { width: 14%; }
        table.strp-items .w-qty { width: 10%; }
        table.strp-items .w-price { width: 11%; }
        table.strp-items .w-tax { width: 10%; }
        table.strp-items .w-amt { width: 12%; }

        .strp-total-label { width: 22%; }
        .strp-total-value { width: 16%; text-align: right; }
        .strp-words-cell { vertical-align: top; }
        .strp-words { font-weight: 600; text-transform: uppercase; }

        table.strp-foot .strp-foot-left { width: 62%; line-height: 1.5; }
        table.strp-foot .strp-foot-right { width: 38%; text-align: right; }
        table.strp-foot tr:first-child td { border-bottom: none; padding-bottom: 46px; }
        table.strp-foot tr:last-child td { border-top: none; }
        .strp-remarks-title { font-weight: 700; margin-bottom: 2px; }
        table.strp-foot .stp-sign, table.strp-foot .strp-sign { height: 46px; vertical-align: bottom; }

        .strp-pagefoot { display: flex; justify-content: space-between; padding: 4px 2px 0; font-size: 12px; }
      `}</style>

      {renderCopy()}
    </div>
  );

  return typeof document === 'undefined' ? content : createPortal(content, document.body);
}

export default React.memo(StockTransferRequestPrintable);
