BEGIN TRY

BEGIN TRAN;

-- AlterTable: payment_receipts.currency / payment_receipts.exchange_rate
--
-- Payment Receipt never had a Currency/Exchange Rate pair, unlike its
-- outgoing counterpart Payment Voucher (see DF_pmv_currency /
-- DF_pmv_exchange_rate on payment_vouchers). Adding the same two columns
-- here, same convention: NOT NULL with an INR / 1 default, so every receipt
-- row that existed before this migration simply reads as INR at a 1:1 rate
-- -- no backfill needed.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[payment_receipts]') AND name = 'currency'
)
BEGIN
    ALTER TABLE [dbo].[payment_receipts] ADD [currency] NVARCHAR(10) NOT NULL CONSTRAINT [DF_pr_currency] DEFAULT (N'INR');
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[payment_receipts]') AND name = 'exchange_rate'
)
BEGIN
    ALTER TABLE [dbo].[payment_receipts] ADD [exchange_rate] DECIMAL(10,4) NOT NULL CONSTRAINT [DF_pr_exchange_rate] DEFAULT (1);
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
