import React, { useRef } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutline';

// How long a press/hold must last before it counts as "long press" and
// reveals the delete icon, rather than a normal tap that selects the
// option. 500ms matches the touch-and-hold convention used elsewhere on
// mobile (e.g. long-press-to-reveal on list rows).
const LONG_PRESS_MS = 500;

/**
 * One option row inside the Invoice Type dropdown (see
 * PurchaseOtherDetailsCard's renderOption), with a mobile-style
 * long-press-to-delete affordance: long-pressing (or long-clicking with a
 * mouse) an option reveals a delete icon next to it. A normal short tap
 * still just selects the option, same as any other FormSelect.
 *
 * The delete icon itself is disabled — greyed out, with an explanatory
 * tooltip — for any Invoice Type already referenced by a Purchase Order /
 * GRN / Purchase Invoice (option.isUsed, from the ?includeUsage=true list
 * the caller fetches), so a used master can never be deleted from here; the
 * backend's own masterGuard('invoiceType', 'name') still enforces this for
 * real regardless, this is only the up-front heads-up.
 *
 * Kept as its own component (rather than inlined in renderOption) because
 * the long-press timer needs its own refs/handlers per row.
 */
export default function InvoiceTypeOptionRow({ liProps, option, revealed, onReveal, onDelete, deleting }) {
  const timerRef = useRef(null);
  // Tracks whether THIS render's press already crossed the long-press
  // threshold, so the click that follows the mouseup/touchend can be
  // swallowed instead of selecting the option out from under the user the
  // instant the delete icon appears.
  const longPressedRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startPress = () => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      longPressedRef.current = true;
      onReveal(option.value);
    }, LONG_PRESS_MS);
  };

  const cancelPress = () => clearTimer();

  // Runs before the option's own onClick (which selects it) — capture
  // phase — so a long press never also picks the option.
  const handleClickCapture = (e) => {
    if (longPressedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      longPressedRef.current = false;
    }
  };

  const isRevealed = revealed === option.value;

  return (
    <li
      {...liProps}
      onMouseDown={(e) => { startPress(); liProps.onMouseDown?.(e); }}
      onMouseUp={cancelPress}
      onMouseLeave={cancelPress}
      onTouchStart={(e) => { startPress(); liProps.onTouchStart?.(e); }}
      onTouchEnd={cancelPress}
      onTouchCancel={cancelPress}
      onClickCapture={handleClickCapture}
      style={{ ...liProps.style, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
    >
      <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {option.label}
      </Box>
      {isRevealed && (
        option.isUsed ? (
          <Tooltip title="Used in a transaction — cannot be deleted.">
            {/* Tooltip needs a live child to attach hover listeners to; a
                disabled button swallows pointer events, so it's wrapped in
                a span. */}
            <span>
              <IconButton size="small" color="error" disabled aria-label="delete invoice type (disabled — in use)">
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        ) : (
          <IconButton
            size="small"
            color="error"
            disabled={deleting}
            aria-label="delete invoice type"
            // preventDefault (not stopPropagation) on mousedown — keeps the
            // Autocomplete's input from blurring and closing the popup
            // before the click below fires, without also blocking the
            // click from bubbling normally.
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(option);
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        )
      )}
    </li>
  );
}
