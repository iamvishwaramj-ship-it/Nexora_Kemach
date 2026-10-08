BEGIN TRY

BEGIN TRAN;

-- Purchase Invoice, when it is the DIRECT document (no base GRN — see
-- isDirectInvoice in routes/resources.js), now creates its own batches/
-- serials exactly like GRN/Stock Receipt do, in their own separate
-- namespace (see the 'purchaseInvoice' batchScope on
-- assertUniqueBatchesAndSerials in utils/businessRules.js). This adds the
-- nullable FK column each batch/serial row uses to record which Purchase
-- Invoice line created it, mirroring grn_item_id/stock_receipt_item_id.

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[product_batches]')
      AND name = N'purchase_invoice_item_id'
)
BEGIN
    ALTER TABLE [dbo].[product_batches]
        ADD [purchase_invoice_item_id] INT NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'FK_product_batches_purchase_invoice_item'
      AND parent_object_id = OBJECT_ID(N'[dbo].[product_batches]')
)
BEGIN
    ALTER TABLE [dbo].[product_batches]
        ADD CONSTRAINT [FK_product_batches_purchase_invoice_item]
        FOREIGN KEY ([purchase_invoice_item_id])
        REFERENCES [dbo].[purchase_invoice_items] ([id])
        ON DELETE CASCADE;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_product_batches_purchase_invoice_item_id'
      AND object_id = OBJECT_ID(N'[dbo].[product_batches]')
)
BEGIN
    CREATE INDEX [IX_product_batches_purchase_invoice_item_id]
        ON [dbo].[product_batches] ([purchase_invoice_item_id]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[product_serials]')
      AND name = N'purchase_invoice_item_id'
)
BEGIN
    ALTER TABLE [dbo].[product_serials]
        ADD [purchase_invoice_item_id] INT NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'FK_product_serials_purchase_invoice_item'
      AND parent_object_id = OBJECT_ID(N'[dbo].[product_serials]')
)
BEGIN
    ALTER TABLE [dbo].[product_serials]
        ADD CONSTRAINT [FK_product_serials_purchase_invoice_item]
        FOREIGN KEY ([purchase_invoice_item_id])
        REFERENCES [dbo].[purchase_invoice_items] ([id])
        ON DELETE CASCADE;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_product_serials_purchase_invoice_item_id'
      AND object_id = OBJECT_ID(N'[dbo].[product_serials]')
)
BEGIN
    CREATE INDEX [IX_product_serials_purchase_invoice_item_id]
        ON [dbo].[product_serials] ([purchase_invoice_item_id]);
END;

-- Sales Invoice, when it is the DIRECT document (no base Delivery Challan),
-- now SELECTS existing batches/serials exactly like Delivery Challan/Stock
-- Issue do. This adds the matching nullable FK column each allocation row
-- uses to record which Sales Invoice line consumed it, mirroring
-- delivery_challan_item_id/stock_issue_item_id.

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[batch_allocations]')
      AND name = N'sales_invoice_item_id'
)
BEGIN
    ALTER TABLE [dbo].[batch_allocations]
        ADD [sales_invoice_item_id] INT NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'FK_batch_allocations_sales_invoice_item'
      AND parent_object_id = OBJECT_ID(N'[dbo].[batch_allocations]')
)
BEGIN
    ALTER TABLE [dbo].[batch_allocations]
        ADD CONSTRAINT [FK_batch_allocations_sales_invoice_item]
        FOREIGN KEY ([sales_invoice_item_id])
        REFERENCES [dbo].[sales_invoice_items] ([id])
        ON DELETE CASCADE;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_batch_allocations_sales_invoice_item_id'
      AND object_id = OBJECT_ID(N'[dbo].[batch_allocations]')
)
BEGIN
    CREATE INDEX [IX_batch_allocations_sales_invoice_item_id]
        ON [dbo].[batch_allocations] ([sales_invoice_item_id]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[serial_allocations]')
      AND name = N'sales_invoice_item_id'
)
BEGIN
    ALTER TABLE [dbo].[serial_allocations]
        ADD [sales_invoice_item_id] INT NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'FK_serial_allocations_sales_invoice_item'
      AND parent_object_id = OBJECT_ID(N'[dbo].[serial_allocations]')
)
BEGIN
    ALTER TABLE [dbo].[serial_allocations]
        ADD CONSTRAINT [FK_serial_allocations_sales_invoice_item]
        FOREIGN KEY ([sales_invoice_item_id])
        REFERENCES [dbo].[sales_invoice_items] ([id])
        ON DELETE CASCADE;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_serial_allocations_sales_invoice_item_id'
      AND object_id = OBJECT_ID(N'[dbo].[serial_allocations]')
)
BEGIN
    CREATE INDEX [IX_serial_allocations_sales_invoice_item_id]
        ON [dbo].[serial_allocations] ([sales_invoice_item_id]);
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
