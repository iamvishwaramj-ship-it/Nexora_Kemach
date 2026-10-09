import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Button,
  Stack, Box, Typography, Chip, Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History';

/**
 * Version History — hand-maintained changelog shown in a popup.
 *
 * This is deliberately a plain hardcoded array, NOT pulled from git log, a
 * CHANGELOG file, or an API: whoever ships a version edits VERSION_HISTORY
 * below by hand, same as the version number itself in
 * ../../config/versionHandle.js. Keep the two in sync — the newest entry
 * here should match VERSION_LABEL_NAME.
 *
 * Add a new release by adding ONE object to the top of this array (newest
 * first — the list is rendered in the order given, no sorting):
 *   {
 *     version: 'v1.0.0.0.5',
 *     title: 'Short heading for this release',
 *     description: 'What changed, in plain language. Can be a few sentences.',
 *   }
 *
 * Nothing else needs to change — Sidebar.jsx just renders whatever is here.
 */
export const VERSION_HISTORY = [
  {
    version: 'v1.0.0.2.4',
    title: 'Business Partner - 06-10-2026',
    description: `
    1. Fixed the Document Numbering Saving bug and issue
    2. Additionally Included the Branch Field on Reports -> Inventory Reports -> Available Balance
    3. Fixed the Opening Balance Deleting and updating issue
    
     `,
  },
  {
    version: 'v1.0.0.2.3',
    title: 'Sales, Document Numbering, Inventory, Purchase - 05-10-2026',
    description: `
    1. Fixed the Sales Invoice Maching Number Select input field to input field
    2. Purchase GRN Machine Name, No, Engine No
    3. Document Numbering Duplication Restriction removed
    4. Sales Return Internal Server Issue fixed
    5. Inventory -> Stock Transfer request -> Branch Transfer -> (Warehouse Removed) & fixed the DLP Price fetching issue
    6. Inventory -> Stock Transfer Issue -> Branch Transfer -> (Issue Warehouse Included)
    7. Inventory -> Stock Transfer Receipt -> Branch Transfer -> (Receive Warehouse Included and removed the to warehouse)
    8. Sales -> Tax Bug Fixed
    9. Reports Page Excel -> Should show fully colon search
    10. Removed the Eye Icon on the "Available Balance" and included on the "Stock Summary"
    11. Included the All Sales invoice document : Original (Finance Copy), Customer Copy, Duplicate
    12. Fixed Inventory -> Stock Receipt(Warehouse text not showing bug)
     `,
  },
  {
    version: 'v1.0.0.2.2',
    title: 'Business Partner - 03-10-2026',
    description: `
    1. Fixed the Business Partner Account Balance showing issue
    2. Added the Notification comes from which user and on which branch it is generated
    3. E-Way Bill is added on the stock transfer issue
    4. Stock transfer bug is partially solved and waiting for the working Flow
    5. Business partner "Account Balance" Negative value bug fixed
     `,
  },
];

export default function VersionHistory({ open, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <HistoryIcon fontSize="small" color="action" />
        Version History
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ ml: 'auto' }}
          aria-label="Close"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {VERSION_HISTORY.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No version history has been recorded yet.
          </Typography>
        ) : (
          <Stack divider={<Divider />} spacing={2}>
            {VERSION_HISTORY.map((entry) => (
              <Box key={entry.version}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                  <Chip label={entry.version} size="small" color="primary" variant="outlined" />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {entry.title}
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                  {entry.description}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
