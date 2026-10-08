/**
 * One-off remedy for HSN/SAC codes saved with dotted customs-tariff-style
 * separators (e.g. "4012.90.90") instead of the app's actual digits-only
 * format ("40129090").
 *
 * Root cause: the /products CRUD route (routes/resources.js) had no
 * server-side format check on hsnCode at all — only the frontend's Zod
 * schema (hsnCode() in lib/validation/common.js) enforced the 4/6/8-digit
 * rule, and only for saves made through the Product Master form. Any write
 * that didn't go through that exact form (a direct API call, a bulk
 * import) could — and evidently did — save a code like "4012.90.90"
 * straight into the products table.
 *
 * That single bad master record then poisoned every document line that
 * picked the product afterwards: Purchase Order/GRN/Invoice, Sales
 * Order/Invoice/Quotation, Delivery Challan and the rest all auto-copy
 * Product Master's hsnCode onto the line the moment the product is picked
 * (see the ProductCell "found.hsnCode" effect in each of those pages), so
 * the same "HSN/SAC code must be 4, 6 or 8 digits" error reappeared on
 * every document raised for that product, not just once.
 *
 * Both the copy-in effects and the shared hsnCode()/hsnCodeRequired()
 * validators (frontend and backend) now strip '.', space and '-' before
 * validating, so this stops recurring for new documents raised from today.
 * The /products route also now runs the same format check HSN Master
 * already had, so a similarly malformed code can't be saved again. What's
 * left is the data already sitting in the two MASTER tables — Product and
 * HsnMaster — which this script normalizes in place.
 *
 * Deliberately NOT touched: hsnCode on already-saved transaction line items
 * (PurchaseOrderItem, SalesInvoiceItem, etc.). Those are historical
 * business records, not master data — normalizing master data going
 * forward is enough to stop the error recurring on new documents, and
 * rewriting posted transaction history is a separate, much higher-risk
 * decision this script does not make for you.
 *
 * SAFE BY DEFAULT: runs inside one Prisma transaction. In dry-run mode (the
 * default) the transaction is rolled back after every lookup/update has run
 * for real against your database — so the report below is exactly what
 * would happen, not a guess — but nothing is kept unless you pass --apply.
 *
 *   node src/scripts/backfillHsnCodeFormat.js            # dry run
 *   node src/scripts/backfillHsnCodeFormat.js --apply    # actually write
 */
const prisma = require('../prisma/client');

const APPLY = process.argv.includes('--apply');

// A sentinel thrown to deliberately roll back the dry-run transaction —
// distinguished from a real failure so main() knows not to report it as one.
class DryRunAbort extends Error {}

// Same rule as stripHsnSeparators() in lib/validation/common.js and
// normalizeHsn() in utils/formatValidators.js.
const HSN_RE = /^\d{4}(\d{2}(\d{2})?)?$/;
function normalize(v) {
  return String(v).trim().replace(/[.\s-]/g, '');
}

async function backfill(tx, log, { model, delegate, label, codeField, identityFields }) {
  const rows = await delegate.findMany({ where: { [codeField]: { not: null } } });
  let fixed = 0;
  let unresolved = 0;
  let alreadyClean = 0;

  for (const row of rows) {
    const raw = row[codeField];
    if (raw === null || raw === '') continue;
    const cleaned = normalize(raw);

    if (cleaned === raw) {
      alreadyClean++;
      continue;
    }

    const identity = identityFields.map((f) => row[f]).filter(Boolean).join(' / ') || `id ${row.id}`;

    if (!HSN_RE.test(cleaned)) {
      // Stripping separators still doesn't leave a valid 4/6/8-digit code —
      // this needs a human to look at it, not a blind rewrite.
      log(`  [SKIP — needs manual review] ${label} ${identity}: "${raw}" -> "${cleaned}" is not 4/6/8 digits`);
      unresolved++;
      continue;
    }

    log(`  ${label} ${identity}: "${raw}" -> "${cleaned}"`);
    await delegate.update({ where: { id: row.id }, data: { [codeField]: cleaned } });
    fixed++;
  }

  log(`${label}: ${rows.length} row(s) with a code set — ${fixed} fixed, ${alreadyClean} already clean, ${unresolved} need manual review.`);
  return { fixed, alreadyClean, unresolved };
}

async function main() {
  const report = [];
  const log = (line) => report.push(line);

  try {
    await prisma.$transaction(async (tx) => {
      log(`Mode: ${APPLY ? 'APPLY (writing for real)' : 'DRY RUN (nothing will be kept)'}`);
      log('');

      const productResult = await backfill(tx, log, {
        label: 'Product',
        delegate: tx.product,
        codeField: 'hsnCode',
        identityFields: ['productCode', 'productName'],
      });
      log('');
      const hsnMasterResult = await backfill(tx, log, {
        label: 'HSN Master',
        delegate: tx.hsnMaster,
        codeField: 'hsnCode',
        identityFields: ['hsnCode', 'description'],
      });

      log('');
      const totalFixed = productResult.fixed + hsnMasterResult.fixed;
      const totalUnresolved = productResult.unresolved + hsnMasterResult.unresolved;
      log(`Total: ${totalFixed} code(s) normalized, ${totalUnresolved} left untouched for manual review.`);

      if (!APPLY) {
        throw new DryRunAbort();
      }
    });
  } catch (err) {
    if (!(err instanceof DryRunAbort)) throw err;
  }

  console.log(report.join('\n'));
  console.log('');
  console.log(APPLY
    ? 'Applied.'
    : 'Dry run only — nothing was written. Re-run with --apply to make these changes for real.');
}

main()
  .catch((err) => {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
