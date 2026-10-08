import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * The single reusable, theme-aware loading indicator for page/section-level
 * loading (as opposed to TableSkeleton, which is for in-table row loading).
 * Supersedes ad-hoc "Loading..." text and bespoke spinners — every list page
 * that isn't rendering skeleton rows should render this instead while its
 * RTK Query `isLoading` flag is true.
 *
 * Reuses Spinner's layout (centered CircularProgress + optional label) so
 * this and Spinner stay visually identical; this is the version wired for
 * list/page use (minHeight instead of a fixed py, fullScreen kept for parity
 * with call sites that used Spinner's overlay mode).
 */
export default function LoadingState({ label, fullScreen = false, size = 36, minHeight = 160 }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        ...(fullScreen
          ? { position: 'fixed', inset: 0, zIndex: 1300, bgcolor: 'background.default' }
          : { minHeight, py: 6 }),
      }}
    >
      <CircularProgress size={size} />
      {label && <Typography variant="body2" color="text.secondary">{label}</Typography>}
    </Box>
  );
}
