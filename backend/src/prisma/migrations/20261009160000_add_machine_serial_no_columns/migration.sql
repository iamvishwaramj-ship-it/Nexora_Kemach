BEGIN TRY

BEGIN TRAN;

-- AlterTable: sales_returns, sales_credit_memos, sales_quotations,
-- sales_orders, delivery_challans, sales_invoices
--
-- Pre-existing schema/database drift, unrelated to Phase 1 (MRP & Order
-- Generation) or the Phase A manufacturing foundation. schema.prisma already
-- declares a nullable `machineSerialNo` field (mapped to `machine_serial_no`)
-- on these models, but no migration was ever generated to add that column
-- to the live tables, so the generated Prisma Client expects a column the
-- database doesn't have -- surfacing as PrismaClientKnownRequestError P2022
-- ("The column `machine_serial_no` does not exist in the current database")
-- on any of these models, most visibly on SalesInvoice via the dashboard
-- stats query (routes/dashboard.js).
--
-- Scope confirmed directly against the live database (nexora_fabric_db) via
-- an INFORMATION_SCHEMA/COL_LENGTH check before this file was finalized:
-- the column is genuinely missing on these six document-header tables, and
-- already exists on goods_received_note_items and purchase_invoice_items
-- (the two item-level tables, @db.NVarChar(100) there) -- those two are
-- deliberately NOT touched by this migration. Each ALTER below is still
-- individually guarded with COL_LENGTH(...) IS NULL, so re-running this
-- migration is a safe no-op on any table where the column already exists --
-- the same idiom already used for this project's other two drift-fix
-- migrations (20261009120000_add_warehouse_description_uom,
-- 20261009130000_add_sales_category_columns). This migration adds only
-- `machine_serial_no`, as NVARCHAR(50) NULL per schema.prisma's own
-- declaration for these six models -- no other column, index, relationship,
-- record, or unrelated module is touched, and schema.prisma itself is
-- unchanged (it already declares this field correctly).
IF COL_LENGTH('dbo.sales_returns', 'machine_serial_no') IS NULL
BEGIN
    ALTER TABLE [dbo].[sales_returns] ADD [machine_serial_no] NVARCHAR(50) NULL;
END;

IF COL_LENGTH('dbo.sales_credit_memos', 'machine_serial_no') IS NULL
BEGIN
    ALTER TABLE [dbo].[sales_credit_memos] ADD [machine_serial_no] NVARCHAR(50) NULL;
END;

IF COL_LENGTH('dbo.sales_quotations', 'machine_serial_no') IS NULL
BEGIN
    ALTER TABLE [dbo].[sales_quotations] ADD [machine_serial_no] NVARCHAR(50) NULL;
END;

IF COL_LENGTH('dbo.sales_orders', 'machine_serial_no') IS NULL
BEGIN
    ALTER TABLE [dbo].[sales_orders] ADD [machine_serial_no] NVARCHAR(50) NULL;
END;

IF COL_LENGTH('dbo.delivery_challans', 'machine_serial_no') IS NULL
BEGIN
    ALTER TABLE [dbo].[delivery_challans] ADD [machine_serial_no] NVARCHAR(50) NULL;
END;

IF COL_LENGTH('dbo.sales_invoices', 'machine_serial_no') IS NULL
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [machine_serial_no] NVARCHAR(50) NULL;
END;

-- NOTE: goods_received_note_items and purchase_invoice_items are
-- intentionally excluded -- confirmed already present on both (NVARCHAR(100)
-- NULL) in the live database check above.

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
