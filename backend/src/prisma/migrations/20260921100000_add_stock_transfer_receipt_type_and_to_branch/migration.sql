BEGIN TRY

BEGIN TRAN;

-- AlterTable: stock_transfer_receipts — add transfer_type and to_branch,
-- mirroring stock_transfers/stock_transfer_requests. transferType 'Branch
-- Transfer' splits the single Branch field into two: the existing `branch`
-- column doubles as "From Branch" and this new `to_branch` column is
-- "To Branch". For a plain 'Stock Transfer' receipt, transfer_type stays at
-- its default and to_branch stays null/unused.
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_receipts]') AND name = 'transfer_type')
BEGIN
    ALTER TABLE [dbo].[stock_transfer_receipts] ADD [transfer_type] NVARCHAR(50) NOT NULL CONSTRAINT [DF_strc_transfer_type] DEFAULT 'Stock Transfer';
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_receipts]') AND name = 'to_branch')
BEGIN
    ALTER TABLE [dbo].[stock_transfer_receipts] ADD [to_branch] NVARCHAR(150) NULL;
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
