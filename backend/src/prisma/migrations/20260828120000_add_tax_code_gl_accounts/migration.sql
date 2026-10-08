BEGIN TRY

BEGIN TRAN;

-- AlterTable: tax_codes -- which G/L account this tax code posts to on the
-- Sales side and on the Purchase side. Set from GL Account Determination
-- (Sales > Tax / Purchasing > Tax, one row per Tax Code -- replaces the
-- earlier fixed CGST/SGST/IGST rows that briefly lived directly on
-- GLAccountDeterminations) or edited from the Tax Code screen itself; both
-- write the same two columns here.
ALTER TABLE [dbo].[tax_codes] ADD [sales_account_id] INT NULL;
ALTER TABLE [dbo].[tax_codes] ADD [purchase_account_id] INT NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
