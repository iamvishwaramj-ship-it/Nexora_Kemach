BEGIN TRY

BEGIN TRAN;

-- AlterTable: product_serials
--
-- Reshapes the Serial Numbers - Setup dialog's columns to match the
-- requested template: Mfr Serial No / Serial No / Lot No / Expiration Date /
-- Mfr Date / Admission Date / Mfr Warranty Start / Mfr Warranty End /
-- Location. Replaces the generic batch_attribute_1/2 + details columns
-- (which stay as-is on product_batches — this reshape is serial-only) with
-- named columns that match what the dialog actually asks for.
--
-- Guarded per-column so this is safe whether or not the previous migration
-- (20260821100000_add_product_batch_serial_tables) has been applied yet.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[product_serials]') AND name = 'mfr_serial_no'
)
BEGIN
    ALTER TABLE [dbo].[product_serials] ADD [mfr_serial_no] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[product_serials]') AND name = 'lot_no'
)
BEGIN
    ALTER TABLE [dbo].[product_serials] ADD [lot_no] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[product_serials]') AND name = 'mfr_warranty_start'
)
BEGIN
    ALTER TABLE [dbo].[product_serials] ADD [mfr_warranty_start] DATE NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[product_serials]') AND name = 'mfr_warranty_end'
)
BEGIN
    ALTER TABLE [dbo].[product_serials] ADD [mfr_warranty_end] DATE NULL;
END;

-- Drop the columns the template doesn't use. Any data already entered under
-- the old shape (batch_attribute_1/2, details) is lost — acceptable here
-- because this feature has not shipped yet (no production GRN has ever
-- written a product_serials row).
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[product_serials]') AND name = 'batch_attribute_1'
)
BEGIN
    ALTER TABLE [dbo].[product_serials] DROP COLUMN [batch_attribute_1];
END;

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[product_serials]') AND name = 'batch_attribute_2'
)
BEGIN
    ALTER TABLE [dbo].[product_serials] DROP COLUMN [batch_attribute_2];
END;

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[product_serials]') AND name = 'details'
)
BEGIN
    ALTER TABLE [dbo].[product_serials] DROP COLUMN [details];
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
