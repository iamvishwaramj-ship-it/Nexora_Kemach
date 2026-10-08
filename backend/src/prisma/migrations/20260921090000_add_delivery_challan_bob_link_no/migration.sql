BEGIN TRY

BEGIN TRAN;

-- AlterTable: delivery_challans.bob_link_no
--
-- Shown and required at the form layer only when Type of DC is 'Warranty'
-- (see deliveryChallanSchema's superRefine). Nullable at the database, same
-- convention as type_of_dc itself: every challan row that existed before
-- this column did simply reads as NULL, no backfill needed, and every
-- non-Warranty despatch legitimately has no value here at all.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[delivery_challans]') AND name = 'bob_link_no'
)
BEGIN
    ALTER TABLE [dbo].[delivery_challans] ADD [bob_link_no] NVARCHAR(50) NULL;
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
