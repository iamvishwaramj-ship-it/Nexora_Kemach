const app = require('./app');
const prisma = require('./prisma/client');
const socket = require('./utils/socket');
const { attachQueryLogger } = require('./middleware/perfLogger');

const PORT = process.env.PORT || 5000;

// Perf-profiling opt-in (Phase 0 of the data-loading performance work — see
// docs/perf-baseline.md). No-op unless PERF_LOG_QUERIES=1 is set outside
// production (see prisma/client.js and middleware/perfLogger.js) — this
// call is unconditional so enabling/disabling the feature is a single env
// var flip, never a code change.
attachQueryLogger(prisma);

const server = app.listen(PORT, () => console.log(`Nexora KEMACH API running on http://localhost:${PORT}`));

// Notification bell feature — real-time push over the same HTTP server/port
// the REST API already listens on, reusing app.js's CORS allow-list. See
// utils/socket.js for the JWT + Active-user handshake auth, per-user room
// routing and the single-instance / optional Redis adapter note.
socket.init(server, { corsOptions: app.corsOptions });

// Without this, every nodemon restart (and every Ctrl+C) leaves the old
// process's SQL Server connections open — on a low connection-limit plan
// that adds up fast across a dev session and eventually exhausts the pool.
// Release the Prisma connection pool before the process actually exits.
async function shutdown(signal) {
  console.log(`\n${signal} received: closing server and releasing DB connections...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // Fallback in case something hangs (e.g. a request never finishes).
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
// nodemon sends SIGUSR2 on restart in some configurations — handle it too.
process.once('SIGUSR2', async () => {
  await prisma.$disconnect();
  process.kill(process.pid, 'SIGUSR2');
});

