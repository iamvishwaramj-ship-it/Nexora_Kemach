import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TextField } from '@mui/material';
import dayjs from 'dayjs';
import { useFormReadOnly } from './AppForm';

export default function FormDatePicker({
  name, label, fullWidth = true, size = 'small', helperText,
  // Names of other form fields that participate in a cross-field date rule
  // with this one (e.g. the dateRange() refinements in purchaseSchemas /
  // salesSchemas / receivablesPayablesSchemas -- Order Date <-> Delivery
  // Date, Document Date <-> Due Date, ...). RHF only re-runs a field's own
  // validation when *that* field changes or is touched -- so picking a new
  // Order Date after Delivery Date was already touched and flagged invalid
  // left the stale Delivery Date error on screen until the user visited it
  // again. Passing the paired field name(s) here re-validates them the
  // moment this picker changes, so the other side of the pair clears (or
  // shows) its error immediately instead of waiting for its own blur.
  triggerFields,
  ...rest
}) {
  const readOnly = useFormReadOnly();
  const { control, trigger } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <DatePicker
          label={label}
          value={field.value ? dayjs(field.value) : null}
          onChange={(newValue) => {
            if (!newValue || !newValue.isValid()) {
              field.onChange(null);
              return;
            }
            // Store the selected calendar day as a UTC-midnight Date instead of
            // newValue.toDate() (which bakes in the local wall-clock time as the
            // UTC instant). Without this, selecting a date in any timezone ahead
            // of UTC (e.g. IST, +5:30) produces an instant that falls on the
            // *previous* UTC day, so once serialized to JSON/ISO and stored as a
            // date-only value on the backend, the record ends up one day earlier
            // than what was picked.
            field.onChange(new Date(Date.UTC(newValue.year(), newValue.month(), newValue.date())));
            if (triggerFields) trigger(triggerFields);
          }}
          slotProps={{
            textField: {
              fullWidth,
              size,
              error: !!error,
              helperText: error?.message || helperText || ' ',
              FormHelperTextProps: { sx: { mx: 0, mt: 0.25, minHeight: '1.1em', lineHeight: 1.3 } },
              onBlur: (e) => {
                field.onBlur(e);
                if (triggerFields) trigger(triggerFields);
              },
            },
          }}
          {...rest}
          // A read-only form disables its fields; an explicit
          // disabled still applies while editing.
          disabled={readOnly || rest.disabled}
        />
      )}
    />
  );
}
