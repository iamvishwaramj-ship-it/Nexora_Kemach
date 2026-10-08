BEGIN TRY

BEGIN TRAN;

-- AlterTable: TaxPro GSP e-invoice (IRN) / e-way bill fields on
-- sales_invoices — see SalesInvoice.jsx's new "E-Invoice / E-Way Bill" tab
-- and services/taxproGsp.service.js. Nullable, no backfill: every invoice
-- that existed before this migration simply has neither generated yet,
-- same as every other add-a-tab migration in this project. The two status
-- columns get a default so existing rows (and any insert that doesn't set
-- them) read as "Not Generated" rather than NULL. Guarded on sys.columns so
-- re-running this migration is a no-op if already applied.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]') AND name = N'irn')
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [irn] NVARCHAR(64) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]') AND name = N'ack_no')
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [ack_no] NVARCHAR(50) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]') AND name = N'ack_date')
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [ack_date] DATETIME2 NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]') AND name = N'qr_code')
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [qr_code] NVARCHAR(MAX) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]') AND name = N'einvoice_status')
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [einvoice_status] NVARCHAR(20) CONSTRAINT [DF_sales_invoices_einvoice_status] DEFAULT N'Not Generated' NOT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]') AND name = N'einvoice_cancel_reason')
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [einvoice_cancel_reason] NVARCHAR(200) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]') AND name = N'eway_bill_no')
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [eway_bill_no] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]') AND name = N'eway_bill_date')
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [eway_bill_date] DATETIME2 NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]') AND name = N'eway_bill_valid_upto')
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [eway_bill_valid_upto] DATETIME2 NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]') AND name = N'transporter_name')
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [transporter_name] NVARCHAR(150) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]') AND name = N'transporter_gstin')
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [transporter_gstin] NVARCHAR(15) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]') AND name = N'vehicle_no')
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [vehicle_no] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]') AND name = N'eway_distance_km')
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [eway_distance_km] INT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]') AND name = N'eway_bill_status')
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [eway_bill_status] NVARCHAR(20) CONSTRAINT [DF_sales_invoices_eway_bill_status] DEFAULT N'Not Generated' NOT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]') AND name = N'eway_cancel_reason')
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [eway_cancel_reason] NVARCHAR(200) NULL;
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
