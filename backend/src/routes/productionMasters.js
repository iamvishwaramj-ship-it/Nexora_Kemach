// Production Planning > Work Centers / Bill of Materials / Routing — Phase A
// manufacturing foundation (schema.prisma: WorkCenter, BillOfMaterial,
// BomLine, Routing, RoutingOperation). Additive only, created under the
// explicitly-approved Phase A scope — see the plan thread for the full
// decision record. Nothing here touches Stock/StockIssue/StockReceipt/
// JournalEntry or any GL posting logic: these are pure planning masters.
//
// Work Centers is a plain master -> served by the generic crudRouter, same
// as every other simple master in this app (UOM, Brand, Product Group...).
// BOM and Routing are header+lines resources (one header, many child rows)
// -> bespoke routes below, following the exact replace-all-lines-on-PUT
// pattern productionPlanning.js's Forecast Plan already uses for its own
// lines, and the same shape resources.js uses for Sales/Purchase documents.

const router = require('express').Router();
const prisma = require('../prisma/client');
const auth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const crudRouter = require('../utils/crudRouter');

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

// ---------------------------------------------------------------------------
// Work Centers — plain master, generic CRUD factory.
// ---------------------------------------------------------------------------
router.use('/work-centers', crudRouter(prisma.workCenter, {
  searchFields: ['workCenterCode', 'name'],
  orderBy: { workCenterCode: 'asc' },
}));

// ---------------------------------------------------------------------------
// Bill of Materials (+ lines) — single-level only, versioned, with an
// isDefault flag per productCode. A Production Order snapshots these lines
// at creation time (see routes/productionOrders.js), so editing or even
// deleting a BOM here never changes an order already created from it.
// ---------------------------------------------------------------------------

async function assertProductExists(productCode, label) {
  if (!productCode) return;
  const product = await prisma.product.findFirst({ where: { productCode } });
  if (!product) throw badRequest(`${label} '${productCode}' does not exist in Product Master`);
  return product;
}

function validateBomPayload(body) {
  const { bomCode, productCode, lines } = body;
  if (!bomCode || !String(bomCode).trim()) throw badRequest('BOM code is required');
  if (!productCode || !String(productCode).trim()) throw badRequest('Product code is required');
  if (!Array.isArray(lines) || lines.length === 0) throw badRequest('At least one component line is required');
  lines.forEach((line, idx) => {
    if (!line.componentProductCode) throw badRequest(`Line ${idx + 1}: component product code is required`);
    if (line.componentProductCode === productCode) {
      throw badRequest(`Line ${idx + 1}: a component cannot be the same product as the BOM header`);
    }
    const qty = Number(line.quantityPer);
    if (!Number.isFinite(qty) || qty <= 0) throw badRequest(`Line ${idx + 1}: quantity per must be greater than 0`);
  });
}

const bomInclude = { lines: { orderBy: { sequenceNo: 'asc' } } };

router.get('/boms', auth(), asyncHandler(async (req, res) => {
  const { productCode, status } = req.query;
  const where = {};
  if (productCode) where.productCode = productCode;
  if (status) where.status = status;
  const boms = await prisma.billOfMaterial.findMany({ where, include: bomInclude, orderBy: { updatedAt: 'desc' } });
  res.json({ success: true, data: boms });
}));

router.get('/boms/:id', auth(), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const bom = await prisma.billOfMaterial.findUnique({ where: { id }, include: bomInclude });
  if (!bom) throw notFound('BOM not found');
  res.json({ success: true, data: bom });
}));

router.post('/boms', auth(), asyncHandler(async (req, res) => {
  const body = req.body || {};
  validateBomPayload(body);
  await assertProductExists(body.productCode, 'Product');
  for (const line of body.lines) {
    await assertProductExists(line.componentProductCode, 'Component');
  }

  const dupe = await prisma.billOfMaterial.findUnique({ where: { bomCode: body.bomCode } });
  if (dupe) throw badRequest(`BOM code '${body.bomCode}' already exists`);

  const bom = await prisma.$transaction(async (tx) => {
    // Setting isDefault true unsets any other default BOM for the same
    // product inside the same transaction, so two BOMs can never both be
    // "the" default a Production Order auto-picks.
    if (body.isDefault) {
      await tx.billOfMaterial.updateMany({
        where: { productCode: body.productCode, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.billOfMaterial.create({
      data: {
        bomCode: body.bomCode,
        productCode: body.productCode,
        uom: body.uom || null,
        version: body.version || '1.0',
        baseQuantity: body.baseQuantity != null ? body.baseQuantity : 1,
        isDefault: !!body.isDefault,
        status: body.status || 'Active',
        notes: body.notes || null,
        createdById: req.user.id,
        createdByName: req.user.name || req.user.email || null,
        lines: {
          create: body.lines.map((line, idx) => ({
            componentProductCode: line.componentProductCode,
            componentProductName: line.componentProductName || null,
            uom: line.uom || null,
            quantityPer: line.quantityPer,
            scrapPercent: line.scrapPercent || 0,
            sequenceNo: line.sequenceNo || idx + 1,
          })),
        },
      },
      include: bomInclude,
    });
  });

  res.status(201).json({ success: true, data: bom });
}));

router.put('/boms/:id', auth(), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.billOfMaterial.findUnique({ where: { id } });
  if (!existing) throw notFound('BOM not found');

  const body = req.body || {};
  validateBomPayload({ ...existing, ...body, lines: body.lines });
  await assertProductExists(body.productCode || existing.productCode, 'Product');
  for (const line of body.lines) {
    await assertProductExists(line.componentProductCode, 'Component');
  }

  if (body.bomCode && body.bomCode !== existing.bomCode) {
    const dupe = await prisma.billOfMaterial.findUnique({ where: { bomCode: body.bomCode } });
    if (dupe) throw badRequest(`BOM code '${body.bomCode}' already exists`);
  }

  const bom = await prisma.$transaction(async (tx) => {
    const productCode = body.productCode || existing.productCode;
    if (body.isDefault) {
      await tx.billOfMaterial.updateMany({
        where: { productCode, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }
    // Replace-all-lines-on-PUT — same pattern Forecast Plan's own lines use
    // (see routes/productionPlanning.js's PUT /forecast-plans/:id).
    await tx.bomLine.deleteMany({ where: { bomId: id } });
    return tx.billOfMaterial.update({
      where: { id },
      data: {
        bomCode: body.bomCode || existing.bomCode,
        productCode,
        uom: body.uom !== undefined ? body.uom : existing.uom,
        version: body.version || existing.version,
        baseQuantity: body.baseQuantity != null ? body.baseQuantity : existing.baseQuantity,
        isDefault: body.isDefault !== undefined ? !!body.isDefault : existing.isDefault,
        status: body.status || existing.status,
        notes: body.notes !== undefined ? body.notes : existing.notes,
        lines: {
          create: body.lines.map((line, idx) => ({
            componentProductCode: line.componentProductCode,
            componentProductName: line.componentProductName || null,
            uom: line.uom || null,
            quantityPer: line.quantityPer,
            scrapPercent: line.scrapPercent || 0,
            sequenceNo: line.sequenceNo || idx + 1,
          })),
        },
      },
      include: bomInclude,
    });
  });

  res.json({ success: true, data: bom });
}));

// DELETE is always safe: production_orders.bom_id is ON DELETE SET NULL (see
// the migration), so removing a BOM can never be blocked by, or cascade
// into, a Production Order already created from it — that order keeps its
// own already-snapshotted ProductionOrderComponent rows regardless.
router.delete('/boms/:id', auth(), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await prisma.billOfMaterial.delete({ where: { id } }).catch(() => { throw notFound('BOM not found'); });
  res.json({ success: true, message: 'Deleted successfully' });
}));

// ---------------------------------------------------------------------------
// Routing (+ operations) — same header+lines shape as BOM above.
// ---------------------------------------------------------------------------

function validateRoutingPayload(body) {
  const { routingCode, productCode, operations } = body;
  if (!routingCode || !String(routingCode).trim()) throw badRequest('Routing code is required');
  if (!productCode || !String(productCode).trim()) throw badRequest('Product code is required');
  if (!Array.isArray(operations) || operations.length === 0) throw badRequest('At least one operation is required');
  operations.forEach((op, idx) => {
    if (!op.operationName || !String(op.operationName).trim()) throw badRequest(`Operation ${idx + 1}: name is required`);
    if (op.operationNo == null || !Number.isInteger(Number(op.operationNo)) || Number(op.operationNo) <= 0) {
      throw badRequest(`Operation ${idx + 1}: a positive operation number is required`);
    }
  });
}

async function assertWorkCenterExists(workCenterCode, label) {
  if (!workCenterCode) return;
  const wc = await prisma.workCenter.findFirst({ where: { workCenterCode } });
  if (!wc) throw badRequest(`${label} '${workCenterCode}' does not exist in Work Centers`);
}

const routingInclude = { operations: { orderBy: { sequenceNo: 'asc' } } };

router.get('/routings', auth(), asyncHandler(async (req, res) => {
  const { productCode, status } = req.query;
  const where = {};
  if (productCode) where.productCode = productCode;
  if (status) where.status = status;
  const routings = await prisma.routing.findMany({ where, include: routingInclude, orderBy: { id: 'desc' } });
  res.json({ success: true, data: routings });
}));

router.get('/routings/:id', auth(), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const routing = await prisma.routing.findUnique({ where: { id }, include: routingInclude });
  if (!routing) throw notFound('Routing not found');
  res.json({ success: true, data: routing });
}));

router.post('/routings', auth(), asyncHandler(async (req, res) => {
  const body = req.body || {};
  validateRoutingPayload(body);
  await assertProductExists(body.productCode, 'Product');
  for (const op of body.operations) {
    await assertWorkCenterExists(op.workCenterCode, 'Work center');
  }

  const dupe = await prisma.routing.findUnique({ where: { routingCode: body.routingCode } });
  if (dupe) throw badRequest(`Routing code '${body.routingCode}' already exists`);

  const routing = await prisma.$transaction(async (tx) => {
    if (body.isDefault) {
      await tx.routing.updateMany({
        where: { productCode: body.productCode, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.routing.create({
      data: {
        routingCode: body.routingCode,
        productCode: body.productCode,
        version: body.version || '1.0',
        isDefault: !!body.isDefault,
        status: body.status || 'Active',
        operations: {
          create: body.operations.map((op, idx) => ({
            operationNo: Number(op.operationNo),
            operationName: op.operationName,
            workCenterCode: op.workCenterCode || null,
            standardTimeMins: op.standardTimeMins != null ? op.standardTimeMins : null,
            sequenceNo: op.sequenceNo || idx + 1,
          })),
        },
      },
      include: routingInclude,
    });
  });

  res.status(201).json({ success: true, data: routing });
}));

router.put('/routings/:id', auth(), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.routing.findUnique({ where: { id } });
  if (!existing) throw notFound('Routing not found');

  const body = req.body || {};
  validateRoutingPayload({ ...existing, ...body, operations: body.operations });
  await assertProductExists(body.productCode || existing.productCode, 'Product');
  for (const op of body.operations) {
    await assertWorkCenterExists(op.workCenterCode, 'Work center');
  }

  if (body.routingCode && body.routingCode !== existing.routingCode) {
    const dupe = await prisma.routing.findUnique({ where: { routingCode: body.routingCode } });
    if (dupe) throw badRequest(`Routing code '${body.routingCode}' already exists`);
  }

  const routing = await prisma.$transaction(async (tx) => {
    const productCode = body.productCode || existing.productCode;
    if (body.isDefault) {
      await tx.routing.updateMany({
        where: { productCode, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }
    await tx.routingOperation.deleteMany({ where: { routingId: id } });
    return tx.routing.update({
      where: { id },
      data: {
        routingCode: body.routingCode || existing.routingCode,
        productCode,
        version: body.version || existing.version,
        isDefault: body.isDefault !== undefined ? !!body.isDefault : existing.isDefault,
        status: body.status || existing.status,
        operations: {
          create: body.operations.map((op, idx) => ({
            operationNo: Number(op.operationNo),
            operationName: op.operationName,
            workCenterCode: op.workCenterCode || null,
            standardTimeMins: op.standardTimeMins != null ? op.standardTimeMins : null,
            sequenceNo: op.sequenceNo || idx + 1,
          })),
        },
      },
      include: routingInclude,
    });
  });

  res.json({ success: true, data: routing });
}));

// Safe for the same reason BOM's DELETE is — production_orders.routing_id is
// also ON DELETE SET NULL.
router.delete('/routings/:id', auth(), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await prisma.routing.delete({ where: { id } }).catch(() => { throw notFound('Routing not found'); });
  res.json({ success: true, message: 'Deleted successfully' });
}));

module.exports = router;
