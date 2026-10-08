import React from 'react';
import { Grid, Card, CardActionArea, CardContent, Typography, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getNavIcon } from '../../router/iconMap';

// Per design-system.md: when a sidebar item has sub-items, it does NOT open
// a flyout. Instead it navigates here — a card grid of its sub-items —
// and clicking a card navigates into that sub-menu's actual page.
export default function SubMenuGrid({ items, title }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <Box>
      {title && (
        <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
          {title.startsWith('nav.') ? t(title) : title}
        </Typography>
      )}
      <Grid container spacing={2}>
        {items.map((item) => {
          const Icon = getNavIcon(item.icon);
          const label = item.labelKey?.startsWith('nav.') ? t(item.labelKey) : item.labelKey;
          return (
            <Grid item xs={12} sm={6} md={4} lg={3} key={item.key}>
              <Card variant="outlined">
                <CardActionArea onClick={() => navigate(item.path)} sx={{ p: 2, height: '100%' }}>
                  <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'center', gap: 1.5, p: '8px !important' }}>
                    <Icon sx={{ fontSize: 32, color: 'primary.main' }} />
                    <Typography variant="subtitle2" fontWeight={600}>{label}</Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
