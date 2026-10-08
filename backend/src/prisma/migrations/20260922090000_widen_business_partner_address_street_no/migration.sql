BEGIN TRY

BEGIN TRAN;

-- AlterTable: widen business_partner_addresses.street_no from NVARCHAR(20)
-- to NVARCHAR(100).
--
-- The Business Partner address block was built to mirror Branch's own
-- address block (see the comment in partnerSchemas.js), but Branch's
-- street_no column is NVARCHAR(100) while this one was left at
-- NVARCHAR(20). Any street/door-number value over 20 characters (e.g.
-- "Padirikode P O,Edappatta") got rejected by SQL Server at insert time
-- with a "string or binary data would be truncated" error, which Prisma
-- surfaces as P2000 — previously unhandled by errorHandler.js, so it fell
-- through to a generic 500 and gave the user no indication of what went
-- wrong. Widening the column to match Branch's width fixes the underlying
-- cause; a companion change to errorHandler.js adds a clear P2000 message
-- as defense-in-depth for any other column this can happen on.
--
-- Metadata-only ALTER in SQL Server (widening an NVARCHAR column is not a
-- table rewrite), so this is safe to run against a live table with data.
-- Guarded on the column's current length so re-running this migration, or
-- running it after the column was already widened by other means, is a
-- no-op.

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[business_partner_addresses]')
      AND name = N'street_no'
      AND max_length <> 200 -- NVARCHAR(100) = 200 bytes (UTF-16)
)
BEGIN
    ALTER TABLE [dbo].[business_partner_addresses] ALTER COLUMN [street_no] NVARCHAR(100) NULL;
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
