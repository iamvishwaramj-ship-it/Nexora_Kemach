BEGIN TRY

BEGIN TRAN;

-- "Ship to a different customer" on the Sales documents (Quotation, Order,
-- Delivery Challan, Invoice). Both columns are safe for existing rows:
-- the flag defaults to 0 and the customer name is nullable.
IF COL_LENGTH(N'[dbo].[sales_quotations]', N'ship_to_different_customer') IS NULL
    ALTER TABLE [dbo].[sales_quotations] ADD [ship_to_different_customer] BIT NOT NULL CONSTRAINT [DF_sales_quotations_ship_to_diff_customer] DEFAULT 0;
IF COL_LENGTH(N'[dbo].[sales_quotations]', N'ship_to_customer') IS NULL
    ALTER TABLE [dbo].[sales_quotations] ADD [ship_to_customer] NVARCHAR(100) NULL;

IF COL_LENGTH(N'[dbo].[sales_orders]', N'ship_to_different_customer') IS NULL
    ALTER TABLE [dbo].[sales_orders] ADD [ship_to_different_customer] BIT NOT NULL CONSTRAINT [DF_sales_orders_ship_to_diff_customer] DEFAULT 0;
IF COL_LENGTH(N'[dbo].[sales_orders]', N'ship_to_customer') IS NULL
    ALTER TABLE [dbo].[sales_orders] ADD [ship_to_customer] NVARCHAR(100) NULL;

IF COL_LENGTH(N'[dbo].[delivery_challans]', N'ship_to_different_customer') IS NULL
    ALTER TABLE [dbo].[delivery_challans] ADD [ship_to_different_customer] BIT NOT NULL CONSTRAINT [DF_delivery_challans_ship_to_diff_customer] DEFAULT 0;
IF COL_LENGTH(N'[dbo].[delivery_challans]', N'ship_to_customer') IS NULL
    ALTER TABLE [dbo].[delivery_challans] ADD [ship_to_customer] NVARCHAR(100) NULL;

IF COL_LENGTH(N'[dbo].[sales_invoices]', N'ship_to_different_customer') IS NULL
    ALTER TABLE [dbo].[sales_invoices] ADD [ship_to_different_customer] BIT NOT NULL CONSTRAINT [DF_sales_invoices_ship_to_diff_customer] DEFAULT 0;
IF COL_LENGTH(N'[dbo].[sales_invoices]', N'ship_to_customer') IS NULL
    ALTER TABLE [dbo].[sales_invoices] ADD [ship_to_customer] NVARCHAR(100) NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
