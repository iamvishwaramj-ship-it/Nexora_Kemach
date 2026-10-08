BEGIN TRY

BEGIN TRAN;

-- ---------------------------------------------------------------------------
-- Document relationship fields ("Copy From"), on every sales and purchase
-- LINE-ITEM table.
--
-- Modelled on SAP Business One's DocumentLines: a line copied from another
-- document records where it came from, so the link is per LINE rather than
-- per document. That matters because one document legitimately draws from
-- several sources — an invoice can consolidate two GRNs, and only a per-line
-- reference can say which line came from which.
--
--   base_type   the SOURCE document's type   ('Purchase Quotation', ...)
--   base_entry  the SOURCE document's internal id (its DocEntry / PK)
--   base_no     the SOURCE document's visible number ('PQ-26-27-000002')
--   base_line   the SOURCE line's position within that document (1-based)
--
-- base_entry and base_no are BOTH kept on purpose. The id is stable if a
-- document is ever renumbered; the number is what a person recognises and
-- what the rest of this schema already joins on. Storing only one would mean
-- either an unreadable link or a fragile one.
--
-- Always the IMMEDIATE predecessor, never the origin of the chain: a line on
-- a Purchase Invoice copied from a GRN names the GRN, even though a quotation
-- began the flow. Walking further back is the Route Map's job.
--
-- All four are NULLable with no default: a line typed in by hand has no base
-- document, and that absence is meaningful — it is exactly what distinguishes
-- a manually entered line from a copied one.
--
-- Sales Enquiry is absent from this list because it has no line-item table at
-- all — it records its requirement as free text on the header. It is also the
-- head of the sales chain, so it could never have had a base document.
-- ---------------------------------------------------------------------------

DECLARE @line_tables TABLE (name SYSNAME);
INSERT INTO @line_tables (name) VALUES
    -- Purchase
    (N'purchase_quotation_items'),
    (N'purchase_order_items'),
    (N'goods_received_note_items'),
    (N'purchase_invoice_items'),
    (N'purchase_return_items'),
    (N'purchase_credit_memo_items'),
    -- Sales
    (N'sales_quotation_items'),
    (N'sales_order_items'),
    (N'delivery_challan_items'),
    (N'sales_invoice_items'),
    (N'sales_return_items'),
    (N'sales_credit_memo_items');

DECLARE @t SYSNAME, @sql NVARCHAR(MAX);
DECLARE tbl CURSOR LOCAL FAST_FORWARD FOR SELECT name FROM @line_tables;
OPEN tbl;
FETCH NEXT FROM tbl INTO @t;

WHILE @@FETCH_STATUS = 0
BEGIN
    -- Guarded per column, not per table: a table may have been part-patched by
    -- an earlier partial run, and re-running must repair it rather than fail.
    IF OBJECT_ID(N'[dbo].[' + @t + N']') IS NOT NULL
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM sys.columns
                       WHERE object_id = OBJECT_ID(N'[dbo].[' + @t + N']') AND name = 'base_type')
        BEGIN
            SET @sql = N'ALTER TABLE [dbo].[' + @t + N'] ADD [base_type] NVARCHAR(50) NULL;';
            EXEC sp_executesql @sql;
        END;

        IF NOT EXISTS (SELECT 1 FROM sys.columns
                       WHERE object_id = OBJECT_ID(N'[dbo].[' + @t + N']') AND name = 'base_entry')
        BEGIN
            SET @sql = N'ALTER TABLE [dbo].[' + @t + N'] ADD [base_entry] INT NULL;';
            EXEC sp_executesql @sql;
        END;

        IF NOT EXISTS (SELECT 1 FROM sys.columns
                       WHERE object_id = OBJECT_ID(N'[dbo].[' + @t + N']') AND name = 'base_no')
        BEGIN
            SET @sql = N'ALTER TABLE [dbo].[' + @t + N'] ADD [base_no] NVARCHAR(50) NULL;';
            EXEC sp_executesql @sql;
        END;

        IF NOT EXISTS (SELECT 1 FROM sys.columns
                       WHERE object_id = OBJECT_ID(N'[dbo].[' + @t + N']') AND name = 'base_line')
        BEGIN
            SET @sql = N'ALTER TABLE [dbo].[' + @t + N'] ADD [base_line] INT NULL;';
            EXEC sp_executesql @sql;
        END;
    END;

    FETCH NEXT FROM tbl INTO @t;
END;

CLOSE tbl;
DEALLOCATE tbl;

-- ---------------------------------------------------------------------------
-- Adding the columns is ALL this migration does. The backfill that populates
-- them lives in the next migration, and that separation is required, not
-- tidiness:
--
-- SQL Server binds an entire batch before it executes any of it. The ALTERs
-- above are dynamic (sp_executesql), so they are compiled only when they run
-- — but a static `UPDATE ... SET base_entry = ...` in this same batch is
-- bound up front, against a table that does not have the column yet. The
-- whole script is then rejected with
--
--     Msg 207: Invalid column name 'base_entry'
--
-- before a single column is added. Splitting the work into two migrations
-- puts the backfill in its own batch, compiled after this one has committed
-- and the columns genuinely exist.
-- ---------------------------------------------------------------------------

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;

THROW

END CATCH
