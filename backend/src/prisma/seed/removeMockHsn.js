// removeMockHsn.js — truncates ONLY HsnMaster (table "hsn_masters", Product
// Setup > HSN Master), clearing whatever HSN/SAC codes have been entered so
// far. Nothing else is touched.
//
//   npm run removemockhsn
//
// TRUNCATE TABLE rather than deleteMany()/DELETE: hsn_masters has no
// incoming foreign keys (Product.hsnCode is a plain string column, not a
// relation — see the model doc comment in schema.prisma), so nothing blocks
// it, and TRUNCATE also resets the IDENTITY seed on its own, unlike DELETE
// (compare removeAccountGroups.js, which has to reseed by hand afterwards).
//
// Safe to re-run: an already-empty table truncates to itself with no error.

require('dotenv').config();
const prisma = require('../client');

async function run() {
  const before = await prisma.hsnMaster.count();
  console.log(`Truncating HSN Master (${before} row(s) found)...`);

  await prisma.$executeRawUnsafe('TRUNCATE TABLE [dbo].[hsn_masters]');

  console.log(`Done. HSN Master cleared${before > 0 ? ` (${before} row(s) removed)` : ''}. Identity counter reset — the next HSN code created will be id 1.`);
}

run()
  .catch((err) => {
    console.error('Remove mock HSN error:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
