BEGIN TRY

BEGIN TRAN;

-- AlterTable: location_master
--
-- Location Master now records the registered location's own address (Street
-- No, Building/Floor/Room, Block, Country, State, City, Zipcode) alongside
-- its statutory numbers — same SAP-style breakdown as Branch Details (see
-- the branches migrations). All nullable, matching this master's existing
-- design: the imported rows are sparsely filled, and requiring these would
-- make every existing location unsaveable until someone had researched it.
--
-- Guarded so this is safe to apply to a database where a column already
-- exists (matches the pattern used by the other AlterTable migrations here).
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[location_master]') AND name = 'street_no'
)
BEGIN
    ALTER TABLE [dbo].[location_master] ADD [street_no] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[location_master]') AND name = 'building_floor_room'
)
BEGIN
    ALTER TABLE [dbo].[location_master] ADD [building_floor_room] NVARCHAR(150) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[location_master]') AND name = 'block'
)
BEGIN
    ALTER TABLE [dbo].[location_master] ADD [block] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[location_master]') AND name = 'country'
)
BEGIN
    ALTER TABLE [dbo].[location_master] ADD [country] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[location_master]') AND name = 'state'
)
BEGIN
    ALTER TABLE [dbo].[location_master] ADD [state] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[location_master]') AND name = 'city'
)
BEGIN
    ALTER TABLE [dbo].[location_master] ADD [city] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[location_master]') AND name = 'zip_code'
)
BEGIN
    ALTER TABLE [dbo].[location_master] ADD [zip_code] NVARCHAR(20) NULL;
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
