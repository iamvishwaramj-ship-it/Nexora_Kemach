-- Extends 20260907120000_add_performance_indexes / 20260908090000_add_more_
-- performance_indexes / 20260908120000_add_stock_ledger_indexes to two
-- predicates none of them covers: the stock ledger's "did this invoice move
-- the goods itself?" de-duplication test, and the document-chain columns the
-- status recompute / over-consumption guards look documents up by.
--
-- Nothing here duplicates an index those three (or 20260908100000) already
-- create; the one candidate that did — business_partners([partner_code]),
-- wanted for nextBusinessPartnerCode's `startsWith` prefix scan inside the
-- partner-create transaction — was dropped from this migration because
-- BusinessPartner.partnerCode is @unique, so
-- 20260823220000_add_business_partner already created
-- [business_partners_partner_code_key] over exactly that column and a prefix
-- range seek is already served by it.
--
-- Same guarded, idempotent style as those migrations: IF NOT EXISTS around
-- each CREATE INDEX, and the whole batch wrapped in one transaction so a
-- failure partway through doesn't leave some indexes created and others not.
BEGIN TRY
BEGIN TRAN;

-- 1. The stock ledger's direct-invoice test — the highest-value pair here.
--
-- utils/stockLedger.js's purchaseInvoice / salesInvoice sources only count an
-- invoice as a stock movement when nothing upstream already moved the goods,
-- via headerFilter = { OR: [{ grnNo: null }, { grnNo: '' }] } (and the
-- delivery-challan equivalent on sales). buildWhere ANDs that with
-- status NOT IN (non-moving) and, when an as-on date is given,
-- invoice_date <= @asOn. That combined predicate is evaluated on EVERY stock
-- read in the system — every negative-stock guard on every save, every
-- inventory report, the dashboard — and neither invoice table had an index
-- leading with the chain column.
--
-- Deliberately a plain composite keyed on the chain column FIRST rather than
-- a filtered index over ([status], [invoice_date]): the predicate is a
-- two-armed OR (IS NULL / = ''), and SQL Server's filtered-index matching
-- cannot reliably prove implication for an OR filter, so a filtered index
-- risks being built and then never chosen. Leading with grn_no /
-- delivery_challan_no makes each arm of the OR its own seek, with status and
-- the date as trailing key columns for the residual.
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_purchase_invoices_direct')
    CREATE NONCLUSTERED INDEX [ix_purchase_invoices_direct] ON [dbo].[purchase_invoices]([grn_no], [status], [invoice_date]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_sales_invoices_direct')
    CREATE NONCLUSTERED INDEX [ix_sales_invoices_direct] ON [dbo].[sales_invoices]([delivery_challan_no], [status], [invoice_date]);

-- 2. Document-chain lookup columns.
--
-- utils/documentFlow.js recomputes a source document's status, and guards
-- against over-consuming it, by finding every downstream document that names
-- it — consumerModel.findMany({ where: { <chain column>: sourceDocNo, ... } }).
-- Each of these tables is indexed on ([status], [document_date]) and on its
-- party column already (20260908090000), but not on the chain column the
-- lookup actually seeks by, so each recompute scanned the whole table.

-- Purchase Quotation -> Purchase Order (recomputePurchaseQuotationStatus).
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_purchase_orders_quotation_no')
    CREATE NONCLUSTERED INDEX [ix_purchase_orders_quotation_no] ON [dbo].[purchase_orders]([quotation_no]);

-- Delivery Challan -> Sales Return (over-consumption guard).
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_sales_returns_challan_no')
    CREATE NONCLUSTERED INDEX [ix_sales_returns_challan_no] ON [dbo].[sales_returns]([challan_no]);

-- GRN -> Purchase Return (over-consumption guard).
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_purchase_returns_grn_no')
    CREATE NONCLUSTERED INDEX [ix_purchase_returns_grn_no] ON [dbo].[purchase_returns]([grn_no]);

-- Sales Invoice -> Sales Credit Memo (over-consumption guard).
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_sales_credit_memos_invoice_no')
    CREATE NONCLUSTERED INDEX [ix_sales_credit_memos_invoice_no] ON [dbo].[sales_credit_memos]([invoice_no]);

-- Purchase Invoice -> Purchase Credit Memo (over-consumption guard).
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_purchase_credit_memos_invoice_no')
    CREATE NONCLUSTERED INDEX [ix_purchase_credit_memos_invoice_no] ON [dbo].[purchase_credit_memos]([invoice_no]);

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRAN;
    THROW;
END CATCH;
