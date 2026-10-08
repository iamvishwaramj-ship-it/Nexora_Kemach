BEGIN TRY

BEGIN TRAN;

-- [dbo].[Stock].[Branch] -- the branch a movement belongs to, cached on the
-- row the same way ItemName is, so historical rows keep the branch they
-- were posted under. Guarded: this was added directly on the live table
-- already (VARCHAR(100) NULL) before this migration was written, so on
-- that database this is a no-op; on any other environment it creates the
-- column fresh with the same type.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Stock]') AND name = 'Branch'
)
BEGIN
    ALTER TABLE [dbo].[Stock] ADD [Branch] VARCHAR(100) NULL;
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
