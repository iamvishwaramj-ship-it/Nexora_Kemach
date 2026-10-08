/**
 * Product flow-flag tests — Sales Item / Purchase Item / Inventory Item.
 *
 * Runs against an in-memory stand-in for the Prisma client, like
 * routeMap.test.js: everything under test is counting rows behind plain
 * equality filters, so a fake implementing `count` over arrays exercises the
 * real code path without needing SQL Server.
 *
 * What a fake cannot check is that the delegate and column names match the
 * schema — a typo like `c.salesReturnItems` would count zero forever and every
 * lock would silently fail open. That is covered by the last test, which
 * asserts every model and field this module names is declared in
 * schema.prisma.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  getProductUsage,
  validateProductUsageFlags,
  assertProductUsageUnchanged,
  PRODUCT_USAGE_MAP,
} = require('../utils/businessRules');

const testAsync = test;

// --- the fake -------------------------------------------------------------

/** Every table the usage map can reach, each backed by an array of rows. */
function makeDb(data = {}) {
  const table = (rows) => ({
    count: async ({ where }) => rows.filter(
      (r) => Object.entries(where).every(([f, v]) => r[f] === v)
    ).length,
  });
  const db = {};
  for (const spec of Object.values(PRODUCT_USAGE_MAP)) {
    for (const ref of spec.references) {
      // Recover the delegate's property name by handing the accessor a proxy
      // that records what it was asked for — so the fake stays in step with
      // the map automatically instead of repeating its 18 table names here.
      const name = ref.delegate(new Proxy({}, { get: (_, prop) => prop }));
      db[name] = table(data[name] || []);
    }
  }
  return db;
}

const PRODUCT = 'P10001';

// --- getProductUsage ------------------------------------------------------

testAsync('a product on no document is used nowhere and locks nothing', async () => {
  const usage = await getProductUsage(makeDb(), PRODUCT);
  for (const flag of Object.keys(PRODUCT_USAGE_MAP)) {
    assert.strictEqual(usage[flag].used, false, flag);
    assert.strictEqual(usage[flag].count, 0, flag);
  }
});

testAsync('usage is reported per flow, not lumped together', async () => {
  const usage = await getProductUsage(makeDb({
    salesOrderItem: [{ productCode: PRODUCT }, { productCode: PRODUCT }],
    salesInvoiceItem: [{ productCode: PRODUCT }],
    purchaseOrderItem: [{ productCode: 'OTHER' }],
  }), PRODUCT);

  assert.strictEqual(usage.salesItem.used, true);
  assert.strictEqual(usage.salesItem.count, 3, 'two order lines and one invoice line');
  assert.deepStrictEqual(
    usage.salesItem.detail,
    [{ label: 'sales order', count: 2 }, { label: 'sales invoice', count: 1 }]
  );
  // A different product's purchase order must not lock THIS product.
  assert.strictEqual(usage.purchaseItem.used, false);
  assert.strictEqual(usage.inventoryItem.used, false);
});

testAsync('the newer document types count too', async () => {
  // REGRESSION: REFERENCE_MAP.product (which governs deletion) predates these
  // tables and never listed them. A product used only on a sales return was
  // therefore invisible to it — and would have been to this, had the usage map
  // been copied from it rather than written out in full.
  for (const [table, flag] of [
    ['salesQuotationItem', 'salesItem'],
    ['salesReturnItem', 'salesItem'],
    ['salesCreditMemoItem', 'salesItem'],
    ['purchaseQuotationItem', 'purchaseItem'],
    ['purchaseReturnItem', 'purchaseItem'],
    ['purchaseCreditMemoItem', 'purchaseItem'],
    ['stockTransferItem', 'inventoryItem'],
  ]) {
    const usage = await getProductUsage(makeDb({ [table]: [{ productCode: PRODUCT }] }), PRODUCT);
    assert.strictEqual(usage[flag].used, true, `${table} should lock ${flag}`);
  }
});

testAsync('stock on hand locks Inventory Item, not just stock documents', async () => {
  // A product the warehouse physically holds cannot be declared a
  // non-inventory item. Both of these key the product by `itemCode`, not
  // `productCode` — the reason the usage map carries a per-reference `field`.
  const fromOpening = await getProductUsage(
    makeDb({ openingBalance: [{ itemCode: PRODUCT }] }), PRODUCT
  );
  assert.strictEqual(fromOpening.inventoryItem.used, true, 'opening balance');

  const fromLedger = await getProductUsage(
    makeDb({ stock: [{ itemCode: PRODUCT }] }), PRODUCT
  );
  assert.strictEqual(fromLedger.inventoryItem.used, true, 'stock ledger');
});

testAsync('a product being created is used nowhere', async () => {
  const usage = await getProductUsage(makeDb({ salesOrderItem: [{ productCode: PRODUCT }] }), '');
  assert.strictEqual(usage.salesItem.used, false, 'no code means nothing to be used by');
});

// --- assertProductUsageUnchanged ------------------------------------------

testAsync('REGRESSION: a flag backed by documents cannot be turned off', async () => {
  const db = makeDb({ purchaseOrderItem: [{ productCode: PRODUCT }] });
  await assert.rejects(
    () => assertProductUsageUnchanged(db, PRODUCT, { purchaseItem: false }),
    (err) => {
      assert.strictEqual(err.status, 409);
      assert.strictEqual(err.code, 'PRODUCT_USAGE_IN_USE');
      assert.match(err.message, /Purchase Item/);
      assert.match(err.message, /1 purchase order/, 'says what is holding it');
      return true;
    }
  );
});

testAsync('turning a flag ON is always allowed', async () => {
  const db = makeDb({ purchaseOrderItem: [{ productCode: PRODUCT }] });
  // Adding a flow contradicts nothing that has already happened.
  await assertProductUsageUnchanged(db, PRODUCT, { salesItem: true, inventoryItem: true });
});

testAsync('an unused flag can be turned off freely', async () => {
  const db = makeDb({ purchaseOrderItem: [{ productCode: PRODUCT }] });
  await assertProductUsageUnchanged(db, PRODUCT, { salesItem: false });
});

testAsync('a save that touches no flag is not blocked', async () => {
  const db = makeDb({ salesOrderItem: [{ productCode: PRODUCT }] });
  await assertProductUsageUnchanged(db, PRODUCT, { productName: 'Renamed', costPrice: 5 });
});

testAsync('cancelled and draft documents lock the flag too', async () => {
  // Status is deliberately not filtered: a cancelled document is still
  // readable history, and the product is still on it.
  const db = makeDb({ salesInvoiceItem: [{ productCode: PRODUCT, status: 'Cancelled' }] });
  await assert.rejects(() => assertProductUsageUnchanged(db, PRODUCT, { salesItem: false }));
});

testAsync('every blocked flag is named, not just the first', async () => {
  const db = makeDb({
    salesOrderItem: [{ productCode: PRODUCT }],
    stockIssueItem: [{ productCode: PRODUCT }],
  });
  await assert.rejects(
    () => assertProductUsageUnchanged(db, PRODUCT, { salesItem: false, inventoryItem: false }),
    (err) => {
      assert.match(err.message, /Sales Item/);
      assert.match(err.message, /Inventory Item/);
      return true;
    }
  );
});

// --- validateProductUsageFlags --------------------------------------------

const delegateReturning = (row) => ({ findUnique: async () => row });

testAsync('REGRESSION: all three unticked is refused', async () => {
  await assert.rejects(
    () => validateProductUsageFlags({
      data: { salesItem: false, purchaseItem: false, inventoryItem: false },
      id: null,
      delegate: delegateReturning(null),
    }),
    (err) => {
      assert.strictEqual(err.status, 400);
      assert.strictEqual(err.code, 'PRODUCT_USAGE_NONE');
      return true;
    }
  );
});

testAsync('any one of the three is enough', async () => {
  for (const flag of Object.keys(PRODUCT_USAGE_MAP)) {
    const data = { salesItem: false, purchaseItem: false, inventoryItem: false, [flag]: true };
    await validateProductUsageFlags({ data, id: null, delegate: delegateReturning(null) });
  }
});

testAsync('a request that never mentions the flags is left alone', async () => {
  // The seed scripts and anything written before these columns existed send no
  // flags at all; the database defaults (all true) apply. Reading "absent" as
  // "unticked" would break every one of those callers.
  await validateProductUsageFlags({
    data: { productName: 'Widget' }, id: null, delegate: delegateReturning(null),
  });
});

testAsync('a partial update is judged on what the product ENDS UP as', async () => {
  const stored = { salesItem: true, purchaseItem: true, inventoryItem: true };

  // Unticking one of three leaves two — fine, even though the payload alone
  // carries nothing that is true.
  await validateProductUsageFlags({
    data: { salesItem: false }, id: 1, delegate: delegateReturning(stored),
  });

  // Unticking the last remaining one is not.
  await assert.rejects(() => validateProductUsageFlags({
    data: { inventoryItem: false },
    id: 1,
    delegate: delegateReturning({ salesItem: false, purchaseItem: false, inventoryItem: true }),
  }));
});

// --- the fake cannot catch a wrong table or column name; this can ----------

test('every model and column the usage map names exists in schema.prisma', () => {
  const schema = fs.readFileSync(
    path.join(__dirname, '..', 'prisma', 'schema.prisma'), 'utf8'
  );

  // Prisma exposes each model as a camelCased property, so map the schema's
  // PascalCase model names the same way to compare.
  const models = {};
  for (const m of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    models[m[1][0].toLowerCase() + m[1].slice(1)] = m[2];
  }

  for (const [flag, spec] of Object.entries(PRODUCT_USAGE_MAP)) {
    for (const ref of spec.references) {
      const name = ref.delegate(new Proxy({}, { get: (_, prop) => prop }));
      assert.ok(models[name], `${flag}: model for prisma.${name} not found in schema.prisma`);
      const field = ref.field || 'productCode';
      assert.match(
        models[name],
        new RegExp(`^\\s*${field}\\s`, 'm'),
        `${flag}: prisma.${name} has no field "${field}"`
      );
    }
  }
});

test('the products table has the three flag columns', () => {
  const schema = fs.readFileSync(
    path.join(__dirname, '..', 'prisma', 'schema.prisma'), 'utf8'
  );
  const product = schema.match(/^model Product \{([\s\S]*?)^\}/m);
  assert.ok(product, 'model Product not found');
  for (const [field, column] of [
    ['salesItem', 'sales_item'],
    ['purchaseItem', 'purchase_item'],
    ['inventoryItem', 'inventory_item'],
  ]) {
    assert.match(product[1], new RegExp(`^\\s*${field}\\s+Boolean`, 'm'), `${field} declared`);
    assert.match(product[1], new RegExp(`@map\\("${column}"\\)`), `${field} maps to ${column}`);
  }

  // The migration has to create what the schema promises, or a fresh database
  // and a migrated one disagree.
  const migration = fs.readFileSync(
    path.join(
      __dirname, '..', 'prisma', 'migrations',
      '20260822140000_add_product_usage_flags', 'migration.sql'
    ),
    'utf8'
  );
  for (const column of ['sales_item', 'purchase_item', 'inventory_item']) {
    assert.match(migration, new RegExp(`ADD \\[${column}\\] BIT NOT NULL`), `${column} added`);
    assert.match(migration, new RegExp(`DF_products_${column}\\] DEFAULT 1`), `${column} defaults true`);
  }
});
