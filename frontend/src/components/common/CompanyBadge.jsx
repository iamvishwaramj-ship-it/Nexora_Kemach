import React from 'react';
import { Box, Typography, Stack, alpha } from '@mui/material';
import ApartmentIcon from '@mui/icons-material/Apartment';
import { useGetCompanyDetailsQuery } from '../../features/company/companyDetailsApi';

// Pastel "Current Company" context badge — used in header cards on pages
// scoped to the active company (Branch Details, Financial Year, ...).
// Fetches its own data so pages don't need to wire this up individually.
//
// `compact` matches EntityHeaderCard's compact mode: without it the badge
// would keep its full padding and set the header's height on its own,
// undoing the smaller title/subtitle beside it. Opt-in, so every existing
// caller renders exactly as before.
export default function CompanyBadge({ compact = false }) {
  const { data: company } = useGetCompanyDetailsQuery();

  return (
    <Stack direction="row" spacing={compact ? 0.75 : 1.25} alignItems="center" sx={{
      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
      borderRadius: 2,
      px: compact ? 1.25 : 2,
      py: compact ? 0.5 : 1,
    }}>
      <ApartmentIcon
        fontSize="small"
        sx={{ color: 'text.primary', ...(compact ? { fontSize: 15 } : null) }}
      />
      <Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', ...(compact ? { fontSize: 10, lineHeight: 1.3 } : null) }}
        >
          Current Company
        </Typography>
        <Typography
          variant="body2"
          fontWeight={700}
          sx={compact ? { fontSize: 12, lineHeight: 1.3 } : null}
        >
          {company?.companyName || '—'}
        </Typography>
      </Box>
    </Stack>
  );
}
