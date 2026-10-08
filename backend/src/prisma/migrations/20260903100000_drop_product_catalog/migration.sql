BEGIN TRY

BEGIN TRAN;

-- Drop Product Catalog (product_catalogs / product_catalog_items).
--
-- The whole feature — menu entry, page, API routes, CAT master-numbering
-- series — is being retired; nothing else in the schema references either
-- table (ProductCatalogItem.catalog was the only FK, and it points INTO
-- product_catalogs, not out of it).

-- DropForeignKey: product_catalog_items_catalog_id_fkey
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'product_catalog_items_catalog_id_fkey')
BEGIN
    ALTER TABLE [dbo].[product_catalog_items] DROP CONSTRAINT [product_catalog_items_catalog_id_fkey];
END;

-- DropTable: product_catalog_items
IF OBJECT_ID(N'[dbo].[product_catalog_items]', 'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[product_catalog_items];
END;

-- DropIndex: product_catalogs_catalog_code_key
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'product_catalogs_catalog_code_key')
BEGIN
    DROP INDEX [product_catalogs_catalog_code_key] ON [dbo].[product_catalogs];
END;

-- DropTable: product_catalogs
IF OBJECT_ID(N'[dbo].[product_catalogs]', 'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[product_catalogs];
END;

-- Stray numbering series for the retired CAT master code, if this
-- database's Document Numbering self-heal ever created one — same cleanup
-- as the CUS/SUP rows in 20260824090000_retire_customer_supplier_master.
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'document_numbering')
BEGIN
    DELETE FROM [dbo].[document_numbering] WHERE [document_code] = 'CAT';
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
