import React from 'react';
import { createPortal } from 'react-dom';
import dayjs from 'dayjs';
import {
  LetterheadHeader, LetterheadWatermark, LetterheadFooter, letterheadStyles,
  LETTERHEAD_TOP_MM, LETTERHEAD_BOTTOM_MM,
} from './Letterhead';
import { wordsInr, makeScopedPrint, makeScopedCapture } from './purchaseStationery';
import { useIsActiveTab } from '../navigation/TabPathContext';

// Same technique as every other document in this family (see
// purchaseStationery.jsx's own notes, and DeliveryChallanPrintable.jsx for
// the fullest write-up) -- but a Payment Receipt has no line-item table to
// paginate, so this is the simplest member of the family: always exactly
// one physical page, one .prc-sheet, no page-break logic at all.
const GRID_BORDER_PX = 1;
const PAGE_MARGIN_MM = 6;
const RULE_SPACING = { headerAbove: 3.5, headerBelow: 0, footerAbove: 2, footerBelow: 1.5 };

const AREA_CLASS = 'prc-print-area';
const PRINTING_CLASS = 'prc-printing';
const PAGE_RULE_ID = 'prc-print-page-rule';
const SHEET_SELECTOR = '.prc-sheet';

/** Print THIS Payment Receipt. Call instead of window.print(). */
export const printPaymentReceipt = makeScopedPrint({ printingClass: PRINTING_CLASS, pageRuleId: PAGE_RULE_ID });

/** "Send via WhatsApp"'s PDF source for Payment Receipt — see makeScopedCapture. */
export const capturePaymentReceiptPdf = makeScopedCapture({
  printingClass: PRINTING_CLASS,
  pageRuleId: PAGE_RULE_ID,
  sheetSelector: SHEET_SELECTOR,
  areaSelector: `.${AREA_CLASS}`,
});

const fmtDate = (d) => (d ? dayjs(d).format('DD-MMM-YYYY') : '—');
const fmtMoney = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * The live, data-driven Payment Receipt print. `row` is the saved
 * PaymentReceipt record (with its `applications` array included). Only
 * ever rendered inside a `.prc-print-area` wrapper that's invisible on
 * screen and shown exclusively via the shared @media print rules (or
 * force-shown off-screen by capturePaymentReceiptPdf — see
 * purchaseStationery.jsx's makeScopedCapture).
 */
function PaymentReceiptPrintable({ row, company, approverSignatureUrl }) {
  const isActive = useIsActiveTab();
  if (!row || !isActive) return null;

  const companyName = (company?.companyName || 'KEMACH EQUIPMENTS PVT LTD').toUpperCase();
  const applications = row.applications || [];
  const totalAmount = row.totalAmountDue;

  const sheet = (
    <div className={AREA_CLASS}>
      <style>{`
        ${letterheadStyles('.prc-page', RULE_SPACING)}
        .${AREA_CLASS} { display: none; }
        @media print {
          /* Portaled straight onto <body>, a direct sibling of #root -- see
             DeliveryChallanPrintable.jsx's identical note on why hiding
             #root entirely (not just this area) is what keeps the rest of
             the (invisible but still laid out) app from contributing stray
             height to the print engine. */
          body.${PRINTING_CLASS} #root { display: none !important; }
          body.${PRINTING_CLASS} .${AREA_CLASS} { display: block; width: 100%; box-sizing: border-box; }
          body.${PRINTING_CLASS} .${AREA_CLASS},
          body.${PRINTING_CLASS} .${AREA_CLASS} * {
            visibility: visible;
          }
          @page { size: 210mm 297mm; margin: 0; }
        }
        .prc-sheet {
          min-height: 100vh;
          box-sizing: border-box;
          padding: ${PAGE_MARGIN_MM}mm;
        }
        .prc-page {
          display: flex; flex-direction: column;
          min-height: calc(100vh - ${PAGE_MARGIN_MM * 2}mm);
          box-sizing: border-box;
          padding-top: ${LETTERHEAD_TOP_MM}mm;
          padding-bottom: ${LETTERHEAD_BOTTOM_MM}mm;
        }
        .${AREA_CLASS} { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 11.5px; }
        .prc-title { text-align: center; font-weight: 700; font-size: 16px; margin-bottom: 4px; letter-spacing: 0.5px; }

        table.prc-grid { width: 100%; border-collapse: collapse; table-layout: fixed; flex-shrink: 0; }
        table.prc-grid td, table.prc-grid th {
          border: ${GRID_BORDER_PX}px solid #000; padding: 4px 6px; vertical-align: top;
        }
        table.prc-grid + table.prc-grid { margin-top: -${GRID_BORDER_PX}px; }
        .prc-half { width: 50%; }
        .num { text-align: right; }

        .prc-box-label { font-weight: 400; margin-bottom: 2px; }
        .prc-party { font-weight: 700; font-size: 12.5px; margin-bottom: 2px; }
        .prc-pre { white-space: pre-line; line-height: 1.35; }

        .prc-kv { display: flex; gap: 4px; line-height: 1.5; }
        .prc-kv .k { flex: 0 0 42%; }
        .prc-kv .c { flex: 0 0 4px; }
        .prc-kv .v { flex: 1; font-weight: 600; }

        table.prc-apps th { font-weight: 700; text-align: center; font-size: 10px; }
        table.prc-apps td { font-size: 10px; }

        .prc-words-cell { vertical-align: top; }
        .prc-words { font-weight: 600; text-transform: uppercase; }
        .prc-total-label { width: 26%; }
        .prc-total-value { width: 16%; }

        table.prc-foot .prc-foot-left { width: 62%; line-height: 1.45; }
        table.prc-foot .prc-foot-right { width: 38%; text-align: right; }
        table.prc-foot .prc-sign { height: 46px; vertical-align: bottom; }
        .prc-sign-img { display: block; margin: 0 6mm 2px auto; height: 64px; max-width: 40mm; width: auto; object-fit: contain; }

        .prc-pagefoot { display: flex; justify-content: space-between; padding: 3px 2px 0; font-size: 9.5px; }

        /* .prc-fill stretches into whatever slack a short receipt leaves,
           pinning the footer/signature block to the true bottom of the
           sheet -- same technique as every other document's own .xxx-fill. */
        .prc-fill { flex: 1 1 0; }
      `}</style>
      <div className="prc-sheet">
        <div className="prc-page">
          <LetterheadHeader company={company} />
          <LetterheadWatermark />

          <div className="prc-title">PAYMENT RECEIPT</div>

          <table className="prc-grid">
            <tbody>
              <tr>
                <td className="prc-half">
                  <div className="prc-box-label">Received From :</div>
                  <div className="prc-party">{row.partyName || '—'}</div>
                  {row.partyCode ? <div>{row.partyCode}</div> : null}
                  {row.billTo ? <div className="prc-pre">{row.billTo}</div> : null}
                  {row.contactPerson ? <div>Attn: {row.contactPerson}</div> : null}
                </td>
                <td className="prc-half">
                  <div className="prc-kv"><span className="k">Payment No</span><span className="c">:</span><span className="v">{row.paymentReceiptNo || '—'}</span></div>
                  <div className="prc-kv"><span className="k">Posting Date</span><span className="c">:</span><span className="v">{fmtDate(row.postingDate)}</span></div>
                  <div className="prc-kv"><span className="k">Payment Date</span><span className="c">:</span><span className="v">{fmtDate(row.documentDate)}</span></div>
                  <div className="prc-kv"><span className="k">Reference No</span><span className="c">:</span><span className="v">{row.reference || '—'}</span></div>
                  <div className="prc-kv"><span className="k">Transaction No</span><span className="c">:</span><span className="v">{row.transactionNo || '—'}</span></div>
                  <div className="prc-kv"><span className="k">Payment Mode</span><span className="c">:</span><span className="v">{row.paymentMode || '—'}</span></div>
                  <div className="prc-kv"><span className="k">Branch</span><span className="c">:</span><span className="v">{row.branch || '—'}</span></div>
                </td>
              </tr>
            </tbody>
          </table>

          {applications.length > 0 && (
            <table className="prc-grid prc-apps">
              <thead>
                <tr>
                  <th>Invoice No.</th>
                  <th>Invoice Date</th>
                  <th>Due Date</th>
                  <th className="num">Total Amount</th>
                  <th className="num">Outstanding</th>
                  <th className="num">Amount Applied</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((a, i) => (
                  <tr key={a.id || i}>
                    <td>{a.invoiceNo || '—'}</td>
                    <td>{fmtDate(a.invoiceDate)}</td>
                    <td>{fmtDate(a.dueDate)}</td>
                    <td className="num">{fmtMoney(a.totalAmount)}</td>
                    <td className="num">{fmtMoney(a.outstandingAtTimeOfApplication)}</td>
                    <td className="num">{fmtMoney(a.amountApplied)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="prc-fill" />

          <table className="prc-grid">
            <tbody>
              <tr>
                <td className="prc-words-cell">
                  <div>Amount Received (in words):</div>
                  <div className="prc-words">{wordsInr(totalAmount)}</div>
                </td>
                <td className="prc-total-label">Total Amount Received</td>
                <td className="prc-total-value num">₹{fmtMoney(totalAmount)}</td>
              </tr>
              <tr>
                <td className="prc-words-cell" />
                <td className="prc-total-label">Applied Amount</td>
                <td className="prc-total-value num">₹{fmtMoney(row.appliedAmount)}</td>
              </tr>
              <tr>
                <td className="prc-words-cell" />
                <td className="prc-total-label">Open Balance</td>
                <td className="prc-total-value num">₹{fmtMoney(row.openBalance)}</td>
              </tr>
            </tbody>
          </table>

          <table className="prc-grid prc-foot">
            <tbody>
              <tr>
                <td className="prc-foot-left">{row.remarks || ''}</td>
                <td className="prc-foot-right">For {companyName}</td>
              </tr>
              <tr>
                <td className="prc-foot-left" />
                <td className="prc-foot-right prc-sign">
                  {approverSignatureUrl ? <img className="prc-sign-img" src={approverSignatureUrl} alt="" /> : null}
                  <div>Authorized Signatory</div>
                </td>
              </tr>
            </tbody>
          </table>

          <div className="prc-pagefoot">
            <span>{company?.phone ? `Ph No : ${company.phone}` : ''}</span>
            <span>{company?.email ? `Email Id : ${company.email}` : ''}</span>
          </div>

          <LetterheadFooter company={company} />
        </div>
      </div>
    </div>
  );

  return typeof document === 'undefined' ? sheet : createPortal(sheet, document.body);
}

// Memoized for the same reason as every other printable in this family —
// see DeliveryChallanPrintable.jsx's own note.
export default React.memo(PaymentReceiptPrintable);
