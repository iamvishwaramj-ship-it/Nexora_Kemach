BEGIN TRY

BEGIN TRAN;

-- CreateTable: GlAccountDetermination
-- Accounting > G/L Account Determination (Sales > General tab). One row per
-- Financial Year — see model GlAccountDetermination in schema.prisma.
CREATE TABLE [dbo].[GLAccountDeterminations]
(
    [GLDeterminationID]              INT IDENTITY(1,1) NOT NULL,
    [FinancialYearID]                INT NOT NULL,

    [AccountsReceivableID]           INT NULL,
    [PermitChangeOfControlAccounts]  BIT NOT NULL CONSTRAINT [DF_GLAccountDeterminations_PermitChangeOfControlAccounts] DEFAULT 0,
    [DefaultCustomerID]              INT NULL,
    [DomesticAccountsReceivableID]   INT NULL,
    [ForeignAccountsReceivableID]    INT NULL,
    [ChecksReceivedID]               INT NULL,
    [CashOnHandID]                   INT NULL,
    [OverpaymentARID]                INT NULL,
    [UnderpaymentARID]               INT NULL,
    [DownPaymentClearingID]          INT NULL,
    [RealizedExchangeDiffGainID]     INT NULL,
    [RealizedExchangeDiffLossID]     INT NULL,
    [RealizedConversionDiffGainID]   INT NULL,
    [RealizedConversionDiffLossID]   INT NULL,

    -- Purchasing
    [DomesticAccountsPayableID]         INT NULL,
    [ForeignAccountsPayableID]          INT NULL,
    [PurchRealizedExchangeDiffGainID]   INT NULL,
    [PurchRealizedExchangeDiffLossID]   INT NULL,
    [PurchRealizedConversionDiffGainID] INT NULL,
    [PurchRealizedConversionDiffLossID] INT NULL,
    [BankTransferID]                    INT NULL,
    [CashDiscountID]                    INT NULL,
    [CashDiscountClearingID]            INT NULL,
    [ExpenseAccountID]                  INT NULL,
    [PurchaseCreditAccountID]           INT NULL,
    [OverpaymentAPID]                   INT NULL,

    -- General
    [CreditCardDepositFeeID]            INT NULL,
    [RoundingAccountID]                 INT NULL,
    [AutomaticReconciliationDiffID]     INT NULL,
    [PeriodEndClosingAccountID]         INT NULL,
    [GenRealizedExchangeDiffGainID]     INT NULL,
    [GenRealizedExchangeDiffLossID]     INT NULL,
    [GenRealizedConversionDiffGainID]   INT NULL,
    [GenRealizedConversionDiffLossID]   INT NULL,
    [OpeningBalanceAccountID]           INT NULL,
    [BankChargesAccountID]              INT NULL,
    [IncomingCenvatClearingActID]       INT NULL,
    [OutgoingCenvatClearingActID]       INT NULL,
    [PLAID]                             INT NULL,
    [TdsInterestActID]                  INT NULL,
    [TdsOtherChargesActID]              INT NULL,
    [TdsFeeActID]                       INT NULL,
    [GstInterestAccountID]              INT NULL,

    -- Inventory
    [InventoryAccountID]                INT NULL,
    [CostOfGoodsSoldAccountID]          INT NULL,
    [AllocationAccountID]               INT NULL,
    [VarianceAccountID]                 INT NULL,
    [PriceDifferenceAccountID]          INT NULL,
    [NegativeInventoryAdjAcctID]        INT NULL,
    [InventoryOffsetDecrAcctID]         INT NULL,
    [InventoryOffsetIncrAcctID]         INT NULL,
    [SalesReturnsAccountID]             INT NULL,
    [ExchangeRateDifferencesAccountID]  INT NULL,
    [GoodsClearingAccountID]            INT NULL,
    [GLDecreaseAccountID]               INT NULL,
    [GLIncreaseAccountID]               INT NULL,
    [WipInventoryAccountID]             INT NULL,
    [WipInventoryVarianceAccountID]     INT NULL,
    [WipOffsetPLAccountID]              INT NULL,

    [Status]                         CHAR(1) NOT NULL CONSTRAINT [DF_GLAccountDeterminations_Status] DEFAULT 'A',
    [CreatedBy]                      INT NULL,
    [CreatedDate]                    DATETIME NOT NULL CONSTRAINT [DF_GLAccountDeterminations_CreatedDate] DEFAULT GETDATE(),
    [ModifiedBy]                     INT NULL,
    [ModifiedDate]                   DATETIME NULL,

    CONSTRAINT [GLAccountDeterminations_pkey] PRIMARY KEY CLUSTERED ([GLDeterminationID]),

    CONSTRAINT [UQ_GLAccountDeterminations_FinancialYear]
        UNIQUE ([FinancialYearID]),

    CONSTRAINT [CK_GLAccountDeterminations_Status]
        CHECK ([Status] IN ('A','I'))
);

-- AddForeignKey
ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_FinancialYear]
    FOREIGN KEY ([FinancialYearID]) REFERENCES [dbo].[financial_years]([id]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_AccountsReceivable]
    FOREIGN KEY ([AccountsReceivableID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_DomesticAR]
    FOREIGN KEY ([DomesticAccountsReceivableID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_ForeignAR]
    FOREIGN KEY ([ForeignAccountsReceivableID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_ChecksReceived]
    FOREIGN KEY ([ChecksReceivedID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_CashOnHand]
    FOREIGN KEY ([CashOnHandID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_OverpaymentAR]
    FOREIGN KEY ([OverpaymentARID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_UnderpaymentAR]
    FOREIGN KEY ([UnderpaymentARID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_DownPaymentClearing]
    FOREIGN KEY ([DownPaymentClearingID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_ExchDiffGain]
    FOREIGN KEY ([RealizedExchangeDiffGainID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_ExchDiffLoss]
    FOREIGN KEY ([RealizedExchangeDiffLossID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_ConvDiffGain]
    FOREIGN KEY ([RealizedConversionDiffGainID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_ConvDiffLoss]
    FOREIGN KEY ([RealizedConversionDiffLossID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_DomesticAP]
    FOREIGN KEY ([DomesticAccountsPayableID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_ForeignAP]
    FOREIGN KEY ([ForeignAccountsPayableID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_PurchExchDiffGain]
    FOREIGN KEY ([PurchRealizedExchangeDiffGainID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_PurchExchDiffLoss]
    FOREIGN KEY ([PurchRealizedExchangeDiffLossID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_PurchConvDiffGain]
    FOREIGN KEY ([PurchRealizedConversionDiffGainID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_PurchConvDiffLoss]
    FOREIGN KEY ([PurchRealizedConversionDiffLossID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_BankTransfer]
    FOREIGN KEY ([BankTransferID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_CashDiscount]
    FOREIGN KEY ([CashDiscountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_CashDiscountClearing]
    FOREIGN KEY ([CashDiscountClearingID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_ExpenseAccount]
    FOREIGN KEY ([ExpenseAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_PurchaseCreditAccount]
    FOREIGN KEY ([PurchaseCreditAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_OverpaymentAP]
    FOREIGN KEY ([OverpaymentAPID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_CreditCardDepositFee]
    FOREIGN KEY ([CreditCardDepositFeeID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_RoundingAccount]
    FOREIGN KEY ([RoundingAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_AutoReconciliationDiff]
    FOREIGN KEY ([AutomaticReconciliationDiffID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_PeriodEndClosingAccount]
    FOREIGN KEY ([PeriodEndClosingAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_GenExchDiffGain]
    FOREIGN KEY ([GenRealizedExchangeDiffGainID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_GenExchDiffLoss]
    FOREIGN KEY ([GenRealizedExchangeDiffLossID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_GenConvDiffGain]
    FOREIGN KEY ([GenRealizedConversionDiffGainID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_GenConvDiffLoss]
    FOREIGN KEY ([GenRealizedConversionDiffLossID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_OpeningBalanceAccount]
    FOREIGN KEY ([OpeningBalanceAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_BankChargesAccount]
    FOREIGN KEY ([BankChargesAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_IncomingCenvatClearing]
    FOREIGN KEY ([IncomingCenvatClearingActID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_OutgoingCenvatClearing]
    FOREIGN KEY ([OutgoingCenvatClearingActID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_PLA]
    FOREIGN KEY ([PLAID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_TdsInterestAct]
    FOREIGN KEY ([TdsInterestActID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_TdsOtherChargesAct]
    FOREIGN KEY ([TdsOtherChargesActID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_TdsFeeAct]
    FOREIGN KEY ([TdsFeeActID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_GstInterestAccount]
    FOREIGN KEY ([GstInterestAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_InventoryAccount]
    FOREIGN KEY ([InventoryAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_COGSAccount]
    FOREIGN KEY ([CostOfGoodsSoldAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_AllocationAccount]
    FOREIGN KEY ([AllocationAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_VarianceAccount]
    FOREIGN KEY ([VarianceAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_PriceDifferenceAccount]
    FOREIGN KEY ([PriceDifferenceAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_NegativeInventoryAdj]
    FOREIGN KEY ([NegativeInventoryAdjAcctID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_InventoryOffsetDecr]
    FOREIGN KEY ([InventoryOffsetDecrAcctID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_InventoryOffsetIncr]
    FOREIGN KEY ([InventoryOffsetIncrAcctID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_SalesReturnsAccount]
    FOREIGN KEY ([SalesReturnsAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_ExchRateDifferences]
    FOREIGN KEY ([ExchangeRateDifferencesAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_GoodsClearingAccount]
    FOREIGN KEY ([GoodsClearingAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_GLDecreaseAccount]
    FOREIGN KEY ([GLDecreaseAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_GLIncreaseAccount]
    FOREIGN KEY ([GLIncreaseAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_WipInventoryAccount]
    FOREIGN KEY ([WipInventoryAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_WipInventoryVariance]
    FOREIGN KEY ([WipInventoryVarianceAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_WipOffsetPLAccount]
    FOREIGN KEY ([WipOffsetPLAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);


ALTER TABLE [dbo].[GLAccountDeterminations] ADD CONSTRAINT [FK_GLAccountDeterminations_DefaultCustomer]
    FOREIGN KEY ([DefaultCustomerID]) REFERENCES [dbo].[customers]([id]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
