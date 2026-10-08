BEGIN TRY

BEGIN TRAN;

-- Inventory Opening Balance: per-line "Manage By" (Batch | Serial | Standard).
-- Only Batch lines carry a Batch No. Nullable, so existing rows are untouched
-- (the page derives it for them from their batch number / Product Master).
IF COL_LENGTH(N'[dbo].[opening_balance]', N'manage_by') IS NULL
    ALTER TABLE [dbo].[opening_balance] ADD [manage_by] NVARCHAR(20) NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
