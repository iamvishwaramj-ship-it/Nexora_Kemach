BEGIN TRY

BEGIN TRAN;

-- CreateTable: production_mrp_runs
--
-- Production Planning Phase 1 -- MRP & Order Generation. Purely additive: 4
-- new tables, nothing existing is altered. This feature never writes to
-- Stock or posts to the G/L -- it only reads existing stock/open-order data
-- and, on "Generate Orders", creates ordinary ProductionOrder/PurchaseOrder
-- rows through their own existing, unmodified creation logic. See
-- schema.prisma's own header comment above these models for the explicitly
-- approved scope (Production/Purchase Orders only -- no Subcontracting/Job
-- Work document type exists anywhere in this schema).
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'production_mrp_runs' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[production_mrp_runs] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [run_code] NVARCHAR(50) NOT NULL,
        [run_date] DATETIME2 NOT NULL CONSTRAINT [DF_production_mrp_runs_run_date] DEFAULT SYSUTCDATETIME(),
        [horizon_from_month] NVARCHAR(7) NULL,
        [horizon_to_month] NVARCHAR(7) NULL,
        [plant] NVARCHAR(150) NULL,
        [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_production_mrp_runs_status] DEFAULT N'Draft',
        [created_by_id] INT NULL,
        [created_by_name] NVARCHAR(100) NULL,
        [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_production_mrp_runs_created_at] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [production_mrp_runs_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'production_mrp_runs_run_code_key'
      AND object_id = OBJECT_ID(N'[dbo].[production_mrp_runs]')
)
BEGIN
    CREATE UNIQUE INDEX [production_mrp_runs_run_code_key] ON [dbo].[production_mrp_runs]([run_code]);
END;

-- CreateTable: production_mrp_requirements
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'production_mrp_requirements' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[production_mrp_requirements] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [run_id] INT NOT NULL,
        [product_code] NVARCHAR(50) NOT NULL,
        [product_name] NVARCHAR(150) NULL,
        [uom] NVARCHAR(50) NULL,
        [gross_requirement] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_production_mrp_requirements_gross_requirement] DEFAULT 0,
        [available_qty] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_production_mrp_requirements_available_qty] DEFAULT 0,
        [in_progress_qty] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_production_mrp_requirements_in_progress_qty] DEFAULT 0,
        [on_hold_qty] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_production_mrp_requirements_on_hold_qty] DEFAULT 0,
        [net_to_generate] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_production_mrp_requirements_net_to_generate] DEFAULT 0,
        [required_date] DATE NULL,
        [suggested_order_type] NVARCHAR(20) NULL,
        [covered_by_go_no] NVARCHAR(50) NULL,
        CONSTRAINT [production_mrp_requirements_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_ProdMrpRequirement_RunId'
      AND object_id = OBJECT_ID(N'[dbo].[production_mrp_requirements]')
)
BEGIN
    CREATE INDEX [IX_ProdMrpRequirement_RunId] ON [dbo].[production_mrp_requirements]([run_id]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_ProdMrpRequirement_ProductCode'
      AND object_id = OBJECT_ID(N'[dbo].[production_mrp_requirements]')
)
BEGIN
    CREATE INDEX [IX_ProdMrpRequirement_ProductCode] ON [dbo].[production_mrp_requirements]([product_code]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'production_mrp_requirements_run_id_fkey'
)
BEGIN
    ALTER TABLE [dbo].[production_mrp_requirements]
      ADD CONSTRAINT [production_mrp_requirements_run_id_fkey]
      FOREIGN KEY ([run_id]) REFERENCES [dbo].[production_mrp_runs]([id]) ON DELETE CASCADE;
END;

-- CreateTable: production_generation_orders
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'production_generation_orders' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[production_generation_orders] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [go_number] NVARCHAR(50) NOT NULL,
        [source_type] NVARCHAR(20) NOT NULL,
        [source_run_id] INT NULL,
        [source_forecast_plan_id] INT NULL,
        [go_date] DATE NULL,
        [required_delivery_date] DATE NULL,
        [plant] NVARCHAR(150) NULL,
        [notes] NVARCHAR(MAX) NULL,
        [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_production_generation_orders_status] DEFAULT N'Draft',
        [created_by_id] INT NULL,
        [created_by_name] NVARCHAR(100) NULL,
        [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_production_generation_orders_created_at] DEFAULT SYSUTCDATETIME(),
        [updated_at] DATETIME2 NOT NULL,
        CONSTRAINT [production_generation_orders_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'production_generation_orders_go_number_key'
      AND object_id = OBJECT_ID(N'[dbo].[production_generation_orders]')
)
BEGIN
    CREATE UNIQUE INDEX [production_generation_orders_go_number_key] ON [dbo].[production_generation_orders]([go_number]);
END;

-- CreateTable: production_generation_order_lines
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'production_generation_order_lines' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[production_generation_order_lines] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [go_id] INT NOT NULL,
        [product_code] NVARCHAR(50) NOT NULL,
        [product_name] NVARCHAR(150) NULL,
        [uom] NVARCHAR(50) NULL,
        [required_qty] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_production_generation_order_lines_required_qty] DEFAULT 0,
        [order_qty] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_production_generation_order_lines_order_qty] DEFAULT 0,
        [order_type] NVARCHAR(20) NOT NULL,
        [planned_start_date] DATE NULL,
        [due_date] DATE NULL,
        [priority] NVARCHAR(20) NOT NULL CONSTRAINT [DF_production_generation_order_lines_priority] DEFAULT N'Normal',
        [vendor_code] NVARCHAR(150) NULL,
        [warehouse] NVARCHAR(150) NULL,
        [branch] NVARCHAR(150) NULL,
        [result_order_type] NVARCHAR(20) NULL,
        [result_order_id] INT NULL,
        [result_order_no] NVARCHAR(50) NULL,
        CONSTRAINT [production_generation_order_lines_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_ProdGenOrderLine_GoId'
      AND object_id = OBJECT_ID(N'[dbo].[production_generation_order_lines]')
)
BEGIN
    CREATE INDEX [IX_ProdGenOrderLine_GoId] ON [dbo].[production_generation_order_lines]([go_id]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'production_generation_order_lines_go_id_fkey'
)
BEGIN
    ALTER TABLE [dbo].[production_generation_order_lines]
      ADD CONSTRAINT [production_generation_order_lines_go_id_fkey]
      FOREIGN KEY ([go_id]) REFERENCES [dbo].[production_generation_orders]([id]) ON DELETE CASCADE;
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
