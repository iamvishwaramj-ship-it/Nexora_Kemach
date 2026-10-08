BEGIN TRY

BEGIN TRAN;

-- AlterTable: Stock.PostGeneration
--
-- Which edit-cycle of the source document produced a given Stock row. The
-- journal is append-only -- editing an already-posted document must not
-- touch its existing rows, only add a reversal of the old generation and a
-- fresh post under a new one. Without this column, hasPostedAlready() can
-- only see "some row already exists for this TransType/TransNum" and skips
-- every repost, so an edited quantity or warehouse never reached the
-- journal. Defaults to 1 so every row written before this column existed is
-- simply generation 1, same as a document's first post -- no backfill needed.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Stock]') AND name = 'PostGeneration'
)
BEGIN
    ALTER TABLE [dbo].[Stock] ADD [PostGeneration] INT NOT NULL CONSTRAINT [DF_Stock_PostGeneration] DEFAULT (1);
END;

-- AlterTable: goods_received_notes.stock_posting_generation
--
-- Which generation is currently live for this document (0 = never posted).
-- Lets syncStockPosting (routes/resources.js) tell a first post apart from a
-- repost after an edit, and know which generation to reverse before posting
-- the next one.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[goods_received_notes]') AND name = 'stock_posting_generation'
)
BEGIN
    ALTER TABLE [dbo].[goods_received_notes] ADD [stock_posting_generation] INT NULL CONSTRAINT [DF_goods_received_notes_stock_posting_generation] DEFAULT (0);
END;

-- AlterTable: sales_returns.stock_posting_generation
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_returns]') AND name = 'stock_posting_generation'
)
BEGIN
    ALTER TABLE [dbo].[sales_returns] ADD [stock_posting_generation] INT NULL CONSTRAINT [DF_sales_returns_stock_posting_generation] DEFAULT (0);
END;

-- AlterTable: sales_credit_memos.stock_posting_generation
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_credit_memos]') AND name = 'stock_posting_generation'
)
BEGIN
    ALTER TABLE [dbo].[sales_credit_memos] ADD [stock_posting_generation] INT NULL CONSTRAINT [DF_sales_credit_memos_stock_posting_generation] DEFAULT (0);
END;

-- AlterTable: purchase_credit_memos.stock_posting_generation
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[purchase_credit_memos]') AND name = 'stock_posting_generation'
)
BEGIN
    ALTER TABLE [dbo].[purchase_credit_memos] ADD [stock_posting_generation] INT NULL CONSTRAINT [DF_purchase_credit_memos_stock_posting_generation] DEFAULT (0);
END;

-- AlterTable: purchase_returns.stock_posting_generation
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[purchase_returns]') AND name = 'stock_posting_generation'
)
BEGIN
    ALTER TABLE [dbo].[purchase_returns] ADD [stock_posting_generation] INT NULL CONSTRAINT [DF_purchase_returns_stock_posting_generation] DEFAULT (0);
END;

-- AlterTable: purchase_invoices.stock_posting_generation
-- (relevant only to a direct invoice -- one linked to a grnNo never posts
-- stock itself, so this stays 0 for it)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[purchase_invoices]') AND name = 'stock_posting_generation'
)
BEGIN
    ALTER TABLE [dbo].[purchase_invoices] ADD [stock_posting_generation] INT NULL CONSTRAINT [DF_purchase_invoices_stock_posting_generation] DEFAULT (0);
END;

-- AlterTable: delivery_challans.stock_posting_generation
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[delivery_challans]') AND name = 'stock_posting_generation'
)
BEGIN
    ALTER TABLE [dbo].[delivery_challans] ADD [stock_posting_generation] INT NULL CONSTRAINT [DF_delivery_challans_stock_posting_generation] DEFAULT (0);
END;

-- AlterTable: sales_invoices.stock_posting_generation
-- (relevant only to a direct invoice -- one linked to a deliveryChallanNo
-- never posts stock itself, so this stays 0 for it)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]') AND name = 'stock_posting_generation'
)
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [stock_posting_generation] INT NULL CONSTRAINT [DF_sales_invoices_stock_posting_generation] DEFAULT (0);
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
