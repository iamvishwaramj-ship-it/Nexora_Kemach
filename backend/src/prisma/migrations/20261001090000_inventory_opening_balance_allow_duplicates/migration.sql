BEGIN TRY

BEGIN TRAN;

-- Inventory Opening Balance: the same item / warehouse / batch may now repeat
-- (several lines, several documents). Replace the unique key with a plain
-- lookup index; rows are addressed by id.
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = N'uq_opening_balance_item_warehouse_batch' AND parent_object_id = OBJECT_ID(N'[dbo].[opening_balance]'))
    ALTER TABLE [dbo].[opening_balance] DROP CONSTRAINT [uq_opening_balance_item_warehouse_batch];
ELSE IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'uq_opening_balance_item_warehouse_batch' AND object_id = OBJECT_ID(N'[dbo].[opening_balance]'))
    DROP INDEX [uq_opening_balance_item_warehouse_batch] ON [dbo].[opening_balance];

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_opening_balance_item_warehouse_batch' AND object_id = OBJECT_ID(N'[dbo].[opening_balance]'))
    CREATE NONCLUSTERED INDEX [IX_opening_balance_item_warehouse_batch] ON [dbo].[opening_balance]([item_code], [warehouse], [batch_no]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
