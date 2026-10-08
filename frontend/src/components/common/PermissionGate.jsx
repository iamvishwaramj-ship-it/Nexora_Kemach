import React from 'react';
import { Box, Card, CardContent, Stack, Typography, Button } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useNavigate } from 'react-router-dom';
import { usePermissions, useVisibleNav } from '../../lib/permissions';
import { canEdit as canEditConfig } from '../../config/deleteConfig';

// First page the user can actually open, walking the filtered nav depth-first.
// Parent sections are skipped in favour of a real leaf page, since a section
// landing page whose children are all hidden is just another dead end.
function firstReachablePath(nodes) {
  for (const node of nodes || []) {
    if (node.children?.length) {
      const nested = firstReachablePath(node.children);
      if (nested) return nested;
    } else if (node.path) {
      return node.path;
    }
  }
  return null;
}

/**
 * Route-level view guard. Wraps a page element in AppRouter so that a user who
 * cannot view the section gets told so plainly, instead of the page rendering
 * and then failing in confusing ways once its requests come back empty.
 *
 * Typing the URL by hand is the case this exists for — hiding the sidebar entry
 * alone would leave every page one address-bar edit away.
 */
export function RequireView({ children }) {
  const { canView, menuKey } = usePermissions();
  const navigate = useNavigate();
  const visible = useVisibleNav();

  if (canView) return children;

  // Don't offer "back to Dashboard" unconditionally: a user who wasn't granted
  // Dashboard either would land straight back on this screen. Send them to the
  // first page they can actually open, and if there is none, say so plainly
  // instead of showing a button that goes nowhere.
  const fallbackPath = firstReachablePath(visible);

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
      <Card variant="outlined" sx={{ maxWidth: 460, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={2} alignItems="center" textAlign="center">
            <LockOutlinedIcon color="disabled" sx={{ fontSize: 44 }} />
            <Typography variant="h6" fontWeight={700}>
              You don&apos;t have access to this page
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Your account has not been granted View permission for this section.
              Ask an administrator to enable it in User Management
              {menuKey ? ` (section: ${menuKey})` : ''}.
            </Typography>
            {fallbackPath ? (
              <Button variant="contained" onClick={() => navigate(fallbackPath)}>
                Go to a page you can access
              </Button>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No sections have been enabled for your account yet.
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

/**
 * Inline guards for action controls. Each renders its single child only when
 * the current page's permission allows that action:
 *
 *   <CanAdd><Button ...>Add Branch</Button></CanAdd>
 *   <CanEdit><MenuItem ...>Edit</MenuItem></CanEdit>
 *
 * They are deliberately TRANSPARENT: when the permission holds, the child is
 * cloned with whatever props and ref the parent passed through the gate, so the
 * gate itself never becomes a barrier in the tree. That matters because MUI
 * parents talk to their children directly — Tooltip needs a ref on the element
 * it anchors to, and MenuList clones its items to drive keyboard focus. An
 * opaque wrapper here would silently break both.
 *
 * These are a UI courtesy, not a security boundary — the server rejects the
 * request regardless (backend/src/middleware/permission.js). Pass an explicit
 * `menuKey` when the control governs a section other than the current route's.
 */
function createGate(displayName, flag) {
  const Gate = React.forwardRef(function Gate({ children, menuKey, ...rest }, ref) {
    const permissions = usePermissions(menuKey);
    if (!permissions[flag]) return null;
    const child = React.Children.only(children);
    // Only clone when there is something to pass along, so a plain
    // <CanEdit><IconButton/></CanEdit> stays a no-op on the child.
    if (!ref && Object.keys(rest).length === 0) return child;
    return React.cloneElement(child, ref ? { ...rest, ref } : rest);
  });
  Gate.displayName = displayName;
  return Gate;
}

export const CanAdd = createGate('CanAdd', 'canAdd');

// The permission-grid gates, unwrapped — CanEdit/CanDelete below wrap these
// with their own extra deleteConfig.js check.
const CanEditByPermission = createGate('CanEdit', 'canEdit');
const CanDeleteByPermission = createGate('CanDelete', 'canDelete');

/**
 * CanEdit — same transparent single-child gate as CanAdd, plus one more
 * check ANDed on top: the global deleteConfig.js `canEdit` switch. When
 * canEditConfig is false, Edit is hidden for every user regardless of their
 * permission grid; when true, the per-user canEdit permission above still
 * applies exactly as before. Mirrors CanDelete below.
 */
export const CanEdit = React.forwardRef(function CanEdit({ children, ...rest }, ref) {
  if (!canEditConfig) return null;
  return <CanEditByPermission ref={ref} {...rest}>{children}</CanEditByPermission>;
});

/**
 * CanDelete — same transparent single-child gate as CanAdd/CanEdit. Used to
 * also do its own blanket `if (!canDeleteConfig) return null` check here,
 * ahead of (and regardless of) per-user permission — but deleteConfig.js's
 * canDelete is no longer a blanket switch: it now governs ONLY the menus in
 * DELETE_SCOPED_MENU_KEYS, and usePermissions() (see lib/permissions.js) is
 * where that scoping is actually decided, per menuKey. So this gate now just
 * defers to CanDeleteByPermission's own permissions.canDelete — which is
 * already the scoped-menu-aware value for a scoped menu, and the untouched
 * per-user value for every other menu. No separate config check belongs
 * here any more; doing it here too would just be a second, menu-blind copy
 * of logic usePermissions() already got right.
 */
export const CanDelete = CanDeleteByPermission;

/**
 * CanCancel — gates the Cancel action (row-level Cancel icon on the Purchase
 * and Sales documents). Governed by its own per-user 'canCancel' permission
 * (User Management > Permissions > Cancel), no longer by 'canEdit'. Like the
 * old behaviour it is independent of deleteConfig.js's `canEditConfig`
 * switch, so hiding the Edit icon globally never hides Cancel.
 */
export const CanCancel = createGate('CanCancel', 'canCancel');

export default RequireView;
