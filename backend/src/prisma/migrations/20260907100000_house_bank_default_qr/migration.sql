BEGIN TRY

BEGIN TRAN;

-- HouseBank.isDefault — at most one house bank may be flagged as the
-- default (see routes/company.js's afterWrite hook, same
-- promote-demotes-the-incumbent pattern as Branch.isDefault). Existing rows
-- default to 0/false so no house bank is accidentally promoted by this
-- migration.
ALTER TABLE [dbo].[house_banks] ADD [is_default] BIT NOT NULL CONSTRAINT [DF_house_banks_is_default] DEFAULT 0;

-- HouseBank.qrCodePath — object-storage key for the bank's uploaded QR code
-- image, same OCI Object Storage pattern as company_details.logo_key /
-- business_partners.logo_key. Nullable: most existing rows have no QR code
-- uploaded yet.
ALTER TABLE [dbo].[house_banks] ADD [qr_code_path] NVARCHAR(500) NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
