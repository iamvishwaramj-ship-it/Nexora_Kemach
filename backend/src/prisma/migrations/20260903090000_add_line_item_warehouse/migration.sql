BEGIN TRY

BEGIN TRAN;

-- Mandatory line-level Warehouse for Purchase, Sales, and Inventory
-- documents. Every column here follows the existing convention set by
-- GoodsReceivedNoteItem.warehouse / StockTransferItem.fromWarehouse: a
-- nullable NVARCHAR(150) holding the WarehouseMaster CODE (not an FK id),
-- so rows written before this migration keep loading/printing exactly as
-- before (they simply resolve to the document's header warehouse at
-- posting time — see stockTable.js). Making the field MANDATORY is
-- enforced at the application layer (zod) for new/edited documents, not by
-- a NOT NULL constraint here, precisely so historical documents are never
-- broken by this change.
--
-- GoodsReceivedNoteItem already has this column (added earlier) and is not
-- touched here.

-- Purchase
ALTER TABLE [dbo].[purchase_quotation_items] ADD [warehouse] NVARCHAR(150) NULL;
ALTER TABLE [dbo].[purchase_order_items] ADD [warehouse] NVARCHAR(150) NULL;
ALTER TABLE [dbo].[purchase_invoice_items] ADD [warehouse] NVARCHAR(150) NULL;
ALTER TABLE [dbo].[purchase_credit_memo_items] ADD [warehouse] NVARCHAR(150) NULL;
ALTER TABLE [dbo].[purchase_return_items] ADD [warehouse] NVARCHAR(150) NULL;

-- Sales
ALTER TABLE [dbo].[sales_quotation_items] ADD [warehouse] NVARCHAR(150) NULL;
ALTER TABLE [dbo].[sales_order_items] ADD [warehouse] NVARCHAR(150) NULL;
ALTER TABLE [dbo].[delivery_challan_items] ADD [warehouse] NVARCHAR(150) NULL;
ALTER TABLE [dbo].[sales_invoice_items] ADD [warehouse] NVARCHAR(150) NULL;
ALTER TABLE [dbo].[sales_credit_memo_items] ADD [warehouse] NVARCHAR(150) NULL;
ALTER TABLE [dbo].[sales_return_items] ADD [warehouse] NVARCHAR(150) NULL;

-- Inventory — additive, alongside the existing header-level warehouse
-- fields (StockReceipt.warehouse, StockIssue.to_warehouse,
-- StockAdjustment.warehouse), which are unchanged by this migration.
ALTER TABLE [dbo].[stock_receipt_items] ADD [warehouse] NVARCHAR(150) NULL;
ALTER TABLE [dbo].[stock_issue_items] ADD [warehouse] NVARCHAR(150) NULL;
ALTER TABLE [dbo].[stock_adjustment_items] ADD [warehouse] NVARCHAR(150) NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
