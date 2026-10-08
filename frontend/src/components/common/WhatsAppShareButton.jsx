import React from 'react';
import { Button, IconButton, Tooltip } from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

// Official WhatsApp brand green — used directly (not MUI's theme "success",
// which is a generic green that didn't read as "WhatsApp" at a glance) so
// the button is recognizable as the WhatsApp action wherever it appears.
const WHATSAPP_GREEN = '#25D366';
const WHATSAPP_GREEN_DARK = '#1EBE5A';

function digitsOnly(value) {
  return String(value || '').replace(/[^\d]/g, '');
}

// This deployment is single-country (GST-based Indian entities throughout
// the rest of the app), so a bare 10-digit mobile number is assumed to be
// Indian. Only used here to decide whether the button is even clickable —
// the backend re-derives (and re-normalizes) the number itself from the
// customer's own record before sending; see whatsappBusiness.service.js's
// own toWhatsAppNumber.
function hasUsableNumber(phone) {
  const digits = digitsOnly(phone);
  return digits.length >= 10;
}

/**
 * "Send via WhatsApp" — sends the customer a WhatsApp Business API template
 * message (Meta Cloud API, via the org's own gateway) with the printable
 * PDF attached as the template's document header. This is a genuinely
 * automated send: no manual "attach the file yourself" step, unlike the
 * click-to-chat version this replaced.
 *
 * This component itself does no networking — it's a dumb button that shows
 * a loading/disabled state and calls `onClick`. The actual work (capturing
 * the printable as a PDF, uploading it, calling the send mutation, and
 * showing a success/error notification) is the caller's own onClick
 * handler, because that work needs page-level things this component has no
 * business knowing about — the printable's own capture<Doc>Pdf function,
 * the RTK Query mutation hook, and the notify() toast.
 *
 * Props:
 *   phone        — customer's mobile/telephone number, any format. Only
 *                  used to decide whether the button is clickable at all —
 *                  see hasUsableNumber above.
 *   customerName — used only for the disabled-state tooltip copy.
 *   docLabel     — human label for the document, e.g. "Sales Quotation".
 *   docNo        — this document's own number, e.g. "SQ-0001". Required —
 *                  there is nothing to send without a saved document.
 *   onClick      — async () => void. Required to actually send anything.
 *   sending      — true while onClick's own async work is in flight
 *                  (mirrors the create/updating/generatingEInvoice flags
 *                  this codebase already threads through its other
 *                  page-level action buttons).
 *   disabled     — additional caller-supplied disable condition.
 *   iconOnly     — renders as a compact icon button instead (for a table
 *                  row's action-icon strip, alongside its Print icon,
 *                  rather than the full labeled Button used on the form's
 *                  own footer action row).
 */
export default function WhatsAppShareButton({
  phone,
  customerName,
  docLabel,
  docNo,
  onClick,
  sending = false,
  disabled = false,
  fullWidth = false,
  iconOnly = false,
}) {
  const isDisabled = disabled || sending || !hasUsableNumber(phone) || !docNo || !onClick;

  const reason = !docNo
    ? 'Save this document first'
    : !hasUsableNumber(phone)
      ? 'No WhatsApp/mobile number on file for this customer'
      : sending
        ? 'Sending…'
        : '';

  if (iconOnly) {
    return (
      <Tooltip title={isDisabled ? (reason || 'Send via WhatsApp') : 'Send via WhatsApp'}>
        {/* Tooltip needs a non-disabled wrapper to still receive hover/focus
          when the IconButton itself is disabled -- MUI swallows those
          events on a disabled element directly. */}
        <span>
          <IconButton size="small" onClick={onClick} disabled={isDisabled} aria-label="send via whatsapp">
            <WhatsAppIcon fontSize="small" sx={isDisabled ? undefined : { color: WHATSAPP_GREEN }} />
          </IconButton>
        </span>
      </Tooltip>
    );
  }

  const button = (
    <Button
      fullWidth={fullWidth}
      type="button"
      variant="contained"
      startIcon={<WhatsAppIcon />}
      onClick={onClick}
      disabled={isDisabled}
      sx={{
        bgcolor: WHATSAPP_GREEN,
        color: '#fff',
        '&:hover': { bgcolor: WHATSAPP_GREEN_DARK },
      }}
    >
      {sending ? 'Sending…' : 'Send via WhatsApp'}
    </Button>
  );

  // Tooltip on a disabled Button needs a non-disabled wrapper to receive
  // the hover/focus events (MUI swallows them on the disabled element
  // itself) — only bothering with the wrapper when there's actually a
  // reason to explain (not while merely sending, and not customerName-only
  // reasons — customerName is otherwise unused, kept as a prop only so
  // callers passing it through don't need a separate no-op check).
  if (!isDisabled || sending) return button;

  return (
    <Tooltip title={reason || `No WhatsApp/mobile number on file${customerName ? ` for ${customerName}` : ''}`}>
      <span style={fullWidth ? { display: 'block', width: '100%' } : undefined}>{button}</span>
    </Tooltip>
  );
}
