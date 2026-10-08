BEGIN TRY

BEGIN TRAN;

-- CreateTable: business_partner_opening_balances
--
-- Company Setup > BP Opening Balance. One row per Business Partner line on
-- a saved "Add BP Opening" document — documentNumber/documentDate/
-- opening_balance_account/ref_1/ref_2/bp_type/remarks are the document
-- header, stamped onto every line saved together (same header-per-line
-- shape as opening_balance above it, but for a BP's starting AR/AP balance
-- instead of a product's starting stock).
IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[dbo].[business_partner_opening_balances]') AND type = N'U'
)
BEGIN
    CREATE TABLE [dbo].[business_partner_opening_balances] (
        [id]                      INT IDENTITY(1,1) NOT NULL,
        [document_number]         NVARCHAR(50)  NOT NULL,
        [document_date]           DATE NULL,
        [opening_balance_account] NVARCHAR(20)  NOT NULL,
        [ref_1]                   NVARCHAR(50)  NULL,
        [ref_2]                   NVARCHAR(50)  NULL,
        [bp_type]                 NVARCHAR(20)  NOT NULL,
        [remarks]                 NVARCHAR(MAX) NULL,
        [bp_code]                 NVARCHAR(50)  NOT NULL,
        [bp_name]                 NVARCHAR(150) NOT NULL,
        [opening_balance]         DECIMAL(15,2) NOT NULL CONSTRAINT [DF_bp_opening_balances_opening_balance] DEFAULT 0,
        [sales_person]            NVARCHAR(100) NULL,
        [branch]                  NVARCHAR(150) NULL,
        [invoice_no]              NVARCHAR(50)  NULL,
        [invoice_date]            DATE NULL,
        [due_date]                DATE NULL,
        [status]                  NVARCHAR(20)  NOT NULL CONSTRAINT [DF_bp_opening_balances_status] DEFAULT 'Posted',
        [created_at]              DATETIME2 NOT NULL CONSTRAINT [DF_bp_opening_balances_created_at] DEFAULT CURRENT_TIMESTAMP,
        [updated_at]              DATETIME2 NOT NULL,
        CONSTRAINT [PK_business_partner_opening_balances] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_bp_opening_balances_document_number'
      AND object_id = OBJECT_ID(N'[dbo].[business_partner_opening_balances]')
)
BEGIN
    CREATE INDEX [IX_bp_opening_balances_document_number]
        ON [dbo].[business_partner_opening_balances] ([document_number]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_bp_opening_balances_bp_code'
      AND object_id = OBJECT_ID(N'[dbo].[business_partner_opening_balances]')
)
BEGIN
    CREATE INDEX [IX_bp_opening_balances_bp_code]
        ON [dbo].[business_partner_opening_balances] ([bp_code]);
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
