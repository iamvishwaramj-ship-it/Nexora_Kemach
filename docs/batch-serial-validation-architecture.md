# Batch/Serial validation architecture (Item, Warehouse, Batch)

This is the reference the team asked for as "Part B" of the batch-tracking
initiative: a written formalization of the validation that **already
exists** across the codebase, confirming it already keys off (Item,
Warehouse, Batch) consistently — not a proposal for a new engine. No code
in this file's description was changed to write it; where a real gap was
found during the review that produced this document, it was fixed
separately (see "Known fix" below) and is reflected here as already
corrected.

There is no single `validateStockAvailability` function. Instead,
`backend/src/utils/businessRules.js` holds five small families of
functions, one per document *shape* (receive / issue / restock / relocate /
opening position), all resolving to the same underlying rule: a batch's
available quantity is scoped to **(batchNo, warehouse)**, never to batchNo
alone. That rule is enforced at the schema level —
`ProductBatch.@@unique([batchNo, warehouse])` — and every validation
function below is just that constraint, checked early with a readable error
instead of a raw DB violation.

## The core resolver

`findBatchRow(client, batchNo, warehouse)` and
`updateBatchQuantity(tx, batchNo, warehouse, delta)` are the shared
primitives every family below (and Opening Balance's own
`syncOpeningBalanceBatch` in `resources.js`) ultimately calls to find or
mutate the correct row. `findBatchRow` prefers the row that matches the
given warehouse exactly, falling back to any row for that batch number only
when there's nothing to go on — this is what lets a batch number legitimately
have more than one `ProductBatch` row (one per warehouse it currently has
stock in), which is what makes a partial Stock Transfer possible.

## Receive side — GRN, Stock Receipt

A receipt line's "Batches - Setup" / "Serials - Setup" dialog **creates**
new batch/serial records.

- `assertBatchSerialAllocation(client, items, { quantityField })` — the
  allocated quantity across a line's batches (or serial count) must equal
  the line's own received quantity. Runs before any DB write.
- `assertUniqueBatchesAndSerials(client, items, { excludeGrnId, excludeStockReceiptId, defaultWarehouse })` —
  a serial number must be unique system-wide; **a batch number is only
  checked for uniqueness within the same warehouse it's being received
  into** (matching `ProductBatch`'s own compound unique index). This function
  resolves each line's effective warehouse as
  `item.warehouse || defaultWarehouse || null` — callers pass their own
  document header's warehouse as `defaultWarehouse` (Stock Receipt has a
  header-level warehouse; GRN does not, so it's always `null` there and the
  line's own warehouse is authoritative).
- `toBatchCreateData`/`toSerialCreateData` (in `resources.js`) then create
  the rows via a nested Prisma write (`batches: { create: [...] }`), so
  `grnItemId`/`stockReceiptItemId` are set automatically and cascade-delete
  when the parent line is removed — no explicit reversal function is needed
  on delete/edit; the DB does it.

## Issue side — Delivery Challan, Stock Issue, Purchase Return, Purchase Credit Memo

A line's "Batches/Serial Numbers - Selection" dialog **selects from
existing** stock.

- `assertBatchSerialIssueAllocation` — selected quantity/serial count must
  equal the line's own issue quantity.
- `assertBatchSerialAvailability(client, items, { excludeChallanId, excludeStockIssueId, excludePurchaseReturnId, excludePurchaseCreditMemoId })` —
  this is the actual (Item, Warehouse, Batch) check: it resolves "available"
  per `${batchNo}::${item.warehouse}` key, not by summing every row that
  happens to share the batch number across every warehouse. A batch sitting
  in a different warehouse never counts towards this line's own warehouse.
- `applyBatchSerialIssueEffects` / `restoreBatchSerialIssueEffects` —
  decrement-on-save / increment-on-reverse, the reverse-then-repost pattern
  every edit path uses so re-saving a document doesn't double-count or lose
  the previous save's effect.

## Restock side — Sales Return, Sales Credit Memo

The mirror of the issue side: goods coming *back* into stock.
`assertBatchSerialRestockAllocation`/`assertBatchSerialRestockAvailability`/
`restoreBatchSerialRestockEffects`/`applyBatchSerialRestockEffects` are kept
as their own functions (not call-throughs) even though the shape matches
the issue side, so the two directions stay independently readable. Restock
availability only requires the named batch to *exist* (restocking only ever
increments `ProductBatch.quantity` — there's no "enough to restock" ceiling
the way there is an "enough to issue" floor).

## Relocate side — Stock Transfer

`assertBatchSerialRelocateAllocation` reuses
`assertBatchSerialIssueAllocation` directly (identical rule).
`assertBatchRelocationAvailable` is the (Item, Warehouse, Batch) check for a
transfer specifically: a line can move only the quantity actually sitting,
right now, in its own **From** warehouse — resolved via the same
`${batchNo}::${fromWarehouse}` keying as the issue side.
`assertRelocateWarehouseMatches` is a separate, narrower check (the
serial-side equivalent, since a serial has no quantity to split).
`applyBatchSerialRelocateEffects` is what actually creates the *second*
`ProductBatch` row for a partial transfer — moving part of a batch into a
new warehouse is exactly how a batch number ends up with more than one row.

## Opening position — Inventory Opening Balance

Added most recently (see the Opening Balance batch-tracking work). Has no
receive/issue shape of its own — it's a starting position, not a movement —
so it doesn't reuse any of the families above directly. Its own
`syncOpeningBalanceBatch` (in `resources.js`, beside the
`/opening-balance/batch` route) calls the same shared `findBatchRow`/
`updateBatchQuantity` primitives everything else uses, and the route itself
checks "Batch No. required for a Batch-managed item" against Product
Master's `manageItemBy`, the same check the page's own
`validateOpeningBalanceBatches` does client-side. Opening Balance never
creates a *duplicate* batch number concern the way GRN does, because its
own `(itemCode, warehouse, batchNo)` unique index is what stops a second
opening position for the same triple — it doesn't currently cross-check
against a batch number a GRN has already created into a *different*
warehouse (out of scope; would need the same treatment
`assertUniqueBatchesAndSerials` now gets, described next).

## Known fix folded into this review

While confirming the (Item, Warehouse, Batch) rule holds everywhere, GRN's
and Stock Receipt's `assertUniqueBatchesAndSerials` was found checking a
new batch number's uniqueness **system-wide**, with no warehouse filter —
inconsistent with `ProductBatch`'s actual `(batchNo, warehouse)` unique
index, and with every other family above. This meant receiving a batch
number into Warehouse B was wrongly rejected as "already exists" solely
because the same number already had a row in Warehouse A, even though that
is an explicitly supported scenario (a Stock Transfer creating exactly that
second row). This has been fixed: the check is now scoped per
`(batchNo, warehouse)`, using each line's own warehouse (falling back to
the document's header warehouse where one exists) — matching exactly the
warehouse `toBatchCreateData` actually writes the row with.

## Summary table

| Direction | Allocation/completeness check | Availability/uniqueness check | Apply | Reverse |
|---|---|---|---|---|
| Receive (GRN, Stock Receipt) | `assertBatchSerialAllocation` | `assertUniqueBatchesAndSerials` (per warehouse) | nested Prisma create | DB cascade on delete |
| Issue (DC, Stock Issue, Purchase Return, Purchase Credit Memo) | `assertBatchSerialIssueAllocation` | `assertBatchSerialAvailability` (per warehouse) | `applyBatchSerialIssueEffects` | `restoreBatchSerialIssueEffects` |
| Restock (Sales Return, Sales Credit Memo) | `assertBatchSerialRestockAllocation` | `assertBatchSerialRestockAvailability` (exists-only) | `applyBatchSerialRestockEffects` | `restoreBatchSerialRestockEffects` |
| Relocate (Stock Transfer) | `assertBatchSerialRelocateAllocation` | `assertBatchRelocationAvailable` + `assertRelocateWarehouseMatches` (per From warehouse) | `applyBatchSerialRelocateEffects` | `restoreBatchSerialRelocateEffects` |
| Opening position (Opening Balance) | Product Master `manageItemBy` check (route-level) | OpeningBalance's own `(itemCode, warehouse, batchNo)` unique index | `syncOpeningBalanceBatch` | same function, reverse-then-repost |

Every row in this table ultimately bottoms out at `findBatchRow`/
`updateBatchQuantity` to touch the actual `ProductBatch` row, which is what
keeps the (Item, Warehouse, Batch) rule uniform across all five directions
without a shared "engine" class or function — the formalization this
document provides.
