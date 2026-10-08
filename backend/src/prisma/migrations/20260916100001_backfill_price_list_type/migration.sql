BEGIN TRY

BEGIN TRAN;

-- Backfill: best-effort guess from the existing price list names (e.g. a
-- list named "DLP - 2026" becomes type 'DLP'). Everything else stays
-- 'Other' from the column default added in the previous migration — go to
-- Product Setup > Price List after this runs and confirm/set the correct
-- type on each existing list, since a name-based guess cannot be fully
-- trusted. Only touches rows still at the default, so re-running this is
-- safe and never overwrites a type someone has since set by hand.
UPDATE [dbo].[price_lists]
   SET [type] = 'DLP'
 WHERE [type] = 'Other' AND [price_list_name] LIKE '%DLP%';

UPDATE [dbo].[price_lists]
   SET [type] = 'CLP'
 WHERE [type] = 'Other' AND [price_list_name] LIKE '%CLP%';

UPDATE [dbo].[price_lists]
   SET [type] = 'MRP'
 WHERE [type] = 'Other' AND [price_list_name] LIKE '%MRP%';

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'price_lists_type_status_effective_date_idx'
      AND object_id = OBJECT_ID(N'[dbo].[price_lists]')
)
BEGIN
    CREATE INDEX [price_lists_type_status_effective_date_idx]
      ON [dbo].[price_lists]([type], [status], [effective_date]);
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
