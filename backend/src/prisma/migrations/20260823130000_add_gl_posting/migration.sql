BEGIN TRY

BEGIN TRAN;

-- ===========================================================================
-- Automatic G/L posting (SAP-style FI integration)
-- ===========================================================================
-- Logistics and financial documents now generate their own accounting
-- document automatically when they post -- see backend/src/utils/glPosting.js.
-- Two things are needed to make that safe:
--
--   1. a source-document key on journal_entries, so one document can never
--      produce two journal entries however many times it is re-saved; and
--   2. GST control accounts on GLAccountDeterminations, so the CGST/SGST/IGST
--      split computed by documentTotals.js has somewhere to land.
--
-- NOTE ON EXEC() BELOW: SQL Server compiles an entire batch before executing
-- any of it, and it only defers name resolution for objects that do not exist
-- yet -- not for COLUMNS of a table that already does. So a CREATE INDEX that
-- names a column added by an ALTER TABLE earlier in the same batch fails to
-- compile with "Invalid column name", and the whole batch never runs. Wrapping
-- that statement in EXEC() defers its compilation to execution time, by which
-- point the column exists. (The earlier CREATE TABLE + CREATE INDEX migration
-- needs no such treatment: the table did not exist at compile time, so
-- deferred name resolution covered it.)
-- ===========================================================================

-- AlterTable: journal_entries -- source document linkage + parked-entry state
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[journal_entries]') AND name = 'source_type'
)
BEGIN
    ALTER TABLE [dbo].[journal_entries] ADD [source_type] NVARCHAR(50) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[journal_entries]') AND name = 'source_doc_no'
)
BEGIN
    ALTER TABLE [dbo].[journal_entries] ADD [source_doc_no] NVARCHAR(50) NULL;
END;

-- Why a journal entry is parked in 'Pending G/L' (which account determination
-- is missing). NULL once it posts successfully.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[journal_entries]') AND name = 'gl_error'
)
BEGIN
    ALTER TABLE [dbo].[journal_entries] ADD [gl_error] NVARCHAR(MAX) NULL;
END;

-- The idempotency key. FILTERED so that manual entries -- which carry NULL on
-- both columns -- are exempt: a plain UNIQUE index in SQL Server treats NULL
-- as a value and would allow only ONE manual journal entry to exist in the
-- whole system. The filter is what makes "at most one auto-generated entry
-- per source document, unlimited manual entries" expressible as a constraint
-- rather than something the application has to remember to check.
--
-- This mirrors IX_Stock_TransType_TransNum on the stock subledger.
--
-- EXEC() because both columns were added above, in this same batch -- see the
-- note at the top of this file.
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'UQ_journal_entries_source'
      AND object_id = OBJECT_ID(N'[dbo].[journal_entries]')
)
BEGIN
    EXEC('CREATE UNIQUE INDEX [UQ_journal_entries_source]
      ON [dbo].[journal_entries]([source_type], [source_doc_no])
      WHERE [source_type] IS NOT NULL AND [source_doc_no] IS NOT NULL;');
END;

-- AlterTable: GLAccountDeterminations -- GST control accounts
--
-- Three per side rather than one lumped tax account, because GSTR-1/GSTR-3B
-- report CGST, SGST and IGST separately; collapsing them makes the returns
-- underivable from the ledger. Nullable like every other determination
-- column -- an unconfigured account parks the journal entry with a message
-- naming it, it does not block the document.
--
-- No index or constraint references these, so they need no EXEC() wrapper.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[GLAccountDeterminations]') AND name = 'OutputCgstPayableID'
)
BEGIN
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [OutputCgstPayableID] INT NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[GLAccountDeterminations]') AND name = 'OutputSgstPayableID'
)
BEGIN
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [OutputSgstPayableID] INT NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[GLAccountDeterminations]') AND name = 'OutputIgstPayableID'
)
BEGIN
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [OutputIgstPayableID] INT NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[GLAccountDeterminations]') AND name = 'InputCgstReceivableID'
)
BEGIN
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [InputCgstReceivableID] INT NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[GLAccountDeterminations]') AND name = 'InputSgstReceivableID'
)
BEGIN
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [InputSgstReceivableID] INT NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[GLAccountDeterminations]') AND name = 'InputIgstReceivableID'
)
BEGIN
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [InputIgstReceivableID] INT NULL;
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
