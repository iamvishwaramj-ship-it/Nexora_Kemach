BEGIN TRY

BEGIN TRAN;

-- CreateTable: system_settings
--
-- Singleton config row (one for the whole org, like company_details /
-- einvoice_settings) for the global Module Validation & Execution Gate --
-- see backend/src/utils/systemSettings.js (assertModuleEnabled,
-- isInventoryModuleEnabled) and the /company/system-settings routes in
-- backend/src/routes/company.js. All three default to 1 (enabled) so an
-- existing database that applies this migration keeps every module exactly
-- as usable as it was before this feature existed -- nothing is gated until
-- someone deliberately unticks a box in Settings.
--
-- Guarded so this is safe to apply to a database where the table already
-- exists, same style as every other CreateTable migration in this project.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'system_settings')
BEGIN
    CREATE TABLE [dbo].[system_settings] (
        [id]                     INT IDENTITY(1,1) NOT NULL,
        [is_sales_enabled]       BIT NOT NULL CONSTRAINT [DF_system_settings_is_sales_enabled] DEFAULT 1,
        [is_purchase_enabled]    BIT NOT NULL CONSTRAINT [DF_system_settings_is_purchase_enabled] DEFAULT 1,
        [is_inventory_enabled]   BIT NOT NULL CONSTRAINT [DF_system_settings_is_inventory_enabled] DEFAULT 1,
        CONSTRAINT [system_settings_pkey] PRIMARY KEY CLUSTERED ([id])
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
