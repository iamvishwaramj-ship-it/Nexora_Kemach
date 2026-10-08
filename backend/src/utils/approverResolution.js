// Recipient resolution for the Notification bell / approval-gate feature.
//
// Who is told about a document is decided entirely here, server-side, from
// the DATABASE (never from JWT claims, which can be stale): the client never
// names a recipient or a socket room.
//
// Recipients are the UNION of two groups, deduped by user id:
//
//   Group A -- admins. Every Active AppUser with role 'admin'. NO permission,
//   branch, amount-level or sender filter: admins are exempt from all of
//   them, so an admin who raised the request still sees (and may act on) it.
//
//   Group B -- users. Every Active, non-admin AppUser who
//     * has a UserPermission row for the document's menuKey with
//       canNotify = true, AND
//     * has a UserBranch grant for a Branch named in the document's branch
//       fields (source OR destination), AND
//     * is not the sender (compared by user id only -- names/emails are not
//       unique enough to trust).
//
// The configured ApprovalFlow amount level (admin-maintained master, see
// schema.prisma) may only NARROW group B to the named approver(s); it can
// never remove an admin, and an approver name that matches no eligible user
// does NOT fall back to "everyone" -- group B simply stays as computed.
//
// Adding another document type later = supply its menuKey, transactionName
// and branch values to resolveApprovers(); nothing here is Stock-Transfer
// specific apart from the thin wrapper at the bottom.

const prisma = require('../prisma/client');

const TRANSACTION_NAME = 'Stock Transfer Request';
// navConfig / UserPermission key of the Stock Transfer Request page (see
// PATH_TO_MENU_KEY in middleware/permission.js).
const STOCK_TRANSFER_REQUEST_MENU_KEY = 'stock-transfer-request';

const USER_SELECT = { id: true, name: true, email: true, role: true };

async function matchingApproverNames(transactionName, amount) {
  const flow = await prisma.approvalFlow.findFirst({
    where: { transactionName, status: 'Active' },
    include: { levels: true },
  });
  if (!flow || flow.approvalType !== 'Amount Based' || !Array.isArray(flow.levels)) return [];
  const numericAmount = Number(amount) || 0;
  const level = flow.levels.find((l) => {
    const from = Number(l.fromAmount) || 0;
    const to = l.toAmount == null ? null : Number(l.toAmount);
    return numericAmount >= from && (to == null || numericAmount <= to);
  });
  return level && level.approver ? [level.approver] : [];
}

/**
 * @param {object} args
 * @param {number} args.amount        document amount (for the optional ApprovalFlow narrowing)
 * @param {Array<string|null>} args.branches  the document's branch NAMES (source and destination)
 * @param {number|null} args.senderId AppUser.id of whoever raised it
 * @param {string} args.menuKey       UserPermission.menuKey whose canNotify gates group B
 * @param {string} args.transactionName ApprovalFlow.transactionName for the narrowing lookup
 * @returns {Promise<Array<{id:number,name:string,email:string|null,isAdmin:boolean}>>}
 */
async function resolveApprovers({ amount, branches, senderId, menuKey, transactionName }) {
  const branchNames = (branches || []).filter(Boolean);

  // Two queries, no per-user loop: admins, then users via relational filters.
  const [admins, branchUsers] = await Promise.all([
    prisma.appUser.findMany({ where: { role: 'admin', status: 'Active' }, select: USER_SELECT }),
    branchNames.length
      ? prisma.appUser.findMany({
        where: {
          status: 'Active',
          role: { not: 'admin' },
          ...(senderId != null ? { id: { not: senderId } } : {}),
          permissions: { some: { menuKey, canNotify: true } },
          branches: { some: { branch: { branchName: { in: branchNames } } } },
        },
        select: USER_SELECT,
      })
      : Promise.resolve([]),
  ]);

  let groupB = branchUsers;
  const approverNames = await matchingApproverNames(transactionName, amount);
  if (approverNames.length && groupB.length) {
    // SQL Server's default collation is case-insensitive, so compare lowered.
    const wanted = new Set(approverNames.map((n) => String(n).trim().toLowerCase()));
    const narrowed = groupB.filter((u) => wanted.has(String(u.name || '').trim().toLowerCase()));
    // Only narrow when the configured name actually matches someone eligible
    // -- a role title like "Manager" matches no user and must not empty B.
    if (narrowed.length) groupB = narrowed;
  }

  const byId = new Map();
  admins.forEach((u) => byId.set(u.id, { id: u.id, name: u.name, email: u.email, isAdmin: true }));
  groupB.forEach((u) => { if (!byId.has(u.id)) byId.set(u.id, { id: u.id, name: u.name, email: u.email, isAdmin: false }); });
  return Array.from(byId.values());
}

function resolveStockTransferRequestApprovers({ amount, branch, toBranch, senderId, menuKey = STOCK_TRANSFER_REQUEST_MENU_KEY }) {
  return resolveApprovers({
    amount,
    branches: [branch, toBranch],
    senderId,
    menuKey,
    transactionName: TRANSACTION_NAME,
  });
}

module.exports = {
  TRANSACTION_NAME,
  STOCK_TRANSFER_REQUEST_MENU_KEY,
  resolveApprovers,
  resolveStockTransferRequestApprovers,
};
