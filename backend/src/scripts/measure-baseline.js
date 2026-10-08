// PHASE 0 — Measure (see docs/perf-baseline.md and the task's PHASE 0
// section). Read-only: every request this script makes is a GET, so it
// cannot create, update or delete a single row. It logs in once with a real
// user (so branch scoping, permission checks, and payload shape are exactly
// what a real screen mount gets) and then times each of the ~30 heaviest
// list endpoints one at a time — sequential on purpose, so one request's
// timing is never skewed by another competing for the same DB connection
// pool or event-loop turn.
//
// For each endpoint it records:
//   - wall-clock duration (ms), same measurement `requestTiming` in
//     middleware/perfLogger.js logs server-side, timed here from the
//     client side of the same process so both numbers can be compared
//   - response payload size in bytes (uncompressed JSON text length)
//   - row count — `data.length` when the response carries a `data` array
//     (every crud/list endpoint does), else `-` for a report shaped
//     differently
//
// Usage (from the backend/ folder, with the API server already running):
//   node src/scripts/measure-baseline.js                 # label: BEFORE
//   node src/scripts/measure-baseline.js --label=AFTER    # after a phase
//   node src/scripts/measure-baseline.js --label="AFTER phase 2"
//
// Needs PERF_TEST_BASE_URL / PERF_TEST_USERCODE / PERF_TEST_PASSWORD in
// backend/.env (see .env.example) — a real login for a user with normal
// (non-admin, if you want to also see branch scoping's effect) access to
// every module below. Nothing here is read by the app itself; this file
// only calls the API as an external client would.
//
// Output: prints a Markdown table to stdout AND appends it to
// docs/perf-baseline.md (creating the file with its header if missing), so
// running this after each phase builds up the full BEFORE/AFTER history in
// one place without any manual copy-pasting.
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.PERF_TEST_BASE_URL || 'http://localhost:5001';
const USER_CODE = process.env.PERF_TEST_USERCODE;
const PASSWORD = process.env.PERF_TEST_PASSWORD;

const labelArg = process.argv.find((a) => a.startsWith('--label='));
const LABEL = labelArg ? labelArg.slice('--label='.length) : 'BEFORE';

// The ~30 heaviest list endpoints named in the task brief, grouped the same
// way the report groups them. `path` is requested with NO query params
// (page/limit/q/includeItems/summary all left off) — the exact "a screen
// just mounted" call the frontend makes today, since that unpaged call is
// the one Phase 0 is meant to characterise.
const ENDPOINTS = [
  // --- Masters most likely to be unbounded (A1) ---
  { group: 'Masters (paging opt-in, capped by maxPageSize)', path: '/api/products', label: 'Products' },
  // Phase 2 projection — the slim `?view=summary` shape Product Master's own
  // list page now requests (see listViews.summary on the /products route
  // and ProductMaster.jsx). Added alongside the unchanged '/api/products'
  // row above so the same run shows, side by side: (a) the default/no-`view`
  // shape is unchanged from before Phase 2, and (b) how much smaller the
  // opt-in slim shape actually is.
  { group: 'Masters (paging opt-in, capped by maxPageSize)', path: '/api/products?view=summary', label: 'Products (?view=summary — Phase 2 projection)' },
  // Phase 3 server-side paging — the actual request Product Master's list
  // page now makes for its first page (10 rows, matching PAGE_SIZE in
  // ProductMaster.jsx): should come back with a `meta` envelope and a data
  // array capped at 10 rows, regardless of how many products exist —
  // dramatically smaller than even the ?view=summary row above once the
  // table has more than one page's worth of products.
  { group: 'Masters (paging opt-in, capped by maxPageSize)', path: '/api/products?view=summary&page=1&limit=10', label: 'Products (?view=summary&page=1&limit=10 — Phase 3 paging)' },
  // Phase 4 — the combined lookup endpoint Product Master's Add/Edit form
  // now calls once instead of five separate requests (Item Group,
  // Sub-Group, Brand, UOM, Preferred Vendor). This single row can't show
  // the "5 requests -> 1" win directly (the script measures one URL at a
  // time), but its own payload/time is worth tracking on its own, and it's
  // a useful smoke test that the route still responds.
  //
  // HSN Master and Price List were folded into this same endpoint in the
  // first cut of Phase 4, then split back out after this route's own
  // ~9.8s / 5.4MB "AFTER phase 4" measurement showed the combined call
  // blocking on whichever of the two was slowest. They're measured here as
  // their own separate rows instead — same two requests ProductMaster.jsx's
  // Add/Edit form now makes on its own, unchanged from before Phase 4.
  //
  // Phase 5 (pure data-access, no business-logic change) — this route now
  // caches its whole response for 60s (see its own comment in resources.js).
  // Each of the three rows below is immediately followed by a second,
  // identical request: since this script runs every request sequentially in
  // well under 60s, that second row is a cache HIT and should come back
  // dramatically faster than the first (cold) one — the actual proof the
  // cache is doing something, in one run instead of needing a manual
  // second `measure:baseline` within the TTL window.
  { group: 'Masters (paging opt-in, capped by maxPageSize)', path: '/api/products/form-lookups', label: 'Products form lookups (Phase 4 — replaces 5 separate requests) [cold]' },
  { group: 'Masters (paging opt-in, capped by maxPageSize)', path: '/api/products/form-lookups', label: 'Products form lookups [Phase 5 cache HIT — 2nd request within 60s]' },
  { group: 'Masters (paging opt-in, capped by maxPageSize)', path: '/api/hsn-master', label: 'HSN Master (cap 50,000 — Product Master form dropdown) [cold]' },
  { group: 'Masters (paging opt-in, capped by maxPageSize)', path: '/api/hsn-master', label: 'HSN Master [Phase 5 cache HIT — 2nd request within 60s]' },
  { group: 'Masters (paging opt-in, capped by maxPageSize)', path: '/api/price-lists', label: 'Price Lists (uncapped, includes items — Product Master form dropdown) [cold]' },
  { group: 'Masters (paging opt-in, capped by maxPageSize)', path: '/api/price-lists', label: 'Price Lists [Phase 5 cache HIT — 2nd request within 60s]' },
  { group: 'Masters (paging opt-in, capped by maxPageSize)', path: '/api/chart-of-accounts', label: 'Chart of Accounts (cap 20,000 — Business Partner Control Account dropdown) [cold]' },
  { group: 'Masters (paging opt-in, capped by maxPageSize)', path: '/api/chart-of-accounts', label: 'Chart of Accounts [Phase 5 cache HIT — 2nd request within 60s]' },
  { group: 'Masters (paging opt-in, capped by maxPageSize)', path: '/api/purchase-prices', label: 'Purchase Prices (cap 50,000)' },
  { group: 'Masters (paging opt-in, capped by maxPageSize)', path: '/api/sales-prices', label: 'Sales Prices (cap 50,000)' },
  { group: 'Masters (paging opt-in, capped by maxPageSize)', path: '/api/customer-discounts', label: 'Customer Discounts (cap 50,000)' },
  { group: 'Masters (paging opt-in, capped by maxPageSize)', path: '/api/warehouse-master', label: 'Warehouse Master' },
  { group: 'Masters (paging opt-in, capped by maxPageSize)', path: '/api/opening-balance', label: 'Opening Balance' },

  // --- Bespoke, genuinely unbounded (A2) ---
  { group: 'Bespoke unbounded routes', path: '/api/business-partners', label: 'Business Partners (no take at all — see diagnose-bp-perf.js)' },
  // Phase 2 projection — the slim `?view=list` shape Business Partner's own
  // list page now requests (drops the contacts/addresses/machineries
  // include entirely — see the `?view=list` branch on the /business-partners
  // route and BusinessPartner.jsx). Same side-by-side purpose as the
  // Products row above.
  { group: 'Bespoke unbounded routes', path: '/api/business-partners?view=list', label: 'Business Partners (?view=list — Phase 2 projection)' },
  // Phase 3 server-side paging — the actual request Business Partner's list
  // page now makes for its first page (10 rows, matching PAGE_SIZE in
  // BusinessPartner.jsx): should come back with a `meta` envelope and a
  // data array capped at 10 rows, regardless of the total partner count.
  { group: 'Bespoke unbounded routes', path: '/api/business-partners?view=list&page=1&limit=10', label: 'Business Partners (?view=list&page=1&limit=10 — Phase 3 paging)' },
  { group: 'Bespoke unbounded routes', path: '/api/business-partner-opening-balance', label: 'Business Partner Opening Balance' },

  // --- Purchase-side transaction lists (A3) ---
  { group: 'Purchase transaction lists', path: '/api/purchase/quotations', label: 'Purchase Quotations' },
  { group: 'Purchase transaction lists', path: '/api/purchase/orders', label: 'Purchase Orders' },
  { group: 'Purchase transaction lists', path: '/api/purchase/grn', label: 'Purchase GRN' },
  { group: 'Purchase transaction lists', path: '/api/purchase/invoices', label: 'Purchase Invoices' },
  { group: 'Purchase transaction lists', path: '/api/purchase/returns', label: 'Purchase Returns' },
  { group: 'Purchase transaction lists', path: '/api/purchase/credit-memos', label: 'Purchase Credit Memos' },

  // --- Sales-side transaction lists (A3) ---
  { group: 'Sales transaction lists', path: '/api/sales/quotations', label: 'Sales Quotations' },
  { group: 'Sales transaction lists', path: '/api/sales/orders', label: 'Sales Orders' },
  { group: 'Sales transaction lists', path: '/api/sales/delivery-challans', label: 'Delivery Challans' },
  { group: 'Sales transaction lists', path: '/api/sales/invoices', label: 'Sales Invoices' },
  { group: 'Sales transaction lists', path: '/api/sales/returns', label: 'Sales Returns' },
  { group: 'Sales transaction lists', path: '/api/sales/credit-memos', label: 'Sales Credit Memos' },

  // --- Inventory movement lists (A3) ---
  { group: 'Inventory transaction lists', path: '/api/inventory/stock-receipts', label: 'Stock Receipts' },
  { group: 'Inventory transaction lists', path: '/api/inventory/stock-issues', label: 'Stock Issues' },
  { group: 'Inventory transaction lists', path: '/api/inventory/stock-adjustments', label: 'Stock Adjustments' },
  { group: 'Inventory transaction lists', path: '/api/inventory/stock-transfers', label: 'Stock Transfers' },
  { group: 'Inventory transaction lists', path: '/api/inventory/stock-transfer-requests', label: 'Stock Transfer Requests' },
  { group: 'Inventory transaction lists', path: '/api/inventory/stock-transfer-receipts', label: 'Stock Transfer Receipts' },

  // --- Banking / receivables / payables lists (A3) ---
  { group: 'Banking / receivables / payables lists', path: '/api/receivables/collections', label: 'Collections' },
  { group: 'Banking / receivables / payables lists', path: '/api/payables/payments', label: 'Supplier Payments' },
  { group: 'Banking / receivables / payables lists', path: '/api/banking/payment-receipts', label: 'Payment Receipts' },
  { group: 'Banking / receivables / payables lists', path: '/api/banking/payment-vouchers', label: 'Payment Vouchers' },
  { group: 'Banking / receivables / payables lists', path: '/api/banking/deposits', label: 'Bank Deposits' },
  { group: 'Banking / receivables / payables lists', path: '/api/banking/cheques', label: 'Cheques' },
  { group: 'Banking / receivables / payables lists', path: '/api/journal-entries', label: 'Journal Entries' },

  // --- Reports — JS-side aggregation over whole tables (A5) ---
  { group: 'Reports (JS aggregation, A5)', path: '/api/inventory/stock-summary/report', label: 'Stock Summary Report' },
  { group: 'Reports (JS aggregation, A5)', path: '/api/inventory/stock-valuation/report', label: 'Stock Valuation Report' },
  { group: 'Reports (JS aggregation, A5)', path: '/api/inventory/low-stock/report', label: 'Low Stock Report' },
  { group: 'Reports (JS aggregation, A5)', path: '/api/inventory/slow-moving/report', label: 'Slow Moving Stock Report' },
  { group: 'Reports (JS aggregation, A5)', path: '/api/inventory/dead-stock/report', label: 'Dead Stock Report' },
  { group: 'Reports (JS aggregation, A5)', path: '/api/inventory/reorder-level/report', label: 'Reorder Level Report' },
  { group: 'Reports (JS aggregation, A5)', path: '/api/sales/invoices/register/report', label: 'Sales Invoice Register' },
  { group: 'Reports (JS aggregation, A5)', path: '/api/purchase/invoices/register/report', label: 'Purchase Invoice Register' },
];

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/** Best-effort row count: every crud/list endpoint wraps rows in `data`; a
 * report may instead return `{ rows: [...] }`, `{ items: [...] }`, or a
 * plain object with no row array at all (a single summary record) — this
 * is diagnostic tooling, not a route contract, so it degrades to '-' rather
 * than throwing on a shape it doesn't recognise. */
function guessRowCount(body) {
  if (Array.isArray(body?.data)) return body.data.length;
  if (Array.isArray(body?.rows)) return body.rows.length;
  if (Array.isArray(body?.items)) return body.items.length;
  if (Array.isArray(body)) return body.length;
  return '-';
}

async function login() {
  if (!USER_CODE || !PASSWORD) {
    throw new Error(
      'Set PERF_TEST_USERCODE and PERF_TEST_PASSWORD in backend/.env before running this script ' +
      '(see .env.example) — it needs a real login the same way the app does.'
    );
  }
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userCode: USER_CODE, password: PASSWORD }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.accessToken) {
    throw new Error(`Login failed (${res.status}): ${body?.message || 'no accessToken in response'}`);
  }
  return body.accessToken;
}

async function timeOne(token, endpoint) {
  const controller = new AbortController();
  // Business Partners is documented as taking ~2 minutes unbounded (see
  // diagnose-bp-perf.js) — give every request enough rope to actually finish
  // rather than reporting a misleading timeout as the "before" number.
  const timeout = setTimeout(() => controller.abort(), 180_000);
  const startedAt = process.hrtime.bigint();
  try {
    const res = await fetch(`${BASE_URL}${endpoint.path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    const text = await res.text();
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const bytes = Buffer.byteLength(text);
    let rows = '-';
    let ok = res.ok;
    try {
      rows = guessRowCount(JSON.parse(text));
    } catch {
      ok = false; // non-JSON body — still record timing/size, but flag it
    }
    return { ...endpoint, status: res.status, ok, durationMs, bytes, rows };
  } catch (err) {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    return { ...endpoint, status: 'ERR', ok: false, durationMs, bytes: 0, rows: '-', error: err.message };
  } finally {
    clearTimeout(timeout);
  }
}

function toMarkdownTable(results) {
  const lines = [];
  lines.push(`## ${LABEL} — ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`Base URL: \`${BASE_URL}\``);
  lines.push('');
  lines.push('| Group | Endpoint | Rows | Payload | Server time | Status |');
  lines.push('|---|---|---:|---:|---:|---|');
  for (const r of results) {
    const statusCell = r.ok ? String(r.status) : `${r.status}${r.error ? ` (${r.error})` : ''}`;
    lines.push(
      `| ${r.group} | ${r.label} (\`${r.path}\`) | ${r.rows} | ${fmtBytes(r.bytes)} | ${r.durationMs.toFixed(0)} ms | ${statusCell} |`
    );
  }
  lines.push('');
  return lines.join('\n');
}

async function main() {
  console.log(`Logging in to ${BASE_URL} as ${USER_CODE} ...`);
  const token = await login();

  const results = [];
  for (const endpoint of ENDPOINTS) {
    process.stdout.write(`  ${endpoint.path} ... `);
    // Sequential, deliberately — see file header comment.
    // eslint-disable-next-line no-await-in-loop
    const result = await timeOne(token, endpoint);
    results.push(result);
    console.log(`${result.durationMs.toFixed(0)}ms, ${fmtBytes(result.bytes)}, ${result.rows} row(s), status ${result.status}`);
  }

  const table = toMarkdownTable(results);
  console.log(`\n${table}`);

  const docPath = path.join(__dirname, '..', '..', '..', 'docs', 'perf-baseline.md');
  fs.mkdirSync(path.dirname(docPath), { recursive: true });
  const existing = fs.existsSync(docPath) ? fs.readFileSync(docPath, 'utf8') : '# Performance baseline\n\n';
  fs.writeFileSync(docPath, `${existing.replace(/\n+$/, '\n')}\n${table}`);
  console.log(`\nAppended to ${docPath}`);
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exitCode = 1;
});
