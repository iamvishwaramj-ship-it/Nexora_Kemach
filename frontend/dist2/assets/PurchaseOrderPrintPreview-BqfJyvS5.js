import{j as e,B as a,e as n}from"./index-Da-Ih398.js";import{d as r}from"./PrintOutlined-BpKRlxz4.js";import{k as d}from"./kemach-PXgjVHv5.js";import{v as l}from"./indus-logo-BBHEDWcL.js";const s={vendor:{name:"INDUS MOTOR COMPANY PRIVATE LTD.",addressLines:["Ernakulam, - 682015","Kerala India"],gstNo:"32AAACI4904J1ZV",gstType:"Regular/TDS/ISD"},billing:{name:"KEMACH EQUIPMENTS PRIVATE LIMITED",addressLines:["15/340A, SwalihPlaza, Karikkode, Okkal,","Post. Ernakulam, 683 550, India."],gstnNo:"32AAICK1298F1ZL",gstnType:"Regular/TDS/ISD"},shipping:{name:"KEMACH EQUIPMENTS PRIVATE LIMITED",addressLines:["2199-13, HAZAT PALAZA, NEAR KANNUR UNIVERSITY., NEAR","KANNUR UNIVERSITY, Thavakkara., KANNUR, 670002","Kerala. India."],gstnNo:"32AAICK1298F1ZL",gstnType:"Regular/TDS/ISD"},refNo:"KEM/PO/ BETA-30 / 262740026",orderDate:"05-Jun-2026",transport:"by Road",carrierName:"",comments:"",items:[{slNo:1,itemCode:"8010041047",description:"INDUSROCK TOOL MAKE BETA 30 ROCK BREAKER WITH STD ACCESSORIES",hsnSac:"8430.41.",um:"NOS",qty:"1",unitPrice:"254237.28",discPercent:"0.00",assValue:"254237.28",taxLines:["CGST 9.0%","SGST 9.0%"],taxAmountLines:["22881.36","22881.36"],amount:"299999.99"}],totalQty:"1",total:"299999.99",amountInWords:"Three lakhs only",freightCharges:"0.00",roundOff:"0.01",grandTotal:"300000.00",taxSummary:[{hsnSac:"8430.41",taxableValue:"(INR)254237.28",centralTaxPercent:"9.00",centralTaxAmt:"(INR)22881.36",stateTaxPercent:"9.00",stateTaxAmt:"(INR)22881.36"}],taxAmountInWords:"Forty-Five Thousand Seven Hundred Sixty-Two and Seventy-One Pisa only",termsConditions:"DELIVERY AT OUR KANNUR BRANCH.",authorisedFor:"KEMACH EQUIPMENTS PRIVATE LIMITED",jurisdiction:"Coimbatore",phone:"8300127888",email:"info@kemach.in"},p=["4%","9%","20%","8%","4%","4%","9%","5%","9%","7%","9%","12%"];function h(){return e.jsxs("svg",{className:"po3-sign-mark",viewBox:"0 0 120 44","aria-hidden":"true",children:[e.jsx("path",{d:`M8 32 C 20 6, 30 6, 32 24 C 34 40, 26 42, 24 32 C 22 20, 34 10, 48 20\r
           C 58 27, 52 38, 46 34 C 40 30, 48 16, 66 18 C 78 19, 84 28, 96 14`,fill:"none",stroke:"#16326b",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"}),e.jsx("path",{d:"M62 36 C 74 30, 86 30, 104 34",fill:"none",stroke:"#16326b",strokeWidth:"1.6",strokeLinecap:"round"})]})}function c(){return e.jsxs("div",{className:"po3-print-root",children:[e.jsx("style",{children:`
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
        /* flex: 1 — this is the band that absorbs the sheet's spare height,
           which is what pins the signature band and footer to the bottom. */
        .po3-terms { flex: 1; padding: 5px 6px; min-height: 0; }
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
          html, body, #root {
            width: 210mm; height: 297mm;
            margin: 0; padding: 0; overflow: hidden; background: #fff;
          }
          /* Remove the app shell from LAYOUT, not merely from view — see the
             note above on why visibility: hidden is what lets Chrome flip the
             job to landscape.
             The naive form of this, "body > *:not(.po3-print-root)", is what
             used to be here and it printed a BLANK sheet: this preview page
             renders inside the app (#root > MainLayout > ... > this sheet), so
             that selector hid #root — and the sheet along with it. These two
             rules are ancestor-aware instead:
               1. hide every element that is not the sheet, not inside it, and
                  not an ANCESTOR of it (:has(.po3-print-root)), and
               2. strip the surviving ancestors of the layout they impose
                  (flex, widths, padding, min-heights), so the chain down to
                  the sheet contributes nothing but a path.
             :has() is supported by every browser this app targets (Chrome/Edge
             105+, Safari 15.4+). */
          body *:not(:has(.po3-print-root)):not(.po3-print-root):not(.po3-print-root *) {
            display: none !important;
          }
          body *:has(.po3-print-root) {
            display: block !important; position: static !important;
            width: auto !important; min-width: 0 !important; max-width: none !important;
            height: auto !important; min-height: 0 !important;
            margin: 0 !important; padding: 0 !important;
            background: none !important; box-shadow: none !important;
            overflow: visible !important; border: 0 !important;
          }
          .po3-screen-only { display: none !important; }
          .po3-print-root {
            position: absolute; top: 0; left: 0;
            width: 210mm; height: 297mm;
            margin: 0; padding: 0;
          }
          .po3-page {
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
          .po3-print-root, .po3-print-root * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}),e.jsxs("div",{className:"po3-page",children:[e.jsx("div",{className:"po3-title",children:"PURCHASE ORDER"}),e.jsxs("div",{className:"po3-frame",children:[e.jsxs("div",{className:"po3-band po3-head",children:[e.jsxs("div",{children:[e.jsxs("div",{className:"po3-to-line",children:[e.jsx("span",{children:"To :"}),s.vendor.name]}),e.jsxs("div",{className:"po3-vendor-block",children:[s.vendor.addressLines.map(t=>e.jsx("div",{children:t},t)),e.jsxs("div",{children:["GST No : ",s.vendor.gstNo," / GST Type : ",s.vendor.gstType]})]})]}),e.jsxs("div",{className:"po3-logos",children:[e.jsx("img",{id:"companyLogo",className:"po3-logo po3-logo-company",src:d,alt:"Company logo"}),e.jsx("img",{id:"vendorLogo",className:"po3-logo po3-logo-vendor",src:l,alt:"Supplier logo"})]})]}),e.jsxs("div",{className:"po3-band po3-split",children:[e.jsxs("div",{className:"po3-half",children:[e.jsx("div",{className:"po3-addr-label",children:"Billing Address :"}),e.jsx("div",{className:"po3-addr-name",children:s.billing.name}),e.jsx("div",{className:"po3-addr-lines",children:s.billing.addressLines.map(t=>e.jsx("div",{children:t},t))}),e.jsxs("div",{className:"po3-addr-gst",children:["GSTN No: ",s.billing.gstnNo," / GSTN Type: ",s.billing.gstnType]})]}),e.jsxs("div",{className:"po3-half",children:[e.jsx("div",{className:"po3-addr-label",children:"Shipping Address :"}),e.jsx("div",{className:"po3-addr-name",children:s.shipping.name}),e.jsx("div",{className:"po3-addr-lines",children:s.shipping.addressLines.map(t=>e.jsx("div",{children:t},t))}),e.jsxs("div",{className:"po3-addr-gst",children:["GSTN No:",s.shipping.gstnNo," / GSTN Type:",s.shipping.gstnType]})]})]}),e.jsxs("div",{className:"po3-band po3-split",children:[e.jsxs("div",{className:"po3-half",children:[e.jsxs("div",{className:"po3-meta-row",children:[e.jsx("div",{className:"po3-meta-label",children:"Ref No"}),e.jsx("div",{className:"po3-meta-colon",children:":"}),e.jsx("div",{className:"po3-meta-value",children:s.refNo})]}),e.jsxs("div",{className:"po3-meta-row",children:[e.jsx("div",{className:"po3-meta-label",children:"Order Date"}),e.jsx("div",{className:"po3-meta-colon",children:":"}),e.jsx("div",{className:"po3-meta-value",children:s.orderDate})]})]}),e.jsxs("div",{className:"po3-half",children:[e.jsxs("div",{className:"po3-meta-row",children:[e.jsx("div",{className:"po3-meta-label",children:"Transport"}),e.jsx("div",{className:"po3-meta-colon",children:":"}),e.jsx("div",{className:"po3-meta-value",children:s.transport})]}),e.jsxs("div",{className:"po3-meta-row",children:[e.jsx("div",{className:"po3-meta-label",children:"Carrier Name"}),e.jsx("div",{className:"po3-meta-colon",children:":"}),e.jsx("div",{className:"po3-meta-value",children:s.carrierName})]})]})]}),e.jsxs("div",{className:"po3-band po3-comments",children:["Comments : ",s.comments]}),e.jsx("div",{className:"po3-band",children:e.jsxs("table",{className:"po3-items",children:[e.jsx("colgroup",{children:p.map((t,i)=>e.jsx("col",{style:{width:t}},i))}),e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsxs("th",{children:["S.",e.jsx("br",{}),"No"]}),e.jsxs("th",{children:["Item",e.jsx("br",{}),"Code"]}),e.jsx("th",{children:"Description"}),e.jsxs("th",{children:["HSN/",e.jsx("br",{}),"SAC"]}),e.jsx("th",{children:"UM"}),e.jsx("th",{children:"Qty"}),e.jsxs("th",{children:["Unit",e.jsx("br",{}),"Price"]}),e.jsxs("th",{children:["Disc",e.jsx("br",{}),"%"]}),e.jsxs("th",{children:["Ass.",e.jsx("br",{}),"Value"]}),e.jsxs("th",{children:["Tax",e.jsx("br",{}),"%"]}),e.jsxs("th",{children:["Tax",e.jsx("br",{}),"Amount"]}),e.jsx("th",{children:"Amount"})]})}),e.jsx("tbody",{children:s.items.map(t=>e.jsxs("tr",{children:[e.jsx("td",{className:"ctr",children:t.slNo}),e.jsx("td",{children:t.itemCode}),e.jsx("td",{children:t.description}),e.jsx("td",{children:t.hsnSac}),e.jsx("td",{className:"ctr",children:t.um}),e.jsx("td",{className:"ctr",children:t.qty}),e.jsx("td",{className:"num",children:t.unitPrice}),e.jsx("td",{className:"num",children:t.discPercent}),e.jsx("td",{className:"num",children:t.assValue}),e.jsx("td",{children:t.taxLines.map(i=>e.jsx("div",{children:i},i))}),e.jsx("td",{className:"num",children:t.taxAmountLines.map((i,o)=>e.jsx("div",{children:i},o))}),e.jsx("td",{className:"num",children:t.amount})]},t.slNo))}),e.jsx("tfoot",{children:e.jsxs("tr",{children:[e.jsx("td",{colSpan:3}),e.jsx("td",{colSpan:2,className:"ctr",children:"Total Qty"}),e.jsx("td",{className:"ctr",children:s.totalQty}),e.jsx("td",{colSpan:4,className:"ctr",children:"Total"}),e.jsx("td",{}),e.jsx("td",{className:"num",children:s.total})]})})]})}),e.jsxs("div",{className:"po3-band po3-sum",children:[e.jsxs("div",{className:"po3-sum-words",children:["Amount in Words. (INR)",e.jsx("span",{className:"v",children:s.amountInWords})]}),e.jsxs("div",{className:"po3-sum-figures",children:[e.jsxs("div",{className:"r",children:[e.jsx("div",{className:"l",children:"Freight charges"}),e.jsx("div",{className:"a",children:s.freightCharges})]}),e.jsxs("div",{className:"r",children:[e.jsx("div",{className:"l",children:"Round off"}),e.jsx("div",{className:"a",children:s.roundOff})]}),e.jsxs("div",{className:"r grand",children:[e.jsx("div",{className:"l",children:"Grand Total"}),e.jsx("div",{className:"a",children:s.grandTotal})]})]})]}),e.jsx("div",{className:"po3-band",children:e.jsxs("table",{className:"po3-tax",children:[e.jsxs("colgroup",{children:[e.jsx("col",{style:{width:"20%"}}),e.jsx("col",{style:{width:"18%"}}),e.jsx("col",{style:{width:"15%"}}),e.jsx("col",{style:{width:"17%"}}),e.jsx("col",{style:{width:"13%"}}),e.jsx("col",{style:{width:"17%"}})]}),e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"HSN/SAC"}),e.jsx("th",{children:"TAXABLE VALUE"}),e.jsx("th",{children:"CENTRAL TAX %"}),e.jsx("th",{children:"CENTRAL TAX AMT"}),e.jsx("th",{children:"STATE TAX %"}),e.jsx("th",{children:"STATE TAX AMT"})]})}),e.jsx("tbody",{children:s.taxSummary.map(t=>e.jsxs("tr",{children:[e.jsx("td",{children:t.hsnSac}),e.jsx("td",{children:t.taxableValue}),e.jsx("td",{children:t.centralTaxPercent}),e.jsx("td",{children:t.centralTaxAmt}),e.jsx("td",{children:t.stateTaxPercent}),e.jsx("td",{children:t.stateTaxAmt})]},t.hsnSac))})]})}),e.jsxs("div",{className:"po3-band po3-tax-words",children:["Tax Amount in Words. (INR)",e.jsx("span",{className:"v",children:s.taxAmountInWords})]}),e.jsxs("div",{className:"po3-band po3-terms",children:[e.jsx("div",{className:"po3-terms-title",children:"Terms & Conditions :"}),e.jsx("div",{className:"po3-terms-body",children:s.termsConditions})]}),e.jsxs("div",{className:"po3-band po3-sign",children:[e.jsx("div",{className:"po3-sign-left"}),e.jsxs("div",{className:"po3-sign-right",children:[e.jsxs("div",{className:"po3-sign-for",children:["For  ",s.authorisedFor]}),e.jsx(h,{}),e.jsx("div",{className:"po3-sign-label",children:"Signature of the Authorized Person"})]})]}),e.jsxs("div",{className:"po3-footer",children:[e.jsxs("div",{children:["Subject to '",s.jurisdiction," Jurisdiction'"]}),e.jsxs("div",{children:["Ph No : ",s.phone,"   Email Id : ",s.email]})]})]})]})]})}function b(){return e.jsxs(a,{children:[e.jsx(a,{className:"po3-screen-only",sx:{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:1.5,mb:2},children:e.jsx(n,{type:"button",variant:"contained",startIcon:e.jsx(r,{}),onClick:()=>window.print(),children:"Print"})}),e.jsx(a,{className:"po3-screen-only-frame",sx:{display:"flex",justifyContent:"center",overflowX:"auto","& .po3-page":{outline:"1px solid #d0d0d0","@media print":{outline:"none"}}},children:e.jsx(c,{})})]})}export{b as default};
