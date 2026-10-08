BEGIN TRY

BEGIN TRAN;

-- DropColumn: business_partner_opening_balances.branch — Branch was removed
-- from the Business Partner Lines grid on the BP Opening Balance form
-- (Company Setup > BP Opening Balance), its Excel template and its bulk
-- import, same round of cleanup as 20260918190000's own removals from this
-- same table. Nothing downstream (Outstanding rows, G/L posting) ever read
-- this column — it was descriptive-only on the line — so there is nothing
-- else to update alongside the drop, and it has no index of its own.
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[business_partner_opening_balances]') AND name = 'branch'
)
BEGIN
    ALTER TABLE [dbo].[business_partner_opening_balances] DROP COLUMN [branch];
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
