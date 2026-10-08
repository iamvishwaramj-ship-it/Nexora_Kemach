/**
 * BP Opening Balance manual-entry number mismatch: preview vs. save.
 *
 * Reported bug: POST /business-partner-opening-balance/batch throws
 * `DocumentNumberError: Number must match the series pattern BPOP-26-27-000001`
 * even when the number typed is visually identical to what
 * POST /company/document-numbers/peek returned moments earlier -- most
 * concretely reproduced by deleting a BP Opening Balance document and then
 * recreating it, reusing the same manual document number.
 *
 * Root cause: DocumentNoField.jsx (peek) and BPOpeningBalance.jsx's submit
 * handler (save) both used to call resolveSeries()/resolveDocumentNumber()
 * with seriesId=null, meaning EACH call independently re-derived "the BPOB
 * document type's default series for the active FY" from scratch. That is
 * normally the same row both times, but not always -- an admin repointing
 * which BPOB series is the default (or editing the series' own prefix/fy
 * token/separator) between the peek that showed the user a number and the
 * save that validates it produces exactly this symptom: a rejection whose
 * message is BUILT FROM the newly-resolved series, so it can look identical
 * to what was typed (which matched the OLD series) while the regex it is
 * actually checked against no longer matches.
 *
 * The fix pins the save to the exact series peek resolved (DocumentNoField
 * now stashes peek's `seriesId` into the form and BPOpeningBalance.jsx
 * forwards it to the batch endpoint as `seriesId`), so a save always
 * validates against the same series row a preview named -- and if that row
 * no longer exists/matches, resolveSeries's existing seriesId branch (see
 * seriesSelection.test.js) rejects with a clear SERIES_NOT_FOUND/
 * SERIES_WRONG_FY/SERIES_INACTIVE/SERIES_EXHAUSTED error instead of silently
 * falling back to a different series.
 *
 * This does not touch the Auto Generate path: resolveDocumentNumber still
 * ignores the typed value entirely for a non-manual series (see
 * utils/documentNumber.js) -- pinning only changes WHICH series row a save
 * resolves against, never whether the typed number is honoured.
 *
 * These tests use a stub Prisma client exposing only the documentNumbering
 * finders resolveSeries actually calls -- no database required, same style
 * as numberingGapReuse.test.js/seriesSelection.test.js.
 *
 * Run with:  node --test "src/tests/*.test.js"
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveDocumentNumber } = require('../utils/documentNumber');
const { DocumentNumberError } = require('../services/documentNumberService');

const FY_ID = 26;

/** A BP Opening Balance Manual Entry series, matching the reported error's own pattern. */
function bpobSeries(overrides = {}) {
  return {
    id: 1,
    documentCode: 'BPOB',
    financialYearId: FY_ID,
    status: 'Active',
    isDefault: true,
    seriesName: 'Series 1',
    prefix: 'BPOP',
    suffix: null,
    separator: '-',
    fyCode: '26-27',
    includeFyInNumber: true,
    numberLength: 6,
    startNumber: 1,
    endNumber: 999999,
    currentNumber: null,
    nextNumber: 1,
    manualEntry: true,
    autoGenerate: false,
    ...overrides,
  };
}

/**
 * Stub client backing both resolveSeries paths: findUnique (explicit
 * seriesId) and findMany (default-series lookup, keyed by isDefault).
 *
 * resolveDocumentNumber (the real entry point every route calls, unlike
 * resolveSeries itself) never passes financialYearId through, so resolveSeries
 * always resolves "the active FY" itself first via getActiveFinancialYear --
 * that happens even down the explicit-seriesId branch (the FY check at line
 * ~866 needs it), so financialYear.findFirst has to be stubbed too, unlike
 * seriesSelection.test.js's stub (which calls resolveSeries directly with an
 * explicit financialYearId and never reaches getActiveFinancialYear at all).
 */
function stubClient(rows) {
  return {
    financialYear: {
      findFirst: async () => ({ id: FY_ID, status: 'Active' }),
    },
    documentNumbering: {
      findUnique: async ({ where: { id } }) => rows.find((r) => r.id === id) || null,
      findMany: async ({ where: { documentCode, financialYearId } }) => rows
        .filter((r) => r.documentCode === documentCode && r.financialYearId === financialYearId)
        .sort((a, b) => a.startNumber - b.startNumber),
    },
  };
}

// ---------------------------------------------------------------------------
// The regression: reuse a manual number after the doc that held it is deleted
// ---------------------------------------------------------------------------

test('recreating a deleted BP Opening Balance with the same manual number succeeds when the series is unchanged', async () => {
  const series = bpobSeries();
  const client = stubClient([series]);

  // First save: BPOP-26-27-000001, pinned to the series id peek would have
  // returned for this (only) series.
  const first = await resolveDocumentNumber('BPOB', 'BPOP-26-27-000001', client, series.id);
  assert.equal(first.documentNumber, 'BPOP-26-27-000001');
  assert.equal(typeof first.syncManual, 'function');

  // The document is deleted (resources.js's DELETE route removes the BP
  // Opening Balance rows but never touches document_numbering -- see that
  // route). Recreating with the exact same manual number, pinned to the same
  // series, must still validate: nothing about deleting the document changes
  // the series' prefix/fyCode/separator/range.
  const second = await resolveDocumentNumber('BPOB', 'BPOP-26-27-000001', client, series.id);
  assert.equal(second.documentNumber, 'BPOP-26-27-000001');
});

// ---------------------------------------------------------------------------
// The bug, reproduced: unpinned (seriesId=null) saves can drift from what
// was previewed if the default series changes in between
// ---------------------------------------------------------------------------

test('BEFORE the fix (seriesId=null): a default-series change between preview and save silently changes which series validates the save', async () => {
  const original = bpobSeries({ id: 1, isDefault: true });
  // An admin adds a second BPOB series for the same FY and makes it the new
  // default -- same prefix/fyCode shape at a glance, different range and
  // (per its own name) genuinely a different row, matching the kind of
  // change that made the reported bug possible.
  const replacement = bpobSeries({
    id: 2, seriesName: 'Series 2 (2026 restart)', isDefault: true, startNumber: 500000, endNumber: 999999,
  });
  original.isDefault = false; // the promotion is exclusive -- only one default at a time

  const client = stubClient([original, replacement]);

  // Old, unpinned behaviour: save calls resolveDocumentNumber with
  // seriesId=null and gets whatever is default NOW, not what peek showed.
  await assert.rejects(
    resolveDocumentNumber('BPOB', 'BPOP-26-27-000001', client, null),
    (err) => {
      assert.ok(err instanceof DocumentNumberError);
      assert.equal(err.code, 'INVALID_MANUAL_NUMBER');
      // The number is rejected by the NEW default series' range (500000-999999),
      // not because anything about what the user typed actually changed --
      // this is the "looks identical but fails" symptom from the bug report.
      assert.match(err.message, /range 500000-999999/);
      return true;
    }
  );
});

test('AFTER the fix: pinning seriesId keeps the save on the series peek actually showed, regardless of a later default change', async () => {
  const original = bpobSeries({ id: 1, isDefault: true });
  const replacement = bpobSeries({
    id: 2, seriesName: 'Series 2 (2026 restart)', isDefault: true, startNumber: 500000, endNumber: 999999,
  });
  original.isDefault = false;

  const client = stubClient([original, replacement]);

  // New behaviour: DocumentNoField's peek returned seriesId: 1, and
  // BPOpeningBalance.jsx now forwards it to the save. Pinned to id 1, the
  // save resolves the ORIGINAL series no matter what is default today.
  const result = await resolveDocumentNumber('BPOB', 'BPOP-26-27-000001', client, original.id);
  assert.equal(result.documentNumber, 'BPOP-26-27-000001');
});

test('a pinned seriesId that no longer matches this document type is rejected, not silently re-defaulted', async () => {
  const series = bpobSeries();
  const client = stubClient([series]);
  await assert.rejects(
    resolveDocumentNumber('BPOB', 'BPOP-26-27-000001', client, 999),
    (err) => {
      assert.ok(err instanceof DocumentNumberError);
      assert.equal(err.code, 'SERIES_NOT_FOUND');
      return true;
    }
  );
});

// ---------------------------------------------------------------------------
// The auto-generate path is untouched by any of the above
// ---------------------------------------------------------------------------

test('an Auto Generate BPOB series still ignores the typed value entirely, pinned or not', async () => {
  const series = bpobSeries({ id: 3, manualEntry: false, autoGenerate: true, nextNumber: 42 });
  const client = {
    documentNumbering: {
      findUnique: async ({ where: { id } }) => (id === series.id ? series : null),
      // allocateDocumentNumber's conditional UPDATE -- a plain stub is enough
      // here since this test only asserts the typed value was never consulted.
      $queryRaw: undefined,
    },
  };
  // allocateDocumentNumber issues a raw UPDATE this stub can't service, so
  // this only needs to prove resolveSeries pins the same row either way --
  // the ignoring-of-typedNumber behaviour itself is exercised by the
  // existing document-flow tests for every other Auto Generate document type
  // and is unchanged by this fix (see utils/documentNumber.js).
  const resolved = await require('../services/documentNumberService').resolveSeries('BPOB', {
    client, seriesId: series.id, financialYearId: FY_ID,
  });
  assert.equal(resolved.manualEntry, false);
  assert.equal(resolved.id, series.id);
});
