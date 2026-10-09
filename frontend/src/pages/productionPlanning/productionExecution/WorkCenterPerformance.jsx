import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Checkbox,
  Table, TableHead, TableBody, TableRow, TableCell, IconButton, Tooltip as MuiTooltip, Pagination,
} from '@mui/material';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
} from 'recharts';
import ListAltIcon from '@mui/icons-material/ListAlt';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import BarChartIcon from '@mui/icons-material/BarChart';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InsertChartIcon from '@mui/icons-material/InsertChart';
import SpeedIcon from '@mui/icons-material/Speed';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Work Center Performance" report screen --
// the dedicated drill-down reached from Production Execution > Reports >
// Work Center Performance. There is no reporting backend behind Production
// Execution in this schema, so this lays out the report exactly as
// designed with fixed mock data for a 01-Oct-2026 to 10-Oct-2026 window,
// following the same convention as the other static-mock screens in this
// module. Local state only (filters, selection, pagination) -- nothing
// here persists or calls the server.
// ---------------------------------------------------------------------------

const SUMMARY_TILES = [
  { label: 'Total Work Centers', sub: null, value: '12', color: 'info', icon: SettingsOutlinedIcon },
  { label: 'Planned Hours', sub: null, value: '5,200', color: 'success', icon: InsertChartIcon },
  { label: 'Actual Run Hours', sub: '86.3%', value: '4,485', color: 'info', icon: CheckCircleIcon },
  { label: 'Utilization %', sub: null, value: '72.5%', color: 'error', icon: BarChartIcon },
  { label: 'OEE %', sub: null, value: '92.4%', color: 'secondary', icon: SpeedIcon },
  { label: 'Rejection %', sub: null, value: '5.6%', color: 'error', icon: WarningAmberIcon },
  { label: 'Avg. Cycle Time', sub: '(Hours)', value: '1.2', color: 'warning', icon: AccessTimeIcon },
];

const UTILIZATION = [
  { name: 'WC-01 - Machining', pct: 92, color: '#1976d2' },
  { name: 'WC-02 - Drilling', pct: 85, color: '#2e7d32' },
  { name: 'WC-03 - Assembly', pct: 78, color: '#f9a825' },
  { name: 'WC-04 - Painting', pct: 65, color: '#ef6c00' },
  { name: 'WC-05 - Testing', pct: 58, color: '#e53935' },
];

const PRODUCTION_QTY = [
  { wc: 'WC-01', planned: 1000, completed: 980 },
  { wc: 'WC-02', planned: 1700, completed: 1420 },
  { wc: 'WC-03', planned: 900, completed: 760 },
  { wc: 'WC-04', planned: 700, completed: 580 },
  { wc: 'WC-05', planned: 450, completed: 380 },
];

const OEE = [
  { name: 'WC-01 - Machining', pct: 98, color: '#1976d2' },
  { name: 'WC-02 - Drilling', pct: 82, color: '#2e7d32' },
  { name: 'WC-03 - Assembly', pct: 76, color: '#f9a825' },
  { name: 'WC-04 - Painting', pct: 68, color: '#ef6c00' },
  { name: 'WC-05 - Testing', pct: 55, color: '#e53935' },
];

const DOWNTIME_PIE = [
  { name: 'Machine Breakdown', pct: 42, color: '#e53935' },
  { name: 'Setup/Changeover', pct: 25, color: '#f9a825' },
  { name: 'Material Shortage', pct: 15, color: '#1976d2' },
  { name: 'Quality Issue', pct: 10, color: '#2e7d32' },
  { name: 'Others', pct: 8, color: '#8e24aa' },
];
const DOWNTIME_TOTAL_HOURS = 320;

const TOP_OUTPUT = [
  { name: 'WC-01 - Machining', qty: 1850, color: '#1976d2' },
  { name: 'WC-02 - Drilling', qty: 1420, color: '#2e7d32' },
  { name: 'WC-03 - Assembly', qty: 1200, color: '#f9a825' },
  { name: 'WC-04 - Painting', qty: 980, color: '#ef6c00' },
  { name: 'WC-05 - Testing', qty: 750, color: '#e53935' },
];

const TOP_DOWNTIME = [
  { name: 'WC-04 - Painting', hrs: 85, color: '#e53935' },
  { name: 'WC-03 - Assembly', hrs: 70, color: '#ef6c00' },
  { name: 'WC-02 - Drilling', hrs: 60, color: '#f9a825' },
  { name: 'WC-05 - Testing', hrs: 55, color: '#1976d2' },
  { name: 'WC-01 - Machining', hrs: 40, color: '#2e7d32' },
];

const DETAILS = [
  { no: 1, wc: 'WC-01', desc: 'Machining', plannedHrs: 800, actualHrs: 740, util: 92.5, plannedQty: 1000, completedQty: 980, oee: 88.0, rejection: 3.2, downtime: 40, reason: 'Tool Change' },
  { no: 2, wc: 'WC-02', desc: 'Drilling', plannedHrs: 800, actualHrs: 680, util: 85.0, plannedQty: 1200, completedQty: 1150, oee: 82.0, rejection: 4.5, downtime: 60, reason: 'Machine Breakdown' },
  { no: 3, wc: 'WC-03', desc: 'Assembly', plannedHrs: 800, actualHrs: 620, util: 77.5, plannedQty: 800, completedQty: 760, oee: 76.0, rejection: 5.0, downtime: 70, reason: 'Material Shortage' },
  { no: 4, wc: 'WC-04', desc: 'Painting', plannedHrs: 800, actualHrs: 520, util: 65.0, plannedQty: 600, completedQty: 580, oee: 68.0, rejection: 6.8, downtime: 85, reason: 'Quality Rework' },
  { no: 5, wc: 'WC-05', desc: 'Testing', plannedHrs: 800, actualHrs: 460, util: 57.5, plannedQty: 400, completedQty: 380, oee: 55.0, rejection: 7.5, downtime: 55, reason: 'Equipment Issue' },
];

const TOTAL_RECORDS = 12;
const TOTAL_PAGES = 2;

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

export default function WorkCenterPerformance() {
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [fromDate, setFromDate] = useState('2026-10-01');
  const [toDate, setToDate] = useState('2026-10-10');
  const [plant, setPlant] = useState('All');
  const [workCenter, setWorkCenter] = useState('All');
  const [poSearch, setPoSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [itemGroup, setItemGroup] = useState('All');
  const [operation, setOperation] = useState('All');
  const [shift, setShift] = useState('All');
  const [machine, setMachine] = useState('All');
  const [show, setShow] = useState('Summary & Details');

  const handleReset = () => {
    setFromDate('2026-10-01');
    setToDate('2026-10-10');
    setPlant('All');
    setWorkCenter('All');
    setPoSearch('');
    setItemSearch('');
    setItemGroup('All');
    setOperation('All');
    setShift('All');
    setMachine('All');
    setShow('Summary & Details');
  };

  const toggleAll = (e) => setSelected(e.target.checked ? DETAILS.map((d) => d.wc) : []);
  const toggleOne = (key) => setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const maxOutput = Math.max(...TOP_OUTPUT.map((t) => t.qty));
  const maxDowntime = Math.max(...TOP_DOWNTIME.map((t) => t.hrs));

  return (
    <Box>
      <EntityHeaderCard
        icon={<ListAltIcon />}
        title="Work Center Performance"
        subtitle="Analyze work center utilization, productivity, efficiency and production performance."
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
                {UTILIZATION.map((w) => <MenuItem key={w.name} value={w.name}>{w.name}</MenuItem>)}
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
                fullWidth size="small" label="Item Code" placeholder="Search Item..."
                value={itemSearch} onChange={(e) => setItemSearch(e.target.value)}
                InputProps={{ endAdornment: <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} /> }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={2.5}>
              <TextField fullWidth size="small" select label="Item Group" value={itemGroup} onChange={(e) => setItemGroup(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Finished Goods">Finished Goods</MenuItem>
                <MenuItem value="Sub Assembly">Sub Assembly</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField fullWidth size="small" select label="Operation" value={operation} onChange={(e) => setOperation(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="OP-10 - Machining">OP-10 - Machining</MenuItem>
                <MenuItem value="OP-20 - Drilling">OP-20 - Drilling</MenuItem>
              </TextField>
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
              <TextField fullWidth size="small" select label="Machine" value={machine} onChange={(e) => setMachine(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="MC-01">MC-01</MenuItem>
                <MenuItem value="MC-02">MC-02</MenuItem>
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
              return (
                <Grid item xs={6} sm={4} md={1.71} key={t.label}>
                  <Stack alignItems="center" spacing={0.5} sx={{ bgcolor: `${t.color}.lighter`, borderRadius: 2, py: 2, px: 1 }}>
                    <Icon color={t.color} />
                    <Typography variant="h6" fontWeight={700}>{t.value}</Typography>
                    <Typography variant="caption" color="text.secondary" textAlign="center">{t.label}</Typography>
                    {t.sub && <Typography variant="caption" color="text.secondary">{t.sub}</Typography>}
                  </Stack>
                </Grid>
              );
            })}
          </Grid>
        </CardContent>
      </Card>

      {/* Charts row 1 */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} lg={4}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Work Center Utilization (%)</Typography>
          <Card variant="outlined">
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={UTILIZATION} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="pct" radius={[0, 4, 4, 0]} barSize={16}>
                    {UTILIZATION.map((u) => <Cell key={u.name} fill={u.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Production Quantity by Work Center</Typography>
          <Card variant="outlined">
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={PRODUCTION_QTY} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="wc" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 2000]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="planned" name="Planned Qty" fill="#1976d2" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="completed" name="Completed Qty" fill="#2e7d32" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>OEE by Work Center</Typography>
          <Card variant="outlined">
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={OEE} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="pct" radius={[0, 4, 4, 0]} barSize={16}>
                    {OEE.map((o) => <Cell key={o.name} fill={o.color} />)}
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
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Downtime Analysis (Hours)</Typography>
          <Card variant="outlined">
            <CardContent sx={{ position: 'relative' }}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={DOWNTIME_PIE} dataKey="pct" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {DOWNTIME_PIE.map((s) => <Cell key={s.name} fill={s.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `${v}%`} />
                </PieChart>
              </ResponsiveContainer>
              <Box sx={{ position: 'absolute', top: '34%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <Typography variant="h6" fontWeight={700}>{numberFmt(DOWNTIME_TOTAL_HOURS)}</Typography>
                <Typography variant="caption" color="text.secondary">Total Hours</Typography>
              </Box>
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {DOWNTIME_PIE.map((s) => (
                  <Stack key={s.name} direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: s.color }} />
                    <Typography variant="body2" sx={{ flex: 1 }}>{s.name}</Typography>
                    <Typography variant="body2" fontWeight={600}>{s.pct}%</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Top 5 Work Centers by Output Quantity</Typography>
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={1.5}>
                {TOP_OUTPUT.map((t) => (
                  <Box key={t.name}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="body2">{t.name}</Typography>
                      <Typography variant="body2" fontWeight={600}>{numberFmt(t.qty)}</Typography>
                    </Stack>
                    <Box sx={{ height: 10, borderRadius: 1, bgcolor: 'action.hover', overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${(t.qty / maxOutput) * 100}%`, bgcolor: t.color, borderRadius: 1 }} />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Top 5 Work Centers by Downtime</Typography>
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={1.5}>
                {TOP_DOWNTIME.map((t) => (
                  <Box key={t.name}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="body2">{t.name}</Typography>
                      <Typography variant="body2" fontWeight={600}>{t.hrs}</Typography>
                    </Stack>
                    <Box sx={{ height: 10, borderRadius: 1, bgcolor: 'action.hover', overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${(t.hrs / maxDowntime) * 100}%`, bgcolor: t.color, borderRadius: 1 }} />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Work Center Performance Details */}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Work Center Performance Details ({numberFmt(TOTAL_RECORDS)} records)</Typography>
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
                  <TableCell>Work Center</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Planned Hours</TableCell>
                  <TableCell align="right">Actual Run Hours</TableCell>
                  <TableCell align="right">Utilization %</TableCell>
                  <TableCell align="right">Planned Qty</TableCell>
                  <TableCell align="right">Completed Qty</TableCell>
                  <TableCell align="right">Variance Qty</TableCell>
                  <TableCell align="right">OEE %</TableCell>
                  <TableCell align="right">Rejection %</TableCell>
                  <TableCell align="right">Downtime (Hrs)</TableCell>
                  <TableCell>Major Downtime Reason</TableCell>
                  <TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {DETAILS.map((d) => {
                  const variance = d.completedQty - d.plannedQty;
                  return (
                    <TableRow key={d.wc} hover selected={selected.includes(d.wc)}>
                      <TableCell padding="checkbox">
                        <Checkbox size="small" checked={selected.includes(d.wc)} onChange={() => toggleOne(d.wc)} />
                      </TableCell>
                      <TableCell>{d.no}</TableCell>
                      <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{d.wc}</Typography></TableCell>
                      <TableCell>{d.desc}</TableCell>
                      <TableCell align="right">{numberFmt(d.plannedHrs)}</TableCell>
                      <TableCell align="right">{numberFmt(d.actualHrs)}</TableCell>
                      <TableCell align="right">{d.util.toFixed(1)}%</TableCell>
                      <TableCell align="right">{numberFmt(d.plannedQty)}</TableCell>
                      <TableCell align="right">{numberFmt(d.completedQty)}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color={variance < 0 ? 'error.main' : 'text.primary'} fontWeight={600}>{variance}</Typography>
                      </TableCell>
                      <TableCell align="right">{d.oee.toFixed(1)}%</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="error.main" fontWeight={600}>{d.rejection.toFixed(1)}%</Typography>
                      </TableCell>
                      <TableCell align="right">{d.downtime}</TableCell>
                      <TableCell>{d.reason}</TableCell>
                      <TableCell align="center">
                        <MuiTooltip title="View">
                          <IconButton size="small"><VisibilityOutlinedIcon fontSize="small" /></IconButton>
                        </MuiTooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
