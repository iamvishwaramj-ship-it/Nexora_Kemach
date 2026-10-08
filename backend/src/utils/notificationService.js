// Shared notification helpers (kept out of routes/resources.js so that
// routes/notifications.js, which already requires resources.js, can use them
// without a circular import).
//
// Every function that takes `tx` runs inside the caller's transaction and
// NEVER emits -- socket pushes are sent by the caller via
// utils/socket.js's emitNotifications() only AFTER the transaction commits,
// so nobody is told about a row that could still be rolled back.

const prisma = require('../prisma/client');
const { STOCK_TRANSFER_REQUEST_MENU_KEY } = require('./approverResolution');

// Menus that can raise notifications, and the fields on the document that
// name its branches. The frontend mirrors the keys in lib/permissions.js
// (NOTIFICATION_MENU_KEYS) to decide which rows show a Notification tick.
const NOTIFICATION_MENUS = {
  StockTransferRequest: {
    menuKey: STOCK_TRANSFER_REQUEST_MENU_KEY,
    label: 'Stock Transfer Request',
    branchFields: ['branch', 'toBranch'],
  },
};
const NOTIFICATION_MENU_KEYS = Object.values(NOTIFICATION_MENUS).map((m) => m.menuKey);

const APPROVAL_REQUEST = 'ApprovalRequest';
const APPROVAL_RESULT = 'ApprovalResult';

const ORIGIN_MARKER = 'Requested by';

// "Requested by Admin User from Kozhikode to Main Branch." Returns '' when
// there is nothing to say (legacy request with no sender and no branch).
function requestOriginText(request, senderName) {
  const parts = [];
  if (senderName) parts.push(`${ORIGIN_MARKER} ${senderName}`);
  if (request.branch) parts.push(`${senderName ? 'from' : 'From'} ${request.branch}`);
  if (request.toBranch) parts.push(`to ${request.toBranch}`);
  return parts.length ? `${parts.join(' ')}.` : '';
}

/**
 * Adds the requester + branch line to ApprovalRequest messages that were
 * stored before it existed, so older notifications in the bell show it too.
 * Read-time only (nothing is written back); rows that already carry it, and
 * rows whose request/user can no longer be found, are returned untouched.
 */
async function withRequestOrigin(notifications) {
  const targets = notifications.filter(
    (n) => n.type === APPROVAL_REQUEST && n.referenceType === 'StockTransferRequest' && !String(n.message || '').includes(ORIGIN_MARKER),
  );
  if (!targets.length) return notifications;
  const requests = await prisma.stockTransferRequest.findMany({
    where: { id: { in: [...new Set(targets.map((n) => n.referenceId))] } },
    select: { id: true, branch: true, toBranch: true, createdById: true },
  });
  const senderIds = [...new Set(requests.map((r) => r.createdById).filter((v) => v != null))];
  const senders = senderIds.length
    ? await prisma.appUser.findMany({ where: { id: { in: senderIds } }, select: { id: true, name: true } })
    : [];
  const senderName = new Map(senders.map((u) => [u.id, u.name]));
  const byId = new Map(requests.map((r) => [r.id, r]));
  return notifications.map((n) => {
    if (!targets.includes(n)) return n;
    const request = byId.get(n.referenceId);
    const origin = request ? requestOriginText(request, senderName.get(request.createdById)) : '';
    return origin ? { ...n, message: `${n.message} ${origin}` } : n;
  });
}

/**
 * One 'ApprovalRequest' row per recipient. Created one by one (not
 * createMany) because SQL Server's createMany returns no rows and the
 * emitter needs the ids.
 */
async function createApprovalRequestNotifications(tx, { referenceType, request, recipients }) {
  const rows = [];
  // Who raised the request and from/to which branch, appended to the message
  // so an approver can see the origin without opening the document.
  const sender = request.createdById != null
    ? await tx.appUser.findUnique({ where: { id: request.createdById }, select: { name: true } })
    : null;
  const origin = requestOriginText(request, sender && sender.name);
  for (const user of recipients) {
    rows.push(await tx.notification.create({
      data: {
        userId: user.id,
        type: APPROVAL_REQUEST,
        title: `${NOTIFICATION_MENUS[referenceType].label} awaiting approval`,
        message: `${request.requestNo} for ${request.amount} needs your approval.${origin ? ` ${origin}` : ''}`,
        referenceType,
        referenceId: request.id,
      },
    }));
  }
  return rows;
}

/**
 * Close every still-open ApprovalRequest row of one document (actionStatus
 * 'Approved' / 'Rejected' / 'Cancelled') and return the rows it touched, as
 * 'updated' events for emitNotifications. ApprovalResult rows are never
 * touched: they are informational and have no open state. `userIds`
 * (optional) restricts it to those recipients; `excludeId` skips the row the
 * caller already updated itself.
 */
async function closeOpenRequestNotifications(tx, { referenceType, referenceId, actionStatus, excludeId = null, userIds = null }) {
  const open = await tx.notification.findMany({
    where: {
      referenceType,
      referenceId,
      type: APPROVAL_REQUEST,
      actionStatus: null,
      ...(excludeId != null ? { id: { not: excludeId } } : {}),
      ...(userIds ? { userId: { in: userIds } } : {}),
    },
    select: { id: true, userId: true },
  });
  if (!open.length) return [];
  await tx.notification.updateMany({
    where: { id: { in: open.map((n) => n.id) }, actionStatus: null },
    data: { status: 'Read', actionStatus },
  });
  return open.map((n) => ({ kind: 'updated', userId: n.userId, id: n.id, status: 'Read', actionStatus, referenceId }));
}

/**
 * Click-time authorization for approve/reject, read from the DB (not the
 * JWT). Admins are exempt. A non-admin must still be Active, still hold
 * canNotify for the menu and still have branch access to one of the
 * document's branches -- access can be revoked after the notification was
 * delivered.
 */
async function assertMayResolve(userId, referenceType, document) {
  const cfg = NOTIFICATION_MENUS[referenceType];
  const user = await prisma.appUser.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true, status: true } });
  const deny = (message) => {
    const err = new Error(message);
    err.status = 403;
    return err;
  };
  if (!user || user.status !== 'Active') throw deny('Your account is not active');
  if (user.role === 'admin') return user;

  const permitted = await prisma.userPermission.count({ where: { userId, menuKey: cfg.menuKey, canNotify: true } });
  if (!permitted) throw deny('You no longer have permission to act on these requests');
  const branchNames = cfg.branchFields.map((f) => document[f]).filter(Boolean);
  const branchAccess = branchNames.length
    ? await prisma.userBranch.count({ where: { userId, branch: { branchName: { in: branchNames } } } })
    : 0;
  if (!branchAccess) throw deny('You no longer have access to this request\'s branch');
  return user;
}

/**
 * Tell the sender how their request was decided. Skipped for legacy rows
 * (no createdById), when the approver is the sender, and when an identical
 * result row already exists. Returns the created row, or null.
 */
async function createApprovalResultNotification({ referenceType, request, decision, approverName, approverId }) {
  if (request.createdById == null || request.createdById === approverId) return null;
  const label = NOTIFICATION_MENUS[referenceType].label;
  const title = `${label} ${decision.toLowerCase()}`;
  const existing = await prisma.notification.findFirst({
    where: { userId: request.createdById, type: APPROVAL_RESULT, referenceType, referenceId: request.id, title },
    select: { id: true },
  });
  if (existing) return null;
  return prisma.notification.create({
    data: {
      userId: request.createdById,
      type: APPROVAL_RESULT,
      title,
      message: `${request.requestNo} was ${decision.toLowerCase()} by ${approverName || 'an approver'}.`,
      referenceType,
      referenceId: request.id,
    },
  });
}

module.exports = {
  NOTIFICATION_MENUS,
  NOTIFICATION_MENU_KEYS,
  APPROVAL_REQUEST,
  APPROVAL_RESULT,
  createApprovalRequestNotifications,
  closeOpenRequestNotifications,
  assertMayResolve,
  createApprovalResultNotification,
  withRequestOrigin,
};
