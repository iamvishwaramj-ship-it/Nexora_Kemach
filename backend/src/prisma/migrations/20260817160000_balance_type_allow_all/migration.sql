BEGIN TRY

BEGIN TRAN;

-- AlterTable: ChartOfAccounts
-- BalanceType gains a third value, 'A' (All), alongside 'D' (Debit) and
-- 'C' (Credit) — for an account that may legitimately carry either side.
-- The column is already CHAR(1), so only its CHECK constraint has to widen.
--
-- Dropped conditionally: on a database where the constraint was never created
-- (or was already replaced), an unguarded DROP would fail and block every
-- later migration.
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_ChartOfAccounts_BalanceType')
BEGIN
    ALTER TABLE [dbo].[ChartOfAccounts] DROP CONSTRAINT [CK_ChartOfAccounts_BalanceType];
END;

ALTER TABLE [dbo].[ChartOfAccounts]
  ADD CONSTRAINT [CK_ChartOfAccounts_BalanceType] CHECK ([BalanceType] IN ('D','C','A'));

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
