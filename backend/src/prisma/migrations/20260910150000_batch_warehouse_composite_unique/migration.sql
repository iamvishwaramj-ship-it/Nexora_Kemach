BEGIN TRY

BEGIN TRAN;

-- product_batches.batch_no moves from unique BY ITSELF to unique per
-- (batch_no, warehouse). A Stock Transfer can now move PART of a batch's
-- quantity into a second warehouse while the remainder stays behind under
-- the same batch number — so the same batch number legitimately needs one
-- row per warehouse it currently has stock in, rather than exactly one row
-- system-wide. See the schema comment on ProductBatch and
-- applyBatchSerialRelocateEffects in utils/businessRules.js.
--
-- Guarded so this is safe to run whether or not the old index exists —
-- same convention as the earlier batch/serial-global-unique migration.
IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UQ_product_batches_batch_no'
      AND object_id = OBJECT_ID(N'[dbo].[product_batches]')
)
BEGIN
    DROP INDEX [UQ_product_batches_batch_no] ON [dbo].[product_batches];
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UQ_product_batches_batch_no_warehouse'
      AND object_id = OBJECT_ID(N'[dbo].[product_batches]')
)
BEGIN
    CREATE UNIQUE INDEX [UQ_product_batches_batch_no_warehouse]
        ON [dbo].[product_batches] ([batch_no], [warehouse]);
END;

-- batch_no is no longer covered by a unique index on its own — every
-- lookup that still searches by batch_no alone (GRN duplicate checks,
-- Issue/Restock quantity effects, the availability check) needs this to
-- stay fast now that it's a plain (non-unique) filter instead of a unique
-- point lookup.
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_product_batches_batch_no'
      AND object_id = OBJECT_ID(N'[dbo].[product_batches]')
)
BEGIN
    CREATE INDEX [IX_product_batches_batch_no]
        ON [dbo].[product_batches] ([batch_no]);
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
