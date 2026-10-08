-- Business Partner list load (GET /business-partners, routes/resources.js)
-- joins business_partners to business_partner_contacts and
-- business_partner_addresses on every single load (businessPartnerInclude),
-- and neither child table's business_partner_id foreign-key column had an
-- index — unlike Postgres, SQL Server does not create one automatically for
-- a foreign key. On a table with any real number of rows that turns the
-- join into a scan of both child tables per partner, which is almost
-- certainly why the Business Partner page was taking 6-10s to load.
--
-- Same guarded, idempotent style as the other performance-index migrations.
BEGIN TRY
BEGIN TRAN;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_business_partner_contact_partner_id')
    CREATE NONCLUSTERED INDEX [ix_business_partner_contact_partner_id] ON [dbo].[business_partner_contacts]([business_partner_id]);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'ix_business_partner_address_partner_id')
    CREATE NONCLUSTERED INDEX [ix_business_partner_address_partner_id] ON [dbo].[business_partner_addresses]([business_partner_id]);

COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRAN;
    THROW;
END CATCH;
