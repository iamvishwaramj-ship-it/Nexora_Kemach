-- Business Partner: add Logo Visibility (Yes/No), so a partner's logo can be
-- opted in or out of print output (e.g. printed alongside the KEMACH logo
-- when this partner is chosen as the Supplier on a sales document).

ALTER TABLE [dbo].[business_partners] ADD [logo_visible] BIT NOT NULL DEFAULT 1;
