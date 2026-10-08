/**
 * Shared page/limit branch for the handful of sales-document list routes in
 * routes/resources.js that are bespoke (custom `where`/`include`, journal-ref
 * annotation, etc.) and so can't go through crudFactory's generic `list`
 * handler, but want the exact same opt-in paging contract crudFactory
 * already gives every resource built from it:
 *
 *   - No `?page=`/`?limit=` (every caller before this helper existed, plus
 *     every current dropdown/"Copy From"/cross-document-reference caller
 *     that still wants "the whole list"): unchanged response shape
 *     (`{ success, data }`), but now capped at `maxPageSize` rows (most
 *     recent first, per `orderBy`) instead of a genuinely unbounded
 *     `findMany` — see crudFactory.js's own comment: fine on demo data,
 *     not fine on a real ledger.
 *   - `?page=`/`?limit=` present: real server-side paging — `{ success,
 *     data, meta: { page, limit, total, pages } }`, same shape crudFactory's
 *     paged branch returns.
 *
 * Deliberately does not add sort/filter query-param plumbing (crudFactory's
 * `sortableFields`/`filterFields`) — none of today's migrated list pages
 * push a sort/filter to these routes yet; add that the same opt-in way if a
 * page needs it later.
 */
async function paginatedFindMany({
  delegate, where, include, orderBy = { id: 'desc' }, page, limit, maxPageSize = 500,
}) {
  const wantsPaging = page !== undefined || limit !== undefined;

  if (!wantsPaging) {
    const rows = await delegate.findMany({ where, include, orderBy, take: maxPageSize });
    return { rows, meta: null };
  }

  const take = Math.min(Math.max(Number(limit) || maxPageSize, 1), maxPageSize);
  const pageNo = Math.max(Number(page) || 1, 1);

  const [rows, total] = await Promise.all([
    delegate.findMany({ where, include, orderBy, skip: (pageNo - 1) * take, take }),
    delegate.count({ where }),
  ]);
  return { rows, meta: { page: pageNo, limit: take, total, pages: Math.ceil(total / take) } };
}

/**
 * Builds the extra `where` clauses for a bespoke list route's server-side
 * filters (Customer/Status/Sales Person/Payment Status/Date Range/... on the
 * sales-document list pages), and resolves `?sort=&dir=` against an
 * allow-list — the same two jobs crudFactory's `filterFields`/
 * `sortableFields` do for its generic routes, hand-rolled here because these
 * six sales-document routes have their own bespoke `where`/`orderBy` and
 * don't go through crudFactory at all.
 *
 * spec: { [queryParam]: { column, mode } }, mode one of:
 *   'contains' — substring match (text columns; a caller can also type a
 *                full value here, which still matches, since ".includes"
 *                already behaves that way)
 *   'eq'       — equality, or `{ in: [...] }` when the value contains a
 *                comma (matches crudFactory's own multi-select convention)
 *   'range'    — reads `${queryParam}From`/`${queryParam}To` instead of
 *                `queryParam` itself, both optional, as a date range
 *                (`{ gte, lte }`); `to` is end-of-day inclusive since a
 *                plain 'YYYY-MM-DD' value would otherwise exclude that whole
 *                day
 *   'numberRange' — reads `${queryParam}Min`/`${queryParam}Max`
 *
 * sortSpec: string[] — allow-listed columns `?sort=` may name; an
 * unrecognised or absent `?sort=` keeps the caller's own `orderBy` (passed
 * in as `defaultOrderBy`) unchanged, exactly like crudFactory's
 * `sortableFields`.
 */
function applyListQueryFilters(where, query, spec) {
  const extra = {};
  for (const [param, { column, mode }] of Object.entries(spec)) {
    if (mode === 'range') {
      const from = query[`${param}From`];
      const to = query[`${param}To`];
      if (from || to) {
        const range = {};
        if (from) range.gte = new Date(from);
        if (to) {
          const end = new Date(to);
          end.setHours(23, 59, 59, 999);
          range.lte = end;
        }
        extra[column] = range;
      }
      continue;
    }
    if (mode === 'numberRange') {
      const min = query[`${param}Min`];
      const max = query[`${param}Max`];
      if (min !== undefined && min !== '' || max !== undefined && max !== '') {
        const range = {};
        if (min !== undefined && min !== '') range.gte = Number(min);
        if (max !== undefined && max !== '') range.lte = Number(max);
        extra[column] = range;
      }
      continue;
    }
    const value = query[param];
    if (value === undefined || value === '') continue;
    if (mode === 'contains') {
      extra[column] = { contains: String(value) };
      continue;
    }
    // 'eq' (default)
    const str = String(value);
    extra[column] = str.includes(',')
      ? { in: str.split(',').map((s) => s.trim()).filter(Boolean) }
      : str;
  }
  if (!Object.keys(extra).length) return where;
  return { ...(where || {}), ...extra };
}

function resolveListOrderBy(query, sortSpec, defaultOrderBy) {
  const { sort, dir } = query;
  if (sortSpec && sort && sortSpec.includes(sort)) {
    return { [sort]: dir === 'desc' ? 'desc' : 'asc' };
  }
  return defaultOrderBy;
}

module.exports = { paginatedFindMany, applyListQueryFilters, resolveListOrderBy };
