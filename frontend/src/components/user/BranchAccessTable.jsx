import React, { useEffect } from 'react';
import {
  Box, Table, TableBody, TableCell, TableHead, TableRow, IconButton, Checkbox, Button, Typography,
  Alert, AlertTitle,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { useFieldArray, useFormContext } from 'react-hook-form';
import ScrollableTableContainer from '../data-display/ScrollableTableContainer';
import FormSelect from '../form/FormSelect';
import { useFormReadOnly } from '../form/AppForm';
import { useBranchOptions } from '../../lib/useBranchOptions';

// Sentinel picked in any row's Branch dropdown to mean "every branch" —
// never a real Branch.id, so it can't collide with one. Handled entirely on
// this side: choosing it expands the array to one row per real branch (see
// handleAllBranchesSelected below) rather than being persisted itself, so
// the server/schema still only ever sees real branchIds, same as any other
// multi-row selection.
const ALL_BRANCHES_VALUE = '__all_branches__';

// One row's "Default" radio-style checkbox. Only one row may be the user's
// default branch at a time, so checking a row clears every other row's flag
// in the same click — same "exclusive default" rule Business Partner's own
// Contact Person / Address grids enforce (see applyExclusiveDefault in
// pages/businessPartner/BusinessPartner.jsx), just applied live via setValue
// instead of on a separate dialog's Save.
function DefaultCheckbox({ name, index, fields }) {
  const readOnly = useFormReadOnly();
  const { watch, setValue } = useFormContext();
  const checked = !!watch(`${name}.${index}.isDefault`);

  const handleChange = (e) => {
    const next = e.target.checked;
    // Unchecking the current default with nothing else to promote would
    // leave the user with no default branch at all -- not a valid state,
    // so the box simply won't uncheck itself; pick a different row's
    // Default instead to move it.
    if (!next) return;
    fields.forEach((_, i) => {
      setValue(`${name}.${i}.isDefault`, i === index, { shouldDirty: true, shouldValidate: true });
    });
  };

  return <Checkbox size="small" checked={checked} disabled={readOnly} onChange={handleChange} />;
}

/**
 * Branch Access tab of the New/Edit User dialog — a useFieldArray-backed
 * table (same row-table shape as SalesOrder.jsx's Item Details grid) letting
 * an admin grant a user access to one or more branches and mark exactly one
 * of them the default. Bind it to a form field (default name "branches").
 *
 * `unrestricted` — pass true for a role that is never branch-scoped at all
 * (today: Admin, see UserManagement.jsx). The per-branch grid is the wrong
 * control for such a user: backend/src/utils/branchScope.js returns a null
 * scope the moment role === 'admin', and useBranchOptions likewise skips its
 * filtering for one, so whatever rows the grid collects are simply never
 * consulted when deciding what an Admin may see. Rendering the grid anyway
 * told the operator the exact opposite of the truth — that they were picking
 * which branches an Admin could reach — so this mode replaces it with a
 * plain statement of the real rule plus the one field that still means
 * something: which branch is recorded as that user's default.
 *
 * `showAllOption` — pass true for a role that CAN be branch-restricted but
 * may also be granted every branch in one pick (today: Staff, per
 * UserManagement.jsx). Unlike `unrestricted` (Admin), this role still keeps
 * the normal per-row grid — the "All Branch" option offered at the top of
 * every row's dropdown just fills that grid with one row per current
 * branch, marking the first the default, instead of the operator adding
 * them one at a time. It is a real, editable snapshot of today's branches,
 * not a live "every branch including ones created later" grant the way
 * Admin's `unrestricted` is — a branch added afterwards still needs a row
 * added here, same as it would for any other Staff user.
 */
export default function BranchAccessTable({ name = 'branches', unrestricted = false, showAllOption = false }) {
  const readOnly = useFormReadOnly();
  const { control, watch, getValues, formState: { errors } } = useFormContext();
  const { fields, append, remove, replace } = useFieldArray({ control, name });
  // The admin doing the granting must see every company branch here, not
  // just their own — see useBranchOptions' restrictToUserBranches doc.
  const { options: allBranchOptions } = useBranchOptions({ restrictToUserBranches: false });

  // Selecting "All Branch" in any row expands the array to one row per real
  // branch (first one flagged default), the same shape multi-row manual
  // entry would produce — so the schema/server side (branchesSchema here,
  // routes/users.js) needs no special case for it at all.
  const handleAllBranchesSelected = () => {
    if (!allBranchOptions.length) return;
    replace(allBranchOptions.map((o, i) => ({ branchId: o.value, isDefault: i === 0 })));
  };

  // In unrestricted mode the array is collapsed to exactly one row, so what
  // the single picker below shows is precisely what gets saved — no hidden
  // extra rows surviving underneath a control that can't display them, and
  // no way for the picker to write a duplicate branch into an array it isn't
  // showing. Both schemas still require at least one row (branchesSchema
  // here, `body('branches').isArray({ min: 1 })` in routes/users.js), so one
  // row is also the minimum this can legally submit. Skipped while readOnly:
  // a View dialog saves nothing, and there is no reason for it to rewrite
  // form state at all.
  useEffect(() => {
    if (!unrestricted || readOnly) return;
    const rows = getValues(name) || [];
    if (rows.length === 1 && rows[0]?.isDefault) return;
    const keep = rows.find((r) => r?.isDefault) || rows[0] || {};
    replace([{ branchId: keep.branchId || '', isDefault: true }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unrestricted, readOnly]);

  // zodResolver puts an array-level .refine() error either directly on the
  // field or nested under `.root`, depending on resolver version — same
  // defensive check PermissionMatrix.jsx already uses for its own array field.
  const fieldError = errors?.[name];
  const errorMessage = fieldError?.message || fieldError?.root?.message;

  const selectedIds = fields.map((_, i) => String(watch(`${name}.${i}.branchId`) || ''));

  if (unrestricted) {
    // Normally 0 — the effect above has collapsed the array by now. Not so
    // in a readOnly View dialog, which deliberately leaves form state alone:
    // a user saved before this mode existed can still hold several rows
    // there, and the default is whichever one carries the flag, not row 0.
    const defaultIdx = Math.max(0, fields.findIndex((_, i) => !!watch(`${name}.${i}.isDefault`)));
    return (
      <Box>
        <Alert severity="info" sx={{ mb: 2 }}>
          <AlertTitle sx={{ fontWeight: 700, mb: 0.25 }}>All Branches</AlertTitle>
          An Admin is never branch-restricted — this user can see and post to every
          branch, including any branch created later. The branch below is recorded
          as their default only; it does not limit what they can reach.
        </Alert>
        <Box sx={{ maxWidth: 360 }}>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
            Default branch *
          </Typography>
          <FormSelect
            name={`${name}.${defaultIdx}.branchId`}
            label=""
            placeholder="Select branch"
            options={allBranchOptions}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      {errorMessage && (
        <Typography variant="body2" color="error.main" fontWeight={500} sx={{ mb: 1 }}>
          {errorMessage}
        </Typography>
      )}
      <ScrollableTableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={48}>#</TableCell>
              <TableCell>Branch Name</TableCell>
              <TableCell width={90} align="center">Default</TableCell>
              {!readOnly && <TableCell width={56} align="center">Action</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {fields.map((field, index) => {
              // A row's own current pick stays selectable even once another
              // row has taken it (matches useBranchOptions' own currentValue
              // handling) -- otherwise editing an existing row could show a
              // blank box for a branch this row itself already holds.
              const ownValue = selectedIds[index];
              const rowOptions = allBranchOptions.filter(
                (o) => o.value === ownValue || !selectedIds.includes(o.value)
              );
              // "All Branch" sits at the top of every row's list, not just
              // row 0 — a Staff user with several rows already picked can
              // still switch to full access from any of them.
              const rowOptionsWithAll = showAllOption
                ? [{ label: 'All Branch', value: ALL_BRANCHES_VALUE }, ...rowOptions]
                : rowOptions;
              return (
                <TableRow key={field.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    <FormSelect
                      name={`${name}.${index}.branchId`}
                      label=""
                      placeholder="Select branch"
                      options={rowOptionsWithAll}
                      onValueChange={(value) => {
                        if (value === ALL_BRANCHES_VALUE) handleAllBranchesSelected();
                      }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <DefaultCheckbox name={name} index={index} fields={fields} />
                  </TableCell>
                  {!readOnly && (
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => remove(index)}
                        disabled={fields.length <= 1}
                        aria-label="remove branch"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollableTableContainer>
      {!readOnly && (
        <Button
          type="button"
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          sx={{ mt: 1.5 }}
          onClick={() => append({ branchId: '', isDefault: fields.length === 0 })}
        >
          Add Branch
        </Button>
      )}
    </Box>
  );
}
