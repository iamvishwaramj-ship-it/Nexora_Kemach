BEGIN TRY

BEGIN TRAN;

-- AlterTable: stock_transfers — add to_branch. transferType 'Branch
-- Transfer' now splits the single Branch field into two: the existing
-- `branch` column doubles as "From Branch" and this new column is
-- "To Branch". For a plain 'Stock Transfer' this stays null/unused and
-- `branch` keeps its original single meaning.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfers]') AND name = 'to_branch')
BEGIN
    ALTER TABLE [dbo].[stock_transfers] ADD [to_branch] NVARCHAR(150) NULL;
END;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
