// Report columns an admin can include / exclude per user, from
// User Management > Permissions > "Columns" on that report's row.
//
// Keyed by the report's navConfig menuKey (the same key its permission row
// uses). The chosen exclusions are saved on that permission row as
// `hiddenColumns` (array of column keys) and applied by the report itself:
// an excluded column is removed from the table, the Columns menu, the
// mobile cards, the CSV export and the printout for that user.

export const REPORT_COLUMN_OPTIONS = {
  'reports-inventory-Available-balance': [
    { key: 'productCode', label: 'Item No' },
    { key: 'productName', label: 'Description' },
    { key: 'productGroup', label: 'Product Group' },
    { key: 'branch', label: 'Branch' },
    { key: 'warehouse', label: 'Warehouse' },
    { key: 'uom', label: 'UOM' },
    { key: 'onHandQty', label: 'On-Hand Qty' },
    { key: 'minimumLevel', label: 'Min Level' },
    { key: 'maximumLevel', label: 'Max Level' },
    { key: 'unitCost', label: 'Unit Cost' },
    { key: 'mrp', label: 'MRP' },
    { key: 'dlp', label: 'DLP' },
    { key: 'onHandValue', label: 'On-Hand Value' },
    { key: 'status', label: 'Status' },
  ],
};

// Accepts the stored value in any shape it can arrive in (JSON string from
// the database, an array from the form, or nothing) and returns a clean array.
export function parseHiddenColumns(value) {
  if (Array.isArray(value)) return value.filter((k) => typeof k === 'string');
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

// Columns excluded for the signed-in user on one report. Applies to admins
// too when their own row has exclusions saved — an admin with none set
// (the normal case) sees everything.
export function excludedColumnsFor(user, menuKey) {
  const row = (user?.permissions || []).find((p) => p.menuKey === menuKey);
  return parseHiddenColumns(row?.hiddenColumns);
}
