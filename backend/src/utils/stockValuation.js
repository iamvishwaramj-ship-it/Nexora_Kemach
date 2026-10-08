// Inventory costing for the [dbo].[Stock] journal's FIFO and MAV columns.
//
// A product's Product Master "Calculation Method" decides which column gets a
// value when one of its movements is journalled:
//
//   None / null      -> both columns NULL
//   FIFO             -> [FIFO] holds the unit cost, [MAV] NULL
//   Moving Average   -> [MAV]  holds the unit cost, [FIFO] NULL
//
// Both hold a *unit* cost (not an extended value), to match [Price]'s meaning
// and precision — DECIMAL(19,6).
//
// This is additive and self-contained: nothing else in the application reads
// these columns, and the derived stock ledger in stockLedger.js is untouched,
// so every existing on-hand, valuation and reporting figure is unaffected by
// anything here.
//
// ## How the cost is arrived at
//
// Costing is a running calculation — what an issue costs depends on every
// receipt before it. Since the journal is append-only and holds the full
// movement history, the state is rebuilt by replaying that history for the
// item rather than caching a balance that could drift out of step with it.
//
//   inward   FIFO -> the cost of the layer being added, i.e. this receipt's
//                    own unit price
//            MAV  -> the weighted average after the receipt is absorbed
//   outward  FIFO -> weighted cost of the oldest layers consumed
//            MAV  -> the weighted average at the moment of the issue
//
// Replaying is O(history) per movement. That's fine at this scale and is the
// honest implementation; if the journal grows large enough for it to matter,
// the fix is a periodic snapshot to replay forward from, not a cached balance.

const VALUATION_METHODS = {
  NONE: 'None',
  FIFO: 'FIFO',
  MOVING_AVERAGE: 'Moving Average',
};

/** Methods that actually write a costing column. */
function isCosted(method) {
  return method === VALUATION_METHODS.FIFO || method === VALUATION_METHODS.MOVING_AVERAGE;
}

/**
 * Running costing state for one item: the FIFO layer queue and the moving
 * average pair. Fed by replaying journal rows, then advanced by each new
 * movement as it is costed.
 */
function newState() {
  return {
    layers: [],  // [{ qty, price }] oldest first
    avgQty: 0,
    avgValue: 0,
  };
}

/** Absorbs a receipt: appends a FIFO layer and folds into the average. */
function applyInward(state, qty, price) {
  if (qty <= 0) return;
  state.layers.push({ qty, price });
  state.avgQty += qty;
  state.avgValue += qty * price;
}

/**
 * Consumes an issue, returning the FIFO unit cost of the quantity taken.
 *
 * If the layers don't cover the issue (possible for stock that pre-dates the
 * journal, or an opening balance never journalled), the shortfall is costed at
 * the last known layer price, falling back to the moving average and then to
 * the movement's own price — an uncosted issue would otherwise silently report
 * zero.
 */
function applyOutward(state, qty, fallbackPrice) {
  if (qty <= 0) return 0;

  let remaining = qty;
  let consumedValue = 0;
  let lastPrice = null;

  while (remaining > 0 && state.layers.length) {
    const layer = state.layers[0];
    const take = Math.min(layer.qty, remaining);
    consumedValue += take * layer.price;
    lastPrice = layer.price;
    layer.qty -= take;
    remaining -= take;
    if (layer.qty <= 0) state.layers.shift();
  }

  if (remaining > 0) {
    const avgPrice = state.avgQty > 0 ? state.avgValue / state.avgQty : null;
    const price = lastPrice ?? avgPrice ?? fallbackPrice ?? 0;
    consumedValue += remaining * price;
  }

  // The average is reduced at the prevailing average cost, which is what keeps
  // the remaining average per unit stable across an issue.
  const avgPrice = state.avgQty > 0 ? state.avgValue / state.avgQty : 0;
  state.avgValue -= qty * avgPrice;
  state.avgQty -= qty;
  if (state.avgQty <= 0) { state.avgQty = 0; state.avgValue = 0; }

  return consumedValue / qty;
}

/** Current moving-average unit cost, or null when nothing is on hand. */
function averagePrice(state) {
  return state.avgQty > 0 ? state.avgValue / state.avgQty : null;
}

/**
 * Rebuilds costing state for an item by replaying its journal history.
 *
 * Scoped by warehouse when one is given, so a product's cost is tracked per
 * location rather than pooled across the company — the same item can sit at
 * different costs in different warehouses.
 */
async function loadState(tx, { itemCode, warehouse }) {
  const rows = await tx.stock.findMany({
    where: { itemCode, ...(warehouse ? { warehouse } : {}) },
    select: { inQty: true, outQty: true, stockPrice: true },
    orderBy: { logEntry: 'asc' },
  });

  const state = newState();
  for (const r of rows) {
    const inQty = Number(r.inQty) || 0;
    const outQty = Number(r.outQty) || 0;
    const price = r.stockPrice == null ? 0 : Number(r.stockPrice);
    if (inQty > 0) applyInward(state, inQty, price);
    if (outQty > 0) applyOutward(state, outQty, price);
  }
  return state;
}

/**
 * Costs one movement and advances the state.
 *
 * @returns {{ fifoCost: number|null, mavCost: number|null }} — only the column
 *          matching `method` is populated; the other is null, and both are
 *          null when the product isn't set to a costed method.
 */
function costMovement(state, { direction, quantity, unitPrice, method }) {
  const qty = Math.abs(Number(quantity) || 0);
  const price = unitPrice == null ? 0 : Number(unitPrice) || 0;
  const isOut = direction === 'out';

  if (!isCosted(method) || qty <= 0) {
    // State still has to advance even for an uncosted product, so that a later
    // switch to FIFO/Moving Average replays against the full history.
    if (isOut) applyOutward(state, qty, price); else applyInward(state, qty, price);
    return { fifoCost: null, mavCost: null };
  }

  let fifoCost = null;
  let mavCost = null;

  if (isOut) {
    // Read the average before the issue is applied: an issue is valued at the
    // average prevailing when it happens.
    mavCost = averagePrice(state) ?? price;
    fifoCost = applyOutward(state, qty, price);
  } else {
    fifoCost = price;
    applyInward(state, qty, price);
    // Read after: a receipt shifts the average, and the figure of interest is
    // the new one it produces.
    mavCost = averagePrice(state) ?? price;
  }

  return {
    fifoCost: method === VALUATION_METHODS.FIFO ? round6(fifoCost) : null,
    mavCost: method === VALUATION_METHODS.MOVING_AVERAGE ? round6(mavCost) : null,
  };
}

/** Matches the columns' DECIMAL(19,6) scale. */
function round6(n) {
  if (n == null || Number.isNaN(n)) return null;
  return Math.round(n * 1e6) / 1e6;
}

module.exports = {
  VALUATION_METHODS,
  isCosted,
  newState,
  loadState,
  costMovement,
  averagePrice,
  // exported for tests
  applyInward,
  applyOutward,
};
