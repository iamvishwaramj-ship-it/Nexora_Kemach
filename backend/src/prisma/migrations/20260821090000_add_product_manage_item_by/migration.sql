BEGIN TRY

BEGIN TRAN;

-- AlterTable: products.manage_item_by
--
-- Backs the "Manage Item By" select on Product Master (None / Batch /
-- Serial). Defaulted to 'None' rather than left NULL-with-no-default so
-- every existing product — which was never tracked at batch or serial level
-- — reads as the correct, explicit value instead of a blank the UI has to
-- paper over.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'manage_item_by'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [manage_item_by] NVARCHAR(20) NULL CONSTRAINT [DF_products_manage_item_by] DEFAULT 'None';
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
