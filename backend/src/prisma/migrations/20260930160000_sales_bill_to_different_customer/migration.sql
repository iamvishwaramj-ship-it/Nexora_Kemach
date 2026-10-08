BEGIN TRY

BEGIN TRAN;

-- "Bill to a different customer" + the GST No / GST Type / PAN snapshot of the
-- selected Bill To and Ship To address, on the Sales documents. All columns are
-- safe for existing rows: the flag defaults to 0, the rest are nullable.
IF COL_LENGTH(N'[dbo].[sales_quotations]', N'bill_to_different_customer') IS NULL
    ALTER TABLE [dbo].[sales_quotations] ADD [bill_to_different_customer] BIT NOT NULL CONSTRAINT [DF_sales_quotations_bill_to_diff_customer] DEFAULT 0;
IF COL_LENGTH(N'[dbo].[sales_quotations]', N'bill_to_customer') IS NULL
    ALTER TABLE [dbo].[sales_quotations] ADD [bill_to_customer] NVARCHAR(100) NULL;
IF COL_LENGTH(N'[dbo].[sales_quotations]', N'bill_to_gst_no') IS NULL
    ALTER TABLE [dbo].[sales_quotations] ADD [bill_to_gst_no] NVARCHAR(30) NULL;
IF COL_LENGTH(N'[dbo].[sales_quotations]', N'bill_to_gst_type') IS NULL
    ALTER TABLE [dbo].[sales_quotations] ADD [bill_to_gst_type] NVARCHAR(50) NULL;
IF COL_LENGTH(N'[dbo].[sales_quotations]', N'bill_to_pan_no') IS NULL
    ALTER TABLE [dbo].[sales_quotations] ADD [bill_to_pan_no] NVARCHAR(20) NULL;
IF COL_LENGTH(N'[dbo].[sales_quotations]', N'ship_to_gst_no') IS NULL
    ALTER TABLE [dbo].[sales_quotations] ADD [ship_to_gst_no] NVARCHAR(30) NULL;
IF COL_LENGTH(N'[dbo].[sales_quotations]', N'ship_to_gst_type') IS NULL
    ALTER TABLE [dbo].[sales_quotations] ADD [ship_to_gst_type] NVARCHAR(50) NULL;
IF COL_LENGTH(N'[dbo].[sales_quotations]', N'ship_to_pan_no') IS NULL
    ALTER TABLE [dbo].[sales_quotations] ADD [ship_to_pan_no] NVARCHAR(20) NULL;

IF COL_LENGTH(N'[dbo].[sales_orders]', N'bill_to_different_customer') IS NULL
    ALTER TABLE [dbo].[sales_orders] ADD [bill_to_different_customer] BIT NOT NULL CONSTRAINT [DF_sales_orders_bill_to_diff_customer] DEFAULT 0;
IF COL_LENGTH(N'[dbo].[sales_orders]', N'bill_to_customer') IS NULL
    ALTER TABLE [dbo].[sales_orders] ADD [bill_to_customer] NVARCHAR(100) NULL;
IF COL_LENGTH(N'[dbo].[sales_orders]', N'bill_to_gst_no') IS NULL
    ALTER TABLE [dbo].[sales_orders] ADD [bill_to_gst_no] NVARCHAR(30) NULL;
IF COL_LENGTH(N'[dbo].[sales_orders]', N'bill_to_gst_type') IS NULL
    ALTER TABLE [dbo].[sales_orders] ADD [bill_to_gst_type] NVARCHAR(50) NULL;
IF COL_LENGTH(N'[dbo].[sales_orders]', N'bill_to_pan_no') IS NULL
    ALTER TABLE [dbo].[sales_orders] ADD [bill_to_pan_no] NVARCHAR(20) NULL;
IF COL_LENGTH(N'[dbo].[sales_orders]', N'ship_to_gst_no') IS NULL
    ALTER TABLE [dbo].[sales_orders] ADD [ship_to_gst_no] NVARCHAR(30) NULL;
IF COL_LENGTH(N'[dbo].[sales_orders]', N'ship_to_gst_type') IS NULL
    ALTER TABLE [dbo].[sales_orders] ADD [ship_to_gst_type] NVARCHAR(50) NULL;
IF COL_LENGTH(N'[dbo].[sales_orders]', N'ship_to_pan_no') IS NULL
    ALTER TABLE [dbo].[sales_orders] ADD [ship_to_pan_no] NVARCHAR(20) NULL;

IF COL_LENGTH(N'[dbo].[delivery_challans]', N'bill_to_different_customer') IS NULL
    ALTER TABLE [dbo].[delivery_challans] ADD [bill_to_different_customer] BIT NOT NULL CONSTRAINT [DF_delivery_challans_bill_to_diff_customer] DEFAULT 0;
IF COL_LENGTH(N'[dbo].[delivery_challans]', N'bill_to_customer') IS NULL
    ALTER TABLE [dbo].[delivery_challans] ADD [bill_to_customer] NVARCHAR(100) NULL;
IF COL_LENGTH(N'[dbo].[delivery_challans]', N'bill_to_gst_no') IS NULL
    ALTER TABLE [dbo].[delivery_challans] ADD [bill_to_gst_no] NVARCHAR(30) NULL;
IF COL_LENGTH(N'[dbo].[delivery_challans]', N'bill_to_gst_type') IS NULL
    ALTER TABLE [dbo].[delivery_challans] ADD [bill_to_gst_type] NVARCHAR(50) NULL;
IF COL_LENGTH(N'[dbo].[delivery_challans]', N'bill_to_pan_no') IS NULL
    ALTER TABLE [dbo].[delivery_challans] ADD [bill_to_pan_no] NVARCHAR(20) NULL;
IF COL_LENGTH(N'[dbo].[delivery_challans]', N'ship_to_gst_no') IS NULL
    ALTER TABLE [dbo].[delivery_challans] ADD [ship_to_gst_no] NVARCHAR(30) NULL;
IF COL_LENGTH(N'[dbo].[delivery_challans]', N'ship_to_gst_type') IS NULL
    ALTER TABLE [dbo].[delivery_challans] ADD [ship_to_gst_type] NVARCHAR(50) NULL;
IF COL_LENGTH(N'[dbo].[delivery_challans]', N'ship_to_pan_no') IS NULL
    ALTER TABLE [dbo].[delivery_challans] ADD [ship_to_pan_no] NVARCHAR(20) NULL;

IF COL_LENGTH(N'[dbo].[sales_invoices]', N'bill_to_different_customer') IS NULL
    ALTER TABLE [dbo].[sales_invoices] ADD [bill_to_different_customer] BIT NOT NULL CONSTRAINT [DF_sales_invoices_bill_to_diff_customer] DEFAULT 0;
IF COL_LENGTH(N'[dbo].[sales_invoices]', N'bill_to_customer') IS NULL
    ALTER TABLE [dbo].[sales_invoices] ADD [bill_to_customer] NVARCHAR(100) NULL;
IF COL_LENGTH(N'[dbo].[sales_invoices]', N'bill_to_gst_no') IS NULL
    ALTER TABLE [dbo].[sales_invoices] ADD [bill_to_gst_no] NVARCHAR(30) NULL;
IF COL_LENGTH(N'[dbo].[sales_invoices]', N'bill_to_gst_type') IS NULL
    ALTER TABLE [dbo].[sales_invoices] ADD [bill_to_gst_type] NVARCHAR(50) NULL;
IF COL_LENGTH(N'[dbo].[sales_invoices]', N'bill_to_pan_no') IS NULL
    ALTER TABLE [dbo].[sales_invoices] ADD [bill_to_pan_no] NVARCHAR(20) NULL;
IF COL_LENGTH(N'[dbo].[sales_invoices]', N'ship_to_gst_no') IS NULL
    ALTER TABLE [dbo].[sales_invoices] ADD [ship_to_gst_no] NVARCHAR(30) NULL;
IF COL_LENGTH(N'[dbo].[sales_invoices]', N'ship_to_gst_type') IS NULL
    ALTER TABLE [dbo].[sales_invoices] ADD [ship_to_gst_type] NVARCHAR(50) NULL;
IF COL_LENGTH(N'[dbo].[sales_invoices]', N'ship_to_pan_no') IS NULL
    ALTER TABLE [dbo].[sales_invoices] ADD [ship_to_pan_no] NVARCHAR(20) NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
