import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Chip, Paper,
  Table, TableHead, TableBody, TableRow, TableCell,
} from '@mui/material';
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, PieChart, Pie, Cell,
} from 'recharts';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import BarChartIcon from '@mui/icons-material/BarChart';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import RecyclingIcon from '@mui/icons-material/Recycling';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CancelIcon from '@mui/icons-material/Cancel';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the Production Execution "Reports" screen, built
// to match the reference design the user supplied. There is no reporting/
// analytics backend behind Production Execution in this schema, so this
// lays out the dashboard exactly as designed with fixed mock data for a
// single 01-Oct-2026 to 10-Oct-2026 window, consistent with the other
// static-mock screens in this module. Local state only (category/report
// type selection, filter fields) -- nothing here persists or calls the
// server.
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { key: 'overview', label: 'Production Overview', icon: BarChartIcon },
  { key: 'order', label: 'Production Order Report', icon: DescriptionOutlinedIcon },
  { key: 'consumption', label: 'Material Consumption', icon: Inventory2OutlinedIcon },
  { key: 'issue', label: 'Material Issue Report', icon: ReceiptLongOutlinedIcon },
  { key: 'rework', label: 'Rework & Scrap Report', icon: RecyclingIcon },
  { key: 'closure', label: 'Production Closure Report', icon: DoneAllIcon },
  { key: 'workcenter', label: 'Work Center Performance', icon: SettingsOutlinedIcon },
  { key: 'operator', label: 'Operator Productivity', icon: GroupsOutlinedIcon },
  { key: 'costing', label: 'Costing Report', icon: PaymentsOutlinedIcon },
];

// Category cards that have a dedicated drill-down screen built so far route
// there on click; the rest just switch the local "active" highlight until
// their own screens exist.
const CATEGORY_ROUTES = {
  order: '/production-execution/production-order-report',
  consumption: '/production-execution/material-consumption-report',
  issue: '/production-execution/material-issue-report',
  rework: '/production-execution/rework-scrap-report',
  closure: '/production-execution/production-closer-report',
  workcenter: '/production-execution/work-center-performance',
  operator: '/production-execution/operator-productivity',
  costing: '/production-execution/costing-report',
};

const SUMMARY = [
  { label: 'Production Orders', value: 8, trend: '+12%', trendLabel: 'vs Previous Period', color: 'info', icon: Inventory2Icon },
  { label: 'Completed', value: 4, trend: '+50%', trendLabel: 'Completion Rate', color: 'success', icon: CheckCircleIcon },
  { label: 'In Progress', value: 3, trend: '+37%', trendLabel: 'In Progress Rate', color: 'warning', icon: AutorenewIcon },
  { label: 'Not Completed', value: 1, trend: '+13%', trendLabel: 'Pending Rate', color: 'error', icon: CancelIcon },
];

const TREND = [
  { date: '01-Oct', planned: 400, completed: 250, pct: 62 },
  { date: '02-Oct', planned: 700, completed: 520, pct: 74 },
  { date: '03-Oct', planned: 500, completed: 380, pct: 76 },
  { date: '04-Oct', planned: 600, completed: 420, pct: 70 },
  { date: '05-Oct', planned: 450, completed: 300, pct: 67 },
  { date: '06-Oct', planned: 850, completed: 800, pct: 94 },
  { date: '07-Oct', planned: 600, completed: 480, pct: 80 },
  { date: '08-Oct', planned: 350, completed: 220, pct: 63 },
  { date: '09-Oct', planned: 400, completed: 270, pct: 68 },
  { date: '10-Oct', planned: 650, completed: 500, pct: 77 },
];

const ITEM_WISE = [
  { item: 'Gear Housing', planned: 500, completed: 480 },
  { item: 'Flange', planned: 400, completed: 0 },
  { item: 'Pump Cover', planned: 300, completed: 300 },
  { item: 'Shaft', planned: 350, completed: 220 },
  { item: 'Valve Body', planned: 200, completed: 100 },
];

const WORK_CENTERS = [
  { name: 'WC-01 - Machining', pct: 85 },
  { name: 'WC-02 - Drilling', pct: 70 },
  { name: 'WC-03 - Assembly', pct: 65 },
  { name: 'WC-04 - Painting', pct: 50 },
  { name: 'WC-05 - Testing', pct: 40 },
];

const STATUS_PIE = [
  { name: 'Completed', value: 480, pct: 48, color: '#2e7d32' },
  { name: 'In Progress', value: 370, pct: 37, color: '#ed6c02' },
  { name: 'Not Completed', value: 150, pct: 15, color: '#d32f2f' },
];
const STATUS_TOTAL = STATUS_PIE.reduce((sum, s) => sum + s.value, 0);

const ORDERS = [
  { no: 1, po: 'PO-2026-001', code: 'FG-1001', desc: 'Gear Housing', planned: 500, completed: 480, inProgress: 20, pending: 0, uom: 'Nos', start: '01-Oct-2026', due: '10-Oct-2026', status: 'Completed' },
  { no: 2, po: 'PO-2026-002', code: 'FG-1002', desc: 'Motor Bracket', planned: 1000, completed: 800, inProgress: 200, pending: 0, uom: 'Nos', start: '01-Oct-2026', due: '10-Oct-2026', status: 'In Progress' },
  { no: 3, po: 'PO-2026-003', code: 'FG-1003', desc: 'Pump Cover', planned: 300, completed: 300, inProgress: 0, pending: 0, uom: 'Nos', start: '02-Oct-2026', due: '10-Oct-2026', status: 'Completed' },
  { no: 4, po: 'PO-2026-004', code: 'FG-1004', desc: 'Valve Body', planned: 200, completed: 100, inProgress: 100, pending: 0, uom: 'Nos', start: '03-Oct-2026', due: '10-Oct-2026', status: 'In Progress' },
  { no: 5, po: 'PO-2026-005', code: 'FG-1005', desc: 'Flange', planned: 400, completed: 0, inProgress: 0, pending: 400, uom: 'Nos', start: '04-Oct-2026', due: '10-Oct-2026', status: 'Not Completed' },
];

const STATUS_COLOR = { Completed: 'success', 'In Progress': 'warning', 'Not Completed': 'error' };

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

export default function Reports() {
  const navigate = useNavigate();
  const [category, setCategory] = useState('overview');
  const [fromDate, setFromDate] = useState('2026-10-01');
  const [toDate, setToDate] = useState('2026-10-10');
  const [plant, setPlant] = useState('All');
  const [workCenter, setWorkCenter] = useState('All');
  const [productionOrder, setProductionOrder] = useState('All');
  const [itemCode, setItemCode] = useState('All');
  const [reportCategory, setReportCategory] = useState('Production Overview');
  const [reportType, setReportType] = useState('All');

  const handleReset = () => {
    setFromDate('2026-10-01');
    setToDate('2026-10-10');
    setPlant('All');
    setWorkCenter('All');
    setProductionOrder('All');
    setItemCode('All');
    setReportCategory('Production Overview');
    setReportType('All');
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<BarChartIcon />}
        title="Production Reports"
        subtitle="Analyze production performance, material consumption, productivity and cost."
        rightContent={
          <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />}>Export</Button>
        }
      />

      {/* Report Filters */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Report Filters</Typography>
          <Grid container spacing={2.5} alignItems="flex-end">
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" type="date" label="From Date"
                value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" type="date" label="To Date"
                value={toDate} onChange={(e) => setToDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Plant / Location" value={plant} onChange={(e) => setPlant(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Main Plant">Main Plant</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Work Center" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                {WORK_CENTERS.map((w) => <MenuItem key={w.name} value={w.name}>{w.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" select label="Production Order" value={productionOrder}
                onChange={(e) => setProductionOrder(e.target.value)}
                InputProps={{ endAdornment: <SearchIcon fontSize="small" sx={{ color: 'text.secondary', mr: 2 }} /> }}
              >
                <MenuItem value="All">All</MenuItem>
                {ORDERS.map((o) => <MenuItem key={o.po} value={o.po}>{o.po}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" select label="Item Code" value={itemCode}
                onChange={(e) => setItemCode(e.target.value)}
                InputProps={{ endAdornment: <SearchIcon fontSize="small" sx={{ color: 'text.secondary', mr: 2 }} /> }}
              >
                <MenuItem value="All">All</MenuItem>
                {ORDERS.map((o) => <MenuItem key={o.code} value={o.code}>{o.code}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Report Category" value={reportCategory} onChange={(e) => setReportCategory(e.target.value)}>
                <MenuItem value="Production Overview">Production Overview</MenuItem>
                <MenuItem value="Order Reports">Order Reports</MenuItem>
                <MenuItem value="Material Reports">Material Reports</MenuItem>
                <MenuItem value="Cost Reports">Cost Reports</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Report Type" value={reportType} onChange={(e) => setReportType(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Summary">Summary</MenuItem>
                <MenuItem value="Detailed">Detailed</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={12} md={6}>
              <Stack direction="row" spacing={1.5} justifyContent={{ md: 'flex-end' }}>
                <Button variant="outlined" onClick={handleReset}>Reset</Button>
                <Button variant="contained" startIcon={<SearchIcon />}>Search</Button>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Report category selector */}
      <Stack direction="row" spacing={1.5} sx={{ mb: 2, overflowX: 'auto', pb: 0.5 }}>
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const active = category === c.key;
          return (
            <Paper
              key={c.key}
              variant={active ? 'elevation' : 'outlined'}
              onClick={() => (CATEGORY_ROUTES[c.key] ? navigate(CATEGORY_ROUTES[c.key]) : setCategory(c.key))}
              sx={{
                flex: '0 0 auto',
                minWidth: 118,
                px: 2, py: 1.5,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: active ? 'primary.main' : 'background.paper',
                color: active ? 'primary.contrastText' : 'text.primary',
                borderColor: active ? 'primary.main' : 'divider',
              }}
            >
              <Icon fontSize="small" />
              <Typography variant="caption" display="block" sx={{ mt: 0.5, fontWeight: 600, lineHeight: 1.2 }}>
                {c.label}
              </Typography>
            </Paper>
          );
        })}
      </Stack>

      {/* Production Summary + Trend */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} lg={5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Production Summary</Typography>
            <Typography variant="caption" color="text.secondary">01-Oct-2026 to 10-Oct-2026</Typography>
          </Stack>
          <Grid container spacing={1.5}>
            {SUMMARY.map((s) => {
              const Icon = s.icon;
              return (
                <Grid item xs={6} key={s.label}>
                  <Stack spacing={0.5} sx={{ bgcolor: `${s.color}.lighter`, borderRadius: 2, p: 2 }}>
                    <Icon color={s.color} />
                    <Typography variant="h5" fontWeight={700}>{s.value}</Typography>
                    <Typography variant="body2" color="text.secondary">{s.label}</Typography>
                    <Typography variant="caption" color={`${s.color}.dark`} fontWeight={600}>
                      ↑ {s.trend} {s.trendLabel}
                    </Typography>
                  </Stack>
                </Grid>
              );
            })}
          </Grid>
        </Grid>

        <Grid item xs={12} lg={7}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Production Quantity Trend</Typography>
          <Card variant="outlined">
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={TREND} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="planned" name="Planned Qty" fill="#1976d2" radius={[3, 3, 0, 0]} />
                  <Bar yAxisId="left" dataKey="completed" name="Completed Qty" fill="#2e7d32" radius={[3, 3, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="pct" name="Completion %" stroke="#ed6c02" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Item Wise, Work Center, Status */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} lg={4}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Item Wise Production (Top 5)</Typography>
          <Card variant="outlined">
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={ITEM_WISE} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="item" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="planned" name="Planned Qty" fill="#1976d2" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="completed" name="Completed Qty" fill="#2e7d32" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Work Center Performance</Typography>
          <Card variant="outlined">
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={WORK_CENTERS} layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="pct" radius={[0, 4, 4, 0]} barSize={18}>
                    {WORK_CENTERS.map((w) => (
                      <Cell key={w.name} fill={w.pct >= 60 ? '#2e7d32' : '#ed6c02'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Production Status (Qty)</Typography>
          <Card variant="outlined">
            <CardContent sx={{ position: 'relative' }}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={STATUS_PIE} dataKey="value" nameKey="name"
                    innerRadius={65} outerRadius={95} paddingAngle={2}
                  >
                    {STATUS_PIE.map((s) => <Cell key={s.name} fill={s.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <Box sx={{ position: 'absolute', top: '42%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <Typography variant="h5" fontWeight={700}>{numberFmt(STATUS_TOTAL)}</Typography>
                <Typography variant="caption" color="text.secondary">Total Qty</Typography>
              </Box>
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {STATUS_PIE.map((s) => (
                  <Stack key={s.name} direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: s.color }} />
                    <Typography variant="body2" sx={{ flex: 1 }}>{s.name}</Typography>
                    <Typography variant="body2" fontWeight={600}>{numberFmt(s.value)} ({s.pct}%)</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Production Order Report table */}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Production Order Report</Typography>
            <Button size="small">View All</Button>
          </Stack>
          <ScrollableTableContainer maxHeight="clamp(200px, calc(100vh - 760px), 320px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>S.No</TableCell>
                  <TableCell>Production Order No.</TableCell>
                  <TableCell>Item Code</TableCell>
                  <TableCell>Item Description</TableCell>
                  <TableCell align="right">Planned Qty</TableCell>
                  <TableCell align="right">Completed Qty</TableCell>
                  <TableCell align="right">In Progress Qty</TableCell>
                  <TableCell align="right">Pending Qty</TableCell>
                  <TableCell>UOM</TableCell>
                  <TableCell>Start Date</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ORDERS.map((o) => (
                  <TableRow key={o.po} hover>
                    <TableCell>{o.no}</TableCell>
                    <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{o.po}</Typography></TableCell>
                    <TableCell>{o.code}</TableCell>
                    <TableCell>{o.desc}</TableCell>
                    <TableCell align="right">{numberFmt(o.planned)}</TableCell>
                    <TableCell align="right">{numberFmt(o.completed)}</TableCell>
                    <TableCell align="right">{numberFmt(o.inProgress)}</TableCell>
                    <TableCell align="right">{numberFmt(o.pending)}</TableCell>
                    <TableCell>{o.uom}</TableCell>
                    <TableCell>{o.start}</TableCell>
                    <TableCell>{o.due}</TableCell>
                    <TableCell><Chip size="small" label={o.status} color={STATUS_COLOR[o.status]} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
