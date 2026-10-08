BEGIN TRY

BEGIN TRAN;

-- AlterTable: sales_invoices.contact_person
--
-- Sales Invoice never had a Contact No field, unlike the other sales
-- documents (Sales Return, Delivery Challan, ...) which all carry a
-- contact_person column. Nullable: every invoice row that existed before
-- this column did simply has no contact captured, no backfill needed.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]') AND name = 'contact_person'
)
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [contact_person] NVARCHAR(100) NULL;
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
