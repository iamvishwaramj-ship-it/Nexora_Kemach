BEGIN TRY

BEGIN TRAN;

-- CreateTable: sales_returns
--
-- Goods coming back from a customer, raised against a Delivery Challan.
-- Carries the same money shape as the other sales documents; all of it is
-- computed server-side from the lines. Posts no stock movement and no
-- receivables adjustment — it records the value of what is coming back.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'sales_returns' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[sales_returns] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [return_no] NVARCHAR(50) NOT NULL,
        [status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_sr_status] DEFAULT 'Open',
        [challan_no] NVARCHAR(50) NULL,
        [customer] NVARCHAR(100) NULL,
        [customer_name] NVARCHAR(150) NULL,
        [contact_person] NVARCHAR(100) NULL,
        [customer_ref_no] NVARCHAR(50) NULL,
        [branch] NVARCHAR(150) NULL,
        [document_date] DATE NULL,
        [posting_date] DATE NULL,
        [due_date] DATE NULL,
        [payment_terms] NVARCHAR(50) NULL,
        [reason] NVARCHAR(MAX) NULL,
        [narration] NVARCHAR(MAX) NULL,
        [comments] NVARCHAR(MAX) NULL,
        [terms_conditions] NVARCHAR(MAX) NULL,
        [attachment_name] NVARCHAR(255) NULL,
        [place_of_supply] NVARCHAR(100) NULL,
        [total_items] INT NOT NULL CONSTRAINT [DF_sr_total_items] DEFAULT 0,
        [discount_percent] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_sr_discount_percent] DEFAULT 0,
        [subtotal] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_sr_subtotal] DEFAULT 0,
        [taxable_amount] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_sr_taxable_amount] DEFAULT 0,
        [cgst_amount] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_sr_cgst_amount] DEFAULT 0,
        [sgst_amount] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_sr_sgst_amount] DEFAULT 0,
        [igst_amount] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_sr_igst_amount] DEFAULT 0,
        [round_off] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_sr_round_off] DEFAULT 0,
        [amount] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_sr_amount] DEFAULT 0,
        CONSTRAINT [sales_returns_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'sales_returns_return_no_key'
      AND object_id = OBJECT_ID(N'[dbo].[sales_returns]')
)
BEGIN
    CREATE UNIQUE INDEX [sales_returns_return_no_key] ON [dbo].[sales_returns]([return_no]);
END;

-- CreateTable: sales_return_items
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'sales_return_items' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[sales_return_items] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [return_id] INT NULL,
        [product_code] NVARCHAR(50) NULL,
        [product_name] NVARCHAR(150) NULL,
        [description] NVARCHAR(MAX) NULL,
        [hsn_code] NVARCHAR(50) NULL,
        [uom] NVARCHAR(50) NULL,
        [delivered_quantity] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_sri_delivered_qty] DEFAULT 0,
        [return_quantity] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_sri_return_qty] DEFAULT 0,
        [unit_price] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_sri_unit_price] DEFAULT 0,
        [discount_percent] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_sri_discount_percent] DEFAULT 0,
        [tax_percent] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_sri_tax_percent] DEFAULT 0,
        [amount] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_sri_amount] DEFAULT 0,
        CONSTRAINT [sales_return_items_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

-- Deleting a return takes its lines with it; the app replaces lines wholesale
-- on every save and never keeps an orphaned one.
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'sales_return_items_return_id_fkey'
)
BEGIN
    ALTER TABLE [dbo].[sales_return_items]
      ADD CONSTRAINT [sales_return_items_return_id_fkey]
      FOREIGN KEY ([return_id]) REFERENCES [dbo].[sales_returns]([id]) ON DELETE CASCADE;
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
