import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Chip, Checkbox,
  Table, TableHead, TableBody, TableRow, TableCell, IconButton, Tooltip as MuiTooltip, Pagination,
} from '@mui/material';
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, PieChart, Pie, Cell,
} from 'recharts';
import ListAltIcon from '@mui/icons-material/ListAlt';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import GroupsIcon from '@mui/icons-material/Groups';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import CancelIcon from '@mui/icons-material/Cancel';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Operator Productivity" report screen -- the
// dedicated drill-down reached from Production Execution > Reports >
// Operator Productivity. There is no reporting backend behind Production
// Execution in this schema, so this lays out the report exactly as
// designed with fixed mock data for a 01-Oct-2026 to 10-Oct-2026 window,
// following the same convention as the other static-mock screens in this
// module. Local state only (filters, selection, pagination) -- nothing
// here persists or calls the server. Only the first page of the mocked
// "38 records" is actually rendered as row data; the rest is represented
// by the (static) pagination control, same as the reference design.
// ---------------------------------------------------------------------------

const SUMMARY_TILES = [
  { label: 'Total Operators', sub: 'vs Previous Period', trend: '5.6%', up: true, value: '38', color: 'info', icon: GroupsIcon },
  { label: 'Total Output Qty', sub: null, trend: '12.4%', up: true, value: '4,850', color: 'success', icon: SettingsSuggestIcon },
  { label: 'Avg. Productivity', sub: '(of Standard)', trend: '6.2%', up: true, value: '92.5%', color: 'info', icon: GpsFixedIcon },
  { label: 'Utilization %', sub: null, trend: '4.1%', up: true, value: '85.3%', color: 'warning', icon: TrackChangesIcon },
  { label: 'Rejection %', sub: null, trend: '1.1%', up: false, value: '3.2%', color: 'error', icon: CancelIcon },
  { label: 'Avg. Cycle Time', sub: '(Min)', trend: '8.2%', up: false, value: '7.8', color: 'secondary', icon: AccessTimeIcon },
];

const TREND = [
  { date: '01-Oct', output: 420, pct: 68 },
  { date: '02-Oct', output: 480, pct: 72 },
  { date: '03-Oct', output: 440, pct: 65 },
  { date: '04-Oct', output: 520, pct: 78 },
  { date: '05-Oct', output: 560, pct: 75 },
  { date: '06-Oct', output: 600, pct: 82 },
  { date: '07-Oct', output: 650, pct: 88 },
  { date: '08-Oct', output: 700, pct: 85 },
  { date: '09-Oct', output: 760, pct: 90 },
  { date: '10-Oct', output: 820, pct: 92 },
];

const OUTPUT_BY_OPERATOR = [
  { name: 'Ravi Kumar', qty: 820, color: '#1976d2' },
  { name: 'Suresh', qty: 680, color: '#2e7d32' },
  { name: 'Mani', qty: 620, color: '#ef6c00' },
  { name: 'Kumar', qty: 580, color: '#f9a825' },
  { name: 'Prakash', qty: 520, color: '#8e24aa' },
];

const PRODUCTIVITY_BY_WC = [
  { name: 'WC-01 - Machining', pct: 98, color: '#1976d2' },
  { name: 'WC-02 - Drilling', pct: 92, color: '#2e7d32' },
  { name: 'WC-03 - Assembly', pct: 86, color: '#f9a825' },
  { name: 'WC-04 - Painting', pct: 78, color: '#ef6c00' },
  { name: 'WC-05 - Testing', pct: 72, color: '#e53935' },
];

const STATUS_PIE = [
  { name: 'Active', value: 30, pct: 78.9, color: '#2e7d32' },
  { name: 'On Training', value: 3, pct: 7.9, color: '#f9a825' },
  { name: 'On Leave', value: 2, pct: 5.3, color: '#ef6c00' },
  { name: 'Inactive', value: 3, pct: 7.9, color: '#e53935' },
];
const STATUS_TOTAL = STATUS_PIE.reduce((sum, s) => sum + s.value, 0);

const UTILIZATION_HOURS = [
  { name: 'Ravi', available: 80, actual: 75 },
  { name: 'Suresh', available: 80, actual: 72 },
  { name: 'Mani', available: 80, actual: 68 },
  { name: 'Kumar', available: 80, actual: 65 },
  { name: 'Prakash', available: 80, actual: 60 },
];

const REJECTION_BY_OPERATOR = [
  { name: 'Suresh', pct: 5.2, color: '#e53935' },
  { name: 'Mani', pct: 4.1, color: '#ef6c00' },
  { name: 'Kumar', pct: 3.5, color: '#f9a825' },
  { name: 'Ravi', pct: 2.5, color: '#2e7d32' },
  { name: 'Prakash', pct: 1.8, color: '#1976d2' },
];

const DETAILS = [
  { no: 1, code: 'OP-001', name: 'Ravi Kumar', workCenter: 'WC-01', shift: 'Shift A', plannedHrs: 8.0, actualHrs: 7.5, util: 93.8, standardQty: 800, actualQty: 820, productivity: 102.5, rejectionQty: 15, rejectionPct: 1.8, status: 'Active' },
  { no: 2, code: 'OP-002', name: 'Suresh', workCenter: 'WC-02', shift: 'Shift A', plannedHrs: 8.0, actualHrs: 7.2, util: 90.0, standardQty: 700, actualQty: 680, productivity: 97.1, rejectionQty: 28, rejectionPct: 4.1, status: 'Active' },
  { no: 3, code: 'OP-003', name: 'Mani', workCenter: 'WC-03', shift: 'Shift B', plannedHrs: 8.0, actualHrs: 6.8, util: 85.0, standardQty: 650, actualQty: 620, productivity: 95.4, rejectionQty: 25, rejectionPct: 4.0, status: 'Active' },
  { no: 4, code: 'OP-004', name: 'Kumar', workCenter: 'WC-04', shift: 'Shift B', plannedHrs: 8.0, actualHrs: 6.5, util: 81.3, standardQty: 600, actualQty: 580, productivity: 96.7, rejectionQty: 20, rejectionPct: 3.4, status: 'Active' },
  { no: 5, code: 'OP-005', name: 'Prakash', workCenter: 'WC-05', shift: 'Shift C', plannedHrs: 8.0, actualHrs: 6.0, util: 75.0, standardQty: 550, actualQty: 520, productivity: 94.5, rejectionQty: 10, rejectionPct: 1.9, status: 'Active' },
];

const STATUS_COLOR = { Active: 'success' };
const TOTAL_RECORDS = 38;
const TOTAL_PAGES = 4;

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

export default function OperatorProductivity() {
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [fromDate, setFromDate] = useState('2026-10-01');
  const [toDate, setToDate] = useState('2026-10-10');
  const [plant, setPlant] = useState('All');
  const [workCenter, setWorkCenter] = useState('All');
  const [poSearch, setPoSearch] = useState('');
  const [operatorSearch, setOperatorSearch] = useState('');
  const [shift, setShift] = useState('All');
  const [skillType, setSkillType] = useState('All');
  const [itemGroup, setItemGroup] = useState('All');
  const [status, setStatus] = useState('All');
  const [show, setShow] = useState('Summary & Details');

  const handleReset = () => {
    setFromDate('2026-10-01');
    setToDate('2026-10-10');
    setPlant('All');
    setWorkCenter('All');
    setPoSearch('');
    setOperatorSearch('');
    setShift('All');
    setSkillType('All');
    setItemGroup('All');
    setStatus('All');
    setShow('Summary & Details');
  };

  const toggleAll = (e) => setSelected(e.target.checked ? DETAILS.map((d) => d.code) : []);
  const toggleOne = (key) => setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const maxOutput = Math.max(...OUTPUT_BY_OPERATOR.map((o) => o.qty));

  return (
    <Box>
      <EntityHeaderCard
        icon={<ListAltIcon />}
        title="Operator Productivity"
        subtitle="Analyze operator-wise production output, efficiency, utilization and performance."
        rightContent={
          <Stack direction="row" spacing={1.5}>
            <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} endIcon={<ArrowDropDownIcon />}>Export</Button>
            <Button variant="outlined" startIcon={<PrintOutlinedIcon />}>Print</Button>
            <Button variant="outlined" startIcon={<SettingsOutlinedIcon />}>Set As Default</Button>
          </Stack>
        }
      />

      {/* Filter Criteria */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Filter Criteria</Typography>
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" type="date" label="From Date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" type="date" label="To Date" value={toDate} onChange={(e) => setToDate(e.target.value)} InputLabelProps={{ shrink: true }} />
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
                {PRODUCTIVITY_BY_WC.map((w) => <MenuItem key={w.name} value={w.name}>{w.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" label="Production Order No." placeholder="Search PO..."
                value={poSearch} onChange={(e) => setPoSearch(e.target.value)}
                InputProps={{ endAdornment: <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} /> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" label="Operator" placeholder="Search Operator..."
                value={operatorSearch} onChange={(e) => setOperatorSearch(e.target.value)}
                InputProps={{ endAdornment: <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} /> }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={2.5}>
              <TextField fullWidth size="small" select label="Shift" value={shift} onChange={(e) => setShift(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Shift A">Shift A</MenuItem>
                <MenuItem value="Shift B">Shift B</MenuItem>
                <MenuItem value="Shift C">Shift C</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField fullWidth size="small" select label="Skill Type" value={skillType} onChange={(e) => setSkillType(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Skilled">Skilled</MenuItem>
                <MenuItem value="Semi-Skilled">Semi-Skilled</MenuItem>
                <MenuItem value="Unskilled">Unskilled</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField fullWidth size="small" select label="Item Group" value={itemGroup} onChange={(e) => setItemGroup(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Finished Goods">Finished Goods</MenuItem>
                <MenuItem value="Sub Assembly">Sub Assembly</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="On Training">On Training</MenuItem>
                <MenuItem value="On Leave">On Leave</MenuItem>
                <MenuItem value="Inactive">Inactive</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Show" value={show} onChange={(e) => setShow(e.target.value)}>
                <MenuItem value="Summary & Details">Summary & Details</MenuItem>
                <MenuItem value="Summary Only">Summary Only</MenuItem>
                <MenuItem value="Details Only">Details Only</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <Stack direction="row" spacing={1.5}>
                <Button fullWidth variant="outlined" onClick={handleReset}>Reset</Button>
                <Button fullWidth variant="contained" startIcon={<SearchIcon />}>Search</Button>
              </Stack>
            </Grid>
          </Grid>

          {/* Summary tiles */}
          <Grid container spacing={1.5}>
            {SUMMARY_TILES.map((t) => {
              const Icon = t.icon;
              const TrendIcon = t.up ? ArrowUpwardIcon : ArrowDownwardIcon;
              const trendColor = t.up ? 'success.main' : 'success.main';
              return (
                <Grid item xs={6} sm={4} md={2} key={t.label}>
                  <Stack alignItems="center" spacing={0.5} sx={{ bgcolor: `${t.color}.lighter`, borderRadius: 2, py: 2, px: 1 }}>
                    <Icon color={t.color} />
                    <Typography variant="h6" fontWeight={700}>{t.value}</Typography>
                    <Typography variant="caption" color="text.secondary" textAlign="center">{t.label}</Typography>
                    {t.sub && <Typography variant="caption" color="text.secondary" textAlign="center">{t.sub}</Typography>}
                    <Stack direction="row" alignItems="center" spacing={0.25}>
                      <TrendIcon sx={{ fontSize: 14, color: trendColor }} />
                      <Typography variant="caption" fontWeight={600} color={trendColor}>{t.trend}</Typography>
                    </Stack>
                  </Stack>
                </Grid>
              );
            })}
          </Grid>
        </CardContent>
      </Card>

      {/* Charts row 1 */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} lg={5}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Operator Productivity Trend</Typography>
          <Card variant="outlined">
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={TREND} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: 'Output Qty', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="output" name="Output Qty" fill="#1976d2" radius={[3, 3, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="pct" name="Productivity %" stroke="#2e7d32" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Output by Operator (Top 5)</Typography>
          <Card variant="outlined">
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={OUTPUT_BY_OPERATOR} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 1000]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="qty" radius={[0, 4, 4, 0]} barSize={16}>
                    {OUTPUT_BY_OPERATOR.map((o) => <Cell key={o.name} fill={o.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={3}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Productivity by Work Center</Typography>
          <Card variant="outlined">
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={PRODUCTIVITY_BY_WC} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="pct" radius={[0, 4, 4, 0]} barSize={16}>
                    {PRODUCTIVITY_BY_WC.map((w) => <Cell key={w.name} fill={w.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts row 2 */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} lg={4}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Operator Status Distribution</Typography>
          <Card variant="outlined">
            <CardContent sx={{ position: 'relative' }}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={STATUS_PIE} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {STATUS_PIE.map((s) => <Cell key={s.name} fill={s.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <Box sx={{ position: 'absolute', top: '34%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <Typography variant="h5" fontWeight={700}>{numberFmt(STATUS_TOTAL)}</Typography>
                <Typography variant="caption" color="text.secondary">Total Operators</Typography>
              </Box>
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {STATUS_PIE.map((s) => (
                  <Stack key={s.name} direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: s.color }} />
                    <Typography variant="body2" sx={{ flex: 1 }}>{s.name}</Typography>
                    <Typography variant="body2" fontWeight={600}>{s.value} ({s.pct}%)</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Utilization Analysis (Hours)</Typography>
          <Card variant="outlined">
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={UTILIZATION_HOURS} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="available" name="Available Hours" fill="#1976d2" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actual" name="Actual Hours" fill="#2e7d32" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Rejection Analysis by Operator</Typography>
          <Card variant="outlined">
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={REJECTION_BY_OPERATOR} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 6]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="pct" radius={[0, 4, 4, 0]} barSize={16}>
                    {REJECTION_BY_OPERATOR.map((r) => <Cell key={r.name} fill={r.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Operator Productivity Details */}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Operator Productivity Details ({numberFmt(TOTAL_RECORDS)} records)</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary">Records per page</Typography>
              <TextField select size="small" value={rowsPerPage} onChange={(e) => setRowsPerPage(e.target.value)} sx={{ width: 80 }}>
                <MenuItem value={10}>10</MenuItem>
                <MenuItem value={25}>25</MenuItem>
                <MenuItem value={50}>50</MenuItem>
              </TextField>
            </Stack>
          </Stack>
          <ScrollableTableContainer maxHeight="clamp(220px, calc(100vh - 760px), 360px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={selected.length === DETAILS.length}
                      indeterminate={selected.length > 0 && selected.length < DETAILS.length}
                      onChange={toggleAll}
                    />
                  </TableCell>
                  <TableCell>S.No</TableCell>
                  <TableCell>Operator Code</TableCell>
                  <TableCell>Operator Name</TableCell>
                  <TableCell>Work Center</TableCell>
                  <TableCell>Shift</TableCell>
                  <TableCell align="right">Planned Hours</TableCell>
                  <TableCell align="right">Actual Hours</TableCell>
                  <TableCell align="right">Utilization %</TableCell>
                  <TableCell align="right">Standard Qty</TableCell>
                  <TableCell align="right">Actual Qty</TableCell>
                  <TableCell align="right">Productivity %</TableCell>
                  <TableCell align="right">Rejection Qty</TableCell>
                  <TableCell align="right">Rejection %</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {DETAILS.map((d) => (
                  <TableRow key={d.code} hover selected={selected.includes(d.code)}>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={selected.includes(d.code)} onChange={() => toggleOne(d.code)} />
                    </TableCell>
                    <TableCell>{d.no}</TableCell>
                    <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{d.code}</Typography></TableCell>
                    <TableCell>{d.name}</TableCell>
                    <TableCell>{d.workCenter}</TableCell>
                    <TableCell>{d.shift}</TableCell>
                    <TableCell align="right">{d.plannedHrs.toFixed(1)}</TableCell>
                    <TableCell align="right">{d.actualHrs.toFixed(1)}</TableCell>
                    <TableCell align="right">{d.util.toFixed(1)}%</TableCell>
                    <TableCell align="right">{numberFmt(d.standardQty)}</TableCell>
                    <TableCell align="right">{numberFmt(d.actualQty)}</TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="success.main" fontWeight={600}>{d.productivity.toFixed(1)}%</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="error.main" fontWeight={600}>{d.rejectionQty}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="error.main" fontWeight={600}>{d.rejectionPct.toFixed(1)}%</Typography>
                    </TableCell>
                    <TableCell><Chip size="small" label={d.status} color={STATUS_COLOR[d.status]} /></TableCell>
                    <TableCell align="center">
                      <MuiTooltip title="View">
                        <IconButton size="small"><VisibilityOutlinedIcon fontSize="small" /></IconButton>
                      </MuiTooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTableContainer>
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
            <Pagination count={TOTAL_PAGES} page={page} onChange={(e, v) => setPage(v)} color="primary" />
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
