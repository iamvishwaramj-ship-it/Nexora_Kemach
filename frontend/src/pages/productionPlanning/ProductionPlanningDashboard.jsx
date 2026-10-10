import React from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, Button, Chip, LinearProgress,
  Table, TableHead, TableBody, TableRow, TableCell, IconButton, Divider, Avatar, CircularProgress,
} from '@mui/material';
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend,
} from 'recharts';
import DashboardIcon from '@mui/icons-material/Dashboard';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import BarChartIcon from '@mui/icons-material/BarChart';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import { useGetProductionPlanningDashboardStatsQuery } from '../../features/productionPlanningApi';
import { isDemoMode } from '../../lib/demoMode';
import { DEMO_DASHBOARD_STATS } from '../../lib/demoData/dashboard';

// ---------------------------------------------------------------------------
// Production Dashboard — Phase 1 (MRP & Order Generation), approved scope,
// Section 6: only the order-status and planned-vs-completed trend widgets
// are backed by real data (GET /production-planning/dashboard-stats —
// mrpService.getDashboardStats, real ProductionOrder rows). Machine
// Utilization, Material Availability, Quality Summary, Production Alerts
// and the Top 5 Orders table have no backing data model anywhere in this
// schema (no Machine, QC/Inspection, or per-order progress tracking) —
// explicitly out of scope for this phase — so they are kept as clearly
// labeled sample data rather than removed or fabricated as real.
// ---------------------------------------------------------------------------

const STATUS_COLOR = { Planned: '#9e9e9e', Released: '#29b6f6', 'In Progress': '#4caf50', Completed: '#2196f3', Closed: '#607d8b', Cancelled: '#f44336' };

const MACHINE_UTILIZATION = [
  { machine: 'CNC-01', planned: 8.0, running: 6.5, pct: 81 },
  { machine: 'CNC-02', planned: 8.0, running: 5.0, pct: 63 },
  { machine: 'VMC-01', planned: 8.0, running: 7.0, pct: 88 },
  { machine: 'Lathe-01', planned: 8.0, running: 4.0, pct: 50 },
  { machine: 'Drilling-01', planned: 8.0, running: 6.0, pct: 75 },
];

const MATERIAL_AVAILABILITY = [
  { item: 'Gear Housing', required: 2000, available: 2100, shortage: 0, status: 'Available' },
  { item: 'Motor Bracket', required: 1500, available: 1200, shortage: 300, status: 'Shortage' },
  { item: 'Shaft Assembly', required: 1000, available: 1000, shortage: 0, status: 'Available' },
  { item: 'Pump Cover', required: 500, available: 350, shortage: 150, status: 'Shortage' },
  { item: 'Valve Body', required: 2000, available: 2500, shortage: 0, status: 'Available' },
];

const QUALITY_SUMMARY = [
  { type: 'Incoming QC', inspected: 5000, accepted: 4850, rejected: 150, pct: 3.0 },
  { type: 'In-Process QC', inspected: 8000, accepted: 7800, rejected: 200, pct: 2.5 },
  { type: 'Final QC', inspected: 6500, accepted: 6300, rejected: 200, pct: 3.1 },
];

const PRODUCTION_ALERTS = [
  { level: 'warning', message: 'Sample alert — Production Alerts has no backing data source yet', time: '-' },
  { level: 'info', message: 'Connect a real alerting rule here in a later phase', time: '-' },
];

const ALERT_ICON = { error: ErrorOutlineIcon, warning: WarningAmberIcon, info: InfoOutlinedIcon };
const ALERT_COLOR = { error: 'error.main', warning: 'warning.main', info: 'info.main' };

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}
function statusChipColor(status) {
  if (status === 'Available') return 'success';
  if (status === 'Shortage') return 'error';
  return 'default';
}
function SampleDataBadge() {
  return <Chip size="small" label="Sample data" variant="outlined" color="default" sx={{ fontStyle: 'italic' }} />;
}

export default function ProductionPlanningDashboard() {
  const { data: realStats, isLoading: isLoadingReal, refetch } = useGetProductionPlanningDashboardStatsQuery(undefined, { skip: isDemoMode() });
  const stats = isDemoMode() ? DEMO_DASHBOARD_STATS : realStats;
  const isLoading = isDemoMode() ? false : isLoadingReal;

  const statusCounts = stats?.orderStatusCounts || {};
  const orderStatusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value, color: STATUS_COLOR[name] || '#9e9e9e' }));
  const totalOrders = orderStatusData.reduce((s, d) => s + d.value, 0);
  const inProgress = (statusCounts['In Progress'] || 0) + (statusCounts.Released || 0) + (statusCounts.Planned || 0);
  const completed = (statusCounts.Completed || 0) + (statusCounts.Closed || 0);

  const trend = stats?.plannedVsCompletedByMonth || [];

  const kpiCards = [
    {
      key: 'total', label: 'Total Production Orders', value: isLoading ? '-' : String(totalOrders), icon: AssignmentOutlinedIcon, color: 'warning',
      sub: [{ label: 'In Progress', value: inProgress }, { label: 'Completed', value: completed }],
    },
    {
      key: 'open', label: 'Open Orders', value: isLoading ? '-' : String(stats?.totalOpenOrders ?? 0), icon: PlayCircleOutlineIcon, color: 'success',
    },
  ];

  return (
    <Box>
      <EntityHeaderCard
        icon={<DashboardIcon />}
        title="Production Dashboard"
        subtitle="Overview of production orders. Order status and trend are live; other widgets below are sample data pending later phases."
        rightContent={(
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <IconButton size="small" sx={{ border: '1px solid', borderColor: 'divider' }} onClick={() => refetch()}>
              <RefreshIcon fontSize="small" />
            </IconButton>
            <Button variant="contained" color="warning" startIcon={<AddIcon />} endIcon={<KeyboardArrowDownIcon />} disabled>
              New Production Order
            </Button>
          </Stack>
        )}
      />

      {/* KPI row — real data */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Grid item xs={12} sm={6} md={3} key={kpi.key}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1 }}>
                    <Avatar sx={{ bgcolor: `${kpi.color}.main`, width: 36, height: 36 }}>
                      <Icon fontSize="small" />
                    </Avatar>
                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>{kpi.label}</Typography>
                  </Stack>
                  <Typography variant="h5" fontWeight={700}>{kpi.value}</Typography>
                  {kpi.sub && (
                    <Stack direction="row" spacing={1.5} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                      {kpi.sub.map((s) => (
                        <Box key={s.label}>
                          <Typography variant="body2" fontWeight={700}>{numberFmt(s.value)}</Typography>
                          <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Charts row — real data */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Production Order Status</Typography>
              {isLoading ? (
                <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress size={28} /></Box>
              ) : orderStatusData.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No Production Orders yet.</Typography>
              ) : (
                <>
                  <Box sx={{ position: 'relative', height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={orderStatusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                          {orderStatusData.map((d) => <Cell key={d.name} fill={d.color} />)}
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                      <Typography variant="h5" fontWeight={700}>{totalOrders}</Typography>
                      <Typography variant="caption" color="text.secondary">Orders</Typography>
                    </Box>
                  </Box>
                  <Stack spacing={0.75} sx={{ mt: 1 }}>
                    {orderStatusData.map((d) => {
                      const pct = totalOrders ? Math.round((d.value / totalOrders) * 100) : 0;
                      return (
                        <Stack key={d.name} direction="row" alignItems="center" spacing={1}>
                          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: d.color }} />
                          <Typography variant="body2" sx={{ flex: 1 }}>{d.name}</Typography>
                          <Typography variant="body2" color="text.secondary">{d.value} ({pct}%)</Typography>
                        </Stack>
                      );
                    })}
                  </Stack>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Planned vs Completed Orders (Last 6 Months)</Typography>
              {isLoading ? (
                <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress size={28} /></Box>
              ) : trend.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No Production Orders in the last 6 months.</Typography>
              ) : (
                <Box sx={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <RechartsTooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="planned" name="Planned / Open" fill="#bdbdbd" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="completed" name="Completed" fill="#ff9800" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Below: sample data, explicitly out of Phase 1 scope (no Machine, QC, or alerting data model exists) */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, pt: 2, pb: 1 }}>
              <Typography variant="subtitle1" fontWeight={700}>Machine Utilization (Today)</Typography>
              <SampleDataBadge />
            </Stack>
            <ScrollableTableContainer maxHeight="none">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Machine</TableCell>
                    <TableCell align="right">Planned Hrs</TableCell>
                    <TableCell align="right">Running Hrs</TableCell>
                    <TableCell>Utilization</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {MACHINE_UTILIZATION.map((m) => (
                    <TableRow key={m.machine} hover>
                      <TableCell>{m.machine}</TableCell>
                      <TableCell align="right">{m.planned.toFixed(1)}</TableCell>
                      <TableCell align="right">{m.running.toFixed(1)}</TableCell>
                      <TableCell sx={{ minWidth: 130 }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <LinearProgress variant="determinate" value={m.pct} color={m.pct < 65 ? 'warning' : 'success'} sx={{ flex: 1, height: 6, borderRadius: 3 }} />
                          <Typography variant="caption" color="text.secondary">{m.pct}%</Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTableContainer>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, pt: 2, pb: 1 }}>
              <Typography variant="subtitle1" fontWeight={700}>Material Availability for Production</Typography>
              <SampleDataBadge />
            </Stack>
            <ScrollableTableContainer maxHeight="none">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Item</TableCell>
                    <TableCell align="right">Required</TableCell>
                    <TableCell align="right">Available</TableCell>
                    <TableCell align="right">Shortage</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {MATERIAL_AVAILABILITY.map((m) => (
                    <TableRow key={m.item} hover>
                      <TableCell>{m.item}</TableCell>
                      <TableCell align="right">{numberFmt(m.required)}</TableCell>
                      <TableCell align="right">{numberFmt(m.available)}</TableCell>
                      <TableCell align="right">{m.shortage ? <Typography color="error.main" variant="body2">{numberFmt(m.shortage)}</Typography> : numberFmt(0)}</TableCell>
                      <TableCell><Chip size="small" label={m.status} color={statusChipColor(m.status)} variant="outlined" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTableContainer>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, pt: 2, pb: 1 }}>
              <Typography variant="subtitle1" fontWeight={700}>Quality Summary (This Month)</Typography>
              <SampleDataBadge />
            </Stack>
            <ScrollableTableContainer maxHeight="none">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Inspected</TableCell>
                    <TableCell align="right">Accepted</TableCell>
                    <TableCell align="right">Rejected</TableCell>
                    <TableCell align="right">Rejection %</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {QUALITY_SUMMARY.map((q) => (
                    <TableRow key={q.type} hover>
                      <TableCell>{q.type}</TableCell>
                      <TableCell align="right">{numberFmt(q.inspected)}</TableCell>
                      <TableCell align="right">{numberFmt(q.accepted)}</TableCell>
                      <TableCell align="right">{numberFmt(q.rejected)}</TableCell>
                      <TableCell align="right">{q.pct.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTableContainer>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Card variant="outlined">
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, pt: 2, pb: 1 }}>
              <Typography variant="subtitle1" fontWeight={700}>Production Alerts</Typography>
              <SampleDataBadge />
            </Stack>
            <Divider />
            <Stack divider={<Divider />}>
              {PRODUCTION_ALERTS.map((a, idx) => {
                const Icon = ALERT_ICON[a.level];
                return (
                  <Stack key={idx} direction="row" spacing={1.25} alignItems="flex-start" sx={{ px: 2.5, py: 1.5 }}>
                    <Icon fontSize="small" sx={{ color: ALERT_COLOR[a.level], mt: 0.25 }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2">{a.message}</Typography>
                      <Typography variant="caption" color="text.secondary">{a.time}</Typography>
                    </Box>
                  </Stack>
                );
              })}
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
