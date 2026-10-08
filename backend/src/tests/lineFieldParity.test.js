/**
 * Line-item field-name parity across the four layers a document line passes
 * through.
 *
 * The defect this exists to prevent, found on Sales Return:
 *
 *   the form's inputs were named `items.N.quantity`, while the zod schema
 *   required `returnQuantity`, the totals engine was told to read
 *   `returnQuantity`, the server's mapLine read `returnQuantity`, and the
 *   column is [sales_return_items].[return_quantity].
 *
 * So the field the user typed into was not the field anything else looked at.
 * Two failures fell out of that, neither of which shows up as an error
 * anywhere in the code:
 *
 *   1. the document could never be saved — zod requires returnQuantity to be a
 *      number greater than zero, and the form never supplied the key at all;
 *   2. the totals panel read returnQuantity off a line that did not have it,
 *      so every amount, tax figure and grand total rendered as 0.00 while the
 *      per-row Amount column (which did read `quantity`) showed real numbers.
 *
 * Nothing catches this at build time: a missing key on a plain object is
 * `undefined`, not an error, and both spellings are legitimate elsewhere in
 * the app — the credit memos genuinely use `quantity`, the returns genuinely
 * use `returnQuantity`. Only comparing the layers against each other finds it.
 *
 * These are static checks over the source text rather than behavioural tests.
 * That is deliberate: the failure is a naming mismatch between files, so
 * reading the names out of those files is the most direct way to assert it,
 * and it needs no browser, bundler or database.
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

/**
 * The documents whose line rows carry a quantity under a name that is NOT
 * plain `quantity` on at least one layer — i.e. every one where the mismatch
 * above is possible. Credit memos are included precisely because they are the
 * counter-example: they use `quantity` consistently, and this test proves that
 * rather than assuming it.
 */
const DOCUMENTS = [
  {
    label: 'Sales Return',
    page: 'pages/sales/SalesReturn.jsx',
    schemaFile: 'lib/validation/salesSchemas.js',
    schemaName: 'salesReturnItemSchema',
    backendMapper: 'toSalesReturnItem',
    prismaModel: 'SalesReturnItem',
  },
  {
    label: 'Purchase Return',
    page: 'pages/purchase/PurchaseReturn.jsx',
    schemaFile: 'lib/validation/purchaseSchemas.js',
    schemaName: 'purchaseReturnItemSchema',
    backendMapper: 'toPurchaseReturnItem',
    prismaModel: 'PurchaseReturnItem',
  },
  {
    label: 'Sales Credit Memo',
    page: 'pages/sales/SalesCreditMemo.jsx',
    schemaFile: 'lib/validation/salesSchemas.js',
    schemaName: 'salesCreditMemoItemSchema',
    backendMapper: 'toSalesCreditMemoItem',
    prismaModel: 'SalesCreditMemoItem',
  },
  {
    label: 'Purchase Credit Memo',
    page: 'pages/purchase/PurchaseCreditMemo.jsx',
    schemaFile: 'lib/validation/purchaseSchemas.js',
    schemaName: 'purchaseCreditMemoItemSchema',
    backendMapper: 'toCreditMemoItem',
    prismaModel: 'PurchaseCreditMemoItem',
  },
];

// --- readers ---------------------------------------------------------------

/** Keys of the page's `const emptyItem = { ... }` seed row. */
function emptyItemKeys(src, label) {
  const m = src.match(/^const emptyItem = \{([\s\S]*?)^\};/m);
  assert.ok(m, `${label}: could not find "const emptyItem = { ... }"`);
  return new Set([...m[1].matchAll(/(\w+)\s*:/g)].map((x) => x[1]));
}

/** The quantityField the page hands the shared totals engine. */
function pageQuantityField(src, label) {
  const m = src.match(/quantityField:\s*'(\w+)'/);
  assert.ok(m, `${label}: the page does not pass a quantityField to buildDocument`);
  return m[1];
}

/** Every `items.${index}.<name>` the page binds an input to. */
function pageInputFields(src) {
  return new Set(
    [...src.matchAll(/items\.\$\{index\}\.(\w+)/g)].map((x) => x[1])
  );
}

/** Top-level keys of a named zod object schema. */
function zodSchemaKeys(src, schemaName, label) {
  const start = src.indexOf(`export const ${schemaName} = z.object({`);
  assert.ok(start !== -1, `${label}: ${schemaName} not found`);
  const body = src.slice(start);
  // Stop at the closing "})" of the z.object call — either "});" for a plain
  // schema or "})\n  .refine" for one carrying a cross-field rule.
  const end = body.search(/^\}\)/m);
  assert.ok(end !== -1, `${label}: could not find the end of ${schemaName}`);
  // Only keys at the schema's own indent level; nested option objects are
  // indented further and must not be mistaken for fields.
  return new Set(
    [...body.slice(0, end).matchAll(/^ {2}(\w+):/gm)].map((x) => x[1])
  );
}

/**
 * The quantityField the server's mapLine call uses.
 *
 * The mapper's own parameter list is intentionally not pinned to exactly
 * `(item)` — several of these gained a second `header` parameter (e.g.
 * `(item, header)`) so a line's warehouse can fall back to the document's
 * header warehouse when left blank; that's an unrelated, deliberate change,
 * not the naming defect this test exists to catch, so any parameter list is
 * accepted here.
 */
function backendQuantityField(src, mapper, label) {
  const re = new RegExp(`const ${mapper} = \\([^)]*\\) => mapLine\\(item, \\{[\\s\\S]{0,200}?quantityField: '(\\w+)'`);
  const m = src.match(re);
  assert.ok(m, `${label}: could not read quantityField from ${mapper}`);
  return m[1];
}

/** Column (field) names on a Prisma model. */
function prismaModelFields(src, model, label) {
  const m = src.match(new RegExp(`^model ${model} \\{([\\s\\S]*?)^\\}`, 'm'));
  assert.ok(m, `${label}: model ${model} not found in schema.prisma`);
  return new Set(
    m[1]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('//') && !l.startsWith('@@'))
      .map((l) => l.split(/\s+/)[0])
  );
}

// --- the checks ------------------------------------------------------------

const prismaSrc = read(SCHEMA_PRISMA);
const resourcesSrc = read(RESOURCES);

for (const doc of DOCUMENTS) {
  const pageSrc = read(path.join(FRONTEND, doc.page));
  const schemaSrc = read(path.join(FRONTEND, doc.schemaFile));

  const seed = emptyItemKeys(pageSrc, doc.label);
  const inputs = pageInputFields(pageSrc);
  const zod = zodSchemaKeys(schemaSrc, doc.schemaName, doc.label);
  const columns = prismaModelFields(prismaSrc, doc.prismaModel, doc.label);
  const qtyPage = pageQuantityField(pageSrc, doc.label);
  const qtyBackend = backendQuantityField(resourcesSrc, doc.backendMapper, doc.label);

  test(`${doc.label}: the quantity field has one name on every layer`, () => {
    assert.equal(
      qtyPage, qtyBackend,
      `the page computes totals on "${qtyPage}" but the server saves "${qtyBackend}" — `
      + 'the panel and the stored document would disagree'
    );
    assert.ok(
      seed.has(qtyPage),
      `the page's emptyItem has no "${qtyPage}" key, so a new row starts with it undefined `
      + `(emptyItem has: ${[...seed].join(', ')})`
    );
    assert.ok(
      inputs.has(qtyPage),
      `no input is bound to items.N.${qtyPage} — whatever the user types goes somewhere `
      + `the totals engine never reads (inputs bind: ${[...inputs].join(', ')})`
    );
    assert.ok(
      zod.has(qtyPage),
      `${doc.schemaName} does not declare "${qtyPage}", so zod strips it before submit`
    );
    assert.ok(
      columns.has(qtyPage),
      `${doc.prismaModel} has no "${qtyPage}" column`
    );
  });

  test(`${doc.label}: every field the schema requires is seeded by the form`, () => {
    // This is the check that catches "the document can never be saved": a key
    // the schema demands but the form never puts on the row validates as
    // undefined, every time, on a form that looks completely filled in.
    const missing = [...zod].filter((k) => !seed.has(k));
    assert.deepEqual(
      missing, [],
      `${doc.schemaName} declares ${missing.join(', ')}, which emptyItem never sets — `
      + 'validation fails on a row the user cannot see anything wrong with'
    );
  });

  test(`${doc.label}: every bound input is a field the schema keeps`, () => {
    // The mirror image: an input bound to a name zod does not declare is typed
    // into and then silently dropped from the payload.
    const stray = [...inputs].filter((k) => !zod.has(k));
    assert.deepEqual(
      stray, [],
      `inputs bind ${stray.join(', ')}, which ${doc.schemaName} does not declare — `
      + 'zod strips unknown keys, so those values never reach the server'
    );
  });
}
