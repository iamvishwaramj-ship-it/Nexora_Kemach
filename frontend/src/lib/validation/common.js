import { z } from 'zod';

// Shared Zod building blocks — reused across every form via RHF's zodResolver.
// Never redefine validation ad hoc per form; compose these instead.

// FormSelect (the Autocomplete-based select every page uses) emits `null`
// whenever a field is cleared or has no matching option — but plain
// z.string()-based schemas below only ever accepted string/undefined/''. The
// moment an optional select field's value was `null` (e.g. an existing
// record's saved value doesn't match any current option, or the field gets
// cleared), zodResolver would throw "Expected string, received null" for
// that one field — which silently blocks the *entire* form submission with
// no obvious toast, since AppForm just doesn't call onSubmit on invalid data.
// That's the "data is not updating" symptom. Preprocessing null -> '' here
// fixes every string-based field across the app in one place.
const toStringInput = (v) => {
      if (v === null || v === undefined) return '';
      if (typeof v === 'string' && v.trim().toUpperCase() === 'NULL') return '';
      return v;
    };

export const requiredString = (label) =>
  z.preprocess(toStringInput, z.string({ required_error: `${label} is required` }).trim().min(1, `${label} is required`));

export const optionalString = () => z.preprocess(toStringInput, z.string().trim().optional().or(z.literal('')));

// Mobile: Indian mobile numbers are 10 digits starting with 6-9. Real-world
// input regularly carries a "+91"/"91" country-code prefix or a leading "0"
// STD-style trunk prefix, and users often space/dash-group the digits (e.g.
// "+91 98765 43210") — none of that is part of the number itself, so it is
// stripped here before the digit check runs. Stripping via .transform (not
// just validating and leaving the raw value alone) mirrors gstin()/
// panNumber()'s .toUpperCase(): both mutate the value that actually gets
// submitted, not just what gets validated.
const stripMobilePrefix = (v) => {
  if (typeof v !== 'string') return v;
  const cleaned = v.replace(/[\s-]/g, '');
  // Only strip a country-code/trunk prefix when the number is actually
  // longer than a bare 10-digit mobile number — i.e. the prefix plus exactly
  // 10 more digits. Unconditionally stripping "^(\+?91|0)" (the old
  // behaviour) also matched a plain 10-digit number that simply *starts*
  // with "91" (e.g. 9123456799 -> 23456799, 8 digits), which then wrongly
  // failed the 10-digit check. A real "+91"/"91" country code or a leading
  // "0" trunk prefix always leaves exactly 10 digits behind once removed;
  // requiring that here is what tells the two cases apart.
  if (/^\+91\d{10}$/.test(cleaned)) return cleaned.slice(3);
  if (/^91\d{10}$/.test(cleaned)) return cleaned.slice(2);
  if (/^0\d{10}$/.test(cleaned)) return cleaned.slice(1);
  return cleaned;
};

export const mobileNumber = (label = 'Mobile number') =>
  z.preprocess(
    toStringInput,
    z
      .string({ required_error: `${label} is required` })
      .trim()
      .transform(stripMobilePrefix)
      .refine((v) => /^[6-9]\d{9}$/.test(v), `${label} must be 10 digits starting with 6-9`)
  );

export const optionalMobileNumber = (label = 'Mobile number') =>
  z.preprocess(
    toStringInput,
    z
      .string()
      .trim()
      .transform(stripMobilePrefix)
      .refine((v) => v === '' || /^[6-9]\d{9}$/.test(v), `${label} must be 10 digits starting with 6-9`)
      .optional()
      .or(z.literal(''))
  );

// Same 10-digit/prefix-stripping shape as mobileNumber() above, but without
// the leading-digit (6-9) restriction — for forms (e.g. Enquiry) where any
// 10-digit number should be accepted rather than only Indian mobile ranges.
export const mobileNumberAnyPrefix = (label = 'Mobile number') =>
  z.preprocess(
    toStringInput,
    z
      .string({ required_error: `${label} is required` })
      .trim()
      .transform(stripMobilePrefix)
      .refine((v) => /^\d{10}$/.test(v), `${label} must be 10 digits`)
  );

// Landline / phone number: no fixed country format is enforced (STD codes
// vary in length and this is a client-side format check, not a directory
// lookup) — just strip the punctuation people use to group digits
// (spaces, hyphens, parentheses) and require what's left to be a plausible
// 6-15 digit number, which comfortably covers "STD code + local number" and
// short local-only entries alike.
const stripPhoneSeparators = (v) => (typeof v === 'string' ? v.replace(/[\s\-()]/g, '') : v);

export const phoneNumber = (label = 'Phone number') =>
  z.preprocess(
    toStringInput,
    z
      .string({ required_error: `${label} is required` })
      .trim()
      .transform(stripPhoneSeparators)
      .refine((v) => /^\d{6,15}$/.test(v), `${label} must be 6-15 digits`)
  );

export const optionalPhoneNumber = (label = 'Phone number') =>
  z.preprocess(
    toStringInput,
    z
      .string()
      .trim()
      .transform(stripPhoneSeparators)
      .refine((v) => v === '' || /^\d{6,15}$/.test(v), `${label} must be 6-15 digits`)
      .optional()
      .or(z.literal(''))
  );

// Person name: letters, spaces and the punctuation real names use (periods
// for initials, apostrophes for names like O'Brien, hyphens for
// double-barrelled names) — no digits or other symbols. min(2) after
// .trim() doubles as the "not just whitespace" check, since trim collapses
// a pure-whitespace string down to '' before the length check runs.
export const personName = (label = 'Name') =>
  z.preprocess(
    toStringInput,
    z
      .string({ required_error: `${label} is required` })
      .trim()
      .min(2, `${label} must be at least 2 characters`)
      .regex(/^[A-Za-z\s.'-]+$/, `${label} can only contain letters`)
  );

export const optionalPersonName = (label = 'Name') =>
  z.preprocess(
    toStringInput,
    z
      .string()
      .trim()
      .min(2, `${label} must be at least 2 characters`)
      .regex(/^[A-Za-z\s.'-]+$/, `${label} can only contain letters`)
      .optional()
      .or(z.literal(''))
  );

// Entity name (company / firm / organization): letters, digits, spaces and
// the punctuation real business names use (e.g. "Sharma & Sons",
// "Unit-4/A", "ABC Traders (India)"). Unlike personName() above, digits are
// allowed since business names commonly include them ("7-Eleven", "24/7
// Logistics") — but a purely numeric string is still not a usable name, so
// that's checked separately via .refine.
export const entityName = (label = 'Name') =>
  z.preprocess(
    toStringInput,
    z
      .string({ required_error: `${label} is required` })
      .trim()
      .min(1, `${label} is required`)
      .regex(/^[A-Za-z0-9\s.,&\-/()]+$/, `${label} can only contain letters, numbers and . , & - / ( )`)
      .refine((v) => /[A-Za-z]/.test(v), `${label} must contain at least one letter`)
  );

export const optionalEntityName = (label = 'Name') =>
  z.preprocess(
    toStringInput,
    z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9\s.,&\-/()]*$/, `${label} can only contain letters, numbers and . , & - / ( )`)
      .refine((v) => v === '' || /[A-Za-z]/.test(v), `${label} must contain at least one letter`)
      .optional()
      .or(z.literal(''))
  );

// Tax label (Tax Code / Tax Name only): no character-set restriction — any
// symbol is allowed (e.g. "GST 18%", "GST_18%", "GST@18#"). Only requires a
// non-blank value containing at least one letter. Mirrors taxLabelField in
// backend/src/utils/formatValidators.js — keep the two in sync.
export const taxLabel = (label = 'Name') =>
  z.preprocess(
    toStringInput,
    z
      .string({ required_error: `${label} is required` })
      .trim()
      .min(1, `${label} is required`)
      .refine((v) => /[A-Za-z]/.test(v), `${label} must contain at least one letter`)
  );

// Strict name (Product Setup screens only): a deliberately stricter rule
// than entityName() above — this is NOT a replacement for entityName, which
// stays in use everywhere else (org/partner/product names still allow
// ". , & - / ( )" and don't require a letter-first character). This one is
// wired ONLY into Product Setup schemas (Product Group, Sub-Group, Brand,
// UOM, Currency, Product Master, etc.) per that
// stakeholder-specified rule: letters, digits, spaces, hyphens and
// underscores only, and the first character must be a letter.
export const strictName = (label = 'Name') =>
  z.preprocess(
    toStringInput,
    z
      .string({ required_error: `${label} is required` })
      .trim()
      .min(1, `${label} is required`)
      .regex(
        /^[A-Za-z][A-Za-z0-9 _-]*$/,
        `${label} must start with a letter and can only contain letters, numbers, spaces, hyphens and underscores.`
      )
  );

export const optionalStrictName = (label = 'Name') =>
  z.preprocess(
    toStringInput,
    z
      .string()
      .trim()
      .regex(
        /^[A-Za-z][A-Za-z0-9 _-]*$/,
        `${label} must start with a letter and can only contain letters, numbers, spaces, hyphens and underscores.`
      )
      .optional()
      .or(z.literal(''))
  );

// Age: integer, 0-150 inclusive.
export const age = (label = 'Age') =>
  z
    .number({ invalid_type_error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(0, `${label} cannot be negative`)
    .max(150, `${label} cannot exceed 150`);

export const email = (label = 'Email') =>
  z.string({ required_error: `${label} is required` }).trim().email(`Enter a valid ${label.toLowerCase()}`);

export const optionalEmail = (label = 'Email') =>
  z.preprocess(toStringInput, z.string().trim().email(`Enter a valid ${label.toLowerCase()}`).optional().or(z.literal('')));

// Password: min 8 chars, at least one uppercase letter and one number.
export const password = (label = 'Password') =>
  z
    .string({ required_error: `${label} is required` })
    .min(8, `${label} must be at least 8 characters`)
    .regex(/[A-Z]/, `${label} must contain an uppercase letter`)
    .regex(/[0-9]/, `${label} must contain a number`);

// Use with .refine on the parent object to confirm password matching:
// z.object({ password: password(), confirmPassword: z.string() })
//   .refine((data) => data.password === data.confirmPassword, {
//     message: 'Passwords do not match', path: ['confirmPassword'],
//   })
export const confirmPasswordRefinement = (schema, passwordField = 'password', confirmField = 'confirmPassword') =>
  schema.refine((data) => data[passwordField] === data[confirmField], {
    message: 'Passwords do not match',
    path: [confirmField],
  });

// Dates: no impossible dates. dateOfBirth must not be in the future.
//
// Records loaded from the API (edit mode) arrive as ISO strings, not JS Date
// instances — z.date() rejects a string outright with "invalid_type_error"
// even when it's a perfectly valid date, which is why re-saving a record
// without touching its date fields used to fail validation ("Enter a valid
// start/end date"). Preprocessing normalizes any string/number/Date into a
// real Date before the z.date() check runs, so unchanged values round-trip
// correctly while genuinely invalid input still fails validation.
const toDateInput = (v) => {
  if (v === '' || v === null || v === undefined) return undefined;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d;
};

// NOTE: these two intentionally use .refine(), not .max()/.min(). Zod
// evaluates a .max(new Date(), ...) / .min(new Date(), ...) bound ONCE, at
// the moment this module's top-level code runs (i.e. page load) — not fresh
// on every validation. In a long-lived SPA tab that timestamp goes stale:
// minutes (or a midnight rollover) after load, "now" moves past that frozen
// bound, and a genuinely-today date (e.g. invoiceDate defaulted to
// `new Date()` when a form opens) gets rejected as "in the future"/"in the
// past" even though it isn't. A .refine() callback runs at parse time, so
// `new Date()` inside it is always current.
export const pastOrTodayDate = (label = 'Date') =>
  z.preprocess(
    toDateInput,
    z
      .date({ required_error: `${label} is required`, invalid_type_error: `Enter a valid ${label.toLowerCase()}` })
      .refine((d) => d <= new Date(), `${label} cannot be in the future`)
  );

export const futureOrTodayDate = (label = 'Date') =>
  z.preprocess(
    toDateInput,
    z
      .date({ required_error: `${label} is required`, invalid_type_error: `Enter a valid ${label.toLowerCase()}` })
      .refine((d) => d >= new Date(new Date().setHours(0, 0, 0, 0)), `${label} cannot be in the past`)
  );

export const anyDate = (label = 'Date') =>
  z.preprocess(
    toDateInput,
    z.date({ required_error: `${label} is required`, invalid_type_error: `Enter a valid ${label.toLowerCase()}` })
  );

// Optional date variant — several pages (HouseBank, SalesEmployee, and the
// ad-hoc optionalDate() in salesSchemas.js) rolled their own version of this
// as `z.preprocess((v) => (v ? v : undefined), z.date().optional())`, which
// passes strings straight through instead of converting them. That's exactly
// the same "Expected date, received string" bug as anyDate() had: editing an
// existing record loads the date as an ISO string, and saving without
// touching the field fails validation. Reuse toDateInput here too.
export const optionalDate = (label = 'Date') =>
  z.preprocess(toDateInput, z.date({ invalid_type_error: `Enter a valid ${label.toLowerCase()}` }).optional());

// Cross-field date-range check: not itself a schema, but a factory that
// returns a (data, ctx) callback for z.object(...).superRefine(...). The
// existing cross-field checks in this codebase (see e.g.
// financialYearSchema in companySchemas.js) are written as one-off
// `.refine((d) => new Date(d.endDate) > new Date(d.startDate), {...})`
// calls per schema — this generalizes that same idea into a reusable
// builder so schema files don't each re-derive the "end before start"
// comparison and path/message wiring by hand. By the time superRefine runs,
// the object's own field schemas (anyDate()/optionalDate()/etc., all
// preprocessed via toDateInput above) have already converted valid date
// values to real Date instances, so this only has to guard against either
// side being absent (an optional/unset date) rather than re-parsing itself.
//
// Usage: z.object({ startDate: anyDate('Start date'), endDate: optionalDate('End date') })
//   .superRefine(dateRange('startDate', 'endDate', { startLabel: 'Start date', endLabel: 'End date' }))
// Compose more than one check on the same object by wrapping them:
//   .superRefine((data, ctx) => {
//     dateRange('startDate', 'endDate', { endLabel: 'End date' })(data, ctx);
//     dateRange('effectiveFrom', 'effectiveTo')(data, ctx);
//   })
// Reduces a Date to "its calendar day", ignoring time-of-day, so two Date
// objects that display as the same day never compare unequal just because
// one carries a time component the other doesn't.
//
// This matters because the two sides of a date-range check are almost never
// built the same way: a header date field is typically `new Date()` (the
// current instant, whatever time it is right now), while a derived field
// like Due Date is typically built at UTC-midnight of the target calendar
// day (see e.g. SalesInvoice.jsx's payment-terms auto-fill effect:
// `new Date(Date.UTC(due.year(), due.month(), due.date()))`). In any
// timezone ahead of UTC (India included, UTC+5:30), UTC-midnight of "today"
// reads back as today's date via the LOCAL getters used here — but compared
// as raw instants against "right now", it is an earlier moment than any time
// after 05:30 local, which made Payment Terms = Immediate (Due Date = same
// day as Invoice Date) fail as "Due date cannot be before invoice date" for
// every invoice raised after 5:30 AM IST — the overwhelming majority of
// them. Comparing calendar days instead of instants fixes it for every
// caller of dateRange(), not just this one payment-terms effect.
const toCalendarDay = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

export const dateRange = (startField, endField, { allowEqual = true, startLabel, endLabel } = {}) => (data, ctx) => {
  const start = data?.[startField];
  const end = data?.[endField];
  if (!(start instanceof Date) || !(end instanceof Date)) return;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;

  const startDay = toCalendarDay(start);
  const endDay = toCalendarDay(end);
  const isInvalid = allowEqual ? endDay < startDay : endDay <= startDay;
  if (isInvalid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${endLabel || endField} cannot be before ${startLabel || startField}`,
      path: [endField],
    });
  }
};

// Machine No. (machineSerialNo) is only meaningful on a document whose
// Sales Category is Parts/Services/Claims — every sales schema below
// already blanks it out on screen the moment the category becomes
// "Machine" (see SalesInvoice.jsx's own salesCategory effect). The field
// itself is declared with optionalString() so a Machine document (where
// it's legitimately blank) can save at all; this is what actually
// enforces it back on a Parts/Services/Claims document, the same way a
// plain requiredString() would have, but only then. `categoryField`
// defaults to 'salesCategory' and `machineField` to 'machineSerialNo' so
// every sales schema can reuse this with no arguments; both are
// overridable in case a future document names either field differently.
// `exemptCategories` defaults to Machine/Claims (see above) — Sales
// Invoice additionally exempts 'Services' (see salesInvoiceSchema), since
// a service line isn't necessarily billed against one specific machine.
export const requireMachineSerialNoWhenMachine = (
  {
    categoryField = 'salesCategory', machineField = 'machineSerialNo', exemptCategories = ['Machine', 'Claims'],
  } = {}
) => (data, ctx) => {
  if (exemptCategories.includes(data?.[categoryField])) return;
  const value = data?.[machineField];
  if (value != null && String(value).trim() !== '') return;
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: 'Machine serial no. is required',
    path: [machineField],
  });
};

// Sales Type / Sales Return Type "Claims" and "Services" describe a document
// that never actually moves physical stock — a warranty claim being billed,
// or a service charge, not a parts movement. Exported so the schema layer
// (skip the per-line Warehouse requirement below) and the page layer (hide
// the Warehouse column entirely, skip the stock/over-consumption checks)
// agree on exactly which categories this applies to, in one place.
export const NON_STOCK_SALES_CATEGORIES = ['Claims', 'Services'];
export const isNonStockSalesCategory = (salesCategory) => NON_STOCK_SALES_CATEGORIES.includes(salesCategory);

// Requires every line's own Warehouse field — same as a plain
// requiredString('Warehouse') on the item schema would — except when the
// document's salesCategory is Claims or Services (see
// isNonStockSalesCategory above): those documents never move stock, so there
// is nothing for a line's Warehouse to name, and the field is hidden
// entirely on the page (see e.g. SalesOrder.jsx). The item schema itself
// declares `warehouse` as optionalString() so it never blocks Save on its
// own; this is what actually enforces it back on a Parts/Machine document,
// the same "conditional cross-field requirement via superRefine" idiom as
// requireMachineSerialNoWhenMachine just above.
export const requireWarehouseUnlessNonStockCategory = (
  { itemsField = 'items', warehouseField = 'warehouse', categoryField = 'salesCategory' } = {}
) => (data, ctx) => {
  if (isNonStockSalesCategory(data?.[categoryField])) return;
  const items = data?.[itemsField];
  if (!Array.isArray(items)) return;
  items.forEach((item, index) => {
    const value = item?.[warehouseField];
    if (value != null && String(value).trim() !== '') return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Warehouse is required',
      path: [itemsField, index, warehouseField],
    });
  });
};

// Narrower Claims-only counterpart of requireWarehouseUnlessNonStockCategory
// above, kept only for Sales Quotation — a quotation is never given a
// Services sales category in this app's flow, and Sales Quotation was
// explicitly kept out of scope for the broader Claims/Services warehouse
// rule (see requireWarehouseUnlessNonStockCategory's own comment). Every
// other document that used to call this now calls
// requireWarehouseUnlessNonStockCategory instead.
export const requireLineWarehouseUnlessClaims = (
  { categoryField = 'salesCategory', itemsField = 'items', warehouseField = 'warehouse' } = {}
) => (data, ctx) => {
  if (data?.[categoryField] === 'Claims') return;
  const items = data?.[itemsField];
  if (!Array.isArray(items)) return;
  items.forEach((item, index) => {
    const value = item?.[warehouseField];
    if (value != null && String(value).trim() !== '') return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Warehouse is required',
      path: [itemsField, index, warehouseField],
    });
  });
};

export const uniqueItemCodes = (itemsField = 'items', codeField = 'productCode', { label = 'Item' } = {}) => (data, ctx) => {
  const items = data?.[itemsField];
  if (!Array.isArray(items)) return;
  const seen = new Map();
  items.forEach((item, index) => {
    const raw = item?.[codeField];
    if (!raw) return;
    const code = String(raw).trim().toUpperCase();
    if (!code) return;

    if (seen.has(code)) {
      const firstIndex = seen.get(code);
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${label} code must be unique (also used in item #${firstIndex + 1}). Each item can only be added once.`,
        path: [itemsField, index, codeField],
      });
    } else {
      seen.set(code, index);
    }
  });
};

// Numbers/currency: no negative values (prices, quantities, balances, etc.)
//
// Same root cause as the date fields above: records loaded for editing come
// back from the API with numeric/decimal columns serialized as strings (e.g.
// Prisma Decimal -> "18.00"), so z.number() rejected them outright and
// re-saving a record without retyping the field failed with "X must be a
// number" — while deleting and retyping worked because FormTextField's
// type="number" onChange runs the value through Number() first. Preprocess
// numeric strings into real numbers before the check runs, so both paths work.
const toNumberInput = (v) => {
  if (v === '' || v === null || v === undefined) return undefined;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isNaN(n) ? v : n;
};

export const nonNegativeNumber = (label = 'Value', max) => {
  let schema = z
    .number({ invalid_type_error: `${label} must be a number` })
    .min(0, `${label} cannot be negative`);
  if (max !== undefined) schema = schema.max(max, `${label} cannot exceed ${max}`);
  return z.preprocess(toNumberInput, schema);
};

export const positiveNumber = (label = 'Value', max) => {
  let schema = z
    .number({ invalid_type_error: `${label} must be a number` })
    .gt(0, `${label} must be greater than 0`);
  if (max !== undefined) schema = schema.max(max, `${label} cannot exceed ${max}`);
  return z.preprocess(toNumberInput, schema);
};

// Optional variants — same bug class as optionalDate() above. Call sites
// used to write `nonNegativeNumber('Discount').optional()`, which chains
// ZodOptional AROUND the preprocess step; ZodOptional only short-circuits for
// `undefined`, not the `''` that a cleared number FormTextField sends, so ''
// still flowed into preprocess (-> undefined) and then hit the inner
// *required* z.number(), silently blocking the whole form submit. These
// apply .optional() to the inner number schema before preprocess wraps it,
// which actually works.
export const optionalNonNegativeNumber = (label = 'Value', max) => {
  let schema = z
    .number({ invalid_type_error: `${label} must be a number` })
    .min(0, `${label} cannot be negative`);
  if (max !== undefined) schema = schema.max(max, `${label} cannot exceed ${max}`);
  return z.preprocess(toNumberInput, schema.optional());
};

// Signed optional number: negatives allowed (e.g. a Business Partner's
// Account Balance, which is negative when the partner is in credit / we owe
// them). Same ''-to-undefined handling as optionalNonNegativeNumber above.
export const optionalSignedNumber = (label = 'Value', max) => {
  let schema = z.number({ invalid_type_error: `${label} must be a number` });
  if (max !== undefined) schema = schema.max(max, `${label} cannot exceed ${max}`).min(-max, `${label} cannot be below -${max}`);
  return z.preprocess(toNumberInput, schema.optional());
};

export const optionalPositiveNumber = (label = 'Value', max) => {
  let schema = z
    .number({ invalid_type_error: `${label} must be a number` })
    .gt(0, `${label} must be greater than 0`);
  if (max !== undefined) schema = schema.max(max, `${label} cannot exceed ${max}`);
  return z.preprocess(toNumberInput, schema.optional());
};

// Currency amount: non-negative, up to 2 decimal places, sensible max (999,999,999.99)
export const currencyAmount = (label = 'Amount') =>
  nonNegativeNumber(label, 999999999.99);

export const optionalCurrencyAmount = (label = 'Amount') =>
  optionalNonNegativeNumber(label, 999999999.99);

// Quantity: non-negative integer/decimal depending on UOM, sensible max
export const quantity = (label = 'Quantity') =>
  nonNegativeNumber(label, 999999999);

export const optionalQuantity = (label = 'Quantity') =>
  optionalNonNegativeNumber(label, 999999999);

export const percentage = (label = 'Percentage') =>
  nonNegativeNumber(label, 100);

export const optionalPercentage = (label = 'Percentage') =>
  optionalNonNegativeNumber(label, 100);

// Indian PIN code: exactly 6 digits, numeric only.
export const pincode = (label = 'Pincode') =>
  z.preprocess(toStringInput, z.string().trim().regex(/^\d{6}$/, `${label} must be exactly 6 digits`).optional().or(z.literal('')));

// Same as pincode() above but required — for forms (e.g. Branch) where the
// zipcode field is mandatory.
export const requiredPincode = (label = 'Pincode') =>
  z.preprocess(
    toStringInput,
    z
      .string({ required_error: `${label} is required` })
      .trim()
      .min(1, `${label} is required`)
      .regex(/^\d{6}$/, `${label} must be exactly 6 digits`)
  );

// Zipcode: country-agnostic postal code. Unlike pincode() above, this isn't
// locked to the 6-digit Indian format — used on forms (e.g. Branch) that
// have a Country selector and so need to accept addresses outside India.
export const zipcode = (label = 'Zipcode') =>
  z.preprocess(
    toStringInput,
    z
      .string({ required_error: `${label} is required` })
      .trim()
      .min(1, `${label} is required`)
      .max(20, `${label} cannot exceed 20 characters`)
      .regex(/^[A-Za-z0-9\s-]+$/, `Enter a valid ${label}`)
  );

export const optionalZipcode = (label = 'Zipcode') =>
  z.preprocess(
    toStringInput,
    z.string().trim().max(20, `${label} cannot exceed 20 characters`).regex(/^[A-Za-z0-9\s-]*$/, `Enter a valid ${label}`).optional().or(z.literal(''))
  );

// GSTIN: 15-character Indian GST identification number.
export const gstin = (label = 'GSTIN') =>
  z.preprocess(
    toStringInput,
    z.string().trim().toUpperCase().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z][A-Z0-9]$/, `Enter a valid ${label}`).optional().or(z.literal(''))
  );

// PAN: 10-character Indian Permanent Account Number.
export const panNumber = (label = 'PAN') =>
  z.preprocess(
    toStringInput,
    z.string().trim().toUpperCase().regex(/^[A-Z]{5}\d{4}[A-Z]$/, `Enter a valid ${label}`).optional().or(z.literal(''))
  );

// Aadhaar: 12 digits, numeric only. The first digit is never 0 or 1 under
// UIDAI's numbering scheme, so [2-9] on the leading digit catches an
// obviously-wrong or randomly-typed 12-digit string without needing the
// actual Verhoeff checksum (which needs the real algorithm, not a regex, and
// isn't worth the complexity for a client-side format check).
export const aadhaarNumber = (label = 'Aadhaar number') =>
  z.preprocess(
    toStringInput,
    z.string().trim().regex(/^[2-9]\d{11}$/, `${label} must be exactly 12 digits`).optional().or(z.literal(''))
  );

// Bank account number: digits only, 9-18 characters — the range that
// covers Indian bank account numbers in practice (there's no single
// national standard length the way PAN/Aadhaar have one, so this is a
// sanity-check range rather than a strict spec; widen it if a bank with
// out-of-range account numbers turns up). Spaces are commonly used to group
// digits when copy-pasting from a passbook/cheque, so they're stripped
// before the digit check — same "mutate the stored value" approach as
// stripMobilePrefix()/stripPhoneSeparators() above.
const stripSpaces = (v) => (typeof v === 'string' ? v.replace(/\s+/g, '') : v);

export const accountNumber = (label = 'Account number') =>
  z.preprocess(
    toStringInput,
    z
      .string({ required_error: `${label} is required` })
      .trim()
      .transform(stripSpaces)
      .refine((v) => /^\d{9,18}$/.test(v), `${label} must be 9-18 digits`)
  );

export const optionalAccountNumber = (label = 'Account number') =>
  z.preprocess(
    toStringInput,
    z
      .string()
      .trim()
      .transform(stripSpaces)
      .refine((v) => v === '' || /^\d{9,18}$/.test(v), `${label} must be 9-18 digits`)
      .optional()
      .or(z.literal(''))
  );

// IFSC: 11-character Indian bank branch code — 4 letters (bank code), a
// literal '0' (reserved for future use), then 6 alphanumeric characters
// (branch code). Same .toUpperCase() stored-transform as gstin()/
// panNumber() above, since IFSC codes are conventionally written upper-case.
export const ifscCode = (label = 'IFSC code') =>
  z.preprocess(
    toStringInput,
    z
      .string({ required_error: `${label} is required` })
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, `Enter a valid ${label} (e.g. SBIN0001234)`)
  );

export const optionalIfscCode = (label = 'IFSC code') =>
  z.preprocess(
    toStringInput,
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, `Enter a valid ${label} (e.g. SBIN0001234)`)
      .optional()
      .or(z.literal(''))
  );

// HSN (goods) / SAC (services) code: 4, 6 or 8 digits, numeric only — the
// widths GST actually issues (SAC codes are also numeric, conventionally
// 6 digits starting with 99, but still just digits as far as format goes).
//
// Real-world codes are frequently written in the dotted customs-tariff
// style ("4012.90.90" for an 8-digit code) rather than as a bare digit
// string — copy-pasted from a supplier invoice/BOE, typed with the
// separators people are used to, or (historically) saved that way before
// this field was locked down to a strict digits-only check. Left
// unstripped, a code like that fails the 4/6/8-digit rule outright even
// though "4012.90.90" and "40129090" are the same code — and because
// Product Master's own HSN field re-shows whatever is already stored, a
// product saved with a dotted code re-triggers this same "must be 4, 6 or 8
// digits" error every time it's picked on a Purchase/Sales document, not
// just once. Stripping the punctuation before validating (same
// "mutate the stored value" approach as stripMobilePrefix()/stripSpaces()
// above) fixes both: the code normalizes to digits-only wherever it's typed
// or copied from, instead of merely being rejected.
const stripHsnSeparators = (v) => (typeof v === 'string' ? v.replace(/[.\s-]/g, '') : v);

export const hsnCode = (label = 'HSN/SAC code') =>
  z.preprocess(
    toStringInput,
    z
      .string()
      .trim()
      .transform(stripHsnSeparators)
      .refine((v) => v === '' || /^\d{4}(\d{2}(\d{2})?)?$/.test(v), `${label} must be 4, 6 or 8 digits`)
      .optional()
      .or(z.literal(''))
  );

// Same 4/6/8-digit format as hsnCode() above but required — for HSN Master
// rows, where a blank code is not a usable master record (unlike Product
// Master, where an existing saved product may simply have no HSN yet).
export const hsnCodeRequired = (label = 'HSN/SAC code') =>
  z.preprocess(
    toStringInput,
    z
      .string({ required_error: `${label} is required` })
      .trim()
      .min(1, `${label} is required`)
      .transform(stripHsnSeparators)
      .refine((v) => /^\d{4}(\d{2}(\d{2})?)?$/.test(v), `${label} must be 4, 6 or 8 digits`)
  );

export const statusEnum = () => z.enum(['Active', 'Inactive']);

// --- Document relationship ("Copy From") ------------------------------------
// The four SAP-style base fields every sales and purchase LINE carries: which
// document, and which line of it, this line was copied from. See the
// 20260820120000_add_base_document_fields migration for the column semantics.
//
// They must appear in every line schema even though the user never types
// them: zod strips keys it does not know about, so a line schema without
// these would silently drop them between the form and the request body, and
// the copy link would never reach the database.
//
// All four are optional and nullable — a line typed in by hand has no base
// document, and that absence is the thing that distinguishes it from a copied
// one, so it is represented rather than defaulted away.
export const baseDocumentFields = () => ({
  baseType: z.union([z.string(), z.null()]).optional(),
  baseEntry: z.union([z.number(), z.null()]).optional(),
  baseNo: z.union([z.string(), z.null()]).optional(),
  baseLine: z.union([z.number(), z.null()]).optional(),
});

// Freight Charges — the six header fields the FreightChargesEditor popup
// reads/writes, shared by every Sales document schema (Quotation, Order,
// Invoice, Return, Credit Memo). freightTransportId/freightTaxCodeId are
// nullable FK-by-id (same optional-preprocess-to-null idiom as
// salesSchemas.js's optionalTaxCodeId — an empty Autocomplete emits null,
// which must stay null rather than being coerced to ''). freightGrossAmount
// is declared here purely so it survives zod's strip-unknown-fields pass on
// submit; the server always recomputes it from freightNetAmount +
// freightTaxAmount and ignores whatever the client sends (see
// PROTECTED_HEADER_FIELDS in backend/src/routes/resources.js) — declaring it
// here only keeps the totals panel's own live preview correct pre-save.
export const freightFields = () => ({
  freightTransportId: z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z.number({ invalid_type_error: 'Transporter is invalid' }).int().positive().nullable().optional()
  ),
  freightName: optionalString(),
  freightRemarks: optionalString(),
  freightTaxCodeId: z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z.number({ invalid_type_error: 'Tax code is invalid' }).int().positive().nullable().optional()
  ),
  freightTaxAmount: optionalNonNegativeNumber('Freight tax amount'),
  freightNetAmount: optionalNonNegativeNumber('Freight net amount'),
  freightGrossAmount: optionalNonNegativeNumber('Freight gross amount'),
});
