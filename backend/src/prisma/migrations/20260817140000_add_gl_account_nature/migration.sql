BEGIN TRY

BEGIN TRAN;

-- AlterTable: ChartOfAccounts
-- Adds the G/L Account Details choice shown at the top of the account form:
-- 'T' = Title (a heading that groups the accounts beneath it, never posted to
-- directly), 'A' = Active Account (a real posting account). Existing rows
-- default to 'A', which is what every account created before this migration
-- effectively was.
ALTER TABLE [dbo].[ChartOfAccounts]
  ADD [AccountNature] CHAR(1) NOT NULL CONSTRAINT [DF_ChartOfAccounts_AccountNature] DEFAULT 'A';

-- EXEC() for the same reason as the BalanceType/AccountTypeID constraints in
-- 20260817130000: SQL Server binds a whole batch before running any of it, so
-- referencing [AccountNature] directly here would fail to compile even though
-- the ADD above will have run by the time this executes. Prisma sends each
-- migration file as one batch (no GO support), so EXEC defers compilation.
EXEC('ALTER TABLE [dbo].[ChartOfAccounts] ADD CONSTRAINT [CK_ChartOfAccounts_AccountNature] CHECK ([AccountNature] IN (''T'',''A''))');

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
