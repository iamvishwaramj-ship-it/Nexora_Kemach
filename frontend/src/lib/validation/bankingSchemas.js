import { z } from 'zod';
import {
  requiredString, optionalString, currencyAmount, anyDate,
  optionalDate, optionalPercentage, optionalCurrencyAmount, personName,
} from './common';

// One deposit line item within a BankDeposit. Payment Mode and Amount are
// always required, on every row regardless of mode. Instrument No.,
// Instrument Date and Account/Description only make sense for a non-cash
// mode (a cheque or transfer has a reference and a bank/account it moved
// through; cash doesn't) — the superRefine below turns that "only applies
// to" from a comment into an enforced rule, so a Cheque/Bank Transfer/UPI/
// NEFT/RTGS line can't be saved without the instrument reference and account
// that reconciling it later depends on. A Cash line is untouched by any of
// this: only Payment Mode and Amount are ever asked of it.
const depositItemSchema = z
  .object({
    paymentMode: requiredString('Payment mode'),
    instrumentNo: optionalString(),
    instrumentDate: anyDate('Instrument date').optional().nullable(),
    accountDescription: optionalString(),
    amount: currencyAmount('Amount'),
  })
  .superRefine((item, ctx) => {
    if (item.paymentMode && item.paymentMode !== 'Cash') {
      if (!item.instrumentNo?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['instrumentNo'], message: `Instrument / Transaction No. is required for ${item.paymentMode}` });
      }
      if (!item.instrumentDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['instrumentDate'], message: `Instrument date is required for ${item.paymentMode}` });
      }
      if (!item.accountDescription?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['accountDescription'], message: `Account / Description is required for ${item.paymentMode}` });
      }
    }
  });

export const bankDepositSchema = z
  .object({
    depositNo: requiredString('Deposit number'),
    // Numbering series chosen on create (DocumentSeriesNoField) — transient
    // request data, not a stored column; unused/blank on edit.
    seriesId: z.union([z.number(), z.string()]).nullable().optional(),
    branch: requiredString('Branch'),
    depositDate: anyDate('Deposit date'),
    depositTo: requiredString('Deposit to'),
    depositType: requiredString('Deposit type'),
    postingDate: anyDate('Posting date'),
    remarks: optionalString(),
    attachmentName: optionalString(),
    // Term-deposit fields — optional, since they only apply to Fixed/Recurring
    // Deposit slips. optionalPercentage caps the rate at 100, so a mistyped
    // "650" for 6.50 is caught at entry rather than stored.
    interestRate: optionalPercentage('Interest rate'),
    maturityDate: optionalDate('Maturity date'),
    maturityAmount: optionalCurrencyAmount('Maturity amount'),
    items: z.array(depositItemSchema).min(1, 'Add at least one deposit item'),
  })
  .superRefine((values, ctx) => {
    // Posting Date is when this deposit is entered into the books, so it
    // can't predate the deposit it's posting — same "no impossible dates"
    // principle as pastOrTodayDate/futureOrTodayDate in common.js, just
    // relative to another field on this form instead of "today".
    if (values.depositDate && values.postingDate && new Date(values.postingDate) < new Date(values.depositDate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['postingDate'], message: 'Posting date cannot be before the deposit date' });
    }
    // A Fixed/Recurring Deposit's maturity is necessarily after it's placed —
    // catches a mistyped year (e.g. last year's date left over from a copied
    // row) before it's saved rather than silently accepting a matured-in-the-
    // past term deposit.
    if (values.maturityDate && values.depositDate && new Date(values.maturityDate) < new Date(values.depositDate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['maturityDate'], message: 'Maturity date cannot be before the deposit date' });
    }
    // The three term-deposit fields describe one thing (this slip is a
    // Fixed/Recurring Deposit) and only make sense together — a Maturity
    // Date with no rate leaves the eventual payout unexplained, and a rate
    // with no maturity date has nothing to compound toward.
    const hasAnyTermField = values.interestRate !== '' && values.interestRate !== undefined
      || Boolean(values.maturityDate)
      || (values.maturityAmount !== '' && values.maturityAmount !== undefined);
    if (hasAnyTermField) {
      if (values.interestRate === '' || values.interestRate === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['interestRate'], message: 'Interest rate is required for a term deposit' });
      }
      if (!values.maturityDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['maturityDate'], message: 'Maturity date is required for a term deposit' });
      }
      if (values.maturityAmount === '' || values.maturityAmount === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['maturityAmount'], message: 'Maturity amount is required for a term deposit' });
      }
    }
  });

export const bankReconciliationSchema = z.object({
  bankAccount: requiredString('Bank account'),
  statementDate: anyDate('Statement date'),
  reconciliationDate: anyDate('Reconciliation date'),
  openingBalance: currencyAmount('Opening balance'),
  status: optionalString(),
  notes: optionalString(),
});

export const chequeSchema = z
  .object({
    chequeNo: requiredString('Cheque number'),
    // Numbering series chosen on create (DocumentSeriesNoField) — transient
    // request data, not a stored column; unused/blank on edit.
    seriesId: z.union([z.number(), z.string()]).nullable().optional(),
    branch: requiredString('Branch'),
    bankAccount: requiredString('Bank account'),
    chequeDate: anyDate('Cheque date'),
    chequeType: requiredString('Cheque type'),
    payTo: personName('Pay to'),
    printTemplate: optionalString(),
    amount: currencyAmount('Amount'),
    amountInWords: optionalString(),
    narration: optionalString(),
    attachmentName: optionalString(),
  })
  .superRefine((values, ctx) => {
    // Post-dated cheques are routine, but a cheque date more than a year out
    // is almost certainly a typo (e.g. the wrong century/year picked in the
    // date widget) rather than a genuine post-dated instrument — same "catch
    // an impossible/implausible date before it's saved" principle as the
    // term-deposit maturity check in bankDepositSchema above.
    if (values.chequeDate) {
      const maxChequeDate = new Date();
      maxChequeDate.setFullYear(maxChequeDate.getFullYear() + 1);
      if (new Date(values.chequeDate) > maxChequeDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['chequeDate'], message: 'Cheque date is too far in the future' });
      }
    }
  });
