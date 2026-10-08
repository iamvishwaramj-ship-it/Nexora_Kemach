BEGIN TRY

BEGIN TRAN;

-- AlterTable: PurchaseOrder — persist the quotation this order was raised
-- from in its own column, mirroring SalesOrder.quotationNo. Previously the
-- Purchase Order "Copy From" dialog only wrote the quotation number into the
-- generic reference_no field, which is not a reliable link (reference_no can
-- be edited for any reason afterwards). This is what lets a Purchase
-- Quotation close automatically once an order is raised against it — see
-- recomputePurchaseQuotationStatus in utils/documentFlow.js.
ALTER TABLE [dbo].[purchase_orders] ADD [quotation_no] NVARCHAR(50) NULL;

-- AlterTable: Enquiry — status default 'New' -> 'Open'. The status
-- vocabulary on this table is being simplified from
-- New/In Progress/Follow-up/Quotation Sent/Converted/Closed-Lost down to a
-- plain Open/Closed, driven by whether a Sales Quotation has been raised
-- against the enquiry (see recomputeEnquiryStatus in utils/documentFlow.js).
-- Existing rows keep whatever legacy status string they already have — this
-- only changes the default for NEW rows; see scripts/backfillDocumentFlow.js
-- for reconciling existing enquiries/quotations to the new vocabulary.
ALTER TABLE [dbo].[enquiries] DROP CONSTRAINT [DF_enquiries_status];
ALTER TABLE [dbo].[enquiries] ADD CONSTRAINT [DF_enquiries_status] DEFAULT N'Open' FOR [status];

-- AlterTable: SalesQuotation — status default 'Draft' -> 'Open'. Simplified
-- from Draft/Sent/Pending/Accepted/Rejected/Expired down to Open/Closed,
-- driven by whether a Sales Order has been raised against the quotation (see
-- recomputeSalesQuotationStatus in utils/documentFlow.js). Existing rows are
-- reconciled by the backfill script, not by this migration.
ALTER TABLE [dbo].[sales_quotations] DROP CONSTRAINT [DF_sales_quotations_status];
ALTER TABLE [dbo].[sales_quotations] ADD CONSTRAINT [DF_sales_quotations_status] DEFAULT N'Open' FOR [status];

-- AlterTable: GoodsReceivedNote — status default 'Received' -> 'Open'.
-- 'Draft' stays as the pre-receipt staging state; 'Received'/
-- 'Partially Received' are retired in favour of a plain Open (received, not
-- yet invoiced) / Closed (fully invoiced) — see recomputeGrnStatus in
-- utils/documentFlow.js. 'Cancelled' is untouched.
ALTER TABLE [dbo].[goods_received_notes] DROP CONSTRAINT [DF_goods_received_notes_status];
ALTER TABLE [dbo].[goods_received_notes] ADD CONSTRAINT [DF_goods_received_notes_status] DEFAULT N'Open' FOR [status];

-- DeliveryChallan.status keeps its 'Pending' default (the pre-despatch
-- staging state is unchanged) and PurchaseQuotation.status is already
-- 'Open' — neither needs a default-constraint change here.

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
