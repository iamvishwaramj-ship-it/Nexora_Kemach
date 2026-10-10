# Phase 1 Audit — Button Functionality Across 4 Modules

Project: `D:\Projects\Nexora_Kemach`
Scope: Production Planning, Production Execution, Subcontracting, Quality
Status: **Audit only. No files were changed.**

---

## 0. How this was done

67 screens were inspected:

- Production Planning (top-level): 15 files
- Production Execution: 26 files (3 of these — `ProductionOrders.jsx`, `CreateProductionOrder.jsx`, `ViewOrder.jsx`, the real Production Order CRUD/lifecycle screens — were read in full personally, line by line, given they're the explicitly protected area; the other 23 were audited by a dedicated sub-agent)
- Subcontracting: 12 files
- Quality: 14 files

For each screen, every clickable control was checked against the actual code: does it have a handler, does that handler call a real API or do real client-side work, or is it a stub/disabled/no-op. I then cross-checked the backend (`backend/src/routes/`) and the frontend API layer (`frontend/src/features/`) to confirm which document types have a real database model + API and which don't, rather than guessing from the UI alone.

**Headline finding:** Production Planning (BOM, Routing, Work Centers, Forecast, MRP, Order Generation, and the Production Order list/create/view/lifecycle screens) has a real, working backend and the large majority of its buttons already work correctly. Production Execution's transactional screens, the entire Subcontracting module, and the entire Quality module are visual mockups with **no backend data model or API of any kind** — confirmed by grepping the backend routes and the frontend feature files. That changes what "Phase 2" can realistically mean for those three areas, explained in §4.

---

## 1. Module: Production Planning (15 files) — already in very good shape

BOM (`BillOfMaterials.jsx`) and Routing (`Routings.jsx`) are built on `bomApi`/`routingApi` (real CRUD via `createCrudApi`) — Create/Edit/Delete/Save all call real endpoints and work correctly (**A**). `WorkCenters.jsx` uses the shared `MasterCrudPage` component wired to `workCenterApi` (**A**, standard working pattern). `Forecast.jsx`'s Run Forecast and Save Plan call real backend compute/persist endpoints (**A**). The whole MRP / Generate Order pipeline (`GenerateOrderMrp.jsx`'s Run MRP, `GenerateOrderManual/Forecast/SalesOrder.jsx`'s Review & Generate Orders, `OrderGenerationOption.jsx`'s Save Changes and Generate Orders) calls real, working mutations (`useRunMrpMutation`, `useCreateGenerationOrderMutation`, `useUpdateGenerationOrderMutation`, `useGenerateOrdersMutation`) that create real Production/Purchase Orders — all confirmed working (**A**) and **not** recommended for any further changes.

The only non-working buttons here are **intentionally disabled by design**, each with an explanatory code comment or tooltip (not bugs): `Forecast.jsx`'s Copy Plan / Import from Excel / Preview Orders / Generate Orders; `ProductionPlanningDashboard.jsx`'s New Production Order; `GenerateOrderProject.jsx` (no "Project" entity exists in the schema yet — a previously-approved scope line) and `PreviewOrder.jsx` (explicitly a "coming soon" placeholder). `ProductionPlanningDashboard.jsx`'s Machine Utilization / Material Availability / Quality Summary / Production Alerts widgets are clearly-labeled static sample data (also a documented, approved scope boundary).

**Recommendation: no Phase 2 work needed in this module.** Nothing is broken or misleadingly non-functional.

---

## 2. Module: Production Execution (26 files)

### 2a. The real, working part — Production Order list/create/view (personally verified)

`ProductionOrders.jsx`, `CreateProductionOrder.jsx`, `ViewOrder.jsx` — Create, Release/Advance, Close, Cancel Order, View, Back to List all call real backend endpoints and work correctly today (**A**): confirmed `PATCH /production/orders/:id/status` and `PATCH /production/orders/:id/cancel` both exist and are wired correctly. **These will not be touched.**

Genuine small gaps found here, all fixable without touching the lifecycle logic itself:
| Item | Classification | Fix |
|---|---|---|
| Filter card fields (Order No., Item Code, From/To Date, Plant, Production Type, Project, Sales Order, Customer, Work Center) + its Search/Clear buttons | **B** | These fields are rendered but never applied — only the separate list-header search box and Status dropdown actually filter. Wire Search/Clear to apply all filter fields to the already-loaded order list, client-side. |
| "Filter" button (list header) | Unclear purpose | Ask — see §5 |
| Export (list header) | **C** | `frontend/src/lib/simpleXlsx.js` already exists and is used elsewhere in the app for exactly this; wire it to export the visible order rows. |
| Edit (list page bottom bar + ViewOrder.jsx bottom bar), enabled only when status = Planned, but has no handler at all | **C** | Backend already supports this: `PUT /production/orders/:id` lets a Planned order's Planned Start Date / Due Date / Warehouse / Branch / Notes be edited (qty/BOM/routing are deliberately not editable there, by backend design). `productionOrderApi.useUpdate()` already exists. Needs a small edit form (could be an inline dialog on ViewOrder.jsx, reusing the same fields). Flagging since it's a new (small) UI element, not just wiring — see §5. |
| Import from Excel, Copy, Print (all three places this appears) | **D** | No import/print backend exists for orders. Recommend leaving disabled/decorative, consistent with how Production Planning already handles similarly out-of-scope buttons. |

### 2b. Everything else in Production Execution — confirmed zero backend

A dedicated audit of the other 23 files (Material Issue, Material Receipt, Material Requisition, Create Issue, Create Requisition, Create Rework Entry, Rework & Scrap, Production Completion, Production Closure, Record Production, Operations, Notes, Product Cost, Production Execution Status, and all the *Report.jsx screens) found **zero RTK Query / API imports anywhere** — every one of these is a static UI mock. Confirmed: there is no `MaterialIssue`, `MaterialReceipt`, `MaterialRequisition`, `ReworkScrap`, `ProductionCompletion`, or `ProductionClosure` model or route anywhere in the backend.

What does work today, all local-state-only (**A**, since it's a legitimate client-side action, just not persisted anywhere): "Add Item" row-adders on the Create screens, row selection, the Operations tab's row/chip selection, and `Reports.jsx`'s category-card navigation plus `ReworkScrap.jsx`'s "Create Entry" navigation.

Everything else — every Save/Submit/Approve/Issue/Complete/Close/Export/Print/Upload/Import/Scan button across these 23 screens — is a no-op (**D**), because the document types themselves don't exist in the database. This is not a small gap; it's the entire transactional layer of Production Execution. See §4 for what this means for scope.

One thing worth a conscious decision rather than a silent fix: **Production Closure's "Close Production Order", Production Completion's "Complete Production", and Record Production's "Submit Production"**, plus the kebab-menu items on `MaterialRequisition.jsx` (Approve/Issue Material/Reject) and `ProductionCompletion.jsx` (Mark Completed/Post to Inventory/Cancel Completion) would, if ever implemented, need to write to the *same* `ProductionOrder` record the explicitly-protected lifecycle already governs (status, produced qty) and potentially post inventory movements. I have not touched these and recommend they stay out of this button-wiring pass entirely — see §5.

---

## 3. Modules: Subcontracting (12 files) and Quality (14 files) — same pattern

Both modules were confirmed to have **no backend at all** (no route file, no feature API file, no model) — every Subcontract Order/Issue/Inward/Bill/Inspection and every Quality Inspection/NCR/CAPA is a static mock array. This was expected (I built the Quality screens myself to pixel-match your screenshots, explicitly as static UI).

The good news: both modules share a common, very fixable pattern of **frontend-only (B)** gaps that don't need any backend and can be fixed safely right now:

| Pattern | Where it recurs | Fix |
|---|---|---|
| Reset / Search buttons on filter cards don't filter the table below | Nearly every list screen in both modules | Wire Search to filter the local mock array by the filter fields; wire Reset to clear them |
| Pagination / Records-per-page controls update state but the table never re-slices | Same screens | Slice the mock array locally by the already-tracked page/pageSize state |
| Print buttons (header + row + detail) do nothing | Both modules, very widely | Wire to `window.print()` |
| "Delete selected" toolbar buttons on item/line tables don't remove the checked rows | Several New-record screens (New Subcontracting Order, New Bill, New Inward, New Issue, New Inspection, New NCR, New CAPA) | Wire to remove checked rows from local state |
| "Add Item / Add Characteristic / Add Action" row-adders are wired in some New-record screens but not their near-identical siblings | Quality: works in `NewInProcessInspection.jsx`, `NewInspectionPlan.jsx`, `QualityNewInspection.jsx`; missing in `NewCAPA.jsx`, `NewFinalInspection.jsx`, `NewNCR.jsx` | Backfill the same local-add pattern for consistency |
| Redundant row "Edit" pencil icons where the row's fields are already inline-editable | Several Subcontracting New-record screens | Low priority — remove or make it a no-op focus action |
| Dashboard/report "Work Center" or report-type selectors update local state but don't actually filter the displayed charts/table | `QualityDashboard.jsx`, `SubcontractingReports.jsx` | Wire the selector to the already-rendered mock data |

The one case that's genuinely **C** (existing backend, just not wired here): **Quality → New Inspection → "Import from GR"**. A real Goods Receipt Note API already exists (`GET/POST /purchase/grn`, used elsewhere in the Purchase module) — this button could pull real GRN line items instead of being a no-op.

Everything that actually needs to **persist** a record — every Save, Save & New, Submit, Approve, and every attachment Upload — is **D**: there is no NCR, CAPA, Inspection, Subcontract Order, Subcontract Issue, Subcontract Inward, or Subcontract Bill model or API anywhere. See §4.

A few items need a quick decision rather than a guess (listed in §5): the Accept/Reject/Put On Hold/Rework buttons on Quality's inspection detail panels, "Generate PDF" in Subcontracting Reports, and the "Scan (Barcode)" buttons.

---

## 4. The important scope point

Rule 9 of your brief says new backend/API work needs your explicit approval, explained first. Here's the honest shape of what the audit found:

- **Production Planning**: essentially nothing to do. Already works.
- **Production Execution's lifecycle screens** (Production Orders list/create/view): a handful of small B/C fixes (filter wiring, Export via an existing utility, a small Edit form reusing an existing endpoint). Safe, contained, no schema changes.
- **Production Execution's other 23 screens, all of Subcontracting, and all of Quality**: a large, genuinely useful batch of **B fixes** (filtering, pagination, print, delete-row, add-row consistency — all frontend-only, zero risk to anything else) that I can do in Phase 2 right now. But the Save/Submit/Approve buttons in these same screens are **D** — not a handful of edge cases, but effectively the entire transactional backend for three modules (new database models and API routes for Material Issue, Material Receipt, Material Requisition, Rework & Scrap, Production Completion, Production Closure, Subcontract Orders/Issues/Inward/Bills/Inspections, and Quality Inspections/NCR/CAPA).

Building that backend is not "making an existing button work" — it's building the modules those buttons were designed for, module by module, each its own project with its own data-model and workflow decisions. I don't think it's something to wave through as one line-item inside this task, and your rules ask me to explain and get approval before any schema/API change anyway. My recommendation: treat the **B and C fixes** below as Phase 2 of this task (they make every currently-dead-but-backend-independent button behave correctly, with no risk to anything working today), and treat the **D items** as a separate, later conversation — prioritized screen by screen, once you decide which of these modules should get real persistence first.

---

## 5. Items needing a decision before I plan them (not guessing per your rules)

1. **Quality: Accept / Reject / Put On Hold / Rework** buttons on the Final/Incoming/In-Process Inspection detail panels — should clicking these flip the row's status chip locally (visibly works, but nothing is actually saved anywhere), or should they stay inert until there's a real backend, so nothing *looks* saved when it isn't?
2. **Production Execution: Edit** on Production Orders (list + view, status = Planned only) — I'd propose a small inline edit dialog for the 5 fields the backend already allows editing (Planned Start/Due Date, Warehouse, Branch, Notes), reusing the existing `PUT /production/orders/:id` endpoint. This is a new small UI element (not a new screen), flagging per your rule 7.
3. **Production Execution: "Filter" button** in `ProductionOrders.jsx`'s list header — unclear what it's meant to do (a filter panel toggle? something else?). Will leave alone unless you tell me its intent.
4. **Production Execution: Production Closure "Close Production Order", Production Completion "Complete Production", Record Production "Submit Production", and the Approve/Issue Material/Reject and Mark Completed/Post to Inventory/Cancel Completion menu items** — these would need to write to the same `ProductionOrder` record your protected lifecycle governs, and potentially post inventory. Recommend these stay out of scope entirely for now — confirm you agree.
5. **Subcontracting: "Generate PDF"** (`SubcontractingReports.jsx`) — a real generated PDF (needs backend, D) or a client-side "print current view to PDF" via the browser (B, no backend)?
6. **Subcontracting: "Scan (Barcode)"** buttons (3 screens) — real scanner/hardware integration (D, out of scope) or a manual barcode-text-entry field (B)?
7. **Quality: backfill "Add Item/Characteristic/Action"** into `NewCAPA.jsx`, `NewFinalInspection.jsx`, `NewNCR.jsx` so they behave the same as their siblings — OK to do as part of Phase 2 B-fixes?

---

## 6. Proposed Phase 2 scope (pending your approval)

If you approve, Phase 2 would cover **only** these, with nothing else touched:

- Production Execution (Production Orders screens only): wire the filter card, add Export via the existing `simpleXlsx.js` utility — (Edit form pending your answer to §5.2)
- Production Execution, Subcontracting, Quality (all other screens): fix Reset/Search filtering, pagination slicing, Print via `window.print()`, "Delete selected" row removal, and (pending §5.7) the Add-row consistency backfill in Quality — all frontend-only, no schema/API/model changes, nothing persisted that wasn't persisted before
- Quality → New Inspection → wire "Import from GR" to the existing `/purchase/grn` API

Everything in §5 stays unplanned until you answer; everything flagged **D** in the full per-screen tables (available on request — the sub-agent audits that produced this report are very detailed per button) is excluded from Phase 2 and left exactly as it is today.

Waiting for your go-ahead before changing anything.
