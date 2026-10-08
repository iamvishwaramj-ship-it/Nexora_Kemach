/**
 * GST account filtering rule shared by G/L Account Determination's Tax
 * section and Tax Code Master's Sales/Purchase/RCM Tax Account pickers.
 *
 * computeAllowedTaxGLAccountIds is pure — no database — so this suite pins
 * it directly against the exact source-of-truth query:
 *
 *   SELECT * FROM ChartOfAccounts
 *   WHERE AccountName LIKE '%GST%' AND AccountNature = 'A';
 *
 * Run with:  node --test "src/tests/*.test.js"
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isGstActiveAccount,
  computeAllowedTaxGLAccountIds,
  TAX_CODE_TO_DETERMINATION_DEFAULT,
} = require('../utils/taxGlAccountFilter');

const CHART_OF_ACCOUNTS = [
  { id: 210001, accountCode: '210001', accountName: 'GST Output CGST', accountNature: 'A' },
  { id: 210002, accountCode: '210002', accountName: 'GST Output SGST', accountNature: 'A' },
  { id: 210003, accountCode: '210003', accountName: 'GST Output IGST', accountNature: 'A' },
  { id: 210004, accountCode: '210004', accountName: 'GST RCM CGST', accountNature: 'A' },
  { id: 510001, accountCode: '510001', accountName: 'GST Input CGST', accountNature: 'A' },
  { id: 410001, accountCode: '410001', accountName: 'GST Expense', accountNature: 'A' },
  { id: 210007, accountCode: '210007', accountName: 'TDS Payable', accountNature: 'A' },
  // A Title (roll-up header) account named GST — must be excluded even
  // though its name matches, since it isn't a postable ('A') account.
  { id: 220000, accountCode: '220000', accountName: 'GST Payable Group', accountNature: 'T' },
];

test('isGstActiveAccount: AccountName LIKE %GST% (case-insensitive) AND AccountNature = A', () => {
  assert.equal(isGstActiveAccount({ accountName: 'GST Output CGST', accountNature: 'A' }), true);
  assert.equal(isGstActiveAccount({ accountName: 'gst output sgst', accountNature: 'A' }), true, 'case-insensitive');
  assert.equal(isGstActiveAccount({ accountName: 'GST Input CGST', accountNature: 'A' }), true, 'no category restriction — Assets/Expenses GST accounts qualify too');
  assert.equal(isGstActiveAccount({ accountName: 'TDS Payable', accountNature: 'A' }), false, 'no GST in name');
  assert.equal(isGstActiveAccount({ accountName: 'GST Payable Group', accountNature: 'T' }), false, 'Title account, not Active');
  assert.equal(isGstActiveAccount(null), false);
  assert.equal(isGstActiveAccount({ accountName: null, accountNature: 'A' }), false);
});

test('computeAllowedTaxGLAccountIds: every Active GST-named account qualifies, regardless of category', () => {
  const allowed = computeAllowedTaxGLAccountIds(CHART_OF_ACCOUNTS);
  assert.deepEqual(
    [...allowed].sort((a, b) => a - b),
    [210001, 210002, 210003, 210004, 510001, 410001].sort((a, b) => a - b)
  );
});

test('computeAllowedTaxGLAccountIds: a non-GST account is excluded regardless of category', () => {
  const allowed = computeAllowedTaxGLAccountIds(CHART_OF_ACCOUNTS);
  assert.equal(allowed.has(210007), false, 'TDS Payable has no "GST" in its name');
});

test('computeAllowedTaxGLAccountIds: a Title (non-Active) GST-named account is excluded', () => {
  const allowed = computeAllowedTaxGLAccountIds(CHART_OF_ACCOUNTS);
  assert.equal(allowed.has(220000), false, 'GST Payable Group is a Title account, not Active');
});

test('computeAllowedTaxGLAccountIds: empty input yields an empty allowed set', () => {
  assert.equal(computeAllowedTaxGLAccountIds([]).size, 0);
  assert.equal(computeAllowedTaxGLAccountIds(undefined).size, 0);
});

test('TAX_CODE_TO_DETERMINATION_DEFAULT: maps each TaxCode Sales/Purchase account to its GlAccountDetermination default field', () => {
  assert.deepEqual(TAX_CODE_TO_DETERMINATION_DEFAULT, {
    sgstSalesAccountId: 'salesSgstAccountId',
    cgstSalesAccountId: 'salesCgstAccountId',
    igstSalesAccountId: 'salesIgstAccountId',
    sgstPurchaseAccountId: 'purchaseSgstAccountId',
    cgstPurchaseAccountId: 'purchaseCgstAccountId',
    igstPurchaseAccountId: 'purchaseIgstAccountId',
  });
});
