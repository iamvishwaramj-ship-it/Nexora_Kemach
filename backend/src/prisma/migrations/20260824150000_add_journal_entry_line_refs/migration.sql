BEGIN TRY

BEGIN TRAN;

-- AlterTable: journal_entry_lines — add ref_1, ref_2, ref_3.
--
-- Per-line reference/memo columns for the Journal Lines table, distinct from
-- the header-level ref_1/ref_2/ref_3 already on journal_entries. Plain free
-- text, nullable, no default; nothing here feeds posting or G/L
-- determination — see schema.prisma. Guarded with IF NOT EXISTS so this
-- migration is safe to run again.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[journal_entry_lines]') AND name = 'ref_1')
BEGIN
    ALTER TABLE [dbo].[journal_entry_lines] ADD [ref_1] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[journal_entry_lines]') AND name = 'ref_2')
BEGIN
    ALTER TABLE [dbo].[journal_entry_lines] ADD [ref_2] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[journal_entry_lines]') AND name = 'ref_3')
BEGIN
    ALTER TABLE [dbo].[journal_entry_lines] ADD [ref_3] NVARCHAR(100) NULL;
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
