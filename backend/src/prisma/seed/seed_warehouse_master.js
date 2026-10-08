// seed_warehouse_master.js — Warehouse Master (rich), imported wholesale
// from the real source system's "Warehouse" sheet in backend/data/Master
// Data.xlsx (WhsCode, WhsName, Street, Block, ZipCode, City, County,
// Country, State, Location, DropShip).
//
// Self-sufficient: creates the [warehouse] table if it doesn't already exist
// (in case this runs before `prisma migrate deploy` has been applied — see
// the CREATE_TABLE_SQL guard below) and then upserts every row from the
// sheet keyed by whs_code, so re-running this is always safe and just
// refreshes the data rather than duplicating it.
//
// Run with:  npm run warehouse_master:seed

require('dotenv').config();
const prisma = require('../client');
const { loadSheet, cleanCell, cleanCode } = require('./masterDataXlsx');

// Mirrors backend/src/prisma/migrations/20260813120000_init_sqlserver/migration.sql's
// [warehouse] table exactly, so a table this script creates and a table a
// later `prisma migrate deploy` would have created are identical.
const CREATE_TABLE_SQL = `
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'warehouse')
BEGIN
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
END
`;

async function ensureTable() {
  await prisma.$executeRawUnsafe(CREATE_TABLE_SQL);
}

function toRowData(sheetRow) {
  return {
    whsCode: cleanCode(sheetRow.WhsCode),
    whsName: cleanCell(sheetRow.WhsName),
    street: cleanCell(sheetRow.Street),
    block: cleanCell(sheetRow.Block),
    zipCode: cleanCode(sheetRow.ZipCode),
    city: cleanCell(sheetRow.City),
    county: cleanCell(sheetRow.County),
    country: cleanCell(sheetRow.Country),
    state: cleanCell(sheetRow.State),
    locationCode: cleanCode(sheetRow.Location),
    dropShip: cleanCell(sheetRow.DropShip),
  };
}

async function run() {
  await ensureTable();

  const sheetRows = loadSheet('Warehouse');
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const sheetRow of sheetRows) {
    const data = toRowData(sheetRow);
    if (!data.whsCode || !data.whsName) {
      skipped += 1;
      console.warn('Skipping Warehouse row missing WhsCode/WhsName:', sheetRow);
      continue;
    }

    const existing = await prisma.warehouseMaster.findUnique({ where: { whsCode: data.whsCode } });
    await prisma.warehouseMaster.upsert({
      where: { whsCode: data.whsCode },
      update: data,
      create: { ...data, status: 'Active' },
    });
    if (existing) updated += 1; else created += 1;
  }

  console.log(`Warehouse master: ${created} created, ${updated} updated, ${skipped} skipped (of ${sheetRows.length} sheet rows).`);
}

// Runnable directly (npm run warehouse_master:seed) and also required by
// seed_current_stock.js, which needs [warehouse] populated first — Opening
// Balance's warehouse column has a foreign key into it.
if (require.main === module) {
  run()
    .catch((err) => {
      console.error('warehouse_master:seed failed:', err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { run };
