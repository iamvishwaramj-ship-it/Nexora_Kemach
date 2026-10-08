BEGIN TRY

BEGIN TRAN;

-- Opening Balance gains the document footer every Sales/Purchase document
-- already carries — Terms & Conditions, Prepared By, Approved By — shown
-- below the Item Details table (see pages/inventory/OpeningBalance.jsx,
-- modelled on SalesInvoice.jsx's own footer card).
--
-- Stamped onto every line saved together, exactly like document_number /
-- document_date from migration 20260912210000: a row here is still one
-- opening stock position per item per warehouse, and these columns only
-- record the paperwork it arrived on.
--
-- prepared_by / approved_by hold the employee's NAME as free text, matching
-- SalesInvoice.prepared_by / approved_by rather than introducing an FK to
-- sales_employees — the Employee Master can be truncated independently (see
-- scripts/empdepttrnck.js) and a foreign key here would block that.
--
-- All nullable, no backfill: rows predating this screen have no document
-- behind them at all.
--
-- Guarded so this is safe to re-run.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[opening_balance]') AND name = 'terms_conditions')
BEGIN
    ALTER TABLE [dbo].[opening_balance] ADD [terms_conditions] NVARCHAR(MAX) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[opening_balance]') AND name = 'prepared_by')
BEGIN
    ALTER TABLE [dbo].[opening_balance] ADD [prepared_by] NVARCHAR(150) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[opening_balance]') AND name = 'approved_by')
BEGIN
    ALTER TABLE [dbo].[opening_balance] ADD [approved_by] NVARCHAR(150) NULL;
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
