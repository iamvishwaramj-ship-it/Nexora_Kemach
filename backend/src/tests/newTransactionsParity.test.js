/**
 * Field-name parity for the three transaction screens that lineFieldParity.js
 * did not cover: Stock Transfer, Payment Receipt and Payment Voucher.
 *
 * Same defect class lineFieldParity.test.js guards against on Sales/Purchase
 * Return and Credit Memo — a form input bound to a name the zod schema, the
 * server's mapper, or the database column does not share. A missing key on a
 * plain object is `undefined`, not a build error, so nothing catches this
 * without actually comparing the layers' names against each other.
 *
 * These three were added in the same batch as the four lineFieldParity.js
 * already covers but were never brought under the same check — this file
 * closes that gap.
 *
 * Static checks over the source text, no browser/bundler/database required.
 *
 * Run with:  node --test "src/tests/*.test.js"
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..', '..', '..');
const FRONTEND = path.join(REPO, 'frontend', 'src');
const SCHEMA_PRISMA = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const RESOURCES = path.join(__dirname, '..', 'routes', 'resources.js');

const read = (p) => fs.readFileSync(p, 'utf8');
const prismaSrc = read(SCHEMA_PRISMA);
const resourcesSrc = read(RESOURCES);

/** Every `<prefix>.${index}.<name>` a page binds an input to. */
function boundFields(src, prefix) {
  const re = new RegExp(`${prefix}\\.\\$\\{index\\}\\.(\\w+)`, 'g');
  return new Set([...src.matchAll(re)].map((m) => m[1]));
}

/** Top-level keys of a named zod object schema (handles a trailing .refine()). */
function zodSchemaKeys(src, schemaName, label) {
  const start = src.indexOf(`${schemaName} = z.object({`);
  assert.ok(start !== -1, `${label}: ${schemaName} not found`);
  const body = src.slice(start);
  const end = body.search(/^\}\)/m);
  assert.ok(end !== -1, `${label}: could not find the end of ${schemaName}`);
  return new Set([...body.slice(0, end).matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]));
}

/** Column (field) names on a Prisma model. */
function prismaModelFields(model, label) {
  const m = prismaSrc.match(new RegExp(`^model ${model} \\{([\\s\\S]*?)^\\}`, 'm'));
  assert.ok(m, `${label}: model ${model} not found in schema.prisma`);
  return new Set(
    m[1].split('\n').map((l) => l.trim())
      .filter((l) => l && !l.startsWith('//') && !l.startsWith('@@'))
      .map((l) => l.split(/\s+/)[0])
  );
}

/**
 * Keys a named backend `function toXxx(item) { ... return { ... }; }` mapper
 * writes — both `key: value` and ES2015 shorthand (`key,`) properties, since
 * toStockTransferItemData's return object uses shorthand for several fields.
 */
function backendMapperKeys(fnName, label) {
  const re = new RegExp(`function ${fnName}\\([^)]*\\) \\{[\\s\\S]*?return \\{([\\s\\S]*?)\\n  \\};`);
  const m = resourcesSrc.match(re);
  assert.ok(m, `${label}: could not read ${fnName}'s return object`);
  const keyed = [...m[1].matchAll(/^\s*(\w+):/gm)].map((x) => x[1]);
  const shorthand = [...m[1].matchAll(/^\s*(\w+),\s*$/gm)].map((x) => x[1]);
  return new Set([...keyed, ...shorthand]);
}

// --- Stock Transfer ---------------------------------------------------------

test('Stock Transfer: every bound item input is a field the schema and the database keep', () => {
  const pageSrc = read(path.join(FRONTEND, 'pages/inventory/StockTransfer.jsx'));
  const schemaSrc = read(path.join(FRONTEND, 'lib/validation/inventorySchemas.js'));

  const seedMatch = pageSrc.match(/^const emptyItem = \{([\s\S]*?)^\};/m);
  assert.ok(seedMatch, 'StockTransfer.jsx: could not find "const emptyItem = { ... }"');
  const seed = new Set([...seedMatch[1].matchAll(/(\w+)\s*:/g)].map((x) => x[1]));

  const inputs = boundFields(pageSrc, 'items');
  const zod = zodSchemaKeys(schemaSrc, 'export const stockTransferItemSchema', 'Stock Transfer');
  const columns = prismaModelFields('StockTransferItem', 'Stock Transfer');
  const backendKeys = backendMapperKeys('toStockTransferItemData', 'Stock Transfer');

  const missingFromSeed = [...zod].filter((k) => !seed.has(k));
  assert.deepEqual(
    missingFromSeed, [],
    `stockTransferItemSchema declares ${missingFromSeed.join(', ')}, which emptyItem never seeds — `
    + 'validation fails on a row the user cannot see anything wrong with'
  );

  const strayInputs = [...inputs].filter((k) => !zod.has(k));
  assert.deepEqual(
    strayInputs, [],
    `inputs bind ${strayInputs.join(', ')}, which stockTransferItemSchema does not declare — `
    + 'zod strips unknown keys, so those values never reach the server'
  );

  // What the schema validates has to actually be a column the item table can
  // store, and a field the server's own mapper (toStockTransferItemData)
  // reads off the line — otherwise a value that passes validation is silently
  // dropped on save.
  const zodNotOnServer = [...zod].filter((k) => !backendKeys.has(k) && k !== 'totalStock');
  assert.deepEqual(
    zodNotOnServer, [],
    `stockTransferItemSchema declares ${zodNotOnServer.join(', ')}, which toStockTransferItemData never reads`
  );
  const zodNotInDb = [...zod].filter((k) => !columns.has(k));
  assert.deepEqual(
    zodNotInDb, [],
    `stockTransferItemSchema declares ${zodNotInDb.join(', ')}, which StockTransferItem has no column for`
  );
});

// --- Payment Receipt / Payment Voucher applications -------------------------

function checkApplicationParity({
  label, page, schemaName, backendMapper, prismaModel, formValuesFnName,
}) {
  test(`${label}: applied-invoice rows agree across the form, the schema, the server and the database`, () => {
    const pageSrc = read(path.join(FRONTEND, page));
    const schemaSrc = read(path.join(FRONTEND, 'lib/validation/receivablesPayablesSchemas.js'));

    const inputs = boundFields(pageSrc, 'applications');
    const zod = zodSchemaKeys(schemaSrc, `const ${schemaName}`, label);
    const columns = prismaModelFields(prismaModel, label);
    const backendKeys = backendMapperKeys(backendMapper, label);

    // rowToFormValues(row) is what an existing record is loaded back into the
    // form as — every key the schema requires on a row has to be populated
    // there too, or re-opening a saved record fails validation on fields the
    // user never touched.
    const fnStart = pageSrc.indexOf(`function ${formValuesFnName}(row)`);
    assert.ok(fnStart !== -1, `${label}: ${formValuesFnName} not found`);
    const appsStart = pageSrc.indexOf('applications:', fnStart);
    const appsBlock = pageSrc.slice(appsStart, pageSrc.indexOf('};', appsStart));
    const loaded = new Set([...appsBlock.matchAll(/(\w+):/g)].map((m) => m[1])
      .filter((k) => k !== 'applications' && k !== 'a'));

    const strayInputs = [...inputs].filter((k) => !zod.has(k));
    assert.deepEqual(strayInputs, [], `${label}: inputs bind ${strayInputs.join(', ')}, not in ${schemaName}`);

    const missingFromLoad = [...zod].filter((k) => !loaded.has(k));
    assert.deepEqual(
      missingFromLoad, [],
      `${label}: ${formValuesFnName} never populates ${missingFromLoad.join(', ')} when loading an existing record`
    );

    const zodNotOnServer = [...zod].filter((k) => !backendKeys.has(k));
    assert.deepEqual(zodNotOnServer, [], `${label}: ${backendMapper} never reads ${zodNotOnServer.join(', ')}`);

    const zodNotInDb = [...zod].filter((k) => !columns.has(k));
    assert.deepEqual(zodNotInDb, [], `${label}: ${prismaModel} has no column for ${zodNotInDb.join(', ')}`);
  });
}

checkApplicationParity({
  label: 'Payment Receipt',
  page: 'pages/banking/PaymentReceipt.jsx',
  schemaName: 'paymentReceiptApplicationSchema',
  backendMapper: 'toPaymentReceiptApplicationData',
  prismaModel: 'PaymentReceiptApplication',
  formValuesFnName: 'rowToFormValues',
});

checkApplicationParity({
  label: 'Payment Voucher',
  page: 'pages/banking/PaymentVoucher.jsx',
  schemaName: 'paymentVoucherApplicationSchema',
  backendMapper: 'toPaymentVoucherApplicationData',
  prismaModel: 'PaymentVoucherApplication',
  formValuesFnName: 'rowToFormValues',
});

// --- Stock Transfer negative-stock guard ------------------------------------
// Not a source-text check — actually exercises the fixed logic. See
// utils/stockLedger.js's getCurrentStockByWarehouseForMany doc comment for the
// bug this closes: a transfer could drain a From Warehouse that holds none of
// a product, as long as another warehouse held enough, because the only guard
// that existed was company-wide.

test('Stock Transfer: getCurrentStockByWarehouseForMany isolates stock to the warehouse it is actually in', async () => {
  const { getCurrentStockByWarehouseForMany } = require('../utils/stockLedger');

  // Product P1 has 100 units, all of it received into WH-A. WH-B has none.
  const fakeTx = {
    stockReceiptItem: {
      findMany: async ({ where }) => {
        const wantsWarehouse = where.receipt && where.receipt.warehouse;
        if (wantsWarehouse && wantsWarehouse !== 'WH-A') return [];
        return [{ productCode: 'P1', quantity: 100, receipt: { warehouse: 'WH-A' } }];
      },
    },
    stockIssueItem: { findMany: async () => [] },
    stockAdjustmentItem: { findMany: async () => [] },
    stockTransferItem: { findMany: async () => [] },
    goodsReceivedNoteItem: { findMany: async () => [] },
    deliveryChallanItem: { findMany: async () => [] },
    purchaseInvoiceItem: { findMany: async () => [] },
    salesInvoiceItem: { findMany: async () => [] },
  };

  const result = await getCurrentStockByWarehouseForMany(
    [{ productCode: 'P1', warehouse: 'WH-A' }, { productCode: 'P1', warehouse: 'WH-B' }],
    { client: fakeTx }
  );

  assert.equal(result.get('P1::WH-A'), 100, 'WH-A should show the 100 units actually received there');
  assert.equal(
    result.get('P1::WH-B'), 0,
    'WH-B should show 0 — before this fix, only the company-wide total (100) was ever checked, '
    + 'which would have let a transfer drain WH-B below zero'
  );
});

test('Stock Transfer: an empty pair list is a no-op, not a crash', async () => {
  const { getCurrentStockByWarehouseForMany } = require('../utils/stockLedger');
  const result = await getCurrentStockByWarehouseForMany([], { client: {} });
  assert.equal(result.size, 0);
});
