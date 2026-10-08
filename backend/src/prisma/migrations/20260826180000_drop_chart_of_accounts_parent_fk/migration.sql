BEGIN TRY

BEGIN TRAN;

-- DropForeignKey: FK_ChartOfAccounts_Parent
--
-- ParentAccountID keeps storing the parent's AccountCode (see model
-- ChartOfAccount in schema.prisma), but it is no longer a DB-enforced FK --
-- brought in line with every other "cross-master by code" reference already
-- in this schema (Branch.defaultCustomerCode, ProductGroup/WarehouseMaster's
-- *Account fields, JournalEntryLine.accountCode), all of which are plain
-- app-validated strings with no Prisma relation/DB constraint. Parent
-- validity, cycle detection and the drawer/level rules are still enforced
-- at the application layer (backend/src/utils/chartOfAccountRules.js) --
-- removing the DB constraint does not remove those checks.
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ChartOfAccounts_Parent')
BEGIN
    ALTER TABLE [dbo].[ChartOfAccounts] DROP CONSTRAINT [FK_ChartOfAccounts_Parent];
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
