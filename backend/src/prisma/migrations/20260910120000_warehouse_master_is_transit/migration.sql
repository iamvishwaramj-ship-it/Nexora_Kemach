BEGIN TRY

BEGIN TRAN;

-- AlterTable: warehouse
--
-- Marks a warehouse as its Branch's Transit Warehouse (the "Transit
-- Warehouse" tick on the New/Edit Warehouse form, General tab). Existing rows
-- default to 0 — none of them were flagged before this column existed.
-- Exclusivity (at most one transit warehouse per branch) is enforced in the
-- app layer, in the /warehouse-master route's afterWrite — see
-- backend/src/routes/resources.js — the same way Branch.isDefault is, not
-- by a DB constraint, since the scoping column (branch) is a plain string,
-- not a FK.
--
-- Guarded so the migration is safe to apply to a database where the column
-- was already added by hand: an unguarded ADD would fail and block every
-- later migration.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'is_transit'
)
BEGIN
    ALTER TABLE [dbo].[warehouse]
      ADD [is_transit] BIT NOT NULL CONSTRAINT [DF_warehouse_is_transit] DEFAULT 0;
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
