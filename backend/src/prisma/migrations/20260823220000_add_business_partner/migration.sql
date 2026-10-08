BEGIN TRY

BEGIN TRAN;

-- CreateTable: business_partners
--
-- Partner Management > Business Partner -- a unified partner master
-- (Customer / Supplier / Both / Lead) alongside the existing customers/
-- suppliers/transporters tables, with its own Contact Person and Address
-- child grids (one header row plus N business_partner_contacts and N
-- business_partner_addresses). partner_code is drawn from the BP numbering
-- series (see DOCUMENT_CATALOG in services/documentNumberService.js) the
-- same way customer_code/supplier_code are.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'business_partners' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[business_partners] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [partner_code] NVARCHAR(50) NOT NULL,
        [partner_name] NVARCHAR(150) NOT NULL,
        [foreign_name] NVARCHAR(150) NULL,
        [group_name] NVARCHAR(50) NULL,
        [currency] NVARCHAR(20) NOT NULL CONSTRAINT [DF_business_partners_currency] DEFAULT N'All',
        [account_balance] DECIMAL(15, 2) NULL,
        [federal_tax_id] NVARCHAR(30) NULL,
        [partner_type] NVARCHAR(30) NOT NULL,
        [telephone] NVARCHAR(20) NULL,
        [mobile] NVARCHAR(20) NULL,
        [fax] NVARCHAR(20) NULL,
        [email] NVARCHAR(100) NULL,
        [website] NVARCHAR(150) NULL,
        [shipping_type] NVARCHAR(50) NULL,
        [industry] NVARCHAR(50) NULL,
        [business_partner_type] NVARCHAR(50) NULL,
        [contact_person] NVARCHAR(150) NULL,
        [sales_person] NVARCHAR(100) NULL,
        [remarks] NVARCHAR(MAX) NULL,
        [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_business_partners_status] DEFAULT N'Active',
        [payment_terms] NVARCHAR(50) NULL,
        [credit_days] INT NULL,
        [credit_limit] DECIMAL(15, 2) NULL,
        [payment_method] NVARCHAR(50) NULL,
        [payment_priority] NVARCHAR(20) NULL,
        [block_payment] BIT NOT NULL CONSTRAINT [DF_business_partners_block_payment] DEFAULT 0,
        [house_bank] NVARCHAR(100) NULL,
        [bank_account_no] NVARCHAR(50) NULL,
        [control_account] NVARCHAR(20) NULL,
        [down_payment_clearing_account] NVARCHAR(20) NULL,
        CONSTRAINT [business_partners_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'business_partners_partner_code_key'
      AND object_id = OBJECT_ID(N'[dbo].[business_partners]')
)
BEGIN
    CREATE UNIQUE INDEX [business_partners_partner_code_key] ON [dbo].[business_partners]([partner_code]);
END;

-- CreateTable: business_partner_contacts
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'business_partner_contacts' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[business_partner_contacts] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [business_partner_id] INT NOT NULL,
        [contact_id] NVARCHAR(50) NULL,
        [title] NVARCHAR(20) NULL,
        [first_name] NVARCHAR(100) NOT NULL,
        [last_name] NVARCHAR(100) NULL,
        [position] NVARCHAR(100) NULL,
        [address] NVARCHAR(255) NULL,
        [telephone] NVARCHAR(20) NULL,
        [mobile] NVARCHAR(20) NULL,
        [fax] NVARCHAR(20) NULL,
        [email] NVARCHAR(100) NULL,
        [email_group] NVARCHAR(50) NULL,
        [password] NVARCHAR(100) NULL,
        [birth_country] NVARCHAR(50) NULL,
        [birth_city] NVARCHAR(100) NULL,
        [date_of_birth] DATE NULL,
        [gender] NVARCHAR(20) NULL,
        [profession] NVARCHAR(100) NULL,
        [remarks] NVARCHAR(MAX) NULL,
        [is_default] BIT NOT NULL CONSTRAINT [DF_bp_contacts_is_default] DEFAULT 0,
        [row_order] INT NOT NULL CONSTRAINT [DF_bp_contacts_row_order] DEFAULT 1,
        CONSTRAINT [business_partner_contacts_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

-- CreateTable: business_partner_addresses
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'business_partner_addresses' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[business_partner_addresses] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [business_partner_id] INT NOT NULL,
        [address_type] NVARCHAR(20) NOT NULL,
        [address] NVARCHAR(MAX) NOT NULL,
        [is_default] BIT NOT NULL CONSTRAINT [DF_bp_addresses_is_default] DEFAULT 0,
        [row_order] INT NOT NULL CONSTRAINT [DF_bp_addresses_row_order] DEFAULT 1,
        CONSTRAINT [business_partner_addresses_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

-- Deleting a business partner takes its contacts/addresses with it; the app
-- replaces both child sets wholesale on every save and never keeps an
-- orphaned row (same pattern as journal_entry_lines / approval_flow_levels).
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'business_partner_contacts_business_partner_id_fkey'
)
BEGIN
    ALTER TABLE [dbo].[business_partner_contacts]
      ADD CONSTRAINT [business_partner_contacts_business_partner_id_fkey]
      FOREIGN KEY ([business_partner_id]) REFERENCES [dbo].[business_partners]([id]) ON DELETE CASCADE;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'business_partner_addresses_business_partner_id_fkey'
)
BEGIN
    ALTER TABLE [dbo].[business_partner_addresses]
      ADD CONSTRAINT [business_partner_addresses_business_partner_id_fkey]
      FOREIGN KEY ([business_partner_id]) REFERENCES [dbo].[business_partners]([id]) ON DELETE CASCADE;
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
