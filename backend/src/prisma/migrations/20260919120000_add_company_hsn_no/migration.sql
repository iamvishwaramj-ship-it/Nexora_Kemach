BEGIN TRY

BEGIN TRAN;

-- AlterTable: company_details — adds hsn_no, the company's own statutory
-- HSN/SAC number printed on sales documents (Quotation, Order, Invoice,
-- Delivery Challan, Sales Return) right below the KEMACH logo in the
-- header — a line the user reported as missing/erased from those
-- printables and asked to have restored via Company Setup instead of a
-- hardcoded value, matching how gstin/pan/registration_number/tin_number
-- already work on this same table.
--
-- Nullable, no default: metadata-only ADD in SQL Server, no table rewrite
-- and no backfill needed — company_details is a one-row (singleton)
-- table, but the guard below keeps this migration idempotent like
-- 20260918190001/20260919030000/20260919060000.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[company_details]') AND name = N'hsn_no')
BEGIN
    ALTER TABLE [dbo].[company_details] ADD [hsn_no] NVARCHAR(50) NULL;
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
