import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Snackbar, Alert } from '@mui/material';

// The ONLY way to surface messages in the app — no native alert()/confirm().
// Usage: const notify = useNotify(); notify.success('Saved!'); notify.error('Failed');
const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const [open, setOpen] = useState(false);

  const notify = useCallback((message, severity = 'info', options = {}) => {
    setQueue((prev) => [...prev, { message, severity, key: Date.now() + Math.random(), ...options }]);
  }, []);

  const api = useMemo(
    () => ({
      show: notify,
      success: (message, options) => notify(message, 'success', options),
      error: (message, options) => notify(message, 'error', options),
      warning: (message, options) => notify(message, 'warning', options),
      info: (message, options) => notify(message, 'info', options),
    }),
    [notify]
  );

  React.useEffect(() => {
    if (queue.length && !current) {
      setCurrent(queue[0]);
      setQueue((prev) => prev.slice(1));
      setOpen(true);
    } else if (queue.length && current && open) {
      setOpen(false);
    }
  }, [queue, current, open]);

  const handleClose = (_e, reason) => {
    if (reason === 'clickaway') return;
    setOpen(false);
  };

  const handleExited = () => setCurrent(null);

  return (
    <NotificationContext.Provider value={api}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={current?.duration || 4000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        TransitionProps={{ onExited: handleExited }}
      >
        <Alert onClose={handleClose} severity={current?.severity || 'info'} variant="filled" sx={{ minWidth: 280 }}>
          {current?.message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
}

export function useNotify() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotify must be used within NotificationProvider');
  return ctx;
}
