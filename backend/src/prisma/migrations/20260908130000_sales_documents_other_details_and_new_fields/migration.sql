BEGIN TRY

BEGIN TRAN;

-- AlterTable: SalesQuotation, SalesOrder, DeliveryChallan, SalesInvoice —
-- "Other Details" was added to all four sales documents' forms, matching
-- Purchase Order's own "Other Details" classification block (Billing Type /
-- Purchase Type / Type of Purchase / Type of Sales / Transport Mode, all
-- fixed-option/CFL selects), plus a new Invoice Type classification with no
-- Purchase Order counterpart. SalesQuotation also gained a Sales Person
-- field (the other three sales documents already carried one), and
-- SalesOrder gained a new Delivery Address field distinct from its existing
-- Billing Address/Shipping Address.

ALTER TABLE [dbo].[sales_quotations] ADD [sales_person] NVARCHAR(100) NULL;
ALTER TABLE [dbo].[sales_quotations] ADD [billing_type] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[sales_quotations] ADD [purchase_type] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[sales_quotations] ADD [type_of_purchase] NVARCHAR(50) NULL;
ALTER TABLE [dbo].[sales_quotations] ADD [sales_type] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[sales_quotations] ADD [transport_mode] NVARCHAR(50) NULL;
ALTER TABLE [dbo].[sales_quotations] ADD [invoice_type] NVARCHAR(30) NULL;

ALTER TABLE [dbo].[sales_orders] ADD [delivery_address] NVARCHAR(MAX) NULL;
ALTER TABLE [dbo].[sales_orders] ADD [billing_type] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[sales_orders] ADD [purchase_type] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[sales_orders] ADD [type_of_purchase] NVARCHAR(50) NULL;
ALTER TABLE [dbo].[sales_orders] ADD [sales_type] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[sales_orders] ADD [transport_mode] NVARCHAR(50) NULL;
ALTER TABLE [dbo].[sales_orders] ADD [invoice_type] NVARCHAR(30) NULL;

ALTER TABLE [dbo].[delivery_challans] ADD [billing_type] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[delivery_challans] ADD [purchase_type] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[delivery_challans] ADD [type_of_purchase] NVARCHAR(50) NULL;
ALTER TABLE [dbo].[delivery_challans] ADD [sales_type] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[delivery_challans] ADD [transport_mode] NVARCHAR(50) NULL;
ALTER TABLE [dbo].[delivery_challans] ADD [invoice_type] NVARCHAR(30) NULL;

ALTER TABLE [dbo].[sales_invoices] ADD [billing_type] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[sales_invoices] ADD [purchase_type] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[sales_invoices] ADD [type_of_purchase] NVARCHAR(50) NULL;
ALTER TABLE [dbo].[sales_invoices] ADD [sales_type] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[sales_invoices] ADD [transport_mode] NVARCHAR(50) NULL;
ALTER TABLE [dbo].[sales_invoices] ADD [invoice_type] NVARCHAR(30) NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
