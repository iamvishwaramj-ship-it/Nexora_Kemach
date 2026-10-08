import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * useTableFeatures — shared search / sort / filter engine for the bespoke
 * list tables (Financial Year List, Branch List, ...).
 *
 * Pair it with <TableToolbar /> for the global search box + filter popover and
 * <SortableHeaderCell /> for the tri-state sort icons.
 *
 * columns: [{
 *   field,                 // unique key
 *   headerName,            // label used in the filter popover
 *   sortable: true,        // set false to hide the sort icon
 *   searchable: true,      // set false to exclude from global search
 *   value: (row) => any,   // raw value used for search/sort/filter (default row[field])
 *   sortValue: (row) => any,       // override just for sorting (numbers/dates stay comparable)
 *   filter: 'text' | 'select' | 'dateRange' | 'numberRange' | false,
 *   filterOptions: ['Active', 'Inactive'],  // for 'select'; auto-derived from data when omitted
 * }]
 *
 * Returns { search, setSearch, sort, toggleSort, filters, setFilter,
 *           clearFilters, activeFilterCount, rows }
 */

const getRaw = (col, row) => (col.value ? col.value(row) : row[col.field]);

const toText = (v) => {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v);
};

// Numbers sort numerically, dates chronologically, everything else naturally
// (localeCompare with `numeric` so "Item 10" lands after "Item 9").
const compare = (a, b) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  const ad = Date.parse(a);
  const bd = Date.parse(b);
  if (!Number.isNaN(ad) && !Number.isNaN(bd) && typeof a === 'string' && /\d{4}-\d{2}-\d{2}/.test(a)) {
    return ad - bd;
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
};

const startOfDay = (v) => {
  const d = new Date(v);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const isEmptyFilter = (value) => {
  if (value == null || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.values(value).every((v) => v == null || v === '');
  return false;
};

export function parseSearchTerms(query){
  if (!query) return [];
  const normalized = String(query).replace(/[\r\n]+/g, ',').trim();
  if(!normalized) return [];

  const isFullySingleQuoted = normalized.startsWith('"') && normalized.endsWith('"') && !normalized.slice(1, -1).includes('"');
  const isFullyDoubleQuoted = normalized.startsWith("'") && normalized.endsWith("'") && !normalized.slice(1, -1).includes("'");
  if(isFullySingleQuoted || isFullyDoubleQuoted){
    const unquoted = normalized.slice(1, -1).trim().toLowerCase();
    return unquoted ? [unquoted] : [];
  }

  if(normalized.includes(',')){
    const terms = normalized.split(',').map((t) => t.trim().replace(/^['"]+|['"]+$/g, '').toLowerCase()).filter(Boolean);
    if(terms.length > 0) return terms;
  }

  const single = normalized.replace(/^['"]+|['"]+$/g, '').trim().toLowerCase();
  return single ? [single] : [];
}

export default function useTableFeatures(sourceRows, columns, options = {}) {
  const { defaultSort = null, onChange } = options;
  const allRows = useMemo(() => sourceRows || [], [sourceRows]);

  const [search, setSearch] = useState('');
  // sort = null (normal order) | { field, direction: 'asc' | 'desc' }
  const [sort, setSort] = useState(defaultSort);
  const [filters, setFilters] = useState({});
  // Whether the inline filter row above the table is showing. It lives here
  // rather than inside the button because the button and the panel render in
  // two different places — the button in the toolbar, the panel beneath it and
  // above the table — and the two have to agree on one piece of state.
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  // Tri-state cycle: normal -> ascending -> descending -> normal.
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
      if (isEmptyFilter(value)) delete next[field];
      else next[field] = value;
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => setFilters({}), []);

  const toggleFilterPanel = useCallback(() => setFilterPanelOpen((v) => !v), []);

  // Clears search, sort and filters together — for "Reset to Default" style
  // actions that repopulate the underlying data and shouldn't leave a stale
  // filter/sort hiding or reordering the freshly-reset rows.
  const resetAll = useCallback(() => {
    setSearch('');
    setSort(defaultSort);
    setFilters({});
  }, [defaultSort]);

  const activeFilterCount = Object.keys(filters).length;

  // Options offered by 'select' filters: use what the column declares,
  // otherwise derive the distinct values present in the data.
  const filterColumns = useMemo(
    () => columns
      .filter((col) => col.filter && col.filter !== false)
      .map((col) => {
        if (col.filter !== 'select' || col.filterOptions) return col;
        const seen = new Set();
        allRows.forEach((row) => {
          const v = getRaw(col, row);
          if (v != null && v !== '') seen.add(String(v));
        });
        return { ...col, filterOptions: Array.from(seen).sort((a, b) => compare(a, b)) };
      }),
    [columns, allRows]
  );

  const searched = useMemo(() => {
    const terms = parseSearchTerms(search);
    if (terms.length === 0) return allRows;
    const cols = columns.filter((col) => col.searchable !== false);
    return allRows.filter((row) =>
      terms.some((term) =>
      cols.some((col) => {
        // searchValue lets a column be searched by what the user actually
        // sees (e.g. "01 Apr 2026") while filtering/sorting still use the
        // raw ISO value.
        const text = col.searchValue ? col.searchValue(row) : getRaw(col, row);
        return toText(text).toLowerCase().includes(term);
      })
    )
    );
  }, [allRows, columns, search]);

  const filtered = useMemo(() => {
    if (activeFilterCount === 0) return searched;
    return searched.filter((row) =>
      Object.entries(filters).every(([field, value]) => {
        const col = columns.find((c) => c.field === field);
        if (!col) return true;
        const raw = getRaw(col, row);

        if (col.filter === 'select') {
          const picked = Array.isArray(value) ? value : [value];
          return picked.length === 0 || picked.includes(String(raw ?? ''));
        }
        if (col.filter === 'dateRange') {
          if (raw == null || raw === '') return false;
          const t = startOfDay(raw);
          if (Number.isNaN(t)) return false;
          if (value.from && t < startOfDay(value.from)) return false;
          if (value.to && t > startOfDay(value.to)) return false;
          return true;
        }
        if (col.filter === 'numberRange') {
          const n = Number(raw);
          if (Number.isNaN(n)) return false;
          if (value.min !== '' && value.min != null && n < Number(value.min)) return false;
          if (value.max !== '' && value.max != null && n > Number(value.max)) return false;
          return true;
        }
        // 'text' (default)
        return toText(raw).toLowerCase().includes(String(value).trim().toLowerCase());
      })
    );
  }, [searched, filters, activeFilterCount, columns]);

  const rows = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.field === sort.field);
    if (!col) return filtered;
    const pick = (row) => (col.sortValue ? col.sortValue(row) : getRaw(col, row));
    const sorted = [...filtered].sort((a, b) => compare(pick(a), pick(b)));
    return sort.direction === 'asc' ? sorted : sorted.reverse();
  }, [filtered, sort, columns]);

  // Send the page back to 1 whenever the visible result set changes, so the
  // user never lands on an out-of-range page. Pass the page setter directly:
  // { onChange: setPage } — a useState setter is referentially stable.
  useEffect(() => {
    if (onChange) onChange(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filters, sort]);

  return {
    search,
    setSearch,
    sort,
    toggleSort,
    filters,
    setFilter,
    clearFilters,
    resetAll,
    filterPanelOpen,
    setFilterPanelOpen,
    toggleFilterPanel,
    activeFilterCount,
    filterColumns,
    rows,
    totalCount: allRows.length,
    // True when a search term or any filter is narrowing the list — use it to
    // pick between the "no matches" and "nothing here yet" empty states.
    isFiltering: Boolean(search.trim()) || activeFilterCount > 0,
  };
}
