const asyncHandler = require('./asyncHandler');
const { withBranchScope } = require('./branchScope');

/**
 * Generic Prisma-backed CRUD controller factory. Every simple master/
 * transaction-header resource in the app (30+ of them) shares the exact
 * same list/get/create/update/delete shape, so we generate the handlers
 * once instead of hand-rolling per-module boilerplate.
 *
 * @param {object} delegate - a Prisma model delegate, e.g. prisma.businessPartner
 * @param {object} options
 *   searchFields: string[] — fields included in the ?q= search filter
 *   orderBy: object — default sort
 *   transform: (body) => data — maps request body to Prisma create/update data
 *   maxPageSize: number — hard cap on how many rows one request can return
 *   autoNumber: { documentCode, field, delegate } — generate the code column
 *     from a numbering series instead of trusting what the client typed
 *   listViews: { [name]: prismaSelectObject } — Phase 2 of the data-loading
 *     performance work (pure data-access, no business-logic change). Named,
 *     opt-in narrower projections for the `list` endpoint ONLY, activated
 *     per request via `?view=<name>`. A request that doesn't pass `?view=`
 *     — every caller that existed before this option did, and every caller
 *     that still doesn't need a slim shape — gets `select: undefined`, i.e.
 *     today's full-row behaviour, byte-for-byte. `getOne` (GET /:id) never
 *     looks at this option at all: it always returns the full row, so a
 *     caller that fetched a slim list row and then needs the rest of a
 *     record (e.g. opening it for Edit) fetches that one record by id
 *     instead of relying on what `list` returned. Leave unset for every
 *     resource that doesn't need this — this is purely additive.
 *   sortableFields: string[] — Phase 3 of the data-loading performance work
 *     (pure data-access, no business-logic change). An allow-list of column
 *     names `list` may sort by when the caller passes `?sort=<field>&dir=
 *     asc|desc` AND is already on the paged branch (`?page=`/`?limit=`) —
 *     consulted nowhere else, so a caller that never sends `?sort=` (every
 *     caller before this option existed) keeps getting `orderBy` exactly as
 *     configured above, unchanged. A `sort` value not in the list is ignored
 *     the same way, falling back to the default `orderBy`. Leave unset for
 *     every resource that hasn't opted into server-side sort.
 *   filterFields: { [queryParam]: columnName | { column, mode: 'contains' } }
 *     — Phase 3, same spirit as `sortableFields`: per-column filters, also
 *     consulted ONLY on the paged branch, activated only by the exact query
 *     params named here. A plain string entry is an equality filter — or, if
 *     the incoming value contains a comma (the filter panel's multi-select
 *     joins its chosen values with ','), a Prisma `{ in: [...] }` filter
 *     instead — for a 'select'-type column. `{ column, mode: 'contains' }`
 *     is a substring filter, for a 'text'-type column (matches the meaning
 *     of that column's client-side `filter: 'text'`, which was always a
 *     substring match, not equality — pushing it server-side as plain
 *     equality would have silently narrowed what a partial-text search
 *     matches). Leave unset for every resource that hasn't opted into
 *     server-side filtering.
 *   cacheTtlMs: number — Phase 5 of the data-loading performance work (pure
 *     data-access, no business-logic change). Opt-in, module-level TTL cache
 *     for `list`'s plain "give me everything" request only — i.e. no `?q=`,
 *     no `?view=`, and not on the paged branch (`?page=`/`?limit=`) — the
 *     exact shape a dropdown/lookup caller sends. Follows the same pattern
 *     already used elsewhere in this codebase for `homeStateCache`/
 *     `currentStockCache` in resources.js: a plain `{ at, data }` object
 *     closed over by this one controller instance, re-fetched from the DB
 *     whenever it's missing or older than `cacheTtlMs`. A search (`?q=`), a
 *     narrower view (`?view=`), or a paged/sorted/filtered request always
 *     goes straight to the DB, uncached, exactly as before this option
 *     existed — so this can only ever make the plain list *faster*, never
 *     change what any request returns.
 *
 *     Deliberately refused (see the guard right below this options block)
 *     together with `branchField`: a branch-scoped resource's `where` is
 *     built from `req.user.branches`, which differs per caller, so a single
 *     shared cache entry would serve one user's branch-filtered rows to a
 *     completely different user — the exact class of bug this task's "never
 *     weaken/bypass branch scoping" rule exists to prevent. Only set this on
 *     resources that are genuinely branch-agnostic pure lookup masters
 *     (Chart of Accounts, HSN Master, ... — the same category crudFactory
 *     already documents `branchField` as being left unset for). Leave unset
 *     for every resource that hasn't opted into this.
 */

/** Columns a client must never be able to set through a generic CRUD route. */
// 'seriesId' is never a real column on any model — it's the transient
// numbering-series choice a create form (Sales/Purchase Quotation, Order,
// Invoice, etc. — see DocumentSeriesNoField) sends alongside the document
// number. Bespoke transaction routes in resources.js pull it out and
// consume it themselves before ever reaching sanitize(); stripping it here
// too protects every resource that goes through this generic CRUD
// controller instead (e.g. Enquiry's PUT, which has no bespoke route) from
// an 'Unknown argument seriesId' error on save.
const PROTECTED_FIELDS = new Set(['id', 'createdAt', 'updatedAt', 'created_at', 'updated_at', 'seriesId']);

/**
 * Parse and validate a route :id.
 *
 * This used to be a bare `Number(req.params.id)`, so GET /customers/abc
 * reached Prisma as NaN and came back as an opaque 500 from the query engine
 * instead of a 400 saying what was wrong. Floats and negative ids behaved the
 * same way.
 */
function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error('Invalid record id');
    err.status = 400;
    throw err;
  }
  return id;
}

/**
 * Strip fields the caller is not allowed to set, so a POST carrying
 * `{"id": 1}` cannot repoint a record's primary key and a PUT cannot forge
 * the audit timestamps on a row.
 */
function sanitize(body) {
  const clean = {};
  for (const [key, value] of Object.entries(body || {})) {
    if (PROTECTED_FIELDS.has(key)) continue;
    if (value === undefined) continue;
    clean[key] = value;
  }
  return clean;
}

function createCrudController(delegate, options = {}) {
  const {
    searchFields = [],
    orderBy = { id: 'desc' },
    transform = (body) => body,
    maxPageSize = 500,
    // { documentCode, field, delegate } — makes this resource's code column
    // auto-generated from the numbering series of that document code.
    // `delegate` is the Prisma model name, needed because the allocation runs
    // inside a transaction and the captured delegate is not transaction-bound.
    autoNumber = null,
    // Hooks that let a resource enforce rules the generic factory cannot know
    // about — chiefly refusing to delete a master record that transactions
    // still reference, and carrying a rename across that history.
    guard = {},
    // async ({ data, id, delegate }) => data | void — runs on every create and
    // update, before the row is written. `id` is null on create.
    //
    // `transform` can't do this job: it's synchronous, so it can't look
    // anything up. A rule like "the parent account must be a Title in the same
    // group, and the resulting depth must not exceed 5" needs the database,
    // which is exactly the class of rule that must not be left to the client.
    // Returning an object replaces the data being written (used to overwrite
    // client-supplied derived columns with server-computed ones); returning
    // nothing keeps it as-is. Throw an Error with `.status = 400` to reject.
    validate = null,
    // async ({ tx, row, data, id }) => void — runs INSIDE the same transaction
    // as the create/update that triggered it, immediately after the row is
    // written. `id` is null on create.
    //
    // For rules whose consequence lands on OTHER rows: "exactly one branch may
    // be the Main Branch", where promoting one has to demote whoever held it
    // before. Doing that here rather than as a follow-up request is what stops
    // two rows both claiming an exclusive flag when two saves land at once,
    // and stops a failed save from demoting the incumbent without promoting
    // its replacement.
    afterWrite = null,
    // The Prisma model property name (e.g. 'branch'). Needed only when
    // `afterWrite` is set: the `delegate` captured above is not bound to a
    // transaction, so the write itself has to go through `tx[delegateName]`.
    // autoNumber already carries the same name, so it is reused when present.
    delegateName = null,
    // Name of this resource's own branch column (e.g. 'branch' on
    // SalesOrder, BusinessPartner, WarehouseMaster, ...) — every one of them
    // stores the branch's NAME as a plain string, the same cross-master-by-
    // name convention the rest of this schema uses (see schema.prisma). When
    // set, `list` restricts results to the branches on the requesting user's
    // own JWT (req.user.branches — see authService.grantedBranches, baked in
    // at login/refresh) unless that user is an admin, who is never branch-
    // restricted. Leave unset for resources with no branch column, or ones
    // that are deliberately branch-agnostic (pure lookup masters like
    // Currency, UOM, Product Group).
    branchField = null,
    // Optional async (rows, req) => rows — lets a resource annotate each row
    // after fetch, before it goes out over the wire. Added for InvoiceType's
    // `isUsed` flag (see getReferencedIdentitySet in businessRules.js), which
    // needs the same "only run the heavy usage query when asked" behaviour
    // the bespoke business-partners list route already has, but InvoiceType
    // has no bespoke route — it goes through this generic controller. Kept
    // generic (not InvoiceType-specific) so any other resource can reuse it.
    annotate = null,
    // See the JSDoc block above — opt-in, per-request narrower projection
    // for `list` only, keyed by `?view=<name>`.
    listViews = null,
    // See sortableFields/filterFields in the JSDoc block above — Phase 3,
    // opt-in server-side sort/filter, consulted only on the paged branch.
    sortableFields = null,
    filterFields = null,
    // See cacheTtlMs in the JSDoc block above — Phase 5, opt-in TTL cache
    // for the plain unfiltered/unpaged `list` request only.
    cacheTtlMs = null,
  } = options;

  // Resolved once — see delegateName above.
  const txDelegateName = delegateName || (autoNumber && autoNumber.delegate) || null;
  if (afterWrite && !txDelegateName) {
    throw new Error('crudFactory: afterWrite requires delegateName (or autoNumber.delegate)');
  }
  // See cacheTtlMs's JSDoc above — a branch-scoped resource's `where` depends
  // on the calling user's own granted branches, so a single cached response
  // could leak one user's branch-filtered rows to another. Fail fast at
  // startup rather than risk that ever reaching production.
  if (cacheTtlMs && branchField) {
    throw new Error('crudFactory: cacheTtlMs cannot be combined with branchField (branch-scoped data must never be cached across users)');
  }
  // Module-instance-local cache state for cacheTtlMs — one per
  // createCrudController() call, i.e. one per resource mount, never shared
  // across resources. See the JSDoc block above for exactly what this caches
  // and what it never touches.
  //
  // Keyed by `?view=` rather than a single slot, so a resource that offers
  // BOTH a full unpaged shape and one or more `listViews` projections can
  // cache each of them independently. It used to be one slot guarded by
  // `!select`, which meant a projection request could never be cached at
  // all — so the moment a caller opted into a lean view to make its request
  // cheap, it also opted out of the cache and went to the database every
  // time. The two optimizations cancelled each other out; keying by view
  // lets a caller have both. Each view's entry carries its own timestamp.
  let simpleListCache = new Map(); // view key ('' for no view) -> { at, data }
  // Any write through this controller drops the whole cache for this
  // resource. Without it the cache is TTL-only: add a product and it stays
  // missing from every picker in the app until the TTL happens to lapse,
  // which reads as "the new record didn't save". Clearing every view's entry
  // (not just the one matching the write) because a created/updated/deleted
  // row can appear in any projection.
  const invalidateListCache = () => { if (cacheTtlMs) simpleListCache.clear(); };

  const list = asyncHandler(async (req, res) => {
    const { q, page, limit, view, sort, dir } = req.query;
    const searchWhere = q && searchFields.length
      ? { OR: searchFields.map((f) => ({ [f]: { contains: q } })) }
      : undefined;
    // See utils/branchScope.js — ANDs in `{ [branchField]: { in: req.user.
    // branches } }` for a non-admin when this resource declared one.
    const where = withBranchScope(searchWhere, req, branchField);

    // See listViews above — an unrecognised/absent `?view=` (every caller
    // that existed before this option did) leaves `select` undefined, which
    // Prisma treats identically to not passing the option at all, so the
    // full-row shape returned today is unchanged.
    const select = (listViews && view && listViews[view]) || undefined;
    const selectOption = select ? { select } : {};

    // An unbounded findMany is fine on demo data and not fine on a real
    // ledger — a couple of years of invoices is tens of thousands of rows and
    // times the request out. Paging is opt-in so existing callers that expect
    // the whole list keep working, but the result set is always capped.
    const wantsPaging = page !== undefined || limit !== undefined;

    if (!wantsPaging) {
      // Phase 5 — cacheTtlMs (see the JSDoc block above). Only the plain
      // "everything" shape is eligible: no `?q=` (searchWhere would be
      // request-specific) and no `?view=` (a different `select` per
      // request). Every other combination — which is every request this
      // resource received before cacheTtlMs existed, if it's a search or a
      // ?view= caller — always falls through to the DB below, unchanged.
      // `?q=` is still never cached — searchWhere makes the result specific
      // to one request's search term. A `?view=` IS cacheable now; it just
      // gets its own entry (see simpleListCache above).
      const cacheEligible = cacheTtlMs && !searchWhere;
      const cacheKey = view || '';
      if (cacheEligible) {
        const hit = simpleListCache.get(cacheKey);
        if (hit && (Date.now() - hit.at) < cacheTtlMs) {
          return res.json({ success: true, data: hit.data });
        }
      }
      const rows = await delegate.findMany({ where, orderBy, take: maxPageSize, ...selectOption });
      const data = annotate ? await annotate(rows, req) : rows;
      if (cacheEligible) {
        simpleListCache.set(cacheKey, { at: Date.now(), data });
      }
      return res.json({ success: true, data });
    }

    const take = Math.min(Math.max(Number(limit) || maxPageSize, 1), maxPageSize);
    const pageNo = Math.max(Number(page) || 1, 1);

    // Phase 3 — server-side sort/filter, opt-in via sortableFields/
    // filterFields (see the JSDoc block above). Neither can affect anything
    // outside this paged branch, and inside it, a caller who doesn't pass
    // `?sort=`/the matching filter query params gets `orderBy`/`where`
    // exactly as computed above, unchanged.
    const pagedOrderBy = sortableFields && sort && sortableFields.includes(sort)
      ? { [sort]: dir === 'desc' ? 'desc' : 'asc' }
      : orderBy;

    let pagedWhere = where;
    if (filterFields) {
      const extra = {};
      for (const [param, spec] of Object.entries(filterFields)) {
        const value = req.query[param];
        if (value === undefined || value === '') continue;
        // A filterFields entry is either a plain column name (equality /
        // multi-select `in`, for a 'select'-type column) or
        // `{ column, mode: 'contains' }` (substring match, for a
        // 'text'-type column) — see the JSDoc block above.
        const { column, mode } = typeof spec === 'string' ? { column: spec, mode: 'eq' } : spec;
        if (mode === 'contains') {
          extra[column] = { contains: String(value) };
          continue;
        }
        const str = String(value);
        extra[column] = str.includes(',')
          ? { in: str.split(',').map((s) => s.trim()).filter(Boolean) }
          : str;
      }
      if (Object.keys(extra).length) pagedWhere = { ...(where || {}), ...extra };
    }

    const [rows, total] = await Promise.all([
      delegate.findMany({ where: pagedWhere, orderBy: pagedOrderBy, skip: (pageNo - 1) * take, take, ...selectOption }),
      delegate.count({ where: pagedWhere }),
    ]);
    const data = annotate ? await annotate(rows, req) : rows;
    res.json({
      success: true,
      data,
      meta: { page: pageNo, limit: take, total, pages: Math.ceil(total / take) },
    });
  });

  const getOne = asyncHandler(async (req, res) => {
    const row = await delegate.findUnique({ where: { id: parseId(req.params.id) } });
    if (!row) return res.status(404).json({ success: false, message: 'Record not found' });
    // Reuses the same per-row annotate hook `list` uses (wrapped in a single-
    // element array) so a resource like SalesEmployee only has to implement
    // its presigned-URL enrichment once for both list and single-record reads.
    const data = annotate ? (await annotate([row], req))[0] : row;
    res.json({ success: true, data });
  });

  const create = asyncHandler(async (req, res) => {
    let data = transform(sanitize(req.body));
    if (validate) data = (await validate({ data, id: null, delegate })) || data;

    // Master records (customer, product, branch, ...) draw their code from the
    // same numbering engine the transaction documents use. The allocation runs
    // inside the same transaction as the insert, so a save that fails
    // validation rolls back the number it consumed rather than burning a
    // permanent gap in the sequence.
    if (autoNumber) {
      const prisma = require('../prisma/client');
      const { resolveDocumentNumber } = require('./documentNumber');

      const row = await prisma.$transaction(async (tx) => {
        const { documentNumber, syncManual } = await resolveDocumentNumber(
          autoNumber.documentCode,
          data[autoNumber.field],
          tx
        );
        const created = await tx[autoNumber.delegate].create({
          data: { ...data, [autoNumber.field]: documentNumber },
        });
        if (syncManual) await syncManual();
        if (afterWrite) await afterWrite({ tx, row: created, data, id: null });
        return created;
      });
      return res.status(201).json({ success: true, data: row });
    }

    // Same transaction as the insert, so a consequence that lands on other
    // rows can never half-apply — see afterWrite above.
    if (afterWrite) {
      const prisma = require('../prisma/client');
      const row = await prisma.$transaction(async (tx) => {
        const created = await tx[txDelegateName].create({ data });
        await afterWrite({ tx, row: created, data, id: null });
        return created;
      });
      return res.status(201).json({ success: true, data: row });
    }

    const row = await delegate.create({ data });
    res.status(201).json({ success: true, data: row });
  });

  const update = asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    let data = transform(sanitize(req.body));
    if (validate) data = (await validate({ data, id, delegate })) || data;

    if (guard.onUpdate) {
      // Runs inside the same transaction as the write, so a rename and the
      // history it cascades to either both land or neither does.
      const row = await guard.onUpdate({ id, data, delegate });
      return res.json({ success: true, data: row });
    }

    // Same transaction as the update — see afterWrite above.
    if (afterWrite) {
      const prisma = require('../prisma/client');
      const row = await prisma.$transaction(async (tx) => {
        const updated = await tx[txDelegateName].update({ where: { id }, data });
        await afterWrite({ tx, row: updated, data, id });
        return updated;
      });
      return res.json({ success: true, data: row });
    }

    const row = await delegate.update({ where: { id }, data });
    res.json({ success: true, data: row });
  });

  const remove = asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (guard.onDelete) {
      await guard.onDelete({ id, delegate });
    } else {
      await delegate.delete({ where: { id } });
    }
    res.json({ success: true, message: 'Deleted successfully' });
  });

  // Write handlers are wrapped rather than having invalidateListCache()
  // called inline before each res.json(): create and update each have
  // several return paths already (guard.onUpdate, afterWrite, the plain
  // write) and any new one added later would silently skip the
  // invalidation, leaving a resource serving a stale list with no obvious
  // cause. Wrapping is the version that cannot be forgotten. `finally`, not
  // `then`: these are asyncHandler-wrapped so they resolve even on failure,
  // and clearing the cache after a failed write costs one extra query.
  // Cleared on BOTH sides of the write, not just after it. After alone
  // leaves two gaps: a read that arrives while the write is still in flight
  // would be served the pre-write rows and, worse, would re-populate the
  // cache with them a moment before the invalidation lands — pinning stale
  // data for the rest of the TTL, which is the exact failure the
  // invalidation exists to prevent. Clearing first shuts the door, clearing
  // after sweeps up anything that got in anyway.
  const invalidatingWrite = (handler) => async (req, res, next) => {
    invalidateListCache();
    try {
      await handler(req, res, next);
    } finally {
      invalidateListCache();
    }
  };

  return {
    list,
    getOne,
    create: invalidatingWrite(create),
    update: invalidatingWrite(update),
    remove: invalidatingWrite(remove),
    // Exposed so a resource with its own bespoke routes alongside this
    // generic mount (e.g. a bulk-import route that writes with a direct
    // `prisma.<model>.upsert()` rather than through `create`/`update` above)
    // can drop this SAME cache after it writes. Every write that goes
    // through this controller already clears it automatically (see
    // invalidatingWrite above) — this only matters for a write that bypasses
    // this controller entirely, which never sees that wrapper. A no-op when
    // cacheTtlMs was never set (invalidateListCache() then does nothing).
    invalidateListCache,
  };
}

module.exports = createCrudController;
module.exports.parseId = parseId;
module.exports.sanitize = sanitize;
