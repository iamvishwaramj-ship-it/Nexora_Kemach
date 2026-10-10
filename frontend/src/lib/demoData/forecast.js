// Static stand-ins for the Forecast Plan screen (Forecast.jsx) and the
// "Generate Order - Forecast" screen (GenerateOrderForecast.jsx), used only
// when DEMO_MODE is on (see ../demoMode.js). Shapes mirror exactly what the
// real backend returns today (usePreviewForecastPlanMutation's result,
// useListForecastPlansQuery/useGetForecastPlanQuery), and reuse
// ./productionPlanning.js's product catalog so the numbers look connected
// across screens.

const now = new Date();
function monthLabel(offsetMonths) {
  const d = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

// Mirrors the shape of `result` from usePreviewForecastPlanMutation:
// { rows, actualMonthDates, forecastMonthDates, orderSummary }.
export function buildDemoForecastResult() {
  const actualMonthDates = [monthLabel(-2), monthLabel(-1), monthLabel(0)];
  const forecastMonthDates = [monthLabel(1), monthLabel(2), monthLabel(3)];
  const rowDefs = [
    { productCode: 'FG-1001', productName: 'Industrial Gear Assembly', uom: 'PCS', actual: [420, 460, 480], forecast: [500, 520, 540], method: 'Moving Average', safetyStock: 50 },
    { productCode: 'FG-1002', productName: 'Hydraulic Pump Unit', uom: 'PCS', actual: [110, 130, 140], forecast: [150, 155, 160], method: 'Moving Average', safetyStock: 20 },
    { productCode: 'FG-1003', productName: 'Conveyor Motor Drive', uom: 'PCS', actual: [60, 70, 75], forecast: [80, 82, 85], method: 'Trend', safetyStock: 10 },
  ];
  const rows = rowDefs.map((r) => {
    const totalForecast = r.forecast.reduce((s, q) => s + q, 0) + r.safetyStock;
    return {
      productCode: r.productCode,
      productName: r.productName,
      uom: r.uom,
      actualMonths: actualMonthDates.map((month, i) => ({ month, qty: r.actual[i] })),
      forecastMonths: forecastMonthDates.map((month, i) => ({ month, qty: r.forecast[i] })),
      method: r.method,
      safetyStock: r.safetyStock,
      totalForecast,
    };
  });
  const totalProductionQty = rows[0].totalForecast + rows[1].totalForecast;
  const totalPurchaseQty = rows[2].totalForecast;
  return {
    rows,
    actualMonthDates,
    forecastMonthDates,
    orderSummary: {
      production: { available: true, items: 2, qty: totalProductionQty },
      purchase: { available: true, items: 1, qty: totalPurchaseQty },
      subcontracting: { available: false, reason: 'Subcontracting is not modelled in this schema yet.' },
      jobwork: { available: false, reason: 'Job Work is not modelled in this schema yet.' },
    },
  };
}

// Mirrors useListForecastPlansQuery's list shape for Generate Order - Forecast.
export const DEMO_FORECAST_PLANS = [
  { id: 1, planNo: 'FP-2026-0001', planName: `${now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}-${now.getFullYear()} Demand Plan` },
];

// Mirrors useGetForecastPlanQuery's single-plan shape (with `lines`) for
// Generate Order - Forecast's line table.
export const DEMO_FORECAST_PLAN_DETAIL = {
  id: 1,
  planNo: 'FP-2026-0001',
  planName: DEMO_FORECAST_PLANS[0].planName,
  lines: [
    { id: 1, productCode: 'FG-1001', productName: 'Industrial Gear Assembly', uom: 'PCS', totalForecast: 1610, included: true },
    { id: 2, productCode: 'FG-1002', productName: 'Hydraulic Pump Unit', uom: 'PCS', totalForecast: 485, included: true },
    { id: 3, productCode: 'FG-1003', productName: 'Conveyor Motor Drive', uom: 'PCS', totalForecast: 257, included: true },
  ],
};
