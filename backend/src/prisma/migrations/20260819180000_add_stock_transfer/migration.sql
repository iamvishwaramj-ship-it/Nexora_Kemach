BEGIN TRY

BEGIN TRAN;

-- CreateTable: stock_transfers
--
-- Inventory > Stock Transfer ("Material Transfer"): moves quantities of one
-- or more products from one warehouse to another. Posting journals into
-- [dbo].[Stock] twice (an outbound leg at from_warehouse, an inbound leg at
-- to_warehouse) — see utils/stockTable.js TRANS_TYPES.STOCK_TRANSFER_OUT/IN.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'stock_transfers' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[stock_transfers] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [branch] NVARCHAR(150) NULL,
        [transfer_no] NVARCHAR(50) NOT NULL,
        [transfer_type] NVARCHAR(50) NOT NULL CONSTRAINT [DF_st_transfer_type] DEFAULT 'Stock Transfer',
        [status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_st_status] DEFAULT 'Draft',
        [party_code] NVARCHAR(50) NULL,
        [party_name] NVARCHAR(150) NULL,
        [contact_person] NVARCHAR(100) NULL,
        [ship_to] NVARCHAR(MAX) NULL,
        [price_list] NVARCHAR(100) NULL,
        [project] NVARCHAR(100) NULL,
        [request_date] DATE NULL,
        [document_date] DATE NULL,
        [from_warehouse] NVARCHAR(150) NULL,
        [to_warehouse] NVARCHAR(150) NULL,
        [prepared_by] NVARCHAR(150) NULL,
        [journal_remarks] NVARCHAR(MAX) NULL,
        [remarks] NVARCHAR(MAX) NULL,
        [attachment_name] NVARCHAR(255) NULL,
        [amount] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_st_amount] DEFAULT 0,
        CONSTRAINT [stock_transfers_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'stock_transfers_transfer_no_key'
      AND object_id = OBJECT_ID(N'[dbo].[stock_transfers]')
)
BEGIN
    CREATE UNIQUE INDEX [stock_transfers_transfer_no_key] ON [dbo].[stock_transfers]([transfer_no]);
END;

-- CreateTable: stock_transfer_items
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'stock_transfer_items' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[stock_transfer_items] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [transfer_id] INT NULL,
        [product_code] NVARCHAR(50) NULL,
        [product_name] NVARCHAR(150) NULL,
        [from_warehouse] NVARCHAR(150) NULL,
        [to_warehouse] NVARCHAR(150) NULL,
        [total_stock] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_sti_total_stock] DEFAULT 0,
        [uom] NVARCHAR(50) NULL,
        [quantity] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_sti_quantity] DEFAULT 0,
        [unit_price] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_sti_unit_price] DEFAULT 0,
        [item_cost] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_sti_item_cost] DEFAULT 0,
        [account_code] NVARCHAR(50) NULL,
        [project] NVARCHAR(100) NULL,
        [remarks] NVARCHAR(255) NULL,
        [amount] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_sti_amount] DEFAULT 0,
        CONSTRAINT [stock_transfer_items_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

-- Deleting a transfer takes its lines with it; the app replaces lines
-- wholesale on every save and never keeps an orphaned one (same as every
-- other master/detail stock document).
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'stock_transfer_items_transfer_id_fkey'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfer_items]
      ADD CONSTRAINT [stock_transfer_items_transfer_id_fkey]
      FOREIGN KEY ([transfer_id]) REFERENCES [dbo].[stock_transfers]([id]) ON DELETE CASCADE;
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
