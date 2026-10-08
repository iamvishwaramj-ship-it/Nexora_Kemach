BEGIN TRY

BEGIN TRAN;

-- AlterTable: ProductGroup — default Unit of Measure, plus an Accounting
-- tab matching WarehouseMaster's own set of G/L account determination
-- columns (see model ProductGroup in schema.prisma).
ALTER TABLE [dbo].[product_groups] ADD [uom] NVARCHAR(150) NULL;

ALTER TABLE [dbo].[product_groups] ADD [expense_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[product_groups] ADD [revenue_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[product_groups] ADD [inventory_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[product_groups] ADD [cost_of_goods_sold_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[product_groups] ADD [allocation_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[product_groups] ADD [variance_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[product_groups] ADD [price_difference_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[product_groups] ADD [negative_inventory_adjustment_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[product_groups] ADD [inventory_offset_decrease_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[product_groups] ADD [inventory_offset_increase_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[product_groups] ADD [sales_returns_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[product_groups] ADD [purchase_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[product_groups] ADD [purchase_return_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[product_groups] ADD [cost_of_goods_purchased_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[product_groups] ADD [exchange_rate_differences_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[product_groups] ADD [goods_clearing_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[product_groups] ADD [gl_decrease_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[product_groups] ADD [gl_increase_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[product_groups] ADD [wip_inventory_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[product_groups] ADD [wip_inventory_variance_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[product_groups] ADD [wip_offset_pnl_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[product_groups] ADD [inventory_offset_pnl_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[product_groups] ADD [expense_clearing_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[product_groups] ADD [shipped_goods_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[product_groups] ADD [sales_credit_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[product_groups] ADD [purchase_credit_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[product_groups] ADD [purchase_balance_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[product_groups] ADD [incoming_cenvat_account] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[product_groups] ADD [outgoing_cenvat_account] NVARCHAR(20) NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
