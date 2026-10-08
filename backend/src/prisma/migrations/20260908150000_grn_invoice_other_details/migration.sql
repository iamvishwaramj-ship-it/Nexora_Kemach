BEGIN TRY

BEGIN TRAN;

-- Purchase GRN and Purchase Invoice: add the same "Other Details" fields
-- Purchase Order already carries (billing_type/purchase_type/type_of_purchase/
-- sales_type/purchase_employee/transport_mode/invoice_type) — see the doc
-- comment on GoodsReceivedNote in schema.prisma. invoice_type references the
-- invoice_types table added in 20260908130000_add_invoice_type_master, which
-- must apply first.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[goods_received_notes]') AND name = 'billing_type')
BEGIN
    ALTER TABLE [dbo].[goods_received_notes] ADD [billing_type] NVARCHAR(20);
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[goods_received_notes]') AND name = 'purchase_type')
BEGIN
    ALTER TABLE [dbo].[goods_received_notes] ADD [purchase_type] NVARCHAR(20);
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[goods_received_notes]') AND name = 'type_of_purchase')
BEGIN
    ALTER TABLE [dbo].[goods_received_notes] ADD [type_of_purchase] NVARCHAR(50);
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[goods_received_notes]') AND name = 'sales_type')
BEGIN
    ALTER TABLE [dbo].[goods_received_notes] ADD [sales_type] NVARCHAR(20);
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[goods_received_notes]') AND name = 'purchase_employee')
BEGIN
    ALTER TABLE [dbo].[goods_received_notes] ADD [purchase_employee] NVARCHAR(100);
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[goods_received_notes]') AND name = 'transport_mode')
BEGIN
    ALTER TABLE [dbo].[goods_received_notes] ADD [transport_mode] NVARCHAR(50);
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[goods_received_notes]') AND name = 'invoice_type')
BEGIN
    ALTER TABLE [dbo].[goods_received_notes] ADD [invoice_type] NVARCHAR(150);
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_invoices]') AND name = 'billing_type')
BEGIN
    ALTER TABLE [dbo].[purchase_invoices] ADD [billing_type] NVARCHAR(20);
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_invoices]') AND name = 'purchase_type')
BEGIN
    ALTER TABLE [dbo].[purchase_invoices] ADD [purchase_type] NVARCHAR(20);
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_invoices]') AND name = 'type_of_purchase')
BEGIN
    ALTER TABLE [dbo].[purchase_invoices] ADD [type_of_purchase] NVARCHAR(50);
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_invoices]') AND name = 'sales_type')
BEGIN
    ALTER TABLE [dbo].[purchase_invoices] ADD [sales_type] NVARCHAR(20);
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_invoices]') AND name = 'purchase_employee')
BEGIN
    ALTER TABLE [dbo].[purchase_invoices] ADD [purchase_employee] NVARCHAR(100);
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_invoices]') AND name = 'transport_mode')
BEGIN
    ALTER TABLE [dbo].[purchase_invoices] ADD [transport_mode] NVARCHAR(50);
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_invoices]') AND name = 'invoice_type')
BEGIN
    ALTER TABLE [dbo].[purchase_invoices] ADD [invoice_type] NVARCHAR(150);
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
