// Wraps an RTK Query `use...Query` result with a localStorage-backed mirror
// of its last successful response, so a full page reload (F5, closing and
// reopening the tab) can paint a report's table instantly from what was
// last seen instead of a blank/loading state -- while the real query still
// runs exactly as it always has and silently replaces the cached data once
// fresh results arrive (the standard "stale-while-revalidate" pattern).
//
// Why this is needed at all: RTK Query's own cache lives in the Redux
// store, which is in-memory only. It's what makes switching between tabs
// inside the app instant, but a full page reload wipes JS memory entirely,
// so RTK Query has nothing to serve and has to hit the API from zero every
// time -- this hook is the piece that survives that reload.
//
// This does NOT change RTK Query's own caching, refetch-on-mount, or
// invalidation behavior at all -- `queryResult` is passed straight through
// (tags still invalidate it, filters still refetch it, etc.) with only
// `data`/`isLoading` swapped out. If the API's own response is stale, this
// cache is stale for exactly as long and no longer -- it never blocks or
// delays the real fetch.
import { useEffect, useState } from 'react';

const STORAGE_PREFIX = 'nexora.reportCache.';
// Skip caching a response bigger than this rather than risk a quota error
// taking down every other cached report sharing the same localStorage
// origin (~5-10MB total, shared across the whole app).
const MAX_ENTRY_BYTES = 1_000_000;

function readCache(key) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    // Corrupted entry, private browsing, storage disabled, etc. -- treat
    // exactly like there was never anything cached.
    return null;
  }
}

function writeCache(key, data) {
  try {
    const raw = JSON.stringify(data);
    if (raw.length > MAX_ENTRY_BYTES) return;
    localStorage.setItem(STORAGE_PREFIX + key, raw);
  } catch {
    // Quota exceeded / storage unavailable -- this cache is a nice-to-have
    // speed-up, never something the page should break over.
  }
}

/**
 * @param {string} cacheKey - Uniquely identifies this query AND its current
 *   params, e.g. `lowStockReport:${JSON.stringify(appliedFilters)}` -- so
 *   different filter combinations each get their own cached snapshot rather
 *   than clobbering one another.
 * @param {object} queryResult - The object returned by an RTK Query
 *   `use...Query(...)` hook (must include `data`, `isLoading`, `isSuccess`).
 */
export function useLocalCachedQuery(cacheKey, queryResult) {
  const { data, isSuccess, isLoading } = queryResult;
  const [cached, setCached] = useState(() => readCache(cacheKey));

  // Filters changed to a combination that has (or hasn't) been cached
  // before -- switch to THAT key's own snapshot rather than keep showing
  // the previous filter combination's data under the new filter's headers.
  useEffect(() => {
    setCached(readCache(cacheKey));
  }, [cacheKey]);

  // Every time the real query succeeds, refresh the cache -- this is the
  // "revalidate" half of stale-while-revalidate.
  useEffect(() => {
    if (isSuccess && data) {
      writeCache(cacheKey, data);
      setCached(data);
    }
  }, [cacheKey, data, isSuccess]);

  return {
    ...queryResult,
    data: data ?? cached ?? undefined,
    // Only the true first-ever load (nothing cached yet) should show a
    // loading state -- once there's cached data on screen, a background
    // refetch is silent, per the "Silent" behavior this was built for.
    isLoading: isLoading && !cached,
  };
}
