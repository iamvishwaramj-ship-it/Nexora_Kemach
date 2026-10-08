import { z } from 'zod';
import { requiredString, optionalString, optionalCurrencyAmount, anyDate, optionalDate, nonNegativeNumber, entityName } from './common';

// GroupType is a free-text VARCHAR(30) column in the DB (no CHECK
// constraint), but every screen picks from the same common set of accounting
// classifications rather than hand-typing it.
export const ACCOUNT_GROUP_TYPE_OPTIONS = [
  { label: 'Assets', value: 'Assets' },
  { label: 'Liabilities', value: 'Liabilities' },
  { label: 'Income', value: 'Income' },
  { label: 'Expenses', value: 'Expenses' },
  { label: 'Equity', value: 'Equity' },
];

// Status is CHAR(1) in the DB — 'A'/'I' — constrained by CK_..._Status.
// Labelled Active/Inactive in the UI to match every other master's Status
// field, but the value going to the API is the single letter.
export const STATUS_AI_OPTIONS = [
  { label: 'Active', value: 'A' },
  { label: 'Inactive', value: 'I' },
];

// Balance nature — CHAR(1) 'D'/'C' on both AccountType.normalBalance and
// ChartOfAccount.balanceType. ChartOfAccount's copy auto-fills from whichever
// AccountType is picked (see ChartOfAccounts.jsx), matching "Debit/Credit
// nature should be automatically determined where possible", but it stays a
// normal editable field rather than being locked.
export const BALANCE_TYPE_OPTIONS = [
  { label: 'Debit', value: 'D' },
  { label: 'Credit', value: 'C' },
];

// Chart Of Accounts' own Balance Type additionally allows 'All', for an
// account that may legitimately carry either side. AccountType.normalBalance
// keeps the strict Debit/Credit pair above — a type's *normal* balance is one
// or the other by definition.
export const BALANCE_TYPE_WITH_ALL_OPTIONS = [
  ...BALANCE_TYPE_OPTIONS,
  { label: 'All', value: 'A' },
];

// G/L Account Details — an account is either a Title (a heading that groups
// the accounts beneath it and is never posted to directly) or an Active
// Account (a real posting account). CHAR(1) 'T'/'A' in the DB, enforced by
// CK_ChartOfAccounts_AccountNature.
export const GL_ACCOUNT_NATURE_OPTIONS = [
  { label: 'Title', value: 'T' },
  { label: 'Active Account', value: 'A' },
];

// Currency is now a real master (Product Setup > Currency Master) instead of
// a fixed code list — every currency dropdown reads it live via
// useCurrencyOptions()/useBpCurrencyOptions() in lib/currencyOptions.js. This
// export was removed rather than kept as a re-export so nothing can quietly
// go back to a hardcoded list by importing from here again.

// Nullable FK selects (Parent Group, Parent Account) — an empty Autocomplete
// emits null (see FormSelect), which must stay null/undefined here rather
// than being coerced to '' (these are INT columns, not strings).
const optionalId = (label) =>
  z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z.number({ invalid_type_error: `${label} is invalid` }).int().positive().nullable().optional()
  );

// Mandatory FK selects (Account Group, Account Type on Chart Of Accounts) —
// same null-safe preprocessing as optionalId, but z.number()'s own
// invalid_type_error fires for the null a cleared/never-picked field holds,
// so "required" reads the same as any other required field's message.
const requiredId = (label) =>
  z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z.number({ invalid_type_error: `${label} is required`, required_error: `${label} is required` }).int().positive()
  );

// Chart of Accounts' Parent Account is the one nullable "FK-shaped" select
// in this file that is NOT a numeric id — ParentAccountID stores the
// parent's AccountCode (VARCHAR), not a DB foreign key (see model
// ChartOfAccount in schema.prisma; parent validity is enforced app-side by
// backend/src/utils/chartOfAccountRules.js instead). Kept separate from
// optionalId above rather than reusing it, since every other nullable FK
// select here (e.g. Parent Group) really is a numeric id.
const optionalCode = (label) =>
  z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z.string({ invalid_type_error: `${label} is invalid` }).trim().min(1, `${label} is invalid`).nullable().optional()
  );

// Account groups are a hierarchy in their own right — 1 Assets >
// 1.1 Current Assets > 1.1.1 Cash — which the schema and the seed have always
// modelled (parentGroupId, groupLevel) but the form never let anyone build:
// every group created from the UI was forced to level 1. Parent Group and
// Level are captured here for the same reason they are on an account, and
// behave the same way: Level picks the depth, Parent Group narrows to the
// groups one level above.
//
// GroupType and IsPostingAllowed stay out of the form deliberately. Both are
// derivable and so shouldn't be asked for: a group's type is whatever its
// drawer's type is, and a group allows posting exactly when it has no
// sub-groups under it. AccountGroup.jsx computes both on save.
export const accountGroupSchema = z.object({
  groupCode: requiredString('Group code'),
  groupName: entityName('Group name'),
  parentGroupId: optionalId('Parent group'),
  groupLevel: z.coerce
    .number({ invalid_type_error: 'Level is required', required_error: 'Level is required' })
    .int()
    .min(1, 'Level must be 1 or deeper')
    .max(5, 'Account groups are limited to 5 levels'),
  status: z.enum(['A', 'I'], {
    required_error: 'Status is required',
    invalid_type_error: 'Status is required',
  }),
  remarks: optionalString(),
}).superRefine((values, ctx) => {
  // Level 1 IS the drawer — a top-level group by definition has nothing above
  // it. Any deeper level has to say what it hangs off.
  if (values.groupLevel > 1 && values.parentGroupId == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['parentGroupId'],
      message: 'A sub-group must sit under a parent group',
    });
  }
  if (values.groupLevel === 1 && values.parentGroupId != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['parentGroupId'],
      message: 'A level 1 group is a drawer and cannot have a parent',
    });
  }
});

// Which statement an account type rolls up into — VARCHAR(30) in the DB,
// constrained by CK_AccountTypes_FinancialStatement. Stored as the label
// itself rather than a code, matching the column the org specified.
export const FINANCIAL_STATEMENT_OPTIONS = [
  { label: 'Balance Sheet', value: 'Balance Sheet' },
  { label: 'Profit & Loss', value: 'Profit & Loss' },
];

export const accountTypeSchema = z.object({
  typeCode: requiredString('Type code'),
  typeName: entityName('Type name'),
  financialStatement: z.enum(['Balance Sheet', 'Profit & Loss'], {
    required_error: 'Financial statement is required',
    invalid_type_error: 'Financial statement is required',
  }),
  normalBalance: z.enum(['D', 'C'], {
    required_error: 'Normal balance is required',
    invalid_type_error: 'Normal balance is required',
  }),
  status: z.enum(['A', 'I'], {
    required_error: 'Status is required',
    invalid_type_error: 'Status is required',
  }),
});

export const chartOfAccountSchema = z.object({
  accountNature: z.enum(['T', 'A'], {
    required_error: 'Select Title or Active Account',
    invalid_type_error: 'Select Title or Active Account',
  }),
  accountCode: requiredString('Account code'),
  accountName: entityName('Account name'),
  groupId: requiredId('Account group'),
  // SAP asks which of its five level columns an account belongs in, so Level
  // is a field the user actually picks — it drives the Parent list rather than
  // being read back off it. Bounds match lib/accountHierarchy: the drawer
  // itself is level 1, so no account is shallower than 2.
  accountLevel: z.coerce
    .number({ invalid_type_error: 'Level is required', required_error: 'Level is required' })
    .int()
    .min(2, 'Level must be 2 or deeper — level 1 is the drawer itself')
    .max(5, 'The chart of accounts is limited to 5 levels'),
  parentAccountId: optionalCode('Parent account'),
  currency: requiredString('Currency'),
  openingBalance: optionalCurrencyAmount('Opening balance'),
  balanceType: z.enum(['D', 'C', 'A'], {
    required_error: 'Balance type is required',
    invalid_type_error: 'Balance type is required',
  }),
  isControlAccount: z.boolean().optional(),
  isBankAccount: z.boolean().optional(),
  allowManualEntry: z.boolean().optional(),
  costCenterRequired: z.boolean().optional(),
  status: z.enum(['A', 'I'], {
    required_error: 'Status is required',
    invalid_type_error: 'Status is required',
  }),
  remarks: optionalString(),
}).superRefine((values, ctx) => {
  // An Active Account is by definition a sub-account: it has to hang off a
  // Title. A Title is a heading and may stand alone directly inside its
  // drawer, so its parent stays optional — it can still nest under another
  // Title, just isn't required to.
  //
  // The other hierarchy rules — parent must be a Title, parent must be in the
  // same account group, and the chart is capped at 5 levels — can't live here:
  // they need the rest of the chart to check against, which this schema never
  // sees. They're applied in ChartOfAccounts.jsx for the form and in
  // backend/src/utils/chartOfAccountRules.js for the API, the latter being
  // what actually guarantees them since a client can post anything.
  if (values.accountNature === 'A' && values.parentAccountId == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['parentAccountId'],
      message: 'An Active Account must sit under a Title account',
    });
  }
});

// Journal Entry (Accounting > Journal Entry) — the manual double-entry
// posting screen, SAP FB50/F-02 style. One line posts EITHER a debit OR a
// credit against a G/L account, never both and never neither — the
// superRefine below on journalEntryLineSchema turns that "only one side" rule
// into an enforced one, and the superRefine on journalEntrySchema enforces
// the golden rule of double-entry bookkeeping: total debit must equal total
// credit before the entry can be saved. Both are re-checked server-side in
// backend/src/routes/resources.js (assertJournalEntryBalanced) since a client
// can post anything.
// Transaction Type — which business process produced a journal entry.
//
// The field is READ-ONLY on the Journal Entry screen and the values are not a
// user's to choose. 'Manual' is stamped on anything typed there; every other
// value is stamped by the G/L posting engine on the entry it generates when
// the corresponding document posts. The server blocks the field outright on
// create and update, so this list exists to LABEL entries, not to pick from.
//
// It must stay in step with JOURNAL_SOURCE_TYPES in
// backend/src/utils/glPosting.js — that is the authoritative list, and a
// value here it does not recognise would render an entry the engine could
// never produce.
export const JOURNAL_ENTRY_TRANSACTION_TYPE_OPTIONS = [
  { label: 'Manual', value: 'Manual' },
  { label: 'Purchase GRN', value: 'Purchase GRN' },
  { label: 'Purchase Invoice', value: 'Purchase Invoice' },
  { label: 'Purchase Return', value: 'Purchase Return' },
  { label: 'Purchase Credit Memo', value: 'Purchase Credit Memo' },
  { label: 'Delivery Challan', value: 'Delivery Challan' },
  { label: 'Sales Invoice', value: 'Sales Invoice' },
  { label: 'Sales Return', value: 'Sales Return' },
  { label: 'Sales Credit Memo', value: 'Sales Credit Memo' },
  { label: 'Stock Issue', value: 'Stock Issue' },
  { label: 'Stock Return', value: 'Stock Return' },
  { label: 'Payment Receipt (Incoming Payment)', value: 'Payment Receipt (Incoming Payment)' },
  { label: 'Payment Voucher (Outgoing Payment)', value: 'Payment Voucher (Outgoing Payment)' },
  { label: 'Stock Transfer', value: 'Stock Transfer' },
];

const journalEntryLineSchema = z
  .object({
    accountCode: requiredString('G/L account'),
    accountName: optionalString(),
    description: optionalString(),
    // A select, same options as the header's own Branch field — not a
    // free-text cost center. Optional: most entries share one branch (set on
    // the header), but a line may override it when a posting genuinely spans
    // more than one.
    branch: optionalString(),
    // Business Partner tagged against this line, for AR/AP control-account
    // reconciliation — optional, most lines (expense, bank, stock, ...)
    // have no partner at all. Name is carried alongside the code the same
    // way accountName rides with accountCode above.
    businessPartnerCode: optionalString(),
    businessPartnerName: optionalString(),
    // Per-line Ref 1/2/3 -- plain free text, distinct from the header's own
    // ref1/ref2/ref3 above. Purely reference/memo: no posting or G/L
    // determination reads these.
    ref1: optionalString(),
    ref2: optionalString(),
    ref3: optionalString(),
    debit: optionalCurrencyAmount('Debit'),
    credit: optionalCurrencyAmount('Credit'),
    // Debit(SC)/Credit(SC)/Base Amount are deliberately NOT form fields
    // here: they're always server-computed from the line's debit/credit
    // (see toJournalEntryLineData in routes/resources.js) and only ever
    // shown, never entered.
  })
  .superRefine((line, ctx) => {
    const debit = Number(line.debit) || 0;
    const credit = Number(line.credit) || 0;
    if (debit > 0 && credit > 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['debit'], message: 'Enter either a debit or a credit, not both' });
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['credit'], message: 'Enter either a debit or a credit, not both' });
    }
    if (debit <= 0 && credit <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['debit'], message: 'Enter a debit or a credit amount' });
    }
  });

export const journalEntrySchema = z
  .object({
    journalEntryNo: requiredString('Journal entry number'),
    branch: requiredString('Branch'),
    transactionType: requiredString('Transaction type'),
    // "Origin No" on the form -- a second, independent number from
    // journalEntryNo, allocated from its own series (catalog code 'JEO')
    // for a manual entry, blank/unused on a system-generated one. See
    // schema.prisma and toJournalEntryLineData's sibling in resources.js.
    originNo: optionalString(),
    postingDate: anyDate('Posting date'),
    documentDate: anyDate('Document date'),
    // Optional even on a manual entry — there is no natural due date for a
    // hand-typed adjustment/accrual. On a system-generated entry it is
    // populated from the source document's own due date where one exists
    // (Purchase/Sales Invoice, Returns, Credit Memos, Payment
    // Receipt/Voucher) — see SOURCE_DATE_FIELDS in glPosting.js.
    dueDate: optionalDate('Due date'),
    // Free-text narration for a manual entry — replaced the old Reference
    // No. field on this form. Not required: most manual entries are
    // self-explanatory from their lines, this is for the ones that aren't.
    narration: optionalString(),
    currency: requiredString('Currency'),
    exchangeRate: nonNegativeNumber('Exchange rate', 999999),
    remarks: optionalString(),
    // Reference-only fields from the legacy Journal Entry screen — none of
    // these feed posting or G/L determination, see schema.prisma.
    ref1: optionalString(),
    ref2: optionalString(),
    ref3: optionalString(),
    reviseDateEnabled: z.boolean().optional(),
    reviseDate: optionalDate('Revise date'),
    lines: z.array(journalEntryLineSchema).min(2, 'A journal entry needs at least two lines'),
  })
  .superRefine((values, ctx) => {
    const totalDebit = (values.lines || []).reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
    const totalCredit = (values.lines || []).reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.005) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lines'],
        message: `Not balanced — total debit ₹${totalDebit.toFixed(2)} must equal total credit ₹${totalCredit.toFixed(2)}`,
      });
    }
  });
