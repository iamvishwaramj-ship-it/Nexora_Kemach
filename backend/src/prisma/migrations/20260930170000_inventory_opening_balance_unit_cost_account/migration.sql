BEGIN TRY

BEGIN TRAN;

-- Inventory Opening Balance: Unit Cost (DLP price) per line and the document's
-- Opening Balance Account (credit side of its journal entry). Safe for existing
-- rows: unit_cost defaults to 0, opening_balance_account is nullable.
IF COL_LENGTH(N'[dbo].[opening_balance]', N'unit_cost') IS NULL
    ALTER TABLE [dbo].[opening_balance] ADD [unit_cost] DECIMAL(18,4) NOT NULL CONSTRAINT [DF_opening_balance_unit_cost] DEFAULT 0;

IF COL_LENGTH(N'[dbo].[opening_balance]', N'opening_balance_account') IS NULL
    ALTER TABLE [dbo].[opening_balance] ADD [opening_balance_account] NVARCHAR(20) NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
