BEGIN TRY

BEGIN TRAN;

-- AlterTable: PurchaseOrder — "Other Details" gained a third classification
-- field, Sales Type (fixed-option/CFL select: Cash Sales, Credit Sales, Cash
-- Purchase, Credit Purchase), alongside billing_type/purchase_type added in
-- the previous migration.
ALTER TABLE [dbo].[purchase_orders] ADD [sales_type] NVARCHAR(20) NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
