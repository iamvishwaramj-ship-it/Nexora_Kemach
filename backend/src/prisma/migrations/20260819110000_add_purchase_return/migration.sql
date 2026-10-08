BEGIN TRY

BEGIN TRAN;

-- CreateTable: purchase_returns
--
-- Goods going back to a supplier, raised against a GRN. Value-only for now —
-- no stock movement and no payables adjustment are posted, which is why there
-- is no CGST/SGST/IGST split here, only a subtotal and an amount.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'purchase_returns' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[purchase_returns] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [return_no] NVARCHAR(50) NOT NULL,
        [status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_purchase_returns_status] DEFAULT 'Open',
        [grn_no] NVARCHAR(50) NULL,
        [supplier] NVARCHAR(100) NULL,
        [supplier_name] NVARCHAR(150) NULL,
        [contact_person] NVARCHAR(100) NULL,
        [supplier_ref_no] NVARCHAR(50) NULL,
        [branch] NVARCHAR(150) NULL,
        [document_date] DATE NULL,
        [posting_date] DATE NULL,
        [due_date] DATE NULL,
        [payment_terms] NVARCHAR(50) NULL,
        [bill_do_no] NVARCHAR(50) NULL,
        [bill_do_date] DATE NULL,
        [reason] NVARCHAR(MAX) NULL,
        [comments] NVARCHAR(MAX) NULL,
        [total_items] INT NOT NULL CONSTRAINT [DF_purchase_returns_total_items] DEFAULT 0,
        [subtotal] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_purchase_returns_subtotal] DEFAULT 0,
        [amount] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_purchase_returns_amount] DEFAULT 0,
        CONSTRAINT [purchase_returns_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'purchase_returns_return_no_key'
      AND object_id = OBJECT_ID(N'[dbo].[purchase_returns]')
)
BEGIN
    CREATE UNIQUE INDEX [purchase_returns_return_no_key] ON [dbo].[purchase_returns]([return_no]);
END;

-- CreateTable: purchase_return_items
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'purchase_return_items' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[purchase_return_items] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [return_id] INT NULL,
        [product_code] NVARCHAR(50) NULL,
        [product_name] NVARCHAR(150) NULL,
        [description] NVARCHAR(MAX) NULL,
        [hsn_code] NVARCHAR(50) NULL,
        [uom] NVARCHAR(50) NULL,
        [received_quantity] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_purchase_return_items_received_qty] DEFAULT 0,
        [return_quantity] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_purchase_return_items_return_qty] DEFAULT 0,
        [unit_price] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_purchase_return_items_unit_price] DEFAULT 0,
        [amount] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_purchase_return_items_amount] DEFAULT 0,
        CONSTRAINT [purchase_return_items_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

-- Deleting a return takes its lines with it; the app replaces lines wholesale
-- on every save and never keeps an orphaned one.
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'purchase_return_items_return_id_fkey'
)
BEGIN
    ALTER TABLE [dbo].[purchase_return_items]
      ADD CONSTRAINT [purchase_return_items_return_id_fkey]
      FOREIGN KEY ([return_id]) REFERENCES [dbo].[purchase_returns]([id]) ON DELETE CASCADE;
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
