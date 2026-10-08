BEGIN TRY

BEGIN TRAN;

-- AddColumn: price_lists.type
--
-- Distinguishes which document type a price list feeds: DLP (Dealer/
-- Distributor Price List) drives Purchase Unit Price auto-fill, CLP
-- (Customer Price List) drives Sales Unit Price auto-fill. MRP/Other are
-- informational only for now.
--
-- Kept in its own migration, separate from the backfill/index that follow:
-- SQL Server compiles a batch against the schema as it stood when the batch
-- started, so a later statement in the SAME batch referencing this brand-new
-- column fails with "Invalid column name 'type'" (error 207) even though the
-- ALTER TABLE above it already ran — same reason
-- 20260820120000_add_base_document_fields / ..._backfill_base_document_fields
-- are two separate migrations rather than one.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[price_lists]') AND name = 'type'
)
BEGIN
    ALTER TABLE [dbo].[price_lists]
      ADD [type] NVARCHAR(10) NOT NULL CONSTRAINT [DF_price_lists_type] DEFAULT 'Other';
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
