/**
 * What actually reaches the database on a write.
 *
 * Routes spread the request body straight into Prisma's `data`, so two things
 * have to be true at once and they pull in opposite directions:
 *
 *   - a client must not be able to set `id`, the audit timestamps, or any
 *     computed money column (that was the mass-assignment defect); and
 *   - every field the user legitimately types must still get through.
 *
 * Tightening the first broke the second once already: `amount` is a computed
 * total on every document except Cheque, where it is the face value written on
 * the cheque. Blanket-stripping it saved cheques with no amount at all and
 * raised bank reconciliation entries for nothing. This test pins both halves.
 *
 * The router is loaded against a recording Prisma stub, so these are the real
 * handlers with the real sanitisation in the path — no database needed.
 *
 * Run with:  node --test "src/tests/*.test.js"
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

// ---------------------------------------------------------------------------
// Recording Prisma stub
// ---------------------------------------------------------------------------

const writes = [];

function makeDelegate(model) {
  const record = (op) => async (args = {}) => {
    writes.push({ model, op, data: args.data, where: args.where });
    return { id: 1, ...(args.data || {}) };
  };
  return {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    count: async () => 0,
    aggregate: async () => ({ _sum: {}, _count: 0 }),
    groupBy: async () => [],
    create: record('create'),
    update: record('update'),
    upsert: record('upsert'),
    updateMany: async () => ({ count: 0 }),
    delete: async () => ({ id: 1 }),
    deleteMany: async () => ({ count: 0 }),
  };
}

/**
 * A configured financial year and numbering series, so document creation gets
 * past resolveDocumentNumber and reaches the write being tested. The values
 * mirror what Company Setup produces for a default series.
 */
const ACTIVE_FY = { id: 1, financialYearName: '2026-27', status: 'Active', startDate: new Date('2026-04-01'), endDate: new Date('2027-03-31') };

const DEFAULT_SERIES = {
  id: 1,
  seriesName: 'Default',
  isDefault: true,
  status: 'Active',
  financialYearId: 1,
  financialYear: ACTIVE_FY,
  fyCode: '26-27',
  prefix: 'DOC',
  suffix: null,
  separator: '-',
  includeFyInNumber: true,
  numberLength: 6,
  startNumber: 1,
  currentNumber: null,
  nextNumber: 1,
  endNumber: 999999,
  resetEveryFy: true,
  autoGenerate: true,
  manualEntry: false,
};

function makePrismaStub() {
  const cache = new Map();

  const numbering = {
    ...makeDelegate('documentNumbering'),
    findMany: async () => [{ ...DEFAULT_SERIES }],
    findFirst: async () => ({ ...DEFAULT_SERIES }),
    findUnique: async () => ({ ...DEFAULT_SERIES }),
  };
  const financialYear = {
    ...makeDelegate('financialYear'),
    findMany: async () => [{ ...ACTIVE_FY }],
    findFirst: async () => ({ ...ACTIVE_FY }),
    findUnique: async () => ({ ...ACTIVE_FY }),
  };
  // The company's registered state drives the CGST/SGST vs IGST decision.
  const companyDetails = {
    ...makeDelegate('companyDetails'),
    findFirst: async () => ({ id: 1, state: 'Tamil Nadu' }),
  };

  // Master records the postings reference. Without these, assertMasterExists
  // correctly refuses every document — which is the right behaviour, but it
  // is not what these tests are measuring.
  const customer = {
    ...makeDelegate('customer'),
    findFirst: async ({ where }) =>
      (where?.customerName === 'Acme Traders'
        ? { id: 1, customerName: 'Acme Traders', creditLimit: null, status: 'Active' }
        : null),
  };
  const supplier = {
    ...makeDelegate('supplier'),
    findFirst: async ({ where }) =>
      (where?.supplierName === 'Global Supplies'
        ? { id: 1, supplierName: 'Global Supplies', status: 'Active' }
        : null),
  };
  const product = {
    ...makeDelegate('product'),
    findMany: async () => [{ productCode: 'P1', costPrice: 42.5 }],
    findFirst: async () => ({ id: 1, productCode: 'P1', costPrice: 42.5 }),
  };

  cache.set('documentNumbering', numbering);
  cache.set('financialYear', financialYear);
  cache.set('companyDetails', companyDetails);
  cache.set('customer', customer);
  cache.set('supplier', supplier);
  cache.set('product', product);

  const stub = new Proxy(
    {
      $transaction: async (arg) => (typeof arg === 'function' ? arg(stub) : Promise.all(arg)),
      // The allocator burns a number with a conditional UPDATE ... RETURNING.
      $queryRaw: async () => [{ id: 1, currentNumber: 1, nextNumber: 2 }],
      $executeRaw: async () => 0,
    },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (typeof prop !== 'string') return undefined;
        if (!cache.has(prop)) cache.set(prop, makeDelegate(prop));
        return cache.get(prop);
      },
    }
  );
  return stub;
}

function loadRouter() {
  const clientPath = require.resolve(path.join(__dirname, '..', 'prisma', 'client'));
  const routerPath = path.join(__dirname, '..', 'routes', 'resources.js');
  const originalLoad = Module._load;

  require.cache[clientPath] = {
    id: clientPath, filename: clientPath, loaded: true, exports: makePrismaStub(),
  };
  Module._load = function patched(request, parent, isMain) {
    if (request === '@prisma/client') {
      return { Prisma: { PrismaClientKnownRequestError: class extends Error {} } };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    delete require.cache[require.resolve(routerPath)];
    return require(routerPath);
  } finally {
    Module._load = originalLoad;
    delete require.cache[clientPath];
  }
}

/** Find the handler registered for a method+path on the router. */
function handlerFor(router, method, routePath) {
  for (const layer of router.stack || []) {
    if (!layer.route) continue;
    if (layer.route.path !== routePath) continue;
    if (!layer.route.methods[method.toLowerCase()]) continue;
    return layer.route.stack[layer.route.stack.length - 1].handle;
  }
  throw new Error(`no handler for ${method} ${routePath}`);
}

/**
 * Invoke a handler and return everything it wrote.
 *
 * Completion is taken from the handler's own promise (asyncHandler returns it)
 * *and* from res.json being called, whichever happens first — a handler that
 * responds and one that hands an error to next() both have to settle this.
 */
async function post(router, method, routePath, body) {
  writes.length = 0;
  const handler = handlerFor(router, method, routePath);
  const req = { params: { id: '1' }, query: {}, body, headers: {}, user: { id: 1, role: 'admin' } };

  let responded;
  const sent = new Promise((resolve) => { responded = resolve; });
  const res = {
    statusCode: 200,
    status(c) { this.statusCode = c; return this; },
    json(payload) { this.payload = payload; responded(); return this; },
  };

  await new Promise((resolve, reject) => {
    const next = (e) => (e ? reject(e) : resolve());
    Promise.resolve(handler(req, res, next))
      .then(() => sent.then(resolve))
      .catch(reject);
  });

  return writes.slice();
}

/** Flatten the router into method/path/handlers entries. */
function collectRoutes(r, prefix = '') {
  const found = [];
  for (const layer of r.stack || []) {
    if (layer.route) {
      for (const [method, on] of Object.entries(layer.route.methods)) {
        if (!on) continue;
        found.push({
          method: method.toUpperCase(),
          path: prefix + layer.route.path,
          handlers: layer.route.stack.map((x) => x.handle),
        });
      }
    } else if (layer.handle?.stack) {
      found.push(...collectRoutes(layer.handle, prefix));
    }
  }
  return found;
}

let router;
test.before(() => { router = loadRouter(); });

// ---------------------------------------------------------------------------
// The user's own input must survive
// ---------------------------------------------------------------------------

test('REGRESSION: a cheque keeps the face value the user typed', async () => {
  const written = await post(router, 'post', '/banking/cheques', {
    chequeNo: 'CHQ-1',
    bankAccount: 'HDFC — 0001',
    payTo: 'Global Supplies',
    amount: 45000,
    narration: 'Against PI-77',
    status: 'Printed',
    invoiceApplications: [],
  });

  const cheque = written.find((w) => w.model === 'cheque' && w.op === 'create');
  assert.ok(cheque, 'no cheque was written');
  assert.equal(cheque.data.amount, 45000, 'the cheque saved without its amount');
  assert.equal(cheque.data.payTo, 'Global Supplies');
  assert.equal(cheque.data.narration, 'Against PI-77');
});

test('REGRESSION: editing a cheque keeps its amount too', async () => {
  const written = await post(router, 'put', '/banking/cheques/:id', {
    chequeNo: 'CHQ-1',
    payTo: 'Global Supplies',
    amount: 51000,
    invoiceApplications: [],
  });
  const cheque = written.find((w) => w.model === 'cheque' && w.op === 'update');
  assert.ok(cheque, 'no cheque update was written');
  assert.equal(cheque.data.amount, 51000);
});

test('ordinary header fields are passed through untouched', async () => {
  const written = await post(router, 'post', '/sales/invoices', {
    invoiceNo: 'SI-1',
    customer: 'Acme Traders',
    salesPerson: 'R. Kumar',
    placeOfSupply: 'Tamil Nadu',
    termsConditions: 'Net 30',
    remarks: 'urgent',
    status: 'Posted',
    items: [{ productCode: 'P1', quantity: 2, unitPrice: 100, taxPercent: 18 }],
  });
  const invoice = written.find((w) => w.model === 'salesInvoice' && w.op === 'create');
  assert.equal(invoice.data.customer, 'Acme Traders');
  assert.equal(invoice.data.salesPerson, 'R. Kumar');
  assert.equal(invoice.data.remarks, 'urgent');
  assert.equal(invoice.data.termsConditions, 'Net 30');
});

// ---------------------------------------------------------------------------
// Injected and forged fields must not
// ---------------------------------------------------------------------------

test('REGRESSION: a client cannot set the primary key or forge audit stamps', async () => {
  const written = await post(router, 'post', '/sales/invoices', {
    id: 9999,
    createdAt: '2001-01-01T00:00:00Z',
    updatedAt: '2001-01-01T00:00:00Z',
    invoiceNo: 'SI-1',
    customer: 'Acme Traders',
    items: [{ productCode: 'P1', quantity: 1, unitPrice: 100, taxPercent: 18 }],
  });
  const invoice = written.find((w) => w.model === 'salesInvoice' && w.op === 'create');
  assert.equal(invoice.data.id, undefined, 'a client set the primary key');
  assert.equal(invoice.data.createdAt, undefined, 'a client forged createdAt');
  assert.equal(invoice.data.updatedAt, undefined, 'a client forged updatedAt');
});

test('REGRESSION: a tampered client cannot dictate the invoice total', async () => {
  // The line is worth 118.00 gross. The client claims the invoice is worth 1.
  const written = await post(router, 'post', '/sales/invoices', {
    invoiceNo: 'SI-1',
    customer: 'Acme Traders',
    subtotal: 1,
    taxableAmount: 1,
    cgstAmount: 0,
    sgstAmount: 0,
    amount: 1,
    items: [{ productCode: 'P1', quantity: 1, unitPrice: 100, taxPercent: 18 }],
  });
  const invoice = written.find((w) => w.model === 'salesInvoice' && w.op === 'create');
  assert.equal(invoice.data.subtotal, 100, 'subtotal came from the client, not the lines');
  assert.equal(invoice.data.amount, 118, 'grand total came from the client, not the lines');
  assert.equal(invoice.data.cgstAmount, 9);
  assert.equal(invoice.data.sgstAmount, 9);
});

test('the header a document writes contains every money column it needs', async () => {
  const written = await post(router, 'post', '/purchase/grn', {
    grnNo: 'GRN-1',
    supplier: 'Global Supplies',
    items: [{ productCode: 'P1', poQuantity: 10, receivedQuantity: 10, unitPrice: 50, taxPercent: 5 }],
  });
  const grn = written.find((w) => w.model === 'goodsReceivedNote' && w.op === 'create');
  for (const field of ['subtotal', 'taxableAmount', 'cgstAmount', 'sgstAmount', 'igstAmount', 'roundOff', 'amount', 'totalItems']) {
    assert.notEqual(grn.data[field], undefined, `GRN header is missing ${field}`);
  }
  assert.equal(grn.data.subtotal, 500);
  assert.equal(grn.data.amount, 525, '5% tax, not the old hard-coded 18%');
  assert.equal(grn.data.totalItems, 1);
});

test('REGRESSION: an over-receipt is refused before anything is written', async () => {
  await assert.rejects(
    () =>
      post(router, 'post', '/purchase/grn', {
        grnNo: 'GRN-1',
        supplier: 'Global Supplies',
        items: [{ productCode: 'P1', poQuantity: 10, receivedQuantity: 15, unitPrice: 50 }],
      }),
    /exceeds the ordered quantity/
  );
  assert.equal(writes.length, 0, 'nothing should have been written');
});

// ---------------------------------------------------------------------------
// Round 3: cheque settlement, credit control, cost stamping, roles
// ---------------------------------------------------------------------------

test('REGRESSION: a cheque records what it applies to each invoice', async () => {
  const written = await post(router, 'post', '/banking/cheques', {
    chequeNo: 'CHQ-1',
    bankAccount: 'HDFC — 0001',
    supplierName: 'Global Supplies',
    payTo: 'Global Supplies',
    amount: 5000,
    status: 'Pending',
    invoiceApplications: [{ invoiceNo: 'PI-1', amountToPay: 3000 }],
  });
  const cheque = written.find((w) => w.model === 'cheque' && w.op === 'create');
  assert.equal(cheque.data.totalAppliedAmount, 3000, 'the applied total must be stored, not left at zero');
  assert.equal(cheque.data.amount, 5000);
});

test('a Pending cheque settles nothing — it has not been issued yet', async () => {
  const written = await post(router, 'post', '/banking/cheques', {
    chequeNo: 'CHQ-1', bankAccount: 'HDFC', supplierName: 'Global Supplies',
    amount: 5000, status: 'Pending',
    invoiceApplications: [{ invoiceNo: 'PI-1', amountToPay: 3000 }],
  });
  const settled = written.filter((w) => w.model === 'supplierOutstanding' && w.op === 'update');
  assert.equal(settled.length, 0, 'a draft instrument must not clear a debt');
});

test('a sales invoice stamps the cost price on every line', async () => {
  const written = await post(router, 'post', '/sales/invoices', {
    invoiceNo: 'SI-1',
    customer: 'Acme Traders',
    items: [{ productCode: 'P1', quantity: 2, unitPrice: 100, taxPercent: 18 }],
  });
  const invoice = written.find((w) => w.model === 'salesInvoice' && w.op === 'create');
  const line = invoice.data.items.create[0];
  assert.equal(line.costPrice, 42.5, 'cost was not stamped — margin would drift with the master');
});

test('deleting a document requires the admin role', () => {
  // auth() is curried with the allowed roles, so the guard sits in the
  // handler chain rather than inside the handler body. Assert it is present
  // on the destructive routes and absent from the read ones.
  const destructive = collectRoutes(router).filter((r) => r.method === 'DELETE');
  assert.ok(destructive.length > 10, `expected many delete routes, found ${destructive.length}`);

  for (const route of destructive) {
    const rejected = [];
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(p) { rejected.push({ code: this.statusCode, body: p }); return this; },
    };
    // A non-admin token must be turned away before the handler runs.
    const req = {
      params: { id: '1' }, query: {}, body: {}, headers: {},
      user: { id: 2, email: 'clerk@example.com', role: 'user' },
    };
    for (const handler of route.handlers.slice(0, -1)) {
      handler(req, res, () => {});
    }
    const denied = rejected.some((r) => r.code === 403 || r.code === 401);
    assert.ok(denied, `${route.method} ${route.path} let a non-admin through`);
  }
});

test('REGRESSION: a negative deposit line is refused by the API', async () => {
  // The form blocks the minus key and the Zod schema rejects it, but neither
  // protects the API — and the deposit total feeds the Cash Book, Bank Book
  // and Day Book, so a negative line posted directly would quietly understate
  // the bank position rather than failing visibly.
  await assert.rejects(
    () =>
      post(router, 'post', '/banking/deposits', {
        depositNo: 'DEP-1',
        depositTo: 'HDFC — 0001',
        status: 'Posted',
        items: [
          { paymentMode: 'Cash', amount: 5000 },
          { paymentMode: 'Cheque', amount: -2000 },
        ],
      }),
    /deposit amount cannot be negative — line 2 \(-2000\.00\)/
  );
  assert.equal(writes.length, 0, 'nothing should have been written');
});

test('editing a deposit is guarded too, not just creating one', async () => {
  await assert.rejects(
    () =>
      post(router, 'put', '/banking/deposits/:id', {
        depositNo: 'DEP-1',
        items: [{ paymentMode: 'Cash', amount: -1 }],
      }),
    /cannot be negative/
  );
});

test('a zero deposit line is allowed, and the total is rounded to paise', async () => {
  const written = await post(router, 'post', '/banking/deposits', {
    depositNo: 'DEP-1',
    depositTo: 'HDFC — 0001',
    status: 'Posted',
    items: [
      { paymentMode: 'Cash', amount: 0 },
      { paymentMode: 'Cheque', amount: 1234.567 },
      { paymentMode: 'UPI', amount: 0.004 },
    ],
  });
  const deposit = written.find((w) => w.model === 'bankDeposit' && w.op === 'create');
  assert.equal(deposit.data.totalDepositAmount, 1234.57, 'total must land on a paisa boundary');
  assert.deepEqual(
    deposit.data.items.create.map((i) => i.amount),
    [0, 1234.57, 0],
    'each line is rounded before it is stored'
  );
});

test('REGRESSION: a cheque records its party, so the ownership check can fire', async () => {
  // The Cheque Print form captures the payee as payTo and has no supplier
  // field, so supplierName arrived null and the ledger's "does this invoice
  // belong to the party paying" guard silently did nothing.
  const written = await post(router, 'post', '/banking/cheques', {
    chequeNo: 'CHQ-1',
    bankAccount: 'HDFC',
    payTo: 'Global Supplies',
    amount: 5000,
    status: 'Pending',
    invoiceApplications: [],
  });
  const cheque = written.find((w) => w.model === 'cheque' && w.op === 'create');
  assert.equal(cheque.data.supplierName, 'Global Supplies', 'the party must be stored, not left null');
});

test('an explicit supplierName wins over the payee name', async () => {
  const written = await post(router, 'post', '/banking/cheques', {
    chequeNo: 'CHQ-1', bankAccount: 'HDFC',
    payTo: 'Global Supplies (Mumbai branch)', supplierName: 'Global Supplies',
    amount: 100, status: 'Pending', invoiceApplications: [],
  });
  const cheque = written.find((w) => w.model === 'cheque' && w.op === 'create');
  assert.equal(cheque.data.supplierName, 'Global Supplies');
});

test('editing a cheque keeps its party too', async () => {
  const written = await post(router, 'put', '/banking/cheques/:id', {
    chequeNo: 'CHQ-1', payTo: 'Global Supplies', amount: 100, invoiceApplications: [],
  });
  const cheque = written.find((w) => w.model === 'cheque' && w.op === 'update');
  assert.equal(cheque.data.supplierName, 'Global Supplies');
});
