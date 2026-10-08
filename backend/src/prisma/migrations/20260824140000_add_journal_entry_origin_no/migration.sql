BEGIN TRY

BEGIN TRAN;

-- AlterTable: journal_entries — add origin_no.
--
-- The Journal Entry screen renames transaction_type's label to "Origin" and
-- adds a companion "Origin No" field beside it. For a manual entry this is a
-- second, independent number allocated from its own numbering series
-- (catalog code 'JEO' in documentNumberService.js) — editable/auto-generated
-- the same way journal_entry_no already is, but never reused as
-- journal_entry_no itself. For a system-generated entry it stays NULL: that
-- entry's Origin No is its existing source_doc_no column, shown read-only,
-- not drawn from this one.
--
-- Nullable, no default, and deliberately NOT unique — see schema.prisma for
-- why a UNIQUE column would break here (SQL Server allows at most one NULL
-- row per unique index, and every system-generated entry leaves this null).
-- Guarded with IF NOT EXISTS so this migration is safe to run again.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[journal_entries]') AND name = 'origin_no')
BEGIN
    ALTER TABLE [dbo].[journal_entries] ADD [origin_no] NVARCHAR(50) NULL;
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
