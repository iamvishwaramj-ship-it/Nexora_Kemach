BEGIN TRY

BEGIN TRAN;

-- AlterTable: purchase_credit_memos — the header fields the credit memo's
-- own form never had, so its "Supplier & Document Details" card can carry
-- Currency / Bill From / Ship To and an "Other Details" card can be added
-- alongside it, matching Purchase Order and Purchase Invoice.
--
-- Every column is nullable with no default. That is deliberate: this table
-- already holds rows, and a nullable add is a metadata-only operation in
-- SQL Server (no table rewrite, no backfill, instant on a large table),
-- whereas NOT NULL with a default would have to touch every existing row.
-- Existing credit memos simply read NULL for all eight, which the form
-- renders as empty.
--
-- Types mirror the same columns on purchase_invoices/purchase_orders so the
-- three documents cannot drift: bill_from/ship_to are NVARCHAR(MAX) because
-- they hold a formatted multi-line address, the Other Details five keep the
-- widths purchase_orders already uses for them.
--
-- Each ADD is guarded on sys.columns so re-running this migration against a
-- database where it has already been applied is a no-op rather than an
-- error — same style as 20260918190001/20260919030000.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[purchase_credit_memos]') AND name = N'currency')
BEGIN
    ALTER TABLE [dbo].[purchase_credit_memos] ADD [currency] NVARCHAR(10) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[purchase_credit_memos]') AND name = N'bill_from')
BEGIN
    ALTER TABLE [dbo].[purchase_credit_memos] ADD [bill_from] NVARCHAR(MAX) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[purchase_credit_memos]') AND name = N'ship_to')
BEGIN
    ALTER TABLE [dbo].[purchase_credit_memos] ADD [ship_to] NVARCHAR(MAX) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[purchase_credit_memos]') AND name = N'purchase_type')
BEGIN
    ALTER TABLE [dbo].[purchase_credit_memos] ADD [purchase_type] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[purchase_credit_memos]') AND name = N'type_of_purchase')
BEGIN
    ALTER TABLE [dbo].[purchase_credit_memos] ADD [type_of_purchase] NVARCHAR(50) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[purchase_credit_memos]') AND name = N'sales_type')
BEGIN
    ALTER TABLE [dbo].[purchase_credit_memos] ADD [sales_type] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[purchase_credit_memos]') AND name = N'purchase_employee')
BEGIN
    ALTER TABLE [dbo].[purchase_credit_memos] ADD [purchase_employee] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[purchase_credit_memos]') AND name = N'transport_mode')
BEGIN
    ALTER TABLE [dbo].[purchase_credit_memos] ADD [transport_mode] NVARCHAR(50) NULL;
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
