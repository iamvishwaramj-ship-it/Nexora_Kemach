BEGIN TRY

BEGIN TRAN;

-- Repair: GLAccountDeterminations column drift.
--
-- The table was physically created from an earlier revision of
-- 20260821180000_add_gl_account_determination, before the Purchasing /
-- General / Inventory account roles were part of it. Prisma's
-- _prisma_migrations table records that migration as applied, so
-- `migrate deploy` had nothing left to run while the live table was still
-- missing ~45 columns -- which is why posting a Purchase Invoice failed with
-- P2022 "The column `DomesticAccountsPayableID` does not exist" from
-- resolveDeterminationAccount() in utils/glPosting.js.
--
-- Every statement below is guarded, so this is safe to run against a database
-- that already has some or all of these columns (e.g. a fresh install that
-- got the full CREATE TABLE), and safe to re-run.

-- Sales flag / default customer -------------------------------------------
IF COL_LENGTH('dbo.GLAccountDeterminations', 'PermitChangeOfControlAccounts') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [PermitChangeOfControlAccounts] BIT NOT NULL
        CONSTRAINT [DF_GLAccountDeterminations_PermitChangeOfControlAccounts] DEFAULT 0;

IF COL_LENGTH('dbo.GLAccountDeterminations', 'DefaultCustomerID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [DefaultCustomerID] INT NULL;

-- G/L account role columns -------------------------------------------------
IF COL_LENGTH('dbo.GLAccountDeterminations', 'AccountsReceivableID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [AccountsReceivableID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'DomesticAccountsReceivableID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [DomesticAccountsReceivableID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'ForeignAccountsReceivableID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [ForeignAccountsReceivableID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'ChecksReceivedID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [ChecksReceivedID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'CashOnHandID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [CashOnHandID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'OverpaymentARID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [OverpaymentARID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'UnderpaymentARID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [UnderpaymentARID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'DownPaymentClearingID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [DownPaymentClearingID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'RealizedExchangeDiffGainID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [RealizedExchangeDiffGainID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'RealizedExchangeDiffLossID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [RealizedExchangeDiffLossID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'RealizedConversionDiffGainID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [RealizedConversionDiffGainID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'RealizedConversionDiffLossID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [RealizedConversionDiffLossID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'RevenueAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [RevenueAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'SalesCreditAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [SalesCreditAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'DomesticAccountsPayableID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [DomesticAccountsPayableID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'ForeignAccountsPayableID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [ForeignAccountsPayableID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'PurchRealizedExchangeDiffGainID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [PurchRealizedExchangeDiffGainID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'PurchRealizedExchangeDiffLossID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [PurchRealizedExchangeDiffLossID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'PurchRealizedConversionDiffGainID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [PurchRealizedConversionDiffGainID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'PurchRealizedConversionDiffLossID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [PurchRealizedConversionDiffLossID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'BankTransferID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [BankTransferID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'CashDiscountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [CashDiscountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'CashDiscountClearingID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [CashDiscountClearingID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'ExpenseAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [ExpenseAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'PurchaseCreditAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [PurchaseCreditAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'OverpaymentAPID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [OverpaymentAPID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'PurchaseAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [PurchaseAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'PurchaseReturnAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [PurchaseReturnAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'CostOfGoodsPurchasedAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [CostOfGoodsPurchasedAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'PurchaseBalanceAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [PurchaseBalanceAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'CreditCardDepositFeeID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [CreditCardDepositFeeID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'RoundingAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [RoundingAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'AutomaticReconciliationDiffID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [AutomaticReconciliationDiffID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'PeriodEndClosingAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [PeriodEndClosingAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'GenRealizedExchangeDiffGainID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [GenRealizedExchangeDiffGainID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'GenRealizedExchangeDiffLossID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [GenRealizedExchangeDiffLossID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'GenRealizedConversionDiffGainID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [GenRealizedConversionDiffGainID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'GenRealizedConversionDiffLossID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [GenRealizedConversionDiffLossID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'OpeningBalanceAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [OpeningBalanceAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'BankChargesAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [BankChargesAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'IncomingCenvatClearingActID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [IncomingCenvatClearingActID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'OutgoingCenvatClearingActID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [OutgoingCenvatClearingActID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'PLAID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [PLAID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'TdsInterestActID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [TdsInterestActID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'TdsOtherChargesActID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [TdsOtherChargesActID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'TdsFeeActID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [TdsFeeActID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'GstInterestAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [GstInterestAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'OutputCgstPayableID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [OutputCgstPayableID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'OutputSgstPayableID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [OutputSgstPayableID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'OutputIgstPayableID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [OutputIgstPayableID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'InputCgstReceivableID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [InputCgstReceivableID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'InputSgstReceivableID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [InputSgstReceivableID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'InputIgstReceivableID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [InputIgstReceivableID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'ExpenseClearingAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [ExpenseClearingAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'InventoryAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [InventoryAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'CostOfGoodsSoldAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [CostOfGoodsSoldAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'AllocationAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [AllocationAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'VarianceAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [VarianceAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'PriceDifferenceAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [PriceDifferenceAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'NegativeInventoryAdjAcctID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [NegativeInventoryAdjAcctID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'InventoryOffsetDecrAcctID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [InventoryOffsetDecrAcctID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'InventoryOffsetIncrAcctID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [InventoryOffsetIncrAcctID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'SalesReturnsAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [SalesReturnsAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'ExchangeRateDifferencesAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [ExchangeRateDifferencesAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'GoodsClearingAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [GoodsClearingAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'GLDecreaseAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [GLDecreaseAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'GLIncreaseAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [GLIncreaseAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'WipInventoryAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [WipInventoryAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'WipInventoryVarianceAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [WipInventoryVarianceAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'WipOffsetPLAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [WipOffsetPLAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'InventoryOffsetPnlAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [InventoryOffsetPnlAccountID] INT NULL;
IF COL_LENGTH('dbo.GLAccountDeterminations', 'ShippedGoodsAccountID') IS NULL
    ALTER TABLE [dbo].[GLAccountDeterminations] ADD [ShippedGoodsAccountID] INT NULL;

-- Foreign keys -------------------------------------------------------------
-- Added through dynamic SQL: a column created earlier in this same batch is
-- not yet resolvable by a statically compiled ALTER TABLE ... ADD CONSTRAINT.
-- Each is skipped when the column already carries any FK, so the differently
-- named constraints created by 20260821180000 on an existing database are
-- left untouched rather than duplicated.
DECLARE @col SYSNAME, @ref NVARCHAR(200), @sql NVARCHAR(MAX);

DECLARE fk_cursor CURSOR LOCAL FAST_FORWARD FOR
SELECT c.col, c.ref FROM (VALUES
    ('DefaultCustomerID', '[dbo].[customers]([id])'),
    ('AccountsReceivableID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('DomesticAccountsReceivableID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('ForeignAccountsReceivableID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('ChecksReceivedID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('CashOnHandID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('OverpaymentARID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('UnderpaymentARID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('DownPaymentClearingID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('RealizedExchangeDiffGainID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('RealizedExchangeDiffLossID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('RealizedConversionDiffGainID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('RealizedConversionDiffLossID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('RevenueAccountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('SalesCreditAccountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('DomesticAccountsPayableID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('ForeignAccountsPayableID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('PurchRealizedExchangeDiffGainID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('PurchRealizedExchangeDiffLossID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('PurchRealizedConversionDiffGainID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('PurchRealizedConversionDiffLossID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('BankTransferID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('CashDiscountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('CashDiscountClearingID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('ExpenseAccountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('PurchaseCreditAccountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('OverpaymentAPID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('PurchaseAccountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('PurchaseReturnAccountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('CostOfGoodsPurchasedAccountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('PurchaseBalanceAccountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('CreditCardDepositFeeID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('RoundingAccountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('AutomaticReconciliationDiffID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('PeriodEndClosingAccountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('GenRealizedExchangeDiffGainID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('GenRealizedExchangeDiffLossID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('GenRealizedConversionDiffGainID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('GenRealizedConversionDiffLossID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('OpeningBalanceAccountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('BankChargesAccountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('IncomingCenvatClearingActID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('OutgoingCenvatClearingActID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('PLAID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('TdsInterestActID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('TdsOtherChargesActID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('TdsFeeActID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('GstInterestAccountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('OutputCgstPayableID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('OutputSgstPayableID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('OutputIgstPayableID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('InputCgstReceivableID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('InputSgstReceivableID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('InputIgstReceivableID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('ExpenseClearingAccountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('InventoryAccountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('CostOfGoodsSoldAccountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('AllocationAccountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('VarianceAccountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('PriceDifferenceAccountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('NegativeInventoryAdjAcctID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('InventoryOffsetDecrAcctID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('InventoryOffsetIncrAcctID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('SalesReturnsAccountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('ExchangeRateDifferencesAccountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('GoodsClearingAccountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('GLDecreaseAccountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('GLIncreaseAccountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('WipInventoryAccountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('WipInventoryVarianceAccountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('WipOffsetPLAccountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('InventoryOffsetPnlAccountID', '[dbo].[ChartOfAccounts]([AccountID])'),
    ('ShippedGoodsAccountID', '[dbo].[ChartOfAccounts]([AccountID])')
) AS c(col, ref);

OPEN fk_cursor;
FETCH NEXT FROM fk_cursor INTO @col, @ref;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF COL_LENGTH('dbo.GLAccountDeterminations', @col) IS NOT NULL
       AND NOT EXISTS (
            SELECT 1
            FROM sys.foreign_key_columns fkc
            JOIN sys.columns sc
              ON sc.object_id = fkc.parent_object_id
             AND sc.column_id = fkc.parent_column_id
            WHERE fkc.parent_object_id = OBJECT_ID('dbo.GLAccountDeterminations')
              AND sc.name = @col
       )
    BEGIN
        SET @sql = 'ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT '
                 + QUOTENAME('FK_GLAccountDeterminations_' + @col)
                 + ' FOREIGN KEY (' + QUOTENAME(@col) + ') REFERENCES ' + @ref + ';';
        EXEC sp_executesql @sql;
    END
    FETCH NEXT FROM fk_cursor INTO @col, @ref;
END
CLOSE fk_cursor;
DEALLOCATE fk_cursor;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
