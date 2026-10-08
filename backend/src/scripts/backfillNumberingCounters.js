/**
 * Backfill numbering-series counters from documents that already exist.
 *
 *   node src/scripts/backfillNumberingCounters.js            # dry run (default)
 *   node src/scripts/backfillNumberingCounters.js --apply    # actually write
 *
 * Why this exists: the numbering engine (services/documentNumberService.js)
 * only just got wired into the 16 transaction-create routes. Every document
 * saved before that change has a number that was typed by hand, not issued
 * by a series — so a series' own counter (nextNumber) has no idea those
 * numbers exist. Left alone, the very first auto-generated number could
 * collide with (or fall inside the range of) a number someone already typed
 * by hand months ago.
 *
 * What this script does, per document type, per financial year that has a
 * DEFAULT series configured:
 *   1. Read every existing row for that document type's model.
 *   2. Pull the numeric run out of each stored number string (handles the
 *      series' own current prefix/separator/suffix, and falls back to "the
 *      last run of digits in the string" for older rows that don't match the
 *      current pattern at all — free-typed numbers were never guaranteed to
 *      follow any pattern).
 *   3. Advance the series' nextNumber past the highest number found, so the
 *      next auto-generated number can't repeat or undercut history.
 *
 * What this script deliberately does NOT do:
 *   - It never rewrites/renames a number on an existing document. Once a
 *     document number has been issued and potentially printed or filed
 *     statutorily, changing it after the fact is how you get an
 *     unreconcilable register — the same principle documentNumberService.js
 *     itself is built around.
 *   - It never touches `currentNumber` (that's the "this series has issued
 *     at least one number through the engine" flag, and none has yet — only
 *     `nextNumber`/`startNumber` counters move here).
 *   - It never modifies a LOCKED_ONCE_CONSUMED field (prefix, pattern, etc).
 *   - It skips a series entirely (and reports it) rather than silently
 *     truncating, if the highest existing number would push nextNumber past
 *     endNumber — that needs a human to extend the range first.
 *
 * Idempotent: safe to run repeatedly. Re-running after the range has already
 * been advanced (or after real documents have since been issued through the
 * engine) only ever moves nextNumber forward, never back, and does nothing
 * once every series is already ahead of its historical numbers.
 */

const prisma = require('../prisma/client');
const { DOCUMENT_CATALOG } = require('../services/documentNumberService');

const APPLY = process.argv.includes('--apply');

// documentCode -> { delegate, field } — the Prisma model that stores each
// document type's header row and the column holding its number string.
const SOURCES = {
  ENQ: { delegate: () => prisma.enquiry, field: 'enquiryNo' },
  PQ:  { delegate: () => prisma.purchaseQuotation, field: 'quotationNo' },
  PO:  { delegate: () => prisma.purchaseOrder, field: 'poNo' },
  GRN: { delegate: () => prisma.goodsReceivedNote, field: 'grnNo' },
  PI:  { delegate: () => prisma.purchaseInvoice, field: 'invoiceNo' },
  SQ:  { delegate: () => prisma.salesQuotation, field: 'quotationNo' },
  SO:  { delegate: () => prisma.salesOrder, field: 'orderNo' },
  DC:  { delegate: () => prisma.deliveryChallan, field: 'challanNo' },
  SI:  { delegate: () => prisma.salesInvoice, field: 'invoiceNo' },
  SRC: { delegate: () => prisma.stockReceipt, field: 'receiptNo' },
  SIG: { delegate: () => prisma.stockIssue, field: 'issueNo' },
  ADJ: { delegate: () => prisma.stockAdjustment, field: 'adjustmentNo' },
  RV:  { delegate: () => prisma.collection, field: 'collectionNo' },
  PV:  { delegate: () => prisma.supplierPayment, field: 'paymentNo' },
  DEP: { delegate: () => prisma.bankDeposit, field: 'depositNo' },
  CHQ: { delegate: () => prisma.cheque, field: 'chequeNo' },
};

/**
 * Best-effort numeric value of a stored document number string.
 *
 * Tries the series' own current pattern first (prefix/separator/fyCode/
 * suffix stripped, remainder parsed as the counter) since that is exact for
 * every number the series itself has ever issued. Falls back to "the last
 * run of digits anywhere in the string" for rows that predate the series
 * (typed by hand, in whatever format the user felt like that day) — not
 * exact, but the closest a free-text field allows, and safely conservative:
 * undercounting here only means a smaller-than-ideal jump forward, never a
 * collision, because every branch below only ever proposes a value >=
 * whatever nextNumber already is.
 */
function extractNumericValue(raw, series) {
  const value = String(raw ?? '').trim();
  if (!value) return null;

  const sep = series.separator || '';
  const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = [];
  if (series.prefix) parts.push(esc(series.prefix));
  if (series.includeFyInNumber && series.fyCode) parts.push(esc(series.fyCode));
  parts.push('(\\d+)');
  if (series.suffix) parts.push(esc(series.suffix));
  const pattern = new RegExp(`^${parts.join(esc(sep))}$`);
  const exact = value.match(pattern);
  if (exact) return Number(exact[1]);

  const trailing = value.match(/(\d+)(?!.*\d)/);
  return trailing ? Number(trailing[1]) : null;
}

async function main() {
  console.log(APPLY ? 'Running in APPLY mode — counters will be updated.' : 'Running in DRY-RUN mode — no writes. Pass --apply to write.');
  console.log('');

  const report = [];

  for (const doc of DOCUMENT_CATALOG) {
    const source = SOURCES[doc.code];
    if (!source) {
      report.push({ code: doc.code, name: doc.name, status: 'skipped', reason: 'no model mapping in this script' });
      continue;
    }

    // One default series per (documentCode, financialYear) — backfill each.
    const defaultSeries = await prisma.documentNumbering.findMany({
      where: { documentCode: doc.code, isDefault: true },
    });

    if (!defaultSeries.length) {
      report.push({ code: doc.code, name: doc.name, status: 'skipped', reason: 'no default series configured for any financial year' });
      continue;
    }

    const rows = await source.delegate().findMany({ select: { [source.field]: true } });

    for (const series of defaultSeries) {
      const values = rows
        .map((r) => extractNumericValue(r[source.field], series))
        .filter((v) => v !== null && Number.isFinite(v));

      if (!values.length) {
        report.push({ code: doc.code, name: doc.name, fy: series.financialYearId, status: 'no-op', reason: 'no existing documents to account for' });
        continue;
      }

      const highest = Math.max(...values);
      const proposedNext = highest + 1;

      if (proposedNext <= series.nextNumber) {
        report.push({
          code: doc.code, name: doc.name, fy: series.financialYearId, status: 'no-op',
          reason: `series is already ahead (nextNumber=${series.nextNumber}, highest existing=${highest})`,
        });
        continue;
      }

      if (proposedNext > series.endNumber + 1) {
        report.push({
          code: doc.code, name: doc.name, fy: series.financialYearId, status: 'NEEDS ATTENTION',
          reason: `highest existing number (${highest}) is beyond this series' End No. (${series.endNumber}) — extend the range under Company Setup → Document Numbering before this series can be used safely`,
        });
        continue;
      }

      if (series.currentNumber !== null && series.currentNumber !== undefined) {
        // The engine has already issued something through this series since
        // this script was last run — trust the live counter over historical
        // free-text data instead of overriding it.
        report.push({
          code: doc.code, name: doc.name, fy: series.financialYearId, status: 'no-op',
          reason: `series has already issued numbers through the engine (currentNumber=${series.currentNumber}) — leaving it alone`,
        });
        continue;
      }

      report.push({
        code: doc.code, name: doc.name, fy: series.financialYearId, status: APPLY ? 'ADVANCED' : 'WOULD ADVANCE',
        reason: `nextNumber ${series.nextNumber} -> ${proposedNext} (highest existing number found: ${highest})`,
      });

      if (APPLY) {
        await prisma.documentNumbering.update({
          where: { id: series.id },
          data: { nextNumber: proposedNext },
        });
      }
    }
  }

  console.log('Document  FY   Status           Detail');
  console.log('--------  ---  ---------------  ------');
  for (const r of report) {
    console.log(`${r.code.padEnd(8)}  ${String(r.fy ?? '-').padEnd(3)}  ${r.status.padEnd(15)}  ${r.reason}`);
  }

  const attention = report.filter((r) => r.status === 'NEEDS ATTENTION');
  if (attention.length) {
    console.log(`\n${attention.length} series need a manual range extension before they can be safely used — see "NEEDS ATTENTION" rows above.`);
  }
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
