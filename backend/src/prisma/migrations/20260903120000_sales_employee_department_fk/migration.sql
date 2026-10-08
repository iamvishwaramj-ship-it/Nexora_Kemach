BEGIN TRY

BEGIN TRAN;

-- AlterTable: sales_employees (SalesEmployee — UI-relabeled "Employee
-- Master"; internal model/table name unchanged, see navConfig.js)
--
-- 1) Drop `designation` — removed from the Employee Master form entirely.
-- 2) Replace the free-text `department` column with `department_id`, an FK
--    to department_master (created by 20260903110000_department_master,
--    which must apply before this one).
-- 3) Backfill: for every distinct non-null `department` value still on
--    sales_employees, ensure a matching department_master row exists
--    (insert if missing, matched by name) and point department_id at it.
-- 4) Drop the old free-text `department` column.
--
-- Guarded throughout so this is safe to re-run (e.g. after a partial
-- failure) without erroring on state it already produced.

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_employees]') AND name = 'designation')
BEGIN
    ALTER TABLE [dbo].[sales_employees] DROP COLUMN [designation];
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_employees]') AND name = 'department_id')
BEGIN
    ALTER TABLE [dbo].[sales_employees] ADD [department_id] INT NULL;
END;

-- Insert any distinct free-text department value not already present in
-- department_master, so the backfill below never leaves a row unmatched.
-- New codes continue the running-integer numbering DepartmentMaster.jsx
-- itself uses (one past the highest whole-number code already in use).
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_employees]') AND name = 'department')
BEGIN
    EXEC('
        DECLARE @nextCode INT = ISNULL((
            SELECT MAX(TRY_CAST([code] AS INT)) FROM [dbo].[department_master]
            WHERE [code] NOT LIKE ''%[^0-9]%''
        ), 0);

        ;WITH missing AS (
            SELECT DISTINCT LTRIM(RTRIM(se.[department])) AS dept_name
            FROM [dbo].[sales_employees] se
            WHERE se.[department] IS NOT NULL AND LTRIM(RTRIM(se.[department])) <> ''''
              AND NOT EXISTS (
                  SELECT 1 FROM [dbo].[department_master] dm
                  WHERE dm.[name] = LTRIM(RTRIM(se.[department]))
              )
        ), numbered AS (
            SELECT dept_name, ROW_NUMBER() OVER (ORDER BY dept_name) AS rn
            FROM missing
        )
        INSERT INTO [dbo].[department_master] ([code], [name], [status])
        SELECT CAST(@nextCode + rn AS NVARCHAR(50)), dept_name, N''Active''
        FROM numbered;

        UPDATE se
        SET se.[department_id] = dm.[id]
        FROM [dbo].[sales_employees] se
        INNER JOIN [dbo].[department_master] dm ON dm.[name] = LTRIM(RTRIM(se.[department]))
        WHERE se.[department] IS NOT NULL AND LTRIM(RTRIM(se.[department])) <> '''' AND se.[department_id] IS NULL;
    ');
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_employees]') AND name = 'department')
BEGIN
    ALTER TABLE [dbo].[sales_employees] DROP COLUMN [department];
END;

-- AddForeignKey
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_sales_employees_department')
BEGIN
    ALTER TABLE [dbo].[sales_employees] ADD CONSTRAINT [FK_sales_employees_department]
        FOREIGN KEY ([department_id]) REFERENCES [dbo].[department_master]([id]);
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
