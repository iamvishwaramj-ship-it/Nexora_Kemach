BEGIN TRY

BEGIN TRAN;

-- Retire Customer Master / Supplier Master.
--
-- Business Partner (business_partners, added in 20260823220000) is now the
-- single source for customer/vendor records — filtered by partner_type
-- 'Customer' / 'Vendor'. The customers/suppliers tables, and the app code
-- that read them directly, are retired in the same change (see
-- utils/glPosting.js, utils/businessRules.js, utils/routeMap.js,
-- routes/resources.js, routes/dashboard.js). Fields the two old masters had
-- that Business Partner does not (discount %, price list, GSTIN/PAN,
-- Aadhaar, MSME No., city/state, supplier bank details, customer/supplier
-- "group" classification) are not carried forward — pages that showed them
-- lose that capability. openingBalance/outstandingBalance ARE carried
-- forward (added to business_partners below) because Receivables/Payables
-- Outstanding and the credit-limit check depend on them being live per
-- partner.

-- AlterTable: business_partners — add opening_balance, outstanding_balance.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[business_partners]') AND name = 'opening_balance')
BEGIN
    ALTER TABLE [dbo].[business_partners] ADD [opening_balance] DECIMAL(15,2) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[business_partners]') AND name = 'outstanding_balance')
BEGIN
    ALTER TABLE [dbo].[business_partners] ADD [outstanding_balance] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_business_partners_outstanding_balance] DEFAULT 0;
END;

-- AlterTable: journal_entry_lines — add the new Business Partner column
-- (Customer/Vendor tag per line, for AR/AP control-account reconciliation).
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[journal_entry_lines]') AND name = 'business_partner_code')
BEGIN
    ALTER TABLE [dbo].[journal_entry_lines] ADD [business_partner_code] NVARCHAR(50) NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[journal_entry_lines]') AND name = 'business_partner_name')
BEGIN
    ALTER TABLE [dbo].[journal_entry_lines] ADD [business_partner_name] NVARCHAR(150) NULL;
END;

-- AlterTable: GLAccountDeterminations — DefaultCustomerID (an Int FK into
-- the retired customers table) becomes DefaultCustomerCode, following this
-- schema's usual cross-master-by-code convention (see Branch.defaultCustomer)
-- now that the FK target is gone. Existing values are looked up against
-- customers.id and translated to the matching customer_code before the old
-- column is dropped, so a configured default customer survives the cutover.
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[GLAccountDeterminations]') AND name = 'DefaultCustomerID')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[GLAccountDeterminations]') AND name = 'DefaultCustomerCode')
    BEGIN
        ALTER TABLE [dbo].[GLAccountDeterminations] ADD [DefaultCustomerCode] NVARCHAR(50) NULL;
    END;

    -- Run as dynamic SQL, not a plain statement in this batch. SQL Server
    -- binds every statement in an ad-hoc batch against the schema as it
    -- stood when the batch STARTED, so a column added by the ALTER TABLE
    -- immediately above it is invisible to a later statement in the very
    -- same batch — "Invalid column name 'DefaultCustomerCode'" — even
    -- though the ALTER already ran. sp_executesql compiles its string
    -- separately at execution time, once the column genuinely exists, which
    -- is exactly what the FK-drop below already does for the same reason.
    IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'customers')
    BEGIN
        EXEC sp_executesql N'
            UPDATE gad
            SET gad.[DefaultCustomerCode] = c.[customer_code]
            FROM [dbo].[GLAccountDeterminations] gad
            JOIN [dbo].[customers] c ON c.[id] = gad.[DefaultCustomerID]
            WHERE gad.[DefaultCustomerID] IS NOT NULL;
        ';
    END;

    -- Drop the FK into customers before dropping the column it constrains.
    DECLARE @fkName SYSNAME;
    DECLARE @fkSql NVARCHAR(MAX);
    DECLARE cur_gad_fk CURSOR LOCAL FAST_FORWARD FOR
        SELECT fk.name
        FROM sys.foreign_keys fk
        JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
        JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
        WHERE fk.parent_object_id = OBJECT_ID(N'[dbo].[GLAccountDeterminations]') AND c.name = 'DefaultCustomerID';
    OPEN cur_gad_fk;
    FETCH NEXT FROM cur_gad_fk INTO @fkName;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            SET @fkSql = 'ALTER TABLE [dbo].[GLAccountDeterminations] DROP CONSTRAINT [' + @fkName + ']';
            EXEC sp_executesql @fkSql;
        END TRY
        BEGIN CATCH
            PRINT 'Skipping stale FK reference: ' + @fkName + ' — ' + ERROR_MESSAGE();
        END CATCH
        FETCH NEXT FROM cur_gad_fk INTO @fkName;
    END
    CLOSE cur_gad_fk;
    DEALLOCATE cur_gad_fk;

    ALTER TABLE [dbo].[GLAccountDeterminations] DROP COLUMN [DefaultCustomerID];
END;

-- Stray numbering series for the retired CUS/SUP master codes, if this
-- database's Document Numbering self-heal ever created one — Business
-- Partner has always had its own separate C/S-prefixed numbering
-- (nextBusinessPartnerCode in routes/resources.js), never wired through
-- this catalog, so nothing else refers to these rows.
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'document_numbering')
BEGIN
    DELETE FROM [dbo].[document_numbering] WHERE [document_code] IN ('CUS', 'SUP');
END;

-- DropTable: suppliers, customers. No other table's FK points at either
-- (GLAccountDeterminations.DefaultCustomerID, handled above, was the only
-- one) — every other reference in the app was already by name/code, not FK.
IF OBJECT_ID(N'[dbo].[suppliers]', 'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[suppliers];
END;

IF OBJECT_ID(N'[dbo].[customers]', 'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[customers];
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
