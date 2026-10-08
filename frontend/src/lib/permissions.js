import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { navConfig, flatNav } from '../router/navConfig';
import { selectCurrentUser } from '../store/authSlice';
import { canDelete as deleteScopedFlag, DELETE_SCOPED_MENU_KEYS } from '../config/deleteConfig';

/**
 * Menu-permission helpers.
 *
 * The source of truth is the permission grid saved per user in User
 * Management: one row per navConfig `key`, carrying canView / canAdd /
 * canEdit / canDelete. The backend sends back only the rows with at least one
 * flag set (see backend/src/services/authService.js), so a menu key that is
 * absent from the list means "no access to it" rather than "unknown".
 *
 * This module governs the UI. It is NOT the security boundary — a user who
 * edits their localStorage can put any button back on screen, and it will
 * still fail on the server. Writes are enforced in
 * backend/src/middleware/permission.js; what happens here is only about not
 * showing people doors they cannot walk through.
 */

// Admins always see everything. This mirrors the same bypass on the server and
// exists for the same reason: an admin who saved themselves a sparse grid must
// not be able to lock themselves out of User Management.
export function isAdmin(user) {
  return user?.role === 'admin';
}

// Menus whose documents raise in-app notifications, i.e. the only rows where
// User Management shows a "Notification" tick. Mirrors NOTIFICATION_MENUS in
// backend/src/utils/notificationService.js -- add a key in both places when
// another document type starts notifying. Admins are always notified and
// need no tick.
export const NOTIFICATION_MENU_KEYS = ['stock-transfer-request'];
export const canRaiseNotifications = (menuKey) => NOTIFICATION_MENU_KEYS.includes(menuKey);

// Menus whose documents can be cancelled, i.e. the only rows where User
// Management shows a "Cancel" tick (and where the row-level Cancel icon is
// gated by <CanCancel>). Add a key here when another document type gets a
// Cancel action.
export const CANCEL_MENU_KEYS = [
  'purchase-quotation', 'purchase-order', 'purchase-grn', 'purchase-invoice',
  'purchase-return', 'purchase-credit-memo',
  'sales-quotation', 'sales-order', 'sales-invoice', 'delivery-challan',
  'sales-return', 'sales-credit-memo',
];
export const canCancelMenu = (menuKey) => CANCEL_MENU_KEYS.includes(menuKey);

function permissionMap(user) {
  const map = new Map();
  (user?.permissions || []).forEach((p) => map.set(p.menuKey, p));
  return map;
}

/**
 * can(user, menuKey, 'canAdd') — does this user hold that flag on that menu?
 * Unknown menu key, missing row or missing user all mean "no".
 */
export function can(user, menuKey, action) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (!menuKey) return false;
  const row = permissionMap(user).get(menuKey);
  return !!(row && row[action]);
}

// A parent section is reachable when the user can view the section itself OR
// anything beneath it — otherwise granting only "Branch" would leave Company
// Setup hidden and the page unreachable from the sidebar.
function nodeIsVisible(node, map, admin) {
  if (admin) return true;
  if (map.get(node.key)?.canView) return true;
  return (node.children || []).some((child) => nodeIsVisible(child, map, admin));
}

/**
 * Filters navConfig down to what this user may see, preserving nesting.
 * Used by the sidebar and by the card-grid sub-menu pages.
 *
 * `hidden: true` on a node pulls it off the sidebar/sub-menu grid for
 * EVERYONE, admins included — unlike the permission check below, it isn't
 * something a user's grid can grant back. It's a menu-level on/off switch,
 * not a permission; the underlying route/page is untouched (see the note on
 * flattenNav() in navConfig.js), so it's still reachable by a direct link,
 * still governed by its own permission row, and still shows up in
 * breadcrumbs/tabs if someone lands on it that way.
 */
export function visibleNav(user, tree = navConfig) {
  const admin = isAdmin(user);
  const map = permissionMap(user);
  const walk = (nodes) =>
    nodes
      .filter((node) => !node.hidden && (admin || nodeIsVisible(node, map, false)))
      .map((node) => (node.children ? { ...node, children: walk(node.children) } : node));
  return walk(tree);
}

/**
 * Resolves a router pathname to the navConfig node that governs it.
 *
 * Matches the longest declared path that prefixes the current one, so the
 * "create" and detail sub-routes a page owns (/company/branch, and anything
 * under it) resolve to that page's own menu key rather than to its parent
 * section. Returns null for paths outside the menu (login, profile, ...),
 * which callers treat as ungoverned.
 */
/**
 * isDeleteScopedMenu(menuKey) — is this menu one of the ones
 * deleteConfig.js's DELETE_SCOPED_MENU_KEYS governs? Kept as its own helper
 * (rather than inlining the Set lookup at each call site) so usePermissions()
 * below and any other caller share exactly one definition of "in scope."
 */
export function isDeleteScopedMenu(menuKey) {
  return !!menuKey && DELETE_SCOPED_MENU_KEYS.has(menuKey);
}

export function findNavNodeForPath(pathname) {
  if (!pathname) return null;
  let best = null;
  flatNav.forEach((node) => {
    if (!node.path) return;
    if (pathname === node.path || pathname.startsWith(`${node.path}/`)) {
      if (!best || node.path.length > best.path.length) best = node;
    }
  });
  return best;
}

/**
 * usePermissions() — the current page's permissions, derived from the route.
 *
 * Pages use this to hide their own Add/Edit/Delete controls:
 *   const { canAdd, canEdit, canDelete } = usePermissions();
 *
 * A route with no matching menu entry is treated as fully permitted, so pages
 * outside the menu (Profile, Settings sub-pages) are not accidentally frozen.
 */
export function usePermissions(menuKeyOverride) {
  const user = useSelector(selectCurrentUser);
  const { pathname } = useLocation();

  return useMemo(() => {
    const admin = isAdmin(user);
    const menuKey = menuKeyOverride || findNavNodeForPath(pathname)?.key || null;
    const ungoverned = !menuKey;
    const row = menuKey ? permissionMap(user).get(menuKey) : null;

    // deleteConfig.js's DELETE_SCOPED_MENU_KEYS carves out a fixed set of
    // Purchase/Sales/Inventory/Banking transaction menus where the per-user
    // UserPermission.canDelete row is IGNORED entirely and the flag alone
    // decides: true auto-grants delete to every user on that menu (no
    // per-user checkbox needed), false hard-blocks it for every user (no
    // per-user override possible). Admin bypass still applies on top, same
    // as every other flag here, so an admin is never the one locked out.
    // Every OTHER menu key (including "ungoverned" routes outside the menu
    // entirely) is completely untouched by this flag — canDelete for them is
    // exactly the pre-existing admin || ungoverned || row?.canDelete logic,
    // with zero involvement of deleteConfig.js. See the backend's mirrored
    // decision in middleware/permission.js's permissionGuard().
    // The flag is a HARD switch for scoped menus: false hides Delete for
    // everyone, admins included (the old `admin ||` here is why Delete kept
    // showing for admin accounts with canDelete = false).
    const canDelete = isDeleteScopedMenu(menuKey)
      ? deleteScopedFlag
      : (admin || ungoverned || !!row?.canDelete);

    return {
      menuKey,
      isAdmin: admin,
      canView: admin || ungoverned || !!row?.canView,
      canAdd: admin || ungoverned || !!row?.canAdd,
      canEdit: admin || ungoverned || !!row?.canEdit,
      canDelete,
      canCancel: admin || ungoverned || !!row?.canCancel,
    };
  }, [user, pathname, menuKeyOverride]);
}

/**
 * useVisibleNav() — navConfig filtered for the signed-in user.
 */
export function useVisibleNav(tree = navConfig) {
  const user = useSelector(selectCurrentUser);
  return useMemo(() => visibleNav(user, tree), [user, tree]);
}
