BEGIN TRY

BEGIN TRAN;

-- Add receiver / receiver_phone to sales_quotations if not exists
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_quotations]')
    AND name = 'receiver'
)
BEGIN
    ALTER TABLE [dbo].[sales_quotations] ADD [receiver] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_quotations]')
    AND name = 'receiver_phone'
)
BEGIN
    ALTER TABLE [dbo].[sales_quotations] ADD [receiver_phone] NVARCHAR(20) NULL;
END;

-- Add receiver / receiver_phone to sales_orders if not exists
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_orders]')
    AND name = 'receiver'
)
BEGIN
    ALTER TABLE [dbo].[sales_orders] ADD [receiver] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_orders]')
    AND name = 'receiver_phone'
)
BEGIN
    ALTER TABLE [dbo].[sales_orders] ADD [receiver_phone] NVARCHAR(20) NULL;
END;

-- Add receiver / receiver_phone to delivery_challans if not exists
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[delivery_challans]')
    AND name = 'receiver'
)
BEGIN
    ALTER TABLE [dbo].[delivery_challans] ADD [receiver] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[delivery_challans]')
    AND name = 'receiver_phone'
)
BEGIN
    ALTER TABLE [dbo].[delivery_challans] ADD [receiver_phone] NVARCHAR(20) NULL;
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
