BEGIN TRY

BEGIN TRAN;

-- AlterTable: purchase_credit_memos — drop contact_person, supplier_ref_no
-- and transaction_type.
--
-- THIS DELETES DATA. It is deliberately a migration of its own, separate
-- from 20260919060000 which only adds columns, so that this one can be
-- skipped, delayed or reverted on its own without holding back the new
-- header fields.
--
-- These three came off the credit memo's header card together with six
-- others (location, posting_date, bill_do_no, bill_do_date, reason,
-- status). Only these three are dropped, because an audit of every reader
-- found nothing outside that form touches them: no GL posting, no stock
-- posting, no print layout, no list column or filter, no report, no Copy
-- From. The other six all stay — status drives syncStockPosting and the
-- list's own Status column, posting_date is where the journal entry takes
-- its posting date from (see JOURNAL_DATE_FIELDS in utils/glPosting.js),
-- and location/bill_do_no/bill_do_date/reason are all printed on the credit
-- memo document (PurchaseCreditMemoPrintable.jsx). Dropping any of those
-- would break working behaviour, not just remove an unused field.
--
-- Guarded on sys.columns so a re-run is a no-op. No DEFAULT constraints to
-- drop first: all three are plain nullable NVARCHARs (see the original
-- table definition) — SQL Server refuses to drop a column that still has a
-- constraint bound to it, which is why that matters.

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[purchase_credit_memos]') AND name = N'contact_person')
BEGIN
    ALTER TABLE [dbo].[purchase_credit_memos] DROP COLUMN [contact_person];
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[purchase_credit_memos]') AND name = N'supplier_ref_no')
BEGIN
    ALTER TABLE [dbo].[purchase_credit_memos] DROP COLUMN [supplier_ref_no];
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[purchase_credit_memos]') AND name = N'transaction_type')
BEGIN
    ALTER TABLE [dbo].[purchase_credit_memos] DROP COLUMN [transaction_type];
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
