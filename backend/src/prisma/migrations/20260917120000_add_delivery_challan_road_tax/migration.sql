BEGIN TRY

BEGIN TRAN;

-- Delivery Challan has no Road Tax UI of its own (unlike Sales Quotation/
-- Order, which have the Yes/No toggle, or Sales Invoice/Return/Credit Memo,
-- which have the plain manual amount) -- but a challan copied from a
-- quotation/order that DOES have Road Tax applied needs somewhere to carry
-- that figure so its own Grand Total still matches the document it was
-- copied from. Same two columns as Sales Order (a manual amount gated by a
-- toggle), added here purely as a carry-through: no visible field on
-- DeliveryChallan.jsx reads or writes these, only the Copy From/To mapping
-- and this document's own totals computation. Defaults to 0/No for every
-- existing challan, which predates this entirely.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[delivery_challans]') AND name = 'road_tax')
BEGIN
    ALTER TABLE [dbo].[delivery_challans] ADD [road_tax] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_delivery_challans_road_tax DEFAULT 0;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[delivery_challans]') AND name = 'road_tax_applicable')
BEGIN
    ALTER TABLE [dbo].[delivery_challans] ADD [road_tax_applicable] BIT NOT NULL CONSTRAINT DF_delivery_challans_road_tax_applicable DEFAULT 0;
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
