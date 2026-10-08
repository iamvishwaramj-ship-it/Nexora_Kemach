BEGIN TRY

BEGIN TRAN;

-- Empty ChartOfAccounts and rename ParentAccountID -> ParentAccountCode
-- (same VARCHAR(20) NULL type; only the name changes, matching what it's
-- actually held since the account-code migration).
--
-- Deliberately NOT a literal DROP TABLE + CREATE TABLE. GLAccountDeterminations
-- holds ~50 real DB-level FOREIGN KEY constraints against
-- ChartOfAccounts([AccountID]) (see migrations
-- 20260821180000_add_gl_account_determination and
-- 20260821200000_add_gl_account_determination_extra_roles). A literal drop
-- would have to tear all 50 of those down first (SQL Server refuses to drop
-- a table that any FK still references) and rebuild them afterwards against
-- whatever new AccountID values the re-imported rows happen to get -- real
-- risk of silently orphaning an existing GL Account Determination
-- configuration for zero benefit, since none of those 50 FKs touch
-- ParentAccountID at all. A DELETE + column rename reaches the exact same
-- end state (an empty ChartOfAccounts with the column renamed) without
-- going anywhere near that machinery.
--
-- DELETE rather than TRUNCATE: SQL Server refuses TRUNCATE TABLE on any
-- table that is the target of a FOREIGN KEY constraint from another table,
-- regardless of whether a row currently uses it -- which is exactly this
-- table's situation because of the GLAccountDeterminations FKs above. If
-- this DELETE fails with an FK violation, it means at least one GL Account
-- Determination row still points at a real ChartOfAccounts row -- clear
-- those fields (or the whole determination row) and re-run.
DELETE FROM [dbo].[ChartOfAccounts];

-- Reseed the IDENTITY column back to 0, same as removeChartOfAccounts.js,
-- so the very next row created (the OACT import) starts at AccountID 1
-- instead of continuing from wherever it last left off.
DBCC CHECKIDENT ('dbo.ChartOfAccounts', RESEED, 0);

EXEC sp_rename '[dbo].[ChartOfAccounts].[ParentAccountID]', 'ParentAccountCode', 'COLUMN';

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
