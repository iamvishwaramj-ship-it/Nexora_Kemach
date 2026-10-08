BEGIN TRY

BEGIN TRAN;

-- AlterTable: GLAccountDeterminations -- company-wide DEFAULT CGST/SGST/IGST
-- accounts for Sales and Purchasing (always exactly 3 rows each side, never
-- one per Tax Code). A specific Tax Code's own Sales/Purchase/RCM account
-- (tax_codes.*_sales_account_id etc. -- see 20260828130000) takes priority
-- over these when both are set; these are the fallback.
--
-- Guarded with COL_LENGTH checks: an earlier draft of this migration (since
-- deleted/redesigned) may have already added one or more of these columns
-- directly to the database without Prisma recording it, so this must not
-- assume a clean table.
IF COL_LENGTH('dbo.GLAccountDeterminations', 'SalesCgstAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [SalesCgstAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'SalesSgstAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [SalesSgstAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'SalesIgstAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [SalesIgstAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'PurchaseCgstAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [PurchaseCgstAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'PurchaseSgstAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [PurchaseSgstAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'PurchaseIgstAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [PurchaseIgstAccountID] INT NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
