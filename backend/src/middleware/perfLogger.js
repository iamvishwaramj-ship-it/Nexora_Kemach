// Dev-only observability for the data-loading performance work (see
// docs/perf-baseline.md). Everything in this file is PURE OBSERVATION — it
// never rewrites a request, a response, or a query, and every piece is inert
// unless explicitly turned on, so requiring/mounting this file changes
// nothing about what any endpoint returns.
//
// Two independent pieces:
//
//   requestTiming   — Express middleware. Logs method, path, status, wall-
//                      clock duration and response payload size for every
//                      request that reaches it.
//   attachQueryLogger — subscribes to Prisma's 'query' event (only emitted
//                      when the client was constructed with that event
//                      enabled — see prisma/client.js) and logs each
//                      generated SQL statement's own duration.
//
// Both are gated on NODE_ENV !== 'production' PLUS their own opt-in flag, so
// a production deploy never pays for this (the checks below short-circuit
// before any timing/wrapping work happens) and a dev who isn't actively
// profiling can leave the flags off and see normal quiet logs.
//
//   PERF_LOG=1          turns request timing on in a non-production env.
//   PERF_LOG_QUERIES=1  turns Prisma per-query timing on (see client.js —
//                       this ALSO has to be set for the client to emit the
//                       'query' event at all; attachQueryLogger re-checks it
//                       here too so the two files can't drift out of sync).

const REQUEST_LOG_ENABLED = process.env.NODE_ENV !== 'production' && process.env.PERF_LOG === '1';
const QUERY_LOG_ENABLED = process.env.NODE_ENV !== 'production' && process.env.PERF_LOG_QUERIES === '1';

/**
 * Logs one line per request: `[perf] METHOD path status durationMs bytes`.
 *
 * `bytes` is measured by wrapping res.write/res.end to sum what the route
 * handler itself wrote — i.e. the JSON payload size BEFORE compression, not
 * the smaller gzipped size actually sent over the wire. That's deliberate:
 * the thing Phase 2 (projection) and Phase 3 (paging) are meant to shrink is
 * how much the server builds and serializes, and compression ratio would
 * otherwise mask exactly that number.
 */
function requestTiming(req, res, next) {
  if (!REQUEST_LOG_ENABLED) return next();

  const startedAt = process.hrtime.bigint();
  let bytes = 0;

  const origWrite = res.write.bind(res);
  const origEnd = res.end.bind(res);
  res.write = (chunk, ...rest) => {
    if (chunk) bytes += Buffer.byteLength(chunk);
    return origWrite(chunk, ...rest);
  };
  res.end = (chunk, ...rest) => {
    if (chunk) bytes += Buffer.byteLength(chunk);
    return origEnd(chunk, ...rest);
  };

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    // eslint-disable-next-line no-console
    console.log(`[perf] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms ${bytes}B`);
  });

  next();
}

/**
 * Subscribes to Prisma's query event, if this process's client was built
 * with it enabled (see prisma/client.js's PERF_LOG_QUERIES check). Safe to
 * call unconditionally at startup — a client built without the 'query'
 * event configured simply never fires it, so this is a no-op in that case.
 */
function attachQueryLogger(prismaClient) {
  if (!QUERY_LOG_ENABLED) return;
  prismaClient.$on('query', (e) => {
    const q = e.query.length > 300 ? `${e.query.slice(0, 300)}…` : e.query;
    // eslint-disable-next-line no-console
    console.log(`[perf:sql] ${e.duration}ms ${q}`);
  });
}

module.exports = { requestTiming, attachQueryLogger, REQUEST_LOG_ENABLED, QUERY_LOG_ENABLED };
