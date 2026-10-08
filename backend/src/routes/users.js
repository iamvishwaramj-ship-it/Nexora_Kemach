const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const prisma = require('../prisma/client');
const auth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { parseId } = require('../utils/crudFactory');
const { disconnectUser } = require('../utils/socket');
const { NOTIFICATION_MENU_KEYS } = require('../utils/notificationService');

// User Management: list/create/update/delete AppUser accounts, each carrying
// its own menu-based permission grid (UserPermission rows, one per navConfig
// entry — see schema.prisma for why there is no separate Role table).
//
// Deliberately its own file rather than folded into the generic resources.js
// router (see the comment that used to sit on the read-only GET /users this
// replaces): password hashing and the nested permissions write need more
// control than createCrudController's generic shape gives a resource.

function checkValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new Error(errors.array()[0].msg);
    err.status = 400;
    err.errors = errors.array();
    throw err;
  }
}

// passwordHash must never reach a client response, not even for an admin
// managing other people's accounts.
function safeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// Normalizes the client's permissions[] into Prisma createMany rows for one
// user. Every flag is coerced to a plain boolean so a stray null/undefined
// can't slip past the column's NOT NULL default, and a row with no menuKey
// is dropped defensively (the frontend always sends one per navConfig entry).
function toPermissionRows(userId, permissions) {
  return (Array.isArray(permissions) ? permissions : [])
    .filter((p) => p && p.menuKey)
    .map((p) => ({
      userId,
      menuKey: String(p.menuKey),
      canView: !!p.canView,
      canAdd: !!p.canAdd,
      canEdit: !!p.canEdit,
      canDelete: !!p.canDelete,
      canCancel: !!p.canCancel,
      // Notification is only meaningful for menus that raise notifications;
      // anywhere else it is forced off so a hand-crafted request cannot store
      // a flag nothing reads. It is an extra flag, never menu access by itself.
      canNotify: !!p.canNotify && NOTIFICATION_MENU_KEYS.includes(String(p.menuKey)),
      // Report columns excluded for this user on this menu (User Management
      // > Permissions > Columns). Stored as a JSON array, NULL when none.
      hiddenColumns: Array.isArray(p.hiddenColumns) && p.hiddenColumns.length
        ? JSON.stringify(p.hiddenColumns.filter((k) => typeof k === 'string'))
        : null,
    }));
}

// Normalizes the client's branches[] into Prisma createMany rows for one
// user — same shape/coercion approach as toPermissionRows above. branchId
// arrives as a string (see useBranchOptions.js's own stringified option
// values) so it's coerced to a number here, the type UserBranch.branchId
// actually is. Exactly one row must end up isDefault: true; rather than
// trust the client sent exactly one (BranchAccessTable's own UI makes that
// hard to violate, but a direct API call is not bound by that), this keeps
// whichever the client marked default if there's exactly one, and otherwise
// forces the first row -- so a user always has a real default branch rather
// than the save failing or silently leaving none set.
function toBranchRows(userId, branches) {
  const clean = (Array.isArray(branches) ? branches : [])
    .filter((b) => b && b.branchId != null && b.branchId !== '')
    .map((b) => ({ userId, branchId: Number(b.branchId), isDefault: !!b.isDefault }));

  const defaultCount = clean.filter((b) => b.isDefault).length;
  if (defaultCount !== 1 && clean.length) {
    clean.forEach((b, i) => { b.isDefault = i === 0; });
  }
  return clean;
}

// Resolves the linked Employee Master record for a save, returning the
// denormalized fields to store with the account (see AppUser.employeeId in
// schema.prisma). The employee's name also becomes the account's `name` —
// the User Master form no longer has its own Name field, since the whole
// point of picking an Employee is that the account is that person.
//
// Returns {} when no employee is selected, so an account created before this
// feature (or a service/admin login with no employee) keeps whatever name it
// already has rather than being blanked.
async function resolveEmployeeFields(employeeId) {
  if (employeeId === undefined || employeeId === null || employeeId === '') return {};
  const id = Number(employeeId);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error('Employee is invalid');
    err.status = 400;
    throw err;
  }
  const employee = await prisma.salesEmployee.findUnique({
    where: { id },
    select: { id: true, employeeCode: true, employeeName: true },
  });
  if (!employee) {
    const err = new Error('The selected employee no longer exists.');
    err.status = 400;
    throw err;
  }
  return {
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
    employeeName: employee.employeeName,
    name: employee.employeeName,
  };
}

// Rejects a userCode already in use by a DIFFERENT account, with a clean
// field-level message instead of the raw P2002 the unique index would
// otherwise surface on save. Compared case-insensitively: SQL Server's
// default collation treats 'ADMIN' and 'admin' as the same value, so letting
// one through here only to have the index reject it would be misleading.
async function assertUserCodeAvailable(userCode, id = null) {
  const existing = await prisma.appUser.findFirst({
    where: { userCode, ...(id ? { NOT: { id } } : {}) },
    select: { id: true },
  });
  if (existing) {
    const err = new Error('Employee user code is already in use.');
    err.status = 400;
    err.errors = [{ path: 'userCode', msg: err.message }];
    throw err;
  }
}

// Shared across create and update — userCode/role required, and at least
// one permission row must carry at least one true flag (the same "Grant at
// least one section permission" rule the frontend grid enforces, checked
// again here since a form's client-side schema is never a substitute for
// the server rejecting a bad request directly). Branches gets the same
// "at least one" check the frontend's own branchesSchema enforces.
//
// userCode replaced email as the login identifier, so it is validated as
// plain text — the old isEmail() rule would reject every user code. `name`
// is no longer required from the client: it is derived from the selected
// Employee (see resolveEmployeeFields above), and only falls back to the
// body value for an account saved without one.
const userFieldValidation = [
  body('userCode').trim().isLength({ min: 2 }).withMessage('Employee user code must be at least 2 characters'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Enter a valid email address'),
  body('role').notEmpty().withMessage('Role is required'),
  body('branches')
    .isArray({ min: 1 }).withMessage('At least one branch is required.')
    .custom((rows) => Array.isArray(rows) && rows.every((b) => b && b.branchId != null && b.branchId !== ''))
    .withMessage('Every branch row must have a branch selected.'),
  body('permissions')
    .isArray({ min: 1 }).withMessage('Grant at least one section permission.')
    .custom((rows) => Array.isArray(rows) && rows.some((r) => r && (r.canView || r.canAdd || r.canEdit || r.canDelete || r.canCancel)))
    .withMessage('Grant at least one section permission.'),
];

router.use(auth());

// GET / — every user account (minus passwordHash) with its permission rows.
// Open to any authenticated user, not just admins: this is the same endpoint
// pages like Collection Entry's "Received By" dropdown have always called
// via appUserApi.useList() for a plain id/name list: restricting it to
// admins would break every one of those. ?q= filters by name/email, matching
// every other list endpoint in the app.
router.get('/', asyncHandler(async (req, res) => {
  const { q } = req.query;
  const where = q
    ? {
        OR: [
          { name: { contains: q } },
          { userCode: { contains: q } },
          { email: { contains: q } },
          { employeeCode: { contains: q } },
          { employeeName: { contains: q } },
        ],
      }
    : undefined;
  const rows = await prisma.appUser.findMany({
    where,
    include: { permissions: true, branches: true },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: rows.map(safeUser) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const row = await prisma.appUser.findUnique({ where: { id }, include: { permissions: true, branches: true } });
  if (!row) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, data: safeUser(row) });
}));

// POST / — create a user and its permission grid in one transaction. Only an
// admin may create accounts and grant permissions to them — same gate
// crudRouter applies to deletes everywhere else in the app.
router.post(
  '/',
  auth(['admin']),
  [
    ...userFieldValidation,
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
      .matches(/[0-9]/).withMessage('Password must contain a number'),
  ],
  asyncHandler(async (req, res) => {
    checkValidation(req);
    const { name, userCode, email, employeeId, password, role, status, permissions, branches } = req.body;
    const trimmedUserCode = String(userCode).trim();
    await assertUserCodeAvailable(trimmedUserCode);
    const employeeFields = await resolveEmployeeFields(employeeId);
    // name comes from the selected employee; with none selected fall back to
    // whatever the client sent, and finally to the user code itself — the
    // column is NOT NULL, and an account with no displayable name would show
    // up blank in the header and in every user dropdown in the app. Unlike
    // the update path below, defaulting is safe here: a brand-new account has
    // no existing name to overwrite.
    const resolvedName = (employeeFields.name || name || trimmedUserCode).trim();
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.appUser.create({
        data: {
          ...employeeFields,
          name: resolvedName,
          userCode: trimmedUserCode,
          email: email ? String(email).trim() : null,
          passwordHash,
          role,
          status: status || 'Active',
        },
      });
      const permissionRows = toPermissionRows(created.id, permissions);
      if (permissionRows.length) await tx.userPermission.createMany({ data: permissionRows });
      const branchRows = toBranchRows(created.id, branches);
      if (branchRows.length) await tx.userBranch.createMany({ data: branchRows });
      return tx.appUser.findUnique({ where: { id: created.id }, include: { permissions: true, branches: true } });
    });

    res.status(201).json({ success: true, data: safeUser(user) });
  })
);

// PUT /:id — password is optional here: blank/omitted leaves the existing
// hash untouched, so editing someone's role or permissions doesn't force a
// password reset in the same request. Permissions are always a full
// replace, never a patch — the grid submits its complete current state on
// every save, so delete-then-recreate inside the same transaction as the
// row update is the simplest thing that's also always correct (no risk of a
// stale row from a menu item the client didn't send surviving the save).
router.put(
  '/:id',
  auth(['admin']),
  [
    ...userFieldValidation,
    body('password')
      .optional({ checkFalsy: true })
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
      .matches(/[0-9]/).withMessage('Password must contain a number'),
  ],
  asyncHandler(async (req, res) => {
    checkValidation(req);
    const id = parseId(req.params.id);
    const { name, userCode, email, employeeId, password, role, status, permissions, branches } = req.body;

    const trimmedUserCode = String(userCode).trim();
    await assertUserCodeAvailable(trimmedUserCode, id);
    const employeeFields = await resolveEmployeeFields(employeeId);

    const data = {
      ...employeeFields,
      userCode: trimmedUserCode,
      email: email ? String(email).trim() : null,
      role,
      status: status || 'Active',
    };
    // `name` is only written when there is something real to write: the
    // linked employee's name, or an explicit one from the body. It is
    // deliberately NOT defaulted to the user code on an edit — the form has
    // no Name field any more, so an account with no linked employee (the
    // seeded 'Admin User', or any service login) sends none, and defaulting
    // here would silently rename it to "admin" the first time somebody
    // changed its role or password. Leaving the key off the update entirely
    // keeps whatever name the row already has.
    const resolvedName = (employeeFields.name || name || '').trim();
    if (resolvedName) data.name = resolvedName;
    // Clearing the Employee select unlinks the account rather than silently
    // keeping the previous employee's code/name on it.
    if (employeeId === null || employeeId === '') {
      data.employeeId = null;
      data.employeeCode = null;
      data.employeeName = null;
    }
    if (password) data.passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.appUser.update({ where: { id }, data });
      await tx.userPermission.deleteMany({ where: { userId: id } });
      const permissionRows = toPermissionRows(id, permissions);
      if (permissionRows.length) await tx.userPermission.createMany({ data: permissionRows });
      await tx.userBranch.deleteMany({ where: { userId: id } });
      const branchRows = toBranchRows(id, branches);
      if (branchRows.length) await tx.userBranch.createMany({ data: branchRows });
      return tx.appUser.findUnique({ where: { id: updated.id }, include: { permissions: true, branches: true } });
    });

    // A non-admin's live sockets were authorised against their OLD grants;
    // drop them so they reconnect with current access. Admins are exempt from
    // permission/branch filtering, so theirs are left alone -- unless the
    // account was just deactivated, which must cut the connection too.
    if (user.role !== 'admin' || user.status !== 'Active') disconnectUser(user.id);

    res.json({ success: true, data: safeUser(user) });
  })
);

// DELETE /:id — admin only. Refusing to let an admin delete their own
// account here isn't optional politeness: doing it mid-request would revoke
// req.user's own row while the very request proving they're an admin is
// still in flight, with no recovery path short of direct DB access.
router.delete('/:id', auth(['admin']), asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (req.user.id === id) {
    return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
  }
  await prisma.appUser.delete({ where: { id } });
  res.json({ success: true, message: 'Deleted successfully' });
}));

module.exports = router;
