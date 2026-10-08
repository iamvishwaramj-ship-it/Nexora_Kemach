BEGIN TRY

BEGIN TRAN;

-- AlterTable: products — drop gst_hsn.
--
-- Added in 20260823180000_add_product_tax_category_fields as a dedicated
-- column for the conditional "HSN" input shown under Item Category while GST
-- is ticked. On request, that input now reuses the existing hsn_code column
-- instead (Product Master's standalone "HSN / SAC Code" field was removed
-- from the General tab at the same time — see ProductMaster.jsx), so this
-- column is no longer written to and is dropped rather than left dead.
--
-- Left as its own migration rather than editing 20260823180000 in place:
-- editing an already-applied migration file is exactly the kind of drift
-- that caused the GLAccountDeterminations and products.min_sales_price
-- issues earlier — the live column would silently disagree with whatever
-- the edited file now says. A separate DROP is safe whether or not
-- 20260823180000 already ran with the gst_hsn ADD in it.
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'gst_hsn')
BEGIN
    DECLARE @constraintName SYSNAME;
    DECLARE @sql NVARCHAR(MAX);

    DECLARE cur_gst_hsn CURSOR LOCAL FAST_FORWARD FOR
        SELECT dc.name
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[products]') AND c.name = 'gst_hsn';
    OPEN cur_gst_hsn;
    FETCH NEXT FROM cur_gst_hsn INTO @constraintName;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            SET @sql = 'ALTER TABLE [dbo].[products] DROP CONSTRAINT [' + @constraintName + ']';
            EXEC sp_executesql @sql;
        END TRY
        BEGIN CATCH
            PRINT 'Skipping stale constraint reference: ' + @constraintName + ' — ' + ERROR_MESSAGE();
        END CATCH
        FETCH NEXT FROM cur_gst_hsn INTO @constraintName;
    END
    CLOSE cur_gst_hsn;
    DEALLOCATE cur_gst_hsn;

    ALTER TABLE [dbo].[products] DROP COLUMN [gst_hsn];
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
