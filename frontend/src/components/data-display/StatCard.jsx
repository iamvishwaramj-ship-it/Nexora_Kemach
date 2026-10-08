import React from 'react';
import { Card, CardContent, Box, Typography, Stack, Tooltip, alpha } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

// The stat cards sit 6-across on desktop (md={2}), so a value like
// "₹19,70,491.50" is wider than the card. Instead of truncating it with an
// ellipsis, step the font size down as the string gets longer. Cards keep an
// identical footprint — only the type inside them scales.
const valueFontSize = (text) => {
  const len = String(text ?? '').length;
  if (len <= 8) return '1.25rem';   // "16", "₹1,200"        — h6
  if (len <= 11) return '1.05rem';  // "₹1,70,491"
  if (len <= 14) return '0.95rem';  // "₹19,70,491.50"
  if (len <= 18) return '0.85rem';  // "₹19,70,49,491.50"
  return '0.75rem';
};

export default function StatCard({ icon, label, value, color = 'primary', change, changeLabel }) {
  const hasChange = typeof change === 'number' && !Number.isNaN(change);
  const isUp = hasChange && change >= 0;
  const valueText = value == null ? '' : String(value);

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent
        sx={{
          p: 2,
          '&:last-child': { pb: 2 },
          // Cards in a row share the same height (Card has height: '100%'),
          // but a 2-line label ("Total Delivered Amount") makes that card's
          // own content taller than a neighbour with a 1-line label ("Total
          // Orders"). Content used to just sit at the top of whatever height
          // the row settled on, so the short cards had dead space stranded
          // at the bottom instead of evenly split above and below. Centering
          // the content vertically (not horizontally — the icon/label/value
          // stay left-aligned exactly as before) fixes that without
          // touching how any individual card's own content is laid out.
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <Box sx={{
            width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: (theme) => alpha(theme.palette[color]?.main || theme.palette.primary.main, 0.14),
            color: `${color}.main`, flexShrink: 0,
          }}>
            {icon}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Tooltip title={label ?? ''} placement="top" enterDelay={600}>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  // Wrap to at most 2 lines rather than cutting the label off
                  // mid-word ("Total Outstanding…", "Current (0 - 30 D…") —
                  // but no minHeight reservation: that used to force a full
                  // 2-line gap between the label and the value below on
                  // every card with a one-line label ("Total Requests",
                  // "Pending"...), which is most of them. A card with a
                  // genuinely 2-line label just ends up a touch taller than
                  // its neighbours instead.
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 2,
                  overflow: 'hidden',
                  lineHeight: 1.3,
                }}
              >
                {label}
              </Typography>
            </Tooltip>
            <Tooltip title={valueText} placement="bottom-start" enterDelay={600}>
              <Typography
                fontWeight={700}
                sx={{
                  fontSize: valueFontSize(valueText),
                  lineHeight: 1.35,
                  mt: 0.25,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {value}
              </Typography>
            </Tooltip>
          </Box>
        </Stack>

        {hasChange && (
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 1 }}>
            <Stack direction="row" alignItems="center" spacing={0.25} sx={{ color: isUp ? 'success.main' : 'error.main' }}>
              {isUp ? <ArrowUpwardIcon sx={{ fontSize: 14 }} /> : <ArrowDownwardIcon sx={{ fontSize: 14 }} />}
              <Typography variant="caption" fontWeight={700}>{Math.abs(change)}%</Typography>
            </Stack>
            {changeLabel && (
              <Typography variant="caption" color="text.secondary">{changeLabel}</Typography>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
