import React from 'react';
import { Box, Typography } from '@mui/material';

// Read-only "view mode" rendering of a field: label above a bordered value box.
// Mirrors the look of a disabled input without pulling in MUI's floating-label chrome.
export default function CompanyInfoField({ label, value, minHeight }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1.5,
          px: 1.75,
          py: 1.25,
          minHeight: minHeight || 42,
          display: 'flex',
          alignItems: 'center',
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="body2" color={value ? 'text.primary' : 'text.disabled'} noWrap>
          {value || '—'}
        </Typography>
      </Box>
    </Box>
  );
}
