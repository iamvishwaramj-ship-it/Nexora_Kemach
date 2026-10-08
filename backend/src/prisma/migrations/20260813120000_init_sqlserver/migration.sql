BEGIN TRY

BEGIN TRAN;

-- CreateTable: AppUser
CREATE TABLE [dbo].[app_users] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [email] NVARCHAR(100) NOT NULL,
    [password_hash] NVARCHAR(255) NOT NULL,
    [role] NVARCHAR(50) NOT NULL CONSTRAINT [DF_app_users_role] DEFAULT N'admin',
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_app_users_status] DEFAULT N'Active',
    [profile_photo_url] NVARCHAR(500) NULL,
    CONSTRAINT [app_users_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: CompanyDetails
CREATE TABLE [dbo].[company_details] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [company_name] NVARCHAR(200) NULL,
    [legal_name] NVARCHAR(200) NULL,
    [registration_number] NVARCHAR(100) NULL,
    [tin_number] NVARCHAR(50) NULL,
    [gstin] NVARCHAR(50) NULL,
    [pan] NVARCHAR(20) NULL,
    [currency] NVARCHAR(10) NOT NULL CONSTRAINT [DF_company_details_currency] DEFAULT N'INR',
    [phone] NVARCHAR(20) NULL,
    [email] NVARCHAR(100) NULL,
    [website] NVARCHAR(150) NULL,
    [address] NVARCHAR(max) NULL,
    [country] NVARCHAR(100) NULL,
    [state] NVARCHAR(100) NULL,
    [city] NVARCHAR(100) NULL,
    [pincode] NVARCHAR(20) NULL,
    CONSTRAINT [company_details_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: Branch
CREATE TABLE [dbo].[branches] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [branch_code] NVARCHAR(50) NOT NULL,
    [branch_name] NVARCHAR(100) NOT NULL,
    [address] NVARCHAR(max) NULL,
    [phone] NVARCHAR(20) NULL,
    [email] NVARCHAR(100) NULL,
    [country] NVARCHAR(100) NULL,
    [state] NVARCHAR(100) NULL,
    [city] NVARCHAR(100) NULL,
    [pincode] NVARCHAR(20) NULL,
    [is_default] BIT NOT NULL CONSTRAINT [DF_branches_is_default] DEFAULT 0,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_branches_status] DEFAULT N'Active',
    CONSTRAINT [branches_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: FinancialYear
CREATE TABLE [dbo].[financial_years] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [financial_year_name] NVARCHAR(50) NOT NULL,
    [start_date] DATE NULL,
    [end_date] DATE NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_financial_years_status] DEFAULT N'Active',
    CONSTRAINT [financial_years_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: TaxCode
CREATE TABLE [dbo].[tax_codes] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [tax_code] NVARCHAR(50) NOT NULL,
    [tax_name] NVARCHAR(100) NOT NULL,
    [tax_type] NVARCHAR(50) NULL,
    [tax_rate] DECIMAL(5, 2) NULL,
    [cgst] DECIMAL(5, 2) NULL,
    [sgst] DECIMAL(5, 2) NULL,
    [igst] DECIMAL(5, 2) NULL,
    [description] NVARCHAR(max) NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_tax_codes_status] DEFAULT N'Active',
    CONSTRAINT [tax_codes_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: DocumentNumbering
CREATE TABLE [dbo].[document_numbering] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [document_code] NVARCHAR(30) NOT NULL,
    [document_name] NVARCHAR(100) NOT NULL,
    [series_name] NVARCHAR(100) NOT NULL,
    [is_default] BIT NOT NULL CONSTRAINT [DF_document_numbering_is_default] DEFAULT 0,
    [financial_year_id] INT NULL,
    [fy_code] NVARCHAR(20) NULL,
    [prefix] NVARCHAR(20) NULL,
    [suffix] NVARCHAR(20) NULL,
    [separator] NVARCHAR(5) NOT NULL CONSTRAINT [DF_document_numbering_separator] DEFAULT N'-',
    [include_fy_in_number] BIT NOT NULL CONSTRAINT [DF_document_numbering_include_fy_in_number] DEFAULT 1,
    [number_length] INT NOT NULL CONSTRAINT [DF_document_numbering_number_length] DEFAULT 6,
    [start_number] INT NOT NULL CONSTRAINT [DF_document_numbering_start_number] DEFAULT 1,
    [current_number] INT NULL,
    [next_number] INT NOT NULL,
    [end_number] INT NOT NULL CONSTRAINT [DF_document_numbering_end_number] DEFAULT 999999,
    [reset_every_fy] BIT NOT NULL CONSTRAINT [DF_document_numbering_reset_every_fy] DEFAULT 1,
    [auto_generate] BIT NOT NULL CONSTRAINT [DF_document_numbering_auto_generate] DEFAULT 1,
    [manual_entry] BIT NOT NULL CONSTRAINT [DF_document_numbering_manual_entry] DEFAULT 0,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_document_numbering_status] DEFAULT N'Active',
    [last_number_at] DATETIME2 NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_document_numbering_created_at] DEFAULT GETDATE(),
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [document_numbering_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: BankName
CREATE TABLE [dbo].[bank_names] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [bank_name] NVARCHAR(150) NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_bank_names_status] DEFAULT N'Active',
    CONSTRAINT [bank_names_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: HouseBank
CREATE TABLE [dbo].[house_banks] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [bank_name] NVARCHAR(150) NOT NULL,
    [account_number] NVARCHAR(50) NOT NULL,
    [account_name] NVARCHAR(150) NULL,
    [ifsc_code] NVARCHAR(20) NULL,
    [bank_address] NVARCHAR(max) NULL,
    [branch_name] NVARCHAR(150) NULL,
    [account_type] NVARCHAR(50) NOT NULL CONSTRAINT [DF_house_banks_account_type] DEFAULT N'Current Account',
    [currency] NVARCHAR(10) NOT NULL CONSTRAINT [DF_house_banks_currency] DEFAULT N'INR',
    [opening_balance] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_house_banks_opening_balance] DEFAULT 0,
    [opening_date] DATE NULL,
    [description] NVARCHAR(max) NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_house_banks_status] DEFAULT N'Active',
    CONSTRAINT [house_banks_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: SalesEmployee
CREATE TABLE [dbo].[sales_employees] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [employee_code] NVARCHAR(50) NOT NULL,
    [employee_name] NVARCHAR(150) NOT NULL,
    [email] NVARCHAR(100) NULL,
    [phone_number] NVARCHAR(20) NULL,
    [designation] NVARCHAR(100) NULL,
    [department] NVARCHAR(100) NULL,
    [reporting_manager] NVARCHAR(150) NULL,
    [date_of_joining] DATE NULL,
    [address] NVARCHAR(max) NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_sales_employees_status] DEFAULT N'Active',
    CONSTRAINT [sales_employees_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: ApprovalFlow
CREATE TABLE [dbo].[approval_flows] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [transaction_name] NVARCHAR(100) NOT NULL,
    [approval_type] NVARCHAR(50) NOT NULL CONSTRAINT [DF_approval_flows_approval_type] DEFAULT N'Amount Based',
    [applied_for] NVARCHAR(100) NOT NULL CONSTRAINT [DF_approval_flows_applied_for] DEFAULT N'All Branches',
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_approval_flows_status] DEFAULT N'Active',
    CONSTRAINT [approval_flows_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: ApprovalFlowLevel
CREATE TABLE [dbo].[approval_flow_levels] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [approval_flow_id] INT NULL,
    [level_name] NVARCHAR(50) NULL,
    [approver_type] NVARCHAR(50) NOT NULL CONSTRAINT [DF_approval_flow_levels_approver_type] DEFAULT N'User',
    [approver] NVARCHAR(150) NULL,
    [from_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_approval_flow_levels_from_amount] DEFAULT 0,
    [to_amount] DECIMAL(15, 2) NULL,
    [required_action] NVARCHAR(20) NOT NULL CONSTRAINT [DF_approval_flow_levels_required_action] DEFAULT N'Approve',
    [level_order] INT NOT NULL CONSTRAINT [DF_approval_flow_levels_level_order] DEFAULT 1,
    CONSTRAINT [approval_flow_levels_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: ProductGroup
CREATE TABLE [dbo].[product_groups] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [group_code] NVARCHAR(50) NOT NULL,
    [group_name] NVARCHAR(150) NOT NULL,
    [description] NVARCHAR(max) NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_product_groups_status] DEFAULT N'Active',
    CONSTRAINT [product_groups_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: ProductSubGroup
CREATE TABLE [dbo].[product_sub_groups] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [sub_group_code] NVARCHAR(50) NOT NULL,
    [sub_group_name] NVARCHAR(150) NOT NULL,
    [group_id] INT NULL,
    [group_name] NVARCHAR(150) NULL,
    [description] NVARCHAR(max) NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_product_sub_groups_status] DEFAULT N'Active',
    CONSTRAINT [product_sub_groups_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: Brand
CREATE TABLE [dbo].[brands] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [brand_code] NVARCHAR(50) NOT NULL,
    [brand_name] NVARCHAR(150) NOT NULL,
    [description] NVARCHAR(max) NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_brands_status] DEFAULT N'Active',
    CONSTRAINT [brands_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: Uom
CREATE TABLE [dbo].[uoms] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [uom_code] NVARCHAR(50) NOT NULL,
    [uom_name] NVARCHAR(150) NOT NULL,
    [unit_type] NVARCHAR(50) NULL,
    [description] NVARCHAR(max) NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_uoms_status] DEFAULT N'Active',
    CONSTRAINT [uoms_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: Product
CREATE TABLE [dbo].[products] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [product_code] NVARCHAR(50) NOT NULL,
    [product_name] NVARCHAR(150) NOT NULL,
    [barcode] NVARCHAR(100) NULL,
    [product_group] NVARCHAR(100) NULL,
    [product_sub_group] NVARCHAR(100) NULL,
    [brand] NVARCHAR(100) NULL,
    [product_type] NVARCHAR(50) NULL,
    [uom] NVARCHAR(50) NULL,
    [sales_uom] NVARCHAR(50) NULL,
    [hsn_code] NVARCHAR(50) NULL,
    [tax_code] NVARCHAR(50) NULL,
    [tax_rate_type] NVARCHAR(20) NULL,
    [tax_rate] DECIMAL(5, 2) NULL,
    [calculation_method] NVARCHAR(20) NULL,
    [cost_price] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_products_cost_price] DEFAULT 0,
    [sales_price] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_products_sales_price] DEFAULT 0,
    [min_sales_price] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_products_min_sales_price] DEFAULT 0,
    [opening_stock] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_products_opening_stock] DEFAULT 0,
    [reorder_level] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_products_reorder_level] DEFAULT 0,
    [expiry_applicable] BIT NOT NULL CONSTRAINT [DF_products_expiry_applicable] DEFAULT 0,
    [default_supplier] NVARCHAR(150) NULL,
    [default_location] NVARCHAR(150) NULL,
    [rack_no] NVARCHAR(50) NULL,
    [description] NVARCHAR(max) NULL,
    [remarks] NVARCHAR(max) NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_products_status] DEFAULT N'Active',
    CONSTRAINT [products_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: ProductCatalog
CREATE TABLE [dbo].[product_catalogs] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [catalog_code] NVARCHAR(50) NOT NULL,
    [catalog_name] NVARCHAR(150) NOT NULL,
    [description] NVARCHAR(max) NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_product_catalogs_status] DEFAULT N'Active',
    CONSTRAINT [product_catalogs_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: ProductCatalogItem
CREATE TABLE [dbo].[product_catalog_items] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [catalog_id] INT NULL,
    [product_code] NVARCHAR(50) NULL,
    [product_name] NVARCHAR(150) NULL,
    [product_group] NVARCHAR(100) NULL,
    [brand] NVARCHAR(100) NULL,
    [uom] NVARCHAR(50) NULL,
    [mrp] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_product_catalog_items_mrp] DEFAULT 0,
    CONSTRAINT [product_catalog_items_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: Customer
CREATE TABLE [dbo].[customers] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [customer_code] NVARCHAR(50) NOT NULL,
    [customer_name] NVARCHAR(100) NOT NULL,
    [customer_type] NVARCHAR(50) NULL,
    [phone] NVARCHAR(20) NULL,
    [email] NVARCHAR(100) NULL,
    [alternate_phone] NVARCHAR(20) NULL,
    [website] NVARCHAR(150) NULL,
    [gstin] NVARCHAR(20) NULL,
    [pan_no] NVARCHAR(20) NULL,
    [aadhaar_no] NVARCHAR(20) NULL,
    [date_of_registration] DATE NULL,
    [billing_address] NVARCHAR(max) NULL,
    [shipping_address] NVARCHAR(max) NULL,
    [city] NVARCHAR(100) NULL,
    [state] NVARCHAR(100) NULL,
    [credit_limit] DECIMAL(15, 2) NULL,
    [opening_balance] DECIMAL(15, 2) NULL,
    [outstanding_balance] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_customers_outstanding_balance] DEFAULT 0,
    [payment_terms] NVARCHAR(50) NULL,
    [price_list] NVARCHAR(100) NULL,
    [sales_person] NVARCHAR(100) NULL,
    [discount_percent] DECIMAL(5, 2) NULL,
    [notes] NVARCHAR(max) NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_customers_status] DEFAULT N'Active',
    CONSTRAINT [customers_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: Supplier
CREATE TABLE [dbo].[suppliers] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [supplier_code] NVARCHAR(50) NOT NULL,
    [supplier_name] NVARCHAR(100) NOT NULL,
    [supplier_type] NVARCHAR(50) NULL,
    [contact_person] NVARCHAR(100) NULL,
    [phone] NVARCHAR(20) NULL,
    [alternate_phone] NVARCHAR(20) NULL,
    [email] NVARCHAR(100) NULL,
    [gstin] NVARCHAR(20) NULL,
    [pan_no] NVARCHAR(20) NULL,
    [msme_no] NVARCHAR(50) NULL,
    [date_of_registration] DATE NULL,
    [billing_address] NVARCHAR(max) NULL,
    [shipping_address] NVARCHAR(max) NULL,
    [city] NVARCHAR(100) NULL,
    [state] NVARCHAR(100) NULL,
    [credit_limit] DECIMAL(15, 2) NULL,
    [opening_balance] DECIMAL(15, 2) NULL,
    [outstanding_balance] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_suppliers_outstanding_balance] DEFAULT 0,
    [payment_terms] NVARCHAR(50) NULL,
    [payment_mode] NVARCHAR(50) NULL,
    [bank_name] NVARCHAR(100) NULL,
    [account_number] NVARCHAR(50) NULL,
    [ifsc_code] NVARCHAR(20) NULL,
    [price_list] NVARCHAR(100) NULL,
    [currency] NVARCHAR(10) NULL,
    [preferred_purchase_category] NVARCHAR(100) NULL,
    [discount_percent] DECIMAL(5, 2) NULL,
    [notes] NVARCHAR(max) NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_suppliers_status] DEFAULT N'Active',
    CONSTRAINT [suppliers_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: Transport
CREATE TABLE [dbo].[transporters] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [transporter_code] NVARCHAR(50) NOT NULL,
    [transporter_name] NVARCHAR(150) NOT NULL,
    [contact_person] NVARCHAR(100) NULL,
    [phone] NVARCHAR(20) NULL,
    [alternate_phone] NVARCHAR(20) NULL,
    [email] NVARCHAR(100) NULL,
    [website] NVARCHAR(150) NULL,
    [gstin] NVARCHAR(20) NULL,
    [pan_no] NVARCHAR(20) NULL,
    [address] NVARCHAR(max) NULL,
    [service_type] NVARCHAR(50) NULL,
    [transport_type] NVARCHAR(50) NULL,
    [freight_payment_terms] NVARCHAR(50) NULL,
    [delivery_regions] NVARCHAR(max) NULL,
    [minimum_freight] DECIMAL(15, 2) NULL,
    [freight_per_km] DECIMAL(10, 2) NULL,
    [loading_time] NVARCHAR(20) NULL,
    [unloading_time] NVARCHAR(20) NULL,
    [vehicle_capacity] NVARCHAR(50) NULL,
    [vehicle_type] NVARCHAR(50) NULL,
    [no_of_vehicles] INT NULL,
    [insurance_valid_upto] DATE NULL,
    [bank_name] NVARCHAR(100) NULL,
    [account_number] NVARCHAR(50) NULL,
    [ifsc_code] NVARCHAR(20) NULL,
    [account_holder_name] NVARCHAR(150) NULL,
    [notes] NVARCHAR(max) NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_transporters_status] DEFAULT N'Active',
    CONSTRAINT [transporters_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: Warehouse
-- A physical stock location, distinct from Branch (a company office/place-of-
-- business used for numbering/print layouts). Deliberately narrow per the
-- Warehouse Master page's design.
CREATE TABLE [dbo].[warehouses] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [warehouse_code] NVARCHAR(50) NOT NULL,
    [warehouse_name] NVARCHAR(150) NOT NULL,
    [warehouse_location] NVARCHAR(max) NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_warehouses_status] DEFAULT N'Active',
    CONSTRAINT [warehouses_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE UNIQUE INDEX [warehouses_warehouse_code_key] ON [dbo].[warehouses]([warehouse_code]);

-- Seed the WH perpetual numbering series, same shape as the other master
-- codes seeded below — one row, no financial year, auto-generated 6-digit
-- codes starting at 1.
INSERT INTO [dbo].[document_numbering] (
  [document_code], [document_name], [series_name], [is_default],
  [financial_year_id], [fy_code],
  [prefix], [suffix], [separator], [include_fy_in_number], [number_length],
  [start_number], [current_number], [next_number], [end_number],
  [reset_every_fy], [auto_generate], [manual_entry], [status],
  [created_at], [updated_at]
)
SELECT
  'WH', 'Warehouse', 'Series 1', 1,
  NULL, NULL,
  'WH', NULL, '-', 0, 6,
  1, NULL, 1, 999999,
  0, 1, 0, 'Active',
  GETDATE(), GETDATE()
WHERE NOT EXISTS (
  SELECT 1 FROM [dbo].[document_numbering] d
   WHERE d.[document_code] = 'WH'
     AND d.[financial_year_id] IS NULL
);

-- CreateTable: Location
-- The registered place a warehouse belongs to, carrying the statutory
-- registrations (PAN, ECC, GST) that apply to stock held there.
-- warehouses.warehouse_location holds this record's location_name.
CREATE TABLE [dbo].[locations] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [location_code] NVARCHAR(50) NOT NULL,
    [location_name] NVARCHAR(150) NOT NULL,
    [pan_no] NVARCHAR(20) NULL,
    [ecc_no] NVARCHAR(50) NULL,
    [gst_registration_no] NVARCHAR(20) NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_locations_status] DEFAULT N'Active',
    CONSTRAINT [locations_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE UNIQUE INDEX [locations_location_code_key] ON [dbo].[locations]([location_code]);

-- Seed the LOC perpetual numbering series.
INSERT INTO [dbo].[document_numbering] (
  [document_code], [document_name], [series_name], [is_default],
  [financial_year_id], [fy_code],
  [prefix], [suffix], [separator], [include_fy_in_number], [number_length],
  [start_number], [current_number], [next_number], [end_number],
  [reset_every_fy], [auto_generate], [manual_entry], [status],
  [created_at], [updated_at]
)
SELECT
  'LOC', 'Location', 'Series 1', 1,
  NULL, NULL,
  'LOC', NULL, '-', 0, 6,
  1, NULL, 1, 999999,
  0, 1, 0, 'Active',
  GETDATE(), GETDATE()
WHERE NOT EXISTS (
  SELECT 1 FROM [dbo].[document_numbering] d
   WHERE d.[document_code] = 'LOC'
     AND d.[financial_year_id] IS NULL
);

-- CreateTable: WarehouseMaster
-- Rich warehouse master imported wholesale from the real source system's
-- Warehouse sheet (Master Data.xlsx) via npm run warehouse_master:seed.
-- Separate table from [warehouses] above by design — see the model comment
-- in schema.prisma.
CREATE TABLE [dbo].[warehouse] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [whs_code] NVARCHAR(50) NOT NULL,
    [whs_name] NVARCHAR(150) NOT NULL,
    [street] NVARCHAR(255) NULL,
    [block] NVARCHAR(255) NULL,
    [zip_code] NVARCHAR(20) NULL,
    [city] NVARCHAR(150) NULL,
    [county] NVARCHAR(100) NULL,
    [country] NVARCHAR(100) NULL,
    [state] NVARCHAR(100) NULL,
    [location_code] NVARCHAR(50) NULL,
    [drop_ship] NVARCHAR(5) NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_warehouse_status] DEFAULT N'Active',
    [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_warehouse_created_at] DEFAULT GETDATE(),
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [warehouse_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE UNIQUE INDEX [warehouse_whs_code_key] ON [dbo].[warehouse]([whs_code]);

-- CreateTable: LocationMaster
-- Rich location master imported wholesale from the real source system's
-- Location sheet (Master Data.xlsx) via npm run location_master:seed.
-- Separate table from [locations] above by design — see the model comment
-- in schema.prisma.
CREATE TABLE [dbo].[location_master] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [code] NVARCHAR(50) NOT NULL,
    [location_name] NVARCHAR(150) NOT NULL,
    [pan_no] NVARCHAR(20) NULL,
    [reg_type] NVARCHAR(20) NULL,
    [ecc_no] NVARCHAR(50) NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_location_master_status] DEFAULT N'Active',
    [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_location_master_created_at] DEFAULT GETDATE(),
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [location_master_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE UNIQUE INDEX [location_master_code_key] ON [dbo].[location_master]([code]);

-- CreateTable: OpeningBalance
-- Per-item, per-warehouse starting stock quantity and value, imported from
-- Master Data.xlsx's Current Stock sheet via npm run current_stock:seed, and
-- also fully editable through Inventory > Opening Balance. References
-- [warehouse] so the page's Warehouse dropdown only ever offers real
-- warehouse codes; (item_code, warehouse) is unique so re-seeding updates
-- rather than duplicates a row.
CREATE TABLE [dbo].[opening_balance] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [item_code] NVARCHAR(50) NOT NULL,
    [item_name] NVARCHAR(255) NOT NULL,
    [warehouse] NVARCHAR(50) NOT NULL,
    [stock] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_opening_balance_stock] DEFAULT 0,
    [stock_value] DECIMAL(15,2) NOT NULL CONSTRAINT [DF_opening_balance_stock_value] DEFAULT 0,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_opening_balance_status] DEFAULT N'Active',
    [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_opening_balance_created_at] DEFAULT GETDATE(),
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [opening_balance_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE UNIQUE INDEX [uq_opening_balance_item_warehouse] ON [dbo].[opening_balance]([item_code], [warehouse]);

ALTER TABLE [dbo].[opening_balance] ADD CONSTRAINT [opening_balance_warehouse_fkey]
    FOREIGN KEY ([warehouse]) REFERENCES [dbo].[warehouse]([whs_code])
    ON DELETE NO ACTION ON UPDATE CASCADE;

-- CreateTable: PurchaseQuotation
CREATE TABLE [dbo].[purchase_quotations] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [branch] NVARCHAR(150) NULL,
    [quotation_no] NVARCHAR(50) NOT NULL,
    [supplier] NVARCHAR(100) NULL,
    [contact_person] NVARCHAR(100) NULL,
    [phone] NVARCHAR(20) NULL,
    [email] NVARCHAR(100) NULL,
    [quotation_date] DATE NULL,
    [valid_upto] DATE NULL,
    [reference_no] NVARCHAR(50) NULL,
    [currency] NVARCHAR(10) NOT NULL CONSTRAINT [DF_purchase_quotations_currency] DEFAULT N'INR',
    [payment_terms] NVARCHAR(50) NULL,
    [delivery_date] DATE NULL,
    [ship_to] NVARCHAR(150) NULL,
    [terms_conditions] NVARCHAR(max) NULL,
    [attachment_name] NVARCHAR(255) NULL,
    [discount_percent] DECIMAL(5, 2) NOT NULL CONSTRAINT [DF_purchase_quotations_discount_percent] DEFAULT 0,
    [subtotal] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_quotations_subtotal] DEFAULT 0,
    [taxable_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_quotations_taxable_amount] DEFAULT 0,
    [cgst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_quotations_cgst_amount] DEFAULT 0,
    [sgst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_quotations_sgst_amount] DEFAULT 0,
    [igst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_quotations_igst_amount] DEFAULT 0,
    [round_off] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_quotations_round_off] DEFAULT 0,
    [place_of_supply] NVARCHAR(100) NULL,
    [amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_quotations_amount] DEFAULT 0,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_purchase_quotations_status] DEFAULT N'Open',
    CONSTRAINT [purchase_quotations_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: PurchaseQuotationItem
CREATE TABLE [dbo].[purchase_quotation_items] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [quotation_id] INT NULL,
    [product_code] NVARCHAR(50) NULL,
    [product_name] NVARCHAR(150) NULL,
    [description] NVARCHAR(max) NULL,
    [hsn_code] NVARCHAR(50) NULL,
    [uom] NVARCHAR(50) NULL,
    [quantity] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_quotation_items_quantity] DEFAULT 0,
    [unit_price] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_quotation_items_unit_price] DEFAULT 0,
    [tax_percent] DECIMAL(5, 2) NOT NULL CONSTRAINT [DF_purchase_quotation_items_tax_percent] DEFAULT 0,
    [discount_percent] DECIMAL(5, 2) NOT NULL CONSTRAINT [DF_purchase_quotation_items_discount_percent] DEFAULT 0,
    [amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_quotation_items_amount] DEFAULT 0,
    CONSTRAINT [purchase_quotation_items_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: PurchaseOrder
CREATE TABLE [dbo].[purchase_orders] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [branch] NVARCHAR(150) NULL,
    [po_no] NVARCHAR(50) NOT NULL,
    [supplier] NVARCHAR(100) NULL,
    [contact_person] NVARCHAR(100) NULL,
    [phone] NVARCHAR(20) NULL,
    [email] NVARCHAR(100) NULL,
    [po_date] DATE NULL,
    [valid_upto] DATE NULL,
    [reference_no] NVARCHAR(50) NULL,
    [currency] NVARCHAR(10) NOT NULL CONSTRAINT [DF_purchase_orders_currency] DEFAULT N'INR',
    [payment_terms] NVARCHAR(50) NULL,
    [delivery_date] DATE NULL,
    [ship_to] NVARCHAR(150) NULL,
    [terms_conditions] NVARCHAR(max) NULL,
    [attachment_name] NVARCHAR(255) NULL,
    [discount_percent] DECIMAL(5, 2) NOT NULL CONSTRAINT [DF_purchase_orders_discount_percent] DEFAULT 0,
    [subtotal] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_orders_subtotal] DEFAULT 0,
    [taxable_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_orders_taxable_amount] DEFAULT 0,
    [cgst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_orders_cgst_amount] DEFAULT 0,
    [sgst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_orders_sgst_amount] DEFAULT 0,
    [igst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_orders_igst_amount] DEFAULT 0,
    [round_off] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_orders_round_off] DEFAULT 0,
    [amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_orders_amount] DEFAULT 0,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_purchase_orders_status] DEFAULT N'Open',
    [buying_branch] NVARCHAR(150) NULL,
    [department] NVARCHAR(100) NULL,
    [place_of_supply] NVARCHAR(100) NULL,
    [transport_mode] NVARCHAR(50) NULL,
    [e_way_bill_no] NVARCHAR(50) NULL,
    [e_way_bill_date] DATE NULL,
    [packing_forwarding] NVARCHAR(150) NULL,
    [loading_unloading] NVARCHAR(150) NULL,
    [inspection] NVARCHAR(150) NULL,
    [warranty] NVARCHAR(max) NULL,
    [remarks] NVARCHAR(max) NULL,
    [bank_account] NVARCHAR(150) NULL,
    [prepared_by] NVARCHAR(100) NULL,
    [checked_by] NVARCHAR(100) NULL,
    [approved_by] NVARCHAR(100) NULL,
    CONSTRAINT [purchase_orders_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: PurchaseOrderItem
CREATE TABLE [dbo].[purchase_order_items] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [order_id] INT NULL,
    [product_code] NVARCHAR(50) NULL,
    [product_name] NVARCHAR(150) NULL,
    [description] NVARCHAR(max) NULL,
    [hsn_code] NVARCHAR(50) NULL,
    [uom] NVARCHAR(50) NULL,
    [quantity] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_order_items_quantity] DEFAULT 0,
    [unit_price] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_order_items_unit_price] DEFAULT 0,
    [tax_percent] DECIMAL(5, 2) NOT NULL CONSTRAINT [DF_purchase_order_items_tax_percent] DEFAULT 0,
    [received_quantity] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_order_items_received_quantity] DEFAULT 0,
    [invoiced_quantity] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_order_items_invoiced_quantity] DEFAULT 0,
    [discount_percent] DECIMAL(5, 2) NOT NULL CONSTRAINT [DF_purchase_order_items_discount_percent] DEFAULT 0,
    [amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_order_items_amount] DEFAULT 0,
    CONSTRAINT [purchase_order_items_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: GoodsReceivedNote
CREATE TABLE [dbo].[goods_received_notes] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [branch] NVARCHAR(150) NULL,
    [grn_no] NVARCHAR(50) NOT NULL,
    [po_no] NVARCHAR(50) NULL,
    [po_date] DATE NULL,
    [supplier] NVARCHAR(100) NULL,
    [received_date] DATE NULL,
    [delivery_challan_no] NVARCHAR(50) NULL,
    [challan_date] DATE NULL,
    [delivery_date] DATE NULL,
    [warehouse] NVARCHAR(150) NULL,
    [received_by] NVARCHAR(100) NULL,
    [notes] NVARCHAR(max) NULL,
    [terms_conditions] NVARCHAR(max) NULL,
    [attachment_name] NVARCHAR(255) NULL,
    [total_items] INT NOT NULL CONSTRAINT [DF_goods_received_notes_total_items] DEFAULT 0,
    [subtotal] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_goods_received_notes_subtotal] DEFAULT 0,
    [cgst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_goods_received_notes_cgst_amount] DEFAULT 0,
    [sgst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_goods_received_notes_sgst_amount] DEFAULT 0,
    [igst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_goods_received_notes_igst_amount] DEFAULT 0,
    [round_off] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_goods_received_notes_round_off] DEFAULT 0,
    [taxable_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_goods_received_notes_taxable_amount] DEFAULT 0,
    [discount_percent] DECIMAL(5, 2) NOT NULL CONSTRAINT [DF_goods_received_notes_discount_percent] DEFAULT 0,
    [place_of_supply] NVARCHAR(100) NULL,
    [amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_goods_received_notes_amount] DEFAULT 0,
    [status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_goods_received_notes_status] DEFAULT N'Received',
    CONSTRAINT [goods_received_notes_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: GoodsReceivedNoteItem
CREATE TABLE [dbo].[goods_received_note_items] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [grn_id] INT NULL,
    [product_code] NVARCHAR(50) NULL,
    [product_name] NVARCHAR(150) NULL,
    [description] NVARCHAR(max) NULL,
    [hsn_code] NVARCHAR(50) NULL,
    [uom] NVARCHAR(50) NULL,
    [po_quantity] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_goods_received_note_items_po_quantity] DEFAULT 0,
    [previously_received] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_goods_received_note_items_previously_received] DEFAULT 0,
    [received_quantity] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_goods_received_note_items_received_quantity] DEFAULT 0,
    [unit_price] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_goods_received_note_items_unit_price] DEFAULT 0,
    [amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_goods_received_note_items_amount] DEFAULT 0,
    [tax_percent] DECIMAL(5, 2) NOT NULL CONSTRAINT [DF_goods_received_note_items_tax_percent] DEFAULT 0,
    [discount_percent] DECIMAL(5, 2) NOT NULL CONSTRAINT [DF_goods_received_note_items_discount_percent] DEFAULT 0,
    CONSTRAINT [goods_received_note_items_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: PurchaseInvoice
CREATE TABLE [dbo].[purchase_invoices] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [branch] NVARCHAR(150) NULL,
    [invoice_no] NVARCHAR(50) NOT NULL,
    [supplier] NVARCHAR(100) NULL,
    [invoice_date] DATE NULL,
    [grn_no] NVARCHAR(50) NULL,
    [po_no] NVARCHAR(50) NULL,
    [currency] NVARCHAR(10) NOT NULL CONSTRAINT [DF_purchase_invoices_currency] DEFAULT N'INR',
    [payment_terms] NVARCHAR(50) NULL,
    [due_date] DATE NULL,
    [place_of_supply] NVARCHAR(100) NULL,
    [bill_from] NVARCHAR(max) NULL,
    [ship_to] NVARCHAR(max) NULL,
    [notes] NVARCHAR(max) NULL,
    [terms_conditions] NVARCHAR(max) NULL,
    [attachment_name] NVARCHAR(255) NULL,
    [discount_percent] DECIMAL(5, 2) NOT NULL CONSTRAINT [DF_purchase_invoices_discount_percent] DEFAULT 0,
    [subtotal] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_invoices_subtotal] DEFAULT 0,
    [taxable_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_invoices_taxable_amount] DEFAULT 0,
    [cgst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_invoices_cgst_amount] DEFAULT 0,
    [sgst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_invoices_sgst_amount] DEFAULT 0,
    [igst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_invoices_igst_amount] DEFAULT 0,
    [round_off] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_invoices_round_off] DEFAULT 0,
    [amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_invoices_amount] DEFAULT 0,
    [status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_purchase_invoices_status] DEFAULT N'Draft',
    [payment_status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_purchase_invoices_payment_status] DEFAULT N'Unpaid',
    CONSTRAINT [purchase_invoices_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: PurchaseInvoiceItem
CREATE TABLE [dbo].[purchase_invoice_items] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [invoice_id] INT NULL,
    [product_code] NVARCHAR(50) NULL,
    [product_name] NVARCHAR(150) NULL,
    [description] NVARCHAR(max) NULL,
    [hsn_code] NVARCHAR(50) NULL,
    [uom] NVARCHAR(50) NULL,
    [quantity] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_invoice_items_quantity] DEFAULT 0,
    [unit_price] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_invoice_items_unit_price] DEFAULT 0,
    [discount_percent] DECIMAL(5, 2) NOT NULL CONSTRAINT [DF_purchase_invoice_items_discount_percent] DEFAULT 0,
    [tax_percent] DECIMAL(5, 2) NOT NULL CONSTRAINT [DF_purchase_invoice_items_tax_percent] DEFAULT 0,
    [amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_invoice_items_amount] DEFAULT 0,
    CONSTRAINT [purchase_invoice_items_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: PurchasePrice
CREATE TABLE [dbo].[purchase_prices] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [supplier] NVARCHAR(100) NULL,
    [product_code] NVARCHAR(50) NULL,
    [product_name] NVARCHAR(150) NULL,
    [uom] NVARCHAR(50) NULL,
    [currency] NVARCHAR(10) NOT NULL CONSTRAINT [DF_purchase_prices_currency] DEFAULT N'INR',
    [price] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_purchase_prices_price] DEFAULT 0,
    [effective_date] DATE NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_purchase_prices_status] DEFAULT N'Active',
    CONSTRAINT [purchase_prices_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: SalesPrice
CREATE TABLE [dbo].[sales_prices] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [customer] NVARCHAR(100) NULL,
    [product_code] NVARCHAR(50) NULL,
    [product_name] NVARCHAR(150) NULL,
    [uom] NVARCHAR(50) NULL,
    [currency] NVARCHAR(10) NOT NULL CONSTRAINT [DF_sales_prices_currency] DEFAULT N'INR',
    [price] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_prices_price] DEFAULT 0,
    [effective_date] DATE NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_sales_prices_status] DEFAULT N'Active',
    CONSTRAINT [sales_prices_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: CustomerDiscount
CREATE TABLE [dbo].[customer_discounts] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [customer] NVARCHAR(100) NULL,
    [discount_type] NVARCHAR(20) NOT NULL CONSTRAINT [DF_customer_discounts_discount_type] DEFAULT N'Flat',
    [product_code] NVARCHAR(50) NULL,
    [product_name] NVARCHAR(150) NULL,
    [discount_value] DECIMAL(5, 2) NOT NULL CONSTRAINT [DF_customer_discounts_discount_value] DEFAULT 0,
    [valid_from] DATE NULL,
    [valid_to] DATE NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_customer_discounts_status] DEFAULT N'Active',
    CONSTRAINT [customer_discounts_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: SalesQuotation
CREATE TABLE [dbo].[sales_quotations] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [branch] NVARCHAR(150) NULL,
    [quotation_no] NVARCHAR(50) NOT NULL,
    [customer] NVARCHAR(100) NULL,
    [contact_person] NVARCHAR(100) NULL,
    [phone] NVARCHAR(20) NULL,
    [email] NVARCHAR(100) NULL,
    [quotation_date] DATE NULL,
    [expiry_date] DATE NULL,
    [reference_no] NVARCHAR(50) NULL,
    [currency] NVARCHAR(10) NOT NULL CONSTRAINT [DF_sales_quotations_currency] DEFAULT N'INR',
    [price_list] NVARCHAR(100) NULL,
    [billing_address] NVARCHAR(max) NULL,
    [shipping_address] NVARCHAR(max) NULL,
    [terms_conditions] NVARCHAR(max) NULL,
    [notes] NVARCHAR(max) NULL,
    [attachment_name] NVARCHAR(255) NULL,
    [discount_percent] DECIMAL(5, 2) NOT NULL CONSTRAINT [DF_sales_quotations_discount_percent] DEFAULT 0,
    [subtotal] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_quotations_subtotal] DEFAULT 0,
    [taxable_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_quotations_taxable_amount] DEFAULT 0,
    [cgst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_quotations_cgst_amount] DEFAULT 0,
    [sgst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_quotations_sgst_amount] DEFAULT 0,
    [igst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_quotations_igst_amount] DEFAULT 0,
    [place_of_supply] NVARCHAR(100) NULL,
    [round_off] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_quotations_round_off] DEFAULT 0,
    [amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_quotations_amount] DEFAULT 0,
    [status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_sales_quotations_status] DEFAULT N'Draft',
    CONSTRAINT [sales_quotations_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: SalesQuotationItem
CREATE TABLE [dbo].[sales_quotation_items] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [quotation_id] INT NULL,
    [product_code] NVARCHAR(50) NULL,
    [product_name] NVARCHAR(150) NULL,
    [description] NVARCHAR(max) NULL,
    [hsn_code] NVARCHAR(50) NULL,
    [uom] NVARCHAR(50) NULL,
    [quantity] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_quotation_items_quantity] DEFAULT 0,
    [unit_price] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_quotation_items_unit_price] DEFAULT 0,
    [discount_percent] DECIMAL(5, 2) NOT NULL CONSTRAINT [DF_sales_quotation_items_discount_percent] DEFAULT 0,
    [tax_percent] DECIMAL(5, 2) NOT NULL CONSTRAINT [DF_sales_quotation_items_tax_percent] DEFAULT 0,
    [amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_quotation_items_amount] DEFAULT 0,
    CONSTRAINT [sales_quotation_items_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: SalesOrder
CREATE TABLE [dbo].[sales_orders] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [branch] NVARCHAR(150) NULL,
    [order_no] NVARCHAR(50) NOT NULL,
    [customer] NVARCHAR(100) NULL,
    [contact_person] NVARCHAR(100) NULL,
    [phone] NVARCHAR(20) NULL,
    [email] NVARCHAR(100) NULL,
    [order_date] DATE NULL,
    [delivery_date] DATE NULL,
    [reference_no] NVARCHAR(50) NULL,
    [currency] NVARCHAR(10) NOT NULL CONSTRAINT [DF_sales_orders_currency] DEFAULT N'INR',
    [payment_terms] NVARCHAR(50) NULL,
    [sales_person] NVARCHAR(100) NULL,
    [source] NVARCHAR(50) NULL,
    [billing_address] NVARCHAR(max) NULL,
    [shipping_address] NVARCHAR(max) NULL,
    [terms_conditions] NVARCHAR(max) NULL,
    [remarks] NVARCHAR(max) NULL,
    [discount_percent] DECIMAL(5, 2) NOT NULL CONSTRAINT [DF_sales_orders_discount_percent] DEFAULT 0,
    [subtotal] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_orders_subtotal] DEFAULT 0,
    [taxable_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_orders_taxable_amount] DEFAULT 0,
    [cgst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_orders_cgst_amount] DEFAULT 0,
    [sgst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_orders_sgst_amount] DEFAULT 0,
    [igst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_orders_igst_amount] DEFAULT 0,
    [place_of_supply] NVARCHAR(100) NULL,
    [round_off] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_orders_round_off] DEFAULT 0,
    [amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_orders_amount] DEFAULT 0,
    [status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_sales_orders_status] DEFAULT N'Draft',
    [payment_status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_sales_orders_payment_status] DEFAULT N'Unpaid',
    [invoice_no] NVARCHAR(50) NULL,
    CONSTRAINT [sales_orders_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: SalesOrderItem
CREATE TABLE [dbo].[sales_order_items] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [order_id] INT NULL,
    [product_code] NVARCHAR(50) NULL,
    [product_name] NVARCHAR(150) NULL,
    [description] NVARCHAR(max) NULL,
    [hsn_code] NVARCHAR(50) NULL,
    [uom] NVARCHAR(50) NULL,
    [quantity] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_order_items_quantity] DEFAULT 0,
    [unit_price] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_order_items_unit_price] DEFAULT 0,
    [discount_percent] DECIMAL(5, 2) NOT NULL CONSTRAINT [DF_sales_order_items_discount_percent] DEFAULT 0,
    [tax_percent] DECIMAL(5, 2) NOT NULL CONSTRAINT [DF_sales_order_items_tax_percent] DEFAULT 0,
    [amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_order_items_amount] DEFAULT 0,
    [delivered_quantity] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_order_items_delivered_quantity] DEFAULT 0,
    [invoiced_quantity] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_order_items_invoiced_quantity] DEFAULT 0,
    CONSTRAINT [sales_order_items_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: DeliveryChallan
CREATE TABLE [dbo].[delivery_challans] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [branch] NVARCHAR(150) NULL,
    [challan_no] NVARCHAR(50) NOT NULL,
    [customer] NVARCHAR(100) NULL,
    [contact_person] NVARCHAR(100) NULL,
    [order_no] NVARCHAR(50) NULL,
    [challan_date] DATE NULL,
    [delivery_date] DATE NULL,
    [from_warehouse] NVARCHAR(150) NULL,
    [sales_person] NVARCHAR(100) NULL,
    [billing_address] NVARCHAR(max) NULL,
    [shipping_address] NVARCHAR(max) NULL,
    [terms_conditions] NVARCHAR(max) NULL,
    [remarks] NVARCHAR(max) NULL,
    [subtotal] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_delivery_challans_subtotal] DEFAULT 0,
    [taxable_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_delivery_challans_taxable_amount] DEFAULT 0,
    [cgst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_delivery_challans_cgst_amount] DEFAULT 0,
    [sgst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_delivery_challans_sgst_amount] DEFAULT 0,
    [igst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_delivery_challans_igst_amount] DEFAULT 0,
    [discount_percent] DECIMAL(5, 2) NOT NULL CONSTRAINT [DF_delivery_challans_discount_percent] DEFAULT 0,
    [place_of_supply] NVARCHAR(100) NULL,
    [round_off] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_delivery_challans_round_off] DEFAULT 0,
    [amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_delivery_challans_amount] DEFAULT 0,
    [status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_delivery_challans_status] DEFAULT N'Pending',
    CONSTRAINT [delivery_challans_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: DeliveryChallanItem
CREATE TABLE [dbo].[delivery_challan_items] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [challan_id] INT NULL,
    [product_code] NVARCHAR(50) NULL,
    [product_name] NVARCHAR(150) NULL,
    [description] NVARCHAR(max) NULL,
    [hsn_code] NVARCHAR(50) NULL,
    [uom] NVARCHAR(50) NULL,
    [quantity] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_delivery_challan_items_quantity] DEFAULT 0,
    [unit_price] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_delivery_challan_items_unit_price] DEFAULT 0,
    [batch_no] NVARCHAR(100) NULL,
    [amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_delivery_challan_items_amount] DEFAULT 0,
    [cost_price] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_delivery_challan_items_cost_price] DEFAULT 0,
    [tax_percent] DECIMAL(5, 2) NOT NULL CONSTRAINT [DF_delivery_challan_items_tax_percent] DEFAULT 0,
    [discount_percent] DECIMAL(5, 2) NOT NULL CONSTRAINT [DF_delivery_challan_items_discount_percent] DEFAULT 0,
    CONSTRAINT [delivery_challan_items_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: SalesInvoice
CREATE TABLE [dbo].[sales_invoices] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [branch] NVARCHAR(150) NULL,
    [invoice_no] NVARCHAR(50) NOT NULL,
    [customer] NVARCHAR(100) NULL,
    [invoice_date] DATE NULL,
    [order_no] NVARCHAR(50) NULL,
    [order_date] DATE NULL,
    [delivery_challan_no] NVARCHAR(50) NULL,
    [challan_date] DATE NULL,
    [due_date] DATE NULL,
    [currency] NVARCHAR(10) NOT NULL CONSTRAINT [DF_sales_invoices_currency] DEFAULT N'INR',
    [payment_terms] NVARCHAR(50) NULL,
    [sales_person] NVARCHAR(100) NULL,
    [source] NVARCHAR(50) NULL,
    [place_of_supply] NVARCHAR(100) NULL,
    [billing_address] NVARCHAR(max) NULL,
    [shipping_address] NVARCHAR(max) NULL,
    [terms_conditions] NVARCHAR(max) NULL,
    [remarks] NVARCHAR(max) NULL,
    [discount_percent] DECIMAL(5, 2) NOT NULL CONSTRAINT [DF_sales_invoices_discount_percent] DEFAULT 0,
    [subtotal] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_invoices_subtotal] DEFAULT 0,
    [taxable_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_invoices_taxable_amount] DEFAULT 0,
    [cgst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_invoices_cgst_amount] DEFAULT 0,
    [sgst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_invoices_sgst_amount] DEFAULT 0,
    [igst_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_invoices_igst_amount] DEFAULT 0,
    [round_off] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_invoices_round_off] DEFAULT 0,
    [amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_invoices_amount] DEFAULT 0,
    [status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_sales_invoices_status] DEFAULT N'Draft',
    [payment_status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_sales_invoices_payment_status] DEFAULT N'Unpaid',
    CONSTRAINT [sales_invoices_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: SalesInvoiceItem
CREATE TABLE [dbo].[sales_invoice_items] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [invoice_id] INT NULL,
    [product_code] NVARCHAR(50) NULL,
    [product_name] NVARCHAR(150) NULL,
    [description] NVARCHAR(max) NULL,
    [hsn_code] NVARCHAR(50) NULL,
    [uom] NVARCHAR(50) NULL,
    [quantity] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_invoice_items_quantity] DEFAULT 0,
    [unit_price] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_invoice_items_unit_price] DEFAULT 0,
    [discount_percent] DECIMAL(5, 2) NOT NULL CONSTRAINT [DF_sales_invoice_items_discount_percent] DEFAULT 0,
    [tax_percent] DECIMAL(5, 2) NOT NULL CONSTRAINT [DF_sales_invoice_items_tax_percent] DEFAULT 0,
    [amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_invoice_items_amount] DEFAULT 0,
    [cost_price] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_sales_invoice_items_cost_price] DEFAULT 0,
    CONSTRAINT [sales_invoice_items_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: CustomerOutstanding
CREATE TABLE [dbo].[customer_outstanding] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [customer_name] NVARCHAR(100) NULL,
    [invoice_no] NVARCHAR(50) NULL,
    [invoice_date] DATE NULL,
    [due_date] DATE NULL,
    [invoice_amount] DECIMAL(15, 2) NULL,
    [paid_amount] DECIMAL(15, 2) NULL,
    [balance_amount] DECIMAL(15, 2) NULL,
    [status] NVARCHAR(50) NULL,
    CONSTRAINT [customer_outstanding_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: Collection
CREATE TABLE [dbo].[collections] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [branch] NVARCHAR(150) NULL,
    [collection_no] NVARCHAR(50) NOT NULL,
    [customer_name] NVARCHAR(100) NULL,
    [receipt_date] DATE NULL,
    [posting_date] DATE NULL,
    [payment_mode] NVARCHAR(50) NULL,
    [deposit_to] NVARCHAR(150) NULL,
    [notes] NVARCHAR(max) NULL,
    [received_by] NVARCHAR(150) NULL,
    [instrument_no] NVARCHAR(100) NULL,
    [payment_currency] NVARCHAR(10) NOT NULL CONSTRAINT [DF_collections_payment_currency] DEFAULT N'INR',
    [payment_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_collections_payment_amount] DEFAULT 0,
    [payment_date] DATE NULL,
    [remarks] NVARCHAR(max) NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_collections_status] DEFAULT N'Draft',
    [total_applied_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_collections_total_applied_amount] DEFAULT 0,
    CONSTRAINT [collections_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: CollectionInvoiceApplication
CREATE TABLE [dbo].[collection_invoice_applications] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [collection_id] INT NULL,
    [invoice_no] NVARCHAR(50) NULL,
    [invoice_date] DATE NULL,
    [due_date] DATE NULL,
    [total_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_collection_invoice_applications_total_amount] DEFAULT 0,
    [outstanding_at_time_of_application] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_collection_invoice_applications_outstanding_at_time_of_application] DEFAULT 0,
    [amount_applied] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_collection_invoice_applications_amount_applied] DEFAULT 0,
    CONSTRAINT [collection_invoice_applications_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: SupplierOutstanding
CREATE TABLE [dbo].[supplier_outstanding] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [supplier_name] NVARCHAR(100) NULL,
    [invoice_no] NVARCHAR(50) NULL,
    [invoice_date] DATE NULL,
    [due_date] DATE NULL,
    [invoice_amount] DECIMAL(15, 2) NULL,
    [paid_amount] DECIMAL(15, 2) NULL,
    [balance_amount] DECIMAL(15, 2) NULL,
    [status] NVARCHAR(50) NULL,
    CONSTRAINT [supplier_outstanding_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: SupplierPayment
CREATE TABLE [dbo].[supplier_payments] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [branch] NVARCHAR(150) NULL,
    [payment_no] NVARCHAR(50) NOT NULL,
    [supplier_name] NVARCHAR(100) NULL,
    [payment_date] DATE NULL,
    [posting_date] DATE NULL,
    [payment_mode] NVARCHAR(50) NULL,
    [pay_from_account] NVARCHAR(150) NULL,
    [notes] NVARCHAR(max) NULL,
    [paid_by] NVARCHAR(150) NULL,
    [instrument_no] NVARCHAR(100) NULL,
    [payment_currency] NVARCHAR(10) NOT NULL CONSTRAINT [DF_supplier_payments_payment_currency] DEFAULT N'INR',
    [payment_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_supplier_payments_payment_amount] DEFAULT 0,
    [summary_payment_date] DATE NULL,
    [remarks] NVARCHAR(max) NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_supplier_payments_status] DEFAULT N'Draft',
    [total_applied_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_supplier_payments_total_applied_amount] DEFAULT 0,
    CONSTRAINT [supplier_payments_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: PaymentInvoiceApplication
CREATE TABLE [dbo].[payment_invoice_applications] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [payment_id] INT NULL,
    [invoice_no] NVARCHAR(50) NULL,
    [invoice_date] DATE NULL,
    [due_date] DATE NULL,
    [total_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_payment_invoice_applications_total_amount] DEFAULT 0,
    [outstanding_at_time_of_application] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_payment_invoice_applications_outstanding_at_time_of_application] DEFAULT 0,
    [amount_applied] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_payment_invoice_applications_amount_applied] DEFAULT 0,
    CONSTRAINT [payment_invoice_applications_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: BankDeposit
CREATE TABLE [dbo].[bank_deposits] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [branch] NVARCHAR(150) NULL,
    [deposit_no] NVARCHAR(50) NOT NULL,
    [deposit_date] DATE NULL,
    [deposit_to] NVARCHAR(150) NULL,
    [deposit_type] NVARCHAR(50) NULL,
    [posting_date] DATE NULL,
    [received_from] NVARCHAR(150) NULL,
    [remarks] NVARCHAR(max) NULL,
    [attachment_name] NVARCHAR(255) NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_bank_deposits_status] DEFAULT N'Draft',
    [total_deposit_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_bank_deposits_total_deposit_amount] DEFAULT 0,
    [interest_rate] DECIMAL(6, 3) NULL,
    [maturity_date] DATE NULL,
    [maturity_amount] DECIMAL(15, 2) NULL,
    CONSTRAINT [bank_deposits_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: DepositItem
CREATE TABLE [dbo].[deposit_items] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [deposit_id] INT NULL,
    [payment_mode] NVARCHAR(50) NULL,
    [instrument_no] NVARCHAR(100) NULL,
    [instrument_date] DATE NULL,
    [account_description] NVARCHAR(255) NULL,
    [amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_deposit_items_amount] DEFAULT 0,
    CONSTRAINT [deposit_items_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: BankReconciliation
CREATE TABLE [dbo].[bank_reconciliations] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [bank_account] NVARCHAR(150) NULL,
    [statement_date] DATE NULL,
    [reconciliation_date] DATE NULL,
    [opening_balance] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_bank_reconciliations_opening_balance] DEFAULT 0,
    [status] NVARCHAR(30) NOT NULL CONSTRAINT [DF_bank_reconciliations_status] DEFAULT N'In Progress',
    [notes] NVARCHAR(max) NULL,
    CONSTRAINT [bank_reconciliations_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: BankReconciliationTransaction
CREATE TABLE [dbo].[bank_reconciliation_transactions] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [reconciliation_id] INT NULL,
    [source] NVARCHAR(20) NULL,
    [txn_date] DATE NULL,
    [description] NVARCHAR(255) NULL,
    [ref_no] NVARCHAR(100) NULL,
    [voucher_type] NVARCHAR(50) NULL,
    [voucher_no] NVARCHAR(100) NULL,
    [type] NVARCHAR(30) NULL,
    [amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_bank_reconciliation_transactions_amount] DEFAULT 0,
    [remarks] NVARCHAR(255) NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_bank_reconciliation_transactions_status] DEFAULT N'Unreconciled',
    CONSTRAINT [bank_reconciliation_transactions_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: Cheque
CREATE TABLE [dbo].[cheques] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [branch] NVARCHAR(150) NULL,
    [cheque_no] NVARCHAR(50) NOT NULL,
    [bank_account] NVARCHAR(150) NULL,
    [cheque_date] DATE NULL,
    [cheque_type] NVARCHAR(50) NULL,
    [pay_to] NVARCHAR(150) NULL,
    [print_template] NVARCHAR(50) NULL,
    [amount] DECIMAL(15, 2) NULL,
    [amount_in_words] NVARCHAR(255) NULL,
    [narration] NVARCHAR(max) NULL,
    [attachment_name] NVARCHAR(255) NULL,
    [status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_cheques_status] DEFAULT N'Pending',
    [supplier_name] NVARCHAR(150) NULL,
    [total_applied_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_cheques_total_applied_amount] DEFAULT 0,
    CONSTRAINT [cheques_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: ChequeInvoiceApplication
CREATE TABLE [dbo].[cheque_invoice_applications] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [cheque_id] INT NULL,
    [invoice_no] NVARCHAR(50) NULL,
    [invoice_date] DATE NULL,
    [due_date] DATE NULL,
    [total_amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_cheque_invoice_applications_total_amount] DEFAULT 0,
    [outstanding] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_cheque_invoice_applications_outstanding] DEFAULT 0,
    [amount_to_pay] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_cheque_invoice_applications_amount_to_pay] DEFAULT 0,
    CONSTRAINT [cheque_invoice_applications_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: StockReceipt
CREATE TABLE [dbo].[stock_receipts] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [branch] NVARCHAR(150) NULL,
    [receipt_no] NVARCHAR(50) NOT NULL,
    [receipt_type] NVARCHAR(50) NULL,
    [date] DATE NULL,
    [posting_date] DATE NULL,
    [reference_no] NVARCHAR(50) NULL,
    [warehouse] NVARCHAR(150) NULL,
    [notes] NVARCHAR(max) NULL,
    [attachment_name] NVARCHAR(255) NULL,
    [remarks] NVARCHAR(max) NULL,
    [amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_stock_receipts_amount] DEFAULT 0,
    [status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_stock_receipts_status] DEFAULT N'Draft',
    CONSTRAINT [stock_receipts_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: StockReceiptItem
CREATE TABLE [dbo].[stock_receipt_items] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [receipt_id] INT NULL,
    [product_code] NVARCHAR(50) NULL,
    [product_name] NVARCHAR(150) NULL,
    [hsn_code] NVARCHAR(50) NULL,
    [batch_no] NVARCHAR(100) NULL,
    [expiry_date] DATE NULL,
    [uom] NVARCHAR(50) NULL,
    [quantity] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_stock_receipt_items_quantity] DEFAULT 0,
    [unit_price] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_stock_receipt_items_unit_price] DEFAULT 0,
    [amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_stock_receipt_items_amount] DEFAULT 0,
    CONSTRAINT [stock_receipt_items_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: StockIssue
CREATE TABLE [dbo].[stock_issues] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [branch] NVARCHAR(150) NULL,
    [issue_no] NVARCHAR(50) NOT NULL,
    [issue_type] NVARCHAR(50) NULL,
    [date] DATE NULL,
    [posting_date] DATE NULL,
    [reference_no] NVARCHAR(50) NULL,
    [to_warehouse] NVARCHAR(150) NULL,
    [notes] NVARCHAR(max) NULL,
    [attachment_name] NVARCHAR(255) NULL,
    [remarks] NVARCHAR(max) NULL,
    [amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_stock_issues_amount] DEFAULT 0,
    [status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_stock_issues_status] DEFAULT N'Draft',
    CONSTRAINT [stock_issues_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: StockIssueItem
CREATE TABLE [dbo].[stock_issue_items] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [issue_id] INT NULL,
    [product_code] NVARCHAR(50) NULL,
    [product_name] NVARCHAR(150) NULL,
    [hsn_code] NVARCHAR(50) NULL,
    [batch_no] NVARCHAR(100) NULL,
    [expiry_date] DATE NULL,
    [uom] NVARCHAR(50) NULL,
    [quantity] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_stock_issue_items_quantity] DEFAULT 0,
    [unit_price] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_stock_issue_items_unit_price] DEFAULT 0,
    [amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_stock_issue_items_amount] DEFAULT 0,
    CONSTRAINT [stock_issue_items_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: StockAdjustment
CREATE TABLE [dbo].[stock_adjustments] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [branch] NVARCHAR(150) NULL,
    [adjustment_no] NVARCHAR(50) NOT NULL,
    [adjustment_type] NVARCHAR(50) NULL,
    [date] DATE NULL,
    [posting_date] DATE NULL,
    [reference_no] NVARCHAR(50) NULL,
    [warehouse] NVARCHAR(150) NULL,
    [reason] NVARCHAR(max) NULL,
    [attachment_name] NVARCHAR(255) NULL,
    [remarks] NVARCHAR(max) NULL,
    [amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_stock_adjustments_amount] DEFAULT 0,
    [status] NVARCHAR(50) NOT NULL CONSTRAINT [DF_stock_adjustments_status] DEFAULT N'Draft',
    CONSTRAINT [stock_adjustments_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: StockAdjustmentItem
CREATE TABLE [dbo].[stock_adjustment_items] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [adjustment_id] INT NULL,
    [product_code] NVARCHAR(50) NULL,
    [product_name] NVARCHAR(150) NULL,
    [hsn_code] NVARCHAR(50) NULL,
    [batch_no] NVARCHAR(100) NULL,
    [expiry_date] DATE NULL,
    [uom] NVARCHAR(50) NULL,
    [system_quantity] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_stock_adjustment_items_system_quantity] DEFAULT 0,
    [physical_quantity] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_stock_adjustment_items_physical_quantity] DEFAULT 0,
    [difference_quantity] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_stock_adjustment_items_difference_quantity] DEFAULT 0,
    [item_adjustment_type] NVARCHAR(20) NULL,
    [quantity] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_stock_adjustment_items_quantity] DEFAULT 0,
    [reason] NVARCHAR(255) NULL,
    [unit_price] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_stock_adjustment_items_unit_price] DEFAULT 0,
    [amount] DECIMAL(15, 2) NOT NULL CONSTRAINT [DF_stock_adjustment_items_amount] DEFAULT 0,
    CONSTRAINT [stock_adjustment_items_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: Stock (inventory transaction journal, modelled on SAP B1's OINM)
-- Guarded so it is safe to re-run against a database that already has the
-- table — this one may pre-date the migration on an installed system.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Stock')
BEGIN
    CREATE TABLE [dbo].[Stock] (
        [DocEntry] BIGINT IDENTITY(1,1) NOT NULL,
        [ItemCode] NVARCHAR(50) NOT NULL,
        [ItemId] INT NOT NULL,
        [Dscription] NVARCHAR(200) NULL,
        [Warehouse] NVARCHAR(8) NULL,
        [InQty] DECIMAL(19,6) NOT NULL CONSTRAINT [DF_Stock_InQty] DEFAULT 0,
        [OutQty] DECIMAL(19,6) NOT NULL CONSTRAINT [DF_Stock_OutQty] DEFAULT 0,
        [Price] DECIMAL(19,6) NULL,
        [Currency] NVARCHAR(3) NULL,
        [TransValue] DECIMAL(19,6) NULL,
        [TransNum] INT NOT NULL,
        [TransType] NVARCHAR(50) NOT NULL CONSTRAINT [DF_Stock_TransType] DEFAULT N'Unknown',
        [FIFO] DECIMAL(19,6) NULL,
        [MAV] DECIMAL(19,6) NULL,
        [LineNum] INT NULL,
        [CreatedBy] INT NULL,
        [CreateDate] DATE NULL,
        [CreateTime] TIME NULL,
        CONSTRAINT [PK_OINM] PRIMARY KEY CLUSTERED ([DocEntry])
    );

    -- Movements are almost always read either "everything this document
    -- posted" or "everything that happened to this item in this warehouse".
    CREATE INDEX [IX_Stock_TransType_TransNum] ON [dbo].[Stock]([TransType], [TransNum]);
    CREATE INDEX [IX_Stock_ItemCode_Warehouse] ON [dbo].[Stock]([ItemCode], [Warehouse]);
END

-- CreateTable: RefreshToken
CREATE TABLE [dbo].[refresh_tokens] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [token] NVARCHAR(500) NOT NULL,
    [user_id] INT NOT NULL,
    [expires_at] DATETIME2 NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_refresh_tokens_created_at] DEFAULT GETDATE(),
    [revoked] BIT NOT NULL CONSTRAINT [DF_refresh_tokens_revoked] DEFAULT 0,
    CONSTRAINT [refresh_tokens_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: Enquiry
CREATE TABLE [dbo].[enquiries] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [branch] NVARCHAR(150) NULL,
    [enquiry_no] NVARCHAR(50) NOT NULL,
    [enquiry_date] DATE NULL,
    [source_of_enquiry] NVARCHAR(50) NULL,
    [enquiry_type] NVARCHAR(50) NULL,
    [priority] NVARCHAR(20) NULL,
    [subject] NVARCHAR(255) NULL,
    [reference_campaign] NVARCHAR(150) NULL,
    [customer_name] NVARCHAR(150) NULL,
    [contact_person] NVARCHAR(100) NULL,
    [mobile_no] NVARCHAR(20) NULL,
    [email_id] NVARCHAR(100) NULL,
    [address] NVARCHAR(max) NULL,
    [city] NVARCHAR(100) NULL,
    [state] NVARCHAR(100) NULL,
    [pin_code] NVARCHAR(20) NULL,
    [requirement_description] NVARCHAR(max) NULL,
    [expected_budget] DECIMAL(15, 2) NULL,
    [expected_closure_date] DATE NULL,
    [no_of_locations] INT NULL,
    [product_service_interest] NVARCHAR(150) NULL,
    [installation_required] NVARCHAR(10) NULL CONSTRAINT [DF_enquiries_installation_required] DEFAULT N'No',
    [amc_required] NVARCHAR(10) NULL CONSTRAINT [DF_enquiries_amc_required] DEFAULT N'No',
    [existing_setup] NVARCHAR(10) NULL CONSTRAINT [DF_enquiries_existing_setup] DEFAULT N'No',
    [competitor_discussed] NVARCHAR(10) NULL CONSTRAINT [DF_enquiries_competitor_discussed] DEFAULT N'No',
    [competitor_name] NVARCHAR(150) NULL,
    [hear_about_us] NVARCHAR(150) NULL,
    [remarks] NVARCHAR(max) NULL,
    [status] NVARCHAR(30) NOT NULL CONSTRAINT [DF_enquiries_status] DEFAULT N'New',
    [assigned_to] NVARCHAR(150) NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_enquiries_created_at] DEFAULT GETDATE(),
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [enquiries_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable: FollowUp
CREATE TABLE [dbo].[follow_ups] (
    [id] INT IDENTITY(1,1) NOT NULL,
    [follow_up_no] NVARCHAR(50) NOT NULL,
    [enquiry_id] INT NULL,
    [follow_up_mode] NVARCHAR(20) NULL,
    [follow_up_date] DATE NULL,
    [follow_up_time] NVARCHAR(10) NULL,
    [follow_up_by] NVARCHAR(150) NULL,
    [next_follow_up_date] DATE NULL,
    [follow_up_with] NVARCHAR(150) NULL,
    [designation] NVARCHAR(100) NULL,
    [department] NVARCHAR(100) NULL,
    [phone_no] NVARCHAR(20) NULL,
    [email_id] NVARCHAR(100) NULL,
    [purpose_discussion] NVARCHAR(max) NULL,
    [outcome_result] NVARCHAR(max) NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_follow_ups_status] DEFAULT N'Pending',
    [follow_up_notes] NVARCHAR(max) NULL,
    [reminder_alert] NVARCHAR(10) NULL CONSTRAINT [DF_follow_ups_reminder_alert] DEFAULT N'No',
    [reminder_date] DATE NULL,
    [reminder_time] NVARCHAR(10) NULL,
    [assign_to] NVARCHAR(150) NULL,
    [priority] NVARCHAR(20) NULL,
    [attachment_name] NVARCHAR(255) NULL,
    [internal_remarks] NVARCHAR(max) NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_follow_ups_created_at] DEFAULT GETDATE(),
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [follow_ups_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex (field-level @unique)
CREATE UNIQUE INDEX [app_users_email_key] ON [dbo].[app_users]([email]);
CREATE UNIQUE INDEX [branches_branch_code_key] ON [dbo].[branches]([branch_code]);
CREATE UNIQUE INDEX [tax_codes_tax_code_key] ON [dbo].[tax_codes]([tax_code]);
CREATE UNIQUE INDEX [bank_names_bank_name_key] ON [dbo].[bank_names]([bank_name]);
CREATE UNIQUE INDEX [sales_employees_employee_code_key] ON [dbo].[sales_employees]([employee_code]);
CREATE UNIQUE INDEX [product_groups_group_code_key] ON [dbo].[product_groups]([group_code]);
CREATE UNIQUE INDEX [product_sub_groups_sub_group_code_key] ON [dbo].[product_sub_groups]([sub_group_code]);
CREATE UNIQUE INDEX [brands_brand_code_key] ON [dbo].[brands]([brand_code]);
CREATE UNIQUE INDEX [uoms_uom_code_key] ON [dbo].[uoms]([uom_code]);
CREATE UNIQUE INDEX [products_product_code_key] ON [dbo].[products]([product_code]);
CREATE UNIQUE INDEX [product_catalogs_catalog_code_key] ON [dbo].[product_catalogs]([catalog_code]);
CREATE UNIQUE INDEX [customers_customer_code_key] ON [dbo].[customers]([customer_code]);
CREATE UNIQUE INDEX [suppliers_supplier_code_key] ON [dbo].[suppliers]([supplier_code]);
CREATE UNIQUE INDEX [transporters_transporter_code_key] ON [dbo].[transporters]([transporter_code]);
CREATE UNIQUE INDEX [purchase_quotations_quotation_no_key] ON [dbo].[purchase_quotations]([quotation_no]);
CREATE UNIQUE INDEX [purchase_orders_po_no_key] ON [dbo].[purchase_orders]([po_no]);
CREATE UNIQUE INDEX [goods_received_notes_grn_no_key] ON [dbo].[goods_received_notes]([grn_no]);
CREATE UNIQUE INDEX [purchase_invoices_invoice_no_key] ON [dbo].[purchase_invoices]([invoice_no]);
CREATE UNIQUE INDEX [sales_quotations_quotation_no_key] ON [dbo].[sales_quotations]([quotation_no]);
CREATE UNIQUE INDEX [sales_orders_order_no_key] ON [dbo].[sales_orders]([order_no]);
CREATE UNIQUE INDEX [delivery_challans_challan_no_key] ON [dbo].[delivery_challans]([challan_no]);
CREATE UNIQUE INDEX [sales_invoices_invoice_no_key] ON [dbo].[sales_invoices]([invoice_no]);
CREATE UNIQUE INDEX [collections_collection_no_key] ON [dbo].[collections]([collection_no]);
CREATE UNIQUE INDEX [supplier_payments_payment_no_key] ON [dbo].[supplier_payments]([payment_no]);
CREATE UNIQUE INDEX [bank_deposits_deposit_no_key] ON [dbo].[bank_deposits]([deposit_no]);
CREATE UNIQUE INDEX [cheques_cheque_no_key] ON [dbo].[cheques]([cheque_no]);
CREATE UNIQUE INDEX [stock_receipts_receipt_no_key] ON [dbo].[stock_receipts]([receipt_no]);
CREATE UNIQUE INDEX [stock_issues_issue_no_key] ON [dbo].[stock_issues]([issue_no]);
CREATE UNIQUE INDEX [stock_adjustments_adjustment_no_key] ON [dbo].[stock_adjustments]([adjustment_no]);
CREATE UNIQUE INDEX [refresh_tokens_token_key] ON [dbo].[refresh_tokens]([token]);
CREATE UNIQUE INDEX [enquiries_enquiry_no_key] ON [dbo].[enquiries]([enquiry_no]);
CREATE UNIQUE INDEX [follow_ups_follow_up_no_key] ON [dbo].[follow_ups]([follow_up_no]);

-- CreateIndex (@@unique)
CREATE UNIQUE INDEX [document_numbering_code_fy_name_key] ON [dbo].[document_numbering]([document_code], [financial_year_id], [series_name]);

-- CreateIndex (@@index)
CREATE INDEX [document_numbering_code_status_idx] ON [dbo].[document_numbering]([document_code], [status]);
CREATE INDEX [document_numbering_fy_idx] ON [dbo].[document_numbering]([financial_year_id]);
CREATE INDEX [document_numbering_default_idx] ON [dbo].[document_numbering]([document_code], [financial_year_id], [is_default]);

-- AddForeignKey
ALTER TABLE [dbo].[document_numbering] ADD CONSTRAINT [document_numbering_financial_year_id_fkey] FOREIGN KEY ([financial_year_id]) REFERENCES [dbo].[financial_years]([id]) ON DELETE CASCADE;
ALTER TABLE [dbo].[approval_flow_levels] ADD CONSTRAINT [approval_flow_levels_approval_flow_id_fkey] FOREIGN KEY ([approval_flow_id]) REFERENCES [dbo].[approval_flows]([id]) ON DELETE CASCADE;
ALTER TABLE [dbo].[product_sub_groups] ADD CONSTRAINT [product_sub_groups_group_id_fkey] FOREIGN KEY ([group_id]) REFERENCES [dbo].[product_groups]([id]) ON DELETE SET NULL;
ALTER TABLE [dbo].[product_catalog_items] ADD CONSTRAINT [product_catalog_items_catalog_id_fkey] FOREIGN KEY ([catalog_id]) REFERENCES [dbo].[product_catalogs]([id]) ON DELETE CASCADE;
ALTER TABLE [dbo].[purchase_quotation_items] ADD CONSTRAINT [purchase_quotation_items_quotation_id_fkey] FOREIGN KEY ([quotation_id]) REFERENCES [dbo].[purchase_quotations]([id]) ON DELETE CASCADE;
ALTER TABLE [dbo].[purchase_order_items] ADD CONSTRAINT [purchase_order_items_order_id_fkey] FOREIGN KEY ([order_id]) REFERENCES [dbo].[purchase_orders]([id]) ON DELETE CASCADE;
ALTER TABLE [dbo].[goods_received_note_items] ADD CONSTRAINT [goods_received_note_items_grn_id_fkey] FOREIGN KEY ([grn_id]) REFERENCES [dbo].[goods_received_notes]([id]) ON DELETE CASCADE;
ALTER TABLE [dbo].[purchase_invoice_items] ADD CONSTRAINT [purchase_invoice_items_invoice_id_fkey] FOREIGN KEY ([invoice_id]) REFERENCES [dbo].[purchase_invoices]([id]) ON DELETE CASCADE;
ALTER TABLE [dbo].[sales_quotation_items] ADD CONSTRAINT [sales_quotation_items_quotation_id_fkey] FOREIGN KEY ([quotation_id]) REFERENCES [dbo].[sales_quotations]([id]) ON DELETE CASCADE;
ALTER TABLE [dbo].[sales_order_items] ADD CONSTRAINT [sales_order_items_order_id_fkey] FOREIGN KEY ([order_id]) REFERENCES [dbo].[sales_orders]([id]) ON DELETE CASCADE;
ALTER TABLE [dbo].[delivery_challan_items] ADD CONSTRAINT [delivery_challan_items_challan_id_fkey] FOREIGN KEY ([challan_id]) REFERENCES [dbo].[delivery_challans]([id]) ON DELETE CASCADE;
ALTER TABLE [dbo].[sales_invoice_items] ADD CONSTRAINT [sales_invoice_items_invoice_id_fkey] FOREIGN KEY ([invoice_id]) REFERENCES [dbo].[sales_invoices]([id]) ON DELETE CASCADE;
ALTER TABLE [dbo].[collection_invoice_applications] ADD CONSTRAINT [collection_invoice_applications_collection_id_fkey] FOREIGN KEY ([collection_id]) REFERENCES [dbo].[collections]([id]) ON DELETE CASCADE;
ALTER TABLE [dbo].[payment_invoice_applications] ADD CONSTRAINT [payment_invoice_applications_payment_id_fkey] FOREIGN KEY ([payment_id]) REFERENCES [dbo].[supplier_payments]([id]) ON DELETE CASCADE;
ALTER TABLE [dbo].[deposit_items] ADD CONSTRAINT [deposit_items_deposit_id_fkey] FOREIGN KEY ([deposit_id]) REFERENCES [dbo].[bank_deposits]([id]) ON DELETE CASCADE;
ALTER TABLE [dbo].[bank_reconciliation_transactions] ADD CONSTRAINT [bank_reconciliation_transactions_reconciliation_id_fkey] FOREIGN KEY ([reconciliation_id]) REFERENCES [dbo].[bank_reconciliations]([id]) ON DELETE CASCADE;
ALTER TABLE [dbo].[cheque_invoice_applications] ADD CONSTRAINT [cheque_invoice_applications_cheque_id_fkey] FOREIGN KEY ([cheque_id]) REFERENCES [dbo].[cheques]([id]) ON DELETE CASCADE;
ALTER TABLE [dbo].[stock_receipt_items] ADD CONSTRAINT [stock_receipt_items_receipt_id_fkey] FOREIGN KEY ([receipt_id]) REFERENCES [dbo].[stock_receipts]([id]) ON DELETE CASCADE;
ALTER TABLE [dbo].[stock_issue_items] ADD CONSTRAINT [stock_issue_items_issue_id_fkey] FOREIGN KEY ([issue_id]) REFERENCES [dbo].[stock_issues]([id]) ON DELETE CASCADE;
ALTER TABLE [dbo].[stock_adjustment_items] ADD CONSTRAINT [stock_adjustment_items_adjustment_id_fkey] FOREIGN KEY ([adjustment_id]) REFERENCES [dbo].[stock_adjustments]([id]) ON DELETE CASCADE;
ALTER TABLE [dbo].[refresh_tokens] ADD CONSTRAINT [refresh_tokens_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[app_users]([id]) ON DELETE CASCADE;
ALTER TABLE [dbo].[follow_ups] ADD CONSTRAINT [follow_ups_enquiry_id_fkey] FOREIGN KEY ([enquiry_id]) REFERENCES [dbo].[enquiries]([id]) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- SQL-only objects that schema.prisma cannot express (carried forward from
-- the original Postgres migration history — see migrations
-- 20260805090000_multiple_series_per_document, 20260807090000_tax_correctness
-- _and_outstanding_integrity, 20260808090000_document_flow_costing_and
-- _settlement and 20260809090000_master_code_numbering for the original
-- rationale). Prisma's schema language has no way to model a partial/filtered
-- unique index or a CHECK constraint, so these are maintained here by hand
-- and must never be "cleaned up" by a future `prisma migrate dev` diff.
-- ---------------------------------------------------------------------------

-- At most one default series per (document type, financial year).
CREATE UNIQUE INDEX [document_numbering_one_default_key]
  ON [dbo].[document_numbering] ([document_code], [financial_year_id])
  WHERE [is_default] = 1;

-- Perpetual master-code series (financial_year_id IS NULL) are not covered by
-- document_numbering_code_fy_name_key, since SQL Server — like Postgres —
-- treats NULL as distinct in a composite unique index. These two close that
-- hole for master series specifically.
CREATE UNIQUE INDEX [document_numbering_master_name_key]
  ON [dbo].[document_numbering] ([document_code], [series_name])
  WHERE [financial_year_id] IS NULL;

CREATE UNIQUE INDEX [document_numbering_master_one_default_key]
  ON [dbo].[document_numbering] ([document_code])
  WHERE [financial_year_id] IS NULL AND [is_default] = 1;

CREATE INDEX [document_numbering_master_idx]
  ON [dbo].[document_numbering] ([document_code])
  WHERE [financial_year_id] IS NULL;

-- A perpetual (master-code) series must never claim to reset or carry a year
-- token; both would eventually reissue a code that already exists.
ALTER TABLE [dbo].[document_numbering]
  ADD CONSTRAINT [document_numbering_master_no_fy_reset_check]
  CHECK (
    [financial_year_id] IS NOT NULL
    OR ([reset_every_fy] = 0 AND [include_fy_in_number] = 0)
  );

-- One outstanding row per invoice (duplicates would let a collection/payment
-- silently settle only one of several rows for the same invoice).
CREATE UNIQUE INDEX [customer_outstanding_invoice_no_key]
  ON [dbo].[customer_outstanding] ([invoice_no]) WHERE [invoice_no] IS NOT NULL;

CREATE UNIQUE INDEX [supplier_outstanding_invoice_no_key]
  ON [dbo].[supplier_outstanding] ([invoice_no]) WHERE [invoice_no] IS NOT NULL;

-- Lookup/performance indexes that were added directly in SQL and were never
-- back-ported into schema.prisma's @@index attributes.
CREATE INDEX [collection_invoice_applications_invoice_no_idx] ON [dbo].[collection_invoice_applications] ([invoice_no]);
CREATE INDEX [payment_invoice_applications_invoice_no_idx]    ON [dbo].[payment_invoice_applications] ([invoice_no]);
CREATE INDEX [cheque_invoice_applications_invoice_no_idx]     ON [dbo].[cheque_invoice_applications] ([invoice_no]);

CREATE INDEX [delivery_challans_order_no_idx] ON [dbo].[delivery_challans] ([order_no]);
CREATE INDEX [sales_invoices_order_no_idx]    ON [dbo].[sales_invoices] ([order_no]);
CREATE INDEX [goods_received_notes_po_no_idx] ON [dbo].[goods_received_notes] ([po_no]);
CREATE INDEX [purchase_invoices_po_no_idx]    ON [dbo].[purchase_invoices] ([po_no]);

CREATE INDEX [customer_outstanding_customer_name_idx] ON [dbo].[customer_outstanding] ([customer_name]);
CREATE INDEX [supplier_outstanding_supplier_name_idx] ON [dbo].[supplier_outstanding] ([supplier_name]);

CREATE INDEX [sales_orders_customer_idx]        ON [dbo].[sales_orders] ([customer]);
CREATE INDEX [sales_invoices_customer_idx]      ON [dbo].[sales_invoices] ([customer]);
CREATE INDEX [sales_quotations_customer_idx]    ON [dbo].[sales_quotations] ([customer]);
CREATE INDEX [delivery_challans_customer_idx]   ON [dbo].[delivery_challans] ([customer]);
CREATE INDEX [purchase_orders_supplier_idx]     ON [dbo].[purchase_orders] ([supplier]);
CREATE INDEX [purchase_invoices_supplier_idx]   ON [dbo].[purchase_invoices] ([supplier]);
CREATE INDEX [purchase_quotations_supplier_idx] ON [dbo].[purchase_quotations] ([supplier]);
CREATE INDEX [goods_received_notes_supplier_idx] ON [dbo].[goods_received_notes] ([supplier]);
CREATE INDEX [sales_invoice_items_product_code_idx]    ON [dbo].[sales_invoice_items] ([product_code]);
CREATE INDEX [purchase_invoice_items_product_code_idx] ON [dbo].[purchase_invoice_items] ([product_code]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
