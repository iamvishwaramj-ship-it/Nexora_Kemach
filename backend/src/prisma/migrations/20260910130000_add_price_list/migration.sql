BEGIN TRY

BEGIN TRAN;

-- CreateTable: price_lists
--
-- Product Setup > Price List: a named, dated list of item prices, built by
-- searching items one at a time (or bulk-uploading via Excel) and saved as a
-- whole. Deliberately simple (v1 scope): no numbering series, no
-- stock/GL effect — pure paperwork, same "header + lines" shape as Stock
-- Transfer but without any of its stock-ledger machinery.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'price_lists' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[price_lists] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [price_list_name] NVARCHAR(150) NOT NULL,
        [effective_date] DATE NOT NULL,
        [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_price_lists_status] DEFAULT 'Active',
        [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_price_lists_created_at] DEFAULT GETDATE(),
        [updated_at] DATETIME2 NOT NULL CONSTRAINT [DF_price_lists_updated_at] DEFAULT GETDATE(),
        CONSTRAINT [price_lists_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

-- CreateTable: price_list_items
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'price_list_items' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[price_list_items] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [price_list_id] INT NOT NULL,
        [product_code] NVARCHAR(50) NOT NULL,
        [product_name] NVARCHAR(150) NULL,
        [product_group] NVARCHAR(100) NULL,
        [price] DECIMAL(15,2) NOT NULL,
        CONSTRAINT [price_list_items_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

-- Deleting a price list takes its lines with it; the app replaces lines
-- wholesale on every save and never keeps an orphaned one (same as every
-- other master/detail stock document — see stock_transfer_request_items).
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'price_list_items_price_list_id_fkey'
)
BEGIN
    ALTER TABLE [dbo].[price_list_items]
      ADD CONSTRAINT [price_list_items_price_list_id_fkey]
      FOREIGN KEY ([price_list_id]) REFERENCES [dbo].[price_lists]([id]) ON DELETE CASCADE;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'price_list_items_price_list_id_idx'
      AND object_id = OBJECT_ID(N'[dbo].[price_list_items]')
)
BEGIN
    CREATE INDEX [price_list_items_price_list_id_idx] ON [dbo].[price_list_items]([price_list_id]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'price_list_items_product_code_idx'
      AND object_id = OBJECT_ID(N'[dbo].[price_list_items]')
)
BEGIN
    CREATE INDEX [price_list_items_product_code_idx] ON [dbo].[price_list_items]([product_code]);
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
