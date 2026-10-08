// Creates non-clustered performance indexes on high-volume transaction
// tables in SQL Server if they do not already exist.
//
// Safe & Idempotent: It NEVER drops or modifies tables/data.
// Run with:  node src/scripts/ensureIndexes.js

require('dotenv').config();
const prisma = require('../prisma/client');

const INDEXES_SQL = `
-- 1. Sales Orders & Items
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SalesOrder_Status_OrderDate' AND object_id = OBJECT_ID('sales_orders'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SalesOrder_Status_OrderDate] ON [dbo].[sales_orders]([status], [order_date]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SalesOrder_Customer' AND object_id = OBJECT_ID('sales_orders'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SalesOrder_Customer] ON [dbo].[sales_orders]([customer]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SalesOrderItem_OrderId' AND object_id = OBJECT_ID('sales_order_items'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SalesOrderItem_OrderId] ON [dbo].[sales_order_items]([order_id]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SalesOrderItem_ProductCode' AND object_id = OBJECT_ID('sales_order_items'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SalesOrderItem_ProductCode] ON [dbo].[sales_order_items]([product_code]);
END

-- 2. Purchase Orders & Items
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PurchaseOrder_Status_PoDate' AND object_id = OBJECT_ID('purchase_orders'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PurchaseOrder_Status_PoDate] ON [dbo].[purchase_orders]([status], [po_date]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PurchaseOrder_Supplier' AND object_id = OBJECT_ID('purchase_orders'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PurchaseOrder_Supplier] ON [dbo].[purchase_orders]([supplier]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PurchaseOrderItem_OrderId' AND object_id = OBJECT_ID('purchase_order_items'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PurchaseOrderItem_OrderId] ON [dbo].[purchase_order_items]([order_id]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PurchaseOrderItem_ProductCode' AND object_id = OBJECT_ID('purchase_order_items'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PurchaseOrderItem_ProductCode] ON [dbo].[purchase_order_items]([product_code]);
END

-- 3. Sales Invoices & Items
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SalesInvoice_Status_InvoiceDate' AND object_id = OBJECT_ID('sales_invoices'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SalesInvoice_Status_InvoiceDate] ON [dbo].[sales_invoices]([status], [invoice_date]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SalesInvoice_Customer' AND object_id = OBJECT_ID('sales_invoices'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SalesInvoice_Customer] ON [dbo].[sales_invoices]([customer]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SalesInvoiceItem_InvoiceId' AND object_id = OBJECT_ID('sales_invoice_items'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SalesInvoiceItem_InvoiceId] ON [dbo].[sales_invoice_items]([invoice_id]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SalesInvoiceItem_ProductCode' AND object_id = OBJECT_ID('sales_invoice_items'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SalesInvoiceItem_ProductCode] ON [dbo].[sales_invoice_items]([product_code]);
END

-- 4. Purchase Invoices & Items
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PurchaseInvoice_Status_InvoiceDate' AND object_id = OBJECT_ID('purchase_invoices'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PurchaseInvoice_Status_InvoiceDate] ON [dbo].[purchase_invoices]([status], [invoice_date]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PurchaseInvoice_Supplier' AND object_id = OBJECT_ID('purchase_invoices'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PurchaseInvoice_Supplier] ON [dbo].[purchase_invoices]([supplier]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PurchaseInvoiceItem_InvoiceId' AND object_id = OBJECT_ID('purchase_invoice_items'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PurchaseInvoiceItem_InvoiceId] ON [dbo].[purchase_invoice_items]([invoice_id]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PurchaseInvoiceItem_ProductCode' AND object_id = OBJECT_ID('purchase_invoice_items'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PurchaseInvoiceItem_ProductCode] ON [dbo].[purchase_invoice_items]([product_code]);
END

-- 5. Phase 1 of the data-loading performance work (see docs/perf-baseline.md).
-- Every one of these tables is filtered by branch on its list route via
-- withBranchScope()/withBranchScopeAny() (utils/branchScope.js) on EVERY
-- request from a non-admin user, and had no index at all on that column —
-- see the branch-scoping gap noted in docs/perf-baseline.md's Phase 0
-- findings. purchase_invoices already had one (IX_PurchaseInvoice_...
-- covers status+date, not branch alone, but is close enough not to
-- duplicate) and is skipped.

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_journal_entry_branch' AND object_id = OBJECT_ID('journal_entries'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_journal_entry_branch] ON [dbo].[journal_entries]([branch]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_purchase_quotation_branch' AND object_id = OBJECT_ID('purchase_quotations'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_purchase_quotation_branch] ON [dbo].[purchase_quotations]([branch]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_purchase_order_branch' AND object_id = OBJECT_ID('purchase_orders'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_purchase_order_branch] ON [dbo].[purchase_orders]([branch]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_grn_branch' AND object_id = OBJECT_ID('goods_received_notes'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_grn_branch] ON [dbo].[goods_received_notes]([branch]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_purchase_return_branch' AND object_id = OBJECT_ID('purchase_returns'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_purchase_return_branch] ON [dbo].[purchase_returns]([branch]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_purchase_credit_memo_branch' AND object_id = OBJECT_ID('purchase_credit_memos'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_purchase_credit_memo_branch] ON [dbo].[purchase_credit_memos]([branch]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_sales_credit_memo_branch' AND object_id = OBJECT_ID('sales_credit_memos'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_sales_credit_memo_branch] ON [dbo].[sales_credit_memos]([branch]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_sales_return_branch' AND object_id = OBJECT_ID('sales_returns'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_sales_return_branch] ON [dbo].[sales_returns]([branch]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_sales_quotation_branch' AND object_id = OBJECT_ID('sales_quotations'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_sales_quotation_branch] ON [dbo].[sales_quotations]([branch]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_sales_order_branch' AND object_id = OBJECT_ID('sales_orders'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_sales_order_branch] ON [dbo].[sales_orders]([branch]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_delivery_challan_branch' AND object_id = OBJECT_ID('delivery_challans'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_delivery_challan_branch] ON [dbo].[delivery_challans]([branch]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_stock_receipt_branch' AND object_id = OBJECT_ID('stock_receipts'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_stock_receipt_branch] ON [dbo].[stock_receipts]([branch]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_stock_issue_branch' AND object_id = OBJECT_ID('stock_issues'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_stock_issue_branch] ON [dbo].[stock_issues]([branch]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_stock_adjustment_branch' AND object_id = OBJECT_ID('stock_adjustments'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_stock_adjustment_branch] ON [dbo].[stock_adjustments]([branch]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_stock_transfer_branch' AND object_id = OBJECT_ID('stock_transfers'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_stock_transfer_branch] ON [dbo].[stock_transfers]([branch]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_stock_transfer_request_branch' AND object_id = OBJECT_ID('stock_transfer_requests'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_stock_transfer_request_branch] ON [dbo].[stock_transfer_requests]([branch]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_stock_transfer_request_to_branch' AND object_id = OBJECT_ID('stock_transfer_requests'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_stock_transfer_request_to_branch] ON [dbo].[stock_transfer_requests]([to_branch]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_stock_transfer_receipt_branch' AND object_id = OBJECT_ID('stock_transfer_receipts'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_stock_transfer_receipt_branch] ON [dbo].[stock_transfer_receipts]([branch]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_collection_branch' AND object_id = OBJECT_ID('collections'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_collection_branch] ON [dbo].[collections]([branch]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_supplier_payment_branch' AND object_id = OBJECT_ID('supplier_payments'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_supplier_payment_branch] ON [dbo].[supplier_payments]([branch]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_payment_receipt_branch' AND object_id = OBJECT_ID('payment_receipts'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_payment_receipt_branch] ON [dbo].[payment_receipts]([branch]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_payment_voucher_branch' AND object_id = OBJECT_ID('payment_vouchers'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_payment_voucher_branch] ON [dbo].[payment_vouchers]([branch]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_bank_deposit_branch' AND object_id = OBJECT_ID('bank_deposits'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_bank_deposit_branch] ON [dbo].[bank_deposits]([branch]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_cheque_branch' AND object_id = OBJECT_ID('cheques'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_cheque_branch] ON [dbo].[cheques]([branch]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_warehouse_master_branch' AND object_id = OBJECT_ID('warehouse'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_warehouse_master_branch] ON [dbo].[warehouse]([branch]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_enquiry_branch' AND object_id = OBJECT_ID('enquiries'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_enquiry_branch] ON [dbo].[enquiries]([branch]);
END

-- 6. Missing FK indexes on child item tables (Phase 1). Every other item
-- table already had its parent-id FK indexed (see the *_items indexes
-- above and the many ix_*/IX_* entries already in schema.prisma) — these
-- five did not, which makes loading a document's line items (and the
-- cascading delete Prisma issues when its header is removed) a full scan
-- of the item table instead of an index seek.

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_purchase_quotation_item_quotation_id' AND object_id = OBJECT_ID('purchase_quotation_items'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_purchase_quotation_item_quotation_id] ON [dbo].[purchase_quotation_items]([quotation_id]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_sales_quotation_item_quotation_id' AND object_id = OBJECT_ID('sales_quotation_items'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_sales_quotation_item_quotation_id] ON [dbo].[sales_quotation_items]([quotation_id]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_deposit_item_deposit_id' AND object_id = OBJECT_ID('deposit_items'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_deposit_item_deposit_id] ON [dbo].[deposit_items]([deposit_id]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_stock_transfer_request_item_request_id' AND object_id = OBJECT_ID('stock_transfer_request_items'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_stock_transfer_request_item_request_id] ON [dbo].[stock_transfer_request_items]([request_id]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_stock_transfer_receipt_item_receipt_id' AND object_id = OBJECT_ID('stock_transfer_receipt_items'))
BEGIN
    CREATE NONCLUSTERED INDEX [ix_stock_transfer_receipt_item_receipt_id] ON [dbo].[stock_transfer_receipt_items]([receipt_id]);
END
`;

async function run() {
  console.log('Applying database indexes safely to SQL Server...');
  try {
    await prisma.$executeRawUnsafe(INDEXES_SQL);
    console.log('✅ All indexes applied successfully! No tables or data were dropped.');
  } catch (err) {
    console.error('❌ Failed to apply indexes:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  run();
}

module.exports = { run };
