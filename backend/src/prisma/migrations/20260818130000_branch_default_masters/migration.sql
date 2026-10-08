BEGIN TRY

BEGIN TRAN;

-- AlterTable: branches
--
-- Branch Details now lets a branch carry a default Warehouse/Customer/Vendor,
-- so a new document raised on that branch can pre-fill them instead of the
-- user re-selecting the same ones every time. Stored by code/name (not FK
-- id), matching every other cross-master reference in this schema — see
-- WarehouseMaster.branch — so a renamed warehouse/customer/vendor doesn't
-- silently break the reference.
--
-- Nullable with no default: existing branches have no default recorded, and
-- guessing one would silently attribute new documents to a choice nobody made.
-- They read as blank until set on Company Setup > Branch Details.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[branches]') AND name = 'default_warehouse'
)
BEGIN
    ALTER TABLE [dbo].[branches] ADD [default_warehouse] NVARCHAR(50) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[branches]') AND name = 'default_customer'
)
BEGIN
    ALTER TABLE [dbo].[branches] ADD [default_customer] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[branches]') AND name = 'default_vendor'
)
BEGIN
    ALTER TABLE [dbo].[branches] ADD [default_vendor] NVARCHAR(100) NULL;
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
