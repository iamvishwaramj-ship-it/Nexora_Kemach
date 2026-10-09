# Nexora Kemach — Production Planning & Production Execution: Dynamic vs. Static Audit

Scope: only the Production Planning and Production Execution modules, re-verified directly against the live project at `D:\Projects\Nexora_Kemach` (fresh file listing + fresh file reads pulled this session, not reused from the broader audit's cache). No files were modified, created, deleted, or refactored; no migrations were run; nothing outside these two modules was touched.

One correction versus the earlier full-project audit: that pass listed 9 "Generate Order" screens in Production Planning. The live project actually has **10** — it also contains `GeneratedOrders.jsx` ("Generated Orders" results screen), which wasn't separately itemized before. It's included below.

---

## 1. Audit Table

| Module | Menu/Screen | Frontend File | API Endpoint | Database Model/Table | Dynamic vs. Static | Exact Missing Functionality |
|---|---|---|---|---|---|---|
| Production Planning | Dashboard | `pages/productionPlanning/ProductionPlanningDashboard.jsx` | none | none | **Static/Mock** | Zero API calls anywhere in the file. 9 hardcoded JS constants drive every card and chart: `KPI_CARDS`, `ORDER_STATUS_DATA`, `PLANNED_VS_COMPLETED`, `PRODUCTION_TREND`, `TOP_ORDERS`, `MACHINE_UTILIZATION`, `MATERIAL_AVAILABILITY`, `QUALITY_SUMMARY`, `PRODUCTION_ALERTS` (lines 40–131). No backend route exists for a production-planning dashboard. |
| Production Planning | Forecast | `pages/productionPlanning/Forecast.jsx` | `GET/POST/PUT/DELETE production-planning/forecast-plans`, `POST .../forecast-plans/preview`, `GET .../meta/item-categories` (backend/src/routes/productionPlanning.js lines 38–230) | `ForecastPlan` (+ live aggregation from `SalesInvoice` history) | **Fully Dynamic** | None. Actual Demand is aggregated server-side from real Sales Invoice history; Forecast Demand/Method is a real calculation; the 4 scope dropdowns (Branch, Product Group, Item Category, Customer) are real master data (`branchApi`, `productGroupApi`, `useListItemCategoriesQuery`, `customerApi`); Run Forecast / Save Plan both call the backend. The only hardcoded piece in the file, `ORDER_CARD_META` (lines 41–46), is cosmetic icon/label/color metadata for the order-type cards, not substitute data. |
| Production Planning | Generate Order (sidebar entry) | `pages/productionPlanning/GenerateOrder.jsx` | none | none | **Static/Mock** | 384-byte placeholder stub (`ProductionPlanningPlaceholder`); no logic at all. |
| Production Planning | Generate Order – Forecast | `pages/productionPlanning/GenerateOrderForecast.jsx` | none | none | **Static/Mock** | 385-byte placeholder stub. |
| Production Planning | Generate Order – MRP | `pages/productionPlanning/GenerateOrderMrp.jsx` | none | none | **Static/Mock** | Zero API calls in a 29.7 KB file — this is a fully built, richly interactive UI (filters, MRP run table, selection, "Generate Orders" button that navigates to Generated Orders) with no backend wiring at all. No MRP computation, demand explosion, or order-generation endpoint exists anywhere in the backend. |
| Production Planning | Generate Order – Manual | `pages/productionPlanning/GenerateOrderManual.jsx` | none | none | **Static/Mock** | Same pattern as above — 27.9 KB, fully built UI, zero API calls, no backend support. |
| Production Planning | Generate Order – Sales Order | `pages/productionPlanning/GenerateOrderSalesOrder.jsx` | none | none | **Static/Mock** | Same pattern — 25 KB, fully built UI, zero API calls. Note: a real `SalesOrder` model and API exist elsewhere in the app (Sales module), but this screen does not call them; the sales-order list shown here is local mock data. |
| Production Planning | Generate Order – Project | `pages/productionPlanning/GenerateOrderProject.jsx` | none | none | **Static/Mock** | Same pattern — 23.7 KB, fully built UI, zero API calls, no backend `Project` concept exists in the schema at all. |
| Production Planning | Order Generation Option | `pages/productionPlanning/OrderGenerationOption.jsx` | none | none | **Static/Mock** | 29.1 KB, fully built UI, zero API calls. |
| Production Planning | Preview Order | `pages/productionPlanning/PreviewOrder.jsx` | none | none | **Static/Mock** | 364-byte placeholder stub. |
| Production Planning | Generated Orders *(not in previous audit's table)* | `pages/productionPlanning/GeneratedOrders.jsx` | none | none | **Static/Mock** | Explicitly documented in its own code comment (lines 26–38) as "a static, UI-only mock... Production/Purchase/Subcontracting/Job Work order documents from a Generate Order run have no backing data model in this schema." All rows (`HEADER_INFO`, `SUMMARY_CARDS`, `PRODUCTION_ORDERS`, `PURCHASE_ORDERS`, `TABS`, lines 40–72) are hardcoded. Reached only via a button on Generate Order – MRP / Order Generation Option, not from the sidebar. |
| Production Planning | Work Centers | `pages/productionPlanning/WorkCenters.jsx` | `GET/POST/PUT/DELETE production/work-centers` (backend/src/routes/productionMasters.js — route file covers BOM/Routing; Work Centers CRUD confirmed via `workCenterApi` in `productionApi.js`) | `WorkCenter` | **Fully Dynamic** | None found. Built in Phase A; full CRUD wired through `workCenterApi` (`createCrudApi`). |
| Production Planning | Bill of Materials | `pages/productionPlanning/BillOfMaterials.jsx` | `GET/POST/PUT/DELETE production/boms` (productionMasters.js lines 72–200) | `BillOfMaterial`, `BomLine` | **Fully Dynamic** | None found. Full CRUD + line items wired through `bomApi`. |
| Production Planning | Routing | `pages/productionPlanning/Routings.jsx` | `GET/POST/PUT/DELETE production/routings` (productionMasters.js lines 231–342) | `Routing`, `RoutingOperation` | **Fully Dynamic** | None found. Full CRUD + operations wired through `routingApi`. |
| Production Execution | Production Orders (list) | `productionExecution/ProductionOrders.jsx` | `GET production/orders`, `PATCH .../orders/:id/status`, `PATCH .../orders/:id/cancel` (productionOrders.js lines 49–265) | `ProductionOrder` | **Fully Dynamic** | None found for the actions it exposes. List, status advance (Release → In Progress → Completed → Closed), and Cancel all call real mutations (`productionOrderApi.useList()`, `useUpdateProductionOrderStatusMutation`). |
| Production Execution | Create Production Order | `productionExecution/CreateProductionOrder.jsx` | `POST production/orders` (productionOrders.js lines 79–186) | `ProductionOrder`, `ProductionOrderComponent`, `ProductionOrderOperation` | **Fully Dynamic** | None found. Product, Branch, Warehouse, BOM and Routing pickers are all real (`productApi`, `branchApi`, `warehouseApi`, `bomApi`, `routingApi`); creation snapshots the selected BOM's components and Routing's operations onto the new order server-side. |
| Production Execution | View Order | `productionExecution/ViewOrder.jsx` | `GET production/orders/:id`, `PATCH .../status`, `PATCH .../cancel` | `ProductionOrder`, `ProductionOrderComponent` | **Partially Dynamic** | Header fields and the **Components** tab are real (`productionOrderApi.useGet(id)`); status Advance/Close and Cancel are real mutations. By explicit design comment in the file (lines 22–30), the **Operations, Production Execution, Material Issue, Material Receipt, Production History, and Notes & Attachments tabs** all render "not available yet — this is planned for a later phase" (line 236) — no data, no API calls for any of them. `Produced Qty` is hardcoded to `0` with an inline comment "not tracked until the Record Production phase exists" (line 94). The header's Print, Copy, and (bottom-bar) Print buttons are present but `disabled` — non-functional placeholders, not broken features. |
| Production Execution | Operations | `productionExecution/Operations.jsx` | none | none | **Static/Mock** | Zero API calls in a 22.5 KB fully-built UI. No endpoint exists to read/update operation-level routing progress for a production order. |
| Production Execution | Production Execution (status tracking) | `productionExecution/ProductionExecutionStatus.jsx` | none | none | **Static/Mock** | Zero API calls, 23.9 KB fully-built UI. No backend concept of per-order execution status beyond the simple header `status` field already used in Production Orders/View Order. |
| Production Execution | Material Requisition | `productionExecution/MaterialRequisition.jsx` | none | none | **Static/Mock** | Zero API calls, 19.6 KB fully-built UI. No `MaterialRequisition` model exists in the schema. |
| Production Execution | Create Requisition | `productionExecution/CreateRequisition.jsx` | none | none | **Static/Mock** | Zero API calls, 17.9 KB fully-built UI. Same missing model as above. |
| Production Execution | Material Issue | `productionExecution/MaterialIssue.jsx` | none | none | **Static/Mock** | Zero API calls, 26.8 KB fully-built UI. `ProductionOrderComponent.issuedQty` already exists in the schema and is already displayed (read-only) on View Order's Components tab, but nothing writes to it — there is no issue/consume endpoint. |
| Production Execution | Create Issue | `productionExecution/CreateIssue.jsx` | none | none | **Static/Mock** | Zero API calls, 16.4 KB fully-built UI. Same missing write-path as above. |
| Production Execution | Material Receipt | `productionExecution/MaterialReceipt.jsx` | none | none | **Static/Mock** | Zero API calls, 22.1 KB fully-built UI. No corresponding model/route. |
| Production Execution | Record Production | `productionExecution/RecordProduction.jsx` | none | none | **Static/Mock** | Zero API calls, 26 KB fully-built UI. This is the screen View Order's own code comments point to as the still-missing piece that would make `Produced Qty` real. |
| Production Execution | Production History | `productionExecution/ProductionHistory.jsx` | none | none | **Static/Mock** | 367-byte placeholder stub. |
| Production Execution | Product Cost | `productionExecution/ProductCost.jsx` | none | none | **Static/Mock** | Zero API calls, 19.4 KB fully-built UI. No production-costing model/route exists. |
| Production Execution | Rework & Scrap | `productionExecution/ReworkScrap.jsx` | none | none | **Static/Mock** | 354-byte placeholder stub. |
| Production Execution | Production Completion | `productionExecution/ProductionCompletion.jsx` | none | none | **Static/Mock** | Zero API calls, 28.3 KB fully-built UI (the largest static screen in either module). No completion/yield-posting endpoint exists. |
| Production Execution | Production Closure | `productionExecution/ProductionClosure.jsx` | none | none | **Static/Mock** | 367-byte placeholder stub. |
| Production Execution | Reports | `productionExecution/Reports.jsx` | none | none | **Static/Mock** | 355-byte placeholder stub. |
| Production Execution | Notes & Attachments | `productionExecution/Notes.jsx` | none | none | **Static/Mock** | Zero API calls, 22.3 KB fully-built UI. No notes/attachments model tied to `ProductionOrder` exists. |

---

## 2. Totals

| Module | Screens Inspected | Fully Dynamic | Partially Dynamic | Static/Mock | Needs Verification |
|---|---|---|---|---|---|
| Production Planning | 14 | 4 (29%) | 0 | 10 (71%) | 0 |
| Production Execution | 16 | 2 (12%) | 1 (6%) | 13 (81%) | 0 |
| **Combined** | **30** | **6 (20%)** | **1 (3%)** | **23 (77%)** | **0** |

(Production Planning's 14 = Dashboard, Forecast, 8 Generate-Order screens, Generated Orders, Work Centers, BOM, Routing. Production Execution's 16 = the 15 screens under `productionExecution/` plus the list screen's own Create flow counted once each; Production Orders list and Create Production Order are counted as the 2 Fully Dynamic.)

Everything classified Fully Dynamic here was built or rewired specifically in the Phase A manufacturing foundation work (Work Centers, BOM, Routing, Production Orders, Create Production Order) plus Forecast, which was built as real from the start. Everything else in these two modules remains exactly the UI-only mock state it was built in during an earlier phase — none of it has silently regressed or been quietly wired since.

## 3. Every Hardcoded/Mock Dataset and Where It Lives

- `ProductionPlanningDashboard.jsx` lines 40–131: `KPI_CARDS`, `ORDER_STATUS_DATA`, `PLANNED_VS_COMPLETED`, `PRODUCTION_TREND`, `TOP_ORDERS`, `MACHINE_UTILIZATION`, `MATERIAL_AVAILABILITY`, `QUALITY_SUMMARY`, `PRODUCTION_ALERTS`, plus `ALERT_ICON`/`ALERT_COLOR` lookup maps.
- `GeneratedOrders.jsx` lines 40–72: `HEADER_INFO`, `SUMMARY_CARDS`, `PRODUCTION_ORDERS`, `PURCHASE_ORDERS`, `TABS` — explicitly documented in the file's own comment as permanent mock data (no backing model exists for a "Generate Order run" result).
- `GenerateOrderMrp.jsx`, `GenerateOrderManual.jsx`, `GenerateOrderSalesOrder.jsx`, `GenerateOrderProject.jsx`, `OrderGenerationOption.jsx`: each is a large (23–30 KB), fully laid-out screen whose entire table/list/filter data is local component state seeded from hardcoded arrays — not yet enumerated field-by-field here since none of it reaches an API at all (confirmed by a zero-match grep for any query/mutation hook in every one of these files).
- `GenerateOrder.jsx`, `GenerateOrderForecast.jsx`, `PreviewOrder.jsx`, `ProductionHistory.jsx`, `ReworkScrap.jsx`, `Reports.jsx`, `ProductionClosure.jsx`: all are 350–390-byte placeholder stubs rendering `ProductionPlanningPlaceholder` with no data of any kind.
- `Operations.jsx`, `ProductionExecutionStatus.jsx`, `MaterialRequisition.jsx`, `CreateRequisition.jsx`, `MaterialIssue.jsx`, `CreateIssue.jsx`, `MaterialReceipt.jsx`, `RecordProduction.jsx`, `ProductCost.jsx`, `ProductionCompletion.jsx`, `Notes.jsx`: each is a large, fully-built UI (16–28 KB) with local-state-only mock data and zero API calls.
- `ViewOrder.jsx` line 94: `producedQty` is hardcoded to the literal `0` (with an inline comment explaining it isn't tracked yet) rather than coming from any real aggregate.

Two constants are **not** mock substitute data and were double-checked for that reason: `Forecast.jsx`'s `ORDER_CARD_META` (icon/label/color only, feeding real counts) and `ViewOrder.jsx`'s `STATUS_COLOR`/`TABS` (presentation config, not business data).

## 4. Missing APIs, Backend Routes, Database Models, CRUD Operations and Workflows

No database model or backend route exists today for any of the following, confirmed by inspecting `backend/src/routes/productionPlanning.js`, `productionMasters.js`, and `productionOrders.js` in full (these are the only three route files mounted for this module, per `backend/src/app.js`):

- MRP calculation / demand explosion against BOMs and sales orders (needed by Generate Order – MRP, Order Generation Option).
- Any order-generation workflow that would create real Production/Purchase/Subcontracting/Job Work orders from a plan (needed by all 8 "Generate Order" screens and Generated Orders).
- Operation-level execution tracking against `RoutingOperation`/`ProductionOrderOperation` (needed by Operations and the View Order "Operations" tab).
- Material requisition and material issue/receipt against `ProductionOrderComponent` — the `issuedQty` column already exists and is already displayed read-only, but there is no write path (needed by Material Requisition, Create Requisition, Material Issue, Create Issue, Material Receipt).
- Production output/yield recording, i.e. anything that would update a real "Produced Qty" (needed by Record Production, and directly referenced by View Order's hardcoded `producedQty = 0`).
- Production costing (needed by Product Cost).
- Rework/scrap recording (needed by Rework & Scrap).
- Production completion and closure workflows distinct from the existing simple status field (needed by Production Completion, Production Closure).
- Production-specific reporting (needed by the Production Execution "Reports" screen — unrelated to the fully-dynamic Reports module audited separately under Sales/Purchase/Inventory/etc.).
- Notes/attachments tied to a `ProductionOrder` (needed by Notes & Attachments).
- A dedicated manufacturing-dashboard aggregation endpoint (needed by Production Planning Dashboard).

## 5. Screens Already Correctly Connected to the Database

- **Forecast** — real Sales Invoice history aggregation, real forecast calculation, real persistence (`ForecastPlan`).
- **Work Centers** — full CRUD (`WorkCenter`).
- **Bill of Materials** — full CRUD with line items (`BillOfMaterial`/`BomLine`).
- **Routing** — full CRUD with operations (`Routing`/`RoutingOperation`).
- **Production Orders (list)** — real list, real status-advance and Cancel mutations (`ProductionOrder`).
- **Create Production Order** — real creation with real BOM/Routing snapshotting onto the new order.
- **View Order** — real for its header fields, status actions, and Components tab only (Partially Dynamic, not a gap in what Phase A promised — it's exactly the Phase A scope boundary, documented in the file itself).

## 6. Prioritized, Phased Plan

This mirrors the production-module portion of the plan from the full-project audit, with file-level specifics added:

**Phase B — Material flow (builds directly on Phase A's `ProductionOrderComponent` snapshots, no schema changes to existing tables needed beyond new models):**
1. Material Requisition + Create Requisition — new `MaterialRequisition` model/route; UI already built, just needs wiring.
2. Material Issue + Create Issue — new issue/consume endpoint that writes to the existing `ProductionOrderComponent.issuedQty` column (already in schema, currently read-only).
3. Material Receipt — new model/route for receiving issued/returned material.

**Phase C — Output tracking (the piece View Order's own code already anticipates):**
4. Record Production — new output-recording endpoint; this is what would replace View Order's hardcoded `producedQty = 0` with a real aggregate.
5. Operations — operation-level progress tracking against `ProductionOrderOperation`, surfaced on both this screen and the View Order "Operations" tab.
6. Production Execution (status) — likely foldable into the Record Production + Operations work rather than a separate model.

**Phase D — Close-out:**
7. Production Completion, Production Closure, Rework & Scrap, Product Cost — completion/yield/scrap/costing workflows, each depending on Phase C's output data.
8. Production History, Notes & Attachments, Reports — reporting/audit-trail layer over the Phase B/C/D data once it exists.

**Phase E — Planning/MRP (the largest, most structurally new piece — no existing model to extend):**
9. The 8 "Generate Order" screens + Generated Orders + the Production Planning Dashboard all depend on a genuine MRP/demand-explosion engine that doesn't exist in any form today. Given the amount of already-built, reference-matched UI waiting for a backend, this should be scoped and approved as its own dedicated phase, the same way Phase A was — not attempted as an incidental add-on to Phase B/C/D.

No code, schema, or data changes were made in this audit — this plan is for your review and approval before any implementation work begins.
