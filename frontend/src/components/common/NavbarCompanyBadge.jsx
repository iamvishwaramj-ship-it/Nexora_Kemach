import React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import ApartmentIcon from '@mui/icons-material/Apartment';
import { useGetCompanyDetailsQuery } from '../../features/company/companyDetailsApi';

// "Current Company" badge shown in the navbar, in the slot NavbarDate used to
// occupy (just before the language switcher) -- a small building icon beside
// a two-line label (the "Current Company" caption on top, the active
// company's name underneath), with no background chip, matching the plain
// inline style of the reference navbar design.
//
// Reuses the same getCompanyDetails query CompanyLogo/CompanyBadge already
// subscribe to, so this doesn't trigger an extra fetch -- RTK Query dedupes
// the subscription and the name is present on first paint.
export default function NavbarCompanyBadge() {
  const { data: company } = useGetCompanyDetailsQuery();

  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0, mr: 0.5 }}>
      <ApartmentIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
      <Box sx={{ lineHeight: 1.15 }}>
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.15 }}>
          Current Company
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.15 }}>
          {company?.companyName || '—'}
        </Typography>
      </Box>
    </Stack>
  );
}
