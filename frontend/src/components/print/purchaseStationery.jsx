import React from 'react';
import { partnerAddressLines } from '../../lib/addressFormat';
import dayjs from 'dayjs';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { round2, num, isTcsTaxType } from '../../lib/documentTotals';

/**
 * Shared stationery for the purchase-document family that prints as a
 * pixel match of the signed-off Purchase Order sheet (see
 * PurchaseOrderPrintable.jsx / PurchaseOrderPrintTemplate.jsx). PO itself is
 * NOT changed or routed through this file — it stays exactly as signed off.
 * This module is what PurchaseInvoicePrintable, PurchaseGRNPrintable,
 * PurchaseReturnPrintable and PurchaseCreditMemoPrintable are built on, so
 * the five purchase documents read as one consistent stationery family
 * instead of five different designs.
 *
 * Every document keeps its own print-activation wrapper class, body class
 * and @page rule id (see makeScopedPrint below) so printing one document
 * never fights another's job even though every KeepAlive tab stays mounted.
 * The visual layout classes ("po3-*") are deliberately the SAME literal
 * class names PurchaseOrderPrintable.jsx uses — every document's <style>
 * block defines them with identical rules, so multiple mounted copies never
 * conflict (last-one-wins is harmless when every copy agrees).
 */

// Registered-office jurisdiction named in the footer — fixed legal
// stationery text, not a per-company field, matching PurchaseOrderPrintable.
export const JURISDICTION_CITY = 'Coimbatore';

// GST registration category shown next to a GSTIN when the record itself
// doesn't carry one.
export const DEFAULT_GST_TYPE = 'Regular/TDS/ISD';

// The item table's column widths, as percentages of the sheet width —
// identical across every document in the family so the header, the body and
// the Total Qty/Total row can never drift out of alignment.
export const ITEM_COL_WIDTHS = ['4%', '9%', '20%', '8%', '4%', '4%', '9%', '5%', '9%', '7%', '9%', '12%'];

export const fmtDate = (d) => (d ? dayjs(d).format('DD-MMM-YYYY') : '—');
// No thousands grouping — the legacy reference stationery prints
// "254237.28", never "2,54,237.28". Used only on the HSN/SAC summary table.
export const fmtMoney = (n) => `(INR)${(Number(n) || 0).toFixed(2)}`;
export const fmt2 = (n) => (Number(n) || 0).toFixed(2);
// The item table's own Tax % cell prints one decimal place with a trailing
// "%" ("CGST 9.0%") — a different precision than the HSN/SAC summary's Tax %
// columns (two decimals, no "%"). Reproduced verbatim from PO's stationery.
export const fmt1 = (n) => (Number(n) || 0).toFixed(1);

// --- Amount in words, matching PurchaseOrderPrintable's own converter -----
// Deliberately NOT lib/numberToWords.js's amountToWords() — see the matching
// note in PurchaseOrderPrintable.jsx. Reproduces the legacy print system's
// own quirks verbatim (hyphenated compound tens, lower-case "lakh"/"crore",
// "Pisa", lower-case "only").
const WORDS_ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const WORDS_TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigitWords(n) {
  if (n < 20) return WORDS_ONES[n];
  const tens = WORDS_TENS[Math.floor(n / 10)];
  const one = n % 10;
  return one ? `${tens}-${WORDS_ONES[one]}` : tens;
}

function threeDigitWords(n) {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return `${h ? `${WORDS_ONES[h]} Hundred` : ''}${h && rest ? ' ' : ''}${rest ? twoDigitWords(rest) : ''}`;
}

export function wordsInr(value) {
  const abs = Math.abs(Number(value) || 0);
  const rupees = Math.floor(abs);
  const paise = Math.round((abs - rupees) * 100);
  if (rupees === 0 && paise === 0) return 'Zero only';

  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const rest = rupees % 1000;

  const parts = [];
  if (crore) parts.push(`${threeDigitWords(crore)} crore${crore > 1 ? 's' : ''}`);
  if (lakh) parts.push(`${twoDigitWords(lakh)} lakh${lakh > 1 ? 's' : ''}`);
  if (thousand) parts.push(`${twoDigitWords(thousand)} Thousand`);
  if (rest) parts.push(threeDigitWords(rest));

  const rupeeWords = parts.length ? parts.join(' ') : 'Zero';
  return paise ? `${rupeeWords} and ${twoDigitWords(paise)} Pisa only` : `${rupeeWords} only`;
}

// One postal address line from a Business Partner address row — its fields
// are all optional and sparsely filled in practice, so each line is built
// from whatever is actually set rather than assuming every field is present.
export function formatPartnerAddressLines(addr) {
  // Standard order, no double commas -- lib/addressFormat.js.
  return partnerAddressLines(addr);
}

export function defaultAddressOf(partner, addressType) {
  const rows = (partner?.addresses || []).filter((a) => a.addressType === addressType);
  return rows.find((a) => a.isDefault) || rows[0] || null;
}

// billFrom / shipTo are stored as newline-joined "Name\nAddress, City,
// State" strings on several of these documents — split back into a name
// line + address line(s) for display.
export function splitBlock(text) {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  return { name: lines[0] || '', rest: lines.slice(1) };
}

/**
 * Per-line display figures for the item table: the line's own taxable value
 * and true tax. `ratio` is totals.taxableAmount / totals.subtotal from the
 * shared documentTotals engine (buildDocument/computeTotals) — applying it
 * per line here is the SAME arithmetic computeTotals applies internally, so
 * summing these across every line reproduces totals.taxableAmount/totalTax
 * exactly (what the item table's Total row, Round off and Grand Total all
 * rely on tying out to).
 *
 * `quantityField` lets a GRN line read `receivedQuantity`, a Return line
 * `returnQuantity`, a Credit Memo line `quantity`, and so on, from the same
 * function. A line's own Discount % (Invoice/Return/Credit Memo item lines)
 * is used automatically when present; `headerDiscPercent` is the fallback
 * for a document whose lines carry no discount field of their own (GRN has
 * neither line nor header discount, so 0).
 */
export function lineDisplay(item, ratio, { quantityField = 'quantity', headerDiscPercent = 0 } = {}) {
  const qty = num(item?.[quantityField]);
  const unitPrice = num(item?.unitPrice);
  const gross = round2(qty * unitPrice);
  // A line with its own Discount % field uses that; a line with none
  // falls back to the document's header Discount % (0 when neither exists).
  const discPercent = item?.discountPercent != null ? num(item.discountPercent) : num(headerDiscPercent);
  const netAfterLineDiscount = round2(gross - round2(gross * (discPercent / 100)));
  const taxable = round2(netAfterLineDiscount * ratio);
  const taxPercent = num(item?.taxPercent);
  const trueTax = round2(taxable * (taxPercent / 100));
  return { qty, unitPrice, discPercent, taxable, taxPercent, trueTax, amount: round2(taxable + trueTax) };
}

// Display-only CGST/SGST (or IGST) split for the item table's Tax %/Tax
// Amount columns and the HSN/SAC summary. Matches PurchaseOrderPrintable's
// own displayTaxRows exactly: both CGST/SGST halves print as the same
// rounded round2(tax / 2), not a remainder-safe split — display-only, the
// item's own Amount column and every header total use the true tax instead.
//
// `tcs` (optional) is `{ taxable, taxType }` for ONE ITEM LINE — when that
// line's own Tax Code is 'GST+TCS'/'IGST+TCS' (isTcsTaxType), a trailing TCS
// sub-row is appended, same convention as SalesInvoicePrintable.jsx's own
// components.push(...) in its renderItemsTable. Callers building the HSN/SAC
// summary (a GROUP, not one line) never pass this — TCS is a document-level
// figure there, shown via StationerySheet's own dedicated TCS columns
// instead (see tcsAmount prop), not folded into any one HSN group's row.
export function displayTaxRows(taxPercent, trueTax, interState, tcs = {}) {
  const rows = interState
    ? [{ label: 'IGST', pct: num(taxPercent), amount: trueTax }]
    : (() => {
        const half = round2(trueTax / 2);
        const halfPct = round2(num(taxPercent) / 2);
        return [
          { label: 'CGST', pct: halfPct, amount: half },
          { label: 'SGST', pct: halfPct, amount: half },
        ];
      })();
  if (isTcsTaxType(tcs.taxType)) {
    rows.push({ label: 'TCS', pct: 1, amount: round2((num(tcs.taxable) + num(trueTax)) * 0.01) });
  }
  return rows;
}

// Tax-summary column widths for the footer tax table, extended with two
// more columns (TCS %, TCS AMT) when the document carries any TCS — same
// gating as StationerySheet's own tcsAmount > 0 check. Percentages are
// re-proportioned (not just two more columns tacked on at the old widths)
// so the table still sums to 100% width either way. No HSN/SAC column any
// more — see the matching removal in StationerySheet's own tax-summary
// table below.
export function buildTaxColWidths(interState, hasTcs) {
  if (interState) {
    return hasTcs
      ? ['24%', '19%', '21%', '17%', '19%']
      : ['33%', '34%', '33%'];
  }
  return hasTcs
    ? ['16%', '13%', '15%', '12%', '14%', '13%', '17%']
    : ['23%', '19%', '21%', '16%', '21%'];
}

/**
 * Groups a document's items into HSN/SAC-wise summary rows (grouped on the
 * TRUE per-line tax, so the group total ties out) — same shape
 * PurchaseOrderPrintable builds inline, lifted out so every document in the
 * family groups identically.
 */
export function buildHsnGroups(items, ratio, opts) {
  const groups = [];
  const index = new Map();
  (items || []).forEach((it) => {
    const { taxable, trueTax, taxPercent } = lineDisplay(it, ratio, opts);
    const key = `${it.hsnCode || '—'}|${taxPercent}`;
    if (!index.has(key)) {
      const group = { hsnCode: it.hsnCode || '—', taxPercent, taxable: 0, trueTax: 0 };
      index.set(key, group);
      groups.push(group);
    }
    const group = index.get(key);
    group.taxable = round2(group.taxable + taxable);
    group.trueTax = round2(group.trueTax + trueTax);
  });
  return groups;
}

// --- Print activation --------------------------------------------------
// One factory, one call per document — each gets its own gating class and
// @page-rule id so printing one never fights another's job, and its own
// PRINT_CLASS keeps a document's CSS from ever being visible outside an
// actual print (see the matching note in PurchaseOrderPrintable.jsx: every
// KeepAliveOutlet tab stays mounted, so an ungated rule would blank or
// hijack whatever else the user happens to be printing).
// A print-area's images (supplier logo, House Bank QR code, an uploaded
// signature) load from remote storage (OCI), unlike the bundled KEMACH
// logo/signature assets Vite inlines/caches up front — those are always
// ready. window.print() used to fire the instant the printing class was
// toggled on, with no regard for whether those remote images had actually
// finished downloading yet: print/export while one was still in flight and
// the browser simply rendered that <img> blank in the printed output. The
// image itself kept loading in the background regardless, so the very next
// print attempt (once the browser had it cached) came out correct — exactly
// the "sometimes the logo doesn't show, then it's fine right after" symptom
// reported against the supplier logo, which is really any not-yet-loaded
// print image, on any of the documents that print through this helper.
//
// Fixed generically here (rather than per-document) since every document
// family that calls makeScopedPrint shares the same risk. Every <img> in the
// document — not just this document's own print area — is awaited: the
// other candidates (another tab's KeepAliveOutlet-mounted printable, an
// avatar in the still-hidden #root) are either already loaded or resolve
// immediately, so this costs nothing extra and does not need to know this
// document's own print-area selector.
function waitForImages(timeoutMs = 4000) {
  const pending = Array.from(document.images).filter((img) => !img.complete);
  if (pending.length === 0) return Promise.resolve();
  return Promise.race([
    Promise.all(pending.map((img) => new Promise((resolve) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true }); // a broken/missing URL should not hang the print forever
    }))),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

export function makeScopedPrint({ printingClass, pageRuleId }) {
  return function printThisDocument() {
    const root = document.documentElement;
    root.classList.add(printingClass);
    document.body.classList.add(printingClass);

    if (!document.getElementById(pageRuleId)) {
      const rule = document.createElement('style');
      rule.id = pageRuleId;
      // Explicit millimetres, not the `A4 portrait` keyword pair — see
      // PurchaseOrderPrintable.jsx's own note on the Windows "Microsoft
      // Print to PDF" driver honouring physical dimensions more reliably.
      rule.textContent = '@page { size: 210mm 297mm; margin: 0; }';
      document.head.appendChild(rule);
    }

    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      root.classList.remove(printingClass);
      document.body.classList.remove(printingClass);
      const rule = document.getElementById(pageRuleId);
      if (rule) rule.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    // Some PDF drivers never fire afterprint; without this the app would be
    // left with its shell hidden the next time anything printed.
    setTimeout(cleanup, 60000);

    // Toggling the printing class just above makes this document's own
    // print-area images (display:none -> block) start loading only now, on
    // top of whichever remote images (a supplier logo, a bank QR) were
    // already mid-fetch from an earlier render — so the wait has to happen
    // AFTER the class is on, not before.
    waitForImages().then(() => window.print());
  };
}

/**
 * "Send via WhatsApp"'s PDF source. Mirrors makeScopedPrint's own
 * printing-class/@page-rule toggle exactly (same visibility switch the
 * Print button uses), but instead of handing off to the browser's native
 * print dialog via window.print(), screenshots each already-paginated
 * sheet block (one per physical page — see e.g. SalesQuotationPrintable's
 * .sqp-sheet) with html2canvas and drops each one onto its own A4 page of a
 * jsPDF document. This is what lets the WhatsApp send flow attach a real
 * PDF with ZERO backend PDF-rendering infrastructure (no Puppeteer/Chromium
 * on the server, nothing new to install there): the exact same on-screen
 * printable the Print button already produces is captured as an image and
 * reassembled into a PDF, entirely in the browser, then uploaded.
 *
 * Returns a Blob (application/pdf) — the caller (WhatsAppShareButton via
 * each printable's own exported capture<Doc>Pdf, e.g. captureSalesQuotationPdf)
 * appends it to a FormData and posts it to that document's own
 * /whatsapp/send route.
 */
export function makeScopedCapture({ printingClass, pageRuleId, sheetSelector, areaSelector }) {
  return async function capturePrintableAsPdf() {
    const root = document.documentElement;
    root.classList.add(printingClass);
    document.body.classList.add(printingClass);

    if (!document.getElementById(pageRuleId)) {
      const rule = document.createElement('style');
      rule.id = pageRuleId;
      rule.textContent = '@page { size: 210mm 297mm; margin: 0; }';
      document.head.appendChild(rule);
    }

    // The bug this block exists to avoid: every printable's own
    // "<areaClass> { display: none; }" base rule is only ever flipped to
    // display: block inside that document's `@media print { ... }` block
    // (see e.g. SalesInvoicePrintable.jsx's .sinv-print-area). That's fine
    // for makeScopedPrint, since window.print() genuinely renders under
    // print media -- but html2canvas renders the ordinary SCREEN DOM, which
    // never evaluates @media print at all. Toggling printingClass alone
    // therefore left the print area (and every .xxx-sheet inside it) at
    // display: none the whole time, so html2canvas captured a 0x0 box --
    // a blank/white page, which is exactly the "white page" WhatsApp
    // attachment this was built to fix. Forcing it visible here with an
    // inline style (important, so it beats the stylesheet rule) sidesteps
    // the media-query gate entirely. Positioned off-screen (not
    // display:none/visibility:hidden, which would collapse layout again)
    // so there's no visible on-screen flash while this runs.
    const areaEl = areaSelector ? document.querySelector(areaSelector) : null;
    if (areaEl) {
      areaEl.style.setProperty('display', 'block', 'important');
      areaEl.style.setProperty('position', 'absolute', 'important');
      areaEl.style.setProperty('left', '-99999px', 'important');
      areaEl.style.setProperty('top', '0', 'important');
      areaEl.style.setProperty('width', '100%', 'important');
    }

    const cleanup = () => {
      root.classList.remove(printingClass);
      document.body.classList.remove(printingClass);
      const rule = document.getElementById(pageRuleId);
      if (rule) rule.remove();
      if (areaEl) {
        areaEl.style.removeProperty('display');
        areaEl.style.removeProperty('position');
        areaEl.style.removeProperty('left');
        areaEl.style.removeProperty('top');
        areaEl.style.removeProperty('width');
      }
    };

    try {
      await waitForImages();
      const sheets = Array.from(document.querySelectorAll(sheetSelector));
      if (sheets.length === 0) {
        throw new Error('Nothing to attach — save the document first, then try again.');
      }

      const PAGE_WIDTH_MM = 210;
      const PAGE_HEIGHT_MM = 297;
      // Every sheet sizes its own inner content off viewport units --
      // .sinv-sheet is `min-height: 100vh`, .sinv-page inside it is
      // `min-height: calc(100vh - <margin>*2)` (same shape on the
      // Quotation side) -- because under real printing, "100vh" IS one
      // physical A4 page. On an ordinary browser tab, though, 100vh is
      // whatever the actual window happens to be: usually much wider and
      // shorter than A4's portrait ratio. html2canvas was capturing that
      // real, wrong-shaped viewport, so every sheet came out short and
      // squat -- small content jammed into the top of the page, the
      // letterhead footer riding up near the middle instead of sitting at
      // the true bottom of a full page, exactly what was reported.
      // windowWidth/windowHeight tell html2canvas to clone the document
      // into a VIRTUAL iframe of exactly this size instead of the real
      // window -- every `vh`/`vw` unit inside .sinv-sheet then resolves
      // against a genuinely A4-shaped viewport, so the capture comes out
      // shaped like an actual printed page with no CSS changes needed.
      const MM_TO_PX = 96 / 25.4; // standard CSS px-per-mm at 96dpi
      const captureWindowWidth = Math.round(PAGE_WIDTH_MM * MM_TO_PX);
      const captureWindowHeight = Math.round(PAGE_HEIGHT_MM * MM_TO_PX);
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      for (let i = 0; i < sheets.length; i += 1) {
        // scale: 2 -- sharper text/lines in the attached PDF than a 1x
        // screenshot would give, at a still-reasonable file size for a
        // WhatsApp document attachment.
        // eslint-disable-next-line no-await-in-loop
        const canvas = await html2canvas(sheets[i], {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          windowWidth: captureWindowWidth,
          windowHeight: captureWindowHeight,
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        if (i > 0) pdf.addPage('a4', 'portrait');
        // Fit the captured canvas into the page WITHOUT stretching it to a
        // hardcoded 210x297 box. The sheet is captured at whatever its
        // on-screen pixel dimensions actually are, which is the browser's
        // own viewport shape (there is no @page/print-media constraint in
        // effect here — see makeScopedCapture's own note on why this whole
        // function exists) — not necessarily an exact A4 ratio. Forcing a
        // non-A4-shaped image into a 210x297 box distorted everything in
        // it non-uniformly, including turning the square QR code into a
        // rectangle. Scaling by the SAME factor on both axes (contain-fit,
        // width-capped since these sheets are always taller than they are
        // wide) keeps every square pixel square.
        const scale = Math.min(PAGE_WIDTH_MM / canvas.width, PAGE_HEIGHT_MM / canvas.height);
        const renderWidthMm = canvas.width * scale;
        const renderHeightMm = canvas.height * scale;
        const xOffsetMm = (PAGE_WIDTH_MM - renderWidthMm) / 2;
        pdf.addImage(imgData, 'JPEG', xOffsetMm, 0, renderWidthMm, renderHeightMm);
      }
      return pdf.output('blob');
    } finally {
      cleanup();
    }
  };
}

/**
 * The shared CSS: the print-activation/visibility rules (parameterised by
 * this document's own areaClass/printingClass) plus the po3- layout rules,
 * copied verbatim from PurchaseOrderPrintable.jsx. Emit once per document,
 * inside that document's own <style> tag.
 */
export function buildStationeryCss({ areaClass, printingClass }) {
  return `
    .${areaClass} { display: none; }
    @media print {
      /* Chrome (unlike Edge, on the same Chromium engine) picks the print
         orientation partly from the actual laid-out size of <html>/<body> at
         print time, not only from @page — see PurchaseOrderPrintable.jsx's
         own note. display: none removes the app shell from LAYOUT rather
         than merely hiding it, so there is no oversized footprint left for
         Chrome to react to by silently flipping the job to landscape. Only
         expressible because this sheet is portaled to <body> — see the
         createPortal call in each document's own component. */
      /* width only -- no forced height/overflow:hidden any more. A
         document long enough to span several physical pages (see the
         per-page pagination in StationerySheet below) now renders as
         several stacked .po3-sheet blocks that are together taller than
         one viewport; forcing html/body to exactly 297mm with
         overflow:hidden would clip every page after the first right back
         out of existence, reproducing the very bug this pagination fixes.
         Letting height stay auto (and overflow visible) lets the
         page-break-after rule below carry the extra sheets onto their own
         physical pages instead. */
      html.${printingClass}, body.${printingClass} {
        width: 210mm !important;
        margin: 0 !important; padding: 0 !important;
        background: #fff !important;
      }
      body.${printingClass} > *:not(.${areaClass}) { display: none !important; }
      body.${printingClass} #root > *:not(.${areaClass}) { display: none !important; }
      body.${printingClass} .${areaClass} {
        display: block !important; position: absolute; top: 0; left: 0;
        width: 100%; margin: 0; padding: 0;
      }
      body.${printingClass} .${areaClass},
      body.${printingClass} .${areaClass} * { visibility: visible; }

      /* Each .po3-sheet is one explicit, self-contained physical page --
         see the pagination comment above paginateStationeryItems below.
         Scoped to this document's own areaClass since every purchase
         document in the family shares these literal po3-* class names
         and can be mounted at the same time (KeepAliveOutlet). */
      .${areaClass} .po3-sheet { page-break-after: always; }
      .${areaClass} .po3-sheet:last-child { page-break-after: auto; }
    }

    /* ==== Layout — copied verbatim from PurchaseOrderPrintable.jsx's po3-*
       rules. Keep the two in sync: PO itself is not routed through this
       module, so a change made only here will not reach PO's own sheet. */
    /* One explicit block per physical printed page -- see the pagination
       comment above paginateStationeryItems below for why this replaced
       the single fixed-height .po3-page box. min-height: 100vh, NOT a
       fixed height: a short page (few items) still fills exactly one
       visual page (the items-fill flex child inside .po3-items-band
       stretches into the slack), while a page with enough items to
       exceed one page's worth of content simply grows taller than 100vh
       instead of being clipped -- the page-break-after rule above then
       carries the overflow onto the next .po3-sheet block. */
    .po3-sheet {
      width: 100%;
      min-height: 100vh;
      padding: 6mm;
      background: #fff;
      box-sizing: border-box;
    }
    .po3-page {
      width: 100%;
      /* min-height: calc(...), NOT height: 100% -- .po3-sheet above has
         no definite height of its own any more (min-height: 100vh with
         no height set, so it can grow with content), and a percentage
         height on a child needs a definite height on the parent to
         resolve against; against an indefinite/auto parent height,
         height: 100% computes to auto instead (CSS2.1 10.5), which would
         silently collapse this flex column to its own content's natural
         height and pull .po3-footer up under a short item table instead
         of the true bottom of the sheet. .po3-sheet's own 6mm padding
         (top and bottom) sits OUTSIDE this element, so the floor here is
         100vh minus that padding, not 100vh itself. */
      min-height: calc(100vh - 12mm);
      background: #fff;
      color: #000;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.28;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    }

    .po3-title {
      text-align: center;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.5px;
      padding-bottom: 4px;
    }

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

    .po3-head { display: flex; justify-content: space-between; align-items: flex-start; padding: 4px 6px 5px; gap: 10px; }
    .po3-to-line { font-weight: 700; margin-bottom: 7px; }
    .po3-to-line span { display: inline-block; min-width: 34px; }
    .po3-vendor-block { padding-left: 34px; }
    /* Purchase Return only: label sits on its own line (its "Supplier :"
       text is wider than the 34px reserved for PO's "To :", so it no
       longer shares a line with the party name), and the address below it
       carries no left indent. */
    .po3-to-line.po3-to-line--stacked span { display: block; min-width: 0; }
    .po3-vendor-block.po3-vendor-block--flush { padding-left: 0; }
    .po3-vendor-block div { line-height: 1.45; }
    .po3-logos { display: flex; align-items: flex-start; gap: 14px; flex-shrink: 0; padding-top: 2px; }
    .po3-logo { object-fit: contain; }
    .po3-logo-company { height: 15mm; max-width: 46mm; }
    .po3-logo-vendor { height: 17mm; max-width: 46mm; }

    .po3-addr-label { margin-bottom: 3px; }
    .po3-addr-name { font-weight: 700; font-size: 11.5px; margin-bottom: 3px; }
    .po3-addr-lines div { line-height: 1.45; }
    .po3-addr-gst { margin-top: 2px; }

    .po3-meta-row { display: flex; align-items: baseline; }
    .po3-meta-row + .po3-meta-row { margin-top: 4px; }
    .po3-meta-label { font-weight: 700; width: 30%; }
    .po3-meta-colon { width: 8px; }
    .po3-meta-value { font-weight: 700; }

    .po3-comments { padding: 4px 6px 6px; font-weight: 700; }

    table.po3-items { width: 100%; border-collapse: collapse; table-layout: fixed; }
    table.po3-items th, table.po3-items td {
      border-right: 1px solid #000;
      border-bottom: 1px solid #000;
      padding: 2px 4px;
      font-size: 9.5px;
      vertical-align: top;
      word-wrap: break-word;
    }
    table.po3-items th:last-child, table.po3-items td:last-child { border-right: none; }
    /* A CGST/SGST/TCS sub-row (see renderItemsTable below) only carries its
       own two tax cells in the DOM -- every other column rides down via
       rowSpan from the item's main row above it. That makes the Tax Amount
       cell the DOM-last-child of its own <tr>, so the generic rule just
       above wrongly stripped its right border, leaving the Tax %/Tax
       Amount box open on the right instead of closed against the Amount
       column. This cell is never actually the table's last column, so its
       right border must stay. */
    table.po3-items td.po3-taxsub-amt:last-child { border-right: 1px solid #000; }
    table.po3-items thead th { text-align: center; font-weight: 700; vertical-align: middle; }
    table.po3-items td.ctr { text-align: center; }
    /* Rate/Amount cells hold the widest numbers in the row (with
       commas and two decimals) but sit in the narrowest columns --
       at the table's base 9.5px they were wide enough to spill past
       the column's right border instead of wrapping (word-wrap:
       break-word only breaks between characters, which for a plain
       number never kicks in). Matching the sales printables' own
       fix for the identical problem: shrink just the numeric cells
       to 8.5px and force a single line, so the number fits inside
       its column instead of overflowing it. */
    table.po3-items td.num { text-align: right; font-size: 8.5px; white-space: nowrap; }
    table.po3-items tfoot td { font-weight: 700; border-bottom: none; }
    table.po3-items tfoot td.ctr { text-align: center; }

    .po3-items-band { flex: 1 0 auto; display: flex; flex-direction: column; }
    .po3-items-fill { flex: 1 1 auto; display: flex; flex-direction: column; min-height: 0; }
    table.po3-items-filler { flex: 1 1 auto; height: 100%; margin-top: -1px; }
    table.po3-items-filler td { padding: 0; }

    .po3-sum { display: flex; }
    .po3-sum-words { width: 62%; border-right: 1px solid #000; padding: 5px 6px; font-weight: 700; }
    .po3-sum-words .v { font-weight: 400; padding-left: 10px; }
    .po3-sum-figures { width: 38%; }
    .po3-sum-figures .r { display: flex; border-bottom: 1px solid #000; }
    .po3-sum-figures .r:last-child { border-bottom: none; }
    .po3-sum-figures .r .l { width: 62%; padding: 3px 6px; border-right: 1px solid #000; }
    .po3-sum-figures .r .a { width: 38%; padding: 3px 6px; text-align: right; }
    .po3-sum-figures .r.grand .l, .po3-sum-figures .r.grand .a { font-weight: 700; }

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

    .po3-tax-words { padding: 4px 6px; font-weight: 700; }
    .po3-tax-words .v { font-weight: 400; padding-left: 10px; }

    .po3-terms { padding: 5px 6px; }
    .po3-terms-title { font-weight: 700; font-size: 11.5px; margin-bottom: 4px; }
    .po3-terms-body { white-space: pre-line; }

    .po3-sign { display: flex; }
    .po3-sign-left { width: 62%; border-right: 1px solid #000; }
    .po3-sign-right { width: 38%; padding: 5px 8px 3px; text-align: center; }
    .po3-sign-for { font-weight: 700; text-align: left; }
    .po3-sign-mark { display: block; margin: 2px auto 0; width: 30mm; height: 12mm; object-fit: contain; }
    .po3-sign-spacer { height: 10mm; }
    .po3-sign-label { padding-top: 2px; }

    .po3-footer { padding: 3px 6px 4px; text-align: center; font-size: 9px; }
    .po3-footer div + div { margin-top: 2px; }

    .${areaClass}, .${areaClass} * {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  `;
}

/**
 * Per-physical-printed-page pagination -- see SalesQuotationPrintable.jsx's
 * own identical pagination comment for the full reasoning (a pure-CSS
 * @page-margin + position:fixed approach was tried first and failed in this
 * app's actual print/PDF pipeline: the @page margin did not reflow ordinary
 * content out of the reserved band, so the fixed header/footer drew ON TOP
 * of the body instead of around it). The fix here is the same one: build
 * the document as several explicit, self-contained .po3-sheet page blocks
 * (see renderPage/renderAllPages in StationerySheet below), each carrying
 * its own complete copy of this document's header cards (po3-head/
 * po3-split/po3-comments), its own item-table slice, and -- on the last
 * page only -- the totals/HSN-summary/terms/signature content. The
 * po3-footer contact/jurisdiction strip repeats on EVERY page, same as a
 * real letterhead footer would. The already-working page-break-after:
 * always rule (see buildStationeryCss's @media print block above) is what
 * turns each block into its own physical page.
 *
 * Item counts per page are a fixed estimate, not a live measurement -- this
 * environment has no way to render the page and see exactly where text
 * wraps. Deliberately mirrors SalesQuotationPrintable.jsx's own constants
 * (FIRST 8 / MID 18 / LAST 8): that document's header cards (company block +
 * billing/shipping split + document-detail block) and footer content
 * (totals + HSN summary + tax words + bank details + declarations/signature)
 * are comparable in on-page size to this document's own header cards
 * (po3-head + billing/shipping split + meta-rows split + one-line comments)
 * and footer content (totals/words + HSN summary + tax words + terms +
 * signature) -- err conservative (smaller counts, more pages) rather than
 * risk the overflow this pagination exists to fix. Retune here if a real
 * print/PDF comes back with a page ending noticeably early.
 */
const FIRST_PAGE_MAX_ITEMS = 8; // page 1 also carries the party/billing/shipping/meta cards
const MID_PAGE_MAX_ITEMS = 18;  // a continuation page with nothing but the item grid
const LAST_PAGE_MAX_ITEMS = 8;  // the last page also carries totals/HSN/terms/signature

/**
 * Split items into page-sized chunks. A document short enough to fit
 * FIRST_PAGE_MAX_ITEMS on its own comes back as a single page that is both
 * isFirst and isLast -- i.e. today's single-page layout, unchanged.
 */
function paginateStationeryItems(items) {
  if (items.length <= FIRST_PAGE_MAX_ITEMS) {
    return [{ items, isFirst: true, isLast: true }];
  }
  const pages = [{ items: items.slice(0, FIRST_PAGE_MAX_ITEMS), isFirst: true, isLast: false }];
  let rest = items.slice(FIRST_PAGE_MAX_ITEMS);
  while (rest.length > LAST_PAGE_MAX_ITEMS) {
    pages.push({ items: rest.slice(0, MID_PAGE_MAX_ITEMS), isFirst: false, isLast: false });
    rest = rest.slice(MID_PAGE_MAX_ITEMS);
  }
  // If the last MID-sized slice above consumed every remaining item
  // exactly (rest.length === 0), don't push a further page for the
  // leftover empty array — that produced a real, observed bug: a
  // spurious extra page with no items at all, just the repeating
  // letterhead header/footer band and a lot of blank space. Instead,
  // the LAST page already pushed by the loop is the true last page.
  if (rest.length > 0) {
    pages.push({ items: rest, isFirst: false, isLast: true });
  } else {
    pages[pages.length - 1].isLast = true;
  }
  return pages;
}

/**
 * The shared po3- markup tree, data-driven from generic props so every
 * document in the family (Invoice/GRN/Return/Credit Memo) renders the exact
 * same structure PurchaseOrderPrintable.jsx does, just with different
 * content. Each document's own component computes these props from its own
 * order/company/supplier/etc. and wraps this in its own print-area div +
 * createPortal -- see PurchaseInvoicePrintable.jsx for the pattern.
 *
 * Internally renders one .po3-sheet per PHYSICAL PRINTED PAGE (see the
 * pagination comment above paginateStationeryItems) -- the props here are
 * unchanged from before pagination was added, so none of the four wrapper
 * components (PurchaseGRNPrintable.jsx etc.) needed to change at all.
 */
export function StationerySheet({
  title,
  headLabel,
  partyName,
  partyCode,
  partyAddrLines,
  partyGstNo,
  partyGstType,
  companyLogoUrl,
  companyLogoAlt,
  partyLogoUrl,
  partyLogoAlt,
  leftBoxLabel,
  leftBoxName,
  leftBoxAddrLines,
  leftBoxGstNo,
  leftBoxGstType,
  rightBoxLabel,
  rightBoxName,
  rightBoxAddrLines,
  rightBoxGstNo,
  rightBoxGstType,
  metaLeftRows,
  metaRightRows,
  metaRightLabelWidth,
  commentsLabel,
  commentsValue,
  items,
  totalQty,
  itemsTotal,
  amountInWords,
  freightCharges,
  roundOff,
  grandTotal,
  taxColWidths,
  hsnRows,
  interState,
  // Document-level TCS (1% of Subtotal + CGST + SGST + IGST, computed once
  // by the shared documentTotals engine — see totals.tcsAmount) — never
  // per-line, never per-HSN-group. Gates the HSN/SAC summary's TCS %/TCS AMT
  // columns exactly the way SalesInvoicePrintable.jsx gates its own single
  // TCS row: tcsAmount > 0 shows them, 0 (no TCS-typed line on this
  // document) hides them entirely.
  tcsAmount = 0,
  taxAmountInWords,
  termsTitle,
  termsValue,
  signFor,
  footerJurisdiction,
  footerPhone,
  footerEmail,
  approverSignatureUrl,
  // Purchase Type 'Machine': bigger signature, no "Signature of the Authorized Person" caption.
  machineType = false,
  // Purchase Return only (see the CSS comment on .po3-to-line--stacked
  // above): breaks the head label onto its own line and drops the address
  // block's left indent, instead of the default PO-style layout where the
  // short "To :" label shares a line with the party name.
  stackedHead = false,
}) {
  const itemColGroup = (
    <colgroup>
      {ITEM_COL_WIDTHS.map((w, i) => <col key={i} style={{ width: w }} />)}
    </colgroup>
  );

  const pages = paginateStationeryItems(items || []);
  const pageCount = pages.length;

  // Party/company head + billing-shipping split + meta-rows split +
  // comments line -- page 1 only.
  const renderHeaderCards = () => (
    <>
      <div className="po3-band po3-head">
        <div>
          <div className={`po3-to-line${stackedHead ? ' po3-to-line--stacked' : ''}`}><span>{headLabel}</span>{partyName || '—'}{partyCode ? ` - ${partyCode}` : ''}</div>
          <div className={`po3-vendor-block${stackedHead ? ' po3-vendor-block--flush' : ''}`}>
            {(partyAddrLines && partyAddrLines.length)
              ? partyAddrLines.map((line, i) => <div key={i}>{line}</div>)
              : <div>—</div>}
            <div>GST No : {partyGstNo || '—'} / GST Type : {partyGstType || DEFAULT_GST_TYPE}</div>
          </div>
        </div>
        <div className="po3-logos">
          {companyLogoUrl && (
            <img id="companyLogo" className="po3-logo po3-logo-company" src={companyLogoUrl} alt={companyLogoAlt || 'Company logo'} />
          )}
          {partyLogoUrl && (
            <img id="vendorLogo" className="po3-logo po3-logo-vendor" src={partyLogoUrl} alt={partyLogoAlt || 'Supplier logo'} />
          )}
        </div>
      </div>

      <div className="po3-band po3-split">
        <div className="po3-half">
          <div className="po3-addr-label">{leftBoxLabel}</div>
          <div className="po3-addr-name">{leftBoxName}</div>
          <div className="po3-addr-lines">
            {(leftBoxAddrLines || []).map((line, i) => <div key={i}>{line}</div>)}
          </div>
          <div className="po3-addr-gst">
            GSTN No: {leftBoxGstNo || '—'} / GSTN Type: {leftBoxGstType || DEFAULT_GST_TYPE}
          </div>
        </div>
        <div className="po3-half">
          <div className="po3-addr-label">{rightBoxLabel}</div>
          <div className="po3-addr-name">{rightBoxName}</div>
          <div className="po3-addr-lines">
            {(rightBoxAddrLines || []).map((line, i) => <div key={i}>{line}</div>)}
          </div>
          <div className="po3-addr-gst">
            GSTN No: {rightBoxGstNo || '—'} / GSTN Type: {rightBoxGstType || DEFAULT_GST_TYPE}
          </div>
        </div>
      </div>

      <div className="po3-band po3-split">
        <div className="po3-half">
          {(metaLeftRows || []).map((row, i) => (
            <div className="po3-meta-row" key={i}>
              <div className="po3-meta-label">{row.label}</div>
              <div className="po3-meta-colon">:</div>
              <div className="po3-meta-value">{row.value ?? '—'}</div>
            </div>
          ))}
        </div>
        <div className="po3-half">
          {(metaRightRows || []).map((row, i) => (
            <div className="po3-meta-row" key={i}>
              <div
                className="po3-meta-label"
                style={metaRightLabelWidth ? { width: metaRightLabelWidth, whiteSpace: 'nowrap' } : undefined}
              >{row.label}</div>
              <div className="po3-meta-colon">:</div>
              <div className="po3-meta-value">{row.value ?? '—'}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="po3-band po3-comments">{commentsLabel}&nbsp;{commentsValue || ''}</div>
    </>
  );

  // Line items for one page, with running S.No carried across pages via
  // startIndex -- same technique SalesQuotationPrintable.jsx's own
  // renderItemsTable uses.
  const renderItemsTable = (pageItems, startIndex) => (
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
        {pageItems.map((row, i) => {
          const idx = startIndex + i;
          // Each tax component (CGST/SGST, or IGST, plus a trailing TCS
          // when row.taxRows carries one — see displayTaxRows) gets its own
          // bordered sub-row stacked inside the Tax %/Tax Amount column,
          // exactly like SalesInvoicePrintable.jsx's own renderItemsTable:
          // the first component rides along on the item's main <tr> (every
          // other column spanning every sub-row via rowSpan), and any
          // further components are separate <tr>s with only the two tax
          // cells — the ordinary table.po3-items td border-right/
          // border-bottom rules (already in buildStationeryCss) are what
          // draw the rule between them, no new styling needed.
          const n = row.taxRows.length;
          return (
            <React.Fragment key={idx}>
              <tr>
                <td className="ctr" rowSpan={n}>{idx + 1}</td>
                <td rowSpan={n}>{row.itemCode || '—'}</td>
                <td rowSpan={n}>
                  {row.description || '—'}
                  {Array.isArray(row.machineDetails) && row.machineDetails.length > 0 && (
                    <div className="po3-machine-details" style={{ marginTop: '1mm', fontSize: '0.92em' }}>
                      {row.machineDetails.map(([label, val]) => (
                        <div key={label}><strong>{label}:</strong> {val}</div>
                      ))}
                    </div>
                  )}
                </td>
                <td rowSpan={n}>{row.hsnSac || '—'}</td>
                <td className="ctr" rowSpan={n}>{row.um || '—'}</td>
                <td className="ctr" rowSpan={n}>{row.qty}</td>
                <td className="num" rowSpan={n}>{fmt2(row.unitPrice)}</td>
                <td className="num" rowSpan={n}>{fmt2(row.discPercent)}</td>
                <td className="num" rowSpan={n}>{fmt2(row.taxable)}</td>
                <td>{row.taxRows[0].label} {fmt1(row.taxRows[0].pct)}%</td>
                <td className="num">{fmt2(row.taxRows[0].amount)}</td>
                <td className="num" rowSpan={n}>{fmt2(row.amount)}</td>
              </tr>
              {row.taxRows.slice(1).map((r, j) => (
                <tr key={j}>
                  <td>{r.label} {fmt1(r.pct)}%</td>
                  <td className="num po3-taxsub-amt">{fmt2(r.amount)}</td>
                </tr>
              ))}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );

  // The blank filler row that stretches the item grid down to the bottom of
  // THIS page's own sheet -- every page carries its own, same as before.
  const renderItemsFiller = () => (
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
  );

  // Total Qty / Total row -- a DOCUMENT-wide figure (totalQty/itemsTotal
  // cover every page's items, not just this page's slice), so -- like
  // SalesQuotationPrintable's own totals table -- it belongs with the rest
  // of the footer content on the last page only.
  const renderItemsTotalRow = () => (
    <table className="po3-items">
      {itemColGroup}
      <tfoot>
        <tr>
          <td colSpan={3} />
          <td colSpan={2} className="ctr">Total Qty</td>
          <td className="ctr">{totalQty}</td>
          <td colSpan={4} className="ctr">Total</td>
          <td />
          <td className="num">{fmt2(itemsTotal)}</td>
        </tr>
      </tfoot>
    </table>
  );

  // Totals / HSN summary / terms / signature -- last page only.
  const renderFooterContent = () => (
    <>
      <div className="po3-band po3-sum">
        <div className="po3-sum-words">
          Amount in Words. (INR)<span className="v">{amountInWords}</span>
        </div>
        <div className="po3-sum-figures">
          <div className="r"><div className="l">Freight charges</div><div className="a">{fmt2(freightCharges)}</div></div>
          <div className="r"><div className="l">Round off</div><div className="a">{fmt2(roundOff)}</div></div>
          <div className="r grand"><div className="l">Grand Total</div><div className="a">{fmt2(grandTotal)}</div></div>
        </div>
      </div>

      <div className="po3-band">
        <table className="po3-tax">
          <colgroup>
            {taxColWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
          </colgroup>
          <thead>
            <tr>
              {/* No HSN/SAC column — hidden on every purchase document's
                  printed tax summary; hsnRows below is still grouped by
                  HSN/tax-rate internally (buildHsnGroups), just not
                  labelled here any more. */}
              <th>TAXABLE VALUE</th>
              {interState ? (
                <>
                  <th>INTEGRATED TAX %</th>
                  <th>INTEGRATED TAX AMT</th>
                </>
              ) : (
                <>
                  <th>CENTRAL TAX %</th>
                  <th>CENTRAL TAX AMT</th>
                  <th>STATE TAX %</th>
                  <th>STATE TAX AMT</th>
                </>
              )}
              {tcsAmount > 0 && <th>TCS %</th>}
              {tcsAmount > 0 && <th>TCS AMT</th>}
            </tr>
          </thead>
          <tbody>
            {hsnRows.length === 0 ? (
              <tr><td colSpan={(interState ? 3 : 5) + (tcsAmount > 0 ? 2 : 0)}>—</td></tr>
            ) : hsnRows.map((g, i) => (
              <tr key={i}>
                <td>{fmtMoney(g.taxable)}</td>
                {g.taxRows.map((r, j) => (
                  <React.Fragment key={j}>
                    <td>{fmt2(r.pct)}</td>
                    <td>{fmtMoney(r.amount)}</td>
                  </React.Fragment>
                ))}
                {/* TCS is a document-level figure (1% of Subtotal + CGST +
                    SGST + IGST, computed once — see totals.tcsAmount), not
                    tied to any one HSN/tax-rate group, so it is shown once,
                    on the first group row, rather than repeated/duplicated
                    on every row. */}
                {tcsAmount > 0 && <td>{i === 0 ? fmt2(1) : ''}</td>}
                {tcsAmount > 0 && <td>{i === 0 ? fmtMoney(tcsAmount) : ''}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="po3-band po3-tax-words">
        Tax Amount in Words. (INR)<span className="v">{taxAmountInWords}</span>
      </div>

      <div className="po3-band po3-terms">
        <div className="po3-terms-title">{termsTitle}</div>
        <div className="po3-terms-body">{termsValue || '—'}</div>
      </div>

      <div className="po3-band po3-sign">
        <div className="po3-sign-left" />
        <div className="po3-sign-right">
          {!(machineType) && <div className="po3-sign-for">For&nbsp;&nbsp;{signFor}</div>}
          <div className="po3-sign-spacer" style={machineType ? { height: '20mm' } : undefined}>
            {approverSignatureUrl ? <img className="po3-sign-mark" src={approverSignatureUrl} alt="" style={machineType ? { width: '50mm', height: '22mm' } : undefined} /> : null}
          </div>
          {!(machineType) && <div className="po3-sign-label">Signature of the Authorized Person</div>}
        </div>
      </div>
    </>
  );

  // One physical page -- its own title, own header cards (first page only),
  // own item-table slice, own totals/HSN/terms/signature (last page only)
  // and its own contact/jurisdiction footer strip (every page, with a
  // running Page X of Y), all inside its own bordered .po3-frame so each
  // physical sheet reads as a complete, self-contained document page. See
  // the pagination comment above paginateStationeryItems for why this
  // replaced the single fixed-height .po3-page box.
  const renderPage = (page, pageIndex, startIndex) => (
    <div className="po3-sheet" key={pageIndex}>
      <div className="po3-page">
        <div className="po3-title">{title}</div>

        <div className="po3-frame">
          {page.isFirst && renderHeaderCards()}

          <div className="po3-band po3-items-band">
            {renderItemsTable(page.items, startIndex)}
            {renderItemsFiller()}
            {page.isLast && renderItemsTotalRow()}
          </div>

          {page.isLast && renderFooterContent()}

          <div className="po3-footer">
            <div>Subject to &apos;{footerJurisdiction} Jurisdiction&apos;</div>
            <div>Ph No : {footerPhone || '—'} &nbsp; Email Id : {footerEmail || '—'} &nbsp; Page {pageIndex + 1} of {pageCount}</div>
          </div>
        </div>
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

  return <>{renderAllPages()}</>;
}
