BEGIN TRY

BEGIN TRAN;

-- AlterTable: currency_masters — symbol becomes optional. Some currencies
-- (or a quick add before deciding on a symbol) don't need one, so this
-- column no longer requires a value the way currency_code/currency_name do.
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[currency_masters]') AND name = 'symbol' AND is_nullable = 0
)
BEGIN
    ALTER TABLE [dbo].[currency_masters] ALTER COLUMN [symbol] NVARCHAR(10) NULL;
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
