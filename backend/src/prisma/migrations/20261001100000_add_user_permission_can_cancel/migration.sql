BEGIN TRY

BEGIN TRAN;

-- AlterTable: user_permissions.can_cancel
--
-- Dedicated Cancel permission for Purchase/Sales documents (User Management >
-- Permissions > Cancel). Until now the Cancel icon/endpoints were governed by
-- can_edit. To keep every existing user's access exactly as it was, rows that
-- already hold can_edit are backfilled with can_cancel = 1; new grants are
-- then managed independently.
IF COL_LENGTH('dbo.user_permissions', 'can_cancel') IS NULL
BEGIN
    ALTER TABLE [dbo].[user_permissions]
        ADD [can_cancel] BIT NOT NULL CONSTRAINT [DF_user_permissions_can_cancel] DEFAULT 0;
END;

EXEC('UPDATE [dbo].[user_permissions] SET [can_cancel] = 1 WHERE [can_edit] = 1 AND [can_cancel] = 0');

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
