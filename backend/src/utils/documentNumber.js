/**
 * Shared entry point every route goes through to get its "No." field.
 *
 * This used to live inline in routes/resources.js, which was fine while only
 * the sixteen bespoke transaction routes needed it. The twelve master records
 * (customer, product, branch, ...) are served by the generic CRUD factory, so
 * the logic had to move somewhere both can reach.
 *
 * Two paths, mirroring SAP B1:
 *
 *   - Manual Entry off (the normal case) — burn the next number from the
 *     document type's default series, ignoring whatever the client sent
 *     entirely. The frontend's DocumentNoField pre-fills the field with the
 *     suggested number and locks it, but that is only a *preview*: it was
 *     never reserved, may already be stale by the time the request lands, and
 *     the field being non-blank on the wire must NOT be read as "the user
 *     typed this", or every auto-generate save trips the manual-entry
 *     rejection below.
 *
 *   - Manual Entry on — the field was editable, so whatever the client
 *     submitted is authoritative: validate it against the series
 *     pattern/range rather than trusting it verbatim, and return a
 *     syncManual() callback the caller must invoke *after* the record is
 *     created, so the counter never later hands out a number the user has
 *     already used.
 *
 * Must be called with the transaction the record itself is created in.
 * Enlisting in the caller's transaction is what makes a failed save roll back
 * the number it consumed instead of burning a permanent gap in the sequence.
 */

const {
  allocateDocumentNumber,
  resolveSeries,
  validateManualNumber,
  syncAfterManualNumber,
  DocumentNumberError,
} = require('../services/documentNumberService');

/**
 * @param {string} documentCode  catalog code, e.g. 'PO' or 'CUS'
 * @param {*}      typedNumber   whatever the client sent in the number field
 * @param {object} tx            the Prisma transaction the record is created in
 * @param {number|string|null} seriesId  explicit series to number from (e.g. a
 *   user-chosen non-default series on Sales Quotation/Sales Invoice create).
 *   Null means "use this document type's default series", the original
 *   behaviour. Resolved once here and then pinned by series.id on the
 *   allocate call below, so allocate can never re-derive a different series
 *   than the one just validated (e.g. if the default changed between calls).
 * @returns {{ documentNumber: string, syncManual: (() => Promise)|null }}
 */
async function resolveDocumentNumber(documentCode, typedNumber, tx, seriesId = null) {
  const series = await resolveSeries(documentCode, { client: tx, seriesId });

  if (!series.manualEntry) {
    const { documentNumber } = await allocateDocumentNumber(documentCode, { tx, seriesId: series.id });
    return { documentNumber, syncManual: null };
  }

  const trimmed = typedNumber != null ? String(typedNumber).trim() : '';
  if (!trimmed) {
    // Manual Entry is on but the client sent nothing (a request that bypassed
    // the form) — auto-allocate rather than saving a blank document number,
    // as long as the series also allows it.
    const { documentNumber } = await allocateDocumentNumber(documentCode, { tx, seriesId: series.id });
    return { documentNumber, syncManual: null };
  }

  const result = validateManualNumber(series, trimmed);
  if (!result.valid) {
    throw new DocumentNumberError(result.reason, { status: 400, code: 'INVALID_MANUAL_NUMBER' });
  }
  return {
    documentNumber: result.documentNumber,
    // result.value is only set when the typed number happened to parse
    // against this series' own pattern (see validateManualNumber/
    // extractSeriesValue) — a genuinely free-form value (no digits this
    // series would recognise as its own) has nothing for the counter to
    // sync against, so syncManual is skipped rather than pushed a bogus
    // number.
    syncManual: result.value != null ? () => syncAfterManualNumber(series.id, result.value, { tx }) : null,
  };
}

module.exports = { resolveDocumentNumber };
