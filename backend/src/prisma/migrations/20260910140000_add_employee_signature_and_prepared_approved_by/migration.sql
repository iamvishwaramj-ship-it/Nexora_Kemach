BEGIN TRY

BEGIN TRAN;

-- AlterTable: SalesEmployee (sales_employees)
--
-- signature_key: object key of the employee's signature image in OCI Object
-- Storage (same "store the key, sign a URL at request time" convention as
-- CompanyDetails.logoKey / BusinessPartner's logo key), used to print the
-- employee's signature on documents they prepare/approve.
--
-- approval_authorization: marks an employee as allowed to be chosen as the
-- Approved By on a document (the Prepared By / Approved By pair added below
-- to all 11 sales/purchase document tables). Existing rows default to 0 —
-- no employee was flagged as an approver before this column existed.
--
-- Guarded so the migration is safe to apply to a database where a column was
-- already added by hand: an unguarded ADD would fail and block every later
-- migration.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_employees]') AND name = 'signature_key'
)
BEGIN
    ALTER TABLE [dbo].[sales_employees] ADD [signature_key] NVARCHAR(500) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_employees]') AND name = 'approval_authorization'
)
BEGIN
    ALTER TABLE [dbo].[sales_employees]
      ADD [approval_authorization] BIT NOT NULL CONSTRAINT [DF_sales_employees_approval_authorization] DEFAULT 0;
END;

-- AlterTable: prepared_by / approved_by on every sales and purchase document
-- header — SalesInvoice, SalesOrder, SalesQuotation, DeliveryChallan,
-- SalesReturn, SalesCreditMemo, PurchaseQuotation, PurchaseInvoice,
-- GoodsReceivedNote, PurchaseReturn, PurchaseCreditMemo. Both hold the
-- employee_code of a SalesEmployee (same store-by-code, not-FK convention as
-- every other cross-master reference in this schema — see
-- WarehouseMaster.branch), so a renamed employee doesn't silently break the
-- reference.

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]') AND name = 'prepared_by'
)
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [prepared_by] NVARCHAR(100) NULL;
END;
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]') AND name = 'approved_by'
)
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [approved_by] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_orders]') AND name = 'prepared_by'
)
BEGIN
    ALTER TABLE [dbo].[sales_orders] ADD [prepared_by] NVARCHAR(100) NULL;
END;
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_orders]') AND name = 'approved_by'
)
BEGIN
    ALTER TABLE [dbo].[sales_orders] ADD [approved_by] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_quotations]') AND name = 'prepared_by'
)
BEGIN
    ALTER TABLE [dbo].[sales_quotations] ADD [prepared_by] NVARCHAR(100) NULL;
END;
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_quotations]') AND name = 'approved_by'
)
BEGIN
    ALTER TABLE [dbo].[sales_quotations] ADD [approved_by] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[delivery_challans]') AND name = 'prepared_by'
)
BEGIN
    ALTER TABLE [dbo].[delivery_challans] ADD [prepared_by] NVARCHAR(100) NULL;
END;
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[delivery_challans]') AND name = 'approved_by'
)
BEGIN
    ALTER TABLE [dbo].[delivery_challans] ADD [approved_by] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_returns]') AND name = 'prepared_by'
)
BEGIN
    ALTER TABLE [dbo].[sales_returns] ADD [prepared_by] NVARCHAR(100) NULL;
END;
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_returns]') AND name = 'approved_by'
)
BEGIN
    ALTER TABLE [dbo].[sales_returns] ADD [approved_by] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_credit_memos]') AND name = 'prepared_by'
)
BEGIN
    ALTER TABLE [dbo].[sales_credit_memos] ADD [prepared_by] NVARCHAR(100) NULL;
END;
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_credit_memos]') AND name = 'approved_by'
)
BEGIN
    ALTER TABLE [dbo].[sales_credit_memos] ADD [approved_by] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[purchase_quotations]') AND name = 'prepared_by'
)
BEGIN
    ALTER TABLE [dbo].[purchase_quotations] ADD [prepared_by] NVARCHAR(100) NULL;
END;
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[purchase_quotations]') AND name = 'approved_by'
)
BEGIN
    ALTER TABLE [dbo].[purchase_quotations] ADD [approved_by] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[purchase_invoices]') AND name = 'prepared_by'
)
BEGIN
    ALTER TABLE [dbo].[purchase_invoices] ADD [prepared_by] NVARCHAR(100) NULL;
END;
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[purchase_invoices]') AND name = 'approved_by'
)
BEGIN
    ALTER TABLE [dbo].[purchase_invoices] ADD [approved_by] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[goods_received_notes]') AND name = 'prepared_by'
)
BEGIN
    ALTER TABLE [dbo].[goods_received_notes] ADD [prepared_by] NVARCHAR(100) NULL;
END;
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[goods_received_notes]') AND name = 'approved_by'
)
BEGIN
    ALTER TABLE [dbo].[goods_received_notes] ADD [approved_by] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[purchase_returns]') AND name = 'prepared_by'
)
BEGIN
    ALTER TABLE [dbo].[purchase_returns] ADD [prepared_by] NVARCHAR(100) NULL;
END;
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[purchase_returns]') AND name = 'approved_by'
)
BEGIN
    ALTER TABLE [dbo].[purchase_returns] ADD [approved_by] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[purchase_credit_memos]') AND name = 'prepared_by'
)
BEGIN
    ALTER TABLE [dbo].[purchase_credit_memos] ADD [prepared_by] NVARCHAR(100) NULL;
END;
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[purchase_credit_memos]') AND name = 'approved_by'
)
BEGIN
    ALTER TABLE [dbo].[purchase_credit_memos] ADD [approved_by] NVARCHAR(100) NULL;
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
