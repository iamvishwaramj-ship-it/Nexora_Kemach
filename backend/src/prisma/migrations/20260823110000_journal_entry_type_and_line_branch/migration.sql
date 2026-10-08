BEGIN TRY

BEGIN TRAN;

-- AlterTable: journal_entries -- add transaction_type
--
-- Classification label for what kind of business process a manual posting
-- relates to ('Manual' or one of the other transaction documents in the
-- app). Carries no FK/linkage of its own -- see the model comment in
-- schema.prisma.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[journal_entries]') AND name = 'transaction_type'
)
BEGIN
    ALTER TABLE [dbo].[journal_entries]
      ADD [transaction_type] NVARCHAR(50) NOT NULL CONSTRAINT [DF_je_transaction_type] DEFAULT 'Manual';
END;

-- AlterTable: journal_entry_lines -- cost_center -> branch
--
-- The line-level classification is a Branch select (same options as the
-- header's own Branch field), not a free-text cost center. Renamed via
-- sp_rename so any rows already saved under cost_center keep their value
-- rather than being dropped and recreated blank.
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[journal_entry_lines]') AND name = 'cost_center'
)
AND NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[journal_entry_lines]') AND name = 'branch'
)
BEGIN
    EXEC sp_rename 'dbo.journal_entry_lines.cost_center', 'branch', 'COLUMN';
END;

-- Covers a database that never had cost_center at all (a fresh install
-- running this migration straight after the CreateTable one) -- the rename
-- above only fires when cost_center exists.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[journal_entry_lines]') AND name = 'branch'
)
BEGIN
    ALTER TABLE [dbo].[journal_entry_lines] ADD [branch] NVARCHAR(150) NULL;
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
