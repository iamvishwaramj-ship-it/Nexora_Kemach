import React, { useEffect, useRef, useState } from 'react';
import { Box, InputAdornment, CircularProgress, Typography } from '@mui/material';
import { useFormContext, useWatch } from 'react-hook-form';
import FormTextField from './FormTextField';
import FormSelect from './FormSelect';
import { useListSeriesForDocumentQuery, usePeekDocumentNumberMutation } from '../../features/company/companyDetailsApi';
import { useNotify } from '../feedback/NotificationProvider';

// Split "No." field for every document backed by the numbering-series
// engine that lets the user choose among more than one series on the form
// itself: a series picker plus the number it generates, side by side in one
// row — see the mockup in the numbering-series spec (a "SQ - Sales
// Quotation"-style select on the left, the generated number on the right).
// Originally built for Sales Quotation/Invoice, then rolled out to every
// other Sales/Purchase transaction, and now the Inventory (Stock Receipt,
// Issue, Adjustment, Transfer) and Banking/Receivables/Payables (Receipt
// Voucher, Payment Voucher, Payment Receipt, Outgoing Payment, Bank
// Deposit, Cheque) documents too. Replaces DocumentNoField wherever a page
// needs it; every other numbered document still gets DocumentNoField's
// single locked/editable field.
//
// Props:
//   documentCode     catalog code, e.g. 'SQ' or 'SRC'
//   seriesFieldName  RHF field the chosen series id is written to (default 'seriesId')
//   numberFieldName  RHF field the generated/typed document number is written to
//   isCreate         false on edit/view: renders the plain saved number, no
//                     picker, and never peeks — an already-issued number must
//                     never be silently touched.
//   disabled         forces the number field disabled regardless of state
//                     (e.g. a read-only view rendered through this same path)
//   label            optional caption rendered once above the control(s).
//                     Most pages wrap this field in <LabeledField label="…">
//                     and leave this unset (label-less controls inside, same
//                     as StockReceipt/SalesQuotation etc). A few pages
//                     (PaymentEntry/PV, CollectionEntry/RV) instead pass
//                     label="Reference No." straight to what used to be
//                     DocumentNoField inside a bare FormGrid cell with no
//                     LabeledField wrapper — for those, pass label here so
//                     the caption survives the split into two controls, in
//                     both the edit/view branch and the create branch.
export default function DocumentSeriesNoField({
  documentCode, seriesFieldName = 'seriesId', numberFieldName, isCreate, disabled, label,
}) {
  if (!isCreate) {
    // Edit/View: plain saved number, no series select, never peeked.
    return (
      <>
        {label ? <FieldCaption>{label}</FieldCaption> : null}
        <FormTextField name={numberFieldName} label="" disabled fullWidth />
      </>
    );
  }
  return (
    <CreateSeriesNoField
      documentCode={documentCode}
      seriesFieldName={seriesFieldName}
      numberFieldName={numberFieldName}
      disabled={disabled}
      label={label}
    />
  );
}

// A plain caption above the select+number row, for the handful of pages
// that don't already wrap this field in LabeledField's own label column.
// Kept intentionally simple (no required-asterisk handling, no fixed
// column width) since it only ever renders the exact string the page passes
// — LabeledField's FieldLabel is for the label-left grid layout these pages
// don't use.
function FieldCaption({ children }) {
  return (
    <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 600, color: 'text.secondary' }}>
      {children}
    </Typography>
  );
}

function CreateSeriesNoField({ documentCode, seriesFieldName, numberFieldName, disabled, label }) {
  const { setValue, control } = useFormContext();
  const notify = useNotify();
  const [peekDocumentNumber] = usePeekDocumentNumberMutation();
  const { data, isFetching: seriesLoading } = useListSeriesForDocumentQuery({ documentCode });
  const selectedSeriesId = useWatch({ control, name: seriesFieldName });

  const [state, setState] = useState({ loading: false, manualEntry: false });
  // Tracks which seriesId the in-flight peek was fired for, so a response
  // that arrives after the user has already switched series again is
  // dropped instead of overwriting the newer selection's number.
  const inFlightSeriesId = useRef(null);
  const defaultApplied = useRef(false);

  // Series that can actually issue a number here: Active, not Exhausted, and
  // either Auto Generate (the number field fills and locks) or Manual Entry
  // (the number field stays editable/blank) — a series with neither switch
  // on can't produce anything and is left off the list entirely.
  const selectable = (data?.series || []).filter(
    (s) => s.status === 'Active' && !s.isExhausted && (s.autoGenerate || s.manualEntry)
  );

  const options = selectable.map((s) => ({
    label: `${s.seriesName}${s.prefix ? ` - ${s.prefix}` : ''}`,
    value: s.id,
  }));

  // Default selection once the series list arrives: the one flagged
  // isDefault, else the first eligible one. Runs once — after that, the
  // user's own choice (or the value carried in from a re-render) stands.
  useEffect(() => {
    if (defaultApplied.current || !selectable.length) return;
    defaultApplied.current = true;
    const def = selectable.find((s) => s.isDefault) || selectable[0];
    setValue(seriesFieldName, def.id, { shouldValidate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectable.length]);

  // Peek on mount and on every series change.
  useEffect(() => {
    if (selectedSeriesId == null) return;
    const series = selectable.find((s) => s.id === selectedSeriesId);
    if (!series) return;

    if (series.manualEntry) {
      // Manual Entry series: nothing is auto-generated — leave the number
      // blank and editable, same as DocumentNoField's manual-entry mode.
      inFlightSeriesId.current = null;
      setState({ loading: false, manualEntry: true });
      setValue(numberFieldName, '', { shouldValidate: true });
      return;
    }

    inFlightSeriesId.current = selectedSeriesId;
    setState({ loading: true, manualEntry: false });
    peekDocumentNumber({ documentCode, seriesId: selectedSeriesId })
      .unwrap()
      .then((res) => {
        if (inFlightSeriesId.current !== selectedSeriesId) return; // stale
        setValue(numberFieldName, res?.documentNumber || '', { shouldValidate: true });
        setState({ loading: false, manualEntry: false });
      })
      .catch((err) => {
        if (inFlightSeriesId.current !== selectedSeriesId) return; // stale
        notify.error(err?.data?.message || 'Could not generate document number');
        // Fallback: leave the number enabled and blank so the user isn't
        // blocked, same fallback DocumentNoField uses on a peek failure.
        setState({ loading: false, manualEntry: true });
        setValue(numberFieldName, '', { shouldValidate: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeriesId, documentCode]);

  const numberLocked = disabled || state.loading || !state.manualEntry;
  // Only one eligible series: still render the select (disabled) rather than
  // swap in a different layout for a single edge case — lighter to reason
  // about than a second read-only-text rendering path just for this.
  const selectDisabled = disabled || seriesLoading || options.length <= 1;

  return (
    <>
      {label ? <FieldCaption>{label}</FieldCaption> : null}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Box sx={{ flex: '1 1 55%', minWidth: 0 }}>
          <FormSelect
            name={seriesFieldName}
            label=""
            options={options}
            disabled={selectDisabled}
            fullWidth
          />
        </Box>
        <Box sx={{ flex: '1 1 45%', minWidth: 0 }}>
          <FormTextField
            name={numberFieldName}
            label=""
            placeholder={state.loading ? 'Generating…' : (state.manualEntry ? 'Enter document number' : '')}
            disabled={numberLocked}
            fullWidth
            InputProps={state.loading ? {
              endAdornment: (
                <InputAdornment position="end">
                  <CircularProgress size={16} />
                </InputAdornment>
              ),
            } : undefined}
          />
        </Box>
      </Box>
    </>
  );
}
