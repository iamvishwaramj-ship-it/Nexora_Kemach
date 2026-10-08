import React from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { useTranslation } from 'react-i18next';

const COLORS = {
  healthy: { glow: '#39FF88', text: '#0B3D24', bg: 'rgba(57,255,136,0.15)' },
  unhealthy: { glow: '#FF3B5C', text: '#4A0A16', bg: 'rgba(255,59,92,0.15)' },
  checking: { glow: '#FFC93B', text: '#4A3A0A', bg: 'rgba(255,201,59,0.15)' },
};

// Neon-style glowing pill for the login page's health status, placed directly
// under the login button. healthy = green check, unhealthy = red cross,
// checking = amber spinner. Was a plain colored dot for all three states;
// a real icon reads at a glance instead of needing the label text to tell
// healthy and unhealthy apart.
export default function NeonStatusPill({ status = 'checking' }) {
  const { t } = useTranslation();
  const c = COLORS[status] || COLORS.checking;
  const label = status === 'healthy' ? t('common.healthy') : status === 'unhealthy' ? t('common.unhealthy') : t('common.checkingHealth');

  return (
    <Box
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 1,
        px: 2, py: 0.6, borderRadius: 999,
        bgcolor: c.bg,
        border: `1px solid ${c.glow}`,
        boxShadow: `0 0 8px ${c.glow}, 0 0 16px ${c.glow}55`,
        animation: status === 'checking' ? 'neon-pulse 1.4s ease-in-out infinite' : 'none',
        '@keyframes neon-pulse': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
      }}
    >
      {status === 'checking' ? (
        <CircularProgress size={12} thickness={6} sx={{ color: c.glow, filter: `drop-shadow(0 0 4px ${c.glow})` }} />
      ) : status === 'healthy' ? (
        <CheckCircleIcon sx={{ fontSize: 16, color: c.glow, filter: `drop-shadow(0 0 4px ${c.glow})` }} />
      ) : (
        <CancelIcon sx={{ fontSize: 16, color: c.glow, filter: `drop-shadow(0 0 4px ${c.glow})` }} />
      )}
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.03em', color: c.glow }}>
        {label}
      </Typography>
    </Box>
  );
}
