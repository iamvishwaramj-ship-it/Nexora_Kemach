// Shared branch-scoping helper — used by crudFactory.js's generic `list`
// handler AND by every bespoke transaction list route in resources.js
// (Sales/Purchase Quotation, Order, Invoice, GRN, Delivery Challan, Stock
// Receipt/Issue/Adjustment/Transfer, Collection, Payment Voucher/Receipt,
// Bank Deposit, Cheque, Journal Entry, ...), so "restrict this list to the
// requesting user's own branches" is one rule instead of ~20 hand-copied
// ones that could quietly drift apart.
//
// Every branch-scoped column in this schema stores the branch's NAME as a
// plain string (see WarehouseMaster.branch and friends — the same cross-
// master-by-name convention this whole schema uses), and req.user.branches
// is that same list of names, baked into the JWT at login/refresh (see
// authService.grantedBranches) rather than looked up per request — auth()
// trusts the token as-is, same as role/permissions already do.

/**
 * The where-clause fragment restricting rows to req.user's own granted
 * branches, or null when no restriction applies: the resource isn't
 * branch-scoped (`branchField` falsy), there's no authenticated user, or
 * the user is an admin (never branch-restricted).
 *
 * A non-admin with zero branch grants gets `{ in: [] }`, which Prisma
 * always resolves to zero rows — fail closed, the same "an empty
 * permissions grid hides every menu" default the rest of the app already
 * applies, rather than accidentally showing everything.
 */
function branchScopeWhere(req, branchField) {
  if (!branchField || !req?.user || req.user.role === 'admin') return null;
  const branches = Array.isArray(req.user.branches) ? req.user.branches : [];
  return { [branchField]: { in: branches } };
}

/**
 * ANDs the branch scope for `branchField` (default 'branch') into an
 * existing where clause. `where` may be undefined (no other filter) — the
 * common case for every list route this backs.
 */
function withBranchScope(where, req, branchField = 'branch') {
  const scope = branchScopeWhere(req, branchField);
  if (!scope) return where;
  if (!where) return scope;
  return { AND: [where, scope] };
}

/**
 * Like branchScopeWhere, but ORs the restriction across several branch
 * columns instead of just one — for the handful of resources (Stock Transfer
 * Request today) where a row is "visible from either side": a source
 * `branch` column and a separate destination column (e.g. `toBranch`). A
 * non-admin only needs a grant on ONE of `branchFields` for the row to pass;
 * admins are unrestricted exactly as in branchScopeWhere.
 */
function branchScopeWhereAny(req, branchFields) {
  const fields = Array.isArray(branchFields) ? branchFields.filter(Boolean) : [];
  if (!fields.length || !req?.user || req.user.role === 'admin') return null;
  const branches = Array.isArray(req.user.branches) ? req.user.branches : [];
  if (fields.length === 1) return { [fields[0]]: { in: branches } };
  return { OR: fields.map((field) => ({ [field]: { in: branches } })) };
}

/**
 * ANDs branchScopeWhereAny's OR-across-fields restriction into an existing
 * where clause. Same shape/behaviour as withBranchScope, generalized to
 * multiple branch columns.
 */
function withBranchScopeAny(where, req, branchFields) {
  const scope = branchScopeWhereAny(req, branchFields);
  if (!scope) return where;
  if (!where) return scope;
  return { AND: [where, scope] };
}

module.exports = { branchScopeWhere, withBranchScope, branchScopeWhereAny, withBranchScopeAny };
