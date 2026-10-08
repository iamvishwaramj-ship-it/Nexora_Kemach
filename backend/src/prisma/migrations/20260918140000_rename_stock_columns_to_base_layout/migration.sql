BEGIN TRY

BEGIN TRAN;

-- Rename [dbo].[Stock]'s columns to the new SAP-style source-document-linking
-- layout (DocEntry/TransNum/TransType/TransValue's siblings/Dscription/Price/
-- LineNum/MAV_COST -> LogEntry/BaseEntry/BaseType/BaseNum/ItemName/
-- StockPrice/BaseLine/ItemCost), and add BaseNum, the one genuinely new
-- column (the source document's human-readable display number, alongside
-- BaseEntry's internal id). FIFO_COST and TransValue are untouched -- they
-- are kept as extra columns beyond the new layout, not renamed. Each rename
-- is guarded so this migration is safe to run again if it partially applied.

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Stock]') AND name = 'DocEntry')
   AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Stock]') AND name = 'LogEntry')
BEGIN
    EXEC sp_rename 'dbo.Stock.DocEntry', 'LogEntry', 'COLUMN';
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Stock]') AND name = 'Dscription')
   AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Stock]') AND name = 'ItemName')
BEGIN
    EXEC sp_rename 'dbo.Stock.Dscription', 'ItemName', 'COLUMN';
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Stock]') AND name = 'Price')
   AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Stock]') AND name = 'StockPrice')
BEGIN
    EXEC sp_rename 'dbo.Stock.Price', 'StockPrice', 'COLUMN';
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Stock]') AND name = 'TransNum')
   AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Stock]') AND name = 'BaseEntry')
BEGIN
    EXEC sp_rename 'dbo.Stock.TransNum', 'BaseEntry', 'COLUMN';
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Stock]') AND name = 'TransType')
   AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Stock]') AND name = 'BaseType')
BEGIN
    EXEC sp_rename 'dbo.Stock.TransType', 'BaseType', 'COLUMN';
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Stock]') AND name = 'LineNum')
   AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Stock]') AND name = 'BaseLine')
BEGIN
    EXEC sp_rename 'dbo.Stock.LineNum', 'BaseLine', 'COLUMN';
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Stock]') AND name = 'MAV_COST')
   AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Stock]') AND name = 'ItemCost')
BEGIN
    EXEC sp_rename 'dbo.Stock.MAV_COST', 'ItemCost', 'COLUMN';
END;

-- New column: BaseNum, the source document's display number. Nullable --
-- rows written before this existed, and any caller not yet passing it,
-- simply have no display number recorded.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Stock]') AND name = 'BaseNum'
)
BEGIN
    ALTER TABLE [dbo].[Stock] ADD [BaseNum] NVARCHAR(50) NULL;
END;

-- The index on (TransType, TransNum) tracks the underlying columns by id,
-- not name, so the two renames above did not break it -- but its own NAME
-- is now stale next to the columns it indexes. Rename the index object too
-- so it matches schema.prisma's @@index(map: "IX_Stock_BaseType_BaseEntry").
IF EXISTS (
    SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Stock]') AND name = 'IX_Stock_TransType_TransNum'
)
   AND NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Stock]') AND name = 'IX_Stock_BaseType_BaseEntry'
)
BEGIN
    EXEC sp_rename 'dbo.Stock.IX_Stock_TransType_TransNum', 'IX_Stock_BaseType_BaseEntry', 'INDEX';
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
