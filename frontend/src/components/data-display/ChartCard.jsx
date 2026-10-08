import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useTheme } from '@mui/material/styles';

// Generic bar-chart card. dataKey/nameKey let callers reuse this for any
// simple category -> value series instead of hand-rolling a chart per page.
export default function ChartCard({ title, data = [], nameKey = 'name', dataKey = 'value', height = 260 }) {
  const theme = useTheme();
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>{title}</Typography>
        <Box sx={{ width: '100%', height }}>
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
              <XAxis dataKey={nameKey} tick={{ fontSize: 11, fill: theme.palette.text.secondary }} />
              <YAxis tick={{ fontSize: 11, fill: theme.palette.text.secondary }} />
              <Tooltip contentStyle={{ backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}` }} />
              <Bar dataKey={dataKey} fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
}
