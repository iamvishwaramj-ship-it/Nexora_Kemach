import React, { useEffect, useRef, useState } from 'react';
import { Snackbar, Alert, AlertTitle } from '@mui/material';
import { useNetworkStatus } from '../../context/NetworkStatusContext';

const BACK_ONLINE_FLASH_MS = 2500;

// Persistent (non-auto-dismissing) network status banner, driven entirely by
// NetworkStatusProvider. Mounted once alongside the provider in App.jsx, so
// it's visible on the login page and every authenticated route with no
// per-page wiring. Distinct from NotificationProvider's Snackbar (transient,
// queued toasts) — this one stays on screen for the whole duration of an
// offline/slow condition instead of auto-hiding.
export default function NetworkStatusBanner() {
  const { isOnline, isSlow, effectiveType } = useNetworkStatus();
  const [showBackOnline, setShowBackOnline] = useState(false);
  const wasDownRef = useRef(false);

  const isDown = !isOnline || isSlow;

  useEffect(() => {
    if (isDown) {
      wasDownRef.current = true;
      setShowBackOnline(false);
      return undefined;
    }
    if (wasDownRef.current) {
      // Connection just recovered — show a brief "Back online" confirmation
      // instead of snapping the banner away instantly.
      wasDownRef.current = false;
      setShowBackOnline(true);
      const timer = setTimeout(() => setShowBackOnline(false), BACK_ONLINE_FLASH_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isDown]);

  const open = isDown || showBackOnline;
  if (!open) return null;

  let severity = 'success';
  let title = 'Back online';
  let message = 'Your connection has been restored.';

  if (!isOnline) {
    severity = 'error';
    title = "You're offline";
    message = 'Waiting for connection...';
  } else if (isSlow) {
    severity = 'warning';
    title = 'Slow network connection detected';
    message = effectiveType
      ? `Some actions may take longer than usual (connection: ${effectiveType}).`
      : 'Some actions may take longer than usual.';
  }

  return (
    <Snackbar
      open={open}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ top: { xs: 8, sm: 16 }, zIndex: (theme) => theme.zIndex.snackbar + 1 }}
    >
      <Alert severity={severity} variant="filled" sx={{ minWidth: 320, boxShadow: 4 }}>
        <AlertTitle sx={{ mb: 0 }}>{title}</AlertTitle>
        {message}
      </Alert>
    </Snackbar>
  );
}
