BEGIN TRY

BEGIN TRAN;

-- AlterTable: sales_quotations — add [enquiry_no]
--
-- The first hop of the sales document chain
-- (Enquiry > Quotation > Order > Delivery Challan > Invoice) had no storage at
-- all. An enquiry and the quotation raised from it were two unconnected rows:
-- the quotation form had no enquiry field, and [enquiries] had no quotation
-- field either. Nothing in the application could state that one led to the
-- other, so Route Map had no way to draw the chain from its beginning.
--
-- Held as the enquiry NUMBER rather than a foreign key to [enquiries].[id],
-- matching how every other document in this schema references the one before
-- it (delivery_challans.order_no, sales_invoices.delivery_challan_no,
-- purchase_invoices.grn_no, ...). Consistency matters more here than
-- referential integrity the rest of the chain does not have either.
--
-- Nullable with no default: a quotation raised directly, with no enquiry
-- behind it, is a normal thing to do and every existing row is exactly that.
-- Backfilling a guessed enquiry onto them would assert a history that was
-- never recorded.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_quotations]') AND name = 'enquiry_no'
)
BEGIN
    ALTER TABLE [dbo].[sales_quotations] ADD [enquiry_no] NVARCHAR(50) NULL;
END;

-- AlterTable: sales_orders — add [quotation_no]
--
-- This one is a repair, not a new idea. The Sales Order form has shown a
-- "Quotation No." dropdown for a long time and used the selection to copy the
-- quotation's customer and line items across — but there was no column to
-- save it into, and salesOrderSchema did not list the field, so zod stripped
-- it out of the payload before the request was ever sent. Every order created
-- from a quotation therefore recorded no trace of it.
--
-- Deliberately NOT reusing [reference_no], which already exists on this table
-- and means something else: it is the CUSTOMER's own reference, auto-filled
-- from the quotation's reference_no. Overloading it would conflate two
-- different facts and corrupt the data already in it.
--
-- Nullable: direct orders with no quotation behind them are normal, and no
-- existing row can be backfilled — the link was never stored to recover.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_orders]') AND name = 'quotation_no'
)
BEGIN
    ALTER TABLE [dbo].[sales_orders] ADD [quotation_no] NVARCHAR(50) NULL;
END;

-- Both columns are indexed: Route Map walks the chain in both directions, so
-- it looks up "the order raised from this quotation" as often as "the
-- quotation behind this order", and the latter is an unindexed scan of the
-- whole table without these. Non-unique — one quotation can legitimately be
-- split across several orders, and one enquiry can produce several quotations.
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_quotations]') AND name = 'IX_sales_quotations_enquiry_no'
)
BEGIN
    CREATE INDEX [IX_sales_quotations_enquiry_no] ON [dbo].[sales_quotations]([enquiry_no]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_orders]') AND name = 'IX_sales_orders_quotation_no'
)
BEGIN
    CREATE INDEX [IX_sales_orders_quotation_no] ON [dbo].[sales_orders]([quotation_no]);
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
