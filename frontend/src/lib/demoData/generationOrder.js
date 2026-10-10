// Static stand-in for a Generation Order, used only when DEMO_MODE is on
// (see ../demoMode.js). Shaped exactly like the real object returned by
// GET /production-planning/generation-orders/:id, so GenerateOrderMrp.jsx,
// GenerateOrderManual.jsx, GenerateOrderSalesOrder.jsx,
// GenerateOrderForecast.jsx, OrderGenerationOption.jsx and
// GeneratedOrders.jsx can all funnel into this one same record and render
// it with no other code changes beyond skipping the real backend calls
// when demo mode is on. Product codes match ./productionPlanning.js's
// catalog so the numbers look connected across screens. Flip DEMO_MODE
// back to false to go back to the real flow.
export const DEMO_GO_ID = 999999;

const today = new Date();
function daysFromNow(n) {
  return new Date(today.getTime() + n * 24 * 60 * 60 * 1000).toISOString();
}

export const DEMO_GENERATION_ORDER = {
  id: DEMO_GO_ID,
  goNumber: 'GO-DEMO-0001',
  sourceType: 'MRP',
  goDate: today.toISOString(),
  requiredDeliveryDate: daysFromNow(7),
  plant: 'Plant 1 - Hyderabad',
  status: 'Completed',
  lines: [
    {
      id: 1, productCode: 'FG-1001', productName: 'Industrial Gear Assembly', uom: 'PCS',
      requiredQty: 500, orderQty: 500, orderType: 'Production', dueDate: daysFromNow(5),
      vendorCode: null, resultOrderType: 'Production', resultOrderId: 5001, resultOrderNo: 'PO-2026-0501',
    },
    {
      id: 2, productCode: 'FG-1002', productName: 'Hydraulic Pump Unit', uom: 'PCS',
      requiredQty: 150, orderQty: 150, orderType: 'Production', dueDate: daysFromNow(6),
      vendorCode: null, resultOrderType: 'Production', resultOrderId: 5002, resultOrderNo: 'PO-2026-0502',
    },
    {
      id: 3, productCode: 'RM-2003', productName: 'Copper Winding Coil', uom: 'KG',
      requiredQty: 800, orderQty: 800, orderType: 'Purchase', dueDate: daysFromNow(10),
      vendorCode: 'VEN-0012', resultOrderType: 'Purchase', resultOrderId: 7001, resultOrderNo: 'PUR-2026-0701',
    },
  ],
};
