BEGIN TRY

BEGIN TRAN;

-- Add customer_ref_no to sales_quotations if not exists
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_quotations]') 
    AND name = 'customer_ref_no'
)
BEGIN
    ALTER TABLE [dbo].[sales_quotations] ADD [customer_ref_no] NVARCHAR(50) NULL;
END;

-- Add customer_ref_no to sales_orders if not exists
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_orders]') 
    AND name = 'customer_ref_no'
)
BEGIN
    ALTER TABLE [dbo].[sales_orders] ADD [customer_ref_no] NVARCHAR(50) NULL;
END;

-- Add customer_ref_no to delivery_challans if not exists
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[delivery_challans]') 
    AND name = 'customer_ref_no'
)
BEGIN
    ALTER TABLE [dbo].[delivery_challans] ADD [customer_ref_no] NVARCHAR(50) NULL;
END;

-- Add customer_ref_no to sales_invoices if not exists
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]') 
    AND name = 'customer_ref_no'
)
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [customer_ref_no] NVARCHAR(50) NULL;
END;

-- Backfill customer_ref_no from reference_no on sales_quotations and sales_orders using sp_executesql.
-- Dynamic SQL is required because SQL Server binds an entire batch before executing any of it:
-- a static UPDATE referencing a newly ADDed column in the same batch fails compilation with Msg 207.
EXEC sp_executesql N'
    UPDATE [dbo].[sales_quotations]
    SET [customer_ref_no] = [reference_no]
    WHERE [customer_ref_no] IS NULL AND [reference_no] IS NOT NULL;
';

EXEC sp_executesql N'
    UPDATE [dbo].[sales_orders]
    SET [customer_ref_no] = [reference_no]
    WHERE [customer_ref_no] IS NULL AND [reference_no] IS NOT NULL;
';

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
