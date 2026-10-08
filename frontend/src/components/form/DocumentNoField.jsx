import React, { useEffect, useRef, useState } from 'react';
import { InputAdornment, CircularProgress } from '@mui/material';
import { useFormContext } from 'react-hook-form';
import FormTextField from './FormTextField';
import { usePeekDocumentNumberMutation } from '../../features/company/companyDetailsApi';
import { useNotify } from '../feedback/NotificationProvider';

// Shared "No." field for every create form backed by the numbering-series
// engine (PO, GRN, PI, ENQ, PQ, SQ, SO, DC, SI, SRC, SIG, ADJ, RV, PV, DEP,
// CHQ). On create it peeks the active series for `documentCode` purely to
// find out which mode it's in, then behaves like one of two entirely
// different fields depending on that series' Auto Generate / Manual Entry
// switches (documentNumberingSeries — Company Setup > Document Numbering):
//   - Auto Generate on (Manual Entry off, the normal/default case): the
//     series' next number is fetched and filled in automatically, and the
//     field is locked -- disabled on the MUI TextField only (never on the
//     Controller/RHF field), so the value still submits, same pattern
//     already used for the other auto-filled/disabled fields on these forms
//     (e.g. Contact Person on PurchaseOrder.jsx). Nothing is left for the
//     user to type.
//   - Manual Entry on (Auto Generate off): nothing is auto-generated at
//     all -- the field is left blank and fully editable so the user types
//     the number themselves, saved verbatim (see validateManualNumber in
//     backend/src/services/documentNumberService.js) -- Manual Entry means
//     genuinely free-form, not "must still fit this series' own pattern".
//     The typed value is still matched against the series pattern purely to
//     keep that series' own running counter in step when it happens to look
//     like one of its own numbers; a value that doesn't is simply not
//     tracked as unnumbered by the series, but always still saves.
//   - peek fails (e.g. no series defined for this FY): the error is
//     surfaced via the shared notify() toast and the field is left enabled
//     and blank as a fallback so the user isn't blocked -- typing a number
//     when Manual Entry is actually off is rejected server-side on save
//     with a clear message, which is the correct fallback.
// On edit/view (isCreate=false) this never peeks and behaves like a plain
// FormTextField, so an existing document's saved number is never touched.
//
// seriesId pinning (opt-in via `emitsSeriesId`): peek's response also names
// the exact series row it resolved (res.seriesId) -- the SAME resolveSeries()
// the save transaction will call. When a caller passes `emitsSeriesId`, that
// id is stashed into a sibling form field, `${name}SeriesId` (e.g.
// documentNumberSeriesId), purely so the page's own submit handler can
// forward it back to the save endpoint as `seriesId`. Without this, a create
// form that never passes seriesId lets the server re-derive "the document
// type's default series" from scratch at save time -- ordinarily the same
// row peek saw, but not always: an admin can repoint which series is
// default, or edit the series a form has already peeked, while the user is
// still filling in a long document. When that happens the save silently
// validates/allocates against a DIFFERENT series than the one previewed,
// which is exactly what produces a manual-entry "must match the series
// pattern X" rejection that looks identical to what was typed -- X was
// built from a series that isn't the one actually being validated against.
// Pinning seriesId turns that class of bug into resolveSeries's existing,
// already-tested rejection (SERIES_NOT_FOUND/SERIES_WRONG_FY/etc., see
// seriesSelection.test.js) instead of a silent, confusing mismatch. This
// covers BOTH Auto Generate and Manual Entry series -- it only changes which
// series a save is pinned to, never whether the auto-generate path still
// ignores the typed value (it still does, see resolveDocumentNumber).
//
// `emitsSeriesId` defaults to false and is opt-in per caller (currently only
// BPOpeningBalance.jsx) rather than always-on for every one of this
// component's ~16 other callers (PO, GRN, PI, ENQ, PQ, SQ, SO, DC, SI, SRC,
// SIG, ADJ, RV, PV, DEP, CHQ): those forms' own Zod schemas were never
// audited for this change, and an extra field silently added to values
// submitted by a `.strict()` schema (if one exists among them) would break
// saves that have nothing to do with this fix. Opting a form in also means
// adding `documentNumberSeriesId` to its own Zod schema the same way
// partnerSchemas.js's businessPartnerOpeningBalanceDocumentSchema now does --
// z.object() silently strips unrecognised keys, so the field vanishes again
// before handleSubmit ever sees it if the schema doesn't declare it.
export default function DocumentNoField({
  documentCode, name, label, isCreate, placeholder, emitsSeriesId = false, ...rest
}) {
  const { setValue } = useFormContext();
  const notify = useNotify();
  const [peekDocumentNumber] = usePeekDocumentNumberMutation();
  const [state, setState] = useState({ loading: false, manualEntry: true });
  const requested = useRef(false);

  useEffect(() => {
    if (!isCreate || requested.current) return;
    requested.current = true;
    setState({ loading: true, manualEntry: true });
    peekDocumentNumber({ documentCode })
      .unwrap()
      .then((res) => {
        const manualEntry = !!res?.series?.manualEntry;
        // Only Auto Generate series get a value put in the field -- Manual
        // Entry means the system generates nothing and the user types the
        // whole number themselves.
        if (!manualEntry) setValue(name, res?.documentNumber || '', { shouldValidate: true });
        // Pin the series peek actually resolved -- see the doc comment above.
        // shouldValidate: false because this is a plumbing field with no
        // validation rules of its own; it must never block submit.
        if (emitsSeriesId) setValue(`${name}SeriesId`, res?.seriesId ?? null, { shouldValidate: false });
        setState({ loading: false, manualEntry });
      })
      .catch((err) => {
        notify.error(err?.data?.message || 'Could not generate document number');
        setState({ loading: false, manualEntry: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreate, documentCode]);

  const locked = isCreate && (state.loading || !state.manualEntry);

  return (
    <FormTextField
      name={name}
      label={label}
      placeholder={state.loading ? 'Generating…' : (state.manualEntry ? 'Enter document number' : placeholder)}
      disabled={locked}
      InputProps={state.loading ? {
        endAdornment: (
          <InputAdornment position="end">
            <CircularProgress size={16} />
          </InputAdornment>
        ),
      } : undefined}
      {...rest}
    />
  );
}

// Peeks the next number for `documentCode` outside of a mounted form --
// used by "Duplicate"/"Clone as new draft" shortcuts that build a payload
// and submit it directly without ever opening the create form UI. Falls
// back to '' (letting the server auto-allocate on save) if the peek fails,
// and surfaces the failure via notify() rather than blocking the duplicate.
export async function peekNextDocumentNumber(peekDocumentNumber, documentCode, notify) {
  try {
    const res = await peekDocumentNumber({ documentCode }).unwrap();
    return res?.documentNumber || '';
  } catch (err) {
    notify.error(err?.data?.message || 'Could not generate document number');
    return '';
  }
}
