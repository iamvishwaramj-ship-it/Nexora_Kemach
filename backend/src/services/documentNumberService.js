/**
 * Document Numbering engine — SAP Business One-style numbering series.
 *
 * Responsibilities, in order of importance:
 *
 *   1. Assemble a document number from a series definition (pure, testable).
 *   2. Hand out the next number *atomically*, so two concurrent posts can
 *      never receive the same number.
 *   3. Refuse to hand out a number when the series is exhausted, inactive or
 *      missing — SAP hard-blocks posting in these cases and so do we, because
 *      silently inventing a number is how you end up with duplicate invoice
 *      numbers in a statutory register.
 *
 * The pure helpers at the top have no Prisma dependency on purpose — they are
 * exercised directly by scripts/testDocumentNumbering.js.
 *
 * ---------------------------------------------------------------------------
 * Wiring a transaction route to this service
 * ---------------------------------------------------------------------------
 * Allocate *inside* the save transaction and pass `tx`, so a document that
 * fails to save also rolls back the number it burned — otherwise a validation
 * error downstream leaves a permanent gap in the sequence:
 *
 *   const { allocateDocumentNumber } = require('../services/documentNumberService');
 *
 *   router.post('/purchase/orders', auth(), asyncHandler(async (req, res) => {
 *     const row = await prisma.$transaction(async (tx) => {
 *       const { documentNumber } = await allocateDocumentNumber('PO', { tx });
 *       return tx.purchaseOrder.create({ data: { ...req.body, poNo: documentNumber } });
 *     });
 *     res.status(201).json({ success: true, data: row });
 *   }));
 *
 * Every failure mode throws a DocumentNumberError carrying an HTTP status,
 * which middleware/errorHandler.js turns into a clean 4xx — no try/catch
 * needed in the route.
 *
 * If the series allows Manual Entry and the user supplied a number, validate
 * it with validateManualNumber() and then call syncAfterManualNumber() so the
 * counter never hands out a number a user already typed.
 */

// Prisma is required lazily so the pure formatting/validation half of this
// module can be loaded (and unit-tested) without a database connection or a
// platform-matched query engine. Every persistence function below calls
// db() rather than closing over a module-level client.
let _prisma = null;
function db() {
  if (!_prisma) _prisma = require('../prisma/client');
  return _prisma;
}

// ---------------------------------------------------------------------------
// Document catalog — the master list of numberable document types.
//
// `code` is the stable machine key stored on the series and used by transaction
// routes; it never changes. `name` is the label, `prefix` the suggested default.
// Keep this in sync with the transaction modules that actually exist in the app.
// ---------------------------------------------------------------------------
// `scope` decides whether a document type's numbering is tied to a financial
// year:
//
//   'transaction' — one series per financial year. Sequences restart each year
//                   and the year token can appear in the number, which is what
//                   an auditor expects of an invoice or a voucher.
//
//   'master'      — one perpetual series, no financial year at all. A customer
//                   code, a product code or a branch code identifies a record
//                   for as long as it exists; resetting the counter each April
//                   would hand out a code that already belongs to somebody
//                   else, and every one of these columns is UNIQUE, so the
//                   second issue would simply fail. Master series therefore
//                   carry financialYearId = NULL, never include the FY token,
//                   and never reset.
const DOCUMENT_CATALOG = [
  // --- Transactions: numbered per financial year ---------------------------
  { code: 'ENQ', name: 'Enquiry',            prefix: 'ENQ', module: 'Sales',       scope: 'transaction' },
  { code: 'PQ',  name: 'Purchase Quotation', prefix: 'PQ',  module: 'Purchase',    scope: 'transaction' },
  { code: 'PO',  name: 'Purchase Order',     prefix: 'PO',  module: 'Purchase',    scope: 'transaction' },
  { code: 'GRN', name: 'Purchase GRN',       prefix: 'GRN', module: 'Purchase',    scope: 'transaction' },
  { code: 'PI',  name: 'Purchase Invoice',   prefix: 'PI',  module: 'Purchase',    scope: 'transaction' },
  { code: 'PRT', name: 'Purchase Return',    prefix: 'PRT', module: 'Purchase',    scope: 'transaction' },
  { code: 'PCM', name: 'Purchase Credit Memo', prefix: 'PCM', module: 'Purchase', scope: 'transaction' },
  { code: 'SQ',  name: 'Sales Quotation',    prefix: 'SQ',  module: 'Sales',       scope: 'transaction' },
  { code: 'SO',  name: 'Sales Order',        prefix: 'SO',  module: 'Sales',       scope: 'transaction' },
  { code: 'DC',  name: 'Delivery Challan',   prefix: 'DC',  module: 'Sales',       scope: 'transaction' },
  { code: 'SI',  name: 'Sales Invoice',      prefix: 'SI',  module: 'Sales',       scope: 'transaction' },
  { code: 'SCM', name: 'Sales Credit Memo',  prefix: 'SCM', module: 'Sales',       scope: 'transaction' },
  { code: 'SRT', name: 'Sales Return',       prefix: 'SRT', module: 'Sales',       scope: 'transaction' },
  { code: 'SRC', name: 'Stock Receipt',      prefix: 'SRC', module: 'Inventory',   scope: 'transaction' },
  { code: 'SIG', name: 'Stock Issue',        prefix: 'SIG', module: 'Inventory',   scope: 'transaction' },
  { code: 'ADJ', name: 'Stock Adjustment',   prefix: 'ADJ', module: 'Inventory',   scope: 'transaction' },
  { code: 'MT',  name: 'Material Transfer',  prefix: 'MT',  module: 'Inventory',   scope: 'transaction' },
  { code: 'MR',  name: 'Stock Transfer Request', prefix: 'MR', module: 'Inventory', scope: 'transaction' },
  { code: 'MC',  name: 'Stock Transfer Receipt', prefix: 'MC', module: 'Inventory', scope: 'transaction' },
  { code: 'RV',  name: 'Receipt Voucher',    prefix: 'RV',  module: 'Receivables', scope: 'transaction' },
  { code: 'PV',  name: 'Payment Voucher',    prefix: 'PV',  module: 'Payables',    scope: 'transaction' },
  { code: 'IP',  name: 'Payment Receipt',    prefix: 'IP',  module: 'Banking',     scope: 'transaction' },
  { code: 'OP',  name: 'Outgoing Payment (Payment Voucher)', prefix: 'OP', module: 'Banking', scope: 'transaction' },
  { code: 'DEP', name: 'Bank Deposit',       prefix: 'DEP', module: 'Banking',     scope: 'transaction' },
  { code: 'CHQ', name: 'Cheque',             prefix: 'CHQ', module: 'Banking',     scope: 'transaction' },
  { code: 'JE',  name: 'Journal Entry',      prefix: 'JE',  module: 'Accounting',  scope: 'transaction' },
  // Company Setup > BP Opening Balance — posts to the G/L (see
  // JOURNAL_SOURCE_TYPES.BP_OPENING_BALANCE in utils/glPosting.js), so it
  // needs a real per-financial-year series like every other posting
  // document, not a self-healed master series. An admin sets this up once
  // under Company Setup > Document Numbering before the page can save.
  //
  // Prefix must be letters/digits only (PREFIX_PATTERN below, mirrored by
  // documentNumberingSchema's own regex on the frontend) — every other
  // catalog entry follows this, and the visual "BP-OP" look still comes
  // through via the Separator field once it's combined as
  // BPOP-<FY>-<number>. A hyphen baked into the prefix itself fails both
  // validations silently (the Save button just never enables) until the
  // user happens to blur the Prefix field and see the red text.
  { code: 'BPOB', name: 'BP Opening Balance', prefix: 'BPOP', module: 'Company', scope: 'transaction' },
  // A manual Journal Entry's own "Origin No" (JournalEntry.jsx) — a second,
  // independent number from Journal Entry No, only ever allocated for a
  // hand-typed (Origin = Manual) entry. A system-generated entry has no
  // series number here at all: its "Origin No" is just its sourceDocNo
  // (the document that generated it) shown read-only, not drawn from this
  // series.
  { code: 'JEO', name: 'Journal Entry — Origin No', prefix: 'JEO', module: 'Accounting', scope: 'transaction' },
  // Production Planning > Production Execution — Phase A manufacturing
  // foundation (schema.prisma's ProductionOrder.orderNo). Per-financial-year
  // like every other transaction document; an admin sets up its series under
  // Company Setup > Document Numbering before the first Production Order can
  // be created (see routes/productionOrders.js).
  { code: 'PRO', name: 'Production Order',   prefix: 'PRO',  module: 'Production',  scope: 'transaction' },

  // --- Masters: one perpetual series each ----------------------------------
  // `hiddenFromNumberingUI: true` keeps these out of the Document
  // Numbering screen (the document-type dropdown on Add/Edit and, via the
  // same flag, anywhere else the catalog is rendered for configuration) —
  // there's nothing for an admin to usefully set here beyond what "Reset to
  // Default"/the seed already configured. The catalog entry itself, and the
  // series rows it resolves to, are untouched: CATALOG_BY_CODE still resolves
  // these codes, so DocumentNoField's peek/allocate on the Branch, Tax Code,
  // Sales Employee, Account Group, Account Type, Chart Of Accounts, Product
  // Group, Product Sub Group, Brand, Unit of Measure, Product Master,
  // Transport Master, Warehouse Master, Location Master and Bank Details
  // pages keeps auto-generating codes exactly as before.
  { code: 'BRN', name: 'Branch',            prefix: 'BRN',  module: 'Company',        scope: 'master', hiddenFromNumberingUI: true },
  { code: 'TAX', name: 'Tax Code',          prefix: 'TAX',  module: 'Company',        scope: 'master', hiddenFromNumberingUI: true },
  { code: 'EMP', name: 'Sales Employee',    prefix: 'EMP',  module: 'Company',        scope: 'master', hiddenFromNumberingUI: true },
  { code: 'AG',  name: 'Account Group',     prefix: 'AG',   module: 'Accounting',     scope: 'master', hiddenFromNumberingUI: true },
  { code: 'ATY', name: 'Account Type',      prefix: 'ATY',  module: 'Accounting',     scope: 'master', hiddenFromNumberingUI: true },
  { code: 'COA', name: 'Chart Of Accounts', prefix: 'COA',  module: 'Accounting',     scope: 'master', hiddenFromNumberingUI: true },
  { code: 'PG',  name: 'Product Group',     prefix: 'PG',   module: 'Product',        scope: 'master', hiddenFromNumberingUI: true },
  { code: 'PSG', name: 'Product Sub Group', prefix: 'PSG',  module: 'Product',        scope: 'master', hiddenFromNumberingUI: true },
  { code: 'BRD', name: 'Brand',             prefix: 'BRD',  module: 'Product',        scope: 'master', hiddenFromNumberingUI: true },
  { code: 'UOM', name: 'Unit of Measure',   prefix: 'UOM',  module: 'Product',        scope: 'master', hiddenFromNumberingUI: true },
  { code: 'PRD', name: 'Product',           prefix: 'PRD',  module: 'Product',        scope: 'master', hiddenFromNumberingUI: true },
  // CUS/SUP retired along with Customer Master / Supplier Master — Business
  // Partner has its own self-contained C/S-prefixed numbering
  // (nextBusinessPartnerCode in routes/resources.js), never wired through
  // this generic document-numbering catalog, so there is nothing to rename
  // here to keep.
  { code: 'TRN', name: 'Transporter',       prefix: 'TRN',  module: 'Business Partner', scope: 'master', hiddenFromNumberingUI: true },
  { code: 'WH',  name: 'Warehouse',         prefix: 'WH',   module: 'Business Partner', scope: 'master', hiddenFromNumberingUI: true },
  { code: 'LOC', name: 'Location',          prefix: 'LOC',  module: 'Business Partner', scope: 'master', hiddenFromNumberingUI: true },
  // Bank Name never had a code column at all (unlike the masters above,
  // which already had a hand-typed one before switching to this engine) —
  // see the schema.prisma comment on BankName.bankCode and
  // scripts/backfillBankCode.js for the one-time catch-up on existing rows.
  { code: 'BNK', name: 'Bank Details',      prefix: 'BNK',  module: 'Banking',         scope: 'master', hiddenFromNumberingUI: true },
];

const CATALOG_BY_CODE = new Map(DOCUMENT_CATALOG.map((d) => [d.code, d]));

// documentCode -> { model, field } — the Prisma delegate name and column that
// holds each master's own hand-typed/legacy code, used only to backfill a
// self-healed series' counter (see the "no numbering series" branch of
// resolveSeries below) past whatever codes already exist in that table.
// Mirrors scripts/backfillNumberingCounters.js's SOURCES map, which covers
// the 17 transaction documents; this is the master-code half of the same
// problem.
const MASTER_TABLE_SOURCES = {
  BRN: { model: 'branch', field: 'branchCode' },
  TAX: { model: 'taxCode', field: 'taxCode' },
  EMP: { model: 'salesEmployee', field: 'employeeCode' },
  AG: { model: 'accountGroup', field: 'groupCode' },
  ATY: { model: 'accountType', field: 'typeCode' },
  COA: { model: 'chartOfAccount', field: 'accountCode' },
  PG: { model: 'productGroup', field: 'groupCode' },
  PSG: { model: 'productSubGroup', field: 'subGroupCode' },
  BRD: { model: 'brand', field: 'brandCode' },
  UOM: { model: 'uom', field: 'uomCode' },
  PRD: { model: 'product', field: 'productCode' },
  TRN: { model: 'transport', field: 'transporterCode' },
  WH: { model: 'warehouse', field: 'warehouseCode' },
  // Location codes are NOT drawn from a series — the Location Master page
  // computes a plain running integer, the same as Account Group. The entry
  // stays mapped to the surviving master so that if a LOC series is ever
  // enabled, its counter self-heals from the right table rather than the
  // retired one.
  LOC: { model: 'locationMaster', field: 'code' },
  BNK: { model: 'bankName', field: 'bankCode' },
};

// The transaction half of the same idea — the Prisma model and column that
// hold each transaction document's number string. Together with
// MASTER_TABLE_SOURCES above this covers all 31 catalog codes, which is what
// lets findLowestFreeNumber() below see which numbers are actually in use for
// any document type.
const TRANSACTION_TABLE_SOURCES = {
  ENQ: { model: 'enquiry', field: 'enquiryNo' },
  PQ: { model: 'purchaseQuotation', field: 'quotationNo' },
  PO: { model: 'purchaseOrder', field: 'poNo' },
  GRN: { model: 'goodsReceivedNote', field: 'grnNo' },
  PI: { model: 'purchaseInvoice', field: 'invoiceNo' },
  SQ: { model: 'salesQuotation', field: 'quotationNo' },
  SO: { model: 'salesOrder', field: 'orderNo' },
  DC: { model: 'deliveryChallan', field: 'challanNo' },
  SI: { model: 'salesInvoice', field: 'invoiceNo' },
  // Added alongside the Sales/Purchase series-selector rollout — these four
  // were missing from this map entirely, which silently disabled gap reuse
  // for them (findLowestFreeNumber only sees a document type once it has a
  // model/field entry here).
  PRT: { model: 'purchaseReturn', field: 'returnNo' },
  PCM: { model: 'purchaseCreditMemo', field: 'creditNo' },
  SCM: { model: 'salesCreditMemo', field: 'creditNo' },
  SRT: { model: 'salesReturn', field: 'returnNo' },
  SRC: { model: 'stockReceipt', field: 'receiptNo' },
  SIG: { model: 'stockIssue', field: 'issueNo' },
  ADJ: { model: 'stockAdjustment', field: 'adjustmentNo' },
  MT: { model: 'stockTransfer', field: 'transferNo' },
  RV: { model: 'collection', field: 'collectionNo' },
  PV: { model: 'supplierPayment', field: 'paymentNo' },
  IP: { model: 'paymentReceipt', field: 'paymentReceiptNo' },
  OP: { model: 'paymentVoucher', field: 'paymentVoucherNo' },
  DEP: { model: 'bankDeposit', field: 'depositNo' },
  CHQ: { model: 'cheque', field: 'chequeNo' },
  JE: { model: 'journalEntry', field: 'journalEntryNo' },
  JEO: { model: 'journalEntry', field: 'originNo' },
  BPOB: { model: 'businessPartnerOpeningBalance', field: 'documentNumber' },
  PRO: { model: 'productionOrder', field: 'orderNo' },
};

/** Every numberable document type's storage location, master or transaction. */
const DOCUMENT_TABLE_SOURCES = { ...MASTER_TABLE_SOURCES, ...TRANSACTION_TABLE_SOURCES };

/**
 * Numeric counter value behind a stored document-number string, for one
 * series' pattern. Ported from scripts/backfillNumberingCounters.js so the
 * live allocator and the backfill script read existing numbers identically.
 *
 * The exact-pattern match is what matters here: it only recognises numbers
 * this series itself would have produced. A number in some other format (hand
 * typed before the series existed, or issued by a different series with a
 * different prefix) falls through to the trailing-digits fallback, which is
 * deliberately loose — for gap-filling, over-recognising a number as "in use"
 * is the safe direction to err, since it only skips a candidate.
 */
const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Build the exact-match pattern a series' own numbers must fit, mirroring
 * buildDocumentNumber's segment layout: Prefix, then (FY code + running
 * number) with nothing between them, then Suffix — the series' Separator
 * appears only between those groups, never inside the FY-code-plus-number
 * group. Shared by extractSeriesValue and validateManualNumber so the two
 * "does this stored/typed string belong to this series" checks can never
 * drift apart from each other or from what buildDocumentNumber actually
 * produces.
 */
function buildSeriesPattern(series) {
  const sep = SEPARATOR_VALUES.includes(series.separator) ? series.separator : (series.separator || '');
  const groups = [];
  if (series.prefix) groups.push(escapeRegExp(series.prefix));
  const fyPart = (series.includeFyInNumber && series.fyCode) ? escapeRegExp(series.fyCode) : '';
  groups.push(`${fyPart}(\\d+)`);
  if (series.suffix) groups.push(escapeRegExp(series.suffix));
  return new RegExp(`^${groups.join(escapeRegExp(sep))}$`);
}

function extractSeriesValue(raw, series) {
  const value = String(raw ?? '').trim();
  if (!value) return null;

  const exact = value.match(buildSeriesPattern(series));
  if (exact) return Number(exact[1]);

  const trailing = value.match(/(\d+)(?!.*\d)/);
  return trailing ? Number(trailing[1]) : null;
}

/**
 * The lowest number in this series' range that no document currently holds,
 * or null when there is no gap below the counter.
 *
 * Deleting a document used to retire its number permanently: the counter only
 * ever moved forward, so deleting SQ-000004 and SQ-000005 out of five left the
 * next save taking SQ-000006 and those two numbers unusable forever. This
 * scans what is actually stored in the document's own table and returns the
 * first hole, so a deleted number goes back into circulation.
 *
 * Only the span below `nextNumber` is worth scanning — everything from
 * `nextNumber` up has never been issued, and the ordinary counter path
 * already covers it.
 *
 * MUST be called with the series row already locked (WITH (UPDLOCK, ROWLOCK), see
 * allocateDocumentNumber). Without that lock two concurrent saves would both
 * see the same hole free and both try to take it, and only one could win the
 * document column's UNIQUE constraint.
 */
async function findLowestFreeNumber(documentCode, series, client) {
  const source = DOCUMENT_TABLE_SOURCES[documentCode];
  if (!source || !client[source.model]?.findMany) return null;

  const ceiling = Math.min(Number(series.nextNumber), Number(series.endNumber) + 1);
  const floor = Number(series.startNumber);
  if (!Number.isFinite(ceiling) || !Number.isFinite(floor) || ceiling <= floor) return null;

  const rows = await client[source.model].findMany({ select: { [source.field]: true } });
  const used = new Set();
  for (const row of rows) {
    const n = extractSeriesValue(row[source.field], series);
    if (n !== null && Number.isFinite(n)) used.add(n);
  }

  for (let n = floor; n < ceiling; n += 1) {
    if (!used.has(n)) return n;
  }
  return null;
}

/**
 * Highest numeric run found in any existing code for this master, or 0 if
 * none/none parseable. Same "last run of digits" fallback as
 * backfillNumberingCounters.js's extractNumericValue — a self-healed series
 * has no pattern of its own yet to match exactly (it's being created right
 * now), so this only ever has the fallback to work with. Conservative by
 * construction: a code that doesn't parse is simply skipped, which can only
 * make the proposed start number too low, never too high — the create below
 * still can't collide with a numeric-looking existing code.
 */
async function highestExistingMasterNumber(documentCode, client) {
  const source = MASTER_TABLE_SOURCES[documentCode];
  if (!source || !client[source.model]?.findMany) return 0;
  const rows = await client[source.model].findMany({ select: { [source.field]: true } });
  let highest = 0;
  for (const row of rows) {
    const raw = String(row[source.field] ?? '');
    const match = raw.match(/(\d+)(?!.*\d)/);
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isFinite(n) && n > highest) highest = n;
  }
  return highest;
}

/** True when a document type's numbering is perpetual rather than per-year. */
const isMasterScope = (documentCode) => CATALOG_BY_CODE.get(documentCode)?.scope === 'master';

// Separator choices offered in the UI. '' means "no separator at all"
// (PO26270000126); every other value is inserted between each pattern segment.
const SEPARATORS = [
  { value: '-', label: '- (Hyphen)' },
  { value: '/', label: '/ (Slash)' },
  { value: '_', label: '_ (Underscore)' },
  { value: '.', label: '. (Dot)' },
  { value: '',  label: 'None' },
];
const SEPARATOR_VALUES = SEPARATORS.map((s) => s.value);

const MIN_NUMBER_LENGTH = 1;
const MAX_NUMBER_LENGTH = 12;
const NUMBER_LENGTH_OPTIONS = [3, 4, 5, 6, 7, 8, 10, 12];

// Smallest allowed gap between Start No. and End No. — e.g. Start 1 needs
// End at least 3 (1, 2, 3), never 1 or 2.
const MIN_SERIES_RANGE_GAP = 2;

// Fields that become read-only once a series has issued its first number.
// Changing any of them mid-sequence would make two documents from the same
// series unreconcilable, so the routes refuse the edit *and* skip writing
// these columns entirely on a consumed row.
const LOCKED_ONCE_CONSUMED = [
  'prefix', 'suffix', 'separator', 'numberLength',
  'includeFyInNumber', 'fyCode', 'financialYearId', 'documentCode',
];

// A prefix goes into a statutory document number, so keep it boring:
// letters, digits, a hyphen or a slash — no spaces, no other punctuation
// that could collide with the separator. A hyphen or slash embedded here is
// never ambiguous with the chosen Separator because buildDocumentNumber (and
// the parsers mirroring it below) always match the assembled number against
// an exact-built pattern rather than splitting it apart. SAP B1 caps
// prefixes at 8 characters; we allow 10.
const PREFIX_PATTERN = /^[A-Za-z0-9/-]{0,10}$/;

/**
 * Raised for every "you cannot have a number right now" condition. Carries an
 * HTTP status so route handlers can rethrow it straight to the error handler.
 */
class DocumentNumberError extends Error {
  constructor(message, { status = 409, code = 'NUMBERING_ERROR', details } = {}) {
    super(message);
    this.name = 'DocumentNumberError';
    this.status = status;
    this.statusCode = status;
    this.code = code;
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Turn a financial year record into the four-digit token used inside document
 * numbers ('2627'). Prefers the actual dates; falls back to parsing the name
 * so an FY entered as free text ("2026 - 2027", "FY2026-27") still works.
 *
 * Deliberately no separator baked in here (it used to return '26-27') — the
 * FY code sits directly against the running number in the assembled document
 * number (see buildDocumentNumber below), with the series' own Separator
 * appearing only between the Prefix and everything after it, e.g.
 * 'KEM/PO/26271999999' rather than 'KEM/PO/26-27/1999999'.
 */
function deriveFyCode(financialYear) {
  if (!financialYear) return null;

  const { startDate, endDate, financialYearName } = financialYear;
  if (startDate && endDate) {
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime())) {
      const two = (d) => String(d.getUTCFullYear() % 100).padStart(2, '0');
      return `${two(s)}${two(e)}`;
    }
  }

  if (financialYearName) {
    // Grab every year-looking token: 2026, 26, 2027, 27 ...
    const years = String(financialYearName).match(/\d{2,4}/g);
    if (years && years.length >= 2) {
      const two = (y) => String(Number(y) % 100).padStart(2, '0');
      return `${two(years[0])}${two(years[1])}`;
    }
    if (years && years.length === 1) {
      const start = Number(years[0]) % 100;
      return `${String(start).padStart(2, '0')}${String((start + 1) % 100).padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * Zero-pad a number to `length` digits. A number that has outgrown its padding
 * is rendered in full rather than truncated — losing digits would produce a
 * duplicate number, which is strictly worse than an inconsistent width. The
 * save-time validation prevents this from happening in practice by capping
 * endNumber at the largest value the padding can hold.
 */
function padNumber(value, length) {
  const n = Math.trunc(Number(value));
  const width = clampLength(length);
  const digits = Math.abs(n).toString();
  return (n < 0 ? '-' : '') + digits.padStart(width, '0');
}

function clampLength(length) {
  const n = Number(length);
  if (!Number.isFinite(n)) return 6;
  return Math.min(MAX_NUMBER_LENGTH, Math.max(MIN_NUMBER_LENGTH, Math.trunc(n)));
}

/** Largest number a given padding width can represent, e.g. 6 -> 999999. */
function maxValueForLength(length) {
  return 10 ** clampLength(length) - 1;
}

/**
 * Assemble a document number.
 *
 *   buildDocumentNumber({ prefix: 'KEM/PO', separator: '/', fyCode: '2627',
 *                         numberLength: 6 }, 126)  ->  'KEM/PO/2627000126'
 *
 * The Separator only ever appears once, between the Prefix and everything
 * after it — the FY code (when included) sits directly against the padded
 * number with nothing between them, and the Suffix (when present) gets its
 * own Separator on the far side. This used to also put the Separator between
 * the FY code and the number (producing e.g. 'KEM/PO/26-27/1999999'), which
 * read as two separate tokens rather than one continuous running number.
 * Empty segments are dropped rather than producing doubled separators, so a
 * series with no prefix and no FY yields a bare '000126'.
 */
function buildDocumentNumber(series, value) {
  const {
    prefix = '',
    suffix = '',
    separator = '-',
    fyCode = null,
    includeFyInNumber = true,
    numberLength = 6,
  } = series || {};

  const sep = SEPARATOR_VALUES.includes(separator) ? separator : '-';

  const segments = [];
  const cleanPrefix = String(prefix ?? '').trim();
  if (cleanPrefix) segments.push(cleanPrefix);

  const cleanFy = String(fyCode ?? '').trim();
  const fyPlusNumber = (includeFyInNumber && cleanFy)
    ? `${cleanFy}${padNumber(value, numberLength)}`
    : padNumber(value, numberLength);
  segments.push(fyPlusNumber);

  const cleanSuffix = String(suffix ?? '').trim();
  if (cleanSuffix) segments.push(cleanSuffix);

  return segments.join(sep);
}

/**
 * The number a series would issue next, without consuming it. Returns null
 * once the series is exhausted so callers can render '—' instead of a number
 * that will never exist.
 */
function peekNumber(series) {
  if (!series) return null;
  if (series.nextNumber > series.endNumber) return null;
  return buildDocumentNumber(series, series.nextNumber);
}

/** The last number the series actually issued, or null if it has issued none. */
function currentNumber(series) {
  if (!series || series.currentNumber === null || series.currentNumber === undefined) return null;
  return buildDocumentNumber(series, series.currentNumber);
}

/** True once the series has issued at least one number — the "locked" state. */
function isConsumed(series) {
  return Boolean(series) && series.currentNumber !== null && series.currentNumber !== undefined;
}

function remainingCapacity(series) {
  if (!series) return 0;
  return Math.max(0, series.endNumber - series.nextNumber + 1);
}

/**
 * The status to *display*. 'Completed' is not a stored value — it is what
 * Active means once the counter has run past End No. Deriving it rather than
 * storing it means it can never disagree with the counter, which a manually
 * maintained third status inevitably would.
 */
function displayStatus(series) {
  if (!series) return 'Inactive';
  if (series.nextNumber > series.endNumber) return 'Completed';
  return series.status === 'Active' ? 'Active' : 'Inactive';
}

/**
 * Do two series cover any of the same numbers? Ranges are inclusive on both
 * ends, so [1,999] and [999,2000] overlap at 999.
 */
function rangesOverlap(a, b) {
  return Number(a.startNumber) <= Number(b.endNumber) && Number(b.startNumber) <= Number(a.endNumber);
}

/**
 * Reject a series whose range collides with a sibling series of the same
 * document type, year AND number length. Two overlapping series that are
 * both live can hand out the same document number, which is the one failure
 * this whole module exists to prevent — so it is a hard error, not a
 * warning.
 *
 * Number length is part of the collision test, not just the document type
 * and range: a 5-digit series covering 40079-99999 and a 6-digit series
 * covering 1-999999 both include the integer 40079, but they never print
 * the same thing — the 5-digit series issues '40079', the 6-digit series
 * issues '040079'. Comparing raw integer ranges alone treated that as a
 * collision and made a document type's *first* series (however wide) block
 * every other digit width from ever being used again, which is what made
 * "let me add a smaller series" fail even though it could never actually
 * duplicate a number the wider series already produced.
 *
 * `siblings` should exclude the row being edited (pass its id as `ignoreId`).
 */
function findOverlappingSeries(candidate, siblings = [], { ignoreId = null } = {}) {
  return siblings.filter(
    (s) => s.id !== ignoreId
      && s.documentCode === candidate.documentCode
      && s.financialYearId === candidate.financialYearId
      && Number(s.numberLength) === Number(candidate.numberLength)
      && rangesOverlap(candidate, s)
  );
}

/**
 * First free block of `numberLength`-digit numbers that no sibling series of
 * that same width occupies, or null if every width-L number is taken (or the
 * remaining holes are smaller than MIN_SERIES_RANGE_GAP + 1 numbers).
 *
 * Ranges are inclusive. Series of other widths are ignored on purpose — see
 * findOverlappingSeries. Used to pre-fill Start/End for a new series so a hole
 * between two existing series (e.g. 1-526 and 40257-99999 leaves 527-40256)
 * is offered instead of a range that runs into the next series.
 */
function findFirstFreeRange(siblings = [], numberLength, { from = 1 } = {}) {
  const cap = maxValueForLength(numberLength);
  const sameWidth = siblings
    .filter((s) => Number(s.numberLength) === Number(numberLength))
    .map((s) => ({ start: Number(s.startNumber), end: Number(s.endNumber) }))
    .sort((a, b) => a.start - b.start);

  let cursor = from;
  for (const r of sameWidth) {
    if (r.start - 1 - cursor >= MIN_SERIES_RANGE_GAP) return { start: cursor, end: r.start - 1 };
    cursor = Math.max(cursor, r.end + 1);
  }
  if (cap - cursor >= MIN_SERIES_RANGE_GAP) return { start: cursor, end: cap };
  return null;
}

/**
 * Next free series name for a document type: 'Series 1', then 'Series 2',
 * 'Series 3', ... always starting from 1 and filling the first free ordinal
 * rather than always appending at the end, so deleting an early series (e.g.
 * "Series 2") lets the next one created reuse that number instead of jumping
 * straight to "Series 4".
 */
function suggestSeriesName(existingNames = []) {
  const taken = new Set(existingNames.map((n) => String(n || '').trim().toLowerCase()));
  for (let i = 1; i < 1000; i += 1) {
    const candidate = `Series ${i}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `Series ${Date.now()}`;
}

/**
 * Decorate a raw DB row with everything the UI needs to render a list row:
 * formatted current/next/preview strings and the derived state flags.
 */
function decorateSeries(row) {
  if (!row) return row;
  return {
    ...row,
    currentNumberFormatted: currentNumber(row),
    nextNumberFormatted: peekNumber(row),
    preview: peekNumber(row) || buildDocumentNumber(row, row.currentNumber ?? row.startNumber),
    isConsumed: isConsumed(row),
    isExhausted: row.nextNumber > row.endNumber,
    displayStatus: displayStatus(row),
    remaining: remainingCapacity(row),
    maxForLength: maxValueForLength(row.numberLength),
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Tail of the overlap error: when the typed Start No. itself sits in free
 * space (e.g. 527 with the next series starting at 40257), say how far End No.
 * can go instead of leaving the user to work it out from the table.
 */
function gapHint(siblings, numberLength, startNumber) {
  const sameWidth = siblings.filter((s) => Number(s.numberLength) === Number(numberLength));
  if (sameWidth.some((s) => Number(s.startNumber) <= startNumber && startNumber <= Number(s.endNumber))) return '';
  const next = sameWidth
    .map((s) => Number(s.startNumber))
    .filter((n) => n > startNumber)
    .sort((a, b) => a - b)[0];
  if (next === undefined || next - 1 - startNumber < MIN_SERIES_RANGE_GAP) return '';
  return ` Start No. ${startNumber} is free — set End No. to ${next - 1} or lower to fit before it.`;
}

/**
 * Validate a create/update payload. Returns an array of human-readable errors
 * — empty means valid.
 *
 * `existing` is the current DB row on an update, and is what drives the
 * "you can't change the pattern after numbers were issued" rules that mirror
 * SAP B1's locked series behaviour.
 *
 * `siblings` is every other series for the same document type and year, used
 * for the name-collision and range-overlap checks. Pass it on create and
 * update; omitting it just skips those two checks (the DB unique index still
 * catches duplicate names, but overlap has no DB-level equivalent).
 */
function validateSeriesPayload(payload, { existing = null, siblings = [] } = {}) {
  const errors = [];
  // Every message is tagged with the form field it belongs to, so the
  // frontend can show it under that exact input instead of only in a toast.
  // `field: null` means it isn't about one specific input.
  const addError = (field, message) => errors.push({ field, message });
  const merged = { ...(existing || {}), ...payload };

  const startNumber = Number(merged.startNumber);
  const endNumber = Number(merged.endNumber);
  const nextNumber = Number(merged.nextNumber ?? startNumber);
  const numberLength = Number(merged.numberLength);

  if (!merged.documentCode) addError('documentCode', 'Document name is required');
  else if (!CATALOG_BY_CODE.has(merged.documentCode)) addError('documentCode', `Unknown document type "${merged.documentCode}"`);

  // Master series (Branch, Tax Code, Product, UOM, ...) are perpetual and
  // legitimately carry financialYearId = NULL — see the 'master' scope doc
  // comment on DOCUMENT_CATALOG above. Requiring one unconditionally here
  // rejected every edit to a master series (including just flipping Auto
  // Generate/Manual Entry) with "Financial year is required", which is what
  // actually made Manual Entry look like it could never be turned on for
  // these document types.
  if (!isMasterScope(merged.documentCode) && !merged.financialYearId) {
    addError('financialYearId', 'Financial year is required');
  }

  if (merged.prefix && !PREFIX_PATTERN.test(String(merged.prefix))) {
    addError('prefix', 'Prefix must be 1-10 letters, digits, hyphens or slashes with no spaces or other symbols');
  }
  if (merged.suffix && !PREFIX_PATTERN.test(String(merged.suffix))) {
    addError('suffix', 'Suffix must be 1-10 letters, digits, hyphens or slashes with no spaces or other symbols');
  }
  if (merged.separator !== undefined && !SEPARATOR_VALUES.includes(merged.separator)) {
    addError('separator', 'Separator must be one of - / _ . or None');
  }

  if (!Number.isInteger(numberLength) || numberLength < MIN_NUMBER_LENGTH || numberLength > MAX_NUMBER_LENGTH) {
    addError('numberLength', `Number length must be between ${MIN_NUMBER_LENGTH} and ${MAX_NUMBER_LENGTH} digits`);
  }
  if (!Number.isInteger(startNumber) || startNumber < 0) {
    addError('startNumber', 'Start No. must be a whole number of 0 or more');
  }
  if (!Number.isInteger(endNumber) || endNumber < 0) {
    addError('endNumber', 'End No. must be a whole number of 0 or more');
  }
  if (Number.isInteger(startNumber) && Number.isInteger(endNumber) && endNumber < startNumber) {
    addError('endNumber', 'End No. must be greater than or equal to Start No.');
  }
  // The range needs room for at least 3 numbers (Start, Start+1, Start+2) —
  // a series that starts and ends within 1 of itself leaves no headroom to
  // actually number more than a document or two before it's exhausted.
  if (
    Number.isInteger(startNumber) && Number.isInteger(endNumber)
    && endNumber >= startNumber && endNumber - startNumber < MIN_SERIES_RANGE_GAP
  ) {
    addError('endNumber', `End No. must be at least ${startNumber + MIN_SERIES_RANGE_GAP} — the series needs a gap of at least ${MIN_SERIES_RANGE_GAP} between Start No. and End No.`);
  }

  // The padding width defines the addressable range: a 6-digit series cannot
  // reach 1,000,000 without silently changing width mid-sequence.
  if (Number.isInteger(numberLength) && Number.isInteger(endNumber)) {
    const cap = maxValueForLength(numberLength);
    if (endNumber > cap) {
      addError('endNumber', `End No. cannot exceed ${cap} for a ${numberLength}-digit series`);
    }
  }

  if (Number.isInteger(nextNumber) && Number.isInteger(startNumber) && Number.isInteger(endNumber)) {
    if (nextNumber < startNumber) addError('startNumber', 'Next No. cannot be lower than Start No.');
    if (nextNumber > endNumber + 1) addError('endNumber', 'Next No. cannot be beyond End No.');
  }

  // A series that neither auto-generates nor allows manual entry can never
  // produce a number — SAP disallows the same combination.
  if (merged.autoGenerate === false && merged.manualEntry === false) {
    addError('autoGenerate', 'Turn on Auto Generate or Manual Entry — a series with both off can never produce a number');
  }

  if (merged.status && !['Active', 'Inactive'].includes(merged.status)) {
    addError('status', 'Status must be Active or Inactive');
  }

  // --- Locked-series rules ---------------------------------------------------
  // Once a number has gone out the door, the pattern is history: changing it
  // would make two documents in the same series unreconcilable, and lowering
  // the range could re-issue a number that already exists.
  if (existing && isConsumed(existing)) {
    for (const field of LOCKED_ONCE_CONSUMED) {
      if (payload[field] === undefined) continue;
      // Compare canonically: prefix/suffix are stored upper-cased now, but
      // rows written before that (and clients echoing them back verbatim) can
      // differ only in case. Treating that as a change would make an old row
      // impossible to edit at all — you couldn't even set it Inactive.
      const canon = (v) => (field === 'prefix' || field === 'suffix'
        ? String(v ?? '').trim().toUpperCase()
        : String(v ?? ''));
      if (canon(payload[field]) !== canon(existing[field])) {
        addError(field, `"${field}" cannot be changed after this series has issued numbers (last issued ${currentNumber(existing)})`);
      }
    }
    if (payload.startNumber !== undefined && Number(payload.startNumber) !== existing.startNumber) {
      addError('startNumber', 'Start No. cannot be changed after this series has issued numbers');
    }
    if (payload.endNumber !== undefined && Number(payload.endNumber) < existing.currentNumber) {
      addError('endNumber', `End No. cannot be lowered below the last issued number (${existing.currentNumber})`);
    }
  }

  // --- Sibling-series rules --------------------------------------------------
  // A document type can have several series in a year, so two things have to
  // hold across the set: names must be distinguishable, and ranges must not
  // intersect. The name rule is also a DB unique index; the overlap rule has
  // no DB equivalent and is enforced only here, because it is the one way two
  // live series could hand out the same document number.
  const name = String(merged.seriesName ?? '').trim();
  if (!name) {
    addError('seriesName', 'Series name is required');
  } else if (name.length > 100) {
    addError('seriesName', 'Series name cannot exceed 100 characters');
  }

  if (siblings.length) {
    const ignoreId = existing?.id ?? null;
    const relatives = siblings.filter(
      (s) => s.id !== ignoreId
        && s.documentCode === merged.documentCode
        && Number(s.financialYearId) === Number(merged.financialYearId)
    );

    if (name && relatives.some((s) => String(s.seriesName).trim().toLowerCase() === name.toLowerCase())) {
      addError('seriesName', `A series named "${name}" already exists for this document type and financial year`);
    }

    if (Number.isInteger(startNumber) && Number.isInteger(endNumber) && endNumber >= startNumber) {
      const clashes = findOverlappingSeries(
        {
          documentCode: merged.documentCode,
          financialYearId: Number(merged.financialYearId),
          numberLength,
          startNumber,
          endNumber,
        },
        relatives.map((s) => ({ ...s, financialYearId: Number(s.financialYearId) })),
        { ignoreId }
      );
      for (const c of clashes) {
        addError(
          'startNumber',
          `Range ${startNumber}-${endNumber} overlaps series "${c.seriesName}" (${c.startNumber}-${c.endNumber}), `
          + `both ${numberLength}-digit. Overlapping same-length series can issue the same document number `
          + `twice — start this series above ${c.endNumber} or lower that one's End No.`
          + gapHint(relatives, numberLength, startNumber)
        );
      }
    }
  }

  return errors;
}

/**
 * Validate a hand-typed document number against its series. Used when
 * Manual Entry is on.
 *
 * This used to also enforce the series' own prefix/digit-pattern and
 * start/end range on the typed value — mirroring SAP B1, where "manual"
 * still means "pick a number from this series", not "type anything". That
 * silently blocked every save that didn't happen to type the exact pattern
 * back (e.g. Product Master's DocumentNoField leaves the field blank and
 * fully editable once Manual Entry is on — see that component's own
 * comment — so a real product code like "SHOE-RED-42" was rejected with
 * "Number must match the series pattern PRD-000001"). Manual Entry now means
 * exactly what the toggle says: any non-empty value the user typed is
 * accepted verbatim, for every document type this numbering engine serves
 * (masters and transactions alike) — uniqueness still falls out of the
 * underlying table's own unique constraint on that column, same as before.
 *
 * The series pattern is still TRIED against the typed value (via
 * extractSeriesValue, shared with the gap-filling scan above) purely so the
 * running counter can be kept in step when the typed value happens to look
 * like one of this series' own numbers (e.g. "PRD-000025" typed ahead of the
 * sequence) — see syncAfterManualNumber. A value that doesn't parse that way
 * just has nothing to sync; it is still saved exactly as typed.
 */
function validateManualNumber(series, documentNumber) {
  if (!series) return { valid: false, reason: 'No numbering series is configured for this document' };
  if (!series.manualEntry) return { valid: false, reason: 'Manual entry is turned off for this series' };

  const raw = String(documentNumber ?? '').trim();
  if (!raw) return { valid: false, reason: 'Document number is required' };

  return { valid: true, value: extractSeriesValue(raw, series), documentNumber: raw };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/** Currently open financial year, preferring Active, then the latest start date. */
async function getActiveFinancialYear(client = db()) {
  const today = new Date();
  const covering = await client.financialYear.findFirst({
    where: { status: 'Active', startDate: { lte: today }, endDate: { gte: today } },
    orderBy: { startDate: 'desc' },
  });
  if (covering) return covering;

  return client.financialYear.findFirst({
    where: { status: 'Active' },
    orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
  });
}

/**
 * Find the series that should number `documentCode` in the given FY (defaults
 * to the currently open FY).
 *
 * A document type may have several series in a year; the one flagged
 * isDefault is the one that issues numbers. That is a deliberate choice over
 * "first Active series with room left": it lets an admin stage next year's or
 * next block's series without it silently going live, and makes the switchover
 * an explicit, audited action.
 *
 * Throws rather than returning null — every caller treats "no usable series"
 * as a hard stop, so the decision lives here in one place. The error messages
 * name the specific remedy because they surface directly to the user posting
 * the document.
 */
async function resolveSeries(documentCode, { financialYearId = null, client = db(), requireActive = true, seriesId = null } = {}) {
  if (!CATALOG_BY_CODE.has(documentCode)) {
    throw new DocumentNumberError(`Unknown document type "${documentCode}"`, { status: 400, code: 'UNKNOWN_DOCUMENT' });
  }

  // Master codes are perpetual: they carry no financial year, so there is no
  // FY to resolve and no reason to require one to be configured. Looking one
  // up would also mean a master series had to be re-created every April, and
  // a customer code that restarts each year collides with the customers
  // already holding those codes.
  const master = isMasterScope(documentCode);

  let fyId = master ? null : financialYearId;
  if (!master && !fyId) {
    const fy = await getActiveFinancialYear(client);
    if (!fy) {
      throw new DocumentNumberError(
        'No active financial year is configured. Create one under Company Setup → Financial Year before posting documents.',
        { status: 409, code: 'NO_ACTIVE_FY' }
      );
    }
    fyId = fy.id;
  }

  const label = CATALOG_BY_CODE.get(documentCode).name;

  // An explicit seriesId (a user picking a specific, not-necessarily-default
  // series on a transaction form) names the exact row to use, so it is
  // validated on its own rather than located via the isDefault scan below.
  if (seriesId != null) {
    const series = await client.documentNumbering.findUnique({
      where: { id: Number(seriesId) },
      include: { financialYear: true },
    });
    if (!series || series.documentCode !== documentCode) {
      throw new DocumentNumberError(
        `The selected ${label} numbering series was not found.`,
        { status: 400, code: 'SERIES_NOT_FOUND', details: { seriesId } }
      );
    }
    // Master scope carries no FY; a transaction's chosen series must belong to
    // the FY actually being posted into — otherwise a stale series picked
    // before a year rollover could number a document into the wrong year's
    // sequence.
    if (!master && series.financialYearId !== fyId) {
      throw new DocumentNumberError(
        `"${series.seriesName}" does not belong to the current financial year.`,
        { status: 400, code: 'SERIES_WRONG_FY', details: { seriesId } }
      );
    }
    if (requireActive && series.status !== 'Active') {
      throw new DocumentNumberError(
        `"${series.seriesName}" is inactive — activate it before posting, or choose a different series.`,
        { status: 409, code: 'SERIES_INACTIVE', details: { seriesId: series.id } }
      );
    }
    if (series.nextNumber > series.endNumber) {
      throw new DocumentNumberError(
        `"${series.seriesName}" has reached its End No. (${series.endNumber}) — choose a different series.`,
        { status: 409, code: 'SERIES_EXHAUSTED', details: { seriesId: series.id, endNumber: series.endNumber } }
      );
    }
    return series;
  }

  let all = await client.documentNumbering.findMany({
    where: { documentCode, financialYearId: fyId },
    include: { financialYear: true },
    orderBy: { startNumber: 'asc' },
  });

  // Self-heal a missing master series instead of hard-blocking every master
  // page's auto-generate behind a manual "run this script" step. A master's
  // default series (Branch/Tax Code/Sales Employee/Product Group/Product Sub
  // Group/Brand/Unit of Measure/Product/Customer/Supplier/
  // Transporter) is fully described by its own DOCUMENT_CATALOG entry — there
  // is nothing about it an admin would need to choose — so if one is missing
  // (never seeded, migration ran on a DB created before it existed, or the
  // row was deleted some other way) it's created here on first use rather
  // than surfacing SERIES_NOT_FOUND to whoever happens to open that page
  // first. Transaction documents deliberately keep the hard stop below: a PO/
  // invoice/etc. series is genuinely a per-financial-year choice (prefix,
  // range, reset behaviour) that only a human should make.
  if (!all.length && master) {
    const def = CATALOG_BY_CODE.get(documentCode);
    // Don't just start a fresh series at 1 — this master's table may already
    // hold records (seeded demo data, or codes created back when the column
    // was a plain hand-typed UNIQUE field) whose codes look like this
    // series' own pattern, e.g. an existing "TAX-000001". Starting at 1
    // would immediately hand out that same code again and fail on the
    // column's UNIQUE constraint. nextNumber instead picks up one past the
    // highest number found in the table today.
    const highest = await highestExistingMasterNumber(documentCode, client);
    const nextNumber = highest + 1;
    // 999999 (6 digits) is the standard default range, but if the existing
    // data has already gone past that, extend the range up front rather than
    // create a series that's already exhausted.
    const endNumber = Math.max(999999, nextNumber + 999998);
    try {
      await client.documentNumbering.create({
        data: {
          documentCode: def.code,
          documentName: def.name,
          seriesName: 'Series 1',
          isDefault: true,
          financialYearId: null,
          fyCode: null,
          prefix: def.prefix,
          suffix: null,
          separator: '-',
          includeFyInNumber: false,
          numberLength: 6,
          startNumber: 1,
          currentNumber: null,
          nextNumber,
          endNumber,
          resetEveryFy: false,
          autoGenerate: true,
          manualEntry: false,
          status: 'Active',
        },
      });
    } catch (err) {
      // Another concurrent request may have created it a moment ago (the
      // partial unique index on (documentCode, financialYearId IS NULL,
      // isDefault) would reject a second one) — fall through and re-read
      // rather than fail the request over a race that isn't actually a problem.
      if (err?.code !== 'P2002') throw err;
    }
    all = await client.documentNumbering.findMany({
      where: { documentCode, financialYearId: fyId },
      include: { financialYear: true },
      orderBy: { startNumber: 'asc' },
    });
  }

  if (!all.length) {
    throw new DocumentNumberError(
      master
        ? `No numbering series is defined for ${label}. Add one under Company Setup → Document Numbering.`
        : `No numbering series is defined for ${label} in this financial year. Add one under Company Setup → Document Numbering.`,
      { status: 409, code: 'SERIES_NOT_FOUND', details: { documentCode, financialYearId: fyId } }
    );
  }

  // A partial unique index guarantees at most one default, but not that one
  // exists — the default can be deleted, or a fresh import may set none.
  const series = all.find((s) => s.isDefault);
  if (!series) {
    throw new DocumentNumberError(
      `${label} has ${all.length} numbering series for this financial year but none is marked as the default. Set one as Default under Company Setup → Document Numbering.`,
      { status: 409, code: 'NO_DEFAULT_SERIES', details: { documentCode, financialYearId: fyId } }
    );
  }

  if (requireActive && series.status !== 'Active') {
    // Point at a series that would work, if there is one — the usual cause is
    // the default being retired without the replacement being promoted.
    const alternative = all.find((s) => s.status === 'Active' && s.nextNumber <= s.endNumber);
    throw new DocumentNumberError(
      alternative
        ? `The default ${label} series ("${series.seriesName}") is inactive. Set "${alternative.seriesName}" as the default, or reactivate this one.`
        : `The default ${label} numbering series ("${series.seriesName}") is inactive.`,
      { status: 409, code: 'SERIES_INACTIVE', details: { seriesId: series.id } }
    );
  }

  return series;
}

/**
 * Allocate the next document number for `documentCode` and burn it.
 *
 * The whole point of this function is the single conditional UPDATE below.
 * Reading the counter and writing it back in two statements — even inside a
 * transaction — lets two concurrent posts read the same value under
 * SQL Server's default READ COMMITTED isolation. One statement that both
 * tests and increments cannot: the second writer blocks on the row lock, then
 * re-evaluates the WHERE clause against the committed value.
 *
 * A zero-row result therefore means the guard failed (exhausted, inactive, or
 * auto-generate off), never that we lost a race.
 *
 * Pass `tx` to enlist in the caller's transaction so that a document which
 * fails to save also rolls back the number it consumed.
 */
async function allocateDocumentNumber(documentCode, { financialYearId = null, tx = null, seriesId = null } = {}) {
  const client = tx || db();
  const series = await resolveSeries(documentCode, { financialYearId, client, seriesId });
  const label = CATALOG_BY_CODE.get(documentCode).name;

  if (!series.autoGenerate) {
    throw new DocumentNumberError(
      `Auto Generate is turned off for the ${label} series — enter the document number manually.`,
      { status: 409, code: 'AUTO_GENERATE_OFF', details: { seriesId: series.id } }
    );
  }

  // Reissue a number freed up by a deletion before taking a fresh one, so a
  // deleted SQ-000004 is handed out again instead of being retired forever.
  //
  // The lock is what makes this safe. The counter path below is atomic by
  // construction (one conditional UPDATE that both tests and increments), but
  // "find the lowest unused number" is a read followed by a write and cannot
  // be. Locking the series row first serialises allocation per series: a
  // second concurrent save blocks here, and by the time it proceeds the first
  // save has committed, so its fresh scan sees that number taken. Only
  // attempted inside a caller-supplied transaction — without one the lock
  // would be released the moment this function returns, well before the
  // document row that claims the number is written.
  if (tx) {
    // SQL Server equivalent of Postgres' SELECT ... FOR UPDATE: a table hint
    // that takes and holds an exclusive row lock for the life of the
    // enclosing transaction, serialising concurrent allocators on this series.
    await client.$queryRaw`SELECT [id] FROM [document_numbering] WITH (UPDLOCK, ROWLOCK) WHERE [id] = ${series.id}`;
    const reusable = await findLowestFreeNumber(documentCode, series, client);
    if (reusable !== null) {
      // Deliberately does not touch current_number/next_number: this number is
      // below the counter, so moving either backwards would re-open numbers
      // that are still in use and make the "last issued" figure lie.
      await client.$executeRaw`
        UPDATE [document_numbering]
           SET [last_number_at] = GETDATE(), [updated_at] = GETDATE()
         WHERE [id] = ${series.id}
      `;
      return {
        documentNumber: buildDocumentNumber(series, reusable),
        value: reusable,
        seriesId: series.id,
        seriesName: series.seriesName,
        documentCode,
        financialYearId: series.financialYearId,
        remaining: Math.max(0, series.endNumber - series.nextNumber + 1),
        reusedGap: true,
      };
    }
  }

  const rows = await client.$queryRaw`
    UPDATE [document_numbering]
       SET [current_number] = [next_number],
           [next_number]    = [next_number] + 1,
           [last_number_at] = GETDATE(),
           [updated_at]     = GETDATE()
    OUTPUT INSERTED.[id], INSERTED.[current_number] AS [currentNumber], INSERTED.[next_number] AS [nextNumber]
     WHERE [id] = ${series.id}
       AND [status] = 'Active'
       AND [auto_generate] = 1
       AND [next_number] <= [end_number]
  `;

  if (!rows || rows.length === 0) {
    // Exhausted. With multiple series per document type this is usually
    // recoverable without touching the range at all — there may already be a
    // reserve series sitting there waiting to be promoted, so say so.
    const spare = await client.documentNumbering.findFirst({
      where: {
        documentCode,
        financialYearId: series.financialYearId,
        status: 'Active',
        isDefault: false,
        id: { not: series.id },
      },
      orderBy: { startNumber: 'asc' },
    });

    throw new DocumentNumberError(
      spare
        ? `The default ${label} series ("${series.seriesName}") has reached its End No. (${series.endNumber}). Set "${spare.seriesName}" as the default to continue numbering.`
        : `The ${label} numbering series ("${series.seriesName}") has reached its End No. (${series.endNumber}). Extend the range or add a new series before posting.`,
      {
        status: 409,
        code: 'SERIES_EXHAUSTED',
        details: { seriesId: series.id, endNumber: series.endNumber, suggestedSeriesId: spare?.id ?? null },
      }
    );
  }

  const issued = Number(rows[0].currentNumber);
  return {
    documentNumber: buildDocumentNumber(series, issued),
    value: issued,
    seriesId: series.id,
    seriesName: series.seriesName,
    documentCode,
    financialYearId: series.financialYearId,
    remaining: Math.max(0, series.endNumber - Number(rows[0].nextNumber) + 1),
  };
}

/**
 * Promote a series to be the one its document type allocates from.
 *
 * The demote-then-promote pair runs in a transaction because a partial unique
 * index enforces at most one default per (document type, year): doing them in
 * either order outside a transaction leaves a window where the constraint is
 * violated or no default exists at all.
 */
async function setDefaultSeries(seriesId, { client = db() } = {}) {
  const target = await client.documentNumbering.findUnique({ where: { id: Number(seriesId) } });
  if (!target) throw new DocumentNumberError('Numbering series not found', { status: 404, code: 'SERIES_NOT_FOUND' });

  if (target.nextNumber > target.endNumber) {
    throw new DocumentNumberError(
      `"${target.seriesName}" has already reached its End No. — it cannot be made the default series.`,
      { status: 409, code: 'SERIES_EXHAUSTED', details: { seriesId: target.id } }
    );
  }
  if (target.status !== 'Active') {
    throw new DocumentNumberError(
      `"${target.seriesName}" is inactive — activate it before making it the default series.`,
      { status: 409, code: 'SERIES_INACTIVE', details: { seriesId: target.id } }
    );
  }

  return client.$transaction(async (tx) => {
    await tx.documentNumbering.updateMany({
      where: {
        documentCode: target.documentCode,
        financialYearId: target.financialYearId,
        isDefault: true,
      },
      data: { isDefault: false },
    });
    return tx.documentNumbering.update({
      where: { id: target.id },
      data: { isDefault: true },
      include: { financialYear: true },
    });
  });
}

/**
 * Non-consuming look at what the next number would be. Safe to call from a
 * form's onOpen so the user sees the number before saving — but the value is
 * advisory: two users opening the form at once will both see it, and only the
 * one who saves first gets it.
 */
async function peekDocumentNumber(documentCode, { financialYearId = null, client = db(), seriesId = null } = {}) {
  const series = await resolveSeries(documentCode, { financialYearId, client, seriesId });

  // Preview the same number allocate would take, gap included — otherwise the
  // form pre-fills SQ-000006 while the save actually stores the reissued
  // SQ-000004, and the user watches the number change under them on save.
  // Unlocked and non-consuming, exactly like the rest of peek: it is advisory
  // either way, and two users opening the form at once have always both seen
  // the same suggestion with only the first to save keeping it.
  const reusable = await findLowestFreeNumber(documentCode, series, client);
  if (reusable !== null) {
    return {
      documentNumber: buildDocumentNumber(series, reusable),
      value: reusable,
      seriesId: series.id,
      series: decorateSeries(series),
      reusedGap: true,
    };
  }

  const next = peekNumber(series);
  if (!next) {
    throw new DocumentNumberError(
      `The ${CATALOG_BY_CODE.get(documentCode).name} numbering series has reached its End No. (${series.endNumber}).`,
      { status: 409, code: 'SERIES_EXHAUSTED', details: { seriesId: series.id } }
    );
  }
  return { documentNumber: next, value: series.nextNumber, seriesId: series.id, series: decorateSeries(series) };
}

/**
 * Push the counter forward after a manually keyed number, so auto-generated
 * numbers never collide with one a user typed ahead of the sequence. Only ever
 * moves the counter up — a manual number below the current position is legal
 * (filling a gap) and must not rewind the series.
 */
async function syncAfterManualNumber(seriesId, value, { tx = null } = {}) {
  const client = tx || db();
  // SQL Server 2019 has no GREATEST()/LEAST() (added only in 2022+), so the
  // "never move the counter backwards" clamp is spelled out with IIF instead.
  const rows = await client.$queryRaw`
    UPDATE [document_numbering]
       SET [current_number] = IIF(COALESCE([current_number], ${value}) > ${value}, COALESCE([current_number], ${value}), ${value}),
           [next_number]    = IIF([next_number] > ${value} + 1, [next_number], ${value} + 1),
           [last_number_at] = GETDATE(),
           [updated_at]     = GETDATE()
    OUTPUT INSERTED.[id], INSERTED.[current_number] AS [currentNumber], INSERTED.[next_number] AS [nextNumber]
     WHERE [id] = ${seriesId}
       AND ${value} + 1 <= [end_number] + 1
  `;
  return rows && rows.length ? rows[0] : null;
}

/**
 * Create the next financial year's series from the current ones.
 *
 * `resetEveryFy = true` starts the new year at Start No. (the usual Indian
 * statutory behaviour — invoice numbering restarts each FY). `false` carries
 * the last-issued number forward so the sequence continues unbroken across the
 * year boundary. Either way the new FY gets its *own row*, which is what keeps
 * the prior year's counter readable for audit.
 *
 * Idempotent: series that already exist in the target FY are skipped.
 */
async function rolloverToFinancialYear(targetFinancialYearId, { sourceFinancialYearId = null, client = db() } = {}) {
  const targetFy = await client.financialYear.findUnique({ where: { id: Number(targetFinancialYearId) } });
  if (!targetFy) throw new DocumentNumberError('Target financial year not found', { status: 404, code: 'FY_NOT_FOUND' });

  let sourceId = sourceFinancialYearId;
  if (!sourceId) {
    const prior = await client.documentNumbering.findFirst({
      where: { financialYearId: { not: targetFy.id } },
      orderBy: { financialYearId: 'desc' },
    });
    if (!prior) throw new DocumentNumberError('No existing series to roll over from', { status: 409, code: 'NOTHING_TO_ROLL' });
    sourceId = prior.financialYearId;
  }

  // Only the default series of each document type carries forward. The others
  // are historical (used up) or staged for a specific block in the old year —
  // copying them would clone stale ranges into the new year and immediately
  // trip the overlap rule.
  const source = await client.documentNumbering.findMany({
    where: { financialYearId: Number(sourceId), isDefault: true },
  });
  const existing = await client.documentNumbering.findMany({
    where: { financialYearId: targetFy.id },
    select: { documentCode: true },
  });
  const alreadyThere = new Set(existing.map((e) => e.documentCode));
  const fyCode = deriveFyCode(targetFy);

  const created = [];
  for (const s of source) {
    if (alreadyThere.has(s.documentCode)) continue;

    // carry-forward series resume where the old year stopped; resetting series
    // start clean. Either way currentNumber is null — the new row has issued
    // nothing yet, even if its counter starts high.
    const startNumber = s.resetEveryFy ? s.startNumber : Math.max(s.startNumber, s.nextNumber);

    created.push(await client.documentNumbering.create({
      data: {
        documentCode: s.documentCode,
        documentName: s.documentName,
        seriesName: s.seriesName,
        financialYearId: targetFy.id,
        fyCode,
        prefix: s.prefix,
        suffix: s.suffix,
        separator: s.separator,
        includeFyInNumber: s.includeFyInNumber,
        numberLength: s.numberLength,
        startNumber,
        currentNumber: null,
        nextNumber: startNumber,
        endNumber: s.endNumber,
        resetEveryFy: s.resetEveryFy,
        autoGenerate: s.autoGenerate,
        manualEntry: s.manualEntry,
        status: s.status,
        // The carried-forward series is the only one of its document type in
        // the new year, so it becomes that year's default.
        isDefault: true,
      },
    }));
  }

  return created;
}

module.exports = {
  DOCUMENT_CATALOG,
  CATALOG_BY_CODE,
  MASTER_TABLE_SOURCES,
  TRANSACTION_TABLE_SOURCES,
  DOCUMENT_TABLE_SOURCES,
  highestExistingMasterNumber,
  extractSeriesValue,
  findLowestFreeNumber,
  isMasterScope,
  SEPARATORS,
  SEPARATOR_VALUES,
  NUMBER_LENGTH_OPTIONS,
  MIN_NUMBER_LENGTH,
  MAX_NUMBER_LENGTH,
  MIN_SERIES_RANGE_GAP,
  LOCKED_ONCE_CONSUMED,
  DocumentNumberError,

  // pure
  deriveFyCode,
  padNumber,
  clampLength,
  maxValueForLength,
  buildDocumentNumber,
  peekNumber,
  currentNumber,
  isConsumed,
  remainingCapacity,
  displayStatus,
  rangesOverlap,
  findOverlappingSeries,
  findFirstFreeRange,
  suggestSeriesName,
  decorateSeries,
  validateSeriesPayload,
  validateManualNumber,

  // persistence
  getActiveFinancialYear,
  resolveSeries,
  allocateDocumentNumber,
  setDefaultSeries,
  peekDocumentNumber,
  syncAfterManualNumber,
  rolloverToFinancialYear,
};
