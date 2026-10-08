BEGIN TRY

BEGIN TRAN;

-- AlterTable: products — General/Purchase/Sales/Inventory tab fields added
-- to match the reference "Edit Items / Material" template's field set.
-- Every column here is optional (nullable, or BIT with a false default) so
-- every product saved before this migration keeps validating untouched; a
-- boolean gets an explicit default rather than being left nullable so
-- existing rows read as a real value (false / not set) instead of NULL.
--
-- Length/Width/Height/Volume/Weight, Factor 1-4 and Tax Group are shared
-- across the Purchase, Sales and Inventory tabs in the UI (one column each,
-- shown in more than one place) rather than duplicated per tab — the
-- reference template itself repeats the same physical-attribute fields
-- verbatim on more than one tab.
--
-- Guarded with IF NOT EXISTS per column (see 20260822140000 for the same
-- pattern) so this migration is safe to re-run.

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'foreign_name'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [foreign_name] NVARCHAR(150) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'manufacturer'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [manufacturer] NVARCHAR(150) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'msdc'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [msdc] NVARCHAR(150) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'additional_identifier'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [additional_identifier] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'shipping_type'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [shipping_type] NVARCHAR(50) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'cost_center_code'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [cost_center_code] NVARCHAR(50) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'cost_center_name'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [cost_center_name] NVARCHAR(150) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'manage_method'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [manage_method] NVARCHAR(50) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'price_list'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [price_list] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'unit_price'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [unit_price] DECIMAL(15,2) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'asset_item'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [asset_item] BIT NOT NULL CONSTRAINT [DF_products_asset_item] DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'mfr_catalog_no'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [mfr_catalog_no] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'purchasing_uom_name'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [purchasing_uom_name] NVARCHAR(50) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'items_per_purchase_unit'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [items_per_purchase_unit] DECIMAL(15,4) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'purchase_packaging_uom_name'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [purchase_packaging_uom_name] NVARCHAR(50) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'quantity_per_purchase_package'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [quantity_per_purchase_package] DECIMAL(15,4) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'customs_group'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [customs_group] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'items_per_sales_unit'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [items_per_sales_unit] DECIMAL(15,4) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'sales_packaging_uom_name'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [sales_packaging_uom_name] NVARCHAR(50) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'quantity_per_sales_package'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [quantity_per_sales_package] DECIMAL(15,4) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'tax_group'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [tax_group] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'length'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [length] DECIMAL(15,4) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'width'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [width] DECIMAL(15,4) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'height'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [height] DECIMAL(15,4) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'volume'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [volume] DECIMAL(18,6) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'weight'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [weight] DECIMAL(15,4) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'factor1'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [factor1] DECIMAL(15,4) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'factor2'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [factor2] DECIMAL(15,4) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'factor3'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [factor3] DECIMAL(15,4) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'factor4'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [factor4] DECIMAL(15,4) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'manage_inventory_by_warehouse'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [manage_inventory_by_warehouse] BIT NOT NULL CONSTRAINT [DF_products_manage_inventory_by_warehouse] DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'inventory_level_required'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [inventory_level_required] DECIMAL(15,4) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'minimum_level'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [minimum_level] DECIMAL(15,4) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'maximum_level'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [maximum_level] DECIMAL(15,4) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'inventory_uom_name'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [inventory_uom_name] NVARCHAR(50) NULL;
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
