const { round2 } = require('./documentTotals');

/**
 * SQL Server caps a single query at ~2,100 parameters. `productCode: { in:
 * productCodes } }` below burns one param per code, so any caller passing an
 * unfiltered product list (this schema's product master runs well into five
 * figures) blows past that wall in a single unchunked query. 1,500 leaves
 * headroom for the handful of other params (status list, date, warehouse)
 * each query also carries.
 */
const PRODUCT_CODE_CHUNK_SIZE = 1500;
function chunkArray(arr, size) {
  if (!arr || !arr.length) return [arr || []];
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

/**
 * Chunking alone isn't enough once a caller (like getStockMovements, which
 * fans a single call out across 7 document-type sources) ends up with dozens
 * of chunk queries: firing them all at once via a plain Promise.all opens
 * that many simultaneous connections to the DB server, which is its own way
 * to get "Can't reach database server" — especially over a networked
 * connection (this app's DB is not localhost) rather than an in-process
 * limit like the 2100-parameter one chunking works around. Running a bounded
 * number at a time keeps total connections sane regardless of how many
 * chunks a call ends up needing.
 */
const DB_QUERY_CONCURRENCY = 4;
async function runWithConcurrency(tasks, limit = DB_QUERY_CONCURRENCY) {
  const results = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

/**
 * The shared Prisma client, resolved lazily rather than required at module
 * load. Constructing it eagerly means merely importing this file spins up a
 * database client — which a caller passing its own client never wanted, and
 * which makes the module impossible to exercise without a live query engine.
 */
let sharedPrisma = null;
function defaultClient() {
  if (!sharedPrisma) sharedPrisma = require('../prisma/client');
  return sharedPrisma;
}

/**
 * The stock ledger — every document in the application that moves inventory.
 *
 * This module previously derived on-hand quantity from only three documents:
 *
 *   openingStock + Stock Receipts − Stock Issues ± Stock Adjustments
 *
 * Goods Received Notes, Delivery Challans and invoices were absent. Inventory
 * was therefore completely decoupled from procure-to-pay and order-to-cash:
 * goods could be received against a purchase order and sold to a customer all
 * day without on-hand stock changing by a single unit, and the only way to
 * correct it was to key a manual stock document duplicating a movement the
 * system already knew about. Every downstream report — stock summary,
 * valuation, low stock, slow moving, dead stock, reorder level — inherited the
 * error, as did the dashboard's inventory alerts.
 *
 * Seven document types now post here.
 *
 * ## Avoiding double counting
 *
 * The same physical movement can be described by two documents. Goods arriving
 * are recorded on a GRN and then again on the Purchase Invoice raised from it;
 * goods leaving are recorded on a Delivery Challan and then again on the Sales
 * Invoice. Counting both would double the movement.
 *
 * SAP resolves this by having the delivery move stock while the invoice
 * carries only the financial posting. This application does not require a
 * delivery — an invoice can legitimately be raised on its own — so the rule
 * here is:
 *
 *   an invoice moves stock only when no delivery document is linked to it.
 *
 * A Purchase Invoice with a `grnNo` is financial only; one without is treated
 * as the receipt itself. A Sales Invoice with a `deliveryChallanNo` is
 * financial only; one without is treated as the issue. That covers both the
 * two-step and the one-step flow without ever counting a movement twice.
 *
 * ## Which documents count
 *
 * A document moves stock once it is no longer a draft and has not been
 * cancelled. The status vocabulary differs per document (a GRN is 'Received',
 * a challan is 'Delivered', a stock document is 'Posted'), so rather than
 * listing the positive values — and silently missing any new one added to the
 * frontend's option lists later — each source excludes the statuses meaning
 * "this has not happened yet" or "this was undone".
 */

/**
 * Statuses that mean a document has not actually moved anything, keyed by
 * source.key below.
 *
 * 'Open' USED to be Stock Transfer's own not-yet-posted status here, kept in
 * lockstep with the identical exclusion in stockTable.js's
 * NON_MOVING_STATUSES_BY_TRANS_TYPE. Stock Transfer now posts stock as soon
 * as it is raised (or, for a Request-linked transfer, as soon as that
 * request is approved) rather than waiting for its Receipt to close it — see
 * routes/resources.js's stockTransferPostable/syncStockTransferMovement —
 * so 'Open' is no longer excluded by status here either; every other source
 * already uses 'Open' as its ordinary active/saved status, and Stock
 * Transfer now does too.
 *
 * What DOES still need excluding — because it is exactly what
 * stockTransferPostable in routes/resources.js checks before ever calling
 * postStockEntries for one of these two TransTypes — is a transfer that is
 * either not yet approved (raised against a still-Pending or Rejected Stock
 * Transfer Request) or not yet resolvable (a Branch Transfer whose
 * destination branch has no Transit Warehouse set yet, leaving some line's
 * toWarehouse blank). See stockTransferReadyFilter below, folded into both
 * SOURCES entries' headerFilter — this MUST stay the same test
 * stockTransferPostable applies, or this derived ledger will count a
 * transfer's legs as moved stock before (or after) the journal actually
 * posted them.
 */
const BASE_NON_MOVING_STATUSES = ['Draft', 'Cancelled', 'Pending'];

const NON_MOVING_STATUSES_BY_SOURCE_KEY = {};

// Kept for backward compatibility with any external reader that imported the
// flat list directly; buildWhere() below no longer uses it directly — see
// nonMovingStatusesForSource(). No source treats 'Open' as non-moving any
// more (see the comment above), so this no longer carries it.
const NON_MOVING_STATUSES = [...BASE_NON_MOVING_STATUSES];

function nonMovingStatusesForSource(source) {
  return NON_MOVING_STATUSES_BY_SOURCE_KEY[source.key] || BASE_NON_MOVING_STATUSES;
}

/**
 * Extra header condition for stockTransferOut/stockTransferIn (folded into
 * their headerFilter below): only count a transfer's legs once
 * routes/resources.js's stockTransferPostable would actually let them post.
 *
 * `approvalStatus` is a plain column on StockTransfer (checked directly —
 * both sources share headerRelation: 'transfer', so this reads the same
 * header row either way). Readiness ("every line's From/To Warehouse is
 * resolved") is a per-LINE condition but the posting policy it backs is
 * all-or-nothing per DOCUMENT (see assertStockTransferItemsHaveWarehouses'
 * doc comment on why a Branch Transfer's toWarehouse can be blank at all),
 * so this reaches back through the header's own `items` relation with an
 * `every` — Prisma allows filtering a relation by a condition on ONE of its
 * own further relations, which is what lets a per-item column (toWarehouse)
 * be asked about "every sibling line on this transfer" rather than just the
 * one row this query happens to be looking at.
 */
const stockTransferReadyFilter = {
  OR: [{ requestNo: null }, { requestNo: '' }, { approvalStatus: 'Approved' }],
  items: { every: { fromWarehouse: { not: null }, toWarehouse: { not: null } } },
};

/**
 * One entry per document type that moves stock.
 *
 * quantityField  — the column holding the moved quantity
 * direction      — +1 inward, -1 outward, 0 signed (the value carries its sign)
 * warehouseField — where the movement happened, for warehouse-filtered reports
 * dateField      — the effective date, for as-on-date reports
 * headerFilter   — extra header conditions (used for the invoice de-duplication)
 */
const SOURCES = [
  {
    key: 'stockReceipt',
    label: 'Stock Receipt',
    itemDelegate: (c) => c.stockReceiptItem,
    headerRelation: 'receipt',
    quantityField: 'quantity',
    direction: +1,
    warehouseField: 'warehouse',
    dateField: 'date',
  },
  {
    key: 'stockIssue',
    label: 'Stock Issue',
    itemDelegate: (c) => c.stockIssueItem,
    headerRelation: 'issue',
    quantityField: 'quantity',
    direction: -1,
    warehouseField: 'toWarehouse',
    dateField: 'date',
  },
  {
    key: 'stockAdjustment',
    label: 'Stock Adjustment',
    itemDelegate: (c) => c.stockAdjustmentItem,
    headerRelation: 'adjustment',
    quantityField: 'differenceQuantity',
    direction: 0, // already signed: positive is a surplus, negative a shortfall
    warehouseField: 'warehouse',
    dateField: 'date',
  },
  // A Stock Transfer is two entries sharing one item table (see
  // StockTransferItem in schema.prisma) — an outbound leg at each line's own
  // fromWarehouse and an inbound leg at its own toWarehouse; there is no
  // header-level From/To Warehouse. Company-wide these cancel exactly to
  // zero net movement (as a transfer must — nothing enters or leaves the
  // business), which is what keeps every existing product-wide "current
  // stock" figure (Product Master, low-stock/dead-stock/reorder reports, the
  // negative-stock guard) correct without any changes; only warehouse-scoped
  // queries (Stock Summary/Valuation filtered to one warehouse) actually see
  // the transfer as a movement, on the correct side.
  {
    key: 'stockTransferOut',
    label: 'Stock Transfer',
    itemDelegate: (c) => c.stockTransferItem,
    headerRelation: 'transfer',
    quantityField: 'quantity',
    direction: -1,
    warehouseField: 'fromWarehouse',
    // Each line names its own From/To Warehouse — see
    // StockTransferItem.fromWarehouse/toWarehouse. Every other source's
    // warehouseField lives on the header, reached through headerRelation;
    // `warehouseScope: 'item'` tells buildWhere/getStockMovements below to
    // read and filter on the ITEM's own column instead, so a
    // warehouse-filtered report (or this line's contribution to current
    // stock) attributes to the warehouse the line actually moved against.
    warehouseScope: 'item',
    dateField: 'requestDate',
    headerFilter: stockTransferReadyFilter,
  },
  {
    key: 'stockTransferIn',
    label: 'Stock Transfer',
    itemDelegate: (c) => c.stockTransferItem,
    headerRelation: 'transfer',
    quantityField: 'quantity',
    direction: +1,
    warehouseField: 'toWarehouse',
    warehouseScope: 'item',
    dateField: 'requestDate',
    headerFilter: stockTransferReadyFilter,
  },
  {
    key: 'goodsReceivedNote',
    label: 'Goods Received Note',
    itemDelegate: (c) => c.goodsReceivedNoteItem,
    headerRelation: 'grn',
    quantityField: 'receivedQuantity',
    direction: +1,
    warehouseField: 'warehouse',
    warehouseScope: 'item-or-header',
    headerWarehouseField: 'warehouse',
    dateField: 'receivedDate',
  },
  {
    key: 'deliveryChallan',
    label: 'Delivery Challan',
    itemDelegate: (c) => c.deliveryChallanItem,
    headerRelation: 'challan',
    quantityField: 'quantity',
    direction: -1,
    warehouseField: 'warehouse',
    warehouseScope: 'item-or-header',
    headerWarehouseField: 'fromWarehouse',
    dateField: 'challanDate',
  },
  {
    key: 'purchaseInvoice',
    label: 'Purchase Invoice',
    itemDelegate: (c) => c.purchaseInvoiceItem,
    headerRelation: 'invoice',
    quantityField: 'quantity',
    direction: +1,
    warehouseField: 'warehouse',
    warehouseScope: 'item-or-header',
    headerWarehouseField: 'warehouse',
    dateField: 'invoiceDate',
    // Only when the goods were not already received on a GRN.
    headerFilter: { OR: [{ grnNo: null }, { grnNo: '' }] },
  },
  {
    key: 'salesInvoice',
    label: 'Sales Invoice',
    itemDelegate: (c) => c.salesInvoiceItem,
    headerRelation: 'invoice',
    quantityField: 'quantity',
    direction: -1,
    warehouseField: 'warehouse',
    warehouseScope: 'item-or-header',
    headerWarehouseField: 'warehouse',
    dateField: 'invoiceDate',
    // Only when the goods were not already despatched on a delivery challan.
    headerFilter: { OR: [{ deliveryChallanNo: null }, { deliveryChallanNo: '' }] },
  },
  // Purchase Return / Purchase Credit Memo — goods going back OUT to a
  // supplier, same direction as a Delivery Challan. Newly wired into the
  // stock ledger (see the schema.prisma comments on PurchaseReturn/
  // PurchaseCreditMemo.warehouse) — previously these were financial-only
  // documents with no stock effect at all.
  {
    key: 'purchaseReturn',
    label: 'Purchase Return',
    itemDelegate: (c) => c.purchaseReturnItem,
    headerRelation: 'purchaseReturn',
    quantityField: 'returnQuantity',
    direction: -1,
    warehouseField: 'warehouse',
    warehouseScope: 'item-or-header',
    headerWarehouseField: 'warehouse',
    dateField: 'postingDate',
  },
  {
    key: 'purchaseCreditMemo',
    label: 'Purchase Credit Memo',
    itemDelegate: (c) => c.purchaseCreditMemoItem,
    headerRelation: 'creditMemo',
    quantityField: 'quantity',
    direction: -1,
    warehouseField: 'warehouse',
    warehouseScope: 'item-or-header',
    headerWarehouseField: 'warehouse',
    dateField: 'postingDate',
  },
  // Sales Return / Sales Credit Memo — goods coming back IN from a customer,
  // same direction as a Goods Received Note ("Restock" — see
  // BatchSerialRestockDialog.jsx and the businessRules.js functions of the
  // same name). Newly wired into the stock ledger for the same reason as the
  // purchase side above.
  {
    key: 'salesReturn',
    label: 'Sales Return',
    itemDelegate: (c) => c.salesReturnItem,
    headerRelation: 'salesReturn',
    quantityField: 'returnQuantity',
    direction: +1,
    warehouseField: 'warehouse',
    warehouseScope: 'item-or-header',
    headerWarehouseField: 'warehouse',
    dateField: 'postingDate',
  },
  {
    key: 'salesCreditMemo',
    label: 'Sales Credit Memo',
    itemDelegate: (c) => c.salesCreditMemoItem,
    headerRelation: 'creditMemo',
    quantityField: 'quantity',
    direction: +1,
    warehouseField: 'warehouse',
    warehouseScope: 'item-or-header',
    headerWarehouseField: 'warehouse',
    dateField: 'postingDate',
  },
];

/**
 * Opening Balance (Inventory > Opening Balance, [dbo].[opening_balance]) as
 * movement-shaped rows.
 *
 * This table is where a user actually keys a product's starting position, one
 * row per (item, warehouse) — and until now NOTHING read it back. It was
 * written by the page and by the .xlsx import, and then never consulted by the
 * ledger, by Product Master's Stock column, or by the Inventory tab, so every
 * one of them reported a product as holding nothing until a Stock Receipt was
 * keyed for stock that was already on the shelf.
 *
 * It is returned separately from getStockMovements() rather than as another
 * entry in SOURCES for two reasons:
 *
 *  1. It is a POSITION, not a movement. Folding it into the movement list
 *     would make it count as inward quantity in getInwardOutwardByProductCode,
 *     and the Stock Summary report would then show a product's opening stock a
 *     second time in its Inward column.
 *  2. It has no document, no status vocabulary and no effective date. The
 *     `asOn` filter every real source honours does not apply: an opening
 *     balance is true as at the start of the ledger, so it counts for every
 *     as-on date. Only `status` distinguishes a live row from a retired one.
 *
 * Its `warehouse` column holds a warehouse CODE (it is a foreign key onto
 * WarehouseMaster.whsCode — see the model in schema.prisma), which is the same
 * form the documents store, so these rows aggregate against the warehouse rows
 * in productInventory.js without any translation.
 */
async function getOpeningBalanceMovements({ warehouse = null, productCodes = null, client = null } = {}) {
  const db = client || defaultClient();
  // Absent on a Prisma Client generated before the model existed — treat that
  // as "no opening balances recorded" rather than failing every stock read.
  if (!db.openingBalance) return [];

  const baseWhere = { status: 'Active' };
  if (warehouse) baseWhere.warehouse = warehouse;

  // See PRODUCT_CODE_CHUNK_SIZE above — an unchunked `itemCode: { in:
  // productCodes } }` over a full, unfiltered product list burns one SQL
  // param per code and blows past SQL Server's ~2,100-parameter cap on its
  // own once the product master runs into five figures.
  const codeChunks = productCodes && productCodes.length
    ? chunkArray(productCodes, PRODUCT_CODE_CHUNK_SIZE)
    : [null];
  // See DB_QUERY_CONCURRENCY above — chunks run a few at a time, not all at
  // once, so a large product master doesn't open dozens of simultaneous DB
  // connections.
  const rowChunks = await runWithConcurrency(codeChunks.map((chunk) => () => db.openingBalance.findMany({
    where: chunk ? { ...baseWhere, itemCode: { in: chunk } } : baseWhere,
    select: { itemCode: true, warehouse: true, stock: true },
  })));
  const rows = rowChunks.flat();

  const movements = [];
  for (const row of rows) {
    if (!row.itemCode) continue;
    const quantity = Number(row.stock) || 0;
    if (quantity === 0) continue;
    movements.push({
      productCode: row.itemCode,
      quantity,
      source: 'Opening Balance',
      warehouse: row.warehouse || null,
    });
  }
  return movements;
}

/** Net opening balance per product code, as a Map. */
async function getOpeningBalanceByProductCode(options = {}) {
  const movements = await getOpeningBalanceMovements(options);
  const net = new Map();
  for (const m of movements) {
    net.set(m.productCode, round2((net.get(m.productCode) || 0) + m.quantity));
  }
  return net;
}

/**
 * How a source decides which warehouse a line moved against.
 *
 *  'header'         (default) the header names the one warehouse for every line
 *  'item'           the line's own column is the only answer; there is no
 *                   header equivalent to fall back to (Stock Transfer's
 *                   From/To pair)
 *  'item-or-header' the line's own column when it has one, else the header's.
 *                   Every Purchase/Sales document is this: each item table
 *                   carries a per-line Warehouse (see the *Item models in
 *                   schema.prisma), but rows saved before that column existed
 *                   hold NULL and are still described by the header.
 *
 * The last one is what makes a multi-warehouse document — the normal result of
 * a Copy From whose source lines named different warehouses — attribute each
 * line to the warehouse it actually moved against. Until it existed, GRN,
 * Delivery Challan, both Returns and both Credit Memos booked every line to
 * the header's warehouse, and the two invoices had `warehouseField: null`,
 * which made buildWhere return null and dropped a direct (non-GRN, non-challan)
 * invoice out of every warehouse-scoped figure entirely. Company-wide totals
 * were right throughout; only the per-warehouse split was wrong, which is why
 * this went unnoticed.
 *
 * utils/stockTable.js already attributed per line (postStockEntries reads a
 * line's own `warehouse` and falls back to the document's) — so this also
 * brings the derived ledger back into agreement with the written journal.
 */
function warehouseScopeOf(source) {
  return source.warehouseScope || 'header';
}

/** Build the Prisma `where` for one source, or null if it cannot contribute. */
function buildWhere(source, { asOn, warehouse, productCodes }) {
  const scope = warehouseScopeOf(source);

  const header = {
    status: { notIn: nonMovingStatusesForSource(source) },
    ...(source.headerFilter || {}),
  };
  if (asOn) header[source.dateField] = { lte: asOn };
  if (warehouse && scope === 'header') {
    // A source with no warehouse column cannot satisfy a warehouse filter, and
    // must contribute nothing rather than everything.
    if (!source.warehouseField) return null;
    header[source.warehouseField] = warehouse;
  }

  const where = { [source.headerRelation]: header };
  if (productCodes && productCodes.length) where.productCode = { in: productCodes };
  if (warehouse && scope === 'item') where[source.warehouseField] = warehouse;
  if (warehouse && scope === 'item-or-header') {
    // "this line's warehouse is the one asked for, OR the line names none and
    // its header's is". Prisma ANDs this OR with the relation filter already on
    // `where`, so the status/date conditions above still apply to both arms.
    where.OR = [
      { [source.warehouseField]: warehouse },
      {
        AND: [
          { OR: [{ [source.warehouseField]: null }, { [source.warehouseField]: '' }] },
          { [source.headerRelation]: { [source.headerWarehouseField]: warehouse } },
        ],
      },
    ];
  }
  return where;
}

/**
 * Read every stock movement, optionally scoped by date, warehouse and product.
 *
 * Returns a flat list of `{ productCode, quantity, source, warehouse }` where
 * `quantity` is signed: positive is inward, negative outward.
 */
async function getStockMovements({ asOn = null, warehouse = null, productCodes = null, client = null } = {}) {
  const db = client || defaultClient();
  // See PRODUCT_CODE_CHUNK_SIZE above. Chunked per source (rather than once
  // globally) since buildWhere's `productCode: { in: chunk } }` is the only
  // thing that varies per chunk — everything else about a source's query
  // (its status/date/warehouse conditions, its select shape) stays fixed.
  const codeChunks = productCodes && productCodes.length
    ? chunkArray(productCodes, PRODUCT_CODE_CHUNK_SIZE)
    : [productCodes];
  // Thunks, not already-fired promises -- runWithConcurrency below decides
  // when each one actually runs. A plain .map() calling .findMany() here
  // would fire all `sources * chunks` queries (7 * ~11 for the full product
  // master) at once regardless of what wraps the resulting promises.
  const queryTasks = SOURCES.flatMap((source) => codeChunks.map((chunk) => () => {
    const where = buildWhere(source, { asOn, warehouse, productCodes: chunk });
    if (!where) return Promise.resolve({ source, rows: [] });
    const delegate = source.itemDelegate(db);
    if (!delegate) return Promise.resolve({ source, rows:[] })

    const scope = warehouseScopeOf(source);
    const needHeaderwarehouse = !warehouse && (scope === 'item-or-header' || scope === 'header')
    // What has to come back to name this line's warehouse: its own column for
    // 'item' and 'item-or-header', plus the header's for the fallback arm.
    const headerWarehouseField = needHeaderwarehouse
    ? (scope === 'item-or-header' ? source.headerWarehouseField : source.warehouseField)
    : null;
    const headerSelect = headerWarehouseField
      ? { [source.headerRelation]: { select: { [headerWarehouseField]: true } } } : {};
    const itemSelect = scope !== 'header' && source.warehouseField
      ? { [source.warehouseField]: true } : {};
    return delegate
      .findMany({
        where,
        select: {
          productCode: true,
          [source.quantityField]: true,
          ...itemSelect,
          ...headerSelect,
          },
      })
      .then((rows) => ({ source, rows }));
  }));

  // See DB_QUERY_CONCURRENCY above — a bounded number of these run at a
  // time rather than all `sources * chunks` simultaneously.
  const results = await runWithConcurrency(queryTasks);

  const movements = [];
  for (const { source, rows } of results) {
    const scope = warehouseScopeOf(source);
    for (const row of rows) {
      if (!row.productCode) continue;
      const raw = Number(row[source.quantityField]) || 0;
      if (raw === 0) continue;

      // Resolved the same way buildWhere filters, so a movement is reported
      // against exactly the warehouse a warehouse-scoped query matched it on.
      let movementWarehouse = warehouse || null;
      if(!movementWarehouse) {
      if (scope === 'item') {
        movementWarehouse = row[source.warehouseField] || null;
      } else if (scope === 'item-or-header') {
        movementWarehouse = row[source.warehouseField]
          || row[source.headerRelation]?.[source.headerWarehouseField]
          || null;
      } else if (source.warehouseField) {
        movementWarehouse = row[source.headerRelation]?.[source.warehouseField] || null;
      }
    }

      movements.push({
        productCode: row.productCode,
        quantity: source.direction === 0 ? raw : raw * source.direction,
        source: source.label,
        warehouse: movementWarehouse,
      });
    }
  }
  return movements;
}

/**
 * Net movement per product code, as a Map.
 *
 * Excludes openingStock so callers can add it to whatever they already loaded.
 */
async function getStockMovementByProductCode(options = {}) {
  const movements = await getStockMovements(options);
  const net = new Map();
  for (const m of movements) {
    net.set(m.productCode, round2((net.get(m.productCode) || 0) + m.quantity));
  }
  return net;
}

/**
 * Inward and outward totals per product code, kept separate.
 *
 * The stock summary report needs both sides, and a stock adjustment has to
 * land on whichever side its sign implies — a shortfall is outward movement,
 * not negative inward movement.
 */
async function getInwardOutwardByProductCode(options = {}) {
  return deriveInwardOutwardByProductCode(await getStockMovements(options));
}

/**
 * The derive half of getInwardOutwardByProductCode, over an already-fetched
 * movements array.
 *
 * Exported so a caller that already holds the movements — the Stock Summary
 * report needs the raw array as well as the split, and getStockMovements is a
 * scan across every line-item table — can get the split without paying for a
 * second identical scan. getInwardOutwardByProductCode above is this function
 * plus the fetch, so the two can never drift apart.
 */
function deriveInwardOutwardByProductCode(movements) {
  const inward = new Map();
  const outward = new Map();
  for (const m of movements) {
    if (m.quantity >= 0) inward.set(m.productCode, round2((inward.get(m.productCode) || 0) + m.quantity));
    else outward.set(m.productCode, round2((outward.get(m.productCode) || 0) + Math.abs(m.quantity)));
  }
  return { inward, outward };
}

/**
 * Given products (each needing productCode + openingStock), attach live stock.
 *
 * Current stock has three parts, all of which have to be present or the figure
 * understates what is on the shelf:
 *
 *   Product.openingStock   the legacy product-wide starting figure typed on the
 *                          product record itself
 * + OpeningBalance.stock   the per-warehouse starting position keyed under
 *                          Inventory > Opening Balance (see
 *                          getOpeningBalanceMovements above — this was the part
 *                          being dropped)
 * + net movement           every posted document that moves stock
 *
 * The two opening figures are ADDED rather than one overriding the other:
 * they are separate entry points that this schema keeps in separate columns,
 * and neither is derived from the other, so a product carrying both genuinely
 * holds both.
 */
async function attachCurrentStock(products, options = {}) {
  const [movement, opening] = await Promise.all([
    getStockMovementByProductCode(options),
    getOpeningBalanceByProductCode(options),
  ]);
  return products.map((p) => ({
    ...p,
    currentStock: round2(
      (Number(p.openingStock) || 0)
      + (opening.get(p.productCode) || 0)
      + (movement.get(p.productCode) || 0),
    ),
  }));
}

/** Live stock for a single product code. */
async function getCurrentStockFor(productCode, { client = null } = {}) {
  const db = client || defaultClient();
  const [product, movement, opening] = await Promise.all([
    db.product.findFirst({ where: { productCode }, select: { openingStock: true } }),
    getStockMovementByProductCode({ productCodes: [productCode], client: db }),
    getOpeningBalanceByProductCode({ productCodes: [productCode], client: db }),
  ]);
  if (!product) return 0;
  return round2(
    (Number(product.openingStock) || 0)
    + (opening.get(productCode) || 0)
    + (movement.get(productCode) || 0),
  );
}

/**
 * Live stock for many product codes at once, as a Map.
 *
 * Used by the negative-stock guard, which has to check a whole document's
 * lines without issuing one query per line.
 */
async function getCurrentStockForMany(productCodes, { client = null } = {}) {
  const codes = [...new Set((productCodes || []).filter(Boolean))];
  if (!codes.length) return new Map();

  const db = client || defaultClient();
  const [products, movement, opening] = await Promise.all([
    db.product.findMany({
      where: { productCode: { in: codes } },
      select: { productCode: true, openingStock: true },
    }),
    getStockMovementByProductCode({ productCodes: codes, client: db }),
    getOpeningBalanceByProductCode({ productCodes: codes, client: db }),
  ]);

  const stock = new Map();
  for (const p of products) {
    stock.set(p.productCode, round2(
      (Number(p.openingStock) || 0)
      + (opening.get(p.productCode) || 0)
      + (movement.get(p.productCode) || 0),
    ));
  }
  return stock;
}

/**
 * Live stock for many (productCode, warehouse) pairs at once, scoped to each
 * pair's own warehouse — as opposed to getCurrentStockForMany, which is
 * company-wide.
 *
 * Stock Transfer needs this: a product can show plenty of stock company-wide
 * (getCurrentStockForMany) while the specific From Warehouse a line names
 * holds none of it, because the rest sits in a different warehouse. Checking
 * only the company-wide figure lets a transfer drain a warehouse to a
 * negative position that no report can show as anything but wrong.
 *
 * Product.openingStock is deliberately excluded — it is a single product-wide
 * figure with no warehouse of its own (see the same design decision, and the
 * reasoning for it, in utils/productInventory.js's `unassignedOnHand`), so
 * folding it into one warehouse's figure here would overstate that warehouse
 * and understate every other one.
 *
 * OpeningBalance.stock IS included, for exactly the opposite reason: it is
 * recorded per (item, warehouse), so it belongs to a specific warehouse and
 * omitting it made this function report an empty warehouse for stock that was
 * keyed as sitting in it — which then failed the negative-stock guards on
 * Stock Issue, Stock Transfer and Delivery Challan for goods genuinely on hand.
 *
 * Returns a Map keyed by `${productCode}::${warehouse}`.
 */
async function getCurrentStockByWarehouseForMany(pairs, { client = null } = {}) {
  const db = client || defaultClient();
  const uniquePairs = [...new Map(
    (pairs || [])
      .filter((p) => p && p.productCode && p.warehouse)
      .map((p) => [`${p.productCode}::${p.warehouse}`, p])
  ).values()];
  if (!uniquePairs.length) return new Map();

  const warehouses = [...new Set(uniquePairs.map((p) => p.warehouse))];
  const productCodes = [...new Set(uniquePairs.map((p) => p.productCode))];

  const stock = new Map();
  // One query per distinct warehouse rather than per line — the same
  // "batch, don't loop per row" shape as getCurrentStockForMany.
  for (const warehouse of warehouses) {
    const [movement, opening] = await Promise.all([
      getStockMovementByProductCode({ warehouse, productCodes, client: db }),
      getOpeningBalanceByProductCode({ warehouse, productCodes, client: db }),
    ]);
    for (const { productCode } of uniquePairs) {
      if (!movement.has(productCode) && !opening.has(productCode)) continue;
      stock.set(
        `${productCode}::${warehouse}`,
        round2((opening.get(productCode) || 0) + (movement.get(productCode) || 0)),
      );
    }
  }
  // Pairs the ledger has no movement for at all still resolve to zero rather
  // than being absent from the Map, so a caller checking `onHand.get(key) ?? 0`
  // and one checking `.has(key)` agree.
  for (const { productCode, warehouse } of uniquePairs) {
    const key = `${productCode}::${warehouse}`;
    if (!stock.has(key)) stock.set(key, 0);
  }
  return stock;
}

module.exports = {
  getStockMovements,
  getStockMovementByProductCode,
  getOpeningBalanceMovements,
  getOpeningBalanceByProductCode,
  getInwardOutwardByProductCode,
  deriveInwardOutwardByProductCode,
  attachCurrentStock,
  getCurrentStockFor,
  getCurrentStockForMany,
  getCurrentStockByWarehouseForMany,
  NON_MOVING_STATUSES,
  NON_MOVING_STATUSES_BY_SOURCE_KEY,
  nonMovingStatusesForSource,
  SOURCES,
  chunkArray,
  runWithConcurrency,
  PRODUCT_CODE_CHUNK_SIZE,
  DB_QUERY_CONCURRENCY,
};
