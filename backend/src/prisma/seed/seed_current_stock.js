// seed_current_stock.js — Opening Balance (per-item, per-warehouse starting
// stock), imported wholesale from the real source system's "Current Stock"
// sheet in backend/data/Master Data.xlsx (ItemCode, ItemName, Warehouse,
// Stock, StockValue — 2172 rows).
//
// Self-sufficient: ensures [warehouse] and [location_master] exist and are
// populated first (opening_balance.warehouse has a foreign key into
// [warehouse], so those rows have to exist before this can insert), then
// creates the [opening_balance] table itself if it doesn't already exist,
// then upserts every row from the sheet keyed by (item_code, warehouse), so
// re-running this is always safe and just refreshes the data.
//
// Run with:  npm run current_stock:seed

require('dotenv').config();
const prisma = require('../client');
const { loadSheet, cleanCell, cleanCode } = require('./masterDataXlsx');
const { run: seedWarehouseMaster } = require('./seed_warehouse_master');
const { run: seedLocationMaster } = require('./seed_location_master');

// Mirrors backend/src/prisma/migrations/20260813120000_init_sqlserver/migration.sql's
// [opening_balance] table exactly, so a table this script creates and a
// table a later `prisma migrate deploy` would have created are identical.
// The foreign key assumes [warehouse] already exists, which is guaranteed by
// seedWarehouseMaster() running first in run() below.
const CREATE_TABLE_SQL = `
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'opening_balance')
BEGIN
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
END
`;

async function ensureTable() {
  await prisma.$executeRawUnsafe(CREATE_TABLE_SQL);
}

function toRowData(sheetRow) {
  return {
    itemCode: cleanCode(sheetRow.ItemCode),
    itemName: cleanCell(sheetRow.ItemName),
    warehouse: cleanCode(sheetRow.Warehouse),
    stock: sheetRow.Stock == null ? 0 : Number(sheetRow.Stock),
    stockValue: sheetRow.StockValue == null ? 0 : Number(sheetRow.StockValue),
  };
}

async function run() {
  // Opening Balance's warehouse column is a real foreign key, not a loose
  // string — this is what guarantees a fresh `npm run current_stock:seed`
  // (with no prior warehouse_master:seed / location_master:seed run) still
  // works end to end rather than failing on the first insert.
  console.log('Ensuring warehouse master is seeded...');
  await seedWarehouseMaster();
  console.log('Ensuring location master is seeded...');
  await seedLocationMaster();

  await ensureTable();

  const sheetRows = loadSheet('Current Stock');
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < sheetRows.length; i += 1) {
    const sheetRow = sheetRows[i];
    const data = toRowData(sheetRow);
    if (!data.itemCode || !data.itemName || !data.warehouse) {
      skipped += 1;
      console.warn('Skipping Current Stock row missing ItemCode/ItemName/Warehouse:', sheetRow);
      continue;
    }

    try {
      const existing = await prisma.openingBalance.findUnique({
        where: { itemCode_warehouse: { itemCode: data.itemCode, warehouse: data.warehouse } },
      });
      await prisma.openingBalance.upsert({
        where: { itemCode_warehouse: { itemCode: data.itemCode, warehouse: data.warehouse } },
        update: data,
        create: { ...data, status: 'Active' },
      });
      if (existing) updated += 1; else created += 1;
    } catch (err) {
      // A row referencing a warehouse code that isn't in [warehouse] (data
      // drift between sheets) would violate the FK — log and keep going
      // rather than letting one bad row abort the other ~2000 good ones.
      failed += 1;
      console.error(`Failed to upsert ItemCode=${data.itemCode} Warehouse=${data.warehouse}:`, err.message);
    }

    if ((i + 1) % 250 === 0) {
      console.log(`  ...${i + 1}/${sheetRows.length} rows processed`);
    }
  }

  console.log(
    `Opening balance (Current Stock): ${created} created, ${updated} updated, ${skipped} skipped, ${failed} failed (of ${sheetRows.length} sheet rows).`
  );
}

if (require.main === module) {
  run()
    .catch((err) => {
      console.error('current_stock:seed failed:', err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { run };
