const { body, validationResult } = require('express-validator');

/**
 * Server-side mirror of frontend/src/lib/validation/common.js.
 *
 * The frontend got a full pass of Zod format validation (names, account
 * numbers, IFSC, phone, email, PAN, GST, Aadhaar, pincode, HSN, quantities,
 * percentages, date ranges) — none of it is enforced here, so a crafted API
 * request bypasses every one of those rules. This module gives resources.js/
 * company.js (and crudRouter.js, via the `formatRules` option) the same
 * checks as express-validator chain builders, with messages that read the
 * same as their Zod counterparts.
 *
 * Deliberately does NOT mutate req.body — see the judgment-call note on
 * normalize*() below. Every builder validates a *normalized* copy of the
 * value (trimmed, case-folded, separators stripped) without writing that
 * normalized value back, so a resource's own `transform`/handler still sees
 * exactly what the client sent. Regexes/limits are mirrored 1:1 from
 * common.js; keep the two in sync if either changes.
 */

// --- Regexes (mirror frontend/src/lib/validation/common.js) ---------------

const PERSON_NAME_RE = /^[A-Za-z\s.'-]+$/;
const ENTITY_NAME_RE = /^[A-Za-z0-9\s.,&\-/()]+$/;
// Stricter name rule for Product Setup screens only — see strictNameField()
// below. Deliberately NOT the same as ENTITY_NAME_RE, which stays in use
// everywhere else.
const STRICT_NAME_RE = /^[A-Za-z][A-Za-z0-9 _-]*$/;
// Tax Code / Tax Name only — see taxLabelField() below. No character-set
// restriction is enforced for these two fields any more; kept exported
// (matching "any symbol") only for anything still importing it.
const TAX_LABEL_RE = /^.*$/;
const ACCOUNT_NUMBER_RE = /^\d{9,18}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const MOBILE_RE = /^[6-9]\d{9}$/;
const PHONE_RE = /^\d{6,15}$/;
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z][A-Z0-9]$/;
const AADHAAR_RE = /^[2-9]\d{11}$/;
const PINCODE_RE = /^\d{6}$/;
const HSN_RE = /^\d{4}(\d{2}(\d{2})?)?$/;

// --- Normalizers (used ONLY to validate a copy — see file doc above) ------

/** Strips a "+91"/"91" country code or a leading "0" trunk prefix, and any
 *  space/hyphen grouping — same rule as common.js's stripMobilePrefix(). */
function normalizeMobile(v) {
  if (typeof v !== 'string') return v;
  return v.trim().replace(/[\s-]/g, '').replace(/^(\+?91|0)/, '');
}

/** Strips space/hyphen/parenthesis grouping — mirrors stripPhoneSeparators(). */
function normalizePhone(v) {
  if (typeof v !== 'string') return v;
  return v.trim().replace(/[\s\-()]/g, '');
}

/** Strips whitespace used to group digits (account no., Aadhaar). */
function normalizeDigits(v) {
  if (typeof v !== 'string') return v;
  return v.trim().replace(/\s+/g, '');
}

/** Trim + uppercase — PAN/GSTIN/IFSC are conventionally written upper-case. */
function normalizeUpper(v) {
  if (typeof v !== 'string') return v;
  return v.trim().toUpperCase();
}

/** Strips the dotted customs-tariff-style separators real codes are often
 *  written/pasted with (e.g. "4012.90.90") — mirrors common.js's
 *  stripHsnSeparators(). Without this, a code that is perfectly valid once
 *  the punctuation is removed fails HSN_RE outright. */
function normalizeHsn(v) {
  if (typeof v !== 'string') return v;
  return v.trim().replace(/[.\s-]/g, '');
}

function isBlank(v) {
  return v === undefined || v === null || v === '';
}

// --- Field builders ---------------------------------------------------

function personNameField(fieldName, { optional = false, label = fieldName } = {}) {
  let chain = body(fieldName);
  chain = optional
    ? chain.optional({ checkFalsy: true })
    : chain.custom((v) => !isBlank(v)).withMessage(`${label} is required`);
  chain = chain
    .custom((v) => isBlank(v) || String(v).trim().length >= 2)
    .withMessage(`${label} must be at least 2 characters`)
    .custom((v) => isBlank(v) || PERSON_NAME_RE.test(String(v).trim()))
    .withMessage(`${label} can only contain letters`);
  return chain;
}

function entityNameField(fieldName, { optional = false, label = fieldName } = {}) {
  let chain = body(fieldName);
  chain = optional
    ? chain.optional({ checkFalsy: true })
    : chain.custom((v) => !isBlank(v)).withMessage(`${label} is required`);
  chain = chain
    .custom((v) => isBlank(v) || ENTITY_NAME_RE.test(String(v).trim()))
    .withMessage(`${label} can only contain letters, numbers and . , & - / ( )`)
    .custom((v) => isBlank(v) || /[A-Za-z]/.test(String(v).trim()))
    .withMessage(`${label} must contain at least one letter`);
  return chain;
}

/**
 * Tax Code / Tax Name only — modeled on entityNameField() above but allowing
 * `% _` alongside the usual `. , & - / ( )`, since real tax labels look like
 * "GST 18%" or a hand-typed "GST_18%". NOT a replacement for entityNameField
 * anywhere else — every other master (Business Partner, Product, ...) keeps
 * using entityNameField/ENTITY_NAME_RE unchanged.
 */
function taxLabelField(fieldName, { optional = false, label = fieldName } = {}) {
  let chain = body(fieldName);
  chain = optional
    ? chain.optional({ checkFalsy: true })
    : chain.custom((v) => !isBlank(v)).withMessage(`${label} is required`);
  chain = chain
    .custom((v) => isBlank(v) || /[A-Za-z]/.test(String(v).trim()))
    .withMessage(`${label} must contain at least one letter`);
  return chain;
}

/**
 * Server-side mirror of frontend common.js's strictName()/optionalStrictName()
 * — a deliberately stricter rule than entityNameField() above, wired ONLY
 * into the Product Setup master routes that already had entityNameField on
 * them (product-groups, product-sub-groups, brands, uoms, currencies). Not
 * a replacement for entityNameField elsewhere.
 */
function strictNameField(fieldName, { optional = false, label = fieldName } = {}) {
  let chain = body(fieldName);
  chain = optional
    ? chain.optional({ checkFalsy: true })
    : chain.custom((v) => !isBlank(v)).withMessage(`${label} is required`);
  chain = chain
    .custom((v) => isBlank(v) || STRICT_NAME_RE.test(String(v).trim()))
    .withMessage(`${label} must start with a letter and can only contain letters, numbers, spaces, hyphens and underscores.`);
  return chain;
}

function accountNumberField(fieldName, { optional = true, label = 'Account number' } = {}) {
  let chain = body(fieldName);
  chain = optional
    ? chain.optional({ checkFalsy: true })
    : chain.custom((v) => !isBlank(v)).withMessage(`${label} is required`);
  return chain
    .custom((v) => isBlank(v) || ACCOUNT_NUMBER_RE.test(normalizeDigits(v)))
    .withMessage(`${label} must be 9-18 digits`);
}

function ifscField(fieldName, { optional = true, label = 'IFSC code' } = {}) {
  let chain = body(fieldName);
  chain = optional
    ? chain.optional({ checkFalsy: true })
    : chain.custom((v) => !isBlank(v)).withMessage(`${label} is required`);
  return chain
    .custom((v) => isBlank(v) || IFSC_RE.test(normalizeUpper(v)))
    .withMessage(`Enter a valid ${label} (e.g. SBIN0001234)`);
}

function mobileField(fieldName, { optional = true, label = 'Mobile number' } = {}) {
  let chain = body(fieldName);
  chain = optional
    ? chain.optional({ checkFalsy: true })
    : chain.custom((v) => !isBlank(v)).withMessage(`${label} is required`);
  return chain
    .custom((v) => isBlank(v) || MOBILE_RE.test(normalizeMobile(v)))
    .withMessage(`${label} must be 10 digits starting with 6-9`);
}

function phoneField(fieldName, { optional = true, label = 'Phone number' } = {}) {
  let chain = body(fieldName);
  chain = optional
    ? chain.optional({ checkFalsy: true })
    : chain.custom((v) => !isBlank(v)).withMessage(`${label} is required`);
  return chain
    .custom((v) => isBlank(v) || PHONE_RE.test(normalizePhone(v)))
    .withMessage(`${label} must be 6-15 digits`);
}

function emailField(fieldName, { optional = true, label = 'Email' } = {}) {
  let chain = body(fieldName);
  chain = optional ? chain.optional({ checkFalsy: true }) : chain.exists({ checkFalsy: true }).withMessage(`${label} is required`);
  return chain.isEmail().withMessage(`Enter a valid ${label.toLowerCase()}`);
}

function panField(fieldName, { optional = true, label = 'PAN' } = {}) {
  let chain = body(fieldName);
  chain = optional
    ? chain.optional({ checkFalsy: true })
    : chain.custom((v) => !isBlank(v)).withMessage(`${label} is required`);
  return chain
    .custom((v) => isBlank(v) || PAN_RE.test(normalizeUpper(v)))
    .withMessage(`Enter a valid ${label}`);
}

function gstinField(fieldName, { optional = true, label = 'GSTIN' } = {}) {
  let chain = body(fieldName);
  chain = optional
    ? chain.optional({ checkFalsy: true })
    : chain.custom((v) => !isBlank(v)).withMessage(`${label} is required`);
  return chain
    .custom((v) => isBlank(v) || GSTIN_RE.test(normalizeUpper(v)))
    .withMessage(`Enter a valid ${label}`);
}

function aadhaarField(fieldName, { optional = true, label = 'Aadhaar number' } = {}) {
  let chain = body(fieldName);
  chain = optional
    ? chain.optional({ checkFalsy: true })
    : chain.custom((v) => !isBlank(v)).withMessage(`${label} is required`);
  return chain
    .custom((v) => isBlank(v) || AADHAAR_RE.test(normalizeDigits(v)))
    .withMessage(`${label} must be exactly 12 digits`);
}

function pincodeField(fieldName, { optional = true, label = 'Pincode' } = {}) {
  let chain = body(fieldName);
  chain = optional
    ? chain.optional({ checkFalsy: true })
    : chain.custom((v) => !isBlank(v)).withMessage(`${label} is required`);
  return chain
    .custom((v) => isBlank(v) || PINCODE_RE.test(String(v).trim()))
    .withMessage(`${label} must be exactly 6 digits`);
}

function hsnField(fieldName, { optional = true, label = 'HSN/SAC code' } = {}) {
  let chain = body(fieldName);
  chain = optional
    ? chain.optional({ checkFalsy: true })
    : chain.custom((v) => !isBlank(v)).withMessage(`${label} is required`);
  return chain
    .custom((v) => isBlank(v) || HSN_RE.test(normalizeHsn(v)))
    .withMessage(`${label} must be 4, 6 or 8 digits`);
}

/**
 * Non-negative (or strictly positive, with allowZero:false) number field —
 * mirrors nonNegativeNumber()/positiveNumber() in common.js. `max`, when
 * given, mirrors the same field's upper bound there (e.g. percentage()'s 100,
 * currencyAmount()'s 999999999.99).
 */
function nonNegativeNumberField(fieldName, { max, allowZero = true, optional = true, label = fieldName } = {}) {
  let chain = body(fieldName);
  chain = optional
    ? chain.optional({ checkFalsy: true })
    : chain.custom((v) => !isBlank(v)).withMessage(`${label} is required`);
  chain = chain
    .custom((v) => isBlank(v) || !Number.isNaN(Number(v)))
    .withMessage(`${label} must be a number`)
    .custom((v) => isBlank(v) || Number(v) >= (allowZero ? 0 : Number.EPSILON))
    .withMessage(allowZero ? `${label} cannot be negative` : `${label} must be greater than 0`);
  if (max !== undefined) {
    chain = chain.custom((v) => isBlank(v) || Number(v) <= max).withMessage(`${label} cannot exceed ${max}`);
  }
  return chain;
}

/** Percentage: non-negative, capped at 100 — mirrors percentage() in common.js. */
function percentageField(fieldName, { optional = true, label = 'Percentage' } = {}) {
  return nonNegativeNumberField(fieldName, { max: 100, optional, label });
}

// Reduces a Date to "its calendar day", ignoring time-of-day — mirrors
// toCalendarDay() in frontend/src/lib/validation/common.js. See that copy's
// doc comment for why comparing raw instants broke Payment Terms =
// Immediate (Due Date built at UTC-midnight vs Invoice Date built as
// "right now") for every invoice raised after 05:30 AM IST: this is the
// server-side half of the same fix, on the same reasoning, since this
// route-level check re-validates whatever the frontend already computed.
const toCalendarDay = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * Cross-field date-range check — mirrors dateRange() in common.js. Not a
 * plain field-format rule: it reads BOTH fields off req.body, so it must run
 * after the individual field chains (it's still just another entry in the
 * `rules` array passed to runValidators — express-validator chains are
 * middleware, and this returns one).
 */
function dateRangeCheck(startField, endField, { allowEqual = true, startLabel, endLabel } = {}) {
  const sLabel = startLabel || startField;
  const eLabel = endLabel || endField;
  return body(endField)
    .optional({ checkFalsy: true, nullable: true })
    .custom((value, { req }) => {
      const start = req.body ? req.body[startField] : undefined;
      const end = value;
      if (isBlank(start) || isBlank(end)) return true;
      const sd = new Date(start);
      const ed = new Date(end);
      if (Number.isNaN(sd.getTime()) || Number.isNaN(ed.getTime())) return true;
      const startDay = toCalendarDay(sd);
      const endDay = toCalendarDay(ed);
      const invalid = allowEqual ? endDay < startDay : endDay <= startDay;
      if (invalid) throw new Error(`${eLabel} cannot be before ${sLabel}`);
      return true;
    });
}

/**
 * Runs `rules` (an array of express-validator chains) against the request,
 * then responds 400 on failure in the SAME shape errorHandler.js already
 * produces for badRequest()-style errors (see routes/company.js's own
 * badRequest and frontend/src/lib/formErrors.js, which reads exactly this
 * shape via `err.data.errors`, an array of { field, message }):
 *
 *   { success: false, message: <first error>, errors: [{ field, message }] }
 *
 * On success, calls next() so the wrapped handler runs unchanged.
 */
function runValidators(rules) {
  const list = typeof rules === 'function' ? rules() : rules;
  return async function formatValidatorsMiddleware(req, res, next) {
    for (const rule of list) {
      // eslint-disable-next-line no-await-in-loop
      await rule.run(req);
    }
    const result = validationResult(req);
    if (result.isEmpty()) return next();

    const seen = new Set();
    const errors = [];
    for (const e of result.array()) {
      const field = e.path || e.param || null;
      const key = field || e.msg;
      if (seen.has(key)) continue;
      seen.add(key);
      errors.push({ field, message: e.msg });
    }
    return res.status(400).json({
      success: false,
      message: errors[0]?.message || 'Validation failed',
      errors,
    });
  };
}

module.exports = {
  // Regexes
  PERSON_NAME_RE,
  ENTITY_NAME_RE,
  TAX_LABEL_RE,
  ACCOUNT_NUMBER_RE,
  IFSC_RE,
  MOBILE_RE,
  PHONE_RE,
  PAN_RE,
  GSTIN_RE,
  AADHAAR_RE,
  PINCODE_RE,
  HSN_RE,
  // Normalizers
  normalizeMobile,
  normalizePhone,
  normalizeDigits,
  normalizeUpper,
  normalizeHsn,
  // Field builders
  personNameField,
  entityNameField,
  taxLabelField,
  strictNameField,
  accountNumberField,
  ifscField,
  mobileField,
  phoneField,
  emailField,
  panField,
  gstinField,
  aadhaarField,
  pincodeField,
  hsnField,
  nonNegativeNumberField,
  percentageField,
  dateRangeCheck,
  // Runner
  runValidators,
};
