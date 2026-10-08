BEGIN TRY

BEGIN TRAN;

-- AlterTable: opening_balance -- adds batch tracking to a per-item,
-- per-warehouse opening stock row. Until now the only place that ever
-- created a [dbo].[product_batches] row was Purchase GRN's "Batches -
-- Setup" dialog, so a Batch-tracked item's STARTING stock had no batch
-- number to select from later on Delivery Challan/Stock Issue. batch_no is
-- nullable at the column level (a non-tracked item never sets it) but is
-- enforced as required for a Batch-tracked item in the application layer
-- (routes/resources.js), the same optional/required split GRN's own
-- batch_no columns carry.
--
-- Metadata-only ADD in SQL Server, no table rewrite -- existing rows
-- simply read NULL.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[opening_balance]') AND name = N'batch_no')
BEGIN
    ALTER TABLE [dbo].[opening_balance] ADD [batch_no] NVARCHAR(100) NULL;
END;

-- Was unique on (item_code, warehouse) alone -- one opening balance row per
-- item per warehouse, full stop. Replaced with a unique index that also
-- includes batch_no, so a Batch-tracked item can carry more than one
-- opening-balance row per warehouse (one per batch), while a non-tracked
-- item -- batch_no always NULL -- keeps exactly the old one-row-per-item-
-- per-warehouse behaviour: SQL Server's unique index treats two NULLs in
-- the same key as a duplicate, so a second all-NULL-batch_no row for the
-- same item+warehouse is still rejected the same way it always was.
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_opening_balance_item_warehouse' AND object_id = OBJECT_ID(N'[dbo].[opening_balance]'))
BEGIN
    DROP INDEX [uq_opening_balance_item_warehouse] ON [dbo].[opening_balance];
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_opening_balance_item_warehouse_batch' AND object_id = OBJECT_ID(N'[dbo].[opening_balance]'))
BEGIN
    CREATE UNIQUE INDEX [uq_opening_balance_item_warehouse_batch] ON [dbo].[opening_balance]([item_code], [warehouse], [batch_no]);
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
