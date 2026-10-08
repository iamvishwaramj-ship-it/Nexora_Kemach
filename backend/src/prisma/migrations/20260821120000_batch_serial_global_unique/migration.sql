BEGIN TRY

BEGIN TRAN;

-- AlterTable: product_serials
-- Drops mfr_serial_no — the dialog no longer collects it, Serial No is the
-- one identifying field a row can have.
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[product_serials]') AND name = 'mfr_serial_no'
)
BEGIN
    ALTER TABLE [dbo].[product_serials] DROP COLUMN [mfr_serial_no];
END;

-- product_batches.batch_no and product_serials.serial_no move from
-- unique-per-product to unique across the whole table: a batch or serial
-- number must never collide with another product's either. Each rebuild
-- drops the old composite unique index (if the previous migration created
-- it) and creates the new single-column one, guarded so this is safe to run
-- whether or not the old index exists.
IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UQ_product_batches_product_batch_no'
      AND object_id = OBJECT_ID(N'[dbo].[product_batches]')
)
BEGIN
    DROP INDEX [UQ_product_batches_product_batch_no] ON [dbo].[product_batches];
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UQ_product_batches_batch_no'
      AND object_id = OBJECT_ID(N'[dbo].[product_batches]')
)
BEGIN
    CREATE UNIQUE INDEX [UQ_product_batches_batch_no]
        ON [dbo].[product_batches] ([batch_no]);
END;

IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UQ_product_serials_product_serial_no'
      AND object_id = OBJECT_ID(N'[dbo].[product_serials]')
)
BEGIN
    DROP INDEX [UQ_product_serials_product_serial_no] ON [dbo].[product_serials];
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UQ_product_serials_serial_no'
      AND object_id = OBJECT_ID(N'[dbo].[product_serials]')
)
BEGIN
    CREATE UNIQUE INDEX [UQ_product_serials_serial_no]
        ON [dbo].[product_serials] ([serial_no]);
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
