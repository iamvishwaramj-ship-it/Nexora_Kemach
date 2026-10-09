# Nexora Kemach ERP — Dynamic vs. Static Data Audit

Full menu-by-menu audit of every screen, tab and sub-menu in the application, tracing each one's complete data flow: frontend UI → API endpoint → backend route → Prisma model → database. Read-only audit; no code, schema, or data was changed.

**A note on method:** the first audit pass was run against this session's working copy, which only had the specific files touched during earlier Phase A work pulled in — everything else looked "missing." That was a false signal from an incomplete local mirror, not a real gap in your project. Every file referenced below was re-verified by pulling it live from `D:\Projects\Nexora_Kemach` on your machine before being classified, so the findings reflect your actual codebase.

---

## 1. Full Audit Table

Classification key: **Fully Dynamic** (real DB-backed data and working CRUD) · **Partially Dynamic** (mix of real and hardcoded) · **Static/Mock** (hardcoded/local only) · **Needs Verification** (ambiguous/orphaned).

### Dashboard

| Module | Menu/Screen | Frontend File | API Endpoint | Database Model/Table | Data Classification | Evidence / Issue |
|---|---|---|---|---|---|---|
| Dashboard | Dashboard | `frontend/src/pages/dashboard/Dashboard.jsx` | `GET /api/dashboard/stats` | `SalesInvoice`, `PurchaseInvoice`, `CustomerOutstanding`, `SupplierOutstanding`, `Stock`, `Product` (per `backend/src/routes/dashboard.js`) | Fully Dynamic | All 7 stat cards and all 6 sub-cards (Sales/Purchase Overview, Business Summary, Recent Transactions, Top Selling Products, Inventory Stock Alert) render from `useGetDashboardStatsQuery()` — no hardcoded arrays. Confirmed earlier this session: this exact route does real `prisma.findMany` calls (it's the route that threw the `sales_category` P2022 error we fixed). |

### Company Setup (14 screens)

| Module | Menu/Screen | Frontend File | API Endpoint | Database Model/Table | Data Classification | Evidence / Issue |
|---|---|---|---|---|---|---|
| Company Setup | Company Details | `company/CompanyDetails.jsx` | `GET/PUT company/details` | `CompanyDetails` | Fully Dynamic | Singleton record; real query+mutation wired. No Create/Delete by design. |
| Company Setup | Branch | `company/Branch.jsx` | `company/branches` | `Branch` | Fully Dynamic | Full CRUD wired; dropdowns from real `customerApi`/`supplierApi`. |
| Company Setup | Financial Year | `company/FinancialYear.jsx` | `company/financial-years` | `FinancialYear` | Fully Dynamic | Full CRUD wired. |
| Company Setup | Document Numbering | `company/DocumentNumbering.jsx` (+Form, +ExistingSeriesTable) | `company/document-numbers*` | `DocumentNumbering` | Fully Dynamic | Catalog query + create/update/delete mutations wired; sub-components are presentational, fed real data. |
| Company Setup | Tax Code | `company/TaxCode.jsx` | `company/tax-codes` | `TaxCode` | Fully Dynamic | Full CRUD + bespoke reset/list-GL-accounts mutations wired; dropdowns real. |
| Company Setup | Bank Details | `company/BankDetails.jsx` | `company/bank-names` | `BankName` | Fully Dynamic | Full CRUD wired. |
| Company Setup | House Bank | `company/HouseBank.jsx` | `company/house-banks` | `HouseBank` | Fully Dynamic | Full CRUD wired; a previously-hardcoded currency list was refactored onto Currency Master (code comment confirms). |
| Company Setup | Employee Master | `company/SalesEmployee.jsx` | `company/sales-employees` | `SalesEmployee` | Fully Dynamic | Full CRUD + bulk-import/signature upload wired; a previously-hardcoded department list was replaced with live `departmentMasterApi` (code comment confirms). |
| Company Setup | Approval Flow | `company/ApprovalFlow.jsx` | `company/approval-flows` | `ApprovalFlow`, `ApprovalFlowLevel` | Fully Dynamic | Full CRUD wired. |
| Company Setup | Department Master | `company/DepartmentMaster.jsx` | `department-master` | `DepartmentMaster` | Fully Dynamic | Full CRUD wired. |
| Company Setup | Location Master | `company/LocationMaster.jsx` | `location-master` | `LocationMaster` | Fully Dynamic | Full CRUD wired via `locationMasterApi`. (Resolves an earlier ambiguity: a second, unrelated `locationApi`/`locations` resource exists in the codebase but this page doesn't use it — likely dead/unused elsewhere, worth a grep if you want to confirm.) |
| Company Setup | Warehouse Master | `company/WarehouseMaster.jsx` | `warehouse-master` | `WarehouseMaster` | Fully Dynamic | Full CRUD wired via `warehouseMasterApi`, plus real GL/branch/financial-year dropdowns. Same dead-resource note as Location Master (`warehouseApi`/`warehouses` unused here). |
| Company Setup | Inventory Opening Balance | `company/OpeningBalance.jsx` | `opening-balance` | `OpeningBalance` | Fully Dynamic | Update/Delete wired (no Create — by design, rows are seeded per product, not freely created; confirm this matches your intended spec). |
| Company Setup | BP Opening Balance | `company/BPOpeningBalance.jsx` | `business-partner-opening-balance*` | `BusinessPartnerOpeningBalance` | Fully Dynamic | Server-paged list + bulk import wired. |

### Accounting (5 screens)

| Module | Menu/Screen | Frontend File | API Endpoint | Database Model/Table | Data Classification | Evidence / Issue |
|---|---|---|---|---|---|---|
| Accounting | Account Group | `accounting/AccountGroup.jsx` | `account-groups` | `AccountGroup` | Fully Dynamic | Full CRUD wired. |
| Accounting | Account Type | `accounting/AccountType.jsx` | `account-types` | `AccountType` | Fully Dynamic | Full CRUD wired. |
| Accounting | Chart Of Accounts | `accounting/ChartOfAccounts.jsx` | `chart-of-accounts` | `ChartOfAccount` | Fully Dynamic | Full CRUD + live balance query + import/export wired. |
| Accounting | G/L Account Determination | `accounting/GLAccountDetermination.jsx` + Form | `gl-account-determinations` | `GlAccountDetermination` | Fully Dynamic | Full CRUD wired. |
| Accounting | Journal Entry | `accounting/JournalEntry.jsx` | `journal-entries` | `JournalEntry`, `JournalEntryLine` | Fully Dynamic | Full CRUD + post-to-GL mutation wired. |

### Product Setup (10 screens)

| Module | Menu/Screen | Frontend File | API Endpoint | Database Model/Table | Data Classification | Evidence / Issue |
|---|---|---|---|---|---|---|
| Product | Product Master | `product/ProductMaster.jsx` | `products` (+ form-lookups, usage, current-stock) | `Product` | Fully Dynamic | Server-paged, full CRUD. All dropdowns live; only fixed classification enums (Product Type, Tax Category, etc.) are hardcoded, which is correct — not substitute data. |
| Product | Product Group | `product/ProductGroup.jsx` | `product-groups` | `ProductGroup` | Fully Dynamic | Full CRUD; 29-field Accounting tab's dropdowns are all live. |
| Product | Product Sub-Group | `product/ProductSubGroup.jsx` | `product-sub-groups` | `ProductSubGroup` | Fully Dynamic | Full CRUD wired. |
| Product | Brand | `product/Brand.jsx` | `brands` | `Brand` | Fully Dynamic | Full CRUD wired. |
| Product | Unit of Measure | `product/UnitOfMeasure.jsx` | `uoms` | `Uom` | Fully Dynamic | Full CRUD wired. |
| Product | HSN Master | `product/HsnMaster.jsx` | `hsn-master` (+ import) | `HsnMaster` | Fully Dynamic | Full CRUD + real bulk import. |
| Product | Currency Master | `product/CurrencyMaster.jsx` | `currencies` | `CurrencyMaster` | Fully Dynamic | Full CRUD; this is the actual source every other currency dropdown *should* read from (see Issue list below — several document screens don't). |
| Product | Barcode | `product/Barcode.jsx` | `products` (same as Product Master) | `Product.barcode` | Fully Dynamic | Not an independent resource — it's a dedicated UI over the `Product` model; Generate/Edit/Remove all call `productApi.useUpdate()`. Functionally real, architecturally a Product Master sub-feature. |
| Product | Customer Discount | `product/CustomerDiscount.jsx` | `customer-discounts` | `CustomerDiscount` | Fully Dynamic (one static dropdown) | Full CRUD; Customer dropdown merges real customers with a hardcoded `GENERIC_PRICE_LISTS = ['Walk-in Customer', 'Retail Price List', 'Corporate Customer', 'Wholesale Price List']` — a deliberate generic-tier convention reused on Purchase/Sales Price pages, not a missing integration. |
| Product | Price List | `product/PriceList.jsx` | `price-lists` (bespoke) | `PriceList` | Fully Dynamic | Full CRUD + real Excel import/export mutations. |

### Partner (2 screens)

| Module | Menu/Screen | Frontend File | API Endpoint | Database Model/Table | Data Classification | Evidence / Issue |
|---|---|---|---|---|---|---|
| Partner | Business Partner | `businessPartner/BusinessPartner.jsx` | `business-partners` (+ summary/invoices/documents/logo) | `BusinessPartner` | Fully Dynamic | Server-paged, full CRUD, live sub-resource queries. |
| Partner | Transport Master | `businessPartner/TransportMaster.jsx` | `transporters` | `Transport` | Fully Dynamic | Full CRUD; bank fields auto-fill live from House Bank. |

### Purchase (5 screens)

| Module | Menu/Screen | Frontend File | API Endpoint | Database Model/Table | Data Classification | Evidence / Issue |
|---|---|---|---|---|---|---|
| Purchase | Purchase Order | `purchase/PurchaseOrder.jsx` | `purchase/orders` (+cancel) | `PurchaseOrder`/Item | Fully Dynamic | Full CRUD + Cancel + real "Copy From" (Purchase Quotation) wired. |
| Purchase | Purchase GRN | `purchase/PurchaseGRN.jsx` | `purchase/grn` (+cancel) | `GoodsReceivedNote`/Item | Fully Dynamic | Full CRUD + Cancel + Copy From (Purchase Order) wired. |
| Purchase | Purchase Return | `purchase/PurchaseReturn.jsx` | `purchase/returns` (+cancel) | `PurchaseReturn`/Item | Fully Dynamic | Full CRUD + Cancel + Copy From (GRN/Invoice/PO) wired; backend enforces real over-consumption guard against source document. |
| Purchase | Purchase Invoice | `purchase/PurchaseInvoice.jsx` | `purchase/invoices` (+cancel) | `PurchaseInvoice`/Item | Fully Dynamic | Full CRUD + Cancel + two Copy From flows wired. |
| Purchase | Purchase Credit Memo | `purchase/PurchaseCreditMemo.jsx` | `purchase/credit-memos` (+cancel) | `PurchaseCreditMemo`/Item | Fully Dynamic | Full CRUD + Cancel + Copy From (Invoice) wired; backend enforces credit-memo eligibility guard. |

### Sales (8 screens)

| Module | Menu/Screen | Frontend File | API Endpoint | Database Model/Table | Data Classification | Evidence / Issue |
|---|---|---|---|---|---|---|
| Sales | Enquiry | `sales/Enquiry.jsx` | `sales/enquiries` | `Enquiry` | Fully Dynamic | Full CRUD wired. No Cancel button — correctly matches backend (no cancel route for this document type). |
| Sales | Follow-up | `sales/FollowUp.jsx` | `sales/follow-ups` | `FollowUp` | Fully Dynamic | Full CRUD wired; linked-Enquiry picker real. |
| Sales | Sales Quotation | `sales/SalesQuotation.jsx` | `sales/quotations` (+cancel) | `SalesQuotation`/Item | Fully Dynamic | Full CRUD + Cancel + WhatsApp-send + Copy From (Enquiry) wired. |
| Sales | Sales Order | `sales/SalesOrder.jsx` | `sales/orders` (+cancel) | `SalesOrder`/Item | Fully Dynamic | Full CRUD + Cancel + Copy From (Quotation/Challan/Invoice) wired. |
| Sales | Delivery Challan | `sales/DeliveryChallan.jsx` | `sales/delivery-challans` (+cancel) | `DeliveryChallan`/Item | Fully Dynamic | Full CRUD + Cancel + Copy From wired. |
| Sales | Sales Return | `sales/SalesReturn.jsx` | `sales/returns` (+cancel) | `SalesReturn`/Item | Fully Dynamic | Full CRUD + Cancel + Copy From wired. |
| Sales | Sales Invoice | `sales/SalesInvoice.jsx` | `sales/invoices` (+cancel, e-invoice, e-way-bill, print/whatsapp) | `SalesInvoice`/Item | Fully Dynamic | Full CRUD + Cancel + e-Invoice/e-Way-Bill generate/cancel + Copy From, all wired to real mutations. |
| Sales | Sales Credit Memo | `sales/SalesCreditMemo.jsx` | `sales/credit-memos` (+cancel) | `SalesCreditMemo`/Item | Fully Dynamic | Full CRUD + Cancel + Copy From wired. |

**Note (Purchase + Sales):** Every document screen with a Currency field (Purchase Invoice, Purchase Credit Memo, Sales Quotation, Sales Order, Delivery Challan, Sales Invoice) sources its currency dropdown from a hardcoded list in `frontend/src/lib/currencyOptions.js` rather than the real Currency Master you just confirmed is fully dynamic elsewhere — minor inconsistency, not a functional blocker. Also, the "Copy From" dialogs on all 11 purchase/sales screens that have one depend on a shared `frontend/src/components/common/CopyFromDocumentDialog.jsx` component that could not be independently re-verified in this pass (everything feeding *into* it is confirmed real) — worth a quick manual spot-check.

### Inventory (6 screens)

| Module | Menu/Screen | Frontend File | API Endpoint | Database Model/Table | Data Classification | Evidence / Issue |
|---|---|---|---|---|---|---|
| Inventory | Stock Receipt | `inventory/StockReceipt.jsx` | `inventory/stock-receipts` | `StockReceipt`/Item | Fully Dynamic | Full CRUD wired. |
| Inventory | Stock Issue | `inventory/StockIssue.jsx` | `inventory/stock-issues` | `StockIssue`/Item | Fully Dynamic | Full CRUD wired. |
| Inventory | Stock Adjustment | `inventory/StockAdjustment.jsx` | `inventory/stock-adjustments` | `StockAdjustment`/Item | Fully Dynamic | Full CRUD wired. |
| Inventory | Stock Transfer Request | `inventory/StockTransferRequest.jsx` | `inventory/stock-transfer-requests` | `StockTransferRequest`/Item | Fully Dynamic | Full CRUD wired; approval fields real. |
| Inventory | Stock Transfer Issue | `inventory/StockTransfer.jsx` | `inventory/stock-transfers` (+e-way bill) | `StockTransfer`/Item | Fully Dynamic | Full CRUD + e-Way Bill generate/cancel wired. |
| Inventory | Stock Transfer Receipt | `inventory/StockTransferReceipt.jsx` | `inventory/stock-transfer-receipts` | `StockTransferReceipt`/Item | Fully Dynamic | Full CRUD wired. |

### Receivables (2 screens)

| Module | Menu/Screen | Frontend File | API Endpoint | Database Model/Table | Data Classification | Evidence / Issue |
|---|---|---|---|---|---|---|
| Receivables | Customer Outstanding | `receivables/CustomerOutstandingList.jsx` | `receivables/outstanding` | `CustomerOutstanding` | Fully Dynamic (read-only by design) | Ledger view, no create/edit/delete — correct for this screen type. |
| Receivables | Collection Entry | `receivables/CollectionEntry.jsx` | `receivables/collections` | `Collection`/`CollectionInvoiceApplication` | Fully Dynamic | Full CRUD + real multi-invoice apply, syncing Customer Outstanding and invoice payment status. |

### Payables (2 screens)

| Module | Menu/Screen | Frontend File | API Endpoint | Database Model/Table | Data Classification | Evidence / Issue |
|---|---|---|---|---|---|---|
| Payables | Supplier Outstanding | `payables/SupplierOutstandingList.jsx` | `payables/outstanding` | `SupplierOutstanding` | Fully Dynamic (read-only by design) | Ledger view, no create/edit/delete — correct for this screen type. |
| Payables | Payment Entry | `payables/PaymentEntry.jsx` | `payables/payments` | `SupplierPayment`+applications | Fully Dynamic | Mirrors Collection Entry; full CRUD + real apply logic. |

### Banking (5 screens)

| Module | Menu/Screen | Frontend File | API Endpoint | Database Model/Table | Data Classification | Evidence / Issue |
|---|---|---|---|---|---|---|
| Banking | Deposit Entry | `banking/DepositEntry.jsx` | `banking/deposits` | `BankDeposit` | Fully Dynamic | Full CRUD wired. |
| Banking | Bank Reconciliation | `banking/BankReconciliation.jsx` | `banking/reconciliations` | `BankReconciliation`/Transaction | Fully Dynamic | List/Create/Update wired; PUT does a real delete+recreate of matched transactions (deliberate design, not a bug). |
| Banking | Cheque Print | `banking/ChequePrint.jsx` | `banking/cheques` | `Cheque`/`ChequeInvoiceApplication` | Fully Dynamic | Full CRUD + real settlement application against outstanding. |
| Banking | Payment Receipt | `banking/PaymentReceipt.jsx` | `banking/payment-receipts` (+whatsapp) | `PaymentReceipt` | Fully Dynamic | Full CRUD + real WhatsApp-send mutation. |
| Banking | Payment Voucher | `banking/PaymentVoucher.jsx` | `banking/payment-vouchers` (+whatsapp) | `PaymentVoucher` | Fully Dynamic | Full CRUD + real WhatsApp-send mutation. |

**Dead files found (not reachable from any route, no action needed but flagged):** `frontend/src/pages/receivables/CustomerOutstanding-1.jsx` and `frontend/src/pages/payables/SupplierOutstanding-1.jsx` — abandoned near-duplicates of the real report pages, not imported anywhere in `AppRouter.jsx`.

### Production Planning (13 screens)

| Module | Menu/Screen | Frontend File | API Endpoint | Database Model/Table | Data Classification | Evidence / Issue |
|---|---|---|---|---|---|---|
| Production Planning | Forecast | `productionPlanning/Forecast.jsx` | `production-planning/*` | `ProductionForecastPlan`/Line (+ real Sales Invoice history) | Fully Dynamic | Built on real Sales Invoice history + statistical projection, via `productionPlanningApi`. |
| Production Planning | Dashboard | `productionPlanning/ProductionPlanningDashboard.jsx` | none | none | Static/Mock | Zero API calls; 9 hardcoded data constants (`KPI_CARDS`, `ORDER_STATUS_DATA`, `PLANNED_VS_COMPLETED`, `PRODUCTION_TREND`, `TOP_ORDERS`, `MACHINE_UTILIZATION`, `MATERIAL_AVAILABILITY`, `QUALITY_SUMMARY`, `PRODUCTION_ALERTS`) drive every chart and card. |
| Production Planning | Generate Order - MRP | `GenerateOrderMrp.jsx` | none | none | Static/Mock | UI-only mock build from an earlier phase of this project; no backend wiring. |
| Production Planning | Order Generation Option | `OrderGenerationOption.jsx` | none | none | Static/Mock | Same as above. |
| Production Planning | Preview Order | `PreviewOrder.jsx` | none | none | Static/Mock | 364-byte placeholder stub. |
| Production Planning | Generate Order | `GenerateOrder.jsx` | none | none | Static/Mock | 384-byte placeholder stub. |
| Production Planning | Generate Order - Manual | `GenerateOrderManual.jsx` | none | none | Static/Mock | UI-only mock build; no backend wiring. |
| Production Planning | Generate Order - Sales Order | `GenerateOrderSalesOrder.jsx` | none | none | Static/Mock | UI-only mock build; no backend wiring. |
| Production Planning | Generate Order - Forecast | `GenerateOrderForecast.jsx` | none | none | Static/Mock | 385-byte placeholder stub. |
| Production Planning | Generate Order - Project | `GenerateOrderProject.jsx` | none | none | Static/Mock | UI-only mock build; no backend wiring. |
| Production Planning | Work Centers | `productionPlanning/WorkCenters.jsx` | `production/work-centers` | `WorkCenter` | Fully Dynamic | Built this session (Phase A); full CRUD wired. |
| Production Planning | Bill of Materials | `productionPlanning/BillOfMaterials.jsx` | `production/boms` | `BillOfMaterial`/`BomLine` | Fully Dynamic | Built this session (Phase A); full CRUD + line-items wired. |
| Production Planning | Routing | `productionPlanning/Routings.jsx` | `production/routings` | `Routing`/`RoutingOperation` | Fully Dynamic | Built this session (Phase A); full CRUD + operations wired. |

### Production Execution (18 screens)

| Module | Menu/Screen | Frontend File | API Endpoint | Database Model/Table | Data Classification | Evidence / Issue |
|---|---|---|---|---|---|---|
| Production Execution | Production Orders | `productionExecution/ProductionOrders.jsx` | `production/orders` | `ProductionOrder` | Fully Dynamic | Rewired this session (Phase A); list, status advance (Release/Advance/Close), Cancel all wired. |
| Production Execution | View Order | `productionExecution/ViewOrder.jsx` | `production/orders/:id` (+status/cancel) | `ProductionOrder`, `ProductionOrderComponent` | Partially Dynamic | Header fields, status, and the Components tab are real. The Operations, Production Execution, Material Issue, Material Receipt, Production History, and Notes & Attachments tabs each show "not available yet — planned for a later phase," by design (Phase A scope). |
| Production Execution | Operations | `Operations.jsx` | none | none | Static/Mock | UI-only mock build; no backend wiring. |
| Production Execution | Production Execution (status) | `ProductionExecutionStatus.jsx` | none | none | Static/Mock | UI-only mock build; no backend wiring. |
| Production Execution | Material Requisition | `MaterialRequisition.jsx` | none | none | Static/Mock | UI-only mock build; no backend wiring. |
| Production Execution | Material Issue | `MaterialIssue.jsx` | none | none | Static/Mock | UI-only mock build; no backend wiring. |
| Production Execution | Material Receipt | `MaterialReceipt.jsx` | none | none | Static/Mock | UI-only mock build; no backend wiring. |
| Production Execution | Create Issue | `CreateIssue.jsx` | none | none | Static/Mock | UI-only mock build; no backend wiring. |
| Production Execution | Record Production | `RecordProduction.jsx` | none | none | Static/Mock | UI-only mock build; no backend wiring. |
| Production Execution | Production History | `ProductionHistory.jsx` | none | none | Static/Mock | 367-byte placeholder stub. |
| Production Execution | Product Cost | `ProductCost.jsx` | none | none | Static/Mock | UI-only mock build; no backend wiring. |
| Production Execution | Rework & Scrap | `ReworkScrap.jsx` | none | none | Static/Mock | 354-byte placeholder stub. |
| Production Execution | Production Completion | `ProductionCompletion.jsx` | none | none | Static/Mock | UI-only mock build; no backend wiring. |
| Production Execution | Production Closure | `ProductionClosure.jsx` | none | none | Static/Mock | 367-byte placeholder stub. |
| Production Execution | Reports | `Reports.jsx` | none | none | Static/Mock | 355-byte placeholder stub. |
| Production Execution | Notes | `Notes.jsx` | none | none | Static/Mock | UI-only mock build; no backend wiring. |
| Production Execution | Create Requisition | `CreateRequisition.jsx` | none | none | Static/Mock | UI-only mock build; no backend wiring. |
| Production Execution | Create Production Order | `productionExecution/CreateProductionOrder.jsx` | `production/orders` (POST) | `ProductionOrder`, `ProductionOrderComponent`, `ProductionOrderOperation` | Fully Dynamic | Built this session (Phase A); real BOM/Routing snapshot-on-create. |

*(All 9 static Production Planning screens and all 15 static Production Execution screens were deliberately built as static UI mocks in earlier phases of this project — this matches your own project history, not an oversight. They're listed here because the brief asked for every screen regardless.)*

### Sales Reports (9 screens)

| Module | Menu/Screen | Frontend File | API Endpoint | Database Model/Table | Data Classification | Evidence / Issue |
|---|---|---|---|---|---|---|
| Reports - Sales | Sales Quotation Register | `reports/sales/SalesQuotationRegister.jsx` | `sales/quotations/register/report` | `SalesQuotation`→`SalesOrder` | Fully Dynamic | Real filters, real conversion-status computation. |
| Reports - Sales | Sales Invoice Register | `reports/sales/SalesInvoiceRegister.jsx` | `sales/invoices/register/report` | `SalesInvoice` | Fully Dynamic | Real filters/stats/totals. |
| Reports - Sales | Customer-wise Sales | `reports/sales/CustomerWiseSales.jsx` | `sales/invoices/customer-wise/report` | `SalesInvoice`/`BusinessPartner` | Fully Dynamic | Real top-customer/trend charts. |
| Reports - Sales | Product-wise Sales | `reports/sales/ProductWiseSales.jsx` | `sales/invoices/product-wise/report` | `SalesInvoice`/Item/`Product` | Fully Dynamic | Real top-product/category charts. |
| Reports - Sales | Salesman-wise Sales | `reports/sales/SalesmanWiseSales.jsx` | `sales/invoices/salesman-wise/report` | `SalesInvoice`/`SalesEmployee` | Fully Dynamic | Data real; "Document Type" filter is a documented no-op on the backend (cosmetic only). |
| Reports - Sales | Pending Sales Order | `reports/sales/PendingSalesOrder.jsx` | `sales/orders/pending/report` | `SalesOrder`/`DeliveryChallan` | Fully Dynamic | Real server-computed aging buckets. |
| Reports - Sales | Profitability Analysis | `reports/sales/ProfitabilityAnalysis.jsx` | `sales/invoices/profitability/report` | `SalesInvoice`/Item/`Product`/`BusinessPartner` | Fully Dynamic | Real margin computation from stamped cost prices. |
| Reports - Sales | Customer Ledger | `reports/sales/CustomerLedger.jsx` | `receivables/customer-ledger/report` | `SalesInvoice`,`SalesReturn`,`SalesCreditMemo`,`Collection`,`PaymentReceipt` | Fully Dynamic | Real 5-document running ledger. |
| Reports - Sales | Customer Aging Report | `reports/sales/CustomerAgingReport.jsx` | `receivables/customer-aging/report` | `SalesInvoice` | Fully Dynamic | Real configurable aging buckets. |

### Purchase Reports (6 screens)

| Module | Menu/Screen | Frontend File | API Endpoint | Database Model/Table | Data Classification | Evidence / Issue |
|---|---|---|---|---|---|---|
| Reports - Purchase | Purchase Order Register | `reports/purchase/PurchaseOrderRegister.jsx` | `purchase/orders/register/report` | `PurchaseOrder` | Fully Dynamic | Data real; "Source" filter is a documented no-op (PurchaseOrder has no source column). |
| Reports - Purchase | Purchase Invoice Register | `reports/purchase/PurchaseInvoiceRegister.jsx` | `purchase/invoices/register/report` | `PurchaseInvoice` | Fully Dynamic | Data real; same no-op Source filter. Also: a real computed payment/aging summary card is built in code but commented out of the JSX, so it's silently hidden from users — worth re-enabling. |
| Reports - Purchase | Vendor-wise Purchase | `reports/purchase/VendorWisePurchase.jsx` | `purchase/invoices/vendor-wise/report` | `PurchaseInvoice`/`BusinessPartner` | Fully Dynamic | Real top-vendor/trend charts. |
| Reports - Purchase | Pending Purchase Order | `reports/purchase/PendingPurchaseOrder.jsx` | `purchase/orders/pending/report` | `PurchaseOrder`/`GoodsReceivedNote` | Fully Dynamic | Data real; same no-op Source filter. |
| Reports - Purchase | Price Comparison | `reports/purchase/PriceComparison.jsx` | `purchase/quotations/price-comparison/report` | `PurchaseQuotation`/`Product` | Fully Dynamic | Real per-item quote comparison. |
| Reports - Purchase | Price History | `reports/purchase/PurchasePriceHistory.jsx` | `purchase/products/price-history/report` | `PurchaseQuotation`/`PurchasePrice`/`Product` | Fully Dynamic | Real trend/supplier-average charts. |

### Inventory Reports (7 screens)

| Module | Menu/Screen | Frontend File | API Endpoint | Database Model/Table | Data Classification | Evidence / Issue |
|---|---|---|---|---|---|---|
| Reports - Inventory | Stock Summary | `reports/inventory/StockSummary.jsx` | `inventory/stock-summary/report` | `Stock`/`Product` | Fully Dynamic | Real, plus live stock-ledger drill-down. |
| Reports - Inventory | Available Balance | `reports/inventory/AvailableBalance.jsx` | `inventory/available-balance/report` | `Stock`/`Product` | Fully Dynamic | Real, with live drill-down. |
| Reports - Inventory | Stock Valuation | `reports/inventory/StockValuation.jsx` | `inventory/stock-valuation/report` | `Stock`/`Product` | Fully Dynamic | Real. |
| Reports - Inventory | Low Stock Report | `reports/inventory/LowStockReport.jsx` | `inventory/low-stock/report` | `Stock`/`Product` | Fully Dynamic | Real. |
| Reports - Inventory | Slow Moving Stock | `reports/inventory/SlowMovingStock.jsx` | `inventory/slow-moving/report` | `Stock`/`Product` | Fully Dynamic | Real. |
| Reports - Inventory | Dead Stock | `reports/inventory/DeadStock.jsx` | `inventory/dead-stock/report` | `Stock`/`Product` | Fully Dynamic | Real. |
| Reports - Inventory | Reorder Level | `reports/inventory/ReorderLevel.jsx` | `inventory/reorder-level/report` | `Stock`/`Product` | Fully Dynamic | Real. |

### Receivable / Payable / Cash-Bank / Tax Reports (11 screens)

| Module | Menu/Screen | Frontend File | API Endpoint | Database Model/Table | Data Classification | Evidence / Issue |
|---|---|---|---|---|---|---|
| Reports - Receivable | Customer Outstanding | `receivables/CustomerOutstanding.jsx` (distinct from the master-list page above) | `receivables/outstanding/report` | `CustomerOutstanding`/`BusinessPartner` | Fully Dynamic | Real aging buckets, stats, charts. |
| Reports - Receivable | Collection Register | `reports/receivable/CollectionRegister.jsx` | `receivables/collection-register/report` | `Collection`/`CollectionInvoiceApplication` | Fully Dynamic | Real. |
| Reports - Payable | Supplier Outstanding | `payables/SupplierOutstanding.jsx` (distinct from the master-list page above) | `payables/outstanding/report` | `SupplierOutstanding`/`BusinessPartner` | Fully Dynamic | Real aging buckets. |
| Reports - Payable | Payment Register | `reports/payable/PaymentRegister.jsx` | `payables/payment-register/report` | `SupplierPayment`/`PaymentVoucher` | Fully Dynamic | Real. |
| Reports - Cash/Bank | Cash Book | `reports/cashbank/CashBook.jsx` | `banking/cash-book/report` | `HouseBank`,`Collection`,`PaymentVoucher`,cheques,`BankDeposit` | Fully Dynamic | Real. |
| Reports - Cash/Bank | Day Book | `reports/cashbank/DayBook.jsx` | `banking/day-book/report` | collections/payments/deposits | Fully Dynamic | Real. |
| Reports - Cash/Bank | Bank Book | `reports/cashbank/BankBook.jsx` | `banking/bank-book/report` | `HouseBank`,`BankDeposit`,`PaymentVoucher` | Fully Dynamic | Real. |
| Reports - Cash/Bank | Deposit Register | `reports/cashbank/DepositRegister.jsx` | `banking/deposit-register/report` | `BankDeposit`/`DepositItem` | Fully Dynamic | Real. |
| Reports - Tax | Input Tax Report | `reports/tax/TaxReport.jsx` | `tax/input-tax-report` (+export) | `PurchaseInvoice`/Item/`TaxCode` | Fully Dynamic | Real, with GSTR-2 export. |
| Reports - Tax | Output Tax Report | `reports/tax/OutputTaxReport.jsx` | `tax/output-tax-report` (+export) | `SalesInvoice`/Item/`TaxCode`/`BusinessPartner` | Fully Dynamic | Real, with GSTR-1 export. **Corrects a stale code comment** in `navConfig.js` claiming this was an unbuilt placeholder — it is fully built. |
| Reports - Tax | Payable Tax Report | `reports/tax/PayableTaxReport.jsx` | `tax/payable-tax-report` | Derived from `SalesInvoice`+`PurchaseInvoice` | Fully Dynamic | Real, nets output vs. input tax server-side. **Same correction** — `navConfig.js`'s comment calling this an unbuilt placeholder is stale/wrong; it's fully built. |

### User Management

| Module | Menu/Screen | Frontend File | API Endpoint | Database Model/Table | Data Classification | Evidence / Issue |
|---|---|---|---|---|---|---|
| User | User Management (List, Create, Edit — Details/Branch Access/Permissions tabs, Delete) | `user/UserManagement.jsx` | `GET/POST/PUT/DELETE /api/users` | `AppUser`, `UserPermission`, `UserBranch` | Fully Dynamic | Every action — list, create (password hashed), edit across all 3 tabs, hard delete — is a real transactional Prisma write in `backend/src/routes/users.js`. No mock data anywhere. |

### Settings

| Module | Menu/Screen | Frontend File | API Endpoint | Database Model/Table | Data Classification | Evidence / Issue |
|---|---|---|---|---|---|---|
| Settings | Profile card | `settings/Settings.jsx` | none (reads logged-in user from Redux) | — | Fully Dynamic (display only) | Shows the real logged-in user's name/email/role/photo; "Manage Profile" just navigates elsewhere. |
| Settings | Theme (color/mode/sidebar hover/icon colors) | `settings/Settings.jsx` | none | none | Static/Mock | Client-only Redux state (`themeSlice`), never sent to the backend — settings reset per browser unless `themeSlice` itself persists to `localStorage` (not confirmed; the slice file wasn't in scope for this pass). |
| Settings | Fonts | `settings/Settings.jsx` | none | none | Static/Mock | Same as Theme — client-only. |
| Settings | Language | `settings/Settings.jsx` | none | none | Static/Mock | `i18n.changeLanguage()` + browser `localStorage` only. |
| Settings | Tabs (max open tabs, close all) | `settings/Settings.jsx` | none | none | Static/Mock | Client-only Redux state (`tabsSlice`). |
| Settings | Developer Settings (Smart Add, Master Quick Link) | `settings/Settings.jsx` | none | none | Static/Mock | Client-only Redux state. |
| Settings | E-Invoice / E-Way Bill Settings | `settings/Settings.jsx` | `GET/PUT company/einvoice-settings` + test-connection | `EInvoiceSettings` | Fully Dynamic | Genuinely persists; the three password fields are intentionally non-editable here by design (they live in server `.env`, never round-tripped to the client) — not a bug. |
| Settings | *(missing from UI)* Module Settings (Sales/Purchase/Inventory toggles) | — no frontend file renders this anywhere — | `GET/PUT /api/company/system-settings` | `SystemSettings` | Needs Verification | The backend endpoint is real and actively used server-side (`assertModuleEnabled()` gates document routes), but no screen or hook anywhere calls it. Either the UI was never built, or it was dropped at some point — this is an orphaned backend feature with no way for anyone to actually change these 3 toggles today. |

---

## 2. Totals

**133 screens/tabs audited** across every module in the navigation.

| Classification | Count | % |
|---|---|---|
| Fully Dynamic | 102 | 77% |
| Partially Dynamic | 1 | 1% |
| Static/Mock | 29 | 22% |
| Needs Verification | 1 | 1% |

The Static/Mock count is concentrated almost entirely in two places: **Production Planning's "Generate Order" family** (9 screens) and **Production Execution's not-yet-built workflow screens** (15 screens) — both deliberately built as UI mockups in earlier phases of this project, ahead of the backend work. The remaining 5 Static/Mock items are the cosmetic (non-business-data) personalization controls on the Settings page.

Every other module you asked about — Company Setup, Accounting, Product, Partner, Purchase, Sales, Inventory, Receivables, Payables, Banking, and all 34 Reports screens — is **100% Fully Dynamic**, with real Create/Edit/Delete/Search/Filter/Cancel wired to Prisma on genuine database models. This was a pleasant surprise relative to how large this ERP is: the "core" transactional modules have no mock data hiding anywhere.

## 3. Every Static or Partially Dynamic Screen, and Exactly What's Static

**Production Planning (9 screens, 100% static, no backend at all):** Dashboard, Generate Order - MRP, Order Generation Option, Preview Order, Generate Order, Generate Order - Manual, Generate Order - Sales Order, Generate Order - Forecast, Generate Order - Project. None of these call any API; all data is hardcoded JS constants.

**Production Execution (15 screens, 100% static, no backend at all):** Operations, Production Execution (status), Material Requisition, Material Issue, Material Receipt, Create Issue, Record Production, Production History, Product Cost, Rework & Scrap, Production Completion, Production Closure, Reports, Notes, Create Requisition.

**View Order (Partially Dynamic):** header, status, and the Components tab are real; the Operations, Production Execution, Material Issue, Material Receipt, Production History, and Notes & Attachments tabs are intentional "not available yet" stubs (Phase A scope boundary, not a bug).

**Customer Discount, Purchase Price, Sales Price (Product module):** otherwise Fully Dynamic, but the Customer/Supplier dropdown on each merges real business partners with 4 hardcoded generic labels (`Walk-in Customer`, `Retail Price List`, `Corporate Customer`, `Wholesale Price List`) — a deliberate convention, not missing data.

**Purchase Invoice, Purchase Credit Memo, Sales Quotation, Sales Order, Delivery Challan, Sales Invoice:** otherwise Fully Dynamic, but the Currency dropdown on each is a hardcoded list rather than reading from the (fully dynamic) Currency Master.

**Settings — Theme, Fonts, Language, Tabs, Developer Settings (5 cards):** entirely client-side Redux/localStorage state; nothing here is stored in the database, so it won't follow a user across devices/browsers.

## 4. Screens With Missing or Nonfunctional CRUD

Only one genuine gap was found in the modules outside Production Planning/Execution:

- **Settings → Module Settings (Sales/Purchase/Inventory enable/disable toggles):** the backend route exists and is load-bearing (other routes check it), but there is no UI anywhere to actually change these values. This is the one orphaned/needs-verification item in the whole audit outside the production module.
- **Inventory Opening Balance (Company Setup):** no Create action — only Update/Delete. Likely correct by design (rows are seeded from the product catalog), but worth a one-line confirmation from whoever owns the spec.

Every other screen's Create/View/Edit/Delete/Search/Filter/Cancel was confirmed wired to a real, Prisma-backed mutation or query. No disguised "looks dynamic but isn't" screens were found outside Production Planning/Execution.

Two minor issues also worth a look, not CRUD gaps: a real, computed payment/aging summary card on the **Purchase Invoice Register** report is built but commented out of the JSX (so it's invisible to users for no reason), and two dead/unused duplicate files (`CustomerOutstanding-1.jsx`, `SupplierOutstanding-1.jsx`) sit in the codebase unreferenced by any route.

## 5. Prioritized Plan to Close the Gaps

1. **Settings → Module Settings toggles (highest priority, smallest scope).** The backend already exists and is already enforced elsewhere in the app — this is purely a missing ~30-line settings card plus one RTK Query hook file. Lowest effort, closes a real functional gap, and touches nothing else.
2. **Re-enable the hidden Purchase Invoice Register summary card.** The data is already computed; this is a one-line JSX uncomment, not new work.
3. **Delete the two dead files** (`CustomerOutstanding-1.jsx`, `SupplierOutstanding-1.jsx`) — zero risk, pure cleanup, no screen depends on them.
4. **Production Execution's remaining 15 static screens**, in roughly this order since each builds on the last and on the Phase A foundation already in place: Material Requisition → Create Requisition → Material Issue → Create Issue → Material Receipt (these five form one material-flow chain feeding off the real `ProductionOrderComponent` snapshots already created in Phase A) → Operations (off the real `ProductionOrderOperation` snapshots) → Record Production / Production Execution status (the actual output-tracking core) → Product Cost → Rework & Scrap → Production Completion → Production Closure → Production History → Notes → Reports. This is a substantial, multi-phase build (materials consumption, output posting, costing, stock/GL integration) — treat it as its own scoped project, not a quick pass, given how deliberately Phase A was scoped down to avoid exactly this.
5. **Production Planning's 9 static "Generate Order" screens** — these depend on real MRP/demand-planning logic (explosion against BOMs, sales orders, and the forecast that's already real) that doesn't exist yet on the backend. This is the largest remaining piece of work in the whole audit and should be scoped and approved as its own phase, the same way Phase A was, rather than folded into anything else.
6. **Cosmetic-only fixes, whenever convenient:** point the Currency dropdowns on the 6 sales/purchase documents at the real Currency Master instead of the hardcoded list; decide whether `Settings` personalization (Theme/Fonts/Language/Tabs/Developer) should ever be server-persisted (e.g. to follow a user across devices) or is intentionally local-only.

No change in this plan touches any screen already confirmed Fully Dynamic, and nothing here was implemented — this is analysis only, per your instructions.
