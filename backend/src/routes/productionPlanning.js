// Production Planning > Forecast — bespoke (not crudFactory) because every
// write here does real compute work (see services/forecastPlanService.js)
// rather than a plain list/get/create/update/delete over one table. Same
// reasoning as routes/notifications.js and routes/dashboard.js.

const router = require('express').Router();
const prisma = require('../prisma/client');
const auth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { computeForecastRows, buildOrderSummary, parseMonth } = require('../services/forecastPlanService');

function serializePlan(plan) {
  return {
    ...plan,
    lines: (plan.lines || []).map((line) => ({
      ...line,
      actualMonths: line.actualMonths ? JSON.parse(line.actualMonths) : [],
      forecastMonths: line.forecastMonths ? JSON.parse(line.forecastMonths) : [],
    })),
  };
}

// Next plan number — FCST-<YYYYMM>-<seq>, scoped to the calendar month a plan
// is created in. This feature deliberately does not go through the full
// Document Numbering series admin (company/document-numbers): a Forecast
// Plan is an internal planning artifact, not a numbered transactional
// document like a Sales Order/Invoice, so a lightweight auto-generated
// number is enough and avoids forcing the user to first set up a numbering
// series for a brand-new, unrelated module.
async function nextPlanNo() {
  const now = new Date();
  const prefix = `FCST-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`;
  const count = await prisma.productionForecastPlan.count({ where: { planNo: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

// GET /api/production-planning/forecast-plans — list, newest first.
router.get('/forecast-plans', auth(), asyncHandler(async (req, res) => {
  const plans = await prisma.productionForecastPlan.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });
  res.json({ success: true, data: plans });
}));

// GET /api/production-planning/forecast-plans/:id — one plan + its lines.
router.get('/forecast-plans/:id', auth(), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const plan = await prisma.productionForecastPlan.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!plan) {
    const err = new Error('Forecast plan not found');
    err.status = 404;
    throw err;
  }
  res.json({ success: true, data: serializePlan(plan) });
}));

// POST /api/production-planning/forecast-plans/preview — compute-only, never
// persisted. Powers the "Run Forecast" button so the user sees real numbers
// before choosing to save a plan. Left out of PATH_TO_MENU_KEY's governed
// writes (middleware/permission.js UNGOVERNED_POSTS) the same way
// document-numbers/peek is: it reads and computes, it does not manage
// anything.
router.post('/forecast-plans/preview', auth(), asyncHandler(async (req, res) => {
  const {
    fromMonth, toMonth, forecastPeriod, branch, itemGroup, itemCategory, customer,
    includeSafetyStock, productCodes,
  } = req.body;

  if (!fromMonth || !toMonth) {
    const err = new Error('fromMonth and toMonth are required');
    err.status = 400;
    throw err;
  }

  const { rows, actualMonthDates, forecastMonthDates } = await computeForecastRows({
    fromMonth, toMonth, forecastPeriod, branch, itemGroup, itemCategory, customer, includeSafetyStock, productCodes,
  });
  const orderSummary = buildOrderSummary(rows);

  res.json({ success: true, data: { rows, actualMonthDates, forecastMonthDates, orderSummary } });
}));

// POST /api/production-planning/forecast-plans — compute AND save. Governed
// under the 'production-planning-forecast' menu key (canAdd) — see
// middleware/permission.js.
router.post('/forecast-plans', auth(), asyncHandler(async (req, res) => {
  const {
    planName, forecastPeriod, fromMonth, toMonth, planType, version,
    branch, itemGroup, itemCategory, customer, includeSafetyStock, notes, productCodes,
  } = req.body;

  if (!planName || !fromMonth || !toMonth) {
    const err = new Error('planName, fromMonth and toMonth are required');
    err.status = 400;
    throw err;
  }

  const { rows } = await computeForecastRows({
    fromMonth, toMonth, forecastPeriod, branch, itemGroup, itemCategory, customer, includeSafetyStock, productCodes,
  });

  const planNo = await nextPlanNo();
  const plan = await prisma.productionForecastPlan.create({
    data: {
      planNo,
      planName,
      forecastPeriod: forecastPeriod || 'Monthly',
      fromMonth: parseMonth(fromMonth),
      toMonth: parseMonth(toMonth),
      planType: planType || 'Statistical Forecast',
      version: version || null,
      branch: branch || null,
      itemGroup: itemGroup || null,
      itemCategory: itemCategory || null,
      customer: customer || null,
      includeSafetyStock: includeSafetyStock !== false,
      notes: notes || null,
      createdById: req.user.id,
      createdByName: req.user.name || req.user.email || null,
      lines: {
        create: rows.map((row) => ({
          productCode: row.productCode,
          productName: row.productName,
          uom: row.uom,
          actualMonths: JSON.stringify(row.actualMonths),
          forecastMonths: JSON.stringify(row.forecastMonths),
          method: row.method,
          safetyStock: row.safetyStock,
          totalForecast: row.totalForecast,
          included: row.included,
        })),
      },
    },
    include: { lines: true },
  });

  res.status(201).json({ success: true, data: serializePlan(plan) });
}));

// PUT /api/production-planning/forecast-plans/:id — update header fields and
// recompute + replace lines wholesale (same replace-all pattern as
// journal_entry_lines/payment_voucher_applications elsewhere in this app).
router.put('/forecast-plans/:id', auth(), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.productionForecastPlan.findUnique({ where: { id } });
  if (!existing) {
    const err = new Error('Forecast plan not found');
    err.status = 404;
    throw err;
  }

  const {
    planName, forecastPeriod, fromMonth, toMonth, planType, version,
    branch, itemGroup, itemCategory, customer, includeSafetyStock, notes, status, productCodes,
  } = req.body;

  const effective = {
    fromMonth: fromMonth || existing.fromMonth,
    toMonth: toMonth || existing.toMonth,
    forecastPeriod: forecastPeriod || existing.forecastPeriod,
    branch: branch !== undefined ? branch : existing.branch,
    itemGroup: itemGroup !== undefined ? itemGroup : existing.itemGroup,
    itemCategory: itemCategory !== undefined ? itemCategory : existing.itemCategory,
    customer: customer !== undefined ? customer : existing.customer,
    includeSafetyStock: includeSafetyStock !== undefined ? includeSafetyStock : existing.includeSafetyStock,
  };

  const { rows } = await computeForecastRows({ ...effective, productCodes });

  const plan = await prisma.$transaction(async (tx) => {
    await tx.productionForecastPlanLine.deleteMany({ where: { planId: id } });
    return tx.productionForecastPlan.update({
      where: { id },
      data: {
        planName: planName || existing.planName,
        forecastPeriod: effective.forecastPeriod,
        fromMonth: parseMonth(effective.fromMonth),
        toMonth: parseMonth(effective.toMonth),
        planType: planType || existing.planType,
        version: version !== undefined ? version : existing.version,
        branch: effective.branch,
        itemGroup: effective.itemGroup,
        itemCategory: effective.itemCategory,
        customer: effective.customer,
        includeSafetyStock: effective.includeSafetyStock,
        notes: notes !== undefined ? notes : existing.notes,
        status: status || existing.status,
        lines: {
          create: rows.map((row) => ({
            productCode: row.productCode,
            productName: row.productName,
            uom: row.uom,
            actualMonths: JSON.stringify(row.actualMonths),
            forecastMonths: JSON.stringify(row.forecastMonths),
            method: row.method,
            safetyStock: row.safetyStock,
            totalForecast: row.totalForecast,
            included: row.included,
          })),
        },
      },
      include: { lines: true },
    });
  });

  res.json({ success: true, data: serializePlan(plan) });
}));

// DELETE /api/production-planning/forecast-plans/:id
router.delete('/forecast-plans/:id', auth(), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await prisma.productionForecastPlan.delete({ where: { id } }).catch(() => {
    const err = new Error('Forecast plan not found');
    err.status = 404;
    throw err;
  });
  res.json({ success: true });
}));

// GET /api/production-planning/meta/item-categories — distinct Product.productType
// values across active, inventory-tracked items, for the Item Category
// dropdown. There is no dedicated "item category" master in this schema (see
// services/forecastPlanService.js comment), so this is the real, if
// improvised, stand-in: it is genuinely derived from master data, not a
// hardcoded list.
router.get('/meta/item-categories', auth(), asyncHandler(async (req, res) => {
  const rows = await prisma.product.findMany({
    where: { status: 'Active', inventoryItem: true, productType: { not: null } },
    select: { productType: true },
    distinct: ['productType'],
    orderBy: { productType: 'asc' },
  });
  res.json({ success: true, data: rows.map((r) => r.productType).filter(Boolean) });
}));

module.exports = router;
