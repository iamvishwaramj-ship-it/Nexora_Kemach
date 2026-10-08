BEGIN TRY

BEGIN TRAN;

-- AlterTable: payment_receipts — Payment Modes breakdown (Banking >
-- Payment Receipt > Payment Modes dialog). payment_mode/payment_gl_account
-- record which tab (Cash/Cheque/Bank Transfer) and Chart-Of-Accounts
-- account the receipt actually moved through, so the G/L posting engine
-- can debit that specific account instead of the fixed cashOnHand
-- determination account — see resolvePaymentModeCashAccount in
-- utils/glPosting.js. All nullable/defaulted: existing rows, and any
-- receipt saved without opening the dialog, fall back to the prior
-- cashOnHand-determination behaviour.
ALTER TABLE [dbo].[payment_receipts] ADD [payment_mode] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[payment_receipts] ADD [payment_gl_account] NVARCHAR(50) NULL;
ALTER TABLE [dbo].[payment_receipts] ADD [bank_charges_account] NVARCHAR(50) NULL;
ALTER TABLE [dbo].[payment_receipts] ADD [bank_charges_amount] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_pr_bank_charges_amount] DEFAULT 0;

-- AlterTable: payment_vouchers — same Payment Modes breakdown, credited
-- instead of debited (money leaving through the chosen account).
ALTER TABLE [dbo].[payment_vouchers] ADD [payment_mode] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[payment_vouchers] ADD [payment_gl_account] NVARCHAR(50) NULL;
ALTER TABLE [dbo].[payment_vouchers] ADD [bank_charges_account] NVARCHAR(50) NULL;
ALTER TABLE [dbo].[payment_vouchers] ADD [bank_charges_amount] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_pv_bank_charges_amount] DEFAULT 0;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
