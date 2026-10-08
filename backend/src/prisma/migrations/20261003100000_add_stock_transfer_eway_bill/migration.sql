BEGIN TRY

BEGIN TRAN;

-- AlterTable: GST e-way bill fields on stock_transfers, for a Branch
-- Transfer's new "E-Way Bill" tab on the Stock Transfer Issue screen (see
-- services/taxproGsp.service.js generateStockTransferEWayBill). Mirrors the
-- e-way bill block 20260922070000_add_sales_invoice_einvoice_eway_bill added
-- to sales_invoices, plus transport_mode (an invoice has its own header
-- field for that; a transfer does not). Nullable, no backfill: every
-- existing transfer simply has no e-way bill yet. The status column gets a
-- default so existing rows read "Not Generated" rather than NULL. Guarded
-- on sys.columns so re-running this migration is a no-op if already applied.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfers]') AND name = N'eway_bill_no')
BEGIN
    ALTER TABLE [dbo].[stock_transfers] ADD [eway_bill_no] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfers]') AND name = N'eway_bill_date')
BEGIN
    ALTER TABLE [dbo].[stock_transfers] ADD [eway_bill_date] DATETIME2 NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfers]') AND name = N'eway_bill_valid_upto')
BEGIN
    ALTER TABLE [dbo].[stock_transfers] ADD [eway_bill_valid_upto] DATETIME2 NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfers]') AND name = N'transport_mode')
BEGIN
    ALTER TABLE [dbo].[stock_transfers] ADD [transport_mode] NVARCHAR(50) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfers]') AND name = N'transporter_name')
BEGIN
    ALTER TABLE [dbo].[stock_transfers] ADD [transporter_name] NVARCHAR(150) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfers]') AND name = N'transporter_gstin')
BEGIN
    ALTER TABLE [dbo].[stock_transfers] ADD [transporter_gstin] NVARCHAR(15) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfers]') AND name = N'vehicle_no')
BEGIN
    ALTER TABLE [dbo].[stock_transfers] ADD [vehicle_no] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfers]') AND name = N'eway_distance_km')
BEGIN
    ALTER TABLE [dbo].[stock_transfers] ADD [eway_distance_km] INT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfers]') AND name = N'eway_bill_status')
BEGIN
    ALTER TABLE [dbo].[stock_transfers] ADD [eway_bill_status] NVARCHAR(20) CONSTRAINT [DF_stock_transfers_eway_bill_status] DEFAULT N'Not Generated' NOT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfers]') AND name = N'eway_cancel_reason')
BEGIN
    ALTER TABLE [dbo].[stock_transfers] ADD [eway_cancel_reason] NVARCHAR(200) NULL;
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
