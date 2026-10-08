import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';

// The ONLY way to ask for confirmation in the app — no window.confirm().
// Usage: const confirm = useConfirm(); const ok = await confirm({ title, message });
const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const { t } = useTranslation();
  const [state, setState] = useState(null); // { title, message, resolve, confirmLabel, cancelLabel, severity }

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        setState({ ...options, resolve });
      }),
    []
  );

  const handleClose = (result) => {
    if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
          document.activeElement.blur();
    }
    state?.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={!!state} onClose={() => handleClose(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{state?.title || t('common.confirm')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{state?.message}</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => handleClose(false)} color="inherit">
            {state?.cancelLabel || t('common.cancel')}
          </Button>
          <Button
            onClick={() => handleClose(true)}
            variant="contained"
            color={state?.severity === 'error' ? 'error' : 'primary'}
            autoFocus
          >
            {state?.confirmLabel || t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
