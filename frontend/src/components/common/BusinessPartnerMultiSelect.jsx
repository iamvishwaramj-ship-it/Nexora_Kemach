import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import {
  Box, TextField, InputAdornment, IconButton, Popover, List, ListItemButton, ListItemIcon,
  ListItemText, Checkbox, Chip, Stack, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

// This company's Business Partner list can run into the hundreds — with no
// cap, every keystroke re-rendered the ENTIRE matching set as real MUI
// ListItemButton/Checkbox/ListItemText components inside the popover (all
// of them, unfiltered, the moment the box gets focus with empty search
// text), which is exactly what made typing feel "dead slow": each
// character wasn't slow to filter, it was slow to re-render hundreds of
// heavyweight components synchronously. Capping how many rows ever hit the
// DOM at once — regardless of how many actually match — decouples render
// cost from the customer count entirely; narrowing the search just swaps
// which up-to-MAX_VISIBLE_OPTIONS are shown.
const MAX_VISIBLE_OPTIONS = 50;
// Keystrokes recompute the filtered/sliced list on a short delay rather
// than synchronously on every change event, so a burst of fast typing (or
// a slow first render while `options` is still arriving from
// customerApi.useList()) doesn't force a render per keystroke on top of
// the render cap above.
const SEARCH_DEBOUNCE_MS = 150;

// Reusable multi-select Business Partner picker — a search box with a
// magnifier icon that opens a checklist popover, with the current
// selection echoed as removable chips underneath ("No business partners
// selected" when empty). This is genuinely new: every other party field in
// this app (PartyCodeSelect, FormSelect with customerOptions, ...) is a
// single-value Autocomplete, and none of them render the selection as a
// standalone chip list separate from the input itself — which is what the
// Customer Aging Report's "all customers unless narrowed" filter calls for.
//
// options: [{ label, value }] — build the same way every other page sources
// customers, e.g. customerApi.useList() mapped to { label: c.customerName,
// value: c.customerName } (see CustomerOutstanding.jsx's customerOptions).
// `name` is the react-hook-form field holding the array of selected values.
export default function BusinessPartnerMultiSelect({ name, label = 'Business Partner (Customer)', options = [], placeholder = 'Select Customer' }) {
  const { control } = useFormContext();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const filteredOptions = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, debouncedSearch]);
  const visibleOptions = useMemo(
    () => filteredOptions.slice(0, MAX_VISIBLE_OPTIONS),
    [filteredOptions],
  );
  const hiddenCount = filteredOptions.length - visibleOptions.length;

  return (
    <Controller
      name={name}
      control={control}
      defaultValue={[]}
      render={({ field }) => {
        const selected = Array.isArray(field.value) ? field.value : [];
        const selectedOptions = options.filter((o) => selected.includes(o.value));

        const toggle = (value) => {
          if (selected.includes(value)) {
            field.onChange(selected.filter((v) => v !== value));
          } else {
            field.onChange([...selected, value]);
          }
        };
        const removeOne = (value) => field.onChange(selected.filter((v) => v !== value));
        const open = Boolean(anchorEl);

        return (
          <Box>
            {label ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>{label}</Typography>
            ) : null}
            <TextField
              inputRef={inputRef}
              fullWidth
              size="small"
              value={search}
              placeholder={placeholder}
              onChange={(e) => { setSearch(e.target.value); setAnchorEl(inputRef.current); }}
              onFocus={(e) => setAnchorEl(e.currentTarget)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setAnchorEl(inputRef.current)}>
                      <SearchIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Popover
              open={open}
              anchorEl={anchorEl}
              onClose={() => setAnchorEl(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              PaperProps={{ sx: { width: inputRef.current?.offsetWidth || 320, maxHeight: 320 } }}
            >
              <List dense sx={{ py: 0 }}>
                {visibleOptions.length === 0 && (
                  <Box sx={{ px: 2, py: 1.5 }}>
                    <Typography variant="body2" color="text.secondary">No matching business partners</Typography>
                  </Box>
                )}
                {visibleOptions.map((o) => (
                  <ListItemButton key={o.value} onClick={() => toggle(o.value)} dense disableRipple>
                    <ListItemIcon sx={{ minWidth: 0 }}>
                      <Checkbox edge="start" size="small" checked={selected.includes(o.value)} tabIndex={-1} disableRipple />
                    </ListItemIcon>
                    <ListItemText primary={o.label} />
                  </ListItemButton>
                ))}
                {hiddenCount > 0 && (
                  <Box sx={{ px: 2, py: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Showing {visibleOptions.length} of {filteredOptions.length} — keep typing to narrow further
                    </Typography>
                  </Box>
                )}
              </List>
            </Popover>

            <Box sx={{ mt: 1, p: 1.25, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'action.hover', minHeight: 40 }}>
              {selectedOptions.length === 0 ? (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ display: 'block' }}>
                  No business partners selected
                </Typography>
              ) : (
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {selectedOptions.map((o) => (
                    <Chip key={o.value} size="small" label={o.label} onDelete={() => removeOne(o.value)} />
                  ))}
                </Stack>
              )}
            </Box>
          </Box>
        );
      }}
    />
  );
}
