// Creates [dbo].[warehouses] and [dbo].[locations] if they don't exist, along
// with the WH and LOC numbering series those masters draw their codes from.
//
// These back the Warehouse Master and Location Master pages. They are distinct
// from [warehouse] / [location_master], which are the richer masters imported
// from Master Data.xlsx — see the model comments in schema.prisma.
//
// Like ensureStockTable.js, this exists so an installation whose database
// predates these tables can get them without replaying migrations: the
// baseline migration is recorded as already applied, so the CREATE TABLE
// statements added to it later never run. `npm run db:repair` reports these
// two as missing but won't create tables itself; this does.
//
// Neither table has foreign keys, so creation order doesn't matter and this is
// safe to run at any time. Every statement is guarded — running it twice does
// nothing the second time.
//
// Run with:  npm run warehouse_location:ensure

require('dotenv').config();
const prisma = require('../prisma/client');

// Mirrors backend/src/prisma/migrations/20260813120000_init_sqlserver/migration.sql
// exactly, so a table this script creates and one the migration would have
// created are identical.
const CREATE_WAREHOUSES_SQL = `
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'warehouses')
BEGIN
    CREATE TABLE [dbo].[warehouses] (
        [id] INT IDENTITY(1,1) NOT NULL,
        [warehouse_code] NVARCHAR(50) NOT NULL,
        [warehouse_name] NVARCHAR(150) NOT NULL,
        [warehouse_location] NVARCHAR(max) NOT NULL,
        [status] NVARCHAR(20) NOT NULL CONSTRAINT [DF_warehouses_status] DEFAULT N'Active',
        CONSTRAINT [warehouses_pkey] PRIMARY KEY CLUSTERED ([id])
    );

    CREATE UNIQUE INDEX [warehouses_warehouse_code_key] ON [dbo].[warehouses]([warehouse_code]);
END
`;

const CREATE_LOCATIONS_SQL = `
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'locations')
BEGIN
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
END
`;

/**
 * Both masters take their code from a perpetual numbering series (no financial
 * year, 6-digit auto-generated codes starting at 1) rather than free text, so
 * without these rows saving a warehouse or location fails to allocate a code.
 * The NOT EXISTS guard makes re-running harmless.
 */
function seedSeriesSql(documentCode, documentName) {
  return `
INSERT INTO [dbo].[document_numbering] (
  [document_code], [document_name], [series_name], [is_default],
  [financial_year_id], [fy_code],
  [prefix], [suffix], [separator], [include_fy_in_number], [number_length],
  [start_number], [current_number], [next_number], [end_number],
  [reset_every_fy], [auto_generate], [manual_entry], [status],
  [created_at], [updated_at]
)
SELECT
  '${documentCode}', '${documentName}', 'Series 1', 1,
  NULL, NULL,
  '${documentCode}', NULL, '-', 0, 6,
  1, NULL, 1, 999999,
  0, 1, 0, 'Active',
  GETDATE(), GETDATE()
WHERE NOT EXISTS (
  SELECT 1 FROM [dbo].[document_numbering] d
   WHERE d.[document_code] = '${documentCode}'
     AND d.[financial_year_id] IS NULL
);
`;
}

async function tableExists(name) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS [count] FROM sys.tables WHERE name = '${name}'`
  );
  return Number(rows?.[0]?.count || 0) > 0;
}

async function run() {
  const hadWarehouses = await tableExists('warehouses');
  const hadLocations = await tableExists('locations');

  await prisma.$executeRawUnsafe(CREATE_WAREHOUSES_SQL);
  console.log(hadWarehouses
    ? '[dbo].[warehouses] already exists — nothing to do.'
    : '[dbo].[warehouses] created.');

  await prisma.$executeRawUnsafe(CREATE_LOCATIONS_SQL);
  console.log(hadLocations
    ? '[dbo].[locations] already exists — nothing to do.'
    : '[dbo].[locations] created.');

  const wh = await prisma.$executeRawUnsafe(seedSeriesSql('WH', 'Warehouse'));
  console.log(wh > 0 ? 'WH numbering series seeded.' : 'WH numbering series already present.');

  const loc = await prisma.$executeRawUnsafe(seedSeriesSql('LOC', 'Location'));
  console.log(loc > 0 ? 'LOC numbering series seeded.' : 'LOC numbering series already present.');
}

if (require.main === module) {
  run()
    .catch((err) => {
      console.error('warehouse_location:ensure failed:', err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { run };
