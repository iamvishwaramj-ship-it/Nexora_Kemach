BEGIN TRY

BEGIN TRAN;

-- Add receiver to sales_invoices if not exists
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]')
    AND name = 'receiver'
)
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [receiver] NVARCHAR(100) NULL;
END;

-- Add receiver_phone to sales_invoices if not exists
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]')
    AND name = 'receiver_phone'
)
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [receiver_phone] NVARCHAR(20) NULL;
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
