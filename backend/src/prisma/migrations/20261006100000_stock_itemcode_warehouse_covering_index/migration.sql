-- Covering index for the stock-costing replay (utils/stockValuation.js loadState):
--   SELECT InQty, OutQty, StockPrice FROM Stock WHERE ItemCode = @i AND Warehouse = @w ORDER BY LogEntry
-- Before: IX_Stock_ItemCode_Warehouse held only (ItemCode, Warehouse), so every
-- matching row needed a second lookup into the clustered index (PK_OINM). A reader
-- locks nonclustered -> clustered while a writer inserting into the same table locks
-- clustered -> nonclustered, which is the classic key-lookup DEADLOCK that kept
-- killing Inventory Opening Balance saves ("changed by another action at the same
-- moment"). With every needed column in the index there is no lookup, so the
-- reader never touches the clustered index and that deadlock cannot form. It also
-- makes the replay (and the slow product list) much cheaper.
-- LogEntry (the clustered key) is carried in the index automatically, so ORDER BY
-- LogEntry needs no sort.
IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_Stock_ItemCode_Warehouse' AND object_id = OBJECT_ID('dbo.Stock')
)
BEGIN
  CREATE NONCLUSTERED INDEX [IX_Stock_ItemCode_Warehouse]
    ON [dbo].[Stock] ([ItemCode], [Warehouse])
    INCLUDE ([InQty], [OutQty], [StockPrice])
    WITH (DROP_EXISTING = ON);
END
ELSE
BEGIN
  CREATE NONCLUSTERED INDEX [IX_Stock_ItemCode_Warehouse]
    ON [dbo].[Stock] ([ItemCode], [Warehouse])
    INCLUDE ([InQty], [OutQty], [StockPrice]);
END
