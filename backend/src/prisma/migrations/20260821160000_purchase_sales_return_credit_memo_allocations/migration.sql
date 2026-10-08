BEGIN TRY

BEGIN TRAN;

-- AddColumn: warehouse on purchase_returns / purchase_credit_memos /
-- sales_returns / sales_credit_memos — these four documents posted no stock
-- movement at all until now (see the schema.prisma comments on each model),
-- so none of them had a warehouse column. Nullable/additive: existing rows
-- keep validating with no warehouse set.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[purchase_returns]') AND name = 'warehouse')
BEGIN
    ALTER TABLE [dbo].[purchase_returns] ADD [warehouse] NVARCHAR(150) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[purchase_credit_memos]') AND name = 'warehouse')
BEGIN
    ALTER TABLE [dbo].[purchase_credit_memos] ADD [warehouse] NVARCHAR(150) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_returns]') AND name = 'warehouse')
BEGIN
    ALTER TABLE [dbo].[sales_returns] ADD [warehouse] NVARCHAR(150) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_credit_memos]') AND name = 'warehouse')
BEGIN
    ALTER TABLE [dbo].[sales_credit_memos] ADD [warehouse] NVARCHAR(150) NULL;
END;

-- AddColumn: purchase_return_item_id / purchase_credit_memo_item_id /
-- sales_return_item_id / sales_credit_memo_item_id on batch_allocations /
-- serial_allocations — the same dual-nullable-FK pattern as the existing
-- delivery_challan_item_id / stock_issue_item_id columns (see migration
-- 20260821150000_batch_serial_issue_allocations), extended to the four
-- documents newly wired into the stock ledger. Purchase Return/Credit Memo
-- SELECT existing batches/serials to decrement (same direction as Delivery
-- Challan/Stock Issue); Sales Return/Credit Memo "Restock" them back onto
-- existing rows (opposite direction, same tables).
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[batch_allocations]') AND name = 'purchase_return_item_id')
BEGIN
    ALTER TABLE [dbo].[batch_allocations] ADD [purchase_return_item_id] INT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[batch_allocations]') AND name = 'purchase_credit_memo_item_id')
BEGIN
    ALTER TABLE [dbo].[batch_allocations] ADD [purchase_credit_memo_item_id] INT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[batch_allocations]') AND name = 'sales_return_item_id')
BEGIN
    ALTER TABLE [dbo].[batch_allocations] ADD [sales_return_item_id] INT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[batch_allocations]') AND name = 'sales_credit_memo_item_id')
BEGIN
    ALTER TABLE [dbo].[batch_allocations] ADD [sales_credit_memo_item_id] INT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[serial_allocations]') AND name = 'purchase_return_item_id')
BEGIN
    ALTER TABLE [dbo].[serial_allocations] ADD [purchase_return_item_id] INT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[serial_allocations]') AND name = 'purchase_credit_memo_item_id')
BEGIN
    ALTER TABLE [dbo].[serial_allocations] ADD [purchase_credit_memo_item_id] INT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[serial_allocations]') AND name = 'sales_return_item_id')
BEGIN
    ALTER TABLE [dbo].[serial_allocations] ADD [sales_return_item_id] INT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[serial_allocations]') AND name = 'sales_credit_memo_item_id')
BEGIN
    ALTER TABLE [dbo].[serial_allocations] ADD [sales_credit_memo_item_id] INT NULL;
END;

-- Foreign keys, one per new column, mirroring the existing FK style/naming.
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_batch_allocations_purchase_return_item')
BEGIN
    ALTER TABLE [dbo].[batch_allocations]
        ADD CONSTRAINT [FK_batch_allocations_purchase_return_item]
        FOREIGN KEY ([purchase_return_item_id]) REFERENCES [dbo].[purchase_return_items]([id])
        ON DELETE CASCADE;
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_batch_allocations_purchase_credit_memo_item')
BEGIN
    ALTER TABLE [dbo].[batch_allocations]
        ADD CONSTRAINT [FK_batch_allocations_purchase_credit_memo_item]
        FOREIGN KEY ([purchase_credit_memo_item_id]) REFERENCES [dbo].[purchase_credit_memo_items]([id])
        ON DELETE CASCADE;
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_batch_allocations_sales_return_item')
BEGIN
    ALTER TABLE [dbo].[batch_allocations]
        ADD CONSTRAINT [FK_batch_allocations_sales_return_item]
        FOREIGN KEY ([sales_return_item_id]) REFERENCES [dbo].[sales_return_items]([id])
        ON DELETE CASCADE;
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_batch_allocations_sales_credit_memo_item')
BEGIN
    ALTER TABLE [dbo].[batch_allocations]
        ADD CONSTRAINT [FK_batch_allocations_sales_credit_memo_item]
        FOREIGN KEY ([sales_credit_memo_item_id]) REFERENCES [dbo].[sales_credit_memo_items]([id])
        ON DELETE CASCADE;
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_serial_allocations_purchase_return_item')
BEGIN
    ALTER TABLE [dbo].[serial_allocations]
        ADD CONSTRAINT [FK_serial_allocations_purchase_return_item]
        FOREIGN KEY ([purchase_return_item_id]) REFERENCES [dbo].[purchase_return_items]([id])
        ON DELETE CASCADE;
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_serial_allocations_purchase_credit_memo_item')
BEGIN
    ALTER TABLE [dbo].[serial_allocations]
        ADD CONSTRAINT [FK_serial_allocations_purchase_credit_memo_item]
        FOREIGN KEY ([purchase_credit_memo_item_id]) REFERENCES [dbo].[purchase_credit_memo_items]([id])
        ON DELETE CASCADE;
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_serial_allocations_sales_return_item')
BEGIN
    ALTER TABLE [dbo].[serial_allocations]
        ADD CONSTRAINT [FK_serial_allocations_sales_return_item]
        FOREIGN KEY ([sales_return_item_id]) REFERENCES [dbo].[sales_return_items]([id])
        ON DELETE CASCADE;
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_serial_allocations_sales_credit_memo_item')
BEGIN
    ALTER TABLE [dbo].[serial_allocations]
        ADD CONSTRAINT [FK_serial_allocations_sales_credit_memo_item]
        FOREIGN KEY ([sales_credit_memo_item_id]) REFERENCES [dbo].[sales_credit_memo_items]([id])
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
