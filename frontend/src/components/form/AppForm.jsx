import React from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Box, Grid, Alert, Button, Tooltip, CircularProgress } from '@mui/material';
import { useDispatch } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { setTabDirty } from '../../store/tabsSlice';
import { useTabPath } from '../navigation/TabPathContext';

// Carries the page's Zod schema down to FormSubmitButton, separate from
// RHF's own FormProvider — see FormSubmitButton for why.
const SchemaContext = React.createContext(null);

// Set when a form is being shown for viewing rather than editing, so
// FormSubmitButton can take itself off a read-only form without every page
// having to remember to hide it.
const ReadOnlyContext = React.createContext(false);

/**
 * useFormReadOnly() — true when the surrounding AppForm was rendered with
 * `readOnly`. For the rare control that needs to opt out of a read-only form
 * itself (a Print or Export button sitting among the form's actions).
 */
export function useFormReadOnly() {
  return React.useContext(ReadOnlyContext);
}

// Reports this form's dirty state to tabsSlice, and clears it on unmount.
//
// The location subscription lives here, in a component that renders nothing,
// rather than in AppForm itself. Under KeepAliveOutlet every open tab's page
// stays mounted, and a context change propagates to consumers even through
// subtrees React would otherwise bail out of — so a useLocation() in AppForm
// meant every navigation re-rendered every open tab's entire form tree (and
// re-ran its whole render prop). Isolating it to a null-rendering leaf keeps
// the same effects with none of that cost.
//
// Which tab this form belongs to -- under the keep-alive outlet, a
// backgrounded tab's location.pathname no longer matches its own URL (it
// reflects whatever tab is currently on screen), so prefer the fixed
// per-tab path from context and only fall back to the live location for
// forms rendered outside a tab (dialogs, standalone pages).
function FormDirtyTracker({ isDirty }) {
  const dispatch = useDispatch();
  const location = useLocation();
  const tabPath = useTabPath();
  const ownerPath = tabPath || location.pathname;

  React.useEffect(() => {
    dispatch(setTabDirty({ path: ownerPath, dirty: isDirty }));
  }, [dispatch, ownerPath, isDirty]);

  // Clear this form's dirty flag if it ever unmounts outright (e.g. its tab
  // was closed and pruned from the keep-alive cache) so a stale flag can't
  // linger and block a beforeunload/close-tab prompt that no longer applies.
  React.useEffect(() => () => {
    dispatch(setTabDirty({ path: ownerPath, dirty: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

// RHF's errors object mirrors the shape of the form values — a flat field's
// error has a `.message`, but a field array (e.g. line items) nests one
// error object per row per column. Counting leaves rather than top-level
// keys means "3 fields need attention" reflects what's actually wrong
// instead of collapsing an entire items array into a single count.
function countFieldErrors(errors) {
  let count = 0;
  for (const key of Object.keys(errors || {})) {
    const err = errors[key];
    if (!err) continue;
    if (typeof err.message === 'string') count += 1;
    else if (typeof err === 'object') count += countFieldErrors(err);
  }
  return count;
}

// Wraps RHF's useForm + zodResolver so every form in the app validates via
// the shared Zod schema — never validate manually in a submit handler.
//
// A field with an error already gets red text under that one input, but
// that's easy to miss on a long form where the invalid field has scrolled
// out of view. This adds a single alert banner at the top of the form
// whenever any field is invalid — client-side (Zod) or server-side (a
// setError('field', { type: 'server', ... }) from a rejected save) both
// land in the same RHF errors object, so one banner covers both.
//
// Pass `readOnly` to show an existing record without letting it be changed:
// every control inside is disabled through a native <fieldset disabled>, the
// validation banner is suppressed (nothing on a record you're only looking at
// is actionable), and FormSubmitButton removes itself. This is what the eye
// icon in each listing table's Action column opens.
export default function AppForm({ schema, defaultValues, onSubmit, children, id, readOnly = false }) {
  const methods = useForm({
    resolver: schema ? zodResolver(schema) : undefined,
    defaultValues,
    // 'onTouched': a field is left alone (no red text) until the user
    // actually focuses it and moves away — that first blur is what triggers
    // validation and shows the error/format message (a required field, a
    // malformed phone/email/pincode, ...). Once a field has been touched
    // once, it then revalidates on every subsequent change too, so the red
    // text clears live as soon as the user fixes it instead of waiting for
    // another blur. A fresh, untouched form never lights up red on first
    // render — only fields the user has actually visited and left.
    mode: 'onTouched',
    reValidateMode: 'onBlur',
  });
  const { formState: { errors, isDirty } } = methods;
  const errorCount = countFieldErrors(errors);

  return (
    <FormProvider {...methods}>
      <ReadOnlyContext.Provider value={readOnly}>
      <SchemaContext.Provider value={schema}>
        {/* onSubmit is called with (values, methods) — the second argument
            gives every page's submit handler access to methods.setError, so
            a rejected save can turn the specific field the server complained
            about red (see lib/formErrors.js's applyServerErrors), the same
            way a client-side Zod failure already does. Pages that don't
            need it (the vast majority still just show a toast) simply
            ignore the extra argument — this is purely additive. */}
        <Box component="form" id={id} onSubmit={methods.handleSubmit((values) => onSubmit(values, methods))} noValidate>
          {errorCount > 0 && !readOnly && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorCount === 1
                ? 'One field needs your attention before this can be saved.'
                : `${errorCount} fields need your attention before this can be saved.`}
            </Alert>
          )}
          {/* Read-only is applied by FormGrid, not by a fieldset around the
              whole form. A disabled <fieldset> disables every control beneath
              it — and HTML gives no way to exempt one — so wrapping everything
              here would take the form's own Close/Cancel button down with the
              fields and trap the user in the dialog. FormGrid only ever holds
              fields, so that is the right place to draw the line. */}
          {typeof children === 'function' ? children(methods) : children}
          {/* Renders nothing. Kept last so its dirty-tracking effects still
              run after the form's children's effects, exactly as they did
              when they lived in AppForm's own body. */}
          <FormDirtyTracker isDirty={isDirty} />
        </Box>
      </SchemaContext.Provider>
      </ReadOnlyContext.Provider>
    </FormProvider>
  );
}

// Drop-in replacement for a form's plain `<Button type="submit">` that stays
// disabled until the form's current values pass its Zod schema in full — so
// Save/Update/Submit can't even be clicked while a required field is still
// empty or a format (phone/email/pincode/...) is wrong, rather than letting
// the click through and bouncing off a toast. `disabled` still composes with
// the caller's own reason to disable (e.g. `saving` while a mutation is in
// flight) — either one disables the button.
//
// Deliberately does NOT read RHF's own `formState.isValid`. That flag is
// computed lazily — it only reflects the true state once RHF has actually
// run validation, which for an untouched field doesn't happen until the
// user interacts with it. On a freshly opened "Add" form with every
// required field still blank, that leaves `isValid` reporting `true` (my
// own testing of this confirmed it) — enabling the button on precisely the
// form it should be disabling it on. Running the schema directly against
// the live watched values here is a plain, synchronous, side-effect-free
// check: accurate from the very first render, and it never touches RHF's
// `errors`/`touched` state, so it can't make an untouched field's red error
// text appear early either — that's still driven entirely by the user
// actually interacting with each field, same as before.
// Turns a Zod issue path like ['items', 2, 'uom'] into "Item 3: UoM" — a
// numeric segment right after 'items' becomes a 1-based "Item N", and every
// other segment is title-cased from camelCase. Falls back to "This form"
// for a top-level (path-less) issue rather than showing nothing.
function describeIssuePath(path) {
  if (!path || path.length === 0) return 'This form';
  const parts = [];
  for (let i = 0; i < path.length; i += 1) {
    const seg = path[i];
    if (seg === 'items' && typeof path[i + 1] === 'number') {
      parts.push(`Item ${path[i + 1] + 1}`);
      i += 1;
    } else if (typeof seg === 'string') {
      parts.push(seg.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase()));
    }
  }
  return parts.join(': ') || 'This form';
}

export function FormSubmitButton({ children, disabled, disabledReason, loading, ...rest }) {
  const schema = React.useContext(SchemaContext);
  const readOnly = React.useContext(ReadOnlyContext);
  const values = useWatch();
  // Re-running the whole schema against every watched value on EVERY render
  // is cheap for a normal form, but a master/detail document with a large
  // items array (Opening Balance after a few-hundred-row Excel import is the
  // reported case) turns this into a genuinely heavy synchronous zod walk —
  // once per keystroke, per row add, per anything else on the page that
  // re-renders. useDeferredValue lets React keep the input responsive by
  // computing this against a value that's allowed to lag a render or two
  // behind, rather than validating synchronously in the same commit as
  // every interaction. The button's disabled state still settles to the
  // same correct answer, just not necessarily on the very next paint.
  const deferredValues = React.useDeferredValue(values);
  // Nothing to submit on a form opened for viewing. Returning null here rather
  // than merely disabling keeps every page's view mode consistent without each
  // one wrapping its own save button in a condition.
  if (readOnly) return null;
  const parseResult = schema ? schema.safeParse(deferredValues) : null;
  const blockedByValidation = Boolean(schema) && !parseResult.success;
  // `loading` (a save/update mutation in flight) forces isDisabled on top of
  // the existing disabled/validation reasons, so the button can't be
  // double-clicked while the request is outstanding.
  const isDisabled = Boolean(disabled) || blockedByValidation || Boolean(loading);

  const button = (
    <Button type="submit" variant="contained" disabled={isDisabled} {...rest}>
      {loading && (
        <CircularProgress
          size={18}
          color="inherit"
          sx={{ mr: 1 }}
        />
      )}
      {children}
    </Button>
  );

  // Only explain *why* it's disabled when validation is the reason — a plain
  // `disabled` from the caller (e.g. "saving...") speaks for itself via the
  // button's own busy state and doesn't need a tooltip on top of it.
  //
  // Names the actual field(s) still failing rather than a generic "fill in
  // required fields" line — a field can fail this schema check without ever
  // showing its own red helper text (that text only appears once RHF
  // considers the field "touched"), which otherwise looks exactly like a
  // frozen, unexplained Save button. That combination is what once made the
  // Prepared By field on the Stock Transfer / Request / Receipt pages block
  // Save with no visible cause — see the comment on preparedBy in
  // inventorySchemas.js.
  if (blockedByValidation && !disabled) {
    const issues = parseResult?.error?.issues || [];
    const fieldList = Array.from(new Set(issues.slice(0, 5).map((iss) => describeIssuePath(iss.path))));
    const detail = fieldList.length
      ? `Needs attention: ${fieldList.join(', ')}${issues.length > fieldList.length ? ', …' : ''}`
      : null;
    return (
      <Tooltip title={disabledReason || detail || 'Fill in all required fields correctly before saving'} arrow>
        <span>{button}</span>
      </Tooltip>
    );
  }
  return button;
}

// Responsive field grid: `columns` fields per row on wide screens (any count,
// not just 4), collapsing down to 2 per row on tablets and 1 on mobile. Pass
// columns to control exactly how many fields share a row on desktop -- e.g.
// a filter bar with 5 fields should pass columns={5} so all 5 shrink to fit
// one line instead of wrapping to a second row.
// Set singleColumnOnMobile to stack one field per row on phones (xs) instead
// of the default two, for forms where side-by-side fields feel cramped.
//
// This is also where a read-only form is actually made read-only. A native
// disabled <fieldset> switches off every control beneath it at once — no
// per-field wiring to keep in sync, and it covers any field added later for
// free. It belongs here rather than around the whole form because a disabled
// fieldset cannot exempt anything: at form level it would also disable the
// Close/Cancel button and leave the user stuck. A grid only ever holds fields.
//
// The reset styles matter: browsers give fieldset a border, padding, and
// `min-width: min-content` — the last of which would stop the grid shrinking
// on narrow screens.
export function FormGrid({
  children, columns = 4, singleColumnOnMobile = false, spacing = { xs: 1, sm: 2 },
  // Separate row/column gap, for a caller that wants rows packed tight
  // (e.g. LabeledField's label-left layout, spacing={0}) without the
  // columns losing their gap too — with a single `spacing`, MUI's Grid
  // applies the same value on both axes, so a caller tightening the
  // vertical gap between rows was also zeroing the horizontal gap between
  // columns, and a column 1 input would butt straight up against column
  // 2's label. Both default to `spacing` so any existing caller (nobody
  // passed these before) renders identically to before.
  rowSpacing = spacing, columnSpacing = spacing,
}) {
  const readOnly = React.useContext(ReadOnlyContext);
  const xs = singleColumnOnMobile ? 12 : 6;
  const sizing = columns === 1 ? { xs: 12 } : { xs, sm: 6, md: 12 / columns };
  return (
    <Box
      component="fieldset"
      disabled={readOnly}
      sx={{ border: 0, p: 0, m: 0, minWidth: 0, width: '100%', display: 'block' }}
    >
      {/* `spacing` defaults to the historical fixed gap so every existing
          caller (nobody passes it today) renders identically to before —
          only a caller that opts in by passing its own value sees a
          different gap. */}
      <Grid container rowSpacing={rowSpacing} columnSpacing={columnSpacing}>
        {React.Children.map(children, (child) =>
          child ? (
            <Grid item {...sizing}>
              {child}
            </Grid>
          ) : null
        )}
      </Grid>
    </Box>
  );
}
