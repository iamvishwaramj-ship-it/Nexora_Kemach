import React, { useMemo } from 'react';
import { Autocomplete, TextField } from '@mui/material';

/**
 * A list-page filter dropdown that always shows a concrete selection.
 *
 * These filters are "unset means everything" by nature, and they used to say
 * so with a grey placeholder — the field looked empty while the list was
 * unfiltered, which reads as *nothing chosen yet* rather than *all of them*.
 * Clearing one with the Autocomplete's × left the same ambiguous blank.
 *
 * Here "All ..." is a real option that is genuinely selected, so the control
 * always states what the list is doing. The × is removed because it has
 * nothing left to do: picking All is the cleared state.
 *
 * The value contract with the caller is unchanged — null still means no
 * filter — so the surrounding `!filter || row.field === filter.value`
 * matching keeps working untouched.
 *
 * @param {string} allLabel    e.g. "All Customers"
 * @param {object|null} value  the selected option, or null for All
 * @param {(next: object|null) => void} onChange
 */
export default function FilterAutocomplete({
  options = [], value, onChange, label, allLabel, size = 'small', ...rest
}) {
  const allOption = useMemo(() => ({ label: allLabel, value: '' }), [allLabel]);
  const withAll = useMemo(() => [allOption, ...options], [allOption, options]);

  return (
    <Autocomplete
      size={size}
      options={withAll}
      value={value ?? allOption}
      onChange={(_e, next) => onChange(next && next.value !== '' ? next : null)}
      getOptionLabel={(o) => o.label || ''}
      isOptionEqualToValue={(o, v) => o.value === v.value}
      disableClearable
      renderInput={(params) => (
        <TextField {...params} label={label} InputLabelProps={{ ...params.InputLabelProps, shrink: true }} />
      )}
      {...rest}
    />
  );
}
