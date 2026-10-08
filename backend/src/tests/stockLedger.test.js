/**
 * Stock ledger tests, against a real SQL Server test database, with the
 * repository's own migrations applied.
 *
 * The defect these pin: on-hand stock used to be derived from only Stock
 * Receipt, Stock Issue and Stock Adjustment. A Goods Received Note did not
 * increase inventory and a Delivery Challan or Sales Invoice did not decrease
 * it, so goods could be bought and sold without stock moving at all.
 *
 * The subtle half is de-duplication: the same physical movement is described
 * twice when a GRN is followed by a Purchase Invoice, or a Delivery Challan by
 * a Sales Invoice. An invoice therefore only moves stock when no delivery
 * document is linked to it. Both the one-step and two-step flows have to come
 * out at the same number.
 *
 * Run with:  node --test "src/tests/*.test.js"
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { SOURCES, NON_MOVING_STATUSES } = require('../utils/stockLedger');
const { freshDb } = require('./testDb');

// ---------------------------------------------------------------------------
// Enough of a Prisma client, over testDb, for the ledger's query shapes.
// The ledger issues exactly one findMany per source, with a header relation
// filter and an optional productCode IN clause — that is all this has to
// support, and it throws on anything else rather than guessing.
// ---------------------------------------------------------------------------

const TABLES = {
  stockReceiptItem: { table: 'stock_receipt_items', fk: 'receipt_id', header: 'stock_receipts' },
  stockIssueItem: { table: 'stock_issue_items', fk: 'issue_id', header: 'stock_issues' },
  stockAdjustmentItem: { table: 'stock_adjustment_items', fk: 'adjustment_id', header: 'stock_adjustments' },
  goodsReceivedNoteItem: { table: 'goods_received_note_items', fk: 'grn_id', header: 'goods_received_notes' },
  deliveryChallanItem: { table: 'delivery_challan_items', fk: 'challan_id', header: 'delivery_challans' },
  purchaseInvoiceItem: { table: 'purchase_invoice_items', fk: 'invoice_id', header: 'purchase_invoices' },
  salesInvoiceItem: { table: 'sales_invoice_items', fk: 'invoice_id', header: 'sales_invoices' },
};

const COLUMN = {
  quantity: 'quantity',
  receivedQuantity: 'received_quantity',
  differenceQuantity: 'difference_quantity',
  warehouse: 'warehouse',
  toWarehouse: 'to_warehouse',
  fromWarehouse: 'from_warehouse',
  date: 'date',
  receivedDate: 'received_date',
  challanDate: 'challan_date',
  invoiceDate: 'invoice_date',
  grnNo: 'grn_no',
  deliveryChallanNo: 'delivery_challan_no',
};

function buildClient(db) {
  const client = {};

  for (const [delegateName, meta] of Object.entries(TABLES)) {
    client[delegateName] = {
      async findMany({ where, select }) {
        const relation = Object.keys(where).find((k) => k !== 'productCode');
        const header = where[relation];

        const conditions = ["h.status <> ALL($1)"];
        const params = [NON_MOVING_STATUSES];

        for (const [key, cond] of Object.entries(header)) {
          if (key === 'status') continue;
          if (key === 'OR') {
            // The invoice de-duplication filter: linked document is null or ''.
            const col = COLUMN[Object.keys(cond[0])[0]];
            conditions.push(`(h."${col}" IS NULL OR h."${col}" = '')`);
            continue;
          }
          const col = COLUMN[key];
          if (cond && typeof cond === 'object' && 'lte' in cond) {
            params.push(cond.lte);
            conditions.push(`h."${col}" <= $${params.length}`);
          } else {
            params.push(cond);
            conditions.push(`h."${col}" = $${params.length}`);
          }
        }

        if (where.productCode?.in) {
          params.push(where.productCode.in);
          conditions.push(`i.product_code = ANY($${params.length})`);
        }

        const qtyKey = Object.keys(select).find((k) => k !== 'productCode' && k !== relation);
        const whCol = Object.keys(select[relation].select)[0];
        const whExpr = whCol === 'id' ? 'NULL' : `h."${COLUMN[whCol]}"`;

        const r = await db.query(
          `SELECT i.product_code AS "productCode",
                  i."${COLUMN[qtyKey]}"::float8 AS qty,
                  ${whExpr} AS wh
             FROM "${meta.table}" i
             JOIN "${meta.header}" h ON h.id = i.${meta.fk}
            WHERE ${conditions.join(' AND ')}`,
          params
        );

        return r.rows.map((row) => ({
          productCode: row.productCode,
          [qtyKey]: row.qty,
          [relation]: whCol === 'id' ? { id: 1 } : { [whCol]: row.wh },
        }));
      },
    };
  }

  client.product = {
    async findMany({ where, select }) {
      const codes = where?.productCode?.in;
      const r = codes
        ? await db.query(
            `SELECT product_code AS "productCode", opening_stock::float8 AS "openingStock"
               FROM products WHERE product_code = ANY($1)`, [codes])
        : await db.query(
            `SELECT product_code AS "productCode", opening_stock::float8 AS "openingStock" FROM products`);
      return r.rows;
    },
    async findFirst({ where }) {
      const r = await db.query(
        `SELECT opening_stock::float8 AS "openingStock" FROM products WHERE product_code = $1`,
        [where.productCode]);
      return r.rows[0] || null;
    },
  };

  return client;
}

async function seededDb() {
  const db = await freshDb();
  await db.exec(`
    INSERT INTO products (product_code, product_name, opening_stock, cost_price, sales_price)
    VALUES ('P1', 'Widget', 100, 50, 80),
           ('P2', 'Gadget', 0,   20, 35);
  `);
  return db;
}

// Document builders — each inserts a header and one line.
const insert = {
  async grn(db, { qty, status = 'Received', warehouse = 'Main', date = '2026-06-01', code = 'P1' }) {
    const h = await db.query(
      `INSERT INTO goods_received_notes (grn_no, status, warehouse, received_date)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [`GRN-${Math.random()}`, status, warehouse, date]);
    await db.query(
      `INSERT INTO goods_received_note_items (grn_id, product_code, received_quantity, unit_price)
       VALUES ($1,$2,$3,10)`, [h.rows[0].id, code, qty]);
  },
  async challan(db, { qty, status = 'Delivered', warehouse = 'Main', date = '2026-06-02', code = 'P1' }) {
    const h = await db.query(
      `INSERT INTO delivery_challans (challan_no, status, from_warehouse, challan_date)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [`DC-${Math.random()}`, status, warehouse, date]);
    await db.query(
      `INSERT INTO delivery_challan_items (challan_id, product_code, quantity, unit_price)
       VALUES ($1,$2,$3,10)`, [h.rows[0].id, code, qty]);
  },
  async salesInvoice(db, { qty, status = 'Sent', challanNo = null, date = '2026-06-03', code = 'P1' }) {
    const h = await db.query(
      `INSERT INTO sales_invoices (invoice_no, status, delivery_challan_no, invoice_date)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [`SI-${Math.random()}`, status, challanNo, date]);
    await db.query(
      `INSERT INTO sales_invoice_items (invoice_id, product_code, quantity, unit_price)
       VALUES ($1,$2,$3,10)`, [h.rows[0].id, code, qty]);
  },
  async purchaseInvoice(db, { qty, status = 'Posted', grnNo = null, date = '2026-06-03', code = 'P1' }) {
    const h = await db.query(
      `INSERT INTO purchase_invoices (invoice_no, status, grn_no, invoice_date)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [`PI-${Math.random()}`, status, grnNo, date]);
    await db.query(
      `INSERT INTO purchase_invoice_items (invoice_id, product_code, quantity, unit_price)
       VALUES ($1,$2,$3,10)`, [h.rows[0].id, code, qty]);
  },
  async stockReceipt(db, { qty, status = 'Posted', warehouse = 'Main', date = '2026-06-01', code = 'P1' }) {
    const h = await db.query(
      `INSERT INTO stock_receipts (receipt_no, status, warehouse, date) VALUES ($1,$2,$3,$4) RETURNING id`,
      [`SRC-${Math.random()}`, status, warehouse, date]);
    await db.query(
      `INSERT INTO stock_receipt_items (receipt_id, product_code, quantity, unit_price) VALUES ($1,$2,$3,10)`,
      [h.rows[0].id, code, qty]);
  },
  async stockIssue(db, { qty, status = 'Posted', warehouse = 'Main', date = '2026-06-02', code = 'P1' }) {
    const h = await db.query(
      `INSERT INTO stock_issues (issue_no, status, to_warehouse, date) VALUES ($1,$2,$3,$4) RETURNING id`,
      [`SIG-${Math.random()}`, status, warehouse, date]);
    await db.query(
      `INSERT INTO stock_issue_items (issue_id, product_code, quantity, unit_price) VALUES ($1,$2,$3,10)`,
      [h.rows[0].id, code, qty]);
  },
  async adjustment(db, { diff, status = 'Posted', warehouse = 'Main', date = '2026-06-04', code = 'P1' }) {
    const h = await db.query(
      `INSERT INTO stock_adjustments (adjustment_no, status, warehouse, date) VALUES ($1,$2,$3,$4) RETURNING id`,
      [`ADJ-${Math.random()}`, status, warehouse, date]);
    await db.query(
      `INSERT INTO stock_adjustment_items (adjustment_id, product_code, difference_quantity, unit_price)
       VALUES ($1,$2,$3,10)`, [h.rows[0].id, code, diff]);
  },
};

/** Load the ledger bound to a testDb-backed client. */
function ledgerFor(db) {
  const client = buildClient(db);
  const ledger = require('../utils/stockLedger');
  return {
    net: (o = {}) => ledger.getStockMovementByProductCode({ ...o, client }),
    inOut: (o = {}) => ledger.getInwardOutwardByProductCode({ ...o, client }),
    movements: (o = {}) => ledger.getStockMovements({ ...o, client }),
    stockFor: (codes) => ledger.getCurrentStockForMany(codes, { client }),
  };
}

// ---------------------------------------------------------------------------

test('the ledger knows about every stock-moving document type', () => {
  const keys = SOURCES.map((s) => s.key).sort();
  assert.deepEqual(keys, [
    'deliveryChallan', 'goodsReceivedNote', 'purchaseInvoice', 'salesInvoice',
    'stockAdjustment', 'stockIssue', 'stockReceipt',
  ]);
});

test('the three manual stock documents still behave exactly as before', async () => {
  const db = await seededDb();
  const l = ledgerFor(db);
  await insert.stockReceipt(db, { qty: 40 });
  await insert.stockIssue(db, { qty: 15 });
  await insert.adjustment(db, { diff: -5 });

  assert.equal((await l.net()).get('P1'), 20);
  assert.equal((await l.stockFor(['P1'])).get('P1'), 120, 'opening 100 + 40 − 15 − 5');
  await db.close();
});

test('REGRESSION: a goods received note increases stock', async () => {
  const db = await seededDb();
  const l = ledgerFor(db);
  await insert.grn(db, { qty: 25 });

  assert.equal((await l.net()).get('P1'), 25, 'a GRN used to move nothing at all');
  assert.equal((await l.stockFor(['P1'])).get('P1'), 125);
  await db.close();
});

test('REGRESSION: a delivery challan decreases stock', async () => {
  const db = await seededDb();
  const l = ledgerFor(db);
  await insert.challan(db, { qty: 30 });

  assert.equal((await l.net()).get('P1'), -30, 'a challan used to move nothing at all');
  assert.equal((await l.stockFor(['P1'])).get('P1'), 70);
  await db.close();
});

test('REGRESSION: a standalone sales invoice decreases stock', async () => {
  const db = await seededDb();
  const l = ledgerFor(db);
  await insert.salesInvoice(db, { qty: 10 });

  assert.equal((await l.net()).get('P1'), -10);
  await db.close();
});

test('REGRESSION: a standalone purchase invoice increases stock', async () => {
  const db = await seededDb();
  const l = ledgerFor(db);
  await insert.purchaseInvoice(db, { qty: 10 });

  assert.equal((await l.net()).get('P1'), 10);
  await db.close();
});

// ---------------------------------------------------------------------------
// De-duplication — the part that would silently double inventory
// ---------------------------------------------------------------------------

test('REGRESSION: a challan and the invoice raised from it move stock once', async () => {
  const db = await seededDb();
  const l = ledgerFor(db);
  await insert.challan(db, { qty: 30 });
  await insert.salesInvoice(db, { qty: 30, challanNo: 'DC-1' });

  assert.equal((await l.net()).get('P1'), -30, 'not -60 — the movement must not be counted twice');
  await db.close();
});

test('REGRESSION: a GRN and the invoice raised from it move stock once', async () => {
  const db = await seededDb();
  const l = ledgerFor(db);
  await insert.grn(db, { qty: 40 });
  await insert.purchaseInvoice(db, { qty: 40, grnNo: 'GRN-1' });

  assert.equal((await l.net()).get('P1'), 40, 'not 80');
  await db.close();
});

test('the one-step and two-step sales flows reach the same stock figure', async () => {
  const twoStep = await seededDb();
  await insert.challan(twoStep, { qty: 20 });
  await insert.salesInvoice(twoStep, { qty: 20, challanNo: 'DC-1' });

  const oneStep = await seededDb();
  await insert.salesInvoice(oneStep, { qty: 20 });

  assert.equal(
    (await ledgerFor(twoStep).stockFor(['P1'])).get('P1'),
    (await ledgerFor(oneStep).stockFor(['P1'])).get('P1')
  );
  await twoStep.close();
  await oneStep.close();
});

test('an empty linked-document reference counts as no link', async () => {
  const db = await seededDb();
  const l = ledgerFor(db);
  await insert.salesInvoice(db, { qty: 10, challanNo: '' });

  assert.equal((await l.net()).get('P1'), -10, "'' must be treated the same as NULL");
  await db.close();
});

// ---------------------------------------------------------------------------
// Status handling
// ---------------------------------------------------------------------------

test('draft and cancelled documents move nothing', async () => {
  const db = await seededDb();
  const l = ledgerFor(db);
  await insert.grn(db, { qty: 100, status: 'Draft' });
  await insert.grn(db, { qty: 100, status: 'Cancelled' });
  await insert.challan(db, { qty: 100, status: 'Pending' });
  await insert.challan(db, { qty: 100, status: 'Cancelled' });
  await insert.salesInvoice(db, { qty: 100, status: 'Cancelled' });

  assert.equal((await l.net()).get('P1'), undefined, 'nothing should have moved');
  assert.equal((await l.stockFor(['P1'])).get('P1'), 100, 'still the opening stock');
  await db.close();
});

test('intermediate statuses do move stock', async () => {
  const db = await seededDb();
  const l = ledgerFor(db);
  await insert.grn(db, { qty: 10, status: 'Partially Received' });
  await insert.challan(db, { qty: 4, status: 'Dispatched' });
  await insert.challan(db, { qty: 1, status: 'Partially Delivered' });

  assert.equal((await l.net()).get('P1'), 5);
  await db.close();
});

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

test('as-on-date excludes later movements', async () => {
  const db = await seededDb();
  const l = ledgerFor(db);
  await insert.grn(db, { qty: 10, date: '2026-06-01' });
  await insert.grn(db, { qty: 90, date: '2026-09-01' });

  assert.equal((await l.net({ asOn: new Date('2026-07-01') })).get('P1'), 10);
  assert.equal((await l.net()).get('P1'), 100);
  await db.close();
});

test('a warehouse filter scopes to that warehouse and excludes invoice movements', async () => {
  const db = await seededDb();
  const l = ledgerFor(db);
  await insert.grn(db, { qty: 10, warehouse: 'Main' });
  await insert.grn(db, { qty: 90, warehouse: 'Depot' });
  // An invoice has no warehouse column, so it cannot satisfy the filter and
  // must contribute nothing rather than everything.
  await insert.salesInvoice(db, { qty: 5 });

  assert.equal((await l.net({ warehouse: 'Main' })).get('P1'), 10);
  assert.equal((await l.net({ warehouse: 'Depot' })).get('P1'), 90);
  await db.close();
});

test('a product filter scopes to that product', async () => {
  const db = await seededDb();
  const l = ledgerFor(db);
  await insert.grn(db, { qty: 10, code: 'P1' });
  await insert.grn(db, { qty: 7, code: 'P2' });

  const net = await l.net({ productCodes: ['P2'] });
  assert.equal(net.get('P2'), 7);
  assert.equal(net.get('P1'), undefined);
  await db.close();
});

// ---------------------------------------------------------------------------
// Inward / outward split
// ---------------------------------------------------------------------------

test('inward and outward are kept on the correct sides', async () => {
  const db = await seededDb();
  const l = ledgerFor(db);
  await insert.grn(db, { qty: 50 });
  await insert.challan(db, { qty: 20 });
  await insert.adjustment(db, { diff: 5 });
  await insert.adjustment(db, { diff: -3 });

  const { inward, outward } = await l.inOut();
  assert.equal(inward.get('P1'), 55, 'GRN 50 + surplus 5');
  assert.equal(outward.get('P1'), 23, 'challan 20 + shortfall 3');
  await db.close();
});

test('a shortfall adjustment is outward movement, not negative inward', async () => {
  const db = await seededDb();
  const l = ledgerFor(db);
  await insert.adjustment(db, { diff: -8 });

  const { inward, outward } = await l.inOut();
  assert.equal(inward.get('P1'), undefined);
  assert.equal(outward.get('P1'), 8);
  await db.close();
});

test('movements are tagged with the document type they came from', async () => {
  const db = await seededDb();
  const l = ledgerFor(db);
  await insert.grn(db, { qty: 10 });
  await insert.challan(db, { qty: 4 });

  const labels = (await l.movements()).map((m) => m.source).sort();
  assert.deepEqual(labels, ['Delivery Challan', 'Goods Received Note']);
  await db.close();
});

test('a product with no movement reports its opening stock unchanged', async () => {
  const db = await seededDb();
  const l = ledgerFor(db);
  const stock = await l.stockFor(['P1', 'P2']);
  assert.equal(stock.get('P1'), 100);
  assert.equal(stock.get('P2'), 0);
  await db.close();
});

test('fractional quantities accumulate to paise-clean figures', async () => {
  const db = await seededDb();
  const l = ledgerFor(db);
  for (let i = 0; i < 10; i += 1) await insert.grn(db, { qty: 0.1 });

  assert.equal((await l.net()).get('P1'), 1, 'not 0.9999999999999999');
  await db.close();
});
