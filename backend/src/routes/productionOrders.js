// Production Execution > Production Orders — Phase A manufacturing
// foundation (schema.prisma: ProductionOrder, ProductionOrderComponent,
// ProductionOrderOperation). Additive only, created under the explicitly-
// approved Phase A scope.
//
// Deliberately NOT built on crudFactory/crudRouter: creating an order does
// real compute work (resolving its document number, picking/validating a
// BOM and Routing, snapshotting their lines) rather than a plain insert —
// same reasoning as routes/productionPlanning.js's Forecast Plan routes.
//
// Explicitly out of scope here (separate, later, individually-approved
// phases): Material Requisition/Issue/Receipt, Production costing, and any
// GL/WIP posting. Nothing in this file writes to Stock, StockIssue,
// StockReceipt, JournalEntry or any accounting table — creating, editing,
// transitioning or cancelling a Production Order here has zero effect on
// inventory or the G/L.

const router = require('express').Router();
const prisma = require('../prisma/client');
const auth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { resolveDocumentNumber } = require('../utils/documentNumber');

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

const orderInclude = {
  components: true,
  operations: { orderBy: { operationNo: 'asc' } },
  bom: { select: { id: true, bomCode: true, version: true } },
  routing: { select: { id: true, routingCode: true, version: true } },
};

// Forward-only lifecycle. A Production Order can only ever move to the next
// stage, never skip ahead or go backwards — Cancel (see PATCH .../cancel
// below) is the only way out of the normal flow, and is itself blocked once
// a Production Order is Completed or Closed.
const STATUS_FLOW = ['Planned', 'Released', 'In Progress', 'Completed', 'Closed'];

router.get('/orders', auth(), asyncHandler(async (req, res) => {
  const { status, productCode } = req.query;
  const where = {};
  if (status) where.status = status;
  if (productCode) where.productCode = productCode;
  const orders = await prisma.productionOrder.findMany({
    where,
    include: orderInclude,
    orderBy: { updatedAt: 'desc' },
    take: 500,
  });
  res.json({ success: true, data: orders });
}));

router.get('/orders/:id', auth(), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const order = await prisma.productionOrder.findUnique({ where: { id }, include: orderInclude });
  if (!order) throw notFound('Production order not found');
  res.json({ success: true, data: order });
}));

// POST /api/production/orders — create + snapshot.
//
// If bomId/routingId are omitted, the server looks up the one
// isDefault:true, status:'Active' BOM/Routing for productCode. Routing is
// optional (an order with no routing simply gets no operations snapshotted
// — Work Center/Routing is not mandatory for every manufactured item in
// this phase); BOM is required, because without one there is nothing to
// snapshot into ProductionOrderComponent and no Material Requisition/Issue
// phase (later) would have anything to work from.
router.post('/orders', auth(), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const { productCode, orderQty } = body;

  if (!productCode || !String(productCode).trim()) throw badRequest('Product code is required');
  const qty = Number(orderQty);
  if (!Number.isFinite(qty) || qty <= 0) throw badRequest('Order quantity must be greater than 0');

  const product = await prisma.product.findFirst({ where: { productCode } });
  if (!product) throw badRequest(`Product '${productCode}' does not exist in Product Master`);

  // Resolve the BOM to snapshot from.
  let bom;
  if (body.bomId) {
    bom = await prisma.billOfMaterial.findUnique({ where: { id: Number(body.bomId) }, include: { lines: true } });
    if (!bom) throw badRequest('Selected BOM was not found');
    if (bom.productCode !== productCode) throw badRequest('Selected BOM does not belong to this product');
  } else {
    const candidates = await prisma.billOfMaterial.findMany({
      where: { productCode, isDefault: true, status: 'Active' },
      include: { lines: true },
    });
    if (candidates.length === 0) {
      throw badRequest(`No default active BOM found for product '${productCode}'. Create one, or select a BOM explicitly.`);
    }
    if (candidates.length > 1) {
      throw badRequest(`More than one default active BOM exists for product '${productCode}'. Select one explicitly.`);
    }
    [bom] = candidates;
  }
  if (!bom.lines || bom.lines.length === 0) throw badRequest('The selected BOM has no component lines');

  // Resolve the Routing to snapshot from — optional.
  let routing = null;
  if (body.routingId) {
    routing = await prisma.routing.findUnique({ where: { id: Number(body.routingId) }, include: { operations: true } });
    if (!routing) throw badRequest('Selected routing was not found');
    if (routing.productCode !== productCode) throw badRequest('Selected routing does not belong to this product');
  } else {
    const routingCandidates = await prisma.routing.findMany({
      where: { productCode, isDefault: true, status: 'Active' },
      include: { operations: true },
    });
    if (routingCandidates.length === 1) [routing] = routingCandidates;
    // Zero or more-than-one default routing is not an error here — routing
    // is optional; an order with no resolvable routing just gets none
    // snapshotted, and can still track components/material without it.
  }

  const order = await prisma.$transaction(async (tx) => {
    const { documentNumber, syncManual } = await resolveDocumentNumber('PRO', body.orderNo, tx);

    const created = await tx.productionOrder.create({
      data: {
        orderNo: documentNumber,
        productCode,
        productName: product.productName || null,
        bomId: bom.id,
        routingId: routing ? routing.id : null,
        orderQty: qty,
        uom: body.uom || bom.uom || product.uom || null,
        plannedStartDate: body.plannedStartDate ? new Date(body.plannedStartDate) : null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        warehouse: body.warehouse || null,
        branch: body.branch || null,
        sourceType: body.sourceType || 'Manual',
        baseType: body.baseType || null,
        baseNo: body.baseNo || null,
        baseEntry: body.baseEntry != null ? Number(body.baseEntry) : null,
        baseLine: body.baseLine != null ? Number(body.baseLine) : null,
        notes: body.notes || null,
        createdById: req.user.id,
        createdByName: req.user.name || req.user.email || null,
        components: {
          create: bom.lines.map((line) => ({
            componentProductCode: line.componentProductCode,
            componentProductName: line.componentProductName,
            uom: line.uom,
            // scrap-adjusted requirement for the full order quantity, scaled
            // against the BOM's own base quantity (quantityPer is "per
            // baseQuantity units of the finished good", not always "per 1").
            plannedQty: (Number(line.quantityPer) * qty / Number(bom.baseQuantity || 1)) * (1 + Number(line.scrapPercent || 0) / 100),
          })),
        },
        operations: routing ? {
          create: routing.operations.map((op) => ({
            operationNo: op.operationNo,
            operationName: op.operationName,
            workCenterCode: op.workCenterCode,
          })),
        } : undefined,
      },
      include: orderInclude,
    });

    if (syncManual) await syncManual();
    return created;
  });

  res.status(201).json({ success: true, data: order });
}));

// PUT /api/production/orders/:id — header-only edit. Planned status only:
// once released, the order's components/operations are already the basis
// for downstream planning (Material Requisition in a later phase), so
// re-snapshotting or changing quantities after that point is a status
// transition / cancel-and-recreate decision, not a plain edit.
router.put('/orders/:id', auth(), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.productionOrder.findUnique({ where: { id } });
  if (!existing) throw notFound('Production order not found');
  if (existing.status !== 'Planned') {
    throw badRequest(`Cannot edit a production order once it is ${existing.status}`);
  }

  const body = req.body || {};
  const data = {};
  if (body.plannedStartDate !== undefined) data.plannedStartDate = body.plannedStartDate ? new Date(body.plannedStartDate) : null;
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (body.warehouse !== undefined) data.warehouse = body.warehouse || null;
  if (body.branch !== undefined) data.branch = body.branch || null;
  if (body.notes !== undefined) data.notes = body.notes || null;
  // Quantity/BOM/Routing are intentionally not editable here — changing them
  // would invalidate the already-snapshotted components/operations. Cancel
  // and create a new order instead.

  const order = await prisma.productionOrder.update({ where: { id }, data, include: orderInclude });
  res.json({ success: true, data: order });
}));

// PATCH /api/production/orders/:id/status — controlled, forward-only status
// transition (see STATUS_FLOW above). Governed by the same canEdit
// permission flag as any other PUT/PATCH write (middleware/permission.js
// has no special-cased action for this path), consistent with the rest of
// this app's plain status+permission-flag convention — ApprovalFlow is
// dormant and unenforced anywhere else in this codebase, so this
// deliberately does not introduce a new approval-engine integration.
router.patch('/orders/:id/status', auth(), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.productionOrder.findUnique({ where: { id } });
  if (!existing) throw notFound('Production order not found');
  if (existing.isCancelled) throw badRequest('Cannot change the status of a cancelled production order');

  const { status: nextStatus } = req.body || {};
  const currentIdx = STATUS_FLOW.indexOf(existing.status);
  const nextIdx = STATUS_FLOW.indexOf(nextStatus);
  if (nextIdx === -1) throw badRequest(`Unknown status '${nextStatus}'`);
  if (nextIdx !== currentIdx + 1) {
    throw badRequest(`Cannot move from '${existing.status}' to '${nextStatus}' — statuses must advance one step at a time (${STATUS_FLOW.join(' -> ')})`);
  }

  const order = await prisma.productionOrder.update({
    where: { id },
    data: { status: nextStatus },
    include: orderInclude,
  });
  res.json({ success: true, data: order });
}));

// PATCH /api/production/orders/:id/cancel — governed by the dedicated
// canCancel permission flag (see middleware/permission.js's resolveAction,
// which special-cases any PATCH .../cancel path), same as every other
// cancellable document in this app. Blocked once Completed/Closed, the same
// way a Sales/Purchase document can't be cancelled after it's fully
// processed.
router.patch('/orders/:id/cancel', auth(), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.productionOrder.findUnique({ where: { id } });
  if (!existing) throw notFound('Production order not found');
  if (existing.isCancelled) throw badRequest('Production order is already cancelled');
  if (['Completed', 'Closed'].includes(existing.status)) {
    throw badRequest(`Cannot cancel a production order that is already ${existing.status}`);
  }

  const order = await prisma.productionOrder.update({
    where: { id },
    data: { isCancelled: true },
    include: orderInclude,
  });
  res.json({ success: true, data: order });
}));

// DELETE /api/production/orders/:id — Planned only. Anything released has
// already been acted on (and, in a later phase, may have Material
// Requisitions referencing it), so Cancel is the correct action past this
// point, not delete.
router.delete('/orders/:id', auth(), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.productionOrder.findUnique({ where: { id } });
  if (!existing) throw notFound('Production order not found');
  if (existing.status !== 'Planned') {
    throw badRequest(`Cannot delete a production order once it is ${existing.status} — cancel it instead`);
  }
  await prisma.productionOrder.delete({ where: { id } });
  res.json({ success: true, message: 'Deleted successfully' });
}));

module.exports = router;
