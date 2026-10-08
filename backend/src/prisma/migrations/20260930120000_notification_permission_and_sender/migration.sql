BEGIN TRY

BEGIN TRAN;

-- Notification permission + sender tracking for the Notification bell.
--
-- 1) user_permissions.can_notify — the new "Notification" column in User
--    Management's permission grid. Existing rows become false, i.e. nobody
--    but admins (who are always notified) receives anything until an admin
--    ticks the box.
--
-- 2) stock_transfer_requests.created_by_id — who raised the request, so the
--    approval result can be notified back and the sender is excluded from
--    their own recipient list. Nullable: legacy rows stay NULL and simply
--    get no result notification.
--
-- 3) notifications.type already exists (see 20260912120000). Values in use:
--    'ApprovalRequest' (actionable) and 'ApprovalResult' (informational).
--    An index over (reference_type, reference_id, type) backs the
--    per-request sibling sync / cleanup / dedupe lookups.
--
-- Guarded throughout so this is safe to re-run.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[user_permissions]') AND name = 'can_notify')
BEGIN
    ALTER TABLE [dbo].[user_permissions] ADD [can_notify] BIT NOT NULL CONSTRAINT [DF_user_permissions_can_notify] DEFAULT 0;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_requests]') AND name = 'created_by_id')
BEGIN
    ALTER TABLE [dbo].[stock_transfer_requests] ADD [created_by_id] INT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_stock_transfer_requests_created_by')
BEGIN
    ALTER TABLE [dbo].[stock_transfer_requests] ADD CONSTRAINT [FK_stock_transfer_requests_created_by]
        FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[app_users]([id]);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_stock_transfer_request_created_by' AND object_id = OBJECT_ID(N'[dbo].[stock_transfer_requests]'))
BEGIN
    CREATE INDEX [ix_stock_transfer_request_created_by] ON [dbo].[stock_transfer_requests]([created_by_id]);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'notifications_reference_type_reference_id_type_idx' AND object_id = OBJECT_ID(N'[dbo].[notifications]'))
BEGIN
    CREATE INDEX [notifications_reference_type_reference_id_type_idx] ON [dbo].[notifications]([reference_type], [reference_id], [type]);
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
