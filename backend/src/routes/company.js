const router = require('express').Router();
const crypto = require('crypto');
const multer = require('multer');
const prisma = require('../prisma/client');
const auth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const crudRouter = require('../utils/crudRouter');
const {
  entityNameField, taxLabelField, personNameField, accountNumberField, ifscField,
  mobileField, phoneField, emailField, nonNegativeNumberField, runValidators,
  panField,
} = require('../utils/formatValidators');
const { assertUnique } = require('../utils/duplicateGuard');
const { validateHeaders, readWorkbookRows, buildTemplateBuffer } = require('../utils/xlsxImport');

// Tax Code format-check chain — shared between the bespoke POST/PUT below
// (crudFactory's own create/update never run for this resource, see the
// comment on router.post('/tax-codes', ...)). taxRate/cgst/sgst/igst mirror
// taxCodeSchema in frontend/src/lib/validation/companySchemas.js, which
// validates them as plain non-negative amounts (currencyAmount()), not
// percentage() — so no 100 cap here either, to stay in lockstep with it.
const taxCodeFormatRules = [
  // taxCode is now hand-typed on the page (see TaxCode.jsx) rather than
  // pulled from the 'TAX' numbering series — enforced here the same way
  // taxName already is, since the frontend's own required-ness check is not
  // something this route can otherwise trust.
  //
  // taxLabelField, not entityNameField: Tax Code/Tax Name allow any
  // symbol (no character-set restriction), unlike entityNameField/
  // ENTITY_NAME_RE which stays exactly as-is for every other master
  // (Business Partner, Product, ...). See taxLabelField in
  // utils/formatValidators.js.
  taxLabelField('taxCode', { label: 'Tax code' }),
  taxLabelField('taxName', { label: 'Tax name' }),
  nonNegativeNumberField('taxRate', { optional: false, label: 'Tax rate' }),
  nonNegativeNumberField('cgst', { optional: true, label: 'CGST' }),
  nonNegativeNumberField('sgst', { optional: true, label: 'SGST' }),
  nonNegativeNumberField('igst', { optional: true, label: 'IGST' }),
];
const { getAllowedTaxGLAccounts, validateTaxCodeAccountFields, applyTaxCodeDefaultsToGlDetermination } = require('../utils/taxGlAccountFilter');
const { uploadObject, deleteObject, getPresignedUrl } = require('../utils/ociStorage');
// Settings > "E-Invoice / E-Way Bill Settings" card — see the
// /einvoice-settings routes below.
const taxproGsp = require('../services/taxproGsp.service');

// ---------------------------------------------------------------------------
// Company (tenant) logo — stored in OCI Object Storage, never on this
// server's own disk and never inline in the DB. Only the object *key* is
// persisted (company_details.logo_key); the frontend gets a fresh
// short-lived pre-signed URL every time it fetches company details, so the
// bucket itself never has to be public and OCI_ACCESS_KEY/OCI_SECRET_KEY
// (backend/.env) never reach the client. See utils/ociStorage.js.
// ---------------------------------------------------------------------------
const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2MB
const LOGO_ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']);
const LOGO_EXT_BY_MIME = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/svg+xml': 'svg', 'image/webp': 'webp' };
const LOGO_PRESIGN_TTL_SECONDS = 3600; // 1 hour — long enough for a page session, short enough not to matter if it leaks (e.g. in a browser cache)

const companyLogoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LOGO_MAX_BYTES },
  fileFilter: (req, file, cb) => {
    if (!LOGO_ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Only PNG, JPG, SVG or WEBP images are accepted.'));
    }
    cb(null, true);
  },
});

// Wraps multer's callback-style middleware so its errors (wrong type, too
// large) reach errorHandler as a 400 instead of falling through to the
// generic 500 default multer errors get otherwise (they carry a `code` like
// LIMIT_FILE_SIZE but no `.status`).
function handleLogoUpload(req, res, next) {
  companyLogoUpload.single('file')(req, res, (err) => {
    if (err) {
      err.status = 400;
      if (err.code === 'LIMIT_FILE_SIZE') err.message = 'Image is too large. Maximum size is 2MB.';
      return next(err);
    }
    next();
  });
}

// Attaches a fresh pre-signed `logoUrl` to a company_details row for API
// responses. Never persisted — a stored URL would either require a public
// bucket or go stale once its signature expires, so it's derived from
// `logoKey` on every read instead.
async function withLogoUrl(details) {
  if (!details) return details;
  if (!details.logoKey) return { ...details, logoUrl: null };
  try {
    const logoUrl = await getPresignedUrl(details.logoKey, LOGO_PRESIGN_TTL_SECONDS);
    return { ...details, logoUrl };
  } catch (err) {
    // An object-storage hiccup shouldn't take down the whole company-details
    // response — the header just falls back to the placeholder icon.
    console.error('Failed to sign company logo URL:', err.message);
    return { ...details, logoUrl: null };
  }
}

// Company Details — singleton (one row for the whole org), get/update only.
router.get('/details', auth(), asyncHandler(async (req, res) => {
  let details = await prisma.companyDetails.findFirst();
  if (!details) details = await prisma.companyDetails.create({ data: { currency: 'INR' } });
  res.json({ success: true, data: await withLogoUrl(details) });
}));

router.put('/details', auth(), asyncHandler(async (req, res) => {
  // logoKey (and id) are never client-settable through this general-purpose
  // endpoint — the only way to change the logo is the dedicated
  // POST/DELETE /company/logo routes below, so a stray field in this form's
  // payload can never point the header at an object the user never uploaded.
  const { logoKey, id, ...body } = req.body;
  let details = await prisma.companyDetails.findFirst();
  if (!details) {
    details = await prisma.companyDetails.create({ data: body });
  } else {
    details = await prisma.companyDetails.update({ where: { id: details.id }, data: body });
  }
  res.json({ success: true, data: await withLogoUrl(details) });
}));

// Settings > "E-Invoice / E-Way Bill Settings" — singleton like /details
// above. Passwords are never part of this payload in either direction (see
// the EInvoiceSettings model doc comment in schema.prisma) — they're
// configured on the server via .env, and this endpoint neither reads nor
// returns them.
router.get('/einvoice-settings', auth(), asyncHandler(async (req, res) => {
  let settings = await prisma.eInvoiceSettings.findFirst();
  if (!settings) settings = await prisma.eInvoiceSettings.create({ data: {} });
  res.json({ success: true, data: settings });
}));

router.put('/einvoice-settings', auth(), asyncHandler(async (req, res) => {
  // id is never client-settable; anything else the caller sends that isn't
  // one of this table's real columns is rejected by Prisma itself, same
  // protection every other singleton PUT in this file relies on.
  const { id, ...body } = req.body;
  let settings = await prisma.eInvoiceSettings.findFirst();
  if (!settings) {
    settings = await prisma.eInvoiceSettings.create({ data: body });
  } else {
    settings = await prisma.eInvoiceSettings.update({ where: { id: settings.id }, data: body });
  }
  res.json({ success: true, data: settings });
}));

// Dry-run auth handshake against TaxPro using whatever the Settings form
// currently holds (not necessarily saved) — lets the user catch a bad ASP
// ID/GSTIN/username, or a misconfigured .env password, before relying on it
// from a live Sales Invoice. Never touches taxproGsp's own cached session.
router.post('/einvoice-settings/test-connection', auth(), asyncHandler(async (req, res) => {
  await taxproGsp.testConnection(req.body || {});
  res.json({ success: true, message: 'Connected to TaxPro GSP successfully.' });
}));

// Settings > "Module Settings" — singleton like /details and
// /einvoice-settings above: three switches (Sales/Purchase/Inventory) read
// by utils/systemSettings.js's assertModuleEnabled()/isInventoryModuleEnabled()
// on every gated document route. See that file's own header comment for
// which document types each switch actually gates.
router.get('/system-settings', auth(), asyncHandler(async (req, res) => {
  let settings = await prisma.systemSettings.findFirst();
  if (!settings) settings = await prisma.systemSettings.create({ data: {} });
  res.json({ success: true, data: settings });
}));

router.put('/system-settings', auth(), asyncHandler(async (req, res) => {
  // id is never client-settable; anything else the caller sends that isn't
  // one of this table's real columns is rejected by Prisma itself, same
  // protection every other singleton PUT in this file relies on.
  const { id, ...body } = req.body;
  let settings = await prisma.systemSettings.findFirst();
  if (!settings) {
    settings = await prisma.systemSettings.create({ data: body });
  } else {
    settings = await prisma.systemSettings.update({ where: { id: settings.id }, data: body });
  }
  res.json({ success: true, data: settings });
}));

router.post('/logo', auth(), handleLogoUpload, asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded. Attach a PNG, JPG, SVG or WEBP image.' });
  }

  let details = await prisma.companyDetails.findFirst();
  if (!details) details = await prisma.companyDetails.create({ data: { currency: 'INR' } });

  const ext = LOGO_EXT_BY_MIME[req.file.mimetype] || 'png';
  const key = `company/${details.id}/logo/${crypto.randomUUID()}.${ext}`;
  const previousKey = details.logoKey;

  // Upload first, persist the key second. If the DB write below then fails,
  // the just-written object is rolled back (deleted) so nothing is left
  // orphaned in the bucket; doing it the other way around (key first) would
  // instead risk the DB pointing at an object that was never written.
  await uploadObject(key, req.file.buffer, req.file.mimetype);

  let updated;
  try {
    updated = await prisma.companyDetails.update({ where: { id: details.id }, data: { logoKey: key } });
  } catch (dbErr) {
    await deleteObject(key).catch(() => {});
    throw dbErr;
  }

  // The previous logo is only removed once the new one is safely live in
  // both OCI and the DB, so a failure above never leaves the company with
  // no logo at all. Best-effort: a failure here just leaves one harmless
  // orphaned object rather than failing the whole request.
  if (previousKey && previousKey !== key) {
    deleteObject(previousKey).catch((err) => {
      console.error('Failed to delete previous company logo object:', err.message);
    });
  }

  res.json({ success: true, data: await withLogoUrl(updated) });
}));

router.delete('/logo', auth(), asyncHandler(async (req, res) => {
  const details = await prisma.companyDetails.findFirst();
  if (!details || !details.logoKey) {
    return res.json({ success: true, data: await withLogoUrl(details) });
  }

  const keyToDelete = details.logoKey;
  // Clear the DB field before deleting the object: if the object delete
  // below then fails (a transient OCI error), the header immediately stops
  // referencing a key we're already committed to removing, rather than
  // continuing to hand out pre-signed URLs for an object about to vanish.
  // A leftover object with no DB reference is harmless; the reverse
  // (DB reference to a deleted object) is what would actually break the
  // header on next load.
  const updated = await prisma.companyDetails.update({ where: { id: details.id }, data: { logoKey: null } });
  await deleteObject(keyToDelete).catch((err) => {
    console.error('Failed to delete company logo object:', err.message);
  });

  res.json({ success: true, data: await withLogoUrl(updated) });
}));

// ---------------------------------------------------------------------------
// Document Numbering Series
//
// SAP Business One-style numbering: one series per (document type, financial
// year), each with its own pattern, range and atomic counter. All the actual
// numbering logic — formatting, validation, allocation — lives in
// services/documentNumberService.js; these routes are thin plumbing over it.
//
// Route order matters: the literal sub-paths (/catalog, /reset, /preview,
// /next, /peek, /rollover) must be declared before '/:id' or Express will
// match them as an id.
// ---------------------------------------------------------------------------
const numbering = require('../services/documentNumberService');

// Defaults used by "Reset to Default". Mirrors the service catalog so a fresh
// install and a reset produce identical series — keep in sync with
// backend/src/prisma/seed/seed.js's seedDocumentNumbering.
const DEFAULT_SERIES_SHAPE = {
  separator: '-',
  includeFyInNumber: true,
  numberLength: 6,
  startNumber: 1,
  endNumber: 999999,
  resetEveryFy: true,
  autoGenerate: true,
  manualEntry: false,
  status: 'Active',
  suffix: null,
};

/** Coerce a request body into the field set the series table accepts. */
function toSeriesData(body, { fyCode, documentName, seriesName }) {
  const num = (v, fallback) => (v === undefined || v === null || v === '' ? fallback : Math.trunc(Number(v)));
  const bool = (v, fallback) => (v === undefined || v === null ? fallback : Boolean(v));
  const str = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());
  // Prefix and suffix are canonicalised to upper case here rather than only in
  // the form. They end up printed on statutory documents, so 'PO' and 'po'
  // must not be storable as two different series — the numbers they issue
  // would be indistinguishable on paper while the uniqueness checks treated
  // them as unrelated.
  const code = (v) => { const s = str(v); return s === null ? null : s.toUpperCase(); };

  const startNumber = num(body.startNumber, DEFAULT_SERIES_SHAPE.startNumber);
  return {
    documentCode: body.documentCode,
    documentName,
    seriesName,
    financialYearId: num(body.financialYearId, null),
    fyCode,
    prefix: code(body.prefix),
    suffix: code(body.suffix),
    separator: body.separator === undefined ? DEFAULT_SERIES_SHAPE.separator : String(body.separator),
    includeFyInNumber: bool(body.includeFyInNumber, DEFAULT_SERIES_SHAPE.includeFyInNumber),
    numberLength: num(body.numberLength, DEFAULT_SERIES_SHAPE.numberLength),
    startNumber,
    nextNumber: num(body.nextNumber, startNumber),
    endNumber: num(body.endNumber, DEFAULT_SERIES_SHAPE.endNumber),
    resetEveryFy: bool(body.resetEveryFy, DEFAULT_SERIES_SHAPE.resetEveryFy),
    autoGenerate: bool(body.autoGenerate, DEFAULT_SERIES_SHAPE.autoGenerate),
    manualEntry: bool(body.manualEntry, DEFAULT_SERIES_SHAPE.manualEntry),
    status: body.status || DEFAULT_SERIES_SHAPE.status,
  };
}

// `errors` can be a mix of plain strings (no specific field) and
// { field, message } objects — validateSeriesPayload returns the latter so
// the frontend can show each message under the input it actually belongs to,
// instead of only in a single toast.
const badRequest = (errors) => {
  const structured = errors.map((e) => (typeof e === 'string' ? { field: null, message: e } : e));
  const err = new Error(structured.map((e) => e.message).join('; '));
  err.status = 400;
  err.errors = structured;
  return err;
};

/** Every other series for the same document type and year — the set the
 *  name-collision and range-overlap checks run against. */
// Master-code series (customer, product, branch, ...) are perpetual and
// carry no financial year, so their siblings are the rows where
// financialYearId IS NULL. See DOCUMENT_CATALOG in documentNumberService.js
// for why a master must never be year-scoped.
function loadSiblings(documentCode, financialYearId) {
  return prisma.documentNumbering.findMany({
    where: {
      documentCode,
      financialYearId: numbering.isMasterScope(documentCode) ? null : Number(financialYearId),
    },
  });
}

// Static reference data for the Add/Edit form: document types, separators and
// length options. `seriesCount` tells the form how many series a document type
// already has in the selected year — nothing is filtered out, since a document
// type may legitimately have several.
router.get('/document-numbers/catalog', auth(), asyncHandler(async (req, res) => {
  const financialYearId = req.query.financialYearId ? Number(req.query.financialYearId) : null;

  const counts = new Map();
  // Masters are counted regardless of the selected year — they have none.
  const grouped = await prisma.documentNumbering.groupBy({
    by: ['documentCode'],
    where: financialYearId
      ? { OR: [{ financialYearId }, { financialYearId: null }] }
      : { financialYearId: null },
    _count: { _all: true },
  });
  grouped.forEach((g) => counts.set(g.documentCode, g._count._all));

  res.json({
    success: true,
    data: {
      // The 11 master-code documents (Branch, Tax Code, Sales Employee,
      // Product Group, Product Sub Group, Brand, Unit of Measure, Product,
      // Customer, Supplier, Transporter) are excluded here —
      // they still auto-generate their codes via the same numbering engine
      // (see DocumentNoField on each master's own page), they're just not
      // offered on this screen for manual series configuration.
      documents: numbering.DOCUMENT_CATALOG
        .filter((d) => !d.hiddenFromNumberingUI)
        .map((d) => ({
          ...d,
          seriesCount: counts.get(d.code) || 0,
          configured: (counts.get(d.code) || 0) > 0,
        })),
      separators: numbering.SEPARATORS,
      numberLengths: numbering.NUMBER_LENGTH_OPTIONS,
    },
  });
}));

// Every series for one document type in one financial year — backs the
// "Existing Series for ..." table on the Add/Edit form. Also returns the
// suggested name and start point for the next series, so the form can
// pre-fill a non-overlapping range instead of making the user work it out.
router.get('/document-numbers/by-document/:documentCode', auth(), asyncHandler(async (req, res) => {
  const { documentCode } = req.params;
  const doc = numbering.CATALOG_BY_CODE.get(documentCode);
  if (!doc) throw badRequest([`Unknown document type "${documentCode}"`]);

  const isMaster = numbering.isMasterScope(documentCode);

  let fyId = req.query.financialYearId ? Number(req.query.financialYearId) : null;
  if (!isMaster && !fyId) {
    const fy = await numbering.getActiveFinancialYear();
    fyId = fy?.id ?? null;
  }
  // A master needs no financial year; a transaction cannot be numbered
  // without one.
  if (!isMaster && !fyId) return res.json({ success: true, data: { series: [], suggestion: null } });

  const rows = await prisma.documentNumbering.findMany({
    where: { documentCode, financialYearId: isMaster ? null : fyId },
    include: { financialYear: true },
    orderBy: [{ startNumber: 'asc' }, { id: 'asc' }],
  });

  // Next free block starts one past the highest End No. in use, so the
  // suggested range can't overlap anything that already exists.
  const highestEnd = rows.reduce((max, r) => Math.max(max, r.endNumber), 0);
  const template = rows.find((r) => r.isDefault) || rows[rows.length - 1] || null;

  let startNumber = rows.length ? highestEnd + 1 : DEFAULT_SERIES_SHAPE.startNumber;

  // If a hole exists between same-width series (1-526 and 40257-99999 leaves
  // 527-40256), offer that instead of a range past the highest End No. —
  // otherwise the user types the free Start No. by hand, keeps the default End
  // No., and is rejected for running into the next series.
  const templateLength = template?.numberLength ?? DEFAULT_SERIES_SHAPE.numberLength;
  const freeRange = rows.some((r) => Number(r.numberLength) === Number(templateLength))
    ? numbering.findFirstFreeRange(rows, templateLength, { from: DEFAULT_SERIES_SHAPE.startNumber })
    : null;
  if (freeRange) startNumber = freeRange.start;

  // Carry the template's range size forward from the new Start No., rather
  // than reusing its fixed End No. — otherwise the second series in a
  // document type would suggest a range that starts after it ends (e.g.
  // Start 1,000,000 with the default End No. still 999,999) and get rejected
  // on save every time the first series fills its default 1–999,999 block.
  const templateRangeSize = template ? (template.endNumber - template.startNumber + 1) : null;
  const rangeSize = templateRangeSize && templateRangeSize > 0
    ? templateRangeSize
    : (DEFAULT_SERIES_SHAPE.endNumber - DEFAULT_SERIES_SHAPE.startNumber + 1);
  let endNumber = startNumber + rangeSize - 1;
  // Never let the suggested End No. run past the free gap it was found in (and
  // clamp before the width check below, or the overshoot would widen the padding).
  if (freeRange) endNumber = Math.min(endNumber, freeRange.end);

  // Widen the padding if the carried-forward range no longer fits the
  // template's digit count — e.g. rolling from 999,999 into 7-digit territory.
  let numberLength = template?.numberLength ?? DEFAULT_SERIES_SHAPE.numberLength;
  const neededLength = Math.min(numbering.MAX_NUMBER_LENGTH, String(endNumber).length);
  if (neededLength > numberLength) numberLength = neededLength;
  endNumber = Math.min(endNumber, numbering.maxValueForLength(numberLength));

  // A digit count can only be offered for the next series if a valid,
  // non-overlapping range still fits inside it — but "non-overlapping" is
  // scoped to siblings of that SAME digit count, not to every series of any
  // length. A 5-digit series and a 6-digit series never print the same
  // string for the same underlying number (5-digit '40079' vs 6-digit
  // '040079'), so a wide 6-digit series filling 1-999,999 has no bearing on
  // whether 5 Digits still has room — it always does, starting fresh at 1,
  // since no other 5-digit series exists yet. Using the single highest End
  // No. across every length here (as this used to) meant a document type's
  // very first series, however wide, silently locked out every other digit
  // width for good — exactly what made "add a smaller series" impossible.
  const highestEndByLength = new Map();
  for (const r of rows) {
    const len = r.numberLength;
    highestEndByLength.set(len, Math.max(highestEndByLength.get(len) ?? 0, r.endNumber));
  }
  const availableNumberLengths = numbering.NUMBER_LENGTH_OPTIONS.filter((len) => {
    const nextStartForLen = highestEndByLength.has(len) ? highestEndByLength.get(len) + 1 : 0;
    return numbering.maxValueForLength(len) >= nextStartForLen + numbering.MIN_SERIES_RANGE_GAP;
  });

  res.json({
    success: true,
    data: {
      series: rows.map(numbering.decorateSeries),
      availableNumberLengths,
      suggestion: {
        seriesName: numbering.suggestSeriesName(rows.map((r) => r.seriesName)),
        startNumber,
        endNumber,
        prefix: template?.prefix ?? doc.prefix,
        separator: template?.separator ?? DEFAULT_SERIES_SHAPE.separator,
        numberLength,
        includeFyInNumber: template?.includeFyInNumber ?? DEFAULT_SERIES_SHAPE.includeFyInNumber,
        // The first series for a document type has to be the default;
        // later ones are staged and promoted deliberately.
        isDefault: rows.length === 0,
      },
    },
  });
}));

// Promote a series to be the one its document type allocates from.
router.post('/document-numbers/:id/set-default', auth(), asyncHandler(async (req, res) => {
  const row = await numbering.setDefaultSeries(Number(req.params.id));
  res.json({ success: true, data: numbering.decorateSeries(row) });
}));

// Live preview for the form — no persistence, no side effects.
router.post('/document-numbers/preview', auth(), asyncHandler(async (req, res) => {
  const { financialYearId, prefix, suffix, separator, numberLength, startNumber, includeFyInNumber } = req.body;

  let fyCode = req.body.fyCode || null;
  if (!fyCode && financialYearId) {
    const fy = await prisma.financialYear.findUnique({ where: { id: Number(financialYearId) } });
    fyCode = numbering.deriveFyCode(fy);
  }

  const shape = {
    prefix, suffix, separator,
    numberLength: numberLength ?? DEFAULT_SERIES_SHAPE.numberLength,
    fyCode,
    includeFyInNumber: includeFyInNumber ?? true,
  };
  res.json({
    success: true,
    data: {
      fyCode,
      preview: numbering.buildDocumentNumber(shape, startNumber ?? DEFAULT_SERIES_SHAPE.startNumber),
      maxForLength: numbering.maxValueForLength(shape.numberLength),
    },
  });
}));

// Consume the next number for a document type. This is the endpoint every
// transaction route should call inside its own save transaction.
router.post('/document-numbers/next', auth(), asyncHandler(async (req, res) => {
  const { documentCode, financialYearId, seriesId } = req.body;
  const result = await numbering.allocateDocumentNumber(documentCode, {
    financialYearId: financialYearId ? Number(financialYearId) : null,
    seriesId: seriesId ? Number(seriesId) : null,
  });
  res.json({ success: true, data: result });
}));

// Same lookup without burning the number — for showing it on a blank form.
// seriesId is optional: pass it when the form has a series picker (Sales
// Quotation/Sales Invoice create) so the preview reflects the series the
// user actually selected rather than always the document type's default.
router.post('/document-numbers/peek', auth(), asyncHandler(async (req, res) => {
  const { documentCode, financialYearId, seriesId } = req.body;
  const result = await numbering.peekDocumentNumber(documentCode, {
    financialYearId: financialYearId ? Number(financialYearId) : null,
    seriesId: seriesId ? Number(seriesId) : null,
  });
  res.json({ success: true, data: result });
}));

// Copy this year's series into next year (respecting each series' Reset Every
// FY flag). Idempotent — re-running skips series that already exist.
router.post('/document-numbers/rollover', auth(), asyncHandler(async (req, res) => {
  const { targetFinancialYearId, sourceFinancialYearId } = req.body;
  if (!targetFinancialYearId) throw badRequest(['Target financial year is required']);
  const created = await numbering.rolloverToFinancialYear(Number(targetFinancialYearId), {
    sourceFinancialYearId: sourceFinancialYearId ? Number(sourceFinancialYearId) : null,
  });
  res.json({ success: true, data: created.map(numbering.decorateSeries), message: `${created.length} series created` });
}));

// Recreate the standard series set for a financial year. Series that have
// already issued numbers are left alone — resetting a live counter would
// re-issue numbers that are already printed on documents.
router.post('/document-numbers/reset', auth(), asyncHandler(async (req, res) => {
  let fyId = req.body?.financialYearId ? Number(req.body.financialYearId) : null;
  if (!fyId) {
    const fy = await numbering.getActiveFinancialYear();
    if (!fy) throw badRequest(['No financial year is configured. Create one under Company Setup → Financial Year first.']);
    fyId = fy.id;
  }
  const fy = await prisma.financialYear.findUnique({ where: { id: fyId } });
  if (!fy) throw badRequest(['Financial year not found']);
  const fyCode = numbering.deriveFyCode(fy);

  const skipped = [];
  // Only the year-scoped transaction documents are rebuilt here. Master-code
  // series (customer, product, branch, ...) are perpetual and carry no
  // financial year at all — creating an FY-scoped copy of one would give a
  // master two default series and reissue codes that records already hold.
  // They are seeded once by migration 20260809090000 and are not part of a
  // per-year reset.
  const resettable = numbering.DOCUMENT_CATALOG.filter((d) => !numbering.isMasterScope(d.code));
  for (const def of resettable) {
    const siblings = await loadSiblings(def.code, fyId);

    // Reset only rebuilds the series *this endpoint itself* created — the
    // one named 'Series 1' (or, for rows from before that naming convention
    // changed, the older 'Default'). Matching by name rather than the
    // isDefault flag is deliberate: a hand-made series that happens to be
    // the only one for its document type is also the default, but it is
    // still the admin's own series, not this endpoint's, and must not be
    // silently overwritten just because it holds that flag.
    //
    // Matching *only* 'Series 1' (the literal bug this comment used to
    // describe) breaks the moment a row still carries the pre-rename
    // 'Default' name: `existing` comes back undefined, so the overlap check
    // below sees that series' own 1-999999 range as a *foreign* "custom
    // series in range" and skips it entirely — Reset to Default silently did
    // nothing. Accepting both names is what a database that hasn't had the
    // rename migration (20260806090000_rename_default_series_to_series_n)
    // applied yet still needs.
    const existing = siblings.find((s) => s.seriesName === 'Series 1' || s.seriesName === 'Default');

    if (existing && numbering.isConsumed(existing)) {
      skipped.push(def.name);
      continue;
    }
    // A hand-made series may already occupy the default range; rewriting
    // 'Series 1' back to 1-999999 would overlap it.
    const others = siblings.filter((s) => s.id !== existing?.id);
    const wouldOverlap = others.some(
      (s) => DEFAULT_SERIES_SHAPE.startNumber <= s.endNumber && s.startNumber <= DEFAULT_SERIES_SHAPE.endNumber
    );
    if (wouldOverlap) {
      skipped.push(`${def.name} (custom series in range)`);
      continue;
    }

    const data = {
      ...DEFAULT_SERIES_SHAPE,
      documentCode: def.code,
      documentName: def.name,
      seriesName: 'Series 1',
      financialYearId: fyId,
      fyCode,
      prefix: def.prefix,
      nextNumber: DEFAULT_SERIES_SHAPE.startNumber,
      currentNumber: null,
      isDefault: true,
    };

    if (existing) {
      await prisma.documentNumbering.update({ where: { id: existing.id }, data });
    } else {
      // Demote whatever currently holds the default flag — the partial unique
      // index allows only one per document type and year.
      await prisma.documentNumbering.updateMany({
        where: { documentCode: def.code, financialYearId: fyId, isDefault: true },
        data: { isDefault: false },
      });
      await prisma.documentNumbering.create({ data });
    }
  }

  const rows = await prisma.documentNumbering.findMany({
    where: { financialYearId: fyId },
    include: { financialYear: true },
    orderBy: { id: 'asc' },
  });
  res.json({
    success: true,
    data: rows.map(numbering.decorateSeries),
    message: skipped.length
      ? `Reset complete. Skipped ${skipped.length} series that have already issued numbers: ${skipped.join(', ')}.`
      : 'Reset complete.',
  });
}));

router.get('/document-numbers', auth(), asyncHandler(async (req, res) => {
  const { financialYearId, documentCode, status, q } = req.query;

  const and = [];
  if (documentCode) and.push({ documentCode });
  if (financialYearId) {
    // Master-scope series (Branch, Tax Code, Product, UOM, ...) are perpetual
    // and carry financialYearId = NULL — see the 'master' scope doc comment
    // on DOCUMENT_CATALOG in documentNumberService.js. A plain
    // `financialYearId: Number(financialYearId)` filter can never match NULL,
    // so this list used to hide every master series no matter which year was
    // selected — the only reason "Product" (or any other master row) ever
    // showed up here at all was a stray duplicate row that had somehow been
    // saved with a real financial_year_id instead of NULL, which is itself a
    // data problem (see scripts/repairMasterNumberingScope.js). Include
    // master rows alongside whatever belongs to the selected year instead of
    // relying on that duplicate to stand in for them.
    const masterCodes = numbering.DOCUMENT_CATALOG.filter((d) => d.scope === 'master').map((d) => d.code);
    and.push({ OR: [{ financialYearId: Number(financialYearId) }, { documentCode: { in: masterCodes } }] });
  }
  if (status) and.push({ status });
  if (q) {
    and.push({
      OR: [
        { documentName: { contains: q } },
        { documentCode: { contains: q } },
        { prefix: { contains: q } },
        { seriesName: { contains: q } },
      ],
    });
  }
  const where = and.length ? { AND: and } : {};

  const rows = await prisma.documentNumbering.findMany({
    where,
    include: { financialYear: true },
    // Group a document type's series together and order them by range, so the
    // list reads as "PO: block 1, block 2, block 3" rather than by insert order.
    orderBy: [{ financialYearId: 'desc' }, { documentCode: 'asc' }, { startNumber: 'asc' }],
  });
  res.json({ success: true, data: rows.map(numbering.decorateSeries) });
}));

router.get('/document-numbers/:id', auth(), asyncHandler(async (req, res) => {
  const row = await prisma.documentNumbering.findUnique({
    where: { id: Number(req.params.id) },
    include: { financialYear: true },
  });
  if (!row) return res.status(404).json({ success: false, message: 'Numbering series not found' });
  res.json({ success: true, data: numbering.decorateSeries(row) });
}));

router.post('/document-numbers', auth(), asyncHandler(async (req, res) => {
  const doc = numbering.CATALOG_BY_CODE.get(req.body.documentCode);
  if (!doc) throw badRequest([`Unknown document type "${req.body.documentCode || ''}"`]);

  // A master series is perpetual: no financial year to select, no year
  // token in the pattern, and it must never reset — a code that restarts
  // each April would be reissued to a record that already holds it.
  const isMaster = numbering.isMasterScope(doc.code);
  const fyId = isMaster ? null : Number(req.body.financialYearId);
  const fy = fyId ? await prisma.financialYear.findUnique({ where: { id: fyId } }) : null;
  if (!isMaster && !fy) throw badRequest(['Select a valid financial year']);

  // A document type can hold several series in a year, so the name has to be
  // unique among its siblings. Auto-name when the client didn't supply one.
  const siblings = await loadSiblings(doc.code, fyId);
  const seriesName = String(req.body.seriesName ?? '').trim()
    || numbering.suggestSeriesName(siblings.map((s) => s.seriesName));

  const data = toSeriesData(req.body, {
    fyCode: fy ? numbering.deriveFyCode(fy) : null,
    documentName: doc.name,
    seriesName,
  });
  data.currentNumber = null; // a brand-new series has issued nothing
  if (isMaster) {
    data.financialYearId = null;
    data.fyCode = null;
    data.includeFyInNumber = false;
    data.resetEveryFy = false;
  }

  const errors = numbering.validateSeriesPayload(data, { siblings });
  if (errors.length) throw badRequest(errors);

  // The first series for a document type must be the default, or nothing
  // could ever be numbered. Beyond that, honour what the client asked for.
  const wantsDefault = siblings.length === 0 ? true : Boolean(req.body.isDefault);
  data.isDefault = wantsDefault;

  const row = await prisma.$transaction(async (tx) => {
    if (wantsDefault) {
      // At most one default per (document type, FY) — demote the incumbent
      // inside the same transaction so the partial unique index is never
      // momentarily violated.
      await tx.documentNumbering.updateMany({
        where: { documentCode: doc.code, financialYearId: fyId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.documentNumbering.create({ data, include: { financialYear: true } });
  });

  res.status(201).json({ success: true, data: numbering.decorateSeries(row) });
}));

router.put('/document-numbers/:id', auth(), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.documentNumbering.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ success: false, message: 'Numbering series not found' });

  const doc = numbering.CATALOG_BY_CODE.get(req.body.documentCode || existing.documentCode);
  if (!doc) throw badRequest([`Unknown document type "${req.body.documentCode}"`]);

  // A master series (Branch, Tax Code, Product, UOM, ...) is perpetual and
  // carries financialYearId = NULL, same as the isMaster branch in the POST
  // handler above. This PUT used to require a financial year unconditionally,
  // so ANY edit to a master series — including just flipping Auto Generate/
  // Manual Entry on the Document Numbering page — was rejected with "Select a
  // valid financial year": existing.financialYearId is null for these rows
  // and the client never sends one, since master document types have no FY
  // field in their part of the form. That is the real cause behind Manual
  // Entry "never taking effect" for a master series (Product's PRD included)
  // — the toggle looked interactive but every save silently 400'd.
  const isMaster = numbering.isMasterScope(doc.code);
  let fyId = null;
  let fy = null;
  if (!isMaster) {
    fyId = Number(req.body.financialYearId || existing.financialYearId);
    fy = await prisma.financialYear.findUnique({ where: { id: fyId } });
    if (!fy) throw badRequest(['Select a valid financial year']);
  }

  const seriesName = String(req.body.seriesName ?? existing.seriesName ?? '').trim();

  const data = toSeriesData({ ...existing, ...req.body }, {
    fyCode: isMaster ? null : numbering.deriveFyCode(fy),
    documentName: doc.name,
    seriesName,
  });
  if (isMaster) {
    data.financialYearId = null;
    data.fyCode = null;
    data.includeFyInNumber = false;
    data.resetEveryFy = false;
  }

  // currentNumber and nextNumber are owned by the allocator, never by the
  // client — accepting them from a PUT would let a stale form rewind a live
  // counter and re-issue numbers. The only exception is repositioning an
  // untouched series, which is handled by the startNumber branch below.
  delete data.currentNumber;
  if (!numbering.isConsumed(existing)) {
    data.nextNumber = data.startNumber;
  } else {
    data.nextNumber = existing.nextNumber;

    // Once numbers have gone out, the pattern is frozen — so don't write these
    // fields at all. Rebuilding them from the request would rewrite the stored
    // value even when the client never asked to change it: a row saved before
    // prefixes were canonicalised would silently jump from 'po' to 'PO'
    // mid-sequence, splitting one series across two visibly different formats.
    // validateSeriesPayload still rejects a *deliberate* change below.
    for (const field of numbering.LOCKED_ONCE_CONSUMED) delete data[field];
  }

  // isDefault moves only through the dedicated set-default endpoint, which
  // demotes the incumbent in the same transaction. Letting a plain PUT set it
  // would either violate the partial unique index or silently leave two
  // defaults' worth of intent with only one taking effect.
  delete data.isDefault;

  const siblings = await loadSiblings(doc.code, fyId);
  const errors = numbering.validateSeriesPayload({ ...req.body, ...data }, { existing, siblings });
  if (errors.length) throw badRequest(errors);

  const row = await prisma.documentNumbering.update({ where: { id }, data, include: { financialYear: true } });
  res.json({ success: true, data: numbering.decorateSeries(row) });
}));

// A series that has issued numbers is part of the audit trail — deleting it
// would orphan every document numbered from it. SAP blocks this too; the way
// to retire a series is to set it Inactive.
router.delete('/document-numbers/:id', auth(), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.documentNumbering.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ success: false, message: 'Numbering series not found' });

  if (numbering.isConsumed(existing)) {
    return res.status(409).json({
      success: false,
      message: `This series has already issued ${numbering.currentNumber(existing)}. It cannot be deleted — set its status to Inactive instead.`,
    });
  }

  // Deleting the default series leaves the document type unable to number
  // anything. If a sibling can take over, hand the flag to it rather than
  // making the user notice the breakage at posting time.
  const successor = existing.isDefault
    ? await prisma.documentNumbering.findFirst({
      where: {
        documentCode: existing.documentCode,
        financialYearId: existing.financialYearId,
        status: 'Active',
        id: { not: id },
      },
      orderBy: { startNumber: 'asc' },
    })
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.documentNumbering.delete({ where: { id } });
    if (successor) {
      await tx.documentNumbering.update({ where: { id: successor.id }, data: { isDefault: true } });
    }
  });

  res.json({
    success: true,
    data: null,
    message: successor ? `Series deleted. "${successor.seriesName}" is now the default.` : 'Series deleted.',
  });
}));

// Tax Code — full CRUD (generic crudRouter below) plus a reset-to-default
// action. Defaults extend backend/src/prisma/seed/seed.js's seedTaxCodes
// (which only seeds the 3 GST slabs) with the full common Indian GST set —
// keep both lists in sync if either changes.
// Tax Type is 'GST' (splits SGST+CGST at half the rate each), 'IGST' (posts
// the full rate as-is), or either of those with a flat 1% TCS row added on
// top ('GST+TCS' / 'IGST+TCS') -- see the TaxCode model comment in
// schema.prisma. CGST9/SGST9 used to be their own standalone entries here;
// under the current Tax Code Master (dynamic SGST/CGST rows generated from a
// single GST-type code) a bare "CGST" or "SGST" Tax Type no longer means
// anything on its own, so those two rows are dropped rather than migrated.
const DEFAULT_TAX_CODES = [
  { taxCode: 'GST5', taxName: 'GST 5%', taxType: 'GST', taxRate: 5.0, description: 'Goods and Services Tax 5%', status: 'Active' },
  { taxCode: 'GST12', taxName: 'GST 12%', taxType: 'GST', taxRate: 12.0, description: 'Goods and Services Tax 12%', status: 'Active' },
  { taxCode: 'GST18', taxName: 'GST 18%', taxType: 'GST', taxRate: 18.0, description: 'Goods and Services Tax 18%', status: 'Active' },
  { taxCode: 'GST28', taxName: 'GST 28%', taxType: 'GST', taxRate: 28.0, description: 'Goods and Services Tax 28%', status: 'Active' },
  { taxCode: 'IGST18', taxName: 'IGST 18%', taxType: 'IGST', taxRate: 18.0, description: 'Integrated GST 18%', status: 'Active' },
];

// Restores the standard GST tax code set — used by the "Reset to Default"
// action on the page. taxCode is @unique, so upsert is safe here.
router.post('/tax-codes/reset', auth(), asyncHandler(async (req, res) => {
  for (const def of DEFAULT_TAX_CODES) {
    await prisma.taxCode.upsert({ where: { taxCode: def.taxCode }, update: def, create: def });
  }
  const rows = await prisma.taxCode.findMany({ orderBy: { id: 'asc' } });
  res.json({ success: true, data: rows });
}));

// "GST 12%" and "GST12%" read as the same tax code to a person, but the DB's
// unique index on taxCode only catches an exact byte-for-byte repeat — it
// would happily store both as two "different" rows. Collapsing whitespace
// and case before comparing is what actually matches how someone would
// eyeball the list and call it a duplicate.
//
// `%`, `_` and `-` are also stripped, not just whitespace/case, now that
// taxLabelField allows them as real characters: "GST 18%", "GST_18%" and
// "GST-18%" all read as the same tax code to a person, and without this a
// tax label differing only by which of those three someone happened to
// type would sail past the duplicate check as three "different" rows.
// Keep this in sync with the identical copy in
// frontend/src/pages/company/TaxCode.jsx — they are duplicated, not shared,
// so a change to one without the other only tightens duplicate detection on
// the side that changed.
const normaliseTaxLabel = (v) => String(v ?? '').replace(/[\s%_-]+/g, '').toLowerCase();

// `client` defaults to the plain prisma singleton (used by PUT, which never
// touches the numbering series) but POST below passes its transaction's `tx`
// so the duplicate check reads the same in-flight connection it's about to
// insert on, rather than a second, separate connection.
async function findDuplicateTaxCode({ taxCode, taxName }, { ignoreId = null, client = prisma } = {}) {
  const normCode = normaliseTaxLabel(taxCode);
  const normName = normaliseTaxLabel(taxName);
  const rows = await client.taxCode.findMany({
    where: ignoreId ? { id: { not: Number(ignoreId) } } : undefined,
    select: { id: true, taxCode: true, taxName: true },
  });
  return rows.find(
    (r) => (normCode && normaliseTaxLabel(r.taxCode) === normCode)
        || (normName && normaliseTaxLabel(r.taxName) === normName)
  );
}

// Tax Type is 'GST', 'IGST', or one of those two with a flat 1% TCS row
// added on top -- 'GST+TCS' / 'IGST+TCS'. See the TaxCode model comment in
// schema.prisma and buildTaxGroupRows (frontend/src/lib/taxCodeGroups.js).
// Checked here (not just in the frontend dropdown) since this is the one
// place every create/update of a Tax Code actually goes through.
const TAX_CODE_TYPES = ['GST', 'IGST', 'GST+TCS', 'IGST+TCS'];
function validateTaxType(taxType) {
  if (taxType != null && !TAX_CODE_TYPES.includes(taxType)) {
    throw badRequest([
      { field: 'taxType', message: `Tax Type must be one of ${TAX_CODE_TYPES.join(', ')}` },
    ]);
  }
}

// G/L account lookup for the Tax Code Master's Sales/Purchase/RCM Tax
// Account pickers (TaxCode.jsx) — NOT the full chart-of-accounts list.
// Registered before the crudRouter mount below (same reason /tax-codes/reset
// is) so it isn't swallowed by crudRouter's own GET '/:id'.
//
// Same exact filter as G/L Account Determination's own Tax Account Code
// picker: AccountName LIKE '%GST%' AND AccountNature = 'A' — see
// utils/taxGlAccountFilter.js for the shared rule. `q` searches by account
// code or name WITHIN that already-filtered set; it can never widen it.
router.get('/tax-codes/gl-accounts', auth(), asyncHandler(async (req, res) => {
  const rows = await getAllowedTaxGLAccounts({ search: req.query.q });
  res.json({ success: true, data: rows });
}));

// Bespoke create/update in front of the generic crudRouter below (same
// pattern as /sales/enquiries in resources.js) — the duplicate check needs
// an async lookup crudFactory's plain pass-through create/update can't do.
// GET/DELETE still fall through to crudRouter unchanged.
router.post('/tax-codes', auth(), runValidators(taxCodeFormatRules), asyncHandler(async (req, res) => {
  validateTaxType(req.body.taxType);
  // Re-checked here regardless of what the frontend's own filtered lookup
  // sent — see utils/taxGlAccountFilter.js. Every Sales/Purchase/RCM account
  // on the payload must be a GST Liabilities account that G/L Account
  // Determination's Tax section actually references.
  await validateTaxCodeAccountFields(req.body, badRequest);
  // taxCode is now hand-typed on the page (TaxCode.jsx), not drawn from the
  // 'TAX' numbering series — resolveDocumentNumber() used to sit here and
  // silently overwrite whatever the client sent with the next number off
  // that series (its manualEntry flag defaults to off, and being
  // hiddenFromNumberingUI means nothing in the Document Numbering page can
  // ever turn it on), so a manually-entered code was never actually saved.
  // Same fix as /uoms in routes/resources.js: use the submitted value as-is.
  const taxCode = String(req.body.taxCode || '').trim();
  const row = await prisma.$transaction(async (tx) => {
    const dupe = await findDuplicateTaxCode({ taxCode, taxName: req.body.taxName }, { client: tx });
    if (dupe) {
      throw badRequest([
        { field: dupe.taxCode && normaliseTaxLabel(dupe.taxCode) === normaliseTaxLabel(taxCode) ? 'taxCode' : 'taxName',
          message: `"${dupe.taxCode} — ${dupe.taxName}" already covers this — differing only by spacing/case does not make it a new tax code` },
      ]);
    }
    const created = await tx.taxCode.create({ data: { ...req.body, taxCode } });
    // Part 2 of the Tax Code Master spec: this Tax Code's own Sales/Purchase
    // Tax Account picks become the DEFAULT on G/L Account Determination's
    // Tax section, filling a gap only — never overwriting an existing
    // default. Same transaction as the create, so both succeed together.
    await applyTaxCodeDefaultsToGlDetermination(tx, req.body);
    return created;
  });
  res.status(201).json({ success: true, data: row });
}));

router.put('/tax-codes/:id', auth(), runValidators(taxCodeFormatRules), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  validateTaxType(req.body.taxType);
  await validateTaxCodeAccountFields(req.body, badRequest);
  const dupe = await findDuplicateTaxCode(req.body, { ignoreId: id });
  if (dupe) {
    throw badRequest([
      { field: dupe.taxCode && normaliseTaxLabel(dupe.taxCode) === normaliseTaxLabel(req.body.taxCode) ? 'taxCode' : 'taxName',
        message: `"${dupe.taxCode} — ${dupe.taxName}" already covers this — differing only by spacing/case does not make it a new tax code` },
    ]);
  }
  const row = await prisma.taxCode.update({ where: { id }, data: req.body });
  res.json({ success: true, data: row });
}));

// Master codes are auto-generated from perpetual numbering series (no
// financial year, never reset) — see DOCUMENT_CATALOG in
// services/documentNumberService.js.
router.use('/branches', crudRouter(prisma.branch, {
  searchFields: ['branchCode', 'branchName', 'city'],
  autoNumber: { documentCode: 'BRN', field: 'branchCode', delegate: 'branch' },
  formatRules: [
    entityNameField('branchName', { label: 'Branch name' }),
    mobileField('phone', { optional: true, label: 'Phone' }),
    emailField('email', { optional: true, label: 'Email' }),
  ],
  // branchCode already has a DB-level @unique (see schema.prisma) and is
  // server-generated via autoNumber anyway; branchName is hand-typed and has
  // no such constraint, so it gets the same case/whitespace-insensitive
  // duplicate check Tax Code uses -- see utils/duplicateGuard.js.
  validate: async ({ data, id, delegate }) => {
    await assertUnique(delegate, { id, data, fields: [{ field: 'branchName', label: 'Branch name' }] });
  },
  // Deliberately NOT branch-scoped: this row IS the branch master list, not
  // a transactional record. Every user (admin or not) needs to see every
  // branch here so lookups like the Stock Transfer "To Branch"/"Request to"
  // dropdown, and the Branch Access grant table, can offer every branch as a
  // destination/grantable option. Per-page restriction to the signed-in
  // user's OWN branches (e.g. Stock Transfer's "From Branch") is applied
  // client-side instead, via useBranchNameOptions({ restrictToUserBranches })
  // in the frontend — see frontend/src/lib/useBranchOptions.js.
  // At most one branch may be the Main Branch (Branch.isDefault, shown as the
  // "Default" column on the list). Promoting one demotes whoever held it
  // before — the tag MOVES rather than being duplicated.
  //
  // Enforced here, not in the form: the browser cannot make "promote B and
  // demote A" a single atomic step, so two people saving at once could
  // otherwise leave two branches both flagged, or leave none flagged if the
  // demote landed and the promote failed. Running inside the write's own
  // transaction (see afterWrite in utils/crudFactory.js) makes both halves
  // succeed or neither.
  //
  // Keyed off the row that was actually written rather than the request body,
  // so it is right whether isDefault was sent as a real boolean, omitted
  // entirely on an unrelated edit, or coerced by the client. That also makes
  // it self-healing: editing the current main branch's phone number re-runs
  // the demotion and clears any stray flag left by older data.
  afterWrite: async ({ tx, row }) => {
    if (!row.isDefault) return;
    await tx.branch.updateMany({
      where: { isDefault: true, id: { not: row.id } },
      data: { isDefault: false },
    });
  },
}));
router.use('/financial-years', crudRouter(prisma.financialYear, {
  searchFields: ['financialYearName'],
  // Each of these three must be unique on its own (OR'd, not a compound
  // key) -- no two financial years may share a name, a start date, or an
  // end date. startDate/endDate use `type: 'date'` so a Date object read
  // back from Prisma is compared correctly against the ISO string the
  // client sent -- see normalizeDate in utils/duplicateGuard.js.
  validate: async ({ data, id, delegate }) => {
    await assertUnique(delegate, {
      id,
      data,
      fields: [
        { field: 'financialYearName', label: 'Financial year' },
        { field: 'startDate', label: 'Start date', type: 'date' },
        { field: 'endDate', label: 'End date', type: 'date' },
      ],
    });
  },
}));
// This mount's own POST/PUT are unreachable — the bespoke router.post/put
// '/tax-codes' handlers above are registered first on this same router and
// always intercept those two methods (see the comment there); only GET and
// DELETE ever fall through to here. No `autoNumber` here for that reason:
// taxCode is now hand-typed and handled entirely by the bespoke POST/PUT
// above, so leaving a stale autoNumber option on this dead POST path would
// just silently reintroduce the auto-generated-code bug if the bespoke
// handler above were ever removed.
router.use('/tax-codes', crudRouter(prisma.taxCode, {
  searchFields: ['taxCode', 'taxName'],
}));
router.use('/bank-names', crudRouter(prisma.bankName, {
  searchFields: ['bankCode', 'bankName'],
  formatRules: [entityNameField('bankName', { label: 'Bank name' })],
  // Bank Code is drawn from the BNK numbering series, same as Branch/Tax
  // Code/Sales Employee/... — see DOCUMENT_CATALOG in
  // services/documentNumberService.js and the schema.prisma comment on
  // BankName.bankCode.
  autoNumber: { documentCode: 'BNK', field: 'bankCode', delegate: 'bankName' },
  // bankName already carries a DB-level @unique (schema.prisma), but a raw
  // hit on that constraint surfaces as a 409 with no field tag (see P2002
  // handling in middleware/errorHandler.js) -- inconsistent with every other
  // master's 400 + { errors: [{ field, message }] } shape, and an exact-byte
  // unique index alone wouldn't catch "ABC Bank" vs " abc  bank " anyway.
  // Checking here first gives both: the same normalized comparison as Tax
  // Code, and a response shape the frontend's shared error-mapping expects.
  validate: async ({ data, id, delegate }) => {
    await assertUnique(delegate, { id, data, fields: [{ field: 'bankName', label: 'Bank name' }] });
  },
}));
// ---------------------------------------------------------------------------
// House Bank QR code — stored in OCI Object Storage, same key-only-persisted/
// pre-signed-URL-on-read pattern as the company logo above and the business
// partner logo (routes/resources.js). Deposit Entry's own "Attachment" field
// (frontend/src/pages/banking/DepositEntry.jsx) looked like the obvious
// precedent but turns out to be cosmetic only — it stores just the chosen
// file's *name* client-side and is never actually uploaded anywhere, so it
// has nothing to render as a thumbnail. The list view here needs a real QR
// thumbnail (see HouseBank.jsx), so this reuses the logo pattern instead,
// which is this codebase's only "upload one image tied to a record" flow
// that actually persists bytes.
// ---------------------------------------------------------------------------
const QR_MAX_BYTES = 2 * 1024 * 1024; // 2MB
const QR_ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const QR_EXT_BY_MIME = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp' };
const QR_PRESIGN_TTL_SECONDS = 3600;

const houseBankQrUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: QR_MAX_BYTES },
  fileFilter: (req, file, cb) => {
    if (!QR_ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Only PNG, JPG or WEBP images are accepted.'));
    }
    cb(null, true);
  },
});

function handleHouseBankQrUpload(req, res, next) {
  houseBankQrUpload.single('file')(req, res, (err) => {
    if (err) {
      err.status = 400;
      if (err.code === 'LIMIT_FILE_SIZE') err.message = 'Image is too large. Maximum size is 2MB.';
      return next(err);
    }
    next();
  });
}

// Attaches a fresh pre-signed `qrCodeUrl` to a house_banks row. Skips the OCI
// round-trip when there's no qrCodePath — most rows won't have one — so this
// stays cheap to call for every row of the list, not just a single record.
async function withHouseBankQrUrl(row) {
  if (!row) return row;
  if (!row.qrCodePath) return { ...row, qrCodeUrl: null };
  try {
    const qrCodeUrl = await getPresignedUrl(row.qrCodePath, QR_PRESIGN_TTL_SECONDS);
    return { ...row, qrCodeUrl };
  } catch (err) {
    // An object-storage hiccup shouldn't take down the whole House Bank
    // list/record — the row just falls back to no thumbnail.
    console.error('Failed to sign house bank QR code URL:', err.message);
    return { ...row, qrCodeUrl: null };
  }
}

// Bespoke GET / and GET /:id, registered ahead of the crudRouter mount below
// so they intercept both methods (same "registered first always wins" shape
// as the tax-codes bespoke POST/PUT elsewhere in this file) — needed only to
// attach qrCodeUrl to every row; list/get behavior is otherwise identical to
// what crudRouter's own list/getOne would have done for this resource (no
// paging in use here, no branch scoping — HouseBank has no branch column).
router.get('/house-banks', auth(), asyncHandler(async (req, res) => {
  const { q } = req.query;
  const where = q
    ? { OR: ['bankName', 'accountNumber', 'accountName'].map((f) => ({ [f]: { contains: q } })) }
    : undefined;
  const rows = await prisma.houseBank.findMany({ where, orderBy: { id: 'desc' } });
  res.json({ success: true, data: await Promise.all(rows.map(withHouseBankQrUrl)) });
}));
router.get('/house-banks/:id', auth(), asyncHandler(async (req, res) => {
  const row = await prisma.houseBank.findUnique({ where: { id: Number(req.params.id) } });
  if (!row) return res.status(404).json({ success: false, message: 'Record not found' });
  res.json({ success: true, data: await withHouseBankQrUrl(row) });
}));

router.use('/house-banks', crudRouter(prisma.houseBank, {
  searchFields: ['bankName', 'accountNumber', 'accountName'],
  formatRules: [
    entityNameField('bankName', { label: 'Bank name' }),
    accountNumberField('accountNumber', { optional: false, label: 'Account number' }),
    personNameField('accountName', { optional: true, label: 'Account name' }),
    ifscField('ifscCode', { optional: true, label: 'IFSC code' }),
    entityNameField('branchName', { optional: true, label: 'Branch name' }),
  ],
  // qrCodePath is never client-settable through this general-purpose
  // create/update route — the only way to change it is the dedicated
  // POST/DELETE /house-banks/:id/qr-code routes below (same rule
  // /company/details applies to logoKey), so a stray field in the form's
  // payload can never point a row at an object that was never uploaded.
  transform: (body) => {
    const { qrCodePath, ...rest } = body;
    return rest;
  },
  // No DB-level constraint on accountNumber (a house bank's real-world
  // identity) at all, so two rows for the same account would otherwise save
  // silently.
  validate: async ({ data, id, delegate }) => {
    await assertUnique(delegate, { id, data, fields: [{ field: 'accountNumber', label: 'Account number' }] });
  },
  // At most one house bank may be the default (HouseBank.isDefault, shown
  // as the "Default" column/badge on the list) — the one every screen that
  // auto-picks a bank account (Sales Invoice, Deposit Entry, Payment
  // Voucher, Payment Receipt, ...) pre-fills before falling back to "first
  // Active" bank. Promoting one demotes whoever held it before, same
  // atomic-within-the-write's-own-transaction pattern as Branch.isDefault
  // above — see that block's comment for why this can't be left to the
  // client or done as a follow-up request.
  //
  // HouseBank has no branch/company column, so — like Branch's own
  // updateMany above — this is intentionally unscoped: exactly one default
  // house bank for the whole tenant, not one per branch.
  delegateName: 'houseBank',
  afterWrite: async ({ tx, row }) => {
    if (!row.isDefault) return;
    await tx.houseBank.updateMany({
      where: { isDefault: true, id: { not: row.id } },
      data: { isDefault: false },
    });
  },
}));

// QR code upload/remove — separate multipart/DELETE endpoints from the JSON
// POST/PUT above, since the object goes to OCI Object Storage rather than
// into the request body. Mirrors /company/logo and
// /business-partners/:id/logo above.
router.post('/house-banks/:id/qr-code', auth(), handleHouseBankQrUpload, asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded. Attach a PNG, JPG or WEBP image.' });
  }

  const id = Number(req.params.id);
  const bank = await prisma.houseBank.findUnique({ where: { id } });
  if (!bank) return res.status(404).json({ success: false, message: 'Record not found' });

  const ext = QR_EXT_BY_MIME[req.file.mimetype] || 'png';
  const key = `house-banks/${id}/qr-code/${crypto.randomUUID()}.${ext}`;
  const previousKey = bank.qrCodePath;

  // Upload first, persist the key second — a failed DB write below rolls
  // back (deletes) the just-written object instead of leaving the DB
  // pointing at one that was never written.
  await uploadObject(key, req.file.buffer, req.file.mimetype);

  let updated;
  try {
    updated = await prisma.houseBank.update({ where: { id }, data: { qrCodePath: key } });
  } catch (dbErr) {
    await deleteObject(key).catch(() => {});
    throw dbErr;
  }

  // The previous QR code is only removed once the new one is safely live in
  // both OCI and the DB — best-effort, a failure here just leaves one
  // harmless orphaned object rather than failing the whole request.
  if (previousKey && previousKey !== key) {
    deleteObject(previousKey).catch((err) => {
      console.error('Failed to delete previous house bank QR code object:', err.message);
    });
  }

  res.json({ success: true, data: await withHouseBankQrUrl(updated) });
}));

router.delete('/house-banks/:id/qr-code', auth(), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const bank = await prisma.houseBank.findUnique({ where: { id } });
  if (!bank) return res.status(404).json({ success: false, message: 'Record not found' });
  if (!bank.qrCodePath) {
    return res.json({ success: true, data: await withHouseBankQrUrl(bank) });
  }

  const keyToDelete = bank.qrCodePath;
  const updated = await prisma.houseBank.update({ where: { id }, data: { qrCodePath: null } });
  await deleteObject(keyToDelete).catch((err) => {
    console.error('Failed to delete house bank QR code object:', err.message);
  });

  res.json({ success: true, data: await withHouseBankQrUrl(updated) });
}));
// ---------------------------------------------------------------------------
// Employee (Sales Employee) signature — same OCI Object Storage pattern as
// the Company Logo above (see the doc comment there): only the object *key*
// is persisted (sales_employees.signature_key), never the image itself or a
// stored URL, and the frontend gets a fresh short-lived pre-signed URL every
// time it fetches an employee record. See utils/ociStorage.js.
// ---------------------------------------------------------------------------
const SIGNATURE_MAX_BYTES = 2 * 1024 * 1024; // 2MB
const SIGNATURE_ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']);
const SIGNATURE_EXT_BY_MIME = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/svg+xml': 'svg', 'image/webp': 'webp' };
const SIGNATURE_PRESIGN_TTL_SECONDS = 3600; // 1 hour — same rationale as LOGO_PRESIGN_TTL_SECONDS above.

const employeeSignatureUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: SIGNATURE_MAX_BYTES },
  fileFilter: (req, file, cb) => {
    if (!SIGNATURE_ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Only PNG, JPG, SVG or WEBP images are accepted.'));
    }
    cb(null, true);
  },
});

// Mirrors handleLogoUpload above — see its comment.
function handleSignatureUpload(req, res, next) {
  employeeSignatureUpload.single('file')(req, res, (err) => {
    if (err) {
      err.status = 400;
      if (err.code === 'LIMIT_FILE_SIZE') err.message = 'Image is too large. Maximum size is 2MB.';
      return next(err);
    }
    next();
  });
}

// Mirrors withLogoUrl above — see its comment.
async function withSignatureUrl(employee) {
  if (!employee) return employee;
  if (!employee.signatureKey) return { ...employee, signatureUrl: null };
  try {
    const signatureUrl = await getPresignedUrl(employee.signatureKey, SIGNATURE_PRESIGN_TTL_SECONDS);
    return { ...employee, signatureUrl };
  } catch (err) {
    // An object-storage hiccup shouldn't take down the whole employee
    // response — the signature just falls back to unavailable.
    console.error('Failed to sign employee signature URL:', err.message);
    return { ...employee, signatureUrl: null };
  }
}

// Employee Master bulk import — "Download Template" / "Import from Excel",
// same shape as Chart of Accounts' and Opening Balance's own import routes
// (see routes/resources.js). Registered BEFORE the crudRouter mount just
// below: router.use('/sales-employees', crudRouter(...)) installs a GET
// '/:id' route, and Express matches in registration order — if that mount
// came first, GET/POST /sales-employees/import-template|import-xlsx would
// be swallowed by it before ever reaching the routes meant to handle them.
//
// employeeCode/employeeName are the only two DB-required columns (see
// SalesEmployee model above); every other column is optional, matching the
// same required/optional split the Add/Edit form and its formatRules above
// already enforce. reportingManager is deliberately absent — it was removed
// from the model entirely (see schema.prisma) — so it was never added to
// this template's column list to begin with.
const SALES_EMPLOYEE_IMPORT_HEADERS = [
  'Employee Code', 'Employee Name', 'Email', 'Phone Number', 'Department', 'Branch',
  'Date of Joining', 'Address Line 1', 'Address Line 2', 'Country', 'State', 'City', 'Zip',
  'PAN Number', 'Alternate Mobile Number', 'Pay Mode', 'Account Number', 'IFSC Code', 'Bank Branch',
  'Status',
];

// The sample row's Department/Branch used to be hardcoded demo names
// ('Sales' / 'Head Office') that only exist in the mockdataseed.js demo
// dataset — on a real company's data, downloading the template and
// re-uploading it unmodified would fail every row with "branch/department
// not found" (exactly what happened: see the import-xlsx handler's name
// lookup below). Fixed by pulling one REAL Department/Branch name straight
// out of this company's own masters at download time, so the worked example
// always round-trips; if either master is completely empty, that column is
// just left blank in the sample (Department/Branch are optional columns —
// see SALES_EMPLOYEE_IMPORT_FIELDS below), never a made-up name.
router.get('/sales-employees/import-template', auth(), asyncHandler(async (req, res) => {
  // Prefer an Active record, but fall back to ANY record of that master —
  // the import's own name lookup below doesn't filter on status at all, so
  // restricting the sample to Active only could blank out a column whose
  // value would in fact have imported perfectly well.
  const [activeDepartment, anyDepartment, activeBranch, anyBranch] = await Promise.all([
    prisma.departmentMaster.findFirst({ where: { status: 'Active' }, orderBy: { id: 'asc' }, select: { name: true } }),
    prisma.departmentMaster.findFirst({ orderBy: { id: 'asc' }, select: { name: true } }),
    prisma.branch.findFirst({ where: { status: 'Active' }, orderBy: { id: 'asc' }, select: { branchName: true } }),
    prisma.branch.findFirst({ orderBy: { id: 'asc' }, select: { branchName: true } }),
  ]);
  const sampleDepartment = activeDepartment || anyDepartment;
  const sampleBranch = activeBranch || anyBranch;

  const buffer = buildTemplateBuffer({
    headers: SALES_EMPLOYEE_IMPORT_HEADERS,
    sampleRows: [
      [
        'EMP-001', 'Rahul Sharma', 'rahul.sharma@example.com', '9876543210',
        sampleDepartment?.name || '', sampleBranch?.branchName || '',
        '2025-01-01', '123, MG Road', '', 'India', 'Delhi', 'New Delhi', '110001',
        'ABCDE1234F', '9876500000', 'Bank', '000123456789', 'HDFC0001234', 'Connaught Place',
        'Active',
      ],
    ],
    sheetName: 'Employee Master',
  });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="employee-master-template.xlsx"');
  res.send(buffer);
}));

// Column names accepted, deliberately loose on case/spacing/punctuation
// (normaliseHeader in xlsxImport.js strips all of that) but strict on the
// actual wording, same convention as every other import route in this app.
const SALES_EMPLOYEE_IMPORT_FIELDS = [
  { field: 'employeeCode', headers: ['Employee Code', 'EmployeeCode'], required: true },
  { field: 'employeeName', headers: ['Employee Name', 'EmployeeName'], required: true },
  { field: 'email', headers: ['Email'], required: false },
  { field: 'phoneNumber', headers: ['Phone Number', 'PhoneNumber', 'Mobile Number', 'MobileNumber'], required: false },
  { field: 'department', headers: ['Department'], required: false },
  { field: 'branch', headers: ['Branch'], required: false },
  { field: 'dateOfJoining', headers: ['Date of Joining', 'DateOfJoining'], required: false },
  { field: 'addressLine1', headers: ['Address Line 1', 'AddressLine1'], required: false },
  { field: 'addressLine2', headers: ['Address Line 2', 'AddressLine2'], required: false },
  { field: 'country', headers: ['Country'], required: false },
  { field: 'state', headers: ['State'], required: false },
  { field: 'city', headers: ['City'], required: false },
  { field: 'zip', headers: ['Zip', 'Zipcode', 'Pincode'], required: false },
  { field: 'panNumber', headers: ['PAN Number', 'PANNumber', 'PAN'], required: false },
  { field: 'alternateMobileNumber', headers: ['Alternate Mobile Number', 'AlternateMobileNumber'], required: false },
  { field: 'payMode', headers: ['Pay Mode', 'PayMode'], required: false },
  { field: 'accountNumber', headers: ['Account Number', 'AccountNumber'], required: false },
  { field: 'ifscCode', headers: ['IFSC Code', 'IFSCCode', 'IFSC'], required: false },
  { field: 'bankBranch', headers: ['Bank Branch', 'BankBranch'], required: false },
  { field: 'status', headers: ['Status'], required: false },
];

const salesEmployeeXlsxUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const okExt = /\.(xlsx|xls)$/i.test(file.originalname || '');
    if (!okExt) return cb(new Error('Only .xlsx or .xls files are accepted.'));
    cb(null, true);
  },
});

// Excel stores a date as a serial day-count (or, less often, as text) —
// XLSX.js is asked not to auto-convert it (readWorkbookRows uses
// `cellDates: false`, same as every other import route) so this parses
// either shape by hand rather than trusting a JS Date XLSX guessed at.
function parseImportDate(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === '') return null;
  if (typeof raw === 'number') {
    // Excel's epoch is 1899-12-30 (its own leap-year bug included).
    const ms = Math.round((raw - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(String(raw).trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

router.post('/sales-employees/import-xlsx', auth(), salesEmployeeXlsxUpload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded. Attach an .xlsx file.' });
  }

  let sheetName;
  let rows;
  try {
    ({ sheetName, rows } = readWorkbookRows(req.file.buffer));
  } catch (err) {
    return res.status(err.status || 400).json({ success: false, message: err.message || 'Could not read the uploaded file.' });
  }

  if (!rows.length) {
    return res.status(400).json({ success: false, message: 'The uploaded sheet is empty.' });
  }

  const [headerRow, ...dataRows] = rows;

  let columnToField;
  try {
    columnToField = validateHeaders(headerRow, SALES_EMPLOYEE_IMPORT_FIELDS);
  } catch (err) {
    return res.status(err.status || 400).json({ success: false, message: err.message });
  }

  const indexToField = {};
  headerRow.forEach((h, idx) => {
    const field = columnToField[h];
    if (field) indexToField[idx] = field;
  });

  // Department/Branch are resolved by name, exactly the way the Employee
  // Master form itself picks them (a FormSelect over the live master list) —
  // matched case-insensitively so "sales"/"Sales"/"SALES" in the sheet all
  // resolve to the same DepartmentMaster row.
  const [departments, branches] = await Promise.all([
    prisma.departmentMaster.findMany({ select: { id: true, name: true } }),
    prisma.branch.findMany({ select: { id: true, branchName: true } }),
  ]);
  const departmentIdByName = new Map(departments.map((d) => [String(d.name).trim().toLowerCase(), d.id]));
  const branchIdByName = new Map(branches.map((b) => [String(b.branchName).trim().toLowerCase(), b.id]));

  // "not found" on its own is a dead end — it says the sheet is wrong but not
  // what would be right, which means opening another screen to go hunting for
  // the correct spelling. Naming the actual masters in the error turns it into
  // something the person can act on immediately (and, when a master is empty,
  // says so plainly rather than implying a name exists that they simply got
  // wrong). Capped so a company with 50 branches doesn't produce an error
  // string longer than the rest of the response.
  const nameListHint = (names, label) => {
    if (!names.length) return ` No ${label} exist yet — create one first, or leave that column blank.`;
    const shown = names.slice(0, 15).join(', ');
    const more = names.length > 15 ? `, ...(+${names.length - 15} more)` : '';
    return ` Available ${label}: ${shown}${more}.`;
  };
  const departmentNamesHint = nameListHint(departments.map((d) => d.name).filter(Boolean), 'departments');
  const branchNamesHint = nameListHint(branches.map((b) => b.branchName).filter(Boolean), 'branches');

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  for (let i = 0; i < dataRows.length; i += 1) {
    const raw = dataRows[i] || [];
    const isBlankRow = raw.every((c) => c === null || c === undefined || String(c).trim() === '');
    if (isBlankRow) continue;

    const data = {};
    Object.entries(indexToField).forEach(([idx, field]) => {
      data[field] = raw[Number(idx)];
    });

    const rowNum = i + 2; // +1 for the header row, +1 to make it 1-indexed
    const employeeCode = data.employeeCode != null ? String(data.employeeCode).trim() : '';
    const employeeName = data.employeeName != null ? String(data.employeeName).trim() : '';

    if (!employeeCode || !employeeName) {
      skipped += 1;
      errors.push(`Row ${rowNum}: missing Employee Code or Employee Name.`);
      continue;
    }

    const rawStatus = data.status != null ? String(data.status).trim() : '';
    const status = rawStatus === '' ? 'Active' : rawStatus;
    if (!['Active', 'Inactive'].some((v) => v.toLowerCase() === status.toLowerCase())) {
      skipped += 1;
      errors.push(`Row ${rowNum}: Status must be Active or Inactive, got "${status}".`);
      continue;
    }
    const normalisedStatus = status.toLowerCase() === 'active' ? 'Active' : 'Inactive';

    const departmentRaw = data.department != null ? String(data.department).trim() : '';
    let departmentId = null;
    if (departmentRaw) {
      departmentId = departmentIdByName.get(departmentRaw.toLowerCase()) ?? null;
      if (departmentId == null) {
        skipped += 1;
        errors.push(`Row ${rowNum}: department "${departmentRaw}" was not found in the Department master.${departmentNamesHint}`);
        continue;
      }
    }

    const branchRaw = data.branch != null ? String(data.branch).trim() : '';
    let branchId = null;
    if (branchRaw) {
      branchId = branchIdByName.get(branchRaw.toLowerCase()) ?? null;
      if (branchId == null) {
        skipped += 1;
        errors.push(`Row ${rowNum}: branch "${branchRaw}" was not found in the Branch master.${branchNamesHint}`);
        continue;
      }
    }

    const payModeRaw = data.payMode != null ? String(data.payMode).trim() : '';
    const payMode = payModeRaw === '' ? null : (payModeRaw.toLowerCase() === 'bank' ? 'Bank' : (payModeRaw.toLowerCase() === 'cash' ? 'Cash' : payModeRaw));

    const rowData = {
      employeeCode,
      employeeName,
      email: data.email != null && String(data.email).trim() !== '' ? String(data.email).trim() : null,
      phoneNumber: data.phoneNumber != null && String(data.phoneNumber).trim() !== '' ? String(data.phoneNumber).trim() : null,
      departmentId,
      branchId,
      dateOfJoining: parseImportDate(data.dateOfJoining),
      addressLine1: data.addressLine1 != null && String(data.addressLine1).trim() !== '' ? String(data.addressLine1).trim() : null,
      addressLine2: data.addressLine2 != null && String(data.addressLine2).trim() !== '' ? String(data.addressLine2).trim() : null,
      country: data.country != null && String(data.country).trim() !== '' ? String(data.country).trim() : null,
      state: data.state != null && String(data.state).trim() !== '' ? String(data.state).trim() : null,
      city: data.city != null && String(data.city).trim() !== '' ? String(data.city).trim() : null,
      zip: data.zip != null && String(data.zip).trim() !== '' ? String(data.zip).trim() : null,
      panNumber: data.panNumber != null && String(data.panNumber).trim() !== '' ? String(data.panNumber).trim() : null,
      alternateMobileNumber: data.alternateMobileNumber != null && String(data.alternateMobileNumber).trim() !== '' ? String(data.alternateMobileNumber).trim() : null,
      payMode,
      accountNumber: data.accountNumber != null && String(data.accountNumber).trim() !== '' ? String(data.accountNumber).trim() : null,
      ifscCode: data.ifscCode != null && String(data.ifscCode).trim() !== '' ? String(data.ifscCode).trim() : null,
      bankBranch: data.bankBranch != null && String(data.bankBranch).trim() !== '' ? String(data.bankBranch).trim() : null,
      status: normalisedStatus,
    };

    try {
      const existing = await prisma.salesEmployee.findUnique({ where: { employeeCode } });
      await prisma.salesEmployee.upsert({
        where: { employeeCode },
        update: rowData,
        create: rowData,
      });
      if (existing) updated += 1; else created += 1;
    } catch (err) {
      skipped += 1;
      errors.push(`Row ${rowNum}: ${err.message}`);
    }
  }

  res.json({
    success: true,
    message: `Imported from sheet "${sheetName}": ${created} created, ${updated} updated, ${skipped} skipped (of ${dataRows.length} data row(s)).`,
    created,
    updated,
    skipped,
    total: dataRows.length,
    errors: errors.slice(0, 50),
  });
}));

router.use('/sales-employees', crudRouter(prisma.salesEmployee, {
  searchFields: ['employeeCode', 'employeeName', 'email'],
  // employeeCode used to be server-generated from the EMP numbering series
  // (autoNumber) — switched to manual entry so the user types it themselves
  // on the Employee Master form (see SalesEmployee.jsx). employeeCode still
  // has a DB-level @unique, but that only surfaces as a raw P2002 on save,
  // so it's checked here too for a clean field-level message, same as
  // employeeName below.
  formatRules: [
    personNameField('employeeName', { label: 'Employee name' }),
    emailField('email', { optional: true, label: 'Email' }),
    mobileField('phoneNumber', { optional: true, label: 'Phone number' }),
    // New Card 2 ("Other Details") fields — format-only checks, same split
    // as every other master here: "required" is enforced client-side
    // (salesEmployeeDetailsSchema's superRefine, gated on payMode), the
    // server only ever checks the shape of what's actually sent.
    mobileField('alternateMobileNumber', { optional: true, label: 'Alternate mobile number' }),
    panField('panNumber', { optional: true, label: 'PAN' }),
    accountNumberField('accountNumber', { optional: true, label: 'Account number' }),
    ifscField('ifscCode', { optional: true, label: 'IFSC code' }),
  ],
  // signatureKey is never client-settable through this general-purpose
  // create/update route — the only way to change it is the dedicated
  // POST/DELETE /sales-employees/:id/signature routes below, same reasoning
  // as logoKey's exclusion from PUT /company/details above.
  // approvalAuthorization is a plain boolean field and needs no such
  // protection — it passes through untouched.
  transform: (body) => {
    const { signatureKey, ...rest } = body;
    return rest;
  },
  // Attaches a fresh pre-signed signatureUrl to every row this resource
  // returns (list and single-record reads alike — see the annotate hook on
  // getOne in crudFactory.js).
  annotate: async (rows) => Promise.all(rows.map(withSignatureUrl)),
  validate: async ({ data, id, delegate }) => {
    await assertUnique(delegate, {
      id,
      data,
      fields: [
        { field: 'employeeCode', label: 'Employee code' },
        { field: 'employeeName', label: 'Employee name' },
      ],
    });
  },
}));

router.post('/sales-employees/:id/signature', auth(), handleSignatureUpload, asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded. Attach a PNG, JPG, SVG or WEBP image.' });
  }

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid record id' });
  }

  const employee = await prisma.salesEmployee.findUnique({ where: { id } });
  if (!employee) return res.status(404).json({ success: false, message: 'Record not found' });

  const ext = SIGNATURE_EXT_BY_MIME[req.file.mimetype] || 'png';
  const key = `sales-employees/${employee.id}/signature/${crypto.randomUUID()}.${ext}`;
  const previousKey = employee.signatureKey;

  // Upload first, persist the key second — same ordering (and same reasoning)
  // as the Company Logo upload above.
  await uploadObject(key, req.file.buffer, req.file.mimetype);

  let updated;
  try {
    updated = await prisma.salesEmployee.update({ where: { id }, data: { signatureKey: key } });
  } catch (dbErr) {
    await deleteObject(key).catch(() => {});
    throw dbErr;
  }

  if (previousKey && previousKey !== key) {
    deleteObject(previousKey).catch((err) => {
      console.error('Failed to delete previous employee signature object:', err.message);
    });
  }

  res.json({ success: true, data: await withSignatureUrl(updated) });
}));

router.delete('/sales-employees/:id/signature', auth(), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid record id' });
  }

  const employee = await prisma.salesEmployee.findUnique({ where: { id } });
  if (!employee || !employee.signatureKey) {
    return res.json({ success: true, data: await withSignatureUrl(employee) });
  }

  const keyToDelete = employee.signatureKey;
  const updated = await prisma.salesEmployee.update({ where: { id }, data: { signatureKey: null } });
  await deleteObject(keyToDelete).catch((err) => {
    console.error('Failed to delete employee signature object:', err.message);
  });

  res.json({ success: true, data: await withSignatureUrl(updated) });
}));

// Approval Flow — a master/detail resource (ApprovalFlow has many
// ApprovalFlowLevel rows), so it can't use the generic crudRouter, which
// only knows flat records. These bespoke routes mirror crudRouter's URL
// shape (GET /, GET /:id, POST /, PUT /:id, DELETE /:id) so the frontend
// can still use the generic createCrudApi hook-set against them.
const approvalFlowInclude = { levels: { orderBy: { levelOrder: 'asc' } } };

function toLevelData(level, index) {
  return {
    levelName: level.levelName || `Level ${index + 1}`,
    approverType: level.approverType || 'User',
    approver: level.approver,
    fromAmount: level.fromAmount ?? 0,
    toAmount: level.toAmount === '' || level.toAmount == null ? null : level.toAmount,
    requiredAction: level.requiredAction || 'Approve',
    levelOrder: index + 1,
  };
}

router.get('/approval-flows', auth(), asyncHandler(async (req, res) => {
  const { q } = req.query;
  const where = q ? { transactionName: { contains: q } } : undefined;
  const rows = await prisma.approvalFlow.findMany({ where, include: approvalFlowInclude, orderBy: { id: 'desc' } });
  res.json({ success: true, data: rows });
}));

router.get('/approval-flows/:id', auth(), asyncHandler(async (req, res) => {
  const row = await prisma.approvalFlow.findUnique({ where: { id: Number(req.params.id) }, include: approvalFlowInclude });
  if (!row) return res.status(404).json({ success: false, message: 'Record not found' });
  res.json({ success: true, data: row });
}));

router.post('/approval-flows', auth(), asyncHandler(async (req, res) => {
  const { levels = [], ...flow } = req.body;
  // Master/detail resource, so it never goes through crudFactory's `validate`
  // hook (see the comment above) -- checked by hand here instead, same
  // normalized-comparison rule as every other Company Setup master.
  await assertUnique(prisma.approvalFlow, {
    id: null,
    data: flow,
    fields: [{ field: 'transactionName', label: 'Transaction' }],
  });
  const row = await prisma.approvalFlow.create({
    data: {
      ...flow,
      levels: { create: levels.map(toLevelData) },
    },
    include: approvalFlowInclude,
  });
  res.status(201).json({ success: true, data: row });
}));

router.put('/approval-flows/:id', auth(), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { levels = [], ...flow } = req.body;
  await assertUnique(prisma.approvalFlow, {
    id,
    data: flow,
    fields: [{ field: 'transactionName', label: 'Transaction' }],
  });
  // Replace the level set wholesale on every save — simpler and safer than
  // diffing which rows were added/removed/reordered client-side.
  const row = await prisma.$transaction(async (tx) => {
    await tx.approvalFlowLevel.deleteMany({ where: { approvalFlowId: id } });
    return tx.approvalFlow.update({
      where: { id },
      data: {
        ...flow,
        levels: { create: levels.map(toLevelData) },
      },
      include: approvalFlowInclude,
    });
  });
  res.json({ success: true, data: row });
}));

router.delete('/approval-flows/:id', auth(), asyncHandler(async (req, res) => {
  // ApprovalFlowLevel.approvalFlow has onDelete: Cascade, so levels go with it.
  await prisma.approvalFlow.delete({ where: { id: Number(req.params.id) } });
  res.json({ success: true, message: 'Deleted successfully' });
}));

module.exports = router;
// Attached onto the router function rather than replacing the default
// export — `router` is what app.js mounts, this just also exposes the two
// pure pieces of the tax-code duplicate check for direct unit testing (see
// tests/taxCode.test.js) without standing up an Express app + database.
module.exports.normaliseTaxLabel = normaliseTaxLabel;
module.exports.findDuplicateTaxCode = findDuplicateTaxCode;
