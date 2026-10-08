BEGIN TRY

BEGIN TRAN;

-- AlterTable: Product — "Set G/L Accounts By" (Warehouse / Product Group),
-- defaulting to Warehouse to match every existing product's current
-- behavior (see model Product in schema.prisma).
ALTER TABLE [dbo].[products] ADD [gl_accounts_by] NVARCHAR(20) NOT NULL
    CONSTRAINT [DF_products_gl_accounts_by] DEFAULT N'Warehouse';

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
