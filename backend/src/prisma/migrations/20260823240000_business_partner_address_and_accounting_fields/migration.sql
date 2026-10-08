BEGIN TRY

BEGIN TRAN;

-- AlterTable: business_partners — drop down_payment_clearing_account.
--
-- Removed on request: the Accounting tab no longer shows "Down Payment
-- Clearing Account", so this column (added in
-- 20260823220000_add_business_partner) is no longer written to and is
-- dropped rather than left dead.
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[business_partners]') AND name = 'down_payment_clearing_account')
BEGIN
    DECLARE @constraintName1 SYSNAME;
    DECLARE @sql1 NVARCHAR(MAX);

    DECLARE cur_bp_dpca CURSOR LOCAL FAST_FORWARD FOR
        SELECT dc.name
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[business_partners]') AND c.name = 'down_payment_clearing_account';
    OPEN cur_bp_dpca;
    FETCH NEXT FROM cur_bp_dpca INTO @constraintName1;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            SET @sql1 = 'ALTER TABLE [dbo].[business_partners] DROP CONSTRAINT [' + @constraintName1 + ']';
            EXEC sp_executesql @sql1;
        END TRY
        BEGIN CATCH
            PRINT 'Skipping stale constraint reference: ' + @constraintName1 + ' — ' + ERROR_MESSAGE();
        END CATCH
        FETCH NEXT FROM cur_bp_dpca INTO @constraintName1;
    END
    CLOSE cur_bp_dpca;
    DEALLOCATE cur_bp_dpca;

    ALTER TABLE [dbo].[business_partners] DROP COLUMN [down_payment_clearing_account];
END;

-- AlterTable: business_partner_addresses — replace the single free-text
-- `address` column with the structured field set the Addresses tab now
-- collects (Address Name, Street, Street No, Building/Floor/Room, Block,
-- Country, State, City, Zip Code, Tax Office, GST Number). Dropped rather
-- than kept alongside per request — this is still dev/test data, so there is
-- nothing worth preserving in the old free-text column.
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[business_partner_addresses]') AND name = 'address')
BEGIN
    DECLARE @constraintName2 SYSNAME;
    DECLARE @sql2 NVARCHAR(MAX);

    DECLARE cur_bpa_addr CURSOR LOCAL FAST_FORWARD FOR
        SELECT dc.name
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[business_partner_addresses]') AND c.name = 'address';
    OPEN cur_bpa_addr;
    FETCH NEXT FROM cur_bpa_addr INTO @constraintName2;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            SET @sql2 = 'ALTER TABLE [dbo].[business_partner_addresses] DROP CONSTRAINT [' + @constraintName2 + ']';
            EXEC sp_executesql @sql2;
        END TRY
        BEGIN CATCH
            PRINT 'Skipping stale constraint reference: ' + @constraintName2 + ' — ' + ERROR_MESSAGE();
        END CATCH
        FETCH NEXT FROM cur_bpa_addr INTO @constraintName2;
    END
    CLOSE cur_bpa_addr;
    DEALLOCATE cur_bpa_addr;

    ALTER TABLE [dbo].[business_partner_addresses] DROP COLUMN [address];
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[business_partner_addresses]') AND name = 'address_name')
BEGIN
    ALTER TABLE [dbo].[business_partner_addresses] ADD [address_name] NVARCHAR(150) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[business_partner_addresses]') AND name = 'street')
BEGIN
    ALTER TABLE [dbo].[business_partner_addresses] ADD [street] NVARCHAR(150) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[business_partner_addresses]') AND name = 'street_no')
BEGIN
    ALTER TABLE [dbo].[business_partner_addresses] ADD [street_no] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[business_partner_addresses]') AND name = 'building_floor_room')
BEGIN
    ALTER TABLE [dbo].[business_partner_addresses] ADD [building_floor_room] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[business_partner_addresses]') AND name = 'block')
BEGIN
    ALTER TABLE [dbo].[business_partner_addresses] ADD [block] NVARCHAR(50) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[business_partner_addresses]') AND name = 'country')
BEGIN
    ALTER TABLE [dbo].[business_partner_addresses] ADD [country] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[business_partner_addresses]') AND name = 'state')
BEGIN
    ALTER TABLE [dbo].[business_partner_addresses] ADD [state] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[business_partner_addresses]') AND name = 'city')
BEGIN
    ALTER TABLE [dbo].[business_partner_addresses] ADD [city] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[business_partner_addresses]') AND name = 'zip_code')
BEGIN
    ALTER TABLE [dbo].[business_partner_addresses] ADD [zip_code] NVARCHAR(20) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[business_partner_addresses]') AND name = 'tax_office')
BEGIN
    ALTER TABLE [dbo].[business_partner_addresses] ADD [tax_office] NVARCHAR(100) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[business_partner_addresses]') AND name = 'gst_number')
BEGIN
    ALTER TABLE [dbo].[business_partner_addresses] ADD [gst_number] NVARCHAR(15) NULL;
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
