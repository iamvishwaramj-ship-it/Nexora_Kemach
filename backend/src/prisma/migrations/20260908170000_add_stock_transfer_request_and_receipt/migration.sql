BEGIN TRY

BEGIN TRAN;

-- CreateTable: stock_transfer_requests
--
-- Inventory > Stock Transfer Request: a request to move stock, raised BEFORE
-- an actual Stock Transfer is created. Deliberately simple (v1 scope): no
-- stock-ledger effect, no GL posting, no batch/serial allocation — pure
-- paperwork, referenced by Stock Transfer via stock_transfers.request_no
-- (string-match, same convention as goods_received_notes.po_no).
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'stock_transfer_requests' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[stock_transfer_requests] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [branch] NVARCHAR(150) NULL,
        [request_no] NVARCHAR(50) NOT NULL,
        [status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_str_status] DEFAULT 'Open',
        [party_code] NVARCHAR(50) NULL,
        [party_name] NVARCHAR(150) NULL,
        [contact_person] NVARCHAR(100) NULL,
        [project] NVARCHAR(100) NULL,
        [request_date] DATE NULL,
        [document_date] DATE NULL,
        [prepared_by] NVARCHAR(150) NULL,
        [remarks] NVARCHAR(MAX) NULL,
        [attachment_name] NVARCHAR(255) NULL,
        [amount] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_str_amount] DEFAULT 0,
        CONSTRAINT [stock_transfer_requests_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'stock_transfer_requests_request_no_key'
      AND object_id = OBJECT_ID(N'[dbo].[stock_transfer_requests]')
)
BEGIN
    CREATE UNIQUE INDEX [stock_transfer_requests_request_no_key] ON [dbo].[stock_transfer_requests]([request_no]);
END;

-- CreateTable: stock_transfer_request_items
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'stock_transfer_request_items' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[stock_transfer_request_items] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [request_id] INT NULL,
        [product_code] NVARCHAR(50) NULL,
        [product_name] NVARCHAR(150) NULL,
        [from_warehouse] NVARCHAR(150) NULL,
        [to_warehouse] NVARCHAR(150) NULL,
        [uom] NVARCHAR(50) NULL,
        [quantity] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_stri_quantity] DEFAULT 0,
        [transferred_quantity] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_stri_transferred_quantity] DEFAULT 0,
        [unit_price] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_stri_unit_price] DEFAULT 0,
        [item_cost] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_stri_item_cost] DEFAULT 0,
        [account_code] NVARCHAR(50) NULL,
        [project] NVARCHAR(100) NULL,
        [remarks] NVARCHAR(255) NULL,
        [amount] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_stri_amount] DEFAULT 0,
        CONSTRAINT [stock_transfer_request_items_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

-- Deleting a request takes its lines with it; the app replaces lines
-- wholesale on every save and never keeps an orphaned one (same as every
-- other master/detail stock document).
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'stock_transfer_request_items_request_id_fkey'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfer_request_items]
      ADD CONSTRAINT [stock_transfer_request_items_request_id_fkey]
      FOREIGN KEY ([request_id]) REFERENCES [dbo].[stock_transfer_requests]([id]) ON DELETE CASCADE;
END;

-- CreateTable: stock_transfer_receipts
--
-- Inventory > Stock Transfer Receipt: confirms goods arrived at the
-- destination warehouse, raised AFTER a Stock Transfer. Deliberately simple
-- (v1 scope): no stock-ledger effect, no GL posting, no batch/serial
-- allocation — pure paperwork, referenced to Stock Transfer via transfer_no
-- (string-match, same convention as goods_received_notes.po_no ->
-- purchase_orders.po_no).
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'stock_transfer_receipts' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[stock_transfer_receipts] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [branch] NVARCHAR(150) NULL,
        [receipt_no] NVARCHAR(50) NOT NULL,
        [status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_strc_status] DEFAULT 'Draft',
        [transfer_no] NVARCHAR(50) NULL,
        [transfer_date] DATE NULL,
        [party_code] NVARCHAR(50) NULL,
        [party_name] NVARCHAR(150) NULL,
        [contact_person] NVARCHAR(100) NULL,
        [project] NVARCHAR(100) NULL,
        [document_date] DATE NULL,
        [prepared_by] NVARCHAR(150) NULL,
        [remarks] NVARCHAR(MAX) NULL,
        [attachment_name] NVARCHAR(255) NULL,
        [amount] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_strc_amount] DEFAULT 0,
        CONSTRAINT [stock_transfer_receipts_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'stock_transfer_receipts_receipt_no_key'
      AND object_id = OBJECT_ID(N'[dbo].[stock_transfer_receipts]')
)
BEGIN
    CREATE UNIQUE INDEX [stock_transfer_receipts_receipt_no_key] ON [dbo].[stock_transfer_receipts]([receipt_no]);
END;

-- CreateTable: stock_transfer_receipt_items
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'stock_transfer_receipt_items' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[stock_transfer_receipt_items] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [receipt_id] INT NULL,
        [base_type] NVARCHAR(50) NULL,
        [base_entry] INT NULL,
        [base_no] NVARCHAR(50) NULL,
        [base_line] INT NULL,
        [product_code] NVARCHAR(50) NULL,
        [product_name] NVARCHAR(150) NULL,
        [from_warehouse] NVARCHAR(150) NULL,
        [to_warehouse] NVARCHAR(150) NULL,
        [uom] NVARCHAR(50) NULL,
        [transfer_quantity] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_strci_transfer_quantity] DEFAULT 0,
        [quantity] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_strci_quantity] DEFAULT 0,
        [unit_price] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_strci_unit_price] DEFAULT 0,
        [item_cost] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_strci_item_cost] DEFAULT 0,
        [account_code] NVARCHAR(50) NULL,
        [project] NVARCHAR(100) NULL,
        [remarks] NVARCHAR(255) NULL,
        [amount] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_strci_amount] DEFAULT 0,
        CONSTRAINT [stock_transfer_receipt_items_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

-- Deleting a receipt takes its lines with it; the app replaces lines
-- wholesale on every save and never keeps an orphaned one.
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'stock_transfer_receipt_items_receipt_id_fkey'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfer_receipt_items]
      ADD CONSTRAINT [stock_transfer_receipt_items_receipt_id_fkey]
      FOREIGN KEY ([receipt_id]) REFERENCES [dbo].[stock_transfer_receipts]([id]) ON DELETE CASCADE;
END;

-- AlterTable: stock_transfers — add request_no (string-match link to
-- stock_transfer_requests.request_no, same convention as
-- goods_received_notes.po_no -> purchase_orders.po_no). Not wired into
-- documentFlow.js yet.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfers]') AND name = 'request_no')
BEGIN
    ALTER TABLE [dbo].[stock_transfers] ADD [request_no] NVARCHAR(50) NULL;
END;

-- AlterTable: stock_transfer_items — add the standard base* "Copy From"
-- block, same shape as purchase_order_items.base_type/base_entry/base_no/base_line.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_items]') AND name = 'base_type')
BEGIN
    ALTER TABLE [dbo].[stock_transfer_items] ADD [base_type] NVARCHAR(50) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_items]') AND name = 'base_entry')
BEGIN
    ALTER TABLE [dbo].[stock_transfer_items] ADD [base_entry] INT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_items]') AND name = 'base_no')
BEGIN
    ALTER TABLE [dbo].[stock_transfer_items] ADD [base_no] NVARCHAR(50) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_items]') AND name = 'base_line')
BEGIN
    ALTER TABLE [dbo].[stock_transfer_items] ADD [base_line] INT NULL;
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
