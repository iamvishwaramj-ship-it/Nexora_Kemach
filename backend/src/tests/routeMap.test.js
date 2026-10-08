/**
 * Route Map + return/credit-memo rule tests.
 *
 * Runs against an in-memory stand-in for the Prisma client rather than a
 * database: everything under test here is traversal and rule logic over rows,
 * and the queries it issues are plain equality filters, so a fake that
 * implements findFirst/findMany over arrays exercises the real code path
 * without needing SQL Server.
 *
 * The one thing a fake cannot check is that the column names match the schema.
 * That is covered separately by asserting every field this module reads is
 * declared in schema.prisma (see "schema fields exist" at the bottom).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildRouteMap, assertReturnAllowed, assertCreditMemoAllowed,
} = require('../utils/routeMap');

// node:test drives this suite so `npm run test:unit` picks it up: the shared
// runner (src/tests/run.js) parses each child's TAP summary, and a bespoke
// harness reports no summary and is counted as a dead suite.
const testAsync = test;

// --- the fake -------------------------------------------------------------

/** Does a row satisfy a Prisma-style where clause? Only what routeMap uses. */
function matches(row, where) {
  return Object.entries(where || {}).every(([field, cond]) => {
    if (cond && typeof cond === 'object' && 'notIn' in cond) {
      return !cond.notIn.includes(row[field]);
    }
    // `in` — how the walk collects children across every parent at a stage
    // (all GRNs of a PO, all challans of an order), so one fan-out branch is
    // not silently dropped. Without this the fake matched nothing and the
    // chain appeared to stop one stage early.
    if (cond && typeof cond === 'object' && 'in' in cond) {
      return cond.in.includes(row[field]);
    }
    // `applications: { some: {...} }` — how a payment's join to the invoices
    // it settles is expressed (payments are not a single foreign key, one
    // payment can apply against several invoices at once).
    if (cond && typeof cond === 'object' && 'some' in cond) {
      return (row[field] || []).some((child) => matches(child, cond.some));
    }
    return row[field] === cond;
  });
}

function table(rows) {
  return {
    findFirst: async ({ where }) => rows.find((r) => matches(r, where)) || null,
    findMany: async ({ where }) => rows.filter((r) => matches(r, where)),
    findUnique: async ({ where }) => rows.find((r) => r.id === where.id) || null,
  };
}

function makeDb(data) {
  return {
    enquiry: table(data.enquiries || []),
    salesQuotation: table(data.salesQuotations || []),
    salesOrder: table(data.salesOrders || []),
    deliveryChallan: table(data.challans || []),
    salesInvoice: table(data.salesInvoices || []),
    salesReturn: table(data.salesReturns || []),
    salesCreditMemo: table(data.salesCreditMemos || []),
    purchaseQuotation: table(data.purchaseQuotations || []),
    purchaseOrder: table(data.purchaseOrders || []),
    goodsReceivedNote: table(data.grns || []),
    purchaseInvoice: table(data.purchaseInvoices || []),
    purchaseReturn: table(data.purchaseReturns || []),
    purchaseCreditMemo: table(data.purchaseCreditMemos || []),
    paymentReceipt: table(data.paymentReceipts || []),
    paymentVoucher: table(data.paymentVouchers || []),
    customer: table(data.customers || []),
    supplier: table(data.suppliers || []),
  };
}

// --- a complete sales chain ------------------------------------------------

const SALES = {
  customers: [{ id: 1, customerCode: 'C001', customerName: 'Kaefer Insulation LLC' }],
  enquiries: [{
    id: 1, enquiryNo: 'SE/26/0130', enquiryDate: '2026-07-05',
    customerName: 'Kaefer Insulation LLC', expectedBudget: 14.332, status: 'New',
  }],
  salesQuotations: [{
    id: 1, quotationNo: 'SQ/26/0130', enquiryNo: 'SE/26/0130',
    quotationDate: '2026-07-05', amount: 119.7, status: 'Sent',
    customer: 'Kaefer Insulation LLC',
  }],
  salesOrders: [{
    id: 1, orderNo: 'SO/26/0065', quotationNo: 'SQ/26/0130',
    orderDate: '2026-07-05', amount: 119.7, status: 'Open',
    customer: 'Kaefer Insulation LLC',
  }],
  challans: [{
    id: 1, challanNo: 'DO-2026-0053', orderNo: 'SO/26/0065',
    challanDate: '2026-07-05', amount: 119.7, status: 'Delivered',
    customer: 'Kaefer Insulation LLC',
  }],
  salesInvoices: [{
    id: 1, invoiceNo: 'MST-INV-2026-0140', deliveryChallanNo: 'DO-2026-0053',
    orderNo: 'SO/26/0065', invoiceDate: '2026-07-06', amount: 119.7, status: 'Posted',
    customer: 'Kaefer Insulation LLC',
  }],
};

const EXPECTED_SALES_NOS = [
  'SE/26/0130', 'SQ/26/0130', 'SO/26/0065', 'DO-2026-0053', 'MST-INV-2026-0140',
];

const db = makeDb(SALES);

// The whole point of the feature: the same chain from any anchor.
for (const [type, no] of [
  ['enquiry', 'SE/26/0130'],
  ['quotation', 'SQ/26/0130'],
  ['order', 'SO/26/0065'],
  ['challan', 'DO-2026-0053'],
  ['invoice', 'MST-INV-2026-0140'],
]) {
  testAsync(`sales chain resolves identically from ${type}`, async () => {
    const map = await buildRouteMap(db, 'sales', { type, no });
    assert.deepStrictEqual(map.stages.map((s) => s.docNo), EXPECTED_SALES_NOS);
    assert.strictEqual(map.partner.code, 'C001');
    assert.strictEqual(map.partner.name, 'Kaefer Insulation LLC');
    assert.strictEqual(map.partner.kind, 'Customer');
    assert.ok(map.stages.every((s) => s.present));
  });
}

testAsync('sales stages carry date, total and status', async () => {
  const map = await buildRouteMap(db, 'sales', { type: 'invoice', no: 'MST-INV-2026-0140' });
  const [enq, quo, , , inv] = map.stages;
  assert.strictEqual(enq.docTotal, 14.332, 'enquiry total comes from expectedBudget');
  assert.strictEqual(quo.docTotal, 119.7);
  assert.strictEqual(inv.status, 'Posted');
  assert.strictEqual(inv.docDate, '2026-07-06');
});

testAsync('an invoiced chain closes returns and opens credit memos', async () => {
  const map = await buildRouteMap(db, 'sales', { type: 'order', no: 'SO/26/0065' });
  assert.strictEqual(map.branch.invoiced, true);
  assert.strictEqual(map.branch.returnAllowed, false);
  assert.strictEqual(map.branch.creditMemoAllowed, true);
});

testAsync('an uninvoiced chain opens returns and closes credit memos', async () => {
  const noInvoice = makeDb({ ...SALES, salesInvoices: [] });
  const map = await buildRouteMap(noInvoice, 'sales', { type: 'challan', no: 'DO-2026-0053' });
  assert.strictEqual(map.branch.invoiced, false);
  assert.strictEqual(map.branch.returnAllowed, true);
  assert.strictEqual(map.branch.creditMemoAllowed, false);
  // The invoice stage is still drawn, just empty.
  assert.strictEqual(map.stages[4].docNo, null);
  assert.strictEqual(map.stages[4].present, false);
});

testAsync('a draft invoice does not count as invoiced', async () => {
  const draft = makeDb({
    ...SALES,
    salesInvoices: [{ ...SALES.salesInvoices[0], status: 'Draft' }],
  });
  const map = await buildRouteMap(draft, 'sales', { type: 'challan', no: 'DO-2026-0053' });
  assert.strictEqual(map.branch.invoiced, false, 'a draft has not been issued');
  assert.strictEqual(map.branch.returnAllowed, true);
});

testAsync('the map resolves upward from a return', async () => {
  const withReturn = makeDb({
    ...SALES,
    salesInvoices: [],
    salesReturns: [{
      id: 1, returnNo: 'SRT/26/0001', challanNo: 'DO-2026-0053',
      documentDate: '2026-07-07', amount: 20, status: 'Open',
      customer: 'Kaefer Insulation LLC',
    }],
  });
  const map = await buildRouteMap(withReturn, 'sales', { type: 'return', no: 'SRT/26/0001' });
  assert.deepStrictEqual(
    map.stages.map((s) => s.docNo),
    ['SE/26/0130', 'SQ/26/0130', 'SO/26/0065', 'DO-2026-0053', null]
  );
  assert.strictEqual(map.branch.returnDoc.docNo, 'SRT/26/0001');
});

testAsync('the map resolves upward from a credit memo', async () => {
  const withMemo = makeDb({
    ...SALES,
    salesCreditMemos: [{
      id: 1, creditNo: 'SCM/26/0001', invoiceNo: 'MST-INV-2026-0140',
      documentDate: '2026-07-08', amount: 30, status: 'Open',
      customer: 'Kaefer Insulation LLC',
    }],
  });
  const map = await buildRouteMap(withMemo, 'sales', { type: 'creditMemo', no: 'SCM/26/0001' });
  assert.deepStrictEqual(map.stages.map((s) => s.docNo), EXPECTED_SALES_NOS);
  assert.strictEqual(map.branch.creditMemoDoc.docNo, 'SCM/26/0001');
});

testAsync('the map resolves an incoming payment applied against the invoice', async () => {
  const withPayment = makeDb({
    ...SALES,
    paymentReceipts: [{
      id: 1, paymentReceiptNo: 'PR/26/0001', partyType: 'Customer',
      partyName: 'Kaefer Insulation LLC', postingDate: '2026-07-09',
      appliedAmount: 119.7, status: 'Posted',
      applications: [{ invoiceNo: 'MST-INV-2026-0140', amountApplied: 119.7 }],
    }],
  });
  const map = await buildRouteMap(withPayment, 'sales', { type: 'invoice', no: 'MST-INV-2026-0140' });
  assert.strictEqual(map.branch.paymentDoc.docNo, 'PR/26/0001');
  assert.strictEqual(map.branch.paymentDoc.stage, 'Incoming Payment');
  assert.strictEqual(map.branch.paymentDoc.parentNo, 'MST-INV-2026-0140');
  assert.deepStrictEqual(map.branch.paymentDocs.map((d) => d.docNo), ['PR/26/0001']);
});

testAsync('a payment against a different invoice does not appear on this chain', async () => {
  const unrelated = makeDb({
    ...SALES,
    paymentReceipts: [{
      id: 1, paymentReceiptNo: 'PR/26/0002', partyType: 'Customer',
      partyName: 'Someone Else', postingDate: '2026-07-09',
      appliedAmount: 50, status: 'Posted',
      applications: [{ invoiceNo: 'MST-INV-9999', amountApplied: 50 }],
    }],
  });
  const map = await buildRouteMap(unrelated, 'sales', { type: 'invoice', no: 'MST-INV-2026-0140' });
  assert.strictEqual(map.branch.paymentDoc, null);
});

testAsync('a one-step sale (invoice off the order, no challan) still links', async () => {
  const oneStep = makeDb({
    ...SALES,
    challans: [],
    salesInvoices: [{
      id: 1, invoiceNo: 'MST-INV-2026-0140', deliveryChallanNo: null,
      orderNo: 'SO/26/0065', invoiceDate: '2026-07-06', amount: 119.7,
      status: 'Posted', customer: 'Kaefer Insulation LLC',
    }],
  });
  const map = await buildRouteMap(oneStep, 'sales', { type: 'quotation', no: 'SQ/26/0130' });
  assert.strictEqual(map.stages[3].docNo, null, 'no challan stage');
  assert.strictEqual(map.stages[4].docNo, 'MST-INV-2026-0140', 'invoice found via the order');
});

testAsync('legacy rows with no enquiry/quotation link degrade, not crash', async () => {
  const legacy = makeDb({
    ...SALES,
    salesQuotations: [{ ...SALES.salesQuotations[0], enquiryNo: null }],
    salesOrders: [{ ...SALES.salesOrders[0], quotationNo: null }],
  });
  const map = await buildRouteMap(legacy, 'sales', { type: 'invoice', no: 'MST-INV-2026-0140' });
  assert.deepStrictEqual(
    map.stages.map((s) => s.docNo),
    [null, null, 'SO/26/0065', 'DO-2026-0053', 'MST-INV-2026-0140']
  );
});

testAsync('fan-out is reported, not hidden', async () => {
  const fanOut = makeDb({
    ...SALES,
    challans: [
      SALES.challans[0],
      { id: 2, challanNo: 'DO-2026-0054', orderNo: 'SO/26/0065', amount: 50, status: 'Delivered', customer: 'Kaefer Insulation LLC' },
    ],
    salesInvoices: [],
  });
  const map = await buildRouteMap(fanOut, 'sales', { type: 'order', no: 'SO/26/0065' });
  assert.strictEqual(map.stages[3].moreCount, 1, 'second challan is counted');
});

testAsync('an unknown document number yields an empty, non-crashing map', async () => {
  const map = await buildRouteMap(db, 'sales', { type: 'invoice', no: 'NOPE-1' });
  assert.ok(map.stages.every((s) => !s.present));
  assert.strictEqual(map.partner, null);
});

// --- purchase ------------------------------------------------------------

const PURCHASE = {
  suppliers: [{ id: 1, supplierCode: 'S001', supplierName: 'Acme Supplies' }],
  purchaseQuotations: [{ id: 1, quotationNo: 'PQ/26/0001', quotationDate: '2026-07-01', amount: 500, status: 'Open', supplier: 'Acme Supplies' }],
  // The purchase side holds the quotation in `referenceNo`, not a column of
  // its own — the walk has to know that.
  purchaseOrders: [{ id: 1, poNo: 'PO/26/0007', referenceNo: 'PQ/26/0001', poDate: '2026-07-02', amount: 500, status: 'Open', supplier: 'Acme Supplies' }],
  grns: [{ id: 1, grnNo: 'GRN/26/0009', poNo: 'PO/26/0007', receivedDate: '2026-07-03', amount: 500, status: 'Received', supplier: 'Acme Supplies' }],
  purchaseInvoices: [{ id: 1, invoiceNo: 'PI/26/0011', grnNo: 'GRN/26/0009', poNo: 'PO/26/0007', invoiceDate: '2026-07-04', amount: 500, status: 'Posted', supplier: 'Acme Supplies' }],
};
const pdb = makeDb(PURCHASE);
const EXPECTED_PURCHASE_NOS = ['PQ/26/0001', 'PO/26/0007', 'GRN/26/0009', 'PI/26/0011'];

for (const [type, no] of [
  ['quotation', 'PQ/26/0001'],
  ['order', 'PO/26/0007'],
  ['grn', 'GRN/26/0009'],
  ['invoice', 'PI/26/0011'],
]) {
  testAsync(`purchase chain resolves identically from ${type}`, async () => {
    const map = await buildRouteMap(pdb, 'purchase', { type, no });
    assert.deepStrictEqual(map.stages.map((s) => s.docNo), EXPECTED_PURCHASE_NOS);
    assert.strictEqual(map.partner.code, 'S001');
    assert.strictEqual(map.partner.kind, 'Supplier');
  });
}

testAsync('purchase branch flags follow the invoice', async () => {
  const map = await buildRouteMap(pdb, 'purchase', { type: 'grn', no: 'GRN/26/0009' });
  assert.strictEqual(map.branch.invoiced, true);
  assert.strictEqual(map.branch.returnAllowed, false);
  assert.strictEqual(map.branch.creditMemoAllowed, true);

  const open = makeDb({ ...PURCHASE, purchaseInvoices: [] });
  const map2 = await buildRouteMap(open, 'purchase', { type: 'grn', no: 'GRN/26/0009' });
  assert.strictEqual(map2.branch.returnAllowed, true);
  assert.strictEqual(map2.branch.creditMemoAllowed, false);
});

testAsync('the map resolves an outgoing payment applied against the invoice', async () => {
  const withPayment = makeDb({
    ...PURCHASE,
    paymentVouchers: [{
      id: 1, paymentVoucherNo: 'PV/26/0001', partyType: 'Vendor',
      partyName: 'Acme Supplies', postingDate: '2026-07-09',
      appliedAmount: 500, status: 'Posted',
      applications: [{ invoiceNo: 'PI/26/0011', amountApplied: 500 }],
    }],
  });
  const map = await buildRouteMap(withPayment, 'purchase', { type: 'invoice', no: 'PI/26/0011' });
  assert.strictEqual(map.branch.paymentDoc.docNo, 'PV/26/0001');
  assert.strictEqual(map.branch.paymentDoc.stage, 'Outgoing Payment');
  assert.strictEqual(map.branch.paymentDoc.parentNo, 'PI/26/0011');
});

// --- the write guards ----------------------------------------------------

const expectReject = async (fn, fragment) => {
  let threw = null;
  try { await fn(); } catch (e) { threw = e; }
  assert.ok(threw, 'expected a rejection but the call succeeded');
  assert.strictEqual(threw.status, 400);
  assert.ok(
    threw.message.includes(fragment),
    `message should mention "${fragment}" but was: ${threw.message}`
  );
};

testAsync('a return against an invoiced challan is refused, and says why', async () => {
  await expectReject(
    () => assertReturnAllowed(db, { kind: 'sales', docNo: 'DO-2026-0053' }),
    'Sales Credit Memo'
  );
});

testAsync('a return against an uninvoiced challan is allowed', async () => {
  const open = makeDb({ ...SALES, salesInvoices: [] });
  await assertReturnAllowed(open, { kind: 'sales', docNo: 'DO-2026-0053' });
});

testAsync('a return with no challan behind it is left alone', async () => {
  await assertReturnAllowed(db, { kind: 'sales', docNo: null });
  await assertReturnAllowed(db, { kind: 'sales', docNo: '' });
});

testAsync('editing a return without moving it stays allowed after invoicing', async () => {
  // The case that would otherwise freeze a legitimately raised return.
  await assertReturnAllowed(db, {
    kind: 'sales', docNo: 'DO-2026-0053', unchangedFrom: 'DO-2026-0053',
  });
});

testAsync('re-pointing a return at an invoiced challan is still refused', async () => {
  await expectReject(
    () => assertReturnAllowed(db, {
      kind: 'sales', docNo: 'DO-2026-0053', unchangedFrom: 'DO-2026-0099',
    }),
    'can no longer be returned'
  );
});

testAsync('a draft invoice does not block a return', async () => {
  const draft = makeDb({
    ...SALES, salesInvoices: [{ ...SALES.salesInvoices[0], status: 'Draft' }],
  });
  await assertReturnAllowed(draft, { kind: 'sales', docNo: 'DO-2026-0053' });
});

testAsync('a cancelled invoice does not block a return', async () => {
  const cancelled = makeDb({
    ...SALES, salesInvoices: [{ ...SALES.salesInvoices[0], status: 'Cancelled' }],
  });
  await assertReturnAllowed(cancelled, { kind: 'sales', docNo: 'DO-2026-0053' });
});

testAsync('a purchase return against an invoiced GRN is refused', async () => {
  await expectReject(
    () => assertReturnAllowed(pdb, { kind: 'purchase', docNo: 'GRN/26/0009' }),
    'Purchase Credit Memo'
  );
});

testAsync('a credit memo with no invoice is refused', async () => {
  await expectReject(
    () => assertCreditMemoAllowed(db, { kind: 'sales', invoiceNo: null }),
    'must be raised against an invoice'
  );
  await expectReject(
    () => assertCreditMemoAllowed(db, { kind: 'sales', invoiceNo: '   ' }),
    'must be raised against an invoice'
  );
});

testAsync('a credit memo against an unknown invoice is refused', async () => {
  await expectReject(
    () => assertCreditMemoAllowed(db, { kind: 'sales', invoiceNo: 'NOPE-1' }),
    'does not exist'
  );
});

testAsync('a credit memo against a cancelled invoice is refused', async () => {
  const cancelled = makeDb({
    ...SALES, salesInvoices: [{ ...SALES.salesInvoices[0], status: 'Cancelled' }],
  });
  await expectReject(
    () => assertCreditMemoAllowed(cancelled, { kind: 'sales', invoiceNo: 'MST-INV-2026-0140' }),
    'nothing left to credit'
  );
});

testAsync('a credit memo against a live invoice is allowed', async () => {
  await assertCreditMemoAllowed(db, { kind: 'sales', invoiceNo: 'MST-INV-2026-0140' });
  await assertCreditMemoAllowed(pdb, { kind: 'purchase', invoiceNo: 'PI/26/0011' });
});

// --- the fake cannot catch a wrong column name; this can -----------------

test('every column the walk reads exists in schema.prisma', () => {
  const schema = fs.readFileSync(
    path.join(__dirname, '..', 'prisma', 'schema.prisma'), 'utf8'
  );
  const modelBody = (name) => {
    const m = schema.match(new RegExp(`^model ${name} \\{([\\s\\S]*?)^\\}`, 'm'));
    assert.ok(m, `model ${name} not found in schema.prisma`);
    return m[1];
  };
  const REQUIRED = {
    Enquiry: ['enquiryNo', 'enquiryDate', 'expectedBudget', 'customerName', 'status'],
    SalesQuotation: ['quotationNo', 'enquiryNo', 'quotationDate', 'amount', 'status', 'customer'],
    SalesOrder: ['orderNo', 'quotationNo', 'orderDate', 'amount', 'status', 'customer'],
    DeliveryChallan: ['challanNo', 'orderNo', 'challanDate', 'amount', 'status', 'customer'],
    SalesInvoice: ['invoiceNo', 'deliveryChallanNo', 'orderNo', 'invoiceDate', 'amount', 'status', 'customer'],
    SalesReturn: ['returnNo', 'challanNo', 'documentDate', 'amount', 'status', 'customer'],
    SalesCreditMemo: ['creditNo', 'invoiceNo', 'documentDate', 'amount', 'status', 'customer'],
    PurchaseQuotation: ['quotationNo', 'quotationDate', 'amount', 'status', 'supplier'],
    PurchaseOrder: ['poNo', 'referenceNo', 'poDate', 'amount', 'status', 'supplier'],
    GoodsReceivedNote: ['grnNo', 'poNo', 'receivedDate', 'amount', 'status', 'supplier'],
    PurchaseInvoice: ['invoiceNo', 'grnNo', 'poNo', 'invoiceDate', 'amount', 'status', 'supplier'],
    PurchaseReturn: ['returnNo', 'grnNo', 'documentDate', 'amount', 'status', 'supplier'],
    PurchaseCreditMemo: ['creditNo', 'invoiceNo', 'documentDate', 'amount', 'status', 'supplier'],
    Customer: ['customerCode', 'customerName'],
    Supplier: ['supplierCode', 'supplierName'],
    PaymentReceipt: ['paymentReceiptNo', 'postingDate', 'documentDate', 'appliedAmount', 'status', 'applications'],
    PaymentVoucher: ['paymentVoucherNo', 'postingDate', 'documentDate', 'appliedAmount', 'status', 'applications'],
    PaymentReceiptApplication: ['invoiceNo'],
    PaymentVoucherApplication: ['invoiceNo'],
  };
  for (const [model, fields] of Object.entries(REQUIRED)) {
    const body = modelBody(model);
    for (const field of fields) {
      assert.ok(
        new RegExp(`^\\s*${field}\\s`, 'm').test(body),
        `${model}.${field} is read by routeMap.js but is not in schema.prisma`
      );
    }
  }
});


// --- fan-out: several documents at one stage --------------------------------
//
// The real shape a chain takes when a PO is received on two GRNs and each GRN
// is billed on its own invoice:
//
//                        |--> GRN-1 --> INV-1
//   PQ --> PO -----------|
//                        |--> GRN-2 --> INV-2
//
// Every one of those documents has to appear, each joined to the document it
// was actually raised from. Collapsing the second branch into a "+1 more"
// count (what the map used to do) loses which invoice came from which GRN.

const FANOUT = {
  suppliers: [{ id: 1, supplierCode: 'S001', supplierName: 'Acme Supplies' }],
  purchaseQuotations: [{
    id: 1, quotationNo: 'PQ-1', quotationDate: '2026-07-01', amount: 100,
    status: 'Sent', supplier: 'Acme Supplies',
  }],
  purchaseOrders: [{
    id: 1, poNo: 'PO-1', referenceNo: 'PQ-1', poDate: '2026-07-02', amount: 100,
    status: 'Open', supplier: 'Acme Supplies',
  }],
  grns: [
    {
      id: 1, grnNo: 'GRN-1', poNo: 'PO-1', receivedDate: '2026-07-03', amount: 60,
      status: 'Received', supplier: 'Acme Supplies',
    },
    {
      id: 2, grnNo: 'GRN-2', poNo: 'PO-1', receivedDate: '2026-07-04', amount: 40,
      status: 'Received', supplier: 'Acme Supplies',
    },
  ],
  purchaseInvoices: [
    {
      id: 1, invoiceNo: 'PI-1', grnNo: 'GRN-1', poNo: 'PO-1',
      invoiceDate: '2026-07-05', amount: 60, status: 'Posted', supplier: 'Acme Supplies',
    },
    {
      id: 2, invoiceNo: 'PI-2', grnNo: 'GRN-2', poNo: 'PO-1',
      invoiceDate: '2026-07-06', amount: 40, status: 'Posted', supplier: 'Acme Supplies',
    },
  ],
};

const fanoutDb = makeDb(FANOUT);

testAsync('a stage that fanned out reports every document, not just the first', async () => {
  const map = await buildRouteMap(fanoutDb, 'purchase', { type: 'order', no: 'PO-1' });
  const [, , grnStage, invStage] = map.stages;

  assert.deepStrictEqual(grnStage.docs.map((d) => d.docNo), ['GRN-1', 'GRN-2']);
  assert.deepStrictEqual(invStage.docs.map((d) => d.docNo), ['PI-1', 'PI-2']);
});

testAsync('each fanned-out document names the parent it was raised from', async () => {
  const map = await buildRouteMap(fanoutDb, 'purchase', { type: 'order', no: 'PO-1' });
  const [, , grnStage, invStage] = map.stages;

  // Both GRNs hang off the one PO.
  assert.deepStrictEqual(grnStage.docs.map((d) => d.parentNo), ['PO-1', 'PO-1']);
  // Each invoice hangs off its OWN GRN — this is what makes it a tree rather
  // than two unrelated columns.
  assert.deepStrictEqual(invStage.docs.map((d) => d.parentNo), ['GRN-1', 'GRN-2']);
});

testAsync('the fan-out is found from any anchor, including a leaf invoice', async () => {
  const map = await buildRouteMap(fanoutDb, 'purchase', { type: 'invoice', no: 'PI-2' });
  const [, , grnStage, invStage] = map.stages;

  assert.deepStrictEqual(grnStage.docs.map((d) => d.docNo), ['GRN-1', 'GRN-2']);
  assert.deepStrictEqual(invStage.docs.map((d) => d.docNo), ['PI-1', 'PI-2']);
});

testAsync('a stage with one document still reports it in docs', async () => {
  const map = await buildRouteMap(db, 'sales', { type: 'invoice', no: 'MST-INV-2026-0140' });
  assert.ok(map.stages.every((s) => s.docs.length === 1));
  assert.ok(map.stages.every((s) => s.moreCount === 0));
});
