import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import InboxIcon from '@mui/icons-material/InboxOutlined';

// action: optional node (e.g. a CanAdd-gated "Add X" button) rendered below
// the message — pass it only for the "no data at all" case, not the
// "no search/filter results" case (see callers' isFiltering branch).
export default function EmptyState({ title, message, icon, action }) {
  return (
    <Paper variant="outlined" sx={{ py: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{ color: 'text.disabled' }}>{icon || <InboxIcon sx={{ fontSize: 48 }} />}</Box>
      {title && <Typography variant="subtitle1" fontWeight={600}>{title}</Typography>}
      {message && <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360, textAlign: 'center' }}>{message}</Typography>}
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
    </Paper>
  );
}
