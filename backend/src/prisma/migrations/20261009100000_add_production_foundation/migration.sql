BEGIN TRY

BEGIN TRAN;

-- CreateTable: work_centers
--
-- Production Planning Phase A -- manufacturing foundation. Purely additive:
-- 7 new tables, nothing existing is altered. See schema.prisma's own header
-- comment above these models for scope notes (no material issue/receipt,
-- costing, or GL/WIP posting in this phase).
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'work_centers' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[work_centers] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [work_center_code] NVARCHAR(50) NOT NULL,
        [name] NVARCHAR(150) NOT NULL,
        [branch] NVARCHAR(150) NULL,
        [capacity_per_day] DECIMAL(15,2) NULL,
        [cost_per_hour] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_work_centers_cost_per_hour] DEFAULT 0,
        [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_work_centers_status] DEFAULT N'Active',
        CONSTRAINT [work_centers_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'work_centers_work_center_code_key'
      AND object_id = OBJECT_ID(N'[dbo].[work_centers]')
)
BEGIN
    CREATE UNIQUE INDEX [work_centers_work_center_code_key] ON [dbo].[work_centers]([work_center_code]);
END;

-- CreateTable: boms
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'boms' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[boms] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [bom_code] NVARCHAR(50) NOT NULL,
        [product_code] NVARCHAR(50) NOT NULL,
        [uom] NVARCHAR(50) NULL,
        [version] NVARCHAR(20) NOT NULL CONSTRAINT [DF_boms_version] DEFAULT N'1.0',
        [base_quantity] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_boms_base_quantity] DEFAULT 1,
        [is_default] BIT NOT NULL CONSTRAINT [DF_boms_is_default] DEFAULT 0,
        [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_boms_status] DEFAULT N'Active',
        [notes] NVARCHAR(MAX) NULL,
        [created_by_id] INT NULL,
        [created_by_name] NVARCHAR(100) NULL,
        [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_boms_created_at] DEFAULT SYSUTCDATETIME(),
        [updated_at] DATETIME2 NOT NULL,
        CONSTRAINT [boms_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'boms_bom_code_key'
      AND object_id = OBJECT_ID(N'[dbo].[boms]')
)
BEGIN
    CREATE UNIQUE INDEX [boms_bom_code_key] ON [dbo].[boms]([bom_code]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_Bom_ProductCode_Status'
      AND object_id = OBJECT_ID(N'[dbo].[boms]')
)
BEGIN
    CREATE INDEX [IX_Bom_ProductCode_Status] ON [dbo].[boms]([product_code], [status]);
END;

-- CreateTable: bom_lines
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'bom_lines' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[bom_lines] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [bom_id] INT NOT NULL,
        [component_product_code] NVARCHAR(50) NOT NULL,
        [component_product_name] NVARCHAR(150) NULL,
        [uom] NVARCHAR(50) NULL,
        [quantity_per] DECIMAL(15,4) NOT NULL,
        [scrap_percent] DECIMAL(5,2) NOT NULL CONSTRAINT [DF_bom_lines_scrap_percent] DEFAULT 0,
        [sequence_no] INT NOT NULL CONSTRAINT [DF_bom_lines_sequence_no] DEFAULT 1,
        CONSTRAINT [bom_lines_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_BomLine_BomId'
      AND object_id = OBJECT_ID(N'[dbo].[bom_lines]')
)
BEGIN
    CREATE INDEX [IX_BomLine_BomId] ON [dbo].[bom_lines]([bom_id]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'bom_lines_bom_id_fkey'
)
BEGIN
    ALTER TABLE [dbo].[bom_lines]
      ADD CONSTRAINT [bom_lines_bom_id_fkey]
      FOREIGN KEY ([bom_id]) REFERENCES [dbo].[boms]([id]) ON DELETE CASCADE;
END;

-- CreateTable: routings
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'routings' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[routings] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [routing_code] NVARCHAR(50) NOT NULL,
        [product_code] NVARCHAR(50) NOT NULL,
        [version] NVARCHAR(20) NOT NULL CONSTRAINT [DF_routings_version] DEFAULT N'1.0',
        [is_default] BIT NOT NULL CONSTRAINT [DF_routings_is_default] DEFAULT 0,
        [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_routings_status] DEFAULT N'Active',
        CONSTRAINT [routings_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'routings_routing_code_key'
      AND object_id = OBJECT_ID(N'[dbo].[routings]')
)
BEGIN
    CREATE UNIQUE INDEX [routings_routing_code_key] ON [dbo].[routings]([routing_code]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_Routing_ProductCode_Status'
      AND object_id = OBJECT_ID(N'[dbo].[routings]')
)
BEGIN
    CREATE INDEX [IX_Routing_ProductCode_Status] ON [dbo].[routings]([product_code], [status]);
END;

-- CreateTable: routing_operations
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'routing_operations' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[routing_operations] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [routing_id] INT NOT NULL,
        [operation_no] INT NOT NULL,
        [operation_name] NVARCHAR(150) NOT NULL,
        [work_center_code] NVARCHAR(50) NULL,
        [standard_time_mins] DECIMAL(10,2) NULL,
        [sequence_no] INT NOT NULL CONSTRAINT [DF_routing_operations_sequence_no] DEFAULT 1,
        CONSTRAINT [routing_operations_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_RoutingOperation_RoutingId'
      AND object_id = OBJECT_ID(N'[dbo].[routing_operations]')
)
BEGIN
    CREATE INDEX [IX_RoutingOperation_RoutingId] ON [dbo].[routing_operations]([routing_id]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'routing_operations_routing_id_fkey'
)
BEGIN
    ALTER TABLE [dbo].[routing_operations]
      ADD CONSTRAINT [routing_operations_routing_id_fkey]
      FOREIGN KEY ([routing_id]) REFERENCES [dbo].[routings]([id]) ON DELETE CASCADE;
END;

-- CreateTable: production_orders
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'production_orders' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[production_orders] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [order_no] NVARCHAR(50) NOT NULL,
        [product_code] NVARCHAR(50) NOT NULL,
        [product_name] NVARCHAR(150) NULL,
        [bom_id] INT NULL,
        [routing_id] INT NULL,
        [order_qty] DECIMAL(15,2) NOT NULL,
        [uom] NVARCHAR(50) NULL,
        [planned_start_date] DATE NULL,
        [due_date] DATE NULL,
        [warehouse] NVARCHAR(150) NULL,
        [branch] NVARCHAR(150) NULL,
        [source_type] NVARCHAR(20) NOT NULL CONSTRAINT [DF_production_orders_source_type] DEFAULT N'Manual',
        [base_type] NVARCHAR(50) NULL,
        [base_no] NVARCHAR(50) NULL,
        [base_entry] INT NULL,
        [base_line] INT NULL,
        [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_production_orders_status] DEFAULT N'Planned',
        [is_cancelled] BIT NOT NULL CONSTRAINT [DF_production_orders_is_cancelled] DEFAULT 0,
        [notes] NVARCHAR(MAX) NULL,
        [created_by_id] INT NULL,
        [created_by_name] NVARCHAR(100) NULL,
        [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_production_orders_created_at] DEFAULT SYSUTCDATETIME(),
        [updated_at] DATETIME2 NOT NULL,
        CONSTRAINT [production_orders_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'production_orders_order_no_key'
      AND object_id = OBJECT_ID(N'[dbo].[production_orders]')
)
BEGIN
    CREATE UNIQUE INDEX [production_orders_order_no_key] ON [dbo].[production_orders]([order_no]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_ProductionOrder_Status_UpdatedAt'
      AND object_id = OBJECT_ID(N'[dbo].[production_orders]')
)
BEGIN
    CREATE INDEX [IX_ProductionOrder_Status_UpdatedAt] ON [dbo].[production_orders]([status], [updated_at]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_ProductionOrder_ProductCode'
      AND object_id = OBJECT_ID(N'[dbo].[production_orders]')
)
BEGIN
    CREATE INDEX [IX_ProductionOrder_ProductCode] ON [dbo].[production_orders]([product_code]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_ProductionOrder_Base'
      AND object_id = OBJECT_ID(N'[dbo].[production_orders]')
)
BEGIN
    CREATE INDEX [IX_ProductionOrder_Base] ON [dbo].[production_orders]([base_type], [base_entry]);
END;

-- Deliberately NOT CASCADE: deleting an old BOM/Routing version must never
-- delete or block-delete a Production Order already created from it -- the
-- order's components/operations are already snapshotted into their own
-- tables below, so the order needs nothing further from the BOM/Routing
-- once created.
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'production_orders_bom_id_fkey'
)
BEGIN
    ALTER TABLE [dbo].[production_orders]
      ADD CONSTRAINT [production_orders_bom_id_fkey]
      FOREIGN KEY ([bom_id]) REFERENCES [dbo].[boms]([id]) ON DELETE SET NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'production_orders_routing_id_fkey'
)
BEGIN
    ALTER TABLE [dbo].[production_orders]
      ADD CONSTRAINT [production_orders_routing_id_fkey]
      FOREIGN KEY ([routing_id]) REFERENCES [dbo].[routings]([id]) ON DELETE SET NULL;
END;

-- CreateTable: production_order_components
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'production_order_components' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[production_order_components] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [order_id] INT NOT NULL,
        [component_product_code] NVARCHAR(50) NOT NULL,
        [component_product_name] NVARCHAR(150) NULL,
        [uom] NVARCHAR(50) NULL,
        [planned_qty] DECIMAL(15,2) NOT NULL,
        [issued_qty] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_production_order_components_issued_qty] DEFAULT 0,
        CONSTRAINT [production_order_components_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_ProdOrderComponent_OrderId'
      AND object_id = OBJECT_ID(N'[dbo].[production_order_components]')
)
BEGIN
    CREATE INDEX [IX_ProdOrderComponent_OrderId] ON [dbo].[production_order_components]([order_id]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'production_order_components_order_id_fkey'
)
BEGIN
    ALTER TABLE [dbo].[production_order_components]
      ADD CONSTRAINT [production_order_components_order_id_fkey]
      FOREIGN KEY ([order_id]) REFERENCES [dbo].[production_orders]([id]) ON DELETE CASCADE;
END;

-- CreateTable: production_order_operations
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'production_order_operations' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[production_order_operations] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [order_id] INT NOT NULL,
        [operation_no] INT NOT NULL,
        [operation_name] NVARCHAR(150) NULL,
        [work_center_code] NVARCHAR(50) NULL,
        [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_production_order_operations_status] DEFAULT N'Pending',
        [good_qty] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_production_order_operations_good_qty] DEFAULT 0,
        [scrap_qty] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_production_order_operations_scrap_qty] DEFAULT 0,
        [started_at] DATETIME2 NULL,
        [completed_at] DATETIME2 NULL,
        CONSTRAINT [production_order_operations_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_ProdOrderOperation_OrderId'
      AND object_id = OBJECT_ID(N'[dbo].[production_order_operations]')
)
BEGIN
    CREATE INDEX [IX_ProdOrderOperation_OrderId] ON [dbo].[production_order_operations]([order_id]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'production_order_operations_order_id_fkey'
)
BEGIN
    ALTER TABLE [dbo].[production_order_operations]
      ADD CONSTRAINT [production_order_operations_order_id_fkey]
      FOREIGN KEY ([order_id]) REFERENCES [dbo].[production_orders]([id]) ON DELETE CASCADE;
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
