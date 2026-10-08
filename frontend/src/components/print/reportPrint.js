import dayjs from 'dayjs';

// Shared helpers for the Reports > * > * print layout (see ReportPrintable.jsx).
// Kept separate from the component so the formatting rules are easy to find
// and reuse from a report page without importing any JSX.

/**
 * Turns a page's `appliedFilters` state object into the [{ label, value }]
 * list ReportPrintable renders under "Filters Applied". Empty/blank filters
 * are dropped so an all-blank filter bar prints nothing rather than a row of
 * "All ..." noise. `labels` maps the filter's state key to its display label
 * (e.g. { fromDate: 'From Date' }); `dateKeys` lists which of those keys hold
 * a raw date string and should be formatted as a date rather than printed
 * literally.
 */
export function buildPrintFilters(appliedFilters = {}, labels = {}, dateKeys = []) {
  return Object.entries(appliedFilters)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => ({
      label: labels[key] || key,
      value: dateKeys.includes(key) && value ? dayjs(value).format('DD-MMM-YYYY') : String(value),
    }));
}

/**
 * Resolves what a report's print table should show for one cell. Reuses the
 * column's existing `searchValue` (already the display-formatted string for
 * date columns on every report page — see useTableFeatures.js) when present,
 * falls back to a `printValue` override for a column that needs bespoke
 * print-only formatting, and otherwise prints the raw field with basic
 * number formatting so amount/qty columns don't lose their thousand
 * separators just because the on-screen cell formatted them inline in JSX.
 */
export function getPrintCellValue(column, row) {
  if (typeof column.printValue === 'function') {
    const v = column.printValue(row);
    return v === undefined || v === null || v === '' ? '—' : v;
  }
  if (typeof column.searchValue === 'function') {
    const v = column.searchValue(row);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  const raw = row[column.field];
  if (raw === undefined || raw === null || raw === '') return '—';
  if (typeof raw === 'number') {
    return raw.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(raw);
}

/** Same number formatting as getPrintCellValue, for a totals-row figure. */
export function formatPrintTotal(value) {
  if (value === undefined || value === null || value === '') return '';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
