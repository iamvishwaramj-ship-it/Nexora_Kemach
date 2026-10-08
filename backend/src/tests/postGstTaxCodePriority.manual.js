// Manual, DB-free verification of postGst's new per-Tax-Code account
// priority (backend/src/utils/glPosting.js). Not wired into src/tests/run.js
// (that suite requires a live SQL Server this sandbox doesn't have) — run
// directly with `node src/tests/postGstTaxCodePriority.manual.js`.
//
// Mocks just enough of the ctx/posting shape postGst actually calls:
// ctx.taxCode(id), ctx.accountById(id), and a posting object recording
// debit/credit calls in order, with no merging (that's createPosting's job,
// tested implicitly by glPosting's own suite once a DB is available — this
// script only needs to see what postGst itself decided to post).

const assert = require('assert');
const { computeLineTaxBreakdown } = require('../utils/documentTotals');

// Re-implement just enough of glPosting's private postGst to test the
// decision logic in isolation, since postGst itself isn't exported. Mirrors
// backend/src/utils/glPosting.js's postGst function exactly — keep in sync
// if that function changes.
const TAX_CODE_SIDE_FIELD = { output: 'Sales', input: 'Purchase' };
const { normaliseLine, round2 } = require('../utils/documentTotals');

async function postGst(ctx, posting, doc, sideOfBooks, entrySide, description, opts = {}) {
  const { items, quantityField = 'quantity' } = opts;
  const sideField = TAX_CODE_SIDE_FIELD[sideOfBooks];
  let total = 0;
  let lineBreakdownCache = null;
  const lineBreakdown = () => {
    if (lineBreakdownCache) return lineBreakdownCache;
    const interState = Number(doc.igstAmount) > 0;
    const lines = items.map((item) => normaliseLine(item, { quantityField }));
    lineBreakdownCache = computeLineTaxBreakdown(lines, doc.discountPercent, { interState });
    return lineBreakdownCache;
  };
  for (const component of ['cgst', 'sgst', 'igst']) {
    const docAmount = round2(Number(doc[`${component}Amount`]) || 0);
    if (docAmount === 0) continue;
    const overrides = [];
    if (items && items.length) {
      const breakdown = lineBreakdown();
      for (let i = 0; i < items.length; i += 1) {
        const taxCodeId = items[i].taxCodeId;
        if (!taxCodeId) continue;
        const taxCode = await ctx.taxCode(taxCodeId);
        const overrideId = taxCode?.[`${component}${sideField}AccountId`];
        if (!overrideId) continue;
        const account = await ctx.accountById(overrideId);
        if (!account) continue;
        const amount = round2(breakdown[i][component]);
        if (amount === 0) continue;
        overrides.push({ account, amount });
      }
    }
    if (!overrides.length) {
      const account = await ctx.resolveGstAccount(sideOfBooks, component);
      posting[entrySide](account, docAmount, description);
      total = round2(total + docAmount);
      continue;
    }
    const byAccount = new Map();
    let overriddenSum = 0;
    for (const { account, amount } of overrides) {
      const key = account.accountCode;
      const existing = byAccount.get(key);
      byAccount.set(key, { account, amount: round2((existing?.amount || 0) + amount) });
      overriddenSum = round2(overriddenSum + amount);
    }
    for (const { account, amount } of byAccount.values()) {
      posting[entrySide](account, amount, description);
      total = round2(total + amount);
    }
    const remainder = round2(docAmount - overriddenSum);
    if (remainder !== 0) {
      const account = await ctx.resolveGstAccount(sideOfBooks, component);
      posting[entrySide](account, remainder, description);
      total = round2(total + remainder);
    }
  }
  return total;
}

function makeCtx({ taxCodes = {}, accounts = {}, defaultAccountByComponent }) {
  return {
    async taxCode(id) { return taxCodes[id] || null; },
    async accountById(id) { return accounts[id] || null; },
    async resolveGstAccount(_side, component) { return defaultAccountByComponent[component]; },
  };
}

function makePosting() {
  const calls = [];
  return {
    calls,
    debit(account, amount, description) { calls.push({ side: 'debit', account: account.accountCode, amount, description }); },
    credit(account, amount, description) { calls.push({ side: 'credit', account: account.accountCode, amount, description }); },
  };
}

async function main() {
  const DEFAULT_CGST = { accountCode: 'OUT-CGST', accountName: 'Output CGST Payable' };
  const DEFAULT_SGST = { accountCode: 'OUT-SGST', accountName: 'Output SGST Payable' };
  const OVERRIDE_CGST = { accountCode: 'GST18-CGST', accountName: 'GST 18% CGST Output' };
  const OVERRIDE_SGST = { accountCode: 'GST18-SGST', accountName: 'GST 18% SGST Output' };

  // --- Scenario 1: no line carries a taxCodeId -> must match original
  // single-line-per-component behavior exactly.
  {
    const ctx = makeCtx({ defaultAccountByComponent: { cgst: DEFAULT_CGST, sgst: DEFAULT_SGST, igst: DEFAULT_CGST } });
    const posting = makePosting();
    const doc = { invoiceNo: 'INV-1', discountPercent: 0, cgstAmount: 90, sgstAmount: 90, igstAmount: 0 };
    const items = [
      { productCode: 'P1', quantity: 1, unitPrice: 1000, discountPercent: 0, taxPercent: 18, amount: 1000 },
    ];
    await postGst(ctx, posting, doc, 'output', 'credit', 'Output GST — INV-1', { items });
    assert.strictEqual(posting.calls.length, 2, 'Scenario 1: expected exactly 2 journal lines (CGST + SGST)');
    assert.deepStrictEqual(
      posting.calls.map((c) => [c.account, c.amount]).sort(),
      [['OUT-CGST', 90], ['OUT-SGST', 90]].sort()
    );
    console.log('Scenario 1 (no Tax Code on any line) — PASS: identical to original single-line-per-component behavior');
  }

  // --- Scenario 2: one line has a Tax Code with its own CGST/SGST account,
  // another has none -> two distinct CGST journal lines (override + default
  // remainder) and two distinct SGST lines, each pair summing to the exact
  // header amount for that component.
  {
    const ctx = makeCtx({
      taxCodes: { 7: { id: 7, cgstSalesAccountId: 501, sgstSalesAccountId: 502 } },
      accounts: { 501: OVERRIDE_CGST, 502: OVERRIDE_SGST },
      defaultAccountByComponent: { cgst: DEFAULT_CGST, sgst: DEFAULT_SGST, igst: DEFAULT_CGST },
    });
    const posting = makePosting();
    // Line A (taxCodeId 7): 1000 @ 18% -> 180 tax -> 90 CGST / 90 SGST, all overridden.
    // Line B (no taxCodeId): 500 @ 18% -> 90 tax -> 45 CGST / 45 SGST, falls to default.
    const doc = { invoiceNo: 'INV-2', discountPercent: 0, cgstAmount: 135, sgstAmount: 135, igstAmount: 0 };
    const items = [
      { productCode: 'P1', quantity: 1, unitPrice: 1000, discountPercent: 0, taxPercent: 18, amount: 1000, taxCodeId: 7 },
      { productCode: 'P2', quantity: 1, unitPrice: 500, discountPercent: 0, taxPercent: 18, amount: 500 },
    ];
    await postGst(ctx, posting, doc, 'output', 'credit', 'Output GST — INV-2', { items });
    console.log('Scenario 2 journal lines:', posting.calls);
    const sumFor = (code) => round2(posting.calls.filter((c) => c.account === code).reduce((s, c) => s + c.amount, 0));
    assert.strictEqual(sumFor('GST18-CGST'), 90, 'Scenario 2: override CGST line should be 90 (the Tax-Coded line\'s own share)');
    assert.strictEqual(sumFor('OUT-CGST'), 45, 'Scenario 2: fallback CGST line should be 45 (the un-overridden line\'s share)');
    assert.strictEqual(sumFor('GST18-SGST'), 90, 'Scenario 2: override SGST line should be 90');
    assert.strictEqual(sumFor('OUT-SGST'), 45, 'Scenario 2: fallback SGST line should be 45');
    assert.strictEqual(round2(sumFor('GST18-CGST') + sumFor('OUT-CGST')), 135, 'Scenario 2: total CGST posted must equal doc.cgstAmount exactly');
    assert.strictEqual(round2(sumFor('GST18-SGST') + sumFor('OUT-SGST')), 135, 'Scenario 2: total SGST posted must equal doc.sgstAmount exactly');
    console.log('Scenario 2 (mixed lines) — PASS: distinct override + fallback lines per component, each summing to the header amount');
  }

  console.log('\nAll manual postGst scenarios passed.');
}

main().catch((err) => {
  console.error('MANUAL TEST FAILED:', err);
  process.exit(1);
});
