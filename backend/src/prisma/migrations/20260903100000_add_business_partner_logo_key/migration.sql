BEGIN TRY

BEGIN TRAN;

-- AlterTable: business_partners -- object key of this partner's logo in OCI
-- Object Storage (business-partners/<partnerId>/logo/<uuid>.<ext>).
-- Nullable: most partners won't have uploaded one, and the form falls back
-- to a placeholder icon when this is null. See backend/src/utils/ociStorage.js
-- and routes/resources.js's POST/DELETE /business-partners/:id/logo.
ALTER TABLE [dbo].[business_partners] ADD [logo_key] NVARCHAR(500) NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
