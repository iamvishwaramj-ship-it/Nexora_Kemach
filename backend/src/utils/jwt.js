const jwt = require('jsonwebtoken');

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d';

/**
 * Refuse to start in production without real signing secrets.
 *
 * The committed .env ships `change_me_access_secret_dev_only`. Anyone holding
 * that string can mint a valid admin token for any deployment still using it,
 * and nothing in the application would notice. A missing secret is worse
 * still: jsonwebtoken throws only at the moment someone tries to log in, so
 * the service starts, looks healthy, and fails at the first request.
 *
 * Failing at boot turns both into a deployment error somebody sees immediately
 * rather than a silent authentication bypass.
 */
const PLACEHOLDER_PATTERN = /^(change_me|changeme|secret|dev|test|password)/i;

function assertSecretsAreUsable() {
  if (process.env.NODE_ENV !== 'production') return;

  const problems = [];
  for (const [name, value] of [
    ['JWT_ACCESS_SECRET', ACCESS_SECRET],
    ['JWT_REFRESH_SECRET', REFRESH_SECRET],
  ]) {
    if (!value) problems.push(`${name} is not set`);
    else if (PLACEHOLDER_PATTERN.test(value)) problems.push(`${name} is still a placeholder value`);
    else if (value.length < 32) problems.push(`${name} is shorter than 32 characters`);
  }
  if (ACCESS_SECRET && REFRESH_SECRET && ACCESS_SECRET === REFRESH_SECRET) {
    problems.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are identical — a refresh token would be accepted as an access token');
  }

  if (problems.length) {
    throw new Error(
      `Refusing to start in production: ${problems.join('; ')}. `
      + `Generate secrets with: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
    );
  }
}

assertSecretsAreUsable();

function signAccessToken(payload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
}

function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

// Convert e.g. "7d" to a JS Date in the future, for storing refresh token expiry in DB
function expiresInToDate(expiresIn) {
  const match = /^(\d+)([smhd])$/.exec(expiresIn);
  if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const value = Number(match[1]);
  const unit = match[2];
  const unitMs = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit];
  return new Date(Date.now() + value * unitMs);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  refreshExpiryDate: () => expiresInToDate(REFRESH_EXPIRES),
};
