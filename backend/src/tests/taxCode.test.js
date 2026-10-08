/**
 * Tax Code Master — format validation (taxLabelField) and the
 * duplicate check (normaliseTaxLabel / findDuplicateTaxCode) shared by
 * POST /tax-codes and PUT /tax-codes/:id in routes/company.js.
 *
 * taxLabelField no longer restricts which symbols Tax Code / Tax Name may
 * contain — it only requires a non-blank value with at least one letter.
 *
 * Run with:  node --test src/tests/taxCode.test.js
 *
 * No Express app or database here: runValidators()'s middleware only needs a
 * plain { body } object (verified against a real express-validator chain,
 * not mocked), and findDuplicateTaxCode takes its `client` as a parameter —
 * a fake with just enough of Prisma's taxCode.findMany() shape is standing
 * in for a live one, same approach productInventory.test.js uses for
 * openOrderedQtyByWarehouse/openCommittedQtyByWarehouse.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { taxLabelField, runValidators } = require('../utils/formatValidators');
const { normaliseTaxLabel, findDuplicateTaxCode } = require('../routes/company');

/** Runs one express-validator chain against a body, the same way the real
 *  POST/PUT routes do via runValidators(taxCodeFormatRules). */
async function validate(rules, body) {
  const req = { body };
  let statusCode = null;
  let json = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(payload) { json = payload; return this; },
  };
  let calledNext = false;
  await runValidators(rules)(req, res, () => { calledNext = true; });
  return { ok: calledNext, statusCode, json };
}

// ---------------------------------------------------------------------------
// 1. taxLabelField — no character-set restriction any more
// ---------------------------------------------------------------------------

test('taxLabelField accepts any symbols in a Tax Code, as long as it has a letter', async () => {
  const rules = [taxLabelField('taxCode', { label: 'Tax code' })];
  for (const value of ['GST_18%-A', 'GST@18', 'GST#18', 'GST 18%!', 'GST;18']) {
    const { ok } = await validate(rules, { taxCode: value });
    assert.equal(ok, true, `expected "${value}" to be accepted`);
  }
});

test('taxLabelField accepts any symbols in a Tax Name, as long as it has a letter', async () => {
  const rules = [taxLabelField('taxName', { label: 'Tax name' })];
  const { ok } = await validate(rules, { taxName: 'GST 18% (RCM)_v2 @!' });
  assert.equal(ok, true);
});

test('taxLabelField still requires at least one letter', async () => {
  const rules = [taxLabelField('taxCode', { label: 'Tax code' })];
  const { ok, json } = await validate(rules, { taxCode: '18%_-' });
  assert.equal(ok, false);
  assert.match(json.message, /must contain at least one letter/);
});

test('taxLabelField still rejects a blank value as required', async () => {
  const rules = [taxLabelField('taxCode', { label: 'Tax code' })];
  const { ok, json } = await validate(rules, { taxCode: '' });
  assert.equal(ok, false);
  assert.match(json.message, /is required/);
});

// ---------------------------------------------------------------------------
// 2. normaliseTaxLabel — % _ - are folded away, not just whitespace/case
// ---------------------------------------------------------------------------

test('normaliseTaxLabel folds %, _, -, whitespace and case to the same key', () => {
  const variants = ['GST 18%', 'gst_18 %', 'GST-18%', 'GST18%', '  gst 1 8 % '];
  const normalised = variants.map(normaliseTaxLabel);
  for (const n of normalised) assert.equal(n, normalised[0], `"${n}" did not fold to "${normalised[0]}"`);
});

test('normaliseTaxLabel does not fold two genuinely different labels together', () => {
  assert.notEqual(normaliseTaxLabel('GST 18%'), normaliseTaxLabel('GST 12%'));
});

// ---------------------------------------------------------------------------
// findDuplicateTaxCode — exercised exactly as POST and PUT /tax-codes call
// it, against a fake `client` standing in for Prisma.
// ---------------------------------------------------------------------------

// Real Prisma applies `where: { id: { not: ignoreId } }` when
// findDuplicateTaxCode is called with an ignoreId (the update path) —
// this has to honour that filter too, or the row being edited never
// actually gets excluded and every self-save looks like a duplicate of
// itself.
function fakeTaxCodeClient(rows) {
  return {
    taxCode: {
      findMany: async ({ where } = {}) => {
        const excludeId = where?.id?.not;
        return excludeId == null ? rows : rows.filter((r) => r.id !== excludeId);
      },
    },
  };
}

test('findDuplicateTaxCode (create path) rejects a Tax Code differing only by %/_/-/case/spacing', async () => {
  const client = fakeTaxCodeClient([{ id: 1, taxCode: 'GST 18%', taxName: 'GST Eighteen' }]);
  const dupe = await findDuplicateTaxCode(
    { taxCode: 'gst_18 %', taxName: 'Something Else' },
    { client },
  );
  assert.ok(dupe, 'expected a duplicate to be found');
  assert.equal(dupe.id, 1);
});

test('findDuplicateTaxCode (create path) rejects a Tax Name differing only by %/_/-/case/spacing', async () => {
  const client = fakeTaxCodeClient([{ id: 1, taxCode: 'GST18', taxName: 'GST 18%' }]);
  const dupe = await findDuplicateTaxCode(
    { taxCode: 'SOMETHING-ELSE', taxName: 'gst_18 %' },
    { client },
  );
  assert.ok(dupe, 'expected a duplicate to be found');
  assert.equal(dupe.id, 1);
});

test('findDuplicateTaxCode (update path) still excludes the record being edited via ignoreId', async () => {
  const client = fakeTaxCodeClient([
    { id: 1, taxCode: 'GST 18%', taxName: 'GST Eighteen' },
    { id: 2, taxCode: 'GST 12%', taxName: 'GST Twelve' },
  ]);
  // Editing record 1 and re-saving its own (unchanged, differently-typed)
  // value must NOT flag itself as a duplicate of itself.
  const selfDupe = await findDuplicateTaxCode(
    { taxCode: 'gst_18%', taxName: 'GST Eighteen' },
    { client, ignoreId: 1 },
  );
  assert.equal(selfDupe, undefined);

  // But colliding with a DIFFERENT existing record is still caught.
  const realDupe = await findDuplicateTaxCode(
    { taxCode: 'gst-12%', taxName: 'Something Else' },
    { client, ignoreId: 1 },
  );
  assert.ok(realDupe);
  assert.equal(realDupe.id, 2);
});

test('findDuplicateTaxCode does not flag genuinely different tax codes/names', async () => {
  const client = fakeTaxCodeClient([{ id: 1, taxCode: 'GST 18%', taxName: 'GST Eighteen' }]);
  const dupe = await findDuplicateTaxCode(
    { taxCode: 'GST 12%', taxName: 'GST Twelve' },
    { client },
  );
  assert.equal(dupe, undefined);
});
