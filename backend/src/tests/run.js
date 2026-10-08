/**
 * Test runner: one child process per suite.
 *
 *   npm run test:unit
 *
 * `node --test "src/tests/*.test.js"` runs every file inside a single process.
 * That is fine for ordinary unit tests and not fine here: most suites stand up
 * a real PostgreSQL (PGlite, compiled to WASM) and apply the full migration
 * set for each fixture. A single process ends up holding dozens of WASM heaps
 * alive at once and is killed by the OS partway through — with no summary, so
 * the run *looks* like it passed if you only check the exit code.
 *
 * Running each suite in its own child process bounds the memory to one suite
 * at a time and makes a crash attributable to the file that caused it.
 * Aggregate counts are parsed from each child's TAP output and reported at the
 * end; the process exits non-zero if any suite fails or dies without a
 * summary.
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const TESTS_DIR = __dirname;
const TIMEOUT_MS = 5 * 60 * 1000;

// An optional substring filter, so a single suite can be re-run without
// waiting for the rest:  npm run test:unit -- stockLedger
const filter = process.argv[2];

const suites = fs
  .readdirSync(TESTS_DIR)
  .filter((f) => f.endsWith('.test.js'))
  .filter((f) => (filter ? f.includes(filter) : true))
  .sort();

if (!suites.length) {
  console.error('No test suites found in', TESTS_DIR);
  process.exit(1);
}

let totalTests = 0;
let totalPass = 0;
let totalFail = 0;
const failedSuites = [];

for (const suite of suites) {
  const file = path.join(TESTS_DIR, suite);
  const started = Date.now();

  const result = spawnSync(
    process.execPath,
    ['--test', '--test-timeout=300000', file],
    // A modest buffer: spawnSync reserves it up front, and a large reserve
    // in the parent competes with the child's WASM heap for the same memory.
    { encoding: 'utf8', timeout: TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 }
  );

  const output = `${result.stdout || ''}${result.stderr || ''}`;
  const read = (label) => {
    const m = output.match(new RegExp(`^# ${label} (\\d+)$`, 'm'));
    return m ? Number(m[1]) : null;
  };

  const tests = read('tests');
  const pass = read('pass');
  const fail = read('fail');
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  if (tests === null) {
    // No summary means the child died — an out-of-memory kill, a timeout, or a
    // crash on load. Surface it rather than counting it as a pass.
    failedSuites.push(suite);
    console.log(`FAIL  ${suite.padEnd(34)} no summary (exit ${result.status}, signal ${result.signal})  ${seconds}s`);
    const tail = output.trim().split('\n').slice(-12).join('\n');
    if (tail) console.log(tail.replace(/^/gm, '        '));
    continue;
  }

  totalTests += tests;
  totalPass += pass ?? 0;
  totalFail += fail ?? 0;

  if (fail) {
    failedSuites.push(suite);
    console.log(`FAIL  ${suite.padEnd(34)} ${pass}/${tests} passed  ${seconds}s`);
    for (const line of output.split('\n')) {
      if (/^not ok /.test(line)) console.log(`        ${line.trim()}`);
    }
  } else {
    console.log(`ok    ${suite.padEnd(34)} ${pass}/${tests} passed  ${seconds}s`);
  }
}

console.log('');
console.log(`${suites.length} suites, ${totalTests} tests, ${totalPass} passed, ${totalFail} failed`);

if (failedSuites.length) {
  console.log(`\nFailing suites: ${failedSuites.join(', ')}`);
  process.exit(1);
}
