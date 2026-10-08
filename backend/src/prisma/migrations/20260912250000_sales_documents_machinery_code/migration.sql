BEGIN TRY

BEGIN TRAN;

-- AlterTable: sales_quotations / sales_orders / delivery_challans /
-- sales_invoices — the Machinery picked on the "Customer & Document
-- Details" card, scoped to whichever Business Partner is selected as the
-- Customer on that document (see business_partner_machineries, added in
-- 20260912240000_business_partner_machineries).
--
-- Held as the code, not an FK id — same by-code convention as this schema
-- already uses for warehouse/supplier/priceList — and nullable, since not
-- every customer has machineries set up and every row written before this
-- column existed stays valid with no value.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_quotations]') AND name = 'machinery_code'
)
BEGIN
    ALTER TABLE [dbo].[sales_quotations] ADD [machinery_code] NVARCHAR(50) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_orders]') AND name = 'machinery_code'
)
BEGIN
    ALTER TABLE [dbo].[sales_orders] ADD [machinery_code] NVARCHAR(50) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[delivery_challans]') AND name = 'machinery_code'
)
BEGIN
    ALTER TABLE [dbo].[delivery_challans] ADD [machinery_code] NVARCHAR(50) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]') AND name = 'machinery_code'
)
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [machinery_code] NVARCHAR(50) NULL;
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
