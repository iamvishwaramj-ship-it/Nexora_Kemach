// One-off, read-only diagnostic — makes no writes, just times the exact
// query GET /business-partners runs (with the same include) plus a plain
// count of every relevant table, so we can see where the 2 minutes is
// actually going. Safe to delete after running.
//
// Run from the backend folder with:
//   node diagnose-bp-perf.js
const prisma = require('./src/prisma/client');

async function main() {
  const counts = {};
  counts.businessPartners = await prisma.businessPartner.count();
  counts.contacts = await prisma.businessPartnerContact.count();
  counts.addresses = await prisma.businessPartnerAddress.count();
  counts.machineries = await prisma.businessPartnerMachinery.count();
  counts.warehouseMaster = await prisma.warehouseMaster.count();
  console.log('Row counts:', counts);

  console.log('\nTiming plain findMany (no include)...');
  let t0 = Date.now();
  await prisma.businessPartner.findMany();
  console.log('  plain findMany:', Date.now() - t0, 'ms');

  console.log('\nTiming findMany WITH the full include (contacts+addresses+machineries)...');
  t0 = Date.now();
  await prisma.businessPartner.findMany({
    include: {
      contacts: { orderBy: { rowOrder: 'asc' } },
      addresses: { orderBy: { rowOrder: 'asc' } },
      machineries: { orderBy: { rowOrder: 'asc' } },
    },
    orderBy: { id: 'desc' },
  });
  console.log('  findMany with include:', Date.now() - t0, 'ms');

  console.log('\nTiming warehouseMaster.findMany (no filters, capped at 500 like the real route)...');
  t0 = Date.now();
  await prisma.warehouseMaster.findMany({ take: 500 });
  console.log('  warehouseMaster findMany:', Date.now() - t0, 'ms');
}

main()
  .catch((e) => console.error('ERROR:', e))
  .finally(() => prisma.$disconnect());
