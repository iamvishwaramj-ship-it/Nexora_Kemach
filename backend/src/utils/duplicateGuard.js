// Shared duplicate-prevention check for the simple named masters under
// Company Setup (and any other resource with a human-typed "name" column).
// Mirrors the normalization idea proven out by Tax Code's
// findDuplicateTaxCode/normaliseTaxLabel in routes/company.js: "ABC Bank"
// and " abc  bank " should read as the same value to a person, so
// comparisons collapse whitespace and case before matching -- a DB-level
// unique index alone can't express that, which is also why this
// deliberately is NOT a Prisma @unique constraint (see routes/company.js's
// Tax Code precedent, and the comment on PROTECTED_FIELDS in crudFactory.js
// for the same "don't trust the client, don't trust the DB alone" pattern).
//
// Wired in as crudFactory's `validate` hook (see utils/crudFactory.js) so it
// runs on both create AND update, before the write, without a bespoke
// POST/PUT pair per resource -- `id` is null on create (nothing to exclude)
// and the record's own id on update (excluded from its own check, so saving
// a row back with its existing value never falsely flags itself).

const normalize = (v) => String(v ?? '').replace(/\s+/g, '').toLowerCase();

// Date-valued columns (e.g. FinancialYear.startDate/endDate) can't go through
// the string `normalize` above: the incoming request body carries an ISO
// string, while a row just read back from Prisma carries a JS Date object,
// and `String(aDateObject)` ("Tue Apr 01 2026 00:00:00 GMT+0000 (...)")
// never matches `String("2026-04-01")` even when they're the same calendar
// day. Both sides go through `new Date(...)` first so a plain date string,
// a datetime string, and a Date object all collapse to the same
// day-only key; time-of-day is intentionally ignored since these columns
// only ever mean a whole day. Invalid/empty input normalizes to '' so it's
// filtered out the same way an unset string field is.
const normalizeDate = (v) => {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

// 'financialYearName' -> 'Financial year name' -- only used when a caller
// passes a bare field name and no explicit label.
function humanize(field) {
  const spaced = field.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * @param {object} delegate - Prisma model delegate (e.g. prisma.branch)
 * @param {object} opts
 *   id:    number|null - the record being saved. null on create; on update,
 *          pass the row's own id so it's excluded from its own dupe check.
 *   fields: Array<string | { field: string, label?: string }> - the columns
 *          that must be unique. Each is checked independently and OR'd
 *          together -- this is "no two rows may share a normalized value on
 *          ANY of these columns", not a compound/AND key. That's the same
 *          shape Tax Code's existing code-OR-name check already uses, and
 *          passing e.g. ['taxCode', 'taxName'] reproduces it exactly.
 *   data:  object - the payload being written (the create/update `data`)
 *   label: string  - optional human name for the record type. When a field
 *          entry doesn't carry its own `label`, one is derived from the
 *          field name instead (see humanize above).
 * @throws {Error} status 400, shaped like routes/company.js's badRequest():
 *   { message, errors: [{ field, message }] } -- picked up as-is by
 *   middleware/errorHandler.js.
 */
async function assertUnique(delegate, { id = null, fields, data, label }) {
  if (!fields || !fields.length) return;

  const checks = fields
    .map((f) => (typeof f === 'string' ? { field: f } : f))
    .map((f) => ({ label: f.label || (label && fields.length === 1 ? label : humanize(f.field)), ...f }))
    // `type: 'date'` opts a field into day-only Date-vs-ISO-string-safe
    // comparison instead of the default whitespace/case-insensitive string
    // one -- see normalizeDate above.
    .map((f) => ({ ...f, normalizeFn: f.type === 'date' ? normalizeDate : normalize }))
    .map((f) => ({ ...f, norm: f.normalizeFn(data[f.field]) }))
    // Nothing to compare an unset/blank field against -- required-ness is a
    // separate concern (formatRules), not this helper's job.
    .filter((f) => f.norm);

  if (!checks.length) return;

  const rows = await delegate.findMany({
    where: id ? { id: { not: id } } : undefined,
    select: { id: true, ...Object.fromEntries(checks.map((c) => [c.field, true])) },
  });

  for (const row of rows) {
    const hit = checks.find((c) => c.normalizeFn(row[c.field]) === c.norm);
    if (!hit) continue;
    const message = hit.type === 'date'
      ? `${hit.label} "${hit.norm}" is already used by another record.`
      : `${hit.label} "${row[hit.field]}" already exists -- differing only by spacing/case does not make it unique.`;
    const err = new Error(message);
    err.status = 400;
    err.errors = [{ field: hit.field, message }];
    throw err;
  }
}

module.exports = { assertUnique, normalize };
