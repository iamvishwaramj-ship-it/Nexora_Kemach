BEGIN TRY

BEGIN TRAN;

-- AlterTable: tax_codes -- SAP B1 India-style Tax Code Master rework.
-- effective_from is the new header date field; the nine *_account_id
-- columns are per tax-group (SGST/CGST/IGST) Sales/Purchase/RCM G/L account
-- mappings, alongside the sales_account_id/purchase_account_id pair added in
-- 20260828120000_add_tax_code_gl_accounts (left in place, unused, rather
-- than dropped -- SQL Server column drops on a table with data are best done
-- deliberately, not as a side effect of this migration).
ALTER TABLE [dbo].[tax_codes] ADD [effective_from] DATE NULL;
ALTER TABLE [dbo].[tax_codes] ADD [sgst_sales_account_id] INT NULL;
ALTER TABLE [dbo].[tax_codes] ADD [sgst_purchase_account_id] INT NULL;
ALTER TABLE [dbo].[tax_codes] ADD [sgst_rcm_account_id] INT NULL;
ALTER TABLE [dbo].[tax_codes] ADD [cgst_sales_account_id] INT NULL;
ALTER TABLE [dbo].[tax_codes] ADD [cgst_purchase_account_id] INT NULL;
ALTER TABLE [dbo].[tax_codes] ADD [cgst_rcm_account_id] INT NULL;
ALTER TABLE [dbo].[tax_codes] ADD [igst_sales_account_id] INT NULL;
ALTER TABLE [dbo].[tax_codes] ADD [igst_purchase_account_id] INT NULL;
ALTER TABLE [dbo].[tax_codes] ADD [igst_rcm_account_id] INT NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
