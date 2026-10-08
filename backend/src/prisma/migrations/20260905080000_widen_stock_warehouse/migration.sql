BEGIN TRY

BEGIN TRAN;

-- [dbo].[Stock].[Warehouse] was NVARCHAR(8) — a leftover from an earlier
-- design that expected short warehouse codes. Every warehouse code this
-- application actually issues is a full string like 'NEXORAWAREHOUSE1',
-- so postStockEntries (utils/stockTable.js, see fitWarehouse) was silently
-- clipping every value to its first 8 characters before writing it here.
--
-- Two warehouses that share the same first 8 characters (e.g.
-- 'NEXORAWAREHOUSE1' and 'NEXORAWAREHOUSE2', both clipping to 'NEXORAWA')
-- therefore collided onto the same journal key. valuationByWarehouse in
-- utils/productInventory.js reads this column back keyed by that same
-- 8-character prefix (see journalKey there), so Product Master's Inventory
-- tab showed ONE warehouse's Avg Price / FIFO Price on BOTH warehouses'
-- rows whenever their codes shared a prefix — quantities were unaffected
-- (those come from the separate, unclipped stockLedger.js read path), only
-- the valuation columns were wrong.
--
-- Widened to NVARCHAR(150) to match every other warehouse column in this
-- schema (DeliveryChallan.fromWarehouse, GoodsReceivedNoteItem.warehouse,
-- StockTransferItem.fromWarehouse/toWarehouse, ...), so a warehouse code of
-- any length written from here on is stored in full and cannot collide with
-- another. Rows written before this migration, under the old 8-character
-- clipping, keep whatever ambiguous value they already have — there is no
-- way to recover which of two colliding warehouses an already-clipped row
-- belonged to after the fact.

ALTER TABLE [dbo].[Stock] ALTER COLUMN [Warehouse] NVARCHAR(150) NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
