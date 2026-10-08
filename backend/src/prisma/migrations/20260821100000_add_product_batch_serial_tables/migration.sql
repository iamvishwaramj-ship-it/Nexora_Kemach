BEGIN TRY

BEGIN TRAN;

-- CreateTable: product_batches
-- One row per batch/lot created when a Batch-tracked product (Product
-- Master > Manage Item By = 'Batch') is received on a Purchase GRN line, via
-- the "Batches - Setup" dialog. Reusable beyond that screen: any future
-- module (Stock Issue, Sales, traceability reports) can look these up by
-- product_code.
IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[dbo].[product_batches]') AND type = N'U'
)
BEGIN
    CREATE TABLE [dbo].[product_batches] (
        [id]                INT IDENTITY(1,1) NOT NULL,
        [batch_no]          NVARCHAR(100) NOT NULL,
        [product_code]      NVARCHAR(50)  NOT NULL,
        [quantity]          DECIMAL(15,2) NOT NULL CONSTRAINT [DF_product_batches_quantity] DEFAULT 0,
        [batch_attribute_1] NVARCHAR(100) NULL,
        [batch_attribute_2] NVARCHAR(100) NULL,
        [expiration_date]   DATE NULL,
        [mfr_date]          DATE NULL,
        [admission_date]    DATE NULL,
        [location]          NVARCHAR(150) NULL,
        [warehouse]         NVARCHAR(150) NULL,
        [details]           NVARCHAR(MAX) NULL,
        [status]            NVARCHAR(20) NOT NULL CONSTRAINT [DF_product_batches_status] DEFAULT 'Active',
        [grn_item_id]       INT NULL,
        [created_at]        DATETIME2 NOT NULL CONSTRAINT [DF_product_batches_created_at] DEFAULT CURRENT_TIMESTAMP,
        [updated_at]        DATETIME2 NOT NULL,
        CONSTRAINT [PK_product_batches] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_product_batches_grn_item')
BEGIN
    ALTER TABLE [dbo].[product_batches]
        ADD CONSTRAINT [FK_product_batches_grn_item]
        FOREIGN KEY ([grn_item_id]) REFERENCES [dbo].[goods_received_note_items]([id])
        ON DELETE CASCADE;
END;

-- One batch number per product — the same string is free to be reused by a
-- different product, but not twice for the same one.
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UQ_product_batches_product_batch_no'
      AND object_id = OBJECT_ID(N'[dbo].[product_batches]')
)
BEGIN
    CREATE UNIQUE INDEX [UQ_product_batches_product_batch_no]
        ON [dbo].[product_batches] ([product_code], [batch_no]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_product_batches_product'
      AND object_id = OBJECT_ID(N'[dbo].[product_batches]')
)
BEGIN
    CREATE INDEX [IX_product_batches_product]
        ON [dbo].[product_batches] ([product_code]);
END;

-- CreateTable: product_serials
-- The Serial equivalent — one row per physical unit of a Serial-tracked
-- product, rather than one row per lot. No quantity column: the count of
-- rows against a line IS the quantity received.
IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[dbo].[product_serials]') AND type = N'U'
)
BEGIN
    CREATE TABLE [dbo].[product_serials] (
        [id]                INT IDENTITY(1,1) NOT NULL,
        [serial_no]         NVARCHAR(100) NOT NULL,
        [product_code]      NVARCHAR(50)  NOT NULL,
        [batch_attribute_1] NVARCHAR(100) NULL,
        [batch_attribute_2] NVARCHAR(100) NULL,
        [expiration_date]   DATE NULL,
        [mfr_date]          DATE NULL,
        [admission_date]    DATE NULL,
        [location]          NVARCHAR(150) NULL,
        [warehouse]         NVARCHAR(150) NULL,
        [details]           NVARCHAR(MAX) NULL,
        [status]            NVARCHAR(20) NOT NULL CONSTRAINT [DF_product_serials_status] DEFAULT 'In Stock',
        [grn_item_id]       INT NULL,
        [created_at]        DATETIME2 NOT NULL CONSTRAINT [DF_product_serials_created_at] DEFAULT CURRENT_TIMESTAMP,
        [updated_at]        DATETIME2 NOT NULL,
        CONSTRAINT [PK_product_serials] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_product_serials_grn_item')
BEGIN
    ALTER TABLE [dbo].[product_serials]
        ADD CONSTRAINT [FK_product_serials_grn_item]
        FOREIGN KEY ([grn_item_id]) REFERENCES [dbo].[goods_received_note_items]([id])
        ON DELETE CASCADE;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UQ_product_serials_product_serial_no'
      AND object_id = OBJECT_ID(N'[dbo].[product_serials]')
)
BEGIN
    CREATE UNIQUE INDEX [UQ_product_serials_product_serial_no]
        ON [dbo].[product_serials] ([product_code], [serial_no]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_product_serials_product'
      AND object_id = OBJECT_ID(N'[dbo].[product_serials]')
)
BEGIN
    CREATE INDEX [IX_product_serials_product]
        ON [dbo].[product_serials] ([product_code]);
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
