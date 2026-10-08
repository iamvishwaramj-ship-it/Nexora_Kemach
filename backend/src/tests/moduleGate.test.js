/**
 * Global Module Validation & Execution Gate tests — Settings > "Module
 * Settings" (isSalesEnabled / isPurchaseEnabled / isInventoryEnabled).
 *
 * Everything here runs against plain in-memory fakes, like
 * productUsage.test.js: assertModuleEnabled/isInventoryModuleEnabled are
 * pure decisions over a settings row, and postStockEntries's own inventory
 * gate is checked FIRST, before anything else it does — so a fake `tx`
 * that implements only `.systemSettings.findFirst()` is enough to prove the
 * bypass is real (any other delegate being called at all would throw).
 *
 * What a fake cannot check is that the schema/migration actually deliver
 * what utils/systemSettings.js assumes — covered by the last two tests,
 * the same style as productUsage.test.js's own schema-parity checks.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  SALES_DOCUMENT_TYPES,
  PURCHASE_DOCUMENT_TYPES,
  moduleForDocumentType,
  getSystemSettings,
  assertModuleEnabled,
  isInventoryModuleEnabled,
} = require('../utils/systemSettings');

const { TRANS_TYPES, postStockEntries } = require('../utils/stockTable');

// --- moduleForDocumentType / the two document-type lists -------------------

test('every Sales document type the spec names is gated as Sales', () => {
  for (const t of ['Sales Order', 'Delivery Challan', 'Sales Invoice', 'Sales Return', 'Sales Credit Memo']) {
    assert.strictEqual(moduleForDocumentType(t), 'sales', t);
    assert.ok(SALES_DOCUMENT_TYPES.includes(t), t);
  }
});

test('every Purchase document type the spec names is gated as Purchase', () => {
  for (const t of ['Purchase Order', 'Purchase GRN', 'Purchase Invoice', 'Purchase Return', 'Purchase Credit Memo']) {
    assert.strictEqual(moduleForDocumentType(t), 'purchase', t);
    assert.ok(PURCHASE_DOCUMENT_TYPES.includes(t), t);
  }
});

test('a document type outside both lists (e.g. a Quotation) is never gated', () => {
  assert.strictEqual(moduleForDocumentType('Sales Quotation'), null);
  assert.strictEqual(moduleForDocumentType('Purchase Quotation'), null);
  assert.strictEqual(moduleForDocumentType('Nonsense Document'), null);
});

// --- getSystemSettings ------------------------------------------------------

const settingsClient = (row) => ({ systemSettings: { findFirst: async () => row } });

test('no settings row yet reads as every module enabled', async () => {
  const settings = await getSystemSettings(settingsClient(null));
  assert.deepStrictEqual(settings, {
    isSalesEnabled: true, isPurchaseEnabled: true, isInventoryEnabled: true,
  });
});

test('an explicit false on the row is honoured, not defaulted away', async () => {
  const settings = await getSystemSettings(settingsClient({
    isSalesEnabled: false, isPurchaseEnabled: true, isInventoryEnabled: false,
  }));
  assert.strictEqual(settings.isSalesEnabled, false);
  assert.strictEqual(settings.isPurchaseEnabled, true);
  assert.strictEqual(settings.isInventoryEnabled, false);
});

// --- assertModuleEnabled: Module Access Gate --------------------------------

test('REGRESSION: Sales module disabled blocks every Sales document type', async () => {
  const client = settingsClient({ isSalesEnabled: false, isPurchaseEnabled: true, isInventoryEnabled: true });
  for (const docType of SALES_DOCUMENT_TYPES) {
    await assert.rejects(
      () => assertModuleEnabled(client, docType),
      (err) => {
        assert.strictEqual(err.status, 403);
        assert.strictEqual(err.message, 'Sales module is disabled.');
        return true;
      },
      docType
    );
  }
});

test('REGRESSION: Purchase module disabled blocks every Purchase document type', async () => {
  const client = settingsClient({ isSalesEnabled: true, isPurchaseEnabled: false, isInventoryEnabled: true });
  for (const docType of PURCHASE_DOCUMENT_TYPES) {
    await assert.rejects(
      () => assertModuleEnabled(client, docType),
      (err) => {
        assert.strictEqual(err.status, 403);
        assert.strictEqual(err.message, 'Purchase module is disabled.');
        return true;
      },
      docType
    );
  }
});

test('disabling Sales never blocks a Purchase document, and vice versa', async () => {
  const salesOff = settingsClient({ isSalesEnabled: false, isPurchaseEnabled: true, isInventoryEnabled: true });
  for (const docType of PURCHASE_DOCUMENT_TYPES) {
    await assertModuleEnabled(salesOff, docType); // must not throw
  }
  const purchaseOff = settingsClient({ isSalesEnabled: true, isPurchaseEnabled: false, isInventoryEnabled: true });
  for (const docType of SALES_DOCUMENT_TYPES) {
    await assertModuleEnabled(purchaseOff, docType); // must not throw
  }
});

test('an already-resolved settings object is accepted directly, without a second lookup', async () => {
  // moduleGate() in systemSettings.js and every route wiring pass a plain
  // Prisma client, but a caller that already has the settings (having just
  // called getSystemSettings itself) can hand that object straight back in
  // -- proven here by a client whose findFirst would throw if called again.
  const alreadyResolved = { isSalesEnabled: false, isPurchaseEnabled: true, isInventoryEnabled: true };
  await assert.rejects(() => assertModuleEnabled(alreadyResolved, 'Sales Invoice'));
  await assertModuleEnabled(alreadyResolved, 'Purchase Invoice'); // does not throw
});

test('a document type this feature does not gate is never blocked, whatever the settings say', async () => {
  const allOff = settingsClient({ isSalesEnabled: false, isPurchaseEnabled: false, isInventoryEnabled: false });
  await assertModuleEnabled(allOff, 'Sales Quotation');
  await assertModuleEnabled(allOff, 'Purchase Quotation');
});

// --- isInventoryModuleEnabled -----------------------------------------------

test('isInventoryModuleEnabled reflects the row, independent of Sales/Purchase', async () => {
  assert.strictEqual(
    await isInventoryModuleEnabled(settingsClient({ isSalesEnabled: false, isPurchaseEnabled: false, isInventoryEnabled: true })),
    true
  );
  assert.strictEqual(
    await isInventoryModuleEnabled(settingsClient({ isSalesEnabled: true, isPurchaseEnabled: true, isInventoryEnabled: false })),
    false
  );
  assert.strictEqual(await isInventoryModuleEnabled(settingsClient(null)), true, 'no row yet = enabled');
});

// --- REGRESSION matrix: all 8 combinations of the 3 toggles, across ---------
// --- Sales Invoice and Purchase Invoice specifically (the spec's own ask) --

test('REGRESSION: all 8 toggle combinations behave correctly for Sales Invoice / Purchase Invoice', async () => {
  for (const isSalesEnabled of [true, false]) {
    for (const isPurchaseEnabled of [true, false]) {
      for (const isInventoryEnabled of [true, false]) {
        const settings = { isSalesEnabled, isPurchaseEnabled, isInventoryEnabled };
        const client = settingsClient(settings);
        const label = JSON.stringify(settings);

        if (isSalesEnabled) {
          await assertModuleEnabled(client, 'Sales Invoice'); // does not throw
        } else {
          await assert.rejects(() => assertModuleEnabled(client, 'Sales Invoice'), /Sales module is disabled\./, label);
        }

        if (isPurchaseEnabled) {
          await assertModuleEnabled(client, 'Purchase Invoice'); // does not throw
        } else {
          await assert.rejects(() => assertModuleEnabled(client, 'Purchase Invoice'), /Purchase module is disabled\./, label);
        }

        // Inventory is independent of both Sales and Purchase being open —
        // a Sales Invoice can be raised (Sales enabled) while Inventory is
        // off, and it must still be possible to open/save it; only the
        // stock-quantity check and the ledger write (tested against
        // postStockEntries below) are what Inventory actually governs.
        assert.strictEqual(await isInventoryModuleEnabled(client), isInventoryEnabled, label);
      }
    }
  }
});

// --- postStockEntries: Inventory Posting & Validation Gate ------------------

/** A tx whose named delegates are fake and everything else throws if touched. */
function makeTx(overrides = {}) {
  const notImplemented = (name) => () => { throw new Error(`unexpected call: ${name}`); };
  return {
    systemSettings: { findFirst: notImplemented('systemSettings.findFirst') },
    stock: {
      findFirst: notImplemented('stock.findFirst'),
      findMany: notImplemented('stock.findMany'),
      createMany: notImplemented('stock.createMany'),
    },
    product: { findMany: notImplemented('product.findMany') },
    ...overrides,
  };
}

test('REGRESSION: Inventory disabled — postStockEntries writes nothing, for ANY document type or status', async () => {
  for (const transType of [TRANS_TYPES.SALES_INVOICE, TRANS_TYPES.PURCHASE_INVOICE, TRANS_TYPES.DELIVERY_CHALLAN]) {
    let stockTouched = false;
    const tx = makeTx({
      systemSettings: { findFirst: async () => ({ isInventoryEnabled: false }) },
      // If postStockEntries's inventory gate did not return immediately,
      // touching ANY of these would flip this flag — proving the bypass is
      // real, not just "happens to post nothing because of empty lines".
      stock: {
        findFirst: async () => { stockTouched = true; return null; },
        findMany: async () => { stockTouched = true; return []; },
        createMany: async () => { stockTouched = true; return { count: 0 }; },
      },
      product: { findMany: async () => { stockTouched = true; return []; } },
    });

    const result = await postStockEntries(tx, {
      transType, transNum: 1, status: 'Posted', warehouse: 'MAIN',
      lines: [{ productCode: 'P1', quantity: 10, unitPrice: 100, direction: 'out' }],
    });

    assert.deepStrictEqual(result, { posted: 0, skipped: 'inventory-disabled' });
    assert.strictEqual(stockTouched, false, `${transType}: no Stock/Product delegate should have been touched`);
  }
});

test('Inventory enabled — a Sales Invoice line posts a Stock row', async () => {
  const created = [];
  const tx = makeTx({
    systemSettings: { findFirst: async () => ({ isInventoryEnabled: true }) },
    stock: {
      findFirst: async () => null, // hasPostedAlready: not posted yet
      findMany: async () => [], // loadState: no costing history
      createMany: async ({ data }) => { created.push(...data); return { count: data.length }; },
    },
    product: {
      findMany: async () => [{ id: 1, productCode: 'P1', calculationMethod: null, inventoryItem: true }],
    },
  });

  const result = await postStockEntries(tx, {
    transType: TRANS_TYPES.SALES_INVOICE, transNum: 1, documentNumber: 'SI-0001', status: 'Posted', warehouse: 'MAIN',
    lines: [{ productCode: 'P1', quantity: 10, unitPrice: 100, direction: 'out' }],
  });

  assert.strictEqual(result.posted, 1);
  assert.strictEqual(created.length, 1);
  assert.strictEqual(created[0].outQty, 10);
  assert.strictEqual(created[0].inQty, 0);
});

test('Inventory enabled — a Purchase Invoice line posts a Stock row', async () => {
  const created = [];
  const tx = makeTx({
    systemSettings: { findFirst: async () => ({ isInventoryEnabled: true }) },
    stock: {
      findFirst: async () => null,
      findMany: async () => [],
      createMany: async ({ data }) => { created.push(...data); return { count: data.length }; },
    },
    product: {
      findMany: async () => [{ id: 2, productCode: 'P2', calculationMethod: null, inventoryItem: true }],
    },
  });

  const result = await postStockEntries(tx, {
    transType: TRANS_TYPES.PURCHASE_INVOICE, transNum: 2, documentNumber: 'PI-0001', status: 'Posted', warehouse: 'MAIN',
    lines: [{ productCode: 'P2', quantity: 5, unitPrice: 50, direction: 'in' }],
  });

  assert.strictEqual(result.posted, 1);
  assert.strictEqual(created.length, 1);
  assert.strictEqual(created[0].inQty, 5);
  assert.strictEqual(created[0].outQty, 0);
});

test('Inventory enabled — a non-inventory item still posts nothing (Product Master flag, not the module switch)', async () => {
  let createManyCalled = false;
  const tx = makeTx({
    systemSettings: { findFirst: async () => ({ isInventoryEnabled: true }) },
    stock: {
      findFirst: async () => null,
      findMany: async () => [],
      createMany: async ({ data }) => { createManyCalled = true; return { count: data.length }; },
    },
    product: {
      // Inventory Item = No — a labour/service line, priced like any other
      // item but with nothing in a warehouse to move.
      findMany: async () => [{ id: 3, productCode: 'SVC1', calculationMethod: null, inventoryItem: false }],
    },
  });

  const result = await postStockEntries(tx, {
    transType: TRANS_TYPES.SALES_INVOICE, transNum: 3, documentNumber: 'SI-0002', status: 'Posted', warehouse: 'MAIN',
    lines: [{ productCode: 'SVC1', quantity: 1, unitPrice: 500, direction: 'out' }],
  });

  assert.deepStrictEqual(result, { posted: 0, skipped: 'no-movement-lines' });
  assert.strictEqual(createManyCalled, false);
});

// --- the fake cannot catch a wrong table or column name; this can ----------

test('the system_settings table has the three toggle columns', () => {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'schema.prisma'), 'utf8');
  const model = schema.match(/^model SystemSettings \{([\s\S]*?)^\}/m);
  assert.ok(model, 'model SystemSettings not found');
  for (const [field, column] of [
    ['isSalesEnabled', 'is_sales_enabled'],
    ['isPurchaseEnabled', 'is_purchase_enabled'],
    ['isInventoryEnabled', 'is_inventory_enabled'],
  ]) {
    assert.match(model[1], new RegExp(`^\\s*${field}\\s+Boolean`, 'm'), `${field} declared`);
    assert.match(model[1], new RegExp(`@map\\("${column}"\\)`), `${field} maps to ${column}`);
  }

  const migration = fs.readFileSync(
    path.join(__dirname, '..', 'prisma', 'migrations', '20260923120000_add_system_settings', 'migration.sql'),
    'utf8'
  );
  for (const column of ['is_sales_enabled', 'is_purchase_enabled', 'is_inventory_enabled']) {
    assert.match(migration, new RegExp(`\\[${column}\\]\\s+BIT NOT NULL`), `${column} added`);
    assert.match(migration, new RegExp(`DF_system_settings_${column}\\] DEFAULT 1`), `${column} defaults enabled`);
  }
});

test('every gated route actually wires moduleGate() in, for each of the 10 document types', () => {
  const routesSrc = fs.readFileSync(path.join(__dirname, '..', 'routes', 'resources.js'), 'utf8');
  for (const docType of [...SALES_DOCUMENT_TYPES, ...PURCHASE_DOCUMENT_TYPES]) {
    const count = (routesSrc.match(new RegExp(`moduleGate\\('${docType}'\\)`, 'g')) || []).length;
    // create + update + delete + bulk-import = 4 wired routes per document type.
    assert.strictEqual(count, 4, `${docType}: expected 4 moduleGate() call sites, found ${count}`);
  }
});
