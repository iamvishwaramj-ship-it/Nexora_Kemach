BEGIN TRY

BEGIN TRAN;

-- AlterTable: journal_entries — drop bp_project, trans_no, trans_code.
--
-- Removed on request together with their inputs on the form (see
-- JournalEntry.jsx) and their entries in journalEntrySchema
-- (frontend/src/lib/validation/accountingSchemas.js). None of these fed
-- posting or G/L determination, so there is no downstream fallback to
-- account for. Origin/Origin No. from the same screen were never stored
-- columns to begin with (see schema.prisma), so there is nothing to drop
-- for those two.
--
-- None of these three columns carry a default constraint (all nullable,
-- no DEFAULT), so a plain guarded DROP COLUMN is enough — no constraint
-- cursor needed, unlike tax_amount/gross_value below.
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[journal_entries]') AND name = 'bp_project')
BEGIN
    ALTER TABLE [dbo].[journal_entries] DROP COLUMN [bp_project];
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[journal_entries]') AND name = 'trans_no')
BEGIN
    ALTER TABLE [dbo].[journal_entries] DROP COLUMN [trans_no];
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[journal_entries]') AND name = 'trans_code')
BEGIN
    ALTER TABLE [dbo].[journal_entries] DROP COLUMN [trans_code];
END;

-- AlterTable: journal_entry_lines — drop tax_group, tax_amount, gross_value.
--
-- Removed on request together with the Tax Group input and the Tax
-- Amount/Gross Value display columns on the Journal Lines grid (see
-- JournalEntry.jsx) and their computation in toJournalEntryLineData
-- (routes/resources.js). debit_sc/credit_sc/base_amount stay — only the
-- tax trio goes.
--
-- tax_amount and gross_value were added NOT NULL with a DEFAULT
-- constraint (see 20260824120000_journal_entry_extra_fields), so each
-- needs its default constraint dropped before the column itself will
-- drop. tax_group is nullable with no default. Same per-column,
-- per-constraint TRY/CATCH cursor pattern as
-- 20260823200000_drop_product_factor_fields: isolates each default
-- constraint drop so a stale/orphaned catalog entry on one column can't
-- abort the whole migration; the DROP COLUMN right after each loop is
-- what actually matters.
DECLARE @constraintName SYSNAME;
DECLARE @sql NVARCHAR(MAX);

-- tax_group -------------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[journal_entry_lines]') AND name = 'tax_group')
BEGIN
    ALTER TABLE [dbo].[journal_entry_lines] DROP COLUMN [tax_group];
END;

-- tax_amount --------------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[journal_entry_lines]') AND name = 'tax_amount')
BEGIN
    DECLARE cur_tax_amount CURSOR LOCAL FAST_FORWARD FOR
        SELECT dc.name
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[journal_entry_lines]') AND c.name = 'tax_amount';
    OPEN cur_tax_amount;
    FETCH NEXT FROM cur_tax_amount INTO @constraintName;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            SET @sql = 'ALTER TABLE [dbo].[journal_entry_lines] DROP CONSTRAINT [' + @constraintName + ']';
            EXEC sp_executesql @sql;
        END TRY
        BEGIN CATCH
            PRINT 'Skipping stale constraint reference: ' + @constraintName + ' — ' + ERROR_MESSAGE();
        END CATCH
        FETCH NEXT FROM cur_tax_amount INTO @constraintName;
    END
    CLOSE cur_tax_amount;
    DEALLOCATE cur_tax_amount;

    ALTER TABLE [dbo].[journal_entry_lines] DROP COLUMN [tax_amount];
END;

-- gross_value -------------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[journal_entry_lines]') AND name = 'gross_value')
BEGIN
    DECLARE cur_gross_value CURSOR LOCAL FAST_FORWARD FOR
        SELECT dc.name
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[journal_entry_lines]') AND c.name = 'gross_value';
    OPEN cur_gross_value;
    FETCH NEXT FROM cur_gross_value INTO @constraintName;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            SET @sql = 'ALTER TABLE [dbo].[journal_entry_lines] DROP CONSTRAINT [' + @constraintName + ']';
            EXEC sp_executesql @sql;
        END TRY
        BEGIN CATCH
            PRINT 'Skipping stale constraint reference: ' + @constraintName + ' — ' + ERROR_MESSAGE();
        END CATCH
        FETCH NEXT FROM cur_gross_value INTO @constraintName;
    END
    CLOSE cur_gross_value;
    DEALLOCATE cur_gross_value;

    ALTER TABLE [dbo].[journal_entry_lines] DROP COLUMN [gross_value];
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
