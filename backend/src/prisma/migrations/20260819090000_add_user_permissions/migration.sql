BEGIN TRY

BEGIN TRAN;

-- CreateTable: user_permissions
--
-- Backs the new User Management screen (Settings > User, sidebar entry
-- "User"). One row per (user, menu item); menuKey matches a `key` in
-- frontend/src/router/navConfig.js, covering both top-level sections and
-- their submenus. Permissions are granted directly per user -- there is
-- deliberately no separate Role table. Deleting a user cascades its rows.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'user_permissions' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[user_permissions] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [user_id] INT NOT NULL,
        [menu_key] NVARCHAR(100) NOT NULL,
        [can_view] BIT NOT NULL CONSTRAINT [DF_user_permissions_can_view] DEFAULT 0,
        [can_add] BIT NOT NULL CONSTRAINT [DF_user_permissions_can_add] DEFAULT 0,
        [can_edit] BIT NOT NULL CONSTRAINT [DF_user_permissions_can_edit] DEFAULT 0,
        [can_delete] BIT NOT NULL CONSTRAINT [DF_user_permissions_can_delete] DEFAULT 0,
        CONSTRAINT [user_permissions_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'UQ_UserPermission_User_MenuKey'
      AND object_id = OBJECT_ID(N'[dbo].[user_permissions]')
)
BEGIN
    CREATE UNIQUE INDEX [UQ_UserPermission_User_MenuKey] ON [dbo].[user_permissions]([user_id], [menu_key]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'user_permissions_user_id_fkey'
)
BEGIN
    ALTER TABLE [dbo].[user_permissions]
      ADD CONSTRAINT [user_permissions_user_id_fkey]
      FOREIGN KEY ([user_id]) REFERENCES [dbo].[app_users]([id]) ON DELETE CASCADE;
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
