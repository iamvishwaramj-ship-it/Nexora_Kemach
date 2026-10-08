BEGIN TRY

BEGIN TRAN;

-- Stock Transfer Receipt gains its own "Stock Request No." reference —
-- a plain string pointer at an existing Stock Transfer Request's
-- request_no, no FK, same convention as the pre-existing transfer_no
-- column (which points at a Stock Transfer instead). Nullable so existing
-- rows need no backfill.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_receipts]')
      AND name = 'request_no'
)
BEGIN
    ALTER TABLE [dbo].[stock_transfer_receipts]
        ADD [request_no] NVARCHAR(50) NULL;
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
