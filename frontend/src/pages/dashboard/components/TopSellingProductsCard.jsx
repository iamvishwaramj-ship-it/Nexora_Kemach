import React, { useState } from 'react';
import { Card, CardContent, Typography, Box, Stack, Select, MenuItem, Divider } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useTheme } from '@mui/material/styles';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import EmptyState from '../../../components/data-display/EmptyState';
import ChartDrilldownDialog from './ChartDrilldownDialog';

const currency = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function TopSellingProductsCard({ data = [] }) {
  const theme = useTheme();
  const [period, setPeriod] = useState('month');
  const [productDrilldown, setProductDrilldown] = useState(null); // clicked one slice
  const [showAll, setShowAll] = useState(false); // clicked the card itself

  // Distinct hues (not shades of one color/grey) so each slice reads apart
  // from the others at a glance -- still theme-driven, since every one of
  // these is a palette token that shifts with the selected color scheme
  // and light/dark mode instead of a hardcoded hex.
  const colors = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.info.main,
    theme.palette.success.main,
    theme.palette.warning.main,
  ];

  return (
    <Card variant="outlined" sx={{ height: '100%', cursor: 'pointer' }} onClick={() => setShowAll(true)}>
      <CardContent>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 1 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>Top Selling Products</Typography>
            <Typography variant="caption" color="text.secondary">click a slice for that product, click the card for all</Typography>
          </Box>
          <Box onClick={(e) => e.stopPropagation()}>
            <Select
              size="small"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              sx={{ minWidth: 110, '& .MuiSelect-select': { py: 0.5, fontSize: '0.8rem' } }}
            >
              <MenuItem value="month">This Month</MenuItem>
              <MenuItem value="quarter">This Quarter</MenuItem>
              <MenuItem value="year">This Year</MenuItem>
            </Select>
          </Box>
        </Stack>

        <Box sx={{ width: '100%', height: 180 }}>
          {data.length === 0 ? (
            // Recharts' Pie renders nothing at all for an empty data array --
            // no chart, no message -- which reads as a broken/blank card. Show
            // a proper empty state instead, same as elsewhere in the app.
            <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
              <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 36 }} />} title="No product value data yet" message="Products need a cost or sales price on record to rank here." />
            </Stack>
          ) : (
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={2}
                  strokeWidth={0}
                  cursor="pointer"
                  onClick={(entry, index, event) => { event?.stopPropagation?.(); setProductDrilldown(entry?.payload ?? entry); }}
                >
                  {data.map((entry, i) => (
                    <Cell key={entry.name} fill={colors[i % colors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => currency(v)} contentStyle={{ backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Box>

        <Stack spacing={0.75} sx={{ mt: 1 }}>
          {data.map((d, i) => (
            <Stack
              key={d.name}
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              onClick={(e) => { e.stopPropagation(); setProductDrilldown(d); }}
              sx={{ cursor: 'pointer', borderRadius: 1, px: 0.5, '&:hover': { bgcolor: 'action.hover' } }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: colors[i % colors.length], flexShrink: 0 }} />
                <Typography variant="caption" color="text.secondary" noWrap>{d.name}</Typography>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ flexShrink: 0 }}>
                <Typography variant="caption" fontWeight={600}>{currency(d.value)}</Typography>
                <Typography variant="caption" color="text.secondary">({d.percent}%)</Typography>
              </Stack>
            </Stack>
          ))}
        </Stack>
      </CardContent>

      <Box onClick={(e) => e.stopPropagation()}>
        {/* Single slice/legend row clicked -- that one product's detail */}
        <ChartDrilldownDialog
          open={!!productDrilldown}
          onClose={() => setProductDrilldown(null)}
          title={productDrilldown?.name}
          subtitle="Top Selling Products breakdown"
        >
          <Stack spacing={1.5}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Value</Typography>
              <Typography variant="subtitle2" fontWeight={700}>{currency(productDrilldown?.value)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Share of top products</Typography>
              <Typography variant="subtitle2" fontWeight={700}>{productDrilldown?.percent}%</Typography>
            </Stack>
            <Divider />
            <Typography variant="caption" color="text.secondary">
              Ranked by current inventory value (stock on hand × sales price) for the
              selected period, since invoices in this app don't carry per-product line items.
            </Typography>
          </Stack>
        </ChartDrilldownDialog>

        {/* Card clicked anywhere else -- the whole breakdown, chart + table */}
        <ChartDrilldownDialog
          open={showAll}
          onClose={() => setShowAll(false)}
          title="Top Selling Products — full breakdown"
          subtitle="Every product/segment shown on the card"
        >
          <Box sx={{ width: '100%', height: 240, mb: 2 }}>
            {data.length === 0 ? (
              <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
                <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 36 }} />} title="No product value data yet" message="Products need a cost or sales price on record to rank here." />
              </Stack>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2} strokeWidth={0}>
                    {data.map((entry, i) => (
                      <Cell key={entry.name} fill={colors[i % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => currency(v)} />
                  <Legend verticalAlign="bottom" height={36} iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Box>
          <Stack spacing={1}>
            {data.map((d, i) => (
              <Stack key={d.name} direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: colors[i % colors.length], flexShrink: 0 }} />
                  <Typography variant="body2" noWrap>{d.name}</Typography>
                </Stack>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ flexShrink: 0 }}>
                  <Typography variant="body2" fontWeight={600}>{currency(d.value)}</Typography>
                  <Typography variant="body2" color="text.secondary">({d.percent}%)</Typography>
                </Stack>
              </Stack>
            ))}
          </Stack>
        </ChartDrilldownDialog>
      </Box>
    </Card>
  );
}
