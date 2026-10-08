import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useFormReadOnly } from './AppForm';
import {
  FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, FormHelperText,
} from '@mui/material';

// RHF-bound radio group, for the small mutually-exclusive choices a <select>
// would over-complicate (two or three options the user should see at a
// glance). Same contract as FormSelect: options are [{ label, value }] and the
// value written to the form is the option's `value`, not its label.
//
// The always-rendered helper text (a space when there's no error) keeps the
// field's height stable, so the fields below it don't jump when an error
// appears — matching FormSelect/FormTextField.
export default function FormRadioGroup({ name, label, options = [], row = true }) {
  const readOnly = useFormReadOnly();
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <FormControl component="fieldset" error={!!error} fullWidth>
          {label && (
            <FormLabel component="legend" sx={{ fontSize: 13, mb: 0.25 }}>
              {label}
            </FormLabel>
          )}
          <RadioGroup
            row={row}
            name={field.name}
            // null/undefined must become '' or MUI treats the group as
            // uncontrolled and warns on the first selection.
            value={field.value ?? ''}
            onChange={(e) => field.onChange(e.target.value)}
            onBlur={field.onBlur}
          >
            {options.map((o) => (
              <FormControlLabel
                key={o.value}
                value={o.value}
                control={<Radio size="small" />}
                label={o.label}
                // An option can be greyed out individually — for a choice that
                // is legal in general but not for this particular record (e.g.
                // a Title account with sub-accounts can't become a posting
                // account). Showing it disabled explains the constraint;
                // hiding it would just make the option look missing.
                disabled={readOnly || Boolean(o.disabled)}
                slotProps={{ typography: { variant: 'body2' } }}
              />
            ))}
          </RadioGroup>
          <FormHelperText sx={{ mx: 0, mt: 0, minHeight: '1.1em', lineHeight: 1.3 }}>
            {error?.message || ' '}
          </FormHelperText>
        </FormControl>
      )}
    />
  );
}
