BEGIN TRY

BEGIN TRAN;

-- Purchase Return: terms, attachment and the money columns.
--
-- A separate migration rather than an edit to 20260819110000: that one may
-- already have been applied, and Prisma records a checksum per migration, so
-- changing an applied file in place makes the next deploy fail. Every
-- statement here is IF NOT EXISTS guarded, so this applies cleanly whether or
-- not the tables were created a moment ago.
--
-- The document now carries the same money shape as the other purchase
-- documents. All of it is computed server-side from the lines.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[purchase_returns]') AND name = 'terms_conditions')
    ALTER TABLE [dbo].[purchase_returns] ADD [terms_conditions] NVARCHAR(MAX) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[purchase_returns]') AND name = 'attachment_name')
    ALTER TABLE [dbo].[purchase_returns] ADD [attachment_name] NVARCHAR(255) NULL;

-- Decides the CGST/SGST vs IGST split, compared against the company's own
-- registered state.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[purchase_returns]') AND name = 'place_of_supply')
    ALTER TABLE [dbo].[purchase_returns] ADD [place_of_supply] NVARCHAR(100) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[purchase_returns]') AND name = 'discount_percent')
    ALTER TABLE [dbo].[purchase_returns] ADD [discount_percent] DECIMAL(5,2) NOT NULL
        CONSTRAINT [DF_purchase_returns_discount_percent] DEFAULT 0;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[purchase_returns]') AND name = 'taxable_amount')
    ALTER TABLE [dbo].[purchase_returns] ADD [taxable_amount] DECIMAL(15,2) NOT NULL
        CONSTRAINT [DF_purchase_returns_taxable_amount] DEFAULT 0;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[purchase_returns]') AND name = 'cgst_amount')
    ALTER TABLE [dbo].[purchase_returns] ADD [cgst_amount] DECIMAL(15,2) NOT NULL
        CONSTRAINT [DF_purchase_returns_cgst_amount] DEFAULT 0;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[purchase_returns]') AND name = 'sgst_amount')
    ALTER TABLE [dbo].[purchase_returns] ADD [sgst_amount] DECIMAL(15,2) NOT NULL
        CONSTRAINT [DF_purchase_returns_sgst_amount] DEFAULT 0;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[purchase_returns]') AND name = 'igst_amount')
    ALTER TABLE [dbo].[purchase_returns] ADD [igst_amount] DECIMAL(15,2) NOT NULL
        CONSTRAINT [DF_purchase_returns_igst_amount] DEFAULT 0;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[purchase_returns]') AND name = 'round_off')
    ALTER TABLE [dbo].[purchase_returns] ADD [round_off] DECIMAL(15,2) NOT NULL
        CONSTRAINT [DF_purchase_returns_round_off] DEFAULT 0;

-- Per-line discount and tax, which the header totals are built from.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[purchase_return_items]') AND name = 'discount_percent')
    ALTER TABLE [dbo].[purchase_return_items] ADD [discount_percent] DECIMAL(5,2) NOT NULL
        CONSTRAINT [DF_purchase_return_items_discount_percent] DEFAULT 0;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[purchase_return_items]') AND name = 'tax_percent')
    ALTER TABLE [dbo].[purchase_return_items] ADD [tax_percent] DECIMAL(5,2) NOT NULL
        CONSTRAINT [DF_purchase_return_items_tax_percent] DEFAULT 0;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
