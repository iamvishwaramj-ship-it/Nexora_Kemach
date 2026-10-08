const { verifyAccessToken } = require('../utils/jwt');
const prisma = require('../prisma/client');
const { canDelete: deleteScopedFlag, isDeleteScopedMenu } = require('../config/deleteConfig');

/**
 * Menu-permission enforcement.
 *
 * The User Management screen stores one UserPermission row per navConfig menu
 * key, carrying canView / canAdd / canEdit / canDelete. This middleware is what
 * makes those flags actually bind on the server — without it the grid is just
 * decoration, and any authenticated user can POST/PUT/DELETE anything.
 *
 * ---------------------------------------------------------------------------
 * Scope: WRITES are enforced here, reads are not.
 * ---------------------------------------------------------------------------
 * Nearly every page in this app reads master data it does not own — the Sales
 * Order form loads customers, products, UOMs, tax codes and warehouses just to
 * populate its dropdowns. Gating GET by menu key would mean a user with access
 * to Sales Order but not Product Master gets an empty product picker and a
 * broken page. So "View" is enforced where it is actually meaningful for a
 * MENU permission — navigation: the sidebar hides sections the user cannot
 * view and the router refuses to render those pages (see
 * frontend/src/lib/permissions.js). Mutations are enforced here, where it
 * counts, and cannot be bypassed by calling the API directly.
 *
 * Admins bypass every check. That is deliberate and load-bearing: an admin who
 * saved themselves a sparse permission grid would otherwise be locked out of
 * User Management with no way back in short of direct database access.
 */

// API path prefix (relative to the /api mount) -> navConfig `key`.
// Longest prefix wins, so '/company/document-numbers' beats '/company'.
// Anything not listed here is left ungoverned and falls through to whatever
// auth() the route itself declares.
const PATH_TO_MENU_KEY = {
  // --- Company Setup -------------------------------------------------------
  '/company/details': 'company-details',
  '/company/branches': 'branch',
  '/company/financial-years': 'financial-year',
  '/company/document-numbers': 'document-numbering',
  '/company/tax-codes': 'tax-code',
  '/company/bank-names': 'bank-details',
  '/company/house-banks': 'house-bank',
  '/company/sales-employees': 'sales-employee',
  '/company/approval-flows': 'approval-flow',

  // --- Accounting ----------------------------------------------------------
  '/account-groups': 'account-group',
  '/account-types': 'account-type',
  '/chart-of-accounts': 'chart-of-accounts',
  '/gl-account-determinations': 'gl-account-determination',
  '/journal-entries': 'journal-entry',

  // --- Product Setup -------------------------------------------------------
  '/product-groups': 'product-group',
  '/product-sub-groups': 'product-sub-group',
  '/brands': 'brand',
  '/uoms': 'uom',
  '/currencies': 'currency-master',
  '/hsn-master': 'hsn-master',
  '/products': 'product-master',
  '/purchase-prices': 'purchase-price',
  '/sales-prices': 'sales-price',
  '/customer-discounts': 'customer-discount',

  // --- Business Partner ----------------------------------------------------
  // '/customers' and '/suppliers' retired with Customer Master/Supplier
  // Master — see BUGLOG. Business Partner's own permission key below now
  // governs customer/vendor records.
  '/transporters': 'transport-master',
  '/business-partners': 'business-partner',

  // Warehouse/Location live under Company Setup in the menu. Both the legacy
  // ('/warehouses', '/locations') and current ('/warehouse-master',
  // '/location-master') mounts map to the same menu key so a permission set on
  // the menu item governs the page whichever endpoint it happens to call.
  '/warehouses': 'warehouse-master',
  '/warehouse-master': 'warehouse-master',
  '/locations': 'location-master',
  '/location-master': 'location-master',
  '/department-master': 'department-master',

  // --- Purchase ------------------------------------------------------------
  '/purchase/quotations': 'purchase-quotation',
  '/purchase/orders': 'purchase-order',
  '/purchase/grn': 'purchase-grn',
  '/purchase/invoices': 'purchase-invoice',
  '/purchase/returns': 'purchase-return',
  '/purchase/credit-memos': 'purchase-credit-memo',

  // --- Sales ---------------------------------------------------------------
  '/sales/enquiries': 'enquiry',
  '/sales/follow-ups': 'follow-up',
  '/sales/quotations': 'sales-quotation',
  '/sales/orders': 'sales-order',
  '/sales/delivery-challans': 'delivery-challan',
  '/sales/invoices': 'sales-invoice',
  '/sales/credit-memos': 'sales-credit-memo',
  '/sales/returns': 'sales-return',

  // --- Inventory -----------------------------------------------------------
  '/inventory/stock-receipts': 'stock-receipt',
  '/inventory/stock-issues': 'stock-issue',
  '/inventory/stock-adjustments': 'stock-adjustment',
  // Stock Transfer's menu entry (navConfig.js) is a parent 'stock-transfer'
  // section with three actual pages nested under it, each carrying its OWN
  // permission-grid row (PermissionMatrix.jsx keys every row off flatNav's
  // leaf nodes, not their parent): 'stock-transfer-request',
  // 'stock-transfer-transfer' (the Stock Transfer page itself — an
  // unfortunate but accurate name, since 'stock-transfer' is already taken
  // by the parent section), and 'stock-transfer-receipt'. This used to map
  // the Stock Transfer API straight to the parent key 'stock-transfer',
  // which has no "Add"/"Edit" checkbox anyone would ever tick — a user
  // granted full rights on the actual "Stock Transfer" row in User
  // Management (the child key below) still got a 403 here, because this
  // table was checking a permission row that was never the one being
  // granted. The Request/Receipt lines were missing entirely, leaving
  // those two writes ungoverned by any permission check at all.
  '/inventory/stock-transfers': 'stock-transfer-transfer',
  '/inventory/stock-transfer-requests': 'stock-transfer-request',
  '/inventory/stock-transfer-receipts': 'stock-transfer-receipt',
  '/opening-balance': 'opening-balance',

  // --- Receivables / Payables / Banking ------------------------------------
  '/receivables/outstanding': 'customer-outstanding',
  '/receivables/collections': 'collection-entry',
  '/payables/outstanding': 'supplier-outstanding',
  '/payables/payments': 'payment-entry',
  '/banking/deposits': 'deposit-entry',
  '/banking/reconciliations': 'bank-reconciliation',
  '/banking/cheques': 'cheque-print',
  '/banking/payment-receipts': 'payment-receipt',
  '/banking/payment-vouchers': 'payment-voucher',
};

// Prefixes sorted longest-first so the lookup below can return on first match.
const SORTED_PREFIXES = Object.keys(PATH_TO_MENU_KEY).sort((a, b) => b.length - a.length);

/**
 * POST endpoints that read or allocate rather than manage.
 *
 * Document numbering is the important one: creating ANY document (a sales
 * order, a GRN, ...) POSTs to /company/document-numbers/next|peek|preview to
 * get its next number. Gating those under the "Document Numbering" menu would
 * mean nobody could create a document without also being granted rights to
 * administer numbering series — so these stay open while the series CRUD
 * itself ('/company/document-numbers', '/reset', '/:id/set-default') is
 * governed normally.
 *
 * /business-partners/next-code is the same shape for Business Partner's own
 * Code selector (see nextBusinessPartnerCode in routes/resources.js): a
 * peek-only POST that scans for the next C-/S-prefixed code and creates
 * nothing. Left off this list, it was matched by the '/business-partners' ->
 * 'business-partner' prefix below and gated under canAdd like a real write —
 * so opening the Add form and picking Auto-Customer/Auto-Supplier failed
 * with a permissions 403 (surfaced to the user as the generic "Could not
 * generate code", since the frontend's catch there doesn't show the server's
 * actual message) for anyone without canAdd already granted, even though no
 * record is created until the form is actually submitted.
 */
const UNGOVERNED_POSTS = [
  '/company/document-numbers/next',
  '/company/document-numbers/peek',
  '/company/document-numbers/preview',
  '/company/document-numbers/rollover',
  '/business-partners/next-code',
];

const ACTION_BY_METHOD = {
  POST: 'canAdd',
  PUT: 'canEdit',
  PATCH: 'canEdit',
  DELETE: 'canDelete',
};

const ACTION_LABEL = {
  canAdd: 'add',
  canEdit: 'edit',
  canDelete: 'delete',
  canCancel: 'cancel',
};

// PATCH /<module>/<documents>/:id/cancel is governed by the dedicated Cancel
// permission (UserPermission.canCancel), not by Edit. Only the document cancel
// endpoints end in "/cancel" under PATCH (e-invoice / e-way bill cancels are
// POSTs and stay under canAdd as before).
function resolveAction(req) {
  // Print-status actions on a Sales Invoice are not edits of the invoice:
  // mark-printed is open to anyone who prints (the route itself requires a
  // signed-in user), reset-printed is admin-only (enforced by the route).
  if (req.method === 'POST' && /\/sales\/invoices\/[^/]+\/(mark-printed|reset-printed)\/?$/.test(req.path)) return null;
  if (req.method === 'PATCH' && /\/cancel\/?$/.test(req.path)) return 'canCancel';
  return ACTION_BY_METHOD[req.method];
}

function findMenuKey(path) {
  for (const prefix of SORTED_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return PATH_TO_MENU_KEY[prefix];
  }
  return null;
}

function permissionGuard() {
  return async (req, res, next) => {
    const action = resolveAction(req);
    // Reads (and OPTIONS preflight) are never gated here — see the header
    // comment for why menu "View" is enforced in the UI's navigation instead.
    if (!action) return next();

    const path = req.path.replace(/\/+$/, '') || '/';
    if (UNGOVERNED_POSTS.includes(path)) return next();

    const menuKey = findMenuKey(path);
    if (!menuKey) return next();

    // Decode the token ourselves: this middleware runs ahead of each route's
    // own auth(), so req.user isn't populated yet. A missing or invalid token
    // is deliberately NOT answered here — fall through and let the route's
    // auth() produce the usual 401, so unauthenticated callers get one
    // consistent error shape rather than two different ones.
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.split(' ')[1] : null;
    if (!token) return next();

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch {
      return next();
    }

    // deleteConfig.js hard-block: when the scoped-delete flag is false, DELETE
    // on those menus is refused for EVERYONE, admins included (previously the
    // admin bypass below let admins through, so Delete "still worked" with the
    // flag off). Checked before the admin bypass on purpose.
    if (action === 'canDelete' && isDeleteScopedMenu(menuKey) && !deleteScopedFlag) {
      return res.status(403).json({
        success: false,
        message: 'Delete is disabled for this section. Ask an administrator if this needs to change.',
      });
    }

    if (decoded.role === 'admin') return next();

    // deleteConfig.js's scoped menus: for exactly these Purchase/Sales/
    // Inventory/Banking transaction menus, a DELETE's permission is decided
    // ENTIRELY by the backend config flag, never by this user's stored
    // UserPermission.canDelete row — skip the DB lookup below entirely, in
    // both directions. true auto-grants delete here for every authenticated
    // user (the admin bypass above already covers admins, so this only ever
    // matters for a non-admin); false hard-blocks it for every non-admin
    // user with a clear 403, with no per-user override possible — admins
    // already returned above, so this 403 never reaches them. Any menuKey
    // outside this set falls straight through to the untouched per-user DB
    // check below, exactly as before this flag existed.
    if (action === 'canDelete' && isDeleteScopedMenu(menuKey)) {
      if (deleteScopedFlag) return next();
      return res.status(403).json({
        success: false,
        message: 'Delete is disabled for this section. Ask an administrator if this needs to change.',
      });
    }

    try {
      const permission = await prisma.userPermission.findFirst({
        where: { userId: decoded.id, menuKey },
      });

      if (permission && permission[action]) return next();

      // Distinguish "never set up" from "explicitly denied": an account that
      // predates User Management has no rows at all, and telling its owner to
      // go hunting for a checkbox that was never ticked is a dead end.
      const anyPermission = await prisma.userPermission.count({ where: { userId: decoded.id } });
      const message = anyPermission === 0
        ? 'No permissions have been assigned to your account. Ask an administrator to set them in User Management.'
        : `You do not have permission to ${ACTION_LABEL[action]} records in this section.`;

      return res.status(403).json({ success: false, message });
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { permissionGuard, PATH_TO_MENU_KEY, findMenuKey };
