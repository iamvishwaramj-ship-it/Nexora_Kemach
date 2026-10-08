BEGIN TRY

BEGIN TRAN;

-- Same restructuring as 20260912110000_stock_transfer_gst_totals, applied to
-- stock_transfer_receipts: replace the flat tax_amount column with the full
-- subtotal/taxableAmount/cgstAmount/sgstAmount/igstAmount/tcsAmount/roundOff
-- shape every Sales/Purchase document uses. Idempotent and safe whether or
-- not 20260912100000_add_stock_transfer_tax_fields has already applied.

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_receipts]')
    AND name = 'tax_amount'
)
BEGIN
    DECLARE @df1 NVARCHAR(200);
    SELECT @df1 = dc.name
    FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[stock_transfer_receipts]') AND c.name = 'tax_amount';
    IF @df1 IS NOT NULL
        EXEC('ALTER TABLE [dbo].[stock_transfer_receipts] DROP CONSTRAINT [' + @df1 + ']');
    ALTER TABLE [dbo].[stock_transfer_receipts] DROP COLUMN [tax_amount];
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_receipts]')
    AND name = 'subtotal'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfer_receipts] ADD [subtotal] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_stock_transfer_receipts_subtotal DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_receipts]')
    AND name = 'taxable_amount'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfer_receipts] ADD [taxable_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_stock_transfer_receipts_taxable_amount DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_receipts]')
    AND name = 'cgst_amount'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfer_receipts] ADD [cgst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_stock_transfer_receipts_cgst_amount DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_receipts]')
    AND name = 'sgst_amount'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfer_receipts] ADD [sgst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_stock_transfer_receipts_sgst_amount DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_receipts]')
    AND name = 'igst_amount'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfer_receipts] ADD [igst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_stock_transfer_receipts_igst_amount DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_receipts]')
    AND name = 'tcs_amount'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfer_receipts] ADD [tcs_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_stock_transfer_receipts_tcs_amount DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_receipts]')
    AND name = 'round_off'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfer_receipts] ADD [round_off] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_stock_transfer_receipts_round_off DEFAULT 0;
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
