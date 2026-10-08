// Shared helpers for "upload an .xlsx and bulk-insert it" features (currently
// just Opening Balance's Import from Excel). Kept generic so a future import
// screen for another master doesn't have to reinvent header validation.
const XLSX = require('xlsx');

/**
 * Normalises a header cell into a comparison key: strips everything but
 * letters/digits and lowercases. "Item Code", "ItemCode", "item_code",
 * "ITEM-CODE" and "itemCode" all collapse to "itemcode" — this is what lets
 * an uploaded sheet's headings be upper/lower/camelCase or spaced/punctuated
 * differently while the actual wording is still checked strictly (a column
 * whose words don't match anything expected is never silently accepted).
 */
function normaliseHeader(raw) {
  return String(raw ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Validates a header row against an expected field map and returns a
 * `{ originalHeaderText: fieldName }` lookup for translating data rows, or
 * throws (with `err.status = 400`) listing exactly what's wrong — missing
 * required columns and/or columns that don't match any expected wording —
 * so the whole upload is rejected up front rather than partially imported.
 *
 * `fieldDefs`: Array<{ field: string, headers: string[], required: boolean }>
 * `headers` lists every accepted spelling for that column; only spelled
 * exactly one of those ways (up to case/punctuation/spacing) is accepted.
 *
 * Rejecting any unrecognised column also means a stray "Created At" /
 * "Updated At" column in the sheet fails validation rather than quietly
 * flowing into the insert — timestamps are always server-generated, never
 * read from the file (see the caller, which never puts createdAt/updatedAt
 * in fieldDefs to begin with).
 */
function validateHeaders(headerRow, fieldDefs) {
  const acceptedToField = new Map();
  for (const def of fieldDefs) {
    for (const h of def.headers) {
      acceptedToField.set(normaliseHeader(h), def.field);
    }
  }

  const seenFields = new Set();
  const unrecognised = [];
  const columnToField = {};

  for (const rawHeader of headerRow || []) {
    if (rawHeader === null || rawHeader === undefined || String(rawHeader).trim() === '') continue;
    const key = normaliseHeader(rawHeader);
    const field = acceptedToField.get(key);
    if (!field) {
      unrecognised.push(String(rawHeader).trim());
      continue;
    }
    columnToField[rawHeader] = field;
    seenFields.add(field);
  }

  const missing = fieldDefs.filter((d) => d.required && !seenFields.has(d.field)).map((d) => d.headers[0]);

  if (missing.length || unrecognised.length) {
    const parts = [];
    if (missing.length) parts.push(`missing required column(s): ${missing.join(', ')}`);
    if (unrecognised.length) parts.push(`unrecognised column(s): ${unrecognised.join(', ')}`);
    const err = new Error(`Invalid sheet headings — ${parts.join('; ')}.`);
    err.status = 400;
    throw err;
  }

  return columnToField;
}

/**
 * Reads the first (or named) sheet of an uploaded workbook buffer as raw
 * rows-of-arrays (`header: 1`), so the header row can be validated by hand
 * before any of it is trusted, instead of letting sheet_to_json guess object
 * keys from headers we haven't checked yet.
 */
function readWorkbookRows(buffer, { sheetName } = {}) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const name = sheetName && wb.SheetNames.includes(sheetName) ? sheetName : wb.SheetNames[0];
  const ws = wb.Sheets[name];
  if (!ws) {
    const err = new Error('The uploaded file has no readable sheet.');
    err.status = 400;
    throw err;
  }
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  return { sheetName: name, rows };
}

/**
 * Builds an .xlsx template buffer for a bulk-import screen's "Download
 * Template" button — a header row (the exact wording `validateHeaders`
 * accepts) plus optional example rows underneath, so the person filling it in
 * sees a concrete pattern to copy rather than a blank grid. Column widths are
 * sized off the header text so a template never opens with the headings
 * themselves clipped.
 */
function buildTemplateBuffer({ headers, sampleRows = [], sheetName = 'Template' }) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(String(h).length + 2, 14) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Builds an .xlsx buffer for a report export: a header row plus data rows.
 * `columns` is `[{ header, width?, format? }]` — `format` is an Excel number
 * format ('#,##0.00', 'dd/mm/yy', ...) applied to that column's numeric
 * cells. A JS Date is written as an Excel date serial computed from its UTC
 * parts, so a date-only column never shifts a day with the server's timezone.
 */
function buildReportBuffer({ columns, rows, sheetName = 'Report' }) {
  const aoa = [columns.map((c) => c.header), ...rows.map((r) => r.map((v) => {
    if (v instanceof Date && !Number.isNaN(v.getTime())) {
      return Math.round(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()) / 86400000) + 25569;
    }
    return v === undefined ? null : v;
  }))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = columns.map((c) => ({ wch: c.width || Math.max(String(c.header).length + 2, 12) }));
  for (let r = 1; r < aoa.length; r += 1) {
    columns.forEach((c, ci) => {
      const cell = ws[XLSX.utils.encode_cell({ r, c: ci })];
      if (cell && cell.t === 'n' && c.format) cell.z = c.format;
    });
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { normaliseHeader, validateHeaders, readWorkbookRows, buildTemplateBuffer, buildReportBuffer };
