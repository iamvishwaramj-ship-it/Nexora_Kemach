/**
 * Non-inventory line behavior — Product Master's Inventory Item flag.
 *
 * A product can be `salesItem`/`purchaseItem` true while `inventoryItem` is
 * false: still selectable and usable on its allowed document, but the line
 * must not move the stock ledger and must not be sized against on-hand
 * quantity (see attachInventoryItemFlag in routes/resources.js and the
 * rules matrix in the task this implements).
 *
 * These tests exercise the two exported, DB-independent functions that carry
 * that rule — postStockEntries (utils/stockTable.js) and
 * assertNoOverConsumption (utils/documentFlow.js) — against small in-memory
 * stand-ins for the Prisma delegates they call, the same "fake db" idiom
 * productUsage.test.js and routeWiring.test.js already use, so nothing here
 * needs a real database.
 *
 * What this file does NOT cover: a full Sales Invoice / Purchase GRN save
 * through the actual Express route (assertNoNegativeStock,
 * assertNoNegativeWarehouseStockFor and attachInventoryItemFlag itself all
 * live un-exported inside routes/resources.js). That level of coverage
 * belongs in the SQL-Server-backed integration harness the rest of this
 * suite uses for real document saves (testDb.js / DATABASE_URL_TEST) —
 * out of reach for a fake-db unit test, since it needs the actual routing,
 * numbering and GL side effects to agree with each other. The static check
 * at the bottom of this file at least guards the *wiring* (that every
 * relevant route still calls attachInventoryItemFlag before its guards and
 * postings run) so that coverage gap fails loudly if it regresses.
 *
 * Run with:  node --test "src/tests/*.test.js"
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  postStockEntries,
  grnLines,
  purchaseInvoiceLines,
  salesInvoiceLines,
  issueLines,
  TRANS_TYPES,
} = require('../utils/stockTable');
const { assertNoOverConsumption } = require('../utils/documentFlow');

// --- fakes ------------------------------------------------------------------

/** Minimal stand-in for `tx.stock` — enough of Prisma's shape for postStockEntries. */
function makeStockDelegate() {
  const rows = [];
  let nextLogEntry = 1;
  return {
    rows,
    findFirst: async ({ where }) => rows.find(
      (r) => Object.entries(where).every(([k, v]) => r[k] === v)
    ) || null,
    findMany: async ({ where }) => rows.filter(
      (r) => Object.entries(where).every(([k, v]) => r[k] === v)
    ),
    createMany: async ({ data }) => {
      for (const row of data) rows.push({ logEntry: nextLogEntry++, ...row });
      return { count: data.length };
    },
  };
}

/** Minimal stand-in for `tx.product` — just resolveItemIds' own findMany. */
function makeProductDelegate(products) {
  return {
    findMany: async ({ where }) => {
      const codes = where?.productCode?.in || [];
      return products.filter((p) => codes.includes(p.productCode));
    },
  };
}

function makeTx(products) {
  return { stock: makeStockDelegate(), product: makeProductDelegate(products) };
}

/** Equality-with-operators matcher, just enough for assertNoOverConsumption's own where clauses. */
function matchesWhere(row, where) {
  return Object.entries(where || {}).every(([key, cond]) => {
    if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
      if ('notIn' in cond) return !cond.notIn.includes(row[key]);
      if ('not' in cond) return row[key] !== cond.not;
    }
    return row[key] === cond;
  });
}

/** Stand-in for a document model (goodsReceivedNote, purchaseReturn, ...) — findFirst/findMany only. */
function makeDocModel(rows) {
  return {
    findFirst: async ({ where }) => rows.find((r) => matchesWhere(r, where)) || null,
    findMany: async ({ where }) => rows.filter((r) => matchesWhere(r, where)),
  };
}

// --- postStockEntries: Sales Invoice (direct) -------------------------------

test('a non-inventory sales line posts no Stock row, however far past on-hand its quantity goes', async () => {
  const tx = makeTx([{ id: 1, productCode: 'SVC-1', calculationMethod: null }]);
  const result = await postStockEntries(tx, {
    transType: TRANS_TYPES.SALES_INVOICE,
    transNum: 501,
    documentNumber: 'SI-0501',
    status: 'Posted',
    warehouse: 'MAIN',
    lines: salesInvoiceLines([
      // Ten thousand units of a service line that has no warehouse stock at
      // all — this must save clean, never a stock-related failure.
      { productCode: 'SVC-1', productName: 'Installation Service', quantity: 10000, unitPrice: 500, inventoryItem: false },
    ]),
  });
  assert.equal(result.posted, 0);
  assert.equal(result.skipped, 'no-movement-lines');
  assert.equal(tx.stock.rows.length, 0, 'no Stock row for the non-inventory line');
});

test('an inventory sales line in the SAME invoice still posts, alongside a non-inventory line that does not', async () => {
  const tx = makeTx([
    { id: 1, productCode: 'GOOD-1', calculationMethod: null },
    { id: 2, productCode: 'SVC-1', calculationMethod: null },
  ]);
  const result = await postStockEntries(tx, {
    transType: TRANS_TYPES.SALES_INVOICE,
    transNum: 502,
    documentNumber: 'SI-0502',
    status: 'Posted',
    warehouse: 'MAIN',
    lines: salesInvoiceLines([
      { productCode: 'GOOD-1', productName: 'Widget', quantity: 5, unitPrice: 100, inventoryItem: true },
      { productCode: 'SVC-1', productName: 'Installation Service', quantity: 3, unitPrice: 500, inventoryItem: false },
    ]),
  });
  assert.equal(result.posted, 1, 'only the inventory line posts');
  assert.equal(tx.stock.rows.length, 1);
  assert.equal(tx.stock.rows[0].itemCode, 'GOOD-1');
  assert.equal(tx.stock.rows[0].outQty, 5);
});

// --- postStockEntries: Purchase GRN / direct Purchase Invoice ---------------

test('a non-inventory GRN line adds no stock (no Stock row) alongside an inventory line that still receives', async () => {
  const tx = makeTx([
    { id: 1, productCode: 'GOOD-2', calculationMethod: null },
    { id: 2, productCode: 'FREIGHT-1', calculationMethod: null },
  ]);
  const result = await postStockEntries(tx, {
    transType: TRANS_TYPES.PURCHASE_GRN,
    transNum: 601,
    documentNumber: 'GRN-0601',
    status: 'Received',
    warehouse: 'MAIN',
    lines: grnLines([
      { productCode: 'GOOD-2', productName: 'Raw Material', receivedQuantity: 20, unitPrice: 50, inventoryItem: true },
      { productCode: 'FREIGHT-1', productName: 'Freight Charge', receivedQuantity: 1, unitPrice: 2000, inventoryItem: false },
    ]),
  });
  assert.equal(result.posted, 1);
  assert.equal(tx.stock.rows.length, 1);
  assert.equal(tx.stock.rows[0].itemCode, 'GOOD-2');
  assert.equal(tx.stock.rows[0].inQty, 20);
});

test('a non-inventory direct Purchase Invoice line adds no stock', async () => {
  const tx = makeTx([{ id: 1, productCode: 'FREIGHT-2', calculationMethod: null }]);
  const result = await postStockEntries(tx, {
    transType: TRANS_TYPES.PURCHASE_INVOICE,
    transNum: 701,
    documentNumber: 'PI-0701',
    status: 'Posted',
    warehouse: 'MAIN',
    lines: purchaseInvoiceLines([
      { productCode: 'FREIGHT-2', productName: 'Service Charge', quantity: 1, unitPrice: 999, inventoryItem: false },
    ]),
  });
  assert.equal(result.posted, 0);
  assert.equal(tx.stock.rows.length, 0);
});

// --- postStockEntries: a line with no flag attached keeps today's behavior --

test('a line with no inventoryItem flag attached still posts (defaults to tracked, not skipped)', async () => {
  const tx = makeTx([{ id: 1, productCode: 'GOOD-3', calculationMethod: null }]);
  const result = await postStockEntries(tx, {
    transType: TRANS_TYPES.STOCK_ISSUE,
    transNum: 801,
    documentNumber: 'SIG-0801',
    status: 'Posted',
    warehouse: 'MAIN',
    lines: issueLines([{ productCode: 'GOOD-3', quantity: 2 }]), // no inventoryItem key at all
  });
  assert.equal(result.posted, 1, 'absent flag must not be read as non-inventory');
  assert.equal(tx.stock.rows.length, 1);
});

// --- assertNoOverConsumption: Purchase/Sales Return & Credit Memo -----------

test('a non-inventory return line is never checked against the source document, however large its quantity', async () => {
  const sourceModel = makeDocModel([{ grnNo: 'GRN-1', items: [{ productCode: 'FREIGHT-3', receivedQuantity: 1 }] }]);
  const consumerModel = makeDocModel([]);
  // Returning 999 of something the GRN only received 1 of would fail this
  // check for a tracked product — must not even be evaluated here.
  await assertNoOverConsumption({}, {
    sourceModel,
    sourceDocField: 'grnNo',
    sourceDocNo: 'GRN-1',
    sourceQuantityField: 'receivedQuantity',
    consumerModel,
    consumerDocField: 'grnNo',
    consumerQuantityField: 'returnQuantity',
    consumerDocNoField: 'returnNo',
    items: [{ productCode: 'FREIGHT-3', returnQuantity: 999, inventoryItem: false }],
    label: 'return',
  });
  // No throw = pass.
});

test('an inventory return line is still capped at what the source document has left (no regression)', async () => {
  const sourceModel = makeDocModel([{ grnNo: 'GRN-2', items: [{ productCode: 'GOOD-4', receivedQuantity: 5 }] }]);
  const consumerModel = makeDocModel([]);
  await assert.rejects(
    () => assertNoOverConsumption({}, {
      sourceModel,
      sourceDocField: 'grnNo',
      sourceDocNo: 'GRN-2',
      sourceQuantityField: 'receivedQuantity',
      consumerModel,
      consumerDocField: 'grnNo',
      consumerQuantityField: 'returnQuantity',
      consumerDocNoField: 'returnNo',
      items: [{ productCode: 'GOOD-4', returnQuantity: 999, inventoryItem: true }],
      label: 'return',
    }),
    (err) => {
      assert.equal(err.status, 400);
      assert.match(err.message, /exceeds what is available/);
      return true;
    }
  );
});

test('mixed lines on one credit memo: only the inventory line is checked', async () => {
  const sourceModel = makeDocModel([{
    invoiceNo: 'SI-9', items: [
      { productCode: 'GOOD-5', quantity: 5 },
      { productCode: 'SVC-2', quantity: 1 },
    ],
  }]);
  const consumerModel = makeDocModel([]);
  await assert.rejects(
    () => assertNoOverConsumption({}, {
      sourceModel,
      sourceDocField: 'invoiceNo',
      sourceDocNo: 'SI-9',
      sourceQuantityField: 'quantity',
      consumerModel,
      consumerDocField: 'invoiceNo',
      consumerQuantityField: 'quantity',
      consumerDocNoField: 'creditNo',
      items: [
        { productCode: 'GOOD-5', quantity: 50, inventoryItem: true }, // over the billed 5 — should reject
        { productCode: 'SVC-2', quantity: 500, inventoryItem: false }, // over the billed 1 — must be ignored
      ],
      label: 'credit',
    }),
    (err) => {
      assert.match(err.message, /GOOD-5/);
      assert.doesNotMatch(err.message, /SVC-2/, 'the non-inventory line must not even be named as offending');
      return true;
    }
  );
});

// --- wiring regression: the routes actually call attachInventoryItemFlag ---

test('every stock-moving/quantity-guarded route still attaches the inventoryItem flag before using it', () => {
  // A full route-level save can't be exercised here without the SQL-Server
  // integration harness (see this file's header comment), so this is the
  // static backstop: if a future edit strips the attachInventoryItemFlag
  // call out of one of these routes, the line builders and guards silently
  // fall back to "every line is tracked" (attachInventoryItemFlag ??'s to
  // true) rather than failing loudly — this test is what catches that.
  const resourcesSrc = fs.readFileSync(
    path.join(__dirname, '..', 'routes', 'resources.js'), 'utf8'
  );

  assert.match(
    resourcesSrc,
    /async function attachInventoryItemFlag\(tx, itemData\)/,
    'attachInventoryItemFlag helper must exist'
  );

  const callSites = resourcesSrc.match(/await attachInventoryItemFlag\(tx, itemData\);/g) || [];
  // GRN, Purchase Return, Purchase Credit Memo, Purchase Invoice, Delivery
  // Challan, Sales Order, Sales Invoice, Sales Credit Memo, Sales Return,
  // Stock Issue, Stock Adjustment — create + update each.
  assert.ok(
    callSites.length >= 22,
    `expected attachInventoryItemFlag to be wired into at least 22 create/update handlers, found ${callSites.length}`
  );
});

test('postStockEntries (utils/stockTable.js) still filters non-inventory lines out of what it posts', () => {
  const stockTableSrc = fs.readFileSync(
    path.join(__dirname, '..', 'utils', 'stockTable.js'), 'utf8'
  );
  assert.match(
    stockTableSrc,
    /l\.inventoryItem !== false/,
    'postStockEntries must exclude inventoryItem === false lines from `movements`'
  );
});

// --- Sales Type / Sales Return Type "Claims"/"Services" — whole-document ----
// override, distinct from the per-product inventoryItem flag above. See
// applyNonStockSalesCategory in routes/resources.js: when a document's own
// header.salesCategory is Claims or Services, EVERY line is force-treated as
// non-inventory for stock posting/guards — regardless of what each line's
// own product would otherwise say — because that whole document never
// touches physical stock (a warranty claim being billed, a service charge).
// The Warehouse field is hidden entirely on the page for those categories
// (see isNonStockCategory in SalesInvoice.jsx/SalesOrder.jsx/
// DeliveryChallan.jsx/SalesReturn.jsx/SalesCreditMemo.jsx) and its
// required-ness is dropped in salesSchemas.js (requireWarehouseUnlessNonStockCategory).

test('a Claims-category direct Sales Invoice posts no Stock row for any line, even a normally-tracked product', () => {
  // applyNonStockSalesCategory mutates itemData in place (same mechanism as
  // attachInventoryItemFlag) before postStockEntries ever sees it, so
  // simulating its effect here — every line stamped inventoryItem: false
  // because the DOCUMENT is Claims/Services, not because any one product is
  // — is the faithful way to exercise this without a live Express route.
  const tx = makeTx([{ id: 1, productCode: 'GOOD-6', calculationMethod: null }]);
  return postStockEntries(tx, {
    transType: TRANS_TYPES.SALES_INVOICE,
    transNum: 901,
    documentNumber: 'SI-0901',
    status: 'Posted',
    warehouse: 'MAIN',
    lines: salesInvoiceLines([
      // GOOD-6 is an ordinary tracked product (inventoryItem defaults true at
      // the Product Master) — only forced false here because the document's
      // own salesCategory is Claims/Services.
      { productCode: 'GOOD-6', productName: 'Spare Part', quantity: 4, unitPrice: 250, inventoryItem: false },
    ]),
  }).then((result) => {
    assert.equal(result.posted, 0);
    assert.equal(tx.stock.rows.length, 0, 'a Claims/Services invoice must never post stock, however trackable the product');
  });
});

test('a Claims-category Sales Return line is never checked against the source challan, even for an ordinarily-tracked product', async () => {
  const sourceModel = makeDocModel([{ challanNo: 'DC-1', items: [{ productCode: 'GOOD-7', quantity: 1 }] }]);
  const consumerModel = makeDocModel([]);
  // Returning 999 against a challan that only despatched 1 would fail for a
  // tracked product — must not even be evaluated once the whole document is
  // Claims/Services.
  await assertNoOverConsumption({}, {
    sourceModel,
    sourceDocField: 'challanNo',
    sourceDocNo: 'DC-1',
    sourceQuantityField: 'quantity',
    consumerModel,
    consumerDocField: 'challanNo',
    consumerQuantityField: 'returnQuantity',
    consumerDocNoField: 'returnNo',
    items: [{ productCode: 'GOOD-7', returnQuantity: 999, inventoryItem: false }],
    label: 'return',
  });
  // No throw = pass.
});

test('applyNonStockSalesCategory is wired into both create and update for every in-scope sales document', () => {
  const resourcesSrc = fs.readFileSync(
    path.join(__dirname, '..', 'routes', 'resources.js'), 'utf8'
  );

  assert.match(
    resourcesSrc,
    /const NON_STOCK_SALES_CATEGORIES = new Set\(\['Claims', 'Services'\]\);/,
    'NON_STOCK_SALES_CATEGORIES must exist and name exactly Claims and Services'
  );
  assert.match(
    resourcesSrc,
    /function applyNonStockSalesCategory\(header, itemData\)/,
    'applyNonStockSalesCategory helper must exist'
  );

  const callSites = resourcesSrc.match(/applyNonStockSalesCategory\(header, itemData\);/g) || [];
  // Sales Order, Delivery Challan, Sales Invoice, Sales Return, Sales Credit
  // Memo — create + update each. Purchase-side documents and GRN/Stock
  // Issue/Stock Adjustment have no salesCategory at all and are out of scope.
  assert.equal(
    callSites.length, 10,
    `expected applyNonStockSalesCategory wired into exactly 10 create/update handlers (5 documents x 2), found ${callSites.length}`
  );

  // The backend mirror of the client-side warehouse-required carve-out
  // (requireWarehouseUnlessNonStockCategory in salesSchemas.js) — a direct
  // Claims/Services Sales Invoice must not be blocked on Save for a
  // Warehouse the page no longer even shows. Extracted per-function (rather
  // than one long regex over the whole function body) so a harmless reflow
  // of an unrelated comment inside either function can't spuriously fail
  // this test.
  const assertInvoiceWarehouseSrc = resourcesSrc.slice(
    resourcesSrc.indexOf('function assertInvoiceWarehouse('),
    resourcesSrc.indexOf('function assertInvoiceLineWarehouses(')
  );
  assert.match(
    assertInvoiceWarehouseSrc,
    /NON_STOCK_SALES_CATEGORIES\.has\(header\.salesCategory\)/,
    'assertInvoiceWarehouse must skip its check for a Claims/Services invoice'
  );

  const assertInvoiceLineWarehousesSrc = resourcesSrc.slice(
    resourcesSrc.indexOf('function assertInvoiceLineWarehouses('),
    resourcesSrc.indexOf('function assertInvoiceLineWarehouses(') + 800
  );
  assert.match(
    assertInvoiceLineWarehousesSrc,
    /NON_STOCK_SALES_CATEGORIES\.has\(salesCategory\)/,
    'assertInvoiceLineWarehouses must skip its per-line check for a Claims/Services invoice'
  );
});

// --- Claims/Services: frontend wiring regression ----------------------------
// Static backstop for the client side of the same feature — the schema
// carve-out (salesSchemas.js) and the per-page Warehouse-hiding (the 5
// in-scope sales pages) can't be exercised without a browser/bundler, so this
// checks the source text agrees with what the backend now enforces, the same
// "static wiring test" idiom the rest of this file uses above.

const FRONTEND_SRC = path.join(__dirname, '..', '..', '..', 'frontend', 'src');

test('salesSchemas.js: the per-line Warehouse requirement is skipped for Claims/Services on every in-scope document', () => {
  const commonSrc = fs.readFileSync(path.join(FRONTEND_SRC, 'lib', 'validation', 'common.js'), 'utf8');
  assert.match(
    commonSrc,
    /export const NON_STOCK_SALES_CATEGORIES = \['Claims', 'Services'\];/,
    'common.js must export NON_STOCK_SALES_CATEGORIES naming exactly Claims and Services'
  );
  assert.match(
    commonSrc,
    /export const requireWarehouseUnlessNonStockCategory = /,
    'common.js must export requireWarehouseUnlessNonStockCategory'
  );

  const salesSchemasSrc = fs.readFileSync(path.join(FRONTEND_SRC, 'lib', 'validation', 'salesSchemas.js'), 'utf8');

  // Sales Order, Delivery Challan, Sales Credit Memo, Sales Return: the
  // per-line item schema's own warehouse field must be optionalString() (not
  // requiredString), with requireWarehouseUnlessNonStockCategory on the
  // parent document schema actually enforcing it outside Claims/Services.
  const itemSchemaNames = [
    'salesOrderItemSchema', 'deliveryChallanItemSchema', 'salesCreditMemoItemSchema', 'salesReturnItemSchema',
  ];
  for (const name of itemSchemaNames) {
    const start = salesSchemasSrc.indexOf(`${name} = z.object({`);
    assert.ok(start !== -1, `${name} not found`);
    const body = salesSchemasSrc.slice(start, salesSchemasSrc.indexOf('\n});', start));
    assert.match(
      body,
      /warehouse: optionalString\(\),/,
      `${name}.warehouse must be optionalString() — required-ness now comes from requireWarehouseUnlessNonStockCategory`
    );
  }
  // salesQuotationItemSchema is explicitly OUT of scope (Sales Quotation was
  // not one of the 5 documents this override applies to) and must still
  // require its own Warehouse unconditionally.
  const quotationStart = salesSchemasSrc.indexOf('salesQuotationItemSchema = z.object({');
  const quotationBody = salesSchemasSrc.slice(quotationStart, salesSchemasSrc.indexOf('\n});', quotationStart));
  assert.match(
    quotationBody,
    /warehouse: requiredString\('Warehouse'\),/,
    'salesQuotationItemSchema.warehouse must remain required — Sales Quotation is out of scope for this override'
  );

  const requireCallSites = salesSchemasSrc.match(/requireWarehouseUnlessNonStockCategory\(\)\(data, ctx\);/g) || [];
  assert.equal(
    requireCallSites.length, 4,
    `expected requireWarehouseUnlessNonStockCategory wired into exactly 4 document schemas' superRefine, found ${requireCallSites.length}`
  );

  // Sales Invoice has its own bespoke pair of superRefine blocks (the
  // isDirectInvoice-gated header + per-line warehouse checks) rather than
  // the shared helper — both must also carve out Claims/Services.
  const isNonStockCallSites = salesSchemasSrc.match(/isNonStockSalesCategory\(val\.salesCategory\)/g) || [];
  assert.equal(
    isNonStockCallSites.length, 2,
    `expected isNonStockSalesCategory guarding both of salesInvoiceSchema's own warehouse superRefine blocks, found ${isNonStockCallSites.length}`
  );
});

test('the 5 in-scope sales pages hide the per-line Warehouse field entirely for Claims/Services', () => {
  const pages = [
    'pages/sales/SalesOrder.jsx',
    'pages/sales/DeliveryChallan.jsx',
    'pages/sales/SalesInvoice.jsx',
    'pages/sales/SalesReturn.jsx',
    'pages/sales/SalesCreditMemo.jsx',
  ];
  for (const page of pages) {
    const src = fs.readFileSync(path.join(FRONTEND_SRC, page), 'utf8');
    assert.match(
      src,
      /import \{ isNonStockSalesCategory \} from '..\/..\/lib\/validation\/common';/,
      `${page}: must import isNonStockSalesCategory`
    );
    assert.match(
      src,
      /const isNonStockCategory = isNonStockSalesCategory\(salesCategoryValue\);/,
      `${page}: must compute isNonStockCategory from the document's own salesCategory`
    );
    // Every remaining WarehouseCodeSelect in the item table must be
    // conditioned on !isNonStockCategory somewhere in the JSX shortly before
    // it (either wrapping it directly, or wrapping the <TableCell> it sits
    // in on the desktop table view) — a stray unconditional one would mean
    // the field is still shown (and still bindable) on a Claims/Services
    // document even though the schema no longer requires it.
    const selectIndices = [...src.matchAll(/<WarehouseCodeSelect/g)].map((m) => m.index);
    assert.ok(selectIndices.length > 0, `${page}: expected at least one <WarehouseCodeSelect`);
    for (const idx of selectIndices) {
      const preceding = src.slice(Math.max(0, idx - 200), idx);
      assert.match(
        preceding,
        /!isNonStockCategory/,
        `${page}: a <WarehouseCodeSelect at offset ${idx} is not guarded by !isNonStockCategory within the preceding 200 chars`
      );
    }
  }
});
