BEGIN TRY

BEGIN TRAN;

-- AlterTable: products — drop sales_price, min_sales_price, tax_code,
-- tax_rate_type, tax_rate.
--
-- These fields were the per-product default sale price and default tax
-- (Product Master > Sales tab). Removed on request, together with their
-- inputs on the form (see ProductMaster.jsx) and their entries in
-- productBaseSchema (frontend/src/lib/validation/productSchemas.js).
--
-- Downstream effect, accepted as part of this removal: Sales Order,
-- Sales Quotation, Sales Invoice and Delivery Challan line auto-fill used
-- to read a picked product's salesPrice/taxRate to default that line's
-- Unit Price/Tax %; Purchase GRN read taxRate the same way. All of those
-- call sites already guard with `!= null ? Number(...) : 0`, so losing the
-- columns does not error — they simply always fall through to 0 now, same
-- as any product that never had a value there. Nothing to fix in those
-- files as a result.
--
-- Each column's default constraint(s) are dropped through a per-constraint
-- TRY/CATCH rather than a single lookup-then-drop: a first attempt at this
-- migration found `DF_products_min_sales_price` in sys.default_constraints
-- (a name that matches exactly what the original CREATE TABLE gave it) and
-- still had SQL Server refuse the DROP CONSTRAINT with "is not a
-- constraint" — orphaned catalog metadata from some earlier ad-hoc ALTER on
-- this long-lived dev database, the same class of drift already seen on
-- GLAccountDeterminations. Isolating each drop in its own TRY/CATCH means
-- one bogus catalog entry can no longer abort the whole migration; the
-- DROP COLUMN right after each loop is what actually matters; and if a
-- column genuinely still has a real default blocking it, that DROP COLUMN
-- fails loudly instead of the constraint-drop failing first and masking it.
DECLARE @constraintName SYSNAME;
DECLARE @sql NVARCHAR(MAX);

-- sales_price ---------------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'sales_price')
BEGIN
    DECLARE cur_sales_price CURSOR LOCAL FAST_FORWARD FOR
        SELECT dc.name
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[products]') AND c.name = 'sales_price';
    OPEN cur_sales_price;
    FETCH NEXT FROM cur_sales_price INTO @constraintName;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            SET @sql = 'ALTER TABLE [dbo].[products] DROP CONSTRAINT [' + @constraintName + ']';
            EXEC sp_executesql @sql;
        END TRY
        BEGIN CATCH
            PRINT 'Skipping stale constraint reference: ' + @constraintName + ' — ' + ERROR_MESSAGE();
        END CATCH
        FETCH NEXT FROM cur_sales_price INTO @constraintName;
    END
    CLOSE cur_sales_price;
    DEALLOCATE cur_sales_price;

    ALTER TABLE [dbo].[products] DROP COLUMN [sales_price];
END;

-- min_sales_price -------------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'min_sales_price')
BEGIN
    DECLARE cur_min_sales_price CURSOR LOCAL FAST_FORWARD FOR
        SELECT dc.name
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[products]') AND c.name = 'min_sales_price';
    OPEN cur_min_sales_price;
    FETCH NEXT FROM cur_min_sales_price INTO @constraintName;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            SET @sql = 'ALTER TABLE [dbo].[products] DROP CONSTRAINT [' + @constraintName + ']';
            EXEC sp_executesql @sql;
        END TRY
        BEGIN CATCH
            PRINT 'Skipping stale constraint reference: ' + @constraintName + ' — ' + ERROR_MESSAGE();
        END CATCH
        FETCH NEXT FROM cur_min_sales_price INTO @constraintName;
    END
    CLOSE cur_min_sales_price;
    DEALLOCATE cur_min_sales_price;

    ALTER TABLE [dbo].[products] DROP COLUMN [min_sales_price];
END;

-- tax_code --------------------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'tax_code')
BEGIN
    DECLARE cur_tax_code CURSOR LOCAL FAST_FORWARD FOR
        SELECT dc.name
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[products]') AND c.name = 'tax_code';
    OPEN cur_tax_code;
    FETCH NEXT FROM cur_tax_code INTO @constraintName;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            SET @sql = 'ALTER TABLE [dbo].[products] DROP CONSTRAINT [' + @constraintName + ']';
            EXEC sp_executesql @sql;
        END TRY
        BEGIN CATCH
            PRINT 'Skipping stale constraint reference: ' + @constraintName + ' — ' + ERROR_MESSAGE();
        END CATCH
        FETCH NEXT FROM cur_tax_code INTO @constraintName;
    END
    CLOSE cur_tax_code;
    DEALLOCATE cur_tax_code;

    ALTER TABLE [dbo].[products] DROP COLUMN [tax_code];
END;

-- tax_rate_type -----------------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'tax_rate_type')
BEGIN
    DECLARE cur_tax_rate_type CURSOR LOCAL FAST_FORWARD FOR
        SELECT dc.name
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[products]') AND c.name = 'tax_rate_type';
    OPEN cur_tax_rate_type;
    FETCH NEXT FROM cur_tax_rate_type INTO @constraintName;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            SET @sql = 'ALTER TABLE [dbo].[products] DROP CONSTRAINT [' + @constraintName + ']';
            EXEC sp_executesql @sql;
        END TRY
        BEGIN CATCH
            PRINT 'Skipping stale constraint reference: ' + @constraintName + ' — ' + ERROR_MESSAGE();
        END CATCH
        FETCH NEXT FROM cur_tax_rate_type INTO @constraintName;
    END
    CLOSE cur_tax_rate_type;
    DEALLOCATE cur_tax_rate_type;

    ALTER TABLE [dbo].[products] DROP COLUMN [tax_rate_type];
END;

-- tax_rate ------------------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND name = 'tax_rate')
BEGIN
    DECLARE cur_tax_rate CURSOR LOCAL FAST_FORWARD FOR
        SELECT dc.name
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[products]') AND c.name = 'tax_rate';
    OPEN cur_tax_rate;
    FETCH NEXT FROM cur_tax_rate INTO @constraintName;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            SET @sql = 'ALTER TABLE [dbo].[products] DROP CONSTRAINT [' + @constraintName + ']';
            EXEC sp_executesql @sql;
        END TRY
        BEGIN CATCH
            PRINT 'Skipping stale constraint reference: ' + @constraintName + ' — ' + ERROR_MESSAGE();
        END CATCH
        FETCH NEXT FROM cur_tax_rate INTO @constraintName;
    END
    CLOSE cur_tax_rate;
    DEALLOCATE cur_tax_rate;

    ALTER TABLE [dbo].[products] DROP COLUMN [tax_rate];
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
