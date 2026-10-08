BEGIN TRY

BEGIN TRAN;

-- AlterTable: GoodsReceivedNote — "Supplier & Document Details" was
-- reorganised (Branch/Supplier/Supplier Code/Vendor Ref No/Place of
-- Supply/Ship From on the left, GRN No/GRN Date/Warehouse/Ship To on the
-- right) and gained three new fields: vendor_ref_no (the vendor's own
-- reference for this delivery), and ship_from/ship_to (sourced from the
-- selected supplier's Business Partner addresses, same idea as Purchase
-- Order's ship_from/ship_to). place_of_supply already existed as a column
-- but is now surfaced on the form.
ALTER TABLE [dbo].[goods_received_notes] ADD [vendor_ref_no] NVARCHAR(50) NULL;
ALTER TABLE [dbo].[goods_received_notes] ADD [ship_from] NVARCHAR(255) NULL;
ALTER TABLE [dbo].[goods_received_notes] ADD [ship_to] NVARCHAR(255) NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
