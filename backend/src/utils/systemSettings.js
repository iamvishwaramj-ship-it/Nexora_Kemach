/**
 * Global Module Validation & Execution Gate — Settings > "Module Settings"
 * (see the SystemSettings model in schema.prisma and the /company/
 * system-settings routes in routes/company.js).
 *
 * Three toggles, one row for the whole org:
 *
 *   isSalesEnabled      opening/saving/posting any Sales document
 *   isPurchaseEnabled   opening/saving/posting any Purchase document
 *   isInventoryEnabled  whether ANY document's stock-quantity check runs
 *                       and whether it writes to [dbo].[Stock] at all
 *
 * The Sales/Purchase gate (assertModuleEnabled, wired as the moduleGate()
 * middleware onto the routes below) is deliberately scoped to exactly the
 * document types this feature was built for, not "every route under
 * /sales/* or /purchase/*" — Sales Quotation and Purchase Quotation, for
 * instance, are pre-transactional documents nothing downstream posts stock
 * or GL against, and are left ungated.
 *
 * The Inventory gate is a different shape on purpose: it is NOT a per-
 * document-type list, because "does this document move stock" is already
 * answered by whether it calls assertNoNegativeStock,
 * assertNoNegativeWarehouseStock*, or postStockEntries at all -- Sales
 * Order, for instance, never did and still doesn't. So
 * isInventoryModuleEnabled() is read inside those functions themselves
 * (assertNoNegativeStock and its warehouse-scoped siblings in
 * routes/resources.js; postStockEntries in stockTable.js), which is the
 * one place every stock-moving document
 * — Sales and Purchase alike, plus Stock Issue/Receipt/Adjustment/Transfer —
 * already funnels through. Disabling Inventory there means "never block a
 * document for insufficient stock, and never write a stock-ledger row",
 * everywhere, in one place, rather than needing to be threaded through every
 * call site individually.
 */

const SALES_DOCUMENT_TYPES = [
  'Sales Order',
  'Delivery Challan',
  'Sales Invoice',
  'Sales Return',
  'Sales Credit Memo',
];

const PURCHASE_DOCUMENT_TYPES = [
  'Purchase Order',
  'Purchase GRN',
  'Purchase Invoice',
  'Purchase Return',
  'Purchase Credit Memo',
];

/** 'sales' | 'purchase' | null — null means this document type is not gated. */
function moduleForDocumentType(documentType) {
  if (SALES_DOCUMENT_TYPES.includes(documentType)) return 'sales';
  if (PURCHASE_DOCUMENT_TYPES.includes(documentType)) return 'purchase';
  return null;
}

/**
 * Read the singleton settings row. A missing row (no Settings page save has
 * ever happened) reads the same as a row whose columns are all 1 — the same
 * "absent means the database's own default" convention productUsage.js
 * uses for Product Master's Sales/Purchase/Inventory Item flags — so a
 * database that has not yet applied the system_settings migration, or has
 * applied it but nobody has touched Settings, behaves exactly as it did
 * before this feature existed.
 *
 * @param client a Prisma client OR an open transaction (`tx`) — either
 *   exposes `.systemSettings`, so callers inside and outside a transaction
 *   use this identically.
 */
async function getSystemSettings(client) {
  const row = await client.systemSettings.findFirst();
  return {
    isSalesEnabled: row ? row.isSalesEnabled !== false : true,
    isPurchaseEnabled: row ? row.isPurchaseEnabled !== false : true,
    isInventoryEnabled: row ? row.isInventoryEnabled !== false : true,
  };
}

/**
 * Block a Sales/Purchase document from opening, saving, or posting while its
 * module is switched off. A no-op for any document type not in the two
 * lists above (e.g. Sales Quotation) or already validated with an explicit
 * settings object.
 *
 * @param client Prisma client/tx, OR an already-resolved settings object
 *   (as returned by getSystemSettings) for a caller that already has one
 *   and does not want a second lookup.
 */
async function assertModuleEnabled(client, documentType) {
  const module = moduleForDocumentType(documentType);
  if (!module) return;

  const settings = 'isSalesEnabled' in (client || {}) ? client : await getSystemSettings(client);

  if (module === 'sales' && !settings.isSalesEnabled) {
    const err = new Error('Sales module is disabled.');
    err.status = 403;
    err.code = 'MODULE_DISABLED';
    throw err;
  }
  if (module === 'purchase' && !settings.isPurchaseEnabled) {
    const err = new Error('Purchase module is disabled.');
    err.status = 403;
    err.code = 'MODULE_DISABLED';
    throw err;
  }
}

/** True unless Settings > Module Settings has switched Inventory off. */
async function isInventoryModuleEnabled(client) {
  const settings = 'isInventoryEnabled' in (client || {}) ? client : await getSystemSettings(client);
  return settings.isInventoryEnabled !== false;
}

/**
 * Express middleware factory — `moduleGate('Sales Invoice')` etc. Runs
 * ahead of the route's own handler (auth() first, then this, then the
 * bespoke create/update/delete logic), reading the settings via the plain
 * `prisma` client since there is no open transaction yet at the middleware
 * stage — the route's own $transaction starts inside the handler, same as
 * every other pre-transaction guard in this app (assertUnique, runValidators).
 */
function moduleGate(documentType) {
  const prisma = require('../prisma/client');
  return (req, res, next) => {
    assertModuleEnabled(prisma, documentType).then(() => next(), next);
  };
}

module.exports = {
  SALES_DOCUMENT_TYPES,
  PURCHASE_DOCUMENT_TYPES,
  moduleForDocumentType,
  getSystemSettings,
  assertModuleEnabled,
  isInventoryModuleEnabled,
  moduleGate,
};
