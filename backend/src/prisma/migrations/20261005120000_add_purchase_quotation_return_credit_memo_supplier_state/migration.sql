BEGIN TRY

BEGIN TRAN;

-- AddColumn: purchase_quotations.supplier_state / purchase_returns.supplier_state /
-- purchase_credit_memos.supplier_state
--
-- Same display-only "State" field Purchase Order / GRN / Invoice already
-- carry (see 20260917090000_add_purchase_documents_supplier_state), now on
-- the remaining three purchase documents so every purchase document decides
-- CGST/SGST vs IGST from the SUPPLIER's state, not Place of Supply.
--
-- Guarded with IF NOT EXISTS so a re-run against a database that already has
-- the column is a no-op.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[purchase_quotations]') AND name = 'supplier_state'
)
BEGIN
    ALTER TABLE [dbo].[purchase_quotations] ADD [supplier_state] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[purchase_returns]') AND name = 'supplier_state'
)
BEGIN
    ALTER TABLE [dbo].[purchase_returns] ADD [supplier_state] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[purchase_credit_memos]') AND name = 'supplier_state'
)
BEGIN
    ALTER TABLE [dbo].[purchase_credit_memos] ADD [supplier_state] NVARCHAR(100) NULL;
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
