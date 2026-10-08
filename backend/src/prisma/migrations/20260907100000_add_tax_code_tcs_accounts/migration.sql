BEGIN TRY

BEGIN TRAN;

-- AlterTable: TaxCode — Tax Type now also offers 'GST+TCS' / 'IGST+TCS',
-- which add a third "TCS" row (flat 1%, alongside SGST+CGST or IGST) to the
-- Tax Code Master's Tax Details table. Same Sales/Purchase/RCM Tax Account
-- triplet as SGST/CGST/IGST already have, just for the new TCS row.
ALTER TABLE [dbo].[tax_codes] ADD [tcs_sales_account_id] INT NULL;
ALTER TABLE [dbo].[tax_codes] ADD [tcs_purchase_account_id] INT NULL;
ALTER TABLE [dbo].[tax_codes] ADD [tcs_rcm_account_id] INT NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
