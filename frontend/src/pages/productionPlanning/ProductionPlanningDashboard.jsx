import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, Button, Chip, LinearProgress,
  Table, TableHead, TableBody, TableRow, TableCell, IconButton, Divider, Avatar,
} from '@mui/material';
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, LineChart, Line, Legend,
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

// ---------------------------------------------------------------------------
// Static, UI-only mock of the Production Dashboard, built to match the
// reference design the user supplied. Same convention as
// pages/purchase/PurchaseOrderPrintPreview.jsx and the first draft of
// pages/productionPlanning/Forecast.jsx: there is no Production Order,
// Machine, or Quality Inspection data model anywhere in this schema yet (no
// backing table for any of the numbers below), so this lays out the screen
// exactly as designed with fixed mock data rather than fabricating "real"
// numbers against tables that don't exist. The user explicitly chose this
// static-mock option (over leaving the screen blank, or building the
// underlying Production Order/Machine/QC modules first) when asked. Once
// those modules exist, this can be wired up the same way Forecast.jsx was.
// Local state only -- nothing here persists or calls the server.
// ---------------------------------------------------------------------------

const KPI_CARDS = [
  {
    key: 'total', label: 'Total Production Orders', value: '24', icon: AssignmentOutlinedIcon, color: 'warning',
    sub: [{ label: 'In Progress', value: 18 }, { label: 'Completed', value: 4 }, { label: 'On Hold', value: 2 }],
  },
  {
    key: 'planned', label: 'Planned Quantity', value: '12,500', unit: 'Nos', icon: PlayCircleOutlineIcon, color: 'success',
    sub: [{ label: 'Completed', value: 8320 }, { label: 'Remaining', value: 4180 }],
  },
  {
    key: 'achievement', label: 'Production Achievement', value: '66.6%', icon: BarChartIcon, color: 'info',
    progress: 66.6, link: 'View Details',
  },
  {
    key: 'delayed', label: 'Delayed Orders', value: '5', icon: WarningAmberIcon, color: 'error',
    link: 'View Details', valueColor: 'error.main',
  },
  {
    key: 'utilization', label: 'Machine Utilization', value: '72 %', icon: SettingsSuggestIcon, color: 'secondary',
    progress: 72,
  },
  {
    key: 'rejection', label: 'Rejection Rate', value: '2.8 %', icon: VerifiedUserOutlinedIcon, color: 'warning',
    progress: 2.8,
  },
];

const ORDER_STATUS_DATA = [
  { name: 'In Progress', value: 18, color: '#4caf50' },
  { name: 'Completed', value: 4, color: '#2196f3' },
  { name: 'On Hold', value: 2, color: '#ff9800' },
  { name: 'Cancelled', value: 0, color: '#f44336' },
];

const PLANNED_VS_COMPLETED = [
  { week: 'W1', planned: 3200, completed: 2600 },
  { week: 'W2', planned: 3600, completed: 2900 },
  { week: 'W3', planned: 3900, completed: 3100 },
  { week: 'W4', planned: 4300, completed: 3500 },
  { week: 'W5', planned: 3700, completed: 2900 },
];

const PRODUCTION_TREND = [
  { month: 'Apr', produced: 2050, rejected: 60 },
  { month: 'May', produced: 2400, rejected: 70 },
  { month: 'Jun', produced: 2700, rejected: 65 },
  { month: 'Jul', produced: 3000, rejected: 80 },
  { month: 'Aug', produced: 3350, rejected: 75 },
  { month: 'Sep', produced: 3700, rejected: 70 },
];

const TOP_ORDERS = [
  { po: 'PO-2026-001', item: 'Gear Housing', planned: 2000, completed: 1500, status: 'In Progress', statusColor: 'info', due: '05-Oct-2026', dueColor: 'text.primary', progress: 75 },
  { po: 'PO-2026-002', item: 'Motor Bracket', planned: 1500, completed: 1500, status: 'Completed', statusColor: 'primary', due: '03-Oct-2026', dueColor: 'text.primary', progress: 100 },
  { po: 'PO-2026-003', item: 'Shaft Assembly', planned: 1000, completed: 200, status: 'In Progress', statusColor: 'info', due: '10-Oct-2026', dueColor: 'text.primary', progress: 20 },
  { po: 'PO-2026-004', item: 'Pump Cover', planned: 500, completed: 0, status: 'On Hold', statusColor: 'warning', due: '12-Oct-2026', dueColor: 'text.primary', progress: 0 },
  { po: 'PO-2026-005', item: 'Valve Body', planned: 2000, completed: 800, status: 'Delayed', statusColor: 'error', due: '28-Sep-2026', dueColor: 'error.main', progress: 40 },
];

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
  { type: 'Subcontracting QC', inspected: 2000, accepted: 1950, rejected: 50, pct: 2.5 },
  { type: 'Job Work QC', inspected: 1000, accepted: 980, rejected: 20, pct: 2.0 },
];

const PRODUCTION_ALERTS = [
  { level: 'error', message: 'PO-2026-005 is delayed (Due: 28-Sep-2026)', time: '2 hrs ago' },
  { level: 'error', message: 'Material shortage for Motor Bracket (300 Nos)', time: '3 hrs ago' },
  { level: 'warning', message: 'Machine CNC-02 utilization below 65%', time: '4 hrs ago' },
  { level: 'info', message: 'QC rejection higher for Pump Cover (5%)', time: '6 hrs ago' },
  { level: 'info', message: 'Subcontracting receipt pending for PO-2026-003', time: '8 hrs ago' },
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

export default function ProductionPlanningDashboard() {
  const [range] = useState('01-Oct-2026  -  31-Oct-2026');

  return (
    <Box>
      <EntityHeaderCard
        icon={<DashboardIcon />}
        title="Production Dashboard"
        subtitle="Real-time overview of production orders, material status, execution and quality."
        rightContent={(
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip label={range} variant="outlined" sx={{ fontWeight: 500 }} />
            <IconButton size="small" sx={{ border: '1px solid', borderColor: 'divider' }}>
              <RefreshIcon fontSize="small" />
            </IconButton>
            <Button variant="contained" color="warning" startIcon={<AddIcon />} endIcon={<KeyboardArrowDownIcon />} disabled>
              New Production Order
            </Button>
          </Stack>
        )}
      />

      {/* KPI row */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {KPI_CARDS.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Grid item xs={12} sm={6} md={4} lg={2} key={kpi.key}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1 }}>
                    <Avatar sx={{ bgcolor: `${kpi.color}.main`, width: 36, height: 36 }}>
                      <Icon fontSize="small" />
                    </Avatar>
                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                      {kpi.label}
                    </Typography>
                  </Stack>
                  <Typography variant="h5" fontWeight={700} color={kpi.valueColor}>
                    {kpi.value}{' '}
                    {kpi.unit && <Typography component="span" variant="body2" color="text.secondary">{kpi.unit}</Typography>}
                  </Typography>

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

                  {kpi.progress !== undefined && (
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(kpi.progress, 100)}
                      color={kpi.color === 'warning' || kpi.color === 'secondary' ? 'primary' : kpi.color}
                      sx={{ mt: 1.5, height: 6, borderRadius: 3 }}
                    />
                  )}

                  {kpi.link && (
                    <Typography variant="caption" color="primary.main" sx={{ display: 'block', mt: 1, cursor: 'pointer', fontWeight: 600 }}>
                      {kpi.link} →
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Charts row */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Production Order Status</Typography>
              <Box sx={{ position: 'relative', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={ORDER_STATUS_DATA} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                      {ORDER_STATUS_DATA.map((d) => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                  <Typography variant="h5" fontWeight={700}>24</Typography>
                  <Typography variant="caption" color="text.secondary">Orders</Typography>
                </Box>
              </Box>
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {ORDER_STATUS_DATA.map((d) => {
                  const total = ORDER_STATUS_DATA.reduce((s, x) => s + x.value, 0);
                  const pct = total ? Math.round((d.value / total) * 100) : 0;
                  return (
                    <Stack key={d.name} direction="row" alignItems="center" spacing={1}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: d.color }} />
                      <Typography variant="body2" sx={{ flex: 1 }}>{d.name}</Typography>
                      <Typography variant="body2" color="text.secondary">{d.value} ({pct}%)</Typography>
                    </Stack>
                  );
                })}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Planned vs Completed Quantity</Typography>
              <Box sx={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={PLANNED_VS_COMPLETED}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <RechartsTooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="planned" name="Planned Qty" fill="#bdbdbd" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="completed" name="Completed Qty" fill="#ff9800" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Production Trend (Last 6 Months)</Typography>
              <Box sx={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={PRODUCTION_TREND}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <RechartsTooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="produced" name="Produced Qty" stroke="#ff9800" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="rejected" name="Rejection Qty" stroke="#f44336" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tables row */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={7}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, pt: 2, pb: 1 }}>
              <Typography variant="subtitle1" fontWeight={700}>Top 5 Production Orders (by Priority / Status)</Typography>
              <Typography variant="body2" color="primary.main" fontWeight={600} sx={{ cursor: 'pointer' }}>View All →</Typography>
            </Stack>
            <ScrollableTableContainer maxHeight="none">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>PO No</TableCell>
                    <TableCell>Item</TableCell>
                    <TableCell align="right">Planned Qty</TableCell>
                    <TableCell align="right">Completed Qty</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Due Date</TableCell>
                    <TableCell>Progress</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {TOP_ORDERS.map((o) => (
                    <TableRow key={o.po} hover>
                      <TableCell>
                        <Typography variant="body2" color="primary.main" fontWeight={600}>{o.po}</Typography>
                      </TableCell>
                      <TableCell>{o.item}</TableCell>
                      <TableCell align="right">{numberFmt(o.planned)}</TableCell>
                      <TableCell align="right">{numberFmt(o.completed)}</TableCell>
                      <TableCell><Chip size="small" label={o.status} color={o.statusColor} variant="outlined" /></TableCell>
                      <TableCell><Typography variant="body2" color={o.dueColor}>{o.due}</Typography></TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <LinearProgress variant="determinate" value={o.progress} sx={{ flex: 1, height: 6, borderRadius: 3 }} />
                          <Typography variant="caption" color="text.secondary">{o.progress}%</Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTableContainer>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, pt: 2, pb: 1 }}>
              <Typography variant="subtitle1" fontWeight={700}>Machine Utilization (Today)</Typography>
              <Typography variant="body2" color="primary.main" fontWeight={600} sx={{ cursor: 'pointer' }}>View All →</Typography>
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
                          <LinearProgress
                            variant="determinate"
                            value={m.pct}
                            color={m.pct < 65 ? 'warning' : 'success'}
                            sx={{ flex: 1, height: 6, borderRadius: 3 }}
                          />
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
      </Grid>

      {/* Bottom row */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, pt: 2, pb: 1 }}>
              <Typography variant="subtitle1" fontWeight={700}>Material Availability for Production</Typography>
              <Typography variant="body2" color="primary.main" fontWeight={600} sx={{ cursor: 'pointer' }}>View All →</Typography>
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
              <Typography variant="body2" color="primary.main" fontWeight={600} sx={{ cursor: 'pointer' }}>View All →</Typography>
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

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, pt: 2, pb: 1 }}>
              <Typography variant="subtitle1" fontWeight={700}>Production Alerts</Typography>
              <Typography variant="body2" color="primary.main" fontWeight={600} sx={{ cursor: 'pointer' }}>View All →</Typography>
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
