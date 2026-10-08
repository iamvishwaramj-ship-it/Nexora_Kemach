BEGIN TRY

BEGIN TRAN;

-- ===========================================================================
-- Journal Entry reversal support
-- ===========================================================================
-- Cancelling a posted document used to hard-delete its JournalEntry (see the
-- old reverseJournalEntry in utils/glPosting.js) -- fine when this app had no
-- notion of an audit trail, wrong once a cancelled document's accounting
-- history needs to stay visible. From here on, cancelling a document that
-- already posted a real entry keeps that entry (flipped to status
-- 'Reversed') and creates a new entry that mirrors it with debit/credit
-- swapped, linked back to it by reversed_entry_id. A parked 'Pending G/L'
-- entry (never actually posted -- no lines were ever written for it) is
-- still just deleted outright, same as before: there is nothing in the
-- ledger to reverse.
-- ===========================================================================

-- AlterTable: journal_entries -- reversal linkage
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[journal_entries]') AND name = 'reversed_entry_id'
)
BEGIN
    ALTER TABLE [dbo].[journal_entries] ADD [reversed_entry_id] INT NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[journal_entries]') AND name = 'is_reversal'
)
BEGIN
    ALTER TABLE [dbo].[journal_entries] ADD [is_reversal] BIT NOT NULL CONSTRAINT [DF_je_is_reversal] DEFAULT 0;
END;

-- reversed_entry_id is one-to-one: an original is reversed at most once (a
-- second cancel of the same document finds nothing live to reverse -- see
-- reverseJournalEntry's own idempotency check), so no two originals should
-- ever point at the same reversal row either.
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'UQ_journal_entries_reversed_entry'
      AND object_id = OBJECT_ID(N'[dbo].[journal_entries]')
)
BEGIN
    EXEC('CREATE UNIQUE INDEX [UQ_journal_entries_reversed_entry]
      ON [dbo].[journal_entries]([reversed_entry_id])
      WHERE [reversed_entry_id] IS NOT NULL;');
END;

-- Self-referencing FK, NO ACTION both ways: SQL Server refuses a CASCADE path
-- that could reach the same table twice, which a self-FK always risks, and
-- there is no scenario where deleting a JournalEntry should ripple onto the
-- entry it reverses (or vice versa) -- a real, ever-posted entry is never
-- deleted any more (see reverseJournalEntry), only flipped to Reversed.
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_journal_entries_reversed_entry_id'
)
BEGIN
    ALTER TABLE [dbo].[journal_entries]
      ADD CONSTRAINT [FK_journal_entries_reversed_entry_id]
      FOREIGN KEY ([reversed_entry_id]) REFERENCES [dbo].[journal_entries]([id])
      ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

-- Widen the source-document idempotency index (added in
-- 20260823130000_add_gl_posting as UQ_journal_entries_source, on
-- (source_type, source_doc_no) WHERE both NOT NULL) so a cancelled
-- document's history can keep BOTH its original (now Reversed) entry and its
-- reversal under the same (source_type, source_doc_no) key -- what it must
-- still guarantee is "at most one LIVE, non-reversal entry per source
-- document", not "at most one row ever".
IF EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'UQ_journal_entries_source'
      AND object_id = OBJECT_ID(N'[dbo].[journal_entries]')
)
BEGIN
    DROP INDEX [UQ_journal_entries_source] ON [dbo].[journal_entries];
END;

-- EXEC() because is_reversal was added earlier in this same batch -- SQL
-- Server compiles the whole batch before executing any of it, and only
-- defers name resolution for objects that don't exist yet, not for columns
-- of a table that already does (see the matching note in
-- 20260823130000_add_gl_posting/migration.sql).
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'UQ_journal_entries_source'
      AND object_id = OBJECT_ID(N'[dbo].[journal_entries]')
)
BEGIN
    EXEC('CREATE UNIQUE INDEX [UQ_journal_entries_source]
      ON [dbo].[journal_entries]([source_type], [source_doc_no])
      WHERE [source_type] IS NOT NULL AND [source_doc_no] IS NOT NULL
        AND [is_reversal] = 0 AND [status] <> ''Reversed'';');
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
