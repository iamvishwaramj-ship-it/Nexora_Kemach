/**
 * Form-schema / server-validator parity.
 *
 * The Zod schema in frontend/src/lib/validation/companySchemas.js gives the
 * user instant feedback; validateSeriesPayload() in the service is what
 * actually protects the data. Its header says the schema mirrors the server.
 *
 * Disagreement is a real defect either way:
 *   - schema looser  -> the form says "fine", the save then fails with a
 *                       server error the user can't act on
 *   - schema tighter -> the form blocks a series the system would accept
 *
 * This walks a table of payloads through both and asserts they agree on
 * accept/reject.
 *
 *   npm run test:schema
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const be = require('../services/documentNumberService');

const VALIDATION_DIR = path.resolve(
  __dirname, '..', '..', '..', 'frontend', 'src', 'lib', 'validation'
);
const FRONTEND_DIR = path.resolve(__dirname, '..', '..', '..', 'frontend');

/**
 * Vite resolves extensionless relative imports ("./common"); plain Node ESM
 * does not. Rather than maintain a duplicate copy of the schema here — which
 * would defeat the entire point of a parity test — copy the real sources into
 * a temp folder under the frontend (so `zod` still resolves from its
 * node_modules) and add the extensions Node needs.
 */
function stageFrontendSchemas() {
  // A fixed directory rather than a unique temp one, and overwritten in place
  // rather than deleted first: on some mounts (and on Windows when a file is
  // briefly locked) unlink is refused, and staging must not fail the run over
  // housekeeping. mkdir -p + truncating writes are enough to guarantee the
  // contents are current.
  const tmp = path.join(FRONTEND_DIR, 'node_modules', '.numbering-parity');
  fs.mkdirSync(tmp, { recursive: true });
  // Only the schema under test and the shared building blocks it pulls in.
  for (const file of ['companySchemas.js', 'common.js']) {
    const src = fs.readFileSync(path.join(VALIDATION_DIR, file), 'utf8');
    // './common' -> './common.js', leaving bare package imports alone.
    const patched = src.replace(
      /(\bfrom\s+['"])(\.\.?\/[^'"]*?)(['"])/g,
      (m, pre, spec, post) => (path.extname(spec) ? m : `${pre}${spec}.js${post}`)
    );
    fs.writeFileSync(path.join(tmp, file), patched);
  }
  return tmp;
}

/** Cleanup is best-effort: a locked temp file must never fail the test run. */
function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

let passed = 0;
let failed = 0;
const failures = [];

function section(title) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
}

/** A payload both sides consider valid. */
const base = {
  documentCode: 'PO',
  seriesName: 'Default',
  financialYearId: 1,
  prefix: 'PO',
  suffix: '',
  separator: '-',
  includeFyInNumber: true,
  numberLength: 6,
  startNumber: 1,
  endNumber: 999999,
  resetEveryFy: true,
  autoGenerate: true,
  manualEntry: false,
  status: 'Active',
};

(async function run() {
  let schemas;
  let staged;
  try {
    staged = stageFrontendSchemas();
    schemas = await import(pathToFileURL(path.join(staged, 'companySchemas.js')).href);
  } catch (err) {
    console.error(`Could not load the frontend schema from ${VALIDATION_DIR}\n`, err.message);
    process.exit(1);
  } finally {
    if (staged) process.on('exit', () => cleanup(staged));
  }
  const schema = schemas.documentNumberingSchema;

  /**
   * Cases the two layers should agree on. `serverOnly: true` marks a rule the
   * form genuinely cannot check (it needs the other series in the year), so
   * the schema is expected to pass while the server rejects.
   */
  const cases = [
    // --- both accept -------------------------------------------------------
    { label: 'the standard series', patch: {}, valid: true },
    { label: 'manual-entry-only series', patch: { autoGenerate: false, manualEntry: true }, valid: true },
    { label: 'a 3-digit series', patch: { numberLength: 3, endNumber: 999 }, valid: true },
    { label: 'a 12-digit series', patch: { numberLength: 12, endNumber: 999999999999 }, valid: true },
    { label: 'a mid-range block', patch: { startNumber: 2000, endNumber: 2999 }, valid: true },
    { label: 'minimum legal gap', patch: { startNumber: 1, endNumber: 3 }, valid: true },
    { label: 'a suffix', patch: { suffix: 'A' }, valid: true },
    { label: 'no FY in the number', patch: { includeFyInNumber: false }, valid: true },
    { label: 'slash separator', patch: { separator: '/' }, valid: true },
    { label: 'no separator', patch: { separator: '' }, valid: true },
    { label: 'inactive series', patch: { status: 'Inactive' }, valid: true },
    { label: 'zero-padded strings from the form', patch: { startNumber: '001100', endNumber: '001998' }, valid: true },

    // --- both reject -------------------------------------------------------
    { label: 'End No. below Start No.', patch: { startNumber: 500, endNumber: 100 }, valid: false },
    { label: 'gap of 0 (start == end)', patch: { startNumber: 7, endNumber: 7 }, valid: false },
    { label: 'gap of 1', patch: { startNumber: 7, endNumber: 8 }, valid: false },
    { label: 'End No. past its padding', patch: { numberLength: 4, endNumber: 10000 }, valid: false },
    { label: 'Start No. past its padding', patch: { numberLength: 3, startNumber: 5000, endNumber: 6000 }, valid: false },
    { label: 'number length 0', patch: { numberLength: 0 }, valid: false },
    { label: 'number length 13', patch: { numberLength: 13 }, valid: false },
    { label: 'prefix with a space', patch: { prefix: 'P O' }, valid: false },
    { label: 'prefix with punctuation', patch: { prefix: 'PO-' }, valid: false },
    { label: 'prefix over 10 chars', patch: { prefix: 'ABCDEFGHIJK' }, valid: false },
    { label: 'suffix with punctuation', patch: { suffix: 'A!' }, valid: false },
    { label: 'a bad separator', patch: { separator: '|' }, valid: false },
    { label: 'a bad status', patch: { status: 'Archived' }, valid: false },
    { label: 'auto-off and manual-off', patch: { autoGenerate: false, manualEntry: false }, valid: false },
    { label: 'a blank series name', patch: { seriesName: '   ' }, valid: false },
    { label: 'an over-long series name', patch: { seriesName: 'x'.repeat(101) }, valid: false },
    { label: 'a missing document code', patch: { documentCode: '' }, valid: false },
    { label: 'a fractional Start No.', patch: { startNumber: 1.5 }, valid: false },
    { label: 'a negative Start No.', patch: { startNumber: -1 }, valid: false },
  ];

  section('Schema vs server validator');

  for (const { label, patch, valid } of cases) {
    const payload = { ...base, ...patch };

    const schemaResult = schema.safeParse(payload);
    const schemaOk = schemaResult.success;
    const serverOk = be.validateSeriesPayload(payload).length === 0;

    const agree = schemaOk === serverOk;
    const correct = agree && schemaOk === valid;

    if (correct) {
      passed += 1;
      console.log(`  ok   ${label}`);
    } else {
      failed += 1;
      const schemaMsg = schemaOk
        ? 'accepted'
        : `rejected (${schemaResult.error.issues.map((i) => i.message).join('; ')})`;
      const serverMsg = serverOk
        ? 'accepted'
        : `rejected (${be.validateSeriesPayload(payload).map((e) => e.message).join('; ')})`;
      const detail = `form ${schemaMsg}\n         server ${serverMsg}\n         expected both to ${valid ? 'accept' : 'reject'}`;
      failures.push(`${label}\n         ${detail}`);
      console.log(`  FAIL ${label}\n         ${detail}`);
    }
  }

  console.log('\nSummary');
  console.log('-------\n');
  console.log(`  ${passed} passed, ${failed} failed\n`);
  if (failures.length) {
    console.log('Failures:');
    failures.forEach((f) => console.log(`  - ${f}\n`));
  }
  process.exit(failed ? 1 : 0);
})();
