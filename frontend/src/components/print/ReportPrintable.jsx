import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import dayjs from 'dayjs';
import { useGetCompanyDetailsQuery } from '../../features/company/companyDetailsApi';
import { getPrintCellValue, formatPrintTotal } from './reportPrint';
import {
  LetterheadHeader, LetterheadWatermark, LetterheadFooter, letterheadStyles,
} from './Letterhead';
import { useIsActiveTab } from '../navigation/TabPathContext';
import { makeScopedPrint } from './purchaseStationery';

const PRINTING_CLASS = 'report-printing';
const PAGE_RULE_ID = 'report-print-page-rule';

export const printReport = makeScopedPrint({ printingClass: PRINTING_CLASS, pageRuleId: PAGE_RULE_ID });

/**
 * The one print layout every Reports > * > * page renders into. Mounted
 * unconditionally (it stays `display: none` until the browser is actually
 * printing), so a report page's Print button stays a plain
 * `onClick={() => window.print()}` — this component, not the button, is
 * what decides what ends up on paper.
 *
 * `body * { visibility: hidden }` + `.report-print-area, .report-print-area *
 * { visibility: visible }` is the same technique already used for the
 * statutory document printables (Sales Invoice/Order/Quotation, Purchase
 * Order/Invoice, Delivery Challan — see ./SalesInvoicePrintable.jsx and
 * siblings): everything else on the page — sidebar, top nav, tab bar,
 * breadcrumbs, the filter card, the on-screen table's toolbar/pagination —
 * is hidden from print without needing a `.no-print` class hand-added to
 * every one of those elements individually.
 *
 * --- The requirement, and why the layout is shaped the way it is ----------
 * The letterhead masthead sits at the top and the closing band at the foot —
 * and for the common case (a report whose rows fit on one sheet), the foot
 * band belongs flush against the BOTTOM edge of that sheet, not tucked
 * directly under the last row with blank paper beneath it.
 *
 * This went through three designs before landing here; the first two are
 * worth knowing about because both failed for reasons that only showed up
 * on a real printer, not in a quick preview:
 *
 *  1. `position: fixed` on the footer band, meant to paint it once per
 *     printed page regardless of where the table's rows stopped. That is
 *     the CSS Paged Media spec's intent, but Chromium's actual behaviour for
 *     `position: fixed` inside a paginated print context is not consistent
 *     across versions or print pipelines — depending on the build/driver
 *     (confirmed against Windows' own "Microsoft Print to PDF"), the fixed
 *     band was sometimes painted once at wherever its flow position landed
 *     rather than repeated on every page, which for a short report meant
 *     the footer got stranded alone on an orphan trailing page while the
 *     table stayed on page one.
 *
 *  2. `<tfoot>` with `display: table-footer-group`, the same repeat
 *     mechanism the header already relies on via `<thead>`. This reliably
 *     fixed the orphan-page failure — the footer always lands on the same
 *     page as the content before it — but table-footer-group repeats a
 *     table's foot immediately after that page's last row, not pinned to
 *     the page's physical bottom edge. For a short report that left the
 *     footer sitting directly under "Generated on ..." with a large dead
 *     strip of blank paper below it before the sheet actually ends.
 *
 * The layout below keeps table-footer-group's reliability for the row grid
 * itself (the `<thead>` column-heading row still repeats on every page a
 * long report breaks onto — that part was never the problem) and borrows
 * SalesInvoicePrintable's technique for the rest: `.rp-sheet` is a fixed-size
 * physical page (its margin drawn as its own padding rather than left to
 * `@page margin` — see that file's comment for why that specific number is
 * the one thing print engines are NOT consistent about honouring), and
 * `.rp-page` inside it is a column flexbox with a growing spacer
 * (`.rp-fill`) between the table and the closing meta/footer block. A short
 * report's spacer absorbs the leftover height and pushes "Generated on ..."
 * and the letterhead footer down to the foot of the sheet; a report long
 * enough to need more than one physical page simply overflows past
 * `.rp-sheet`'s box as normal — the spacer has nothing left to give, so the
 * footer prints directly after the last row instead, on whichever page that
 * turns out to be. That is the same trade `table-footer-group` already made
 * and is unavoidable without knowing a report's row count ahead of a real
 * page break: on a genuinely multi-page report the masthead and footer
 * bands each print once — at the very top and the very bottom of the whole
 * document — rather than repeating on every page. Given the alternative
 * (position: fixed) does not reliably repeat them either, once-and-correct
 * beats sometimes-repeated-sometimes-orphaned.
 *
 * The watermark stays fixed: it only recentres per page, and getting that
 * wrong is a faint mistint on one page, not a phantom blank one.
 *
 * Letterhead.jsx is shared with the statutory printables and is not touched;
 * the `.lh-header` / `.lh-footer` overrides below only re-target its
 * positioning for this flowing-report context.
 *
 * `rows` is expected to be the report's full filtered/sorted result set
 * (the same array each report already hands to its CSV export), never the
 * paginated slice, so the printout always contains every row the on-screen
 * filters matched regardless of which page the grid happens to be showing.
 */

// Most reports are narrow enough for A4 portrait; a page with a wide grid
// (10+ columns, or a handful of wide text columns) passes
// orientation="landscape" explicitly instead of relying on this default.
const DEFAULT_ORIENTATION = 'portrait';

// A4 in millimetres. Which of these is the printed page's HEIGHT depends on
// orientation — portrait prints the 297mm edge vertically, landscape prints
// the 210mm edge vertically — so `.rp-sheet`'s height below is picked per
// orientation rather than hardcoded.
const A4_LONG_MM = 297;
const A4_SHORT_MM = 210;

// Plain uniform sheet margin, drawn as `.rp-sheet`'s own padding — see the
// file comment for why that, and not `@page margin`, is what decides it.
const PAGE_MARGIN_MM = 10;

// --- Brand rule spacing, for THIS document ---------------------------------
// Mirrors RULE_SPACING in SalesInvoicePrintable.jsx: only the keys set here
// override the shared letterhead defaults (RULE_SPACING_MM in
// ./Letterhead.jsx), and all four are restated so every gap on the sheet is
// visible in one place while the layout is being tuned.
const RULE_SPACING = {
  headerAbove: 1.5,
  headerBelow: 0,
  footerAbove: 2,
  footerBelow: 1.5,
};

export default function ReportPrintable({
  title,
  subtitle,
  filters = [],
  columns,
  rows,
  totals,
  totalsLabel = 'Total',
  orientation = DEFAULT_ORIENTATION,
}) {
  const isActiveTab = useIsActiveTab();
  const { data: company } = useGetCompanyDetailsQuery();
  const generatedOn = dayjs().format('DD-MMM-YYYY HH:mm');
  const colCount = columns.length;
  const pageHeightMm = orientation === 'landscape' ? A4_SHORT_MM : A4_LONG_MM;

  useEffect(() => {
    if (!isActiveTab) return;
    const onBeforePrint = () => {
      document.body.classList.add(PRINTING_CLASS);
      document.documentElement.classList.add(PRINTING_CLASS);
    };
    const onAfterPrint = () => {
      document.body.classList.remove(PRINTING_CLASS);
      document.documentElement.classList.remove(PRINTING_CLASS);
    };
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
      document.body.classList.remove(PRINTING_CLASS);
      document.documentElement.classList.remove(PRINTING_CLASS);
    };
  }, [isActiveTab]);

  if (!isActiveTab) return null;

  const sheet = (
    <div className="report-print-area">
      <style>{`
        ${letterheadStyles('.rp-page', RULE_SPACING)}
        .report-print-area { display: none; }
        @media print {
          body.${PRINTING_CLASS} #root { display: none !important; }
          body.${PRINTING_CLASS} .report-print-area {
            display: block !important; position: absolute; top: 0; left: 0; width: 100%;
          }
          body.${PRINTING_CLASS} .report-print-area,
          body.${PRINTING_CLASS} .report-print-area * {
            visibility: visible;
          }
          /* margin: 0 deliberately — see SalesInvoicePrintable.jsx's @page
             comment. The margin is .rp-sheet's own padding below instead,
             so it can't drift from what the height maths assumes. */
          @page { size: A4 ${orientation}; margin: 0; }

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
           hardcoded ${pageHeightMm}mm: in print, 1vh is 1% of whatever
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
          padding: ${PAGE_MARGIN_MM}mm;
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
      `}
      </style>

      <div className="rp-sheet">
        <div className="rp-page">
          <LetterheadWatermark />
          <LetterheadHeader company={company} />

          <div className="rp-title">{title}</div>
          {subtitle && <div className="rp-subtitle">{subtitle}</div>}
          {filters.length > 0 && (
            <div className="rp-filters">
              <span className="rp-filters-label">Filters Applied:</span>
              {filters.map((f) => (
                <span className="rp-filter-chip" key={f.label}>
                  <span className="k">{f.label}:</span> {f.value}
                </span>
              ))}
            </div>
          )}

          <table className="rp-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.field} style={{ textAlign: c.align || 'left' }}>{c.headerName}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={colCount} style={{ textAlign: 'center' }}>No records found for the selected criteria</td></tr>
              )}
              {rows.map((row, idx) => (
                <tr key={row.id ?? idx}>
                  {columns.map((c) => (
                    <td key={c.field} style={{ textAlign: c.align || 'left' }}>{getPrintCellValue(c, row)}</td>
                  ))}
                </tr>
              ))}
              {totals && (
                <tr className="rp-totals">
                  {columns.map((c, idx) => (
                    <td key={c.field} style={{ textAlign: idx === 0 ? 'left' : (c.align || 'left') }}>
                      {idx === 0 ? totalsLabel : formatPrintTotal(totals[c.field])}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>

          <div className="rp-fill" />

          <div className="rp-meta-block">
            <div className="rp-meta">
              <span>Generated on {generatedOn}</span>
              <span>{rows.length} record{rows.length === 1 ? '' : 's'}</span>
            </div>
            <LetterheadFooter company={company} />
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document === 'undefined' ? sheet : createPortal(sheet, document.body);
}
