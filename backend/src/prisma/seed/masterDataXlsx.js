// Shared loader for the real Master Data.xlsx export (backend/data/Master
// Data.xlsx) that seed_warehouse_master.js, seed_location_master.js and
// seed_current_stock.js all read from. Centralised here so the file path and
// the "blank/NULL cell" cleanup rule live in exactly one place.
const path = require('node:path');
const XLSX = require('xlsx');

const WORKBOOK_PATH = path.join(__dirname, '..', '..', '..', 'data', 'Master Data.xlsx');

/**
 * Reads one sheet as an array of row objects keyed by its header row.
 * `sheet:` must match a tab name in the workbook exactly (e.g. 'Warehouse',
 * 'Location', 'Current Stock').
 */
function loadSheet(sheetName) {
  const wb = XLSX.readFile(WORKBOOK_PATH, { cellDates: false });
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    throw new Error(
      `Sheet "${sheetName}" not found in ${WORKBOOK_PATH}. Available sheets: ${wb.SheetNames.join(', ')}`
    );
  }
  // defval: null so a genuinely blank cell comes back as null rather than
  // being omitted from the row object entirely — every row gets every column.
  return XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
}

/**
 * The source workbook uses the literal text "NULL" for a lot of blank
 * address fields (see Warehouse.Street/Block/ZipCode/City/County) instead of
 * an actually-empty cell. Collapses that, real blanks, and pure whitespace
 * down to a real null; everything else is trimmed and stringified so a
 * numeric cell (e.g. ZipCode read back as 683550) lands as text the same way
 * a manually-typed one would.
 */
function cleanCell(value) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (str === '' || str.toUpperCase() === 'NULL') return null;
  return str;
}

/**
 * Item/warehouse/location codes can arrive as a JS number (small integer
 * codes like WhsCode 1, or Location Code 4) or — worse — as a float when
 * Excel's own "General" formatting silently converted a long numeric code
 * (see Current Stock's occasional 2.5e+16-shaped ItemCode). Formats either
 * back to a plain, non-exponential integer string; string values pass
 * through cleanCell unchanged.
 */
function cleanCode(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(0);
  }
  return cleanCell(value);
}

module.exports = { WORKBOOK_PATH, loadSheet, cleanCell, cleanCode };
