BEGIN TRY

BEGIN TRAN;

-- AlterTable: branches
--
-- Branch Details now exposes a full SAP-style address breakdown (Street No,
-- Building/Floor/Room, Block, Country) alongside the existing free-text
-- `address` line, and the India-specific "Pincode" field is renamed to the
-- country-agnostic "Zipcode" now that a Country selector is on the form.
--
-- Guarded so this is safe to apply to a database where a column already
-- exists (matches the pattern used by the other AlterTable migrations here).
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[branches]') AND name = 'street_no'
)
BEGIN
    ALTER TABLE [dbo].[branches] ADD [street_no] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[branches]') AND name = 'building_floor_room'
)
BEGIN
    ALTER TABLE [dbo].[branches] ADD [building_floor_room] NVARCHAR(150) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[branches]') AND name = 'block'
)
BEGIN
    ALTER TABLE [dbo].[branches] ADD [block] NVARCHAR(100) NULL;
END;

-- pincode -> zip_code: rename in place so existing values survive, rather
-- than add-then-drop (which would silently blank every branch's PIN code).
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[branches]') AND name = 'pincode'
) AND NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[branches]') AND name = 'zip_code'
)
BEGIN
    EXEC sp_rename '[dbo].[branches].[pincode]', 'zip_code', 'COLUMN';
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
