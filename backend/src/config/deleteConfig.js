// Backend twin of frontend/src/config/deleteConfig.js's DELETE_SCOPED_MENU_
// KEYS / canDelete. The frontend config module is never shipped to (or
// importable by) the backend build, so this is a deliberately separate file
// carrying the SAME two values by hand, enforced here so real requests are
// actually blocked/allowed — the frontend copy only controls what the UI
// shows, which is not a security boundary on its own (see permission.js's
// own header comment).
//
// IMPORTANT: keep this file's `canDelete` and `DELETE_SCOPED_MENU_KEYS` in
// exact sync with frontend/src/config/deleteConfig.js by hand, in the same
// commit, every time either one changes. Nothing automated enforces that
// today. If the two ever drift, the symptom is confusing rather than a hard
// failure: e.g. flag=true here but false on the frontend would 200 a DELETE
// the UI never even offered a button for (harmless but odd), while flag=
// false here but true on the frontend would show/enable a Delete button the
// server then 403s on the click (confusing for the user, but still SAFE,
// since this backend file — not the frontend one — is what actually decides
// what happens to the data).
//
// Edit this value by hand to change what happens for the scoped menus below:
//   canDelete - true to auto-grant delete to every authenticated user on
//     these menus (admin or not, no per-user UserPermission row needed),
//     false to hard-block delete for every user on these menus except
//     admin, who keeps the same unconditional bypass every other check in
//     this middleware already gives them (see permissionGuard() below).
const canDelete = false;

// The exact set of navConfig menu keys this flag governs — see the matching
// (much longer) comment on frontend/src/config/deleteConfig.js's own
// DELETE_SCOPED_MENU_KEYS for the full reasoning (explicit list, never
// derived from parent/child nesting; Sales' hidden enquiry/follow-up
// submenus and Purchase's not-yet-re-enabled purchase-quotation are exactly
// why). Values here are navConfig `key`s, matched against the menuKey that
// findMenuKey()/PATH_TO_MENU_KEY resolves for the incoming request path —
// NOT the request path itself.
//
// 'stock-transfer-transfer' (not 'stock-transfer') is the actual Stock
// Transfer page's own key — see PATH_TO_MENU_KEY's Inventory block above for
// the full story of the naming trap this guards against.
const DELETE_SCOPED_MENU_KEYS = new Set([
  // --- Purchase --------------------------------------------------------
  'purchase-order',
  'purchase-grn',
  'purchase-invoice',
  'purchase-return',
  'purchase-credit-memo',
  'purchase-quotation',
  // --- Sales -------------------------------------------------------------
  'sales-quotation',
  'sales-order',
  'sales-invoice',
  'delivery-challan',
  'sales-return',
  'sales-credit-memo',
  // --- Inventory -----------------------------------------------------------
  'stock-receipt',
  'stock-issue',
  'stock-adjustment',
  'stock-transfer-request',
  'stock-transfer-transfer',
  'stock-transfer-receipt',
  // --- Banking ---------------------------------------------------------
  'payment-receipt',
  'payment-voucher',
]);

function isDeleteScopedMenu(menuKey) {
  return !!menuKey && DELETE_SCOPED_MENU_KEYS.has(menuKey);
}

module.exports = { canDelete, DELETE_SCOPED_MENU_KEYS, isDeleteScopedMenu };
