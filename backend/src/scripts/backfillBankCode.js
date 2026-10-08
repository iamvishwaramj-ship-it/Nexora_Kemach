/**
 * Assigns a Bank Code to every existing Bank Name row that doesn't have one.
 *
 *   node src/scripts/backfillBankCode.js            # dry run (default)
 *   node src/scripts/backfillBankCode.js --apply    # actually write
 *
 * Bank Code is new: migration 20260905090000_add_bank_code adds the column
 * nullable, because — unlike Branch/Tax Code/Sales Employee/... (see
 * DOCUMENT_CATALOG in services/documentNumberService.js), which already had
 * a hand-typed code column before switching to auto-generation — Bank Name
 * never had one, so there's nothing to preserve. Every row created from now
 * on gets its code from the BNK numbering series automatically (see the
 * autoNumber option on the /company/bank-names route); this script is the
 * one-time catch-up for rows that already existed when the column was added.
 *
 * Assigns in id order (oldest bank first) through the same
 * resolveDocumentNumber() engine the create route itself uses, one
 * transaction per row, so a save that fails partway through never burns a
 * permanent gap in the sequence.
 */
const prisma = require('../prisma/client');
const { resolveDocumentNumber } = require('../utils/documentNumber');

const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(APPLY ? 'APPLYING CHANGES' : 'DRY RUN — pass --apply to write changes');

  const banks = await prisma.bankName.findMany({
    where: { OR: [{ bankCode: null }, { bankCode: '' }] },
    orderBy: { id: 'asc' },
    select: { id: true, bankName: true },
  });

  console.log(`\n${banks.length} bank(s) with no Bank Code.\n`);

  for (const bank of banks) {
    if (!APPLY) {
      console.log(`  would assign a code to "${bank.bankName}" (id ${bank.id})`);
      continue;
    }
    const code = await prisma.$transaction(async (tx) => {
      const { documentNumber, syncManual } = await resolveDocumentNumber('BNK', null, tx);
      await tx.bankName.update({ where: { id: bank.id }, data: { bankCode: documentNumber } });
      if (syncManual) await syncManual();
      return documentNumber;
    });
    console.log(`  ${code} -> "${bank.bankName}" (id ${bank.id})`);
  }

  console.log('\nDone.');
  if (!APPLY) console.log('Nothing was written. Re-run with --apply once the output looks right.');
}

main()
  .catch((err) => {
    console.error('\nBackfill failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
