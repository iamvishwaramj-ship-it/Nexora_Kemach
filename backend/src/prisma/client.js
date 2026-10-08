const { PrismaClient } = require('@prisma/client');

// Singleton Prisma client — avoids exhausting DB connections on hot reload (nodemon)
const globalForPrisma = globalThis;

// Perf-profiling opt-in (Phase 0 of the data-loading performance work — see
// docs/perf-baseline.md / middleware/perfLogger.js). Off by default and
// never enabled in production regardless of the env var, so this can be
// left set in a dev .env without risk of it following a deploy. Adding the
// event-form log entry only makes Prisma EMIT a 'query' event — something
// still has to $on() it to see anything (see perfLogger.attachQueryLogger).
// It does not print anything by itself and does not change query results.
const logLevels = process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'];
if (process.env.NODE_ENV !== 'production' && process.env.PERF_LOG_QUERIES === '1') {
  logLevels.push({ emit: 'event', level: 'query' });
}

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: logLevels,
    // Prisma's defaults (maxWait: 2000ms, timeout: 5000ms) assume a low-latency
    // database and a short transaction. routes/resources.js's transactions
    // routinely make 3-6 round trips (resolveDocumentNumber's row-locking
    // UPDATE, the document create, syncBankReconciliationTxn's own lookups,
    // ...), and on a busier SQL Server instance — or one reached over the
    // network rather than locally — that adds up fast enough to eat the
    // default 5s budget under nothing worse than normal load. When it's
    // exceeded, Prisma closes the transaction out from under whatever query
    // was next in line — P2028 "Transaction already closed" — which surfaced
    // as an otherwise-ordinary POST failing with a 500 (see BankDeposit's
    // syncBankReconciliationTxn hitting this after 5.6s under the old Postgres
    // setup). Raised generously rather than tuned to one observed failure,
    // since the point is headroom against latency that varies run to run.
    transactionOptions: {
      maxWait: 10000,
      timeout: 20000,
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
