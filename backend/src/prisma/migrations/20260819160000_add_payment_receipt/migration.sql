BEGIN TRY

BEGIN TRAN;

-- CreateTable: payment_receipts
--
-- Banking > Payment Receipt ("Incoming Payment"): posts a receipt against a
-- Customer, a Vendor, or a raw Chart-Of-Accounts Account (party_type), unlike
-- Collection Entry which is customer-only. Customer/Vendor receipts settle
-- through the same open-item ledger as Collection/SupplierPayment; Account
-- receipts and any receipt with payment_on_account = 1 never touch an
-- outstanding-invoice balance.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'payment_receipts' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[payment_receipts] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [branch] NVARCHAR(150) NULL,
        [payment_receipt_no] NVARCHAR(50) NOT NULL,
        [party_type] NVARCHAR(20) NOT NULL CONSTRAINT [DF_pr_party_type] DEFAULT 'Customer',
        [party_code] NVARCHAR(50) NULL,
        [party_name] NVARCHAR(150) NULL,
        [bill_to] NVARCHAR(MAX) NULL,
        [contact_person] NVARCHAR(100) NULL,
        [posting_date] DATE NULL,
        [due_date] DATE NULL,
        [document_date] DATE NULL,
        [reference] NVARCHAR(100) NULL,
        [transaction_no] NVARCHAR(100) NULL,
        [remarks] NVARCHAR(MAX) NULL,
        [journal_remarks] NVARCHAR(MAX) NULL,
        [payment_on_account] BIT NOT NULL CONSTRAINT [DF_pr_payment_on_account] DEFAULT 0,
        [round_off] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_pr_round_off] DEFAULT 0,
        [total_amount_due] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_pr_total_amount_due] DEFAULT 0,
        [applied_amount] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_pr_applied_amount] DEFAULT 0,
        [open_balance] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_pr_open_balance] DEFAULT 0,
        [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_pr_status] DEFAULT 'Draft',
        CONSTRAINT [payment_receipts_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'payment_receipts_payment_receipt_no_key'
      AND object_id = OBJECT_ID(N'[dbo].[payment_receipts]')
)
BEGIN
    CREATE UNIQUE INDEX [payment_receipts_payment_receipt_no_key] ON [dbo].[payment_receipts]([payment_receipt_no]);
END;

-- CreateTable: payment_receipt_applications
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'payment_receipt_applications' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[payment_receipt_applications] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [payment_receipt_id] INT NULL,
        [invoice_no] NVARCHAR(50) NULL,
        [invoice_date] DATE NULL,
        [due_date] DATE NULL,
        [total_amount] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_pra_total_amount] DEFAULT 0,
        [outstanding_at_time_of_application] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_pra_outstanding] DEFAULT 0,
        [amount_applied] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_pra_amount_applied] DEFAULT 0,
        CONSTRAINT [payment_receipt_applications_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

-- Deleting a payment receipt takes its lines with it; the app replaces lines
-- wholesale on every save and never keeps an orphaned one (same as
-- collection_invoice_applications / payment_invoice_applications).
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'payment_receipt_applications_payment_receipt_id_fkey'
)
BEGIN
    ALTER TABLE [dbo].[payment_receipt_applications]
      ADD CONSTRAINT [payment_receipt_applications_payment_receipt_id_fkey]
      FOREIGN KEY ([payment_receipt_id]) REFERENCES [dbo].[payment_receipts]([id]) ON DELETE CASCADE;
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
