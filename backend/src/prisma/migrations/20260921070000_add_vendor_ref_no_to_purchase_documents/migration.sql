BEGIN TRY

BEGIN TRAN;

-- AlterTable: purchase_orders.vendor_ref_no
--
-- Vendor's own reference for this order -- same field/name as
-- goods_received_notes.vendor_ref_no. Nullable, no backfill needed.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[purchase_orders]') AND name = 'vendor_ref_no'
)
BEGIN
    ALTER TABLE [dbo].[purchase_orders] ADD [vendor_ref_no] NVARCHAR(50) NULL;
END;

-- AlterTable: purchase_returns.vendor_ref_no
--
-- Distinct from the existing supplier_ref_no column (an older, unrelated
-- field with no rendered input on this form) -- same vendor_ref_no
-- field/name every other purchase document now carries.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[purchase_returns]') AND name = 'vendor_ref_no'
)
BEGIN
    ALTER TABLE [dbo].[purchase_returns] ADD [vendor_ref_no] NVARCHAR(50) NULL;
END;

-- AlterTable: purchase_invoices.vendor_ref_no
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[purchase_invoices]') AND name = 'vendor_ref_no'
)
BEGIN
    ALTER TABLE [dbo].[purchase_invoices] ADD [vendor_ref_no] NVARCHAR(50) NULL;
END;

-- AlterTable: purchase_credit_memos.vendor_ref_no
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[purchase_credit_memos]') AND name = 'vendor_ref_no'
)
BEGIN
    ALTER TABLE [dbo].[purchase_credit_memos] ADD [vendor_ref_no] NVARCHAR(50) NULL;
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
