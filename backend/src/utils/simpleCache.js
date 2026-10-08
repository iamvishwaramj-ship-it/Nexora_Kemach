// Tiny in-process TTL cache for expensive, read-only aggregation endpoints
// (report pages that run several DB queries just to answer "what does this
// look like right now"). Deliberately NOT a distributed cache like Redis --
// this app runs as a single Node process per deployment, so a plain
// in-memory Map is enough, and it disappears automatically on every
// restart/deploy, which is exactly the safe default for anything derived
// from live transactional data (nothing here can outlive a stale value
// across a deploy the way a persistent cache could).
//
// What this buys: several tabs or several users asking for the same report
// with the same filters within the same `ttlMs` window get ONE real
// aggregation run between them, not one each -- see the Low Stock Report's
// use of it in routes/resources.js for the concrete case this was built
// for (client-side polling multiplying database load).
const store = new Map();

function makeKey(namespace, params) {
  // Sorted so { a: 1, b: 2 } and { b: 2, a: 1 } hash the same -- callers
  // pass req.query-shaped objects straight through, and Express doesn't
  // guarantee key order matches how the client happened to build the URL.
  const sorted = Object.keys(params || {}).sort().reduce((acc, k) => {
    acc[k] = params[k];
    return acc;
  }, {});
  return `${namespace}:${JSON.stringify(sorted)}`;
}

/**
 * @param {string} namespace - Usually the route path, so different
 *   endpoints' entries can never collide even if their param shapes
 *   happen to match.
 * @param {object} params - The request's own filter params. Reusing
 *   them as the cache key means there's no separate key-building logic
 *   to keep in sync with what actually scopes the report.
 * @param {number} ttlMs - How long a cached result stays valid.
 * @param {() => Promise<any>} compute - Only called on a cache miss or
 *   expiry; its resolved value is what gets cached and returned.
 * @returns {Promise<any>}
 */
async function withCache(namespace, params, ttlMs, compute) {
  const key = makeKey(namespace, params);
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  // An in-flight computation for this exact key (several near-simultaneous
  // requests, e.g. multiple tabs polling at once) is shared rather than
  // each triggering its own compute() -- otherwise a burst of requests
  // arriving before the first one finishes would all miss and all
  // recompute, defeating the point of the cache.
  if (hit && hit.promise) return hit.promise;

  const promise = compute()
    .then((value) => {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .catch((err) => {
      store.delete(key); // never cache a failure
      throw err;
    });
  store.set(key, { ...(hit || {}), promise });
  return promise;
}

// Drops every cached entry under a namespace -- for a route that wants to
// invalidate its cache immediately after a mutation that could affect it,
// rather than waiting out the TTL. Not wired to any call sites yet.
function invalidate(namespace) {
  for (const key of store.keys()) {
    if (key.startsWith(`${namespace}:`)) store.delete(key);
  }
}

module.exports = { withCache, invalidate };
