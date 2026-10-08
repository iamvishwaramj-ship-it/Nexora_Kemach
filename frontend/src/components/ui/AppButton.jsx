import React from 'react';
import { Button, CircularProgress } from '@mui/material';

// Thin wrapper over MUI Button so every button in the app shares one place
// to add app-wide behavior (loading state, consistent sizing) without
// hardcoding colors/sizes inside consuming pages.
export default function AppButton({ loading, disabled, children, startIcon, ...rest }) {
  return (
    <Button
      disabled={disabled || loading}
      startIcon={loading ? <CircularProgress size={16} color="inherit" /> : startIcon}
      {...rest}
    >
      {children}
    </Button>
  );
}
