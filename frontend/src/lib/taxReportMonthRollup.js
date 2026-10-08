import dayjs from 'dayjs';

// Shared by Input Tax Report and Output Tax Report only (pages/reports/tax/
// TaxReport.jsx and OutputTaxReport.jsx) — Payable Tax Report has its own,
// separate "Month Wise" View By mode built server-side (see
// buildPayableTaxReportRows in backend/src/routes/resources.js) since it
// already rolls up documents rather than showing raw lines.
export const TAX_REPORT_MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Whole calendar months touched by an inclusive [fromDate, toDate] range —
// e.g. 15 Jan to 10 Mar is 3 (Jan, Feb, Mar) even though it's under two
// full months by day count, and 5 Mar to 20 Mar is 1. Input Tax Report /
// Output Tax Report use this to decide when to auto-roll their normally
// per-line rows up to one row per month: a range that never leaves a
// single calendar month keeps the detailed line-by-line view; anything
// wider (a quarter, a financial year, ...) switches to the month rollup
// so the table doesn't turn into hundreds of unreadable lines.
export function taxReportMonthsSpanned(fromDate, toDate) {
  if (!fromDate || !toDate) return 1;
  const f = dayjs(fromDate);
  const t = dayjs(toDate);
  if (!f.isValid() || !t.isValid()) return 1;
  return (t.year() - f.year()) * 12 + (t.month() - f.month()) + 1;
}

// Rolls Input Tax Report / Output Tax Report's own per-line rows (see
// buildTaxReportRows in backend/src/routes/resources.js) up to one row per
// calendar month — entirely client-side, since both reports already fetch
// every matching line for the applied filters up front, so no extra
// request is needed just to change how they're grouped. `taxField` is
// 'inputTax' for Input Tax Report or 'outputTax' for Output Tax Report.
// Tax % and the per-line document/party/item fields have no single value
// once lines are combined this way, so the rolled-up row only carries the
// figures that are still meaningful summed: Quantity, Taxable Value, the
// tax amount itself, and Invoice Total.
export function buildTaxReportMonthRows(lineRows, taxField) {
  const map = new Map();
  (lineRows || []).forEach((r) => {
    const dt = r.postingDate ? new Date(r.postingDate) : null;
    const key = dt ? `${dt.getFullYear()}-${String(dt.getMonth()).padStart(2, '0')}` : 'unknown';
    if (!map.has(key)) {
      const label = dt ? `${TAX_REPORT_MONTH_LABELS[dt.getMonth()]} ${dt.getFullYear()}` : '—';
      map.set(key, {
        key, month: label, quantity: 0, taxableValue: 0, [taxField]: 0, invoiceTotal: 0,
      });
    }
    const m = map.get(key);
    m.quantity += Number(r.quantity || 0);
    m.taxableValue += Number(r.taxableValue || 0);
    m[taxField] += Number(r[taxField] || 0);
    m.invoiceTotal += Number(r.invoiceTotal || 0);
  });
  return [...map.values()]
    .sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0)) // most recent month first
    .map((m, i) => ({
      id: `month-${i}`, month: m.month, quantity: m.quantity, taxableValue: m.taxableValue, [taxField]: m[taxField], invoiceTotal: m.invoiceTotal,
    }));
}
