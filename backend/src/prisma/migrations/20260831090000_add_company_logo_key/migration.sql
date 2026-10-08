BEGIN TRY

BEGIN TRAN;

-- AlterTable: company_details -- object key of the tenant logo in OCI
-- Object Storage (company/<companyId>/logo/<uuid>.<ext>). Nullable: most
-- companies won't have uploaded a logo, and the header falls back to a
-- generic building icon when this is null. See backend/src/utils/ociStorage.js
-- and routes/company.js's POST/DELETE /company/logo.
ALTER TABLE [dbo].[company_details] ADD [logo_key] NVARCHAR(500) NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
