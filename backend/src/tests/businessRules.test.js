/**
 * Credit control and master-data integrity, against a real SQL Server test
 * database with the repository's SQL Server baseline migration applied.
 *
 * Both areas had the same shape of defect: the application captured a control
 * and then never applied it. `Customer.creditLimit` was displayed in reports
 * and never checked. Customers, suppliers and products were linked to every
 * transaction by a plain string with no foreign key, so deleting one orphaned
 * its history and renaming one detached it from everything it had ever done.
 *
 * Run with:  node --test "src/tests/*.test.js"
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assertWithinCreditLimit,
  assertNotReferenced,
  cascadeRename,
  assertMasterExists,
  REFERENCE_MAP,
} = require('../utils/businessRules');

const { freshDb } = require('./testDb');

/** Column names for the delegates the rules touch. */
const TABLE_FOR = {
  customer: 'customers', supplier: 'suppliers', product: 'products',
  // Customer Master/Supplier Master are retired — assertWithinCreditLimit
  // now reads Business Partner (see utils/businessRules.js).
  businessPartner: 'business_partners',
  customerOutstanding: 'customer_outstanding', supplierOutstanding: 'supplier_outstanding',
  salesQuotation: 'sales_quotations', salesOrder: 'sales_orders',
  deliveryChallan: 'delivery_challans', salesInvoice: 'sales_invoices',
  collection: 'collections', salesPrice: 'sales_prices', customerDiscount: 'customer_discounts',
  purchaseQuotation: 'purchase_quotations', purchaseOrder: 'purchase_orders',
  goodsReceivedNote: 'goods_received_notes', purchaseInvoice: 'purchase_invoices',
  supplierPayment: 'supplier_payments', purchasePrice: 'purchase_prices',
  salesInvoiceItem: 'sales_invoice_items', salesOrderItem: 'sales_order_items',
  deliveryChallanItem: 'delivery_challan_items', purchaseInvoiceItem: 'purchase_invoice_items',
  purchaseOrderItem: 'purchase_order_items', goodsReceivedNoteItem: 'goods_received_note_items',
  stockReceiptItem: 'stock_receipt_items', stockIssueItem: 'stock_issue_items',
  stockAdjustmentItem: 'stock_adjustment_items',
};

const COLUMN_FOR = {
  customer: 'customer', customerName: 'customer_name', supplier: 'supplier',
  supplierName: 'supplier_name', productCode: 'product_code',
  creditLimit: 'credit_limit', balanceAmount: 'balance_amount',
  invoiceNo: 'invoice_no', status: 'status',
  // Customer Master/Supplier Master are retired — assertMasterExists now
  // looks these up on Business Partner (see REFERENCE_MAP in
  // utils/businessRules.js).
  partnerType: 'partner_type', partnerName: 'partner_name',
};

/** Prisma-shaped adapter over testDb for the query shapes these rules use. */
function buildClient(db) {
  const proxyFor = (delegateName) => {
    const table = TABLE_FOR[delegateName];
    if (!table) throw new Error(`test adapter has no table for ${delegateName}`);
    return {
      async count({ where }) {
        const [key, value] = Object.entries(where)[0];
        const r = await db.query(
          `SELECT COUNT(*)::int AS n FROM "${table}" WHERE ${COLUMN_FOR[key]} = $1`, [value]);
        return r.rows[0].n;
      },
      async updateMany({ where, data }) {
        const [wk, wv] = Object.entries(where)[0];
        const [dk, dv] = Object.entries(data)[0];
        const r = await db.query(
          `UPDATE "${table}" SET ${COLUMN_FOR[dk]} = $1 WHERE ${COLUMN_FOR[wk]} = $2`, [dv, wv]);
        return { count: r.affectedRows ?? 0 };
      },
      async findFirst({ where, select }) {
        const clauses = [];
        const params = [];
        for (const [k, v] of Object.entries(where)) {
          if (v && typeof v === 'object' && 'not' in v) {
            params.push(v.not);
            clauses.push(`${COLUMN_FOR[k]} <> $${params.length}`);
          } else {
            params.push(v);
            clauses.push(`${COLUMN_FOR[k]} = $${params.length}`);
          }
        }
        const r = await db.query(
          `SELECT * FROM "${table}" WHERE ${clauses.join(' AND ')} LIMIT 1`, params);
        if (!r.rows[0]) return null;
        const row = r.rows[0];
        return {
          id: row.id,
          creditLimit: row.credit_limit,
          customerName: row.customer_name,
          supplierName: row.supplier_name,
          productCode: row.product_code,
          status: row.status,
        };
      },
      async findMany({ where, select }) {
        const clauses = [];
        const params = [];
        for (const [k, v] of Object.entries(where)) {
          if (v && typeof v === 'object' && 'not' in v) {
            params.push(v.not);
            clauses.push(`${COLUMN_FOR[k]} <> $${params.length}`);
          } else {
            params.push(v);
            clauses.push(`${COLUMN_FOR[k]} = $${params.length}`);
          }
        }
        const r = await db.query(
          `SELECT balance_amount::float8 AS "balanceAmount" FROM "${table}" WHERE ${clauses.join(' AND ')}`,
          params);
        return r.rows;
      },
    };
  };

  return new Proxy({}, { get: (_t, prop) => (typeof prop === 'string' ? proxyFor(prop) : undefined) });
}

// ---------------------------------------------------------------------------
// Credit limit
// ---------------------------------------------------------------------------

// Customer Master is retired — this seeds a Business Partner (partnerType
// 'Customer') instead, which is what assertWithinCreditLimit/assertMasterExists
// now read.
async function seedCustomer(db, { name = 'Acme Traders', limit = null } = {}) {
  await db.query(
    `INSERT INTO business_partners (partner_code, partner_name, partner_type, credit_limit) VALUES ($1,$2,'Customer',$3)`,
    [`C-${Math.random()}`, name, limit]);
}

async function seedOpenInvoice(db, { customer = 'Acme Traders', balance, status = 'Unpaid' }) {
  await db.query(
    `INSERT INTO customer_outstanding (customer_name, invoice_no, invoice_amount, paid_amount, balance_amount, status)
     VALUES ($1,$2,$3,0,$3,$4)`,
    [customer, `SI-${Math.random()}`, balance, status]);
}

test('REGRESSION: an order beyond the credit limit is refused', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  await seedCustomer(db, { limit: 10000 });
  await seedOpenInvoice(db, { balance: 8000 });

  await assert.rejects(
    () => assertWithinCreditLimit(tx, {
      customerName: 'Acme Traders', documentAmount: 5000, documentLabel: 'order',
    }),
    /would exceed their credit limit/,
    '8,000 owed plus 5,000 more against a 10,000 limit'
  );
  await db.close();
});

test('an order within the limit passes and reports the headroom', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  await seedCustomer(db, { limit: 10000 });
  await seedOpenInvoice(db, { balance: 6000 });

  const result = await assertWithinCreditLimit(tx, {
    customerName: 'Acme Traders', documentAmount: 3000,
  });
  assert.equal(result.currentExposure, 6000);
  assert.equal(result.newExposure, 9000);
  assert.equal(result.available, 1000);
  await db.close();
});

test('landing exactly on the limit is allowed', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  await seedCustomer(db, { limit: 10000 });
  await seedOpenInvoice(db, { balance: 7000 });

  const r = await assertWithinCreditLimit(tx, { customerName: 'Acme Traders', documentAmount: 3000 });
  assert.equal(r.available, 0);
  await db.close();
});

test('an unset credit limit means no limit, not zero credit', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  await seedCustomer(db, { limit: null });

  // Must not throw — treating an unconfigured master as a hard block would
  // stop every sale on day one.
  assert.equal(await assertWithinCreditLimit(tx, {
    customerName: 'Acme Traders', documentAmount: 999999,
  }), null);
  await db.close();
});

test('a zero credit limit is also treated as unset', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  await seedCustomer(db, { limit: 0 });
  assert.equal(await assertWithinCreditLimit(tx, {
    customerName: 'Acme Traders', documentAmount: 999999,
  }), null);
  await db.close();
});

test('paid invoices do not count towards exposure', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  await seedCustomer(db, { limit: 10000 });
  await seedOpenInvoice(db, { balance: 0, status: 'Paid' });

  const r = await assertWithinCreditLimit(tx, { customerName: 'Acme Traders', documentAmount: 9000 });
  assert.equal(r.currentExposure, 0);
  await db.close();
});

test('editing an invoice excludes its own prior exposure', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  await seedCustomer(db, { limit: 10000 });
  await db.query(
    `INSERT INTO customer_outstanding (customer_name, invoice_no, invoice_amount, paid_amount, balance_amount, status)
     VALUES ('Acme Traders','SI-EDIT',9000,0,9000,'Unpaid')`);

  // Re-saving SI-EDIT at 9,500 must measure 9,500 against the limit, not
  // 9,000 + 9,500.
  const r = await assertWithinCreditLimit(tx, {
    customerName: 'Acme Traders', documentAmount: 9500, excludeInvoiceNo: 'SI-EDIT',
  });
  assert.equal(r.currentExposure, 0);
  assert.equal(r.newExposure, 9500);
  await db.close();
});

test('an unknown customer is not blocked by credit control', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  assert.equal(await assertWithinCreditLimit(tx, {
    customerName: 'Nobody', documentAmount: 999999,
  }), null);
  assert.equal(await assertWithinCreditLimit(tx, { customerName: null, documentAmount: 1 }), null);
  await db.close();
});

// ---------------------------------------------------------------------------
// Master data integrity
// ---------------------------------------------------------------------------

test('REGRESSION: a customer with transactions cannot be deleted', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  await seedCustomer(db);
  await db.query(`INSERT INTO sales_invoices (invoice_no, customer, status) VALUES ('SI-1','Acme Traders','Sent')`);

  await assert.rejects(
    () => assertNotReferenced(tx, 'customer', 'Acme Traders'),
    /cannot be deleted — it is referenced by 1 sales invoice/
  );
  await db.close();
});

test('the delete refusal names every document type involved', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  await seedCustomer(db);
  await db.query(`INSERT INTO sales_invoices (invoice_no, customer, status) VALUES ('SI-1','Acme Traders','Sent')`);
  await db.query(`INSERT INTO sales_orders (order_no, customer, status) VALUES ('SO-1','Acme Traders','Open')`);
  await db.query(`INSERT INTO sales_orders (order_no, customer, status) VALUES ('SO-2','Acme Traders','Open')`);

  await assert.rejects(
    () => assertNotReferenced(tx, 'customer', 'Acme Traders'),
    (err) => {
      assert.match(err.message, /2 sales orders/);
      assert.match(err.message, /1 sales invoice/);
      assert.match(err.message, /Set its status to Inactive instead/);
      assert.equal(err.status, 409);
      return true;
    }
  );
  await db.close();
});

test('an unreferenced customer can be deleted', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  await seedCustomer(db, { name: 'Unused Ltd' });
  await assertNotReferenced(tx, 'customer', 'Unused Ltd');
  await db.close();
});

test('a product used on any document cannot be deleted', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  const inv = await db.query(
    `INSERT INTO sales_invoices (invoice_no, customer, status) VALUES ('SI-1','Acme','Sent') RETURNING id`);
  await db.query(
    `INSERT INTO sales_invoice_items (invoice_id, product_code, quantity, unit_price) VALUES ($1,'P1',1,10)`,
    [inv.rows[0].id]);

  await assert.rejects(() => assertNotReferenced(tx, 'product', 'P1'), /cannot be deleted/);
  await db.close();
});

test('a supplier used on a purchase invoice cannot be deleted', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  await db.query(`INSERT INTO purchase_invoices (invoice_no, supplier, status) VALUES ('PI-1','Global','Posted')`);
  await assert.rejects(() => assertNotReferenced(tx, 'supplier', 'Global'), /cannot be deleted/);
  await db.close();
});

test('REGRESSION: renaming a customer carries the history with it', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  await seedCustomer(db);
  await db.query(`INSERT INTO sales_invoices (invoice_no, customer, status) VALUES ('SI-1','Acme Traders','Sent')`);
  await db.query(`INSERT INTO sales_orders (order_no, customer, status) VALUES ('SO-1','Acme Traders','Open')`);
  await db.query(
    `INSERT INTO customer_outstanding (customer_name, invoice_no, invoice_amount, balance_amount, status)
     VALUES ('Acme Traders','SI-1',100,100,'Unpaid')`);

  const updated = await cascadeRename(tx, 'customer', 'Acme Traders', 'Acme Trading Co');
  assert.ok(updated >= 3, `expected at least 3 rows repointed, got ${updated}`);

  const stale = await db.query(
    `SELECT (SELECT COUNT(*) FROM sales_invoices WHERE customer = 'Acme Traders')
          + (SELECT COUNT(*) FROM sales_orders WHERE customer = 'Acme Traders')
          + (SELECT COUNT(*) FROM customer_outstanding WHERE customer_name = 'Acme Traders') AS n`);
  assert.equal(Number(stale.rows[0].n), 0, 'nothing may still point at the old name');

  const moved = await db.query(`SELECT COUNT(*)::int AS n FROM sales_invoices WHERE customer = 'Acme Trading Co'`);
  assert.equal(moved.rows[0].n, 1);
  await db.close();
});

test('a rename to the same name is a no-op', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  assert.equal(await cascadeRename(tx, 'customer', 'Acme', 'Acme'), 0);
  assert.equal(await cascadeRename(tx, 'customer', null, 'Acme'), 0);
  await db.close();
});

test('REGRESSION: a transaction naming a customer that does not exist is refused', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  await seedCustomer(db, { name: 'Acme Traders' });

  await assertMasterExists(tx, 'customer', 'Acme Traders');

  await assert.rejects(
    () => assertMasterExists(tx, 'customer', 'Acme Traderz'),
    /No customer named "Acme Traderz" exists/,
    'a typo used to create a phantom customer with real money attached'
  );
  await db.close();
});

test('a blank party is allowed by default and can be required', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  await assertMasterExists(tx, 'customer', null);
  await assert.rejects(
    () => assertMasterExists(tx, 'customer', '', { allowBlank: false }),
    /is required/
  );
  await db.close();
});

test('the reference map covers all three masters and points at real delegates', () => {
  assert.deepEqual(Object.keys(REFERENCE_MAP).sort(), ['customer', 'product', 'supplier']);
  for (const [kind, spec] of Object.entries(REFERENCE_MAP)) {
    assert.ok(spec.references.length >= 7, `${kind} should check more than a couple of tables`);
    for (const ref of spec.references) {
      assert.equal(typeof ref.delegate, 'function');
      assert.ok(ref.field && ref.label, `${kind} reference is missing field/label`);
    }
  }
});
