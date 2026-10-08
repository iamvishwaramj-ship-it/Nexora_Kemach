BEGIN TRY

BEGIN TRAN;

-- PAN Card Number on Business Partner billing / shipping addresses.
-- Nullable, so every existing address row stays valid untouched.
IF COL_LENGTH(N'[dbo].[business_partner_addresses]', N'pan_no') IS NULL
BEGIN
    ALTER TABLE [dbo].[business_partner_addresses] ADD [pan_no] NVARCHAR(20) NULL;
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
