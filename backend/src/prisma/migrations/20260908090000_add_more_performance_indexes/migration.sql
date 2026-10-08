-- Extends 20260907120000_add_performance_indexes to the document/master
-- tables that mirror the same status+date / party-name filter pattern as
-- Sales Order, Sales Invoice, Purchase Order and Purchase Invoice (which
-- already got this treatment) but were missed the first time round:
-- Purchase Quotation, GRN, Sales Return, Sales Credit Memo, Purchase Credit
-- Memo, Purchase Return, Sales Quotation, Delivery Challan, Collection,
-- Supplier Payment, Bank Deposit, Journal Entry, and Business Partner
-- (filtered by partner_type + status on essentially every customer/vendor
-- dropdown and list in the app — see routes/resources.js's
-- GET /business-partners and the customerApi/supplierApi adapters).
--
-- Same guarded, idempotent style as that migration: IF NOT EXISTS around
-- each CREATE INDEX, and the whole batch wrapped in one transaction so a
-- failure partway through doesn't leave some indexes created and others not.
BEGIN TRY
BEGIN TRAN;

-- 1. Purchase Quotation
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_purchase_quotation_status_date')
    CREATE NONCLUSTERED INDEX [ix_purchase_quotation_status_date] ON [dbo].[purchase_quotations]([status], [quotation_date]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_purchase_quotation_supplier')
    CREATE NONCLUSTERED INDEX [ix_purchase_quotation_supplier] ON [dbo].[purchase_quotations]([supplier]);

-- 2. Goods Received Note
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_grn_status_date')
    CREATE NONCLUSTERED INDEX [ix_grn_status_date] ON [dbo].[goods_received_notes]([status], [received_date]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_grn_supplier')
    CREATE NONCLUSTERED INDEX [ix_grn_supplier] ON [dbo].[goods_received_notes]([supplier]);

-- 3. Sales Return
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_sales_return_status_date')
    CREATE NONCLUSTERED INDEX [ix_sales_return_status_date] ON [dbo].[sales_returns]([status], [document_date]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_sales_return_customer')
    CREATE NONCLUSTERED INDEX [ix_sales_return_customer] ON [dbo].[sales_returns]([customer]);

-- 4. Sales Credit Memo
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_sales_credit_memo_status_date')
    CREATE NONCLUSTERED INDEX [ix_sales_credit_memo_status_date] ON [dbo].[sales_credit_memos]([status], [document_date]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_sales_credit_memo_customer')
    CREATE NONCLUSTERED INDEX [ix_sales_credit_memo_customer] ON [dbo].[sales_credit_memos]([customer]);

-- 5. Purchase Credit Memo
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_purchase_credit_memo_status_date')
    CREATE NONCLUSTERED INDEX [ix_purchase_credit_memo_status_date] ON [dbo].[purchase_credit_memos]([status], [document_date]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_purchase_credit_memo_supplier')
    CREATE NONCLUSTERED INDEX [ix_purchase_credit_memo_supplier] ON [dbo].[purchase_credit_memos]([supplier]);

-- 6. Purchase Return
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_purchase_return_status_date')
    CREATE NONCLUSTERED INDEX [ix_purchase_return_status_date] ON [dbo].[purchase_returns]([status], [document_date]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_purchase_return_supplier')
    CREATE NONCLUSTERED INDEX [ix_purchase_return_supplier] ON [dbo].[purchase_returns]([supplier]);

-- 7. Sales Quotation
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_sales_quotation_status_date')
    CREATE NONCLUSTERED INDEX [ix_sales_quotation_status_date] ON [dbo].[sales_quotations]([status], [quotation_date]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_sales_quotation_customer')
    CREATE NONCLUSTERED INDEX [ix_sales_quotation_customer] ON [dbo].[sales_quotations]([customer]);

-- 8. Delivery Challan
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_delivery_challan_status_date')
    CREATE NONCLUSTERED INDEX [ix_delivery_challan_status_date] ON [dbo].[delivery_challans]([status], [challan_date]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_delivery_challan_customer')
    CREATE NONCLUSTERED INDEX [ix_delivery_challan_customer] ON [dbo].[delivery_challans]([customer]);

-- 9. Collection (Receivables) & Supplier Payment (Payables) — also the
-- backing tables for the Collection Register / Payment Register "Last 7
-- Days" trend queries in routes/resources.js, which filter by date + status
-- + customer/supplier name with no index behind any of it today.
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_collection_status_date')
    CREATE NONCLUSTERED INDEX [ix_collection_status_date] ON [dbo].[collections]([status], [receipt_date]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_collection_customer_name')
    CREATE NONCLUSTERED INDEX [ix_collection_customer_name] ON [dbo].[collections]([customer_name]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_supplier_payment_status_date')
    CREATE NONCLUSTERED INDEX [ix_supplier_payment_status_date] ON [dbo].[supplier_payments]([status], [payment_date]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_supplier_payment_supplier_name')
    CREATE NONCLUSTERED INDEX [ix_supplier_payment_supplier_name] ON [dbo].[supplier_payments]([supplier_name]);

-- 10. Bank Deposit & Journal Entry
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_bank_deposit_status_date')
    CREATE NONCLUSTERED INDEX [ix_bank_deposit_status_date] ON [dbo].[bank_deposits]([status], [deposit_date]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_journal_entry_status_date')
    CREATE NONCLUSTERED INDEX [ix_journal_entry_status_date] ON [dbo].[journal_entries]([status], [posting_date]);

-- 11. Business Partner — every Customer/Vendor dropdown and list in the app
-- (Sales/Purchase documents, Business Partner page itself, reports) filters
-- GET /business-partners by partner_type and often status, with no index
-- behind either column until now.
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_business_partner_type_status')
    CREATE NONCLUSTERED INDEX [ix_business_partner_type_status] ON [dbo].[business_partners]([partner_type], [status]);

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRAN;
    THROW;
END CATCH;
