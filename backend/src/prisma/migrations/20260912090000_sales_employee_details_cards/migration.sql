BEGIN TRY

BEGIN TRAN;

-- AlterTable: sales_employees (SalesEmployee — Employee Master)
--
-- Redesigns the Add/Edit popup into two cards ("Employee Details" and
-- "Other Details") and adds every new field that design needs:
--   - branch_id: FK to branches (Card 1, alongside department_id)
--   - pay_mode / account_number / ifsc_code / bank_branch: Card 2's
--     Bank/Cash section — all nullable, since Cash leaves the bank fields
--     empty and only the frontend enforces "required when Bank" (same
--     format-only / no-presence-check split every other master in this
--     app already uses between Zod and formatRules)
--   - address_line1 / address_line2 / country / state / city / zip:
--     Permanent Address Details, replacing the single free-text `address`
--     column on the form (the column itself is left in place — see the
--     schema.prisma comment on SalesEmployee.address)
--   - pan_number / alternate_mobile_number
--
-- Guarded throughout so this is safe to re-run without erroring on state
-- it already produced.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_employees]') AND name = 'branch_id')
BEGIN
    ALTER TABLE [dbo].[sales_employees] ADD [branch_id] INT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_employees]') AND name = 'address_line1')
BEGIN
    ALTER TABLE [dbo].[sales_employees] ADD [address_line1] NVARCHAR(200) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_employees]') AND name = 'address_line2')
BEGIN
    ALTER TABLE [dbo].[sales_employees] ADD [address_line2] NVARCHAR(200) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_employees]') AND name = 'country')
BEGIN
    ALTER TABLE [dbo].[sales_employees] ADD [country] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_employees]') AND name = 'state')
BEGIN
    ALTER TABLE [dbo].[sales_employees] ADD [state] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_employees]') AND name = 'city')
BEGIN
    ALTER TABLE [dbo].[sales_employees] ADD [city] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_employees]') AND name = 'zip')
BEGIN
    ALTER TABLE [dbo].[sales_employees] ADD [zip] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_employees]') AND name = 'pan_number')
BEGIN
    ALTER TABLE [dbo].[sales_employees] ADD [pan_number] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_employees]') AND name = 'alternate_mobile_number')
BEGIN
    ALTER TABLE [dbo].[sales_employees] ADD [alternate_mobile_number] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_employees]') AND name = 'pay_mode')
BEGIN
    ALTER TABLE [dbo].[sales_employees] ADD [pay_mode] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_employees]') AND name = 'account_number')
BEGIN
    ALTER TABLE [dbo].[sales_employees] ADD [account_number] NVARCHAR(30) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_employees]') AND name = 'ifsc_code')
BEGIN
    ALTER TABLE [dbo].[sales_employees] ADD [ifsc_code] NVARCHAR(11) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[sales_employees]') AND name = 'bank_branch')
BEGIN
    ALTER TABLE [dbo].[sales_employees] ADD [bank_branch] NVARCHAR(150) NULL;
END;

-- AddForeignKey — mirrors FK_sales_employees_department (see
-- 20260903120000_sales_employee_department_fk).
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_sales_employees_branch')
BEGIN
    ALTER TABLE [dbo].[sales_employees] ADD CONSTRAINT [FK_sales_employees_branch]
        FOREIGN KEY ([branch_id]) REFERENCES [dbo].[branches]([id]);
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
