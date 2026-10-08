import React from 'react';
import companyLogoSrc from '../../../assets/kemach.png';
import vendorLogoSrc from '../../../assets/indus-logo.png';
import { makeScopedPrint } from './purchaseStationery';
import { useIsActiveTab } from '../navigation/TabPathContext';

export const PO_TEMPLATE_PRINTING_CLASS = 'po-template-printing';
export const PO_TEMPLATE_PAGE_RULE_ID = 'po-template-page-rule';

export const printPurchaseOrderTemplate = makeScopedPrint({
  printingClass: PO_TEMPLATE_PRINTING_CLASS,
  pageRuleId: PO_TEMPLATE_PAGE_RULE_ID,
});

/**
 * Purchase Order — A4 print template (UI ONLY).
 *
 * A pixel-faithful recreation of the reference ERP Purchase Order stationery
 * as a single A4 portrait sheet. This file deliberately contains NO business
 * logic: every figure below is a static mock constant, nothing is computed,
 * and no API/store/selector is touched. When this layout is signed off, the
 * mock constants are the only thing that gets swapped for real props — the
 * markup and CSS stay as they are.
 *
 * The live, data-driven Purchase Order print lives separately in
 * PurchaseOrderPrintable.jsx and is NOT affected by this file.
 *
 * Structure is one continuous ruled frame, exactly as the reference prints
 * it: the outer box draws the page border, and every section is a band
 * inside it separated by a full-width rule, so all the vertical dividers
 * (billing/shipping, meta, signature) line up down the sheet.
 */

// --- Mock data -------------------------------------------------------------
// Static stand-ins only, matching the reference document's own values so the
// printed result can be compared against it line for line.
const MOCK = {
  vendor: {
    name: 'INDUS MOTOR COMPANY PRIVATE LTD.',
    addressLines: ['Ernakulam, - 682015', 'Kerala India'],
    gstNo: '32AAACI4904J1ZV',
    gstType: 'Regular/TDS/ISD',
  },
  billing: {
    name: 'KEMACH EQUIPMENTS PRIVATE LIMITED',
    addressLines: ['15/340A, SwalihPlaza, Karikkode, Okkal,', 'Post. Ernakulam, 683 550, India.'],
    gstnNo: '32AAICK1298F1ZL',
    gstnType: 'Regular/TDS/ISD',
  },
  shipping: {
    name: 'KEMACH EQUIPMENTS PRIVATE LIMITED',
    addressLines: [
      '2199-13, HAZAT PALAZA, NEAR KANNUR UNIVERSITY., NEAR',
      'KANNUR UNIVERSITY, Thavakkara., KANNUR, 670002',
      'Kerala. India.',
    ],
    gstnNo: '32AAICK1298F1ZL',
    gstnType: 'Regular/TDS/ISD',
  },
  refNo: 'KEM/PO/ BETA-30 / 262740026',
  orderDate: '05-Jun-2026',
  transport: 'by Road',
  carrierName: '',
  comments: '',
  items: [
    {
      slNo: 1,
      itemCode: '8010041047',
      description: 'INDUSROCK TOOL MAKE BETA 30 ROCK BREAKER WITH STD ACCESSORIES',
      hsnSac: '8430.41.',
      um: 'NOS',
      qty: '1',
      unitPrice: '254237.28',
      discPercent: '0.00',
      assValue: '254237.28',
      taxLines: ['CGST 9.0%', 'SGST 9.0%'],
      taxAmountLines: ['22881.36', '22881.36'],
      amount: '299999.99',
    },
  ],
  totalQty: '1',
  total: '299999.99',
  amountInWords: 'Three lakhs only',
  freightCharges: '0.00',
  roundOff: '0.01',
  grandTotal: '300000.00',
  taxSummary: [
    {
      hsnSac: '8430.41',
      taxableValue: '(INR)254237.28',
      centralTaxPercent: '9.00',
      centralTaxAmt: '(INR)22881.36',
      stateTaxPercent: '9.00',
      stateTaxAmt: '(INR)22881.36',
    },
  ],
  taxAmountInWords: 'Forty-Five Thousand Seven Hundred Sixty-Two and Seventy-One Pisa only',
  termsConditions: 'DELIVERY AT OUR KANNUR BRANCH.',
  authorisedFor: 'KEMACH EQUIPMENTS PRIVATE LIMITED',
  jurisdiction: 'Coimbatore',
  phone: '8300127888',
  email: 'info@kemach.in',
};

// The item table's column widths, as percentages of the sheet width. Held in
// one place and emitted as a <colgroup> so the header, the body and the
// Total Qty/Total row can never drift out of alignment with each other.
const ITEM_COL_WIDTHS = ['4%', '9%', '20%', '8%', '4%', '4%', '9%', '5%', '9%', '7%', '9%', '12%'];

/** The mock authorised signature — an inline path, so no asset is needed. */
function MockSignature() {
  return (
    <svg className="po3-sign-mark" viewBox="0 0 120 44" aria-hidden="true">
      <path
        d="M8 32 C 20 6, 30 6, 32 24 C 34 40, 26 42, 24 32 C 22 20, 34 10, 48 20
           C 58 27, 52 38, 46 34 C 40 30, 48 16, 66 18 C 78 19, 84 28, 96 14"
        fill="none"
        stroke="#16326b"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M62 36 C 74 30, 86 30, 104 34" fill="none" stroke="#16326b" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function PurchaseOrderPrintTemplate() {
  const isActive = useIsActiveTab();

  React.useEffect(() => {
    if (!isActive) return;
    const onBefore = () => document.body.classList.add(PO_TEMPLATE_PRINTING_CLASS);
    const onAfter = () => document.body.classList.remove(PO_TEMPLATE_PRINTING_CLASS);
    window.addEventListener('beforeprint', onBefore);
    window.addEventListener('afterprint', onAfter);
    return () => {
      window.removeEventListener('beforeprint', onBefore);
      window.removeEventListener('afterprint', onAfter);
      document.body.classList.remove(PO_TEMPLATE_PRINTING_CLASS);
    };
  }, [isActive]);

  const item = MOCK.items[0];

  // One <colgroup> element, reused by all three item tables (head+body,
  // filler, totals) so their columns stay locked to ITEM_COL_WIDTHS together.
  const itemColGroup = (
    <colgroup>
      {ITEM_COL_WIDTHS.map((w, i) => <col key={i} style={{ width: w }} />)}
    </colgroup>
  );

  return (
    <div className="po3-print-root">
      {isActive && (
        <style>{`
        /* ==== A4 page geometry ==========================================
           margin: 0 on @page, so the white margin around the ruled frame is
           the sheet's own padding below — one place decides it, and no print
           engine's default margin can add a second one on top. */
        @page { size: A4 portrait; margin: 0; }

        .po3-page {
          width: 210mm;
          height: 297mm;
          padding: 6mm;
          background: #fff;
          color: #000;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 11px;
          line-height: 1.28;
          display: flex;
          flex-direction: column;
        }

        .po3-title {
          text-align: center;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.5px;
          padding-bottom: 4px;
        }

        /* The single ruled frame everything below the title sits in. flex: 1
           makes it take all the height left on the sheet, so the terms band
           stretches and the signature + footer always land on the bottom
           edge — the document fills the page for a 1-line order exactly as
           it does for a full one. */
        .po3-frame {
          flex: 1;
          border: 1px solid #000;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .po3-band { border-bottom: 1px solid #000; }
        .po3-split { display: flex; }
        .po3-split > .po3-half { width: 50%; padding: 3px 6px; }
        .po3-split > .po3-half:first-child { border-right: 1px solid #000; }

        /* ---- 1. Vendor "To" + the two logos ---------------------------- */
        .po3-head { display: flex; justify-content: space-between; align-items: flex-start; padding: 4px 6px 5px; gap: 10px; }
        .po3-to-line { font-weight: 700; margin-bottom: 7px; }
        .po3-to-line span { display: inline-block; min-width: 34px; }
        .po3-vendor-block { padding-left: 34px; }
        .po3-vendor-block div { line-height: 1.45; }
        /* Two SEPARATE logo slots: company first, vendor second. */
        .po3-logos { display: flex; align-items: flex-start; gap: 14px; flex-shrink: 0; padding-top: 2px; }
        .po3-logo { object-fit: contain; }
        .po3-logo-company { height: 15mm; max-width: 46mm; }
        .po3-logo-vendor { height: 17mm; max-width: 46mm; }

        /* ---- 2. Billing / Shipping ------------------------------------ */
        .po3-addr-label { margin-bottom: 3px; }
        .po3-addr-name { font-weight: 700; font-size: 11.5px; margin-bottom: 3px; }
        .po3-addr-lines div { line-height: 1.45; }
        .po3-addr-gst { margin-top: 2px; }

        /* ---- 3. Ref No / Order Date / Transport / Carrier -------------- */
        .po3-meta-row { display: flex; align-items: baseline; }
        .po3-meta-row + .po3-meta-row { margin-top: 4px; }
        .po3-meta-label { font-weight: 700; width: 30%; }
        .po3-meta-colon { width: 8px; }
        .po3-meta-value { font-weight: 700; }

        /* ---- 4. Comments ---------------------------------------------- */
        .po3-comments { padding: 4px 6px 6px; font-weight: 700; }

        /* ---- 5. Item table -------------------------------------------- */
        table.po3-items { width: 100%; border-collapse: collapse; table-layout: fixed; }
        table.po3-items th, table.po3-items td {
          border-right: 1px solid #000;
          border-bottom: 1px solid #000;
          padding: 2px 4px;
          font-size: 9.5px;
          vertical-align: top;
          word-wrap: break-word;
        }
        /* The frame already draws the outer edge — dropping the last cell's
           right border keeps every rule a single hairline, never a double. */
        table.po3-items th:last-child, table.po3-items td:last-child { border-right: none; }
        table.po3-items thead th { text-align: center; font-weight: 700; vertical-align: middle; }
        table.po3-items td.ctr { text-align: center; }
        table.po3-items td.num { text-align: right; }
        table.po3-items tfoot td { font-weight: 700; border-bottom: none; }
        table.po3-items tfoot td.ctr { text-align: center; }

        /* The item band is what absorbs the sheet's spare height now (the
           Terms band used to). Splitting the one table into head+body, a
           stretchable filler and the Total Qty/Total foot is what lets the
           totals row sit at the BOTTOM of the band with ruled, empty column
           space above it — the way the Tax Invoice stationery prints it. All
           three tables share ITEM_COL_WIDTHS through the same <colgroup>
           element, so their columns can never drift apart.
           flex: 1 0 auto, not flex: 1 — a zero flex-basis would let a long
           order's rows be squeezed below their natural height and spill out
           of the frame; auto keeps the rows at full height and only the
           SPARE space is handed to the filler. */
        .po3-items-band { flex: 1 0 auto; display: flex; flex-direction: column; }
        .po3-items-fill { flex: 1 1 auto; display: flex; flex-direction: column; min-height: 0; }
        /* height: 100% on a ONE-row table hands every spare pixel to that row,
           so each cell's border-right runs the full depth of the empty space
           and its border-bottom draws the rule directly above Total Qty.
           margin-top: -1px overlaps the body table's own bottom rule: these
           are separate tables, so their borders cannot collapse into one and
           would otherwise print as a 2px double line. */
        table.po3-items-filler { flex: 1 1 auto; height: 100%; margin-top: -1px; }
        table.po3-items-filler td { padding: 0; }

        /* ---- 6. Amount in words + Freight / Round off / Grand Total ---- */
        .po3-sum { display: flex; }
        .po3-sum-words { width: 62%; border-right: 1px solid #000; padding: 5px 6px; font-weight: 700; }
        .po3-sum-words .v { font-weight: 400; padding-left: 10px; }
        .po3-sum-figures { width: 38%; }
        .po3-sum-figures .r { display: flex; border-bottom: 1px solid #000; }
        .po3-sum-figures .r:last-child { border-bottom: none; }
        .po3-sum-figures .r .l { width: 62%; padding: 3px 6px; border-right: 1px solid #000; }
        .po3-sum-figures .r .a { width: 38%; padding: 3px 6px; text-align: right; }
        .po3-sum-figures .r.grand .l, .po3-sum-figures .r.grand .a { font-weight: 700; }

        /* ---- 7. HSN/SAC tax summary ----------------------------------- */
        table.po3-tax { width: 100%; border-collapse: collapse; table-layout: fixed; }
        table.po3-tax th, table.po3-tax td {
          border-right: 1px solid #000;
          border-bottom: 1px solid #000;
          padding: 3px 5px;
          font-size: 9.5px;
          text-align: center;
        }
        table.po3-tax th:last-child, table.po3-tax td:last-child { border-right: none; }
        table.po3-tax th { font-weight: 700; }
        table.po3-tax tr:last-child td { border-bottom: none; }

        /* ---- 8. Tax amount in words ----------------------------------- */
        .po3-tax-words { padding: 4px 6px; font-weight: 700; }
        .po3-tax-words .v { font-weight: 400; padding-left: 10px; }

        /* ---- 9. Terms & Conditions ------------------------------------ */
        /* Sized to its own content. The item band above absorbs the sheet's
           spare height instead, so the signature band sits directly beneath
           the last term rather than after a tall empty gap. */
        .po3-terms { padding: 5px 6px; }
        .po3-terms-title { font-weight: 700; font-size: 11.5px; margin-bottom: 4px; }
        .po3-terms-body { white-space: pre-line; }

        /* ---- 10. Authorised signature --------------------------------- */
        .po3-sign { display: flex; }
        .po3-sign-left { width: 62%; border-right: 1px solid #000; }
        .po3-sign-right { width: 38%; padding: 5px 8px 3px; text-align: center; }
        .po3-sign-for { font-weight: 700; text-align: left; }
        .po3-sign-mark { display: block; margin: 2px auto 0; width: 30mm; height: 12mm; }
        .po3-sign-label { padding-top: 2px; }

        /* ---- 11. Footer ------------------------------------------------ */
        .po3-footer { padding: 3px 6px 4px; text-align: center; font-size: 9px; }
        .po3-footer div + div { margin-top: 2px; }

        /* ==== Print ======================================================
           The app's navigation, toolbars and buttons must not reach the
           paper. They are removed with display: none rather than merely
           hidden: visibility: hidden would leave the whole application
           shell occupying its full on-screen width behind the scenes, and
           Chromium reads that leftover footprint when it picks an
           orientation — which is how a portrait @page still comes out
           landscape in Chrome while Edge prints it correctly. */
        @media print {
          html.${PO_TEMPLATE_PRINTING_CLASS}, body.${PO_TEMPLATE_PRINTING_CLASS}, body.${PO_TEMPLATE_PRINTING_CLASS} #root {
            width: 210mm; height: 297mm;
            margin: 0; padding: 0; overflow: hidden; background: #fff;
          }
          body.${PO_TEMPLATE_PRINTING_CLASS} *:not(:has(.po3-print-root)):not(.po3-print-root):not(.po3-print-root *) {
            display: none !important;
          }
          body.${PO_TEMPLATE_PRINTING_CLASS} *:has(.po3-print-root) {
            display: block !important; position: static !important;
            width: auto !important; min-width: 0 !important; max-width: none !important;
            height: auto !important; min-height: 0 !important;
            margin: 0 !important; padding: 0 !important;
            background: none !important; box-shadow: none !important;
            overflow: visible !important; border: 0 !important;
          }
          body.${PO_TEMPLATE_PRINTING_CLASS} .po3-screen-only { display: none !important; }
          body.${PO_TEMPLATE_PRINTING_CLASS} .po3-print-root {
            position: absolute; top: 0; left: 0;
            width: 210mm; height: 297mm;
            margin: 0; padding: 0;
          }
          body.${PO_TEMPLATE_PRINTING_CLASS} .po3-page {
            width: 210mm;
            /* 100vh, not 297mm — in print 1vh is 1% of the printable area the
               browser/driver actually grants, which is NOT reliably the full
               sheet even with @page { margin: 0 } (see ReportPrintable.jsx's
               own note, and PurchaseOrderPrintable.jsx). A fixed 297mm here
               leaves the ruled frame short of the real bottom edge with a
               dead strip of paper beneath it whenever a driver reserves its
               own margin or applies a scale. The screen rule above keeps the
               fixed 297mm so the preview is still a true A4 sheet. */
            height: 100vh;
            box-shadow: none; outline: none;
            page-break-after: avoid; page-break-inside: avoid;
          }
          /* Keep the browser from tinting or dropping the ruled borders. */
          body.${PO_TEMPLATE_PRINTING_CLASS} .po3-print-root,
          body.${PO_TEMPLATE_PRINTING_CLASS} .po3-print-root * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
      )}

      <div className="po3-page">
        {/* 1 — Title */}
        <div className="po3-title">PURCHASE ORDER</div>

        <div className="po3-frame">
          {/* 2 + 3 — Supplier "To" block and the two logo slots */}
          <div className="po3-band po3-head">
            <div>
              <div className="po3-to-line"><span>To :</span>{MOCK.vendor.name}</div>
              <div className="po3-vendor-block">
                {MOCK.vendor.addressLines.map((line) => <div key={line}>{line}</div>)}
                <div>GST No : {MOCK.vendor.gstNo} / GST Type : {MOCK.vendor.gstType}</div>
              </div>
            </div>
            <div className="po3-logos">
              {/* companyLogo — first / left */}
              <img
                id="companyLogo"
                className="po3-logo po3-logo-company"
                src={companyLogoSrc}
                alt="Company logo"
              />
              {/* vendorLogo — second / right */}
              <img
                id="vendorLogo"
                className="po3-logo po3-logo-vendor"
                src={vendorLogoSrc}
                alt="Supplier logo"
              />
            </div>
          </div>

          {/* 4 — Billing / Shipping */}
          <div className="po3-band po3-split">
            <div className="po3-half">
              <div className="po3-addr-label">Billing Address :</div>
              <div className="po3-addr-name">{MOCK.billing.name}</div>
              <div className="po3-addr-lines">
                {MOCK.billing.addressLines.map((line) => <div key={line}>{line}</div>)}
              </div>
              <div className="po3-addr-gst">
                GSTN No: {MOCK.billing.gstnNo} / GSTN Type: {MOCK.billing.gstnType}
              </div>
            </div>
            <div className="po3-half">
              <div className="po3-addr-label">Shipping Address :</div>
              <div className="po3-addr-name">{MOCK.shipping.name}</div>
              <div className="po3-addr-lines">
                {MOCK.shipping.addressLines.map((line) => <div key={line}>{line}</div>)}
              </div>
              <div className="po3-addr-gst">
                GSTN No:{MOCK.shipping.gstnNo} / GSTN Type:{MOCK.shipping.gstnType}
              </div>
            </div>
          </div>

          {/* 5 — Ref No / Order Date / Transport / Carrier Name */}
          <div className="po3-band po3-split">
            <div className="po3-half">
              <div className="po3-meta-row">
                <div className="po3-meta-label">Ref No</div>
                <div className="po3-meta-colon">:</div>
                <div className="po3-meta-value">{MOCK.refNo}</div>
              </div>
              <div className="po3-meta-row">
                <div className="po3-meta-label">Order Date</div>
                <div className="po3-meta-colon">:</div>
                <div className="po3-meta-value">{MOCK.orderDate}</div>
              </div>
            </div>
            <div className="po3-half">
              <div className="po3-meta-row">
                <div className="po3-meta-label">Transport</div>
                <div className="po3-meta-colon">:</div>
                <div className="po3-meta-value">{MOCK.transport}</div>
              </div>
              <div className="po3-meta-row">
                <div className="po3-meta-label">Carrier Name</div>
                <div className="po3-meta-colon">:</div>
                <div className="po3-meta-value">{MOCK.carrierName}</div>
              </div>
            </div>
          </div>

          {/* 6 — Comments */}
          <div className="po3-band po3-comments">Comments :&nbsp;{MOCK.comments}</div>

          {/* 7 + 8 — Item table, closing with the Total Qty / Total row.
              Three tables sharing one <colgroup>: header + item rows, a
              filler that stretches to fill the sheet's spare height with
              ruled empty columns, and the Total Qty / Total row pinned to the
              bottom of the band. See .po3-items-band in the CSS above. */}
          <div className="po3-band po3-items-band">
            <table className="po3-items">
              {itemColGroup}
              <thead>
                <tr>
                  <th>S.<br />No</th>
                  <th>Item<br />Code</th>
                  <th>Description</th>
                  <th>HSN/<br />SAC</th>
                  <th>UM</th>
                  <th>Qty</th>
                  <th>Unit<br />Price</th>
                  <th>Disc<br />%</th>
                  <th>Ass.<br />Value</th>
                  <th>Tax<br />%</th>
                  <th>Tax<br />Amount</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {MOCK.items.map((row) => (
                  <tr key={row.slNo}>
                    <td className="ctr">{row.slNo}</td>
                    <td>{row.itemCode}</td>
                    <td>{row.description}</td>
                    <td>{row.hsnSac}</td>
                    <td className="ctr">{row.um}</td>
                    <td className="ctr">{row.qty}</td>
                    <td className="num">{row.unitPrice}</td>
                    <td className="num">{row.discPercent}</td>
                    <td className="num">{row.assValue}</td>
                    <td>{row.taxLines.map((t) => <div key={t}>{t}</div>)}</td>
                    <td className="num">{row.taxAmountLines.map((t, i) => <div key={i}>{t}</div>)}</td>
                    <td className="num">{row.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Ruled empty space — a single row that takes every pixel left
                in the band, so the column dividers carry on down to the
                totals row instead of stopping under the last item. */}
            <div className="po3-items-fill">
              <table className="po3-items po3-items-filler">
                {itemColGroup}
                <tbody>
                  <tr>
                    {ITEM_COL_WIDTHS.map((_, i) => <td key={i} />)}
                  </tr>
                </tbody>
              </table>
            </div>

            <table className="po3-items">
              {itemColGroup}
              <tfoot>
                <tr>
                  <td colSpan={3} />
                  {/* Label spans HSN/SAC + UM so "Total Qty" cannot break
                      mid-word in the 4%-wide UM column; the figure itself
                      still lands in the Qty column. */}
                  <td colSpan={2} className="ctr">Total Qty</td>
                  <td className="ctr">{MOCK.totalQty}</td>
                  <td colSpan={4} className="ctr">Total</td>
                  <td />
                  <td className="num">{MOCK.total}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* 9 + 10 — Amount in Words, and Freight / Round off / Grand Total */}
          <div className="po3-band po3-sum">
            <div className="po3-sum-words">
              Amount in Words. (INR)<span className="v">{MOCK.amountInWords}</span>
            </div>
            <div className="po3-sum-figures">
              <div className="r"><div className="l">Freight charges</div><div className="a">{MOCK.freightCharges}</div></div>
              <div className="r"><div className="l">Round off</div><div className="a">{MOCK.roundOff}</div></div>
              <div className="r grand"><div className="l">Grand Total</div><div className="a">{MOCK.grandTotal}</div></div>
            </div>
          </div>

          {/* 11 — Tax summary */}
          <div className="po3-band">
            <table className="po3-tax">
              <colgroup>
                <col style={{ width: '20%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '17%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '17%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>HSN/SAC</th>
                  <th>TAXABLE VALUE</th>
                  <th>CENTRAL TAX %</th>
                  <th>CENTRAL TAX AMT</th>
                  <th>STATE TAX %</th>
                  <th>STATE TAX AMT</th>
                </tr>
              </thead>
              <tbody>
                {MOCK.taxSummary.map((t) => (
                  <tr key={t.hsnSac}>
                    <td>{t.hsnSac}</td>
                    <td>{t.taxableValue}</td>
                    <td>{t.centralTaxPercent}</td>
                    <td>{t.centralTaxAmt}</td>
                    <td>{t.stateTaxPercent}</td>
                    <td>{t.stateTaxAmt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 12 — Tax Amount in Words */}
          <div className="po3-band po3-tax-words">
            Tax Amount in Words. (INR)<span className="v">{MOCK.taxAmountInWords}</span>
          </div>

          {/* 13 — Terms & Conditions (absorbs the sheet's spare height) */}
          <div className="po3-band po3-terms">
            <div className="po3-terms-title">Terms &amp; Conditions :</div>
            <div className="po3-terms-body">{MOCK.termsConditions}</div>
          </div>

          {/* 14 — Authorised signature */}
          <div className="po3-band po3-sign">
            <div className="po3-sign-left" />
            <div className="po3-sign-right">
              <div className="po3-sign-for">For&nbsp;&nbsp;{MOCK.authorisedFor}</div>
              <MockSignature />
              <div className="po3-sign-label">Signature of the Authorized Person</div>
            </div>
          </div>

          {/* 15 — Footer */}
          <div className="po3-footer">
            <div>Subject to &apos;{MOCK.jurisdiction} Jurisdiction&apos;</div>
            <div>Ph No : {MOCK.phone} &nbsp; Email Id : {MOCK.email}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
