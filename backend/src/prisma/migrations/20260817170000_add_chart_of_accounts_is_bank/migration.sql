BEGIN TRY

BEGIN TRAN;

-- AlterTable: ChartOfAccounts
-- Marks a G/L account as a bank account (the "Bank" tick beside Control
-- Account on the Add Account form). Existing rows default to 0 — none of them
-- were flagged as bank accounts before this column existed.
--
-- Guarded so the migration is safe to apply to a database where the column was
-- already added by hand: an unguarded ADD would fail and block every later
-- migration.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[ChartOfAccounts]') AND name = 'IsBankAccount'
)
BEGIN
    ALTER TABLE [dbo].[ChartOfAccounts]
      ADD [IsBankAccount] BIT NOT NULL CONSTRAINT [DF_ChartOfAccounts_IsBankAccount] DEFAULT 0;
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
