/**
 * Party-state GST treatment, across every purchase AND sales document.
 *
 * Rule under test: CGST/SGST vs IGST is decided from the PARTY's State --
 * the SUPPLIER's on Purchase Quotation/Order/GRN/Invoice/Return/Credit Memo,
 * the CUSTOMER's on Sales Quotation/Order/Delivery Challan/Invoice/Credit
 * Memo/Return -- taken from the Business Partner's default Billing address.
 * Place of Supply no longer decides it on any of the twelve.
 *
 * Four layers are pinned so the forms, the server, the print sheets and the
 * database can't drift apart again (the old bug: the screen said IGST while
 * the server, reading a different field, saved CGST/SGST):
 *
 *   1. The lookup helper (utils/partnerState.js) -- unit tests with a fake client.
 *   2. The tax arithmetic -- intra vs inter, through the shared totals engine.
 *   3. Source wiring -- routes, pages, print sheets and zod schemas of all
 *      twelve documents (static checks, like frontendParity.test.js).
 *   4. Database -- schema.prisma column + a migration adding it, per table.
 *
 * Run with:  node --test src/tests/
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { billingStateOf, resolvePartnerState, resolveSupplierState, resolveCustomerState } = require('../utils/partnerState');
const { computeTotals, isInterState } = require('../utils/documentTotals');

const ROOT = path.resolve(__dirname, '../../..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const FE = (...p) => read('frontend', 'src', ...p);

// ---------------------------------------------------------------------------
// 1. Lookup helper
// ---------------------------------------------------------------------------

const addr = (type, state, isDefault = false) => ({ addressType: type, isDefault, state });

test('billingStateOf: the default Billing address wins over an earlier non-default one', () => {
  const p = { addresses: [addr('Billing', 'Kerala'), addr('Billing', 'Tamil Nadu', true)] };
  assert.equal(billingStateOf(p), 'Tamil Nadu');
});

test('billingStateOf: no default -> the first Billing address', () => {
  const p = { addresses: [addr('Shipping', 'Goa'), addr('Billing', 'Karnataka'), addr('Billing', 'Kerala')] };
  assert.equal(billingStateOf(p), 'Karnataka');
});

test('billingStateOf: Shipping addresses are never used', () => {
  assert.equal(billingStateOf({ addresses: [addr('Shipping', 'Goa', true)] }), '');
});

test('billingStateOf: missing partner / no addresses / blank state -> empty string', () => {
  assert.equal(billingStateOf(null), '');
  assert.equal(billingStateOf(undefined), '');
  assert.equal(billingStateOf({}), '');
  assert.equal(billingStateOf({ addresses: [] }), '');
  assert.equal(billingStateOf({ addresses: [addr('Billing', '   ', true)] }), '');
  assert.equal(billingStateOf({ addresses: [addr('Billing', null, true)] }), '');
});

test('billingStateOf: trims whitespace', () => {
  assert.equal(billingStateOf({ addresses: [addr('Billing', '  Kerala ', true)] }), 'Kerala');
});

function fakeClient(partner) {
  const calls = [];
  return {
    calls,
    businessPartner: {
      findFirst: async (args) => { calls.push(args); return partner; },
    },
  };
}

test('resolvePartnerState: a state the document already carries is used as-is, with no query', async () => {
  const c = fakeClient({ addresses: [addr('Billing', 'Goa', true)] });
  assert.equal(await resolvePartnerState(c, 'Customer', ' Tamil Nadu ', 'Acme'), 'Tamil Nadu');
  assert.equal(c.calls.length, 0);
});

test('resolvePartnerState: no state and no party name -> empty string, no query', async () => {
  const c = fakeClient(null);
  assert.equal(await resolvePartnerState(c, 'Customer', '', ''), '');
  assert.equal(await resolvePartnerState(c, 'Vendor', undefined, undefined), '');
  assert.equal(c.calls.length, 0);
});

test('resolvePartnerState: looks the party up by type + name and reads its billing state', async () => {
  const c = fakeClient({ addresses: [addr('Billing', 'Karnataka', true)] });
  assert.equal(await resolvePartnerState(c, 'Vendor', '', 'Live Computers'), 'Karnataka');
  assert.equal(c.calls.length, 1);
  assert.equal(c.calls[0].where.partnerType, 'Vendor');
  assert.equal(c.calls[0].where.partnerName, 'Live Computers');
  assert.ok(c.calls[0].select.addresses, 'must select addresses -- business_partners has no state column');
  assert.equal(c.calls[0].select.state, undefined, 'must NOT select a non-existent state column');
});

test('resolvePartnerState: unknown party -> empty string (intra-state), not a crash', async () => {
  assert.equal(await resolvePartnerState(fakeClient(null), 'Customer', '', 'Nobody'), '');
});

test('resolveSupplierState / resolveCustomerState use the right partner type and header field', async () => {
  const s = fakeClient({ addresses: [addr('Billing', 'Kerala', true)] });
  assert.equal(await resolveSupplierState(s, { supplier: 'Sup A', customer: 'Cus B' }), 'Kerala');
  assert.equal(s.calls[0].where.partnerType, 'Vendor');
  assert.equal(s.calls[0].where.partnerName, 'Sup A');

  const c = fakeClient({ addresses: [addr('Billing', 'Goa', true)] });
  assert.equal(await resolveCustomerState(c, { supplier: 'Sup A', customer: 'Cus B' }), 'Goa');
  assert.equal(c.calls[0].where.partnerType, 'Customer');
  assert.equal(c.calls[0].where.partnerName, 'Cus B');
});

test('resolveSupplierState / resolveCustomerState: the form-sent state wins over a lookup', async () => {
  const c = fakeClient({ addresses: [addr('Billing', 'Goa', true)] });
  assert.equal(await resolveSupplierState(c, { supplier: 'X', supplierState: 'Kerala' }), 'Kerala');
  assert.equal(await resolveCustomerState(c, { customer: 'X', customerState: 'Assam' }), 'Assam');
  assert.equal(c.calls.length, 0);
});

// ---------------------------------------------------------------------------
// 2. Tax arithmetic: intra vs inter
// ---------------------------------------------------------------------------

const LINE = { amount: 100000, taxPercent: 18, taxType: 'GST' };
const HOME = 'Kerala';

test('same state as the company -> CGST + SGST, no IGST', () => {
  const inter = isInterState('Kerala', HOME);
  assert.equal(inter, false);
  const t = computeTotals([LINE], 0, { interState: inter });
  assert.equal(t.cgstAmount, 9000);
  assert.equal(t.sgstAmount, 9000);
  assert.equal(t.igstAmount, 0);
  assert.equal(t.amount, 118000);
});

test('different state -> whole tax is IGST, same grand total', () => {
  const inter = isInterState('Tamil Nadu', HOME);
  assert.equal(inter, true);
  const t = computeTotals([LINE], 0, { interState: inter });
  assert.equal(t.cgstAmount, 0);
  assert.equal(t.sgstAmount, 0);
  assert.equal(t.igstAmount, 18000);
  assert.equal(t.amount, 118000);
});

test('state comparison ignores case and surrounding whitespace', () => {
  assert.equal(isInterState('  kerala ', 'KERALA'), false);
  assert.equal(isInterState('KARNATAKA', 'kerala'), true);
});

test('unknown / blank state falls back to intra-state (never a surprise IGST)', () => {
  assert.equal(isInterState('', HOME), false);
  assert.equal(isInterState(null, HOME), false);
  assert.equal(isInterState(undefined, HOME), false);
  assert.equal(isInterState('Kerala', ''), false);
});

test('mixed rates split per line on an inter-state document', () => {
  const t = computeTotals(
    [{ amount: 10000, taxPercent: 18 }, { amount: 30000, taxPercent: 5 }],
    0,
    { interState: true },
  );
  assert.equal(t.igstAmount, 3300);
  assert.equal(t.cgstAmount, 0);
  assert.equal(t.amount, 43300);
});

// ---------------------------------------------------------------------------
// 3. Source wiring across all twelve documents
// ---------------------------------------------------------------------------

const PURCHASE = [
  { doc: 'Purchase Quotation', page: 'PurchaseQuotation', print: 'PurchaseQuotationPrintable', schema: 'purchaseQuotationSchema' },
  { doc: 'Purchase Order', page: 'PurchaseOrder', print: 'PurchaseOrderPrintable', schema: 'purchaseOrderSchema' },
  { doc: 'Purchase GRN', page: 'PurchaseGRN', print: 'PurchaseGRNPrintable', schema: 'goodsReceivedNoteSchema' },
  { doc: 'Purchase Invoice', page: 'PurchaseInvoice', print: 'PurchaseInvoicePrintable', schema: 'purchaseInvoiceSchema' },
  { doc: 'Purchase Return', page: 'PurchaseReturn', print: 'PurchaseReturnPrintable', schema: 'purchaseReturnSchema' },
  { doc: 'Purchase Credit Memo', page: 'PurchaseCreditMemo', print: 'PurchaseCreditMemoPrintable', schema: 'purchaseCreditMemoSchema' },
].map((d) => ({ ...d, dir: 'purchase', field: 'supplierState', schemaFile: 'purchaseSchemas.js' }));

const SALES = [
  { doc: 'Sales Quotation', page: 'SalesQuotation', print: 'SalesQuotationPrintable', schema: 'salesQuotationSchema' },
  { doc: 'Sales Order', page: 'SalesOrder', print: 'SalesOrderPrintable', schema: 'salesOrderSchema' },
  { doc: 'Delivery Challan', page: 'DeliveryChallan', print: 'DeliveryChallanPrintable', schema: 'deliveryChallanSchema' },
  { doc: 'Sales Invoice', page: 'SalesInvoice', print: 'SalesInvoicePrintable', schema: 'salesInvoiceSchema' },
  { doc: 'Sales Credit Memo', page: 'SalesCreditMemo', print: 'SalesCreditMemoPrintable', schema: 'salesCreditMemoSchema' },
  { doc: 'Sales Return', page: 'SalesReturn', print: 'SalesReturnPrintable', schema: 'salesReturnSchema' },
].map((d) => ({ ...d, dir: 'sales', field: 'customerState', schemaFile: 'salesSchemas.js' }));

const ALL = [...PURCHASE, ...SALES];

test('routes: no purchase/sales document decides tax from header.placeOfSupply any more', () => {
  const src = read('backend', 'src', 'routes', 'resources.js');
  assert.equal(
    (src.match(/resolveTaxTreatment\(tx, header\.placeOfSupply\)/g) || []).length,
    0,
    'a create/update route still resolves tax from Place of Supply',
  );
});

test('routes: every create + update route resolves tax from the party state', () => {
  const src = read('backend', 'src', 'routes', 'resources.js');
  // 5 purchase documents x (create + update); Purchase Invoice has its own
  // pre-existing header.supplierState call (create + update) -- see below.
  assert.equal((src.match(/resolveTaxTreatment\(tx, supplierState\)/g) || []).length, 10);
  assert.equal((src.match(/resolveTaxTreatment\(tx, header\.supplierState\)/g) || []).length, 2);
  // 6 sales documents x (create + update)
  assert.equal((src.match(/resolveTaxTreatment\(tx, customerState\)/g) || []).length, 12);
});

test('routes: the resolved state is persisted back onto the saved header', () => {
  const src = read('backend', 'src', 'routes', 'resources.js');
  assert.equal((src.match(/header\.supplierState = supplierState \|\| null;/g) || []).length, 10);
  assert.equal((src.match(/header\.customerState = customerState \|\| null;/g) || []).length, 12);
});

test('routes: the helper module is imported, and nothing selects a non-existent business_partners.state', () => {
  const src = read('backend', 'src', 'routes', 'resources.js');
  assert.match(src, /require\('\.\.\/utils\/partnerState'\)/);
  assert.doesNotMatch(src, /select: \{ partnerCode: true, partnerName: true, state: true \}/);
});

for (const d of ALL) {
  test(`${d.doc}: page decides GST/IGST from ${d.field}, not Place of Supply`, () => {
    const src = FE('pages', d.dir, `${d.page}.jsx`);
    assert.match(
      src,
      new RegExp(`isInterState\\(watch\\('${d.field}'\\), company\\?\\.state\\)`),
      'interState must read the party state',
    );
    assert.doesNotMatch(
      src,
      /isInterState\(watch\('placeOfSupply'\), company\?\.state\)/,
      'interState must not read Place of Supply',
    );
  });

  test(`${d.doc}: page has the read-only State field and keeps it in the form values`, () => {
    const src = FE('pages', d.dir, `${d.page}.jsx`);
    assert.match(src, new RegExp(`name="${d.field}"`), 'State input missing');
    assert.match(src, new RegExp(`setValue\\('${d.field}'`), 'State is never filled in');
    assert.match(src, new RegExp(`${d.field}: ''`), 'getEmptyValues must default the field');
    assert.match(src, new RegExp(`${d.field}: row\\.${d.field} \\|\\| ''`), 'rowToFormValues must carry the saved value');
  });

  test(`${d.doc}: print sheet decides GST/IGST from ${d.field} (legacy rows fall back to Place of Supply)`, () => {
    const src = FE('components', 'print', `${d.print}.jsx`);
    assert.match(
      src,
      new RegExp(`isInterState\\(order\\.${d.field}( \\|\\| order\\.placeOfSupply)?, company\\?\\.state\\)`),
    );
  });

  test(`${d.doc}: form schema accepts ${d.field} (zod would otherwise strip it before save)`, () => {
    const src = FE('lib', 'validation', d.schemaFile);
    const start = src.indexOf(`export const ${d.schema} = z.object({`);
    assert.ok(start >= 0, `${d.schema} not found`);
    const next = src.indexOf('\nexport const ', start + 10);
    const block = src.slice(start, next === -1 ? undefined : next);
    assert.match(block, new RegExp(`${d.field}: optionalString\\(\\)`));
  });
}

test('Purchase Quotation regression: it used to read a Place of Supply field no form ever set', () => {
  const src = FE('pages', 'purchase', 'PurchaseQuotation.jsx');
  assert.doesNotMatch(src, /watch\('placeOfSupply'\)/);
});

// ---------------------------------------------------------------------------
// 4. Database: column + migration for every table
// ---------------------------------------------------------------------------

const PRISMA = read('backend', 'src', 'prisma', 'schema.prisma').replace(/\r\n/g, '\n');
const MIG_DIR = path.join(ROOT, 'backend', 'src', 'prisma', 'migrations');
const ALL_MIGRATIONS_SQL = fs.readdirSync(MIG_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => fs.readFileSync(path.join(MIG_DIR, e.name, 'migration.sql'), 'utf8'))
  .join('\n');

const MODELS = [
  ['PurchaseQuotation', 'purchase_quotations', 'supplierState', 'supplier_state'],
  ['PurchaseOrder', 'purchase_orders', 'supplierState', 'supplier_state'],
  ['GoodsReceivedNote', 'goods_received_notes', 'supplierState', 'supplier_state'],
  ['PurchaseInvoice', 'purchase_invoices', 'supplierState', 'supplier_state'],
  ['PurchaseReturn', 'purchase_returns', 'supplierState', 'supplier_state'],
  ['PurchaseCreditMemo', 'purchase_credit_memos', 'supplierState', 'supplier_state'],
  ['SalesQuotation', 'sales_quotations', 'customerState', 'customer_state'],
  ['SalesOrder', 'sales_orders', 'customerState', 'customer_state'],
  ['DeliveryChallan', 'delivery_challans', 'customerState', 'customer_state'],
  ['SalesInvoice', 'sales_invoices', 'customerState', 'customer_state'],
  ['SalesCreditMemo', 'sales_credit_memos', 'customerState', 'customer_state'],
  ['SalesReturn', 'sales_returns', 'customerState', 'customer_state'],
];

for (const [model, table, field, column] of MODELS) {
  test(`${model}: schema.prisma has ${field} mapped to ${table}.${column}`, () => {
    const start = PRISMA.indexOf(`model ${model} {`);
    assert.ok(start >= 0, `model ${model} not found`);
    const end = PRISMA.indexOf('\n}\n', start);
    const body = PRISMA.slice(start, end);
    assert.match(body, new RegExp(`\\n\\s*${field}\\s+String\\?\\s+@map\\("${column}"\\)\\s+@db\\.NVarChar\\(100\\)`));
    assert.match(body, new RegExp(`@@map\\("${table}"\\)`));
  });

  test(`${model}: a migration adds ${table}.${column}`, () => {
    const re = new RegExp(`ALTER TABLE \\[dbo\\]\\.\\[${table}\\] ADD \\[${column}\\]`);
    assert.match(ALL_MIGRATIONS_SQL, re);
  });
}

test('the new migrations are idempotent (guarded by IF NOT EXISTS) and transactional', () => {
  for (const name of fs.readdirSync(MIG_DIR)) {
    if (!/supplier_state|customer_state/.test(name)) continue;
    const sql = fs.readFileSync(path.join(MIG_DIR, name, 'migration.sql'), 'utf8');
    const adds = (sql.match(/ADD \[(supplier|customer)_state\]/g) || []).length;
    const guards = (sql.match(/IF NOT EXISTS \(/g) || []).length;
    assert.equal(guards, adds, `${name}: every ADD needs an IF NOT EXISTS guard`);
    assert.match(sql, /BEGIN TRAN;/);
    assert.match(sql, /COMMIT TRAN;/);
    assert.match(sql, /ROLLBACK TRAN;/);
  }
});
