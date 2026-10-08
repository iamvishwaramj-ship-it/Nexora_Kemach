BEGIN TRY

BEGIN TRAN;

-- CreateTable: AccountType
-- A lookup master for ChartOfAccounts.AccountTypeID (Current Assets,
-- Non-Current Assets, Current Liabilities, Long Term Liabilities, Equity,
-- Income, Direct Costs, Indirect Costs, Expenses) — see model AccountType.
CREATE TABLE [dbo].[AccountTypes]
(
    [AccountTypeID]       INT IDENTITY(1,1) NOT NULL,
    [TypeCode]            VARCHAR(20) NOT NULL,
    [TypeName]            VARCHAR(50) NOT NULL,
    [NormalBalance]       CHAR(1) NOT NULL CONSTRAINT [DF_AccountTypes_NormalBalance] DEFAULT 'D',
    [Status]              CHAR(1) NOT NULL CONSTRAINT [DF_AccountTypes_Status] DEFAULT 'A',

    [CreatedBy]           INT NULL,
    [CreatedDate]         DATETIME NOT NULL CONSTRAINT [DF_AccountTypes_CreatedDate] DEFAULT GETDATE(),
    [ModifiedBy]          INT NULL,
    [ModifiedDate]        DATETIME NULL,

    CONSTRAINT [AccountTypes_pkey] PRIMARY KEY CLUSTERED ([AccountTypeID]),
    CONSTRAINT [UQ_AccountTypes_TypeCode] UNIQUE ([TypeCode]),
    CONSTRAINT [CK_AccountTypes_NormalBalance] CHECK ([NormalBalance] IN ('D','C')),
    CONSTRAINT [CK_AccountTypes_Status] CHECK ([Status] IN ('A','I'))
);

-- AlterTable: ChartOfAccounts
-- Replaces the free-text AccountType column with an AccountTypeID FK to the
-- new AccountTypes master, drops IsPostingAllowed (replaced by
-- AllowManualEntry / IsControlAccount / CostCenterRequired below), and adds
-- Currency, OpeningBalance, BalanceType.
ALTER TABLE [dbo].[ChartOfAccounts] DROP CONSTRAINT [DF_ChartOfAccounts_IsPostingAllowed];
ALTER TABLE [dbo].[ChartOfAccounts] DROP COLUMN [IsPostingAllowed];
ALTER TABLE [dbo].[ChartOfAccounts] DROP COLUMN [AccountType];

ALTER TABLE [dbo].[ChartOfAccounts] ADD [AccountTypeID] INT NULL;
ALTER TABLE [dbo].[ChartOfAccounts] ADD [Currency] VARCHAR(10) NOT NULL CONSTRAINT [DF_ChartOfAccounts_Currency] DEFAULT 'INR';
ALTER TABLE [dbo].[ChartOfAccounts] ADD [OpeningBalance] DECIMAL(18,2) NULL;
ALTER TABLE [dbo].[ChartOfAccounts] ADD [BalanceType] CHAR(1) NOT NULL CONSTRAINT [DF_ChartOfAccounts_BalanceType] DEFAULT 'D';
ALTER TABLE [dbo].[ChartOfAccounts] ADD [IsControlAccount] BIT NOT NULL CONSTRAINT [DF_ChartOfAccounts_IsControlAccount] DEFAULT 0;
ALTER TABLE [dbo].[ChartOfAccounts] ADD [AllowManualEntry] BIT NOT NULL CONSTRAINT [DF_ChartOfAccounts_AllowManualEntry] DEFAULT 1;
ALTER TABLE [dbo].[ChartOfAccounts] ADD [CostCenterRequired] BIT NOT NULL CONSTRAINT [DF_ChartOfAccounts_CostCenterRequired] DEFAULT 0;

-- The two statements below reference [BalanceType] / [AccountTypeID], which
-- are added by the ALTER TABLE ... ADD statements immediately above. SQL
-- Server parses and binds an entire batch before executing any of it, so a
-- direct reference to a column added earlier in the same batch fails to
-- compile with "Invalid column name" even though the column will exist by
-- the time the statement runs. Prisma sends each migration file as a single
-- batch (it has no GO-batch support), so EXEC() is the standard workaround:
-- the inner statement is compiled only when EXEC runs, by which point the
-- columns are really there.
EXEC('ALTER TABLE [dbo].[ChartOfAccounts] ADD CONSTRAINT [CK_ChartOfAccounts_BalanceType] CHECK ([BalanceType] IN (''D'',''C''))');

-- AddForeignKey
EXEC('ALTER TABLE [dbo].[ChartOfAccounts] ADD CONSTRAINT [FK_ChartOfAccounts_AccountType] FOREIGN KEY ([AccountTypeID]) REFERENCES [dbo].[AccountTypes]([AccountTypeID])');

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
