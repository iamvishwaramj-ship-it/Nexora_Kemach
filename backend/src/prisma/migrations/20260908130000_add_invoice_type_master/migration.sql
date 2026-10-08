BEGIN TRY

BEGIN TRAN;

-- CreateTable: InvoiceType
--
-- Purchase Order > "Other Details" > Invoice Type — see the model doc
-- comment in schema.prisma. A plain user-entered name, no auto-numbered
-- code (modeled on CurrencyMaster/HsnMaster). Seeded below with the fixed
-- starter list the business already uses on paper; "Define New" on the
-- Purchase Order form adds further rows here at runtime through the same
-- /invoice-types CRUD route.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'invoice_types' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE [dbo].[invoice_types] (
        [id]     INT IDENTITY(1,1) NOT NULL,
        [name]   NVARCHAR(150) NOT NULL,
        [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_invoice_types_status] DEFAULT N'Active',
        CONSTRAINT [invoice_types_pkey] PRIMARY KEY CLUSTERED ([id])
    );

    CREATE UNIQUE INDEX [invoice_types_name_key] ON [dbo].[invoice_types]([name]);

    INSERT INTO [dbo].[invoice_types] ([name], [status]) VALUES
        (N'FOR STOCK MACHINE', N'Active'),
        (N'Stock Order', N'Active'),
        (N'Stock transfer', N'Active'),
        (N'warranty dc', N'Active'),
        (N'Branch Transfer', N'Active'),
        (N'Service Charge', N'Active'),
        (N'DC', N'Active'),
        (N'Damage', N'Active'),
        (N'Parts Discrepancy', N'Active'),
        (N'Service Engg Issue', N'Active'),
        (N'PDI', N'Active'),
        (N'ATTACHMENT', N'Active'),
        (N'Warranty Order', N'Active'),
        (N'warranty', N'Active'),
        (N'service coupon', N'Active'),
        (N'Labour charges Receipts', N'Active'),
        (N'Non warranty', N'Active'),
        (N'Sales Quotation', N'Active'),
        (N'Inventory Transfer', N'Active'),
        (N'BHL Discount', N'Active'),
        (N'FOC-GOODWILL', N'Active'),
        (N'TA & DA', N'Active'),
        (N'Doosan', N'Active'),
        (N'Non-Warranty Order', N'Active'),
        (N'Return', N'Active'),
        (N'Coupon', N'Active'),
        (N'AMC', N'Active'),
        (N'Retail', N'Active'),
        (N'FOC', N'Active'),
        (N'Sales Commission', N'Active'),
        (N'Machine Sales', N'Active');
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
