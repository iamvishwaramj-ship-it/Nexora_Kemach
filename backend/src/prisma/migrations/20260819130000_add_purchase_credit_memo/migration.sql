BEGIN TRY

BEGIN TRAN;

-- CreateTable: purchase_credit_memos
--
-- A credit received from a supplier, raised against a Purchase Invoice. Carries
-- the same money shape as the other purchase documents; all of it is computed
-- server-side from the lines. Posts no payables adjustment — it records the
-- credit's value only.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'purchase_credit_memos' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[purchase_credit_memos] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [credit_no] NVARCHAR(50) NOT NULL,
        [status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_pcm_status] DEFAULT 'Open',
        [invoice_no] NVARCHAR(50) NULL,
        [supplier] NVARCHAR(100) NULL,
        [supplier_name] NVARCHAR(150) NULL,
        [supplier_code] NVARCHAR(50) NULL,
        [contact_person] NVARCHAR(100) NULL,
        [supplier_ref_no] NVARCHAR(50) NULL,
        [location] NVARCHAR(150) NULL,
        [branch] NVARCHAR(150) NULL,
        [transaction_type] NVARCHAR(100) NULL,
        [document_date] DATE NULL,
        [posting_date] DATE NULL,
        [due_date] DATE NULL,
        [payment_terms] NVARCHAR(50) NULL,
        [bill_do_no] NVARCHAR(50) NULL,
        [bill_do_date] DATE NULL,
        [reason] NVARCHAR(MAX) NULL,
        [comments] NVARCHAR(MAX) NULL,
        [terms_conditions] NVARCHAR(MAX) NULL,
        [attachment_name] NVARCHAR(255) NULL,
        [place_of_supply] NVARCHAR(100) NULL,
        [total_items] INT NOT NULL CONSTRAINT [DF_pcm_total_items] DEFAULT 0,
        [discount_percent] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_pcm_discount_percent] DEFAULT 0,
        [subtotal] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_pcm_subtotal] DEFAULT 0,
        [taxable_amount] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_pcm_taxable_amount] DEFAULT 0,
        [cgst_amount] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_pcm_cgst_amount] DEFAULT 0,
        [sgst_amount] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_pcm_sgst_amount] DEFAULT 0,
        [igst_amount] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_pcm_igst_amount] DEFAULT 0,
        [round_off] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_pcm_round_off] DEFAULT 0,
        [amount] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_pcm_amount] DEFAULT 0,
        CONSTRAINT [purchase_credit_memos_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'purchase_credit_memos_credit_no_key'
      AND object_id = OBJECT_ID(N'[dbo].[purchase_credit_memos]')
)
BEGIN
    CREATE UNIQUE INDEX [purchase_credit_memos_credit_no_key]
      ON [dbo].[purchase_credit_memos]([credit_no]);
END;

-- CreateTable: purchase_credit_memo_items
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'purchase_credit_memo_items' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[purchase_credit_memo_items] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [credit_memo_id] INT NULL,
        [product_code] NVARCHAR(50) NULL,
        [product_name] NVARCHAR(150) NULL,
        [description] NVARCHAR(MAX) NULL,
        [hsn_code] NVARCHAR(50) NULL,
        [uom] NVARCHAR(50) NULL,
        [invoiced_quantity] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_pcmi_invoiced_qty] DEFAULT 0,
        [quantity] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_pcmi_quantity] DEFAULT 0,
        [unit_price] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_pcmi_unit_price] DEFAULT 0,
        [discount_percent] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_pcmi_discount_percent] DEFAULT 0,
        [tax_percent] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_pcmi_tax_percent] DEFAULT 0,
        [amount] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_pcmi_amount] DEFAULT 0,
        CONSTRAINT [purchase_credit_memo_items_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

-- Deleting a memo takes its lines with it; the app replaces lines wholesale on
-- every save and never keeps an orphaned one.
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'purchase_credit_memo_items_memo_fkey'
)
BEGIN
    ALTER TABLE [dbo].[purchase_credit_memo_items]
      ADD CONSTRAINT [purchase_credit_memo_items_memo_fkey]
      FOREIGN KEY ([credit_memo_id]) REFERENCES [dbo].[purchase_credit_memos]([id]) ON DELETE CASCADE;
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
