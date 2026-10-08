BEGIN TRY
BEGIN TRAN;

-- 1. Sales & Purchase Invoice Indexes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_sales_invoice_branch_status')
    CREATE NONCLUSTERED INDEX [ix_sales_invoice_branch_status] ON [dbo].[sales_invoices]([branch], [status]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_sales_invoice_date_status')
    CREATE NONCLUSTERED INDEX [ix_sales_invoice_date_status] ON [dbo].[sales_invoices]([invoice_date], [status]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_purchase_invoice_branch_status')
    CREATE NONCLUSTERED INDEX [ix_purchase_invoice_branch_status] ON [dbo].[purchase_invoices]([branch], [status]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_purchase_invoice_date_status')
    CREATE NONCLUSTERED INDEX [ix_purchase_invoice_date_status] ON [dbo].[purchase_invoices]([invoice_date], [status]);

-- 2. Line Item Foreign Keys & Product Lookups
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_sales_invoice_item_invoice_id')
    CREATE NONCLUSTERED INDEX [ix_sales_invoice_item_invoice_id] ON [dbo].[sales_invoice_items]([invoice_id]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_sales_invoice_item_product_code')
    CREATE NONCLUSTERED INDEX [ix_sales_invoice_item_product_code] ON [dbo].[sales_invoice_items]([product_code]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_purchase_invoice_item_invoice_id')
    CREATE NONCLUSTERED INDEX [ix_purchase_invoice_item_invoice_id] ON [dbo].[purchase_invoice_items]([invoice_id]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_purchase_invoice_item_product_code')
    CREATE NONCLUSTERED INDEX [ix_purchase_invoice_item_product_code] ON [dbo].[purchase_invoice_items]([product_code]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_grn_item_grn_id')
    CREATE NONCLUSTERED INDEX [ix_grn_item_grn_id] ON [dbo].[goods_received_note_items]([grn_id]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_grn_item_product_code')
    CREATE NONCLUSTERED INDEX [ix_grn_item_product_code] ON [dbo].[goods_received_note_items]([product_code]);

-- 3. Outstanding Balances & Aging
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_cust_outstanding_status_date')
    CREATE NONCLUSTERED INDEX [ix_cust_outstanding_status_date] ON [dbo].[customer_outstanding]([status], [invoice_date]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_supp_outstanding_status_date')
    CREATE NONCLUSTERED INDEX [ix_supp_outstanding_status_date] ON [dbo].[supplier_outstanding]([status], [invoice_date]);

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRAN;
    THROW;
END CATCH;