BEGIN TRY

BEGIN TRAN;

-- AddColumn: business_partner_opening_balances.invoice_no / invoice_date /
-- due_date — per-line Invoice No, Invoice Date and Due Date on the BP Opening
-- Balance form (Company Setup > BP Opening Balance), its Excel import and its
-- download template. All nullable: a blank Invoice No falls back to the old
-- "<documentNumber>-<id>" Outstanding key, a blank Invoice Date falls back to
-- the document date. (These three columns were dropped in
-- 20260918190000_remove_bp_opening_balance_fields and are now brought back.)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[business_partner_opening_balances]') AND name = 'invoice_no'
)
BEGIN
    ALTER TABLE [dbo].[business_partner_opening_balances] ADD [invoice_no] NVARCHAR(50) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[business_partner_opening_balances]') AND name = 'invoice_date'
)
BEGIN
    ALTER TABLE [dbo].[business_partner_opening_balances] ADD [invoice_date] DATE NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[business_partner_opening_balances]') AND name = 'due_date'
)
BEGIN
    ALTER TABLE [dbo].[business_partner_opening_balances] ADD [due_date] DATE NULL;
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
