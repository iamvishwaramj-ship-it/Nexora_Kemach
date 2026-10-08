BEGIN TRY

BEGIN TRAN;

-- User Master: "Employee User Code" login + linked Employee Master record.
--
-- 1) app_users.user_code becomes the primary login identifier, replacing
--    email on the User Master form. Existing rows are backfilled from their
--    email prefix (admin@nexora.com -> 'admin') so everyone who can log in
--    today still can, then the column is made NOT NULL + unique.
--
-- 2) email stops being the login key and becomes optional contact info —
--    services/authService.js still ACCEPTS it as a second login identifier
--    so pre-existing credentials keep working. Its old plain unique index is
--    replaced by a FILTERED one: SQL Server's ordinary UNIQUE permits only a
--    single NULL row, and once the form stops collecting email most accounts
--    will have none, which would otherwise fail on the second such user.
--
-- 3) employee_id/employee_code/employee_name link an account to an Employee
--    Master record (employee_code/name denormalized at save time so the user
--    list needs no join). ON DELETE SET NULL — removing an employee must
--    unlink the account, never delete someone's login.
--
-- NOTE ON EXEC(): SQL Server compiles an entire batch before running any of
-- it, and Prisma Migrate sends this file as one batch (it does not honour GO
-- separators). Any statement referencing a column added earlier in this same
-- file would therefore fail to compile with "Invalid column name". Wrapping
-- those statements in EXEC() defers their compilation until they actually
-- run, which is what makes add-then-populate work in a single migration.
--
-- Guarded throughout so this is safe to re-run.

-- 1. user_code ------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[app_users]') AND name = 'user_code')
BEGIN
    ALTER TABLE [dbo].[app_users] ADD [user_code] NVARCHAR(50) NULL;
END;

-- Backfill from the email prefix. CHARINDEX over (email + '@') guarantees a
-- match even for a stored value with no '@' in it, in which case the whole
-- string is taken.
EXEC('
UPDATE [dbo].[app_users]
SET [user_code] = LTRIM(RTRIM(LEFT([email], CHARINDEX(''@'', [email] + ''@'') - 1)))
WHERE [user_code] IS NULL
  AND [email] IS NOT NULL
  AND LTRIM(RTRIM([email])) <> '''';
');

-- Anything still blank (no email at all) gets a guaranteed-unique fallback.
EXEC('
UPDATE [dbo].[app_users]
SET [user_code] = ''user'' + CAST([id] AS NVARCHAR(20))
WHERE [user_code] IS NULL OR LTRIM(RTRIM([user_code])) = '''';
');

-- Two different addresses can share a prefix (a@x.com / a@y.com). Suffix the
-- later rows with their own id, which is unique by definition, so the unique
-- index below cannot fail. LEFT(...,40) keeps the result inside NVARCHAR(50).
-- Written as an UPDATE ... FROM against a derived table rather than updating
-- through the CTE directly: the column being written is the same one the
-- window function partitions on, and SQL Server is not reliably willing to
-- update a CTE in that shape. Joining on [id] sidesteps the question.
EXEC('
UPDATE u
SET u.[user_code] = LEFT(u.[user_code], 40) + ''_'' + CAST(u.[id] AS NVARCHAR(9))
FROM [dbo].[app_users] u
INNER JOIN (
    SELECT [id],
           ROW_NUMBER() OVER (PARTITION BY LOWER([user_code]) ORDER BY [id]) AS rn
    FROM [dbo].[app_users]
) d ON d.[id] = u.[id]
WHERE d.rn > 1;
');

EXEC('ALTER TABLE [dbo].[app_users] ALTER COLUMN [user_code] NVARCHAR(50) NOT NULL');

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'app_users_user_code_key' AND object_id = OBJECT_ID(N'[dbo].[app_users]'))
BEGIN
    EXEC('CREATE UNIQUE INDEX [app_users_user_code_key] ON [dbo].[app_users]([user_code])');
END;

-- 2. email: no longer the login key ---------------------------------------
-- Drop the plain unique index BEFORE relaxing nullability, then re-create it
-- filtered so any number of rows may leave email empty.
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'app_users_email_key' AND object_id = OBJECT_ID(N'[dbo].[app_users]'))
BEGIN
    DROP INDEX [app_users_email_key] ON [dbo].[app_users];
END;

ALTER TABLE [dbo].[app_users] ALTER COLUMN [email] NVARCHAR(100) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'app_users_email_unique_notnull' AND object_id = OBJECT_ID(N'[dbo].[app_users]'))
BEGIN
    CREATE UNIQUE INDEX [app_users_email_unique_notnull]
        ON [dbo].[app_users]([email])
        WHERE [email] IS NOT NULL;
END;

-- 3. Linked Employee Master record ----------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[app_users]') AND name = 'employee_id')
BEGIN
    ALTER TABLE [dbo].[app_users] ADD [employee_id] INT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[app_users]') AND name = 'employee_code')
BEGIN
    ALTER TABLE [dbo].[app_users] ADD [employee_code] NVARCHAR(50) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[app_users]') AND name = 'employee_name')
BEGIN
    ALTER TABLE [dbo].[app_users] ADD [employee_name] NVARCHAR(150) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'app_users_employee_id_fkey')
BEGIN
    EXEC('
    ALTER TABLE [dbo].[app_users] ADD CONSTRAINT [app_users_employee_id_fkey]
        FOREIGN KEY ([employee_id]) REFERENCES [dbo].[sales_employees]([id]) ON DELETE SET NULL;
    ');
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
