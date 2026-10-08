import React from 'react';
import { Box, Typography, Card, CardContent, Stack, alpha } from '@mui/material';

// Standard page header for "master detail" style pages (Company Details,
// Branch Details, Financial Year, ...): circular pastel icon + title +
// one-line subtitle on the left, optional action/content on the right.
// See tempmem.md section 2 — reuse this instead of hand-rolling the header.
//
// `compact` shrinks the whole header — padding, icon and type — for pages
// that need the vertical space back for their own content (Chart Of Accounts
// puts a drawer cabinet directly beneath it). It's opt-in precisely so the
// default header every other page renders is left exactly as it was.
export default function EntityHeaderCard({ icon, title, subtitle, rightContent, compact = false }) {
  const iconSize = compact ? 30 : 52;

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent sx={compact ? { p: 1.25, '&:last-child': { pb: 1.25 } } : { p: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={compact ? 1 : 2}>
          <Stack direction="row" spacing={compact ? 1.25 : 2} alignItems="center">
            <Box sx={{
              width: iconSize, height: iconSize, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14), color: 'primary.main', flexShrink: 0,
              // Scale the caller's icon down to match the smaller circle —
              // cloning would force a fontSize the caller may have set
              // deliberately, so this styles the rendered <svg> instead.
              ...(compact ? { '& > *': { fontSize: 17 } } : null),
            }}>
              {icon}
            </Box>
            <Box>
              <Typography
                variant="h6"
                fontWeight={700}
                sx={compact ? { fontSize: 12, lineHeight: 1.35 } : null}
              >
                {title}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={compact ? { fontSize: 10, lineHeight: 1.35 } : null}
              >
                {subtitle}
              </Typography>
            </Box>
          </Stack>

          {rightContent}
        </Stack>
      </CardContent>
    </Card>
  );
}
