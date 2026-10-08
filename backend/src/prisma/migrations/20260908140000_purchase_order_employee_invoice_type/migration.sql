BEGIN TRY

BEGIN TRAN;

-- Purchase Order: drop Vehicle Type, add Purchase Employee and Invoice Type.
--
-- Vehicle Type (rented/owned delivery vehicle, added in
-- 20260907130000_purchase_order_type_vehicle_transport) is removed from the
-- form entirely per business request — not replaced by anything.
--
-- Purchase Employee is a CFL select sourced from Company Setup > Sales
-- Employee (see schema.prisma's doc comment on PurchaseOrder.purchaseEmployee).
--
-- Invoice Type is a CFL select backed by the new invoice_types table (see
-- 20260908130000_add_invoice_type_master, which must apply first).
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('[dbo].[purchase_orders]') AND name = 'vehicle_type'
)
BEGIN
    ALTER TABLE [dbo].[purchase_orders] DROP COLUMN [vehicle_type];
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('[dbo].[purchase_orders]') AND name = 'purchase_employee'
)
BEGIN
    ALTER TABLE [dbo].[purchase_orders] ADD [purchase_employee] NVARCHAR(100);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('[dbo].[purchase_orders]') AND name = 'invoice_type'
)
BEGIN
    ALTER TABLE [dbo].[purchase_orders] ADD [invoice_type] NVARCHAR(150);
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
