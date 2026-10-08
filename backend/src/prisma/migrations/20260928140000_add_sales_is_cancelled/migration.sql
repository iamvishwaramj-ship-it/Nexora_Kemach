BEGIN TRY

BEGIN TRAN;

-- ===========================================================================
-- Sales document cancellation parity
-- ===========================================================================
-- Purchase Order, Goods Received Note, Purchase Invoice, Purchase Return and
-- Purchase Credit Memo have each had their own is_cancelled flag for a while
-- (see PurchaseOrder.isCancelled and its siblings in schema.prisma). The four
-- Sales GL-posting document types -- Sales Invoice, Sales Return, Sales
-- Credit Memo, Delivery Challan -- never got one, so cancelling them meant
-- setting status = 'Cancelled' with no companion flag and, worse, no guarded
-- PATCH .../cancel route to reach that state safely (settlement/dependent-
-- document checks, stock reversal, a real reversing Journal Entry). This
-- migration only adds the missing column on each of the four tables, same
-- shape as every existing isCancelled column: BIT NOT NULL DEFAULT 0. The
-- guarded cancel routes and the reversal itself already exist independently
-- of this column (see PATCH /sales/invoices/:id/cancel and its siblings in
-- routes/resources.js, and reverseJournalEntry/syncJournalEntry in
-- utils/glPosting.js, added by 20260928120000_add_journal_entry_reversal).
-- ===========================================================================

-- AlterTable: sales_invoices
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_invoices]') AND name = 'is_cancelled'
)
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [is_cancelled] BIT NOT NULL CONSTRAINT [DF_sales_invoices_is_cancelled] DEFAULT 0;
END;

-- AlterTable: sales_returns
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_returns]') AND name = 'is_cancelled'
)
BEGIN
    ALTER TABLE [dbo].[sales_returns] ADD [is_cancelled] BIT NOT NULL CONSTRAINT [DF_sales_returns_is_cancelled] DEFAULT 0;
END;

-- AlterTable: sales_credit_memos
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[sales_credit_memos]') AND name = 'is_cancelled'
)
BEGIN
    ALTER TABLE [dbo].[sales_credit_memos] ADD [is_cancelled] BIT NOT NULL CONSTRAINT [DF_sales_credit_memos_is_cancelled] DEFAULT 0;
END;

-- AlterTable: delivery_challans
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[delivery_challans]') AND name = 'is_cancelled'
)
BEGIN
    ALTER TABLE [dbo].[delivery_challans] ADD [is_cancelled] BIT NOT NULL CONSTRAINT [DF_delivery_challans_is_cancelled] DEFAULT 0;
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
