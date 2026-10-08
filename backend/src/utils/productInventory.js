/**
 * Per-warehouse inventory position for one product — what Product Master's
 * Inventory tab shows.
 *
 * Everything except the Min/Max levels is DERIVED at read time: on-hand comes
 * from the same movement ledger the rest of the app uses (utils/stockLedger),
 * the valuations come from the append-only stock journal (the Stock model), and
 * ordered/committed come from the open purchase and sales orders. Nothing is
 * cached. A cached per-warehouse quantity is precisely how an inventory figure
 * ends up disagreeing with the ledger that produced it, and reconciling the two
 * afterwards is far more expensive than recomputing.
 *
 * One honest limit, surfaced rather than papered over:
 *
 * Product.openingStock has no warehouse — it is a single product-wide number
 * typed on the product record. It is reported under `unassignedOnHand`
 * instead of being silently folded into the first warehouse's row, which
 * would make that warehouse overstate its holding.
 *
 * This does NOT apply to the Opening Balance table (Inventory > Opening
 * Balance), which records a starting quantity per (item, warehouse) and so
 * lands on the right warehouse row. That table used to be ignored here
 * entirely — written by its page and its .xlsx import, then read back by
 * nothing — so a product whose whole starting position was keyed there
 * showed zero on hand in every warehouse until someone raised a Stock
 * Receipt for goods that were already on the shelf. It is now folded in
 * alongside the movements; see getOpeningBalanceMovements in
 * utils/stockLedger.js for why it is kept out of the movement list proper.
 *
 * ORDERED and COMMITTED used to be product-wide only: Purchase Order and
 * Sales Order lines carried no warehouse of their own when this was first
 * written, so there was nothing to attribute them by. Migration
 * 20260903090000_add_line_item_warehouse added a per-line `warehouse` column
 * to PurchaseOrderItem ("which warehouse this line is intended for once
 * received") and SalesOrderItem ("which warehouse this line would be
 * fulfilled from") — this module just never started reading it, so every
 * warehouse row kept showing Ordered/Committed as 0 (or null) regardless of
 * which warehouse an open order line actually named, even when every
 * document in the chain agreed on one warehouse. openOrderedQtyByWarehouse /
 * openCommittedQtyByWarehouse below attribute by that column now, the same
 * line-first-then-header convention every other document in this schema
 * uses; a line saved before the column existed (warehouse is null) has
 * nothing to attribute to and is folded into the total instead, the same
 * unassigned treatment on-hand already gets.
 *
 * Min/Max Inventory Level used to be stored per product+warehouse (the
 * ProductWarehouse model) and merged into these rows as the one non-derived
 * field. Removed on request — the table, the merge, and the save endpoint —
 * see migration 20260823210000_drop_product_warehouse_levels. Every row here
 * is now purely derived, no exceptions.
 */

const prisma = require('../prisma/client');
const { getStockMovements, getOpeningBalanceMovements } = require('./stockLedger');
const { round2 } = require('./documentTotals');
const { VALUATION_METHODS } = require('./stockValuation');

// Statuses whose orders are not an outstanding commitment. Stated per document
// rather than as one shared list, because the two vocabularies genuinely differ
// (see PO_STATUS_OPTIONS and ORDER_STATUS_OPTIONS in the frontend's validation
// schemas) and a single list would quietly fail to match half of them.
//
// Draft is excluded from both: a draft is not a commitment to anyone. The
// terminal states are belt-and-braces — a fully received or fully delivered
// order already nets to zero on the quantity arithmetic below — but naming them
// means the intent survives someone later changing how the quantities are kept.
const CLOSED_PO_STATUSES = ['Draft', 'Cancelled', 'Closed', 'Received'];
const CLOSED_SO_STATUSES = ['Draft', 'Cancelled', 'Delivered'];

const num = (v) => Number(v) || 0;

/**
 * Stock.Warehouse used to be NVARCHAR(8) while the documents carry full
 * warehouse codes/names, so the journal stored a clipped version (see
 * fitWarehouse in utils/stockTable.js) and this had to clip its own side of
 * the comparison to match, or every lookup missed for any warehouse whose
 * code was longer than eight characters. Two warehouses sharing the same
 * first 8 characters (e.g. 'NEXORAWAREHOUSE1'/'NEXORAWAREHOUSE2', both
 * clipping to 'NEXORAWA') then collided onto the same key, which is why
 * Product Master's Inventory tab could show one warehouse's Avg Price/FIFO
 * Price on another warehouse's row.
 *
 * The column is now NVARCHAR(150) — see migration
 * 20260905080000_widen_stock_warehouse — so this no longer clips; it matches
 * a journal row by its full, untruncated warehouse value.
 */
function journalKey(warehouseName) {
  if (warehouseName == null) return null;
  const str = String(warehouseName).trim();
  return str === '' ? null : str;
}

/**
 * The OLD (pre-widening) form of journalKey — an 8-character clip. Rows
 * written before the migration above are still sitting in the journal under
 * that clipped value, so a warehouse whose code is longer than 8 characters
 * needs this as a fallback lookup or its pre-fix history goes dark rather
 * than merely staying imprecise. Two warehouses that already collided under
 * the old scheme remain ambiguous — there is no way to tell, after the fact,
 * which of them a given clipped row belonged to — but a warehouse that never
 * collided (nothing else shares its first 8 characters) resolves correctly
 * by this fallback alone.
 */
function legacyJournalKey(warehouseName) {
  const key = journalKey(warehouseName);
  return key == null ? null : (key.length > 8 ? key.slice(0, 8) : key);
}

/**
 * Valuation per warehouse from the stock journal.
 *
 *  itemCost           the most recent unit price the product moved at
 *  movingAveragePrice the running Moving Average the journal recorded, latest
 *                     value — written only for products whose Calculation
 *                     Method is Moving Average, so null otherwise
 *  fifoPrice          same, for FIFO
 *  averagePrice       inward value divided by inward quantity: the plain
 *                     weighted average of what was actually paid. Distinct
 *                     from movingAveragePrice, which is a costing method's
 *                     running figure — this one is computed here and is always
 *                     available whatever the costing method.
 *
 * @param calculationMethod the product's own Calculation Method (see
 *                       VALUATION_METHODS in utils/stockValuation.js). The
 *                       Stock journal itself only carries ONE cost column
 *                       (ItemCost — FIFO and Moving Average are mutually
 *                       exclusive per product, so one column holds whichever
 *                       applies), so this decides which of fifoPrice /
 *                       movingAveragePrice the read-back value is reported
 *                       under; the other stays null, same as before this
 *                       column was consolidated.
 */
async function valuationByWarehouse(productCode, calculationMethod) {
  // The Stock delegate only exists on a Prisma Client generated after the
  // Stock model was added. Treat its absence as "no journal yet" rather than
  // failing the whole tab — the quantities are still worth showing.
  if (!prisma.stock) return new Map();

  const rows = await prisma.stock.findMany({
    where: { itemCode: productCode },
    select: {
      warehouse: true, stockPrice: true, inQty: true, itemCost: true, logEntry: true,
    },
    orderBy: { logEntry: 'asc' },
  });

  const isFifo = calculationMethod === VALUATION_METHODS.FIFO;
  const isMovingAverage = calculationMethod === VALUATION_METHODS.MOVING_AVERAGE;

  const byWarehouse = new Map();
  for (const row of rows) {
    const key = row.warehouse || '';
    if (!byWarehouse.has(key)) {
      byWarehouse.set(key, {
        itemCost: null, fifoPrice: null, movingAveragePrice: null,
        inwardValue: 0, inwardQty: 0,
      });
    }
    const acc = byWarehouse.get(key);

    // Rows are in logEntry order, so a later row simply overwrites — the last
    // non-null wins and that is the current figure.
    //
    // NOTE: acc.itemCost here is THIS function's own output field ("the most
    // recent unit price the product moved at" — see the doc comment above),
    // sourced from Stock.StockPrice. It is a different thing from
    // row.itemCost below, which is the Stock model's own ItemCost column
    // (the FIFO-or-Moving-Average valuation cost recorded on that row) —
    // same name, two unrelated meanings; don't conflate them when editing
    // this function.
    if (row.stockPrice != null) acc.itemCost = num(row.stockPrice);
    if (row.itemCost != null) {
      if (isFifo) acc.fifoPrice = num(row.itemCost);
      if (isMovingAverage) acc.movingAveragePrice = num(row.itemCost);
    }

    const inQty = num(row.inQty);
    if (inQty > 0) {
      acc.inwardQty += inQty;
      acc.inwardValue += num(row.stockPrice) * inQty;
    }
  }

  const out = new Map();
  for (const [key, acc] of byWarehouse) {
    out.set(key, {
      itemCost: acc.itemCost,
      fifoPrice: acc.fifoPrice,
      movingAveragePrice: acc.movingAveragePrice,
      averagePrice: acc.inwardQty > 0 ? round2(acc.inwardValue / acc.inwardQty) : null,
    });
  }
  return out;
}

/**
 * Opening-balance valuation per warehouse: stockValue / stock, keyed by the
 * warehouse CODE the row was recorded against.
 *
 * Used only as a FALLBACK for `averagePrice` on warehouses the stock journal
 * says nothing about. A product whose entire holding is an opening balance has
 * no journal rows at all — no receipt, no invoice, nothing that would have
 * written a price — so its Avg Price column read 0.00 next to a real quantity,
 * which reads as "this stock is worthless" rather than "no cost recorded". The
 * opening balance carries the value the stock was brought in at, which is
 * precisely the figure that column is asking for.
 *
 * It never overrides a journal figure: once the product has actually moved,
 * the journal's weighted average is the better number and wins.
 */
async function openingBalanceValuation(productCode) {
  if (!prisma.openingBalance) return new Map();

  const rows = await prisma.openingBalance.findMany({
    where: { itemCode: productCode, status: 'Active' },
    select: { warehouse: true, stock: true, stockValue: true },
  });

  const out = new Map();
  for (const row of rows) {
    const quantity = num(row.stock);
    const value = num(row.stockValue);
    if (quantity <= 0 || value <= 0) continue;
    out.set(row.warehouse, round2(value / quantity));
  }
  return out;
}

/**
 * Open purchase-order quantity for a product: ordered but not yet received.
 *
 * `client` defaults to the shared singleton but can be overridden — same
 * convention as utils/stockLedger.js — so this can be exercised in a test
 * against a fake client instead of a live database.
 */
async function openOrderedQty(productCode, client = prisma) {
  const items = await client.purchaseOrderItem.findMany({
    where: {
      productCode,
      order: { status: { notIn: CLOSED_PO_STATUSES } },
    },
    select: { quantity: true, receivedQuantity: true },
  });
  // Clamped at zero per line: over-receipt is a real occurrence, and letting a
  // negative line net off another line's genuine outstanding quantity would
  // understate what is still on order.
  return round2(items.reduce(
    (sum, i) => sum + Math.max(0, num(i.quantity) - num(i.receivedQuantity)), 0,
  ));
}

/** Open sales-order quantity for a product: sold but not yet delivered. */
async function openCommittedQty(productCode, client = prisma) {
  const items = await client.salesOrderItem.findMany({
    where: {
      productCode,
      order: { status: { notIn: CLOSED_SO_STATUSES } },
    },
    select: { quantity: true, deliveredQuantity: true },
  });
  return round2(items.reduce(
    (sum, i) => sum + Math.max(0, num(i.quantity) - num(i.deliveredQuantity)), 0,
  ));
}

/**
 * Open purchase-order quantity for a product, split by PurchaseOrderItem's
 * own `warehouse` column (see the doc comment at the top of this file).
 *
 * Returns { byWarehouse, unassigned }: `byWarehouse` maps a warehouse value
 * (whatever the line has — code today, occasionally a legacy name) to its
 * open quantity; `unassigned` is the sum of lines saved before the warehouse
 * column existed, which have nothing to attribute to. The two always sum to
 * the same total openOrderedQty() reports, since both read the same lines
 * under the same open-PO filter — only the grouping differs.
 */
async function openOrderedQtyByWarehouse(productCode, client = prisma) {
  const items = await client.purchaseOrderItem.findMany({
    where: {
      productCode,
      order: { status: { notIn: CLOSED_PO_STATUSES } },
    },
    select: { quantity: true, receivedQuantity: true, warehouse: true },
  });

  const byWarehouse = new Map();
  let unassigned = 0;
  for (const item of items) {
    const open = Math.max(0, num(item.quantity) - num(item.receivedQuantity));
    if (open <= 0) continue;
    const key = item.warehouse || null;
    if (key == null) {
      unassigned += open;
      continue;
    }
    byWarehouse.set(key, round2((byWarehouse.get(key) || 0) + open));
  }
  return { byWarehouse, unassigned: round2(unassigned) };
}

/**
 * Open sales-order quantity for a product, split by SalesOrderItem's own
 * `warehouse` column — same shape and reasoning as
 * openOrderedQtyByWarehouse above.
 *
 * Regression coverage: this is exactly the query that read back 0 for every
 * warehouse despite the total being correct, because SalesOrderItem.warehouse
 * was always null — salesOrderItemSchema (frontend/src/lib/validation/
 * salesSchemas.js) never declared a `warehouse` field, so Zod silently
 * stripped it from every Sales Order line before the request left the
 * browser, however the required "Warehouse *" column on the form was filled
 * in. See the test 'attributes committed quantity by SalesOrderItem.warehouse'
 * in productInventory.test.js, which exercises this function directly against
 * a line that DOES carry a warehouse, so a future regression on either side
 * (this query, or the schema silently dropping the field again) fails loudly
 * instead of only being noticeable by eye on the Inventory tab.
 */
async function openCommittedQtyByWarehouse(productCode, client = prisma) {
  const items = await client.salesOrderItem.findMany({
    where: {
      productCode,
      order: { status: { notIn: CLOSED_SO_STATUSES } },
    },
    select: { quantity: true, deliveredQuantity: true, warehouse: true, order: { select: { branch: true } }  },
  });

  const branches = await client.warehouseMaster.findMany({
    where: { status: 'Active' },
    select: { whsCode: true, branch: true}
  })
  const branchWhsMap = new Map();
  for (const w of branches) {
    if (w.branch && !branchWhsMap.has(w.branch)) branchWhsMap.set(w.branch, w.whsCode);
  }

  const byWarehouse = new Map();
  let unassigned = 0;
  for (const item of items) {
    const open = Math.max(0, num(item.quantity) - num(item.deliveredQuantity));
    if (open <= 0) continue;
    const key = item.warehouse || branchWhsMap.get(item.order?.branch) || null;
    if (key == null) {
      unassigned += open;
      continue;
    }
    byWarehouse.set(key, round2((byWarehouse.get(key) || 0) + open));
  }
  return { byWarehouse, unassigned: round2(unassigned) };
}

/**
 * Bulk form of openCommittedQtyByWarehouse above, for reports that need
 * open (sold-but-not-yet-delivered) quantity for many products at once
 * rather than Product Master's Inventory tab, which only ever looks at one
 * product. Same open-order filter, same line-then-branch warehouse
 * attribution — see the doc comment on openCommittedQtyByWarehouse for why
 * the branch fallback exists. Unassigned lines (no line warehouse and no
 * warehouse resolvable from the order's branch) are folded into an
 * 'Unassigned' bucket per product, matching the same 'Unassigned' label the
 * Available Balance report already uses for Stock rows with no warehouse.
 *
 * Returns a Map keyed by `${productCode}::${warehouse}` -> open committed
 * qty, for every productCode in `productCodes` that has at least one open
 * Sales Order line.
 */
async function openCommittedQtyByWarehouseForCodes(productCodes, client = prisma) {
  const result = new Map();
  if (!productCodes || productCodes.length === 0) return result;

  const items = await client.salesOrderItem.findMany({
    where: {
      productCode: { in: productCodes },
      order: { status: { notIn: CLOSED_SO_STATUSES } },
    },
    select: { productCode: true, quantity: true, deliveredQuantity: true, warehouse: true, order: { select: { branch: true } } },
  });
  if (items.length === 0) return result;

  const branches = await client.warehouseMaster.findMany({
    where: { status: 'Active' },
    select: { whsCode: true, branch: true },
  });
  const branchWhsMap = new Map();
  for (const w of branches) {
    if (w.branch && !branchWhsMap.has(w.branch)) branchWhsMap.set(w.branch, w.whsCode);
  }

  for (const item of items) {
    if (!item.productCode) continue;
    const open = Math.max(0, num(item.quantity) - num(item.deliveredQuantity));
    if (open <= 0) continue;
    const warehouse = item.warehouse || branchWhsMap.get(item.order?.branch) || 'Unassigned';
    const key = `${item.productCode}::${warehouse}`;
    result.set(key, round2((result.get(key) || 0) + open));
  }
  return result;
}

/**
 * Pure aggregation, split out from the I/O above so it can be tested without a
 * database. Given the movements, the warehouse master, the stored levels and
 * the valuations, produce the rows the tab renders.
 */
function buildInventoryRows({
  warehouses, movements, valuations, openingStock, ordered, committed,
  // Map of warehouseCode -> unit value from the Opening Balance table, used
  // only where the stock journal has no average of its own. See
  // openingBalanceValuation above.
  openingValuations = new Map(),
  // Movement-shaped rows from the Opening Balance table — see
  // getOpeningBalanceMovements in stockLedger.js. Defaulted so existing
  // callers and tests that predate it keep working unchanged.
  openingBalances = [],
  // { byWarehouse: Map<warehouse value, qty>, unassigned: number } from
  // openOrderedQtyByWarehouse/openCommittedQtyByWarehouse above. Defaulted to
  // an empty split so a caller that has not fetched per-warehouse data yet
  // (and every existing test) still gets a row, just with 0 in both columns
  // rather than an attributed figure.
  orderedByWarehouse = { byWarehouse: new Map(), unassigned: ordered },
  committedByWarehouse = { byWarehouse: new Map(), unassigned: committed },
}) {
  const onHandByWarehouse = new Map();
  let unassignedOnHand = 0;
  // Opening balances are aggregated through the same map as the movements:
  // they carry a warehouse and a signed quantity in exactly the same shape, so
  // a warehouse's on-hand figure is its starting position plus everything that
  // has moved through it since.
  for (const m of [...openingBalances, ...movements]) {
    if (!m.warehouse) {
      // A movement from a document type that records no warehouse (see
      // SOURCES in stockLedger.js — the de-duplicating invoice sources).
      unassignedOnHand = round2(unassignedOnHand + m.quantity);
      continue;
    }
    onHandByWarehouse.set(m.warehouse, round2((onHandByWarehouse.get(m.warehouse) || 0) + m.quantity));
  }
  // Product.openingStock — as opposed to the Opening Balance rows folded in
  // above — is a single product-wide figure with no warehouse of its own, so
  // it belongs to no row either.
  unassignedOnHand = round2(unassignedOnHand + openingStock);

  const rows = warehouses.map((w) => {
    const hasDistinctName = Boolean(w.warehouseName && w.warehouseName !== w.warehouseCode);
    // Documents store the warehouse CODE now. Older ones stored a NAME — and
    // before the master was wired up, often a branch name or the literal
    // 'Main Warehouse'. Both forms are looked up so a warehouse's history does
    // not appear to begin on the day the codes were introduced.
    //
    // The two are ADDED rather than one taking precedence: a warehouse that
    // existed either side of the change legitimately has movements recorded
    // under both forms, and picking one would drop the other's stock.
    const onHand = round2(
      (onHandByWarehouse.get(w.warehouseCode) || 0)
      + (hasDistinctName ? (onHandByWarehouse.get(w.warehouseName) || 0) : 0),
    );
    // Full-value match first (how every row is now written); the legacy
    // 8-character clip last, purely so a warehouse's history from before
    // migration 20260905080000_widen_stock_warehouse still resolves. See
    // journalKey/legacyJournalKey above.
    const valuation = valuations.get(journalKey(w.warehouseCode))
      || (hasDistinctName && valuations.get(journalKey(w.warehouseName)))
      || valuations.get(legacyJournalKey(w.warehouseCode))
      || (hasDistinctName && valuations.get(legacyJournalKey(w.warehouseName)))
      || {};
    // Same code-then-legacy-name attribution as on-hand above, added rather
    // than one taking precedence for the same reason: an open order line
    // saved under either form is still a real open quantity against this
    // warehouse.
    const orderedQty = round2(
      (orderedByWarehouse.byWarehouse.get(w.warehouseCode) || 0)
      + (hasDistinctName ? (orderedByWarehouse.byWarehouse.get(w.warehouseName) || 0) : 0),
    );
    const committedQty = round2(
      (committedByWarehouse.byWarehouse.get(w.warehouseCode) || 0)
      + (hasDistinctName ? (committedByWarehouse.byWarehouse.get(w.warehouseName) || 0) : 0),
    );
    return {
      warehouseCode: w.warehouseCode,
      warehouseName: w.warehouseName,
      branch: w.branch || null,
      onHand,
      ordered: orderedQty,
      committed: committedQty,
      // SAP's own definition, same formula as the totals row: what is free to
      // promise here is what this warehouse holds, less what is already sold
      // from it, plus what is already on its way into it.
      available: round2(onHand + orderedQty - committedQty),
      itemCost: valuation.itemCost ?? null,
      movingAveragePrice: valuation.movingAveragePrice ?? null,
      // Journal average first, opening-balance value second — see
      // openingBalanceValuation above.
      averagePrice: valuation.averagePrice
        ?? openingValuations.get(w.warehouseCode)
        ?? null,
      fifoPrice: valuation.fifoPrice ?? null,
    };
  });

  // Stock recorded against a warehouse that is NOT in the list — one since
  // deactivated, renamed, or removed from the master. No row will claim it, so
  // without this it would simply disappear and the tab would report less stock
  // than the ledger holds. It is real quantity sitting somewhere; it just has
  // no current warehouse to sit under, which is the same situation as opening
  // stock, so it joins the unassigned figure rather than being lost.
  const claimed = new Set(warehouses.flatMap((w) => [w.warehouseCode, w.warehouseName]));
  for (const [key, quantity] of onHandByWarehouse) {
    if (claimed.has(key)) continue;
    unassignedOnHand = round2(unassignedOnHand + quantity);
  }

  const warehouseOnHand = rows.reduce((s, r) => s + r.onHand, 0);
  const totalOnHand = round2(warehouseOnHand + unassignedOnHand);

  return {
    rows,
    totals: {
      onHand: totalOnHand,
      ordered,
      committed,
      // SAP's definition: what is free to promise is what is held, less what is
      // already sold, plus what is already on its way in.
      available: round2(totalOnHand - committed + ordered),
      // Stock that exists but cannot be attributed to a warehouse: opening
      // stock, plus movements from documents that record no warehouse. Shown
      // separately so the warehouse rows and the total visibly reconcile
      // instead of appearing not to add up.
      unassignedOnHand,
    },
  };
}

/** The Inventory tab's payload for one product. */
async function getProductInventory(productCode) {
  const product = await prisma.product.findFirst({
    where: { productCode },
    select: { productCode: true, openingStock: true, calculationMethod: true },
  });
  if (!product) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }

  const [
    warehouses, movements, openingBalances, valuations, ordered, committed, openingValuations,
    orderedByWarehouse, committedByWarehouse,
  ] = await Promise.all([
    // WarehouseMaster ([dbo].[warehouse]) is the single warehouse master the
    // whole application now reads from. The older Warehouse model
    // ([dbo].[warehouses]) is retired — see the note on it in schema.prisma.
    prisma.warehouseMaster.findMany({
      where: { status: 'Active' },
      orderBy: { whsCode: 'asc' },
      select: { whsCode: true, whsName: true, branch: true },
    }).then((rows) => rows.map((w) => ({
      warehouseCode: w.whsCode,
      warehouseName: w.whsName,
      branch: w.branch,
    }))),
    getStockMovements({ productCodes: [productCode] }),
    // The per-warehouse starting position keyed under Inventory > Opening
    // Balance. Warehouse-tagged (its `warehouse` column is a foreign key onto
    // WarehouseMaster.whsCode), so unlike Product.openingStock below it lands
    // on a real warehouse row instead of the unassigned bucket.
    getOpeningBalanceMovements({ productCodes: [productCode] }),
    valuationByWarehouse(productCode, product.calculationMethod),
    openOrderedQty(productCode),
    openCommittedQty(productCode),
    openingBalanceValuation(productCode),
    // Per-warehouse split of the same two figures, via PurchaseOrderItem/
    // SalesOrderItem's own `warehouse` column — see the doc comment at the
    // top of this file. ordered/committed above remain the authoritative
    // totals; these only decide how each warehouse row's share is shown.
    openOrderedQtyByWarehouse(productCode),
    openCommittedQtyByWarehouse(productCode),
  ]);

  return buildInventoryRows({
    warehouses,
    movements,
    openingBalances,
    valuations,
    openingValuations,
    openingStock: num(product.openingStock),
    ordered,
    committed,
    orderedByWarehouse,
    committedByWarehouse,
  });
}

// saveProductInventoryLevels (and the ProductWarehouse model it wrote to)
// removed along with Min/Max Inventory Level — see migration
// 20260823210000_drop_product_warehouse_levels. Every figure this module
// returns is now derived, nothing is persisted here.

module.exports = {
  getProductInventory,
  buildInventoryRows,
  openingBalanceValuation,
  openOrderedQtyByWarehouse,
  openCommittedQtyByWarehouse,
  openCommittedQtyByWarehouseForCodes,
  journalKey,
  legacyJournalKey,
  CLOSED_PO_STATUSES,
  CLOSED_SO_STATUSES,
};
