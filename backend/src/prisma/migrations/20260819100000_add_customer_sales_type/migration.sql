BEGIN TRY

BEGIN TRAN;

-- AlterTable: customers.sales_type
--
-- Backs the "Sales Type" select on Customer Master (B - B / B - C / Branch),
-- which sits directly below Customer Type. Nullable on purpose: every customer
-- created before this column existed has no value for it, and a NOT NULL
-- column would need a default that silently misclassifies all of them.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[customers]') AND name = 'sales_type'
)
BEGIN
    ALTER TABLE [dbo].[customers] ADD [sales_type] NVARCHAR(50) NULL;
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
