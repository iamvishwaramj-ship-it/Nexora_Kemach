BEGIN TRY

BEGIN TRAN;

-- CreateTable: journal_entries
--
-- Accounting > Journal Entry -- the manual double-entry posting screen
-- (SAP FB50/F-02 style). One header row plus N journal_entry_lines, each
-- posting a debit or a credit against a ChartOfAccounts account by its code.
-- total_debit/total_credit are server-recomputed on every save and must be
-- equal -- an unbalanced entry is rejected in the API layer before it ever
-- reaches this table.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'journal_entries' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[journal_entries] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [journal_entry_no] NVARCHAR(50) NOT NULL,
        [branch] NVARCHAR(150) NULL,
        [posting_date] DATE NULL,
        [document_date] DATE NULL,
        [due_date] DATE NULL,
        [reference_no] NVARCHAR(100) NULL,
        [currency] NVARCHAR(10) NOT NULL CONSTRAINT [DF_je_currency] DEFAULT 'INR',
        [exchange_rate] DECIMAL(10,4) NOT NULL CONSTRAINT [DF_je_exchange_rate] DEFAULT 1,
        [remarks] NVARCHAR(MAX) NULL,
        [total_debit] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_je_total_debit] DEFAULT 0,
        [total_credit] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_je_total_credit] DEFAULT 0,
        [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_je_status] DEFAULT 'Draft',
        CONSTRAINT [journal_entries_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'journal_entries_journal_entry_no_key'
      AND object_id = OBJECT_ID(N'[dbo].[journal_entries]')
)
BEGIN
    CREATE UNIQUE INDEX [journal_entries_journal_entry_no_key] ON [dbo].[journal_entries]([journal_entry_no]);
END;

-- CreateTable: journal_entry_lines
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'journal_entry_lines' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[journal_entry_lines] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [journal_entry_id] INT NULL,
        [line_no] INT NOT NULL CONSTRAINT [DF_jel_line_no] DEFAULT 1,
        [account_code] VARCHAR(20) NOT NULL,
        [account_name] NVARCHAR(150) NULL,
        [description] NVARCHAR(MAX) NULL,
        [cost_center] NVARCHAR(100) NULL,
        [debit] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_jel_debit] DEFAULT 0,
        [credit] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_jel_credit] DEFAULT 0,
        CONSTRAINT [journal_entry_lines_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

-- Deleting a journal entry takes its lines with it; the app replaces lines
-- wholesale on every save and never keeps an orphaned one (same pattern as
-- payment_voucher_applications / payment_receipt_applications).
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'journal_entry_lines_journal_entry_id_fkey'
)
BEGIN
    ALTER TABLE [dbo].[journal_entry_lines]
      ADD CONSTRAINT [journal_entry_lines_journal_entry_id_fkey]
      FOREIGN KEY ([journal_entry_id]) REFERENCES [dbo].[journal_entries]([id]) ON DELETE CASCADE;
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
