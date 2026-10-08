BEGIN TRY

BEGIN TRAN;

-- CreateIndex: business_partner_opening_balances — bp_name and ref_1, the
-- two columns GET /business-partner-opening-balance's own OR search
-- (document_number/bp_code/bp_name/ref_1 — see that route) reaches for that
-- weren't already indexed by 20260918190001_add_bp_opening_balance_indexes
-- (status/document_date) or the original bp_code/document_number indexes.
--
-- Same caveat as those: SQL Server can't index-seek a leading-wildcard LIKE
-- '%term%' (Prisma's `contains`) no matter what's indexed here — that would
-- need a Full-Text Index, not a plain one, and isn't attempted in this
-- change. What these two DO buy: ORDER BY/lookups on bp_name or ref_1 on
-- their own (a future exact-match filter, a sort), and — same as the
-- status/document_date pair before them — they cost nothing meaningful on
-- a table this write-light (one insert per BP line per document save, never
-- a hot write path).
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_bp_opening_balances_bp_name'
      AND object_id = OBJECT_ID(N'[dbo].[business_partner_opening_balances]')
)
BEGIN
    CREATE INDEX [IX_bp_opening_balances_bp_name]
        ON [dbo].[business_partner_opening_balances] ([bp_name]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_bp_opening_balances_ref_1'
      AND object_id = OBJECT_ID(N'[dbo].[business_partner_opening_balances]')
)
BEGIN
    CREATE INDEX [IX_bp_opening_balances_ref_1]
        ON [dbo].[business_partner_opening_balances] ([ref_1]);
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
