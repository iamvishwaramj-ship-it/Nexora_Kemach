BEGIN TRY

BEGIN TRAN;

-- AlterTable: product_batches / product_serials
--
-- Extends the "Batches - Setup" / "Serial Numbers - Setup" dialog to Stock
-- Receipt, alongside Purchase GRN. Each row is created from exactly one
-- source document line, so a second nullable FK is added rather than
-- reusing grn_item_id for both — Prisma has no native polymorphic relation,
-- and NULLing out an unrelated grn_item_id to repurpose it for a Stock
-- Receipt row would make the column mean two different things depending on
-- which is set.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[product_batches]') AND name = 'stock_receipt_item_id'
)
BEGIN
    ALTER TABLE [dbo].[product_batches] ADD [stock_receipt_item_id] INT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_product_batches_stock_receipt_item')
BEGIN
    ALTER TABLE [dbo].[product_batches]
        ADD CONSTRAINT [FK_product_batches_stock_receipt_item]
        FOREIGN KEY ([stock_receipt_item_id]) REFERENCES [dbo].[stock_receipt_items]([id])
        ON DELETE CASCADE;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[product_serials]') AND name = 'stock_receipt_item_id'
)
BEGIN
    ALTER TABLE [dbo].[product_serials] ADD [stock_receipt_item_id] INT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_product_serials_stock_receipt_item')
BEGIN
    ALTER TABLE [dbo].[product_serials]
        ADD CONSTRAINT [FK_product_serials_stock_receipt_item]
        FOREIGN KEY ([stock_receipt_item_id]) REFERENCES [dbo].[stock_receipt_items]([id])
        ON DELETE CASCADE;
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
