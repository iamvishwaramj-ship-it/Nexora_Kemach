-- AlterTable: sales_returns, sales_credit_memos, sales_quotations,
-- sales_orders, delivery_challans, sales_invoices
--
-- Same pre-existing schema/database drift as the warehouse fix in the
-- previous migration (20261009120000_add_warehouse_description_uom),
-- unrelated to the Phase A manufacturing foundation. The Prisma schema
-- already declares a nullable `salesCategory` field (mapped to
-- `sales_category`) on six sales-document models, but no migration was
-- ever generated to add that column to the live tables, so
-- `prisma generate` produces a client that expects a column the database
-- doesn't have, causing PrismaClientKnownRequestError P2022 ("Invalid
-- column name 'sales_category'") on any of these models -- most visibly
-- on SalesInvoice via the dashboard stats query. This migration only adds
-- the missing, nullable column to each of the six tables; it touches no
-- other column.
IF COL_LENGTH('dbo.sales_returns', 'sales_category') IS NULL
BEGIN
    ALTER TABLE [dbo].[sales_returns] ADD [sales_category] NVARCHAR(20) NULL;
END;

IF COL_LENGTH('dbo.sales_credit_memos', 'sales_category') IS NULL
BEGIN
    ALTER TABLE [dbo].[sales_credit_memos] ADD [sales_category] NVARCHAR(20) NULL;
END;

IF COL_LENGTH('dbo.sales_quotations', 'sales_category') IS NULL
BEGIN
    ALTER TABLE [dbo].[sales_quotations] ADD [sales_category] NVARCHAR(20) NULL;
END;

IF COL_LENGTH('dbo.sales_orders', 'sales_category') IS NULL
BEGIN
    ALTER TABLE [dbo].[sales_orders] ADD [sales_category] NVARCHAR(20) NULL;
END;

IF COL_LENGTH('dbo.delivery_challans', 'sales_category') IS NULL
BEGIN
    ALTER TABLE [dbo].[delivery_challans] ADD [sales_category] NVARCHAR(20) NULL;
END;

IF COL_LENGTH('dbo.sales_invoices', 'sales_category') IS NULL
BEGIN
    ALTER TABLE [dbo].[sales_invoices] ADD [sales_category] NVARCHAR(20) NULL;
END;
