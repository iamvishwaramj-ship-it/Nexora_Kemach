// Applies a failed save's server response to the form, so the offending
// field(s) go red exactly like a client-side Zod failure would — in
// addition to, never instead of, the toast every page already shows.
//
// The backend tags some validation failures with a structured
// `errors: [{ field, message }]` array (see badRequest() in
// backend/src/routes/company.js and the errorHandler middleware that
// forwards it), specifically so a form can highlight the input the problem
// actually belongs to instead of leaving the user to guess from a toast
// alone. When present, each one is applied via RHF's setError, which lands
// in the same `formState.errors` a client-side Zod failure would — so
// FormTextField/FormSelect's existing `error={!!error}` styling picks it up
// automatically, no extra wiring needed per field.
//
// Most failures today are still untagged (a generic string message, or a
// Prisma unique-constraint message with no field attached) — those still
// only ever surface as the toast, same as before. Call this from every
// save's catch block and pass its return value straight to notify.error();
// it's a no-op pass-through when there's nothing field-specific to apply.
export function applyServerErrors(err, setError, fallback = 'Save failed') {
  const errors = err?.data?.errors;
  if (Array.isArray(errors) && typeof setError === 'function') {
    errors.forEach((e) => {
      if (e?.field) setError(e.field, { type: 'server', message: e.message });
    });
  }
  return err?.data?.message || fallback;
}
