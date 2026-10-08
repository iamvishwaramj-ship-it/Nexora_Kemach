// ---------------------------------------------------------------------------
// OCI Object Storage client, used to store the company (tenant) logo.
//
// OCI Object Storage exposes an S3-compatible API, so the official AWS S3
// SDK works against it unmodified once pointed at the tenancy's compat
// endpoint — no separate OCI SDK dependency needed. Credentials are read
// once from backend/.env at process start and NEVER leave this file: no
// route handler, response body, or frontend bundle ever sees
// OCI_ACCESS_KEY / OCI_SECRET_KEY. Callers only get back object keys and
// short-lived pre-signed URLs.
// ---------------------------------------------------------------------------
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Read live from process.env at call time rather than destructuring once at
// module load. Those two disagree whenever this module is required before
// dotenv has run (a test harness, a maintenance script, or any entry point
// that isn't server.js -> app.js): the snapshot would hold `undefined` for
// every key while assertConfigured() below — which reads process.env live —
// still passed. The client then got built as
// https://undefined.compat.objectstorage.undefined.oraclecloud.com with
// undefined credentials, and the upload failed with an opaque 500 instead of
// the clear "Object storage is not configured" the guard exists to give.
const cfg = () => ({
  OCI_NAMESPACE: process.env.OCI_NAMESPACE,
  OCI_REGION: process.env.OCI_REGION,
  OCI_BUCKET: process.env.OCI_BUCKET,
  OCI_ACCESS_KEY: process.env.OCI_ACCESS_KEY,
  OCI_SECRET_KEY: process.env.OCI_SECRET_KEY,
});

function assertConfigured() {
  const missing = ['OCI_NAMESPACE', 'OCI_REGION', 'OCI_BUCKET', 'OCI_ACCESS_KEY', 'OCI_SECRET_KEY']
    .filter((k) => !process.env[k]);
  if (missing.length) {
    const err = new Error(`Object storage is not configured (missing: ${missing.join(', ')}).`);
    err.status = 500;
    throw err;
  }
}

// Lazily constructed so a misconfigured .env fails on first actual use with a
// clear message, rather than crashing the whole server at require-time.
let client = null;
function getClient() {
  if (client) return client;
  assertConfigured();
  const { OCI_NAMESPACE, OCI_REGION, OCI_ACCESS_KEY, OCI_SECRET_KEY } = cfg();
  client = new S3Client({
    // S3-compatible endpoint for this tenancy's namespace/region — see
    // https://docs.oracle.com/en-us/iaas/Content/Object/Tasks/s3compatibleapi.htm
    endpoint: `https://${OCI_NAMESPACE}.compat.objectstorage.${OCI_REGION}.oraclecloud.com`,
    region: OCI_REGION,
    credentials: {
      accessKeyId: OCI_ACCESS_KEY,
      secretAccessKey: OCI_SECRET_KEY,
    },
    // OCI's compat endpoint only understands path-style bucket addressing
    // (https://host/<bucket>/<key>), not the virtual-hosted-style
    // (https://<bucket>.host/<key>) the AWS SDK defaults to.
    forcePathStyle: true,
  });
  return client;
}

/**
 * Upload a buffer to OCI Object Storage under `key`.
 * @param {string} key - object key, e.g. `company/<companyId>/logo/<uuid>.png`
 * @param {Buffer} body
 * @param {string} contentType
 */
async function uploadObject(key, body, contentType) {
  assertConfigured();
  await getClient().send(new PutObjectCommand({
    Bucket: cfg().OCI_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  return key;
}

/**
 * Delete an object. Missing-object errors are swallowed (deleting something
 * that's already gone is not a failure for our callers — see company.js's
 * "replace" and "remove" flows, which call this best-effort).
 */
async function deleteObject(key) {
  if (!key) return;
  assertConfigured();
  try {
    await getClient().send(new DeleteObjectCommand({ Bucket: cfg().OCI_BUCKET, Key: key }));
  } catch (err) {
    // NoSuchKey / NotFound — already gone, nothing to roll back.
    if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) return;
    throw err;
  }
}

/** True if `key` currently exists in the bucket. */
async function objectExists(key) {
  if (!key) return false;
  assertConfigured();
  try {
    await getClient().send(new HeadObjectCommand({ Bucket: cfg().OCI_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Short-lived pre-signed GET URL for `key`. The client fetches this URL
 * directly from OCI — the object bytes never pass through our backend, and
 * the bucket itself never needs to be public.
 */
async function getPresignedUrl(key, expiresInSeconds = 3600) {
  if (!key) return null;
  assertConfigured();
  const command = new GetObjectCommand({ Bucket: cfg().OCI_BUCKET, Key: key });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}

module.exports = {
  uploadObject,
  deleteObject,
  objectExists,
  getPresignedUrl,
  // A getter, not a value: same reason cfg() exists above — a plain export
  // captured at module-load time reads `undefined` for any consumer that
  // loads this before dotenv has run. Nothing outside this file uses it
  // today, but exporting a stale snapshot is a trap waiting to be stepped in.
  get OCI_BUCKET() { return process.env.OCI_BUCKET; },
};
