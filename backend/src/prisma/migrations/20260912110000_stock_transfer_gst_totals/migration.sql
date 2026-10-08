BEGIN TRY

BEGIN TRAN;

-- Stock Transfer header totals are being restructured to the same
-- subtotal/taxableAmount/cgstAmount/sgstAmount/igstAmount/tcsAmount/roundOff
-- shape every Sales/Purchase document uses (see headerTotals in
-- routes/resources.js), replacing the earlier flat tax_amount column added
-- by 20260912100000_add_stock_transfer_tax_fields — this migration is
-- idempotent and safe to run whether or not that earlier one has already
-- applied on this database.

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfers]')
    AND name = 'tax_amount'
)
BEGIN
    -- Drop the DEFAULT constraint before the column, or SQL Server refuses
    -- the ALTER TABLE ... DROP COLUMN.
    DECLARE @df1 NVARCHAR(200);
    SELECT @df1 = dc.name
    FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[stock_transfers]') AND c.name = 'tax_amount';
    IF @df1 IS NOT NULL
        EXEC('ALTER TABLE [dbo].[stock_transfers] DROP CONSTRAINT [' + @df1 + ']');
    ALTER TABLE [dbo].[stock_transfers] DROP COLUMN [tax_amount];
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfers]')
    AND name = 'subtotal'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfers] ADD [subtotal] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_stock_transfers_subtotal DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfers]')
    AND name = 'taxable_amount'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfers] ADD [taxable_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_stock_transfers_taxable_amount DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfers]')
    AND name = 'cgst_amount'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfers] ADD [cgst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_stock_transfers_cgst_amount DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfers]')
    AND name = 'sgst_amount'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfers] ADD [sgst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_stock_transfers_sgst_amount DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfers]')
    AND name = 'igst_amount'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfers] ADD [igst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_stock_transfers_igst_amount DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfers]')
    AND name = 'tcs_amount'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfers] ADD [tcs_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_stock_transfers_tcs_amount DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfers]')
    AND name = 'round_off'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfers] ADD [round_off] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_stock_transfers_round_off DEFAULT 0;
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
