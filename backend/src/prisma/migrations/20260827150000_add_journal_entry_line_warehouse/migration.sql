BEGIN TRY

BEGIN TRAN;

-- AlterTable: JournalEntryLine — which warehouse this posting line belongs
-- to. Populated only by the G/L posting engine for a document whose own
-- lines are warehouse-scoped (Purchase GRN's per-item warehouse — see
-- GoodsReceivedNoteItem.warehouse and POSTING_SCHEMAS[PURCHASE_GRN] in
-- utils/glPosting.js). Null on every manual entry and on every existing row
-- written before this column existed. Purely a traceability/display column
-- for the Journal Entry Lines view — it plays no part in account
-- determination or balancing.
ALTER TABLE [dbo].[journal_entry_lines] ADD [warehouse] NVARCHAR(150) NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
