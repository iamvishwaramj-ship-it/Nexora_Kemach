BEGIN TRY

BEGIN TRAN;

-- Purchase Return: add the "Other Details" fields Purchase Order/GRN/Invoice
-- already carry (billing_type/purchase_type/type_of_purchase/sales_type/
-- purchase_employee/transport_mode) — see the doc comment on PurchaseReturn
-- in schema.prisma. No invoice_type column: Invoice Type has been removed
-- from every purchase document's UI.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_returns]') AND name = 'billing_type')
BEGIN
    ALTER TABLE [dbo].[purchase_returns] ADD [billing_type] NVARCHAR(20);
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_returns]') AND name = 'purchase_type')
BEGIN
    ALTER TABLE [dbo].[purchase_returns] ADD [purchase_type] NVARCHAR(20);
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_returns]') AND name = 'type_of_purchase')
BEGIN
    ALTER TABLE [dbo].[purchase_returns] ADD [type_of_purchase] NVARCHAR(50);
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_returns]') AND name = 'sales_type')
BEGIN
    ALTER TABLE [dbo].[purchase_returns] ADD [sales_type] NVARCHAR(20);
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_returns]') AND name = 'purchase_employee')
BEGIN
    ALTER TABLE [dbo].[purchase_returns] ADD [purchase_employee] NVARCHAR(100);
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_returns]') AND name = 'transport_mode')
BEGIN
    ALTER TABLE [dbo].[purchase_returns] ADD [transport_mode] NVARCHAR(50);
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
