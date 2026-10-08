/**
 * Product Master > Inventory tab — the aggregation behind it.
 *
 * Run with:  node --test src/tests/productInventory.test.js
 *
 * buildInventoryRows is deliberately pure (the I/O lives in the exported
 * async functions around it) so the arithmetic can be pinned here without a
 * database. What is being protected is not the code shape but the accounting:
 * a stock figure that is wrong by a rounding step, or that quietly absorbs
 * quantity it cannot attribute, is the kind of defect that is only noticed at
 * a stock count months later.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildInventoryRows, journalKey, legacyJournalKey,
  openOrderedQtyByWarehouse, openCommittedQtyByWarehouse,
} = require('../utils/productInventory');

/**
 * A minimal, purpose-built stand-in for the two Prisma delegates
 * openOrderedQtyByWarehouse/openCommittedQtyByWarehouse actually query —
 * same philosophy as scripts/fakePrisma.js ("implements exactly the query
 * shapes this module uses... throws on anything it does not understand"),
 * scoped down further because these two functions only ever call `findMany`
 * with a flat `productCode` and a nested `order: { status: { notIn: [...] } }`.
 *
 * Rows are pre-flattened (`orderStatus` stands in for the related order's
 * status) rather than modelling a real relation, since that is the only part
 * of the relation either function reads.
 */
function fakeOrderItemsClient({ purchaseOrderItems = [], salesOrderItems = [] } = {}) {
  const findManyOver = (rows) => async ({ where, select }) => {
    const notIn = where.order?.status?.notIn;
    const matched = rows.filter((r) => {
      if (where.productCode != null && r.productCode !== where.productCode) return false;
      if (notIn && notIn.includes(r.orderStatus)) return false;
      return true;
    });
    if (!select) return matched.map((r) => ({ ...r }));
    return matched.map((r) => Object.fromEntries(Object.keys(select).map((k) => [k, r[k]])));
  };
  return {
    purchaseOrderItem: { findMany: findManyOver(purchaseOrderItems) },
    salesOrderItem: { findMany: findManyOver(salesOrderItems) },
  };
}

// Shaped as getProductInventory hands them over: the Warehouse Master's
// whsCode/whsName mapped onto warehouseCode/warehouseName.
const WAREHOUSES = [
  { warehouseCode: 'WH-01', warehouseName: 'Main Warehouse', branch: 'Coimbatore' },
  { warehouseCode: 'WH-02', warehouseName: 'Service Van', branch: 'Palakkad' },
  { warehouseCode: 'WH-03', warehouseName: 'Spare Store', branch: null },
];

const build = (overrides = {}) => buildInventoryRows({
  warehouses: WAREHOUSES,
  movements: [],
  valuations: new Map(),
  openingStock: 0,
  ordered: 0,
  committed: 0,
  ...overrides,
});

// ---------------------------------------------------------------------------
// On-hand, per warehouse
// ---------------------------------------------------------------------------

test('nets inward and outward movements per warehouse', () => {
  const { rows } = build({
    movements: [
      { quantity: 100, warehouse: 'Main Warehouse' },
      { quantity: -30, warehouse: 'Main Warehouse' },
      { quantity: 12, warehouse: 'Service Van' },
    ],
  });
  assert.equal(rows.find((r) => r.warehouseCode === 'WH-01').onHand, 70);
  assert.equal(rows.find((r) => r.warehouseCode === 'WH-02').onHand, 12);
});

test('lists every active warehouse, including ones holding none of the product', () => {
  const { rows } = build({ movements: [{ quantity: 5, warehouse: 'Main Warehouse' }] });
  assert.equal(rows.length, 3);
  // A warehouse with no stock must still appear — otherwise a stocking level
  // cannot be set for somewhere the product has not reached yet, which is
  // exactly when you most want to set one.
  assert.equal(rows.find((r) => r.warehouseCode === 'WH-03').onHand, 0);
});

test('a movement for an unknown warehouse is not silently dropped into a known one', () => {
  const { rows, totals } = build({
    movements: [
      { quantity: 10, warehouse: 'Main Warehouse' },
      { quantity: 4, warehouse: 'Decommissioned Shed' },
    ],
  });
  assert.equal(rows.find((r) => r.warehouseCode === 'WH-01').onHand, 10);
  // It is not attributed anywhere, but it is still counted in the total: the
  // stock exists. Losing it would make the tab disagree with the stock ledger.
  assert.equal(totals.onHand, 14);
});

// ---------------------------------------------------------------------------
// Quantities that cannot be attributed to a warehouse
// ---------------------------------------------------------------------------

test('opening stock is reported as unassigned, not folded into a warehouse', () => {
  const { rows, totals } = build({
    openingStock: 25,
    movements: [{ quantity: 10, warehouse: 'Main Warehouse' }],
  });
  // Product.openingStock is a single product-wide number with no warehouse.
  // Adding it to the first row would make that warehouse overstate its holding
  // by the whole opening balance.
  assert.equal(rows.find((r) => r.warehouseCode === 'WH-01').onHand, 10);
  assert.equal(totals.unassignedOnHand, 25);
  assert.equal(totals.onHand, 35);
});

// ---------------------------------------------------------------------------
// Opening Balance (Inventory > Opening Balance)
//
// This table was written by its page and its .xlsx import and then read back by
// nothing at all, so a product whose entire starting position was keyed there
// showed zero on hand in every warehouse. These pin the fix: unlike
// Product.openingStock above, an opening balance carries a warehouse code, so
// it belongs ON that warehouse's row rather than in the unassigned bucket.
// ---------------------------------------------------------------------------

test('an opening balance lands on its own warehouse row, not unassigned', () => {
  const { rows, totals } = build({
    openingBalances: [{ quantity: 60, warehouse: 'WH-01' }],
  });
  assert.equal(rows.find((r) => r.warehouseCode === 'WH-01').onHand, 60);
  assert.equal(totals.unassignedOnHand, 0);
  assert.equal(totals.onHand, 60);
});

test('movements accumulate on top of a warehouse opening balance', () => {
  const { rows } = build({
    openingBalances: [{ quantity: 60, warehouse: 'WH-01' }],
    movements: [
      { quantity: 15, warehouse: 'WH-01' },
      { quantity: -20, warehouse: 'WH-01' },
    ],
  });
  assert.equal(rows.find((r) => r.warehouseCode === 'WH-01').onHand, 55);
});

test('an opening balance and Product.openingStock both count, on their own terms', () => {
  const { rows, totals } = build({
    openingStock: 25,
    openingBalances: [{ quantity: 60, warehouse: 'WH-01' }],
  });
  // They are separate entry points kept in separate columns and neither is
  // derived from the other, so a product carrying both genuinely holds both —
  // the warehouse-tagged one on its row, the product-wide one unassigned.
  assert.equal(rows.find((r) => r.warehouseCode === 'WH-01').onHand, 60);
  assert.equal(totals.unassignedOnHand, 25);
  assert.equal(totals.onHand, 85);
});

test('an opening balance for a retired warehouse is still counted, as unassigned', () => {
  const { totals } = build({
    openingBalances: [
      { quantity: 60, warehouse: 'WH-01' },
      { quantity: 9, warehouse: 'WH-99' },
    ],
  });
  // Same rule as an unattributable movement: the stock exists, so dropping it
  // would make the tab disagree with the ledger.
  assert.equal(totals.unassignedOnHand, 9);
  assert.equal(totals.onHand, 69);
});

test('opening-balance value fills in Avg Price only where the journal is silent', () => {
  const { rows } = build({
    openingBalances: [
      { quantity: 60, warehouse: 'WH-01' },
      { quantity: 10, warehouse: 'WH-02' },
    ],
    openingValuations: new Map([['WH-01', 42.5], ['WH-02', 12]]),
    valuations: new Map([[journalKey('Main Warehouse'), { averagePrice: 39 }]]),
  });
  // WH-01 has actually moved, so the journal's weighted average wins.
  assert.equal(rows.find((r) => r.warehouseCode === 'WH-01').averagePrice, 39);
  // WH-02 has no journal rows at all. Without the fallback this read 0.00
  // beside a real quantity, which says "worthless" rather than "no cost yet".
  assert.equal(rows.find((r) => r.warehouseCode === 'WH-02').averagePrice, 12);
  // A warehouse with neither stays honestly blank.
  assert.equal(rows.find((r) => r.warehouseCode === 'WH-03').averagePrice, null);
});

test('movements from documents that record no warehouse are unassigned too', () => {
  const { totals } = build({
    movements: [
      { quantity: 10, warehouse: 'Main Warehouse' },
      { quantity: 7, warehouse: null },
    ],
  });
  assert.equal(totals.unassignedOnHand, 7);
  assert.equal(totals.onHand, 17);
});

test('warehouse rows plus unassigned always reconcile to the total', () => {
  const { rows, totals } = build({
    openingStock: 25,
    movements: [
      { quantity: 100, warehouse: 'Main Warehouse' },
      { quantity: -30, warehouse: 'Main Warehouse' },
      { quantity: 12, warehouse: 'Service Van' },
      { quantity: 7, warehouse: null },
    ],
  });
  const summed = rows.reduce((s, r) => s + r.onHand, 0) + totals.unassignedOnHand;
  assert.equal(summed, totals.onHand);
});

// ---------------------------------------------------------------------------
// Available to promise
// ---------------------------------------------------------------------------

test('available is on hand less committed plus ordered', () => {
  const { totals } = build({
    movements: [{ quantity: 114, warehouse: 'Main Warehouse' }],
    ordered: 40,
    committed: 18,
  });
  assert.equal(totals.available, 136);
});

test('available can go negative when more is sold than held', () => {
  const { totals } = build({
    movements: [{ quantity: 5, warehouse: 'Main Warehouse' }],
    committed: 20,
  });
  // Clamping this to zero would hide an oversell, which is the one thing the
  // figure exists to reveal.
  assert.equal(totals.available, -15);
});

test('ordered and committed default to 0 per warehouse when no per-warehouse data is supplied', () => {
  // A caller that has not fetched openOrderedQtyByWarehouse/
  // openCommittedQtyByWarehouse yet (or a line saved before PurchaseOrderItem/
  // SalesOrderItem grew a `warehouse` column) still gets a row — just with
  // nothing attributed to it, which is 0 now that the figure is genuinely
  // knowable per warehouse, not unknowable the way it used to be.
  const { rows, totals } = build({
    movements: [{ quantity: 10, warehouse: 'Main Warehouse' }],
    ordered: 40,
    committed: 18,
  });
  for (const row of rows) {
    assert.equal(row.ordered, 0);
    assert.equal(row.committed, 0);
  }
  // The totals row is unaffected — it is still the authoritative product-wide
  // figure, entirely independent of how (or whether) it is split per warehouse.
  assert.equal(totals.ordered, 40);
  assert.equal(totals.committed, 18);
});

test('ordered and committed attribute to the warehouse named on the open PO/SO line', () => {
  // Regression test for the exact bug reported against Product Master's
  // Inventory tab: a PO for 5, GRN for 2 (Ordered = 3 outstanding), an SO for
  // 5, a Delivery Challan for 2 (Committed = 3 outstanding) — all raised
  // against the SAME warehouse — showed Ordered/Committed as 0 on that
  // warehouse's own row even though the totals row correctly read 3 and 3.
  const { rows, totals } = build({
    movements: [{ quantity: 10, warehouse: 'NEXORAWAREHOUSE1' }],
    ordered: 3,
    committed: 3,
    orderedByWarehouse: { byWarehouse: new Map([['NEXORAWAREHOUSE1', 3]]), unassigned: 0 },
    committedByWarehouse: { byWarehouse: new Map([['NEXORAWAREHOUSE1', 3]]), unassigned: 0 },
    warehouses: [
      { warehouseCode: 'NEXORAWAREHOUSE1', warehouseName: 'Nexora Warehouse 1', branch: 'Nexora' },
      { warehouseCode: 'NEXORAWAREHOUSE2', warehouseName: 'Nexora Warehouse 2', branch: 'Nexora' },
    ],
  });

  const wh1 = rows.find((r) => r.warehouseCode === 'NEXORAWAREHOUSE1');
  const wh2 = rows.find((r) => r.warehouseCode === 'NEXORAWAREHOUSE2');
  assert.equal(wh1.onHand, 10);
  assert.equal(wh1.ordered, 3);
  assert.equal(wh1.committed, 3);
  assert.equal(wh1.available, 10); // 10 + 3 - 3, matching the totals row
  // A warehouse with no open PO/SO line of its own reports 0, not the other
  // warehouse's figure and not null.
  assert.equal(wh2.ordered, 0);
  assert.equal(wh2.committed, 0);
  assert.equal(totals.ordered, 3);
  assert.equal(totals.committed, 3);
});

test('an open PO/SO line saved before the warehouse column existed stays unattributed, not lost', () => {
  const { rows, totals } = build({
    movements: [{ quantity: 10, warehouse: 'Main Warehouse' }],
    ordered: 40,
    committed: 18,
    orderedByWarehouse: { byWarehouse: new Map([['WH-01', 10]]), unassigned: 30 },
    committedByWarehouse: { byWarehouse: new Map(), unassigned: 18 },
  });
  // WH-01 gets what is genuinely attributed to it...
  assert.equal(rows.find((r) => r.warehouseCode === 'WH-01').ordered, 10);
  // ...the other 30 (no warehouse on the line) isn't invented for any row...
  assert.equal(rows.find((r) => r.warehouseCode === 'WH-02').ordered, 0);
  assert.equal(rows.find((r) => r.warehouseCode === 'WH-03').ordered, 0);
  // ...but the total still reads the full, correct figure.
  assert.equal(totals.ordered, 40);
  assert.equal(totals.committed, 18);
});

// Levels tests removed — Min/Max Inventory Level (and the levels param
// buildInventoryRows used to take) was dropped; see migration
// 20260823210000_drop_product_warehouse_levels.

// ---------------------------------------------------------------------------
// openOrderedQtyByWarehouse / openCommittedQtyByWarehouse — the actual I/O
// functions, exercised against a fake client rather than through
// buildInventoryRows. The tests above prove buildInventoryRows attributes a
// { byWarehouse, unassigned } split correctly once it has one; these prove
// the split itself is built correctly from PurchaseOrderItem/
// SalesOrderItem rows — the part a bug in the query, the status filter, or
// (as actually happened) the value never being saved in the first place
// would slip past the tests above, since those simply hand it a Map already
// containing the right answer.
// ---------------------------------------------------------------------------

test('openCommittedQtyByWarehouse attributes by SalesOrderItem.warehouse when the line has one', () => {
  const client = fakeOrderItemsClient({
    salesOrderItems: [
      // SO for 5, 2 delivered -> 3 open, against NEXORAWAREHOUSE1 — the
      // exact PO 5/GRN 2, SO 5/DC 2 scenario reported against the Inventory
      // tab, where Ordered showed 3 correctly but Committed showed 0.
      {
        productCode: 'PROD-1', quantity: 5, deliveredQuantity: 2,
        warehouse: 'NEXORAWAREHOUSE1', orderStatus: 'Open',
      },
    ],
  });
  return openCommittedQtyByWarehouse('PROD-1', client).then(({ byWarehouse, unassigned }) => {
    assert.equal(byWarehouse.get('NEXORAWAREHOUSE1'), 3);
    assert.equal(unassigned, 0);
  });
});

test('openCommittedQtyByWarehouse falls back to unassigned when warehouse is null — the actual bug', () => {
  // Reproduces exactly what salesOrderItemSchema not declaring `warehouse`
  // did to every Sales Order ever saved through the form before that schema
  // was fixed (frontend/src/lib/validation/salesSchemas.js): Zod stripped
  // the field the "Warehouse *" column collected, so SalesOrderItem.warehouse
  // persisted as null however the form was filled in. This test is what
  // should have caught it — it fails on the pre-fix schema's actual output
  // (a null warehouse) and passes once the line carries a real one, matching
  // the test right above it.
  const client = fakeOrderItemsClient({
    salesOrderItems: [
      { productCode: 'PROD-1', quantity: 5, deliveredQuantity: 2, warehouse: null, orderStatus: 'Open' },
    ],
  });
  return openCommittedQtyByWarehouse('PROD-1', client).then(({ byWarehouse, unassigned }) => {
    assert.equal(byWarehouse.size, 0);
    assert.equal(unassigned, 3);
  });
});

test('openCommittedQtyByWarehouse excludes closed sales orders, same as the product-wide total', () => {
  const client = fakeOrderItemsClient({
    salesOrderItems: [
      { productCode: 'PROD-1', quantity: 5, deliveredQuantity: 0, warehouse: 'WH-01', orderStatus: 'Draft' },
      { productCode: 'PROD-1', quantity: 5, deliveredQuantity: 5, warehouse: 'WH-01', orderStatus: 'Delivered' },
      { productCode: 'PROD-1', quantity: 5, deliveredQuantity: 2, warehouse: 'WH-01', orderStatus: 'Open' },
    ],
  });
  return openCommittedQtyByWarehouse('PROD-1', client).then(({ byWarehouse, unassigned }) => {
    // Only the 'Open' line counts — Draft and Delivered are excluded by
    // CLOSED_SO_STATUSES, matching openCommittedQty's own filter exactly.
    assert.equal(byWarehouse.get('WH-01'), 3);
    assert.equal(unassigned, 0);
  });
});

test('openOrderedQtyByWarehouse attributes by PurchaseOrderItem.warehouse when the line has one', () => {
  const client = fakeOrderItemsClient({
    purchaseOrderItems: [
      { productCode: 'PROD-1', quantity: 5, receivedQuantity: 2, warehouse: 'NEXORAWAREHOUSE1', orderStatus: 'Open' },
    ],
  });
  return openOrderedQtyByWarehouse('PROD-1', client).then(({ byWarehouse, unassigned }) => {
    assert.equal(byWarehouse.get('NEXORAWAREHOUSE1'), 3);
    assert.equal(unassigned, 0);
  });
});

test('openOrderedQtyByWarehouse falls back to unassigned when warehouse is null', () => {
  const client = fakeOrderItemsClient({
    purchaseOrderItems: [
      { productCode: 'PROD-1', quantity: 5, receivedQuantity: 2, warehouse: null, orderStatus: 'Open' },
    ],
  });
  return openOrderedQtyByWarehouse('PROD-1', client).then(({ byWarehouse, unassigned }) => {
    assert.equal(byWarehouse.size, 0);
    assert.equal(unassigned, 3);
  });
});

// ---------------------------------------------------------------------------
// Valuation
// ---------------------------------------------------------------------------

test('valuation is matched through the journal key, using the full warehouse value', () => {
  // Stock.Warehouse is NVARCHAR(150) as of migration
  // 20260905080000_widen_stock_warehouse — journalKey no longer clips, so a
  // warehouse whose code/name is longer than 8 characters matches on its
  // full value rather than an 8-character prefix.
  assert.equal(journalKey('Main Warehouse'), 'Main Warehouse');

  const { rows } = build({
    valuations: new Map([[journalKey('Main Warehouse'), {
      itemCost: 350, fifoPrice: 340, movingAveragePrice: 347.5, averagePrice: 345,
    }]]),
  });
  const row = rows.find((r) => r.warehouseCode === 'WH-01');
  assert.equal(row.itemCost, 350);
  assert.equal(row.fifoPrice, 340);
  assert.equal(row.movingAveragePrice, 347.5);
  assert.equal(row.averagePrice, 345);
});

test('two warehouses sharing an 8-character prefix no longer collide on valuation', () => {
  // Regression test for the exact bug reported against Product Master's
  // Inventory tab: NEXORAWAREHOUSE1 and NEXORAWAREHOUSE2 both clipped to
  // 'NEXORAWA' under the old 8-character journal key, so warehouse 2 showed
  // warehouse 1's Avg Price/FIFO Price even though it had no stock activity
  // of its own. journalKey no longer clips, so each resolves independently.
  assert.notEqual(journalKey('NEXORAWAREHOUSE1'), journalKey('NEXORAWAREHOUSE2'));

  const { rows } = build({
    warehouses: [
      { warehouseCode: 'NEXORAWAREHOUSE1', warehouseName: 'Nexora Warehouse 1', branch: null },
      { warehouseCode: 'NEXORAWAREHOUSE2', warehouseName: 'Nexora Warehouse 2', branch: null },
    ],
    valuations: new Map([
      [journalKey('NEXORAWAREHOUSE1'), { averagePrice: 233.33 }],
    ]),
  });
  const wh1 = rows.find((r) => r.warehouseCode === 'NEXORAWAREHOUSE1');
  const wh2 = rows.find((r) => r.warehouseCode === 'NEXORAWAREHOUSE2');
  assert.equal(wh1.averagePrice, 233.33);
  // The bug: this used to also read 233.33, inherited from warehouse 1 via
  // the collided 'NEXORAWA' key.
  assert.equal(wh2.averagePrice, null);
});

test('legacyJournalKey still resolves warehouse history written before the widening', () => {
  // A row posted before migration 20260905080000_widen_stock_warehouse is
  // sitting in the journal under the OLD 8-character clip. A warehouse whose
  // 8-character prefix never collided with another still needs to find that
  // row, or its pre-fix valuation history goes dark instead of merely
  // staying (harmlessly, for a non-colliding warehouse) imprecise.
  assert.equal(legacyJournalKey('Distribution Center'), 'Distribu');

  const { rows } = build({
    // Simulates a Stock row written under the old scheme: only the clipped
    // key exists, there is no full-value entry.
    valuations: new Map([[legacyJournalKey('Main Warehouse'), { itemCost: 275 }]]),
  });
  const row = rows.find((r) => r.warehouseCode === 'WH-01');
  assert.equal(row.itemCost, 275);
});

test('a warehouse with no journal history reports no cost rather than zero', () => {
  const { rows } = build({ movements: [{ quantity: 3, warehouse: 'Service Van' }] });
  const row = rows.find((r) => r.warehouseCode === 'WH-02');
  // Zero would assert the product cost nothing, which is a different claim
  // from "it has never moved here, so there is no cost to report".
  assert.equal(row.itemCost, null);
  assert.equal(row.averagePrice, null);
});

// ---------------------------------------------------------------------------
// Rounding
// ---------------------------------------------------------------------------

test('fractional movements do not accumulate binary float error', () => {
  const { rows, totals } = build({
    movements: Array.from({ length: 3 }, () => ({ quantity: 0.1, warehouse: 'Main Warehouse' })),
  });
  // 0.1 + 0.1 + 0.1 is 0.30000000000000004 in IEEE 754. A stock quantity that
  // reads 0.30000000000000004 fails a stock count for no real reason.
  assert.equal(rows.find((r) => r.warehouseCode === 'WH-01').onHand, 0.3);
  assert.equal(totals.onHand, 0.3);
});

// ---------------------------------------------------------------------------
// Code / legacy-name matching
//
// Documents now store the warehouse CODE. Everything posted before the
// Warehouse Master was wired up stored a NAME — often a branch name, or the
// literal 'Main Warehouse'. A warehouse's history spans both.
// ---------------------------------------------------------------------------

test('movements stored by code are attributed to their warehouse', () => {
  const { rows } = build({ movements: [{ quantity: 40, warehouse: 'WH-01' }] });
  assert.equal(rows.find((r) => r.warehouseCode === 'WH-01').onHand, 40);
});

test('movements stored under the old name still count, and add to the new ones', () => {
  const { rows, totals } = build({
    movements: [
      { quantity: 40, warehouse: 'WH-01' },           // posted since the change
      { quantity: 10, warehouse: 'Main Warehouse' },  // posted before it
    ],
  });
  // Taking one form and ignoring the other would drop real stock — the
  // warehouse existed on both sides of the change.
  assert.equal(rows.find((r) => r.warehouseCode === 'WH-01').onHand, 50);
  assert.equal(totals.unassignedOnHand, 0, 'neither form is left unattributed');
});

test('valuation falls back to the legacy name when nothing is keyed by code', () => {
  const { rows } = build({
    valuations: new Map([[journalKey('Main Warehouse'), { itemCost: 350 }]]),
  });
  assert.equal(rows.find((r) => r.warehouseCode === 'WH-01').itemCost, 350);
});

test('valuation keyed by code wins over the legacy name', () => {
  const { rows } = build({
    valuations: new Map([
      [journalKey('WH-01'), { itemCost: 400 }],
      [journalKey('Main Warehouse'), { itemCost: 350 }],
    ]),
  });
  // The code is what documents write today, so it is the more current figure.
  assert.equal(rows.find((r) => r.warehouseCode === 'WH-01').itemCost, 400);
});

test('a branch name nobody mapped to a warehouse stays unassigned, not lost', () => {
  const { rows, totals } = build({
    movements: [
      { quantity: 40, warehouse: 'WH-01' },
      { quantity: 6, warehouse: 'Coimbatore' },  // a branch name, not a warehouse
    ],
  });
  assert.equal(rows.find((r) => r.warehouseCode === 'WH-01').onHand, 40);
  assert.equal(totals.unassignedOnHand, 6);
  assert.equal(totals.onHand, 46);
});
