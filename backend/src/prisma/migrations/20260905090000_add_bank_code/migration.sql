BEGIN TRY

BEGIN TRAN;

-- AlterTable: BankName — an auto-generated Bank Code (BNK numbering series),
-- same perpetual-master-series pattern as Branch/Tax Code/Sales Employee/...
-- (see DOCUMENT_CATALOG in services/documentNumberService.js). Nullable:
-- existing bank rows have no code of their own to preserve — unlike those
-- other masters, which already had a hand-typed code column before this —
-- so scripts/backfillBankCode.js assigns one to each pre-existing row after
-- this migration applies.
--
-- Filtered rather than a plain unique index: SQL Server (unlike Postgres)
-- allows only ONE null in a plain unique index, and every pre-existing row
-- is null until the backfill script runs. Same shape as
-- customer_outstanding_invoice_no_key / supplier_outstanding_invoice_no_key
-- in the init migration — but those were declared on CREATE TABLE, so this
-- is the first time this repo adds a column and indexes it in the same
-- migration. Prisma sends this whole file to SQL Server as a single batch
-- (it does not split on GO), and SQL Server resolves every column reference
-- in a batch at parse time, before any statement in it actually runs — so a
-- plain CREATE INDEX referencing bank_code here would fail with "Invalid
-- column name" even though the ALTER TABLE above it runs first. Wrapping the
-- CREATE INDEX in dynamic SQL (EXEC) defers its parsing to execution time,
-- by which point the column already exists.
ALTER TABLE [dbo].[bank_names] ADD [bank_code] NVARCHAR(50) NULL;

EXEC(N'CREATE UNIQUE INDEX [bank_names_bank_code_key]
  ON [dbo].[bank_names]([bank_code]) WHERE [bank_code] IS NOT NULL;');

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
