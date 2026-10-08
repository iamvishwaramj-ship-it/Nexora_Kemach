/**
 * Backfill per-line Warehouse on existing Sales documents.
 *
 *   node src/scripts/backfillSalesLineWarehouse.js            # report only
 *   node src/scripts/backfillSalesLineWarehouse.js --apply    # write changes
 *
 * Root cause (fixed in frontend/src/lib/validation/salesSchemas.js): every
 * sales document's per-line item schema — Quotation, Order, Delivery
 * Challan, Invoice, Credit Memo, Return — was missing the `warehouse` field
 * declaration. Zod strips whatever a schema does not declare, so the
 * warehouse picked on every line was silently dropped from the save request
 * before it ever reached the server. The schema fix stops it happening to
 * NEW saves; this script is the second half, same shape as
 * backfillDocumentFlow.js — it repairs existing rows.
 *
 * The six document types split into two very different cases:
 *
 *   1. **Recoverable exactly.** Delivery Challan, direct Sales Invoice (no
 *      deliveryChallanNo), Sales Credit Memo and Sales Return each have their
 *      own HEADER-level warehouse field (fromWarehouse / warehouse), and that
 *      header field was declared correctly all along — only the per-line
 *      override was ever lost. The line-first-then-header convention these
 *      documents already use (see DeliveryChallanItem.warehouse's schema
 *      comment) means the backend's own write path
 *      (toChallanItemData/toSalesInvoiceItemData/toSalesCreditMemoItem/
 *      toSalesReturnItem) ALREADY fell back to the header's value whenever
 *      the line arrived blank — which, because of this bug, was every
 *      single line. So existing rows almost certainly already hold the
 *      header's own stated value, not null; this pass only mops up any
 *      genuine gaps (a header saved blank at some point, a row written by a
 *      seed/import script) by copying the header's value down, which is
 *      exactly what the app's own convention says should happen — nothing
 *      is invented.
 *
 *   2. **Not recoverable.** Sales Quotation and Sales Order have no header
 *      warehouse at all to fall back to — the per-line pick was the ONLY
 *      place that value ever lived, and it never reached the database. No
 *      fact anywhere in this schema says what warehouse a given line was
 *      meant to use. This is the same class of loss as BUG-34's historic
 *      cost of sales: the number was never written down, so nothing
 *      recomputes it. This script does NOT guess (e.g. from the branch's
 *      Company Setup > Branch > Default Warehouse) — a line's Warehouse
 *      decides available-stock checks and downstream document defaults, and
 *      inventing a value that happens to be wrong is worse than an honest
 *      blank the required-field validation will now catch. It only reports
 *      exactly which documents/lines still need a human to pick one — the
 *      fixed form makes that a one-time per-line edit.
 *
 * Dry run by default. Nothing is written without --apply.
 */

const prisma = require('../prisma/client');

const APPLY = process.argv.includes('--apply');

function log(...args) {
  console.log(...args);
}

function section(title) {
  log(`\n${title}\n${'-'.repeat(title.length)}`);
}

const isBlank = (v) => v == null || String(v).trim() === '';

/**
 * Generic pass for a document type whose lines carry a warehouse that is
 * meant to fall back to a header-level field. Copies the header's value onto
 * any line left blank — nothing invented, just applying the convention the
 * write path already uses.
 */
async function backfillFromHeader({
  label, itemDelegate, headerField, itemField = 'warehouse',
  headerRelationField, headerSelect,
}) {
  const items = await itemDelegate.findMany({
    where: { OR: [{ [itemField]: null }, { [itemField]: '' }] },
    select: {
      id: true,
      [headerRelationField]: { select: headerSelect },
    },
  });

  const fixable = items.filter((i) => !isBlank(i[headerRelationField]?.[headerField]));
  const unfixable = items.filter((i) => isBlank(i[headerRelationField]?.[headerField]));

  log(`  ${items.length} ${label} line(s) with a blank warehouse.`);
  log(`    ${fixable.length} can be repaired from their document's own header warehouse.`);
  if (unfixable.length) {
    log(`    ${unfixable.length} have a blank header warehouse too — nothing to copy down, these need a manual pick.`);
  }

  if (APPLY) {
    for (const item of fixable) {
      await itemDelegate.update({
        where: { id: item.id },
        data: { [itemField]: item[headerRelationField][headerField] },
      });
    }
  }

  return { total: items.length, fixed: fixable.length, unresolved: unfixable.length };
}

async function backfillDeliveryChallanItems() {
  return backfillFromHeader({
    label: 'Delivery Challan',
    itemDelegate: prisma.deliveryChallanItem,
    headerRelationField: 'challan',
    headerField: 'fromWarehouse',
    headerSelect: { fromWarehouse: true },
  });
}

async function backfillSalesInvoiceItems() {
  // Only direct invoices (no deliveryChallanNo) are meant to carry a
  // warehouse at all — a challan-backed invoice's blank item warehouse is
  // correct as-is (see SalesInvoice.warehouse's schema comment), so those
  // lines are excluded rather than counted as a gap.
  const items = await prisma.salesInvoiceItem.findMany({
    where: {
      OR: [{ warehouse: null }, { warehouse: '' }],
      invoice: { OR: [{ deliveryChallanNo: null }, { deliveryChallanNo: '' }] },
    },
    select: { id: true, invoice: { select: { warehouse: true } } },
  });

  const fixable = items.filter((i) => !isBlank(i.invoice?.warehouse));
  const unfixable = items.filter((i) => isBlank(i.invoice?.warehouse));

  log(`  ${items.length} direct Sales Invoice line(s) with a blank warehouse (challan-backed invoices are correctly left alone).`);
  log(`    ${fixable.length} can be repaired from their invoice's own header warehouse.`);
  if (unfixable.length) {
    log(`    ${unfixable.length} have a blank header warehouse too — nothing to copy down, these need a manual pick.`);
  }

  if (APPLY) {
    for (const item of fixable) {
      await prisma.salesInvoiceItem.update({
        where: { id: item.id },
        data: { warehouse: item.invoice.warehouse },
      });
    }
  }

  return { total: items.length, fixed: fixable.length, unresolved: unfixable.length };
}

async function backfillSalesCreditMemoItems() {
  return backfillFromHeader({
    label: 'Sales Credit Memo',
    itemDelegate: prisma.salesCreditMemoItem,
    headerRelationField: 'creditMemo',
    headerField: 'warehouse',
    headerSelect: { warehouse: true },
  });
}

async function backfillSalesReturnItems() {
  return backfillFromHeader({
    label: 'Sales Return',
    itemDelegate: prisma.salesReturnItem,
    headerRelationField: 'salesReturn',
    headerField: 'warehouse',
    headerSelect: { warehouse: true },
  });
}

/**
 * Sales Quotation and Sales Order have no header warehouse to fall back to —
 * the per-line value was the only copy and it never reached the database.
 * Report only: lists exactly which documents/lines need a human to pick a
 * Warehouse now that the form actually saves the choice.
 */
async function reportUnrecoverable(label, itemDelegate, docNoField, docRelationField) {
  const items = await itemDelegate.findMany({
    where: { OR: [{ warehouse: null }, { warehouse: '' }] },
    select: {
      productCode: true,
      [docRelationField]: { select: { [docNoField]: true } },
    },
  });

  log(`  ${items.length} ${label} line(s) have no warehouse recorded anywhere — never captured, not recoverable.`);
  if (items.length) {
    const byDoc = new Map();
    for (const item of items) {
      const docNo = item[docRelationField]?.[docNoField] || '(unlinked)';
      byDoc.set(docNo, (byDoc.get(docNo) || 0) + 1);
    }
    const sample = [...byDoc.entries()].slice(0, 25);
    for (const [docNo, count] of sample) {
      log(`    ${docNo}: ${count} line(s)`);
    }
    if (byDoc.size > sample.length) log(`    ... and ${byDoc.size - sample.length} more document(s)`);
    log(`  These will show as required-field errors next time each document is opened for edit — pick a Warehouse and save once to close the gap.`);
  }

  return { total: items.length };
}

async function main() {
  log(APPLY ? 'APPLYING CHANGES' : 'DRY RUN — pass --apply to write changes');

  section('1. Delivery Challan — recoverable from header');
  await backfillDeliveryChallanItems();

  section('2. Sales Invoice (direct only) — recoverable from header');
  await backfillSalesInvoiceItems();

  section('3. Sales Credit Memo — recoverable from header');
  await backfillSalesCreditMemoItems();

  section('4. Sales Return — recoverable from header');
  await backfillSalesReturnItems();

  section('5. Sales Quotation — NOT recoverable (no header warehouse ever existed)');
  await reportUnrecoverable('Sales Quotation', prisma.salesQuotationItem, 'quotationNo', 'quotation');

  section('6. Sales Order — NOT recoverable (no header warehouse ever existed)');
  await reportUnrecoverable('Sales Order', prisma.salesOrderItem, 'orderNo', 'order');

  section('Done');
  if (!APPLY) log('Nothing was written. Re-run with --apply once the output looks right.');
}

main()
  .catch((err) => {
    console.error('\nBackfill failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
