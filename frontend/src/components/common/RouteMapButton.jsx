import React, { useState } from 'react';
import { Tooltip, IconButton } from '@mui/material';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import RouteMapDialog from './RouteMapDialog';

// The Actions-column entry point to the Route Map, for every Purchase and
// Sales list page.
//
// Self-contained — it owns its own open state and renders its own dialog —
// so a list page adds the whole feature with one import and one element,
// instead of threading state, a handler and a dialog through each page.
//
// One of these per ROW is deliberate and cheap: a closed MUI <Dialog> renders
// nothing at all (keepMounted defaults to false), and RouteMapDialog skips its
// query while closed, so an unopened row costs a boolean and no request.
//
// @param {'sales'|'purchase'} flow
// @param {string} type   anchor type the backend understands —
//   sales: enquiry | quotation | order | challan | invoice | return | creditMemo
//   purchase: quotation | order | grn | invoice | return | creditMemo
// @param {string} docNo  this row's own document number
export default function RouteMapButton({ flow, type, docNo }) {
  const [open, setOpen] = useState(false);

  // A row with no document number has nothing to anchor a chain on. Rendered
  // disabled rather than hidden, so the Actions column keeps a stable width
  // and the icons below it do not shift from row to row.
  const disabled = !docNo;

  return (
    <>
      <Tooltip title={disabled ? 'No document number' : 'Relationship Map'}>
        {/* span wrapper: MUI cannot attach a tooltip to a disabled button. */}
        <span>
          <IconButton
            size="small"
            disabled={disabled}
            onClick={(e) => { e.stopPropagation(); setOpen(true); }}
            aria-label="route map"
          >
            <AccountTreeOutlinedIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      {open && (
        <RouteMapDialog
          open={open}
          onClose={() => setOpen(false)}
          flow={flow}
          type={type}
          docNo={docNo}
        />
      )}
    </>
  );
}
