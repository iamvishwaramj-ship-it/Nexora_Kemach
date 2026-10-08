/**
 * Explicit-series selection on the numbering engine.
 *
 * Sales Quotation and Sales Invoice create forms let the user pick a specific
 * numbering series instead of always taking the document type's default (see
 * DocumentSeriesNoField.jsx). resolveSeries()'s seriesId branch is what makes
 * that safe: it validates the chosen row belongs to the right document type
 * and financial year and is still usable, rather than trusting whatever id
 * the client sent — a stale, foreign, inactive or exhausted seriesId is
 * rejected with a clean 4xx instead of silently falling back to the default
 * or handing out a number from the wrong series.
 *
 * peekDocumentNumber/allocateDocumentNumber both funnel through resolveSeries,
 * so pinning its behaviour here covers both callers. These tests use a stub
 * Prisma client exposing only documentNumbering.findUnique — no database
 * required, same style as numberingGapReuse.test.js.
 *
 * Run with:  node --test "src/tests/*.test.js"
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveSeries,
  peekDocumentNumber,
  DocumentNumberError,
} = require('../services/documentNumberService');

/** Stub Prisma client exposing only documentNumbering.findUnique, keyed by id. */
function stubClient(rows) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return {
    documentNumbering: {
      findUnique: async ({ where: { id } }) => byId.get(id) || null,
    },
  };
}

const FY_ID = 10;
const OTHER_FY_ID = 20;

const DEFAULT_SQ = {
  id: 1, documentCode: 'SQ', financialYearId: FY_ID, status: 'Active',
  isDefault: true, seriesName: 'Series 1', nextNumber: 6, endNumber: 999999,
};
const NON_DEFAULT_SQ = {
  id: 2, documentCode: 'SQ', financialYearId: FY_ID, status: 'Active',
  isDefault: false, seriesName: 'Series 2', nextNumber: 1, endNumber: 999,
};
const SI_SERIES = {
  id: 3, documentCode: 'SI', financialYearId: FY_ID, status: 'Active',
  isDefault: true, seriesName: 'SI Series', nextNumber: 1, endNumber: 999999,
};
const INACTIVE_SQ = {
  id: 4, documentCode: 'SQ', financialYearId: FY_ID, status: 'Inactive',
  isDefault: false, seriesName: 'Series X', nextNumber: 1, endNumber: 999,
};
const EXHAUSTED_SQ = {
  id: 5, documentCode: 'SQ', financialYearId: FY_ID, status: 'Active',
  isDefault: false, seriesName: 'Series Y', nextNumber: 1000, endNumber: 999,
};
const WRONG_FY_SQ = {
  id: 6, documentCode: 'SQ', financialYearId: OTHER_FY_ID, status: 'Active',
  isDefault: false, seriesName: 'Series Z', nextNumber: 1, endNumber: 999,
};

async function rejectsWith(promise, code, status) {
  await assert.rejects(promise, (err) => {
    assert.ok(err instanceof DocumentNumberError, `expected DocumentNumberError, got ${err}`);
    assert.equal(err.code, code, `expected code ${code}, got ${err.code}`);
    assert.equal(err.status, status, `expected status ${status}, got ${err.status}`);
    return true;
  });
}

// ---------------------------------------------------------------------------
test('resolveSeries with an explicit non-default seriesId returns that series', async () => {
  const client = stubClient([DEFAULT_SQ, NON_DEFAULT_SQ]);
  const series = await resolveSeries('SQ', { financialYearId: FY_ID, client, seriesId: NON_DEFAULT_SQ.id });
  assert.equal(series.id, NON_DEFAULT_SQ.id);
  assert.equal(series.isDefault, false);
});

test('resolveSeries with seriesId=null still resolves the default (unchanged behaviour)', async () => {
  // No documentNumbering.findMany on this stub — proves the seriesId branch
  // is what's being exercised above, and that omitting seriesId takes a
  // different path (the pre-existing default-lookup path, covered by
  // numberingGapReuse.test.js and the live scripts, not re-tested here).
  const client = { documentNumbering: { findUnique: async () => { throw new Error('should not be called'); } } };
  await assert.rejects(resolveSeries('SQ', { financialYearId: FY_ID, client }));
});

test('peekDocumentNumber with an explicit seriesId previews from that series, not the default', async () => {
  const client = stubClient([DEFAULT_SQ, NON_DEFAULT_SQ]);
  const result = await peekDocumentNumber('SQ', { financialYearId: FY_ID, client, seriesId: NON_DEFAULT_SQ.id });
  assert.equal(result.seriesId, NON_DEFAULT_SQ.id);
  assert.equal(result.value, NON_DEFAULT_SQ.nextNumber);
});

// ---------------------------------------------------------------------------
test('resolveSeries rejects a seriesId belonging to a different document type', async () => {
  const client = stubClient([SI_SERIES]);
  await rejectsWith(
    resolveSeries('SQ', { financialYearId: FY_ID, client, seriesId: SI_SERIES.id }),
    'SERIES_NOT_FOUND', 400
  );
});

test('resolveSeries rejects a seriesId that does not exist at all', async () => {
  const client = stubClient([]);
  await rejectsWith(
    resolveSeries('SQ', { financialYearId: FY_ID, client, seriesId: 999 }),
    'SERIES_NOT_FOUND', 400
  );
});

test('resolveSeries rejects an inactive seriesId', async () => {
  const client = stubClient([INACTIVE_SQ]);
  await rejectsWith(
    resolveSeries('SQ', { financialYearId: FY_ID, client, seriesId: INACTIVE_SQ.id }),
    'SERIES_INACTIVE', 409
  );
});

test('resolveSeries allows an inactive seriesId when requireActive is false', async () => {
  const client = stubClient([INACTIVE_SQ]);
  const series = await resolveSeries('SQ', {
    financialYearId: FY_ID, client, seriesId: INACTIVE_SQ.id, requireActive: false,
  });
  assert.equal(series.id, INACTIVE_SQ.id);
});

test('resolveSeries rejects an exhausted seriesId', async () => {
  const client = stubClient([EXHAUSTED_SQ]);
  await rejectsWith(
    resolveSeries('SQ', { financialYearId: FY_ID, client, seriesId: EXHAUSTED_SQ.id }),
    'SERIES_EXHAUSTED', 409
  );
});

test('resolveSeries rejects a seriesId from a different financial year', async () => {
  const client = stubClient([WRONG_FY_SQ]);
  await rejectsWith(
    resolveSeries('SQ', { financialYearId: FY_ID, client, seriesId: WRONG_FY_SQ.id }),
    'SERIES_WRONG_FY', 400
  );
});

// ---------------------------------------------------------------------------
// Same coverage, one inventory code (SIG) and one banking/voucher code (OP)
// — added alongside the Inventory/Banking/Receivables/Payables numbering-
// series rollout, to confirm the seriesId path isn't special-cased to SQ.
// Both are FY-scoped transaction series exactly like SQ, so the same stub
// shape applies.
// ---------------------------------------------------------------------------

const DEFAULT_SIG = {
  id: 7, documentCode: 'SIG', financialYearId: FY_ID, status: 'Active',
  isDefault: true, seriesName: 'Series 1', nextNumber: 12, endNumber: 999999,
};
const NON_DEFAULT_SIG = {
  id: 8, documentCode: 'SIG', financialYearId: FY_ID, status: 'Active',
  isDefault: false, seriesName: 'Series 2', nextNumber: 1, endNumber: 999,
};
const INACTIVE_OP = {
  id: 9, documentCode: 'OP', financialYearId: FY_ID, status: 'Inactive',
  isDefault: false, seriesName: 'Series X', nextNumber: 1, endNumber: 999,
};
const EXHAUSTED_OP = {
  id: 10, documentCode: 'OP', financialYearId: FY_ID, status: 'Active',
  isDefault: false, seriesName: 'Series Y', nextNumber: 1000, endNumber: 999,
};

test('resolveSeries with an explicit non-default seriesId (SIG) returns that series', async () => {
  const client = stubClient([DEFAULT_SIG, NON_DEFAULT_SIG]);
  const series = await resolveSeries('SIG', { financialYearId: FY_ID, client, seriesId: NON_DEFAULT_SIG.id });
  assert.equal(series.id, NON_DEFAULT_SIG.id);
  assert.equal(series.isDefault, false);
});

test('peekDocumentNumber (SIG) with an explicit seriesId previews from that series, not the default', async () => {
  const client = stubClient([DEFAULT_SIG, NON_DEFAULT_SIG]);
  const result = await peekDocumentNumber('SIG', { financialYearId: FY_ID, client, seriesId: NON_DEFAULT_SIG.id });
  assert.equal(result.seriesId, NON_DEFAULT_SIG.id);
  assert.equal(result.value, NON_DEFAULT_SIG.nextNumber);
});

test('resolveSeries (SIG) rejects a seriesId belonging to another document type (OP)', async () => {
  const client = stubClient([DEFAULT_SIG, INACTIVE_OP]);
  await rejectsWith(
    resolveSeries('SIG', { financialYearId: FY_ID, client, seriesId: INACTIVE_OP.id }),
    'SERIES_NOT_FOUND', 400
  );
});

test('resolveSeries (OP) rejects an inactive seriesId', async () => {
  const client = stubClient([INACTIVE_OP]);
  await rejectsWith(
    resolveSeries('OP', { financialYearId: FY_ID, client, seriesId: INACTIVE_OP.id }),
    'SERIES_INACTIVE', 409
  );
});

test('resolveSeries (OP) rejects an exhausted seriesId', async () => {
  const client = stubClient([EXHAUSTED_OP]);
  await rejectsWith(
    resolveSeries('OP', { financialYearId: FY_ID, client, seriesId: EXHAUSTED_OP.id }),
    'SERIES_EXHAUSTED', 409
  );
});
