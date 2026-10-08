import { z } from 'zod';
import {
  requiredString, optionalString, currencyAmount, optionalCurrencyAmount, anyDate, optionalDate, optionalPositiveNumber,
  pastOrTodayDate, dateRange, entityName, personName,
} from './common';

export const customerOutstandingSchema = z.object({
  customerName: entityName('Customer name'),
  invoiceNo: requiredString('Invoice number'),
  invoiceDate: pastOrTodayDate('Invoice date'),
  dueDate: anyDate('Due date'),
  invoiceAmount: currencyAmount('Invoice amount'),
  paidAmount: currencyAmount('Paid amount'),
  balanceAmount: currencyAmount('Balance amount'),
  status: requiredString('Status'),
}).superRefine((data, ctx) => {
  dateRange('invoiceDate', 'dueDate', { startLabel: 'Invoice date', endLabel: 'Due date' })(data, ctx);
});

// One applied-invoice line item within a Collection -- amountApplied must
// never exceed that row's outstanding balance at the time it was added
// (outstandingAtTimeOfApplication), same "row-level .refine" idea as
// financialYearSchema's start/end date check.
const collectionInvoiceApplicationSchema = z.object({
  invoiceNo: requiredString('Invoice number'),
  invoiceDate: anyDate('Invoice date'),
  dueDate: anyDate('Due date'),
  totalAmount: currencyAmount('Total amount'),
  outstandingAtTimeOfApplication: currencyAmount('Outstanding amount'),
  amountApplied: currencyAmount('Amount to apply'),
}).refine((row) => Number(row.amountApplied) <= Number(row.outstandingAtTimeOfApplication), {
  message: 'Amount to apply cannot exceed the outstanding balance',
  path: ['amountApplied'],
});

export const collectionSchema = z.object({
  collectionNo: requiredString('Collection number'),
  // Numbering series chosen on create (DocumentSeriesNoField) — transient
  // request data, not a stored column; unused/blank on edit.
  seriesId: z.union([z.number(), z.string()]).nullable().optional(),
  branch: requiredString('Branch'),
  customerName: entityName('Customer name'),
  receiptDate: anyDate('Receipt date'),
  postingDate: anyDate('Posting date'),
  paymentMode: requiredString('Payment mode'),
  depositTo: requiredString('Deposit to'),
  notes: optionalString(),
  receivedBy: personName('Received by'),
  instrumentNo: optionalString(),
  paymentCurrency: requiredString('Payment currency'),
  paymentAmount: currencyAmount('Payment amount'),
  paymentDate: anyDate('Payment date'),
  remarks: optionalString(),
  invoiceApplications: z.array(collectionInvoiceApplicationSchema).min(1, 'Add at least one invoice to apply this payment against'),
}).superRefine((data, ctx) => {
  dateRange('receiptDate', 'postingDate', { startLabel: 'Receipt date', endLabel: 'Posting date' })(data, ctx);
});

export const supplierOutstandingSchema = z.object({
  supplierName: entityName('Supplier name'),
  invoiceNo: requiredString('Invoice number'),
  invoiceDate: pastOrTodayDate('Invoice date'),
  dueDate: anyDate('Due date'),
  invoiceAmount: currencyAmount('Invoice amount'),
  paidAmount: currencyAmount('Paid amount'),
  balanceAmount: currencyAmount('Balance amount'),
  status: requiredString('Status'),
}).superRefine((data, ctx) => {
  dateRange('invoiceDate', 'dueDate', { startLabel: 'Invoice date', endLabel: 'Due date' })(data, ctx);
});

// One applied-invoice line item within a SupplierPayment -- same rule as
// collectionInvoiceApplicationSchema above.
const paymentInvoiceApplicationSchema = z.object({
  invoiceNo: requiredString('Invoice number'),
  invoiceDate: anyDate('Invoice date'),
  dueDate: anyDate('Due date'),
  totalAmount: currencyAmount('Total amount'),
  outstandingAtTimeOfApplication: currencyAmount('Outstanding amount'),
  amountApplied: currencyAmount('Amount to apply'),
}).refine((row) => Number(row.amountApplied) <= Number(row.outstandingAtTimeOfApplication), {
  message: 'Amount to apply cannot exceed the outstanding balance',
  path: ['amountApplied'],
});

export const supplierPaymentSchema = z.object({
  paymentNo: requiredString('Payment number'),
  // Numbering series chosen on create (DocumentSeriesNoField) — transient
  // request data, not a stored column; unused/blank on edit.
  seriesId: z.union([z.number(), z.string()]).nullable().optional(),
  branch: requiredString('Branch'),
  supplierName: entityName('Supplier name'),
  paymentDate: anyDate('Payment date'),
  postingDate: anyDate('Posting date'),
  paymentMode: requiredString('Payment mode'),
  payFromAccount: requiredString('Pay from account'),
  notes: optionalString(),
  paidBy: personName('Paid by'),
  instrumentNo: optionalString(),
  paymentCurrency: requiredString('Payment currency'),
  paymentAmount: currencyAmount('Payment amount'),
  summaryPaymentDate: anyDate('Payment date'),
  remarks: optionalString(),
  invoiceApplications: z.array(paymentInvoiceApplicationSchema).min(1, 'Add at least one invoice to apply this payment against'),
}).superRefine((data, ctx) => {
  dateRange('paymentDate', 'postingDate', { startLabel: 'Payment date', endLabel: 'Posting date' })(data, ctx);
});

// Round Off on a Payment Receipt is a plain user-typed adjustment (unlike the
// server-computed tax-rounding field of the same name on Sales/Purchase
// documents), so it needs its own small signed-amount schema rather than
// currencyAmount()/nonNegativeNumber() — a round-off can legitimately be
// negative (e.g. rounding a receipt down by a few paise).
const signedAmount = (label = 'Amount') =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? 0 : Number(v)),
    z.number({ invalid_type_error: `${label} must be a number` }).max(999999999.99, `${label} is too large`).min(-999999999.99, `${label} is too large`)
  );

// One applied invoice/bill line on a Payment Receipt -- same shape and
// over-application guard as Collection/SupplierPayment's application rows.
const paymentReceiptApplicationSchema = z.object({
  invoiceNo: requiredString('Invoice/Bill number'),
  invoiceDate: anyDate('Invoice/Bill date'),
  dueDate: anyDate('Due date'),
  totalAmount: currencyAmount('Total amount'),
  outstandingAtTimeOfApplication: currencyAmount('Outstanding amount'),
  amountApplied: currencyAmount('Amount to apply'),
}).refine((row) => Number(row.amountApplied) <= Number(row.outstandingAtTimeOfApplication), {
  message: 'Amount to apply cannot exceed the outstanding balance',
  path: ['amountApplied'],
});

// Payment Receipt ("Incoming Payment") — Banking > Payment Receipt. Unlike
// Collection Entry (customer-only) this form posts against a Customer, a
// Vendor, or a raw Chart-Of-Accounts Account (partyType), so partyName is
// validated generically rather than as "Customer name"/"Supplier name".
// applications is intentionally NOT `.min(1)` the way Collection/
// SupplierPayment's invoiceApplications is — an Account party or a
// Payment on Account receipt legitimately has none, and the page itself
// disables/hides the table in both cases.
export const paymentReceiptSchema = z.object({
  paymentReceiptNo: requiredString('Incoming Payment No.'),
  // Numbering series chosen on create (DocumentSeriesNoField) — transient
  // request data, not a stored column; unused/blank on edit.
  seriesId: z.union([z.number(), z.string()]).nullable().optional(),
  branch: requiredString('Branch'),
  partyType: requiredString('Customer/Vendor/Account'),
  partyCode: optionalString(),
  partyName: requiredString('Name'),
  billTo: optionalString(),
  contactPerson: optionalString(),
  postingDate: anyDate('Posting date'),
  dueDate: optionalDate('Due date'),
  documentDate: anyDate('Document date'),
  reference: optionalString(),
  transactionNo: optionalString(),
  currency: requiredString('Currency'),
  // Exchange Rate is only meaningful for a foreign currency — INR against
  // itself is always 1, so the field is blank/disabled and not required on
  // the page whenever Currency is INR (mirrors paymentVoucherSchema below).
  // Left optional here and enforced conditionally by the superRefine so a
  // blank/disabled field never blocks submit for an INR receipt.
  exchangeRate: optionalPositiveNumber('Exchange rate', 100000),
  remarks: optionalString(),
  journalRemarks: optionalString(),
  paymentOnAccount: z.boolean().optional().default(false),
  roundOff: signedAmount('Round off'),
  totalAmountDue: currencyAmount('Total amount due'),
  // Payment Modes breakdown (see components/banking/PaymentModesDialog.jsx)
  // -- paymentMode/paymentGlAccount record which tab and Cash/Bank account
  // the user picked, so the GL posting can debit that specific account
  // instead of the fixed cashOnHand determination account. All optional:
  // a receipt saved before this existed, or one closed without opening the
  // dialog, simply falls back to the old behaviour server-side.
  paymentMode: optionalString(),
  paymentGlAccount: optionalString(),
  bankChargesAccount: optionalString(),
  bankChargesAmount: optionalCurrencyAmount(),
  applications: z.array(paymentReceiptApplicationSchema),
})
  .superRefine((values, ctx) => {
    // Mandatory only for a non-INR currency -- see the exchangeRate comment
    // above (same rule as paymentVoucherSchema).
    if (values.currency && values.currency !== 'INR'
      && (values.exchangeRate === undefined || values.exchangeRate === null || values.exchangeRate === '')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['exchangeRate'], message: 'Exchange rate is required when currency is not INR' });
    }
  });

// One applied invoice/bill line on a Payment Voucher -- same shape and
// over-application guard as Payment Receipt's application rows.
const paymentVoucherApplicationSchema = z.object({
  invoiceNo: requiredString('Invoice/Bill number'),
  invoiceDate: anyDate('Invoice/Bill date'),
  dueDate: anyDate('Due date'),
  totalAmount: currencyAmount('Total amount'),
  outstandingAtTimeOfApplication: currencyAmount('Outstanding amount'),
  amountApplied: currencyAmount('Amount to apply'),
}).refine((row) => Number(row.amountApplied) <= Number(row.outstandingAtTimeOfApplication), {
  message: 'Amount to apply cannot exceed the outstanding balance',
  path: ['amountApplied'],
});

// Payment Voucher ("Outgoing Payment") — Banking > Payment Voucher, the
// outgoing counterpart to Payment Receipt. Only Vendor and Account are valid
// partyType values here (there is no "pay a customer" concept), enforced by
// the page itself (the radio group only offers those two) rather than a
// z.enum here, matching how paymentReceiptSchema leaves partyType a plain
// string. applications is NOT `.min(1)` for the same reason as
// paymentReceiptSchema — an Account party or a Payment on Account voucher
// legitimately has none.
export const paymentVoucherSchema = z.object({
  paymentVoucherNo: requiredString('Outgoing Payment No.'),
  // Numbering series chosen on create (DocumentSeriesNoField) — transient
  // request data, not a stored column; unused/blank on edit.
  seriesId: z.union([z.number(), z.string()]).nullable().optional(),
  branch: requiredString('Branch'),
  partyType: requiredString('Vendor/Account'),
  partyCode: optionalString(),
  partyName: requiredString('Name'),
  billTo: optionalString(),
  contactPerson: optionalString(),
  reference: optionalString(),
  paymentType: requiredString('Payment type'),
  postingDate: anyDate('Posting date'),
  dueDate: optionalDate('Due date'),
  documentDate: anyDate('Document date'),
  transactionNo: optionalString(),
  currency: requiredString('Currency'),
  // Exchange Rate is only meaningful for a foreign currency — INR against
  // itself is always 1, so the field is disabled and not required on the
  // page whenever Currency is INR. Left optional here and enforced
  // conditionally below so a blank/disabled field never blocks submit for
  // an INR voucher.
  exchangeRate: optionalPositiveNumber('Exchange rate', 100000),
  remarks: optionalString(),
  journalRemarks: optionalString(),
  paymentOnAccount: z.boolean().optional().default(false),
  totalDue: currencyAmount('Total due'),
  roundOff: signedAmount('Round off'),
  // Payment Modes breakdown -- see the matching comment on
  // paymentReceiptSchema above.
  paymentMode: optionalString(),
  paymentGlAccount: optionalString(),
  bankChargesAccount: optionalString(),
  bankChargesAmount: optionalCurrencyAmount(),
  applications: z.array(paymentVoucherApplicationSchema),
})
  .superRefine((values, ctx) => {
    // Mandatory only for a non-INR currency -- see the exchangeRate comment
    // above.
    if (values.currency && values.currency !== 'INR'
      && (values.exchangeRate === undefined || values.exchangeRate === null || values.exchangeRate === '')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['exchangeRate'], message: 'Exchange rate is required when currency is not INR' });
    }
  });
