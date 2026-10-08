/**
 * Backfill order fulfilment, stamped costs and cheque settlement.
 *
 *   node src/scripts/backfillDocumentFlow.js            # report only
 *   node src/scripts/backfillDocumentFlow.js --apply    # write changes
 *
 * The 20260808090000 migration adds the columns but deliberately defaults them
 * to zero, so applying it changes no behaviour and restates no figure. This
 * script is the second half: it walks the existing documents and derives what
 * those columns should have contained all along.
 *
 * Three passes:
 *
 *   1. **Order fulfilment.** Every sales and purchase order is recomputed from
 *      the delivery challans, goods receipts and invoices already raised
 *      against it, so orders that have long since shipped stop showing as
 *      Open and part-shipped ones show what is still outstanding.
 *
 *   2. **Cost of sales.** Sales invoice and delivery challan lines get the
 *      product's current cost price stamped on them. This is an approximation
 *      and the script says so: the true historic cost is not recoverable,
 *      because the figure this fixes is precisely the one that was never
 *      recorded. From this point forward the stamp is exact.
 *
 *   3. **Cheque settlement.** Cheques already issued had their invoice
 *      applications recorded but never applied to Supplier Outstanding. Each
 *      is applied now, skipping any that would over-settle an invoice —
 *      those are reported for a human to look at rather than forced through.
 *
 * Dry run by default. Nothing is written without --apply.
 */

const prisma = require('../prisma/client');
const { recomputeSalesOrder, recomputePurchaseOrder } = require('../utils/documentFlow');
const { createOpenItemLedger } = require('../utils/openItemLedger');
const { round2 } = require('../utils/documentTotals');

const APPLY = process.argv.includes('--apply');

const supplierLedger = createOpenItemLedger({
  delegateOf: (tx) => tx.supplierOutstanding,
  partyField: 'supplierName',
  documentWord: 'cheque',
});

const CHEQUE_SETTLING_STATUSES = ['Printed', 'Issued', 'Presented', 'Cleared'];

function log(...args) {
  console.log(...args);
}

function section(title) {
  log(`\n${title}\n${'-'.repeat(title.length)}`);
}

async function backfillOrderFlow() {
  section('1. Order fulfilment');

  const [salesOrders, purchaseOrders] = await Promise.all([
    prisma.salesOrder.findMany({ select: { orderNo: true, status: true } }),
    prisma.purchaseOrder.findMany({ select: { poNo: true, status: true } }),
  ]);

  let changed = 0;

  for (const order of salesOrders) {
    if (!order.orderNo) continue;
    const result = await prisma.$transaction(async (tx) => recomputeSalesOrder(tx, order.orderNo));
    if (result && result.status !== order.status) {
      changed += 1;
      log(`  SO ${order.orderNo}: ${order.status} -> ${result.status}`);
    }
  }

  for (const order of purchaseOrders) {
    if (!order.poNo) continue;
    const result = await prisma.$transaction(async (tx) => recomputePurchaseOrder(tx, order.poNo));
    if (result && result.status !== order.status) {
      changed += 1;
      log(`  PO ${order.poNo}: ${order.status} -> ${result.status}`);
    }
  }

  log(`  ${salesOrders.length} sales orders and ${purchaseOrders.length} purchase orders examined, ${changed} status changes.`);
  if (!APPLY) log('  (dry run — recompute wrote nothing because the transaction is rolled back below)');
  return changed;
}

async function backfillStampedCosts() {
  section('2. Cost of sales');

  const products = await prisma.product.findMany({ select: { productCode: true, costPrice: true } });
  const costByCode = new Map(products.map((p) => [p.productCode, Number(p.costPrice) || 0]));

  const [invoiceLines, challanLines] = await Promise.all([
    prisma.salesInvoiceItem.findMany({
      where: { costPrice: 0 },
      select: { id: true, productCode: true },
    }),
    prisma.deliveryChallanItem.findMany({
      where: { costPrice: 0 },
      select: { id: true, productCode: true },
    }),
  ]);

  const stampable = (lines) => lines.filter((l) => (costByCode.get(l.productCode) || 0) > 0);
  const invoiceTargets = stampable(invoiceLines);
  const challanTargets = stampable(challanLines);

  log(`  ${invoiceTargets.length} sales invoice lines and ${challanTargets.length} challan lines can be stamped.`);
  log('  NOTE: this uses the product master\'s CURRENT cost price. The true cost at');
  log('  the time of sale was never recorded — that is the defect being fixed — so');
  log('  historic margins remain an approximation. Lines written from now on are exact.');

  if (!APPLY) return invoiceTargets.length + challanTargets.length;

  for (const line of invoiceTargets) {
    await prisma.salesInvoiceItem.update({
      where: { id: line.id },
      data: { costPrice: costByCode.get(line.productCode) },
    });
  }
  for (const line of challanTargets) {
    await prisma.deliveryChallanItem.update({
      where: { id: line.id },
      data: { costPrice: costByCode.get(line.productCode) },
    });
  }
  return invoiceTargets.length + challanTargets.length;
}

async function backfillChequeSettlement() {
  section('3. Cheque settlement');

  const cheques = await prisma.cheque.findMany({
    where: { status: { in: CHEQUE_SETTLING_STATUSES } },
    include: { invoiceApplications: true },
  });

  let applied = 0;
  const skipped = [];

  for (const cheque of cheques) {
    const apps = cheque.invoiceApplications
      .filter((a) => a.invoiceNo && Number(a.amountToPay) > 0)
      .map((a) => ({ invoiceNo: a.invoiceNo, amountApplied: Number(a.amountToPay) }));
    if (!apps.length) continue;

    try {
      await prisma.$transaction(async (tx) => {
        await supplierLedger.assertApplicationsValid(tx, apps, {
          paymentAmount: cheque.amount,
          partyName: cheque.supplierName,
        });
        if (APPLY) {
          await supplierLedger.apply(tx, apps);
          await tx.cheque.update({
            where: { id: cheque.id },
            data: { totalAppliedAmount: round2(apps.reduce((s, a) => s + a.amountApplied, 0)) },
          });
        } else {
          // Validation only — roll back so the dry run writes nothing.
          throw Object.assign(new Error('__dry_run__'), { dryRun: true });
        }
      });
      applied += 1;
    } catch (err) {
      if (err.dryRun) { applied += 1; continue; }
      skipped.push(`  ${cheque.chequeNo}: ${err.message}`);
    }
  }

  log(`  ${cheques.length} issued cheques examined, ${applied} settleable, ${skipped.length} need attention.`);
  skipped.forEach((line) => log(line));
  return applied;
}

async function main() {
  log(APPLY ? 'APPLYING CHANGES' : 'DRY RUN — pass --apply to write changes');

  // The order-flow pass writes through recompute*, which has no dry-run mode.
  // In a dry run it is skipped entirely rather than half-run.
  if (APPLY) {
    await backfillOrderFlow();
  } else {
    section('1. Order fulfilment');
    const [so, po] = await Promise.all([prisma.salesOrder.count(), prisma.purchaseOrder.count()]);
    log(`  ${so} sales orders and ${po} purchase orders would be recomputed.`);
  }

  await backfillStampedCosts();
  await backfillChequeSettlement();

  section('Done');
  if (!APPLY) log('Nothing was written. Re-run with --apply once the output looks right.');
}

main()
  .catch((err) => {
    console.error('\nBackfill failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
