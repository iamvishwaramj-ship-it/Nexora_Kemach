BEGIN TRY

BEGIN TRAN;

-- Purchase Invoice line: Machine Engine No., alongside the existing Machine
-- Serial No / Machine Model. Only ever filled when the header's Purchase Type
-- is 'Machine'; descriptive text only.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[purchase_invoice_items]')
    AND name = 'machine_engine_no'
)
BEGIN
    ALTER TABLE [dbo].[purchase_invoice_items] ADD [machine_engine_no] NVARCHAR(100) NULL;
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
