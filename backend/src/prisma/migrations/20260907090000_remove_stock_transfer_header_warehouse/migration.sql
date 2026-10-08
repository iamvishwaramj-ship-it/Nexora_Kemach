BEGIN TRY

BEGIN TRAN;

-- AlterTable: stock_transfers — drop from_warehouse, to_warehouse.
--
-- Stock Transfer's header-level From/To Warehouse were redundant with
-- StockTransferItem.from_warehouse/to_warehouse (each line already carries
-- its own From/To Warehouse, and different lines on the same document can
-- move stock between different warehouse pairs), so the header pair is
-- removed entirely. StockTransferItem.from_warehouse/to_warehouse are the
-- SOLE source of truth from now on and are NOT touched by this migration —
-- only the stock_transfers (header) table's own two columns are dropped.
--
-- Both columns are nullable with no DEFAULT (see schema.prisma:
-- `fromWarehouse String? @map("from_warehouse")` / same for toWarehouse),
-- so a plain guarded DROP COLUMN is enough — no default-constraint cursor
-- needed, same reasoning as 20260824130000_drop_journal_entry_reference_and_tax_fields's
-- bp_project/trans_no/trans_code columns.
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfers]') AND name = 'from_warehouse')
BEGIN
    ALTER TABLE [dbo].[stock_transfers] DROP COLUMN [from_warehouse];
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfers]') AND name = 'to_warehouse')
BEGIN
    ALTER TABLE [dbo].[stock_transfers] DROP COLUMN [to_warehouse];
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
