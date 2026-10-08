BEGIN TRY

BEGIN TRAN;

-- AddColumn: purchase_orders.supplier_state / goods_received_notes.supplier_state /
-- purchase_invoices.supplier_state
--
-- New display-only "State" field on Purchase Order, Purchase GRN and
-- Purchase Invoice, auto-filled client-side from the selected supplier's own
-- Business Partner record (never hand-typed) — same data-flow pattern as
-- ship_from/bill_from. Independent of place_of_supply, which already exists
-- on all three tables and tracks the BRANCH's state instead.
--
-- Guarded with IF NOT EXISTS so re-running this migration against a database
-- that already has the column (e.g. after a partial/retried deploy) is a
-- no-op rather than an error — same convention as
-- 20260916100000_add_price_list_type.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[purchase_orders]') AND name = 'supplier_state'
)
BEGIN
    ALTER TABLE [dbo].[purchase_orders] ADD [supplier_state] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[goods_received_notes]') AND name = 'supplier_state'
)
BEGIN
    ALTER TABLE [dbo].[goods_received_notes] ADD [supplier_state] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[purchase_invoices]') AND name = 'supplier_state'
)
BEGIN
    ALTER TABLE [dbo].[purchase_invoices] ADD [supplier_state] NVARCHAR(100) NULL;
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
