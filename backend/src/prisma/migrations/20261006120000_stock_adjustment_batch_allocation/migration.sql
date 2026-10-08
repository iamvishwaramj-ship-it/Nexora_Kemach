BEGIN TRY

BEGIN TRAN;

-- Stock Adjustment (Decrease lines) now takes batch quantity off a Batch-managed
-- item's batches automatically, earliest expiry first, and records what it took
-- so an edit or delete can give it back. This adds the nullable FK column the
-- allocation row uses to record which Stock Adjustment line it belongs to,
-- mirroring sales_invoice_item_id/stock_issue_item_id on the same table.

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[batch_allocations]')
      AND name = N'stock_adjustment_item_id'
)
BEGIN
    ALTER TABLE [dbo].[batch_allocations]
        ADD [stock_adjustment_item_id] INT NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'FK_batch_allocations_stock_adjustment_item'
      AND parent_object_id = OBJECT_ID(N'[dbo].[batch_allocations]')
)
BEGIN
    ALTER TABLE [dbo].[batch_allocations]
        ADD CONSTRAINT [FK_batch_allocations_stock_adjustment_item]
        FOREIGN KEY ([stock_adjustment_item_id])
        REFERENCES [dbo].[stock_adjustment_items] ([id])
        ON DELETE CASCADE;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_batch_allocations_stock_adjustment_item_id'
      AND object_id = OBJECT_ID(N'[dbo].[batch_allocations]')
)
BEGIN
    CREATE INDEX [IX_batch_allocations_stock_adjustment_item_id]
        ON [dbo].[batch_allocations] ([stock_adjustment_item_id]);
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
