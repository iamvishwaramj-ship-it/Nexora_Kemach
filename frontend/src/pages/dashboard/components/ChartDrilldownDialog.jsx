import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Typography, Box, Button,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

// Shared shell for every dashboard chart's click-to-drill-down popup --
// each chart card supplies its own body (an invoice table, a single
// product's detail, etc.) via children, so this only owns the dialog
// chrome (title/subtitle/close) that all of them share.
export default function ChartDrilldownDialog({ open, onClose, title, subtitle, children }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
          {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>{children}</DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
