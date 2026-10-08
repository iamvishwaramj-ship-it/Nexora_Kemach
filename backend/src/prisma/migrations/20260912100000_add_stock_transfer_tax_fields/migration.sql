BEGIN TRY

BEGIN TRAN;

-- Stock Transfer header: total tax across all lines (amount stays the
-- pre-tax line-total sum, unchanged).
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfers]')
    AND name = 'tax_amount'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfers] ADD [tax_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_stock_transfers_tax_amount DEFAULT 0;
END;

-- Stock Transfer line: Tax Code (soft-FK-by-id) and the rate it resolved to.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_items]')
    AND name = 'tax_percent'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfer_items] ADD [tax_percent] DECIMAL(5, 2) NOT NULL CONSTRAINT DF_stock_transfer_items_tax_percent DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_items]')
    AND name = 'tax_code_id'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfer_items] ADD [tax_code_id] INT NULL;
END;

-- Stock Transfer Receipt header: same tax_amount addition.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_receipts]')
    AND name = 'tax_amount'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfer_receipts] ADD [tax_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_stock_transfer_receipts_tax_amount DEFAULT 0;
END;

-- Stock Transfer Receipt line: same Tax Code / rate pair.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_receipt_items]')
    AND name = 'tax_percent'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfer_receipt_items] ADD [tax_percent] DECIMAL(5, 2) NOT NULL CONSTRAINT DF_stock_transfer_receipt_items_tax_percent DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_receipt_items]')
    AND name = 'tax_code_id'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfer_receipt_items] ADD [tax_code_id] INT NULL;
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
