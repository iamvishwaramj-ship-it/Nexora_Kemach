BEGIN TRY

BEGIN TRAN;

-- AlterTable: PurchaseInvoice / SalesInvoice — the warehouse a DIRECT invoice
-- moves stock through.
--
-- Neither table had a warehouse, which is why direct-invoice movements (a
-- purchase billed straight off the order with no GRN, a sale billed with no
-- delivery challan) never reached [dbo].[Stock]: the journal needs a warehouse
-- per row and the document could not name one. On-hand quantity was still
-- correct — utils/stockLedger.js derives it from the documents and already
-- counts those invoices — but the movement left no journal row and, more
-- importantly, no FIFO/MAV cost layer, so that stock was unvalued.
--
-- Nullable, and it stays null on the ordinary path: when a GRN or delivery
-- challan exists it already moved the goods through ITS warehouse and the
-- invoice is finance-only. Required only on the direct path, enforced in
-- routes/resources.js rather than by a CHECK constraint, because "direct"
-- means grn_no / delivery_challan_no is empty — a condition about another
-- column that would make the constraint fire on legacy rows that predate it.
ALTER TABLE [dbo].[purchase_invoices] ADD [warehouse] NVARCHAR(150) NULL;
ALTER TABLE [dbo].[sales_invoices] ADD [warehouse] NVARCHAR(150) NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
