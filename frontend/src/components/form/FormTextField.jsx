import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { TextField } from '@mui/material';
import { useFormReadOnly } from './AppForm';

// Suppresses the browser's native up/down spin buttons on a number input.
// Exported so the handful of screens that use a bare MUI <TextField
// type="number"> (report filters, table Min/Max filters) look identical to
// every FormTextField, which hides them by default — see `showSpinners`.
export const noSpinnersSx = {
  '& input[type=number]': { MozAppearance: 'textfield' },
  '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
  '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
};

// Every text-like input wraps RHF's Controller and reads errors off the
// shared Zod schema automatically — never validate manually in a submit handler.
export default function FormTextField({
  name, label, type = 'text', multiline, rows, fullWidth = true, size = 'small',
  digitsOnly = false, maxLength, inputProps, helperText,
  // Every numeric field in this app (quantity, price, rate, discount...) is
  // validated non-negative by its Zod schema (nonNegativeNumber/
  // currencyAmount/quantity in lib/validation/common.js) — but until now
  // nothing stopped the browser's native number input from happily letting
  // someone type a leading "-" (or "e" for scientific notation) and only
  // finding out it's rejected after submit. Blocking those keys at the
  // input is what actually keeps a qty field from *going* negative instead
  // of just refusing to save once it already has. Set allowNegative on the
  // rare field that's a genuine signed value (there are none in this app
  // today, but the escape hatch costs nothing to keep open).
  allowNegative = false,
  // Numeric fields render as a plain input everywhere in this app — no
  // up/down stepper. Nobody nudges a quantity or a rupee amount one unit at a
  // time, the arrows eat horizontal space the value itself needs (an 8-digit
  // figure was being clipped by them in the document line grids), and a stray
  // scroll over a focused field silently changes the number, which is how a
  // wrong quantity reaches a ledger. The input stays type="number", so the
  // mobile numeric keypad and the sign/exponent blocking below still apply —
  // only the arrows go away. Opt back in per-field with showSpinners.
  showSpinners = false,
  // By default every field reserves a fixed line of space below it for its
  // helper/validation text (a literal ' ' is rendered there when there's
  // nothing to say) so a row of fields lines up the same whether one of them
  // is showing an error or not. Set false to skip that reservation instead:
  // the field takes only the height its input needs, and the validation
  // message's own line only appears — pushing whatever is below it down —
  // once there actually is one. Meant for dense, spreadsheet-style grids
  // (e.g. Journal Lines) where the row itself supplies the alignment and a
  // permanently blank strip under every cell just adds height.
  reserveHelperSpace = true,
  // Called after the field's own change with (newValue, previousValue) — lets a
  // screen react to typing (e.g. Journal Lines mirroring debit <-> credit)
  // without replacing the field's own onChange.
  onValueChange,
  sx,
  ...rest
}) {
  const readOnly = useFormReadOnly();
  const spinnerSx = type === 'number' && !showSpinners ? noSpinnersSx : null;
  // helperText is pulled out of ...rest deliberately: spreading it would
  // clobber the validation message below, silently hiding field errors on
  // any input that also wants a hint. Validation always wins; the hint
  // shows only while the field is valid.
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <TextField
          {...field}
          value={field.value ?? ''}
          type={type}
          label={label}
          fullWidth={fullWidth}
          size={size}
          multiline={multiline}
          rows={rows}
          error={!!error}
          sx={spinnerSx ? [spinnerSx, ...(Array.isArray(sx) ? sx : [sx])] : sx}
          helperText={error?.message || helperText || (reserveHelperSpace ? ' ' : undefined)}
          FormHelperTextProps={{
            sx: reserveHelperSpace
              ? { mx: 0, mt: 0.25, minHeight: '1.1em', lineHeight: 1.3 }
              // No reserved strip when empty -- the message (once there is
              // one) still renders at its natural height and pushes layout
              // below it, same as any other bit of real content appearing.
              : { mx: 0, mt: 0.25, lineHeight: 1.3 },
          }}
          inputProps={{
            ...(maxLength ? { maxLength } : {}),
            ...(digitsOnly ? { inputMode: 'numeric', pattern: '[0-9]*' } : {}),
            ...(type === 'number' && !allowNegative ? { min: 0 } : {}),
            ...inputProps,
          }}
          {...rest}
          // A read-only form disables its fields; an explicit
          // disabled still applies while editing.
          disabled={readOnly || rest.disabled}
          onWheel={(e) => {
            // The other half of removing the stepper: a number input still
            // steps on mouse wheel even with the arrows hidden, so scrolling
            // the page with the cursor resting on a focused quantity field
            // silently rewrites it. Dropping focus makes the wheel scroll the
            // page, which is what the gesture meant.
            if (spinnerSx && e.target === document.activeElement) e.target.blur();
            rest.onWheel?.(e);
          }}
          onKeyDown={(e) => {
            // Blocks the keystroke outright — stripping it in onChange still
            // lets the character flash into the field for a frame and moves
            // the caret, which reads as broken even though the value that
            // lands is correct. "-"/"+" is the sign, "e"/"E" is scientific
            // notation ("1e5") — a number input accepts both by default and
            // neither is ever a value this app's non-negative fields want.
            if (type === 'number' && !allowNegative && ['-', '+', 'e', 'E'].includes(e.key)) {
              e.preventDefault();
            }
            rest.onKeyDown?.(e);
          }}
          onChange={(e) => {
            let raw = e.target.value;
            // digitsOnly strips any non-numeric characters as they're typed (so
            // pasting/typing letters simply never appears), and maxLength trims
            // to the allowed length — used for mobile/phone numbers so users
            // can't type more than 10 digits or any alphabets.
            if (digitsOnly) raw = raw.replace(/\D/g, '');
            // Belt-and-braces for the paste path, which onKeyDown above can't
            // intercept — a pasted "-5" or "1e5" is stripped down to the
            // digits/decimal point rather than accepted verbatim.
            if (type === 'number' && !allowNegative) raw = raw.replace(/[-+eE]/g, '');
            if (maxLength) raw = raw.slice(0, maxLength);
            const nextValue = type === 'number' ? (raw === '' ? '' : Number(raw)) : raw;
            const prevValue = field.value;
            field.onChange(nextValue);
            onValueChange?.(nextValue, prevValue);
          }}
        />
      )}
    />
  );
}
