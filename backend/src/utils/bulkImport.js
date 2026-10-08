// Reusable pieces for every "Bulk Excel Import" screen (Sales Invoice first,
// with Sales Order/Quotation/Delivery Challan/Return/Credit Memo and the six
// Purchase-side documents meant to follow the same shape).
//
// The convention every one of these sheets shares: ONE ROW PER ITEM LINE,
// with the document's header fields repeated on every row that belongs to
// it, and a "Row No" column that is 1 on the first item line of a document
// and increments (2, 3, ...) for that same document's later lines — seeing
// "Row No" = 1 is what always means "a new document starts here". This file
// has no idea what a Sales Invoice or a Purchase Order actually is; it only
// turns a workbook into `{ header, items }` groups. Each route (see the
// Sales Invoice bulk-import routes in routes/resources.js for the reference
// implementation) still does its own field mapping, master-code lookups and
// per-document create — this just saves every one of them from re-parsing
// the sheet and re-implementing the "Row No" grouping rule by hand.
const { readWorkbookRows, validateHeaders } = require('./xlsxImport');

/**
 * Reads an uploaded workbook buffer, validates its header row against
 * `fieldDefs` (same shape xlsxImport.js's validateHeaders already expects —
 * `{ field, headers, required }[]`), and returns every data row as a plain
 * `{ field: value, ... }` object keyed by `field`, not by whatever the
 * column happened to be spelled in the sheet. Columns not listed in
 * `fieldDefs` are rejected up front (validateHeaders' job); a column listed
 * but left blank on a given row simply comes back `undefined` there.
 *
 * Wholly blank rows (every cell empty) are dropped — Excel routinely leaves
 * trailing blank rows below the last real one — so callers never have to
 * special-case them. Each surviving row carries its own `__excelRow` (1-based,
 * matching what the person filling the sheet actually sees, i.e. accounting
 * for the header row) purely so error messages and grouped-document row
 * ranges can point back at the exact spreadsheet row.
 *
 * Throws (with `err.status = 400`) on an unreadable file, an empty sheet, or
 * a header row that's missing a required column / carries one that doesn't
 * match anything expected — same failure shape as every existing xlsx import
 * route, so callers can keep using `err.status || 400` / `err.message`
 * straight in their catch block.
 */
function parseWorkbookRows(buffer, fieldDefs, { sheetName } = {}) {
  const { rows } = readWorkbookRows(buffer, { sheetName });
  if (!rows.length) {
    const err = new Error('The uploaded sheet is empty.');
    err.status = 400;
    throw err;
  }

  const [headerRow, ...dataRows] = rows;
  const columnToField = validateHeaders(headerRow, fieldDefs);

  const indexToField = {};
  headerRow.forEach((h, idx) => {
    const field = columnToField[h];
    if (field) indexToField[idx] = field;
  });

  const parsed = [];
  dataRows.forEach((raw, i) => {
    const cells = raw || [];
    const isBlank = cells.every((c) => c === null || c === undefined || String(c).trim() === '');
    if (isBlank) return;

    const row = { __excelRow: i + 2 }; // +2: 1-based, plus the header row itself
    Object.entries(indexToField).forEach(([idx, field]) => {
      row[field] = cells[Number(idx)];
    });
    parsed.push(row);
  });

  return { rows: parsed };
}

/**
 * Splits flat, one-row-per-item-line data (as `parseWorkbookRows` returns)
 * into an array of `{ header, items, startRow, endRow }` documents, using the
 * "Row No" = 1 convention described at the top of this file.
 *
 * `rows`: parsed row objects, each with a `rowNo` field (from a fieldDefs
 * entry the caller declared) and an `__excelRow`.
 * `headerColumnNames`: which parsed fields belong to the HEADER (repeated on
 * every line of a document) rather than the item line itself — captured once,
 * off the document's first row, and never re-read from later rows even if a
 * careless fill-in changed one midway through the group. Everything else on
 * the row becomes part of that row's item data.
 *
 * A row whose Row No is blank/non-numeric is treated as "continues the
 * current document" rather than rejected here — whether that is actually
 * valid is a per-document business question (e.g. "Row No is required")
 * that the caller checks and reports per-row, keeping this helper a pure,
 * dumb grouping pass with nothing document-specific in it. The very first
 * row of the whole sheet always starts a document regardless of its Row No,
 * so a sheet that (wrongly) opens with Row No 2 still produces one document
 * instead of silently discarding that row for having "no document open yet".
 */
function groupRowsIntoDocuments(rows, headerColumnNames) {
  const headerSet = new Set(headerColumnNames);
  const documents = [];
  let current = null;

  rows.forEach((row) => {
    const rowNoRaw = row.rowNo;
    const rowNo = rowNoRaw === null || rowNoRaw === undefined || String(rowNoRaw).trim() === ''
      ? null
      : Number(rowNoRaw);
    const startsNewDocument = !current || rowNo === 1;

    if (startsNewDocument) {
      current = { header: {}, items: [], startRow: row.__excelRow, endRow: row.__excelRow };
      headerColumnNames.forEach((field) => { current.header[field] = row[field]; });
      documents.push(current);
    }

    current.endRow = row.__excelRow;
    const item = { __excelRow: row.__excelRow };
    Object.keys(row).forEach((key) => {
      if (key !== '__excelRow' && !headerSet.has(key)) item[key] = row[key];
    });
    current.items.push(item);
  });

  return documents;
}

/** Small helper so route code can throw a plain, per-row-message error that
 * the bulk-import loop's try/catch reports as this document's failure
 * reason, without every route re-typing `const err = new Error(...); err.status = 400; throw err;`. */
function importRowError(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

/**
 * Turns one Excel cell into a Date, accepting whatever readWorkbookRows(...)
 * actually hands back for a date-formatted column: a numeric Excel serial
 * (cellDates is always false there — see xlsxImport.js — so a real
 * date-formatted cell arrives as a serial number, never a JS Date or a
 * string) or a plain typed string ("2026-09-01", "2026/09/01", ...). Every
 * one of the twelve bulk-import screens has several date columns, so this
 * lives here rather than being reimplemented per document type.
 *
 * Returns null for anything that doesn't parse (blank cell included) rather
 * than throwing — callers treat a null date on a required column as their
 * own "Invoice Date is required/invalid (row N)" error, same as every other
 * required-field check in this style of import.
 */
function parseImportDate(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Excel's own epoch is 1899-12-30 (day 0, carrying the historical
    // 1900-leap-year quirk) — the same base sheet_to_json's own date
    // coercion uses internally.
    const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
    const d = new Date(EXCEL_EPOCH_MS + Math.round(value * 86400000));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(String(value).trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

module.exports = { parseWorkbookRows, groupRowsIntoDocuments, importRowError, parseImportDate };
