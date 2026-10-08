BEGIN TRY

BEGIN TRAN;

-- Stock Transfer Request header: same subtotal/taxable_amount/cgst_amount/
-- sgst_amount/igst_amount/tcs_amount/round_off shape every Sales/Purchase
-- document uses (see headerTotals in routes/resources.js). `amount` already
-- exists and stays the grand total.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_requests]')
    AND name = 'subtotal'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfer_requests] ADD [subtotal] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_stock_transfer_requests_subtotal DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_requests]')
    AND name = 'taxable_amount'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfer_requests] ADD [taxable_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_stock_transfer_requests_taxable_amount DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_requests]')
    AND name = 'cgst_amount'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfer_requests] ADD [cgst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_stock_transfer_requests_cgst_amount DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_requests]')
    AND name = 'sgst_amount'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfer_requests] ADD [sgst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_stock_transfer_requests_sgst_amount DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_requests]')
    AND name = 'igst_amount'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfer_requests] ADD [igst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_stock_transfer_requests_igst_amount DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_requests]')
    AND name = 'tcs_amount'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfer_requests] ADD [tcs_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_stock_transfer_requests_tcs_amount DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_requests]')
    AND name = 'round_off'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfer_requests] ADD [round_off] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_stock_transfer_requests_round_off DEFAULT 0;
END;

-- Stock Transfer Request line: Tax Code (soft-FK-by-id) and the rate it
-- resolved to — same pair StockTransferItem/StockTransferReceiptItem carry.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_request_items]')
    AND name = 'tax_percent'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfer_request_items] ADD [tax_percent] DECIMAL(5, 2) NOT NULL CONSTRAINT DF_stock_transfer_request_items_tax_percent DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_request_items]')
    AND name = 'tax_code_id'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfer_request_items] ADD [tax_code_id] INT NULL;
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
