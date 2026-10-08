/**
 * SAP-style "Copy From" fields — base_type / base_entry / base_no / base_line —
 * across every layer they have to exist in to actually work.
 *
 * These four columns are only useful if all four layers agree, and each layer
 * fails SILENTLY on its own when it does not:
 *
 *   * missing from schema.prisma -> Prisma rejects the write with "Unknown
 *     argument baseType", but only for the one document that was copied;
 *   * missing from the migration -> the column is absent in a fresh database
 *     and every save of that document breaks, while the developer's own
 *     already-patched database keeps working;
 *   * missing from the zod line schema -> zod STRIPS unknown keys, so the
 *     fields vanish between the form and the request body and the link is
 *     quietly never recorded — no error anywhere;
 *   * missing from a page's copy-from effect -> that one document copies
 *     lines without recording where they came from, which looks exactly like
 *     a manually typed line.
 *
 * The last two are the dangerous ones: nothing throws, the document saves,
 * and the only symptom is a base reference that is null when it should not
 * be. Static checks across the layers are the only thing that catches them.
 *
 * Deliberately source-text checks rather than behavioural tests: the failure
 * mode is layers disagreeing about a name, so reading the names out of the
 * files is the most direct assertion, and it needs no database.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const schema = read('prisma/schema.prisma');
// Two migrations, and the split is load-bearing — see the note at the end of
// the first one. SQL Server binds a whole batch before running any of it, so
// a static UPDATE against a column an ALTER in the same batch has not added
// yet fails the entire script with "Invalid column name". The columns are
// added in one migration and populated in the next.
const addColumns = read('prisma/migrations/20260820120000_add_base_document_fields/migration.sql');
const backfill = read('prisma/migrations/20260820120001_backfill_base_document_fields/migration.sql');
const migration = `${addColumns}\n${backfill}`;
const resources = read('routes/resources.js');

// The four fields, as the Prisma model spells them and as the database does.
const FIELDS = [
  ['baseType', 'base_type'],
  ['baseEntry', 'base_entry'],
  ['baseNo', 'base_no'],
  ['baseLine', 'base_line'],
];

/**
 * Every sales and purchase LINE-ITEM model, with its table name.
 *
 * Sales Enquiry is absent on purpose and not by oversight: it has no
 * line-item table at all (its requirement is free text on the header), and it
 * is the head of the sales chain, so it could never carry a base document.
 */
const LINE_MODELS = [
  ['PurchaseQuotationItem', 'purchase_quotation_items'],
  ['PurchaseOrderItem', 'purchase_order_items'],
  ['GoodsReceivedNoteItem', 'goods_received_note_items'],
  ['PurchaseInvoiceItem', 'purchase_invoice_items'],
  ['PurchaseReturnItem', 'purchase_return_items'],
  ['PurchaseCreditMemoItem', 'purchase_credit_memo_items'],
  ['SalesQuotationItem', 'sales_quotation_items'],
  ['SalesOrderItem', 'sales_order_items'],
  ['DeliveryChallanItem', 'delivery_challan_items'],
  ['SalesInvoiceItem', 'sales_invoice_items'],
  ['SalesReturnItem', 'sales_return_items'],
  ['SalesCreditMemoItem', 'sales_credit_memo_items'],
];

/** The body of one `model X { ... }` block. */
function modelBody(name) {
  const m = new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`).exec(schema);
  assert.ok(m, `model ${name} is not in schema.prisma`);
  return m[1];
}

test('the model list itself is complete (guards against a silent pass)', () => {
  // If this file ever stops naming all twelve, every other test here would
  // still pass while checking less than it claims to.
  assert.equal(LINE_MODELS.length, 12);
  const itemModels = [...schema.matchAll(/model (\w+Item) \{/g)].map((m) => m[1]);
  for (const [model] of LINE_MODELS) {
    assert.ok(itemModels.includes(model), `${model} is not a model in schema.prisma`);
  }
});

test('every sales and purchase line model declares all four base fields', () => {
  for (const [model] of LINE_MODELS) {
    const body = modelBody(model);
    for (const [field, column] of FIELDS) {
      assert.match(
        body,
        new RegExp(`^\\s*${field}\\s`, 'm'),
        `${model}.${field} is missing from schema.prisma`
      );
      assert.match(
        body,
        new RegExp(`${field}[^\\n]*@map\\("${column}"\\)`),
        `${model}.${field} must map to the ${column} column`
      );
    }
  }
});

test('base fields are nullable — a hand-typed line has no base document', () => {
  for (const [model] of LINE_MODELS) {
    const body = modelBody(model);
    for (const [field] of FIELDS) {
      const line = new RegExp(`^\\s*${field}\\s+(\\S+)`, 'm').exec(body);
      assert.ok(line, `${model}.${field} not found`);
      assert.ok(
        line[1].endsWith('?'),
        `${model}.${field} is ${line[1]} — it must be optional, since a line `
        + 'entered by hand genuinely has no base document and that absence is meaningful'
      );
    }
  }
});

test('baseEntry and baseLine are integers, baseType and baseNo are strings', () => {
  for (const [model] of LINE_MODELS) {
    const body = modelBody(model);
    const typeOf = (f) => new RegExp(`^\\s*${f}\\s+(\\S+)`, 'm').exec(body)[1];
    // baseEntry is an ID, not a document number — the whole point of keeping
    // it alongside baseNo is that an id survives a document being renumbered.
    assert.equal(typeOf('baseEntry'), 'Int?', `${model}.baseEntry must be Int?`);
    assert.equal(typeOf('baseLine'), 'Int?', `${model}.baseLine must be Int?`);
    assert.equal(typeOf('baseType'), 'String?', `${model}.baseType must be String?`);
    assert.equal(typeOf('baseNo'), 'String?', `${model}.baseNo must be String?`);
  }
});

test('the migration adds the columns to every one of those tables', () => {
  for (const [, table] of LINE_MODELS) {
    assert.ok(
      migration.includes(`'${table}'`) || migration.includes(`N'${table}'`),
      `${table} is never touched by the base-document migration, so the columns `
      + 'would be missing in a database built from the migrations'
    );
  }
  for (const [, column] of FIELDS) {
    assert.ok(migration.includes(`[${column}]`), `the migration never adds [${column}]`);
  }
});

test('REGRESSION: the column-adding migration never references the new columns', () => {
  // The bug this pins down (SQL Server error 207, "Invalid column name
  // 'base_entry'"): the ALTERs are dynamic SQL and so compile at run time,
  // but a plain UPDATE in the same batch is bound BEFORE anything executes —
  // against tables that do not have the column yet. SQL Server then rejects
  // the whole script without adding a single column, and `prisma migrate
  // deploy` records the migration as failed.
  //
  // So the migration that ADDS the columns must not read or write them
  // outside dynamic SQL. Populating them belongs in the next migration,
  // which is compiled after this one has committed.
  const withoutDynamic = addColumns
    // Strip comments, then every string literal — both the N'...' text that
    // sp_executesql compiles later and the plain '...' names compared against
    // sys.columns. Naming a column inside either is fine; what breaks the
    // script is naming one as a real column reference in static SQL.
    .replace(/--[^\n]*/g, '')
    .replace(/N?'[^']*'/g, "''");

  for (const [, column] of FIELDS) {
    assert.ok(
      !new RegExp(`\\b${column}\\b`).test(withoutDynamic),
      `the add-columns migration references ${column} in static SQL. SQL Server `
      + 'binds the batch before running it, so the script fails with error 207 '
      + 'before the column exists. Move that statement to the backfill migration.'
    );
  }
});

test('the backfill runs as its own migration, after the columns exist', () => {
  assert.ok(
    !/ADD \[base_/.test(backfill),
    'the backfill migration should not add columns — that is the previous one'
  );
  assert.match(
    backfill,
    /base_entry IS NULL/,
    'the backfill must only touch rows whose base fields are still empty, so '
    + 're-running it cannot overwrite a link the application has since written'
  );
});

test('the server maps all four fields onto every line it writes', () => {
  // mapLine is the single funnel every sales/purchase line passes through, so
  // the fields are applied there rather than repeated per document.
  const fn = /function baseFields\(item\) \{([\s\S]*?)\n\}/.exec(resources);
  assert.ok(fn, 'baseFields() is missing from resources.js');
  for (const [field] of FIELDS) {
    assert.match(fn[1], new RegExp(`${field}:`), `baseFields() does not set ${field}`);
  }
  assert.match(
    resources,
    /Object\.assign\(row, baseFields\(item\)\)/,
    'mapLine no longer applies baseFields, so copied lines would lose their link'
  );
});

test('baseEntry and baseLine are only accepted as whole numbers', () => {
  // A client can send anything. A non-integer must land as NULL rather than
  // as a partial value that looks like a real reference.
  const fn = /function baseFields\(item\) \{([\s\S]*?)\n\}/.exec(resources)[1];
  assert.match(fn, /Number\.isInteger/, 'baseEntry/baseLine are not integer-checked');
  assert.match(fn, /baseEntry: int\(/, 'baseEntry is not coerced through the integer guard');
  assert.match(fn, /baseLine: int\(/, 'baseLine is not coerced through the integer guard');
});

// --- the frontend half ------------------------------------------------------

const web = path.join(root, '..', '..', 'frontend', 'src');
const readWeb = (p) => fs.readFileSync(path.join(web, p), 'utf8');

test('every line schema keeps the base fields instead of stripping them', () => {
  // zod removes keys it does not declare, so a line schema without these
  // would drop the link between the form and the request body — with no
  // error raised anywhere.
  const sales = readWeb('lib/validation/salesSchemas.js');
  const purchase = readWeb('lib/validation/purchaseSchemas.js');
  const count = (s) => (s.match(/\.\.\.baseDocumentFields\(\)/g) || []).length;

  // Six line schemas per side: quotation, order, delivery/GRN, invoice,
  // return, credit memo.
  assert.equal(count(sales), 6, 'a sales line schema is missing baseDocumentFields()');
  assert.equal(count(purchase), 6, 'a purchase line schema is missing baseDocumentFields()');
});

/**
 * Each page that copies lines from another document, and the base type it
 * must stamp on them. This is the whole "Copy From" matrix — if a page is
 * added to the chain it belongs here too.
 *
 * The quotations are absent because they start their chains: a purchase
 * quotation has no predecessor, and a sales quotation's predecessor (the
 * enquiry) has no lines to copy.
 */
const COPY_FROM = [
  ['pages/purchase/PurchaseOrder.jsx', 'Purchase Quotation'],
  ['pages/purchase/PurchaseGRN.jsx', 'Purchase Order'],
  ['pages/purchase/PurchaseInvoice.jsx', 'Purchase GRN'],
  ['pages/purchase/PurchaseReturn.jsx', 'Purchase GRN'],
  ['pages/purchase/PurchaseCreditMemo.jsx', 'Purchase Invoice'],
  ['pages/sales/SalesOrder.jsx', 'Sales Quotation'],
  ['pages/sales/DeliveryChallan.jsx', 'Sales Order'],
  ['pages/sales/SalesInvoice.jsx', 'Delivery Challan'],
  ['pages/sales/SalesReturn.jsx', 'Delivery Challan'],
  ['pages/sales/SalesCreditMemo.jsx', 'Sales Invoice'],
];

test('every copy-from page stamps all four base fields', () => {
  for (const [file] of COPY_FROM) {
    const src = readWeb(file);
    for (const [field] of FIELDS) {
      assert.match(
        src,
        new RegExp(`${field}:`),
        `${file} copies lines from another document but never sets ${field}, `
        + 'so those lines would be indistinguishable from ones typed by hand'
      );
    }
  }
});

test('each copy-from page names its immediate predecessor as the base type', () => {
  // Always the document it was actually copied from, never the origin of the
  // chain: a purchase invoice copied from a GRN names the GRN, even though a
  // quotation began the flow.
  for (const [file, expected] of COPY_FROM) {
    const src = readWeb(file);
    assert.match(
      src,
      new RegExp(`baseType: '${expected}'`),
      `${file} should stamp baseType: '${expected}' — its immediate base document`
    );
  }
});

test('base_line is numbered against the source document, not the copied subset', () => {
  // Returns and credit memos drop source lines that have nothing left to take.
  // If base_line were numbered after that filter it would point at the wrong
  // line of the source document — the one bug in here that produces a
  // plausible-looking but wrong reference rather than a null one.
  const filtered = [
    'pages/purchase/PurchaseReturn.jsx',
    'pages/purchase/PurchaseCreditMemo.jsx',
    'pages/sales/SalesReturn.jsx',
    'pages/sales/SalesCreditMemo.jsx',
    'pages/purchase/PurchaseInvoice.jsx',
    'pages/sales/SalesInvoice.jsx',
  ];
  for (const file of filtered) {
    const src = readWeb(file);
    // The line number has to be captured in the .map() that walks the source
    // document's own items, i.e. before any .filter() narrows them.
    const mapIdx = src.search(/\.map\(\(i, n\) =>/);
    const filterIdx = src.search(/\.filter\(\(\{ qty \}\)/);
    assert.ok(
      mapIdx !== -1,
      `${file} does not capture the source line index while mapping, so base_line `
      + 'would be the position in the copied subset rather than in the source document'
    );
    if (filterIdx !== -1) {
      assert.ok(
        mapIdx < filterIdx,
        `${file} numbers base_line after filtering out consumed lines — it must be `
        + 'captured before, or the reference points at the wrong source line'
      );
    }
    assert.match(src, /baseLine: line/, `${file} should stamp the captured source line number`);
  }
});
