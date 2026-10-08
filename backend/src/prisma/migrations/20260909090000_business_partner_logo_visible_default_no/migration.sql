BEGIN TRY

BEGIN TRAN;

-- Business Partner: newly-created partners now default Logo Visibility to
-- No instead of Yes — printing a supplier's logo alongside KEMACH's on a
-- sales document is now something each partner opts INTO, not out of.
-- Existing partners keep whatever Logo Visibility they already have
-- (this only changes the column-level default used when a new row is
-- created without an explicit value) — see the original DEFAULT 1 added in
-- 20260908170000_business_partner_logo_visible.
IF NOT EXISTS (
    SELECT 1 FROM sys.default_constraints WHERE name = 'DF_business_partners_logo_visible'
)
BEGIN
    DECLARE @constraintName NVARCHAR(200);
    SELECT @constraintName = dc.name
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[business_partners]') AND c.name = 'logo_visible';

    IF @constraintName IS NOT NULL
    BEGIN
        EXEC('ALTER TABLE [dbo].[business_partners] DROP CONSTRAINT [' + @constraintName + ']');
    END;

    ALTER TABLE [dbo].[business_partners] ADD CONSTRAINT [DF_business_partners_logo_visible] DEFAULT 0 FOR [logo_visible];
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
