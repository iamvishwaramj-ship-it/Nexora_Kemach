BEGIN TRY

BEGIN TRAN;

-- CreateTable: production_forecast_plans
--
-- Production Planning > Forecast -- the saved header for one Forecast Plan
-- run (scope filters + date range). Lines (per-item Actual/Forecast Demand)
-- live in production_forecast_plan_lines below and are always
-- server-computed from real Sales Invoice history, never hand-entered.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'production_forecast_plans' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[production_forecast_plans] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [plan_no] NVARCHAR(50) NOT NULL,
        [plan_name] NVARCHAR(150) NOT NULL,
        [forecast_period] NVARCHAR(20) NOT NULL CONSTRAINT [DF_prod_forecast_plans_period] DEFAULT N'Monthly',
        [from_month] DATE NOT NULL,
        [to_month] DATE NOT NULL,
        [plan_type] NVARCHAR(30) NOT NULL CONSTRAINT [DF_prod_forecast_plans_plan_type] DEFAULT N'Statistical Forecast',
        [version] NVARCHAR(20) NULL,
        [branch] NVARCHAR(150) NULL,
        [item_group] NVARCHAR(100) NULL,
        [item_category] NVARCHAR(50) NULL,
        [customer] NVARCHAR(150) NULL,
        [include_safety_stock] BIT NOT NULL CONSTRAINT [DF_prod_forecast_plans_include_safety_stock] DEFAULT 1,
        [notes] NVARCHAR(MAX) NULL,
        [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_prod_forecast_plans_status] DEFAULT N'Draft',
        [created_by_id] INT NULL,
        [created_by_name] NVARCHAR(100) NULL,
        [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_prod_forecast_plans_created_at] DEFAULT SYSUTCDATETIME(),
        [updated_at] DATETIME2 NOT NULL,
        CONSTRAINT [production_forecast_plans_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'production_forecast_plans_plan_no_key'
      AND object_id = OBJECT_ID(N'[dbo].[production_forecast_plans]')
)
BEGIN
    CREATE UNIQUE INDEX [production_forecast_plans_plan_no_key] ON [dbo].[production_forecast_plans]([plan_no]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_ProdForecastPlan_Status_UpdatedAt'
      AND object_id = OBJECT_ID(N'[dbo].[production_forecast_plans]')
)
BEGIN
    CREATE INDEX [IX_ProdForecastPlan_Status_UpdatedAt] ON [dbo].[production_forecast_plans]([status], [updated_at]);
END;

-- CreateTable: production_forecast_plan_lines
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'production_forecast_plan_lines' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[production_forecast_plan_lines] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [plan_id] INT NOT NULL,
        [product_code] NVARCHAR(50) NOT NULL,
        [product_name] NVARCHAR(150) NULL,
        [uom] NVARCHAR(50) NULL,
        [actual_months] NVARCHAR(MAX) NULL,
        [forecast_months] NVARCHAR(MAX) NULL,
        [method] NVARCHAR(50) NULL,
        [safety_stock] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_prod_forecast_plan_lines_safety_stock] DEFAULT 0,
        [total_forecast] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_prod_forecast_plan_lines_total_forecast] DEFAULT 0,
        [included] BIT NOT NULL CONSTRAINT [DF_prod_forecast_plan_lines_included] DEFAULT 1,
        CONSTRAINT [production_forecast_plan_lines_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_ProdForecastPlanLine_PlanId'
      AND object_id = OBJECT_ID(N'[dbo].[production_forecast_plan_lines]')
)
BEGIN
    CREATE INDEX [IX_ProdForecastPlanLine_PlanId] ON [dbo].[production_forecast_plan_lines]([plan_id]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_ProdForecastPlanLine_ProductCode'
      AND object_id = OBJECT_ID(N'[dbo].[production_forecast_plan_lines]')
)
BEGIN
    CREATE INDEX [IX_ProdForecastPlanLine_ProductCode] ON [dbo].[production_forecast_plan_lines]([product_code]);
END;

-- Deleting a plan takes its lines with it; the app replaces lines wholesale
-- on every save/recompute and never keeps an orphaned one (same pattern as
-- journal_entry_lines / payment_voucher_applications).
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'production_forecast_plan_lines_plan_id_fkey'
)
BEGIN
    ALTER TABLE [dbo].[production_forecast_plan_lines]
      ADD CONSTRAINT [production_forecast_plan_lines_plan_id_fkey]
      FOREIGN KEY ([plan_id]) REFERENCES [dbo].[production_forecast_plans]([id]) ON DELETE CASCADE;
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
