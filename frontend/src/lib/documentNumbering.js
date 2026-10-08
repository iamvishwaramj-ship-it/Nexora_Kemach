// Client-side mirror of the document-number formatter in
// backend/src/services/documentNumberService.js.
//
// It exists purely so the Add/Edit form can render its Preview field on every
// keystroke without a round trip. The server remains the authority — it
// formats the number it actually issues — so if these two ever disagree, the
// server wins and this file is the bug. Keep them in sync.

export const SEPARATORS = [
  { value: '-', label: '- (Hyphen)' },
  { value: '/', label: '/ (Slash)' },
  { value: '_', label: '_ (Underscore)' },
  { value: '.', label: '. (Dot)' },
  { value: '', label: 'None' },
];

export const SEPARATOR_VALUES = SEPARATORS.map((s) => s.value);

export const NUMBER_LENGTH_OPTIONS = [3, 4, 5, 6, 7, 8, 10, 12].map((n) => ({
  label: `${n} Digits`,
  value: n,
}));

export const MIN_NUMBER_LENGTH = 1;
export const MAX_NUMBER_LENGTH = 12;

export function clampLength(length) {
  const n = Number(length);
  if (!Number.isFinite(n)) return 6;
  return Math.min(MAX_NUMBER_LENGTH, Math.max(MIN_NUMBER_LENGTH, Math.trunc(n)));
}

/** Largest number a given padding width can hold: 6 -> 999999. */
export function maxValueForLength(length) {
  return 10 ** clampLength(length) - 1;
}

export function padNumber(value, length) {
  const n = Math.trunc(Number(value) || 0);
  const width = clampLength(length);
  const digits = Math.abs(n).toString();
  return (n < 0 ? '-' : '') + digits.padStart(width, '0');
}

/**
 * '2026-2027' / { startDate, endDate } -> '2627'.
 * Mirrors deriveFyCode() on the server, including the name-parsing fallback.
 *
 * No separator is baked in here (this used to return '26-27') — it sits
 * directly against the running number in buildDocumentNumber below, with
 * the series' own Separator appearing only right after the Prefix.
 */
export function deriveFyCode(financialYear) {
  if (!financialYear) return null;

  const { startDate, endDate, financialYearName } = financialYear;
  if (startDate && endDate) {
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime())) {
      const two = (d) => String(d.getUTCFullYear() % 100).padStart(2, '0');
      return `${two(s)}${two(e)}`;
    }
  }

  if (financialYearName) {
    const years = String(financialYearName).match(/\d{2,4}/g);
    if (years && years.length >= 2) {
      const two = (y) => String(Number(y) % 100).padStart(2, '0');
      return `${two(years[0])}${two(years[1])}`;
    }
    if (years && years.length === 1) {
      const start = Number(years[0]) % 100;
      return `${String(start).padStart(2, '0')}${String((start + 1) % 100).padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * prefix + sep + [fyCode +] paddedNumber [+ sep + suffix]
 *
 * The Separator appears only once, between the Prefix and everything after
 * it (and again before the Suffix, if any) — the FY code, when included,
 * sits directly against the padded number with nothing between them. E.g.
 * prefix 'KEM/PO', separator '/', fyCode '2627' -> 'KEM/PO/2627000126'.
 * Empty segments are dropped so you never get a doubled separator.
 */
export function buildDocumentNumber(series, value) {
  const {
    prefix = '',
    suffix = '',
    separator = '-',
    fyCode = null,
    includeFyInNumber = true,
    numberLength = 6,
  } = series || {};

  const sep = SEPARATOR_VALUES.includes(separator) ? separator : '-';

  const segments = [];
  const cleanPrefix = String(prefix ?? '').trim();
  if (cleanPrefix) segments.push(cleanPrefix);

  const cleanFy = String(fyCode ?? '').trim();
  const fyPlusNumber = (includeFyInNumber && cleanFy)
    ? `${cleanFy}${padNumber(value, numberLength)}`
    : padNumber(value, numberLength);
  segments.push(fyPlusNumber);

  const cleanSuffix = String(suffix ?? '').trim();
  if (cleanSuffix) segments.push(cleanSuffix);

  return segments.join(sep);
}

/**
 * How much of a series' range Current No. has used up, as a percentage —
 * e.g. Start 1 / End 100 / Current 90 is 90%.
 */
export function consumptionPercent(row) {
  if (!row || row.currentNumber === null || row.currentNumber === undefined) return 0;
  const total = row.endNumber - row.startNumber + 1;
  if (total <= 0) return 0;
  const used = row.currentNumber - row.startNumber + 1;
  return (used / total) * 100;
}

/**
 * Text color for Current No.: green while there's plenty of room, orange
 * once a series has used 80% of its range, red past 90% — a heads-up to add
 * the next series before this one runs out and blocks new documents.
 */
export function currentNumberColor(row) {
  const pct = consumptionPercent(row);
  if (pct >= 90) return 'error.main';
  if (pct >= 80) return 'warning.main';
  return 'text.primary';
}

/**
 * Format a stored FY name for display: '2026-2027' -> '2026 - 2027 (26-27)'.
 *
 * deriveFyCode() itself returns the dashless '2627' now (see its own comment
 * — that's the form the FY code takes inside an actual document number). The
 * dash here is purely cosmetic, re-inserted only for this human-readable
 * label so the FY picker still reads as two two-digit years rather than one
 * four-digit blob.
 */
export function formatFyLabel(fy) {
  if (!fy) return '';
  const code = deriveFyCode(fy);
  const name = String(fy.financialYearName || '').replace(/\s*-\s*/, ' - ');
  const displayCode = code && code.length === 4 ? `${code.slice(0, 2)}-${code.slice(2)}` : code;
  return displayCode ? `${name} (${displayCode})` : name;
}
