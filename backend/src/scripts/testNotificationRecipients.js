// Offline test of recipient resolution + notification helpers against an
// in-memory fake of the few Prisma calls they use (no database needed).
//   node src/scripts/testNotificationRecipients.js
const assert = require('assert');

// ---- tiny fake prisma -------------------------------------------------------
const db = { users: [], perms: [], grants: [], notifs: [], nextId: 1 };
const branchNameOf = (g) => g.branchName;
const fake = {
  approvalFlow: { findFirst: async () => null },
  appUser: {
    findUnique: async ({ where }) => db.users.find((u) => u.id === where.id) || null,
    findMany: async ({ where }) => db.users.filter((u) => {
      if (where.status && u.status !== where.status) return false;
      if (where.role === 'admin' && u.role !== 'admin') return false;
      if (where.role && where.role.not && u.role === where.role.not) return false;
      if (where.id && where.id.not != null && u.id === where.id.not) return false;
      if (where.permissions) {
        const { menuKey, canNotify } = where.permissions.some;
        if (!db.perms.some((p) => p.userId === u.id && p.menuKey === menuKey && p.canNotify === canNotify)) return false;
      }
      if (where.branches) {
        const names = where.branches.some.branch.branchName.in;
        if (!db.grants.some((g) => g.userId === u.id && names.includes(branchNameOf(g)))) return false;
      }
      return true;
    }),
  },
  userPermission: { count: async ({ where }) => db.perms.filter((p) => p.userId === where.userId && p.menuKey === where.menuKey && p.canNotify === where.canNotify).length },
  userBranch: { count: async ({ where }) => db.grants.filter((g) => g.userId === where.userId && where.branch.branchName.in.includes(g.branchName)).length },
  notification: {
    create: async ({ data }) => { const r = { id: db.nextId++, status: 'Unread', actionStatus: null, ...data }; db.notifs.push(r); return r; },
    findFirst: async ({ where }) => db.notifs.find((n) => Object.entries(where).every(([k, v]) => n[k] === v)) || null,
    findMany: async ({ where }) => db.notifs.filter((n) => Object.entries(where).every(([k, v]) => {
      if (v && typeof v === 'object' && 'not' in v) return n[k] !== v.not;
      if (v && typeof v === 'object' && 'in' in v) return v.in.includes(n[k]);
      return n[k] === v;
    })),
    updateMany: async ({ where, data }) => { db.notifs.filter((n) => where.id.in.includes(n.id) && n.actionStatus === where.actionStatus).forEach((n) => Object.assign(n, data)); },
  },
};
// Intercept the app's prisma client module so nothing touches a real database.
const Module = require('module');
const realLoad = Module._load;
Module._load = function load(request, ...rest) {
  if (/prisma[\\/]client$/.test(request)) return fake;
  return realLoad.call(this, request, ...rest);
};

const { resolveStockTransferRequestApprovers } = require('../utils/approverResolution');
const svc = require('../utils/notificationService');

const MENU = 'stock-transfer-request';
const add = (id, role, status = 'Active') => db.users.push({ id, name: `u${id}`, email: null, role, status });
const perm = (userId, canNotify = true) => db.perms.push({ userId, menuKey: MENU, canNotify });
const grant = (userId, branchName) => db.grants.push({ userId, branchName });
const ids = (list) => list.map((u) => u.id).sort((a, b) => a - b);

(async () => {
  // users: 1 admin (no perms/branches), 2 sender A, 3 B ok, 4 B no canNotify, 5 B no branch, 6 inactive, 7 second admin
  add(1, 'admin'); add(2, 'staff'); add(3, 'staff'); add(4, 'staff'); add(5, 'staff'); add(6, 'staff', 'Inactive'); add(7, 'admin');
  [2, 3, 5, 6].forEach((u) => perm(u)); perm(4, false);
  [2, 3, 4, 6].forEach((u) => grant(u, 'CALICUT')); grant(5, 'CHENNAI');

  // (a)+(b)+(c)+(f)+inactive: A raises at CALICUT -> B(3) notified, A not, 4/5/6 not, both admins yes
  let r = await resolveStockTransferRequestApprovers({ amount: 10, branch: 'CALICUT', toBranch: null, senderId: 2 });
  assert.deepStrictEqual(ids(r), [1, 3, 7], 'non-admin sender excluded; admins always; filters applied');

  // destination-branch side also counts
  r = await resolveStockTransferRequestApprovers({ amount: 10, branch: 'CHENNAI', toBranch: 'CALICUT', senderId: 2 });
  assert.deepStrictEqual(ids(r), [1, 3, 5, 7]);

  // (e) admin sender still included; no duplicates
  r = await resolveStockTransferRequestApprovers({ amount: 10, branch: 'CALICUT', toBranch: 'CALICUT', senderId: 1 });
  assert.deepStrictEqual(ids(r), [1, 2, 3, 7]);
  assert.strictEqual(new Set(ids(r)).size, r.length);

  // (i) nobody eligible and no admin
  db.users.forEach((u) => { if (u.role === 'admin') u.status = 'Inactive'; });
  r = await resolveStockTransferRequestApprovers({ amount: 10, branch: 'NOWHERE', toBranch: null, senderId: 2 });
  assert.deepStrictEqual(r, []);
  db.users.forEach((u) => { if (u.role === 'admin') u.status = 'Active'; });

  // (h) click-time re-check
  const reqDoc = { branch: 'CALICUT', toBranch: null };
  await svc.assertMayResolve(3, 'StockTransferRequest', reqDoc); // ok
  db.perms.find((p) => p.userId === 3).canNotify = false;
  await assert.rejects(() => svc.assertMayResolve(3, 'StockTransferRequest', reqDoc), (e) => e.status === 403);
  db.perms.find((p) => p.userId === 3).canNotify = true;
  db.grants = db.grants.filter((g) => g.userId !== 3);
  await assert.rejects(() => svc.assertMayResolve(3, 'StockTransferRequest', reqDoc), (e) => e.status === 403);
  await svc.assertMayResolve(1, 'StockTransferRequest', reqDoc); // admin unaffected with no perms/branches
  db.users.find((u) => u.id === 3).status = 'Inactive';
  await assert.rejects(() => svc.assertMayResolve(3, 'StockTransferRequest', reqDoc), (e) => e.status === 403);

  // ApprovalResult rules
  const request = { id: 50, requestNo: 'MR-1', createdById: 2 };
  assert.strictEqual(await svc.createApprovalResultNotification({ referenceType: 'StockTransferRequest', request, decision: 'Approved', approverName: 'x', approverId: 2 }), null, 'approver==sender skipped');
  assert.strictEqual(await svc.createApprovalResultNotification({ referenceType: 'StockTransferRequest', request: { ...request, createdById: null }, decision: 'Approved', approverName: 'x', approverId: 9 }), null, 'legacy skipped');
  const made = await svc.createApprovalResultNotification({ referenceType: 'StockTransferRequest', request, decision: 'Approved', approverName: 'x', approverId: 9 });
  assert.strictEqual(made.type, 'ApprovalResult'); assert.strictEqual(made.actionStatus, null); assert.strictEqual(made.status, 'Unread');
  assert.strictEqual(await svc.createApprovalResultNotification({ referenceType: 'StockTransferRequest', request, decision: 'Approved', approverName: 'x', approverId: 9 }), null, 'duplicate skipped');

  // sibling close never touches ApprovalResult rows or the excluded row
  const a = await fake.notification.create({ data: { userId: 10, type: 'ApprovalRequest', referenceType: 'StockTransferRequest', referenceId: 60 } });
  const b = await fake.notification.create({ data: { userId: 11, type: 'ApprovalRequest', referenceType: 'StockTransferRequest', referenceId: 60 } });
  const res = await fake.notification.create({ data: { userId: 12, type: 'ApprovalResult', referenceType: 'StockTransferRequest', referenceId: 60 } });
  const ev = await svc.closeOpenRequestNotifications({ notification: fake.notification }, { referenceType: 'StockTransferRequest', referenceId: 60, actionStatus: 'Approved', excludeId: a.id });
  assert.deepStrictEqual(ev.map((e) => e.id), [b.id]);
  assert.strictEqual(res.actionStatus, null); assert.strictEqual(a.actionStatus, null); assert.strictEqual(b.actionStatus, 'Approved');

  console.log('notification recipient/helper tests: all passed');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
