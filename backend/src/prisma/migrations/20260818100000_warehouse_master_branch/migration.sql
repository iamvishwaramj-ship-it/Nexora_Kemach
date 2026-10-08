BEGIN TRY

BEGIN TRAN;

-- AlterTable: warehouse (WarehouseMaster — the surviving warehouse master)
--
-- Which branch operates a warehouse. This column was added to [warehouses] by
-- the previous migration; it belongs here instead, because [warehouse] is now
-- the single master every warehouse dropdown in the application reads from.
-- The earlier column is left in place rather than dropped — see the note at the
-- foot of this file.
--
-- Nullable with no default: existing warehouses genuinely have no branch
-- recorded, and defaulting them to one would attribute stock to a branch nobody
-- chose. They read as blank until set on Company Setup > Warehouse Master.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'branch'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [branch] NVARCHAR(150) NULL;
END;

-- [dbo].[warehouses] is deliberately NOT dropped, and its own branch column is
-- deliberately NOT removed.
--
-- Dropping a table in the same change that stops reading it means a mistake in
-- the consolidation is unrecoverable. Run scripts/consolidateWarehouses.js
-- first: it copies every warehouse that exists only in [warehouses] across into
-- [warehouse], and reports anything it could not. Once the surviving master is
-- confirmed complete, dropping the old table is a one-line migration of its
-- own — taken deliberately, not as a side effect of this one.

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
