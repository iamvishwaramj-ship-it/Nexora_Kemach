-- Sales Quotation: add Supplier (Business Partner / Vendor) so their logo
-- can be printed alongside the KEMACH logo when that partner's Logo
-- Visibility is Yes.

ALTER TABLE [dbo].[sales_quotations] ADD [supplier] NVARCHAR(150);
