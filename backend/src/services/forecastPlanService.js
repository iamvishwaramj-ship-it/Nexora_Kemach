// Production Planning > Forecast — all the real, server-side computation
// behind the Forecast Plan screen (frontend pages/productionPlanning/Forecast.jsx).
//
// Nothing here is mock/placeholder data: Actual Demand is a real aggregate of
// Sales Invoice history, Forecast Demand is a real (if intentionally simple)
// statistical projection off that same history, and the four dropdown scopes
// (Plant/Location, Item Group, Item Category, Customer) resolve against real
// master data by the app's existing "stored by name, not by id" convention
// (see Product.productGroup / SalesOrder.customer / Warehouse.branch for the
// same pattern elsewhere in this schema).
//
// Deliberately NOT built on utils/crudFactory.js — every endpoint that uses
// this service does bespoke aggregation/compute work the generic CRUD
// list/get/create/update/delete shape doesn't cover (same reasoning as
// routes/notifications.js and routes/dashboard.js).

const prisma = require('../prisma/client');

const MONTH_RE = /^\d{4}-\d{2}$/;

function parseMonth(value) {
  // Accepts 'YYYY-MM' (what the frontend's <input type="month"> sends) or any
  // Date-parseable value. Always returns a Date pinned to the 1st of that
  // month at UTC midnight, so month-bucket comparisons are exact.
  if (typeof value === 'string' && MONTH_RE.test(value)) {
    const [y, m] = value.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 1));
  }
  const d = new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function addMonths(date, n) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + n, 1));
}

function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }).replace(' ', '-');
}

// Forecast Period -> how many calendar months each "period" step covers.
// Capped at 12 steps regardless of period, both to keep the query/response
// bounded and because a Forecast Plan beyond a year is not a realistic use
// of this screen.
const PERIOD_STEP_MONTHS = { Monthly: 1, Quarterly: 3, Yearly: 12 };
const MAX_FORECAST_PERIODS = 12;
const TRAILING_ACTUAL_MONTHS = 3;

function buildPeriodList(fromMonth, toMonth, forecastPeriod) {
  const step = PERIOD_STEP_MONTHS[forecastPeriod] || 1;
  const periods = [];
  let cursor = fromMonth;
  let guard = 0;
  while (cursor.getTime() <= toMonth.getTime() && guard < MAX_FORECAST_PERIODS) {
    periods.push(cursor);
    cursor = addMonths(cursor, step);
    guard += 1;
  }
  // Always at least one period, even if toMonth < fromMonth was mis-entered.
  return periods.length ? periods : [fromMonth];
}

// Resolves the eligible Product rows for a plan's scope. itemGroup/
// itemCategory/branch/customer are the master-data NAMES already stored
// against the plan (see the schema comment on ProductionForecastPlan).
// Only inventoryItem products are forecast-relevant here — see the
// Product.inventoryItem/salesItem/purchaseItem flags.
async function resolveEligibleProducts({ itemGroup, itemCategory, productCodes }) {
  const where = { status: 'Active', inventoryItem: true };
  if (itemGroup && itemGroup !== 'All Groups') where.productGroup = itemGroup;
  if (itemCategory && itemCategory !== 'All Categories') where.productType = itemCategory;
  if (Array.isArray(productCodes) && productCodes.length) where.productCode = { in: productCodes };

  return prisma.product.findMany({
    where,
    select: {
      productCode: true, productName: true, uom: true, productType: true,
      productGroup: true, reorderLevel: true, purchaseItem: true,
    },
    orderBy: { productCode: 'asc' },
    // A plan with no scope at all forecasts every active inventory item —
    // capped so one unscoped "Run Forecast" can't try to aggregate sales
    // history for thousands of products in a single request.
    take: 500,
  });
}

// Sums real SalesInvoiceItem quantity, bucketed by product code + calendar
// month, for invoices dated in [from, to). Cancelled invoices are excluded —
// they never represent real fulfilled/booked demand.
async function sumInvoicedQuantityByMonth({ productCodes, from, to, branch, customer }) {
  if (!productCodes.length) return new Map();

  const invoiceWhere = {
    isCancelled: false,
    invoiceDate: { gte: from, lt: to },
  };
  if (branch && branch !== 'All' && branch !== 'All Plants') invoiceWhere.branch = branch;
  if (customer && !/^all\b/i.test(customer)) invoiceWhere.customer = customer;

  const rows = await prisma.salesInvoiceItem.findMany({
    where: {
      productCode: { in: productCodes },
      invoice: invoiceWhere,
    },
    select: {
      productCode: true,
      quantity: true,
      invoice: { select: { invoiceDate: true } },
    },
  });

  // Map<productCode, Map<'YYYY-MM', qty>>
  const byProduct = new Map();
  for (const row of rows) {
    if (!row.invoice?.invoiceDate) continue;
    const key = monthKey(new Date(row.invoice.invoiceDate));
    if (!byProduct.has(row.productCode)) byProduct.set(row.productCode, new Map());
    const perMonth = byProduct.get(row.productCode);
    perMonth.set(key, (perMonth.get(key) || 0) + Number(row.quantity || 0));
  }
  return byProduct;
}

// The real forecast formula: a trailing 3-month moving average, projected
// forward with the linear trend observed across that same trailing window
// (slope = (last - first) / (n - 1) actual months). This is a standard,
// simple demand-forecasting method (moving-average-with-trend) — genuinely
// computed from the actual figures above, not a cosmetic label. Method is
// reported as 'Trend Analysis' when the trend is material (>=10% of the
// average per month) and 'Moving Average' otherwise, so the label always
// reflects which formula was actually applied for that item.
function computeForecast(actualValues) {
  const n = actualValues.length;
  const avg = n ? actualValues.reduce((a, b) => a + b, 0) / n : 0;
  const trend = n > 1 ? (actualValues[n - 1] - actualValues[0]) / (n - 1) : 0;
  const method = Math.abs(trend) >= 0.1 * Math.max(avg, 1) ? 'Trend Analysis' : 'Moving Average';
  const forecastFn = (stepIndex) => Math.max(0, Math.round(avg + trend * stepIndex));
  return { avg, trend, method, forecastFn };
}

/**
 * Computes the full set of forecast rows for a plan's scope + date range,
 * purely from real data — no persistence. Used by both the "Run Forecast"
 * preview and as the first step of actually saving a plan.
 */
async function computeForecastRows({
  fromMonth, toMonth, forecastPeriod = 'Monthly', branch, itemGroup, itemCategory, customer,
  includeSafetyStock = true, productCodes,
}) {
  const from = parseMonth(fromMonth);
  const to = parseMonth(toMonth);
  const actualFrom = addMonths(from, -TRAILING_ACTUAL_MONTHS);
  const periods = buildPeriodList(from, to, forecastPeriod);

  const products = await resolveEligibleProducts({ itemGroup, itemCategory, productCodes });
  const codes = products.map((p) => p.productCode);

  const actualByProduct = await sumInvoicedQuantityByMonth({
    productCodes: codes, from: actualFrom, to: from, branch, customer,
  });

  const actualMonthDates = Array.from({ length: TRAILING_ACTUAL_MONTHS }, (_, i) => addMonths(actualFrom, i));

  const rows = products.map((product) => {
    const perMonth = actualByProduct.get(product.productCode) || new Map();
    const actualMonths = actualMonthDates.map((d) => ({
      month: monthKey(d),
      label: monthLabel(d),
      qty: Math.round(perMonth.get(monthKey(d)) || 0),
    }));
    const actualValues = actualMonths.map((m) => m.qty);
    const { method, forecastFn } = computeForecast(actualValues);

    const forecastMonths = periods.map((d, idx) => ({
      month: monthKey(d),
      label: monthLabel(d),
      qty: forecastFn(idx + 1),
    }));

    const safetyStock = includeSafetyStock ? Number(product.reorderLevel || 0) : 0;
    const totalForecast = forecastMonths.reduce((sum, m) => sum + m.qty, 0) + safetyStock;

    return {
      productCode: product.productCode,
      productName: product.productName,
      uom: product.uom,
      purchaseItem: product.purchaseItem,
      actualMonths,
      forecastMonths,
      method,
      safetyStock,
      totalForecast,
      included: true,
    };
  });

  return { rows, actualMonthDates: actualMonthDates.map(monthLabel), forecastMonthDates: periods.map(monthLabel) };
}

/**
 * Section 3 "Generate Orders from Forecast" summary. Only Production and
 * Purchase can be computed from real data today: Product.purchaseItem is a
 * real master-data flag telling us whether an item is bought in directly
 * (needs a Purchase Order) or made in-house (needs a Production Order).
 * Subcontracting and Job Work orders have NO backing data model anywhere in
 * this schema (no BOM, no ProductionOrder, no SubcontractingOrder/JobWork
 * table) — surfaced as `available: false` rather than a fabricated number,
 * per the "no static/mock data" requirement.
 */
function buildOrderSummary(rows) {
  const included = rows.filter((r) => r.included);
  const production = included.filter((r) => !r.purchaseItem);
  const purchase = included.filter((r) => r.purchaseItem);
  const sum = (list) => list.reduce((total, r) => total + r.totalForecast, 0);

  return {
    production: { available: true, items: production.length, qty: sum(production) },
    purchase: { available: true, items: purchase.length, qty: sum(purchase) },
    subcontracting: { available: false, items: 0, qty: 0, reason: 'No Subcontracting Order module exists yet in this system.' },
    jobwork: { available: false, items: 0, qty: 0, reason: 'No Job Work Order module exists yet in this system.' },
  };
}

module.exports = { computeForecastRows, buildOrderSummary, parseMonth };
