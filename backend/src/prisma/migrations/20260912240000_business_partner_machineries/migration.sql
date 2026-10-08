BEGIN TRY

BEGIN TRAN;

-- CreateTable: business_partner_machineries
--
-- One Business Partner can have many Machineries — the "Machineries" tab's
-- grid on the Business Partner form, listing the equipment/item codes
-- associated with this partner (e.g. a customer's fleet). Referenced by
-- code from the Sales Quotation/Order/Delivery Challan/Invoice header's new
-- machinery_code column (see 20260912250000_sales_documents_machinery_code)
-- once a Customer is selected on those documents.
--
-- Replaced wholesale on every Business Partner save, same pattern as
-- business_partner_contacts/business_partner_addresses above it.
IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[dbo].[business_partner_machineries]') AND type = N'U'
)
BEGIN
    CREATE TABLE [dbo].[business_partner_machineries] (
        [id]                  INT IDENTITY(1,1) NOT NULL,
        [business_partner_id] INT NOT NULL,
        [item_code]           NVARCHAR(50)  NOT NULL,
        [item_name]           NVARCHAR(150) NOT NULL,
        [row_order]           INT NOT NULL CONSTRAINT [DF_business_partner_machineries_row_order] DEFAULT 1,
        [created_at]          DATETIME2 NOT NULL CONSTRAINT [DF_business_partner_machineries_created_at] DEFAULT CURRENT_TIMESTAMP,
        [updated_at]          DATETIME2 NOT NULL,
        CONSTRAINT [PK_business_partner_machineries] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_business_partner_machineries_partner')
BEGIN
    ALTER TABLE [dbo].[business_partner_machineries]
        ADD CONSTRAINT [FK_business_partner_machineries_partner]
        FOREIGN KEY ([business_partner_id]) REFERENCES [dbo].[business_partners]([id])
        ON DELETE CASCADE;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_business_partner_machineries_partner'
      AND object_id = OBJECT_ID(N'[dbo].[business_partner_machineries]')
)
BEGIN
    CREATE INDEX [IX_business_partner_machineries_partner]
        ON [dbo].[business_partner_machineries] ([business_partner_id]);
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
