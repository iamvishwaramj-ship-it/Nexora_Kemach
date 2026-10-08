BEGIN TRY

BEGIN TRAN;

-- AlterTable: PurchaseOrder — "Other Details" on the Purchase Order form was
-- reworked to a Billing Type / Purchase Type classification pair (both
-- fixed-option/CFL selects) in place of the old free-text/print-only block,
-- and "Supplier & Document Details" gained a Ship From counterpart to the
-- existing Ship To field.
ALTER TABLE [dbo].[purchase_orders] ADD [ship_from] NVARCHAR(150) NULL;
ALTER TABLE [dbo].[purchase_orders] ADD [billing_type] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[purchase_orders] ADD [purchase_type] NVARCHAR(20) NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
