import React from 'react';
import { createPortal } from 'react-dom';
import dayjs from 'dayjs';
import {
  LetterheadHeader, LetterheadWatermark, LetterheadFooter, letterheadStyles,
  LETTERHEAD_TOP_MM, LETTERHEAD_BOTTOM_MM,
} from './Letterhead';
import { wordsInr, makeScopedPrint, makeScopedCapture } from './purchaseStationery';
import { useIsActiveTab } from '../navigation/TabPathContext';

// Visual twin of PaymentReceiptPrintable.jsx (see that file for the fuller
// reasoning) with this document's own field names substituted -- Paid To
// instead of Received From, paymentVoucherNo/totalDue instead of
// paymentReceiptNo/totalAmountDue, "Amount Paid" instead of "Amount
// Received". Own class prefix (pvc-*, distinct from prc-*) so both
// documents' printables can stay mounted at once (a KeepAlive tab) without
// their printing-class toggles or @page rules fighting each other -- same
// isolation every other document pair in this family already has.
const GRID_BORDER_PX = 1;
const PAGE_MARGIN_MM = 6;
const RULE_SPACING = { headerAbove: 3.5, headerBelow: 0, footerAbove: 2, footerBelow: 1.5 };

const AREA_CLASS = 'pvc-print-area';
const PRINTING_CLASS = 'pvc-printing';
const PAGE_RULE_ID = 'pvc-print-page-rule';
const SHEET_SELECTOR = '.pvc-sheet';

/** Print THIS Payment Voucher. Call instead of window.print(). */
export const printPaymentVoucher = makeScopedPrint({ printingClass: PRINTING_CLASS, pageRuleId: PAGE_RULE_ID });

/** "Send via WhatsApp"'s PDF source for Payment Voucher — see makeScopedCapture. */
export const capturePaymentVoucherPdf = makeScopedCapture({
  printingClass: PRINTING_CLASS,
  pageRuleId: PAGE_RULE_ID,
  sheetSelector: SHEET_SELECTOR,
  areaSelector: `.${AREA_CLASS}`,
});

const fmtDate = (d) => (d ? dayjs(d).format('DD-MMM-YYYY') : '—');
const fmtMoney = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * The live, data-driven Payment Voucher print. `row` is the saved
 * PaymentVoucher record (with its `applications` array included). Only
 * ever rendered inside a `.pvc-print-area` wrapper that's invisible on
 * screen and shown exclusively via the shared @media print rules (or
 * force-shown off-screen by capturePaymentVoucherPdf — see
 * purchaseStationery.jsx's makeScopedCapture).
 */
function PaymentVoucherPrintable({ row, company, approverSignatureUrl }) {
  const isActive = useIsActiveTab();
  if (!row || !isActive) return null;

  const companyName = (company?.companyName || 'KEMACH EQUIPMENTS PVT LTD').toUpperCase();
  const applications = row.applications || [];
  const totalAmount = row.totalDue;

  const sheet = (
    <div className={AREA_CLASS}>
      <style>{`
        ${letterheadStyles('.pvc-page', RULE_SPACING)}
        .${AREA_CLASS} { display: none; }
        @media print {
          body.${PRINTING_CLASS} #root { display: none !important; }
          body.${PRINTING_CLASS} .${AREA_CLASS} { display: block; width: 100%; box-sizing: border-box; }
          body.${PRINTING_CLASS} .${AREA_CLASS},
          body.${PRINTING_CLASS} .${AREA_CLASS} * {
            visibility: visible;
          }
          @page { size: 210mm 297mm; margin: 0; }
        }
        .pvc-sheet {
          min-height: 100vh;
          box-sizing: border-box;
          padding: ${PAGE_MARGIN_MM}mm;
        }
        .pvc-page {
          display: flex; flex-direction: column;
          min-height: calc(100vh - ${PAGE_MARGIN_MM * 2}mm);
          box-sizing: border-box;
          padding-top: ${LETTERHEAD_TOP_MM}mm;
          padding-bottom: ${LETTERHEAD_BOTTOM_MM}mm;
        }
        .${AREA_CLASS} { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 11.5px; }
        .pvc-title { text-align: center; font-weight: 700; font-size: 16px; margin-bottom: 4px; letter-spacing: 0.5px; }

        table.pvc-grid { width: 100%; border-collapse: collapse; table-layout: fixed; flex-shrink: 0; }
        table.pvc-grid td, table.pvc-grid th {
          border: ${GRID_BORDER_PX}px solid #000; padding: 4px 6px; vertical-align: top;
        }
        table.pvc-grid + table.pvc-grid { margin-top: -${GRID_BORDER_PX}px; }
        .pvc-half { width: 50%; }
        .num { text-align: right; }

        .pvc-box-label { font-weight: 400; margin-bottom: 2px; }
        .pvc-party { font-weight: 700; font-size: 12.5px; margin-bottom: 2px; }
        .pvc-pre { white-space: pre-line; line-height: 1.35; }

        .pvc-kv { display: flex; gap: 4px; line-height: 1.5; }
        .pvc-kv .k { flex: 0 0 42%; }
        .pvc-kv .c { flex: 0 0 4px; }
        .pvc-kv .v { flex: 1; font-weight: 600; }

        table.pvc-apps th { font-weight: 700; text-align: center; font-size: 10px; }
        table.pvc-apps td { font-size: 10px; }

        .pvc-words-cell { vertical-align: top; }
        .pvc-words { font-weight: 600; text-transform: uppercase; }
        .pvc-total-label { width: 26%; }
        .pvc-total-value { width: 16%; }

        table.pvc-foot .pvc-foot-left { width: 62%; line-height: 1.45; }
        table.pvc-foot .pvc-foot-right { width: 38%; text-align: right; }
        table.pvc-foot .pvc-sign { height: 46px; vertical-align: bottom; }
        .pvc-sign-img { display: block; margin: 0 6mm 2px auto; height: 64px; max-width: 40mm; width: auto; object-fit: contain; }

        .pvc-pagefoot { display: flex; justify-content: space-between; padding: 3px 2px 0; font-size: 9.5px; }
        .pvc-fill { flex: 1 1 0; }
      `}</style>
      <div className="pvc-sheet">
        <div className="pvc-page">
          <LetterheadHeader company={company} />
          <LetterheadWatermark />

          <div className="pvc-title">PAYMENT VOUCHER</div>

          <table className="pvc-grid">
            <tbody>
              <tr>
                <td className="pvc-half">
                  <div className="pvc-box-label">Paid To :</div>
                  <div className="pvc-party">{row.partyName || '—'}</div>
                  {row.partyCode ? <div>{row.partyCode}</div> : null}
                  {row.billTo ? <div className="pvc-pre">{row.billTo}</div> : null}
                  {row.contactPerson ? <div>Attn: {row.contactPerson}</div> : null}
                </td>
                <td className="pvc-half">
                  <div className="pvc-kv"><span className="k">Payment No</span><span className="c">:</span><span className="v">{row.paymentVoucherNo || '—'}</span></div>
                  <div className="pvc-kv"><span className="k">Posting Date</span><span className="c">:</span><span className="v">{fmtDate(row.postingDate)}</span></div>
                  <div className="pvc-kv"><span className="k">Payment Date</span><span className="c">:</span><span className="v">{fmtDate(row.documentDate)}</span></div>
                  <div className="pvc-kv"><span className="k">Reference No</span><span className="c">:</span><span className="v">{row.reference || '—'}</span></div>
                  <div className="pvc-kv"><span className="k">Transaction No</span><span className="c">:</span><span className="v">{row.transactionNo || '—'}</span></div>
                  <div className="pvc-kv"><span className="k">Payment Mode</span><span className="c">:</span><span className="v">{row.paymentMode || '—'}</span></div>
                  <div className="pvc-kv"><span className="k">Branch</span><span className="c">:</span><span className="v">{row.branch || '—'}</span></div>
                </td>
              </tr>
            </tbody>
          </table>

          {applications.length > 0 && (
            <table className="pvc-grid pvc-apps">
              <thead>
                <tr>
                  <th>Bill No.</th>
                  <th>Bill Date</th>
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

          <div className="pvc-fill" />

          <table className="pvc-grid">
            <tbody>
              <tr>
                <td className="pvc-words-cell">
                  <div>Amount Paid (in words):</div>
                  <div className="pvc-words">{wordsInr(totalAmount)}</div>
                </td>
                <td className="pvc-total-label">Total Amount Paid</td>
                <td className="pvc-total-value num">₹{fmtMoney(totalAmount)}</td>
              </tr>
              <tr>
                <td className="pvc-words-cell" />
                <td className="pvc-total-label">Applied Amount</td>
                <td className="pvc-total-value num">₹{fmtMoney(row.appliedAmount)}</td>
              </tr>
              <tr>
                <td className="pvc-words-cell" />
                <td className="pvc-total-label">Open Balance</td>
                <td className="pvc-total-value num">₹{fmtMoney(row.openBalance)}</td>
              </tr>
            </tbody>
          </table>

          <table className="pvc-grid pvc-foot">
            <tbody>
              <tr>
                <td className="pvc-foot-left">{row.remarks || ''}</td>
                <td className="pvc-foot-right">For {companyName}</td>
              </tr>
              <tr>
                <td className="pvc-foot-left" />
                <td className="pvc-foot-right pvc-sign">
                  {approverSignatureUrl ? <img className="pvc-sign-img" src={approverSignatureUrl} alt="" /> : null}
                  <div>Authorized Signatory</div>
                </td>
              </tr>
            </tbody>
          </table>

          <div className="pvc-pagefoot">
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

export default React.memo(PaymentVoucherPrintable);
