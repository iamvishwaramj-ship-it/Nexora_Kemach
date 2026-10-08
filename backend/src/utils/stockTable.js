// Posting logic for [dbo].[Stock] — the append-only inventory transaction
// journal (see the Stock model in schema.prisma).
//
// This sits alongside, not instead of, utils/stockLedger.js. That module
// derives on-hand quantity by reading the source documents live and covers
// all seven document types that move stock; this one writes a durable row
// per line at the moment a stock document is posted, so there is a permanent
// record of the movement independent of whatever the documents later say.
//
// Deliberate design constraints, chosen when this was specced:
//
//  * Insert-only. Rows are never updated or deleted. Editing a posted
//    document or deleting it outright leaves its existing Stock rows in
//    place — the journal records what was posted at the time, not the
//    document's current state.
//  * Posted-only. A document contributes rows when its status is 'Posted'.
//    Drafts and cancelled documents post nothing.
//
// Those two together mean a document posts its rows exactly once, the first
// time it is saved in Posted status — hasPostedAlready() below is what
// enforces the "once", since without it re-saving an already-posted document
// (a remark typo, a status round-trip) would duplicate every line.

const { isCosted, loadState, costMovement } = require('./stockValuation');

// Stored as text in Stock.BaseType, so a row identifies its source document
// without a lookup table. (Column renamed from TransType/TransNum/TransValue's
// siblings to BaseType/BaseEntry/BaseNum/BaseLine -- SAP-style source-document
// linking -- see the Stock model's own comments in schema.prisma for the full
// column-by-column rationale.)
const TRANS_TYPES = {
  STOCK_RECEIPT: 'Stock Receipt',
  STOCK_ISSUE: 'Stock Issue',
  STOCK_ADJUSTMENT: 'Stock Adjustment',
  PURCHASE_GRN: 'Purchase GRN',
  DELIVERY_CHALLAN: 'Delivery Challan',
  // A Stock Transfer posts two rows per line under ONE document id — an
  // outbound leg at the from-warehouse and an inbound leg at the
  // to-warehouse — so it needs two distinct TransType values sharing one
  // TransNum. hasPostedAlready() keys off (transType, transNum), so calling
  // postStockEntries() twice with two different types here is what lets both
  // legs actually get written instead of the second call being silently
  // skipped as "already posted".
  STOCK_TRANSFER_OUT: 'Stock Transfer Out',
  STOCK_TRANSFER_IN: 'Stock Transfer In',
  // Goods going back OUT to a supplier — same direction as Delivery Challan.
  PURCHASE_RETURN: 'Purchase Return',
  PURCHASE_CREDIT_MEMO: 'Purchase Credit Memo',
  // Goods coming back IN from a customer — same direction as a GRN.
  SALES_RETURN: 'Sales Return',
  SALES_CREDIT_MEMO: 'Sales Credit Memo',
  // A DIRECT invoice — billed straight off the order with no GRN or delivery
  // challan behind it — is itself the document that moves the goods, so it
  // journals them. An invoice raised against a GRN or a challan posts NOTHING
  // here: that document already did, and posting again would count one
  // movement twice. The caller decides which case applies; see
  // postDirectInvoiceStock in routes/resources.js, which tests exactly the
  // condition utils/stockLedger.js filters on, so the journal and the derived
  // on-hand quantity cannot disagree about the same invoice.
  PURCHASE_INVOICE: 'Purchase Invoice',
  SALES_INVOICE: 'Sales Invoice',
  // A per-(item, warehouse) starting position from Company Setup > Inventory
  // Opening Balance -- not a real source document (no numbering series, no
  // G/L), but journalled here the same way so on-hand quantity/valuation
  // read consistently through one table instead of a special case. See the
  // opening-balance-specific entry in NON_MOVING_STATUSES_BY_TRANS_TYPE just
  // below -- its vocabulary ('Active'/'Inactive') isn't the
  // Draft/Cancelled/Pending one every other document type uses.
  OPENING_BALANCE: 'Opening Balance',
};

// Which statuses mean "this movement has not actually happened". Stated as an
// exclusion rather than a list of good statuses because the vocabulary differs
// per document: a stock document is 'Posted', a GRN is 'Received' or
// 'Partially Received', a challan is 'Dispatched'/'Partially
// Delivered'/'Delivered'. Listing the positive values would silently miss any
// new one added to the frontend's option lists later.
//
// This is deliberately the same rule the derived ledger uses (see
// NON_MOVING_STATUSES_BY_SOURCE_KEY in stockLedger.js) and the same rule the
// G/L posting layer uses (GL_NON_MOVING_STATUSES_BY_SOURCE_TYPE in
// glPosting.js) so all three never disagree about whether a given document
// moved stock/value.
//
// This USED to be one flat list shared by every document type, with 'Open'
// permanently excluded. That was correct for GRN/Challan/Return/Credit-Memo
// (see the six-document-type story below) but Stock Transfer, whose own
// vocabulary (STOCK_TRANSFER_STATUS_OPTIONS = ['Open', 'Closed']) used to
// treat 'Open' as "not yet posted", was a special case carved out here: a
// transfer moved stock only once its receipt confirmed the goods arrived and
// flipped it to 'Closed'.
//
// That design changed: a Stock Transfer now posts stock (and G/L) as soon as
// it is raised — or, for one raised against a Stock Transfer Request, as
// soon as that request is approved — not when a later Stock Transfer Receipt
// closes it. See routes/resources.js's stockTransferPostable/
// syncStockTransferMovement, and syncStockTransferClosure's own updated doc
// comment for what Closure is left responsible for now. 'Open' is therefore
// no longer excluded here for either leg: whether a given Open transfer is
// ACTUALLY ready to post (approved, and every line's From/To Warehouse
// resolved) is Stock-Transfer-specific business policy this generic module
// has no business knowing about — that gate lives entirely in
// routes/resources.js, which simply never calls postStockEntries/
// reverseStockEntries for a transfer that is not yet ready. movesStock/
// postStockEntries here only ever see status 'Open' or 'Closed' for these
// two TransTypes, and now treat both as moving, exactly like every other
// non-Draft/Cancelled/Pending document.
//
// For every OTHER type that posts here — Purchase GRN, Delivery Challan,
// Purchase Return, Purchase Credit Memo, Sales Return, Sales Credit Memo —
// 'Open' is the ordinary, active, saved status (what a plain Save produces;
// see GRN_STATUS_OPTIONS, CHALLAN_STATUS_OPTIONS,
// PURCHASE_RETURN_STATUS_OPTIONS, PURCHASE_CREDIT_MEMO_STATUS_OPTIONS,
// SALES_RETURN_STATUS_OPTIONS, SALES_CREDIT_MEMO_STATUS_OPTIONS in the
// frontend validation schemas — none of them reach 'Closed' without passing
// through 'Open' first). Excluding 'Open' for all of them meant those six
// document types silently posted nothing to this journal under any save
// path — the bug this per-type map originally existed to fix.
const BASE_NON_MOVING_STATUSES = ['Draft', 'Cancelled', 'Pending'];

// Stock Transfer's two legs now fall back to BASE_NON_MOVING_STATUSES like
// almost every other TRANS_TYPE (see the comment above) — no per-type
// override needed for them any more. Opening Balance keeps its own,
// differently-worded entry.
const NON_MOVING_STATUSES_BY_TRANS_TYPE = {
  // Opening Balance rows only ever carry 'Active'/'Inactive' -- none of
  // BASE_NON_MOVING_STATUSES' vocabulary ('Draft'/'Cancelled'/'Pending')
  // ever appears on this row, so falling back to it would treat 'Inactive'
  // as moving stock (it's not excluded from that list) and silently post
  // rows for a position the user marked inactive.
  [TRANS_TYPES.OPENING_BALANCE]: ['Inactive'],
};

// Kept for backward compatibility with any external reader that imported the
// flat list directly; nothing in this file uses it for a moving/non-moving
// decision any more — see nonMovingStatusesFor(). No TRANS_TYPE treats 'Open'
// as non-moving any more (see the comment above), so this no longer carries it.
const NON_MOVING_STATUSES = [...BASE_NON_MOVING_STATUSES];

function nonMovingStatusesFor(transType) {
  return NON_MOVING_STATUSES_BY_TRANS_TYPE[transType] || BASE_NON_MOVING_STATUSES;
}

// Settings > Module Settings > Inventory -- see utils/systemSettings.js's
// own header comment. Read inside postStockEntries below (the single
// writer of every [dbo].[Stock] row, for every document type that moves
// stock) rather than per document type.
const { isInventoryModuleEnabled } = require('./systemSettings');

function movesStock(status, transType) {
  return !nonMovingStatusesFor(transType).includes(status);
}

/**
 * [dbo].[Stock].[Warehouse] used to be NVARCHAR(8), while the warehouse
 * values these documents carry are full codes/names ('NEXORAWAREHOUSE1', a
 * branch name) — so this used to clip to 8 characters to fit rather than
 * failing the insert. Two warehouses sharing the same first 8 characters
 * (e.g. 'NEXORAWAREHOUSE1'/'NEXORAWAREHOUSE2', both clipping to 'NEXORAWA')
 * then collided onto the same journal key, which showed up as one
 * warehouse's Avg Price/FIFO Price appearing on another warehouse's row in
 * Product Master's Inventory tab. The column is now NVARCHAR(150) — see
 * migration 20260905080000_widen_stock_warehouse — so this just trims,
 * matching journalKey() in utils/productInventory.js, which reads this same
 * column back and must agree with whatever this function decided to store.
 */
function fitWarehouse(value) {
  if (value == null) return null;
  const str = String(value).trim();
  if (str === '') return null;
  return str.length > 150 ? str.slice(0, 150) : str;
}

/**
 * The Stock delegate only exists on a Prisma Client generated after the Stock
 * model was added to schema.prisma. Without this check the first call fails
 * with a bare "Cannot read properties of undefined (reading 'findFirst')",
 * which says nothing about the actual cause.
 */
function stockDelegate(tx) {
  if (!tx.stock) {
    const err = new Error(
      'Prisma Client is out of date — it has no Stock model. '
      + 'Run `npm run prisma:generate` in backend/ and restart the server.'
    );
    err.status = 500;
    throw err;
  }
  return tx.stock;
}

/**
 * Has this document already written its rows for this generation? Keeps
 * posting idempotent -- but only within one generation, so an edit that
 * bumps the generation (see the module doc comment on generations, above
 * postStockEntries) is free to post again rather than being skipped as
 * "already posted".
 */
async function hasPostedAlready(tx, transType, transNum, generation = 1) {
  const existing = await stockDelegate(tx).findFirst({
    where: { baseType: transType, baseEntry: transNum, postGeneration: generation },
    select: { logEntry: true },
  });
  return Boolean(existing);
}

/**
 * Resolves product codes to Product.id, because Stock.ItemId is NOT NULL.
 * A line naming a product that isn't in the master can't be journalled, and
 * silently dropping it would leave the journal quietly disagreeing with the
 * document, so this refuses the whole posting instead.
 */
async function resolveItemIds(tx, productCodes) {
  const codes = [...new Set(productCodes.filter(Boolean))];
  if (!codes.length) return new Map();
  const products = await tx.product.findMany({
    where: { productCode: { in: codes } },
    // calculationMethod rides along because costing needs it per line, and
    // inventoryItem because postStockEntries below uses it to skip posting
    // for a non-inventory product (a labour/service line, say) -- this is
    // already the one lookup that touches every product on the document.
    select: { id: true, productCode: true, calculationMethod: true, inventoryItem: true },
  });
  const byCode = new Map(products.map((p) => [p.productCode, p]));
  const missing = codes.filter((c) => !byCode.has(c));
  if (missing.length) {
    const err = new Error(
      `Cannot post to the stock journal — no product master record for: ${missing.join(', ')}.`
    );
    err.status = 400;
    throw err;
  }
  return byCode;
}

/**
 * Writes one Stock row per movement line.
 *
 * @param tx             Prisma transaction client (posting must share the
 *                       document's transaction, so a failed save posts nothing)
 * @param transType      one of TRANS_TYPES
 * @param transNum       the source document's primary key
 * @param status         the document's status — a non-moving one is a no-op
 * @param warehouse      document-level warehouse, used for any line that does
 *                       not carry its own (see `line.warehouse` below)
 * @param lines          [{ productCode, productName, quantity, unitPrice, direction, warehouse }]
 *                       direction: 'in' adds to InQty, 'out' adds to OutQty.
 *                       `warehouse`, when present on a line, overrides the
 *                       document-level `warehouse` for that line only — this
 *                       is what lets Stock Transfer post each item against its
 *                       own From/To Warehouse instead of one pair for the
 *                       whole document. Every other caller leaves it unset and
 *                       gets the prior all-lines-share-one-warehouse behavior.
 * @param userId         req.user.id, recorded as CreatedBy
 * @param currency       ISO code stored against the line's price
 * @param generation     which edit-cycle of the source document this is
 *                       (default 1, the first post). syncStockPosting in
 *                       routes/resources.js is the only caller that passes
 *                       anything else: when a document that already posted
 *                       generation N is saved again, it reverses generation
 *                       N (see reverseStockEntries) and posts generation
 *                       N+1 here, so hasPostedAlready's per-generation check
 *                       does not mistake the fresh post for a duplicate of
 *                       the one it just reversed.
 * @param documentNumber the source document's human-readable number (its
 *                       grnNo/invoiceNo/challanNo/... ) stored into
 *                       Stock.BaseNum alongside BaseEntry's internal id, so
 *                       a journal row can be traced back to a document by
 *                       the number a user actually sees on screen, not only
 *                       by its database id. Optional (defaults to null) so
 *                       a caller that has not been updated to pass it yet
 *                       degrades to a blank BaseNum rather than failing.
 */
async function postStockEntries(tx, {
  transType, transNum, documentNumber = null, status, warehouse, branch = null, lines = [], userId = null, currency = 'INR', generation = 1,
}) {
  // Inventory switched off org-wide: no document, of any type, ever writes
  // a stock-ledger row -- checked first (ahead of movesStock/transNum) since
  // there is nothing else worth computing once this is true.
  if (!(await isInventoryModuleEnabled(tx))) return { posted: 0, skipped: 'inventory-disabled' };
  if (!movesStock(status, transType)) return { posted: 0, skipped: 'not-posted' };
  if (!transNum) return { posted: 0, skipped: 'no-document-id' };
  if (await hasPostedAlready(tx, transType, transNum, generation)) {
    return { posted: 0, skipped: 'already-posted' };
  }

  // A line whose product is flagged non-inventory (Product Master's
  // Inventory Item unchecked, while Sales/Purchase Item stays checked — see
  // attachInventoryItemFlag in routes/resources.js) is accepted on its
  // document but must never write a Stock journal row: no qty in, no qty
  // out. Filtering it out here, in the single choke point every *Lines()
  // builder in this file feeds into, covers all of them at once rather than
  // repeating the check in each one. A line with no flag attached (older
  // callers that have not been updated) keeps the pre-existing behavior —
  // `!== false` treats anything but an explicit `false` as tracked.
  const movements = lines.filter((l) => l && l.productCode && Number(l.quantity) && l.inventoryItem !== false);
  if (!movements.length) return { posted: 0, skipped: 'no-movement-lines' };

  const productByCode = await resolveItemIds(tx, movements.map((l) => l.productCode));

  // A non-inventory product (Product Master's own Inventory Item flag) never
  // moves stock, on any document, in any status -- a service/labour line
  // priced and billed like any other item but with nothing in a warehouse to
  // decrement or receive. Filtered here rather than earlier (the raw
  // `movements` filter above only knows productCode/quantity) since this is
  // the first point the product record itself is in hand.
  const inventoryMovements = movements.filter((l) => productByCode.get(l.productCode)?.inventoryItem !== false);
  if (!inventoryMovements.length) return { posted: 0, skipped: 'no-movement-lines' };

  // CreateDate and CreateTime split the same instant across the table's
  // separate DATE and TIME columns, so both describe the moment of posting.
  const now = new Date();
  const documentWarehouse = fitWarehouse(warehouse);

  // Costing state, keyed by item+warehouse rather than item alone — a product
  // can sit at a different cost in different warehouses (see loadState in
  // stockValuation.js), which only matters once lines are allowed to name
  // their own warehouse. Loaded once per pair and then carried across the
  // document's own lines that share it.
  const stateByKey = new Map();
  const stateFor = async (itemCode, warehouseValue) => {
    const key = `${itemCode}::${warehouseValue || ''}`;
    if (!stateByKey.has(key)) {
      stateByKey.set(key, await loadState(tx, { itemCode, warehouse: warehouseValue }));
    }
    return stateByKey.get(key);
  };

  const data = [];
  for (let i = 0; i < inventoryMovements.length; i += 1) {
    const line = inventoryMovements[i];
    const quantity = Math.abs(Number(line.quantity) || 0);
    // Valuation basis for the [dbo].[Stock] journal: cost, never the billed
    // price. Delivery Challan and Sales Invoice lines carry a `costPrice`
    // (stamped by resources.js's stampCostPrices, from the Product master's
    // cost at the moment of posting) alongside their billed `unitPrice` — use
    // that when it's there. Every other document (Stock Receipt, GRN,
    // Purchase Invoice, Stock Issue/Adjustment/Transfer, Purchase/Sales
    // Return, Sales Credit Memo, ...) has no separate cost column at all, so
    // `costPrice` is simply undefined on those lines and this falls straight
    // through to `unitPrice`, which already IS the cost/purchase price there
    // — unchanged from before.
    //
    // Without this, a Delivery Challan/Sales Invoice line posted its outward
    // movement at the customer-facing selling price instead of cost, so
    // Outward Value on the dashboard's Total Inventory Value card
    // (Opening Stock Value + Inward Value − Outward Value) ran well above
    // the Inward Value that Purchase-side documents post at actual cost,
    // driving the figure negative over time even though physical stock was
    // fine.
    const price = line.costPrice != null
      ? Number(line.costPrice) || 0
      : (line.unitPrice == null ? null : Number(line.unitPrice) || 0);
    const isOut = line.direction === 'out';
    const product = productByCode.get(line.productCode);
    const method = product.calculationMethod;
    const lineWarehouse = fitWarehouse(line.warehouse != null && line.warehouse !== '' ? line.warehouse : documentWarehouse);

    // Only products set to FIFO or Moving Average are costed at all; for the
    // rest this is skipped entirely and ItemCost stays NULL.
    let fifoCost = null;
    let mavCost = null;
    if (isCosted(method)) {
      const state = await stateFor(line.productCode, lineWarehouse);
      ({ fifoCost, mavCost } = costMovement(state, {
        direction: line.direction, quantity, unitPrice: price, method,
      }));
    }

    data.push({
      itemCode: line.productCode,
      itemId: product.id,
      itemName: line.productName || null,
      warehouse: lineWarehouse,
      branch: branch || null,
      inQty: isOut ? 0 : quantity,
      outQty: isOut ? quantity : 0,
      stockPrice: price,
      currency,
      baseEntry: transNum,
      baseNum: documentNumber,
      baseType: transType,
      // FIFO and Moving Average are mutually exclusive per product (only one
      // of the pair costMovement() returns is ever non-null -- see its own
      // doc comment in stockValuation.js), so one column holds whichever
      // applies.
      itemCost: fifoCost ?? mavCost,
      baseLine: i + 1,
      createdBy: userId ?? null,
      createDate: now,
      createTime: now,
      postGeneration: generation,
    });
  }

  await stockDelegate(tx).createMany({ data });
  return { posted: data.length, skipped: null };
}

/**
 * The BaseType a reversal is written under: the original's, suffixed.
 *
 * Deriving it rather than listing a second constant per document means every
 * type reverses without another table to keep in step, and it doubles as the
 * idempotency key — hasPostedAlready(reversalTypeFor(t), num) answers "has
 * this already been reversed?" using the same (baseType, baseEntry) index.
 * The longest result, 'Purchase Credit Memo Reversal' at 29 characters, fits
 * Stock.BaseType's NVARCHAR(50).
 */
function reversalTypeFor(transType) {
  return `${transType} Reversal`;
}

/** True for a TransType written by reverseStockEntries rather than a document. */
function isReversalType(transType) {
  return typeof transType === 'string' && transType.endsWith(' Reversal');
}

/**
 * Reverse a document's stock journal rows with contra entries.
 *
 * The journal is append-only by design (see the header of this file), so
 * cancelling a posted document must not delete or edit what it wrote. Instead
 * this writes a mirror of every original row with InQty and OutQty swapped, so
 * the pair nets to zero and the trail still shows both that the movement
 * happened and that it was undone.
 *
 * Without this, cancelling a posted GRN left its inward rows in place forever
 * while utils/stockLedger.js — which excludes cancelled documents by status —
 * correctly stopped counting it. The journal and the derived on-hand figure
 * then disagreed permanently, and only about cancelled documents, which is
 * exactly the case nobody reconciles.
 *
 * Costing: each contra row carries the SAME ItemCost the original was
 * valued at, rather than being re-costed against current state. That is what
 * makes the reversal cancel the original in value as well as quantity — a
 * cancellation should leave valuation exactly where it stood before the
 * document, not book a gain or loss at today's cost.
 *
 * Idempotent: reversing twice is a no-op, so a save that re-submits an
 * already-cancelled document writes nothing further. That check is now
 * per-generation (see postStockEntries's doc comment on `generation`): only
 * the specific generation named here is looked up and reversed, so
 * reversing generation 1 after it has already been reversed is a no-op,
 * but generation 2's own eventual reversal is unaffected by it.
 *
 * @param generation which generation's rows to reverse (default 1) --
 *                    syncStockPosting always passes the generation number
 *                    currently recorded as live on the document, i.e. the
 *                    one this call is about to supersede or retire.
 * @returns {{reversed: number, skipped: string|null}}
 */
async function reverseStockEntries(tx, { transType, transNum, userId = null, generation = 1 }) {
  if (!transNum) return { reversed: 0, skipped: 'no-document-id' };
  if (isReversalType(transType)) return { reversed: 0, skipped: 'already-a-reversal' };

  const reversalType = reversalTypeFor(transType);
  if (await hasPostedAlready(tx, reversalType, transNum, generation)) {
    return { reversed: 0, skipped: 'already-reversed' };
  }

  const originals = await stockDelegate(tx).findMany({
    where: { baseType: transType, baseEntry: transNum, postGeneration: generation },
    orderBy: { logEntry: 'asc' },
  });
  // Nothing was ever posted — a document cancelled while still a draft, which
  // is the normal case and not an error.
  if (!originals.length) return { reversed: 0, skipped: 'nothing-posted' };

  const now = new Date();
  const data = originals.map((row, i) => ({
    itemCode: row.itemCode,
    itemId: row.itemId,
    itemName: row.itemName,
    warehouse: row.warehouse,
    branch: row.branch,
    // The mirror: what went in comes out, and what went out goes back in.
    inQty: row.outQty,
    outQty: row.inQty,
    stockPrice: row.stockPrice,
    currency: row.currency,
    baseEntry: transNum,
    // Carried over from the original row rather than re-supplied by the
    // caller -- a reversal always describes the exact same source document,
    // so it always has the exact same display number.
    baseNum: row.baseNum,
    baseType: reversalType,
    itemCost: row.itemCost,
    baseLine: row.baseLine ?? i + 1,
    createdBy: userId ?? null,
    createDate: now,
    createTime: now,
    postGeneration: generation,
  }));

  await stockDelegate(tx).createMany({ data });
  return { reversed: data.length, skipped: null };
}

/**
 * The highest generation currently posted (under the ORIGINAL, non-reversal
 * BaseType) for one TransType+TransNum pair, or 0 if nothing has ever posted.
 *
 * Every other stock-posting document (GRN, Purchase Invoice, Delivery
 * Challan, ...) tracks its own "current generation" in a
 * `stockPostingGeneration` column and hands it to syncStockPosting (see
 * routes/resources.js) on every save. Stock Transfer has no such column —
 * adding one is a schema migration, out of scope for a stock-timing fix — so
 * routes/resources.js's own Stock Transfer reverse-then-repost cycle
 * (syncStockTransferMovement) derives the same number from the journal
 * itself instead.
 *
 * This is safe to call even when the generation it returns has already been
 * reversed: a reversal writes under reversalTypeFor(transType), a DIFFERENT
 * BaseType, so it is never counted here, and reverseStockEntries against an
 * already-reversed generation is itself a documented no-op (see its own doc
 * comment) — so a caller that blindly reverses whatever this returns and
 * then posts one generation higher never double-reverses or double-posts.
 */
async function highestPostedGeneration(tx, transType, transNum) {
  if (!transNum) return 0;
  const latest = await stockDelegate(tx).findFirst({
    where: { baseType: transType, baseEntry: transNum },
    orderBy: { postGeneration: 'desc' },
    select: { postGeneration: true },
  });
  return latest?.postGeneration || 0;
}

// Every *Lines() helper below spreads `...i` through unchanged apart from
// adding `direction` (and, where the moved quantity differs from the raw
// line quantity, overriding `quantity`). That is deliberate: postStockEntries
// above already reads a per-line `warehouse` property generically (falling
// back to the document-level one — see its own doc comment), so as long as
// each document's item-mapper (toXItemData in routes/resources.js) resolves
// and attaches `.warehouse` onto the item object it hands to these helpers —
// line-first-then-header, same convention as GoodsReceivedNoteItem.warehouse
// — posting automatically attributes the movement to that line's own
// warehouse. No changes were needed here to support per-line warehouses on
// Stock Receipt/Issue/Adjustment, Delivery Challan, or direct Sales/Purchase
// Invoice — only their item-mappers needed to start setting `.warehouse`.

/** Stock Receipt lines all move stock inward. */
function receiptLines(items) {
  return (items || []).map((i) => ({ ...i, direction: 'in' }));
}

/** Stock Issue lines all move stock outward. */
function issueLines(items) {
  return (items || []).map((i) => ({ ...i, direction: 'out' }));
}

/**
 * Stock Adjustment lines go either way per line — an Increase behaves like a
 * receipt, a Decrease like an issue. `quantity` is stored unsigned on the
 * document with the direction in itemAdjustmentType, which maps cleanly onto
 * the journal's InQty/OutQty split.
 */
function adjustmentLines(items) {
  return (items || []).map((i) => ({
    ...i,
    direction: i.itemAdjustmentType === 'Decrease' ? 'out' : 'in',
  }));
}

/**
 * Goods Received Note lines move stock inward. The moved quantity is
 * `receivedQuantity` — what actually arrived — not the ordered `poQuantity`,
 * which is what a partial receipt is measured against.
 */
function grnLines(items) {
  return (items || []).map((i) => ({
    ...i,
    quantity: i.receivedQuantity,
    direction: 'in',
  }));
}

/** Delivery Challan lines move stock outward — goods despatched to a customer. */
function challanLines(items) {
  return (items || []).map((i) => ({ ...i, direction: 'out' }));
}

/**
 * A Stock Transfer's outbound leg — each line leaves its OWN From Warehouse,
 * which the item table lets differ line to line, not necessarily the header's.
 * `warehouse` here is what postStockEntries' per-line override reads; the
 * header's fromWarehouse is passed alongside as the document-level fallback
 * for any line that somehow has none.
 */
function transferOutLines(items) {
  return (items || []).map((i) => ({ ...i, direction: 'out', warehouse: i.fromWarehouse || undefined }));
}

/** A Stock Transfer's inbound leg — each line arrives at its OWN To Warehouse. */
function transferInLines(items) {
  return (items || []).map((i) => ({ ...i, direction: 'in', warehouse: i.toWarehouse || undefined }));
}

/**
 * Purchase Return lines move stock outward — goods going back to the
 * supplier. The moved quantity is `returnQuantity`, not `receivedQuantity`
 * (what the original GRN brought in).
 */
function purchaseReturnLines(items) {
  return (items || []).map((i) => ({ ...i, quantity: i.returnQuantity, direction: 'out' }));
}

/** Purchase Credit Memo lines move stock outward — same direction as a Purchase Return. */
function purchaseCreditMemoLines(items) {
  return (items || []).map((i) => ({ ...i, direction: 'out' }));
}

/**
 * Sales Return lines move stock inward — goods coming back from a customer.
 * The moved quantity is `returnQuantity`, not `deliveredQuantity` (what the
 * original challan despatched).
 */
function salesReturnLines(items) {
  return (items || []).map((i) => ({ ...i, quantity: i.returnQuantity, direction: 'in' }));
}

/** Sales Credit Memo lines move stock inward — same direction as a Sales Return. */
function salesCreditMemoLines(items) {
  return (items || []).map((i) => ({ ...i, direction: 'in' }));
}

/**
 * Direct Purchase Invoice lines move stock inward — the goods are received by
 * the invoice itself because no GRN received them first. Same direction and
 * same `quantity` field as a GRN line; only the document differs.
 *
 * Called ONLY for an invoice with no grnNo. See postDirectInvoiceStock.
 */
function purchaseInvoiceLines(items) {
  return (items || []).map((i) => ({ ...i, direction: 'in' }));
}

/**
 * Direct Sales Invoice lines move stock outward — the goods are despatched by
 * the invoice itself because no delivery challan despatched them first.
 *
 * Called ONLY for an invoice with no deliveryChallanNo.
 */
function salesInvoiceLines(items) {
  return (items || []).map((i) => ({ ...i, direction: 'out' }));
}

module.exports = {
  TRANS_TYPES,
  BASE_NON_MOVING_STATUSES,
  NON_MOVING_STATUSES,
  NON_MOVING_STATUSES_BY_TRANS_TYPE,
  nonMovingStatusesFor,
  movesStock,
  postStockEntries,
  reverseStockEntries,
  highestPostedGeneration,
  reversalTypeFor,
  isReversalType,
  receiptLines,
  issueLines,
  adjustmentLines,
  grnLines,
  challanLines,
  transferOutLines,
  transferInLines,
  purchaseReturnLines,
  purchaseCreditMemoLines,
  salesReturnLines,
  salesCreditMemoLines,
  purchaseInvoiceLines,
  salesInvoiceLines,
};
