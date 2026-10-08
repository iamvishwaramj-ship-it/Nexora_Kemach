import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Phase 3 of the data-loading performance work (pure data-access, no
 * business-logic change) — server-side counterpart to useTableFeatures.js,
 * built for exactly two pages so far (Product Master, Business Partner) that
 * now fetch one page at a time via a resource's `useListPaged` hook instead
 * of the whole list. It is a SEPARATE, additive file: useTableFeatures.js
 * itself is untouched, so every other list page in the app keeps its
 * existing fully-client-side search/sort/filter/paging exactly as before.
 *
 * It returns the SAME shaped object useTableFeatures does (search, setSearch,
 * sort, toggleSort, filters, setFilter, clearFilters, filterPanelOpen,
 * setFilterPanelOpen, toggleFilterPanel, activeFilterCount, filterColumns,
 * rows, isFiltering — plus page/setPage/pageSize/setPageSize/total/isLoading/
 * isFetching), so it drops straight into <TableSearchFilter>, <TableFilterPanel>
 * and <SortableHeaderCell> unchanged.
 *
 * columns: same shape as useTableFeatures, with one addition —
 *   server: true   marks a column whose sort/`select`-type filter can be
 *                   pushed to the server as `?sort=`/`?dir=` or
 *                   `?<field>=value1,value2`. A column WITHOUT `server: true`
 *                   (Product Master's "Stock" — a live computed value, not a
 *                   plain DB column, see the sortableFields comment on the
 *                   /products route) keeps sorting/filtering CLIENT-SIDE,
 *                   applied only to whatever page is currently loaded — a
 *                   deliberate, documented scope line for that one column,
 *                   not a bug.
 *
 * useListPagedHook: the resource's `useListPaged` RTK Query hook (from
 *   createCrudApi). baseParams: extra params always sent (e.g. `{ view:
 *   'summary' }`). Multi-value 'select' filters (the filter panel's
 *   multi-select) are joined with ',' before being sent — the matching
 *   backend routes split on ',' into a Prisma `{ in: [...] }` for any value
 *   that contains one, and treat a plain value exactly as before (so a
 *   caller that never sends a comma — every existing caller — is
 *   unaffected).
 *
 * A `server: true` column whose `filter` is 'dateRange' or 'numberRange'
 * sends its value as two params instead of one — `<field>From`/`<field>To`
 * for a date range, `<field>Min`/`<field>Max` for a number range — since the
 * value itself is an object ({from, to} / {min, max}, same shape
 * useTableFeatures.js's own client-side dateRange/numberRange filtering
 * uses), not a scalar. A column without `server: true` is unaffected — its
 * range value stays client-side, exactly as before this existed. Added for
 * the sales-document list pages (Sales Order, Invoice, ...), whose Order
 * Date / Amount filters need to reach across the whole ledger, not just
 * whatever page happens to be loaded.
 */

const toText = (v) => {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v);
};

const compare = (a, b) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
};

const getRaw = (col, row) => (col.value ? col.value(row) : row[col.field]);

export default function useServerListTable(useListPagedHook, {
  columns,
  baseParams = {},
  initialPageSize = 10,
  searchDebounceMs = 350,
} = {}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState(null); // { field, direction: 'asc' | 'desc' }
  const [filters, setFilters] = useState({}); // { [field]: string | string[] }
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [page, setPage] = useState(0); // 0-indexed, matches every other list page's convention
  const [pageSize, setPageSize] = useState(initialPageSize);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), searchDebounceMs);
    return () => clearTimeout(t);
  }, [search, searchDebounceMs]);

  // Every other list page resets to page 0 whenever search/sort/filters
  // change (see useTableFeatures' own onChange(0) effect) — same here, so
  // the user never lands on a now-out-of-range page.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, sort, JSON.stringify(filters)]);

  const toggleSort = useCallback((field) => {
    setSort((prev) => {
      if (!prev || prev.field !== field) return { field, direction: 'asc' };
      if (prev.direction === 'asc') return { field, direction: 'desc' };
      return null;
    });
  }, []);

  const setFilter = useCallback((field, value) => {
    setFilters((prev) => {
      const next = { ...prev };
      const empty = value == null || value === '' || (Array.isArray(value) && value.length === 0);
      if (empty) delete next[field];
      else next[field] = value;
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => setFilters({}), []);
  const toggleFilterPanel = useCallback(() => setFilterPanelOpen((v) => !v), []);
  const activeFilterCount = Object.keys(filters).length;

  const filterColumns = useMemo(
    () => columns.filter((col) => col.filter && col.filter !== false),
    [columns]
  );

  const columnByField = useMemo(() => new Map(columns.map((c) => [c.field, c])), [columns]);

  const params = useMemo(() => {
    const p = { ...baseParams, page: page + 1, limit: pageSize };
    if (debouncedSearch.trim()) p.q = debouncedSearch.trim();
    if (sort && columnByField.get(sort.field)?.server) {
      p.sort = sort.field;
      p.dir = sort.direction;
    }
    Object.entries(filters).forEach(([field, value]) => {
      const col = columnByField.get(field);
      if (!col?.server) return; // client-only column (e.g. Products' Stock) — handled after fetch, not sent
      if (col.filter === 'dateRange' && value && typeof value === 'object') {
        if (value.from) p[`${field}From`] = value.from;
        if (value.to) p[`${field}To`] = value.to;
        return;
      }
      if (col.filter === 'numberRange' && value && typeof value === 'object') {
        if (value.min !== '' && value.min != null) p[`${field}Min`] = value.min;
        if (value.max !== '' && value.max != null) p[`${field}Max`] = value.max;
        return;
      }
      const joined = Array.isArray(value) ? value.join(',') : String(value);
      if (joined) p[field] = joined;
    });
    return p;
  }, [baseParams, page, pageSize, debouncedSearch, sort, filters, columnByField]);

  const result = useListPagedHook(params);
  const serverRows = result.data?.data || [];
  const meta = result.data?.meta;

  // Client-side-only refinement for columns without `server: true` — applied
  // to whatever page the server just returned, never to the full dataset.
  // A no-op (identity) for a page like Business Partner where every column
  // is server-capable.
  const rows = useMemo(() => {
    let out = serverRows;

    const clientFilterEntries = Object.entries(filters).filter(([field]) => !columnByField.get(field)?.server);
    if (clientFilterEntries.length) {
      out = out.filter((row) => clientFilterEntries.every(([field, value]) => {
        const col = columnByField.get(field);
        if (!col) return true;
        const raw = getRaw(col, row);
        if (col.filter === 'numberRange') {
          const n = Number(raw);
          if (Number.isNaN(n)) return false;
          if (value.min !== '' && value.min != null && n < Number(value.min)) return false;
          if (value.max !== '' && value.max != null && n > Number(value.max)) return false;
          return true;
        }
        if (col.filter === 'select') {
          const picked = Array.isArray(value) ? value : [value];
          return picked.length === 0 || picked.includes(String(raw ?? ''));
        }
        return toText(raw).toLowerCase().includes(String(value).trim().toLowerCase());
      }));
    }

    if (sort && !columnByField.get(sort.field)?.server) {
      const col = columnByField.get(sort.field);
      if (col) {
        const pick = (row) => (col.sortValue ? col.sortValue(row) : getRaw(col, row));
        out = [...out].sort((a, b) => compare(pick(a), pick(b)));
        if (sort.direction === 'desc') out = out.reverse();
      }
    }

    return out;
  }, [serverRows, filters, sort, columnByField]);

  return {
    search,
    setSearch,
    sort,
    toggleSort,
    filters,
    setFilter,
    clearFilters,
    filterPanelOpen,
    setFilterPanelOpen,
    toggleFilterPanel,
    activeFilterCount,
    filterColumns,
    rows,
    page,
    setPage,
    pageSize,
    setPageSize,
    total: meta?.total ?? 0,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    isFiltering: Boolean(debouncedSearch.trim()) || activeFilterCount > 0,
    // The RTK Query result's own refetch — e.g. for a "Bulk Import"
    // dialog's onImported, which needs to force a fresh page after an
    // import lands rows the current page's cache doesn't know about yet.
    refetch: result.refetch,
  };
}
