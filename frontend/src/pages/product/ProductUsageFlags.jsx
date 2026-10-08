import React from 'react';
import { Box, Stack, Tooltip, Typography, FormHelperText } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useFormContext } from 'react-hook-form';
import { FormCheckbox } from '../../components/form/FormCheckbox';

// Sales Item / Purchase Item / Inventory Item — which flows this product may
// be used in.
//
// The three are INDEPENDENT, not exclusive: an ordinary traded good is bought
// and sold and stocked, so it carries all three. What a flag controls is
// whether the product is OFFERED in that flow's document pickers (see
// lib/productUsage.js), so a raw material flagged purchase-only simply never
// appears on a sales document.
//
// --- Why a box can be locked ---------------------------------------------
// A flag whose flow already has documents behind it cannot be unticked.
// Unticking it would drop the product out of that flow's picker while it is
// still sitting on saved documents — the stored lines would keep their product
// code and name, but nobody could select that product again to correct or
// repeat the document, and the master would be asserting the product was never
// part of a flow it demonstrably was.
//
// The lock is advisory here and enforced on the server
// (assertProductUsageUnchanged in backend utils/businessRules.js), so a direct
// API call is refused the same way. This component's job is to make the
// refusal visible BEFORE the user fills in a form and presses Save, and to say
// what is holding the flag rather than just greying it out.

const FLAGS = [
  {
    name: 'salesItem',
    label: 'Sales Item',
    hint: 'Offered on sales quotations, orders, delivery challans, invoices, returns and credit memos.',
  },
  {
    name: 'purchaseItem',
    label: 'Purchase Item',
    hint: 'Offered on purchase quotations, orders, goods receipts, invoices, returns and credit memos.',
  },
  {
    name: 'inventoryItem',
    label: 'Inventory Item',
    hint: 'Offered on stock receipts, issues, adjustments and transfers.',
  },
];

/** "3 sales orders, 1 sales invoice" — what is holding a locked flag. */
function describe(usage) {
  if (!usage?.detail?.length) return '';
  return usage.detail
    .slice(0, 3)
    .map((d) => `${d.count} ${d.label}${d.count === 1 ? '' : 's'}`)
    .join(', ')
    + (usage.detail.length > 3 ? `, and ${usage.detail.length - 3} more` : '');
}

/**
 * @param {object} usage  the /products/:code/usage response, or null while
 *   loading and for a product being created (which is used nowhere yet, so
 *   nothing is locked).
 */
export default function ProductUsageFlags({ usage }) {
  const { formState: { errors } } = useFormContext();

  // The at-least-one rule is a statement about the three together, so zod
  // attaches the same message to all three paths (see productSchema's
  // superRefine). Show it once, under the row, rather than three times.
  const error = errors.salesItem || errors.purchaseItem || errors.inventoryItem;

  return (
    <Box sx={{ width: '100%' }}>
      <Stack direction="row" flexWrap="wrap" useFlexGap spacing={2} alignItems="center">
        {FLAGS.map((flag) => {
          const locked = Boolean(usage?.[flag.name]?.used);
          const title = locked
            ? `Already used on ${describe(usage[flag.name])} — this cannot be turned off. `
              + 'Set the product\'s status to Inactive instead, so the history stays readable.'
            : flag.hint;

          return (
            // The span wrapper is what lets the tooltip work at all: MUI
            // cannot attach one to a disabled control, because a disabled
            // element fires no pointer events — and the locked case is
            // precisely the one where the explanation matters most.
            <Tooltip key={flag.name} title={title}>
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
                <FormCheckbox name={flag.name} label={flag.label} disabled={locked} />
                {locked && (
                  <LockOutlinedIcon
                    fontSize="small"
                    sx={{ ml: -0.75, color: 'text.disabled' }}
                    aria-label={`${flag.label} is locked because it is already in use`}
                  />
                )}
              </Box>
            </Tooltip>
          );
        })}
      </Stack>

      {error && <FormHelperText error>{error.message}</FormHelperText>}
    </Box>
  );
}
