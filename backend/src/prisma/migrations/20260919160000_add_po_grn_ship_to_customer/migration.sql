-- Adds the "Ship to a different customer" columns to Purchase Order and
-- Purchase GRN, mirroring the pair already added to purchase_invoices in
-- 20260919150000_add_purchase_invoice_ship_to_customer. Both new columns on
-- both tables are nullable/defaulted, so every existing row (and every
-- existing INSERT that doesn't yet know about these columns) is unaffected.
BEGIN TRY
BEGIN TRAN;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[purchase_orders]') AND name = N'ship_to_different_customer')
BEGIN
    ALTER TABLE [dbo].[purchase_orders] ADD [ship_to_different_customer] BIT NOT NULL CONSTRAINT [DF_purchase_orders_ship_to_diff_customer] DEFAULT (0);
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[purchase_orders]') AND name = N'ship_to_customer')
BEGIN
    ALTER TABLE [dbo].[purchase_orders] ADD [ship_to_customer] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[goods_received_notes]') AND name = N'ship_to_different_customer')
BEGIN
    ALTER TABLE [dbo].[goods_received_notes] ADD [ship_to_different_customer] BIT NOT NULL CONSTRAINT [DF_goods_received_notes_ship_to_diff_customer] DEFAULT (0);
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[goods_received_notes]') AND name = N'ship_to_customer')
BEGIN
    ALTER TABLE [dbo].[goods_received_notes] ADD [ship_to_customer] NVARCHAR(100) NULL;
END;

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 BEGIN ROLLBACK TRAN; END;
    THROW;
END CATCH;
