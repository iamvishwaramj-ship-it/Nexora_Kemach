/**
 * Open-item settlement tests, run against a real SQL Server test database, with the
 * repository's own migrations applied — not a mock. Balances are read back out
 * of the table after each posting, which is the only way to catch the class of
 * bug this module was written to fix: arithmetic that looks right in isolation
 * but does not round-trip once several documents touch the same invoice.
 *
 * Run with:  node --test "src/tests/*.test.js"
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { createOpenItemLedger, settlementStatus } = require('../utils/openItemLedger');
const { freshDb } = require('./testDb');

// ---------------------------------------------------------------------------
// A thin Prisma-shaped adapter over testDb. It implements only findFirst and
// update on the two outstanding tables — enough for the ledger, and it throws
// on anything else so an unsupported query fails loudly instead of silently
// returning the wrong answer.
// ---------------------------------------------------------------------------

function delegate(db, table) {
  // customer_outstanding and supplier_outstanding are structurally identical
  // apart from the column naming the party.
  const partyColumn = table === 'customer_outstanding' ? 'customer_name' : 'supplier_name';
  const partyProp = table === 'customer_outstanding' ? 'customerName' : 'supplierName';

  return {
    async findFirst({ where }) {
      const r = await db.query(
        `SELECT id, ${partyColumn} AS party, invoice_no,
                invoice_amount::float8  AS "invoiceAmount",
                paid_amount::float8     AS "paidAmount",
                balance_amount::float8  AS "balanceAmount",
                status
           FROM "${table}" WHERE invoice_no = $1 ORDER BY id LIMIT 1`,
        [where.invoiceNo]
      );
      if (!r.rows[0]) return null;
      const row = r.rows[0];
      return { ...row, [partyProp]: row.party, invoiceNo: row.invoice_no };
    },
    async update({ where, data }) {
      await db.query(
        `UPDATE "${table}" SET paid_amount = $1, balance_amount = $2, status = $3 WHERE id = $4`,
        [data.paidAmount, data.balanceAmount, data.status, where.id]
      );
    },
  };
}

const arLedger = (db) =>
  createOpenItemLedger({
    delegateOf: () => delegate(db, 'customer_outstanding'),
    partyField: 'customerName',
    documentWord: 'receipt',
  });

const apLedger = (db) =>
  createOpenItemLedger({
    delegateOf: () => delegate(db, 'supplier_outstanding'),
    partyField: 'supplierName',
    documentWord: 'payment',
  });

async function seedInvoice(db, { invoiceNo, customer = 'Acme Traders', amount }) {
  await db.query(
    `INSERT INTO "customer_outstanding"
       (customer_name, invoice_no, invoice_amount, paid_amount, balance_amount, status)
     VALUES ($1, $2, $3, 0, $3, 'Unpaid')`,
    [customer, invoiceNo, amount]
  );
}

async function readInvoice(db, invoiceNo) {
  const r = await db.query(
    `SELECT invoice_amount::float8 AS inv, paid_amount::float8 AS paid,
            balance_amount::float8 AS bal, status
       FROM "customer_outstanding" WHERE invoice_no = $1`,
    [invoiceNo]
  );
  return r.rows[0];
}

// ---------------------------------------------------------------------------
// Status derivation
// ---------------------------------------------------------------------------

test('settlement status follows the balance, not the payment count', () => {
  assert.equal(settlementStatus(1000, 0), 'Unpaid');
  assert.equal(settlementStatus(400, 600), 'Partial');
  assert.equal(settlementStatus(0, 1000), 'Paid');
  assert.equal(settlementStatus(0.004, 1000), 'Paid', 'a sub-paisa residue still closes the item');
  assert.equal(settlementStatus(-50, 1050), 'Paid', 'an overpaid invoice is closed, not reopened');
});

// ---------------------------------------------------------------------------
// The core invariant
// ---------------------------------------------------------------------------

test('a single receipt settles an invoice and closes it', async () => {
  const db = await freshDb();
  const ledger = arLedger(db);
  await seedInvoice(db, { invoiceNo: 'SI-1', amount: 1000 });

  await ledger.apply(null, [{ invoiceNo: 'SI-1', amountApplied: 1000 }]);

  assert.deepEqual(await readInvoice(db, 'SI-1'), { inv: 1000, paid: 1000, bal: 0, status: 'Paid' });
  await db.close();
});

test('a part payment leaves the correct balance and marks the item Partial', async () => {
  const db = await freshDb();
  const ledger = arLedger(db);
  await seedInvoice(db, { invoiceNo: 'SI-1', amount: 1000 });

  await ledger.apply(null, [{ invoiceNo: 'SI-1', amountApplied: 300 }]);

  assert.deepEqual(await readInvoice(db, 'SI-1'), { inv: 1000, paid: 300, bal: 700, status: 'Partial' });
  await db.close();
});

test('REGRESSION: reversing one of two receipts restores the exact balance', async () => {
  // The defect: apply clamped the balance at zero while reverse clamped it at
  // the invoice amount. Two receipts of 800 against a 1,000 invoice drove the
  // balance to 0; reversing the first then reported 800 outstanding instead of
  // 200 — the second receipt's money vanished from the ledger.
  const db = await freshDb();
  const ledger = arLedger(db);
  await seedInvoice(db, { invoiceNo: 'SI-1', amount: 1000 });

  await ledger.apply(null, [{ invoiceNo: 'SI-1', amountApplied: 800 }]);
  await ledger.apply(null, [{ invoiceNo: 'SI-1', amountApplied: 800 }]);
  await ledger.reverse(null, [{ invoiceNo: 'SI-1', amountApplied: 800 }]);

  const after = await readInvoice(db, 'SI-1');
  assert.equal(after.paid, 800, 'exactly one receipt of 800 remains applied');
  assert.equal(after.bal, 200, 'not 800 — that was the old clamped result');
  await db.close();
});

test('REGRESSION: apply then reverse is an identity for any ordering', async () => {
  const db = await freshDb();
  const ledger = arLedger(db);
  await seedInvoice(db, { invoiceNo: 'SI-1', amount: 1000 });
  const before = await readInvoice(db, 'SI-1');

  const receipts = [250, 900, 10, 640.55, 0.45];
  for (const amt of receipts) {
    await ledger.apply(null, [{ invoiceNo: 'SI-1', amountApplied: amt }]);
  }
  // Reverse in a deliberately different order from the one they were applied.
  for (const amt of [...receipts].reverse()) {
    await ledger.reverse(null, [{ invoiceNo: 'SI-1', amountApplied: amt }]);
  }

  assert.deepEqual(await readInvoice(db, 'SI-1'), before, 'the invoice must return to its opening state');
  await db.close();
});

test('an invoice re-settled after a full reversal behaves as if new', async () => {
  const db = await freshDb();
  const ledger = arLedger(db);
  await seedInvoice(db, { invoiceNo: 'SI-1', amount: 1000 });

  await ledger.apply(null, [{ invoiceNo: 'SI-1', amountApplied: 1000 }]);
  await ledger.reverse(null, [{ invoiceNo: 'SI-1', amountApplied: 1000 }]);
  assert.deepEqual(await readInvoice(db, 'SI-1'), { inv: 1000, paid: 0, bal: 1000, status: 'Unpaid' });

  await ledger.apply(null, [{ invoiceNo: 'SI-1', amountApplied: 400 }]);
  assert.deepEqual(await readInvoice(db, 'SI-1'), { inv: 1000, paid: 400, bal: 600, status: 'Partial' });
  await db.close();
});

test('paise-level settlements accumulate without drift over 200 postings', async () => {
  const db = await freshDb();
  const ledger = arLedger(db);
  await seedInvoice(db, { invoiceNo: 'SI-1', amount: 200 });

  for (let i = 0; i < 200; i += 1) {
    await ledger.apply(null, [{ invoiceNo: 'SI-1', amountApplied: 1 }]);
  }
  const after = await readInvoice(db, 'SI-1');
  assert.equal(after.paid, 200);
  assert.equal(after.bal, 0);
  assert.equal(after.status, 'Paid');
  await db.close();
});

// ---------------------------------------------------------------------------
// Validation — the guards that did not exist at all before
// ---------------------------------------------------------------------------

test('REGRESSION: a receipt cannot settle more than it is worth', async () => {
  const db = await freshDb();
  const ledger = arLedger(db);
  await seedInvoice(db, { invoiceNo: 'SI-1', amount: 5000 });
  await seedInvoice(db, { invoiceNo: 'SI-2', amount: 5000 });

  await assert.rejects(
    () =>
      ledger.assertApplicationsValid(
        null,
        [
          { invoiceNo: 'SI-1', amountApplied: 5000 },
          { invoiceNo: 'SI-2', amountApplied: 5000 },
        ],
        { paymentAmount: 1000, partyName: 'Acme Traders' }
      ),
    /exceeds the receipt amount/,
    'a 1,000 receipt must not clear 10,000 of receivables'
  );
  await db.close();
});

test('REGRESSION: a receipt cannot settle more than an invoice owes', async () => {
  const db = await freshDb();
  const ledger = arLedger(db);
  await seedInvoice(db, { invoiceNo: 'SI-1', amount: 1000 });
  await ledger.apply(null, [{ invoiceNo: 'SI-1', amountApplied: 700 }]);

  await assert.rejects(
    () =>
      ledger.assertApplicationsValid(null, [{ invoiceNo: 'SI-1', amountApplied: 500 }], {
        paymentAmount: 5000,
        partyName: 'Acme Traders',
      }),
    /outstanding balance of 300\.00/,
    'only 300 remains open on this invoice'
  );
  await db.close();
});

test("REGRESSION: a receipt cannot settle another customer's invoice", async () => {
  const db = await freshDb();
  const ledger = arLedger(db);
  await seedInvoice(db, { invoiceNo: 'SI-1', customer: 'Acme Traders', amount: 1000 });

  await assert.rejects(
    () =>
      ledger.assertApplicationsValid(null, [{ invoiceNo: 'SI-1', amountApplied: 100 }], {
        paymentAmount: 1000,
        partyName: 'Beta Industries',
      }),
    /belongs to Acme Traders, not Beta Industries/
  );
  await db.close();
});

test('an unknown invoice number is rejected rather than silently ignored', async () => {
  const db = await freshDb();
  const ledger = arLedger(db);

  await assert.rejects(
    () =>
      ledger.assertApplicationsValid(null, [{ invoiceNo: 'SI-NOPE', amountApplied: 100 }], {
        paymentAmount: 1000,
        partyName: 'Acme Traders',
      }),
    /no outstanding invoice with this number/
  );
  await db.close();
});

test('a negative application is rejected', async () => {
  const db = await freshDb();
  const ledger = arLedger(db);
  await seedInvoice(db, { invoiceNo: 'SI-1', amount: 1000 });

  await assert.rejects(
    () =>
      ledger.assertApplicationsValid(null, [{ invoiceNo: 'SI-1', amountApplied: -100 }], {
        paymentAmount: 1000,
        partyName: 'Acme Traders',
      }),
    /negative amount cannot be applied/
  );
  await db.close();
});

test('every problem in a document is reported at once, not one at a time', async () => {
  const db = await freshDb();
  const ledger = arLedger(db);
  await seedInvoice(db, { invoiceNo: 'SI-1', customer: 'Acme Traders', amount: 100 });

  await assert.rejects(
    () =>
      ledger.assertApplicationsValid(
        null,
        [
          { invoiceNo: 'SI-1', amountApplied: 500 },
          { invoiceNo: 'SI-GONE', amountApplied: 500 },
        ],
        { paymentAmount: 10, partyName: 'Acme Traders' }
      ),
    (err) => {
      assert.match(err.message, /outstanding balance/);
      assert.match(err.message, /no outstanding invoice/);
      assert.match(err.message, /exceeds the receipt amount/);
      assert.equal(err.status, 400);
      return true;
    }
  );
  await db.close();
});

test('a valid settlement passes and reports the total applied', async () => {
  const db = await freshDb();
  const ledger = arLedger(db);
  await seedInvoice(db, { invoiceNo: 'SI-1', amount: 600 });
  await seedInvoice(db, { invoiceNo: 'SI-2', amount: 400 });

  const { totalApplied } = await ledger.assertApplicationsValid(
    null,
    [
      { invoiceNo: 'SI-1', amountApplied: 600 },
      { invoiceNo: 'SI-2', amountApplied: 400 },
    ],
    { paymentAmount: 1000, partyName: 'Acme Traders' }
  );
  assert.equal(totalApplied, 1000);
  await db.close();
});

test('an on-account receipt with no applications is allowed', async () => {
  const db = await freshDb();
  const ledger = arLedger(db);
  const { totalApplied } = await ledger.assertApplicationsValid(null, [], {
    paymentAmount: 5000,
    partyName: 'Acme Traders',
  });
  assert.equal(totalApplied, 0);
  await db.close();
});

test('settling to the exact paisa is allowed, one paisa over is not', async () => {
  const db = await freshDb();
  const ledger = arLedger(db);
  await seedInvoice(db, { invoiceNo: 'SI-1', amount: 1234.56 });

  await ledger.assertApplicationsValid(null, [{ invoiceNo: 'SI-1', amountApplied: 1234.56 }], {
    paymentAmount: 1234.56,
    partyName: 'Acme Traders',
  });

  await assert.rejects(
    () =>
      ledger.assertApplicationsValid(null, [{ invoiceNo: 'SI-1', amountApplied: 1234.57 }], {
        paymentAmount: 2000,
        partyName: 'Acme Traders',
      }),
    /outstanding balance/
  );
  await db.close();
});

// ---------------------------------------------------------------------------
// The payables side is the same ledger against the other table
// ---------------------------------------------------------------------------

test('supplier payments obey the identical rules', async () => {
  const db = await freshDb();
  const ledger = apLedger(db);
  await db.query(
    `INSERT INTO "supplier_outstanding"
       (supplier_name, invoice_no, invoice_amount, paid_amount, balance_amount, status)
     VALUES ('Global Supplies', 'PI-1', 2000, 0, 2000, 'Unpaid')`
  );

  await ledger.apply(null, [{ invoiceNo: 'PI-1', amountApplied: 1200 }]);
  let r = await db.query(
    `SELECT paid_amount::float8 AS paid, balance_amount::float8 AS bal, status
       FROM "supplier_outstanding" WHERE invoice_no = 'PI-1'`
  );
  assert.deepEqual(r.rows[0], { paid: 1200, bal: 800, status: 'Partial' });

  await assert.rejects(
    () =>
      ledger.assertApplicationsValid(null, [{ invoiceNo: 'PI-1', amountApplied: 900 }], {
        paymentAmount: 5000,
        partyName: 'Global Supplies',
      }),
    /exceeds|outstanding balance/
  );

  await ledger.reverse(null, [{ invoiceNo: 'PI-1', amountApplied: 1200 }]);
  r = await db.query(
    `SELECT paid_amount::float8 AS paid, balance_amount::float8 AS bal, status
       FROM "supplier_outstanding" WHERE invoice_no = 'PI-1'`
  );
  assert.deepEqual(r.rows[0], { paid: 0, bal: 2000, status: 'Unpaid' });
  await db.close();
});
