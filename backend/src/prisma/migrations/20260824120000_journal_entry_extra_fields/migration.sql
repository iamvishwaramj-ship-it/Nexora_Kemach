BEGIN TRY

BEGIN TRAN;

-- AlterTable: journal_entries — add the reference-only header fields from
-- the legacy Journal Entry screen (BP Project, Trans. No., Trans. Code,
-- Ref 1/2/3, Revise Date). None of these feed posting or G/L determination.
-- Guarded with IF NOT EXISTS so this migration is safe to run again, or on a
-- database where one of these was already added by hand.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[journal_entries]') AND name = 'bp_project')
BEGIN
    ALTER TABLE [dbo].[journal_entries] ADD [bp_project] NVARCHAR(150) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[journal_entries]') AND name = 'trans_no')
BEGIN
    ALTER TABLE [dbo].[journal_entries] ADD [trans_no] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[journal_entries]') AND name = 'trans_code')
BEGIN
    ALTER TABLE [dbo].[journal_entries] ADD [trans_code] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[journal_entries]') AND name = 'ref_1')
BEGIN
    ALTER TABLE [dbo].[journal_entries] ADD [ref_1] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[journal_entries]') AND name = 'ref_2')
BEGIN
    ALTER TABLE [dbo].[journal_entries] ADD [ref_2] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[journal_entries]') AND name = 'ref_3')
BEGIN
    ALTER TABLE [dbo].[journal_entries] ADD [ref_3] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[journal_entries]') AND name = 'revise_date_enabled')
BEGIN
    ALTER TABLE [dbo].[journal_entries]
      ADD [revise_date_enabled] BIT NOT NULL
          CONSTRAINT [DF_journal_entries_revise_date_enabled] DEFAULT 0;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[journal_entries]') AND name = 'revise_date')
BEGIN
    ALTER TABLE [dbo].[journal_entries] ADD [revise_date] DATE NULL;
END;

-- AlterTable: journal_entry_lines — add System Currency (SC) and tax columns
-- from the legacy line grid (Debit(SC)/Credit(SC), Tax Group, Tax Amount,
-- Gross Value, Base Amount). All server-computed on save (see
-- toJournalEntryLineData in routes/resources.js) -- never trusted from the
-- client, same rule as the header's totalDebit/totalCredit.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[journal_entry_lines]') AND name = 'debit_sc')
BEGIN
    ALTER TABLE [dbo].[journal_entry_lines]
      ADD [debit_sc] DECIMAL(15, 2) NOT NULL
          CONSTRAINT [DF_journal_entry_lines_debit_sc] DEFAULT 0;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[journal_entry_lines]') AND name = 'credit_sc')
BEGIN
    ALTER TABLE [dbo].[journal_entry_lines]
      ADD [credit_sc] DECIMAL(15, 2) NOT NULL
          CONSTRAINT [DF_journal_entry_lines_credit_sc] DEFAULT 0;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[journal_entry_lines]') AND name = 'tax_group')
BEGIN
    ALTER TABLE [dbo].[journal_entry_lines] ADD [tax_group] NVARCHAR(50) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[journal_entry_lines]') AND name = 'tax_amount')
BEGIN
    ALTER TABLE [dbo].[journal_entry_lines]
      ADD [tax_amount] DECIMAL(15, 2) NOT NULL
          CONSTRAINT [DF_journal_entry_lines_tax_amount] DEFAULT 0;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[journal_entry_lines]') AND name = 'gross_value')
BEGIN
    ALTER TABLE [dbo].[journal_entry_lines]
      ADD [gross_value] DECIMAL(15, 2) NOT NULL
          CONSTRAINT [DF_journal_entry_lines_gross_value] DEFAULT 0;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[journal_entry_lines]') AND name = 'base_amount')
BEGIN
    ALTER TABLE [dbo].[journal_entry_lines]
      ADD [base_amount] DECIMAL(15, 2) NOT NULL
          CONSTRAINT [DF_journal_entry_lines_base_amount] DEFAULT 0;
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
