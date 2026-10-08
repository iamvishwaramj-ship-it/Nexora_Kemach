BEGIN TRY

BEGIN TRAN;

-- CreateTable: DepartmentMaster
--
-- A simple 3-field lookup (code, name, status) added so Employee Master's
-- Department field can become a proper FK (sales_employees.department_id)
-- instead of the free-text column it replaces. Must apply before
-- 20260903120000_sales_employee_department_fk, which references this table.
--
-- Guarded so this is safe to apply to a database where the table already
-- exists (e.g. created by hand or by seed_department_master.js's own
-- self-sufficient CREATE_TABLE_SQL guard — see that file).
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'department_master')
BEGIN
    CREATE TABLE [dbo].[department_master] (
        [id]     INT IDENTITY(1,1) NOT NULL,
        [code]   NVARCHAR(50) NOT NULL,
        [name]   NVARCHAR(150) NOT NULL,
        [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_department_master_status] DEFAULT N'Active',
        CONSTRAINT [department_master_pkey] PRIMARY KEY CLUSTERED ([id])
    );
    CREATE UNIQUE INDEX [department_master_code_key] ON [dbo].[department_master]([code]);
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
