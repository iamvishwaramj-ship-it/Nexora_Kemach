// ---------------------------------------------------------------------------
// TaxPro GSP integration — GST e-invoice (IRN) and e-way bill generation for
// a Sales Invoice, via TaxPro/Chartered Info's GSP (charteredinfo.com),
// which fronts the NIC e-Invoice System API. That API has a distinctive
// two-step crypto envelope:
//
//   1. Auth (POST /eivital/v1.04/auth) — RSA-encrypt the account Password
//      and a freshly generated 32-byte AES key ("AppKey") with the IRP's
//      public key (TAXPRO_PUBLIC_KEY_PATH), POST them alongside the ASP
//      id/secret (sent as client_id/client_secret). The response's `Data`
//      field is itself AES-256-ECB-encrypted with that same AppKey;
//      decrypting it yields { AuthToken, Sek, TokenExpiry } — Sek is the
//      session key every later call uses (not necessarily the same bytes
//      as AppKey).
//   2. Every other call sends its JSON body AES-256-ECB-encrypted with Sek
//      as `{ Data: "<base64>" }`, with `authtoken`/`client_id`/
//      `client_secret`/`gstin`/`user_name` as headers, and gets an equally
//      Sek-encrypted `Data` field back.
//
// Config is split across two places, matched to what Settings > "E-Invoice /
// E-Way Bill Settings" actually lets the user edit:
//   - The non-secret half (enabled, environment, API URLs, ASP ID, and the
//     sandbox/production GSTIN + username pairs) lives in the
//     EInvoiceSettings DB row, edited from that Settings card.
//   - Every password (ASP Password, and the sandbox/production e-invoice
//     Passwords) stays in .env — TAXPRO_ASP_PASSWORD / TAXPRO_PASSWORD /
//     TAXPRO_PRODUCTION_PASSWORD — never stored in the database or sent to
//     the frontend. loadConfig() below merges the two into one config
//     object for whichever environment is in play.
//
// This file owns the whole crypto/config envelope so every route handler
// and the frontend only ever see plain invoice fields (irn, ackNo, qrCode,
// ewayBillNo, ...) or a plain success/failure from testConnection() —
// nothing here (passwords, the ASP secret, key material, the session key)
// ever leaves this module.
//
// The auth step and its crypto are dictated by NIC's spec and are the same
// across every GSP that fronts this API, so they're implemented exactly as
// documented. The actual resource paths below (IRN generate/cancel, e-way
// bill generate/cancel) follow NIC's published `/enriched/ei/api/...`
// naming, which TaxPro mirrors — double-check them against TaxPro's own
// Postman collection/API docs once you're testing against sandbox, and
// adjust the *_PATH constants below if theirs differ; nothing else in this
// file needs to change if they do.
// ---------------------------------------------------------------------------
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const prisma = require('../prisma/client');

// Official NIC / IRP Sandbox Public Key embedded as a built-in default
// so sandbox testing never requires a manual PEM file download or path configuration.
const DEFAULT_SANDBOX_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArxd93uLDs8HTPqcSPpxZ
rf0Dc29r3iPp0a8filjAyeX4RAH6lWm9qFt26CcE8ESYtmo1sVtswvs7VH4Bjg/F
DlRpd+MnAlXuxChij8/vjyAwE71ucMrmZhxM8rOSfPML8fniZ8trr3I4R2o4xWh6
no/xTUtZ02/yUEXbphw3DEuefzHEQnEF+quGji9pvGnPO6Krmnri9H4WPY0ysPQQ
Qd82bUZCk9XdhSZcW/am8wBulYokITRMVHlbRXqu1pOFmQMO5oSpyZU3pXbsx+Ox
IOc4EDX0WMa9aH4+snt18WAXVGwF2B4fmBk7AtmkFzrTmbpmyVqA3KO2IjzMZPw0
hQIDAQAB
-----END PUBLIC KEY-----`;

// API endpoint paths (relative to a loaded config's BASE_URL) — see the
// file header comment on why these specifically are the ones worth
// double-checking against TaxPro's own docs.
const PATHS = {
  AUTH: '/eivital/v1.04/auth',
  GENERATE_EINVOICE: '/eicore/v1.03/Invoice',
  GET_EINVOICE: '/eicore/v1.03/Invoice/irn',
  CANCEL_EINVOICE: '/eicore/v1.03/Invoice/Cancel',
  GENERATE_EWAYBILL: '/eiewb/v1.03/ewaybill',
  GENERATE_EWAYBILL_BY_IRN: '/eiewb/v1.03/ewaybill',
  EWAYBILL_API: '/ewaybillapi/v1.03/ewayapi',
  CANCEL_EWAYBILL: '/ewaybillapi/v1.03/ewayapi',
};

// ---------------------------------------------------------------------------
// Config — merges the EInvoiceSettings DB row with the .env-only passwords
// for whichever environment applies, live on every call (never cached
// beyond the session below) so a Settings save takes effect on the very
// next action without a server restart.
//
// `overrides` lets a caller (namely testConnection, called from the
// Settings form before it's been saved) test against values that aren't in
// the database yet. Any key from the EInvoiceSettings shape can be
// overridden; a key left out falls back to the saved row, then — for
// BASE_URL only — to the legacy TAXPRO_BASE_URL_SANDBOX/PRODUCTION env vars
// for a deployment that hasn't opened Settings yet.
// ---------------------------------------------------------------------------
async function loadConfig(overrides = {}) {
  const settings = (await prisma.eInvoiceSettings.findFirst()) || {};
  const merged = { ...settings, ...overrides };
  const env = String(merged.environment || 'sandbox').toLowerCase();
  const isProd = env === 'production';

  return {
    ENV: env,
    ENABLED: Boolean(merged.enabled),
    BASE_URL: (isProd ? merged.productionApiUrl : merged.sandboxApiUrl)
      || (isProd ? process.env.TAXPRO_BASE_URL_PRODUCTION : process.env.TAXPRO_BASE_URL_SANDBOX),
    GSTIN: isProd ? merged.productionGstin : merged.sandboxGstin,
    USERNAME: isProd ? merged.productionUsername : merged.sandboxUsername,
    // Passwords are deliberately never read from `merged` — even a caller
    // that somehow passed one in `overrides` would be ignored, since these
    // two lines only ever look at process.env.
    PASSWORD: isProd ? process.env.TAXPRO_PRODUCTION_PASSWORD : process.env.TAXPRO_PASSWORD,
    ASP_ID: merged.aspId,
    // Production may have its own ASP secret; falls back to the shared one.
    ASP_PASSWORD: (isProd && process.env.TAXPRO_PRODUCTION_ASP_PASSWORD) || process.env.TAXPRO_ASP_PASSWORD,
    CLIENT_ID: (isProd && process.env.TAXPRO_PRODUCTION_CLIENT_ID) || process.env.TAXPRO_CLIENT_ID,
    CLIENT_SECRET: (isProd && process.env.TAXPRO_PRODUCTION_CLIENT_SECRET) || process.env.TAXPRO_CLIENT_SECRET,
    // Public key is per-environment: production must NEVER pick up the
    // sandbox key vars (the sandbox key would make the auth handshake fail).
    PUBLIC_KEY: isProd ? process.env.TAXPRO_PRODUCTION_PUBLIC_KEY : process.env.TAXPRO_PUBLIC_KEY,
    PUBLIC_KEY_PATH: isProd ? process.env.TAXPRO_PRODUCTION_PUBLIC_KEY_PATH : process.env.TAXPRO_PUBLIC_KEY_PATH,
    QR_CODE_SIZE: Number(settings.qrCodeSize) || 300,
    // Sandbox-only seller address override — not user-editable in Settings
    // (see the EInvoiceSettings model doc comment), so still .env-only with sensible sandbox defaults.
    SANDBOX_SELLER_STCD: process.env.TAXPRO_SANDBOX_SELLER_STCD || '34',
    SANDBOX_SELLER_LOC: process.env.TAXPRO_SANDBOX_SELLER_LOC || 'PUDUCHERRY',
    SANDBOX_SELLER_PIN: process.env.TAXPRO_SANDBOX_SELLER_PIN || 605001,
    SANDBOX_SELLER_LGLNM: process.env.TAXPRO_SANDBOX_SELLER_LGLNM || 'Chartered Information Systems Private Limited',
  };
}

function assertConfigured(c) {
  // PUBLIC_KEY_PATH is deliberately NOT in this list because keys are
  // bundled directly in src/keys/ and embedded as defaults.
  const required = ['BASE_URL', 'GSTIN', 'USERNAME', 'PASSWORD', 'ASP_ID', 'ASP_PASSWORD'];
  const missing = required.filter((k) => !c[k]);
  if (missing.length) {
    const err = new Error(
      `TaxPro GSP is not fully configured for the ${c.ENV} environment (missing: ${missing.join(', ')}). `
      + 'Check Settings > E-Invoice / E-Way Bill Settings and the server .env.'
    );
    err.status = 500;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Crypto — RSA for the auth handshake, AES-256-ECB/PKCS5 for the session
// (both mandated by NIC's spec, not a choice made here).
// ---------------------------------------------------------------------------
const publicKeyCache = new Map();
function getPublicKey(c) {
  const cacheKey = `${c.ENV}:${c.PUBLIC_KEY || c.PUBLIC_KEY_PATH || 'default'}`;
  if (publicKeyCache.has(cacheKey)) return publicKeyCache.get(cacheKey);

  let key = null;

  // 1. Direct inline PEM in env var TAXPRO_PUBLIC_KEY
  if (c.PUBLIC_KEY && typeof c.PUBLIC_KEY === 'string' && c.PUBLIC_KEY.trim()) {
    key = c.PUBLIC_KEY.trim().replace(/\\n/g, '\n');
  }

  // 2. Custom file path in TAXPRO_PUBLIC_KEY_PATH (if provided and file exists)
  if (!key && c.PUBLIC_KEY_PATH) {
    const candidatePath = path.isAbsolute(c.PUBLIC_KEY_PATH)
      ? c.PUBLIC_KEY_PATH
      : path.resolve(process.cwd(), c.PUBLIC_KEY_PATH);
    if (fs.existsSync(candidatePath)) {
      try {
        key = fs.readFileSync(candidatePath, 'utf8');
      } catch (_) {
        // Fall through to bundled defaults
      }
    }
  }

  // 3. Bundled keys in src/keys/
  if (!key) {
    const bundledFilename = c.ENV === 'production' ? 'einv_production.pem' : 'einv_sandbox.pem';
    const bundledPath = path.resolve(__dirname, '../keys', bundledFilename);
    if (fs.existsSync(bundledPath)) {
      try {
        key = fs.readFileSync(bundledPath, 'utf8');
      } catch (_) {
        // Fall through to embedded fallback
      }
    }
  }

  // 4. In-memory embedded fallback for sandbox
  if (!key && c.ENV !== 'production') {
    key = DEFAULT_SANDBOX_PUBLIC_KEY;
  }

  if (!key) {
    const err = new Error(
      `TaxPro/NIC public key is missing for ${c.ENV} environment. `
      + 'Place the production public key in backend/src/keys/einv_production.pem, or set TAXPRO_PRODUCTION_PUBLIC_KEY_PATH or TAXPRO_PRODUCTION_PUBLIC_KEY in .env.'
    );
    err.status = 500;
    throw err;
  }

  publicKeyCache.set(cacheKey, key);
  return key;
}

// NIC's spec calls for RSA/ECB/PKCS1Padding specifically (not OAEP).
function rsaEncrypt(plainText, c) {
  return crypto.publicEncrypt(
    { key: getPublicKey(c), padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(plainText, 'utf8'),
  ).toString('base64');
}

function aesEncrypt(plainText, keyBuffer) {
  const cipher = crypto.createCipheriv('aes-256-ecb', keyBuffer, null);
  cipher.setAutoPadding(true);
  return Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]).toString('base64');
}

function aesDecryptBuffer(base64CipherText, keyBuffer) {
  const decipher = crypto.createDecipheriv('aes-256-ecb', keyBuffer, null);
  decipher.setAutoPadding(true);
  return Buffer.concat([decipher.update(Buffer.from(base64CipherText, 'base64')), decipher.final()]);
}

function aesDecrypt(base64CipherText, keyBuffer) {
  return aesDecryptBuffer(base64CipherText, keyBuffer).toString('utf8');
}

// ---------------------------------------------------------------------------
// Session — one authenticate() per (environment, GSTIN) pair per process
// (or per expiry), cached like every other bearer-token integration in this
// app. Pure function: does NOT touch the cache itself, so testConnection()
// can call it directly for a one-off dry run without disturbing whatever
// session real invoice actions are relying on.
// ---------------------------------------------------------------------------
async function authenticate(c) {
  assertConfigured(c);
  // The client picks this random 32-byte AES key itself and hands it to
  // the IRP RSA-encrypted; the IRP's auth response is then encrypted right
  // back with it. Whatever session key (Sek) the IRP issues for later calls
  // comes out of THAT decrypted response — it is not necessarily this same
  // key, so appKey is only ever used to read the auth response itself.
  const appKey = crypto.randomBytes(32);

  // Per NIC/TaxPro v1.04 auth specification: the credentials payload is
  // Base64-encoded, then RSA-encrypted with the IRP public key, and sent
  // as { Data: "<base64>" }.
  const innerPayload = JSON.stringify({
    UserName: c.USERNAME,
    Password: c.PASSWORD,
    AppKey: appKey.toString('base64'),
    ForceRefreshAccessToken: false,
  });
  const base64Inner = Buffer.from(innerPayload, 'utf8').toString('base64');
  const encryptedData = rsaEncrypt(base64Inner, c);

  const authHeaders = {
    'Content-Type': 'application/json',
    aspid: c.ASP_ID,
    password: c.ASP_PASSWORD,
    gstin: c.GSTIN,
    username: c.USERNAME,
  };
  // Do NOT pass client_id / client_secret unless explicitly configured via TAXPRO_CLIENT_ID / TAXPRO_CLIENT_SECRET.
  // TaxPro GSP automatically attaches its registered GSP client_id when communicating with NIC.
  // If an invalid client_id (such as ASP ID) is sent, NIC returns "Invalid Client-ID/Client-Secret".
  if (c.CLIENT_ID) authHeaders.client_id = c.CLIENT_ID;
  if (c.CLIENT_SECRET) authHeaders.client_secret = c.CLIENT_SECRET;

  const res = await fetch(`${c.BASE_URL}${PATHS.AUTH}`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      Data: encryptedData,
    }),
  });
  const rawBody = await res.text().catch(() => '');
  let data = {};
  try { data = JSON.parse(rawBody); } catch (_) { /* non-JSON body, reported below */ }
  if (!res.ok || Number(data?.Status) !== 1 || !data?.Data) {
    // Request headers/body (which carry the passwords) are never logged —
    // only the provider's own reply, so a 401/403 can be diagnosed.
    console.error(`TaxPro auth failed [${c.ENV}] ${c.BASE_URL}${PATHS.AUTH} -> HTTP ${res.status}:`, rawBody.slice(0, 500));
    const providerMsg = data?.ErrorDetails?.[0]?.ErrorMessage || data?.Message || data?.message
      || (typeof data?.error === 'string' ? data.error : '') || (rawBody && !rawBody.trim().startsWith('<') ? rawBody.slice(0, 200) : '');
    const err = new Error(
      `TaxPro GSP authentication failed (${res.status})${providerMsg ? `: ${providerMsg}` : ''}`
      + (!providerMsg && (res.status === 401 || res.status === 403)
        ? ' — check the ASP ID/password for this environment and that this server\'s public IP is whitelisted with TaxPro.'
        : '')
    );
    err.status = 502;
    throw err;
  }

  let decrypted;
  try {
    if (typeof data.Data === 'string') {
      decrypted = JSON.parse(aesDecrypt(data.Data, appKey));
    } else {
      decrypted = data.Data;
    }
  } catch (e) {
    const err = new Error('TaxPro GSP authentication succeeded but the response could not be decrypted.');
    err.status = 502;
    throw err;
  }

  // Decrypt session encryption key (Sek) using appKey
  let sekBuffer;
  try {
    const rawSek = typeof decrypted.Sek === 'string' ? decrypted.Sek : '';
    const decryptedSek = aesDecryptBuffer(rawSek, appKey);
    sekBuffer = decryptedSek.length === 32 ? decryptedSek : Buffer.from(rawSek, 'base64');
  } catch (_) {
    sekBuffer = Buffer.from(decrypted.Sek, 'base64');
  }

  return {
    clientId: decrypted.ClientId || c.CLIENT_ID,
    authToken: decrypted.AuthToken,
    sek: sekBuffer,
    // TokenExpiry is an absolute timestamp string in NIC's response;
    // fall back to a conservative 6 hours (their usual validity window)
    // if it's missing or unparseable.
    expiresAt: (() => {
      const t = decrypted.TokenExpiry ? new Date(decrypted.TokenExpiry).getTime() : NaN;
      return Number.isFinite(t) ? t : Date.now() + 6 * 60 * 60 * 1000;
    })(),
  };
}

const sessions = new Map(); // key `${ENV}:${GSTIN}` -> { authToken, sek, clientId, expiresAt }

async function getSession(c) {
  const key = `${c.ENV}:${c.GSTIN}`;
  const cached = sessions.get(key);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached;
  const fresh = await authenticate(c);
  sessions.set(key, fresh);
  return fresh;
}

// Every non-auth call: body -> AES(Sek) -> { Data }, response.Data -> AES
// decrypt(Sek) -> JSON. `action` is NIC's own discriminator for the
// multi-purpose endpoints (e-way bill generate/cancel share one path).
async function callGsp(path, payload, c, { action, method = 'POST' } = {}) {
  assertConfigured(c);
  const { authToken, sek, clientId } = await getSession(c);

  const headers = {
    'Content-Type': 'application/json',
    aspid: c.ASP_ID,
    password: c.ASP_PASSWORD,
    gstin: c.GSTIN,
    user_name: c.USERNAME,
    authtoken: authToken,
  };
  if (clientId) headers.client_id = clientId;

  const fetchOptions = { method, headers };
  if (method === 'POST') {
    const body = { Data: aesEncrypt(JSON.stringify(payload), sek) };
    if (action) body.Action = action;
    fetchOptions.body = JSON.stringify(body);
  }

  const res = await fetch(`${c.BASE_URL}${path}`, fetchOptions);
  const data = await res.json().catch(() => ({}));

  // A stale/rejected auth token, unlike every other failure below, is worth
  // one silent retry: drop the cached session and replay the call once
  // rather than surfacing a confusing "invalid token" error to the user for
  // something that had nothing to do with their action.
  if (Number(data?.Status) !== 1 && /invalid.*token|token.*expired/i.test(data?.ErrorDetails?.[0]?.ErrorMessage || '')) {
    sessions.delete(`${c.ENV}:${c.GSTIN}`);
    return callGsp(path, payload, c, { action });
  }

  const statusVal = data?.Status != null ? Number(data.Status) : (data?.status != null ? Number(data.status) : NaN);
  const rawData = data?.Data || data?.data;

  let decodedErrorMsg = data?.ErrorDetails?.[0]?.ErrorMessage || data?.Message;
  if (!decodedErrorMsg && data?.error && typeof data.error === 'string') {
    try {
      const decodedErr = JSON.parse(Buffer.from(data.error, 'base64').toString());
      decodedErrorMsg = decodedErr.errorCodes || String(data.error);
    } catch (_) {
      decodedErrorMsg = data.error;
    }
  }

  const rawInfo = data?.InfoDtls || data?.info;
  if (rawInfo && typeof rawInfo === 'string') {
    try {
      const infoText = Buffer.from(rawInfo, 'base64').toString('utf8').replace(/^,\s*/, '').trim();
      if (infoText) {
        decodedErrorMsg = decodedErrorMsg ? `${decodedErrorMsg}: ${infoText}` : infoText;
      }
    } catch (_) {}
  }

  if (!res.ok || statusVal !== 1) {
    const err = new Error(
      decodedErrorMsg || `TaxPro GSP request to ${path} failed (${res.status}).`
    );
    err.status = res.status >= 400 && res.status < 500 ? 400 : 502;
    err.errors = Array.isArray(data?.ErrorDetails)
      ? data.ErrorDetails.map((e) => ({ msg: e.ErrorMessage || String(e) }))
      : (decodedErrorMsg ? [{ msg: decodedErrorMsg }] : undefined);
    err.infoDtls = data?.InfoDtls || data?.info;
    throw err;
  }

  if (!rawData) return data;
  try {
    if (typeof rawData === 'string') {
      return JSON.parse(aesDecrypt(rawData, sek));
    }
    return rawData;
  } catch (e) {
    const err = new Error(`TaxPro GSP response from ${path} could not be decrypted.`);
    err.status = 502;
    throw err;
  }
}

// Settings > "E-Invoice / E-Way Bill Settings" > Test Connection. Runs the
// auth handshake only, against whatever the form currently holds (not
// necessarily saved) merged over the saved row — see loadConfig(). Always a
// fresh handshake and never written into the `sessions` cache real invoice
// actions use, so testing sandbox doesn't leave a stale sandbox token
// sitting under a key production traffic might later reuse.
async function testConnection(overrides = {}) {
  const c = await loadConfig(overrides);
  assertConfigured(c);
  await authenticate(c);
}

// ---------------------------------------------------------------------------
// Invoice loading / guards shared by all four actions.
// ---------------------------------------------------------------------------
async function loadInvoice(invoiceId) {
  const invoice = await prisma.salesInvoice.findUnique({
    where: { id: Number(invoiceId) },
    include: { items: { orderBy: { id: 'asc' } } },
  });
  if (!invoice) {
    const err = new Error('Sales Invoice not found.');
    err.status = 404;
    throw err;
  }
  if (!invoice.invoiceNo) {
    const err = new Error('Save the invoice before generating an e-invoice or e-way bill.');
    err.status = 400;
    throw err;
  }
  return invoice;
}

// Every public generate/cancel action shares this: load config, load the
// invoice, and refuse outright if the feature is switched off in Settings —
// checked here rather than only in assertConfigured() so the error is "not
// enabled" instead of a confusing "missing config" when it's fully
// configured but the toggle is just off.
async function loadContext(invoiceId) {
  const [c, invoice, companyDetails] = await Promise.all([
    loadConfig(),
    loadInvoice(invoiceId),
    prisma.companyDetails.findFirst().catch(() => null),
  ]);
  if (!c.ENABLED) {
    const err = new Error('E-Invoicing is disabled. Turn it on in Settings > E-Invoice / E-Way Bill Settings.');
    err.status = 400;
    throw err;
  }
  return { c, invoice, companyDetails: companyDetails || {} };
}

function requireReason(reason) {
  if (!reason || !String(reason).trim()) {
    const err = new Error('A cancel reason is required.');
    err.status = 400;
    err.errors = [{ path: 'cancelReason', msg: 'A cancel reason is required.' }];
    throw err;
  }
  return String(reason).trim();
}

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

function parseGspDate(s) {
  if (!s) return null;
  const str = String(s).trim();
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?/i);
  if (match) {
    const [, dd, mm, yyyy, rawH, min = '00', sec = '00', meridiem] = match;
    let h = rawH ? Number(rawH) : 0;
    if (meridiem) {
      if (meridiem.toUpperCase() === 'PM' && h < 12) h += 12;
      if (meridiem.toUpperCase() === 'AM' && h === 12) h = 0;
    }
    const hh = String(h).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}:${sec}.000Z`;
  }
  return str;
}

function formatGspDate(d) {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return undefined;
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

const STATE_CODE_MAP = {
  'JAMMU AND KASHMIR': '01',
  'JAMMU & KASHMIR': '01',
  'HIMACHAL PRADESH': '02',
  'PUNJAB': '03',
  'CHANDIGARH': '04',
  'UTTARAKHAND': '05',
  'HARYANA': '06',
  'DELHI': '07',
  'RAJASTHAN': '08',
  'UTTAR PRADESH': '09',
  'BIHAR': '10',
  'SIKKIM': '11',
  'ARUNACHAL PRADESH': '12',
  'NAGALAND': '13',
  'MANIPUR': '14',
  'MIZORAM': '15',
  'TRIPURA': '16',
  'MEGHALAYA': '17',
  'ASSAM': '18',
  'WEST BENGAL': '19',
  'JHARKHAND': '20',
  'ODISHA': '21',
  'CHHATTISGARH': '22',
  'MADHYA PRADESH': '23',
  'GUJARAT': '24',
  'DAMAN AND DIU': '25',
  'DADRA AND NAGAR HAVELI': '26',
  'MAHARASHTRA': '27',
  'ANDHRA PRADESH': '37',
  'KARNATAKA': '29',
  'GOA': '30',
  'LAKSHADWEEP': '31',
  'KERALA': '32',
  'TAMIL NADU': '33',
  'PUDUCHERRY': '34',
  'PONDICHERRY': '34',
  'ANDAMAN AND NICOBAR ISLANDS': '35',
  'ANDAMAN & NICOBAR': '35',
  'TELANGANA': '36',
  'ANDHRA PRADESH (NEW)': '37',
  'LADAKH': '38',
  'OTHER TERRITORY': '97',
};

function parseStateCode(input, fallbackGstin) {
  if (!input && fallbackGstin && fallbackGstin.length >= 2 && /^\d{2}/.test(fallbackGstin)) {
    return fallbackGstin.slice(0, 2);
  }
  if (!input) return null;
  const str = String(input).trim().toUpperCase();
  if (/^\d{1,2}$/.test(str)) {
    return str.padStart(2, '0');
  }
  for (const [stateName, code] of Object.entries(STATE_CODE_MAP)) {
    if (str.includes(stateName)) {
      return code;
    }
  }
  if (fallbackGstin && fallbackGstin.length >= 2 && /^\d{2}/.test(fallbackGstin)) {
    return fallbackGstin.slice(0, 2);
  }
  return null;
}

const GST_UOM_MAP = {
  NO: 'NOS',
  NOS: 'NOS',
  NUM: 'NOS',
  EA: 'NOS',
  EACH: 'NOS',
  PC: 'PCS',
  PCS: 'PCS',
  PIECE: 'PCS',
  KG: 'KGS',
  KGS: 'KGS',
  GM: 'GMS',
  GMS: 'GMS',
  LTR: 'LTR',
  LITRE: 'LTR',
  LITER: 'LTR',
  LT: 'LTR',
  L: 'LTR',
  M: 'MTR',
  MTR: 'MTR',
  METER: 'MTR',
  BOX: 'BOX',
  SET: 'SET',
  CAN: 'CAN',
  BAG: 'BAG',
  BTL: 'BTL',
  ROL: 'ROL',
  PAC: 'PAC',
  PACK: 'PAC',
  DRM: 'DRM',
  DRUM: 'DRM',
  PAIR: 'PRS',
  PRS: 'PRS',
  QTL: 'QTL',
  TON: 'TON',
  UNT: 'UNT',
  UNIT: 'UNT',
};

function normalizeUom(raw) {
  if (!raw) return 'NOS';
  const clean = String(raw).trim().toUpperCase();
  if (GST_UOM_MAP[clean]) return GST_UOM_MAP[clean];
  if (clean.length < 3) return 'OTH';
  if (clean.length > 8) return clean.slice(0, 8);
  return clean;
}

function buildSellerDtls(invoice, c, companyDetails = {}) {
  if (c.ENV === 'sandbox') {
    return {
      Gstin: c.GSTIN,
      LglNm: c.SANDBOX_SELLER_LGLNM || 'Chartered Information Systems Private Limited',
      Addr1: (c.SANDBOX_SELLER_LOC || 'PUDUCHERRY').slice(0, 100),
      Loc: (c.SANDBOX_SELLER_LOC || 'PUDUCHERRY').slice(0, 100),
      Pin: Number(c.SANDBOX_SELLER_PIN) || 605001,
      Stcd: String(c.SANDBOX_SELLER_STCD || '34').padStart(2, '0'),
    };
  }

  const stcd = parseStateCode(companyDetails.state, c.GSTIN) || (c.GSTIN && c.GSTIN.slice(0, 2)) || '32';
  const cleanAddr = (companyDetails.address || invoice.billingAddress || 'Seller Address')
    .replace(/[\r\n]+/g, ', ')
    .slice(0, 100);

  return {
    Gstin: c.GSTIN,
    LglNm: (companyDetails.legalName || companyDetails.companyName || 'Kemach Equipments Private Limited').trim().slice(0, 100),
    Addr1: cleanAddr.length >= 3 ? cleanAddr : 'Seller Address',
    Loc: (companyDetails.city || invoice.branch || 'City').trim().slice(0, 100),
    Pin: Number(companyDetails.pincode) || 683550,
    Stcd: stcd,
  };
}

function buildBuyerDtls(invoice, sellerStcd) {
  const gstin = invoice.gstNo && invoice.gstNo.trim().length === 15 ? invoice.gstNo.trim().toUpperCase() : 'URP';
  const rawAddr = (invoice.shippingAddress || invoice.billingAddress || '').trim();
  const cleanAddr = rawAddr.replace(/[\r\n]+/g, ', ');

  const pinMatch = cleanAddr.match(/\b(\d{6})\b/);
  const pin = pinMatch ? Number(pinMatch[1]) : 999999;

  let pos = parseStateCode(invoice.placeOfSupply, gstin !== 'URP' ? gstin : null);
  if (!pos) pos = parseStateCode(cleanAddr, gstin !== 'URP' ? gstin : null);
  if (!pos) pos = sellerStcd;

  const parts = cleanAddr.split(',').map((s) => s.trim()).filter(Boolean);
  let loc = 'City';
  if (parts.length > 2) {
    loc = parts[parts.length - 4] || parts[parts.length - 3] || parts[1];
  } else if (parts[0]) {
    loc = parts[0];
  }
  const addr1 = parts[0] || 'Buyer Address';

  return {
    Gstin: gstin,
    LglNm: (invoice.customer || 'Buyer').trim().slice(0, 100),
    Pos: pos,
    Addr1: addr1.length >= 3 ? addr1.slice(0, 100) : 'Buyer Address',
    Loc: loc.length >= 3 ? loc.slice(0, 100) : 'City',
    Pin: pin,
    Stcd: pos,
  };
}

// ---------------------------------------------------------------------------
// E-Invoice (IRN)
// ---------------------------------------------------------------------------
function buildEInvoicePayload(invoice, c, companyDetails = {}) {
  const sellerDtls = buildSellerDtls(invoice, c, companyDetails);
  const buyerDtls = buildBuyerDtls(invoice, sellerDtls.Stcd);
  const isInterState = sellerDtls.Stcd !== buyerDtls.Pos;

  let totalAssVal = 0;
  let totalCgstVal = 0;
  let totalSgstVal = 0;
  let totalIgstVal = 0;

  const itemList = (invoice.items || []).map((item, idx) => {
    const qty = Number(item.quantity) || 0;
    const unitPrice = round2(item.unitPrice);
    const gross = round2(qty * unitPrice);
    const discount = round2(gross * (Number(item.discountPercent) || 0) / 100);
    const assAmt = round2(item.amount != null ? item.amount : gross - discount);
    const gstRt = Number(item.taxPercent) || 0;

    let cgstAmt = 0;
    let sgstAmt = 0;
    let igstAmt = 0;

    if (isInterState) {
      igstAmt = round2(assAmt * gstRt / 100);
    } else {
      cgstAmt = round2(assAmt * (gstRt / 2) / 100);
      sgstAmt = round2(assAmt * (gstRt / 2) / 100);
    }

    const totItemVal = round2(assAmt + cgstAmt + sgstAmt + igstAmt);

    totalAssVal += assAmt;
    totalCgstVal += cgstAmt;
    totalSgstVal += sgstAmt;
    totalIgstVal += igstAmt;

    const rawHsn = String(item.hsnCode || '').replace(/\D/g, '');
    const hsnCd = rawHsn.length >= 4 ? rawHsn : '27101974';
    const isServc = hsnCd.startsWith('99') ? 'Y' : 'N';
    const uom = normalizeUom(item.uom);

    return {
      SlNo: String(idx + 1),
      PrdDesc: (item.description || item.productName || item.productCode || 'Item').slice(0, 100),
      IsServc: isServc,
      HsnCd: hsnCd,
      Qty: qty,
      Unit: uom,
      UnitPrice: unitPrice,
      TotAmt: gross,
      Discount: discount,
      AssAmt: assAmt,
      GstRt: gstRt,
      IgstAmt: igstAmt,
      CgstAmt: cgstAmt,
      SgstAmt: sgstAmt,
      TotItemVal: totItemVal,
    };
  });

  totalAssVal = round2(totalAssVal);
  totalCgstVal = round2(totalCgstVal);
  totalSgstVal = round2(totalSgstVal);
  totalIgstVal = round2(totalIgstVal);
  const totalItemValSum = round2(totalAssVal + totalCgstVal + totalSgstVal + totalIgstVal);
  const rndOff = round2(Number(invoice.amount) - totalItemValSum);
  const totInvVal = round2(totalItemValSum + rndOff);

  const validSupTypes = ['B2B', 'SEZWP', 'SEZWOP', 'EXPWP', 'EXPWOP', 'DEXP'];
  const supTyp = validSupTypes.includes(invoice.billingType) ? invoice.billingType : 'B2B';

  return {
    Version: '1.1',
    TranDtls: { TaxSch: 'GST', SupTyp: supTyp },
    DocDtls: { Typ: 'INV', No: invoice.invoiceNo, Dt: formatGspDate(invoice.invoiceDate) },
    SellerDtls: sellerDtls,
    BuyerDtls: buyerDtls,
    ItemList: itemList,
    ValDtls: {
      AssVal: totalAssVal,
      CgstVal: totalCgstVal,
      SgstVal: totalSgstVal,
      IgstVal: totalIgstVal,
      RndOffAmt: rndOff,
      TotInvVal: totInvVal,
    },
  };
}

function mapEInvoiceResponse(data) {
  return {
    irn: data?.Irn || null,
    ackNo: data?.AckNo != null ? String(data.AckNo) : null,
    ackDate: parseGspDate(data?.AckDt),
    qrCode: data?.SignedQRCode || null,
  };
}

async function generateEInvoice(invoiceId) {
  const { c, invoice, companyDetails } = await loadContext(invoiceId);
  if (invoice.einvoiceStatus === 'Generated') {
    const err = new Error('An e-invoice has already been generated for this document. Cancel it before regenerating.');
    err.status = 409;
    throw err;
  }
  if (!invoice.gstNo && invoice.billingType === 'B2C') {
    const err = new Error('E-Invoicing is only applicable to B2B / SEZ / Export supplies with a valid customer GSTIN under GST rules. B2C invoices do not generate an IRN.');
    err.status = 400;
    throw err;
  }
  let data;
  try {
    data = await callGsp(PATHS.GENERATE_EINVOICE, buildEInvoicePayload(invoice, c, companyDetails), c);
  } catch (err) {
    if (err.infoDtls?.[0]?.Desc?.Irn) {
      data = err.infoDtls[0].Desc;
    } else {
      throw err;
    }
  }

  // If QR code or full signed invoice wasn't in the response (e.g. recovered from duplicate IRN info), fetch it
  if (!data?.SignedQRCode && data?.Irn) {
    try {
      const full = await callGsp(`${PATHS.GET_EINVOICE}/${data.Irn}`, null, c, { method: 'GET' });
      if (full?.SignedQRCode) data = full;
    } catch (_) {}
  }

  const mapped = mapEInvoiceResponse(data);

  // REGRESSION GUARD: the provider answered without error, but the response
  // this call actually parsed carried no Irn at all (a differently-shaped
  // success response than mapEInvoiceResponse expects, or a genuine
  // provider-side gap). Saving einvoiceStatus: 'Generated' anyway used to
  // happen unconditionally here, which left the invoice looking successful
  // (chip says "Generated", Generate IRN disables itself) while the IRN box
  // stays permanently blank -- and because Cancel IRN requires an existing
  // irn, there was no way back from that state either. Failing loudly here
  // instead means the invoice is never silently marked Generated without
  // one, and console.error leaves the exact raw shape TaxPro sent to
  // diagnose why -- see mapEInvoiceResponse just above for the fields it
  // reads.
  if (!mapped.irn) {
    console.error('TaxPro GSP e-invoice generate returned no Irn for invoice', invoice.invoiceNo, '— raw response:', JSON.stringify(data));
    const err = new Error(
      'TaxPro GSP did not return an IRN for this invoice. Nothing was saved — check the invoice details and try again, or contact support with the server logs if this persists.'
    );
    err.status = 502;
    throw err;
  }

  return prisma.salesInvoice.update({
    where: { id: invoice.id },
    data: {
      irn: mapped.irn,
      ackNo: mapped.ackNo,
      ackDate: mapped.ackDate ? new Date(mapped.ackDate) : new Date(),
      qrCode: mapped.qrCode,
      einvoiceStatus: 'Generated',
      einvoiceCancelReason: null,
    },
  });
}

async function cancelEInvoice(invoiceId, reason) {
  const { c, invoice } = await loadContext(invoiceId);
  if (!invoice.irn) {
    // Bug-recovery path: an invoice can be stuck with einvoiceStatus
    // 'Generated' but no irn if it was generated before generateEInvoice's
    // own guard (see that function's comment) started refusing to save
    // that combination. There is nothing registered with the government to
    // cancel in that case, so this just resets the invoice's own e-invoice
    // status locally instead of calling TaxPro GSP at all -- the frontend's
    // Cancel IRN button is enabled for exactly this state (see
    // SalesInvoice.jsx) so there is a way out of it.
    if (invoice.einvoiceStatus === 'Generated') {
      return prisma.salesInvoice.update({
        where: { id: invoice.id },
        data: { einvoiceStatus: 'Not Generated', einvoiceCancelReason: null },
      });
    }
    const err = new Error('No IRN has been generated for this invoice.');
    err.status = 400;
    throw err;
  }
  const cleanReason = requireReason(reason);
  try {
    await callGsp(PATHS.CANCEL_EINVOICE, { Irn: invoice.irn, CnlRsn: '1', CnlRem: cleanReason }, c);
  } catch (err) {
    if (!/not active|already cancelled/i.test(err.message)) {
      throw err;
    }
  }
  return prisma.salesInvoice.update({
    where: { id: invoice.id },
    data: { einvoiceStatus: 'Cancelled', einvoiceCancelReason: cleanReason },
  });
}

// ---------------------------------------------------------------------------
// E-Way Bill
// ---------------------------------------------------------------------------
const TRANSPORT_MODE_CODE = { Road: '1', Rail: '2', Air: '3', Ship: '4' };

// E-way bill generation off an existing IRN uses the IRN itself, not a
// fresh set of item lines — NIC re-derives everything else from the
// e-invoice already on file for it.
function buildEWayBillPayload(invoice, options) {
  const transMode = TRANSPORT_MODE_CODE[options.transportMode ?? invoice.transportMode] || '1';
  const payload = {
    Irn: invoice.irn || undefined,
    Distance: Number(options.distanceKm ?? invoice.ewayDistanceKm) || 0,
    TransMode: transMode,
  };

  const transId = (options.transporterGstin || invoice.transporterGstin || '').trim();
  if (transId) payload.TransId = transId;

  const transName = (options.transporterName || invoice.transporterName || '').trim();
  if (transName) payload.TransName = transName;

  payload.TransDocNo = options.transDocNo || invoice.invoiceNo;
  payload.TransDocDt = formatGspDate(options.transDocDt || invoice.invoiceDate);

  const rawVehNo = options.vehicleNo || invoice.vehicleNo;
  if (rawVehNo && String(rawVehNo).trim()) {
    payload.VehNo = String(rawVehNo).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    payload.VehType = options.vehType || 'R';
  }

  return payload;
}

function mapEWayBillResponse(data) {
  let distanceKm = null;
  if (data?.alert && typeof data.alert === 'string') {
    const m = data.alert.match(/distance.*?(\d+)/i);
    if (m) distanceKm = Number(m[1]);
  }
  return {
    ewayBillNo: data?.EwbNo != null ? String(data.EwbNo) : (data?.ewayBillNo != null ? String(data.ewayBillNo) : null),
    ewayBillDate: parseGspDate(data?.EwbDt || data?.ewayBillDate),
    ewayBillValidUpto: parseGspDate(data?.EwbValidTill || data?.validUpto),
    distanceKm,
  };
}

function buildStandaloneEWayBillPayload(invoice, c, companyDetails = {}, options = {}) {
  const sellerDtls = buildSellerDtls(invoice, c, companyDetails);
  const buyerDtls = buildBuyerDtls(invoice, sellerDtls.Stcd);
  const isInterState = sellerDtls.Stcd !== buyerDtls.Pos;

  if (!buyerDtls.Pin || !/^\d{6}$/.test(String(buyerDtls.Pin))) {
    const err = new Error('A valid 6-digit destination Pincode is required in the customer address for E-Way Bill generation.');
    err.status = 400;
    err.errors = [{ path: 'shippingAddress', msg: 'A valid 6-digit destination Pincode is required.' }];
    throw err;
  }

  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  const itemList = (invoice.items || []).map((item, idx) => {
    const qty = Number(item.quantity) || 0;
    const unitPrice = round2(item.unitPrice);
    const gross = round2(qty * unitPrice);
    const discount = round2(gross * (Number(item.discountPercent) || 0) / 100);
    const assAmt = round2(item.amount != null ? item.amount : gross - discount);
    const gstRt = Number(item.taxPercent) || 0;

    let cgstAmt = 0;
    let sgstAmt = 0;
    let igstAmt = 0;
    let cgstRate = 0;
    let sgstRate = 0;
    let igstRate = 0;

    if (isInterState) {
      igstAmt = round2(assAmt * gstRt / 100);
      igstRate = gstRt;
    } else {
      cgstAmt = round2(assAmt * (gstRt / 2) / 100);
      sgstAmt = round2(assAmt * (gstRt / 2) / 100);
      cgstRate = round2(gstRt / 2);
      sgstRate = round2(gstRt / 2);
    }

    totalTaxable += assAmt;
    totalCgst += cgstAmt;
    totalSgst += sgstAmt;
    totalIgst += igstAmt;

    const rawHsn = String(item.hsnCode || '').replace(/\D/g, '');
    const hsnCode = Number(rawHsn.length >= 4 ? rawHsn : '84295200');
    const uom = normalizeUom(item.uom);

    return {
      itemNo: idx + 1,
      productName: (item.productName || item.productCode || 'Item').slice(0, 100),
      productDesc: (item.description || item.productName || 'Item').slice(0, 100),
      hsnCode: hsnCode,
      quantity: qty,
      qtyUnit: uom,
      cgstRate: cgstRate,
      sgstRate: sgstRate,
      igstRate: igstRate,
      cessRate: 0,
      taxableAmount: assAmt,
    };
  });

  totalTaxable = round2(totalTaxable);
  totalCgst = round2(totalCgst);
  totalSgst = round2(totalSgst);
  totalIgst = round2(totalIgst);
  const taxSum = round2(totalTaxable + totalCgst + totalSgst + totalIgst);
  const totInvVal = round2(Number(invoice.amount) || taxSum);
  const otherValue = round2(totInvVal - taxSum);

  const transMode = TRANSPORT_MODE_CODE[options.transportMode ?? invoice.transportMode] || '1';
  const transDistance = Number(options.distanceKm ?? invoice.ewayDistanceKm) || 0;
  const transId = (options.transporterGstin || invoice.transporterGstin || '').trim();
  const transName = (options.transporterName || invoice.transporterName || '').trim();

  const payload = {
    supplyType: 'O',
    subSupplyType: '1',
    docType: 'INV',
    docNo: invoice.invoiceNo,
    docDate: formatGspDate(invoice.invoiceDate),
    fromGstin: sellerDtls.Gstin,
    fromTrdName: sellerDtls.LglNm,
    fromAddr1: sellerDtls.Addr1,
    fromPlace: sellerDtls.Loc,
    fromPincode: Number(sellerDtls.Pin),
    actFromStateCode: Number(sellerDtls.Stcd),
    fromStateCode: Number(sellerDtls.Stcd),
    toGstin: buyerDtls.Gstin,
    toTrdName: buyerDtls.LglNm,
    toAddr1: buyerDtls.Addr1,
    toPlace: buyerDtls.Loc,
    toPincode: Number(buyerDtls.Pin),
    actToStateCode: Number(buyerDtls.Stcd),
    toStateCode: Number(buyerDtls.Stcd),
    transactionType: 1,
    totalValue: totalTaxable,
    cgstValue: totalCgst,
    sgstValue: totalSgst,
    igstValue: totalIgst,
    cessValue: 0,
    otherValue: otherValue,
    totInvValue: totInvVal,
    transMode: transMode,
    transDistance: transDistance,
    itemList: itemList,
  };

  if (transId) payload.transporterId = transId;
  if (transName) payload.transporterName = transName;
  payload.transDocNo = options.transDocNo || invoice.invoiceNo;
  payload.transDocDate = formatGspDate(options.transDocDt || invoice.invoiceDate);

  const rawVehNo = options.vehicleNo || invoice.vehicleNo;
  if (rawVehNo && String(rawVehNo).trim()) {
    payload.vehicleNo = String(rawVehNo).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    payload.vehicleType = options.vehType || 'R';
  }

  return payload;
}

async function generateEWayBill(invoiceId, options = {}) {
  const { c, invoice, companyDetails } = await loadContext(invoiceId);
  if (invoice.ewayBillStatus === 'Generated') {
    const err = new Error('An e-way bill has already been generated for this document. Cancel it before regenerating.');
    err.status = 409;
    throw err;
  }
  if (!(options.transportMode ?? invoice.transportMode)) {
    const err = new Error('Transport Mode is required to generate an e-way bill.');
    err.status = 400;
    err.errors = [{ path: 'transportMode', msg: 'Transport Mode is required.' }];
    throw err;
  }

  const rawVehNo = (options.vehicleNo || invoice.vehicleNo || '').trim();
  const rawTransGstin = (options.transporterGstin || invoice.transporterGstin || '').trim();
  if (!rawVehNo && !rawTransGstin) {
    const err = new Error('Vehicle Number or Transporter ID (GSTIN) is required to generate an e-way bill.');
    err.status = 400;
    err.errors = [{ path: 'vehicleNo', msg: 'Vehicle Number or Transporter ID is required.' }];
    throw err;
  }

  let data;
  if (invoice.irn && invoice.einvoiceStatus === 'Generated') {
    // Generate E-Way Bill linked to active IRN
    data = await callGsp(PATHS.GENERATE_EWAYBILL_BY_IRN, buildEWayBillPayload(invoice, options), c);
  } else {
    // Generate Standalone E-Way Bill (e.g. B2C or invoices without an IRN)
    data = await callGsp(
      PATHS.EWAYBILL_API,
      buildStandaloneEWayBillPayload(invoice, c, companyDetails, options),
      c,
      { action: 'GENEWAYBILL' }
    );
  }

  const mapped = mapEWayBillResponse(data);
  const finalDistance = options.distanceKm != null && options.distanceKm !== ''
    ? Number(options.distanceKm)
    : (mapped.distanceKm ?? invoice.ewayDistanceKm);

  return prisma.salesInvoice.update({
    where: { id: invoice.id },
    data: {
      ewayBillNo: mapped.ewayBillNo,
      ewayBillDate: mapped.ewayBillDate ? new Date(mapped.ewayBillDate) : new Date(),
      ewayBillValidUpto: mapped.ewayBillValidUpto ? new Date(mapped.ewayBillValidUpto) : null,
      ewayBillStatus: 'Generated',
      ewayCancelReason: null,
      transporterName: options.transporterName ?? invoice.transporterName,
      transporterGstin: options.transporterGstin ?? invoice.transporterGstin,
      vehicleNo: options.vehicleNo ?? invoice.vehicleNo,
      ewayDistanceKm: finalDistance,
    },
  });
}

async function cancelEWayBill(invoiceId, reason) {
  const { c, invoice } = await loadContext(invoiceId);
  if (!invoice.ewayBillNo) {
    const err = new Error('No e-way bill has been generated for this invoice.');
    err.status = 400;
    throw err;
  }
  const cleanReason = requireReason(reason);
  try {
    await callGsp(
      PATHS.CANCEL_EWAYBILL,
      { ewbNo: Number(invoice.ewayBillNo) || invoice.ewayBillNo, cancelRsnCode: 1, cancelRmrk: cleanReason },
      c,
      { action: 'CANEWB' }
    );
  } catch (err) {
    if (!/already cancelled|not active|312/i.test(err.message)) {
      throw err;
    }
  }
  return prisma.salesInvoice.update({
    where: { id: invoice.id },
    data: { ewayBillStatus: 'Cancelled', ewayCancelReason: cleanReason },
  });
}

// ---------------------------------------------------------------------------
// E-Way Bill for a Stock Transfer Issue (Branch Transfer).
//
// A Branch Transfer moves goods between two of the company's own places of
// business, so under GST it needs an e-way bill exactly like a sale does --
// only the consignor and the consignee are both the company, each at its own
// branch address, and the document is a delivery challan ("CHL", supply type
// Outward, sub-supply type 8 "Others" / "Stock Transfer") instead of a tax
// invoice. Everything crypto/transport (auth, encryption, GENEWAYBILL /
// CANEWB, response mapping, status columns) is shared with the Sales Invoice
// e-way bill above; only the document loading and payload building differ.
// A plain Stock Transfer (warehouse to warehouse inside one branch) never
// leaves the place of business, so it is refused here.
// ---------------------------------------------------------------------------
async function loadStockTransfer(transferId) {
  const transfer = await prisma.stockTransfer.findUnique({
    where: { id: Number(transferId) },
    include: { items: { orderBy: { id: 'asc' } } },
  });
  if (!transfer) {
    const err = new Error('Stock Transfer not found.');
    err.status = 404;
    throw err;
  }
  if (!transfer.transferNo) {
    const err = new Error('Save the Stock Transfer before generating an e-way bill.');
    err.status = 400;
    throw err;
  }
  return transfer;
}

async function loadStockTransferContext(transferId) {
  const [c, transfer, companyDetails] = await Promise.all([
    loadConfig(),
    loadStockTransfer(transferId),
    prisma.companyDetails.findFirst().catch(() => null),
  ]);
  if (!c.ENABLED) {
    const err = new Error('E-Invoicing is disabled. Turn it on in Settings > E-Invoice / E-Way Bill Settings.');
    err.status = 400;
    throw err;
  }
  return { c, transfer, companyDetails: companyDetails || {} };
}

// One side (consignor or consignee) of a Branch Transfer. Address comes from
// the warehouse the goods leave from / arrive at (the most specific place of
// business), then the Branch master, then the company profile; the GSTIN
// from that warehouse's Location (GST Registration No), falling back to the
// company's own GSTIN from the TaxPro settings -- one GSTIN with several
// additional places of business is the common case. In sandbox the TaxPro
// test seller stands in for both sides, exactly as it does for invoices.
async function buildStockTransferParty({ c, companyDetails, branchName, warehouseCode, role }) {
  if (c.ENV === 'sandbox') {
    return buildSellerDtls({}, c, companyDetails);
  }

  const warehouse = warehouseCode
    ? await prisma.warehouseMaster.findUnique({ where: { whsCode: warehouseCode } }).catch(() => null)
    : null;
  const [location, branch] = await Promise.all([
    warehouse?.locationCode
      ? prisma.locationMaster.findUnique({ where: { code: warehouse.locationCode } }).catch(() => null)
      : null,
    branchName ? prisma.branch.findFirst({ where: { branchName } }).catch(() => null) : null,
  ]);

  const rawGstin = String(location?.gstRegistrationNo || c.GSTIN || '').trim().toUpperCase();
  const gstin = rawGstin.length === 15 ? rawGstin : String(c.GSTIN || '').trim().toUpperCase();

  const stateText = warehouse?.state || location?.state || branch?.state || companyDetails.state;
  const stcd = parseStateCode(stateText, gstin);

  const addrParts = [
    warehouse?.buildingFloorRoom, warehouse?.streetNo, warehouse?.street, warehouse?.block,
  ].filter((v) => v && String(v).trim());
  const rawAddr = (addrParts.length ? addrParts.join(', ') : (branch?.address || companyDetails.address || '')).trim();
  const addr1 = rawAddr.replace(/[\r\n]+/g, ', ').slice(0, 100);

  const pinText = String(warehouse?.zipCode || location?.zipCode || branch?.zipCode || '').replace(/\D/g, '');
  const place = (warehouse?.city || location?.city || branch?.city || companyDetails.city || '').trim();

  const fail = (path, msg) => {
    const err = new Error(msg);
    err.status = 400;
    err.errors = [{ path, msg }];
    throw err;
  };
  const roleLabel = role === 'from' ? 'From Branch' : 'To Branch';
  if (!/^\d{6}$/.test(pinText)) {
    fail('pincode', `A valid 6-digit Pincode is required on the ${roleLabel} (${branchName || warehouseCode || '—'}) address -- set it in Company Setup > Branch / Warehouse Master.`);
  }
  if (!stcd) {
    fail('state', `State is missing on the ${roleLabel} (${branchName || warehouseCode || '—'}) -- set it in Company Setup > Branch / Warehouse Master.`);
  }
  if (addr1.length < 3) {
    fail('address', `Address is missing on the ${roleLabel} (${branchName || warehouseCode || '—'}) -- set it in Company Setup > Branch / Warehouse Master.`);
  }

  return {
    Gstin: gstin,
    LglNm: (companyDetails.legalName || companyDetails.companyName || 'Kemach Equipments Private Limited').trim().slice(0, 100),
    Addr1: addr1,
    Loc: (place || 'City').slice(0, 100),
    Pin: Number(pinText),
    Stcd: String(stcd).padStart(2, '0'),
  };
}

async function buildStockTransferEWayBillPayload(transfer, c, companyDetails, options = {}) {
  const items = transfer.items || [];
  const firstFrom = items.find((i) => i.fromWarehouse)?.fromWarehouse || null;
  const firstTo = items.find((i) => i.toWarehouse)?.toWarehouse || null;

  const from = await buildStockTransferParty({ c, companyDetails, branchName: transfer.branch, warehouseCode: firstFrom, role: 'from' });
  const to = await buildStockTransferParty({ c, companyDetails, branchName: transfer.toBranch, warehouseCode: firstTo, role: 'to' });
  const isInterState = from.Stcd !== to.Stcd;

  // HSN lives on the Product master, not on the transfer line.
  const codes = [...new Set(items.map((i) => i.productCode).filter(Boolean))];
  const products = codes.length
    ? await prisma.product.findMany({ where: { productCode: { in: codes } }, select: { productCode: true, hsnCode: true, uom: true } })
    : [];
  const productByCode = new Map(products.map((p) => [p.productCode, p]));

  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  const itemList = items.map((item, idx) => {
    const qty = Number(item.quantity) || 0;
    const product = productByCode.get(item.productCode) || {};
    const assAmt = round2(item.amount != null ? item.amount : qty * (Number(item.unitPrice) || 0));
    const gstRt = Number(item.tax_percent) || 0;

    let cgstRate = 0;
    let sgstRate = 0;
    let igstRate = 0;
    if (isInterState) {
      igstRate = gstRt;
      totalIgst += round2(assAmt * gstRt / 100);
    } else {
      cgstRate = round2(gstRt / 2);
      sgstRate = round2(gstRt / 2);
      totalCgst += round2(assAmt * (gstRt / 2) / 100);
      totalSgst += round2(assAmt * (gstRt / 2) / 100);
    }
    totalTaxable += assAmt;

    const rawHsn = String(product.hsnCode || '').replace(/\D/g, '');
    return {
      itemNo: idx + 1,
      productName: (item.productName || item.productCode || 'Item').slice(0, 100),
      productDesc: (item.productName || item.productCode || 'Item').slice(0, 100),
      hsnCode: Number(rawHsn.length >= 4 ? rawHsn : '84295200'),
      quantity: qty,
      qtyUnit: normalizeUom(item.uom || product.uom),
      cgstRate,
      sgstRate,
      igstRate,
      cessRate: 0,
      taxableAmount: assAmt,
    };
  });

  totalTaxable = round2(totalTaxable);
  totalCgst = round2(totalCgst);
  totalSgst = round2(totalSgst);
  totalIgst = round2(totalIgst);
  const taxSum = round2(totalTaxable + totalCgst + totalSgst + totalIgst);
  const totInvVal = round2(taxSum);

  const transMode = TRANSPORT_MODE_CODE[options.transportMode ?? transfer.transportMode] || '1';
  const transId = (options.transporterGstin || transfer.transporterGstin || '').trim();
  const transName = (options.transporterName || transfer.transporterName || '').trim();
  const docDate = transfer.documentDate || transfer.requestDate || new Date();

  const payload = {
    supplyType: 'O',
    subSupplyType: '8',
    subSupplyDesc: 'Stock Transfer',
    docType: 'CHL',
    docNo: transfer.transferNo,
    docDate: formatGspDate(docDate),
    fromGstin: from.Gstin,
    fromTrdName: from.LglNm,
    fromAddr1: from.Addr1,
    fromPlace: from.Loc,
    fromPincode: Number(from.Pin),
    actFromStateCode: Number(from.Stcd),
    fromStateCode: Number(from.Stcd),
    toGstin: to.Gstin,
    toTrdName: to.LglNm,
    toAddr1: to.Addr1,
    toPlace: to.Loc,
    toPincode: Number(to.Pin),
    actToStateCode: Number(to.Stcd),
    toStateCode: Number(to.Stcd),
    transactionType: 1,
    totalValue: totalTaxable,
    cgstValue: totalCgst,
    sgstValue: totalSgst,
    igstValue: totalIgst,
    cessValue: 0,
    otherValue: 0,
    totInvValue: totInvVal,
    transMode,
    transDistance: Number(options.distanceKm ?? transfer.ewayDistanceKm) || 0,
    itemList,
  };

  if (transId) payload.transporterId = transId;
  if (transName) payload.transporterName = transName;
  payload.transDocNo = options.transDocNo || transfer.transferNo;
  payload.transDocDate = formatGspDate(options.transDocDt || docDate);

  const rawVehNo = options.vehicleNo || transfer.vehicleNo;
  if (rawVehNo && String(rawVehNo).trim()) {
    payload.vehicleNo = String(rawVehNo).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    payload.vehicleType = options.vehType || 'R';
  }

  return payload;
}

async function generateStockTransferEWayBill(transferId, options = {}) {
  const { c, transfer, companyDetails } = await loadStockTransferContext(transferId);

  const refuse = (message, path, status = 400) => {
    const err = new Error(message);
    err.status = status;
    if (path) err.errors = [{ path, msg: message }];
    throw err;
  };

  if (transfer.transferType !== 'Branch Transfer') {
    refuse('An e-way bill is only needed for a Branch Transfer. A plain Stock Transfer stays inside one place of business.');
  }
  if (transfer.status === 'Cancelled') refuse('This Stock Transfer is cancelled.');
  if (transfer.approvalStatus === 'Pending') refuse('This Stock Transfer is still waiting for its Stock Transfer Request to be approved.');
  if (transfer.approvalStatus === 'Rejected') refuse('This Stock Transfer\'s request was rejected.');
  if (!transfer.branch || !transfer.toBranch) refuse('From Branch and To Branch are both required to generate an e-way bill.', 'toBranch');
  if (!(transfer.items || []).length) refuse('The Stock Transfer has no item lines.');
  if (transfer.ewayBillStatus === 'Generated') {
    refuse('An e-way bill has already been generated for this document. Cancel it before regenerating.', null, 409);
  }

  const transportMode = options.transportMode || transfer.transportMode;
  if (!transportMode || !TRANSPORT_MODE_CODE[transportMode]) {
    refuse('Transport Mode is required to generate an e-way bill.', 'transportMode');
  }
  const vehicleNo = String(options.vehicleNo || transfer.vehicleNo || '').trim();
  const transporterGstin = String(options.transporterGstin || transfer.transporterGstin || '').trim();
  if (!vehicleNo && !transporterGstin) {
    refuse('Vehicle Number or Transporter ID (GSTIN) is required to generate an e-way bill.', 'vehicleNo');
  }

  const data = await callGsp(
    PATHS.EWAYBILL_API,
    await buildStockTransferEWayBillPayload(transfer, c, companyDetails, { ...options, transportMode }),
    c,
    { action: 'GENEWAYBILL' }
  );

  const mapped = mapEWayBillResponse(data);
  const finalDistance = options.distanceKm != null && options.distanceKm !== ''
    ? Number(options.distanceKm)
    : (mapped.distanceKm ?? transfer.ewayDistanceKm);

  return prisma.stockTransfer.update({
    where: { id: transfer.id },
    data: {
      ewayBillNo: mapped.ewayBillNo,
      ewayBillDate: mapped.ewayBillDate ? new Date(mapped.ewayBillDate) : new Date(),
      ewayBillValidUpto: mapped.ewayBillValidUpto ? new Date(mapped.ewayBillValidUpto) : null,
      ewayBillStatus: 'Generated',
      ewayCancelReason: null,
      transportMode,
      transporterName: options.transporterName ?? transfer.transporterName,
      transporterGstin: options.transporterGstin ?? transfer.transporterGstin,
      vehicleNo: options.vehicleNo ?? transfer.vehicleNo,
      ewayDistanceKm: finalDistance,
    },
  });
}

async function cancelStockTransferEWayBill(transferId, reason) {
  const { c, transfer } = await loadStockTransferContext(transferId);
  if (!transfer.ewayBillNo) {
    const err = new Error('No e-way bill has been generated for this Stock Transfer.');
    err.status = 400;
    throw err;
  }
  if (transfer.ewayBillStatus === 'Cancelled') {
    const err = new Error('This e-way bill is already cancelled.');
    err.status = 409;
    throw err;
  }
  const cleanReason = requireReason(reason);
  try {
    await callGsp(
      PATHS.CANCEL_EWAYBILL,
      { ewbNo: Number(transfer.ewayBillNo) || transfer.ewayBillNo, cancelRsnCode: 1, cancelRmrk: cleanReason },
      c,
      { action: 'CANEWB' }
    );
  } catch (err) {
    if (!/already cancelled|not active|312/i.test(err.message)) {
      throw err;
    }
  }
  return prisma.stockTransfer.update({
    where: { id: transfer.id },
    data: { ewayBillStatus: 'Cancelled', ewayCancelReason: cleanReason },
  });
}

module.exports = {
  generateEInvoice,
  cancelEInvoice,
  generateEWayBill,
  cancelEWayBill,
  generateStockTransferEWayBill,
  cancelStockTransferEWayBill,
  testConnection,
};

