BEGIN TRY

BEGIN TRAN;

-- [dbo].[Stock].[BaseEntry] and [BaseNum] came out of the previous rename
-- migration as BIGINT on this database, instead of the INT / NVARCHAR(50)
-- that schema.prisma and every other environment's Stock table use. This
-- table pre-existed Prisma's management here (see the comment on the
-- baseline migration and on scripts/ensureStockTable.js), and sp_rename
-- only relabels a column -- it never changes its type -- so whatever type
-- the old TransNum column already had on THIS database carried straight
-- through to BaseEntry, and a BaseNum column already sitting there under
-- that name (also BIGINT) meant the later "ADD [BaseNum] NVARCHAR(50)"
-- silently no-opped against its own IF NOT EXISTS guard.
--
-- Concretely this broke posting: a document's display number (e.g.
-- 'GRN-26-27-000001') is a string, and writing it into a BIGINT BaseNum
-- column fails with "Error converting data type nvarchar to bigint."
--
-- Both ALTER COLUMNs below are guarded to only run if the live column is
-- still BIGINT, so this migration is a no-op (and safe to re-run) once
-- applied, and a no-op outright on any database where the earlier rename
-- already produced the correct types.

-- The index on (BaseType, BaseEntry) has to be dropped before BaseEntry's
-- type can change, then rebuilt afterward.
IF EXISTS (
    SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Stock]') AND name = 'IX_Stock_BaseType_BaseEntry'
)
   AND EXISTS (
    SELECT 1 FROM sys.columns c JOIN sys.types t ON c.user_type_id = t.user_type_id
    WHERE c.object_id = OBJECT_ID(N'[dbo].[Stock]') AND c.name = 'BaseEntry' AND t.name = 'bigint'
)
BEGIN
    DROP INDEX [IX_Stock_BaseType_BaseEntry] ON [dbo].[Stock];
END;

IF EXISTS (
    SELECT 1 FROM sys.columns c JOIN sys.types t ON c.user_type_id = t.user_type_id
    WHERE c.object_id = OBJECT_ID(N'[dbo].[Stock]') AND c.name = 'BaseEntry' AND t.name = 'bigint'
)
BEGIN
    ALTER TABLE [dbo].[Stock] ALTER COLUMN [BaseEntry] INT NOT NULL;
END;

IF EXISTS (
    SELECT 1 FROM sys.columns c JOIN sys.types t ON c.user_type_id = t.user_type_id
    WHERE c.object_id = OBJECT_ID(N'[dbo].[Stock]') AND c.name = 'BaseNum' AND t.name = 'bigint'
)
BEGIN
    ALTER TABLE [dbo].[Stock] ALTER COLUMN [BaseNum] NVARCHAR(50) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Stock]') AND name = 'IX_Stock_BaseType_BaseEntry'
)
BEGIN
    CREATE INDEX [IX_Stock_BaseType_BaseEntry] ON [dbo].[Stock]([BaseType], [BaseEntry]);
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
