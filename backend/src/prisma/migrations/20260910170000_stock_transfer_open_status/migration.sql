BEGIN TRY

BEGIN TRAN;

-- Stock Transfer's not-yet-posted status is renamed 'Draft' -> 'Open':
-- closing is no longer a manual choice on save (see StockTransfer.jsx /
-- syncStockTransferClosure in routes/resources.js) — a transfer now closes
-- only once a Stock Transfer Receipt confirms the goods arrived. Existing
-- rows still reading 'Draft' are backfilled so they keep meaning
-- "not yet closed" rather than silently becoming an unrecognized status;
-- 'Closed' rows are untouched.
UPDATE [dbo].[stock_transfers]
SET [status] = 'Open'
WHERE [status] = 'Draft';

-- The column's default constraint name is whatever SQL Server (or an
-- earlier Prisma migration) auto-generated, not a fixed name — found
-- dynamically via sys.default_constraints rather than assumed, same
-- caution as every other migration in this folder that touches a
-- constraint it didn't itself create.
DECLARE @constraintName NVARCHAR(200);
SELECT @constraintName = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c
    ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[stock_transfers]')
  AND c.name = 'status';

IF @constraintName IS NOT NULL
BEGIN
    EXEC(N'ALTER TABLE [dbo].[stock_transfers] DROP CONSTRAINT [' + @constraintName + N'];');
END;

ALTER TABLE [dbo].[stock_transfers]
    ADD CONSTRAINT [DF_stock_transfers_status] DEFAULT 'Open' FOR [status];

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
