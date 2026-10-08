BEGIN TRY

BEGIN TRAN;

-- AlterTable: delivery_challans.currency
--
-- Delivery Challan never had a Currency field, unlike every other sales
-- document (Sales Quotation, Sales Order, Sales Invoice, ...) which all
-- carry one. Nullable with an INR default, same convention as those
-- columns (see DF_sales_orders_currency et al.): every challan row that
-- existed before this column did simply reads as INR, no backfill needed.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[delivery_challans]') AND name = 'currency'
)
BEGIN
    ALTER TABLE [dbo].[delivery_challans] ADD [currency] NVARCHAR(10) NULL CONSTRAINT [DF_delivery_challans_currency] DEFAULT (N'INR');
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
