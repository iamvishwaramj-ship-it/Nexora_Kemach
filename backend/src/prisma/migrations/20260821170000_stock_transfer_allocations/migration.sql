BEGIN TRY

BEGIN TRAN;

-- AddColumn: stock_transfer_item_id on batch_allocations / serial_allocations
-- — the "Relocate" counterpart of the other dual-nullable-FK columns: records
-- which batch/serial a Stock Transfer line moved from its From Warehouse to
-- its To Warehouse. Stock Transfer already has fromWarehouse/toWarehouse per
-- line (see transferOutLines/transferInLines in utils/stockTable.js), so this
-- migration only adds the allocation linkage, nothing else.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[batch_allocations]') AND name = 'stock_transfer_item_id')
BEGIN
    ALTER TABLE [dbo].[batch_allocations] ADD [stock_transfer_item_id] INT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[serial_allocations]') AND name = 'stock_transfer_item_id')
BEGIN
    ALTER TABLE [dbo].[serial_allocations] ADD [stock_transfer_item_id] INT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_batch_allocations_stock_transfer_item')
BEGIN
    ALTER TABLE [dbo].[batch_allocations]
        ADD CONSTRAINT [FK_batch_allocations_stock_transfer_item]
        FOREIGN KEY ([stock_transfer_item_id]) REFERENCES [dbo].[stock_transfer_items]([id])
        ON DELETE CASCADE;
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_serial_allocations_stock_transfer_item')
BEGIN
    ALTER TABLE [dbo].[serial_allocations]
        ADD CONSTRAINT [FK_serial_allocations_stock_transfer_item]
        FOREIGN KEY ([stock_transfer_item_id]) REFERENCES [dbo].[stock_transfer_items]([id])
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
