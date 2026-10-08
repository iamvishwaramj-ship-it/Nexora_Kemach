import{d as c,Y as x,j as e}from"./index-CCF7ae3G.js";import{l as u,L as y,a as w,b as j}from"./Letterhead-CDSg-ZHb.js";function L(a={},i={},s=[]){return Object.entries(a).filter(([,t])=>t!=null&&t!=="").map(([t,n])=>({label:i[t]||t,value:s.includes(t)&&n?c(n).format("DD-MMM-YYYY"):String(n)}))}function v(a,i){if(typeof a.printValue=="function"){const t=a.printValue(i);return t==null||t===""?"—":t}if(typeof a.searchValue=="function"){const t=a.searchValue(i);if(t!=null&&t!=="")return t}const s=i[a.field];return s==null||s===""?"—":typeof s=="number"?s.toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2}):String(s)}function N(a){if(a==null||a==="")return"";const i=Number(a);return Number.isNaN(i)?String(a):i.toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}const k="portrait",A=297,z=210,M=10,S={headerAbove:1.5,headerBelow:0,footerAbove:2,footerBelow:1.5};function P({title:a,subtitle:i,filters:s=[],columns:t,rows:n,totals:p,totalsLabel:f="Total",orientation:h=k}){const{data:d}=x(),m=c().format("DD-MMM-YYYY HH:mm"),g=t.length,b=h==="landscape"?z:A;return e.jsxs("div",{className:"report-print-area",children:[e.jsx("style",{children:`
        ${u(".rp-page",S)}
        .report-print-area { display: none; }
        @media print {
          body * { visibility: hidden; }
          .report-print-area, .report-print-area * { visibility: visible; }
          .report-print-area {
            display: block; position: absolute; top: 0; left: 0; width: 100%;
          }
          /* margin: 0 deliberately — see SalesInvoicePrintable.jsx's @page
             comment. The margin is .rp-sheet's own padding below instead,
             so it can't drift from what the height maths assumes. */
          @page { size: A4 ${h}; margin: 0; }

          /* Header: back into normal flow, because it's now a plain block
             above the table rather than pinned anywhere. */
          .rp-page > .lh-header { position: static; height: auto; }
          /* The footer's own band styling (bottom/left/right/height) is
             built for the absolute-positioned statutory-document case; back
             it into normal flow here too so it just sizes to what it draws
             at wherever the flex layout below places it. */
          .rp-page .lh-footer { position: static; height: auto; }
          /* The watermark is the one band still fixed, so Chromium paints it
             on every page anchored to the page's content area instead of
             once wherever this (possibly many-pages-long) flow happens to
             end. Letterhead.jsx's own centring is already correct against
             that box. */
          .rp-page .lh-watermark { position: fixed; }
        }

        /* The physical sheet. Deliberately sized to 100vh rather than a
           hardcoded ${b}mm: in print, 1vh is 1% of whatever
           printable area the browser/driver actually hands the page, and
           that is NOT reliably the full 297mm/210mm sheet even with
           @page { margin: 0 } set above. Chrome's own print pipeline (and
           real-world drivers such as Windows' "Microsoft Print to PDF")
           can still reserve their own margin around the page regardless of
           that CSS, or apply their own print-dialog Scale — either one
           shrinks or shifts the usable printable area below what this
           component assumed. When that happens, a fixed-mm .rp-sheet no
           longer matches the real printable area, so .rp-fill's spacer
           gets sized against the wrong box and the footer lands short of
           the true physical bottom edge with a dead strip of paper beneath
           it — correct internally, wrong on the sheet. Sizing to 100vh
           instead means the sheet always matches whatever printable area is
           actually granted, and the flex-fill still stretches to consume
           exactly that area, so the footer stays pinned to the real bottom
           regardless of margin/scale quirks in the print pipeline. The page
           margin is still drawn as this element's own padding rather than
           left to @page margin, for the same reason SalesInvoicePrintable.jsx
           does. box-sizing: border-box keeps that padding inside the 100vh
           box. Content taller than one sheet (a long report) simply
           overflows past this box's own edge — that is fine; real
           pagination follows the content's absolute position on the paper,
           not this element's declared height. */
        .rp-sheet {
          height: 100vh;
          box-sizing: border-box;
          padding: ${M}mm;
        }
        /* Column flexbox filling the sheet's content box. .rp-fill is the
           one child allowed to grow, so a short report's leftover height
           lands there and pushes the meta/footer block down to the sheet's
           foot instead of leaving it stranded under a short table. */
        .rp-page {
          display: flex; flex-direction: column;
          min-height: 100%;
          box-sizing: border-box;
          font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 11px;
        }
        .rp-fill { flex: 1 1 auto; }

        .rp-title { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.4px; margin-top: 4px; }
        .rp-subtitle { font-size: 10px; color: #555; margin-top: 1px; }
        .rp-filters { margin: 8px 0 2px; font-size: 10px; color: #222; }
        .rp-filters .rp-filters-label { font-weight: 700; margin-right: 6px; }
        .rp-filters .rp-filter-chip { display: inline-block; margin: 0 10px 2px 0; }
        .rp-filters .rp-filter-chip .k { color: #555; }
        .rp-table { width: 100%; border-collapse: collapse; margin-top: 6px; flex-shrink: 0; }
        .rp-table th, .rp-table td { border: 1px solid #999; padding: 3px 5px; font-size: 9.5px; text-align: left; }
        .rp-table thead th { background: #eee; font-weight: 700; }
        .rp-table tbody tr { page-break-inside: avoid; }
        .rp-table thead { display: table-header-group; }
        .rp-table { page-break-inside: auto; }

        .rp-meta-block { flex-shrink: 0; }
        .rp-meta { display: flex; justify-content: space-between; font-size: 9px; color: #444; padding-top: 2mm; }
        .rp-totals { font-weight: 800; background: #f2f2f2; }
        .rp-totals td { border: 1px solid #999; padding: 3px 5px; font-size: 9.5px; }
      `}),e.jsx("div",{className:"rp-sheet",children:e.jsxs("div",{className:"rp-page",children:[e.jsx(y,{}),e.jsx(w,{company:d}),e.jsx("div",{className:"rp-title",children:a}),i&&e.jsx("div",{className:"rp-subtitle",children:i}),s.length>0&&e.jsxs("div",{className:"rp-filters",children:[e.jsx("span",{className:"rp-filters-label",children:"Filters Applied:"}),s.map(r=>e.jsxs("span",{className:"rp-filter-chip",children:[e.jsxs("span",{className:"k",children:[r.label,":"]})," ",r.value]},r.label))]}),e.jsxs("table",{className:"rp-table",children:[e.jsx("thead",{children:e.jsx("tr",{children:t.map(r=>e.jsx("th",{style:{textAlign:r.align||"left"},children:r.headerName},r.field))})}),e.jsxs("tbody",{children:[n.length===0&&e.jsx("tr",{children:e.jsx("td",{colSpan:g,style:{textAlign:"center"},children:"No records found for the selected criteria"})}),n.map((r,l)=>e.jsx("tr",{children:t.map(o=>e.jsx("td",{style:{textAlign:o.align||"left"},children:v(o,r)},o.field))},r.id??l)),p&&e.jsx("tr",{className:"rp-totals",children:t.map((r,l)=>e.jsx("td",{style:{textAlign:l===0?"left":r.align||"left"},children:l===0?f:N(p[r.field])},r.field))})]})]}),e.jsx("div",{className:"rp-fill"}),e.jsxs("div",{className:"rp-meta-block",children:[e.jsxs("div",{className:"rp-meta",children:[e.jsxs("span",{children:["Generated on ",m]}),e.jsxs("span",{children:[n.length," record",n.length===1?"":"s"]})]}),e.jsx(j,{company:d})]})]})})]})}export{P as R,L as b};
