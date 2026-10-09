-- AlterTable: warehouse
-- Fixes a pre-existing schema/database drift on the `warehouse` table,
-- unrelated to the Phase A manufacturing foundation (Work Centers / BOM /
-- Routing / Production Orders) added in the previous migration. The Prisma
-- schema's WarehouseMaster model already declares `description`, `uom`, and
-- `isTransit` (mapped to `is_transit`), but no migration was ever generated
-- to add these columns to the live `warehouse` table, so `prisma generate`
-- (which reads schema.prisma, not the database) produced a client that
-- expects columns the database doesn't have yet, causing
-- PrismaClientKnownRequestError P2022 ("Invalid column name 'description'")
-- on any WarehouseMaster query. This migration only adds the three missing,
-- nullable columns; it touches no other table and no existing column.
IF COL_LENGTH('dbo.warehouse', 'description') IS NULL
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [description] NVARCHAR(MAX) NULL;
END;

IF COL_LENGTH('dbo.warehouse', 'uom') IS NULL
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [uom] NVARCHAR(150) NULL;
END;

IF COL_LENGTH('dbo.warehouse', 'is_transit') IS NULL
BEGIN
    ALTER TABLE [dbo].[warehouse] ADD [is_transit] BIT NOT NULL CONSTRAINT [DF_warehouse_is_transit] DEFAULT 0;
END;
