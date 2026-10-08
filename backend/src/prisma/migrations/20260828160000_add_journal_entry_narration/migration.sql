BEGIN TRY

BEGIN TRAN;

-- AlterTable: JournalEntry — free-text narration typed on a manual entry,
-- replacing "Reference No." as the header's free-text field on the Journal
-- Entry form. reference_no is left in place (still shown as the "Reference"
-- column in the list/detail views and still populated for
-- system-generated entries).
ALTER TABLE [dbo].[journal_entries] ADD [narration] NVARCHAR(MAX) NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
