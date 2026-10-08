BEGIN TRY

BEGIN TRAN;

-- AlterTable: gst_no on every sales document header table.
--
-- Before this migration, the "GST No." field on Sales Quotation, Sales
-- Order, Sales Invoice, Delivery Challan, Sales Credit Memo and Sales
-- Return was UI-only: the frontend computed it live from the selected
-- customer's Business Partner address (see customerGstNo() in each page)
-- and displayed it, but the value was never part of any of these tables
-- and had no field in the corresponding Zod schema either — so react-
-- hook-form's zodResolver silently stripped it from the submitted values
-- before the request ever reached the backend. The value only ever
-- existed for as long as the customer stayed selected in that one form
-- session: opening the same document again for View/Edit had nothing
-- saved to read back, so the field always came up blank.
--
-- This adds a real gst_no column to each document so the value that was
-- already being computed and shown at save time gets persisted, and
-- View/Edit can read it back directly like every other header field
-- instead of re-deriving it from the customer record.
--
-- Nullable, no default: metadata-only ADD in SQL Server, no table rewrite,
-- no backfill of existing rows (they simply have no gst_no captured,
-- exactly like contact_person did before it was added). Guarded on
-- sys.columns so re-running this migration is a no-op if already applied,
-- same style as every other AlterTable migration in this project.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_quotations]') AND name = N'gst_no')
BEGIN
    ALTER TABLE [dbo].[sales_quotations] ADD [gst_no] NVARCHAR(15) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_orders]') AND name = N'gst_no')
BEGIN
    ALTER TABLE [dbo].[sales_orders] ADD [gst_no] NVARCHAR(15) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]') AND name = N'gst_no')
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [gst_no] NVARCHAR(15) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[delivery_challans]') AND name = N'gst_no')
BEGIN
    ALTER TABLE [dbo].[delivery_challans] ADD [gst_no] NVARCHAR(15) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_credit_memos]') AND name = N'gst_no')
BEGIN
    ALTER TABLE [dbo].[sales_credit_memos] ADD [gst_no] NVARCHAR(15) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_returns]') AND name = N'gst_no')
BEGIN
    ALTER TABLE [dbo].[sales_returns] ADD [gst_no] NVARCHAR(15) NULL;
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
