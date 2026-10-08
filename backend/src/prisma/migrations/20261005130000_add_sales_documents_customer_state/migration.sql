BEGIN TRY

BEGIN TRAN;

-- AddColumn: customer_state on the six sales documents.
--
-- Display-only "State" field, auto-filled client-side from the selected
-- customer's own Business Partner Billing address -- the sales-side twin of
-- supplier_state on the purchase documents
-- (20260917090000 / 20261005120000). It, not Place of Supply, now decides
-- CGST/SGST vs IGST on every sales document.
--
-- Guarded with IF NOT EXISTS so a re-run against a database that already has
-- the column is a no-op.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_quotations]') AND name = 'customer_state'
)
BEGIN
    ALTER TABLE [dbo].[sales_quotations] ADD [customer_state] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_orders]') AND name = 'customer_state'
)
BEGIN
    ALTER TABLE [dbo].[sales_orders] ADD [customer_state] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[delivery_challans]') AND name = 'customer_state'
)
BEGIN
    ALTER TABLE [dbo].[delivery_challans] ADD [customer_state] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]') AND name = 'customer_state'
)
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [customer_state] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_credit_memos]') AND name = 'customer_state'
)
BEGIN
    ALTER TABLE [dbo].[sales_credit_memos] ADD [customer_state] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_returns]') AND name = 'customer_state'
)
BEGIN
    ALTER TABLE [dbo].[sales_returns] ADD [customer_state] NVARCHAR(100) NULL;
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
