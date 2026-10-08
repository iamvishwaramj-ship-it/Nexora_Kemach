BEGIN TRY

BEGIN TRAN;

-- AlterTable: GoodsReceivedNoteItem — previously_received is removed
-- outright (frontend, backend, and now the column itself), per request. It
-- was always submitted as 0 by the client (Copy From hardcoded it, and a
-- manually added row defaulted to it too), so it never actually tracked
-- real prior-receipt history. assertNoOverReceipt in
-- backend/src/routes/resources.js now compares received_quantity directly
-- against po_quantity instead of summing it with previously_received first.
-- The column carries a named DEFAULT constraint, so that has to be dropped
-- before the column itself.
ALTER TABLE [dbo].[goods_received_note_items] DROP CONSTRAINT [DF_goods_received_note_items_previously_received];
ALTER TABLE [dbo].[goods_received_note_items] DROP COLUMN [previously_received];

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
