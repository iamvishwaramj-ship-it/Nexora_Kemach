BEGIN TRY

BEGIN TRAN;

-- AlterTable: SalesQuotationItem/SalesOrderItem/DeliveryChallanItem/
-- SalesReturnItem/SalesCreditMemoItem — each line's taxPercent is a plain
-- rate number (e.g. 18), which can't tell apart two Tax Code records that
-- share a rate (GST 18% and IGST-18 are both "18"). The Tax (%) dropdown on
-- these five documents was recently changed to list every active Tax Code
-- instead of collapsing same-rate codes into one option, which surfaced
-- this: picking one of two same-rate codes could show/select the OTHER one,
-- because there was nothing to tell them apart once both had value 18.
--
-- tax_code_id is a soft reference (no FK constraint, same convention as
-- sales_invoice_items.tax_code_id / purchase_invoice_items.tax_code_id) that
-- remembers WHICH Tax Code was actually picked. Nullable: existing rows and
-- any future hand-typed/legacy line keep working off taxPercent alone.
ALTER TABLE [dbo].[sales_quotation_items] ADD [tax_code_id] INT NULL;
ALTER TABLE [dbo].[sales_order_items] ADD [tax_code_id] INT NULL;
ALTER TABLE [dbo].[delivery_challan_items] ADD [tax_code_id] INT NULL;
ALTER TABLE [dbo].[sales_return_items] ADD [tax_code_id] INT NULL;
ALTER TABLE [dbo].[sales_credit_memo_items] ADD [tax_code_id] INT NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
