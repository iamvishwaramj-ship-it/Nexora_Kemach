# Phase 1 Implementation Plan — MRP & Order Generation

Production Planning module, Nexora Kemach ERP. **Planning document only — no code, schema, or data has been changed.** This plan is grounded in the actual live project (schema.prisma, the existing `production-planning`/`production-masters`/`production-orders` routes, and the 10 already-built reference-design screens), re-read directly from `D:\Projects\Nexora_Kemach` for this plan. It is meant for your review and sign-off before any implementation work starts.

---

## 1. What Phase 1 covers, and one scope decision that needs your call before I start

Phase 1 replaces the hardcoded data in these 10 screens with a real MRP engine and real order generation, without touching Forecast, BOM, Work Centers, Routing, or Production Orders (list/view/create), which all already work correctly and must keep working exactly as they do today:

Dashboard, Generate Order (sidebar stub), Generate Order – MRP, Generate Order – Manual, Generate Order – Sales Order, Generate Order – Forecast, Generate Order – Project, Order Generation Option, Preview Order, Generated Orders.

**Scope decision needed:** every one of these 10 screens' reference design includes "Subcontracting Order" and "Job Work Order" as generation targets, alongside Production Order and Purchase Order. I checked the full schema and the full 133-screen application (from the earlier full-project audit) and confirmed **no Subcontracting or Job Work document type exists anywhere in this ERP** — not as a Prisma model, not as a route, not as a screen outside this static mock. Building those would mean designing two entirely new document types (header + line models, numbering, routes, and likely their own screens) from scratch — that's a materially different, much larger undertaking than "connect the MRP engine to the two order types that already exist."

My recommendation: **Phase 1 generates real Production Orders and real Purchase Orders only.** The Subcontracting/Job Work cards, tabs, and counts stay visible in the UI exactly as designed, always showing 0/empty (exactly as they do today whenever there's genuinely nothing of that type), with a short inline note that they're not yet available — so nothing in the reference design is removed, it just has nothing to show until a later phase builds those document types on purpose. If you'd rather Phase 1 include Subcontracting and/or Job Work order generation, say so and I'll revise this plan to add those two document types to the data model and API sections below before anything is built.

Everything below assumes the recommendation above; I'll flag the two places it would change if you choose otherwise.

---

## 2. What the 10 screens actually need (extracted from their reference-design code)

I re-read every large static file in full rather than guessing from the audit's earlier summary. Each screen's hardcoded constants double as a precise functional spec:

- **MRP run**: a named, dated run (`MRP-2026-10-01`) that produces a list of finished-good requirements with columns MRP Req. Qty, Already Covered, In Progress, On Hold, Net Qty to Generate, UOM, Required Date, and a Suggested Order Type per item.
- **Generate Order – MRP**: picks an existing MRP run, lets the user select a subset of its net requirements, and for the selected item shows its BOM components (with Make/Buy/Subcontract per component) and its Routing operations in a side panel.
- **Generate Order – Manual / Sales Order / Forecast / Project**: four alternate ways to arrive at the same "selected items + quantities + dates" starting point for order generation — Manual is free item pick, Sales Order pulls from open Sales Order quantity, Forecast pulls from a saved Forecast Plan (already real), Project has no backing concept in this schema at all today.
- **Order Generation Option**: given a selected set of items, groups them by suggested order type (Production/Purchase), lets the user edit quantity/date/priority per line, shows validation messages (BOM/Routing present, vendor available, stock/order check), and triggers "Generate Orders."
- **Generated Orders**: a results screen showing the Production Orders and Purchase Orders that were actually created by a generation run, with their real document numbers.
- **Dashboard**: aggregate KPIs across production orders (status counts, planned-vs-completed, production trend, machine utilization, material availability, quality, alerts) — I recommend building the subset that has real data behind it today (order counts/status/trend from `ProductionOrder`) and explicitly deferring the subset that needs data this phase doesn't produce (machine utilization, quality summary — no such data exists anywhere in the schema yet).

## 3. Calculation rules

**Net requirement, per finished-good item, for a given planning horizon:**

```
Gross Requirement   = sum of open Sales Order quantity not yet delivered (SalesOrderItem.quantity − deliveredQuantity)
                     + sum of saved Forecast Plan demand for that item in the horizon (existing ForecastPlan data)
Available           = current on-hand stock (Stock ledger: sum(inQty) − sum(outQty) for the item/warehouse)
                     + open Purchase Order quantity not yet received (PurchaseOrderItem.quantity − receivedQuantity, if tracked — see note below)
                     − already-reserved quantity (open Sales Order quantity already counted above should not double-count against stock reserved for it; reservation logic needs a precise rule, see Open Question #1 in Section 8)
In Progress         = sum of open (Planned/Released/In Progress) ProductionOrder.orderQty for that productCode
On Hold             = sum of open ProductionOrder.orderQty where status is held (no "On Hold" status exists on ProductionOrder today — Open Question #2)
Net to Generate      = max(0, Gross Requirement − Available − In Progress) MINUS already-covered quantity from a prior, not-yet-actioned MRP run for the same item/horizon, so re-running MRP doesn't double-count
```

**Make vs. Buy vs. Subcontract classification, per item**, derived automatically rather than stored as a new manual field (keeps Product Master untouched):
- If the item has an active `BillOfMaterial` (status = Active) → **Make** (suggested order type: Production Order).
- Else if the item has a `defaultSupplier` set on `Product` → **Buy** (suggested order type: Purchase Order).
- Else → flagged as "Unclassified" in the MRP result, shown but not selectable for generation, with a validation message telling the user to add a BOM or a default supplier for that item.
- Subcontract classification is out of scope per the Section 1 decision; BOM-line-level Make/Buy/Subcontract tags shown in the MRP side panel use the same Make/Buy rule recursively per component (a `BomLine` component with its own active BOM shows "Make", otherwise "Buy"; no schema change needed since this is computed at read time).

**Lead time / planned dates**: `RoutingOperation.standardTimeMins` gives operation-level timing but there's no item-level lead-time field today. Phase 1 will compute Planned Start Date as `Required Date − (sum of routing operation standard times, converted to days, with a configurable minimum of 1 day)` for Make items, and for Buy items will leave Planned/Expected Delivery Date as a manually-entered field on the generation screen (no purchase lead-time field exists on Product or BusinessPartner today, so this can't be computed automatically without adding one — flagged as Open Question #3, not required for Phase 1).

## 4. Data model (additive only — new tables, zero changes to existing columns)

Following this project's existing migration idiom (`IF NOT EXISTS (SELECT 1 FROM sys.tables ...)` guards, matching `WorkCenter`/`BillOfMaterial`/`Routing` conventions already in the schema):

- **`MrpRun`** — `id`, `runCode` (unique, e.g. `MRP-2026-10-01`), `runDate`, `horizonFromMonth`, `horizonToMonth`, `status` (`Draft`/`Completed`), `createdById`, `createdByName`, `createdAt`. One row per "Run MRP" action.
- **`MrpRequirement`** — `id`, `runId` (FK → MrpRun, cascade delete), `productCode`, `productName`, `uom`, `grossRequirement`, `availableQty`, `inProgressQty`, `onHoldQty`, `netToGenerate`, `requiredDate`, `suggestedOrderType` (`Production`/`Purchase`/`Unclassified`), `coveredByGoNumber` (nullable — set once a Generation Order consumes this requirement, so re-running MRP doesn't re-offer already-actioned lines). Mirrors exactly the table columns already built into Generate Order – MRP.
- **`GenerationOrder`** ("GO") — `id`, `goNumber` (unique, e.g. `GO-2026-10-001`), `sourceType` (`MRP`/`Manual`/`SalesOrder`/`Forecast`/`Project`), `sourceRunId` (nullable FK → MrpRun, or FK to ForecastPlan depending on source — see note below), `goDate`, `requiredDeliveryDate`, `plant`, `notes`, `status` (`Draft`/`Completed`), `createdById`, `createdByName`, `createdAt`. One row per completed "Generate Orders" action — this is what the Generated Orders screen lists and what Order Generation Option is building up to.
- **`GenerationOrderLine`** — `id`, `goId` (FK → GenerationOrder, cascade delete), `productCode`, `productName`, `uom`, `requiredQty`, `orderQty`, `orderType` (`Production`/`Purchase`), `plannedStartDate`, `dueDate`, `priority` (`Low`/`Normal`/`High`), `vendorCode` (nullable, Purchase lines only), `resultOrderType` (`ProductionOrder`/`PurchaseOrder`, nullable until generated), `resultOrderId` (nullable, the id of the actually-created ProductionOrder or PurchaseOrder), `resultOrderNo` (nullable, cached document number for fast display on Generated Orders without a join). This is the line-level record Order Generation Option edits and "Generate Orders" finalizes.

No changes to `ProductionOrder`, `BillOfMaterial`, `Routing`, `WorkCenter`, or `ForecastPlan` — `ProductionOrder` already has the `sourceType`/`baseType`/`baseNo`/`baseEntry`/`baseLine` columns reserved for exactly this purpose (confirmed in schema: the model's own code comment says "Populating these fields is Phase B (MRP/Generate Order) work; the columns exist from Phase A so no later migration is needed for them"). Generation will set `sourceType = 'MRP'` (or `'Manual'`/`'SalesOrder'`/`'Forecast'`) and `baseType = 'GenerationOrder'`, `baseNo = <goNumber>` on each `ProductionOrder` it creates — purely additive, no existing row or column touched. The equivalent fields already exist on `PurchaseOrder`/`PurchaseOrderItem` for the generated Purchase Orders (to be confirmed at implementation time by reading those models in full — not yet read in this plan).

A real "On Hold" status doesn't exist on `ProductionOrder` today (its `status` default is `Planned`, confirmed in schema); Phase 1 will not invent one — see Open Question #2.

## 5. APIs (all new; nothing existing changes)

All under the existing `production-planning` route prefix (`backend/src/routes/productionPlanning.js`), following its existing `auth()` + `asyncHandler` pattern:

- `POST /api/production-planning/mrp-runs` — runs the net-requirement calculation (Section 3) across all items with an active BOM or a default supplier, within a given horizon; persists an `MrpRun` + its `MrpRequirement` rows; returns the run.
- `GET /api/production-planning/mrp-runs` — list, for the "MRP Run" dropdown on Generate Order – MRP.
- `GET /api/production-planning/mrp-runs/:id` — the requirement table for Generate Order – MRP's Step 2 grid.
- `GET /api/production-planning/mrp-runs/:id/items/:productCode/detail` — BOM components + Routing operations + stock/order breakdown for the side panel.
- `POST /api/production-planning/generation-orders` — creates a `GenerationOrder` (Draft) + its `GenerationOrderLine` rows from a selected set of requirements/items (used by all four Generate Order entry screens, differentiated only by `sourceType`); returns the GO for Order Generation Option to edit.
- `PUT /api/production-planning/generation-orders/:id` — updates line quantities/dates/priority/vendor (Order Generation Option's inline edits).
- `POST /api/production-planning/generation-orders/:id/generate` — the real "Generate Orders" action: for each line, creates a real `ProductionOrder` (reusing the same creation logic already in `POST /api/production/orders`, including BOM/Routing snapshotting) or a real `PurchaseOrder`, stamps `GenerationOrderLine.resultOrderId/resultOrderNo`, marks the `GenerationOrder` status `Completed`, and marks the source `MrpRequirement` rows as covered. This is a single DB transaction so a partial failure can't leave some orders created and others not.
- `GET /api/production-planning/generation-orders/:id` — full detail for the Generated Orders screen.
- `GET /api/production-planning/dashboard-stats` — order status counts, planned-vs-completed, and production trend aggregated from real `ProductionOrder` rows (the subset of the Dashboard's 9 widgets that has real data available; see Section 2).

Exact field names and new-model column names above are a plan-stage proposal; small naming tweaks may happen at implementation time to match the project's existing conventions more closely (e.g. decimal precision, exact status-enum strings), but the shapes and scope will not change without telling you first.

## 6. Affected screens and exactly what changes in each

| Screen | Change |
|---|---|
| Production Planning Dashboard | Replace `KPI_CARDS`, `ORDER_STATUS_DATA`, `PLANNED_VS_COMPLETED`, `PRODUCTION_TREND` with `GET .../dashboard-stats`. `TOP_ORDERS`, `MACHINE_UTILIZATION`, `MATERIAL_AVAILABILITY`, `QUALITY_SUMMARY`, `PRODUCTION_ALERTS` have no real data source yet and are out of scope for Phase 1 — they'll stay as-is (flagged in the UI or left static) unless you want them removed instead; your call at implementation time. |
| Generate Order – MRP | Replace `METHODS`' hardcoded counts, `MRP_SUMMARY`, `REQUIREMENTS`, `BOM_COMPONENTS`, `SELECTED_ITEM`, `ORDER_PREVIEW_CARDS` with real calls to the MRP run/detail endpoints above. "Generate Orders" button creates a real `GenerationOrder` via `POST .../generation-orders` and navigates to Order Generation Option with its real id, instead of a bare route. |
| Generate Order – Manual | Replace its local item-picker mock with a real Product list + manual quantity/date entry, then the same `POST .../generation-orders` call with `sourceType: 'Manual'`. |
| Generate Order – Sales Order | Replace its mock sales-order list with real open `SalesOrder`/`SalesOrderItem` data (quantity − deliveredQuantity), then the same `POST .../generation-orders` call with `sourceType: 'SalesOrder'`. |
| Generate Order – Forecast | Replace its mock with a real picker over existing `ForecastPlan` data (already fully dynamic elsewhere in the app) and its saved results, then `POST .../generation-orders` with `sourceType: 'Forecast'`. |
| Generate Order – Project | No real "Project" concept exists anywhere in this schema. Recommend this screen either stays a documented static placeholder (same convention as `GeneratedOrders.jsx`'s own code comment) until a real Project module exists, or Phase 1 defines a minimal `sourceType: 'Project'` that's really just a manual/ad-hoc entry labeled "Project" — your call; not required to make the other 9 screens real. |
| Order Generation Option | Replace `HEADER_INFO`, `SCOPE_OPTIONS`, `PRODUCTION_ROWS`, `PURCHASE_ROWS`, `SUMMARY_CARDS`, `ITEM_WISE_ORDER_TYPE`, `VALIDATION_MESSAGES` with the real `GenerationOrder`/`GenerationOrderLine` returned by the APIs above; inline edits call `PUT .../generation-orders/:id`; "Generate Orders" calls `POST .../generation-orders/:id/generate` and navigates to Generated Orders with the real GO id (Subcontracting/Job Work tabs stay visible, always 0, per Section 1). |
| Preview Order | Currently a 364-byte stub; becomes a read-only preview of a Draft `GenerationOrder`'s lines before generation (reachable from Order Generation Option's existing "Preview Orders" button, which already navigates here but currently shows nothing real). |
| Generated Orders | Replace `HEADER_INFO`, `SUMMARY_CARDS`, `PRODUCTION_ORDERS`, `PURCHASE_ORDERS`, `TABS` with `GET .../generation-orders/:id`, showing the real created `ProductionOrder`/`PurchaseOrder` document numbers (with working "View" links into the real Production Orders / Purchase Order screens, both already fully dynamic). |

**Explicitly unchanged:** Forecast's own screen and APIs, BOM, Work Centers, Routing, Production Orders list/view, Create Production Order, and every other module in the application. The only write Phase 1 makes to an existing table is new rows in `ProductionOrder` (and `PurchaseOrder`) via the exact same creation path those already use today — no existing row is ever modified by this phase.

## 7. Migration plan

Two or more new, additive, idempotent migration files (one logical change per file, matching the two migrations already shipped this session for the warehouse/sales-category drift):
1. `..._add_mrp_runs_and_requirements` — creates `mrp_runs`, `mrp_requirements` tables.
2. `..._add_generation_orders` — creates `generation_orders`, `generation_order_lines` tables.

Both guarded with `IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE ...)` before each `CREATE TABLE`, matching the existing `WorkCenter`/`BillOfMaterial`/`Routing` migration style already in the project. No `ALTER TABLE` on any existing table. No data migration/backfill needed since these are brand-new, currently-empty concepts.

## 8. Open questions (need your decision before/at implementation; none of these block writing code for the parts they don't touch)

1. **Reservation logic**: should "Available" stock subtract quantity already reserved against open Sales Orders, to avoid promising the same stock twice? (Affects the exact Net Requirement formula in Section 3.) Recommend yes, but it needs a precise rule for what counts as "reserved" given there's no explicit reservation table today.
2. **"On Hold" status**: `ProductionOrder.status` has no On Hold value today. Recommend Phase 1's "On Hold" column in MRP results always shows 0 (there's genuinely nothing to put there yet) rather than inventing a new status value that the rest of the app (Production Orders list, View Order, status-advance logic) doesn't know about. Flag this as future scope if you want a real On Hold workflow.
3. **Lead time for Buy items**: no field exists today for "vendor lead time in days." Recommend leaving Expected Delivery Date as a manual entry for Buy items in Phase 1 rather than adding a new field to `Product`/`BusinessPartner` (keeps this phase from touching the Product/Partner masters at all); can be added in a later phase if wanted.
4. **Subcontracting / Job Work** — see Section 1; needs your explicit choice.
5. **Generate Order – Project** — see the table row above; needs your explicit choice on whether "Project" gets a real (if minimal) concept or stays a documented placeholder.

## 9. Tests

- **Unit tests** (backend, matching whatever test setup the project already uses — to be confirmed at implementation time, since no test suite was inspected in this audit): the net-requirement formula (Section 3) against hand-computed cases — zero demand, demand fully covered by stock, demand partially covered by an open Production Order, an item with no BOM and no default supplier (Unclassified path).
- **Integration tests**: `POST .../mrp-runs` → `POST .../generation-orders` → `PUT .../generation-orders/:id` → `POST .../generation-orders/:id/generate` end-to-end, asserting the resulting `ProductionOrder`/`PurchaseOrder` rows have correct `sourceType`/`baseType`/`baseNo` and that `GenerationOrderLine.resultOrderId` is stamped correctly; a second MRP run after generation must not re-offer already-covered requirements.
- **Regression tests on untouched functionality**: Forecast's existing preview/create/save flow, BOM/Routing/Work Centers CRUD, and Production Orders list/create/status-advance/cancel must all produce identical results before and after Phase 1 ships — these are the "keep intact" guarantees you asked for, and should be explicitly re-run (not just assumed) once Phase 1 code exists.
- **Manual QA pass** against each of the 10 screens' reference design once wired, confirming that every element that was previously hardcoded now reflects real data from a real MRP run, and that Subcontracting/Job Work (or whatever Section 1's decision lands on) display correctly as empty/unavailable rather than breaking.

---

No code, schema, or data changes have been made. The next step, once you've reviewed this and answered Section 1 and Section 8's open questions, is implementation — which I'll treat as a separate, explicitly-approved step.
