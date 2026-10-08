BEGIN TRY

BEGIN TRAN;

-- AlterTable: products — add chapter_id, gst_hsn, tax_category.
--
-- Conditional Item Category detail fields (Product Master > General tab):
-- chapter_id shows only while Excisable is ticked; gst_hsn and tax_category
-- show only while GST is ticked (see ProductMaster.jsx). All nullable, no
-- default needed — existing rows simply have no value until edited.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'chapter_id')
BEGIN
    ALTER TABLE [dbo].[products] ADD [chapter_id] NVARCHAR(50) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'gst_hsn')
BEGIN
    ALTER TABLE [dbo].[products] ADD [gst_hsn] NVARCHAR(50) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'tax_category')
BEGIN
    ALTER TABLE [dbo].[products] ADD [tax_category] NVARCHAR(20) NULL;
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
