const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
require('dotenv').config();

const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { permissionGuard } = require('./middleware/permission');
const { requestTiming } = require('./middleware/perfLogger');

const app = express();

// CORS whitelist — allow Vite dev server + any FRONTEND_URL set in .env
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3101',
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(helmet());
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(compression());
// Perf-profiling opt-in (Phase 0 of the data-loading performance work — see
// docs/perf-baseline.md). Mounted AFTER compression so the byte count it
// logs is the pre-gzip payload size the route actually built — the number
// Phase 2 (projection) and Phase 3 (paging) are meant to shrink — rather
// than the smaller, compression-ratio-dependent size sent over the wire.
// A no-op unless PERF_LOG=1 is set outside production; see perfLogger.js.
app.use(requestTiming);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
// Body limit raised from body-parser's 100 KB default. A correctness fix, not
// a performance one: a real document — 100-odd line items each carrying its
// own nested batch/serial allocation array — genuinely exceeds 100 KB, and the
// failure mode was a bare 413 from the parser before any route saw the
// request, which reads as a mystery save failure rather than "too large".
//
// Raised again, 5mb -> 15mb, for BP Opening Balance's own bulk import
// (Company Setup > BP Opening Balance > Import Lines / Save): a real
// 20,000-line import sits close enough to the old 5mb ceiling that it
// deserves real headroom, not a limit tuned to a smaller size actually
// observed to fail.
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Menu-permission enforcement for every mutating request under /api. Mounted
// here, ahead of the module routers, so one map governs all of them instead of
// each route re-deriving its own rule (and forgetting to). Reads and unmapped
// paths fall straight through — see middleware/permission.js.
app.use('/api', permissionGuard());

// --- Prisma-backed modules ---
app.use('/api/health', require('./routes/health'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/company', require('./routes/company'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/profile', require('./routes/profile'));
// User accounts + their menu-based permission grid — ahead of the generic
// resources router below so this bespoke handling of /api/users (password
// hashing, nested permissions writes) is what actually answers it.
app.use('/api/users', require('./routes/users'));
// Notification bell feature — scoped to req.user.id, ahead of the generic
// resources router for the same reason /api/users is (bespoke handling,
// not the generic CRUD shape).
app.use('/api/notifications', require('./routes/notifications'));
// Production Planning > Forecast — bespoke compute/aggregate endpoints
// (real Sales Invoice history + statistical projection), not the generic
// CRUD shape. See routes/productionPlanning.js and
// services/forecastPlanService.js.
app.use('/api/production-planning', require('./routes/productionPlanning'));
// Every other resource (products, customers, suppliers, purchase, sales,
// inventory, receivables, payables, banking) shares the generic CRUD shape
// and is mounted in one place — see routes/resources.js.
app.use('/api', require('./routes/resources'));

app.use(notFoundHandler);
app.use(errorHandler);

// Exposed so server.js can hand the same allow-list to Socket.io
// (utils/socket.js) — one CORS config for both the REST API and the
// notification-push websocket, instead of maintaining it twice.
app.corsOptions = corsOptions;

module.exports = app;
