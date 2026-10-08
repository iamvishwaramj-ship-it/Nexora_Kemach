BEGIN TRY

BEGIN TRAN;

-- Freight Charges feature -- see schema.prisma's "--- Freight Charges ---"
-- comment on each of the five sales document models. freightTransportId /
-- freightTaxCodeId are soft-FK-by-id columns, same convention as
-- taxCodeId/warehouse elsewhere in this schema (no FK constraint, resolved
-- client-side). freightGrossAmount (= freightNetAmount + freightTaxAmount,
-- recomputed server-side) is what gets added into each table's amount
-- column (the grand total), the same way roadTax already does on Sales
-- Quotation. All new columns default to 0/NULL so every existing row is
-- unaffected until a document is edited and freight is actually set.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_quotations]') AND name = 'freight_transport_id')
BEGIN
    ALTER TABLE [dbo].[sales_quotations] ADD [freight_transport_id] INT NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_quotations]') AND name = 'freight_name')
BEGIN
    ALTER TABLE [dbo].[sales_quotations] ADD [freight_name] NVARCHAR(150) NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_quotations]') AND name = 'freight_remarks')
BEGIN
    ALTER TABLE [dbo].[sales_quotations] ADD [freight_remarks] NVARCHAR(MAX) NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_quotations]') AND name = 'freight_tax_code_id')
BEGIN
    ALTER TABLE [dbo].[sales_quotations] ADD [freight_tax_code_id] INT NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_quotations]') AND name = 'freight_tax_amount')
BEGIN
    ALTER TABLE [dbo].[sales_quotations] ADD [freight_tax_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_sales_quotations_freight_tax_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_quotations]') AND name = 'freight_net_amount')
BEGIN
    ALTER TABLE [dbo].[sales_quotations] ADD [freight_net_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_sales_quotations_freight_net_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_quotations]') AND name = 'freight_gross_amount')
BEGIN
    ALTER TABLE [dbo].[sales_quotations] ADD [freight_gross_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_sales_quotations_freight_gross_amount DEFAULT 0;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_orders]') AND name = 'road_tax')
BEGIN
    ALTER TABLE [dbo].[sales_orders] ADD [road_tax] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_sales_orders_road_tax DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_orders]') AND name = 'freight_transport_id')
BEGIN
    ALTER TABLE [dbo].[sales_orders] ADD [freight_transport_id] INT NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_orders]') AND name = 'freight_name')
BEGIN
    ALTER TABLE [dbo].[sales_orders] ADD [freight_name] NVARCHAR(150) NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_orders]') AND name = 'freight_remarks')
BEGIN
    ALTER TABLE [dbo].[sales_orders] ADD [freight_remarks] NVARCHAR(MAX) NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_orders]') AND name = 'freight_tax_code_id')
BEGIN
    ALTER TABLE [dbo].[sales_orders] ADD [freight_tax_code_id] INT NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_orders]') AND name = 'freight_tax_amount')
BEGIN
    ALTER TABLE [dbo].[sales_orders] ADD [freight_tax_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_sales_orders_freight_tax_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_orders]') AND name = 'freight_net_amount')
BEGIN
    ALTER TABLE [dbo].[sales_orders] ADD [freight_net_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_sales_orders_freight_net_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_orders]') AND name = 'freight_gross_amount')
BEGIN
    ALTER TABLE [dbo].[sales_orders] ADD [freight_gross_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_sales_orders_freight_gross_amount DEFAULT 0;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_invoices]') AND name = 'road_tax')
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [road_tax] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_sales_invoices_road_tax DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_invoices]') AND name = 'freight_transport_id')
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [freight_transport_id] INT NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_invoices]') AND name = 'freight_name')
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [freight_name] NVARCHAR(150) NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_invoices]') AND name = 'freight_remarks')
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [freight_remarks] NVARCHAR(MAX) NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_invoices]') AND name = 'freight_tax_code_id')
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [freight_tax_code_id] INT NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_invoices]') AND name = 'freight_tax_amount')
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [freight_tax_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_sales_invoices_freight_tax_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_invoices]') AND name = 'freight_net_amount')
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [freight_net_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_sales_invoices_freight_net_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_invoices]') AND name = 'freight_gross_amount')
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [freight_gross_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_sales_invoices_freight_gross_amount DEFAULT 0;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_returns]') AND name = 'road_tax')
BEGIN
    ALTER TABLE [dbo].[sales_returns] ADD [road_tax] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_sales_returns_road_tax DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_returns]') AND name = 'freight_transport_id')
BEGIN
    ALTER TABLE [dbo].[sales_returns] ADD [freight_transport_id] INT NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_returns]') AND name = 'freight_name')
BEGIN
    ALTER TABLE [dbo].[sales_returns] ADD [freight_name] NVARCHAR(150) NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_returns]') AND name = 'freight_remarks')
BEGIN
    ALTER TABLE [dbo].[sales_returns] ADD [freight_remarks] NVARCHAR(MAX) NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_returns]') AND name = 'freight_tax_code_id')
BEGIN
    ALTER TABLE [dbo].[sales_returns] ADD [freight_tax_code_id] INT NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_returns]') AND name = 'freight_tax_amount')
BEGIN
    ALTER TABLE [dbo].[sales_returns] ADD [freight_tax_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_sales_returns_freight_tax_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_returns]') AND name = 'freight_net_amount')
BEGIN
    ALTER TABLE [dbo].[sales_returns] ADD [freight_net_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_sales_returns_freight_net_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_returns]') AND name = 'freight_gross_amount')
BEGIN
    ALTER TABLE [dbo].[sales_returns] ADD [freight_gross_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_sales_returns_freight_gross_amount DEFAULT 0;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_credit_memos]') AND name = 'road_tax')
BEGIN
    ALTER TABLE [dbo].[sales_credit_memos] ADD [road_tax] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_sales_credit_memos_road_tax DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_credit_memos]') AND name = 'freight_transport_id')
BEGIN
    ALTER TABLE [dbo].[sales_credit_memos] ADD [freight_transport_id] INT NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_credit_memos]') AND name = 'freight_name')
BEGIN
    ALTER TABLE [dbo].[sales_credit_memos] ADD [freight_name] NVARCHAR(150) NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_credit_memos]') AND name = 'freight_remarks')
BEGIN
    ALTER TABLE [dbo].[sales_credit_memos] ADD [freight_remarks] NVARCHAR(MAX) NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_credit_memos]') AND name = 'freight_tax_code_id')
BEGIN
    ALTER TABLE [dbo].[sales_credit_memos] ADD [freight_tax_code_id] INT NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_credit_memos]') AND name = 'freight_tax_amount')
BEGIN
    ALTER TABLE [dbo].[sales_credit_memos] ADD [freight_tax_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_sales_credit_memos_freight_tax_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_credit_memos]') AND name = 'freight_net_amount')
BEGIN
    ALTER TABLE [dbo].[sales_credit_memos] ADD [freight_net_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_sales_credit_memos_freight_net_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[sales_credit_memos]') AND name = 'freight_gross_amount')
BEGIN
    ALTER TABLE [dbo].[sales_credit_memos] ADD [freight_gross_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_sales_credit_memos_freight_gross_amount DEFAULT 0;
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
