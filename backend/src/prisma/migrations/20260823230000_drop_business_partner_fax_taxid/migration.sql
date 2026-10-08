BEGIN TRY

BEGIN TRAN;

-- AlterTable: business_partners — drop federal_tax_id and fax.
--
-- Removed on request: the Business Partner General tab no longer shows
-- "Federal Tax ID" or "Fax", so these columns (added in
-- 20260823220000_add_business_partner) are no longer written to and are
-- dropped rather than left dead.
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[business_partners]') AND name = 'federal_tax_id')
BEGIN
    DECLARE @constraintName1 SYSNAME;
    DECLARE @sql1 NVARCHAR(MAX);

    DECLARE cur_bp_tax CURSOR LOCAL FAST_FORWARD FOR
        SELECT dc.name
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[business_partners]') AND c.name = 'federal_tax_id';
    OPEN cur_bp_tax;
    FETCH NEXT FROM cur_bp_tax INTO @constraintName1;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            SET @sql1 = 'ALTER TABLE [dbo].[business_partners] DROP CONSTRAINT [' + @constraintName1 + ']';
            EXEC sp_executesql @sql1;
        END TRY
        BEGIN CATCH
            PRINT 'Skipping stale constraint reference: ' + @constraintName1 + ' — ' + ERROR_MESSAGE();
        END CATCH
        FETCH NEXT FROM cur_bp_tax INTO @constraintName1;
    END
    CLOSE cur_bp_tax;
    DEALLOCATE cur_bp_tax;

    ALTER TABLE [dbo].[business_partners] DROP COLUMN [federal_tax_id];
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[business_partners]') AND name = 'fax')
BEGIN
    DECLARE @constraintName2 SYSNAME;
    DECLARE @sql2 NVARCHAR(MAX);

    DECLARE cur_bp_fax CURSOR LOCAL FAST_FORWARD FOR
        SELECT dc.name
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[business_partners]') AND c.name = 'fax';
    OPEN cur_bp_fax;
    FETCH NEXT FROM cur_bp_fax INTO @constraintName2;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            SET @sql2 = 'ALTER TABLE [dbo].[business_partners] DROP CONSTRAINT [' + @constraintName2 + ']';
            EXEC sp_executesql @sql2;
        END TRY
        BEGIN CATCH
            PRINT 'Skipping stale constraint reference: ' + @constraintName2 + ' — ' + ERROR_MESSAGE();
        END CATCH
        FETCH NEXT FROM cur_bp_fax INTO @constraintName2;
    END
    CLOSE cur_bp_fax;
    DEALLOCATE cur_bp_fax;

    ALTER TABLE [dbo].[business_partners] DROP COLUMN [fax];
END;

-- AlterTable: business_partner_contacts — drop fax.
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[business_partner_contacts]') AND name = 'fax')
BEGIN
    DECLARE @constraintName3 SYSNAME;
    DECLARE @sql3 NVARCHAR(MAX);

    DECLARE cur_bpc_fax CURSOR LOCAL FAST_FORWARD FOR
        SELECT dc.name
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[business_partner_contacts]') AND c.name = 'fax';
    OPEN cur_bpc_fax;
    FETCH NEXT FROM cur_bpc_fax INTO @constraintName3;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            SET @sql3 = 'ALTER TABLE [dbo].[business_partner_contacts] DROP CONSTRAINT [' + @constraintName3 + ']';
            EXEC sp_executesql @sql3;
        END TRY
        BEGIN CATCH
            PRINT 'Skipping stale constraint reference: ' + @constraintName3 + ' — ' + ERROR_MESSAGE();
        END CATCH
        FETCH NEXT FROM cur_bpc_fax INTO @constraintName3;
    END
    CLOSE cur_bpc_fax;
    DEALLOCATE cur_bpc_fax;

    ALTER TABLE [dbo].[business_partner_contacts] DROP COLUMN [fax];
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
