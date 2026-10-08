BEGIN TRY

BEGIN TRAN;

-- AlterTable: warehouses
-- Which branch operates a warehouse. Nullable with no default: existing
-- warehouses genuinely have no branch recorded, and inventing one (the default
-- branch, say) would attribute stock to a branch nobody chose. They read as
-- blank until someone sets them on Company Setup > Warehouse Master.
--
-- Guarded so this is safe to apply to a database where the column was already
-- added by hand: an unguarded ADD would fail and block every later migration.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouses]') AND name = 'branch'
)
BEGIN
    ALTER TABLE [dbo].[warehouses] ADD [branch] NVARCHAR(150) NULL;
END;

-- CreateTable: product_warehouses
-- Per-product, per-warehouse stocking policy — the Min/Max inventory levels on
-- Product Master's Inventory tab. Levels only; every quantity and valuation on
-- that tab is derived from the stock journal at read time rather than cached
-- here, so it cannot drift from the movements that produced it.
IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[dbo].[product_warehouses]') AND type = N'U'
)
BEGIN
    CREATE TABLE [dbo].[product_warehouses] (
        [id]                  INT IDENTITY(1,1) NOT NULL,
        [product_code]        NVARCHAR(50)  NOT NULL,
        [warehouse_code]      NVARCHAR(50)  NOT NULL,
        [min_inventory_level] DECIMAL(15,2) NULL,
        [max_inventory_level] DECIMAL(15,2) NULL,
        [created_at]          DATETIME2     NOT NULL CONSTRAINT [DF_product_warehouses_created_at] DEFAULT CURRENT_TIMESTAMP,
        [updated_at]          DATETIME2     NOT NULL,
        CONSTRAINT [PK_product_warehouses] PRIMARY KEY CLUSTERED ([id])
    );
END;

-- One policy row per product per warehouse. This is what lets the save be an
-- upsert rather than a delete-and-reinsert, so re-saving a product never
-- momentarily drops its levels.
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UQ_product_warehouses_product_warehouse'
      AND object_id = OBJECT_ID(N'[dbo].[product_warehouses]')
)
BEGIN
    CREATE UNIQUE INDEX [UQ_product_warehouses_product_warehouse]
        ON [dbo].[product_warehouses] ([product_code], [warehouse_code]);
END;

-- The Inventory tab reads every row for one product at a time, so this is the
-- access path that actually matters.
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_product_warehouses_product'
      AND object_id = OBJECT_ID(N'[dbo].[product_warehouses]')
)
BEGIN
    CREATE INDEX [IX_product_warehouses_product]
        ON [dbo].[product_warehouses] ([product_code]);
END;

-- No foreign keys to products or warehouses, deliberately, matching how the
-- rest of this schema holds cross-master references (by code string, not FK).
-- A level row for a warehouse that is later renamed simply stops matching,
-- which is recoverable; a cascade would delete stocking policy as a side
-- effect of a master-data edit.

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
