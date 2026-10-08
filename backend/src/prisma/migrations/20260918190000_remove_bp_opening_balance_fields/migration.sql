BEGIN TRY

BEGIN TRAN;

-- DropColumn: business_partner_opening_balances.sales_person / invoice_no /
-- invoice_date / due_date — Sales Employee, Invoice No, Invoice Date and Due
-- Date were removed from the BP Opening Balance form (Company Setup > BP
-- Opening Balance) and from its Excel import. invoiceNo/invoiceDate/dueDate
-- had already collapsed to documentNumber/documentDate/null respectively
-- wherever a per-line value was actually consumed (see
-- upsertBpOutstandingForLine in routes/resources.js), so nothing downstream
-- needed a real per-line value once the fields were gone from the form.
-- None of the four had their own index, so there is nothing to drop there.
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[business_partner_opening_balances]') AND name = 'sales_person'
)
BEGIN
    ALTER TABLE [dbo].[business_partner_opening_balances] DROP COLUMN [sales_person];
END;

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[business_partner_opening_balances]') AND name = 'invoice_no'
)
BEGIN
    ALTER TABLE [dbo].[business_partner_opening_balances] DROP COLUMN [invoice_no];
END;

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[business_partner_opening_balances]') AND name = 'invoice_date'
)
BEGIN
    ALTER TABLE [dbo].[business_partner_opening_balances] DROP COLUMN [invoice_date];
END;

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[business_partner_opening_balances]') AND name = 'due_date'
)
BEGIN
    ALTER TABLE [dbo].[business_partner_opening_balances] DROP COLUMN [due_date];
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
