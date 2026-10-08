import React, { useCallback, useEffect, useRef } from 'react';
import { useFormContext } from 'react-hook-form';
import { useConfirm } from '../feedback/ConfirmationDialog';

// Guards a create/edit form dialog against losing work: once the user has
// actually edited a field, closing the dialog by any route (Cancel, the X,
// Esc) asks for confirmation first, and a stray backdrop click is ignored
// outright.
//
// Two pieces, because the thing that knows the form is dirty (react-hook-form,
// inside AppForm) and the thing that closes the dialog (the page, outside
// AppForm) sit on opposite sides of that boundary:
//   - useUnsavedChangesGuard() lives in the page and owns the close handlers.
//   - <FormDirtyTracker /> is rendered anywhere inside the AppForm and reports
//     the first genuine user edit back up via the setDirty it's handed.
//
// Usage:
//   const closeForm = () => { setDialogOpen(false); setEditingRow(null); };
//   const { requestClose, forceClose, setDirty, dialogCloseProps } =
//     useUnsavedChangesGuard(closeForm);
//   ...
//   <Dialog open={dialogOpen} {...dialogCloseProps}>
//     <IconButton onClick={requestClose}>...   // the X
//     <AppForm ...>{() => (<><FormDirtyTracker onDirtyChange={setDirty} /> ...
//     <Button onClick={requestClose}>Cancel</Button>
//   and on a successful save, call forceClose() instead of closeForm().

const DEFAULT_CONFIRM = {
  title: 'Discard unsaved changes?',
  message:
    'You have entered details that have not been saved yet. If you close this form now, those changes will be lost.',
  confirmLabel: 'Discard changes',
  cancelLabel: 'Keep editing',
  severity: 'error',
};

export function useUnsavedChangesGuard(close, confirmOptions) {
  const confirm = useConfirm();

  // A ref, not state: nothing here needs to re-render the page, and the close
  // handlers below must read the value at the moment they run rather than
  // whatever was captured when they were created.
  const dirtyRef = useRef(false);

  const setDirty = useCallback((value) => {
    dirtyRef.current = value;
  }, []);

  // Blurs whatever currently has focus, if anything, right before the dialog
  // starts closing. Without this, the element the user just clicked (the "X",
  // Cancel/Close, or a field inside the form) is still focused at the instant
  // MUI's Modal marks its root aria-hidden="true" for the exit transition —
  // a descendant of an aria-hidden subtree retaining focus, which Chrome logs
  // as "Blocked aria-hidden on an element because its descendant retained
  // focus" and which also leaves keyboard/AT navigation stuck on a
  // now-hidden element until something else steals focus. Moving focus away
  // first (MUI's own focus-restore then lands it back on the row's
  // View/Edit button, same as before) avoids the whole class of bug for
  // every dialog built on this hook, not just one screen's.
  const blurActiveElement = () => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body) {
      active.blur();
    }
  };

  // Close without asking, and clear the flag — for the save path, where the
  // changes are not being lost at all. The flag has to be cleared explicitly
  // because the same dialog may be reopened before anything remounts.
  const forceClose = useCallback(() => {
    dirtyRef.current = false;
    blurActiveElement();
    close();
  }, [close]);

  // Doubles as an onClick handler (event only, reason undefined) and as MUI
  // Dialog's onClose (event, reason) — hence the two-argument shape.
  const requestClose = useCallback(
    async (_event, reason) => {
      // A misclick outside the dialog is the cheapest way to lose a
      // half-filled form, so on a dirty form it does nothing at all rather
      // than throwing up a confirmation the user never asked to see. An
      // untouched form still closes on backdrop click as normal.
      if (reason === 'backdropClick' && dirtyRef.current) return;

      if (dirtyRef.current) {
        const ok = await confirm({ ...DEFAULT_CONFIRM, ...confirmOptions });
        if (!ok) return;
      }
      dirtyRef.current = false;
      blurActiveElement();
      close();
    },
    // confirmOptions is normally an inline object literal; depending on its
    // identity would rebuild this callback every render for no benefit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [confirm, close]
  );

  return {
    requestClose,
    forceClose,
    setDirty,
    // Spread onto <Dialog> so Esc and backdrop both route through the guard.
    dialogCloseProps: { onClose: requestClose },
  };
}

// Reports the first real user edit up to the guard. Render it inside an
// AppForm (it draws nothing).
//
// Deliberately does NOT use react-hook-form's own formState.isDirty. That flag
// counts any change to the values, including programmatic ones — and several
// of these forms auto-fill a field on mount (DocumentNoField writes the next
// document number via setValue as soon as an Add dialog opens). isDirty would
// therefore be true on a brand-new, untouched form, and the user would be
// warned about "unsaved changes" they never made, on every single cancel.
//
// The watch subscription's `type` separates the two cases: RHF reports 'change'
// only for edits that came from a field's own onChange — a real keystroke or a
// selection — and leaves it undefined for setValue/reset. So this fires on what
// the user did and stays quiet for what the form did to itself.
export function FormDirtyTracker({ onDirtyChange }) {
  const { watch } = useFormContext();

  useEffect(() => {
    // Reset on mount: the dialog remounts its form each time it opens (MUI
    // unmounts a closed Modal's children), so this is what clears the flag
    // left behind by a previous, discarded edit.
    onDirtyChange(false);

    const subscription = watch((_values, { type }) => {
      if (type === 'change') onDirtyChange(true);
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch]);

  return null;
}

export default useUnsavedChangesGuard;
