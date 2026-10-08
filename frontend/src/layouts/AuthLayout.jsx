import React from 'react';
import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';

// Thin wrapper for unauthenticated routes (login, forgot-password, etc.)
// Individual auth pages own their full-screen layout.
export default function AuthLayout() {
  return (
    <Box sx={{ minHeight: '100vh' }}>
      <Outlet />
    </Box>
  );
}
