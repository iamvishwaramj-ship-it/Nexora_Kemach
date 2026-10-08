BEGIN TRY

BEGIN TRAN;

-- CreateTable: einvoice_settings
--
-- Singleton config row for Settings > "E-Invoice / E-Way Bill Settings"
-- (see backend/src/routes/company.js's /einvoice-settings routes and
-- services/taxproGsp.service.js's loadConfig()). Only the non-secret half
-- of the TaxPro GSP config lives here — ASP Password and both e-invoice
-- Passwords are never columns on this table; they stay in .env.
--
-- Guarded so this is safe to apply to a database where the table already
-- exists, same style as every other CreateTable migration in this project.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'einvoice_settings')
BEGIN
    CREATE TABLE [dbo].[einvoice_settings] (
        [id]                  INT IDENTITY(1,1) NOT NULL,
        [enabled]             BIT NOT NULL CONSTRAINT [DF_einvoice_settings_enabled] DEFAULT 0,
        [environment]         NVARCHAR(20) NOT NULL CONSTRAINT [DF_einvoice_settings_environment] DEFAULT N'sandbox',
        [sandbox_api_url]     NVARCHAR(300) NULL,
        [production_api_url]  NVARCHAR(300) NULL,
        [qr_code_size]        INT NOT NULL CONSTRAINT [DF_einvoice_settings_qr_code_size] DEFAULT 300,
        [asp_id]              NVARCHAR(50) NULL,
        [sandbox_gstin]       NVARCHAR(15) NULL,
        [sandbox_username]    NVARCHAR(100) NULL,
        [production_gstin]    NVARCHAR(15) NULL,
        [production_username] NVARCHAR(100) NULL,
        CONSTRAINT [einvoice_settings_pkey] PRIMARY KEY CLUSTERED ([id])
    );
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
