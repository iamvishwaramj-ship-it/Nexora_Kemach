// Creates [dbo].[Stock] — the inventory transaction journal — if it doesn't
// already exist, without needing a full `prisma migrate deploy`.
//
// The same guarded DDL lives in the baseline migration (plus the later
// column-widening/renaming migrations applied on top of it); this script
// exists so an already-running installation can get the table (and start
// journalling stock movements) without replaying migrations, matching how
// the master-data seed scripts create their own tables.
//
// Run with:  npm run stock_table:ensure

require('dotenv').config();
const prisma = require('../prisma/client');

// Mirrors the CURRENT shape of [dbo].[Stock] -- the baseline migration plus
// every column-widening/renaming/dropping migration applied on top of it
// since (20260819080000_rename_stock_fifo_mav_columns,
// 20260905080000_widen_stock_warehouse, 20260918130000_stock_posting_generation,
// 20260918140000_rename_stock_columns_to_base_layout,
// 20260918150000_drop_stock_fifocost_transvalue) -- so a table this script
// creates from scratch and one built up through every migration are
// identical. If this table already exists, this script only ever no-ops
// (see the IF NOT EXISTS guard below) -- it never alters an existing table,
// so it cannot itself apply any of those changes.
const CREATE_TABLE_SQL = `
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Stock')
BEGIN
    CREATE TABLE [dbo].[Stock] (
        [LogEntry] BIGINT IDENTITY(1,1) NOT NULL,
        [ItemCode] NVARCHAR(50) NOT NULL,
        [ItemId] INT NOT NULL,
        [ItemName] NVARCHAR(200) NULL,
        [Warehouse] NVARCHAR(150) NULL,
        [Branch] VARCHAR(100) NULL,
        [InQty] DECIMAL(19,6) NOT NULL CONSTRAINT [DF_Stock_InQty] DEFAULT 0,
        [OutQty] DECIMAL(19,6) NOT NULL CONSTRAINT [DF_Stock_OutQty] DEFAULT 0,
        [StockPrice] DECIMAL(19,6) NULL,
        [Currency] NVARCHAR(3) NULL,
        [BaseEntry] INT NOT NULL,
        [BaseNum] NVARCHAR(50) NULL,
        [BaseType] NVARCHAR(50) NOT NULL CONSTRAINT [DF_Stock_TransType] DEFAULT N'Unknown',
        [ItemCost] DECIMAL(19,6) NULL,
        [BaseLine] INT NULL,
        [CreatedBy] INT NULL,
        [CreateDate] DATE NULL,
        [CreateTime] TIME NULL,
        [PostGeneration] INT NOT NULL CONSTRAINT [DF_Stock_PostGeneration] DEFAULT 1,
        CONSTRAINT [PK_OINM] PRIMARY KEY CLUSTERED ([LogEntry])
    );

    CREATE INDEX [IX_Stock_BaseType_BaseEntry] ON [dbo].[Stock]([BaseType], [BaseEntry]);
    CREATE INDEX [IX_Stock_ItemCode_Warehouse] ON [dbo].[Stock]([ItemCode], [Warehouse]);
END
`;

async function run() {
  const existedBefore = await prisma.$queryRawUnsafe(
    "SELECT COUNT(*) AS [count] FROM sys.tables WHERE name = 'Stock'"
  );
  const already = Number(existedBefore?.[0]?.count || 0) > 0;

  await prisma.$executeRawUnsafe(CREATE_TABLE_SQL);

  console.log(already
    ? '[dbo].[Stock] already exists — nothing to do.'
    : '[dbo].[Stock] created (with IX_Stock_BaseType_BaseEntry and IX_Stock_ItemCode_Warehouse).');
}

if (require.main === module) {
  run()
    .catch((err) => {
      console.error('stock_table:ensure failed:', err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { run };
