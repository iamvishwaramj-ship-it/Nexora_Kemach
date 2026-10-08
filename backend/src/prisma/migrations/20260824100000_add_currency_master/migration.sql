BEGIN TRY

BEGIN TRAN;

-- CreateTable: CurrencyMaster
--
-- Product Setup > Currency Master — see the model doc comment in
-- schema.prisma. This becomes the single source of truth every currency
-- dropdown in the app reads from, replacing every hardcoded currency list.
-- Seeded below with the four codes (INR/USD/EUR/GBP) every hardcoded list in
-- the app used to carry, so documents already saved with one of those codes
-- keep resolving without a manual data fix.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'currency_masters' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[currency_masters] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [currency_code] NVARCHAR(10) NOT NULL,
        [currency_name] NVARCHAR(100) NOT NULL,
        [symbol] NVARCHAR(10) NOT NULL,
        [is_active] BIT NOT NULL CONSTRAINT [DF_currency_masters_is_active] DEFAULT 1,
        CONSTRAINT [currency_masters_pkey] PRIMARY KEY CLUSTERED ([id])
    );

    CREATE UNIQUE INDEX [currency_masters_currency_code_key] ON [dbo].[currency_masters]([currency_code]);
    CREATE UNIQUE INDEX [currency_masters_currency_name_key] ON [dbo].[currency_masters]([currency_name]);

    INSERT INTO [dbo].[currency_masters] ([currency_code], [currency_name], [symbol], [is_active]) VALUES
        (N'INR', N'Indian Rupee', N'₹', 1),
        (N'USD', N'US Dollar', N'$', 1),
        (N'EUR', N'Euro', N'€', 1),
        (N'GBP', N'British Pound', N'£', 1);
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
