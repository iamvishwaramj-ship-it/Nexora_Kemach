BEGIN TRY

BEGIN TRAN;

-- AlterTable: GlAccountDetermination — 9 additional G/L account roles, added
-- so every ChartOfAccounts role Product Group's Accounting tab needs (see
-- PRODUCT_GROUP_ACCOUNT_MAP in ProductGroup.jsx) has a source to default
-- from here, instead of 9 of the 29 having nothing to pull.
ALTER TABLE [dbo].[GLAccountDeterminations] ADD [RevenueAccountID] INT NULL;
ALTER TABLE [dbo].[GLAccountDeterminations] ADD [SalesCreditAccountID] INT NULL;
ALTER TABLE [dbo].[GLAccountDeterminations] ADD [PurchaseAccountID] INT NULL;
ALTER TABLE [dbo].[GLAccountDeterminations] ADD [PurchaseReturnAccountID] INT NULL;
ALTER TABLE [dbo].[GLAccountDeterminations] ADD [CostOfGoodsPurchasedAccountID] INT NULL;
ALTER TABLE [dbo].[GLAccountDeterminations] ADD [PurchaseBalanceAccountID] INT NULL;
ALTER TABLE [dbo].[GLAccountDeterminations] ADD [ExpenseClearingAccountID] INT NULL;
ALTER TABLE [dbo].[GLAccountDeterminations] ADD [InventoryOffsetPnlAccountID] INT NULL;
ALTER TABLE [dbo].[GLAccountDeterminations] ADD [ShippedGoodsAccountID] INT NULL;

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_RevenueAccount]
    FOREIGN KEY ([RevenueAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_SalesCreditAccount]
    FOREIGN KEY ([SalesCreditAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_PurchaseAccount]
    FOREIGN KEY ([PurchaseAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_PurchaseReturnAccount]
    FOREIGN KEY ([PurchaseReturnAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_CostOfGoodsPurchasedAccount]
    FOREIGN KEY ([CostOfGoodsPurchasedAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_PurchaseBalanceAccount]
    FOREIGN KEY ([PurchaseBalanceAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_ExpenseClearingAccount]
    FOREIGN KEY ([ExpenseClearingAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_InventoryOffsetPnlAccount]
    FOREIGN KEY ([InventoryOffsetPnlAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_ShippedGoodsAccount]
    FOREIGN KEY ([ShippedGoodsAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
