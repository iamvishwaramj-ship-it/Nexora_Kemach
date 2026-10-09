// Single source of truth for the sidebar, breadcrumbs, global search, and the
// card-grid sub-menu pages. Every route entry below MUST correspond to a real
// route in router/AppRouter.jsx. Add a nav entry whenever you add a page.
//
// Shape: { key, labelKey, path, icon, children? }
// - Top-level items with children render as a sidebar link to `path`, which
//   shows a card grid of the children (design-system.md sidebar rule).
// - Leaf items (no children) are the actual pages.

export const navConfig = [
  {
    key: 'dashboard',
    labelKey: 'nav.dashboard',
    path: '/dashboard',
    icon: 'Dashboard',
  },
  {
    key: 'company',
    labelKey: 'nav.company',
    path: '/company',
    icon: 'Business',
    children: [
      { key: 'company-details', labelKey: 'Company Details', path: '/company/details', icon: 'Domain' },
      { key: 'branch', labelKey: 'Branch', path: '/company/branch', icon: 'AccountTree' },
      { key: 'financial-year', labelKey: 'Financial Year', path: '/company/financial-year', icon: 'DateRange' },
      { key: 'document-numbering', labelKey: 'Document Numbering', path: '/company/document-numbering', icon: 'Numbers' },
      { key: 'tax-code', labelKey: 'Tax Code', path: '/company/tax-code', icon: 'Percent' },
      { key: 'bank-details', labelKey: 'Bank Details', path: '/company/bank-details', icon: 'AccountBalance' },
      { key: 'house-bank', labelKey: 'House Bank', path: '/company/house-bank', icon: 'AccountBalanceWallet' },
      { key: 'sales-employee', labelKey: 'Employee Master', path: '/company/sales-employee', icon: 'Badge' },
      { key: 'approval-flow', labelKey: 'Approval Flow', path: '/company/approval-flow', icon: 'Rule' },
      { key: 'department-master', labelKey: 'Department Master', path: '/company/department', icon: 'Apartment' },
      { key: 'location-master', labelKey: 'Location Master', path: '/company/location', icon: 'Place' },
      { key: 'warehouse-master', labelKey: 'Warehouse Master', path: '/company/warehouse', icon: 'Warehouse' },
      { key: 'inventory-opening-balance', labelKey: 'Inventory Opening Balance', path: '/company/opening-balance', icon: 'Balance' },
      { key: 'bp-opening-balance', labelKey: 'BP Opening Balance', path: '/company/bp-opening-balance', icon: 'AccountBalance' },
    ],
  },
  {
    key: 'accounting',
    labelKey: 'nav.accounting',
    path: '/accounting',
    icon: 'Calculate',
    children: [
      { key: 'account-group', labelKey: 'Account Group', path: '/accounting/account-group', icon: 'AccountTreeOutlined' },
      { key: 'account-type', labelKey: 'Account Type', path: '/accounting/account-type', icon: 'Category' },
      { key: 'chart-of-accounts', labelKey: 'Chart Of Accounts', path: '/accounting/chart-of-accounts', icon: 'MenuBook' },
      { key: 'gl-account-determination', labelKey: 'G/L Account Determination', path: '/accounting/gl-account-determination', icon: 'Rule' },
      { key: 'journal-entry', labelKey: 'Journal Entry', path: '/accounting/journal-entry', icon: 'Book' },
    ],
  },
  {
    key: 'product',
    labelKey: 'nav.product',
    path: '/product',
    icon: 'Inventory2',
    children: [
      { key: 'product-master', labelKey: 'Product Master', path: '/product/master', icon: 'Inventory' },
      { key: 'product-group', labelKey: 'Product Group', path: '/product/group', icon: 'Category' },
      { key: 'product-sub-group', labelKey: 'Product Sub-Group', path: '/product/sub-group', icon: 'Layers', hidden: true },
      { key: 'brand', labelKey: 'Brand', path: '/product/brand', icon: 'BrandingWatermark', hidden: true, },
      { key: 'uom', labelKey: 'Unit of Measure', path: '/product/uom', icon: 'Straighten' },
      { key: 'hsn-master', labelKey: 'HSN Master', path: '/product/hsn-master', icon: 'ReceiptLong' },
      { key: 'currency-master', labelKey: 'Currency Master', path: '/product/currency', icon: 'CurrencyExchange' },
      { key: 'barcode', labelKey: 'Barcode', path: '/product/barcode', icon: 'QrCode', hidden: true },
      // { key: 'purchase-price', labelKey: 'Purchase Price', path: '/product/purchase-price', icon: 'PriceChange' },
      // { key: 'sales-price', labelKey: 'Sales Price', path: '/product/sales-price', icon: 'Sell' },
      { key: 'customer-discount', labelKey: 'Customer Discount', path: '/product/customer-discount', icon: 'Discount', hidden: true },
      { key: 'price-list', labelKey: 'Price List', path: '/product/price-list', icon: 'FormatListBulleted' },
    ],
  },
  {
    key: 'partner',
    labelKey: 'nav.partner',
    path: '/partner',
    icon: 'Groups',
    children: [
      { key: 'business-partner', labelKey: 'Business Partner', path: '/partner/business-partner', icon: 'ContactMail' },
      { key: 'transport-master', labelKey: 'Transport Master', path: '/partner/transport', icon: 'DirectionsCar', hidden: true },
    ],
  },
  {
    key: 'purchase',
    labelKey: 'nav.purchase',
    path: '/purchase',
    icon: 'ShoppingCart',
    children: [
      // { key: 'purchase-quotation', labelKey: 'Purchase Quotation', path: '/purchase/quotation', icon: 'RequestQuote' },
      { key: 'purchase-order', labelKey: 'Purchase Order', path: '/purchase/order', icon: 'Assignment' },
      { key: 'purchase-grn', labelKey: 'Purchase GRN', path: '/purchase/grn', icon: 'Inventory' },
      { key: 'purchase-return', labelKey: 'Purchase Return', path: '/purchase/return', icon: 'AssignmentReturn' },
      { key: 'purchase-invoice', labelKey: 'Purchase Invoice', path: '/purchase/invoice', icon: 'Receipt' },
      { key: 'purchase-credit-memo', labelKey: 'Purchase Credit Memo', path: '/purchase/credit-memo', icon: 'ReceiptLong' },
    ],
  },
  {
    key: 'sales',
    labelKey: 'nav.sales',
    path: '/sales',
    icon: 'PointOfSale',
    children: [
      // Hidden from the sidebar and global search — see the `hidden` note
      // on 'receivables' above. Routes/pages are untouched, so a direct
      // URL still works; this only pulls the menu entries off screen.
      { key: 'enquiry', labelKey: 'Enquiry', path: '/sales/enquiry', icon: 'ContactMail', hidden: true },
      { key: 'follow-up', labelKey: 'Follow-up', path: '/sales/follow-up', icon: 'EventRepeat', hidden: true },
      { key: 'sales-quotation', labelKey: 'Sales Quotation', path: '/sales/quotation', icon: 'RequestQuote' },
      { key: 'sales-order', labelKey: 'Sales Order', path: '/sales/order', icon: 'Assignment' },
      { key: 'delivery-challan', labelKey: 'Delivery Challan', path: '/sales/delivery-challan', icon: 'LocalShipping' },
      { key: 'sales-return', labelKey: 'Sales Return', path: '/sales/return', icon: 'AssignmentReturn' },
      { key: 'sales-invoice', labelKey: 'Sales Invoice', path: '/sales/invoice', icon: 'Receipt' },
      { key: 'sales-credit-memo', labelKey: 'Sales Credit Memo', path: '/sales/credit-memo', icon: 'ReceiptLong' },

    ],
  },
  {
    key: 'inventory',
    labelKey: 'nav.inventory',
    path: '/inventory',
    icon: 'Warehouse',
    children: [
      { key: 'stock-receipt', labelKey: 'Stock Receipt', path: '/inventory/stock-receipt', icon: 'MoveToInbox' },
      { key: 'stock-issue', labelKey: 'Stock Issue', path: '/inventory/stock-issue', icon: 'Outbox' },
      { key: 'stock-adjustment', labelKey: 'Stock Adjustment', path: '/inventory/stock-adjustment', icon: 'Tune' },
      {
        key: 'stock-transfer',
        labelKey: 'Stock Transfer',
        path: '/inventory/stock-transfer',
        icon: 'SwapHoriz',
        children: [
          { key: 'stock-transfer-request', labelKey: 'Stock Transfer Request', path: '/inventory/stock-transfer/request', icon: 'Assignment' },
          { key: 'stock-transfer-transfer', labelKey: 'Stock Transfer Issue', path: '/inventory/stock-transfer/transfer', icon: 'SwapHoriz' },
          { key: 'stock-transfer-receipt', labelKey: 'Stock Transfer Receipt', path: '/inventory/stock-transfer/receipt', icon: 'MoveToInbox' },
        ],
      },
    ],
  },
  {
    key: 'receivables',
    labelKey: 'nav.receivables',
    path: '/receivables',
    icon: 'TrendingUp',
    // Hidden from the sidebar, breadcrumbs, and global search for every
    // user (admins included) — see hidden handling in flattenNav() below
    // and visibleNav() in lib/permissions.js. The routes/pages themselves
    // are untouched, so a direct URL still works; this only pulls the menu
    // entry off screen.
    hidden: true,
    children: [
      { key: 'customer-outstanding', labelKey: 'Customer Outstanding', path: '/receivables/outstanding', icon: 'AccountBalance' },
      { key: 'collection-entry', labelKey: 'Collection Entry', path: '/receivables/collection', icon: 'Payments' },
    ],
  },
  {
    key: 'payables',
    labelKey: 'nav.payables',
    path: '/payables',
    icon: 'TrendingDown',
    // See the `hidden` note on 'receivables' above.
    hidden: true,
    children: [
      { key: 'supplier-outstanding', labelKey: 'Supplier Outstanding', path: '/payables/outstanding', icon: 'AccountBalance' },
      { key: 'payment-entry', labelKey: 'Payment Entry', path: '/payables/payment', icon: 'Payments' },
    ],
  },
  {
    key: 'banking',
    labelKey: 'nav.banking',
    path: '/banking',
    icon: 'AccountBalance',
    children: [
      { key: 'deposit-entry', labelKey: 'Deposit Entry', path: '/banking/deposit', icon: 'Savings' },
      { key: 'bank-reconciliation', labelKey: 'Bank Reconciliation', path: '/banking/reconciliation', icon: 'Balance' },
      { key: 'cheque-print', labelKey: 'Cheque Print', path: '/banking/cheque-print', icon: 'Print', hidden: true },
      { key: 'payment-receipt', labelKey: 'Payment Receipt', path: '/banking/payment-receipt', icon: 'ReceiptLong' },
      { key: 'payment-voucher', labelKey: 'Payment Voucher', path: '/banking/payment-voucher', icon: 'Payments' },
    ],
  },
  {
    key: 'production-planning',
    labelKey: 'nav.productionPlanning',
    path: '/production-planning',
    icon: 'Factory',
    children: [
      { key: 'production-planning-forecast', labelKey: 'Forecast', path: '/production-planning/forecast', icon: 'Insights' },
      { key: 'production-planning-dashboard', labelKey: 'Dashboard', path: '/production-planning/dashboard', icon: 'Dashboard' },
      { key: 'production-planning-generate-order-mrp', labelKey: 'Generate Order - MRP', path: '/production-planning/generate-order-mrp', icon: 'Tune' },
      { key: 'production-planning-order-generation-option', labelKey: 'Order Generation Option', path: '/production-planning/order-generation-option', icon: 'Rule' },
      { key: 'production-planning-preview-order', labelKey: 'Preview Order', path: '/production-planning/preview-order', icon: 'Visibility' },
      { key: 'production-planning-generate-order', labelKey: 'Generate Order', path: '/production-planning/generate-order', icon: 'PlaylistAddCheck' },
      { key: 'production-planning-generate-order-manual', labelKey: 'Generate Order - Manual', path: '/production-planning/generate-order-manual', icon: 'EditNote' },
      { key: 'production-planning-generate-order-sales-order', labelKey: 'Generate Order - Sales Order', path: '/production-planning/generate-order-sales-order', icon: 'PointOfSale' },
      { key: 'production-planning-generate-order-forecast', labelKey: 'Generate Order - Forecast', path: '/production-planning/generate-order-forecast', icon: 'TrendingUp' },
      { key: 'production-planning-generate-order-project', labelKey: 'Generate Order - Project', path: '/production-planning/generate-order-project', icon: 'Engineering' },
      { key: 'production-planning-work-centers', labelKey: 'Work Centers', path: '/production-planning/work-centers', icon: 'Build' },
      { key: 'production-planning-bom', labelKey: 'Bill of Materials', path: '/production-planning/bom', icon: 'AccountTree' },
      { key: 'production-planning-routing', labelKey: 'Routing', path: '/production-planning/routing', icon: 'Timeline' },
    ],
  },
  {
    key: 'production-execution',
    labelKey: 'Production Execution',
    path: '/production-execution',
    icon: 'PrecisionManufacturing',
    children: [
      { key: 'production-execution-production-orders', labelKey: 'Production Orders', path: '/production-execution/production-orders', icon: 'Assignment' },
      { key: 'production-execution-view-order', labelKey: 'View Order', path: '/production-execution/view-order', icon: 'Visibility' },
      { key: 'production-execution-operations', labelKey: 'Operations', path: '/production-execution/operations', icon: 'Build' },
      { key: 'production-execution-production-execution', labelKey: 'Production Execution', path: '/production-execution/production-execution-status', icon: 'Engineering' },
      { key: 'production-execution-material-requisition', labelKey: 'Material Requisition', path: '/production-execution/material-requisition', icon: 'Inventory2' },
      { key: 'production-execution-material-issue', labelKey: 'Material Issue', path: '/production-execution/material-issue', icon: 'Outbox' },
      { key: 'production-execution-material-receipt', labelKey: 'Material Receipt', path: '/production-execution/material-receipt', icon: 'MoveToInbox' },
      { key: 'production-execution-create-issue', labelKey: 'Create Issue', path: '/production-execution/create-issue', icon: 'NoteAdd' },
      { key: 'production-execution-record-production', labelKey: 'Record Production', path: '/production-execution/record-production', icon: 'PlaylistAddCheck' },
      { key: 'production-execution-production-history', labelKey: 'Production History', path: '/production-execution/production-history', icon: 'History' },
      { key: 'production-execution-product-cost', labelKey: 'Product Cost', path: '/production-execution/product-cost', icon: 'PriceCheck' },
      { key: 'production-execution-rework-scrap', labelKey: 'Rework & Scrap', path: '/production-execution/rework-scrap', icon: 'Replay' },
      { key: 'production-execution-production-completion', labelKey: 'Production Completion', path: '/production-execution/production-completion', icon: 'TaskAlt' },
      { key: 'production-execution-production-closure', labelKey: 'Production Closure', path: '/production-execution/production-closure', icon: 'DoneAll' },
      { key: 'production-execution-reports', labelKey: 'Reports', path: '/production-execution/reports', icon: 'Assessment' },
      { key: 'production-execution-notes', labelKey: 'Notes', path: '/production-execution/notes', icon: 'EditNote' },
      { key: 'production-execution-create-requisition', labelKey: 'Create Requisition', path: '/production-execution/create-requisition', icon: 'PostAdd' },
      { key: 'production-execution-create-production-order', labelKey: 'Create Production Order', path: '/production-execution/create-production-order', icon: 'NoteAdd' },
    ],
  },
  {
    key: 'reports',
    labelKey: 'nav.reports',
    path: '/reports',
    icon: 'Assessment',
    children: [
      {
        key: 'reports-sales',
        labelKey: 'Sales Reports',
        path: '/reports/sales',
        icon: 'PointOfSale',
        children: [
          // { key: 'reports-sales-enquiry-register', labelKey: 'Enquiry Register', path: '/reports/sales/enquiry-register', icon: 'ListAlt' },
          // { key: 'reports-sales-enquiry-analysis', labelKey: 'Enquiry Analysis', path: '/reports/sales/enquiry-analysis', icon: 'Analytics' },
          { key: 'reports-sales-quotation-register', labelKey: 'Sales Quotation Register', path: '/reports/sales/quotation-register', icon: 'Assignment' },
          { key: 'reports-sales-invoice-register', labelKey: 'Sales Invoice Register', path: '/reports/sales/invoice-register', icon: 'Receipt' },
          { key: 'reports-sales-customer-wise', labelKey: 'Customer-wise Sales', path: '/reports/sales/customer-wise', icon: 'PersonSearch' },
          { key: 'reports-sales-product-wise', labelKey: 'Product-wise Sales', path: '/reports/sales/product-wise', icon: 'BarChart' },
          { key: 'reports-sales-salesman-wise', labelKey: 'Salesman-wise Sales', path: '/reports/sales/salesman-wise', icon: 'Leaderboard' },
          { key: 'reports-sales-pending-order', labelKey: 'Pending Sales Order', path: '/reports/sales/pending-order', icon: 'HourglassBottom' },
          { key: 'reports-sales-profitability', labelKey: 'Profitability Analysis', path: '/reports/sales/profitability', icon: 'TrendingUp' },
          { key: 'reports-sales-customer-ledger', labelKey: 'Customer Ledger', path: '/reports/sales/customer-ledger', icon: 'AccountBalance' },
          { key: 'reports-sales-customer-aging', labelKey: 'Customer Aging Report', path: '/reports/sales/customer-aging', icon: 'HourglassBottom' },
        ],
      },
      {
        key: 'reports-purchase',
        labelKey: 'Purchase Reports',
        path: '/reports/purchase',
        icon: 'ShoppingCart',
        children: [
          { key: 'reports-purchase-order-register', labelKey: 'Purchase Order Register', path: '/reports/purchase/order-register', icon: 'Assignment' },
          { key: 'reports-purchase-invoice-register', labelKey: 'Purchase Invoice Register', path: '/reports/purchase/invoice-register', icon: 'Receipt' },
          { key: 'reports-purchase-vendor-wise', labelKey: 'Vendor-wise Purchase', path: '/reports/purchase/vendor-wise', icon: 'PersonSearch' },
          { key: 'reports-purchase-pending-order', labelKey: 'Pending Purchase Order', path: '/reports/purchase/pending-order', icon: 'HourglassBottom' },
          { key: 'reports-purchase-price-comparison', labelKey: 'Price Comparison', path: '/reports/purchase/price-comparison', icon: 'CompareArrows' },
          { key: 'reports-purchase-price-history', labelKey: 'Price History', path: '/reports/purchase/price-history', icon: 'History' },
        ],
      },
      {
        key: 'reports-inventory',
        labelKey: 'Inventory Reports',
        path: '/reports/inventory',
        icon: 'Warehouse',
        children: [
          { key: 'reports-inventory-stock-summary', labelKey: 'Stock Summary', path: '/reports/inventory/stock-summary', icon: 'Inventory' },
          { key: 'reports-inventory-Available-balance', labelKey: 'Available Balance', path: '/reports/inventory/available-balance', icon: 'Warehouse' },
          { key: 'reports-inventory-stock-valuation', labelKey: 'Stock Valuation', path: '/reports/inventory/stock-valuation', icon: 'PriceCheck' },
          { key: 'reports-inventory-low-stock', labelKey: 'Low Stock Report', path: '/reports/inventory/low-stock', icon: 'WarningAmber' },
          { key: 'reports-inventory-slow-moving', labelKey: 'Slow Moving Stock', path: '/reports/inventory/slow-moving', icon: 'Speed' },
          { key: 'reports-inventory-dead-stock', labelKey: 'Dead Stock', path: '/reports/inventory/dead-stock', icon: 'Block' },
          { key: 'reports-inventory-reorder-level', labelKey: 'Reorder Level', path: '/reports/inventory/reorder-level', icon: 'Replay' },
        ],
      },
      {
        key: 'reports-receivable',
        labelKey: 'Receivable',
        path: '/reports/receivable',
        icon: 'TrendingUp',
        children: [
          { key: 'reports-receivable-customer-outstanding', labelKey: 'Customer Outstanding', path: '/reports/receivable/customer-outstanding', icon: 'AccountBalance' },
          { key: 'reports-receivable-collection-register', labelKey: 'Collection Register', path: '/reports/receivable/collection-register', icon: 'Payments' },
        ],
      },
      {
        key: 'reports-payable',
        labelKey: 'Payable',
        path: '/reports/payable',
        icon: 'TrendingDown',
        children: [
          { key: 'reports-payable-supplier-outstanding', labelKey: 'Supplier Outstanding', path: '/reports/payable/supplier-outstanding', icon: 'AccountBalance' },
          { key: 'reports-payable-payment-register', labelKey: 'Payment Register', path: '/reports/payable/payment-register', icon: 'Payments' },
        ],
      },
      {
        key: 'reports-cash-bank',
        labelKey: 'Cash / Bank Position',
        path: '/reports/cash-bank',
        icon: 'AccountBalance',
        children: [
          { key: 'reports-cash-bank-cash-book', labelKey: 'Cash Book', path: '/reports/cash-bank/cash-book', icon: 'Book' },
          { key: 'reports-cash-bank-day-book', labelKey: 'Day Book', path: '/reports/cash-bank/day-book', icon: 'Today' },
          { key: 'reports-cash-bank-bank-book', labelKey: 'Bank Book', path: '/reports/cash-bank/bank-book', icon: 'AccountBalanceWallet' },
          { key: 'reports-cash-bank-deposit-register', labelKey: 'Deposit Register', path: '/reports/cash-bank/deposit-register', icon: 'Savings' },
        ],
      },
      // Tax Reports. `children: []` (not omitted) is what makes this a
      // proper sub-menu rather than a leaf: Sidebar navigates any node with
      // a `children` array to its SubMenuIndexPage/SubMenuGrid card-grid
      // page (see Sidebar.jsx's own comment) instead of treating it as a
      // direct link, and SubMenuIndexPage only bails out to `null` when
      // `children` is missing entirely -- an empty array still renders the
      // grid, just with zero cards. Needs a matching
      // `<Route path="tax-reports">` in AppRouter.jsx (see
      // reports-cash-bank's route block for the pattern) — without one,
      // this is the same dead-link-to-empty-card bug the previous "Demo"
      // stub had. Add real report entries here (and their own routes) as
      // they're built.
      {
        key: 'reports-tax-reports',
        labelKey: 'Tax Reports',
        path: '/reports/tax-reports',
        icon: 'PercentIcon',
        children: [
          // First (and so far only) FULLY BUILT report under this sub-menu
          // — GST tax breakup by HSN Code and Tax Code, Sales/Purchase tabs.
          // See pages/reports/tax/TaxReport.jsx and the matching
          // <Route path="tax-report"> in AppRouter.jsx's tax-reports block.
          // `key`/`path` are left exactly as they were before this rename —
          // both are what saved User Management permission grants and any
          // existing bookmark/deep-link key off of, so only the on-screen
          // label changes here.
          { key: 'reports-tax-tax-report', labelKey: 'Input Tax Report', path: '/reports/tax-reports/tax-report', icon: 'ReceiptLongIcon' },
          // Output Tax Report / Payable Tax Report — not built yet, so each
          // routes to a ReportPlaceholder shell (see AppRouter.jsx's
          // tax-reports route block) until its own backend endpoint and
          // page land, same "empty state instead of a blank/broken route"
          // convention as every other not-yet-built report in this app.
          { key: 'reports-tax-output-tax-report', labelKey: 'Output Tax Report', path: '/reports/tax-reports/output-tax-report', icon: 'PointOfSaleIcon' },
          { key: 'reports-tax-payable-tax-report', labelKey: 'Payable Tax Report', path: '/reports/tax-reports/payable-tax-report', icon: 'AccountBalanceWalletIcon' },
        ],
      },
    ],
  },
  {
    key: 'user',
    labelKey: 'nav.user',
    path: '/user',
    icon: 'ManageAccounts',
  },
  {
    key: 'settings',
    labelKey: 'nav.settings',
    path: '/settings',
    icon: 'Settings',
  },
];

// Flat list of every leaf page — used for the global search and breadcrumb
// lookup, AND for resolving a pathname to its governing menu key (see
// findNavNodeForPath/usePermissions in lib/permissions.js). `hidden` nodes
// stay IN this list on purpose: a hidden menu's own page is still reachable
// by direct URL/tab, and it must keep resolving to its real permission row
// and breadcrumb trail rather than falling through to "ungoverned" (fully
// permitted) just because its sidebar entry is switched off. Callers that
// want to hide something from the sidebar or search filter on `.hidden`
// themselves — see visibleNav() in lib/permissions.js and GlobalSearch.jsx.
export function flattenNav(tree = navConfig, trail = []) {
  return tree.flatMap((node) => {
    const currentTrail = [...trail, node];
    if (node.children?.length) {
      return [
        { ...node, trail: currentTrail, isParent: true },
        ...flattenNav(node.children, currentTrail),
      ];
    }
    return [{ ...node, trail: currentTrail, isParent: false }];
  });
}

export const flatNav = flattenNav();

export function findNavByPath(path) {
  return flatNav.find((n) => n.path === path);
}
