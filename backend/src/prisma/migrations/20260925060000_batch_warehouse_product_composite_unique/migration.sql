BEGIN TRY

BEGIN TRAN;

-- product_batches moves from unique (batch_no, warehouse) to unique
-- (batch_no, warehouse, product_code).
--
-- Purchase GRN's batch duplicate check is now scoped to the GRN document
-- itself, not the item/warehouse (see assertUniqueBatchesAndSerials's
-- 'grn' batchScope in utils/businessRules.js) — the SAME batch number is
-- explicitly allowed to appear on more than one line of the SAME GRN, for
-- different products and/or the same warehouse (e.g. two different items
-- both received into CAL200 under batch 2627 on one GRN). The old
-- (batch_no, warehouse) index made that a hard DB-level collision the
-- moment two different products' lines shared a batch+warehouse, even
-- though the application-level check had already allowed it — see the
-- product_batches insert this was blocking.
--
-- Scoping the uniqueness to (batch_no, warehouse, product_code) instead
-- keeps exactly one row per product's own stock of a batch in a
-- warehouse (still one running-quantity row per physical lot-and-product,
-- which findBatchRow/updateBatchQuantity and every Batch Selection/Stock
-- Transfer/Sales Return flow still depend on), while letting two
-- different products legitimately share the same batch number in the
-- same warehouse — which is now possible precisely because the GRN-level
-- check no longer treats that as a duplicate.
--
-- Guarded so this is safe to run whether or not the old index exists —
-- same convention as the earlier batch-uniqueness migrations.
IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UQ_product_batches_batch_no_warehouse'
      AND object_id = OBJECT_ID(N'[dbo].[product_batches]')
)
BEGIN
    DROP INDEX [UQ_product_batches_batch_no_warehouse] ON [dbo].[product_batches];
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UQ_product_batches_batch_no_warehouse_product'
      AND object_id = OBJECT_ID(N'[dbo].[product_batches]')
)
BEGIN
    CREATE UNIQUE INDEX [UQ_product_batches_batch_no_warehouse_product]
        ON [dbo].[product_batches] ([batch_no], [warehouse], [product_code]);
END;

-- batch_no + warehouse is no longer covered by a unique index of its own
-- (only the three-column one above is unique now) — the cross-GRN
-- duplicate check and findBatchRow's own (batch_no, warehouse) lookup
-- still filter on this pair alone, so keep it indexed for that.
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_product_batches_batch_no_warehouse'
      AND object_id = OBJECT_ID(N'[dbo].[product_batches]')
)
BEGIN
    CREATE INDEX [IX_product_batches_batch_no_warehouse]
        ON [dbo].[product_batches] ([batch_no], [warehouse]);
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
