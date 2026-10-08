BEGIN TRY

BEGIN TRAN;

-- AddColumn: goods_received_note_items.machine_serial_no / machine_model
-- and purchase_invoice_items.machine_serial_no / machine_model
--
-- New per-line "Machine Serial No" / "Machine Model" text fields on GRN and
-- Purchase Invoice, shown only when the document's HEADER-level Purchase
-- Type is 'Machine'. Nullable, descriptive text only — never read by
-- mapLine/computeGrnTotals/computeInvoiceTotals or any GL/stock posting
-- code, so no data migration is needed: existing rows are unaffected.
--
-- Guarded with IF NOT EXISTS so re-running this migration against a
-- database that already has the columns (e.g. after a partial/retried
-- deploy) is a no-op rather than an error — same convention as
-- 20260916100000_add_price_list_type / 20260917090000_add_purchase_documents_supplier_state.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[goods_received_note_items]') AND name = 'machine_serial_no'
)
BEGIN
    ALTER TABLE [dbo].[goods_received_note_items] ADD [machine_serial_no] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[goods_received_note_items]') AND name = 'machine_model'
)
BEGIN
    ALTER TABLE [dbo].[goods_received_note_items] ADD [machine_model] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[purchase_invoice_items]') AND name = 'machine_serial_no'
)
BEGIN
    ALTER TABLE [dbo].[purchase_invoice_items] ADD [machine_serial_no] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[purchase_invoice_items]') AND name = 'machine_model'
)
BEGIN
    ALTER TABLE [dbo].[purchase_invoice_items] ADD [machine_model] NVARCHAR(100) NULL;
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
