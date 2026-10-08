const { validationResult } = require('express-validator');
const authService = require('../services/authService');
const prisma = require('../prisma/client');
const asyncHandler = require('../utils/asyncHandler');

function checkValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new Error(errors.array()[0].msg);
    err.status = 400;
    err.errors = errors.array();
    throw err;
  }
}

const login = asyncHandler(async (req, res) => {
  checkValidation(req);
  // Trim so a stray leading/trailing space (autofill, copy-paste, etc.)
  // never causes an otherwise-correct login to fail -- enforced here too,
  // not just in the frontend form, since this endpoint can be hit directly.
  // The identifier is an Employee User Code or an email — `userCode` is what
  // the login form sends now, `email` is still read as a fallback so an older
  // client (or a saved API call) posting the previous shape keeps working.
  const identifier = (req.body.userCode ?? req.body.email)?.trim();
  const password = req.body.password?.trim();
  const result = await authService.login(identifier, password);
  res.json({ success: true, ...result });
});

const refresh = asyncHandler(async (req, res) => {
  const token = req.body.refreshToken || req.cookies?.refreshToken;
  const result = await authService.refresh(token);
  res.json({ success: true, ...result });
});

const logout = asyncHandler(async (req, res) => {
  const token = req.body.refreshToken || req.cookies?.refreshToken;
  await authService.logout(token);
  res.json({ success: true, message: 'Logged out' });
});

const me = asyncHandler(async (req, res) => {
  const user = await prisma.appUser.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  const { passwordHash, ...safe } = user;
  // Also return the caller's granted menu permissions, so the app can re-sync
  // them without a full logout — an admin changing someone's grid takes effect
  // on that user's next /me rather than staying stuck on the login snapshot.
  safe.permissions = await authService.grantedPermissions(user.id);
  const { branches, defaultBranch } = await authService.grantedBranches(user.id);
  safe.branches = branches;
  safe.defaultBranch = defaultBranch;
  res.json({ success: true, user: safe });
});

const resetPassword = asyncHandler(async (req, res) => {
  checkValidation(req);
  const { currentPassword, newPassword } = req.body;
  await authService.resetPassword(req.user.id, currentPassword, newPassword);
  res.json({ success: true, message: 'Password updated successfully' });
});

module.exports = { login, refresh, logout, me, resetPassword };
