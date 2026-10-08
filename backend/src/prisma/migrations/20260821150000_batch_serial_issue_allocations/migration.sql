BEGIN TRY

BEGIN TRAN;

-- CreateTable: batch_allocations / serial_allocations
--
-- The "Selection" counterpart to product_batches / product_serials: those
-- two tables record a batch/serial being CREATED (Purchase GRN, Stock
-- Receipt); these two record one being SPENT — picked from what's already on
-- hand via the "Batches Number - Selection" / "Serial Numbers - Selection"
-- dialog on a Delivery Challan or Stock Issue line. See the schema.prisma
-- comments on BatchAllocation/SerialAllocation for the full rationale.
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[batch_allocations]') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[batch_allocations] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [batch_no] NVARCHAR(100) NOT NULL,
        [product_code] NVARCHAR(50) NOT NULL,
        [quantity] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_batch_allocations_quantity] DEFAULT 0,
        [delivery_challan_item_id] INT NULL,
        [stock_issue_item_id] INT NULL,
        [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_batch_allocations_created_at] DEFAULT GETDATE(),
        CONSTRAINT [PK_batch_allocations] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_batch_allocations_batch_no' AND object_id = OBJECT_ID(N'[dbo].[batch_allocations]'))
BEGIN
    CREATE INDEX [IX_batch_allocations_batch_no] ON [dbo].[batch_allocations]([batch_no]);
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_batch_allocations_delivery_challan_item')
BEGIN
    ALTER TABLE [dbo].[batch_allocations]
        ADD CONSTRAINT [FK_batch_allocations_delivery_challan_item]
        FOREIGN KEY ([delivery_challan_item_id]) REFERENCES [dbo].[delivery_challan_items]([id])
        ON DELETE CASCADE;
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_batch_allocations_stock_issue_item')
BEGIN
    ALTER TABLE [dbo].[batch_allocations]
        ADD CONSTRAINT [FK_batch_allocations_stock_issue_item]
        FOREIGN KEY ([stock_issue_item_id]) REFERENCES [dbo].[stock_issue_items]([id])
        ON DELETE CASCADE;
END;

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[serial_allocations]') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[serial_allocations] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [serial_no] NVARCHAR(100) NOT NULL,
        [product_code] NVARCHAR(50) NOT NULL,
        [delivery_challan_item_id] INT NULL,
        [stock_issue_item_id] INT NULL,
        [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_serial_allocations_created_at] DEFAULT GETDATE(),
        CONSTRAINT [PK_serial_allocations] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_serial_allocations_serial_no' AND object_id = OBJECT_ID(N'[dbo].[serial_allocations]'))
BEGIN
    CREATE INDEX [IX_serial_allocations_serial_no] ON [dbo].[serial_allocations]([serial_no]);
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_serial_allocations_delivery_challan_item')
BEGIN
    ALTER TABLE [dbo].[serial_allocations]
        ADD CONSTRAINT [FK_serial_allocations_delivery_challan_item]
        FOREIGN KEY ([delivery_challan_item_id]) REFERENCES [dbo].[delivery_challan_items]([id])
        ON DELETE CASCADE;
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_serial_allocations_stock_issue_item')
BEGIN
    ALTER TABLE [dbo].[serial_allocations]
        ADD CONSTRAINT [FK_serial_allocations_stock_issue_item]
        FOREIGN KEY ([stock_issue_item_id]) REFERENCES [dbo].[stock_issue_items]([id])
        ON DELETE CASCADE;
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
