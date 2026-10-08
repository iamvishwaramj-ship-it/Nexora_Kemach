import React from 'react';
import { Card, CardContent, Stack, Typography, IconButton, Divider } from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutline';

/**
 * MobileItemCard — the mobile (below `sm`) stand-in for one editable row of
 * an item-details table inside a create/edit form. Companion to
 * MobileRecordCard (which replaces read-only list rows): below the `sm`
 * breakpoint, item-entry tables collapse into a stack of these cards
 * instead of a horizontally-scrolled table.
 *
 * index: zero-based row index (renders as "Item {index + 1}")
 * amount: computed row amount, already formatted (e.g. "1,234.00")
 * onRemove/removeDisabled: remove-row action and its disabled state
 * children: the row's form fields, stacked vertically
 */
export default function MobileItemCard({ index, amount, onRemove, removeDisabled, children }) {
  return (
    <Card variant="outlined" sx={{ mb: 1.5 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={700}>Item {index + 1}</Typography>
          <IconButton
            type="button"
            size="small"
            color="error"
            onClick={onRemove}
            disabled={removeDisabled}
            aria-label="remove item"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>

        {/* Every field reserves helper-text space below it for validation
            messages (even when empty); hiding that spacer here is what keeps
            the gap after the (usually disabled, single-column) Item field
            the same size as the gaps between the two-column rows below it —
            without this, the Item field's own reserved sliver of whitespace
            stacks with the Stack's spacing and reads as a much bigger gap
            than the tighter, row-shared reserved space further down. */}
        <Stack spacing={1.5} sx={{ '& .MuiFormHelperText-root:not(.Mui-error)': { display: 'none' } }}>{children}</Stack>

        <Divider sx={{ my: 1 }} />
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" color="text.secondary">Amount (₹)</Typography>
          <Typography variant="subtitle2" fontWeight={700}>{amount}</Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
