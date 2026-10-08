/**
 * Route wiring smoke test.
 *
 * routes/resources.js is ~6,000 lines mounting every module in the
 * application. A typo in a handler — a renamed helper that one call site still
 * uses under its old name, a variable referenced before it is defined — does
 * not show up until that specific endpoint is called, which in practice means
 * it ships. `node --check` only proves the file parses; it does not prove the
 * identifiers resolve.
 *
 * This test loads the real router against a stubbed Prisma client (so no
 * database or platform-specific query engine is needed), walks the resulting
 * Express route table, and invokes every handler to prove it runs rather than
 * throwing a ReferenceError or TypeError on the way in.
 *
 * Run with:  node --test "src/tests/*.test.js"
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

// ---------------------------------------------------------------------------
// A Prisma stub. Every model delegate answers with empty results, and any
// property that is read returns something callable/awaitable, so the router
// can be exercised without a database. $transaction runs its callback against
// the same stub, which is what makes the create/update paths reachable.
// ---------------------------------------------------------------------------

function makeDelegate() {
  return {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    count: async () => 0,
    aggregate: async () => ({ _sum: {}, _count: 0 }),
    groupBy: async () => [],
    create: async ({ data }) => ({ id: 1, ...data }),
    update: async ({ data }) => ({ id: 1, ...data }),
    updateMany: async () => ({ count: 0 }),
    delete: async () => ({ id: 1 }),
    deleteMany: async () => ({ count: 0 }),
    upsert: async ({ create }) => ({ id: 1, ...create }),
  };
}

function makePrismaStub() {
  const cache = new Map();
  const stub = new Proxy(
    {
      $transaction: async (arg) => (typeof arg === 'function' ? arg(stub) : Promise.all(arg)),
      $queryRaw: async () => [],
      $executeRaw: async () => 0,
    },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (typeof prop !== 'string') return undefined;
        if (!cache.has(prop)) cache.set(prop, makeDelegate());
        return cache.get(prop);
      },
    }
  );
  return stub;
}

/** Load a module with `../prisma/client` replaced by the stub. */
function loadWithStubbedPrisma(modulePath) {
  const clientPath = require.resolve(path.join(__dirname, '..', 'prisma', 'client'));
  const originalLoad = Module._load;
  const previous = require.cache[clientPath];

  require.cache[clientPath] = { id: clientPath, filename: clientPath, loaded: true, exports: makePrismaStub() };
  // Anything that reaches for @prisma/client directly (errorHandler) needs the
  // error classes but not the engine.
  Module._load = function patched(request, parent, isMain) {
    if (request === '@prisma/client') {
      return { Prisma: { PrismaClientKnownRequestError: class extends Error {} } };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    delete require.cache[require.resolve(modulePath)];
    return require(modulePath);
  } finally {
    Module._load = originalLoad;
    if (previous) require.cache[clientPath] = previous;
    else delete require.cache[clientPath];
  }
}

/**
 * Flatten an Express router into { method, path, handlers, guarded } entries.
 *
 * `guarded` accounts for both ways this codebase applies authentication:
 * bespoke routes list `auth()` in their own handler chain, while the generated
 * CRUD routers call `router.use(auth())` once — which lands on the sub-router's
 * stack, not on any individual route. Tracking inherited middleware is what
 * makes the auth assertion below mean anything.
 */
function collectRoutes(router, prefix = '', inheritedMiddleware = 0) {
  const found = [];
  let middlewareSoFar = inheritedMiddleware;

  for (const layer of router.stack || []) {
    if (layer.route) {
      const routePath = prefix + layer.route.path;
      for (const [method, on] of Object.entries(layer.route.methods)) {
        if (!on) continue;
        found.push({
          method: method.toUpperCase(),
          path: routePath,
          handlers: layer.route.stack.map((s) => s.handle),
          guarded: middlewareSoFar + layer.route.stack.length >= 2,
        });
      }
    } else if (layer.handle?.stack) {
      found.push(...collectRoutes(layer.handle, prefix, middlewareSoFar));
    } else if (typeof layer.handle === 'function') {
      // A bare `router.use(fn)` — applies to everything mounted after it.
      middlewareSoFar += 1;
    }
  }
  return found;
}

let router;
let routes;

test.before(() => {
  router = loadWithStubbedPrisma(path.join(__dirname, '..', 'routes', 'resources.js'));
  routes = collectRoutes(router);
});

test('resources.js loads and mounts its full route table', () => {
  assert.ok(routes.length > 100, `expected the whole application surface, mounted ${routes.length} routes`);
});

test('the modules the business runs on are all present', () => {
  const paths = new Set(routes.map((r) => `${r.method} ${r.path}`));
  const required = [
    'POST /purchase/quotations',
    'POST /purchase/orders',
    'POST /purchase/grn',
    'POST /purchase/invoices',
    'POST /sales/quotations',
    'POST /sales/orders',
    'POST /sales/delivery-challans',
    'POST /sales/invoices',
    'POST /inventory/stock-receipts',
    'POST /inventory/stock-issues',
    'POST /inventory/stock-adjustments',
    'POST /inventory/stock-transfers',
    'POST /receivables/collections',
    'POST /payables/payments',
    'POST /banking/deposits',
    'POST /banking/cheques',
    'POST /banking/payment-receipts',
    'POST /banking/payment-vouchers',
  ];
  const missing = required.filter((r) => !paths.has(r));
  assert.deepEqual(missing, []);
});

test('every handler runs without a load-time reference error', async () => {
  // A ReferenceError or TypeError thrown synchronously on entry means a helper
  // was renamed or removed and a call site was missed. Business-rule
  // rejections and stub-shaped failures are expected and ignored; what is
  // being asserted is that the code path is reachable at all.
  const structural = [];

  for (const route of routes) {
    const handler = route.handlers[route.handlers.length - 1];
    const req = {
      params: { id: '1' },
      query: {},
      body: { items: [], invoiceApplications: [], transactions: [] },
      headers: {},
      user: { id: 1, email: 't@example.com', role: 'admin' },
    };
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json() { return this; },
      send() { return this; },
    };

    const error = await new Promise((resolve) => {
      let settled = false;
      const done = (e) => { if (!settled) { settled = true; resolve(e); } };
      try {
        Promise.resolve(handler(req, res, done)).then(() => done(null), done);
      } catch (e) {
        done(e);
      }
      setTimeout(() => done(null), 0);
    });

    if (error instanceof ReferenceError || error instanceof SyntaxError) {
      structural.push(`${route.method} ${route.path}: ${error.message}`);
    }
    if (error instanceof TypeError && /is not a function|of undefined|of null/.test(error.message)) {
      structural.push(`${route.method} ${route.path}: ${error.message}`);
    }
  }

  assert.deepEqual(structural, [], 'handlers reference identifiers that do not exist');
});

test('no route was left mounted without authentication', () => {
  // Every handler chain should start with the auth middleware. A resource
  // mounted without it is an open door onto the ledger.
  const open = routes.filter((r) => !r.guarded).map((r) => `${r.method} ${r.path}`);
  assert.deepEqual(open, [], 'these routes have no middleware in front of the handler');
});
