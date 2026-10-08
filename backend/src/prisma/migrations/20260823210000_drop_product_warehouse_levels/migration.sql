BEGIN TRY

BEGIN TRAN;

-- DropTable: product_warehouses.
--
-- Backed the Min/Max Inventory Level columns on Product Master's Inventory
-- tab (per product+warehouse). Removed on request together with the table's
-- inputs on the form (see ProductInventoryTab.jsx), its save endpoint
-- (PUT /products/:productCode/inventory, removed from routes/resources.js),
-- and the merge step in utils/productInventory.js. The table's only two
-- meaningful columns were the levels themselves, so the whole table is
-- dropped rather than left behind with nothing to hold.
--
-- A first attempt at this migration checked sys.indexes for
-- UQ_product_warehouses_product_warehouse, found it, and issued
-- ALTER TABLE ... DROP CONSTRAINT — which SQL Server refused with "is not a
-- constraint" (3728). sys.indexes lists both plain indexes AND the indexes
-- that back real named constraints, so its presence there does not tell you
-- which kind it is; on this database the unique key ended up materialized as
-- a plain unique index rather than a constraint object, the same class of
-- catalog drift already seen on GLAccountDeterminations and
-- products.min_sales_price. This version checks sys.key_constraints
-- specifically (true constraint objects only) and only falls back to
-- ALTER TABLE ... DROP CONSTRAINT when the name is actually found there;
-- otherwise, if sys.indexes has it, it drops it as a plain index instead.
IF OBJECT_ID(N'[dbo].[product_warehouses]', 'U') IS NOT NULL
BEGIN
    IF EXISTS (
        SELECT 1 FROM sys.key_constraints
        WHERE parent_object_id = OBJECT_ID(N'[dbo].[product_warehouses]')
          AND name = 'UQ_product_warehouses_product_warehouse'
    )
    BEGIN
        ALTER TABLE [dbo].[product_warehouses] DROP CONSTRAINT [UQ_product_warehouses_product_warehouse];
    END
    ELSE IF EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'[dbo].[product_warehouses]')
          AND name = 'UQ_product_warehouses_product_warehouse'
    )
    BEGIN
        DROP INDEX [UQ_product_warehouses_product_warehouse] ON [dbo].[product_warehouses];
    END;

    IF EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'[dbo].[product_warehouses]')
          AND name = 'IX_product_warehouses_product'
    )
    BEGIN
        DROP INDEX [IX_product_warehouses_product] ON [dbo].[product_warehouses];
    END;

    DROP TABLE [dbo].[product_warehouses];
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
