BEGIN TRY

BEGIN TRAN;

-- Opening Balance becomes a header + item-lines screen (see
-- pages/inventory/OpeningBalance.jsx). Every line saved together now records
-- the document number and date it came in on.
--
-- Both columns are NULLABLE and no backfill is attempted: rows that predate
-- this screen genuinely have no document behind them, and inventing one would
-- assert paperwork that never existed. The list simply shows an em dash for
-- those.
--
-- The (item_code, warehouse) unique index is deliberately LEFT ALONE. A row
-- here is still one opening stock position per item per warehouse; the
-- document columns only say which paperwork it arrived on. That is what makes
-- the batch save an upsert on that pair rather than a plain insert — see
-- POST /opening-balance/batch in routes/resources.js.
--
-- Guarded so this is safe to re-run.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[opening_balance]') AND name = 'document_number')
BEGIN
    ALTER TABLE [dbo].[opening_balance] ADD [document_number] NVARCHAR(50) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[opening_balance]') AND name = 'document_date')
BEGIN
    ALTER TABLE [dbo].[opening_balance] ADD [document_date] DATE NULL;
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
