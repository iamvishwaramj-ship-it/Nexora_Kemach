BEGIN TRY

BEGIN TRAN;

-- Freight Charges + Road Tax on Purchase documents -- same feature/
-- convention as the Sales documents' own migration
-- (20260914120000_add_sales_freight_charges_and_road_tax). All new
-- columns default to 0/NULL so every existing row is unaffected until a
-- document is edited and freight/road tax are actually set.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_quotations]') AND name = 'road_tax')
BEGIN
    ALTER TABLE [dbo].[purchase_quotations] ADD [road_tax] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_purchase_quotations_road_tax DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_quotations]') AND name = 'freight_transport_id')
BEGIN
    ALTER TABLE [dbo].[purchase_quotations] ADD [freight_transport_id] INT NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_quotations]') AND name = 'freight_name')
BEGIN
    ALTER TABLE [dbo].[purchase_quotations] ADD [freight_name] NVARCHAR(150) NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_quotations]') AND name = 'freight_remarks')
BEGIN
    ALTER TABLE [dbo].[purchase_quotations] ADD [freight_remarks] NVARCHAR(MAX) NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_quotations]') AND name = 'freight_tax_code_id')
BEGIN
    ALTER TABLE [dbo].[purchase_quotations] ADD [freight_tax_code_id] INT NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_quotations]') AND name = 'freight_tax_amount')
BEGIN
    ALTER TABLE [dbo].[purchase_quotations] ADD [freight_tax_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_purchase_quotations_freight_tax_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_quotations]') AND name = 'freight_net_amount')
BEGIN
    ALTER TABLE [dbo].[purchase_quotations] ADD [freight_net_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_purchase_quotations_freight_net_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_quotations]') AND name = 'freight_gross_amount')
BEGIN
    ALTER TABLE [dbo].[purchase_quotations] ADD [freight_gross_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_purchase_quotations_freight_gross_amount DEFAULT 0;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_orders]') AND name = 'road_tax')
BEGIN
    ALTER TABLE [dbo].[purchase_orders] ADD [road_tax] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_purchase_orders_road_tax DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_orders]') AND name = 'freight_transport_id')
BEGIN
    ALTER TABLE [dbo].[purchase_orders] ADD [freight_transport_id] INT NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_orders]') AND name = 'freight_name')
BEGIN
    ALTER TABLE [dbo].[purchase_orders] ADD [freight_name] NVARCHAR(150) NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_orders]') AND name = 'freight_remarks')
BEGIN
    ALTER TABLE [dbo].[purchase_orders] ADD [freight_remarks] NVARCHAR(MAX) NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_orders]') AND name = 'freight_tax_code_id')
BEGIN
    ALTER TABLE [dbo].[purchase_orders] ADD [freight_tax_code_id] INT NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_orders]') AND name = 'freight_tax_amount')
BEGIN
    ALTER TABLE [dbo].[purchase_orders] ADD [freight_tax_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_purchase_orders_freight_tax_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_orders]') AND name = 'freight_net_amount')
BEGIN
    ALTER TABLE [dbo].[purchase_orders] ADD [freight_net_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_purchase_orders_freight_net_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_orders]') AND name = 'freight_gross_amount')
BEGIN
    ALTER TABLE [dbo].[purchase_orders] ADD [freight_gross_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_purchase_orders_freight_gross_amount DEFAULT 0;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[goods_received_notes]') AND name = 'road_tax')
BEGIN
    ALTER TABLE [dbo].[goods_received_notes] ADD [road_tax] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_goods_received_notes_road_tax DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[goods_received_notes]') AND name = 'freight_transport_id')
BEGIN
    ALTER TABLE [dbo].[goods_received_notes] ADD [freight_transport_id] INT NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[goods_received_notes]') AND name = 'freight_name')
BEGIN
    ALTER TABLE [dbo].[goods_received_notes] ADD [freight_name] NVARCHAR(150) NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[goods_received_notes]') AND name = 'freight_remarks')
BEGIN
    ALTER TABLE [dbo].[goods_received_notes] ADD [freight_remarks] NVARCHAR(MAX) NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[goods_received_notes]') AND name = 'freight_tax_code_id')
BEGIN
    ALTER TABLE [dbo].[goods_received_notes] ADD [freight_tax_code_id] INT NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[goods_received_notes]') AND name = 'freight_tax_amount')
BEGIN
    ALTER TABLE [dbo].[goods_received_notes] ADD [freight_tax_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_goods_received_notes_freight_tax_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[goods_received_notes]') AND name = 'freight_net_amount')
BEGIN
    ALTER TABLE [dbo].[goods_received_notes] ADD [freight_net_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_goods_received_notes_freight_net_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[goods_received_notes]') AND name = 'freight_gross_amount')
BEGIN
    ALTER TABLE [dbo].[goods_received_notes] ADD [freight_gross_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_goods_received_notes_freight_gross_amount DEFAULT 0;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_credit_memos]') AND name = 'road_tax')
BEGIN
    ALTER TABLE [dbo].[purchase_credit_memos] ADD [road_tax] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_purchase_credit_memos_road_tax DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_credit_memos]') AND name = 'freight_transport_id')
BEGIN
    ALTER TABLE [dbo].[purchase_credit_memos] ADD [freight_transport_id] INT NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_credit_memos]') AND name = 'freight_name')
BEGIN
    ALTER TABLE [dbo].[purchase_credit_memos] ADD [freight_name] NVARCHAR(150) NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_credit_memos]') AND name = 'freight_remarks')
BEGIN
    ALTER TABLE [dbo].[purchase_credit_memos] ADD [freight_remarks] NVARCHAR(MAX) NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_credit_memos]') AND name = 'freight_tax_code_id')
BEGIN
    ALTER TABLE [dbo].[purchase_credit_memos] ADD [freight_tax_code_id] INT NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_credit_memos]') AND name = 'freight_tax_amount')
BEGIN
    ALTER TABLE [dbo].[purchase_credit_memos] ADD [freight_tax_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_purchase_credit_memos_freight_tax_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_credit_memos]') AND name = 'freight_net_amount')
BEGIN
    ALTER TABLE [dbo].[purchase_credit_memos] ADD [freight_net_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_purchase_credit_memos_freight_net_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_credit_memos]') AND name = 'freight_gross_amount')
BEGIN
    ALTER TABLE [dbo].[purchase_credit_memos] ADD [freight_gross_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_purchase_credit_memos_freight_gross_amount DEFAULT 0;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_returns]') AND name = 'road_tax')
BEGIN
    ALTER TABLE [dbo].[purchase_returns] ADD [road_tax] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_purchase_returns_road_tax DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_returns]') AND name = 'freight_transport_id')
BEGIN
    ALTER TABLE [dbo].[purchase_returns] ADD [freight_transport_id] INT NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_returns]') AND name = 'freight_name')
BEGIN
    ALTER TABLE [dbo].[purchase_returns] ADD [freight_name] NVARCHAR(150) NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_returns]') AND name = 'freight_remarks')
BEGIN
    ALTER TABLE [dbo].[purchase_returns] ADD [freight_remarks] NVARCHAR(MAX) NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_returns]') AND name = 'freight_tax_code_id')
BEGIN
    ALTER TABLE [dbo].[purchase_returns] ADD [freight_tax_code_id] INT NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_returns]') AND name = 'freight_tax_amount')
BEGIN
    ALTER TABLE [dbo].[purchase_returns] ADD [freight_tax_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_purchase_returns_freight_tax_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_returns]') AND name = 'freight_net_amount')
BEGIN
    ALTER TABLE [dbo].[purchase_returns] ADD [freight_net_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_purchase_returns_freight_net_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_returns]') AND name = 'freight_gross_amount')
BEGIN
    ALTER TABLE [dbo].[purchase_returns] ADD [freight_gross_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_purchase_returns_freight_gross_amount DEFAULT 0;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_invoices]') AND name = 'road_tax')
BEGIN
    ALTER TABLE [dbo].[purchase_invoices] ADD [road_tax] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_purchase_invoices_road_tax DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_invoices]') AND name = 'freight_transport_id')
BEGIN
    ALTER TABLE [dbo].[purchase_invoices] ADD [freight_transport_id] INT NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_invoices]') AND name = 'freight_name')
BEGIN
    ALTER TABLE [dbo].[purchase_invoices] ADD [freight_name] NVARCHAR(150) NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_invoices]') AND name = 'freight_remarks')
BEGIN
    ALTER TABLE [dbo].[purchase_invoices] ADD [freight_remarks] NVARCHAR(MAX) NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_invoices]') AND name = 'freight_tax_code_id')
BEGIN
    ALTER TABLE [dbo].[purchase_invoices] ADD [freight_tax_code_id] INT NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_invoices]') AND name = 'freight_tax_amount')
BEGIN
    ALTER TABLE [dbo].[purchase_invoices] ADD [freight_tax_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_purchase_invoices_freight_tax_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_invoices]') AND name = 'freight_net_amount')
BEGIN
    ALTER TABLE [dbo].[purchase_invoices] ADD [freight_net_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_purchase_invoices_freight_net_amount DEFAULT 0;
END;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[purchase_invoices]') AND name = 'freight_gross_amount')
BEGIN
    ALTER TABLE [dbo].[purchase_invoices] ADD [freight_gross_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT DF_purchase_invoices_freight_gross_amount DEFAULT 0;
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
