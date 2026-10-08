BEGIN TRY

BEGIN TRAN;

-- ===========================================================================
-- Cancel for the non-posting documents: Sales Quotation, Sales Order,
-- Purchase Quotation
-- ===========================================================================
-- These three carry no journal entry, stock posting or outstanding row, so
-- cancelling one is a pure status change (see PATCH /sales/quotations/:id/
-- cancel, /sales/orders/:id/cancel and /purchase/quotations/:id/cancel in
-- routes/resources.js). This only adds the is_cancelled flag, same shape as
-- purchase_orders.is_cancelled: BIT NOT NULL DEFAULT 0.
-- ===========================================================================

-- AlterTable: sales_quotations
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_quotations]') AND name = 'is_cancelled'
)
BEGIN
    ALTER TABLE [dbo].[sales_quotations] ADD [is_cancelled] BIT NOT NULL CONSTRAINT [DF_sales_quotations_is_cancelled] DEFAULT 0;
END;

-- AlterTable: sales_orders
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_orders]') AND name = 'is_cancelled'
)
BEGIN
    ALTER TABLE [dbo].[sales_orders] ADD [is_cancelled] BIT NOT NULL CONSTRAINT [DF_sales_orders_is_cancelled] DEFAULT 0;
END;

-- AlterTable: purchase_quotations
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[purchase_quotations]') AND name = 'is_cancelled'
)
BEGIN
    ALTER TABLE [dbo].[purchase_quotations] ADD [is_cancelled] BIT NOT NULL CONSTRAINT [DF_purchase_quotations_is_cancelled] DEFAULT 0;
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
