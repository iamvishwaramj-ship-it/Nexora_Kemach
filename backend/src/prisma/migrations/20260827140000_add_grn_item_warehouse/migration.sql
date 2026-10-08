BEGIN TRY

BEGIN TRAN;

-- AlterTable: GoodsReceivedNoteItem — which warehouse THIS LINE receives
-- into, so a single GRN can put different products into different
-- warehouses instead of every line sharing the header's one warehouse.
--
-- Nullable, and stays null on every row written before this column existed:
-- resolveItemAccount and postStockEntries both already fall back to the
-- header's own [warehouse] for a line that names none (see toGrnItemData /
-- grnLines in routes/resources.js and the lineWarehouse fallback in
-- utils/stockTable.js — the same fallback StockTransferItem's
-- fromWarehouse/toWarehouse already rely on). GoodsReceivedNote.warehouse
-- itself is unchanged and stays required on the form: it is still the
-- default a new line is seeded with, and the fallback for any line that
-- somehow has none.
ALTER TABLE [dbo].[goods_received_note_items] ADD [warehouse] NVARCHAR(150) NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
