import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import dayjs from 'dayjs';
import { useFormReadOnly } from './AppForm';

// Stores time as a formatted "hh:mm A" string (e.g. "09:00 AM") rather than
// a full Date — these are daily operating-hours fields, not timestamps, so
// there's no date/timezone to round-trip.
export default function FormTimePicker({ name, label, fullWidth = true, size = 'small', ...rest }) {
  const readOnly = useFormReadOnly();
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <TimePicker
          label={label}
          value={field.value ? dayjs(field.value, 'hh:mm A') : null}
          onChange={(newValue) => field.onChange(newValue && newValue.isValid() ? newValue.format('hh:mm A') : '')}
          slotProps={{
            textField: {
              fullWidth,
              size,
              error: !!error,
              helperText: error?.message || ' ',
              FormHelperTextProps: { sx: { mx: 0, mt: 0.25, minHeight: '1.1em', lineHeight: 1.3 } },
              onBlur: field.onBlur,
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
