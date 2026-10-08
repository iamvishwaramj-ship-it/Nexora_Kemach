BEGIN TRY

BEGIN TRAN;

-- Lets an Inventory Opening Balance row track which generation of its
-- position is currently posted to [dbo].[Stock] -- the same
-- reverse-then-repost bookkeeping the 8 stock-moving document types already
-- use (see their own stock_posting_generation columns and
-- utils/resources.js's syncStockPosting). 0 = never posted, matching every
-- existing row (a bulk createMany import cannot set this per row at insert
-- time, so new rows start here and get generation 1 the first time they are
-- journalled).

IF NOT EXISTS (
    SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[opening_balance]') AND name = 'stock_posting_generation'
)
BEGIN
    ALTER TABLE [dbo].[opening_balance] ADD [stock_posting_generation] INT NULL
        CONSTRAINT [DF_opening_balance_stock_posting_generation] DEFAULT 0;
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
