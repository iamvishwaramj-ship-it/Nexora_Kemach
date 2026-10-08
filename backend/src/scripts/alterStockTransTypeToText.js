// Converts [dbo].[Stock].[TransType] from INT to NVARCHAR(50), in place.
//
// TransType originally held a numeric code (1 = Stock Receipt, 2 = Stock
// Issue, 3 = Stock Adjustment). It now holds the document type as text, so a
// row is readable on its own and new document types don't need a code
// allocated — see TRANS_TYPES in utils/stockTable.js.
//
// SQL Server won't retype a column while things depend on it, so the order
// matters: drop the index that includes TransType, drop its DEFAULT
// constraint, ALTER the column, translate the existing numeric values to
// their labels, then put the default and index back.
//
// Idempotent: if TransType is already NVARCHAR the script reports that and
// exits without touching anything.
//
// Run with:  npm run stock_transtype:alter

require('dotenv').config();
const prisma = require('../prisma/client');

// The numeric codes this column used before the change, mapped to the labels
// that replace them. Rows written by an older build carry these.
const CODE_TO_LABEL = {
  1: 'Stock Receipt',
  2: 'Stock Issue',
  3: 'Stock Adjustment',
};

async function currentType() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT ty.name AS typeName
      FROM sys.columns c
      JOIN sys.tables t  ON t.object_id = c.object_id
      JOIN sys.types  ty ON ty.user_type_id = c.user_type_id
     WHERE t.name = 'Stock' AND c.name = 'TransType'
  `);
  return rows?.[0]?.typeName || null;
}

async function run() {
  const type = await currentType();

  if (!type) {
    console.log('[dbo].[Stock] or its TransType column does not exist — run `npm run stock_table:ensure` first.');
    return;
  }
  if (type.toLowerCase() !== 'int') {
    console.log(`TransType is already ${type.toUpperCase()} — nothing to do.`);
    return;
  }

  console.log('TransType is INT — converting to NVARCHAR(50)...');

  // 1. The index covers TransType, so it blocks the ALTER.
  await prisma.$executeRawUnsafe(`
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Stock_TransType_TransNum' AND object_id = OBJECT_ID('dbo.Stock'))
        DROP INDEX [IX_Stock_TransType_TransNum] ON [dbo].[Stock];
  `);
  console.log('  dropped IX_Stock_TransType_TransNum');

  // 2. A DEFAULT constraint also pins the column's type. Its name is known,
  //    but look it up anyway in case the table was created by hand.
  await prisma.$executeRawUnsafe(`
    DECLARE @df SYSNAME;
    SELECT @df = dc.name
      FROM sys.default_constraints dc
      JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
     WHERE dc.parent_object_id = OBJECT_ID('dbo.Stock') AND c.name = 'TransType';
    IF @df IS NOT NULL
        EXEC('ALTER TABLE [dbo].[Stock] DROP CONSTRAINT [' + @df + ']');
  `);
  console.log('  dropped the TransType DEFAULT constraint');

  // 3. Retype. Existing integers become their own text ('1', '2', ...), which
  //    step 4 then translates into labels.
  await prisma.$executeRawUnsafe(
    "ALTER TABLE [dbo].[Stock] ALTER COLUMN [TransType] NVARCHAR(50) NOT NULL;"
  );
  console.log('  altered TransType to NVARCHAR(50)');

  // 4. Translate the old codes. Rows already carrying a label are untouched.
  let translated = 0;
  for (const [code, label] of Object.entries(CODE_TO_LABEL)) {
    const n = await prisma.$executeRawUnsafe(
      `UPDATE [dbo].[Stock] SET [TransType] = N'${label}' WHERE [TransType] = N'${code}';`
    );
    if (n > 0) console.log(`  translated ${n} row(s): '${code}' -> '${label}'`);
    translated += n;
  }
  if (translated === 0) console.log('  no legacy numeric rows to translate');

  // 5. Restore the default and the index.
  await prisma.$executeRawUnsafe(
    "ALTER TABLE [dbo].[Stock] ADD CONSTRAINT [DF_Stock_TransType] DEFAULT N'Unknown' FOR [TransType];"
  );
  console.log('  restored DF_Stock_TransType');

  await prisma.$executeRawUnsafe(
    'CREATE INDEX [IX_Stock_TransType_TransNum] ON [dbo].[Stock]([TransType], [TransNum]);'
  );
  console.log('  recreated IX_Stock_TransType_TransNum');

  console.log('Done — TransType is now NVARCHAR(50).');
}

if (require.main === module) {
  run()
    .catch((err) => {
      console.error('stock_transtype:alter failed:', err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { run };
