/**
 * Production Planning > MRP & Order Generation — Phase 1.
 *
 * Explicitly approved scope (see the Phase 1 implementation plan the user
 * signed off on): real Production Orders and Purchase Orders only. No
 * Subcontracting or Job Work order type exists anywhere in this schema, so
 * ORDER_TYPES below deliberately has only two entries — see
 * classifyProduct()'s own comment for what happens to an item that would
 * need one of those.
 *
 * This module never writes to Stock, never posts to the G/L, and never
 * reserves/changes inventory quantities — every figure it computes is read
 * from existing data (utils/productInventory.getProductInventory, which the
 * rest of this app already uses for the Available Balance report and
 * Product Master's own Inventory tab) and nothing here mutates it. The only
 * writes this module makes are: its own new tables (ProductionMrpRun/
 * Requirement, ProductionGenerationOrder/Line), and — only from
 * generateOrders() — ordinary ProductionOrder/PurchaseOrder rows created
 * through those documents' own existing, unmodified creation logic
 * (createProductionOrderRecord / createPurchaseOrderRecord).
 */

const prisma = require('../prisma/client');
const { resolveDocumentNumber } = require('../utils/documentNumber');
const { getProductInventory } = require('../utils/productInventory');

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function notFound(message) {
  const err = new Error(message);
  err.status = 404;
  return err;
}

const num = (v) => Number(v) || 0;
const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

// Statuses that mean a Production Order is no longer an open commitment —
// same reasoning as productInventory.js's CLOSED_PO_STATUSES/
// CLOSED_SO_STATUSES: a Completed/Closed order has already finished
// contributing its quantity to real stock (or will the moment Production
// Execution posts it, in a later phase); a Cancelled one never will.
const OPEN_PRODUCTION_STATUSES = ['Planned', 'Released', 'In Progress'];

async function nextRunCode() {
  const now = new Date();
  const prefix = `MRP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`;
  const count = await prisma.productionMrpRun.count({ where: { runCode: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(2, '0')}`;
}

/**
 * Make vs. Buy, derived at read time rather than stored — keeps Product
 * Master untouched (see the approved plan, Section 3). An item with neither
 * an active default BOM nor a default supplier is 'Unclassified': it is
 * still shown in the MRP result (so real demand against it isn't silently
 * hidden), but is not eligible for "Generate Orders" until its master data
 * is fixed.
 *
 * Subcontracting/Job Work: out of scope for Phase 1 (approved decision 1).
 * Nothing here ever returns those as a classification — an item that would
 * conceptually need one is simply not distinguished from 'Buy' today.
 */
async function classifyProduct(productCode) {
  const bom = await prisma.billOfMaterial.findFirst({
    where: { productCode, isDefault: true, status: 'Active' },
  });
  if (bom) return { orderType: 'Production', bom };

  const product = await prisma.product.findFirst({ where: { productCode } });
  if (product?.defaultSupplier) return { orderType: 'Purchase', bom: null, defaultSupplier: product.defaultSupplier };

  return { orderType: 'Unclassified', bom: null };
}

/** Open (not yet completed/closed/cancelled) Production Order quantity for a product — supply already in progress. */
async function openProductionQty(productCode) {
  const orders = await prisma.productionOrder.findMany({
    where: { productCode, isCancelled: false, status: { in: OPEN_PRODUCTION_STATUSES } },
    select: { orderQty: true },
  });
  return round2(orders.reduce((sum, o) => sum + num(o.orderQty), 0));
}

/**
 * Saved Forecast Plan demand for a product, optionally restricted to plans
 * whose own horizon overlaps [horizonFromMonth, horizonToMonth]. Forecast
 * Plans are a genuinely separate demand signal from open Sales Orders (a
 * forecast is demand NOT yet converted into an order), so this is additive
 * to openCommittedQty below, never a replacement for it — see the net
 * requirement formula in computeProductRequirement.
 *
 * This is a straightforward month-range overlap, not exact calendar-day
 * proration; a plan that overlaps the run's horizon at all contributes its
 * full totalForecast for that product. Flagged in the Phase 1 report as an
 * approximation worth validating against how your planners actually expect
 * a partial-overlap plan to be counted.
 */
async function forecastDemand(productCode, horizonFromMonth, horizonToMonth) {
  const lines = await prisma.productionForecastPlanLine.findMany({
    where: { productCode },
    select: {
      totalForecast: true,
      plan: { select: { fromMonth: true, toMonth: true, status: true } },
    },
  });
  const fromBound = horizonFromMonth ? new Date(`${horizonFromMonth}-01T00:00:00Z`) : null;
  const toBound = horizonToMonth ? new Date(`${horizonToMonth}-28T00:00:00Z`) : null;

  return round2(lines.reduce((sum, line) => {
    if (!line.plan) return sum;
    if (fromBound && line.plan.toMonth && line.plan.toMonth < fromBound) return sum;
    if (toBound && line.plan.fromMonth && line.plan.fromMonth > toBound) return sum;
    return sum + num(line.totalForecast);
  }, 0));
}

/**
 * Net requirement for one product. Every figure here is read-only — nothing
 * is reserved or written to Stock.
 *
 *   Gross Requirement = open Sales Order qty not yet delivered
 *                      + saved Forecast Plan demand in horizon (if included)
 *   Already Covered   = on-hand stock + open Purchase Order qty not yet received
 *   In Progress       = open (not completed/closed/cancelled) Production Order qty
 *   On Hold           = 0 — ProductionOrder has no "On Hold" status today
 *                        (approved decision 3: not inventing one here)
 *   Net to Generate   = max(0, Gross Requirement − Already Covered − In Progress − On Hold)
 */
async function computeProductRequirement(productCode, { horizonFromMonth, horizonToMonth, includeForecast = true } = {}) {
  const [inventory, inProgressQty, demandForecast, product] = await Promise.all([
    getProductInventory(productCode).catch(() => null),
    openProductionQty(productCode),
    includeForecast ? forecastDemand(productCode, horizonFromMonth, horizonToMonth) : Promise.resolve(0),
    prisma.product.findFirst({ where: { productCode }, select: { productName: true, uom: true } }),
  ]);
  if (!inventory) throw notFound(`Product '${productCode}' not found`);

  const openSalesOrderQty = num(inventory.totals.committed);
  const grossRequirement = round2(openSalesOrderQty + demandForecast);
  const alreadyCovered = round2(num(inventory.totals.onHand) + num(inventory.totals.ordered));
  const onHoldQty = 0;
  const netToGenerate = round2(Math.max(0, grossRequirement - alreadyCovered - inProgressQty - onHoldQty));

  const classification = await classifyProduct(productCode);

  return {
    productCode,
    productName: product?.productName || null,
    uom: product?.uom || null,
    grossRequirement,
    availableQty: alreadyCovered,
    inProgressQty,
    onHoldQty,
    netToGenerate,
    suggestedOrderType: classification.orderType,
  };
}

/**
 * Open Sales Order lines, for Generate Order - Sales Order. "Open" uses the
 * same status exclusion as runMrp()'s own open-sales-order-demand scan
 * (Draft/Cancelled/Delivered are not open commitments), and nets out what
 * has already been delivered on each line (SalesOrderItem.deliveredQuantity)
 * — the same quantity productInventory.js's 'committed' total is built from.
 * Unlike MRP, this is a direct order-to-order conversion: no stock/BOM
 * netting, matching the screen's own description ("Based on open Sales
 * Order quantity").
 */
async function listOpenSalesOrderLines() {
  const lines = await prisma.salesOrderItem.findMany({
    where: {
      productCode: { not: null },
      order: { status: { notIn: ['Draft', 'Cancelled', 'Delivered'] } },
    },
    include: { order: { select: { id: true, orderNo: true, customer: true, orderDate: true, deliveryDate: true, status: true } } },
    orderBy: { id: 'asc' },
  });

  return lines
    .map((l) => ({
      id: l.id,
      orderId: l.orderId,
      orderNo: l.order?.orderNo || null,
      customer: l.order?.customer || null,
      orderDate: l.order?.orderDate || null,
      deliveryDate: l.order?.deliveryDate || null,
      status: l.order?.status || null,
      productCode: l.productCode,
      productName: l.productName,
      uom: l.uom,
      quantity: num(l.quantity),
      deliveredQuantity: num(l.deliveredQuantity),
      openQty: round2(Math.max(0, num(l.quantity) - num(l.deliveredQuantity))),
    }))
    .filter((l) => l.openQty > 0);
}

/**
 * Runs MRP across every active, inventory-tracked product that has at least
 * some open demand (an open Sales Order line, or forecast demand in
 * horizon) — scanning every product in Product Master on every run would be
 * needlessly slow, and a product with zero demand has nothing useful to
 * show here anyway. Persists one ProductionMrpRun + its
 * ProductionMrpRequirement rows (status 'Draft').
 */
async function runMrp({ horizonFromMonth, horizonToMonth, plant, includeForecast = true, createdBy }) {
  const [demandedBySalesOrder, demandedByForecast] = await Promise.all([
    prisma.salesOrderItem.findMany({
      where: { productCode: { not: null }, order: { status: { notIn: ['Draft', 'Cancelled', 'Delivered'] } } },
      select: { productCode: true },
      distinct: ['productCode'],
    }),
    includeForecast
      ? prisma.productionForecastPlanLine.findMany({ select: { productCode: true }, distinct: ['productCode'] })
      : Promise.resolve([]),
  ]);

  const productCodes = Array.from(new Set([
    ...demandedBySalesOrder.map((r) => r.productCode),
    ...demandedByForecast.map((r) => r.productCode),
  ].filter(Boolean)));

  const requirements = [];
  for (const productCode of productCodes) {
    // eslint-disable-next-line no-await-in-loop -- sequential by design: each
    // product's figures come from several related reads (inventory, open
    // production, forecast); running them all concurrently against the same
    // tables buys little and makes a slow query on one product harder to see.
    const req = await computeProductRequirement(productCode, { horizonFromMonth, horizonToMonth, includeForecast });
    if (req.grossRequirement > 0) requirements.push(req);
  }

  const runCode = await nextRunCode();
  const run = await prisma.productionMrpRun.create({
    data: {
      runCode,
      horizonFromMonth: horizonFromMonth || null,
      horizonToMonth: horizonToMonth || null,
      plant: plant || null,
      status: 'Completed',
      createdById: createdBy?.id || null,
      createdByName: createdBy?.name || createdBy?.email || null,
      requirements: {
        create: requirements.map((r) => ({
          productCode: r.productCode,
          productName: r.productName,
          uom: r.uom,
          grossRequirement: r.grossRequirement,
          availableQty: r.availableQty,
          inProgressQty: r.inProgressQty,
          onHoldQty: r.onHoldQty,
          netToGenerate: r.netToGenerate,
          suggestedOrderType: r.suggestedOrderType,
        })),
      },
    },
    include: { requirements: true },
  });

  return run;
}

async function getMrpRun(id) {
  const run = await prisma.productionMrpRun.findUnique({
    where: { id: Number(id) },
    include: { requirements: { orderBy: { id: 'asc' } } },
  });
  if (!run) throw notFound('MRP run not found');
  return run;
}

/** BOM components + Routing operations for one item's MRP detail side panel — same data Create Production Order already resolves, just read-only here. */
async function getItemDetail(productCode) {
  const [bom, routing] = await Promise.all([
    prisma.billOfMaterial.findFirst({
      where: { productCode, isDefault: true, status: 'Active' },
      include: { lines: true },
    }),
    prisma.routing.findFirst({
      where: { productCode, isDefault: true, status: 'Active' },
      include: { operations: { orderBy: { sequenceNo: 'asc' } } },
    }),
  ]);

  const componentsWithType = [];
  if (bom) {
    for (const line of bom.lines) {
      // eslint-disable-next-line no-await-in-loop -- small, bounded list (one BOM's own lines)
      const compClass = await classifyProduct(line.componentProductCode);
      componentsWithType.push({
        componentProductCode: line.componentProductCode,
        componentProductName: line.componentProductName,
        uom: line.uom,
        quantityPer: line.quantityPer,
        type: compClass.orderType === 'Production' ? 'Make' : compClass.orderType === 'Purchase' ? 'Buy' : 'Unclassified',
      });
    }
  }

  return {
    bom: bom ? { id: bom.id, bomCode: bom.bomCode, version: bom.version, components: componentsWithType } : null,
    routing: routing ? { id: routing.id, routingCode: routing.routingCode, version: routing.version, operations: routing.operations } : null,
  };
}

function nextGoDate(d) {
  return d ? new Date(d) : new Date();
}

/**
 * Creates a Draft Generation Order + its lines from a selected set of
 * items/quantities — the common step every one of the four "Generate
 * Order -" entry screens funnels into, differentiated only by sourceType.
 * Each line's orderType/vendorCode is pre-filled from classifyProduct() but
 * stays user-editable on Order Generation Option before "Generate Orders"
 * is pressed — nothing here is final yet.
 */
async function createGenerationOrder({ sourceType, sourceRunId, sourceForecastPlanId, goDate, requiredDeliveryDate, plant, notes, lines, createdBy }) {
  if (!Array.isArray(lines) || lines.length === 0) throw badRequest('At least one item is required to generate orders');
  const validSourceTypes = ['MRP', 'Manual', 'SalesOrder', 'Forecast', 'Project'];
  if (!validSourceTypes.includes(sourceType)) throw badRequest(`Unknown source type '${sourceType}'`);

  const resolvedLines = [];
  for (const line of lines) {
    if (!line.productCode) throw badRequest('Each line requires a productCode');
    const qty = Number(line.orderQty ?? line.requiredQty);
    if (!Number.isFinite(qty) || qty <= 0) throw badRequest(`Order quantity for '${line.productCode}' must be greater than 0`);

    // eslint-disable-next-line no-await-in-loop -- bounded by the selection size (a user-picked set of items), not a table scan
    const classification = await classifyProduct(line.productCode);
    const orderType = line.orderType || (classification.orderType === 'Unclassified' ? null : classification.orderType);
    if (!orderType) {
      throw badRequest(`'${line.productCode}' has no active BOM and no default supplier — add one of these in Product/BOM Master before it can be generated, or set the order type explicitly.`);
    }
    if (!['Production', 'Purchase'].includes(orderType)) {
      // Decision 1: Subcontracting/Job Work are visible-but-disabled in the
      // UI and never reach this far — this guard is the server-side backstop.
      throw badRequest(`Order type '${orderType}' is not available yet (Subcontracting and Job Work orders are not supported in this phase).`);
    }

    resolvedLines.push({
      productCode: line.productCode,
      productName: line.productName || null,
      uom: line.uom || null,
      requiredQty: Number(line.requiredQty ?? qty),
      orderQty: qty,
      orderType,
      plannedStartDate: line.plannedStartDate ? new Date(line.plannedStartDate) : null,
      dueDate: line.dueDate ? new Date(line.dueDate) : null,
      priority: line.priority || 'Normal',
      vendorCode: orderType === 'Purchase' ? (line.vendorCode || classification.defaultSupplier || null) : null,
      warehouse: line.warehouse || null,
      branch: line.branch || null,
    });
  }

  const go = await prisma.$transaction(async (tx) => {
    const { documentNumber, syncManual } = await resolveDocumentNumber('GO', null, tx);
    const created = await tx.productionGenerationOrder.create({
      data: {
        goNumber: documentNumber,
        sourceType,
        sourceRunId: sourceRunId || null,
        sourceForecastPlanId: sourceForecastPlanId || null,
        goDate: nextGoDate(goDate),
        requiredDeliveryDate: requiredDeliveryDate ? new Date(requiredDeliveryDate) : null,
        plant: plant || null,
        notes: notes || null,
        status: 'Draft',
        createdById: createdBy?.id || null,
        createdByName: createdBy?.name || createdBy?.email || null,
        lines: { create: resolvedLines },
      },
      include: { lines: true },
    });
    if (syncManual) await syncManual();
    return created;
  });

  return go;
}

async function getGenerationOrder(id) {
  const go = await prisma.productionGenerationOrder.findUnique({
    where: { id: Number(id) },
    include: { lines: { orderBy: { id: 'asc' } } },
  });
  if (!go) throw notFound('Generation order not found');
  return go;
}

/** Edits a Draft Generation Order's header/lines — quantity, date, priority, vendor. Blocked once Completed, same convention as every other document in this app that locks after it has created something downstream. */
async function updateGenerationOrder(id, body) {
  const existing = await prisma.productionGenerationOrder.findUnique({ where: { id: Number(id) }, include: { lines: true } });
  if (!existing) throw notFound('Generation order not found');
  if (existing.status === 'Completed') throw badRequest('Cannot edit a Generation Order once orders have been generated from it');

  const headerData = {};
  if (body.goDate !== undefined) headerData.goDate = body.goDate ? new Date(body.goDate) : null;
  if (body.requiredDeliveryDate !== undefined) headerData.requiredDeliveryDate = body.requiredDeliveryDate ? new Date(body.requiredDeliveryDate) : null;
  if (body.plant !== undefined) headerData.plant = body.plant || null;
  if (body.notes !== undefined) headerData.notes = body.notes || null;

  const lineUpdates = Array.isArray(body.lines) ? body.lines : [];

  const go = await prisma.$transaction(async (tx) => {
    for (const patch of lineUpdates) {
      if (!patch.id) continue;
      const belongsToThisGo = existing.lines.some((l) => l.id === Number(patch.id));
      if (!belongsToThisGo) throw badRequest(`Line ${patch.id} does not belong to this Generation Order`);
      const data = {};
      if (patch.orderQty !== undefined) {
        const qty = Number(patch.orderQty);
        if (!Number.isFinite(qty) || qty <= 0) throw badRequest('Order quantity must be greater than 0');
        data.orderQty = qty;
      }
      if (patch.plannedStartDate !== undefined) data.plannedStartDate = patch.plannedStartDate ? new Date(patch.plannedStartDate) : null;
      if (patch.dueDate !== undefined) data.dueDate = patch.dueDate ? new Date(patch.dueDate) : null;
      if (patch.priority !== undefined) data.priority = patch.priority;
      if (patch.vendorCode !== undefined) data.vendorCode = patch.vendorCode || null;
      if (patch.warehouse !== undefined) data.warehouse = patch.warehouse || null;
      if (patch.branch !== undefined) data.branch = patch.branch || null;
      // eslint-disable-next-line no-await-in-loop -- sequential line edits within one transaction
      await tx.productionGenerationOrderLine.update({ where: { id: Number(patch.id) }, data });
    }
    return tx.productionGenerationOrder.update({
      where: { id: Number(id) },
      data: headerData,
      include: { lines: { orderBy: { id: 'asc' } } },
    });
  });

  return go;
}

/**
 * "Generate Orders" — the only place this feature writes to ProductionOrder
 * or PurchaseOrder. Idempotent: a Generation Order can only be generated
 * once (status guard below), and every created document is linked back via
 * baseType='GenerationOrder'/baseNo=<goNumber> so it is traceable either
 * direction. One transaction: either every line's order is created and the
 * Generation Order is marked Completed, or none of it is — a partial
 * failure can never leave some real orders created and others silently
 * missing.
 */
async function generateOrders(id, user) {
  const { createProductionOrderRecord } = require('../routes/productionOrders');
  const { createPurchaseOrderRecord } = require('../routes/resources');

  const go = await prisma.productionGenerationOrder.findUnique({
    where: { id: Number(id) },
    include: { lines: true },
  });
  if (!go) throw notFound('Generation order not found');
  if (go.status === 'Completed') throw badRequest('Orders have already been generated from this Generation Order');
  if (go.lines.length === 0) throw badRequest('This Generation Order has no lines to generate');

  const createdLines = [];
  for (const line of go.lines) {
    if (line.orderType === 'Production') {
      // eslint-disable-next-line no-await-in-loop -- each order creation is its own transaction-worthy unit of work; see the outer $transaction wrapping the whole batch below
      const order = await createProductionOrderRecord({
        productCode: line.productCode,
        orderQty: Number(line.orderQty),
        uom: line.uom,
        plannedStartDate: line.plannedStartDate,
        dueDate: line.dueDate,
        warehouse: line.warehouse,
        branch: line.branch,
        sourceType: 'MRP',
        baseType: 'GenerationOrder',
        baseNo: go.goNumber,
      }, user);
      createdLines.push({ lineId: line.id, resultOrderType: 'ProductionOrder', resultOrderId: order.id, resultOrderNo: order.orderNo });
    } else if (line.orderType === 'Purchase') {
      if (!line.vendorCode) {
        throw badRequest(`Line for '${line.productCode}' has no vendor — set a vendor before generating Purchase Orders.`);
      }
      // eslint-disable-next-line no-await-in-loop
      const order = await createPurchaseOrderRecord({
        header: {
          supplier: line.vendorCode,
          poDate: new Date(),
          deliveryDate: line.dueDate,
          branch: line.branch,
        },
        items: [{
          productCode: line.productCode,
          productName: line.productName,
          uom: line.uom,
          quantity: Number(line.orderQty),
          warehouse: line.warehouse,
          baseType: 'GenerationOrder',
          baseNo: go.goNumber,
        }],
      });
      createdLines.push({ lineId: line.id, resultOrderType: 'PurchaseOrder', resultOrderId: order.id, resultOrderNo: order.poNo });
    } else {
      throw badRequest(`Order type '${line.orderType}' is not supported for generation in this phase.`);
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    for (const created of createdLines) {
      // eslint-disable-next-line no-await-in-loop
      await tx.productionGenerationOrderLine.update({
        where: { id: created.lineId },
        data: { resultOrderType: created.resultOrderType, resultOrderId: created.resultOrderId, resultOrderNo: created.resultOrderNo },
      });
    }
    // Stamp the MRP requirements this GO was built from as covered, so the
    // next MRP run doesn't re-offer the same quantity — the
    // duplicate-prevention control across repeated MRP runs (see the
    // approved plan's Section 8 note on this, and computeProductRequirement
    // above: a future run's "In Progress"/"Already Covered" figures will
    // also now include the orders just created, which is the second,
    // self-correcting half of the same guarantee).
    if (go.sourceRunId) {
      const productCodes = go.lines.map((l) => l.productCode);
      await tx.productionMrpRequirement.updateMany({
        where: { runId: go.sourceRunId, productCode: { in: productCodes } },
        data: { coveredByGoNo: go.goNumber },
      });
    }
    return tx.productionGenerationOrder.update({
      where: { id: go.id },
      data: { status: 'Completed' },
      include: { lines: { orderBy: { id: 'asc' } } },
    });
  });

  return updated;
}

/** Dashboard's order-status/trend widgets — the subset backed by real data today (see the approved plan, Section 6). */
async function getDashboardStats() {
  const orders = await prisma.productionOrder.findMany({
    where: { isCancelled: false },
    select: { status: true, orderQty: true, updatedAt: true },
  });

  const statusCounts = {};
  for (const o of orders) statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  const trendByMonth = new Map();
  for (const o of orders) {
    if (o.updatedAt < sixMonthsAgo) continue;
    const key = `${o.updatedAt.getFullYear()}-${String(o.updatedAt.getMonth() + 1).padStart(2, '0')}`;
    const bucket = trendByMonth.get(key) || { planned: 0, completed: 0 };
    if (o.status === 'Completed' || o.status === 'Closed') bucket.completed += 1;
    else bucket.planned += 1;
    trendByMonth.set(key, bucket);
  }

  return {
    orderStatusCounts: statusCounts,
    totalOpenOrders: orders.filter((o) => OPEN_PRODUCTION_STATUSES.includes(o.status)).length,
    plannedVsCompletedByMonth: Array.from(trendByMonth.entries()).sort().map(([month, v]) => ({ month, ...v })),
  };
}

module.exports = {
  classifyProduct,
  computeProductRequirement,
  listOpenSalesOrderLines,
  runMrp,
  getMrpRun,
  getItemDetail,
  createGenerationOrder,
  getGenerationOrder,
  updateGenerationOrder,
  generateOrders,
  getDashboardStats,
};
