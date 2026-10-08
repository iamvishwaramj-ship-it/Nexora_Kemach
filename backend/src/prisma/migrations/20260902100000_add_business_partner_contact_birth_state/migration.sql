BEGIN TRY

BEGIN TRAN;

-- AlterTable: BusinessPartnerContact — Birth State, added between Birth
-- Country and Birth City on the Contact Person dialog now that all three
-- are populated from the country-state-city package's cascading lists.
ALTER TABLE [dbo].[business_partner_contacts] ADD [birth_state] NVARCHAR(50) NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
