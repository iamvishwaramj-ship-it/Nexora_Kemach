BEGIN TRY

BEGIN TRAN;

-- Road Tax becomes an explicit Yes/No toggle on Sales Quotation and Sales
-- Order only (see schema.prisma's roadTaxApplicable comment on those two
-- models) -- every other sales document (Invoice, Return, Credit Memo) has
-- no Road Tax UI at all and does not get this column. Defaults to 0 (No) so
-- every existing row keeps computing/showing no Road Tax until a user
-- explicitly checks the box on that document.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_quotations]') AND name = 'road_tax_applicable')
BEGIN
    ALTER TABLE [dbo].[sales_quotations] ADD [road_tax_applicable] BIT NOT NULL CONSTRAINT DF_sales_quotations_road_tax_applicable DEFAULT 0;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_orders]') AND name = 'road_tax_applicable')
BEGIN
    ALTER TABLE [dbo].[sales_orders] ADD [road_tax_applicable] BIT NOT NULL CONSTRAINT DF_sales_orders_road_tax_applicable DEFAULT 0;
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
