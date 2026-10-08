// seed_location_master.js — Location Master (rich), imported wholesale from
// the real source system's "Location" sheet in backend/data/Master
// Data.xlsx (Code, Location Name, PanNo, RegType, ECCNo).
//
// Self-sufficient: creates the [location_master] table if it doesn't already
// exist (in case this runs before `prisma migrate deploy` has been applied —
// see the CREATE_TABLE_SQL guard below) and then upserts every row from the
// sheet keyed by code, so re-running this is always safe.
//
// Run with:  npm run location_master:seed

require('dotenv').config();
const prisma = require('../client');
const { loadSheet, cleanCell } = require('./masterDataXlsx');

// Mirrors backend/src/prisma/migrations/20260813120000_init_sqlserver/migration.sql's
// [location_master] table exactly, so a table this script creates and a
// table a later `prisma migrate deploy` would have created are identical.
const CREATE_TABLE_SQL = `
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'location_master')
BEGIN
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
END
`;

async function ensureTable() {
  await prisma.$executeRawUnsafe(CREATE_TABLE_SQL);
}

function toRowData(sheetRow) {
  return {
    code: cleanCell(sheetRow.Code),
    locationName: cleanCell(sheetRow['Location Name']),
    panNo: cleanCell(sheetRow.PanNo),
    regType: cleanCell(sheetRow.RegType),
    eccNo: cleanCell(sheetRow.ECCNo),
  };
}

async function run() {
  await ensureTable();

  const sheetRows = loadSheet('Location');
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const sheetRow of sheetRows) {
    const data = toRowData(sheetRow);
    if (!data.code || !data.locationName) {
      skipped += 1;
      console.warn('Skipping Location row missing Code/Location Name:', sheetRow);
      continue;
    }

    const existing = await prisma.locationMaster.findUnique({ where: { code: data.code } });
    await prisma.locationMaster.upsert({
      where: { code: data.code },
      update: data,
      create: { ...data, status: 'Active' },
    });
    if (existing) updated += 1; else created += 1;
  }

  console.log(`Location master: ${created} created, ${updated} updated, ${skipped} skipped (of ${sheetRows.length} sheet rows).`);
}

// Runnable directly (npm run location_master:seed) and also required by
// seed_current_stock.js for completeness, alongside the warehouse seed.
if (require.main === module) {
  run()
    .catch((err) => {
      console.error('location_master:seed failed:', err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { run };
