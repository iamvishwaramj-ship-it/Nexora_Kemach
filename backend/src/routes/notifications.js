// Notification bell feature — list / mark-read / approve / reject for the
// current user's own notifications. Deliberately hand-written rather than
// run through crudRouter/crudFactory (utils/crudRouter.js) because every
// endpoint here is scoped to req.user.id and two of them (approve/reject)
// have side effects on a different model (StockTransferRequest) — nothing
// the generic CRUD shape covers.

const router = require('express').Router();
const prisma = require('../prisma/client');
const auth = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { emitNotifications } = require('../utils/socket');
const {
  APPROVAL_REQUEST,
  closeOpenRequestNotifications,
  assertMayResolve,
  createApprovalResultNotification,
  withRequestOrigin,
} = require('../utils/notificationService');
// Stock Transfer's own posting logic lives in routes/resources.js (it needs
// the same helpers -- assertNoNegativeStock, syncStockTransferMovement, etc.
// -- that file's own Stock Transfer routes already use), exposed here the
// same way routes/dashboard.js reuses buildAvailableBalanceReportData.
const { syncStockTransferApprovalOnRequestApproved } = require('./resources');

// GET /api/notifications?status=Unread — list the current user's own
// notifications, newest first. `status` is optional (omit for all).
router.get('/', auth(), asyncHandler(async (req, res) => {
  const { status } = req.query;
  const where = { userId: req.user.id };
  if (status) where.status = status;

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.notification.count({ where: { userId: req.user.id, status: 'Unread' } }),
  ]);

  res.json({ success: true, data: await withRequestOrigin(notifications), unreadCount });
}));

// PATCH /api/notifications/:id/read — mark one notification read. Scoped to
// the owning user so one person can't mark another's notification read by
// guessing an id.
router.patch('/:id/read', auth(), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.notification.findUnique({ where: { id } });
  if (!existing || existing.userId !== req.user.id) {
    const err = new Error('Notification not found');
    err.status = 404;
    throw err;
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { status: 'Read' },
  });
  // Keeps the user's other tabs/devices (and their unread badge) in sync.
  await emitNotifications([{ kind: 'updated', userId: req.user.id, id, status: 'Read', actionStatus: updated.actionStatus, referenceId: updated.referenceId }]);

  res.json({ success: true, data: updated });
}));

// Shared body for approve/reject — both flip the referenced
// StockTransferRequest's approvalStatus, stamp approver/approvedAt, close
// out the notification's actionStatus, and notify the requester back.
//
// A Stock Transfer Request can have several recipients (every admin, plus
// non-admins with the Notification permission and branch access — see
// utils/approverResolution.js), each with their OWN Notification row.
// Whoever acts first decides the request for everyone; every other
// recipient's ApprovalRequest row is synced to match, or their bell keeps
// showing stale Approve/Reject buttons for a request someone else already
// resolved.
async function resolveApproval(req, res, decision) {
  const id = Number(req.params.id);
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== req.user.id) {
    const err = new Error('Notification not found');
    err.status = 404;
    throw err;
  }
  // Only actionable rows can be approved/rejected — never an informational
  // ApprovalResult row (which would otherwise flip the request from the
  // SENDER's bell).
  if (notification.type !== APPROVAL_REQUEST) {
    const err = new Error('Only an approval request can be approved or rejected');
    err.status = 400;
    throw err;
  }
  if (notification.referenceType !== 'StockTransferRequest') {
    const err = new Error('This notification type cannot be approved or rejected here');
    err.status = 400;
    throw err;
  }
  if (notification.actionStatus) {
    const err = new Error(`This request has already been ${notification.actionStatus.toLowerCase()}`);
    err.status = 409;
    throw err;
  }

  // Someone else may have already resolved the underlying request between
  // this notification being rendered in the caller's bell and this click —
  // the caller's own row just hasn't caught up yet. Sync it now and tell
  // them plainly what happened, instead of either silently double-applying
  // the decision or letting a stale write through.
  const request = await prisma.stockTransferRequest.findUnique({
    where: { id: notification.referenceId },
    select: { id: true, requestNo: true, amount: true, branch: true, toBranch: true, approvalStatus: true, createdById: true },
  });
  if (!request) {
    // Orphaned notification — the request behind it was deleted. Not the
    // caller's fault and nothing left to act on, so resolve it as a normal
    // SUCCESS rather than an error: throwing would fail the mutation and
    // leave the stale Approve/Reject icons on screen. The row moves to
    // "Cancelled" (text only, icons gone).
    const cancelled = await prisma.notification.update({
      where: { id },
      data: { status: 'Read', actionStatus: 'Cancelled' },
    });
    await emitNotifications([{ kind: 'updated', userId: req.user.id, id, status: 'Read', actionStatus: 'Cancelled', referenceId: notification.referenceId }]);
    return res.json({ success: true, data: cancelled, message: 'This Stock Transfer Request no longer exists — removed from your notifications.' });
  }
  if (request.approvalStatus === 'Approved' || request.approvalStatus === 'Rejected') {
    await prisma.notification.update({
      where: { id },
      data: { status: 'Read', actionStatus: request.approvalStatus },
    });
    await emitNotifications([{ kind: 'updated', userId: req.user.id, id, status: 'Read', actionStatus: request.approvalStatus, referenceId: request.id }]);
    const err = new Error(`This request has already been ${request.approvalStatus.toLowerCase()} by another user`);
    err.status = 409;
    throw err;
  }

  // Click-time re-check against the DB (a grant can be revoked after the
  // notification was delivered). Admins are exempt.
  // Admins may approve or reject a request they raised themselves — intentional:
  // they already hold every approval right. Non-admins are never recipients of
  // their own request (see approverResolution), so self-approval cannot happen for them.
  const actor = await assertMayResolve(req.user.id, notification.referenceType, request);

  // Callback form because approving has a real side effect beyond these
  // writes — releasing stock/G/L for any Stock Transfer raised against this
  // Request (see syncStockTransferApprovalOnRequestApproved) — and that must
  // commit or roll back atomically with the approval decision itself.
  const { updatedRequest, siblingEvents } = await prisma.$transaction(async (tx) => {
    await tx.notification.update({
      where: { id },
      data: { status: 'Read', actionStatus: decision },
    });
    const updated = await tx.stockTransferRequest.update({
      where: { id: notification.referenceId },
      data: {
        approvalStatus: decision,
        approverId: req.user.id,
        approvedAt: new Date(),
      },
    });
    // Sync every OTHER still-open ApprovalRequest row to the same decision
    // (ApprovalResult rows are informational and never touched).
    const events = await closeOpenRequestNotifications(tx, {
      referenceType: 'StockTransferRequest',
      referenceId: notification.referenceId,
      actionStatus: decision,
      excludeId: id,
    });
    if (decision === 'Approved') {
      // The moment stock/G/L now actually move for a Request-linked Stock
      // Transfer that was waiting on exactly this approval.
      await syncStockTransferApprovalOnRequestApproved(tx, { requestNo: updated.requestNo, userId: req.user.id });
    } else {
      // Rejected: sync any still-Pending, still-Open Stock Transfer(s) raised
      // against this Request to the same terminal value. A rejected transfer
      // never posts, so there is nothing to reverse — this is purely so the
      // column reflects reality instead of sitting on 'Pending' forever.
      await tx.stockTransfer.updateMany({
        where: { requestNo: updated.requestNo, status: 'Open', approvalStatus: 'Pending' },
        data: { approvalStatus: 'Rejected' },
      });
    }
    return { updatedRequest: updated, siblingEvents: events };
  });

  // Everything below runs AFTER commit and can never fail the response: the
  // decision is already saved.
  const events = [
    { kind: 'updated', userId: req.user.id, id, status: 'Read', actionStatus: decision, referenceId: request.id },
    ...siblingEvents,
  ];
  try {
    // Tell the sender how it was decided (skipped for legacy rows, for a
    // sender who is the approver, and when one already exists).
    const result = await createApprovalResultNotification({
      referenceType: 'StockTransferRequest',
      request,
      decision,
      approverName: req.user.name || actor.name,
      approverId: req.user.id,
    });
    if (result) events.push({ kind: 'new', notification: result });
  } catch (err) {
    console.error('Could not create approval-result notification (ignored):', err.message);
  }
  await emitNotifications(events);

  res.json({ success: true, data: updatedRequest });
}

// POST /api/notifications/:id/approve
router.post('/:id/approve', auth(), asyncHandler((req, res) => resolveApproval(req, res, 'Approved')));

// POST /api/notifications/:id/reject
router.post('/:id/reject', auth(), asyncHandler((req, res) => resolveApproval(req, res, 'Rejected')));

module.exports = router;
