BEGIN TRY

BEGIN TRAN;

-- Dashboard (and every other caller of utils/stockLedger.js's
-- getStockMovementByProductCode) joins each of these item tables back to its
-- header on the FK below and filters the header's status. Ten of the twelve
-- stock-moving item tables had no index at all on that FK -- a company-wide,
-- unfiltered join was doing a full table scan on every one of them, on every
-- dashboard load that missed the 30s in-memory cache. Only PurchaseInvoiceItem
-- and SalesInvoiceItem already had this covered.

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_stock_receipt_items_receipt_id')
CREATE NONCLUSTERED INDEX ix_stock_receipt_items_receipt_id ON [dbo].[stock_receipt_items] ([receipt_id]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_stock_receipt_items_product_code')
CREATE NONCLUSTERED INDEX ix_stock_receipt_items_product_code ON [dbo].[stock_receipt_items] ([product_code]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_stock_issue_items_issue_id')
CREATE NONCLUSTERED INDEX ix_stock_issue_items_issue_id ON [dbo].[stock_issue_items] ([issue_id]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_stock_issue_items_product_code')
CREATE NONCLUSTERED INDEX ix_stock_issue_items_product_code ON [dbo].[stock_issue_items] ([product_code]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_stock_adjustment_items_adjustment_id')
CREATE NONCLUSTERED INDEX ix_stock_adjustment_items_adjustment_id ON [dbo].[stock_adjustment_items] ([adjustment_id]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_stock_adjustment_items_product_code')
CREATE NONCLUSTERED INDEX ix_stock_adjustment_items_product_code ON [dbo].[stock_adjustment_items] ([product_code]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_stock_transfer_items_transfer_id')
CREATE NONCLUSTERED INDEX ix_stock_transfer_items_transfer_id ON [dbo].[stock_transfer_items] ([transfer_id]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_stock_transfer_items_product_code')
CREATE NONCLUSTERED INDEX ix_stock_transfer_items_product_code ON [dbo].[stock_transfer_items] ([product_code]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_goods_received_note_items_grn_id')
CREATE NONCLUSTERED INDEX ix_goods_received_note_items_grn_id ON [dbo].[goods_received_note_items] ([grn_id]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_goods_received_note_items_product_code')
CREATE NONCLUSTERED INDEX ix_goods_received_note_items_product_code ON [dbo].[goods_received_note_items] ([product_code]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_delivery_challan_items_challan_id')
CREATE NONCLUSTERED INDEX ix_delivery_challan_items_challan_id ON [dbo].[delivery_challan_items] ([challan_id]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_delivery_challan_items_product_code')
CREATE NONCLUSTERED INDEX ix_delivery_challan_items_product_code ON [dbo].[delivery_challan_items] ([product_code]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_purchase_return_items_return_id')
CREATE NONCLUSTERED INDEX ix_purchase_return_items_return_id ON [dbo].[purchase_return_items] ([return_id]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_purchase_return_items_product_code')
CREATE NONCLUSTERED INDEX ix_purchase_return_items_product_code ON [dbo].[purchase_return_items] ([product_code]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_purchase_credit_memo_items_credit_memo_id')
CREATE NONCLUSTERED INDEX ix_purchase_credit_memo_items_credit_memo_id ON [dbo].[purchase_credit_memo_items] ([credit_memo_id]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_purchase_credit_memo_items_product_code')
CREATE NONCLUSTERED INDEX ix_purchase_credit_memo_items_product_code ON [dbo].[purchase_credit_memo_items] ([product_code]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_sales_return_items_return_id')
CREATE NONCLUSTERED INDEX ix_sales_return_items_return_id ON [dbo].[sales_return_items] ([return_id]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_sales_return_items_product_code')
CREATE NONCLUSTERED INDEX ix_sales_return_items_product_code ON [dbo].[sales_return_items] ([product_code]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_sales_credit_memo_items_credit_memo_id')
CREATE NONCLUSTERED INDEX ix_sales_credit_memo_items_credit_memo_id ON [dbo].[sales_credit_memo_items] ([credit_memo_id]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_sales_credit_memo_items_product_code')
CREATE NONCLUSTERED INDEX ix_sales_credit_memo_items_product_code ON [dbo].[sales_credit_memo_items] ([product_code]);

-- Stock Receipt/Issue/Adjustment/Transfer headers had NO index at all --
-- not even on status -- unlike GRN/Delivery Challan/Returns/Credit Memos,
-- which already got a (status, date) index in an earlier pass. These four
-- feed the same stock ledger join above (status filters every source), so
-- they were an equally-sized blind spot.

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_stock_receipts_status_date')
CREATE NONCLUSTERED INDEX ix_stock_receipts_status_date ON [dbo].[stock_receipts] ([status], [date]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_stock_issues_status_date')
CREATE NONCLUSTERED INDEX ix_stock_issues_status_date ON [dbo].[stock_issues] ([status], [date]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_stock_adjustments_status_date')
CREATE NONCLUSTERED INDEX ix_stock_adjustments_status_date ON [dbo].[stock_adjustments] ([status], [date]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_stock_transfers_status_request_date')
CREATE NONCLUSTERED INDEX ix_stock_transfers_status_request_date ON [dbo].[stock_transfers] ([status], [request_date]);

-- customer_outstanding / supplier_outstanding back the dashboard's
-- Total Receivables / Total Payables cards (aggregate SUM ... WHERE status
-- <> 'Paid') and had no index at all -- a full scan of every invoice ever
-- raised, on every dashboard load.

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_customer_outstanding_status')
CREATE NONCLUSTERED INDEX ix_customer_outstanding_status ON [dbo].[customer_outstanding] ([status]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_supplier_outstanding_status')
CREATE NONCLUSTERED INDEX ix_supplier_outstanding_status ON [dbo].[supplier_outstanding] ([status]);

COMMIT TRAN;

END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
