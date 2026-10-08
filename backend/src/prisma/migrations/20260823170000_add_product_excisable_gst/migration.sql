BEGIN TRY

BEGIN TRAN;

-- AlterTable: products — excisable / gst
--
-- Item Category tax-treatment flags (Product Master > General tab): whether
-- this product is Excisable or a GST item. Mutually exclusive by design —
-- enforced on the form (ProductMaster.jsx, checking one unchecks the other)
-- and not as a CHECK constraint here, so a violation reads as an ordinary
-- validation-style behaviour rather than a driver error. Both default false
-- so every product saved before these existed keeps validating untouched.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'excisable'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [excisable] BIT NOT NULL CONSTRAINT [DF_products_excisable] DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'gst'
)
BEGIN
    ALTER TABLE [dbo].[products] ADD [gst] BIT NOT NULL CONSTRAINT [DF_products_gst] DEFAULT 0;
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
