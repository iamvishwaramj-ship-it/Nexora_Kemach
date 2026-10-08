BEGIN TRY

BEGIN TRAN;

-- AlterTable: AccountTypes
-- Which financial statement this account type rolls up into: 'Balance Sheet'
-- (assets, liabilities, equity) or 'Profit & Loss' (income, costs, expenses).
--
-- Guarded with IF NOT EXISTS because this column may already have been added
-- by hand outside Prisma. Without the guard, `migrate deploy` would fail with
-- "Column names in each table must be unique" on any database where the
-- manual ALTER had already run, and that failure would then block every later
-- migration. With the guard the migration is safe either way: it adds the
-- column where it's missing and quietly does nothing where it isn't.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[AccountTypes]') AND name = 'FinancialStatement'
)
BEGIN
    ALTER TABLE [dbo].[AccountTypes]
      ADD [FinancialStatement] VARCHAR(30) NOT NULL
          CONSTRAINT [DF_AccountTypes_FinancialStatement] DEFAULT 'Balance Sheet';
END;

-- Same guard for the CHECK: a hand-run ALTER may have created the column
-- without it. EXEC() defers compilation, which is required whenever a
-- statement references a column added earlier in the same batch — SQL Server
-- binds the whole batch up front and Prisma sends each migration as one batch.
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_AccountTypes_FinancialStatement')
BEGIN
    EXEC('ALTER TABLE [dbo].[AccountTypes] ADD CONSTRAINT [CK_AccountTypes_FinancialStatement] CHECK ([FinancialStatement] IN (''Balance Sheet'',''Profit & Loss''))');
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
