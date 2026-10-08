BEGIN TRY

BEGIN TRAN;

-- AlterForeignKey: follow_ups_enquiry_id_fkey -- was ON DELETE CASCADE,
-- which meant deleting an Enquiry silently took every follow-up logged
-- against it down with it: real history of calls/emails/meetings a
-- salesperson made, gone with no warning and no way to recover it.
-- Restrict (SQL Server: NO ACTION) makes that delete fail at the database
-- instead, so removing an enquiry that still has follow-ups on it requires
-- dealing with them first rather than losing them as a side effect.
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'follow_ups_enquiry_id_fkey')
BEGIN
    ALTER TABLE [dbo].[follow_ups] DROP CONSTRAINT [follow_ups_enquiry_id_fkey];
END;

ALTER TABLE [dbo].[follow_ups] ADD CONSTRAINT [follow_ups_enquiry_id_fkey]
    FOREIGN KEY ([enquiry_id]) REFERENCES [dbo].[enquiries]([id]) ON DELETE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH;
