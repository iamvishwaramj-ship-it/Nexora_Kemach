BEGIN TRY

BEGIN TRAN;

-- AlterTable: Customer — Accounting control-account fields (see model
-- Customer in schema.prisma).
ALTER TABLE [dbo].[customers] ADD [accounts_receivable] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[customers] ADD [down_payment_clearing_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[customers] ADD [account_balance] DECIMAL(15, 2) NULL;

-- AlterTable: Supplier — same fields (see model Supplier in schema.prisma).
ALTER TABLE [dbo].[suppliers] ADD [accounts_receivable] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[suppliers] ADD [down_payment_clearing_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[suppliers] ADD [account_balance] DECIMAL(15, 2) NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
