BEGIN TRY

BEGIN TRAN;

-- AlterTable: ChartOfAccounts.ParentAccountID
--
-- Was an INT FK to the parent row's own surrogate AccountID. Converted here
-- to store the parent's AccountCode instead (VARCHAR(20), matching
-- ChartOfAccounts.AccountCode itself), with FK_ChartOfAccounts_Parent
-- re-pointed at AccountCode's own unique constraint
-- (UQ_ChartOfAccounts_AccountCode) instead of the primary key — see model
-- ChartOfAccount in schema.prisma. Existing rows are backfilled from their
-- current numeric parent before the column is dropped and rebuilt under the
-- same name, so no parent linkage is lost; a row with no parent (NULL) stays
-- NULL throughout.
--
-- Guarded with IF EXISTS/IF NOT EXISTS throughout so this migration is safe
-- to run again (e.g. after a partial failure) without erroring on state it
-- already produced.
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ChartOfAccounts_Parent')
BEGIN
    ALTER TABLE [dbo].[ChartOfAccounts] DROP CONSTRAINT [FK_ChartOfAccounts_Parent];
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ChartOfAccounts]') AND name = 'ParentAccountCode')
BEGIN
    ALTER TABLE [dbo].[ChartOfAccounts] ADD [ParentAccountCode] VARCHAR(20) NULL;
END;

-- The statement below reads [ParentAccountCode], added by the ALTER TABLE
-- ... ADD immediately above. SQL Server binds an entire batch before
-- executing any of it, so a direct reference to a column added earlier in
-- the same batch fails to compile with "Invalid column name" even though it
-- will exist by the time the statement runs — same EXEC() workaround used in
-- 20260817130000_update_chart_of_accounts.
EXEC('
    UPDATE c
    SET c.[ParentAccountCode] = p.[AccountCode]
    FROM [dbo].[ChartOfAccounts] c
    INNER JOIN [dbo].[ChartOfAccounts] p ON p.[AccountID] = c.[ParentAccountID]
    WHERE c.[ParentAccountID] IS NOT NULL AND c.[ParentAccountCode] IS NULL
');

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ChartOfAccounts]') AND name = 'ParentAccountID')
BEGIN
    ALTER TABLE [dbo].[ChartOfAccounts] DROP COLUMN [ParentAccountID];
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ChartOfAccounts]') AND name = 'ParentAccountCode')
   AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ChartOfAccounts]') AND name = 'ParentAccountID')
BEGIN
    EXEC sp_rename '[dbo].[ChartOfAccounts].[ParentAccountCode]', 'ParentAccountID', 'COLUMN';
END;

-- AddForeignKey
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ChartOfAccounts_Parent')
BEGIN
    EXEC('ALTER TABLE [dbo].[ChartOfAccounts] ADD CONSTRAINT [FK_ChartOfAccounts_Parent] FOREIGN KEY ([ParentAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountCode])');
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
