import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

export default function Spinner({ label, fullScreen = false, size = 36 }) {
  return (
    <Box
      sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5,
        ...(fullScreen ? { position: 'fixed', inset: 0, zIndex: 1300, bgcolor: 'background.default' } : { py: 6 }),
      }}
    >
      <CircularProgress size={size} />
      {label && <Typography variant="body2" color="text.secondary">{label}</Typography>}
    </Box>
  );
}
