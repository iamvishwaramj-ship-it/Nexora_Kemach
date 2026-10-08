import React from 'react';
import { Box, Paper } from '@mui/material';

// Low-level rendering pieces shared by every "Code/Name" picker in the app
// (PartyCodeSelect for Supplier/Customer, WarehouseCodeSelect for the item
// table's Warehouse column, and any future one): the open list is a
// two-column Code | Name table with a sticky header, and typing filters
// against both columns even though the closed field only ever shows the
// code. Pulled out here so every picker renders and filters identically
// instead of each one hand-rolling its own slightly-different copy.

// options must carry {code, name} alongside the usual {label, value}.
export function codeNameOptionFilter(options, { inputValue }) {
  const q = inputValue.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) => String(o.code || '').toLowerCase().includes(q) || String(o.name || '').toLowerCase().includes(q));
}

export function CodeNameOptionRow(props, option) {
  const { key, ...optionProps } = props;
  // Keyed by the master record's own Code, not `value` (the party's Name):
  // `value` is what the form field stores (see PartyCodeSelect's own doc
  // comment), but it is NOT unique — two different Supplier/Customer master
  // records can share the same Name (this app's data has several such
  // pairs, e.g. two different suppliers both named "OK PAINTS" under codes
  // S000462 and S000420). Keying by the colliding Name caused React to
  // conflate the two rows across re-renders as the filtered list changed
  // while typing: one of the pair got stuck showing stale content — the
  // same few rows kept appearing in the list no matter what was typed,
  // which looked like the search itself was broken. Code is what this
  // column is actually keyed/labelled by on screen and is unique per
  // record, so it doesn't have this problem.
  return (
    <li key={option.code || option.value || key} {...optionProps} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', columnGap: 12 }}>
      <span style={{ fontWeight: 600 }}>{option.code}</span>
      <span>{option.name}</span>
    </li>
  );
}

export function CodeNameListPaper({ children, ...paperProps }) {
  return (
    <Paper {...paperProps}>
      <Box
        sx={{
          display: 'grid', gridTemplateColumns: '120px 1fr', columnGap: 1.5,
          px: 2, py: 0.75, borderBottom: '1px solid', borderColor: 'divider',
          typography: 'caption', fontWeight: 700, color: 'text.secondary',
        }}
      >
        <span>Code</span>
        <span>Name</span>
      </Box>
      {children}
    </Paper>
  );
}
