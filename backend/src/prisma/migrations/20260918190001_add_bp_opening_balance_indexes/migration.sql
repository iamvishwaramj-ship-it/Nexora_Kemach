BEGIN TRY

BEGIN TRAN;

-- CreateIndex: business_partner_opening_balances — status and document_date
-- are the two columns GET /business-partner-opening-balance (the list
-- endpoint) actually filters/sorts by (`where.status`, `where.documentDate.
-- gte/lte`, `orderBy: [{ documentDate: 'desc' }, { id: 'desc' }]`), on top of
-- the existing bp_code/document_number indexes (used by findMany/deleteMany
-- keyed on documentNumber for edit/delete).
--
-- bp_type is deliberately NOT indexed here, and no bp_type+document_date
-- composite is added either: every current query against this table
-- (routes/resources.js) was checked and none of them filters by bp_type, so
-- either index would only add write overhead with nothing to serve today.
-- Add one later if a bp_type filter/report actually needs it.
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_bp_opening_balances_status'
      AND object_id = OBJECT_ID(N'[dbo].[business_partner_opening_balances]')
)
BEGIN
    CREATE INDEX [IX_bp_opening_balances_status]
        ON [dbo].[business_partner_opening_balances] ([status]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_bp_opening_balances_document_date'
      AND object_id = OBJECT_ID(N'[dbo].[business_partner_opening_balances]')
)
BEGIN
    CREATE INDEX [IX_bp_opening_balances_document_date]
        ON [dbo].[business_partner_opening_balances] ([document_date]);
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
