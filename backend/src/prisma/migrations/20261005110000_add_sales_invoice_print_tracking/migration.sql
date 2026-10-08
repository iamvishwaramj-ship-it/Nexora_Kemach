BEGIN TRY

BEGIN TRAN;

-- Sales Invoice print-copy tracking: is_printed flips to 1 once the user
-- confirms the first 3-copy print; later prints are the Duplicate alone.
-- Existing invoices start as not printed.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]') AND name = 'is_printed'
)
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [is_printed] BIT NOT NULL
        CONSTRAINT [DF_sales_invoices_is_printed] DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]') AND name = 'printed_at'
)
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [printed_at] DATETIME2 NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]') AND name = 'printed_by'
)
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [printed_by] NVARCHAR(100) NULL;
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
