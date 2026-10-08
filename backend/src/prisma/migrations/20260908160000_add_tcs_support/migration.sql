BEGIN TRY

BEGIN TRAN;

-- TCS (Tax Collected at Source) support.
--
-- 1. tcs_amount on every sales/purchase document header that already carries
--    cgst_amount/sgst_amount/igst_amount — the amount CARVED OUT of a
--    '+TCS' Tax Code's own combined rate by computeTotals (see
--    backend/src/utils/documentTotals.js and its frontend mirror), never
--    additive on top of it. Defaults to 0 and stays 0 for every existing
--    document and every document whose lines are plain GST/IGST.
--
-- 2. tax_code_id on the five Purchase line tables that didn't already carry
--    it (Purchase Quotation/Order/GRN/Return/Credit Memo — Purchase Invoice
--    and every Sales line table already have it, see
--    20260820120000_add_base_document_fields and earlier migrations).
--    Soft-FK-by-id to tax_codes, same convention as every other taxCodeId
--    column in this schema: nullable, not validated with a real FK
--    constraint, resolved at submit time from the line's picked rate (see
--    taxCodeIdByRate in the matching page component). Needed so a
--    'GST+TCS'/'IGST+TCS' Tax Code can be told apart from a plain
--    'GST'/'IGST' one that happens to share the same combined rate.

-- ---------------------------------------------------------------------------
-- tcs_amount on document headers
-- ---------------------------------------------------------------------------

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_quotations]') AND name = 'tcs_amount')
BEGIN
    ALTER TABLE [dbo].[purchase_quotations] ADD [tcs_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_purchase_quotations_tcs_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_orders]') AND name = 'tcs_amount')
BEGIN
    ALTER TABLE [dbo].[purchase_orders] ADD [tcs_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_purchase_orders_tcs_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[goods_received_notes]') AND name = 'tcs_amount')
BEGIN
    ALTER TABLE [dbo].[goods_received_notes] ADD [tcs_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_goods_received_notes_tcs_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_invoices]') AND name = 'tcs_amount')
BEGIN
    ALTER TABLE [dbo].[purchase_invoices] ADD [tcs_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_purchase_invoices_tcs_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_returns]') AND name = 'tcs_amount')
BEGIN
    ALTER TABLE [dbo].[purchase_returns] ADD [tcs_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_purchase_returns_tcs_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_credit_memos]') AND name = 'tcs_amount')
BEGIN
    ALTER TABLE [dbo].[purchase_credit_memos] ADD [tcs_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_purchase_credit_memos_tcs_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_quotations]') AND name = 'tcs_amount')
BEGIN
    ALTER TABLE [dbo].[sales_quotations] ADD [tcs_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_sales_quotations_tcs_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_orders]') AND name = 'tcs_amount')
BEGIN
    ALTER TABLE [dbo].[sales_orders] ADD [tcs_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_sales_orders_tcs_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[delivery_challans]') AND name = 'tcs_amount')
BEGIN
    ALTER TABLE [dbo].[delivery_challans] ADD [tcs_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_delivery_challans_tcs_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_invoices]') AND name = 'tcs_amount')
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [tcs_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_sales_invoices_tcs_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_returns]') AND name = 'tcs_amount')
BEGIN
    ALTER TABLE [dbo].[sales_returns] ADD [tcs_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_sales_returns_tcs_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_credit_memos]') AND name = 'tcs_amount')
BEGIN
    ALTER TABLE [dbo].[sales_credit_memos] ADD [tcs_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_sales_credit_memos_tcs_amount DEFAULT 0;
END;

-- ---------------------------------------------------------------------------
-- tax_code_id on the five Purchase line tables that didn't already have it
-- ---------------------------------------------------------------------------

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_quotation_items]') AND name = 'tax_code_id')
BEGIN
    ALTER TABLE [dbo].[purchase_quotation_items] ADD [tax_code_id] INT NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_order_items]') AND name = 'tax_code_id')
BEGIN
    ALTER TABLE [dbo].[purchase_order_items] ADD [tax_code_id] INT NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[goods_received_note_items]') AND name = 'tax_code_id')
BEGIN
    ALTER TABLE [dbo].[goods_received_note_items] ADD [tax_code_id] INT NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_return_items]') AND name = 'tax_code_id')
BEGIN
    ALTER TABLE [dbo].[purchase_return_items] ADD [tax_code_id] INT NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_credit_memo_items]') AND name = 'tax_code_id')
BEGIN
    ALTER TABLE [dbo].[purchase_credit_memo_items] ADD [tax_code_id] INT NULL;
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
