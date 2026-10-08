BEGIN TRY

BEGIN TRAN;

-- AlterTable: business_partners -- Payment Run tab gained IFSC Code and
-- Branch alongside the existing House Bank / Bank Account No, so the
-- partner's bank branch details can be captured in full. Both nullable,
-- like every other Payment Run field on this master.
ALTER TABLE [dbo].[business_partners] ADD [ifsc_code] NVARCHAR(11) NULL;
ALTER TABLE [dbo].[business_partners] ADD [branch] NVARCHAR(100) NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
