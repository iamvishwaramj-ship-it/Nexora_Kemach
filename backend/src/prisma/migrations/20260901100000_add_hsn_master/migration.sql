BEGIN TRY

BEGIN TRAN;

-- CreateTable: HsnMaster
--
-- Product Setup > HSN Master — see the model doc comment in schema.prisma.
-- Every GST-enabled product's HSN field (Product Master > Item Category)
-- reads its options from this table instead of accepting free-text entry.
-- Created empty — rows are entered through the HSN Master screen.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'hsn_masters' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[hsn_masters] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [hsn_code] NVARCHAR(8) NOT NULL,
        [description] NVARCHAR(255) NULL,
        [gst_rate] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_hsn_masters_gst_rate] DEFAULT 0,
        [is_active] BIT NOT NULL CONSTRAINT [DF_hsn_masters_is_active] DEFAULT 1,
        CONSTRAINT [hsn_masters_pkey] PRIMARY KEY CLUSTERED ([id])
    );

    CREATE UNIQUE INDEX [hsn_masters_hsn_code_key] ON [dbo].[hsn_masters]([hsn_code]);
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
