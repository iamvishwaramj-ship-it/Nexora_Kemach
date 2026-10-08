import React, { useState, useMemo } from 'react';
import { Card, CardContent, Typography, Box, Stack, Select, MenuItem } from '@mui/material';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from 'recharts';
import { useTheme } from '@mui/material/styles';
import dayjs from 'dayjs';
import { salesInvoiceApi } from '../../../features/resources';
import ChartDrilldownDialog from './ChartDrilldownDialog';
import MonthlyDrilldownTable from './MonthlyDrilldownTable';
import MonthlySeriesTable from './MonthlySeriesTable';

// A real, clickable SVG dot -- used instead of Area's built-in `dot` object
// prop so an individual point's click can stopPropagation() and keep it from
// also triggering the card-level "whole chart" click handler underneath it.
function ClickableDot(color, onPick) {
  return function Dot(props) {
    const { cx, cy, payload, index } = props;
    if (cx == null || cy == null) return null;
    return (
      <circle
        key={`dot-${index}`}
        cx={cx}
        cy={cy}
        r={5}
        fill={color}
        stroke="none"
        style={{ cursor: 'pointer' }}
        onClick={(e) => { e.stopPropagation(); onPick(payload); }}
      />
    );
  };
}

export default function SalesOverviewCard({ data = [], height = 260 }) {
  const theme = useTheme();
  const [period, setPeriod] = useState('year');
  const [monthDrilldown, setMonthDrilldown] = useState(null); // clicked one point
  const [showAll, setShowAll] = useState(false); // clicked the card itself

  const { data: invoices } = salesInvoiceApi.useList(undefined, { skip: !monthDrilldown });

  const rows = useMemo(() => {
    if (!monthDrilldown || !invoices) return [];
    return invoices
      .filter((inv) => {
        if (!inv.invoiceDate) return false;
        const d = dayjs(inv.invoiceDate);
        return d.year() === monthDrilldown.year && d.month() === monthDrilldown.month;
      })
      .map((inv) => ({ id: inv.id, no: inv.invoiceNo, party: inv.customer, date: inv.invoiceDate, amount: inv.amount }));
  }, [monthDrilldown, invoices]);

  const Dot = useMemo(() => ClickableDot(theme.palette.primary.main, setMonthDrilldown), [theme.palette.primary.main]);

  // `data` is a fixed 6-month trailing series from the backend. "This Year"
  // keeps the full trailing series (the original/default view); "This
  // Quarter"/"This Month" narrow it down to the buckets that fall in the
  // current quarter/month, using the year/month each bucket already carries.
  const filteredData = useMemo(() => {
    if (!data.length || period === 'year') return data;
    const now = dayjs();
    if (period === 'month') {
      return data.filter((d) => d.year === now.year() && d.month === now.month());
    }
    const curQuarter = Math.floor(now.month() / 3);
    return data.filter((d) => d.year === now.year() && Math.floor(d.month / 3) === curQuarter);
  }, [data, period]);

  return (
    <Card variant="outlined" sx={{ height: '100%', cursor: 'pointer' }} onClick={() => setShowAll(true)}>
      <CardContent>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>Sales Overview</Typography>
            <Typography variant="caption" color="text.secondary">₹ in Lakhs · click a point for that month, click the card for all</Typography>
          </Box>
          <Box onClick={(e) => e.stopPropagation()}>
            <Select
              size="small"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              sx={{ minWidth: 110, '& .MuiSelect-select': { py: 0.5, fontSize: '0.8rem' } }}
            >
              <MenuItem value="year">This Year</MenuItem>
              <MenuItem value="quarter">This Quarter</MenuItem>
              <MenuItem value="month">This Month</MenuItem>
            </Select>
          </Box>
        </Stack>

        <Box sx={{ width: '100%', height, mt: 1 }}>
          <ResponsiveContainer>
            <AreaChart data={filteredData} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 }}
                formatter={(v) => [`₹${v}L`, 'Sales']}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={theme.palette.primary.main}
                strokeWidth={2.5}
                fill="url(#salesGradient)"
                dot={Dot}
                activeDot={Dot}
              >
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={(v) => `₹${v}L`}
                  style={{ fontSize: 10, fill: theme.palette.text.secondary }}
                />
              </Area>
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>

      {/* Single point clicked -- that month's real invoices */}
      <Box onClick={(e) => e.stopPropagation()}>
        <ChartDrilldownDialog
          open={!!monthDrilldown}
          onClose={() => setMonthDrilldown(null)}
          title={`Sales — ${monthDrilldown?.name} ${monthDrilldown?.year}`}
          subtitle="Invoices behind this month's total"
        >
          <MonthlyDrilldownTable rows={rows} partyLabel="Customer" exactTotal={monthDrilldown?.rawValue} />
        </ChartDrilldownDialog>

        {/* Card clicked anywhere else -- the whole 6-month series, chart + table */}
        <ChartDrilldownDialog
          open={showAll}
          onClose={() => setShowAll(false)}
          title="Sales Overview — full period"
          subtitle="₹ in Lakhs, all months shown on the card"
        >
          <Box sx={{ width: '100%', height: 220, mb: 2 }}>
            <ResponsiveContainer>
              <AreaChart data={data} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [`₹${v}L`, 'Sales']} />
                <Area type="monotone" dataKey="value" stroke={theme.palette.primary.main} strokeWidth={2.5} fill="url(#salesGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
          <MonthlySeriesTable rows={data} />
        </ChartDrilldownDialog>
      </Box>
    </Card>
  );
}
