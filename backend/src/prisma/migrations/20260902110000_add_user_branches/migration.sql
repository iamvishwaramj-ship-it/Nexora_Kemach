BEGIN TRY

BEGIN TRAN;

-- CreateTable: user_branches
--
-- Backs the new Branch tab on the User Management New/Edit User dialog. One
-- row per (user, branch); which of a user's branches is their default is
-- carried on this same row (is_default) rather than a separate column on
-- app_users, mirroring how Branch.isDefault marks the company's own Main
-- Branch. Unlike user_permissions this has a real FK into branches (not just
-- app_users) -- this table exists purely to answer "which branches can this
-- user see", so referential integrity is worth keeping. Deleting a user
-- cascades its rows; deleting a branch that's still assigned to a user is
-- blocked (NO ACTION) rather than silently unassigning it.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'user_branches' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[user_branches] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [user_id] INT NOT NULL,
        [branch_id] INT NOT NULL,
        [is_default] BIT NOT NULL CONSTRAINT [DF_user_branches_is_default] DEFAULT 0,
        CONSTRAINT [user_branches_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'UQ_UserBranch_User_Branch'
      AND object_id = OBJECT_ID(N'[dbo].[user_branches]')
)
BEGIN
    CREATE UNIQUE INDEX [UQ_UserBranch_User_Branch] ON [dbo].[user_branches]([user_id], [branch_id]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'user_branches_user_id_fkey'
)
BEGIN
    ALTER TABLE [dbo].[user_branches]
      ADD CONSTRAINT [user_branches_user_id_fkey]
      FOREIGN KEY ([user_id]) REFERENCES [dbo].[app_users]([id]) ON DELETE CASCADE;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'user_branches_branch_id_fkey'
)
BEGIN
    ALTER TABLE [dbo].[user_branches]
      ADD CONSTRAINT [user_branches_branch_id_fkey]
      FOREIGN KEY ([branch_id]) REFERENCES [dbo].[branches]([id]) ON DELETE NO ACTION;
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
