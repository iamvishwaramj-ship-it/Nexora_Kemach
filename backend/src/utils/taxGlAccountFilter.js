/**
 * GST/TCS account filtering — the single, shared rule used by both:
 *   - Accounting > G/L Account Determination > Sales/Purchasing > Tax
 *     (frontend/src/pages/accounting/GLAccountDeterminationForm.jsx, applied
 *     client-side there since that screen already has the full Chart of
 *     Accounts loaded — that screen has no TCS row, only the GST/IGST rate
 *     rows below, so it keeps its own narrower "%gst%"-only copy of this
 *     filter and does not need the "or TCS" half added here).
 *   - Tax Code Master's Sales/Purchase/RCM Tax Account pickers
 *     (frontend/src/pages/company/TaxCode.jsx), applied server-side here via
 *     GET /company/tax-codes/gl-accounts — the only consumer of this
 *     function, so widening it here is safe.
 *
 * Exact source of truth (no other filtering logic):
 *
 *   SELECT * FROM ChartOfAccounts
 *   WHERE (AccountName LIKE '%GST%' OR AccountName LIKE '%TCS%') AND AccountNature = 'A';
 *
 * i.e. "GST" or "TCS" anywhere in the account name (start/middle/end, case-
 * insensitive — names are free-typed on Chart of Accounts) AND
 * accountNature = 'A' (Active/postable, not a Title roll-up header). The
 * "or TCS" half exists for the Tax Code Master's own TCS row (GST+TCS /
 * IGST+TCS tax types — see lib/taxCodeGroups.js): a company's TCS payable/
 * receivable account is conventionally named with "TCS", not "GST", so
 * without it the TCS row's own Sales/Purchase/RCM pickers would offer no
 * matching accounts at all. Deliberately does NOT check Account Group /
 * Liabilities classification, and does NOT intersect with what's already
 * configured on G/L Account Determination — this is exactly this query's
 * result set, nothing more.
 */

const prisma = require('../prisma/client');

// The twelve Sales/Purchase/RCM account fields on TaxCode itself (SGST/CGST/
// IGST/TCS x Sales/Purchase/RCM) — see the TaxCode model comment in
// schema.prisma. Every one of these that a create/update submits must fall
// inside the allowed set below.
const TAX_CODE_ACCOUNT_FIELDS = [
  'sgstSalesAccountId', 'sgstPurchaseAccountId', 'sgstRcmAccountId',
  'cgstSalesAccountId', 'cgstPurchaseAccountId', 'cgstRcmAccountId',
  'igstSalesAccountId', 'igstPurchaseAccountId', 'igstRcmAccountId',
  'tcsSalesAccountId', 'tcsPurchaseAccountId', 'tcsRcmAccountId',
];

// Which TaxCode account field feeds which GlAccountDetermination default
// field, per tax group — used by applyTaxCodeDefaultsToGlDetermination below
// (Part 2 of the Tax Code Master spec: a newly-picked Sales/Purchase Tax
// Account becomes the default on G/L Account Determination's Tax section
// when that default isn't already set).
const TAX_CODE_TO_DETERMINATION_DEFAULT = {
  sgstSalesAccountId: 'salesSgstAccountId',
  cgstSalesAccountId: 'salesCgstAccountId',
  igstSalesAccountId: 'salesIgstAccountId',
  sgstPurchaseAccountId: 'purchaseSgstAccountId',
  cgstPurchaseAccountId: 'purchaseCgstAccountId',
  igstPurchaseAccountId: 'purchaseIgstAccountId',
};

const GST_NAME_PATTERN = /gst|tcs/i;

/**
 * True when `account` (a ChartOfAccount row) matches the exact filter above:
 * (AccountName LIKE '%GST%' OR AccountName LIKE '%TCS%') AND AccountNature = 'A'.
 */
function isGstActiveAccount(account) {
  if (!account) return false;
  return account.accountNature === 'A' && GST_NAME_PATTERN.test(account.accountName || '');
}

/**
 * Pure function — no database access — so the filter itself is unit-testable
 * without standing up a database (see
 * backend/src/tests/taxGlAccountFilter.test.js).
 *
 * @param {Array} chartOfAccounts - ChartOfAccount rows.
 * @returns {Set<number>} the allowed ChartOfAccount ids.
 */
function computeAllowedTaxGLAccountIds(chartOfAccounts) {
  const allowed = new Set();
  for (const account of chartOfAccounts || []) {
    if (isGstActiveAccount(account)) allowed.add(Number(account.id));
  }
  return allowed;
}

/**
 * Loads the current Chart of Accounts and returns the rows matching the
 * filter above (optionally narrowed further by a code/name search — the
 * search itself never widens the set, it only filters within it).
 */
async function getAllowedTaxGLAccounts({ search } = {}) {
  const chartOfAccounts = await prisma.chartOfAccount.findMany();

  const allowedIds = computeAllowedTaxGLAccountIds(chartOfAccounts);
  let rows = chartOfAccounts.filter((a) => allowedIds.has(Number(a.id)));

  const q = search != null ? String(search).trim().toLowerCase() : '';
  if (q) {
    rows = rows.filter((a) => (
      String(a.accountCode || '').toLowerCase().includes(q)
      || String(a.accountName || '').toLowerCase().includes(q)
    ));
  }

  return rows;
}

/**
 * Validates every Sales/Purchase/RCM tax account field present on `data`
 * (a Tax Code create/update payload) against the allowed set, regardless of
 * what the frontend already filtered client-side. Fields that are null/
 * undefined are left alone (RCM is optional — see the TaxCode.jsx comment).
 *
 * Throws (via `makeBadRequest`, so the caller controls the exact error shape
 * already in use on that route) with one field-tagged message per invalid
 * account, all reported together rather than stopping at the first one.
 */
async function validateTaxCodeAccountFields(data, makeBadRequest) {
  const provided = TAX_CODE_ACCOUNT_FIELDS.filter((f) => data?.[f] != null);
  if (!provided.length) return;

  const allowed = await getAllowedTaxGLAccounts();
  const allowedIds = new Set(allowed.map((a) => Number(a.id)));

  const message = 'Invalid Tax Account. Please select a GST account (Chart of Account name contains "GST" and is Active).';
  const errors = provided
    .filter((field) => !allowedIds.has(Number(data[field])))
    .map((field) => ({ field, message }));

  if (errors.length) throw makeBadRequest(errors);
}

/**
 * Part 2 of the Tax Code Master spec: when a Tax Code is CREATED, its
 * Sales/Purchase Tax Account picks become the DEFAULT on G/L Account
 * Determination's Tax section — but only filling a gap, never overwriting an
 * admin-configured default that's already set. Applied to whichever
 * financial year's GlAccountDetermination row is presently open (same
 * "active year, else the only row" resolution glPosting.js's own
 * determination() lookup uses), inside the same transaction as the Tax
 * Code's own create so both succeed or neither does.
 *
 * `tx` is the Prisma transaction client the caller is already inside.
 * `taxCodeData` is the Tax Code's own create payload (already validated by
 * validateTaxCodeAccountFields above).
 */
async function applyTaxCodeDefaultsToGlDetermination(tx, taxCodeData) {
  const updates = {};
  for (const [taxCodeField, determinationField] of Object.entries(TAX_CODE_TO_DETERMINATION_DEFAULT)) {
    if (taxCodeData?.[taxCodeField] != null) updates[determinationField] = { value: Number(taxCodeData[taxCodeField]), field: determinationField };
  }
  if (!Object.keys(updates).length) return;

  const activeFy = await tx.financialYear.findFirst({ where: { status: 'Active' } });
  const row = activeFy
    ? await tx.glAccountDetermination.findFirst({ where: { financialYearId: activeFy.id } })
    : await tx.glAccountDetermination.findFirst();
  if (!row) return; // Nothing to default onto yet — Company Setup hasn't created a G/L Account Determination row for any year.

  const data = {};
  for (const { value, field } of Object.values(updates)) {
    if (row[field] == null) data[field] = value; // only fill a gap, never overwrite an existing default
  }
  if (Object.keys(data).length) {
    await tx.glAccountDetermination.update({ where: { id: row.id }, data });
  }
}

module.exports = {
  TAX_CODE_ACCOUNT_FIELDS,
  TAX_CODE_TO_DETERMINATION_DEFAULT,
  isGstActiveAccount,
  computeAllowedTaxGLAccountIds,
  getAllowedTaxGLAccounts,
  validateTaxCodeAccountFields,
  applyTaxCodeDefaultsToGlDetermination,
};
