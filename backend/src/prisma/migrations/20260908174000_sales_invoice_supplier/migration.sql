-- Sales Invoice: add Supplier (Business Partner / Vendor) so their logo can
-- be printed alongside the KEMACH logo when that partner's Logo Visibility
-- is Yes.

ALTER TABLE [dbo].[sales_invoices] ADD [supplier] NVARCHAR(150);
