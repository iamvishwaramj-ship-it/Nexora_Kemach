BEGIN TRY

BEGIN TRAN;

-- AlterTable: location_master (LocationMaster — the surviving location master)
--
-- The retired [dbo].[locations] table carried a GST registration number and
-- this one did not. Added here so consolidating the two masters loses nothing:
-- a location's statutory registration must not disappear as a side effect of
-- tidying up duplicate tables.
--
-- Guarded so this is safe to apply to a database where the column was already
-- added by hand.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[location_master]') AND name = 'gst_registration_no'
)
BEGIN
    ALTER TABLE [dbo].[location_master] ADD [gst_registration_no] NVARCHAR(20) NULL;
END;

-- [dbo].[locations] is deliberately NOT dropped. Run
-- scripts/consolidateLocations.js first: it copies every location that exists
-- only there into [location_master], and reports any location referenced by a
-- warehouse that is missing from the master. Dropping the old table is a
-- one-line migration of its own once the surviving master is confirmed
-- complete — taken deliberately, not as a side effect of this one.

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
