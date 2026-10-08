BEGIN TRY

BEGIN TRAN;

-- CreateTable: payment_vouchers
--
-- Banking > Payment Voucher ("Outgoing Payment"): posts a payment against a
-- Vendor or a raw Chart-Of-Accounts Account (party_type) -- the outgoing
-- counterpart to payment_receipts. Vendor payments settle through the same
-- supplier open-item ledger as Payment Entry/Payment Receipt; Account
-- payments and any payment with payment_on_account = 1 never touch an
-- outstanding-invoice balance.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'payment_vouchers' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[payment_vouchers] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [branch] NVARCHAR(150) NULL,
        [payment_voucher_no] NVARCHAR(50) NOT NULL,
        [party_type] NVARCHAR(20) NOT NULL CONSTRAINT [DF_pmv_party_type] DEFAULT 'Vendor',
        [party_code] NVARCHAR(50) NULL,
        [party_name] NVARCHAR(150) NULL,
        [bill_to] NVARCHAR(MAX) NULL,
        [contact_person] NVARCHAR(100) NULL,
        [reference] NVARCHAR(100) NULL,
        [payment_type] NVARCHAR(20) NOT NULL CONSTRAINT [DF_pmv_payment_type] DEFAULT 'Payment',
        [posting_date] DATE NULL,
        [due_date] DATE NULL,
        [document_date] DATE NULL,
        [transaction_no] NVARCHAR(100) NULL,
        [currency] NVARCHAR(10) NOT NULL CONSTRAINT [DF_pmv_currency] DEFAULT 'INR',
        [exchange_rate] DECIMAL(10,4) NOT NULL CONSTRAINT [DF_pmv_exchange_rate] DEFAULT 1,
        [remarks] NVARCHAR(MAX) NULL,
        [journal_remarks] NVARCHAR(MAX) NULL,
        [payment_on_account] BIT NOT NULL CONSTRAINT [DF_pmv_payment_on_account] DEFAULT 0,
        [round_off] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_pmv_round_off] DEFAULT 0,
        [total_due] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_pmv_total_due] DEFAULT 0,
        [applied_amount] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_pmv_applied_amount] DEFAULT 0,
        [open_balance] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_pmv_open_balance] DEFAULT 0,
        [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_pmv_status] DEFAULT 'Draft',
        CONSTRAINT [payment_vouchers_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'payment_vouchers_payment_voucher_no_key'
      AND object_id = OBJECT_ID(N'[dbo].[payment_vouchers]')
)
BEGIN
    CREATE UNIQUE INDEX [payment_vouchers_payment_voucher_no_key] ON [dbo].[payment_vouchers]([payment_voucher_no]);
END;

-- CreateTable: payment_voucher_applications
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'payment_voucher_applications' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[payment_voucher_applications] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [payment_voucher_id] INT NULL,
        [invoice_no] NVARCHAR(50) NULL,
        [invoice_date] DATE NULL,
        [due_date] DATE NULL,
        [total_amount] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_pmva_total_amount] DEFAULT 0,
        [outstanding_at_time_of_application] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_pmva_outstanding] DEFAULT 0,
        [amount_applied] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_pmva_amount_applied] DEFAULT 0,
        CONSTRAINT [payment_voucher_applications_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

-- Deleting a payment voucher takes its lines with it; the app replaces lines
-- wholesale on every save and never keeps an orphaned one (same as
-- payment_receipt_applications).
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'payment_voucher_applications_payment_voucher_id_fkey'
)
BEGIN
    ALTER TABLE [dbo].[payment_voucher_applications]
      ADD CONSTRAINT [payment_voucher_applications_payment_voucher_id_fkey]
      FOREIGN KEY ([payment_voucher_id]) REFERENCES [dbo].[payment_vouchers]([id]) ON DELETE CASCADE;
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
