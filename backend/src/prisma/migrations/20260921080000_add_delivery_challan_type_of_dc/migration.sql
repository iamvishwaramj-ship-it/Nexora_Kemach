BEGIN TRY

BEGIN TRAN;

-- AlterTable: delivery_challans.type_of_dc
--
-- New required (at the form layer) classification of what this despatch is
-- actually for -- Warranty / Good will Warranty / FOC / Goodwill FOC /
-- attachments / Claims. Nullable at the database, same convention as every
-- other "required" header field on this document (sales_person, sales_type,
-- ...): every challan row that existed before this column did simply reads
-- as NULL, no backfill needed, and the form's own zod schema is what
-- actually enforces "required" going forward.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[delivery_challans]') AND name = 'type_of_dc'
)
BEGIN
    ALTER TABLE [dbo].[delivery_challans] ADD [type_of_dc] NVARCHAR(50) NULL;
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
