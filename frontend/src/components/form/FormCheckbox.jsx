import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { FormControlLabel, Checkbox, Switch } from '@mui/material';
import { useFormReadOnly } from './AppForm';

// `disabled` is OR'd with the form's read-only state rather than replacing it:
// a caller disabling one box (because the value is pinned by something outside
// the form — see ProductUsageFlags) must not be able to re-enable it inside a
// read-only form by passing false.
// `compact` shrinks the Checkbox's default ~42px touch target (padding: 9px)
// and FormControlLabel's own -11px/16px margins down to almost nothing —
// opt-in only, so every existing caller keeps the normal comfortable hit
// area. Added for DocumentTotalsPanel's Road Tax row: sitting a full-size
// checkbox next to a single line of totals text made that one row visibly
// taller than every other row in the panel, reading as a stray gap above and
// below it even though the Stack's own spacing was uniform throughout.
export function FormCheckbox({ name, label, disabled = false, compact = false }) {
  const readOnly = useFormReadOnly();
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <FormControlLabel
          sx={compact ? { m: 0 } : undefined}
          control={(
            <Checkbox
              {...field}
              checked={!!field.value}
              disabled={readOnly || disabled}
              size={compact ? 'small' : 'medium'}
              sx={compact ? { p: 0.5 } : undefined}
            />
          )}
          label={label}
        />
      )}
    />
  );
}

export function FormSwitch({ name, label }) {
  const readOnly = useFormReadOnly();
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <FormControlLabel control={<Switch {...field} checked={!!field.value} disabled={readOnly} />} label={label} />
      )}
    />
  );
}
