# Nexora Kemach — Phase 1 (MRP & Order Generation) — Implementation Report

Date: 2026-10-09
Scope: exactly the approved Phase 1 scope (MRP, Generation Orders, real Production/Purchase Order creation). Production Execution remediation was **not** started, per instruction.

All files below have been written directly into the real project at `D:\Projects\Nexora_Kemach` on your computer (verified by re-reading the files back from the device after committing). Nothing has been applied to any database.

## 1. Schema changes (additive only)

Four new tables added to `backend/src/prisma/schema.prisma`, appended after `ProductionOrderOperation`. Nothing existing was altered.

- `ProductionMrpRun` (`production_mrp_runs`) — one row per MRP run.
- `ProductionMrpRequirement` (`production_mrp_requirements`) — one row per item per run, with gross requirement / available / in-progress / on-hold / net-to-generate, and `coveredByGoNo` once actioned.
- `ProductionGenerationOrder` (`production_generation_orders`) — the "GO" batch document.
- `ProductionGenerationOrderLine` (`production_generation_order_lines`) — its lines, with `resultOrderType/resultOrderId/resultOrderNo` once orders are generated.

**Migration SQL** (not yet applied — awaiting your explicit approval, per your instructions):
`backend/src/prisma/migrations/20261009150000_add_production_mrp_and_generation_orders/migration.sql`

It follows this project's standard pattern: wrapped in `BEGIN TRY/BEGIN TRAN … COMMIT TRAN` with rollback on error, and every `CREATE TABLE`/`CREATE INDEX`/`ALTER TABLE ADD CONSTRAINT` guarded by an `IF NOT EXISTS` check, so it's safe to run even if partially applied before. Please review it (full text in that file) and tell me when to run `npx prisma migrate deploy` (or however your team applies migrations) against your target database — I have not run it anywhere.

**Verification gap:** `npx prisma validate` could not be run in this environment — the schema-engine binary download from `binaries.prisma.sh` is blocked (403) by this sandbox's network policy, both via the staged backend copy and via a fresh `npx prisma` install. As a substitute I manually verified brace-balance (135 open / 135 close) and checked every new field against this schema's own conventions (snake_case `@map`, explicit `@db.Decimal`, named `@default`/FK constraints) by comparison with neighboring models. Please run `npx prisma validate` and `npx prisma format` yourself before applying the migration, as a final check I could not complete here.

## 2. Backend changes

| File | Change |
|---|---|
| `backend/src/services/mrpService.js` | **New file.** All MRP/Generation Order logic: `classifyProduct`, `computeProductRequirement`, `listOpenSalesOrderLines`, `runMrp`, `getMrpRun`, `getItemDetail`, `createGenerationOrder`, `getGenerationOrder`, `updateGenerationOrder`, `generateOrders`, `getDashboardStats`. |
| `backend/src/routes/productionPlanning.js` | 10 new routes added (listed below). |
| `backend/src/routes/productionOrders.js` | Extracted the existing POST `/orders` body into `createProductionOrderRecord(body, user)` and exported it, so MRP's "Generate Orders" reuses the exact same BOM/Routing-snapshot logic as a manually created Production Order. The route itself is otherwise unchanged. |
| `backend/src/routes/resources.js` | Exported the already-existing internal `createPurchaseOrderRecord` helper (one line added), so MRP's "Generate Orders" reuses the exact same Purchase Order creation/tax/numbering logic. No other change to this file. |
| `backend/src/services/documentNumberService.js` | Registered a new document type `GO` ("Generation Order", prefix `GO`, module Production, transaction-scoped) in the catalog and its table source. **An admin must configure a numbering series for `GO` under Company Setup → Document Numbering before the first Generation Order can be saved** — identical to the existing requirement for `PRO`. |

### New API endpoints (all under `/api/production-planning`, all `auth()`-protected)

- `GET /open-sales-order-lines` — open Sales Order lines (qty − delivered), for Generate Order - Sales Order.
- `POST /mrp-runs` — runs MRP, persists a run + requirement rows.
- `GET /mrp-runs` — list, for dropdowns.
- `GET /mrp-runs/:id` — one run + its requirements.
- `GET /mrp-runs/:id/items/:productCode/detail` — BOM/Routing detail for the MRP side panel.
- `GET /items/:productCode/detail` — same BOM/Routing detail, usable with no MRP run in context (Generate Order - Manual).
- `POST /generation-orders` — creates a Draft Generation Order from selected lines.
- `GET /generation-orders/:id` — one Generation Order + its lines.
- `PUT /generation-orders/:id` — edits a Draft Generation Order's header/lines (blocked once Completed).
- `POST /generation-orders/:id/generate` — creates the real Production/Purchase Orders (the only state-changing step).
- `GET /dashboard-stats` — real order-status counts + 6-month planned-vs-completed trend.

## 3. Calculation rules actually implemented

For each product with open demand:

```
Gross Requirement = open Sales Order qty not yet delivered
                   + saved Forecast Plan demand in the run's horizon
Already Covered   = on-hand stock + open Purchase Order qty not yet received
In Progress       = open (Planned/Released/In Progress) Production Order qty
On Hold           = 0  (no "On Hold" status exists on Production Order — decision 3: not invented)
Net to Generate   = max(0, Gross Requirement − Already Covered − In Progress − On Hold)
```

Stock/order figures are read from `utils/productInventory.js`'s existing `getProductInventory()` — the same function already powering the Available Balance report and Product Master's Inventory tab — reused as-is rather than reimplemented, which is also how cancelled/closed/delivered documents are correctly excluded from the start.

Make vs. Buy is classified at read time, never stored: an active default BOM → Production; else a default supplier on the product → Purchase; else Unclassified (shown, but blocked from generation until master data is fixed). **Subcontracting and Job Work are not modeled anywhere in this schema and are not offered as generation outcomes** — their panels throughout the UI are shown visibly but disabled/empty, per decision 1.

Generate Order - Sales Order and Generate Order - Forecast are **direct conversions** of the quantities you select (no MRP netting) — matching their own on-screen descriptions ("based on open Sales Order quantity" / "forecast / planned demand"), and distinct from Generate Order - MRP, which is the netted calculation above.

## 4. Frontend screens connected to real data

| Screen | Status |
|---|---|
| Generate Order - MRP | Real: run MRP, browse requirements, BOM/Routing side panel, create Generation Order. |
| Generate Order - Manual | Real: select from Product Master, BOM/Routing preview, create Generation Order (sourceType Manual). |
| Generate Order - Sales Order | Real: open Sales Order lines (qty − delivered), create Generation Order (sourceType SalesOrder). |
| Generate Order - Forecast | Real: your saved Forecast Plans, select lines, create Generation Order (sourceType Forecast). |
| Generate Order - Project | **Left visible-but-disabled**, per decision 5 — there is no Project concept anywhere in this schema (no Project model, no project field on Sales Order). Wiring it would require designing that concept first, which is out of this phase's scope. |
| Order Generation Options | Real: shows the actual Generation Order's Production/Purchase lines, lets you edit qty/date, "Generate Orders" calls the real endpoint. Subcontracting/Job Work tabs always show empty, not simulated. |
| Generated Orders | Real: shows the real created Production/Purchase Order numbers from a completed Generation Order. |
| Generate Order (sidebar entry) | Now redirects straight to Generate Order - MRP instead of an empty placeholder. |
| Production Dashboard | **Partially real**, per the approved plan's own Section 6: the Production Order Status pie chart, open-order count, and the 6-month Planned vs Completed trend are real (`GET /dashboard-stats`). Machine Utilization, Material Availability, Quality Summary and Production Alerts have **no backing data model anywhere in this schema** (no Machine, QC/Inspection, or alerting tables) — they are left as clearly labeled "Sample data" rather than removed or faked as real, explicitly out of scope for this phase. |
| Preview Order | Left as the existing honest placeholder — it wasn't part of the four-screen "golden path" and has no clear design of its own; flagging this so you can tell me if you want it built out too. |

## 5. Safeguards — confirmed

- **No GL postings, anywhere in this feature.** `mrpService.js` never references any ledger/accounting table.
- **No inventory/Stock table writes, and no stock reservation.** All stock figures are read-only via the existing `getProductInventory()`. Decision 2 honored.
- **No "On Hold" status invented.** Hardcoded to 0 with an explanatory comment (decision 3).
- **Lead time:** no `leadTime` field exists anywhere in the schema (confirmed by search) — there is no supplier lead-time data to use, so none is displayed as if it existed; this was the documented fallback per decision 4.
- **Subcontracting/Job Work:** visible, disabled, never simulated, anywhere (decision 1).
- **Generate Order – Project:** visible but disabled (decision 5).
- **Idempotency:** a Generation Order can only be generated once (`status === 'Completed'` guard); the MRP requirements it was built from are stamped `coveredByGoNo`; and a later MRP run's own "Already Covered"/"In Progress" figures will already reflect the newly created orders — three independent layers against double-generation.
- **Transactions:** Generation Order creation, its edits, and "Generate Orders" (order creation + result-stamping + MRP requirement covering + status update) are each wrapped in `prisma.$transaction`.
- **No unrelated module changes.** Only two pre-existing files outside the new feature were touched, both minimally and explained above: `productionOrders.js` (one function extracted and exported, logic untouched) and `resources.js` (one export line added, logic untouched).
- **Existing functionality preserved.** Forecast, BOM, Work Centers, Routing and Production Orders routes/logic were not modified beyond the one extraction above.
- **Full actual project used**, not a staging copy — confirmed by re-staging two of the written files from the device after commit and checking their contents matched.

## 6. Tests

This project has no automated test suite (no test runner configured in `backend/package.json`, no test files found). In its absence I verified:

- `node --check` passed on all 5 touched/added backend JavaScript files.
- All 9 touched/added frontend `.jsx` files parse cleanly (`esbuild --jsx=automatic`).
- Manual brace-balance check on the edited `schema.prisma` (135/135).
- Re-staged two committed files from the device post-commit and confirmed their content matched what was intended.

**Could not be completed:** `npx prisma validate`/`prisma format` (network-blocked in this sandbox, as above — please run these yourself before migrating), and no live run against your actual SQL Server database (no database connection available from this environment) — so runtime behavior (the MRP calculation against your real data, document-numbering series prompt, and the actual `generateOrders()` transaction) has not been exercised end-to-end. I'd recommend testing in a non-production environment first:
1. Apply the migration.
2. Configure a numbering series for document type `GO`.
3. Run MRP, confirm the numbers look right against known open Sales Orders/stock.
4. Create a small Generation Order and generate orders from it, confirming the resulting Production/Purchase Orders look correct and no GL/stock entries appear anywhere.

## 7. Next steps needing your decision

- **Migration approval** — please confirm when/where to run the migration SQL above; I have not applied it anywhere.
- Whether you want **Preview Order** built out as a real read-only preview of a Draft Generation Order (not part of the original four-screen flow, so I left it as-is).
- Whether a future phase should design the **Project** concept so Generate Order - Project can be wired for real.
