BEGIN TRY

BEGIN TRAN;

-- AlterTable: products — drop factor1, factor2, factor3, factor4.
--
-- Free-standing numeric fields on the Purchase and Sales tabs (Product
-- Master), removed on request together with their inputs on the form (see
-- ProductMaster.jsx) and their entries in productBaseSchema
-- (frontend/src/lib/validation/productSchemas.js). Nothing else in the
-- application read these columns, so there is no downstream fallback to
-- account for, unlike the sales_price/tax_rate removal earlier.
--
-- Same per-column, per-constraint TRY/CATCH pattern as
-- 20260823160000_drop_product_sales_tax_fields: isolates each default
-- constraint drop so a stale/orphaned catalog entry on one column can't
-- abort the whole migration; the DROP COLUMN right after each loop is what
-- actually matters.
DECLARE @constraintName SYSNAME;
DECLARE @sql NVARCHAR(MAX);

-- factor1 -------------------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'factor1')
BEGIN
    DECLARE cur_factor1 CURSOR LOCAL FAST_FORWARD FOR
        SELECT dc.name
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[products]') AND c.name = 'factor1';
    OPEN cur_factor1;
    FETCH NEXT FROM cur_factor1 INTO @constraintName;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            SET @sql = 'ALTER TABLE [dbo].[products] DROP CONSTRAINT [' + @constraintName + ']';
            EXEC sp_executesql @sql;
        END TRY
        BEGIN CATCH
            PRINT 'Skipping stale constraint reference: ' + @constraintName + ' — ' + ERROR_MESSAGE();
        END CATCH
        FETCH NEXT FROM cur_factor1 INTO @constraintName;
    END
    CLOSE cur_factor1;
    DEALLOCATE cur_factor1;

    ALTER TABLE [dbo].[products] DROP COLUMN [factor1];
END;

-- factor2 -------------------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'factor2')
BEGIN
    DECLARE cur_factor2 CURSOR LOCAL FAST_FORWARD FOR
        SELECT dc.name
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[products]') AND c.name = 'factor2';
    OPEN cur_factor2;
    FETCH NEXT FROM cur_factor2 INTO @constraintName;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            SET @sql = 'ALTER TABLE [dbo].[products] DROP CONSTRAINT [' + @constraintName + ']';
            EXEC sp_executesql @sql;
        END TRY
        BEGIN CATCH
            PRINT 'Skipping stale constraint reference: ' + @constraintName + ' — ' + ERROR_MESSAGE();
        END CATCH
        FETCH NEXT FROM cur_factor2 INTO @constraintName;
    END
    CLOSE cur_factor2;
    DEALLOCATE cur_factor2;

    ALTER TABLE [dbo].[products] DROP COLUMN [factor2];
END;

-- factor3 -------------------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'factor3')
BEGIN
    DECLARE cur_factor3 CURSOR LOCAL FAST_FORWARD FOR
        SELECT dc.name
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[products]') AND c.name = 'factor3';
    OPEN cur_factor3;
    FETCH NEXT FROM cur_factor3 INTO @constraintName;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            SET @sql = 'ALTER TABLE [dbo].[products] DROP CONSTRAINT [' + @constraintName + ']';
            EXEC sp_executesql @sql;
        END TRY
        BEGIN CATCH
            PRINT 'Skipping stale constraint reference: ' + @constraintName + ' — ' + ERROR_MESSAGE();
        END CATCH
        FETCH NEXT FROM cur_factor3 INTO @constraintName;
    END
    CLOSE cur_factor3;
    DEALLOCATE cur_factor3;

    ALTER TABLE [dbo].[products] DROP COLUMN [factor3];
END;

-- factor4 -------------------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'factor4')
BEGIN
    DECLARE cur_factor4 CURSOR LOCAL FAST_FORWARD FOR
        SELECT dc.name
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[products]') AND c.name = 'factor4';
    OPEN cur_factor4;
    FETCH NEXT FROM cur_factor4 INTO @constraintName;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            SET @sql = 'ALTER TABLE [dbo].[products] DROP CONSTRAINT [' + @constraintName + ']';
            EXEC sp_executesql @sql;
        END TRY
        BEGIN CATCH
            PRINT 'Skipping stale constraint reference: ' + @constraintName + ' — ' + ERROR_MESSAGE();
        END CATCH
        FETCH NEXT FROM cur_factor4 INTO @constraintName;
    END
    CLOSE cur_factor4;
    DEALLOCATE cur_factor4;

    ALTER TABLE [dbo].[products] DROP COLUMN [factor4];
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
