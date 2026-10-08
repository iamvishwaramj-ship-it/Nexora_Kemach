// mockdataseed.js — realistic demo/mock data layered on top of seed.js,
// for development and demos. Safe to re-run: each table is only seeded if empty.
// removeseed.js knows how to strip exactly what this script adds.

require('dotenv').config();
const prisma = require('../client');
const { run: seedDepartmentMaster } = require('./seed_department_master');

async function seedIfEmpty(model, rows, label) {
  const count = await model.count();
  if (count > 0) {
    console.log(`Skipping ${label} (already has ${count} row(s))`);
    return;
  }
  await model.createMany({ data: rows });
  console.log(`Seeded ${rows.length} row(s) into ${label}`);
}

async function run() {
  console.log('Seeding mock/demo business data...');

  await seedIfEmpty(prisma.branch, [
    { branchCode: 'HO', branchName: 'Head Office', address: '123, Business Park, Connaught Place, New Delhi', phone: '+91 98765 43210', email: 'ho@abctraders.com', country: 'India', state: 'Delhi', city: 'New Delhi', zipCode: '110001', isDefault: true, status: 'Active' },
    { branchCode: 'MUM', branchName: 'Mumbai Branch', address: 'Office 201, Nariman Point, Mumbai', phone: '+91 91234 56789', email: 'mumbai@abctraders.com', country: 'India', state: 'Maharashtra', city: 'Mumbai', zipCode: '400021', isDefault: false, status: 'Active' },
    { branchCode: 'KOL', branchName: 'Kolkata Branch', address: '190, Park Street, Kolkata', phone: '+91 70345 21098', email: 'kolkata@abctraders.com', country: 'India', state: 'West Bengal', city: 'Kolkata', zipCode: '700016', isDefault: false, status: 'Active' },
  ], 'branches');

  await seedIfEmpty(prisma.financialYear, [
    { financialYearName: '2026-2027', startDate: new Date('2026-04-01'), endDate: new Date('2027-03-31'), status: 'Active' },
    { financialYearName: '2025-2026', startDate: new Date('2025-04-01'), endDate: new Date('2026-03-31'), status: 'Active' },
    { financialYearName: '2024-2025', startDate: new Date('2024-04-01'), endDate: new Date('2025-03-31'), status: 'Active' },
    { financialYearName: '2023-2024', startDate: new Date('2023-04-01'), endDate: new Date('2024-03-31'), status: 'Inactive' },
    { financialYearName: '2022-2023', startDate: new Date('2022-04-01'), endDate: new Date('2023-03-31'), status: 'Inactive' },
  ], 'financial_years');

  await seedIfEmpty(prisma.houseBank, [
    { bankName: 'HDFC Bank Ltd.', accountNumber: '50200012345678', accountName: 'ABC Traders Current A/c', ifscCode: 'HDFC0001234', accountType: 'Current Account', currency: 'INR', openingBalance: 25000, openingDate: new Date('2026-04-01'), status: 'Active' },
    { bankName: 'ICICI Bank Ltd.', accountNumber: '123405001234', accountName: 'ABC Traders Current A/c', ifscCode: 'ICIC0001234', accountType: 'Current Account', currency: 'INR', openingBalance: 10000, openingDate: new Date('2026-04-01'), status: 'Active' },
    { bankName: 'State Bank of India', accountNumber: '00000010234567890', accountName: 'ABC Traders Current A/c', ifscCode: 'SBIN0001234', accountType: 'Current Account', currency: 'INR', openingBalance: 15000, openingDate: new Date('2026-04-01'), status: 'Active' },
    { bankName: 'Axis Bank Ltd.', accountNumber: '918020012345678', accountName: 'ABC Traders Current A/c', ifscCode: 'UTIB0001234', accountType: 'Current Account', currency: 'INR', openingBalance: 5000, openingDate: new Date('2026-04-01'), status: 'Active' },
    { bankName: 'Kotak Mahindra Bank Ltd.', accountNumber: '564785632145', accountName: 'ABC Traders Current A/c', ifscCode: 'KKBK0001234', accountType: 'Current Account', currency: 'INR', openingBalance: 8000, openingDate: new Date('2026-04-01'), status: 'Active' },
  ], 'house_banks');

  // Department Master seeded first — Sales Employee's rows below point
  // department_id at the 'Sales' row it creates.
  await seedDepartmentMaster();
  const salesDept = await prisma.departmentMaster.findFirst({ where: { name: 'Sales' } });

  await seedIfEmpty(prisma.salesEmployee, [
    { employeeCode: 'SE001', employeeName: 'Rahul Sharma', email: 'rahul.sharma@nexora.com', phoneNumber: '9876543210', departmentId: salesDept?.id ?? null, dateOfJoining: new Date('2025-01-01'), address: 'Delhi, India', status: 'Active' },
    { employeeCode: 'SE002', employeeName: 'Priya Mehta', email: 'priya.mehta@nexora.com', phoneNumber: '9876543211', departmentId: salesDept?.id ?? null, dateOfJoining: new Date('2025-01-15'), address: 'Delhi, India', status: 'Active' },
    { employeeCode: 'SE003', employeeName: 'Amit Verma', email: 'amit.verma@nexora.com', phoneNumber: '9876543212', departmentId: salesDept?.id ?? null, dateOfJoining: new Date('2025-02-01'), address: 'Delhi, India', status: 'Active' },
    { employeeCode: 'SE004', employeeName: 'Neha Kapoor', email: 'neha.kapoor@nexora.com', phoneNumber: '9876543213', departmentId: salesDept?.id ?? null, dateOfJoining: new Date('2025-02-10'), address: 'Delhi, India', status: 'Active' },
    { employeeCode: 'SE005', employeeName: 'Vikram Singh', email: 'vikram.singh@nexora.com', phoneNumber: '9876543214', departmentId: salesDept?.id ?? null, dateOfJoining: new Date('2025-02-20'), address: 'Delhi, India', status: 'Active' },
  ], 'sales_employees');

  // Approval flows + levels (parent/child — created row by row, not createMany)
  const approvalCount = await prisma.approvalFlow.count();
  if (approvalCount > 0) {
    console.log('Skipping approval_flows (already has data)');
  } else {
    const transactionsToSeed = [
      { name: 'Purchase Quotation', levels: [
        { name: 'Level 1', approver: 'Manager', from: 0, to: 10000 },
        { name: 'Level 2', approver: 'General Manager', from: 10000.01, to: 50000 },
        { name: 'Level 3', approver: 'Director', from: 50000.01, to: null },
      ]},
      { name: 'Purchase Order', levels: [
        { name: 'Level 1', approver: 'Manager', from: 0, to: 10000 },
        { name: 'Level 2', approver: 'General Manager', from: 10000.01, to: 50000 },
        { name: 'Level 3', approver: 'Director', from: 50000.01, to: null },
      ]},
      { name: 'Purchase GRN', levels: [
        { name: 'Level 1', approver: 'Manager', from: 0, to: 10000 },
        { name: 'Level 2', approver: 'General Manager', from: 10000.01, to: null },
      ]},
      { name: 'Purchase Invoice', levels: [
        { name: 'Level 1', approver: 'Manager', from: 0, to: 10000 },
        { name: 'Level 2', approver: 'General Manager', from: 10000.01, to: 50000 },
        { name: 'Level 3', approver: 'Director', from: 50000.01, to: null },
      ]},
      { name: 'Sales Quotation', levels: [
        { name: 'Level 1', approver: 'Manager', from: 0, to: 10000 },
        { name: 'Level 2', approver: 'General Manager', from: 10000.01, to: null },
      ]},
      { name: 'Sales Order', levels: [{ name: 'Level 1', approver: 'Manager', from: 0, to: null }] },
      { name: 'Delivery Challan', levels: [{ name: 'Level 1', approver: 'Manager', from: 0, to: null }] },
      { name: 'Sales Invoice', levels: [{ name: 'Level 1', approver: 'Manager', from: 0, to: null }] },
      { name: 'Stock Receipt', levels: [{ name: 'Level 1', approver: 'Manager', from: 0, to: null }] },
      { name: 'Stock Issue', levels: [{ name: 'Level 1', approver: 'Manager', from: 0, to: null }] },
      { name: 'Stock Adjustment', levels: [{ name: 'Level 1', approver: 'Manager', from: 0, to: null }] },
      { name: 'Collection Entry', levels: [{ name: 'Level 1', approver: 'Manager', from: 0, to: null }] },
      { name: 'Payment Entry', levels: [{ name: 'Level 1', approver: 'Manager', from: 0, to: null }] },
    ];
    for (const t of transactionsToSeed) {
      const flow = await prisma.approvalFlow.create({
        data: { transactionName: t.name, approvalType: 'Amount Based', appliedFor: 'All Branches', status: 'Active' },
      });
      await prisma.approvalFlowLevel.createMany({
        data: t.levels.map((l, i) => ({
          approvalFlowId: flow.id,
          levelName: l.name,
          approverType: 'User',
          approver: l.approver,
          fromAmount: l.from,
          toAmount: l.to,
          requiredAction: 'Approve',
          levelOrder: i + 1,
        })),
      });
    }
    console.log('Seeded approval_flows + approval_flow_levels');
  }

  await seedIfEmpty(prisma.productGroup, [
    { groupCode: 'PG001', groupName: 'Computer Accessories', description: 'All types of computer accessories', status: 'Active' },
    { groupCode: 'PG002', groupName: 'Monitors', description: 'LED, LCD, and other monitors', status: 'Active' },
    { groupCode: 'PG003', groupName: 'Storage Devices', description: 'Hard Drives, SSD, Pen Drives, etc.', status: 'Active' },
    { groupCode: 'PG004', groupName: 'Networking', description: 'Routers, Switches, Modems, etc.', status: 'Active' },
    { groupCode: 'PG005', groupName: 'Printers & Scanners', description: 'Printers, Scanners and accessories', status: 'Active' },
    { groupCode: 'PG006', groupName: 'Software', description: 'System and application software', status: 'Active' },
    { groupCode: 'PG007', groupName: 'Office Furniture', description: 'Chairs, Desks, Tables, Cabinets, etc.', status: 'Active' },
    { groupCode: 'PG008', groupName: 'Mobile Accessories', description: 'Cables, Chargers, Cases, etc.', status: 'Active' },
    { groupCode: 'PG009', groupName: 'CCTV & Security', description: 'CCTV Cameras, DVR, Accessories', status: 'Active' },
    { groupCode: 'PG010', groupName: 'Consumables', description: 'Toners, Cartridges, Papers, etc.', status: 'Active' },
  ], 'product_groups');

  const subGroupCount = await prisma.productSubGroup.count();
  if (subGroupCount > 0) {
    console.log('Skipping product_sub_groups (already has data)');
  } else {
    const groups = await prisma.productGroup.findMany();
    const groupByCode = Object.fromEntries(groups.map((g) => [g.groupCode, g]));
    const subGroups = [
      ['PSG001', 'Keyboards', 'PG001', 'Computer Accessories', 'All types of keyboards'],
      ['PSG002', 'Mice', 'PG001', 'Computer Accessories', 'Wired, wireless and gaming mice'],
      ['PSG003', 'USB Hubs', 'PG001', 'Computer Accessories', 'USB hubs and docking stations'],
      ['PSG004', 'LED Monitors', 'PG002', 'Monitors', 'LED backlit monitors'],
      ['PSG005', 'LCD Monitors', 'PG002', 'Monitors', 'LCD monitors'],
      ['PSG006', 'Hard Drives', 'PG003', 'Storage Devices', 'Internal and external hard drives'],
      ['PSG007', 'Pen Drives', 'PG003', 'Storage Devices', 'USB flash drives'],
      ['PSG008', 'Routers', 'PG004', 'Networking', 'WiFi routers'],
      ['PSG009', 'Switches', 'PG004', 'Networking', 'Network switches'],
      ['PSG010', 'Modems', 'PG004', 'Networking', 'Internet modems'],
    ];
    await prisma.productSubGroup.createMany({
      data: subGroups.map(([subGroupCode, subGroupName, groupCode, groupName, description]) => ({
        subGroupCode, subGroupName, groupId: groupByCode[groupCode]?.id, groupName, description, status: 'Active',
      })),
    });
    console.log('Seeded product_sub_groups');
  }

  await seedIfEmpty(prisma.brand, [
    { brandCode: 'BR001', brandName: 'Logitech', description: 'Logitech computer peripherals and accessories', status: 'Active' },
    { brandCode: 'BR002', brandName: 'Dell', description: 'Dell computers, laptops and accessories', status: 'Active' },
    { brandCode: 'BR003', brandName: 'HP', description: 'HP computers and printing solutions', status: 'Active' },
    { brandCode: 'BR004', brandName: 'Canon', description: 'Canon printers, scanners and cameras', status: 'Active' },
    { brandCode: 'BR005', brandName: 'Epson', description: 'Epson printers and imaging products', status: 'Active' },
    { brandCode: 'BR006', brandName: 'Samsung', description: 'Samsung monitors, storage and accessories', status: 'Active' },
    { brandCode: 'BR007', brandName: 'Zebronics', description: 'Zebronics IT peripherals and accessories', status: 'Active' },
    { brandCode: 'BR008', brandName: 'Kingston', description: 'Kingston memory and storage products', status: 'Active' },
    { brandCode: 'BR009', brandName: 'Transcend', description: 'Transcend storage and memory solutions', status: 'Active' },
    { brandCode: 'BR010', brandName: 'Asus', description: 'Asus laptops, components and accessories', status: 'Active' },
  ], 'brands');

  // Customer Master / Supplier Master are retired — both are now Business
  // Partner rows (partnerType 'Customer' / 'Vendor'). Business Partner has no
  // top-level city/state (those live per-address on BusinessPartnerAddress,
  // not seeded here), so that part of the old mock rows is dropped rather
  // than carried over — same "keep only the common fields" call made for the
  // rest of this retirement.
  await seedIfEmpty(prisma.businessPartner, [
    { partnerCode: 'CUS001', partnerName: 'Walk-In Customer', partnerType: 'Customer', creditLimit: 0, outstandingBalance: 0, status: 'Active' },
    { partnerCode: 'CUS002', partnerName: 'Galaxy Retailers', partnerType: 'Customer', mobile: '+91 98765 12345', email: 'galaxy@gmail.com', creditLimit: 50000, outstandingBalance: 0, status: 'Active' },
    { partnerCode: 'CUS003', partnerName: 'TechPoint Solutions', partnerType: 'Customer', mobile: '+91 87654 23456', email: 'tech@techpoint.com', creditLimit: 100000, outstandingBalance: 32400, status: 'Active' },
    { partnerCode: 'CUS004', partnerName: 'Prime Distribution', partnerType: 'Customer', mobile: '+91 76543 34567', email: 'prime@dist.com', creditLimit: 150000, outstandingBalance: 54200, status: 'Active' },
    { partnerCode: 'CUS005', partnerName: 'Star Enterprises', partnerType: 'Customer', mobile: '+91 65432 45678', email: 'star@enterprise.com', creditLimit: 80000, outstandingBalance: 0, status: 'Active' },
    { partnerCode: 'CUS006', partnerName: 'Value Point', partnerType: 'Customer', mobile: '+91 54321 56789', email: 'value@point.com', creditLimit: 40000, outstandingBalance: 0, status: 'Active' },
    { partnerCode: 'CUS007', partnerName: 'City Technologies Ltd.', partnerType: 'Customer', mobile: '+91 43210 67890', email: 'city@tech.com', creditLimit: 120000, outstandingBalance: 0, status: 'Active' },
    { partnerCode: 'CUS008', partnerName: 'Corporate Customer', partnerType: 'Customer', mobile: '+91 32109 78901', email: 'corp@customer.com', creditLimit: 60000, outstandingBalance: 0, status: 'Active' },
    { partnerCode: 'CUS009', partnerName: 'Apex Solutions Ltd.', partnerType: 'Customer', mobile: '+91 90011 22334', email: 'contact@apexsolutions.com', creditLimit: 100000, outstandingBalance: 45000, status: 'Active' },
    { partnerCode: 'CUS010', partnerName: 'Global Tech Corp.', partnerType: 'Customer', mobile: '+91 90022 33445', email: 'info@globaltech.com', creditLimit: 90000, outstandingBalance: 78000, status: 'Active' },
    { partnerCode: 'CUS011', partnerName: 'Sunrise Enterprises', partnerType: 'Customer', mobile: '+91 90033 44556', email: 'sunrise@enterprise.com', creditLimit: 70000, outstandingBalance: 12000, status: 'Active' },
    { partnerCode: 'CUS012', partnerName: 'Rollbridge India Pvt. Ltd.', partnerType: 'Customer', mobile: '+91 90044 55667', email: 'info@rollbridge.com', creditLimit: 130000, outstandingBalance: 0, status: 'Active' },
    { partnerCode: 'CUS013', partnerName: 'ABC Commodities', partnerType: 'Customer', mobile: '+91 90055 66778', email: 'sales@abccommodities.com', creditLimit: 50000, outstandingBalance: 0, status: 'Active' },
    { partnerCode: 'CUS014', partnerName: 'Canningbay Infosys Ltd.', partnerType: 'Customer', mobile: '+91 90066 77889', email: 'contact@canningbay.com', creditLimit: 85000, outstandingBalance: 0, status: 'Active' },
    { partnerCode: 'CUS015', partnerName: 'Rajat Priya Pvt. Ltd.', partnerType: 'Customer', mobile: '+91 90077 88990', email: 'info@rajatpriya.com', creditLimit: 45000, outstandingBalance: 0, status: 'Active' },
    { partnerCode: 'CUS016', partnerName: 'Agner Micro India Pvt. Ltd.', partnerType: 'Customer', mobile: '+91 90088 99001', email: 'contact@agnermicro.com', creditLimit: 55000, outstandingBalance: 0, status: 'Active' },
    { partnerCode: 'SUP001', partnerName: 'Dell India Pvt. Ltd.', partnerType: 'Vendor', mobile: '+91 80 1234 5678', email: 'dell@dellsupply.com', paymentTerms: '30 Days', outstandingBalance: 0, status: 'Active' },
    { partnerCode: 'SUP002', partnerName: 'HP India Pvt. Ltd.', partnerType: 'Vendor', mobile: '+91 80 2345 6789', email: 'hp@hpsupply.com', paymentTerms: '30 Days', outstandingBalance: 95730, status: 'Active' },
    { partnerCode: 'SUP003', partnerName: 'Logitech India', partnerType: 'Vendor', mobile: '+91 80 3456 7890', email: 'logi@logisupply.com', paymentTerms: '15 Days', outstandingBalance: 14210, status: 'Active' },
    { partnerCode: 'SUP004', partnerName: 'Global Supplies Pvt. Ltd.', partnerType: 'Vendor', mobile: '+91 80 4567 8901', email: 'global@supplies.com', paymentTerms: '45 Days', outstandingBalance: 0, status: 'Active' },
    { partnerCode: 'SUP005', partnerName: 'Raphycel Infotech Pvt. Ltd.', partnerType: 'Vendor', mobile: '+91 80 5678 9012', email: 'raph@infotech.com', paymentTerms: '30 Days', outstandingBalance: 0, status: 'Active' },
  ], 'business partners');

  await seedIfEmpty(prisma.product, [
    { productCode: 'P10001', productName: 'Dell Optical Mouse', barcode: '9786450012345', productGroup: 'Computer Accessories', productSubGroup: 'Mice', brand: 'Dell', uom: 'PCS', salesUom: 'PCS', hsnCode: '84716060', costPrice: 320, openingStock: 50, reorderLevel: 10, expiryApplicable: false, defaultSupplier: 'Dell India Pvt. Ltd.', defaultLocation: 'Main Warehouse', rackNo: 'A1', description: 'Standard USB optical mouse', status: 'Active' },
    { productCode: 'P10002', productName: 'Logitech Wireless Mouse M235', barcode: '9786450012346', productGroup: 'Computer Accessories', productSubGroup: 'Mice', brand: 'Logitech', uom: 'PCS', salesUom: 'PCS', hsnCode: '84716060', costPrice: 650, openingStock: 40, reorderLevel: 10, expiryApplicable: false, defaultSupplier: 'Logitech India', defaultLocation: 'Main Warehouse', rackNo: 'A2', description: 'Wireless mouse with USB receiver', status: 'Active' },
    { productCode: 'P10003', productName: 'HP Wired USB Keyboard', barcode: '9786450012347', productGroup: 'Computer Accessories', productSubGroup: 'Keyboards', brand: 'HP', uom: 'PCS', salesUom: 'PCS', hsnCode: '84716060', costPrice: 480, openingStock: 35, reorderLevel: 10, expiryApplicable: false, defaultSupplier: 'HP India Pvt. Ltd.', defaultLocation: 'Main Warehouse', rackNo: 'A3', description: 'Standard wired keyboard', status: 'Active' },
    { productCode: 'P10004', productName: 'Zebronics Multimedia Keyboard', barcode: '9786450012348', productGroup: 'Computer Accessories', productSubGroup: 'Keyboards', brand: 'Zebronics', uom: 'PCS', salesUom: 'PCS', hsnCode: '84716060', costPrice: 350, openingStock: 45, reorderLevel: 10, expiryApplicable: false, defaultSupplier: 'Global Supplies Pvt. Ltd.', defaultLocation: 'Main Warehouse', rackNo: 'A4', description: 'Multimedia keyboard with hotkeys', status: 'Active' },
    { productCode: 'P10005', productName: 'Kingston 32GB USB Pen Drive', barcode: '9786450012349', productGroup: 'Storage Devices', productSubGroup: 'Pen Drives', brand: 'Kingston', uom: 'PCS', salesUom: 'PCS', hsnCode: '85235100', costPrice: 280, openingStock: 80, reorderLevel: 20, expiryApplicable: false, defaultSupplier: 'Global Supplies Pvt. Ltd.', defaultLocation: 'Branch Warehouse', rackNo: 'B1', description: '32GB USB 3.0 flash drive', status: 'Active' },
    { productCode: 'P10006', productName: 'Transcend 1TB External Hard Drive', barcode: '9786450012350', productGroup: 'Storage Devices', productSubGroup: 'Hard Drives', brand: 'Transcend', uom: 'PCS', salesUom: 'PCS', hsnCode: '84717020', costPrice: 3200, openingStock: 25, reorderLevel: 5, expiryApplicable: false, defaultSupplier: 'Global Supplies Pvt. Ltd.', defaultLocation: 'Branch Warehouse', rackNo: 'B2', description: 'Portable external HDD', status: 'Active' },
    { productCode: 'P10007', productName: 'Samsung 24" LED Monitor', barcode: '9786450012351', productGroup: 'Monitors', productSubGroup: 'LED Monitors', brand: 'Samsung', uom: 'PCS', salesUom: 'PCS', hsnCode: '85285900', costPrice: 7800, openingStock: 15, reorderLevel: 5, expiryApplicable: false, defaultSupplier: 'Raphycel Infotech Pvt. Ltd.', defaultLocation: 'Main Warehouse', rackNo: 'C1', description: '24 inch Full HD LED monitor', status: 'Active' },
    { productCode: 'P10008', productName: 'Asus 21.5" LED Monitor', barcode: '9786450012352', productGroup: 'Monitors', productSubGroup: 'LED Monitors', brand: 'Asus', uom: 'PCS', salesUom: 'PCS', hsnCode: '85285900', costPrice: 6900, openingStock: 18, reorderLevel: 5, expiryApplicable: false, defaultSupplier: 'Raphycel Infotech Pvt. Ltd.', defaultLocation: 'Main Warehouse', rackNo: 'C2', description: '21.5 inch Full HD LED monitor', status: 'Active' },
    { productCode: 'P10009', productName: 'TP-Link Wireless Router', barcode: '9786450012353', productGroup: 'Networking', productSubGroup: 'Routers', brand: 'TP-Link', uom: 'PCS', salesUom: 'PCS', hsnCode: '85176290', costPrice: 1450, openingStock: 22, reorderLevel: 5, expiryApplicable: false, defaultSupplier: 'Global Supplies Pvt. Ltd.', defaultLocation: 'Branch Warehouse', rackNo: 'D1', description: 'Dual-band wireless router', status: 'Active' },
    { productCode: 'P10010', productName: 'Canon PIXMA Inkjet Printer', barcode: '9786450012354', productGroup: 'Printers & Scanners', brand: 'Canon', uom: 'PCS', salesUom: 'PCS', hsnCode: '84433100', costPrice: 5200, openingStock: 12, reorderLevel: 4, expiryApplicable: false, defaultSupplier: 'HP India Pvt. Ltd.', defaultLocation: 'Main Warehouse', rackNo: 'E1', description: 'All-in-one inkjet printer', status: 'Active' },
    { productCode: 'P10011', productName: 'Epson L3210 Ink Tank Printer', barcode: '9786450012355', productGroup: 'Printers & Scanners', brand: 'Epson', uom: 'PCS', salesUom: 'PCS', hsnCode: '84433100', costPrice: 11500, openingStock: 8, reorderLevel: 3, expiryApplicable: false, defaultSupplier: 'Raphycel Infotech Pvt. Ltd.', defaultLocation: 'Main Warehouse', rackNo: 'E2', description: 'Ink tank all-in-one printer', status: 'Active' },
    { productCode: 'P10012', productName: 'HDMI Cable 1.5 Meter', barcode: '9786450012356', productGroup: 'Computer Accessories', productSubGroup: 'USB Hubs', brand: 'Generic', uom: 'PCS', salesUom: 'PCS', hsnCode: '85444220', costPrice: 90, openingStock: 100, reorderLevel: 30, expiryApplicable: false, defaultSupplier: 'Global Supplies Pvt. Ltd.', defaultLocation: 'Branch Warehouse', rackNo: 'F1', description: 'High-speed HDMI cable', status: 'Active' },
  ], 'products');

  await seedIfEmpty(prisma.purchaseQuotation, [
    { quotationNo: 'PQ/2025/1001', supplier: 'Dell India Pvt. Ltd.', date: new Date('2024-05-01'), expiryDate: new Date('2024-06-01'), amount: 45130.0, status: 'Converted', referenceNo: 'PO/2025/1001' },
    { quotationNo: 'PQ/2025/1002', supplier: 'HP India Pvt. Ltd.', date: new Date('2024-05-05'), expiryDate: new Date('2024-06-05'), amount: 20305.0, status: 'Open' },
    { quotationNo: 'PQ/2025/1003', supplier: 'Logitech India', date: new Date('2024-05-12'), expiryDate: new Date('2024-06-12'), amount: 34210.0, status: 'Open' },
    { quotationNo: 'PQ/2025/1004', supplier: 'Global Supplies Pvt. Ltd.', date: new Date('2024-05-17'), expiryDate: new Date('2024-06-17'), amount: 55400.0, status: 'Expired' },
    { quotationNo: 'PQ/2025/1005', supplier: 'Raphycel Infotech Pvt. Ltd.', date: new Date('2024-05-21'), expiryDate: new Date('2024-06-21'), amount: 29750.0, status: 'Converted', referenceNo: 'PO/2025/1004' },
  ], 'purchase_quotations');

  await seedIfEmpty(prisma.purchaseOrder, [
    { poNo: 'PO/2025/1001', supplier: 'Dell India Pvt. Ltd.', poDate: new Date('2024-05-01'), deliveryDate: new Date('2024-05-15'), amount: 45130.0, status: 'Received', referenceNo: 'PQ/2025/1001' },
    { poNo: 'PO/2025/1002', supplier: 'HP India Pvt. Ltd.', poDate: new Date('2024-05-08'), deliveryDate: new Date('2024-05-22'), amount: 67230.0, status: 'Partial' },
    { poNo: 'PO/2025/1003', supplier: 'Logitech India', poDate: new Date('2024-05-12'), deliveryDate: new Date('2024-05-26'), amount: 34210.0, status: 'Open' },
    { poNo: 'PO/2025/1004', supplier: 'Raphycel Infotech Pvt. Ltd.', poDate: new Date('2024-05-17'), deliveryDate: new Date('2024-05-31'), amount: 29750.0, status: 'Received', referenceNo: 'PQ/2025/1005' },
  ], 'purchase_orders');

  await seedIfEmpty(prisma.goodsReceivedNote, [
    { grnNo: 'GRN/2025/1001', poNo: 'PO/2025/1001', supplier: 'Dell India Pvt. Ltd.', receivedDate: new Date('2024-05-15'), amount: 45130.0, status: 'Posted' },
    { grnNo: 'GRN/2025/1002', poNo: 'PO/2025/1003', supplier: 'Logitech India', receivedDate: new Date('2024-05-28'), amount: 34210.0, status: 'Draft' },
    { grnNo: 'GRN/2025/1003', poNo: 'PO/2025/1004', supplier: 'Raphycel Infotech Pvt. Ltd.', receivedDate: new Date('2024-06-02'), amount: 29750.0, status: 'Posted' },
  ], 'goods_received_notes');

  await seedIfEmpty(prisma.purchaseInvoice, [
    { invoiceNo: 'PI/2025/1001', supplier: 'Dell India Pvt. Ltd.', invoiceDate: new Date('2024-05-18'), grnNo: 'GRN/2025/1001', poNo: 'PO/2025/1001', dueDate: new Date('2024-06-17'), amount: 45130.0, status: 'Posted', paymentStatus: 'Paid' },
    { invoiceNo: 'PI/2025/1002', supplier: 'HP India Pvt. Ltd.', invoiceDate: new Date('2024-05-25'), poNo: 'PO/2025/1002', dueDate: new Date('2024-06-24'), amount: 67230.0, status: 'Posted', paymentStatus: 'Unpaid' },
    { invoiceNo: 'PI/2025/1003', supplier: 'Logitech India', invoiceDate: new Date('2024-06-02'), grnNo: 'GRN/2025/1002', poNo: 'PO/2025/1003', dueDate: new Date('2024-07-01'), amount: 34210.0, status: 'Posted', paymentStatus: 'Partially Paid' },
    { invoiceNo: 'PI/2025/1004', supplier: 'HP India Pvt. Ltd.', invoiceDate: new Date('2024-04-10'), dueDate: new Date('2024-05-10'), amount: 28500.0, status: 'Draft', paymentStatus: 'Unpaid' },
  ], 'purchase_invoices');

  await seedIfEmpty(prisma.purchasePrice, [
    { supplier: 'Dell India Pvt. Ltd.', productCode: 'P10001', productName: 'Dell Optical Mouse', uom: 'PCS', currency: 'INR', price: 320.0, effectiveDate: new Date('2026-04-01'), status: 'Active' },
    { supplier: 'Logitech India', productCode: 'P10002', productName: 'Logitech Wireless Mouse M235', uom: 'PCS', currency: 'INR', price: 650.0, effectiveDate: new Date('2026-04-01'), status: 'Active' },
    { supplier: 'HP India Pvt. Ltd.', productCode: 'P10003', productName: 'HP Wired USB Keyboard', uom: 'PCS', currency: 'INR', price: 480.0, effectiveDate: new Date('2026-04-01'), status: 'Active' },
    { supplier: 'Global Supplies Pvt. Ltd.', productCode: 'P10004', productName: 'Zebronics Multimedia Keyboard', uom: 'PCS', currency: 'INR', price: 350.0, effectiveDate: new Date('2026-04-01'), status: 'Active' },
    { supplier: 'Global Supplies Pvt. Ltd.', productCode: 'P10005', productName: 'Kingston 32GB USB Pen Drive', uom: 'PCS', currency: 'INR', price: 280.0, effectiveDate: new Date('2026-04-01'), status: 'Active' },
    { supplier: 'Global Supplies Pvt. Ltd.', productCode: 'P10006', productName: 'Transcend 1TB External Hard Drive', uom: 'PCS', currency: 'INR', price: 3200.0, effectiveDate: new Date('2026-04-01'), status: 'Active' },
    { supplier: 'Raphycel Infotech Pvt. Ltd.', productCode: 'P10007', productName: 'Samsung 24" LED Monitor', uom: 'PCS', currency: 'INR', price: 7800.0, effectiveDate: new Date('2026-04-01'), status: 'Active' },
    { supplier: 'Raphycel Infotech Pvt. Ltd.', productCode: 'P10008', productName: 'Asus 21.5" LED Monitor', uom: 'PCS', currency: 'INR', price: 6900.0, effectiveDate: new Date('2026-04-01'), status: 'Active' },
    { supplier: 'Global Supplies Pvt. Ltd.', productCode: 'P10009', productName: 'TP-Link Wireless Router', uom: 'PCS', currency: 'INR', price: 1450.0, effectiveDate: new Date('2026-04-01'), status: 'Active' },
    { supplier: 'Raphycel Infotech Pvt. Ltd.', productCode: 'P10011', productName: 'Epson L3210 Ink Tank Printer', uom: 'PCS', currency: 'INR', price: 11500.0, effectiveDate: new Date('2026-04-01'), status: 'Active' },
    { supplier: 'Global Supplies Pvt. Ltd.', productCode: 'P10012', productName: 'HDMI Cable 1.5 Meter', uom: 'PCS', currency: 'INR', price: 90.0, effectiveDate: new Date('2026-04-01'), status: 'Active' },
  ], 'purchase_prices');

  await seedIfEmpty(prisma.salesQuotation, [
    { quotationNo: 'SQ/2025/1001', customer: 'Galaxy Retailers', date: new Date('2024-05-01'), expiryDate: new Date('2024-06-01'), amount: 18750.0, status: 'Converted' },
    { quotationNo: 'SQ/2025/1002', customer: 'TechPoint Solutions', date: new Date('2024-05-05'), expiryDate: new Date('2024-06-05'), amount: 32400.0, status: 'Open' },
    { quotationNo: 'SQ/2025/1003', customer: 'Rollbridge India Pvt. Ltd.', date: new Date('2024-05-12'), expiryDate: new Date('2024-06-12'), amount: 54200.0, status: 'Open' },
    { quotationNo: 'SQ/2025/1004', customer: 'Prime Distribution', date: new Date('2024-05-17'), expiryDate: new Date('2024-06-17'), amount: 28900.0, status: 'Expired' },
  ], 'sales_quotations');

  await seedIfEmpty(prisma.salesOrder, [
    { orderNo: 'SO/2025/1001', customer: 'Galaxy Retailers', orderDate: new Date('2024-05-01'), deliveryDate: new Date('2024-05-05'), amount: 18750.0, status: 'Delivered', invoiceNo: 'INV/2025/1001' },
    { orderNo: 'SO/2025/1002', customer: 'TechPoint Solutions', orderDate: new Date('2024-05-03'), deliveryDate: new Date('2024-05-08'), amount: 32400.0, status: 'Processing' },
    { orderNo: 'SO/2025/1003', customer: 'Prime Distribution', orderDate: new Date('2024-05-07'), deliveryDate: new Date('2024-05-12'), amount: 54200.0, status: 'Confirmed' },
    { orderNo: 'SO/2025/1004', customer: 'Star Enterprises', orderDate: new Date('2024-05-11'), deliveryDate: new Date('2024-05-16'), amount: 28900.0, status: 'Delivered', invoiceNo: 'INV/2025/1004' },
  ], 'sales_orders');

  await seedIfEmpty(prisma.deliveryChallan, [
    { challanNo: 'DC/2025/1001', customer: 'ABC Commodities', orderNo: 'SO/2025/1001', challanDate: new Date('2024-05-05'), status: 'Delivered' },
    { challanNo: 'DC/2025/1002', customer: 'Canningbay Infosys Ltd.', orderNo: 'SO/2025/1002', challanDate: new Date('2024-05-08'), status: 'In Transit' },
    { challanNo: 'DC/2025/1003', customer: 'Rajat Priya Pvt. Ltd.', orderNo: 'SO/2025/1003', challanDate: new Date('2024-05-15'), status: 'Delivered' },
    { challanNo: 'DC/2025/1004', customer: 'Agner Micro India Pvt. Ltd.', challanDate: new Date('2024-05-20'), status: 'Draft' },
  ], 'delivery_challans');

  await seedIfEmpty(prisma.salesInvoice, [
    { invoiceNo: 'INV/2025/1001', customer: 'Galaxy Retailers', invoiceDate: new Date('2024-05-05'), dueDate: new Date('2024-06-05'), amount: 18750.0, status: 'Paid' },
    { invoiceNo: 'INV/2025/1002', customer: 'TechPoint Solutions', invoiceDate: new Date('2024-05-08'), dueDate: new Date('2024-06-08'), amount: 32400.0, status: 'Unpaid' },
    { invoiceNo: 'INV/2025/1003', customer: 'Prime Distribution', invoiceDate: new Date('2024-05-12'), dueDate: new Date('2024-06-12'), amount: 54200.0, status: 'Partial' },
    { invoiceNo: 'INV/2025/1004', customer: 'Star Enterprises', invoiceDate: new Date('2024-05-16'), dueDate: new Date('2024-06-16'), amount: 28900.0, status: 'Paid' },
    { invoiceNo: 'INV/2025/1005', customer: 'Walk-In Customer', invoiceDate: new Date('2024-05-20'), dueDate: new Date('2024-05-20'), amount: 2350.0, status: 'Paid' },
  ], 'sales_invoices');

  // NOTE: customer_outstanding is intentionally NOT seeded with standalone
  // demo rows here anymore — it used to seed 5 rows (invoice numbers like
  // SI/2025/1001) that were never linked to any real Sales Invoice, which
  // just showed up as unexplained extra rows on the Customer Outstanding
  // pages. Real Customer Outstanding rows are created automatically by
  // syncCustomerOutstanding() in resources.js whenever a Sales Invoice is
  // saved with a non-Draft/Cancelled status — see that function's comment.
  // If a real, pre-existing DB has stray rows left over from the old seed,
  // run `node src/prisma/seed/recomputeOutstanding.js` to prune them.

  // Collection is a master/detail model (see schema.prisma) -- seedIfEmpty
  // only does a createMany-style insert for flat rows, so these are created
  // individually (with their nested invoiceApplications) instead.
  if ((await prisma.collection.count()) === 0) {
    await prisma.collection.create({
      data: {
        collectionNo: 'COL/2025/001', customerName: 'Apex Solutions Ltd.',
        receiptDate: new Date('2024-05-22'), postingDate: new Date('2024-05-22'),
        paymentMode: 'Bank Transfer', depositTo: 'HDFC Bank - 50123456789',
        notes: 'Full settlement against SI/2025/1001', receivedBy: 'Admin',
        paymentCurrency: 'INR', paymentAmount: 45000, paymentDate: new Date('2024-05-22'),
        status: 'Posted', totalAppliedAmount: 45000,
        invoiceApplications: { create: [
          { invoiceNo: 'SI/2025/1001', invoiceDate: new Date('2024-05-02'), dueDate: new Date('2024-06-01'), totalAmount: 55000, outstandingAtTimeOfApplication: 45000, amountApplied: 45000 },
        ] },
      },
    });
    await prisma.collection.create({
      data: {
        collectionNo: 'COL/2025/002', customerName: 'Global Tech Corp.',
        receiptDate: new Date('2024-05-28'), postingDate: new Date('2024-05-28'),
        paymentMode: 'Cheque', depositTo: 'HDFC Bank - 50123456789',
        notes: 'Partial payment received', receivedBy: 'Admin',
        paymentCurrency: 'INR', paymentAmount: 30000, paymentDate: new Date('2024-05-28'),
        status: 'Posted', totalAppliedAmount: 30000,
        invoiceApplications: { create: [
          { invoiceNo: 'SI/2025/1002', invoiceDate: new Date('2024-05-07'), dueDate: new Date('2024-06-06'), totalAmount: 78000, outstandingAtTimeOfApplication: 78000, amountApplied: 30000 },
        ] },
      },
    });
    await prisma.collection.create({
      data: {
        collectionNo: 'COL/2025/003', customerName: 'Sunrise Enterprises',
        receiptDate: new Date('2024-06-01'), postingDate: new Date('2024-06-01'),
        paymentMode: 'UPI', depositTo: 'HDFC Bank - 50123456789',
        notes: 'Partial payment received', receivedBy: 'Admin',
        paymentCurrency: 'INR', paymentAmount: 20000, paymentDate: new Date('2024-06-01'),
        status: 'Posted', totalAppliedAmount: 20000,
        invoiceApplications: { create: [
          { invoiceNo: 'SI/2025/1003', invoiceDate: new Date('2024-05-12'), dueDate: new Date('2024-06-11'), totalAmount: 32000, outstandingAtTimeOfApplication: 12000, amountApplied: 20000 },
        ] },
      },
    });
    console.log('Seeded: collections (master/detail)');
  } else {
    console.log('Skipped: collections (already has data)');
  }

  // Same reasoning as customer_outstanding above — real Supplier Outstanding
  // rows come from syncSupplierOutstanding() in resources.js whenever a
  // Purchase Invoice is saved as Posted. Run recomputeOutstanding.js to
  // prune any stray demo rows left over from the old seed on an existing DB.

  // SupplierPayment is a master/detail model (see schema.prisma) -- same
  // individual-create approach as collections above.
  if ((await prisma.supplierPayment.count()) === 0) {
    await prisma.supplierPayment.create({
      data: {
        paymentNo: 'PAY/2025/001', supplierName: 'Dell India Pvt. Ltd.',
        paymentDate: new Date('2024-05-20'), postingDate: new Date('2024-05-20'),
        paymentMode: 'Bank Transfer', payFromAccount: 'HDFC Bank - 50123456789',
        notes: 'Full payment against PI/2025/1001', paidBy: 'Admin',
        paymentCurrency: 'INR', paymentAmount: 45130, summaryPaymentDate: new Date('2024-05-20'),
        status: 'Posted', totalAppliedAmount: 45130,
        invoiceApplications: { create: [
          { invoiceNo: 'PI/2025/1001', invoiceDate: new Date('2024-05-18'), dueDate: new Date('2024-06-17'), totalAmount: 45130, outstandingAtTimeOfApplication: 45130, amountApplied: 45130 },
        ] },
      },
    });
    await prisma.supplierPayment.create({
      data: {
        paymentNo: 'PAY/2025/002', supplierName: 'HP India Pvt. Ltd.',
        paymentDate: new Date('2024-05-27'), postingDate: new Date('2024-05-27'),
        paymentMode: 'NEFT', payFromAccount: 'HDFC Bank - 50123456789',
        notes: 'Partial payment', paidBy: 'Admin', instrumentNo: 'NEFT123456789',
        paymentCurrency: 'INR', paymentAmount: 30000, summaryPaymentDate: new Date('2024-05-27'),
        status: 'Posted', totalAppliedAmount: 30000,
        invoiceApplications: { create: [
          { invoiceNo: 'PI/2025/1002', invoiceDate: new Date('2024-05-25'), dueDate: new Date('2024-06-24'), totalAmount: 67230, outstandingAtTimeOfApplication: 67230, amountApplied: 30000 },
        ] },
      },
    });
    await prisma.supplierPayment.create({
      data: {
        paymentNo: 'PAY/2025/003', supplierName: 'Logitech India',
        paymentDate: new Date('2024-06-05'), postingDate: new Date('2024-06-05'),
        paymentMode: 'RTGS', payFromAccount: 'HDFC Bank - 50123456789',
        notes: 'Partial payment', paidBy: 'Admin',
        paymentCurrency: 'INR', paymentAmount: 20000, summaryPaymentDate: new Date('2024-06-05'),
        status: 'Posted', totalAppliedAmount: 20000,
        invoiceApplications: { create: [
          { invoiceNo: 'PI/2025/1003', invoiceDate: new Date('2024-06-02'), dueDate: new Date('2024-07-01'), totalAmount: 34210, outstandingAtTimeOfApplication: 32000, amountApplied: 20000 },
        ] },
      },
    });
    console.log('Seeded: supplier_payments (master/detail)');
  } else {
    console.log('Skipped: supplier_payments (already has data)');
  }

  // BankDeposit is a master/detail model (see schema.prisma) -- same
  // individual-create approach as collections/supplier payments above.
  if ((await prisma.bankDeposit.count()) === 0) {
    await prisma.bankDeposit.create({
      data: {
        depositNo: 'DEP/2025/001', depositDate: new Date('2024-05-20'), postingDate: new Date('2024-05-20'),
        depositTo: 'HDFC Bank - 50123456789', depositType: 'Cash',
        remarks: 'Cash deposit from daily collections', status: 'Posted', totalDepositAmount: 75000,
        items: { create: [
          { paymentMode: 'Cash', accountDescription: 'Cash', amount: 75000 },
        ] },
      },
    });
    await prisma.bankDeposit.create({
      data: {
        depositNo: 'DEP/2025/002', depositDate: new Date('2024-05-25'), postingDate: new Date('2024-05-25'),
        depositTo: 'HDFC Bank - 50123456789', depositType: 'Mixed',
        remarks: 'Cheque + transfer deposit - customer collection', status: 'Posted', totalDepositAmount: 120000,
        items: { create: [
          { paymentMode: 'Cheque', instrumentNo: 'CHQ-889021', instrumentDate: new Date('2024-05-24'), accountDescription: 'HDFC Bank - 50123456789', amount: 80000 },
          { paymentMode: 'Bank Transfer', instrumentNo: 'NEFT123456789', instrumentDate: new Date('2024-05-25'), accountDescription: 'HDFC Bank - 50123456789', amount: 40000 },
        ] },
      },
    });
    await prisma.bankDeposit.create({
      data: {
        depositNo: 'DEP/2025/003', depositDate: new Date('2024-06-01'), postingDate: new Date('2024-06-01'),
        depositTo: 'HDFC Bank - 50123456789', depositType: 'Cash',
        remarks: 'Cash deposit', status: 'Draft', totalDepositAmount: 45000,
        items: { create: [
          { paymentMode: 'Cash', accountDescription: 'Cash', amount: 45000 },
        ] },
      },
    });
    console.log('Seeded: bank_deposits (master/detail)');
  } else {
    console.log('Skipped: bank_deposits (already has data)');
  }

  // NOTE: bank_reconciliations is intentionally NOT seeded with a standalone
  // demo record anymore — it used to seed one reconciliation with 6
  // fabricated bank-statement lines and 6 fabricated "System" lines
  // referencing voucher numbers (REC/2026/05/0001 etc) that were never
  // linked to any real Collection/Payment/Deposit/Cheque, which just showed
  // up as unexplained extra rows on the Bank Reconciliation page. Real
  // System Transaction rows are now created automatically by
  // syncBankReconciliationTxn() in resources.js whenever a Bank Deposit/
  // Collection/Supplier Payment is Posted, or a Cheque is Printed — see
  // that function's comment. Bank-statement lines still have to be entered/
  // matched by hand, since this app has no real bank feed to fabricate them
  // from. If a real, pre-existing DB has stray demo rows left over from the
  // old seed, run `node src/prisma/seed/backfillBankReconciliation.js` to
  // prune them and backfill the real System lines.

  await seedIfEmpty(prisma.cheque, [
    { chequeNo: '000001', bankAccount: 'HDFC Bank - 50123456789', payTo: 'Dell India Pvt. Ltd.', chequeType: 'Current Account', printTemplate: 'Standard Cheque', amount: 45130, amountInWords: 'Rupees Forty Five Thousand One Hundred Thirty Only', narration: 'Payment against Invoice PI/2025/1001', chequeDate: new Date('2024-05-20'), status: 'Printed' },
    { chequeNo: '000002', bankAccount: 'HDFC Bank - 50123456789', payTo: 'HP India Pvt. Ltd.', chequeType: 'Current Account', printTemplate: 'Standard Cheque', amount: 67230, amountInWords: 'Rupees Sixty Seven Thousand Two Hundred Thirty Only', narration: 'Payment against Invoice PI/2025/1002', chequeDate: new Date('2024-05-27'), status: 'Pending' },
    { chequeNo: '000003', bankAccount: 'HDFC Bank - 50123456789', payTo: 'Logitech India', chequeType: 'Current Account', printTemplate: 'Standard Cheque', amount: 34210, amountInWords: 'Rupees Thirty Four Thousand Two Hundred Ten Only', narration: 'Payment against Invoice PI/2025/1003', chequeDate: new Date('2024-06-03'), status: 'Printed' },
  ], 'cheques');

  // Stock tables depend on products.id, resolved via product_code lookup
  const stockReceiptCount = await prisma.stockReceipt.count();
  if (stockReceiptCount > 0) {
    console.log('Skipping stock_receipts (already has data)');
  } else {
    const products = await prisma.product.findMany();
    const idByCode = Object.fromEntries(products.map((p) => [p.productCode, p.id]));
    await prisma.stockReceipt.createMany({
      data: [
        { receiptNo: 'SR/2025/0001', productId: idByCode['P10001'], quantity: 50, date: new Date('2026-04-02'), referenceNo: 'PO/2025/1001', notes: 'Opening stock receipt' },
        { receiptNo: 'SR/2025/0002', productId: idByCode['P10005'], quantity: 80, date: new Date('2026-04-05'), referenceNo: 'PO/2025/1004', notes: 'Stock receipt against PO' },
        { receiptNo: 'SR/2025/0003', productId: idByCode['P10007'], quantity: 15, date: new Date('2026-04-10'), referenceNo: 'GRN/2025/1003', notes: 'Received from Raphycel Infotech Pvt. Ltd.' },
      ],
    });
    console.log('Seeded stock_receipts');
  }

  const stockIssueCount = await prisma.stockIssue.count();
  if (stockIssueCount > 0) {
    console.log('Skipping stock_issues (already has data)');
  } else {
    const products = await prisma.product.findMany();
    const idByCode = Object.fromEntries(products.map((p) => [p.productCode, p.id]));
    await prisma.stockIssue.createMany({
      data: [
        { issueNo: 'SI/2025/0001', productId: idByCode['P10002'], quantity: 10, date: new Date('2026-04-15'), referenceNo: 'SO/2025/1001', notes: 'Issued against Sales Order' },
        { issueNo: 'SI/2025/0002', productId: idByCode['P10009'], quantity: 5, date: new Date('2026-04-18'), referenceNo: 'DC/2025/1002', notes: 'Issued for delivery challan' },
      ],
    });
    console.log('Seeded stock_issues');
  }

  const stockAdjustmentCount = await prisma.stockAdjustment.count();
  if (stockAdjustmentCount > 0) {
    console.log('Skipping stock_adjustments (already has data)');
  } else {
    const products = await prisma.product.findMany();
    const idByCode = Object.fromEntries(products.map((p) => [p.productCode, p.id]));
    await prisma.stockAdjustment.createMany({
      data: [
        { adjustmentNo: 'SA/2025/0001', productId: idByCode['P10004'], quantity: -2, adjustmentType: 'Damage', date: new Date('2026-04-20'), reason: 'Damaged during handling' },
        { adjustmentNo: 'SA/2025/0002', productId: idByCode['P10006'], quantity: 3, adjustmentType: 'Stock Found', date: new Date('2026-04-22'), reason: 'Physical count variance - excess found' },
      ],
    });
    console.log('Seeded stock_adjustments');
  }

  console.log('Mock data seeding complete!');
}

run()
  .catch((err) => {
    console.error('Mock data seed error:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
