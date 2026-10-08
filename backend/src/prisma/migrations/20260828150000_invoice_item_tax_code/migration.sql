BEGIN TRY

BEGIN TRAN;

-- AlterTable: sales_invoice_items / purchase_invoice_items -- which TaxCode
-- (if any) produced this line's tax_percent. Nullable and additive -- a line
-- with no tax_code_id keeps behaving exactly as before (tax_percent alone
-- drives display/totals; GL posting falls back to GlAccountDetermination's
-- company-wide default). When set, GL posting (backend/src/utils/glPosting.js)
-- prefers this Tax Code's own Sales/Purchase account for the relevant
-- CGST/SGST/IGST component over the company-wide default -- see the Mapping
-- Priority note on the TaxCode model in schema.prisma.
--
-- Guarded with COL_LENGTH checks, same pattern as 20260828140000, in case an
-- earlier attempt already added one of these columns without Prisma
-- recording it.
IF COL_LENGTH('dbo.sales_invoice_items', 'tax_code_id') IS NULL
    ALTER TABLE [dbo].[sales_invoice_items] ADD [tax_code_id] INT NULL;
IF COL_LENGTH('dbo.purchase_invoice_items', 'tax_code_id') IS NULL
    ALTER TABLE [dbo].[purchase_invoice_items] ADD [tax_code_id] INT NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
