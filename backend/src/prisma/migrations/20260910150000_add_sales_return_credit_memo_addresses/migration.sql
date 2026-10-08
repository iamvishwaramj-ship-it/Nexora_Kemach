BEGIN TRY

BEGIN TRAN;

-- AlterTable: SalesReturn, SalesCreditMemo — Bill To/Ship To were added to
-- these two forms to match the other four sales documents (Sales
-- Quotation/Order/Delivery Challan/Invoice), which already carry a frozen,
-- derived Billing/Shipping Address auto-filled from the selected customer's
-- Business Partner record.

ALTER TABLE [dbo].[sales_returns] ADD [billing_address] NVARCHAR(MAX) NULL;
ALTER TABLE [dbo].[sales_returns] ADD [shipping_address] NVARCHAR(MAX) NULL;

ALTER TABLE [dbo].[sales_credit_memos] ADD [billing_address] NVARCHAR(MAX) NULL;
ALTER TABLE [dbo].[sales_credit_memos] ADD [shipping_address] NVARCHAR(MAX) NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
