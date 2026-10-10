// Fixed, offline demo data for Production Planning's client-demo mode (see
// ../demoMode.js). Shapes mirror exactly what the real backend returns for
// each resource today, so a demo screen looks and behaves identically to
// the real one — nothing is simplified, only the numbers are fixed.

export const DEMO_PRODUCTS = [
  { productCode: 'FG-1001', productName: 'Industrial Gear Assembly', uom: 'PCS' },
  { productCode: 'FG-1002', productName: 'Hydraulic Pump Unit', uom: 'PCS' },
  { productCode: 'FG-1003', productName: 'Conveyor Motor Drive', uom: 'PCS' },
  { productCode: 'RM-2001', productName: 'Steel Shaft 25mm', uom: 'PCS' },
  { productCode: 'RM-2002', productName: 'Bearing Housing Cast', uom: 'PCS' },
  { productCode: 'RM-2003', productName: 'Copper Winding Coil', uom: 'KG' },
  { productCode: 'RM-2004', productName: 'Gasket Seal Kit', uom: 'SET' },
  { productCode: 'RM-2005', productName: 'Control Circuit Board', uom: 'PCS' },
];

export const DEMO_BRANCHES = [
  { branchName: 'Head Office' },
  { branchName: 'Plant 1 - Hyderabad' },
  { branchName: 'Plant 2 - Chennai' },
];

export const DEMO_WORK_CENTERS = [
  { id: 1, workCenterCode: 'WC-01', name: 'CNC Machining Cell', branch: 'Plant 1 - Hyderabad', capacityPerDay: 16, costPerHour: 850, status: 'Active' },
  { id: 2, workCenterCode: 'WC-02', name: 'Assembly Line A', branch: 'Plant 1 - Hyderabad', capacityPerDay: 24, costPerHour: 600, status: 'Active' },
  { id: 3, workCenterCode: 'WC-03', name: 'Welding Bay', branch: 'Plant 2 - Chennai', capacityPerDay: 12, costPerHour: 720, status: 'Active' },
  { id: 4, workCenterCode: 'WC-04', name: 'Paint & Finishing', branch: 'Plant 2 - Chennai', capacityPerDay: 20, costPerHour: 450, status: 'Active' },
  { id: 5, workCenterCode: 'WC-05', name: 'Quality Test Bench', branch: 'Plant 1 - Hyderabad', capacityPerDay: 30, costPerHour: 380, status: 'Active' },
];

export const DEMO_BOMS = [
  {
    id: 1, bomCode: 'BOM-1001', productCode: 'FG-1001', productName: 'Industrial Gear Assembly', uom: 'PCS',
    version: '1.0', baseQuantity: 1, isDefault: true, status: 'Active', notes: 'Standard production BOM',
    lines: [
      { id: 11, componentProductCode: 'RM-2001', componentProductName: 'Steel Shaft 25mm', uom: 'PCS', quantityPer: 2, scrapPercent: 2 },
      { id: 12, componentProductCode: 'RM-2002', componentProductName: 'Bearing Housing Cast', uom: 'PCS', quantityPer: 4, scrapPercent: 1 },
      { id: 13, componentProductCode: 'RM-2004', componentProductName: 'Gasket Seal Kit', uom: 'SET', quantityPer: 1, scrapPercent: 0 },
    ],
  },
  {
    id: 2, bomCode: 'BOM-1002', productCode: 'FG-1002', productName: 'Hydraulic Pump Unit', uom: 'PCS',
    version: '1.0', baseQuantity: 1, isDefault: true, status: 'Active', notes: '',
    lines: [
      { id: 21, componentProductCode: 'RM-2002', componentProductName: 'Bearing Housing Cast', uom: 'PCS', quantityPer: 1, scrapPercent: 1 },
      { id: 22, componentProductCode: 'RM-2004', componentProductName: 'Gasket Seal Kit', uom: 'SET', quantityPer: 2, scrapPercent: 0 },
    ],
  },
  {
    id: 3, bomCode: 'BOM-1003', productCode: 'FG-1003', productName: 'Conveyor Motor Drive', uom: 'PCS',
    version: '2.0', baseQuantity: 1, isDefault: true, status: 'Active', notes: 'Revised winding spec',
    lines: [
      { id: 31, componentProductCode: 'RM-2003', componentProductName: 'Copper Winding Coil', uom: 'KG', quantityPer: 3.5, scrapPercent: 3 },
      { id: 32, componentProductCode: 'RM-2005', componentProductName: 'Control Circuit Board', uom: 'PCS', quantityPer: 1, scrapPercent: 0 },
    ],
  },
];

export const DEMO_PRODUCT_GROUPS = [
  { id: 1, groupName: 'Mechanical Assemblies', status: 'Active' },
  { id: 2, groupName: 'Electrical Components', status: 'Active' },
];

export const DEMO_CUSTOMERS = [
  { id: 1, name: 'Agni Steel Pvt Ltd' },
  { id: 2, name: 'Bluepeak Manufacturing' },
];

export const DEMO_ITEM_CATEGORIES = ['Finished Goods', 'Raw Materials'];

export const DEMO_WAREHOUSES = [
  { id: 1, warehouseName: 'Main Warehouse' },
  { id: 2, warehouseName: 'WIP Store' },
];

export const DEMO_ROUTINGS = [
  {
    id: 1, routingCode: 'RT-1001', productCode: 'FG-1001', version: '1.0', isDefault: true, status: 'Active',
    operations: [
      { id: 11, operationNo: 10, operationName: 'Machining', workCenterCode: 'WC-01', standardTimeMins: 25 },
      { id: 12, operationNo: 20, operationName: 'Assembly', workCenterCode: 'WC-02', standardTimeMins: 15 },
      { id: 13, operationNo: 30, operationName: 'Quality Check', workCenterCode: 'WC-05', standardTimeMins: 8 },
    ],
  },
  {
    id: 2, routingCode: 'RT-1002', productCode: 'FG-1002', version: '1.0', isDefault: true, status: 'Active',
    operations: [
      { id: 21, operationNo: 10, operationName: 'Assembly', workCenterCode: 'WC-02', standardTimeMins: 20 },
      { id: 22, operationNo: 20, operationName: 'Quality Check', workCenterCode: 'WC-05', standardTimeMins: 10 },
    ],
  },
  {
    id: 3, routingCode: 'RT-1003', productCode: 'FG-1003', version: '2.0', isDefault: true, status: 'Active',
    operations: [
      { id: 31, operationNo: 10, operationName: 'Welding', workCenterCode: 'WC-03', standardTimeMins: 18 },
      { id: 32, operationNo: 20, operationName: 'Paint & Finishing', workCenterCode: 'WC-04', standardTimeMins: 12 },
      { id: 33, operationNo: 30, operationName: 'Quality Check', workCenterCode: 'WC-05', standardTimeMins: 6 },
    ],
  },
];

// Returns the same { bom, routing } shape as the real GET
// /production-planning/mrp-runs/:runId/items/:productCode detail endpoint
// (mrpService.getItemDetail), built from DEMO_BOMS/DEMO_ROUTINGS above —
// used by Generate Order - Manual's item detail side panel in demo mode.
// A raw material (RM-*) is classified "Buy" (it has no BOM of its own in
// this fixture); a finished good (FG-*) with a BOM is classified "Make".
export function getDemoItemDetail(productCode) {
  const bom = DEMO_BOMS.find((b) => b.productCode === productCode && b.isDefault);
  const routing = DEMO_ROUTINGS.find((r) => r.productCode === productCode && r.isDefault);
  return {
    bom: bom ? {
      bomCode: bom.bomCode,
      components: bom.lines.map((l) => ({
        componentProductCode: l.componentProductCode,
        componentProductName: l.componentProductName,
        quantityPer: l.quantityPer,
        type: l.componentProductCode.startsWith('FG-') ? 'Make' : 'Buy',
      })),
    } : null,
    routing: routing ? { operations: routing.operations } : null,
  };
}

// Three Production Orders at different statuses, built on the same
// product/BOM/routing catalog above, for Production Orders / View Order /
// Create Production Order in demo mode. All three screens import this
// exact array (not copies) so a demo "Create Production Order" appends to
// the same in-memory list the other two screens read from.
const poToday = new Date();
function poDaysAgo(n) { return new Date(poToday.getTime() - n * 24 * 60 * 60 * 1000).toISOString(); }
function poDaysFromNow(n) { return new Date(poToday.getTime() + n * 24 * 60 * 60 * 1000).toISOString(); }

export const DEMO_PRODUCTION_ORDERS = [
  {
    id: 1, orderNo: 'PO-2026-0301', productCode: 'FG-1001', productName: 'Industrial Gear Assembly', uom: 'PCS',
    orderQty: 500, status: 'In Progress', isCancelled: false,
    plannedStartDate: poDaysAgo(3), dueDate: poDaysFromNow(4), warehouse: 'Main Warehouse', branch: 'Plant 1 - Hyderabad',
    bom: { bomCode: 'BOM-1001', version: '1.0' }, routing: { routingCode: 'RT-1001', version: '1.0' },
    baseType: null, baseNo: null, notes: 'Priority order for Agni Steel delivery schedule.',
    producedQty: 320, reworkQty: 30, scrapQty: 30,
    // No real costing module exists for Production Orders today, so this
    // block (and the matching ones on the other two demo orders below) is
    // demo-only presentation data for the Product Cost tab, not a mirror
    // of a real API response like the rest of this fixture.
    productCost: {
      standardCostPerUnit: { rawMaterial: 850, consumables: 50, directLabour: 120, machineOverhead: 100, fixedOverhead: 80 },
      actualCostPerUnit: { rawMaterial: 870, consumables: 60, directLabour: 110, machineOverhead: 95, fixedOverhead: 85 },
      costHistory: [
        { id: 1, date: '2026-10-01', producedQty: 100, rawMaterial: 85000, consumables: 5000, directLabour: 12000, machineOverhead: 10000, fixedOverhead: 8000, totalCost: 120000, costPerUnit: 1200.00 },
        { id: 2, date: '2026-10-02', producedQty: 120, rawMaterial: 104000, consumables: 7200, directLabour: 13200, machineOverhead: 11400, fixedOverhead: 10200, totalCost: 146800, costPerUnit: 1223.33 },
        { id: 3, date: '2026-10-03', producedQty: 100, rawMaterial: 87000, consumables: 5800, directLabour: 10800, machineOverhead: 9500, fixedOverhead: 8500, totalCost: 121600, costPerUnit: 1216.00 },
      ],
    },
    // Notes & attachments are not tracked as structured records anywhere in
    // the real schema today (the real order only has a single free-text
    // `notes` string, handled above) -- this richer list is demo-only,
    // static mock content for the Notes & Attachments tab.
    noteEntries: [
      { id: 1, dateTime: '2026-10-01T09:30:00', type: 'General', title: 'Production Start', description: 'Production order released as per plan.', addedBy: 'Kannan P', visibility: 'Internal' },
      { id: 2, dateTime: '2026-10-02T11:15:00', type: 'Production', title: 'Material Issue Note', description: 'Raw material issued partially.', addedBy: 'Dheena S', visibility: 'Internal' },
      { id: 3, dateTime: '2026-10-03T14:20:00', type: 'Quality', title: 'Dimensional Check', description: 'First lot inspected. All dimensions OK.', addedBy: 'Mani', visibility: 'Internal' },
      { id: 4, dateTime: '2026-10-04T10:45:00', type: 'Issue', title: 'Delay Note', description: 'Machine breakdown caused 2 hours delay.', addedBy: 'Arunkumar', visibility: 'Internal' },
    ],
    attachmentEntries: [
      { id: 1, fileName: 'Drawing_FG1001.pdf', fileType: 'PDF', fileSizeKB: 1229, description: 'Component drawing', uploadedBy: 'Kannan P', uploadedOn: '2026-10-01T09:35:00' },
      { id: 2, fileName: 'BOM_FG1001.xlsx', fileType: 'Excel', fileSizeKB: 350, description: 'Approved BOM', uploadedBy: 'Dheena S', uploadedOn: '2026-10-01T09:40:00' },
      { id: 3, fileName: 'Work_Instructions.pdf', fileType: 'PDF', fileSizeKB: 800, description: 'Machining work instruction', uploadedBy: 'Mani', uploadedOn: '2026-10-02T10:20:00' },
      { id: 4, fileName: 'Quality_Checksheet.xlsx', fileType: 'Excel', fileSizeKB: 420, description: 'Inspection checklist', uploadedBy: 'Arunkumar', uploadedOn: '2026-10-03T14:10:00' },
      { id: 5, fileName: 'Photo_Component.jpg', fileType: 'Image', fileSizeKB: 250, description: 'Sample component image', uploadedBy: 'Mani', uploadedOn: '2026-10-04T11:00:00' },
    ],
    components: [
      { id: 11, componentProductCode: 'RM-2001', componentProductName: 'Steel Shaft 25mm', uom: 'PCS', plannedQty: 1000, issuedQty: 600 },
      { id: 12, componentProductCode: 'RM-2002', componentProductName: 'Bearing Housing Cast', uom: 'PCS', plannedQty: 2000, issuedQty: 1200 },
      { id: 13, componentProductCode: 'RM-2004', componentProductName: 'Gasket Seal Kit', uom: 'SET', plannedQty: 500, issuedQty: 500 },
    ],
    operations: [
      { id: 101, operationNo: 10, operationName: 'Machining', workCenterCode: 'WC-01', standardTimeMins: 25, status: 'Completed', goodQty: 320, reworkQty: 20, scrapQty: 10, startDate: poDaysAgo(3), endDate: poDaysAgo(2) },
      { id: 102, operationNo: 20, operationName: 'Assembly', workCenterCode: 'WC-02', standardTimeMins: 15, status: 'In Progress', goodQty: 200, reworkQty: 10, scrapQty: 20, startDate: poDaysAgo(1), endDate: null },
      { id: 103, operationNo: 30, operationName: 'Quality Check', workCenterCode: 'WC-05', standardTimeMins: 8, status: 'Pending', goodQty: 0, reworkQty: 0, scrapQty: 0, startDate: null, endDate: null },
    ],
    statusHistory: [
      { status: 'Planned', changedBy: 'Demo User', changedAt: poDaysAgo(3) },
      { status: 'Released', changedBy: 'Demo User', changedAt: poDaysAgo(2) },
      { status: 'In Progress', changedBy: 'Demo User', changedAt: poDaysAgo(1) },
    ],
    materialIssues: [
      { id: 1, docNo: 'MI-2026-0101', date: poDaysAgo(2), componentProductCode: 'RM-2001', componentProductName: 'Steel Shaft 25mm', qty: 600, store: 'Main Warehouse', issuedBy: 'Demo User', remarks: 'Initial issue' },
      { id: 2, docNo: 'MI-2026-0102', date: poDaysAgo(1), componentProductCode: 'RM-2002', componentProductName: 'Bearing Housing Cast', qty: 1200, store: 'Main Warehouse', issuedBy: 'Demo User', remarks: 'Issued as per plan' },
      { id: 3, docNo: 'MI-2026-0103', date: poDaysAgo(1), componentProductCode: 'RM-2004', componentProductName: 'Gasket Seal Kit', qty: 500, store: 'Main Warehouse', issuedBy: 'Demo User', remarks: 'Full issue' },
    ],
    materialReceipts: [],
    productionExecutionHistory: [
      { id: 1, dateTime: poDaysAgo(2), operationNo: 10, workCenterCode: 'WC-01', goodQty: 320, reworkQty: 20, scrapQty: 10, reportedBy: 'Demo User', remarks: 'Machining batch completed' },
      { id: 2, dateTime: poDaysAgo(1), operationNo: 20, workCenterCode: 'WC-02', goodQty: 200, reworkQty: 10, scrapQty: 20, reportedBy: 'Demo User', remarks: 'Assembly in progress' },
    ],
    createdByName: 'Demo User', createdAt: poDaysAgo(3), updatedAt: poDaysAgo(1),
  },
  {
    id: 2, orderNo: 'PO-2026-0302', productCode: 'FG-1002', productName: 'Hydraulic Pump Unit', uom: 'PCS',
    orderQty: 150, status: 'Planned', isCancelled: false,
    plannedStartDate: poDaysFromNow(2), dueDate: poDaysFromNow(9), warehouse: 'Main Warehouse', branch: 'Plant 1 - Hyderabad',
    bom: { bomCode: 'BOM-1002', version: '1.0' }, routing: { routingCode: 'RT-1002', version: '1.0' },
    baseType: null, baseNo: null, notes: '',
    producedQty: 0, reworkQty: 0, scrapQty: 0,
    productCost: {
      standardCostPerUnit: { rawMaterial: 300, consumables: 20, directLabour: 60, machineOverhead: 40, fixedOverhead: 30 },
      actualCostPerUnit: { rawMaterial: 300, consumables: 20, directLabour: 60, machineOverhead: 40, fixedOverhead: 30 },
      costHistory: [],
    },
    noteEntries: [],
    attachmentEntries: [],
    components: [
      { id: 21, componentProductCode: 'RM-2002', componentProductName: 'Bearing Housing Cast', uom: 'PCS', plannedQty: 150, issuedQty: 0 },
      { id: 22, componentProductCode: 'RM-2004', componentProductName: 'Gasket Seal Kit', uom: 'SET', plannedQty: 300, issuedQty: 0 },
    ],
    operations: [
      { id: 111, operationNo: 10, operationName: 'Assembly', workCenterCode: 'WC-02', standardTimeMins: 20, status: 'Pending', goodQty: 0, reworkQty: 0, scrapQty: 0, startDate: null, endDate: null },
      { id: 112, operationNo: 20, operationName: 'Quality Check', workCenterCode: 'WC-05', standardTimeMins: 10, status: 'Pending', goodQty: 0, reworkQty: 0, scrapQty: 0, startDate: null, endDate: null },
    ],
    statusHistory: [
      { status: 'Planned', changedBy: 'Demo User', changedAt: poDaysAgo(1) },
    ],
    materialIssues: [],
    materialReceipts: [],
    productionExecutionHistory: [],
    createdByName: 'Demo User', createdAt: poDaysAgo(1), updatedAt: poDaysAgo(1),
  },
  {
    id: 3, orderNo: 'PO-2026-0255', productCode: 'FG-1003', productName: 'Conveyor Motor Drive', uom: 'PCS',
    orderQty: 80, status: 'Completed', isCancelled: false,
    plannedStartDate: poDaysAgo(20), dueDate: poDaysAgo(6), warehouse: 'Main Warehouse', branch: 'Plant 2 - Chennai',
    bom: { bomCode: 'BOM-1003', version: '2.0' }, routing: { routingCode: 'RT-1003', version: '2.0' },
    baseType: null, baseNo: null, notes: 'Completed ahead of schedule.',
    producedQty: 80, reworkQty: 0, scrapQty: 0,
    productCost: {
      standardCostPerUnit: { rawMaterial: 1400, consumables: 40, directLabour: 150, machineOverhead: 90, fixedOverhead: 60 },
      actualCostPerUnit: { rawMaterial: 1430, consumables: 42, directLabour: 145, machineOverhead: 88, fixedOverhead: 65 },
      costHistory: [
        { id: 1, date: '2026-09-24', producedQty: 80, rawMaterial: 114400, consumables: 3360, directLabour: 11600, machineOverhead: 7040, fixedOverhead: 5200, totalCost: 141600, costPerUnit: 1770.00 },
      ],
    },
    noteEntries: [
      { id: 1, dateTime: poDaysAgo(6), type: 'General', title: 'Order Completed', description: 'Completed ahead of schedule.', addedBy: 'Demo User', visibility: 'Internal' },
    ],
    attachmentEntries: [
      { id: 1, fileName: 'Completion_Report_PO-2026-0255.pdf', fileType: 'PDF', fileSizeKB: 540, description: 'Final production completion report', uploadedBy: 'Demo User', uploadedOn: poDaysAgo(6) },
    ],
    components: [
      { id: 31, componentProductCode: 'RM-2003', componentProductName: 'Copper Winding Coil', uom: 'KG', plannedQty: 280, issuedQty: 280 },
      { id: 32, componentProductCode: 'RM-2005', componentProductName: 'Control Circuit Board', uom: 'PCS', plannedQty: 80, issuedQty: 80 },
    ],
    operations: [
      { id: 121, operationNo: 10, operationName: 'Welding', workCenterCode: 'WC-03', standardTimeMins: 18, status: 'Completed', goodQty: 80, reworkQty: 0, scrapQty: 0, startDate: poDaysAgo(19), endDate: poDaysAgo(14) },
      { id: 122, operationNo: 20, operationName: 'Paint & Finishing', workCenterCode: 'WC-04', standardTimeMins: 12, status: 'Completed', goodQty: 80, reworkQty: 0, scrapQty: 0, startDate: poDaysAgo(13), endDate: poDaysAgo(9) },
      { id: 123, operationNo: 30, operationName: 'Quality Check', workCenterCode: 'WC-05', standardTimeMins: 6, status: 'Completed', goodQty: 80, reworkQty: 0, scrapQty: 0, startDate: poDaysAgo(8), endDate: poDaysAgo(6) },
    ],
    statusHistory: [
      { status: 'Planned', changedBy: 'Demo User', changedAt: poDaysAgo(20) },
      { status: 'Released', changedBy: 'Demo User', changedAt: poDaysAgo(18) },
      { status: 'In Progress', changedBy: 'Demo User', changedAt: poDaysAgo(10) },
      { status: 'Completed', changedBy: 'Demo User', changedAt: poDaysAgo(6) },
    ],
    materialIssues: [
      { id: 1, docNo: 'MI-2026-0055', date: poDaysAgo(19), componentProductCode: 'RM-2003', componentProductName: 'Copper Winding Coil', qty: 280, store: 'Main Warehouse', issuedBy: 'Demo User', remarks: 'Full issue' },
      { id: 2, docNo: 'MI-2026-0056', date: poDaysAgo(19), componentProductCode: 'RM-2005', componentProductName: 'Control Circuit Board', qty: 80, store: 'Main Warehouse', issuedBy: 'Demo User', remarks: 'Full issue' },
    ],
    materialReceipts: [
      { id: 1, docNo: 'MR-2026-0055', date: poDaysAgo(6), qty: 80, warehouse: 'Main Warehouse', receivedBy: 'Demo User' },
    ],
    productionExecutionHistory: [
      { id: 1, dateTime: poDaysAgo(14), operationNo: 10, workCenterCode: 'WC-03', goodQty: 80, reworkQty: 0, scrapQty: 0, reportedBy: 'Demo User', remarks: 'Welding completed' },
      { id: 2, dateTime: poDaysAgo(9), operationNo: 20, workCenterCode: 'WC-04', goodQty: 80, reworkQty: 0, scrapQty: 0, reportedBy: 'Demo User', remarks: 'Paint & finishing completed' },
      { id: 3, dateTime: poDaysAgo(6), operationNo: 30, workCenterCode: 'WC-05', goodQty: 80, reworkQty: 0, scrapQty: 0, reportedBy: 'Demo User', remarks: 'Final inspection passed' },
    ],
    createdByName: 'Demo User', createdAt: poDaysAgo(20), updatedAt: poDaysAgo(6),
  },
];

// Mirrors useListOpenSalesOrderLinesQuery's shape for Generate Order -
// Sales Order, reusing the same product catalog above.
const soToday = new Date();
function soDaysFromNow(n) { return new Date(soToday.getTime() + n * 24 * 60 * 60 * 1000).toISOString(); }

export const DEMO_OPEN_SALES_ORDER_LINES = [
  { id: 1, orderNo: 'SO-2026-09-001', customer: 'Agni Steel Pvt Ltd', productCode: 'FG-1001', productName: 'Industrial Gear Assembly', uom: 'PCS', openQty: 200, deliveryDate: soDaysFromNow(12) },
  { id: 2, orderNo: 'SO-2026-09-014', customer: 'Bluepeak Manufacturing', productCode: 'FG-1002', productName: 'Hydraulic Pump Unit', uom: 'PCS', openQty: 60, deliveryDate: soDaysFromNow(18) },
];
