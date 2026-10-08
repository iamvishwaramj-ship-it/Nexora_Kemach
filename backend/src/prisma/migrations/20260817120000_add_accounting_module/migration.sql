BEGIN TRY

BEGIN TRAN;

-- CreateTable: AccountGroup
-- Matches the org-specified DDL exactly (table/column names, types,
-- constraint names) — see model AccountGroup in schema.prisma.
CREATE TABLE [dbo].[AccountGroups]
(
    [GroupID]             INT IDENTITY(1,1) NOT NULL,
    [GroupCode]           VARCHAR(20) NOT NULL,
    [GroupName]           VARCHAR(100) NOT NULL,
    [ParentGroupID]       INT NULL,
    [GroupType]           VARCHAR(30) NOT NULL,
    [GroupLevel]          INT NOT NULL CONSTRAINT [DF_AccountGroups_GroupLevel] DEFAULT 1,
    [IsPostingAllowed]    BIT NOT NULL CONSTRAINT [DF_AccountGroups_IsPostingAllowed] DEFAULT 0,
    [Status]              CHAR(1) NOT NULL CONSTRAINT [DF_AccountGroups_Status] DEFAULT 'A',
    [Remarks]             VARCHAR(255) NULL,

    [CreatedBy]           INT NULL,
    [CreatedDate]         DATETIME NOT NULL CONSTRAINT [DF_AccountGroups_CreatedDate] DEFAULT GETDATE(),
    [ModifiedBy]          INT NULL,
    [ModifiedDate]        DATETIME NULL,

    CONSTRAINT [AccountGroups_pkey] PRIMARY KEY CLUSTERED ([GroupID]),

    CONSTRAINT [UQ_AccountGroups_GroupCode]
        UNIQUE ([GroupCode]),

    CONSTRAINT [CK_AccountGroups_Status]
        CHECK ([Status] IN ('A','I'))
);

-- CreateTable: ChartOfAccount
-- Same shape as AccountGroups (per the org's AccountTree recursive-query
-- fields), plus GroupID linking each account to its AccountGroup — see model
-- ChartOfAccount in schema.prisma.
CREATE TABLE [dbo].[ChartOfAccounts]
(
    [AccountID]           INT IDENTITY(1,1) NOT NULL,
    [AccountCode]         VARCHAR(20) NOT NULL,
    [AccountName]         VARCHAR(100) NOT NULL,
    [ParentAccountID]     INT NULL,
    [GroupID]             INT NULL,
    [AccountType]         VARCHAR(30) NOT NULL,
    [AccountLevel]        INT NOT NULL CONSTRAINT [DF_ChartOfAccounts_AccountLevel] DEFAULT 1,
    [IsPostingAllowed]    BIT NOT NULL CONSTRAINT [DF_ChartOfAccounts_IsPostingAllowed] DEFAULT 0,
    [Status]              CHAR(1) NOT NULL CONSTRAINT [DF_ChartOfAccounts_Status] DEFAULT 'A',
    [Remarks]             VARCHAR(255) NULL,

    [CreatedBy]           INT NULL,
    [CreatedDate]         DATETIME NOT NULL CONSTRAINT [DF_ChartOfAccounts_CreatedDate] DEFAULT GETDATE(),
    [ModifiedBy]          INT NULL,
    [ModifiedDate]        DATETIME NULL,

    CONSTRAINT [ChartOfAccounts_pkey] PRIMARY KEY CLUSTERED ([AccountID]),

    CONSTRAINT [UQ_ChartOfAccounts_AccountCode]
        UNIQUE ([AccountCode]),

    CONSTRAINT [CK_ChartOfAccounts_Status]
        CHECK ([Status] IN ('A','I'))
);

-- AddForeignKey
-- Self-referencing FKs have no ON DELETE clause (SQL Server default: NO
-- ACTION) — matching the org's DDL and required anyway, since SQL Server
-- rejects CASCADE on a self-relation.
ALTER TABLE [dbo].[AccountGroups] ADD CONSTRAINT [FK_AccountGroups_Parent]
    FOREIGN KEY ([ParentGroupID]) REFERENCES [dbo].[AccountGroups]([GroupID]);

ALTER TABLE [dbo].[ChartOfAccounts] ADD CONSTRAINT [FK_ChartOfAccounts_Parent]
    FOREIGN KEY ([ParentAccountID]) REFERENCES [dbo].[ChartOfAccounts]([AccountID]);

ALTER TABLE [dbo].[ChartOfAccounts] ADD CONSTRAINT [FK_ChartOfAccounts_Group]
    FOREIGN KEY ([GroupID]) REFERENCES [dbo].[AccountGroups]([GroupID]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
