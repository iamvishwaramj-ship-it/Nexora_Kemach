BEGIN TRY

BEGIN TRAN;

-- AlterTable: warehouse (WarehouseMaster)
--
-- Warehouse Master now has two tabs. General adds the Street No /
-- Building-Floor-Room address breakdown (Block, Country, State, City,
-- Zipcode already existed on this table but were never exposed on the form
-- until now, so they need no new column). Accounting adds one column per
-- G/L account determination role, each storing a ChartOfAccount.accountCode
-- (not an FK id) -- the same cross-master-by-code convention this schema
-- uses everywhere else, so a renamed/renumbered account never silently
-- orphans a warehouse's determination.
--
-- All nullable, no defaults: an existing warehouse has none of this set, and
-- guessing a G/L account would silently misroute postings for a choice
-- nobody made. They read as blank until set on Company Setup > Warehouse
-- Master > Accounting.
--
-- Guarded so this is safe to apply to a database where a column already
-- exists (matches the pattern used by the other AlterTable migrations here).

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'street_no'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [street_no] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'building_floor_room'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [building_floor_room] NVARCHAR(150) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'expense_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [expense_account] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'revenue_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [revenue_account] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'inventory_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [inventory_account] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'cost_of_goods_sold_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [cost_of_goods_sold_account] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'allocation_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [allocation_account] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'variance_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [variance_account] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'price_difference_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [price_difference_account] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'negative_inventory_adjustment_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [negative_inventory_adjustment_account] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'inventory_offset_decrease_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [inventory_offset_decrease_account] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'inventory_offset_increase_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [inventory_offset_increase_account] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'sales_returns_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [sales_returns_account] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'purchase_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [purchase_account] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'purchase_return_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [purchase_return_account] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'cost_of_goods_purchased_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [cost_of_goods_purchased_account] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'exchange_rate_differences_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [exchange_rate_differences_account] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'goods_clearing_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [goods_clearing_account] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'gl_decrease_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [gl_decrease_account] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'gl_increase_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [gl_increase_account] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'wip_inventory_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [wip_inventory_account] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'wip_inventory_variance_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [wip_inventory_variance_account] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'wip_offset_pnl_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [wip_offset_pnl_account] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'inventory_offset_pnl_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [inventory_offset_pnl_account] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'expense_clearing_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [expense_clearing_account] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'shipped_goods_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [shipped_goods_account] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'sales_credit_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [sales_credit_account] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'purchase_credit_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [purchase_credit_account] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'purchase_balance_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [purchase_balance_account] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'incoming_cenvat_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [incoming_cenvat_account] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[warehouse]') AND name = 'outgoing_cenvat_account'
)
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [outgoing_cenvat_account] NVARCHAR(20) NULL;
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
