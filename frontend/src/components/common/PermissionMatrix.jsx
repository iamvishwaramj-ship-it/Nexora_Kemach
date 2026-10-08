import React, { useMemo, useState } from 'react';
import {
  Box, TextField, InputAdornment, IconButton, Table, TableBody, TableCell, TableHead, TableRow,
  Checkbox, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControlLabel, Stack,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Close';
import { Controller, useFormContext } from 'react-hook-form';
import Tooltip from '@mui/material/Tooltip';
import { useTranslation } from 'react-i18next';
import ScrollableTableContainer from '../data-display/ScrollableTableContainer';
import { flatNav } from '../../router/navConfig';
import { useFormReadOnly } from '../form/AppForm';
import { REPORT_COLUMN_OPTIONS, parseHiddenColumns } from '../../lib/reportColumns';
import { isDeleteScopedMenu, canRaiseNotifications, canCancelMenu } from '../../lib/permissions';
import { canDelete as deleteScopedFlag } from '../../config/deleteConfig';

// Section rows that are pure navigation (a card-grid landing page — Company,
// Reports > Sales, ...) or a page with genuinely no add/edit/delete concept
// of its own (Dashboard, every individual report under Reports, Settings)
// only ever carry View — matches the reference design's Dashboard/
// Organization rows, which show "—" instead of a checkbox for the three
// columns that don't apply there.
function isViewOnly(node) {
  if (node.isParent) return true;
  if (node.key === 'dashboard' || node.key === 'settings') return true;
  // Every leaf under Reports (Enquiry Register, Stock Valuation, ...) is a
  // read-only register/analysis with no add/edit/delete of its own.
  if (node.trail.some((n) => n.key === 'reports')) return true;
  return false;
}

function navLabel(node, t) {
  return node.labelKey?.startsWith('nav.') ? t(node.labelKey) : node.labelKey;
}

/**
 * Seeds a `permissions` form field with one row per navConfig entry — every
 * top-level section AND every submenu beneath it, at full depth (Reports'
 * individual report pages included) — carrying over an existing user's
 * saved flags where a menuKey matches, and defaulting a menu item the user
 * has never been granted anything on to all-false.
 *
 * The row order always follows flatNav, and PermissionMatrix addresses each
 * row by that same flatNav index — the two must never seed from different
 * orderings or a row's checkboxes would end up controlling a different
 * menu item than the label next to them claims.
 */
export function buildPermissionRows(existingPermissions = []) {
  const byKey = new Map((existingPermissions || []).map((p) => [p.menuKey, p]));
  return flatNav.map((node) => {
    const existing = byKey.get(node.key);
    return {
      menuKey: node.key,
      canView: existing ? !!existing.canView : false,
      canAdd: existing ? !!existing.canAdd : false,
      canEdit: existing ? !!existing.canEdit : false,
      canDelete: existing ? !!existing.canDelete : false,
      canCancel: existing ? !!existing.canCancel : false,
      canNotify: existing ? !!existing.canNotify : false,
      hiddenColumns: existing ? parseHiddenColumns(existing.hiddenColumns) : [],
    };
  });
}

// "Columns" button on a report row that supports per-user column access
// (see lib/reportColumns.js): opens a checklist of that report's columns —
// ticked = the user sees it, unticked = excluded for this user. Writes the
// row's `hiddenColumns` field, saved with the rest of the permissions.
function ColumnAccessButton({ baseName, menuKey }) {
  const readOnly = useFormReadOnly();
  const { watch, setValue } = useFormContext();
  const [open, setOpen] = useState(false);
  const options = REPORT_COLUMN_OPTIONS[menuKey] || [];
  const hidden = parseHiddenColumns(watch(`${baseName}.hiddenColumns`));
  const shownCount = options.filter((o) => !hidden.includes(o.key)).length;

  const setHidden = (next) => setValue(`${baseName}.hiddenColumns`, next, { shouldDirty: true });
  const toggle = (key) => setHidden(hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key]);

  return (
    <>
      <Button size="small" variant="text" onClick={() => setOpen(true)} sx={{ whiteSpace: 'nowrap', minWidth: 0 }}>
        {shownCount}/{options.length}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Columns this user can see</DialogTitle>
        <DialogContent dividers>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <Button size="small" disabled={readOnly || hidden.length === 0} onClick={() => setHidden([])}>Include all</Button>
            <Button size="small" disabled={readOnly || hidden.length === options.length} onClick={() => setHidden(options.map((o) => o.key))}>Exclude all</Button>
          </Stack>
          {options.map((o) => (
            <FormControlLabel
              key={o.key}
              sx={{ display: 'flex' }}
              control={<Checkbox size="small" checked={!hidden.includes(o.key)} disabled={readOnly} onChange={() => toggle(o.key)} />}
              label={o.label}
            />
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Done</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function ActionCheckbox({ name, disabled }) {
  const readOnly = useFormReadOnly();
  const { control } = useFormContext();
  if (disabled) {
    return (
      <Typography variant="body2" color="text.disabled" align="center" component="span">
        —
      </Typography>
    );
  }
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Checkbox
          size="small"
          checked={!!field.value}
          disabled={readOnly}
          onChange={(e) => field.onChange(e.target.checked)}
        />
      )}
    />
  );
}

/**
 * Delete column cell — same as ActionCheckbox for every ordinary row, but a
 * row whose menuKey is in deleteConfig.js's DELETE_SCOPED_MENU_KEYS (see
 * isDeleteScopedMenu()) is no longer an editable per-user permission at all,
 * because runtime delete access for those menus is decided entirely by the
 * deleteConfig.js flag (frontend AND backend — see middleware/permission.js),
 * never by this row's own stored canDelete value:
 *
 *   - flag false (hard-blocked for everyone) -> hidden, same "—" treatment
 *     as a view-only row, so an admin never sees a checkbox that would do
 *     nothing if ticked.
 *   - flag true (auto-granted to everyone) -> a checkbox is still shown, but
 *     forced checked and disabled, communicating "already granted, not
 *     something you can turn off here" rather than either hiding it (which
 *     would misleadingly suggest delete is unavailable) or leaving it a live
 *     editable box an admin could un-tick to no effect.
 *
 * Deliberately NOT wired to react-hook-form's Controller in either scoped
 * case: neither ticking nor un-ticking it should write anything, since the
 * row's stored canDelete value for these menus is inert historical data (see
 * the no-DB-migration note in deleteConfig.js) and the runtime override is
 * what actually governs behavior. viewOnly still takes priority over scoped
 * — a view-only row (Dashboard, a parent section, ...) never had a Delete
 * concept to begin with, scoped or not.
 *
 * Note: the row's own "All" checkbox and the column header's bulk toggle
 * (AllCheckbox/HeaderColumnCheckbox/HeaderAllCheckbox above) are unchanged —
 * they still read/write this row's underlying canDelete field exactly as
 * before. That's harmless (the field is inert for a scoped menu either way)
 * but means those bulk controls don't specially skip scoped rows the way
 * this cell does; only this cell's own DISPLAY reflects the flag.
 */
function DeleteActionCheckbox({ name, viewOnly, scoped }) {
  const readOnly = useFormReadOnly();
  const { control } = useFormContext();
  if (viewOnly) {
    return (
      <Typography variant="body2" color="text.disabled" align="center" component="span">
        —
      </Typography>
    );
  }
  if (scoped) {
    if (!deleteScopedFlag) {
      return (
        <Typography variant="body2" color="text.disabled" align="center" component="span">
          —
        </Typography>
      );
    }
    return <Checkbox size="small" checked disabled />;
  }
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Checkbox
          size="small"
          checked={!!field.value}
          disabled={readOnly}
          onChange={(e) => field.onChange(e.target.checked)}
        />
      )}
    />
  );
}

/**
 * Cancel column cell. Only menus with a Cancel action (canCancelMenu — the
 * Purchase/Sales documents) get a tick; every other row shows "—" so nobody
 * ticks a box that does nothing.
 */
function CancelCheckbox({ name, menuKey }) {
  if (!canCancelMenu(menuKey)) {
    return (
      <Typography variant="body2" color="text.disabled" align="center" component="span">
        —
      </Typography>
    );
  }
  return <ActionCheckbox name={name} />;
}

/**
 * Notification column cell. Only menus that can raise notifications get a
 * tick (canRaiseNotifications); every other row shows "—" so nobody ticks a
 * box that does nothing. For an admin account the cell reads "always on":
 * admins are exempt from permission/branch filtering and are always notified,
 * so the stored value is irrelevant. It is an extra flag -- never menu access.
 */
function NotificationCheckbox({ name, menuKey, adminTarget }) {
  if (!canRaiseNotifications(menuKey)) {
    return (
      <Typography variant="body2" color="text.disabled" align="center" component="span">
        —
      </Typography>
    );
  }
  if (adminTarget) {
    return (
      <Tooltip title="Admins always receive notifications">
        <span><Checkbox size="small" checked disabled /></span>
      </Tooltip>
    );
  }
  return <ActionCheckbox name={name} />;
}

// "All" isn't its own stored flag — it's a convenience toggle over the row's
// real columns, so it reads/writes them directly instead of being a field of
// its own. For a view-only row (see isViewOnly above) the only real column IS
// View, so All and View end up mirroring each other there, same as the
// reference design's Dashboard/Organization rows showing both as live,
// independently-clickable checkboxes.
function AllCheckbox({ baseName, viewOnly, menuKey }) {
  const readOnly = useFormReadOnly();
  const { watch, setValue } = useFormContext();
  const row = watch(baseName) || {};
  const notifies = canRaiseNotifications(menuKey);
  const cancels = canCancelMenu(menuKey);
  const checked = viewOnly
    ? !!row.canView
    : !!(row.canView && row.canAdd && row.canEdit && row.canDelete && (!cancels || row.canCancel) && (!notifies || row.canNotify));

  const handleChange = (e) => {
    const next = e.target.checked;
    setValue(`${baseName}.canView`, next, { shouldDirty: true, shouldValidate: true });
    if (!viewOnly) {
      setValue(`${baseName}.canAdd`, next, { shouldDirty: true, shouldValidate: true });
      setValue(`${baseName}.canEdit`, next, { shouldDirty: true, shouldValidate: true });
      setValue(`${baseName}.canDelete`, next, { shouldDirty: true, shouldValidate: true });
      if (cancels) setValue(`${baseName}.canCancel`, next, { shouldDirty: true, shouldValidate: true });
      if (notifies) setValue(`${baseName}.canNotify`, next, { shouldDirty: true });
    }
  };

  return <Checkbox size="small" checked={checked} disabled={readOnly} onChange={handleChange} />;
}

// Header checkbox for a single action column (View/Add/Edit/Delete) — toggles
// that one field across every row currently visible. Add/Edit/Delete skip
// view-only rows entirely (they show "—" there, no checkbox to touch); View
// applies to every row since it's the one column every row always has.
function HeaderColumnCheckbox({ name, field, indices }) {
  const readOnly = useFormReadOnly();
  const { watch, setValue } = useFormContext();
  const rows = watch(name) || [];

  const applicableIndices = useMemo(
    () => {
      if (field === 'canView') return indices;
      if (field === 'canCancel') return indices.filter((i) => canCancelMenu(flatNav[i].key));
      return indices.filter((i) => !isViewOnly(flatNav[i]));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [indices, field]
  );

  const checkedCount = applicableIndices.reduce((n, i) => n + ((rows[i] || {})[field] ? 1 : 0), 0);
  const checked = applicableIndices.length > 0 && checkedCount === applicableIndices.length;
  const indeterminate = checkedCount > 0 && checkedCount < applicableIndices.length;

  const handleChange = (e) => {
    const next = e.target.checked;
    applicableIndices.forEach((i) => {
      setValue(`${name}.${i}.${field}`, next, { shouldDirty: true, shouldValidate: true });
    });
  };

  return (
    <Checkbox
      size="small"
      checked={checked}
      indeterminate={indeterminate}
      disabled={readOnly || applicableIndices.length === 0}
      onChange={handleChange}
      sx={{
        color: 'rgba(255,255,255,0.7)',
        '&.Mui-checked': { color: '#fff' },
        '&.MuiCheckbox-indeterminate': { color: '#fff' },
        '&.Mui-disabled': { color: 'rgba(255,255,255,0.3)' },
      }}
    />
  );
}

// Header "All" checkbox — toggles every row currently visible (respecting
// the search filter, so it never touches rows the user can't see) between
// fully granted and fully cleared, same per-row viewOnly rule as AllCheckbox.
function HeaderAllCheckbox({ name, indices }) {
  const readOnly = useFormReadOnly();
  const { watch, setValue } = useFormContext();
  const rows = watch(name) || [];

  const rowChecked = (i) => {
    const node = flatNav[i];
    const row = rows[i] || {};
    return isViewOnly(node)
      ? !!row.canView
      : !!(row.canView && row.canAdd && row.canEdit && row.canDelete && (!canCancelMenu(node.key) || row.canCancel) && (!canRaiseNotifications(node.key) || row.canNotify));
  };

  const checkedCount = indices.reduce((n, i) => n + (rowChecked(i) ? 1 : 0), 0);
  const checked = indices.length > 0 && checkedCount === indices.length;
  const indeterminate = checkedCount > 0 && checkedCount < indices.length;

  const handleChange = (e) => {
    const next = e.target.checked;
    indices.forEach((i) => {
      const node = flatNav[i];
      const baseName = `${name}.${i}`;
      setValue(`${baseName}.canView`, next, { shouldDirty: true, shouldValidate: true });
      if (!isViewOnly(node)) {
        setValue(`${baseName}.canAdd`, next, { shouldDirty: true, shouldValidate: true });
        setValue(`${baseName}.canEdit`, next, { shouldDirty: true, shouldValidate: true });
        setValue(`${baseName}.canDelete`, next, { shouldDirty: true, shouldValidate: true });
        if (canCancelMenu(node.key)) setValue(`${baseName}.canCancel`, next, { shouldDirty: true, shouldValidate: true });
        if (canRaiseNotifications(node.key)) setValue(`${baseName}.canNotify`, next, { shouldDirty: true });
      }
    });
  };

  return (
    <Checkbox
      size="small"
      checked={checked}
      indeterminate={indeterminate}
      disabled={readOnly || indices.length === 0}
      onChange={handleChange}
      // The header row is filled with the theme's primary color and the
      // checkbox defaults to that same color for its checked/indeterminate
      // states — left alone, a checked box is red-on-red and disappears.
      // Force white so it stays visible against the header regardless of
      // theme color scheme.
      sx={{
        color: 'rgba(255,255,255,0.7)',
        '&.Mui-checked': { color: '#fff' },
        '&.MuiCheckbox-indeterminate': { color: '#fff' },
        '&.Mui-disabled': { color: 'rgba(255,255,255,0.3)' },
      }}
    />
  );
}

/**
 * Menu-based permission grid — one row per section AND submenu (navConfig,
 * full depth), View/Add/Edit/Delete + a convenience All column per row, and a
 * search box to find a section in a ~95-row list. Bind it to a form field
 * (default name "permissions") seeded via buildPermissionRows() above.
 */
export default function PermissionMatrix({ name = 'permissions' }) {
  const { t } = useTranslation();
  const { formState: { errors }, watch } = useFormContext();
  const [search, setSearch] = useState('');
  // The account being edited: admins are always notified, so their
  // Notification cells read "always on" instead of being editable.
  const adminTarget = watch('role') === 'admin';

  // zodResolver puts an array-level .refine() error either directly on the
  // field (`errors.permissions.message`) or nested under `.root`, depending
  // on resolver version — check both rather than assume one shape.
  const fieldError = errors?.[name];
  const errorMessage = fieldError?.message || fieldError?.root?.message;

  const q = search.trim().toLowerCase();
  const visibleIndices = useMemo(() => {
    // Rows still come from flatNav at full depth so indices keep lining up
    // with buildPermissionRows()'s own flatNav.map() (see that function's
    // doc comment — the two must never diverge) and any permission already
    // saved for a hidden menu item (e.g. Enquiry/Follow-up, from before their
    // route was hidden — see navConfig.js) is preserved rather than dropped.
    // A node marked `hidden: true` in navConfig.js (its sidebar/search entry
    // pulled, route left working — see navConfig.js's own comment) is simply
    // never rendered as a row here, same as it's never rendered in the
    // sidebar.
    const indices = flatNav.map((_, i) => i).filter((i) => !flatNav[i].hidden);
    if (!q) return indices;
    return indices.filter((i) => navLabel(flatNav[i], t).toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <Box>
      {errorMessage && (
        <Typography variant="body2" color="error.main" fontWeight={500} sx={{ mb: 1 }}>
          {errorMessage}
        </Typography>
      )}
      <TextField
        size="small"
        fullWidth
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search sections..."
        sx={{ mb: 1.5 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
          ),
          endAdornment: search ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setSearch('')} aria-label="clear search">
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null,
        }}
      />
      <ScrollableTableContainer
        maxHeight="clamp(280px, 46vh, 460px)"
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Section</TableCell>
              <TableCell align="center">
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                  View
                  <HeaderColumnCheckbox name={name} field="canView" indices={visibleIndices} />
                </Box>
              </TableCell>
              <TableCell align="center">
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                  Add
                  <HeaderColumnCheckbox name={name} field="canAdd" indices={visibleIndices} />
                </Box>
              </TableCell>
              <TableCell align="center">
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                  Edit
                  <HeaderColumnCheckbox name={name} field="canEdit" indices={visibleIndices} />
                </Box>
              </TableCell>
              <TableCell align="center">
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                  Delete
                  <HeaderColumnCheckbox name={name} field="canDelete" indices={visibleIndices} />
                </Box>
              </TableCell>
              <TableCell align="center">
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                  Cancel
                  <HeaderColumnCheckbox name={name} field="canCancel" indices={visibleIndices} />
                </Box>
              </TableCell>
              <TableCell align="center">Notification</TableCell>
              <TableCell align="center">
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                  All
                  <HeaderAllCheckbox name={name} indices={visibleIndices} />
                </Box>
              </TableCell>
              <TableCell align="center">Columns</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleIndices.map((i) => {
              const node = flatNav[i];
              const label = navLabel(node, t);
              const depth = node.trail.length - 1;
              const viewOnly = isViewOnly(node);
              const baseName = `${name}.${i}`;
              return (
                <TableRow key={node.key} hover>
                  <TableCell sx={{ pl: 2 + depth * 2.5 }}>
                    <Typography variant="body2" fontWeight={node.isParent ? 700 : 400}>
                      {label}
                    </Typography>
                  </TableCell>
                  <TableCell align="center"><ActionCheckbox name={`${baseName}.canView`} /></TableCell>
                  <TableCell align="center"><ActionCheckbox name={`${baseName}.canAdd`} disabled={viewOnly} /></TableCell>
                  <TableCell align="center"><ActionCheckbox name={`${baseName}.canEdit`} disabled={viewOnly} /></TableCell>
                  <TableCell align="center">
                    <DeleteActionCheckbox
                      name={`${baseName}.canDelete`}
                      viewOnly={viewOnly}
                      scoped={isDeleteScopedMenu(node.key)}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <CancelCheckbox name={`${baseName}.canCancel`} menuKey={node.key} />
                  </TableCell>
                  <TableCell align="center">
                    <NotificationCheckbox name={`${baseName}.canNotify`} menuKey={node.key} adminTarget={adminTarget} />
                  </TableCell>
                  <TableCell align="center"><AllCheckbox baseName={baseName} viewOnly={viewOnly} menuKey={node.key} /></TableCell>
                  <TableCell align="center">
                    {REPORT_COLUMN_OPTIONS[node.key]
                      ? <ColumnAccessButton baseName={baseName} menuKey={node.key} />
                      : <Typography variant="body2" color="text.disabled" component="span">—</Typography>}
                  </TableCell>
                </TableRow>
              );
            })}
            {visibleIndices.length === 0 && (
              <TableRow>
                <TableCell colSpan={9}>
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                    No sections match your search
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollableTableContainer>
    </Box>
  );
}
