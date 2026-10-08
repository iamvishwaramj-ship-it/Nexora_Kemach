BEGIN TRY

BEGIN TRAN;

-- Sales Quotation only: a flat 8.2% Road Tax, computed server-side off the
-- document's own amount (see computeSalesQuotationTotals in
-- routes/resources.js) and folded into `amount` (the saved grand total) —
-- unlike CGST/SGST/IGST it has no Tax Code of its own and no GL account
-- treatment, so it gets its own plain column rather than joining the
-- cgst_amount/sgst_amount/igst_amount/tcs_amount group. Defaults to 0 for
-- every existing quotation, which predates Road Tax entirely.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_quotations]') AND name = 'road_tax')
BEGIN
    ALTER TABLE [dbo].[sales_quotations] ADD [road_tax] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_sales_quotations_road_tax DEFAULT 0;
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
