BEGIN TRY

BEGIN TRAN;

-- AlterTable: Stock
--
-- Renaming the two costing columns to say what they hold instead of reading
-- like a costing-method flag: FIFO -> FIFO_COST, MAV -> MAV_COST. Written
-- only for products whose Product Master Calculation Method selects that
-- costing method (see utils/stockTable.js), and read back by
-- utils/productInventory.js for the Product Inventory tab; both stay NULL
-- otherwise. sp_rename preserves the existing data and any index/constraint
-- built on the column -- this is a rename, not a drop/recreate.
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Stock]') AND name = 'FIFO'
) AND NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Stock]') AND name = 'FIFO_COST'
)
BEGIN
    EXEC sp_rename N'[dbo].[Stock].[FIFO]', N'FIFO_COST', 'COLUMN';
END;

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Stock]') AND name = 'MAV'
) AND NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Stock]') AND name = 'MAV_COST'
)
BEGIN
    EXEC sp_rename N'[dbo].[Stock].[MAV]', N'MAV_COST', 'COLUMN';
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
