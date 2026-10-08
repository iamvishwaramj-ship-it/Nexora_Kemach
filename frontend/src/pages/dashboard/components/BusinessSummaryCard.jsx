import React from 'react';
import { Card, CardContent, Typography, Stack, Box, alpha } from '@mui/material';
import ApartmentIcon from '@mui/icons-material/Apartment';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import GroupIcon from '@mui/icons-material/Group';
import StorefrontIcon from '@mui/icons-material/Storefront';

export default function BusinessSummaryCard({ summary = {} }) {
  const rows = [
    { icon: <ApartmentIcon fontSize="small" />, label: 'Total Companies', value: summary.totalCompanies ?? 0, color: 'primary' },
    { icon: <Inventory2Icon fontSize="small" />, label: 'Total Products', value: summary.totalProducts ?? 0, color: 'info' },
    { icon: <PeopleAltIcon fontSize="small" />, label: 'Total Customers', value: summary.totalCustomers ?? 0, color: 'success' },
    { icon: <LocalShippingIcon fontSize="small" />, label: 'Total Suppliers', value: summary.totalSuppliers ?? 0, color: 'warning' },
    { icon: <GroupIcon fontSize="small" />, label: 'Total Users', value: summary.totalUsers ?? 0, color: 'secondary' },
    { icon: <StorefrontIcon fontSize="small" />, label: 'Active Branches', value: summary.activeBranches ?? 0, color: 'error' },
  ];

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Business Summary</Typography>
        <Stack spacing={1.75}>
          {rows.map((row) => (
            <Stack key={row.label} direction="row" alignItems="center" justifyContent="space-between">
              <Stack direction="row" alignItems="center" spacing={1.25}>
                <Box sx={{
                  width: 32, height: 32, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  bgcolor: (theme) => alpha(theme.palette[row.color]?.main || theme.palette.primary.main, 0.14),
                  color: `${row.color}.main`,
                }}>
                  {row.icon}
                </Box>
                <Typography variant="body2" color="text.secondary">{row.label}</Typography>
              </Stack>
              <Typography variant="body2" fontWeight={700}>{row.value}</Typography>
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
