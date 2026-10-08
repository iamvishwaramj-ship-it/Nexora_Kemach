// Hardcoded switch for the Delete action — but, as of the DELETE_SCOPED_
// MENU_KEYS list below, no longer a blanket "everywhere" override. It now
// governs delete ONLY for the menu keys in that list; every other menu is
// completely untouched by it and continues to work purely from each user's
// own per-user UserPermission.canDelete value (see lib/permissions.js's
// isDeleteScopedMenu()/usePermissions()).
// Edit this value by hand to change what happens on the scoped menus below:
//   canDelete - true to auto-grant Delete to every user on those menus (no
//     per-user checkbox needed), false to hard-block Delete for every user
//     on those menus (no per-user override possible).
// Independent of duplicateConfig.js. This has a backend-enforced twin at
// backend/src/config/deleteConfig.js — the two must be kept in sync by hand
// (the frontend config is never shipped to the backend), and that file
// points back at this comment for the same reason.
export const canDelete = false;

// The exact set of navConfig menu keys that DELETE_SCOPED behavior above
// applies to. Deliberately an explicit, hand-picked list rather than
// anything derived from navConfig's parent/child nesting (e.g. "everything
// under the Sales node") — Sales in particular nests two hidden-but-live
// submenus (enquiry, follow-up) under the same 'sales' parent that must NOT
// be swept in by accident, and Purchase has a commented-out purchase-quotation
// entry that should still be governed once it's re-enabled. Every key here
// is a real, current navConfig leaf key (see router/navConfig.js) for a
// Purchase/Sales/Inventory/Banking TRANSACTION document — never a parent
// section key (a parent like 'purchase'/'sales'/'inventory'/'banking' has no
// permission semantics of its own; see PermissionMatrix.jsx's isViewOnly()
// and the flatNav-indexed row model).
//
// 'stock-transfer-transfer' (not 'stock-transfer') is the actual Stock
// Transfer page's own key — 'stock-transfer' is the parent grouping key with
// no permission row of its own. See the naming-trap comment at
// backend/src/middleware/permission.js (PATH_TO_MENU_KEY's Inventory block)
// for the full story of a real bug this exact mismatch caused before.
//
// 'inventory-opening-balance' is deliberately NOT included: despite the
// name, navConfig nests it under the Company Setup parent, not Inventory,
// and it was explicitly confirmed out of scope for this flag.
export const DELETE_SCOPED_MENU_KEYS = new Set([
    // --- Purchase --------------------------------------------------------
    'purchase-order',
    'purchase-grn',
    'purchase-invoice',
    'purchase-return',
    'purchase-credit-memo',
    // Currently commented out in navConfig.js — kept here so it's already
    // governed the moment it's re-enabled, with nothing else to remember.
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

// Same global override, for the Edit action — every row-level Edit icon/menu
// item (gated via the CanEdit guard in components/common/PermissionGate.jsx
// and components/data-display/DataTable.jsx + MobileRecordCard.jsx) across
// every master and transaction page that has one.
// Edit this value by hand to change what shows up:
//   canEdit - true to show the Edit icon everywhere, false to hide it everywhere.
// Independent of duplicateConfig.js, and independent of each user's own
// permission grid (User Management) — this is a single global override that
// sits on top of both: when false, Edit stays hidden for everyone regardless
// of what their permission grid allows.
export const canEdit = true;
