/**
 * Payment Modes -> G/L posting: Payment Receipt and Payment Voucher must
 * debit/credit the specific Cash/Bank account chosen in the Payment Modes
 * dialog (doc.paymentGlAccount) instead of the fixed cashOnHand
 * determination account, and fold in a Bank Charges line when one was
 * recorded — see resolvePaymentModeCashAccount / resolveBankCharges in
 * utils/glPosting.js.
 *
 * DB-free: exercises the real, exported POSTING_SCHEMAS[PAYMENT_RECEIPT]/
 * [PAYMENT_VOUCHER] handlers against a hand-rolled ctx/posting mock, the
 * same style as postGstTaxCodePriority.manual.js uses for postGst — no live
 * SQL Server needed, so (unlike most of this suite) it runs under plain
 * `node --test` / `node src/tests/run.js` with no DATABASE_URL_TEST.
 *
 * Run with:  node --test "src/tests/*.test.js"
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { POSTING_SCHEMAS, JOURNAL_SOURCE_TYPES, AccountDeterminationError } = require('../utils/glPosting');

function account(code, name, overrides = {}) {
  return { id: overrides.id ?? code, accountCode: code, accountName: name, accountNature: 'A', status: 'A', ...overrides };
}

/** Minimal ctx: just accountByCode/accountById/determination/customer/supplier. */
function makeCtx({ accounts = [], determination = null } = {}) {
  const byCode = new Map(accounts.map((a) => [a.accountCode, a]));
  const byId = new Map(accounts.map((a) => [a.id, a]));
  return {
    async accountByCode(code) { return byCode.get(code) || null; },
    async accountById(id) { return byId.get(id) || null; },
    async determination() { return determination; },
    async customer() { return null; },
    async supplier() { return null; },
  };
}

function makePosting() {
  const calls = [];
  return {
    calls,
    debit(acc, amount, description) {
      if (!amount) return;
      calls.push({ side: 'debit', code: acc.accountCode, amount, description });
    },
    credit(acc, amount, description) {
      if (!amount) return;
      calls.push({ side: 'credit', code: acc.accountCode, amount, description });
    },
  };
}

function totalsBySide(calls) {
  const sum = (side) => calls.filter((c) => c.side === side).reduce((s, c) => s + c.amount, 0);
  return { debit: Math.round(sum('debit') * 100) / 100, credit: Math.round(sum('credit') * 100) / 100 };
}

const PETTY_CASH = account('PC-001', 'Petty Cash');
const BANK = account('BANK-001', 'HDFC Current Account');
const BANK_CHARGES = account('CHG-001', 'Bank Charges');
const CONTRA_IN = account('MISC-IN', 'Miscellaneous Income');
const CONTRA_OUT = account('MISC-EXP', 'Miscellaneous Expense');
const DETERMINED_CASH = account('CASH-DET', 'Cash on Hand', { id: 999 });

test('Payment Receipt: paymentGlAccount pointing at a petty cash code debits that account, not the cashOnHand determination', async () => {
  const ctx = makeCtx({ accounts: [PETTY_CASH, CONTRA_IN] });
  const posting = makePosting();
  const doc = {
    paymentReceiptNo: 'IP-1', appliedAmount: 1000,
    partyType: 'Account', partyCode: 'MISC-IN', partyName: 'Misc',
    paymentGlAccount: 'PC-001',
  };
  await POSTING_SCHEMAS[JOURNAL_SOURCE_TYPES.PAYMENT_RECEIPT](ctx, posting, doc);

  assert.deepEqual(posting.calls, [
    { side: 'debit', code: 'PC-001', amount: 1000, description: 'Receipt — IP-1' },
    { side: 'credit', code: 'MISC-IN', amount: 1000, description: 'Misc — IP-1' },
  ]);
});

test('Payment Voucher: paymentGlAccount pointing at a bank code credits that account, not the cashOnHand determination', async () => {
  const ctx = makeCtx({ accounts: [BANK, CONTRA_OUT] });
  const posting = makePosting();
  const doc = {
    paymentVoucherNo: 'OP-1', appliedAmount: 500,
    partyType: 'Account', partyCode: 'MISC-EXP', partyName: 'Misc Expense',
    paymentGlAccount: 'BANK-001',
  };
  await POSTING_SCHEMAS[JOURNAL_SOURCE_TYPES.PAYMENT_VOUCHER](ctx, posting, doc);

  assert.deepEqual(posting.calls, [
    { side: 'debit', code: 'MISC-EXP', amount: 500, description: 'Misc Expense — OP-1' },
    { side: 'credit', code: 'BANK-001', amount: 500, description: 'Payment — OP-1' },
  ]);
});

test('Payment Receipt with bank charges: 3-line entry, debits reduced by the charge, still balanced', async () => {
  const ctx = makeCtx({ accounts: [BANK, BANK_CHARGES, CONTRA_IN] });
  const posting = makePosting();
  const doc = {
    paymentReceiptNo: 'IP-2', appliedAmount: 1000,
    partyType: 'Account', partyCode: 'MISC-IN', partyName: 'Misc',
    paymentGlAccount: 'BANK-001',
    bankChargesAccount: 'CHG-001', bankChargesAmount: 50,
  };
  await POSTING_SCHEMAS[JOURNAL_SOURCE_TYPES.PAYMENT_RECEIPT](ctx, posting, doc);

  assert.equal(posting.calls.length, 3, 'Dr Bank Charges, Dr Bank (net), Cr party contra');
  assert.deepEqual(posting.calls, [
    { side: 'debit', code: 'CHG-001', amount: 50, description: 'Bank charges — IP-2' },
    { side: 'debit', code: 'BANK-001', amount: 950, description: 'Receipt — IP-2' },
    { side: 'credit', code: 'MISC-IN', amount: 1000, description: 'Misc — IP-2' },
  ]);
  const totals = totalsBySide(posting.calls);
  assert.equal(totals.debit, totals.credit, 'entry must balance');
  assert.equal(totals.debit, 1000);
});

test('Payment Voucher with bank charges: 3-line entry, credit increased by the charge, still balanced', async () => {
  const ctx = makeCtx({ accounts: [BANK, BANK_CHARGES, CONTRA_OUT] });
  const posting = makePosting();
  const doc = {
    paymentVoucherNo: 'OP-2', appliedAmount: 500,
    partyType: 'Account', partyCode: 'MISC-EXP', partyName: 'Misc Expense',
    paymentGlAccount: 'BANK-001',
    bankChargesAccount: 'CHG-001', bankChargesAmount: 20,
  };
  await POSTING_SCHEMAS[JOURNAL_SOURCE_TYPES.PAYMENT_VOUCHER](ctx, posting, doc);

  assert.equal(posting.calls.length, 3, 'Dr party contra, Dr Bank Charges, Cr Bank (gross)');
  assert.deepEqual(posting.calls, [
    { side: 'debit', code: 'MISC-EXP', amount: 500, description: 'Misc Expense — OP-2' },
    { side: 'debit', code: 'CHG-001', amount: 20, description: 'Bank charges — OP-2' },
    { side: 'credit', code: 'BANK-001', amount: 520, description: 'Payment — OP-2' },
  ]);
  const totals = totalsBySide(posting.calls);
  assert.equal(totals.debit, totals.credit, 'entry must balance');
  assert.equal(totals.credit, 520);
});

test('Payment Receipt: empty paymentGlAccount falls back to the cashOnHand determination account (pre-existing behaviour)', async () => {
  const ctx = makeCtx({
    accounts: [DETERMINED_CASH, CONTRA_IN],
    determination: { cashOnHandId: 999 },
  });
  const posting = makePosting();
  const doc = {
    paymentReceiptNo: 'IP-3', appliedAmount: 250,
    partyType: 'Account', partyCode: 'MISC-IN', partyName: 'Misc',
    paymentGlAccount: '', // never opened Payment Modes, or a pre-existing record
  };
  await POSTING_SCHEMAS[JOURNAL_SOURCE_TYPES.PAYMENT_RECEIPT](ctx, posting, doc);

  assert.deepEqual(posting.calls, [
    { side: 'debit', code: 'CASH-DET', amount: 250, description: 'Receipt — IP-3' },
    { side: 'credit', code: 'MISC-IN', amount: 250, description: 'Misc — IP-3' },
  ]);
});

test('Payment Voucher: empty paymentGlAccount falls back to the cashOnHand determination account (pre-existing behaviour)', async () => {
  const ctx = makeCtx({
    accounts: [DETERMINED_CASH, CONTRA_OUT],
    determination: { cashOnHandId: 999 },
  });
  const posting = makePosting();
  const doc = {
    paymentVoucherNo: 'OP-3', appliedAmount: 250,
    partyType: 'Account', partyCode: 'MISC-EXP', partyName: 'Misc Expense',
    paymentGlAccount: undefined,
  };
  await POSTING_SCHEMAS[JOURNAL_SOURCE_TYPES.PAYMENT_VOUCHER](ctx, posting, doc);

  assert.deepEqual(posting.calls, [
    { side: 'debit', code: 'MISC-EXP', amount: 250, description: 'Misc Expense — OP-3' },
    { side: 'credit', code: 'CASH-DET', amount: 250, description: 'Payment — OP-3' },
  ]);
});

test('Payment Receipt: paymentGlAccount naming a code that does not exist in the Chart Of Accounts throws AccountDeterminationError', async () => {
  const ctx = makeCtx({ accounts: [CONTRA_IN] });
  const posting = makePosting();
  const doc = {
    paymentReceiptNo: 'IP-4', appliedAmount: 100,
    partyType: 'Account', partyCode: 'MISC-IN', partyName: 'Misc',
    paymentGlAccount: 'NOPE-001',
  };
  await assert.rejects(
    () => POSTING_SCHEMAS[JOURNAL_SOURCE_TYPES.PAYMENT_RECEIPT](ctx, posting, doc),
    (err) => err instanceof AccountDeterminationError && /NOPE-001/.test(err.message)
  );
});

test('Payment Voucher: a Title account named as paymentGlAccount is refused (not postable)', async () => {
  const titleAccount = account('GRP-001', 'Bank Accounts Group', { accountNature: 'T' });
  const ctx = makeCtx({ accounts: [titleAccount, CONTRA_OUT] });
  const posting = makePosting();
  const doc = {
    paymentVoucherNo: 'OP-4', appliedAmount: 100,
    partyType: 'Account', partyCode: 'MISC-EXP', partyName: 'Misc Expense',
    paymentGlAccount: 'GRP-001',
  };
  await assert.rejects(
    () => POSTING_SCHEMAS[JOURNAL_SOURCE_TYPES.PAYMENT_VOUCHER](ctx, posting, doc),
    (err) => err instanceof AccountDeterminationError && /Title account/.test(err.message)
  );
});
