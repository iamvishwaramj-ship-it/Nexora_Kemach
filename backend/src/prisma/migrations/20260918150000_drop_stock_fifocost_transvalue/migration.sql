BEGIN TRY

BEGIN TRAN;

-- Drop [dbo].[Stock].[FIFO_COST] and [dbo].[Stock].[TransValue] -- neither is
-- part of the final requested column layout (LogEntry, BaseEntry, BaseNum,
-- BaseType, BaseLine, ItemId, ItemCode, ItemName, Warehouse, InQty, OutQty,
-- StockPrice, Currency, CreatedBy, CreateDate, CreateTime, ItemCost,
-- PostGeneration). TransValue was only ever quantity x price, always
-- recomputable, so nothing is lost dropping it. FIFO_COST is different: any
-- FIFO-costed product's historical per-line cost lived ONLY in this column,
-- and dropping it deletes that history permanently -- confirmed explicitly
-- before writing this migration. Going forward, FIFO cost is written into
-- ItemCost instead (see utils/stockTable.js) -- FIFO and Moving Average are
-- mutually exclusive per product, so one column is enough for either.
--
-- Neither column carries a default constraint, so a plain DROP COLUMN is
-- enough -- no constraint to drop first.

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Stock]') AND name = 'FIFO_COST')
BEGIN
    ALTER TABLE [dbo].[Stock] DROP COLUMN [FIFO_COST];
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Stock]') AND name = 'TransValue')
BEGIN
    ALTER TABLE [dbo].[Stock] DROP COLUMN [TransValue];
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
