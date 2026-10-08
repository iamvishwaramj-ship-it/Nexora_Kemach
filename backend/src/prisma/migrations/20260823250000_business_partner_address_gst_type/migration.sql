BEGIN TRY

BEGIN TRAN;

-- AlterTable: business_partner_addresses — add gst_type.
--
-- The Addresses tab's Billing/Shipping dialogs now collect a GST
-- registration category (Regular/TDS/ISD, Composition Levy, Casual Taxable
-- Person, Government Department or PSU, Non Resident Taxable Person, UN
-- Agency or Embassy) alongside the GST Number added in
-- 20260823240000_business_partner_address_and_accounting_fields.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[business_partner_addresses]') AND name = 'gst_type')
BEGIN
    ALTER TABLE [dbo].[business_partner_addresses] ADD [gst_type] NVARCHAR(50) NULL;
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
