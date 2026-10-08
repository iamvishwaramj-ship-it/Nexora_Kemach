/**
 * Backfill the simplified document-flow statuses onto rows that predate them.
 *
 * The migration that introduced Open/Closed only changed DEFAULTS, which apply
 * to new rows. Every enquiry already sitting at 'Follow-up', every quotation
 * at 'Accepted', every GRN at 'Partially Received' keeps that legacy string
 * until something recomputes it — and nothing does, because the recompute
 * functions only run when a follow-on document is saved. This script walks
 * every affected document once and lets those same functions settle it.
 *
 * Five document types are reconciled, each by exactly the rule the app now
 * enforces going forward (see utils/documentFlow.js):
 *
 *   Enquiry            -> Closed if any Sales Quotation quotes it
 *   Sales Quotation    -> Closed if any Sales Order was raised from it
 *   Purchase Quotation -> Closed if any Purchase Order was raised from it
 *   Delivery Challan   -> Closed once fully invoiced
 *   GRN                -> Closed once fully invoiced
 *
 * Sales Order and Purchase Order are deliberately NOT touched: they keep the
 * quantity-based Open / Partially Delivered / Partially Received / Closed
 * vocabulary, which is already correct and already maintained.
 *
 * Legacy staging values are mapped before recomputing, because the recompute
 * functions refuse to overwrite a protected status and would otherwise leave
 * them stranded:
 *
 *   GRN     'Received' / 'Partially Received' -> Open   ('Draft' kept as-is)
 *   Challan 'Dispatched' / 'Partially Delivered' / 'Delivered' -> Open
 *           ('Pending' kept as-is)
 *
 * 'Cancelled' is never touched anywhere — cancellation is a human decision.
 *
 * Idempotent: running it twice changes nothing the second time. Safe to run
 * on a live database, though it is a write, so take the usual backup first.
 *
 * Usage:  node src/scripts/backfillDocumentFlowStatus.js
 *         node src/scripts/backfillDocumentFlowStatus.js --dry-run
 */

const prisma = require('../prisma/client');
const {
  recomputeEnquiryStatus,
  recomputeSalesQuotationStatus,
  recomputePurchaseQuotationStatus,
  recomputeDeliveryChallanStatus,
  recomputeGrnStatus,
} = require('../utils/documentFlow');

const DRY_RUN = process.argv.includes('--dry-run');

// Legacy value -> the value that means the same thing under the new scheme.
// Anything not listed (including 'Draft', 'Pending', 'Cancelled', 'Open' and
// 'Closed' themselves) is left exactly as it is.
const GRN_LEGACY = { Received: 'Open', 'Partially Received': 'Open' };
const CHALLAN_LEGACY = {
  Dispatched: 'Open', 'Partially Delivered': 'Open', Delivered: 'Open',
};

async function normaliseLegacy(model, rows, mapping, label) {
  let changed = 0;
  for (const row of rows) {
    const next = mapping[row.status];
    if (!next || next === row.status) continue;
    if (!DRY_RUN) await model.update({ where: { id: row.id }, data: { status: next } });
    changed += 1;
  }
  if (changed) console.log(`  ${label}: mapped ${changed} legacy status value(s) to 'Open'`);
  return changed;
}

async function run() {
  console.log(DRY_RUN ? 'Dry run — nothing will be written.\n' : 'Backfilling document-flow statuses...\n');

  const [enquiries, salesQuotations, purchaseQuotations, challans, grns] = await Promise.all([
    prisma.enquiry.findMany({ select: { id: true, enquiryNo: true, status: true } }),
    prisma.salesQuotation.findMany({ select: { id: true, quotationNo: true, status: true } }),
    prisma.purchaseQuotation.findMany({ select: { id: true, quotationNo: true, status: true } }),
    prisma.deliveryChallan.findMany({ select: { id: true, challanNo: true, status: true } }),
    prisma.goodsReceivedNote.findMany({ select: { id: true, grnNo: true, status: true } }),
  ]);

  console.log(
    `Found ${enquiries.length} enquiries, ${salesQuotations.length} sales quotations, `
    + `${purchaseQuotations.length} purchase quotations, ${challans.length} delivery challans, `
    + `${grns.length} GRNs.\n`
  );

  // Step 1 — retire the legacy staging vocabulary, so step 2's recompute is
  // not blocked by a protected-status check on a value that no longer exists.
  console.log('Mapping legacy status values:');
  await normaliseLegacy(prisma.goodsReceivedNote, grns, GRN_LEGACY, 'GRN');
  await normaliseLegacy(prisma.deliveryChallan, challans, CHALLAN_LEGACY, 'Delivery Challan');

  if (DRY_RUN) {
    console.log('\nDry run complete — re-run without --dry-run to apply.');
    return;
  }

  // Step 2 — settle each document with the same function the routes use, so
  // the backfilled state and the live behaviour can never disagree.
  //
  // Each document is its own transaction rather than one transaction for the
  // whole run: a failure partway through then leaves earlier documents
  // correctly settled instead of rolling back thousands of rows, and the
  // script can simply be re-run.
  const settle = async (label, items, key, fn) => {
    let done = 0;
    for (const item of items) {
      const docNo = item[key];
      if (!docNo) continue;
      await prisma.$transaction(async (tx) => { await fn(tx, docNo); });
      done += 1;
    }
    console.log(`  ${label}: settled ${done}`);
  };

  console.log('\nRecomputing statuses:');
  await settle('Enquiry', enquiries, 'enquiryNo', recomputeEnquiryStatus);
  await settle('Sales Quotation', salesQuotations, 'quotationNo', recomputeSalesQuotationStatus);
  await settle('Purchase Quotation', purchaseQuotations, 'quotationNo', recomputePurchaseQuotationStatus);
  await settle('Delivery Challan', challans, 'challanNo', recomputeDeliveryChallanStatus);
  await settle('GRN', grns, 'grnNo', recomputeGrnStatus);

  console.log('\nDone.');
}

run()
  .catch((err) => {
    console.error('\nBackfill failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
