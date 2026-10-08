/**
 * Order fulfilment tracking, against a real SQL Server test database, with the
 * repository's own migrations applied.
 *
 * The defect: nothing propagated. A purchase order stayed 'Open' no matter how
 * many goods receipts were posted against it; a sales order likewise. Partial
 * fulfilment could not be represented, so buyers could not see what was still
 * on order and nothing stopped a second full delivery against an order that
 * had already shipped in full.
 *
 * Run with:  node --test "src/tests/*.test.js"
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  sumByProduct,
  reconcileOrder,
  recomputeSalesOrder,
  recomputePurchaseOrder,
  assertNoOverDelivery,
} = require('../utils/documentFlow');

// ---------------------------------------------------------------------------
// Pure-logic tests — no database needed
// ---------------------------------------------------------------------------

test('sumByProduct totals a quantity field across documents', () => {
  const totals = sumByProduct([
    { items: [{ productCode: 'P1', quantity: 3 }, { productCode: 'P2', quantity: 1 }] },
    { items: [{ productCode: 'P1', quantity: 2.5 }] },
  ]);
  assert.equal(totals.get('P1'), 5.5);
  assert.equal(totals.get('P2'), 1);
});

test('sumByProduct ignores lines with no product code', () => {
  const totals = sumByProduct([{ items: [{ quantity: 99 }, { productCode: 'P1', quantity: 1 }] }]);
  assert.equal(totals.size, 1);
  assert.equal(totals.get('P1'), 1);
});

test('sumByProduct can read an alternative quantity field', () => {
  const totals = sumByProduct(
    [{ items: [{ productCode: 'P1', receivedQuantity: 8, quantity: 999 }] }],
    { quantityField: 'receivedQuantity' }
  );
  assert.equal(totals.get('P1'), 8);
});

test('an untouched order is Open', () => {
  const r = reconcileOrder([{ id: 1, productCode: 'P1', quantity: 10 }], new Map(), 'Partially Delivered');
  assert.equal(r.status, 'Open');
  assert.equal(r.lines[0].fulfilled, 0);
});

test('a part-fulfilled order reports the partial status', () => {
  const r = reconcileOrder(
    [{ id: 1, productCode: 'P1', quantity: 10 }],
    new Map([['P1', 4]]),
    'Partially Delivered'
  );
  assert.equal(r.status, 'Partially Delivered');
  assert.equal(r.lines[0].fulfilled, 4);
});

test('a fully fulfilled order is Closed', () => {
  const r = reconcileOrder(
    [{ id: 1, productCode: 'P1', quantity: 10 }],
    new Map([['P1', 10]]),
    'Partially Delivered'
  );
  assert.equal(r.status, 'Closed');
});

test('over-fulfilment does not exceed the ordered quantity on the line', () => {
  const r = reconcileOrder(
    [{ id: 1, productCode: 'P1', quantity: 10 }],
    new Map([['P1', 25]]),
    'Partially Delivered'
  );
  assert.equal(r.lines[0].fulfilled, 10, 'the line cannot record more than was ordered');
  assert.equal(r.status, 'Closed');
});

test('a product on two lines has its fulfilment consumed line by line', () => {
  // 6 delivered against an order with two lines of 5 each: the first closes,
  // the second is part-done. Crediting 6 to both would close the whole order.
  const r = reconcileOrder(
    [{ id: 1, productCode: 'P1', quantity: 5 }, { id: 2, productCode: 'P1', quantity: 5 }],
    new Map([['P1', 6]]),
    'Partially Delivered'
  );
  assert.equal(r.lines[0].fulfilled, 5);
  assert.equal(r.lines[1].fulfilled, 1);
  assert.equal(r.status, 'Partially Delivered');
});

test('an order with no lines is Open, not Closed', () => {
  const r = reconcileOrder([], new Map(), 'Partially Delivered');
  assert.equal(r.status, 'Open', 'an empty order must not read as fully delivered');
});

test('fractional fulfilment closes the line at the paisa', () => {
  const r = reconcileOrder(
    [{ id: 1, productCode: 'P1', quantity: 10 }],
    new Map([['P1', 9.999]]),
    'Partially Delivered'
  );
  assert.equal(r.status, 'Closed', 'a thousandth short still counts as delivered');
});

// ---------------------------------------------------------------------------
// Database-backed tests
// ---------------------------------------------------------------------------

const { freshDb } = require('./testDb');

/**
 * A Prisma-shaped adapter over testDb covering exactly the query shapes
 * documentFlow uses. Anything else throws, so an unsupported query is a loud
 * failure rather than a silently wrong answer.
 */
function buildClient(db) {
  const notIn = (col, values) => ({
    sql: `${col} <> ALL($$)`, values,
  });

  async function findOrder(table, keyCol, keyVal, itemTable, fkCol) {
    const h = await db.query(`SELECT * FROM "${table}" WHERE ${keyCol} = $1 LIMIT 1`, [keyVal]);
    if (!h.rows[0]) return null;
    const items = await db.query(
      `SELECT id, product_code AS "productCode", quantity::float8 AS quantity
         FROM "${itemTable}" WHERE ${fkCol} = $1 ORDER BY id`,
      [h.rows[0].id]
    );
    return { ...h.rows[0], items: items.rows };
  }

  async function findDocs(table, keyCol, keyVal, statuses, itemTable, fkCol, qtyCol, exclude = null) {
    // `exclude` implements the `{ challanNo: { not: ... } }` clause that lets
    // an edit leave its own previous lines out of the over-delivery check.
    const params = [keyVal, statuses];
    let sql = `SELECT id FROM "${table}" WHERE ${keyCol} = $1 AND status <> ALL($2)`;
    if (exclude?.column && exclude.value != null) {
      params.push(exclude.value);
      sql += ` AND ${exclude.column} <> $${params.length}`;
    }
    const h = await db.query(sql, params);
    const out = [];
    for (const row of h.rows) {
      const items = await db.query(
        `SELECT product_code AS "productCode", ${qtyCol}::float8 AS q
           FROM "${itemTable}" WHERE ${fkCol} = $1`,
        [row.id]
      );
      out.push({
        id: row.id,
        items: items.rows.map((i) => ({
          productCode: i.productCode,
          quantity: i.q,
          receivedQuantity: i.q,
        })),
      });
    }
    return out;
  }

  return {
    salesOrder: {
      findFirst: ({ where }) => findOrder('sales_orders', 'order_no', where.orderNo, 'sales_order_items', 'order_id'),
      update: async ({ where, data }) => {
        await db.query(`UPDATE "sales_orders" SET status = $1 WHERE id = $2`, [data.status, where.id]);
      },
    },
    purchaseOrder: {
      findFirst: ({ where }) => findOrder('purchase_orders', 'po_no', where.poNo, 'purchase_order_items', 'order_id'),
      update: async ({ where, data }) => {
        await db.query(`UPDATE "purchase_orders" SET status = $1 WHERE id = $2`, [data.status, where.id]);
      },
    },
    salesOrderItem: {
      update: async ({ where, data }) => {
        await db.query(
          `UPDATE "sales_order_items" SET delivered_quantity = $1, invoiced_quantity = $2 WHERE id = $3`,
          [data.deliveredQuantity, data.invoicedQuantity, where.id]
        );
      },
    },
    purchaseOrderItem: {
      update: async ({ where, data }) => {
        await db.query(
          `UPDATE "purchase_order_items" SET received_quantity = $1, invoiced_quantity = $2 WHERE id = $3`,
          [data.receivedQuantity, data.invoicedQuantity, where.id]
        );
      },
    },
    deliveryChallan: {
      findMany: ({ where }) =>
        findDocs('delivery_challans', 'order_no', where.orderNo,
          where.status.notIn, 'delivery_challan_items', 'challan_id', 'quantity',
          { column: 'challan_no', value: where.challanNo?.not }),
    },
    salesInvoice: {
      findMany: ({ where }) =>
        findDocs('sales_invoices', 'order_no', where.orderNo,
          where.status.notIn, 'sales_invoice_items', 'invoice_id', 'quantity'),
    },
    goodsReceivedNote: {
      findMany: ({ where }) =>
        findDocs('goods_received_notes', 'po_no', where.poNo,
          where.status.notIn, 'goods_received_note_items', 'grn_id', 'received_quantity'),
    },
    purchaseInvoice: {
      findMany: ({ where }) =>
        findDocs('purchase_invoices', 'po_no', where.poNo,
          where.status.notIn, 'purchase_invoice_items', 'invoice_id', 'quantity'),
    },
  };
}

async function seedSalesOrder(db, { orderNo = 'SO-1', lines = [['P1', 10]], status = 'Open' } = {}) {
  const h = await db.query(
    `INSERT INTO sales_orders (order_no, customer, status) VALUES ($1,'Acme',$2) RETURNING id`,
    [orderNo, status]);
  for (const [code, qty] of lines) {
    await db.query(
      `INSERT INTO sales_order_items (order_id, product_code, quantity, unit_price) VALUES ($1,$2,$3,100)`,
      [h.rows[0].id, code, qty]);
  }
}

async function seedChallan(db, { orderNo = 'SO-1', lines = [['P1', 4]], status = 'Delivered' } = {}) {
  const h = await db.query(
    `INSERT INTO delivery_challans (challan_no, order_no, status) VALUES ($1,$2,$3) RETURNING id`,
    [`DC-${Math.random()}`, orderNo, status]);
  for (const [code, qty] of lines) {
    await db.query(
      `INSERT INTO delivery_challan_items (challan_id, product_code, quantity, unit_price) VALUES ($1,$2,$3,100)`,
      [h.rows[0].id, code, qty]);
  }
}

async function orderStatus(db, orderNo) {
  const r = await db.query(`SELECT status FROM sales_orders WHERE order_no = $1`, [orderNo]);
  return r.rows[0]?.status;
}

async function orderLines(db, orderNo) {
  const r = await db.query(
    `SELECT i.product_code AS code, i.quantity::float8 AS ordered,
            i.delivered_quantity::float8 AS delivered, i.invoiced_quantity::float8 AS invoiced
       FROM sales_order_items i JOIN sales_orders o ON o.id = i.order_id
      WHERE o.order_no = $1 ORDER BY i.id`, [orderNo]);
  return r.rows;
}

test('REGRESSION: a delivery moves its sales order off Open', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  await seedSalesOrder(db, { lines: [['P1', 10]] });
  await seedChallan(db, { lines: [['P1', 4]] });

  await recomputeSalesOrder(tx, 'SO-1');

  assert.equal(await orderStatus(db, 'SO-1'), 'Partially Delivered', 'used to stay Open forever');
  assert.deepEqual(await orderLines(db, 'SO-1'), [{ code: 'P1', ordered: 10, delivered: 4, invoiced: 0 }]);
  await db.close();
});

test('delivering everything closes the order', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  await seedSalesOrder(db, { lines: [['P1', 10], ['P2', 5]] });
  await seedChallan(db, { lines: [['P1', 10], ['P2', 5]] });

  await recomputeSalesOrder(tx, 'SO-1');
  assert.equal(await orderStatus(db, 'SO-1'), 'Closed');
  await db.close();
});

test('two part-deliveries accumulate to a closed order', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  await seedSalesOrder(db, { lines: [['P1', 10]] });
  await seedChallan(db, { lines: [['P1', 6]] });
  await recomputeSalesOrder(tx, 'SO-1');
  assert.equal(await orderStatus(db, 'SO-1'), 'Partially Delivered');

  await seedChallan(db, { lines: [['P1', 4]] });
  await recomputeSalesOrder(tx, 'SO-1');
  assert.equal(await orderStatus(db, 'SO-1'), 'Closed');
  await db.close();
});

test('draft and cancelled challans do not fulfil anything', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  await seedSalesOrder(db, { lines: [['P1', 10]] });
  await seedChallan(db, { lines: [['P1', 10]], status: 'Draft' });
  await seedChallan(db, { lines: [['P1', 10]], status: 'Cancelled' });

  await recomputeSalesOrder(tx, 'SO-1');
  assert.equal(await orderStatus(db, 'SO-1'), 'Open');
  await db.close();
});

test('a cancelled order is never reopened by a recompute', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  await seedSalesOrder(db, { lines: [['P1', 10]], status: 'Cancelled' });
  await seedChallan(db, { lines: [['P1', 10]] });

  await recomputeSalesOrder(tx, 'SO-1');
  assert.equal(await orderStatus(db, 'SO-1'), 'Cancelled', 'cancellation is a human decision');
  await db.close();
});

test('with no challan at all, the invoice fulfils the order', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  await seedSalesOrder(db, { lines: [['P1', 10]] });
  const h = await db.query(
    `INSERT INTO sales_invoices (invoice_no, order_no, status) VALUES ('SI-1','SO-1','Sent') RETURNING id`);
  await db.query(
    `INSERT INTO sales_invoice_items (invoice_id, product_code, quantity, unit_price) VALUES ($1,'P1',10,100)`,
    [h.rows[0].id]);

  await recomputeSalesOrder(tx, 'SO-1');
  assert.equal(await orderStatus(db, 'SO-1'), 'Closed', 'a one-step sale must not leave its order open');
  await db.close();
});

test('REGRESSION: a goods receipt moves its purchase order off Open', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  const po = await db.query(
    `INSERT INTO purchase_orders (po_no, supplier, status) VALUES ('PO-1','Global','Open') RETURNING id`);
  await db.query(
    `INSERT INTO purchase_order_items (order_id, product_code, quantity, unit_price) VALUES ($1,'P1',20,50)`,
    [po.rows[0].id]);
  const grn = await db.query(
    `INSERT INTO goods_received_notes (grn_no, po_no, status) VALUES ('GRN-1','PO-1','Received') RETURNING id`);
  await db.query(
    `INSERT INTO goods_received_note_items (grn_id, product_code, received_quantity, unit_price) VALUES ($1,'P1',8,50)`,
    [grn.rows[0].id]);

  await recomputePurchaseOrder(tx, 'PO-1');

  const r = await db.query(`SELECT status FROM purchase_orders WHERE po_no = 'PO-1'`);
  assert.equal(r.rows[0].status, 'Partially Received');
  const lines = await db.query(
    `SELECT received_quantity::float8 AS received FROM purchase_order_items`);
  assert.equal(lines.rows[0].received, 8);
  await db.close();
});

test('an unknown order number is a no-op, not a crash', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  assert.equal(await recomputeSalesOrder(tx, 'SO-NOPE'), null);
  assert.equal(await recomputeSalesOrder(tx, null), null);
  await db.close();
});

// ---------------------------------------------------------------------------
// Over-delivery guard
// ---------------------------------------------------------------------------

test('REGRESSION: delivering more than ordered is refused', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  await seedSalesOrder(db, { lines: [['P1', 10]] });
  await seedChallan(db, { lines: [['P1', 8]] });

  await assert.rejects(
    () => assertNoOverDelivery(tx, { orderNo: 'SO-1', items: [{ productCode: 'P1', quantity: 5 }] }),
    /exceeds the order/,
    '8 already gone plus 5 more against an order for 10'
  );
  await db.close();
});

test('delivering exactly the balance is allowed', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  await seedSalesOrder(db, { lines: [['P1', 10]] });
  await seedChallan(db, { lines: [['P1', 8]] });

  await assertNoOverDelivery(tx, { orderNo: 'SO-1', items: [{ productCode: 'P1', quantity: 2 }] });
  await db.close();
});

test('editing a challan does not measure itself as extra', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  await seedSalesOrder(db, { lines: [['P1', 10]] });
  const h = await db.query(
    `INSERT INTO delivery_challans (challan_no, order_no, status) VALUES ('DC-EDIT','SO-1','Delivered') RETURNING id`);
  await db.query(
    `INSERT INTO delivery_challan_items (challan_id, product_code, quantity, unit_price) VALUES ($1,'P1',10,100)`,
    [h.rows[0].id]);

  // Re-saving the same challan at the same quantity must not trip the guard.
  await assertNoOverDelivery(tx, {
    orderNo: 'SO-1',
    items: [{ productCode: 'P1', quantity: 10 }],
    excludeChallanNo: 'DC-EDIT',
  });
  await db.close();
});

test('a challan raised without an order is unconstrained', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  await assertNoOverDelivery(tx, { orderNo: null, items: [{ productCode: 'P1', quantity: 9999 }] });
  await assertNoOverDelivery(tx, { orderNo: 'SO-NONE', items: [{ productCode: 'P1', quantity: 9999 }] });
  await db.close();
});

test('a product not on the order is treated as a free line, not an over-delivery', async () => {
  const db = await freshDb();
  const tx = buildClient(db);
  await seedSalesOrder(db, { lines: [['P1', 10]] });
  await assertNoOverDelivery(tx, { orderNo: 'SO-1', items: [{ productCode: 'P9', quantity: 3 }] });
  await db.close();
});
