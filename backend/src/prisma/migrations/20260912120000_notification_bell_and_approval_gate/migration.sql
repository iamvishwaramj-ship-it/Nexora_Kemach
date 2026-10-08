BEGIN TRY

BEGIN TRAN;

-- Notification bell + approval-gated Stock Transfer feature.
--
-- 1) New `notifications` table — one row per recipient per approval-worthy
--    event. Currently emitted only for StockTransferRequest creation
--    (reference_type 'StockTransferRequest', reference_id =
--    stock_transfer_requests.id) — see utils/approverResolution.js and
--    routes/resources.js. Generic (reference_type/reference_id) so it can be
--    reused for other transactions later without another schema change.
--
-- 2) `stock_transfer_requests.approval_status` / `approver_id` /
--    `approved_at` — the approval gate itself: set to 'Pending' on create,
--    flipped to 'Approved'/'Rejected' via POST /notifications/:id/approve|
--    reject.
--
-- 3) `stock_transfers.approval_status` — copied from the referenced
--    StockTransferRequest (matched via request_no) at Transfer-creation
--    time; defaults to 'Approved' when there is no request_no, so the
--    pre-existing ad-hoc/no-request Transfer flow keeps working unchanged.
--    syncStockTransferClosure (routes/resources.js) refuses to post
--    stock/GL for a transfer whose approval_status isn't 'Approved'.
--
-- Guarded throughout so this is safe to re-run without erroring on state it
-- already produced.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_requests]') AND name = 'approval_status')
BEGIN
    ALTER TABLE [dbo].[stock_transfer_requests] ADD [approval_status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_stock_transfer_requests_approval_status] DEFAULT ('Pending');
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_requests]') AND name = 'approver_id')
BEGIN
    ALTER TABLE [dbo].[stock_transfer_requests] ADD [approver_id] INT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfer_requests]') AND name = 'approved_at')
BEGIN
    ALTER TABLE [dbo].[stock_transfer_requests] ADD [approved_at] DATETIME2 NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_stock_transfer_requests_approver')
BEGIN
    ALTER TABLE [dbo].[stock_transfer_requests] ADD CONSTRAINT [FK_stock_transfer_requests_approver]
        FOREIGN KEY ([approver_id]) REFERENCES [dbo].[app_users]([id]);
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[stock_transfers]') AND name = 'approval_status')
BEGIN
    ALTER TABLE [dbo].[stock_transfers] ADD [approval_status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_stock_transfers_approval_status] DEFAULT ('Approved');
END;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'notifications')
BEGIN
    CREATE TABLE [dbo].[notifications] (
        [id]             INT IDENTITY(1,1) NOT NULL,
        [user_id]        INT NOT NULL,
        [type]           NVARCHAR(50) NOT NULL,
        [title]          NVARCHAR(200) NOT NULL,
        [message]        NVARCHAR(MAX) NULL,
        [reference_type] NVARCHAR(50) NOT NULL,
        [reference_id]   INT NOT NULL,
        [status]         NVARCHAR(20) NOT NULL CONSTRAINT [DF_notifications_status] DEFAULT ('Unread'),
        [action_status]  NVARCHAR(20) NULL,
        [created_at]     DATETIME2 NOT NULL CONSTRAINT [DF_notifications_created_at] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_notifications] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_notifications_user')
BEGIN
    ALTER TABLE [dbo].[notifications] ADD CONSTRAINT [FK_notifications_user]
        FOREIGN KEY ([user_id]) REFERENCES [dbo].[app_users]([id]) ON DELETE CASCADE;
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'notifications_user_id_status_idx' AND object_id = OBJECT_ID(N'[dbo].[notifications]'))
BEGIN
    CREATE INDEX [notifications_user_id_status_idx] ON [dbo].[notifications]([user_id], [status]);
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
