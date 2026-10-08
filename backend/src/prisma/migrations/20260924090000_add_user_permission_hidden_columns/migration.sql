BEGIN TRY

BEGIN TRAN;

-- AlterTable: user_permissions.hidden_columns
--
-- Per-user, per-menu list of report columns the user may NOT see (JSON array
-- of column keys, e.g. ["unitCost","onHandValue"]). Set from User
-- Management > Permissions > "Columns" on a report row (currently Reports >
-- Inventory > Available Balance). NULL = every column allowed, so existing
-- users see exactly what they saw before.
IF COL_LENGTH('dbo.user_permissions', 'hidden_columns') IS NULL
BEGIN
    ALTER TABLE [dbo].[user_permissions] ADD [hidden_columns] NVARCHAR(MAX) NULL;
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
