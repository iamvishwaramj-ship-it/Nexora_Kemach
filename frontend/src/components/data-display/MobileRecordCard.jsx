import React from 'react';
import { Card, CardContent, Stack, Box, Typography, IconButton, Divider, Tooltip } from '@mui/material';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import { usePermissions } from '../../lib/permissions';
import { canEdit as canEditConfig } from '../../config/deleteConfig';

/**
 * MobileRecordCard — the mobile ("xs"/below `sm`) stand-in for a table row.
 * Every listing table in the app collapses into a stack of these below the
 * `sm` breakpoint instead of a horizontally-scrolled table — see tempmem.md
 * section 5.
 *
 * title: primary field shown as the card heading (usually the row's name/code)
 * fields: [{ label, value }] rendered as stacked label/value pairs
 * statusChip: optional node (e.g. a MUI <Chip />) shown next to the title
 * onEdit/onDelete/onView: optional row action handlers, receive the row
 * extraActions: optional [{ key, label, icon, onClick, color }] — additional
 * edit-type buttons beyond onEdit (e.g. a page that splits "edit" into two
 * separate actions, like User Management's details vs. permissions edit).
 * Gated by the same canEdit check as onEdit.
 * deleteDisabled/deleteDisabledReason: grey out Delete without hiding it —
 * for a row a permission check wouldn't catch, e.g. Business Partner's own
 * "already used on a document" rule (same as UserManagement's own inline
 * disabled-delete-on-self, generalised so every mobile list can use it).
 * The reason shows as a tooltip on the (still-hoverable, wrapped in a span)
 * disabled button.
 * menuKey: which navConfig menu governs this card's actions — defaults to
 * whatever usePermissions() resolves from the current route (correct for
 * the common case: a page's own list, rendered on that page's own route).
 * Pass this explicitly when a card is rendered somewhere other than its
 * governing page (mirrors DataTable's own menuKey prop, which threads its
 * own value down when it renders this component internally).
 */
export default function MobileRecordCard({
  title, fields = [], statusChip, onEdit, onDelete, onView, extraActions = [],
  deleteDisabled = false, deleteDisabledReason, menuKey,
}) {
  // Row actions follow the signed-in user's menu permissions for whichever page
  // this card is rendered on. Gating here covers every mobile list at once; the
  // desktop tables gate their own icon buttons the same way.
  const { canEdit: canEditByPermission, canDelete: canDeleteByPermission } = usePermissions(menuKey);
  // Edit: deleteConfig.js's canEdit is still a blanket override sitting on
  // top of the per-user permission — unaffected by this task's Delete
  // scoping.
  const canEdit = canEditByPermission && canEditConfig;
  // Delete: canDeleteByPermission above is already the final answer — for a
  // menu in DELETE_SCOPED_MENU_KEYS, usePermissions() has already folded the
  // deleteConfig.js flag in (ignoring the per-user row); for every other
  // menu it's the untouched per-user UserPermission.canDelete check. ANDing
  // a raw canDeleteConfig here again would be redundant for a scoped menu
  // and wrong for every other one (it would reintroduce the old blanket
  // override this task removes). See lib/permissions.js.
  const canDelete = canDeleteByPermission;
  const showEdit = onEdit && canEdit;
  const showDelete = onDelete && canDelete;
  const showExtraActions = canEdit && extraActions.length > 0;
  const hasActions = showEdit || showDelete || onView || showExtraActions;

  return (
    <Card variant="outlined" sx={{ mb: 1.5 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ wordBreak: 'break-word' }}>
            {title}
          </Typography>
          {statusChip}
        </Stack>

        <Stack spacing={0.75} sx={{ mt: 1.5 }}>
          {fields.map((f) => (
            <Stack key={f.label} direction="row" justifyContent="space-between" spacing={2}>
              <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>{f.label}</Typography>
              <Typography variant="body2" sx={{ textAlign: 'right', wordBreak: 'break-word' }}>{f.value ?? '—'}</Typography>
            </Stack>
          ))}
        </Stack>

        {hasActions && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
              {onView && (
                <IconButton size="small" onClick={onView} aria-label="view">
                  <VisibilityIcon fontSize="small" />
                </IconButton>
              )}
              {showEdit && (
                <IconButton size="small" color="primary" onClick={onEdit} aria-label="edit">
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
              {showExtraActions && extraActions.map((a) => (
                <IconButton key={a.key || a.label} size="small" color={a.color || 'primary'} onClick={a.onClick} aria-label={a.label}>
                  {a.icon}
                </IconButton>
              ))}
              {showDelete && (deleteDisabled ? (
                <Tooltip title={deleteDisabledReason || 'Cannot be deleted'}>
                  <span>
                    <IconButton size="small" color="error" disabled aria-label="delete">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              ) : (
                <IconButton size="small" color="error" onClick={onDelete} aria-label="delete">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              ))}
            </Stack>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Shared hook so every page checks the same breakpoint the same way.
export { useIsMobileListView } from './useIsMobileListView';
