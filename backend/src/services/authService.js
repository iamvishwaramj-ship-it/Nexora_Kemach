const bcrypt = require('bcryptjs');
const prisma = require('../prisma/client');
const { signAccessToken, signRefreshToken, verifyRefreshToken, refreshExpiryDate } = require('../utils/jwt');

// The permission rows the frontend needs to hide menus and action buttons.
// Only granted ones are sent: User Management writes a row per menu item
// (~95 of them, mostly all-false), and shipping the whole grid on every login
// would bloat the response and its localStorage copy for no gain — a menu key
// the client never sees is treated as "no access" anyway.
async function grantedPermissions(userId) {
  return prisma.userPermission.findMany({
    where: {
      userId,
      OR: [{ canView: true }, { canAdd: true }, { canEdit: true }, { canDelete: true }, { canCancel: true }],
    },
    // canNotify rides along on granted rows; a row with ONLY canNotify is not
    // menu access, so it is deliberately not part of the OR filter above.
    select: { menuKey: true, canView: true, canAdd: true, canEdit: true, canDelete: true, canCancel: true, canNotify: true, hiddenColumns: true },
  });
}

// The branches a user may see, resolved to NAMES (not ids) — every
// branch-scoped column across the app (BusinessPartner.branch,
// SalesOrder.branch, WarehouseMaster.branch, ...) stores the branch's NAME
// as a plain string, the same "cross-master by name" convention the rest of
// this schema already uses, so that's what crudFactory's list-scoping hook
// needs to filter `where: { branch: { in: [...] } } }` against. Baked into
// the JWT at login/refresh (see login/refresh below) rather than looked up
// per request — auth() middleware trusts the token as-is and never hits the
// DB, same as role/permissions already do; a branch grant added or revoked
// takes effect on the user's next login or token refresh, not instantly.
async function grantedBranches(userId) {
  // Guards against a Prisma Client that hasn't been regenerated yet after
  // the UserBranch model was added to schema.prisma (`prisma.userBranch` is
  // undefined until `npx prisma generate` runs against the updated schema,
  // and the migration that creates the actual [user_branches] table has to
  // have been applied too — `npx prisma migrate deploy`). Without this,
  // every login/refresh 500'd outright on a stale client, which is strictly
  // worse than temporarily granting no branches: falling back to "no
  // branches" degrades to what an admin already bypasses and a non-admin
  // simply sees nothing branch-scoped, rather than being unable to log in
  // at all.
  if (!prisma.userBranch) return { branches: [], defaultBranch: null };
  const rows = await prisma.userBranch.findMany({
    where: { userId },
    include: { branch: { select: { branchName: true, status: true } } },
  });
  const active = rows.filter((r) => r.branch && r.branch.status === 'Active');
  const branches = active.map((r) => r.branch.branchName);
  const defaultRow = active.find((r) => r.isDefault) || active[0] || null;
  return { branches, defaultBranch: defaultRow ? defaultRow.branch.branchName : null };
}

// `identifier` is an Employee User Code (AppUser.userCode) OR an email
// address. userCode is the identifier the User Master form now issues, but
// email is still accepted so accounts that predate it — the seeded
// admin@nexora.com among them — keep working rather than being locked out
// the moment the migration runs.
//
// findFirst, not findUnique: email is no longer declared @unique in the
// Prisma model (its uniqueness is a filtered index the client can't see —
// see schema.prisma's AppUser comment), so findUnique isn't available for
// it, and matching both columns in one OR is a single query either way.
async function login(identifier, password) {
  // Guard before the query, not just in the route's validator. Prisma DROPS
  // an `undefined` value from a where clause rather than matching on it, so
  // an absent identifier would reduce this OR to "no condition at all" and
  // hand back the first row in the table — which the password check would
  // then be run against. The route already rejects a blank identifier; this
  // makes the service safe to call directly too.
  const trimmed = typeof identifier === 'string' ? identifier.trim() : '';
  if (!trimmed) {
    const err = new Error('Invalid user code or password');
    err.status = 401;
    throw err;
  }

  const user = await prisma.appUser.findFirst({
    where: { OR: [{ userCode: trimmed }, { email: trimmed }] },
  });
  if (!user) {
    const err = new Error('Invalid user code or password');
    err.status = 401;
    throw err;
  }
  if (user.status !== 'Active') {
    const err = new Error('This account is inactive. Contact your administrator.');
    err.status = 403;
    throw err;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const err = new Error('Invalid user code or password');
    err.status = 401;
    throw err;
  }

  const { branches, defaultBranch } = await grantedBranches(user.id);
  // Admins are never branch-restricted (crudFactory's scoping hook already
  // special-cases role === 'admin'), so an empty branches[] here is fine for
  // them; a non-admin with none assigned simply sees nothing branch-scoped
  // until an admin grants one — same "fail closed" behaviour empty
  // permissions already have.
  const payload = { id: user.id, userCode: user.userCode, email: user.email, role: user.role, name: user.name, branches };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken({ id: user.id });

  await prisma.refreshToken.create({
    data: { token: refreshToken, userId: user.id, expiresAt: refreshExpiryDate() },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      userCode: user.userCode,
      email: user.email,
      employeeId: user.employeeId,
      employeeCode: user.employeeCode,
      employeeName: user.employeeName,
      role: user.role,
      status: user.status,
      profilePhotoUrl: user.profilePhotoUrl,
      permissions: await grantedPermissions(user.id),
      branches,
      defaultBranch,
    },
  };
}

async function refresh(token) {
  if (!token) {
    const err = new Error('No refresh token provided');
    err.status = 401;
    throw err;
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    const err = new Error('Invalid or expired refresh token');
    err.status = 401;
    throw err;
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token } });
  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    const err = new Error('Refresh token is no longer valid');
    err.status = 401;
    throw err;
  }

  const user = await prisma.appUser.findUnique({ where: { id: decoded.id } });
  if (!user || user.status !== 'Active') {
    const err = new Error('User not found or inactive');
    err.status = 401;
    throw err;
  }

  const { branches } = await grantedBranches(user.id);
  const payload = { id: user.id, userCode: user.userCode, email: user.email, role: user.role, name: user.name, branches };
  const accessToken = signAccessToken(payload);

  return { accessToken };
}

async function logout(token) {
  if (!token) return;
  await prisma.refreshToken.updateMany({ where: { token }, data: { revoked: true } });
}

async function resetPassword(userId, currentPassword, newPassword) {
  const user = await prisma.appUser.findUnique({ where: { id: userId } });
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    const err = new Error('Current password is incorrect');
    err.status = 400;
    throw err;
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.appUser.update({ where: { id: userId }, data: { passwordHash } });
  // Invalidate all outstanding refresh tokens on password change
  await prisma.refreshToken.updateMany({ where: { userId }, data: { revoked: true } });
}

module.exports = { login, refresh, logout, resetPassword, grantedPermissions, grantedBranches };
