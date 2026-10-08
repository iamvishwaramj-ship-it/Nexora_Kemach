BEGIN TRY

BEGIN TRAN;

-- Removes the "Reporting Manager" field entirely — the frontend/backend no
-- longer expose or validate it (see SalesEmployee.jsx, companySchemas.js,
-- schema.prisma). Free-text column with no FK/index of its own (baked into
-- the initial migration — see 20260813120000_init_sqlserver/migration.sql:143
-- — so it has to be dropped here rather than edited in place), so a plain
-- guarded DROP COLUMN is all this needs.

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_employees]') AND name = 'reporting_manager')
BEGIN
    ALTER TABLE [dbo].[sales_employees] DROP COLUMN [reporting_manager];
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
