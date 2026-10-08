BEGIN TRY

BEGIN TRAN;

-- AlterTable: products — sales_item / purchase_item / inventory_item
--
-- Which flows a product may be used in, mirroring SAP B1's three item
-- checkboxes on the Item Master. They drive what each document's product
-- picker offers: a purchase document lists only products flagged
-- purchase_item, a sales document only sales_item, and the four stock
-- documents (Receipt, Issue, Adjustment, Transfer) only inventory_item.
--
-- The three are INDEPENDENT, not exclusive. An ordinary traded good is
-- bought and sold and stocked, so it carries all three; a raw material is
-- purchase + inventory and never appears in a sales document; a service or
-- labour charge is sales only and never moves stock. Making them exclusive
-- would make the ordinary buy-then-sell product impossible to express, which
-- is the case most of this system's Purchase > Inventory > Sales flow exists
-- to handle.
--
-- NOT NULL with DEFAULT 1, which is also what backfills the rows already in
-- the table. Every existing product predates the idea of the flags, and the
-- application has until now offered all of them in every picker — so
-- all-three-true is the value that states what has actually been true of
-- them, and means nothing silently disappears from a picker the day this
-- ships. Narrowing a product to only the flows it really belongs in is then
-- a deliberate edit, product by product, rather than a mass blanking nobody
-- asked for.
--
-- At least one of the three must be set. That rule is enforced in the
-- application (productSchema on the client, and the products route on the
-- server) rather than as a CHECK constraint here, so it fails as an ordinary
-- readable validation message on the field instead of a driver-level error.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'sales_item'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [sales_item] BIT NOT NULL CONSTRAINT [DF_products_sales_item] DEFAULT 1;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'purchase_item'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [purchase_item] BIT NOT NULL CONSTRAINT [DF_products_purchase_item] DEFAULT 1;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'inventory_item'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [inventory_item] BIT NOT NULL CONSTRAINT [DF_products_inventory_item] DEFAULT 1;
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
