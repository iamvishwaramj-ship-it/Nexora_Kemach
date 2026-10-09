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
import AssignmentIcon from '@mui/icons-material/Assignment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CancelIcon from '@mui/icons-material/Cancel';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Production Closer Report" screen -- the
// dedicated drill-down reached from Production Execution > Reports >
// Production Closer Report. There is no reporting backend behind
// Production Execution in this schema, so this lays out the report exactly
// as designed with fixed mock data for a 01-Oct-2026 to 10-Oct-2026 window,
// following the same convention as the other static-mock screens in this
// module. Local state only (filters, selection, pagination) -- nothing
// here persists or calls the server. Only the first page of the mocked
// "28 records" is actually rendered as row data; the rest is represented
// by the (static) pagination control, same as the reference design. Title
// kept as "Production Closer Report" (not "Closure") to match the
// reference image verbatim.
// ---------------------------------------------------------------------------

const SUMMARY_TILES = [
  { label: 'Total Production Orders', sub: '(Selected Period)', value: '28', color: 'info', icon: AssignmentIcon },
  { label: 'Closed Orders', sub: '78.6%', value: '22', color: 'success', icon: CheckCircleIcon },
  { label: 'In Progress', sub: '14.3%', value: '4', color: 'warning', icon: AutorenewIcon },
  { label: 'Not Closed', sub: '7.1%', value: '2', color: 'error', icon: CancelIcon },
  { label: 'Planned Quantity', sub: 'Nos / Kg / Ltr', value: '5,600', color: 'info', icon: Inventory2Icon },
  { label: 'Actual Quantity', sub: '93.4%  (Nos / Kg / Ltr)', value: '5,230', color: 'success', icon: Inventory2Icon },
  { label: 'Avg. Closure Delay', sub: 'Days', value: '1.8', color: 'secondary', icon: AccessTimeIcon },
];

const TREND = [
  { date: '01-Oct', planned: 400, actual: 380, pct: 60 },
  { date: '02-Oct', planned: 500, actual: 460, pct: 65 },
  { date: '03-Oct', planned: 550, actual: 520, pct: 70 },
  { date: '04-Oct', planned: 600, actual: 560, pct: 72 },
  { date: '05-Oct', planned: 700, actual: 650, pct: 85 },
  { date: '06-Oct', planned: 650, actual: 600, pct: 60 },
  { date: '07-Oct', planned: 750, actual: 700, pct: 92 },
  { date: '08-Oct', planned: 600, actual: 560, pct: 75 },
  { date: '09-Oct', planned: 550, actual: 520, pct: 78 },
  { date: '10-Oct', planned: 800, actual: 780, pct: 95 },
];

const STATUS_PIE = [
  { name: 'Closed', value: 22, pct: 78.6, color: '#2e7d32' },
  { name: 'In Progress', value: 4, pct: 14.3, color: '#f9a825' },
  { name: 'Not Closed', value: 2, pct: 7.1, color: '#e53935' },
];
const STATUS_TOTAL = STATUS_PIE.reduce((sum, s) => sum + s.value, 0);

const DELAY_ANALYSIS = [
  { bucket: 'On Time\n(<= 0 Days)', orders: 10, color: '#2e7d32' },
  { bucket: '1 - 2 Days', orders: 8, color: '#1976d2' },
  { bucket: '3 - 5 Days', orders: 6, color: '#f9a825' },
  { bucket: '> 5 Days', orders: 4, color: '#e53935' },
];

const DETAILS = [
  { no: 1, po: 'PO-2026-001', code: 'FG-1001', desc: 'Gear Housing', workCenter: 'WC-01', planned: 500, actual: 500, uom: 'Nos', start: '01-Oct-2026', completion: '05-Oct-2026', closure: '05-Oct-2026', delay: 0, status: 'Closed' },
  { no: 2, po: 'PO-2026-002', code: 'FG-1002', desc: 'Motor Bracket', workCenter: 'WC-02', planned: 1000, actual: 980, uom: 'Nos', start: '01-Oct-2026', completion: '06-Oct-2026', closure: '06-Oct-2026', delay: 0, status: 'Closed' },
  { no: 3, po: 'PO-2026-003', code: 'FG-1003', desc: 'Pump Cover', workCenter: 'WC-03', planned: 300, actual: 290, uom: 'Nos', start: '02-Oct-2026', completion: '07-Oct-2026', closure: '08-Oct-2026', delay: 1, status: 'Closed' },
  { no: 4, po: 'PO-2026-004', code: 'FG-1004', desc: 'Valve Body', workCenter: 'WC-04', planned: 200, actual: 200, uom: 'Nos', start: '03-Oct-2026', completion: '08-Oct-2026', closure: '08-Oct-2026', delay: 0, status: 'Closed' },
  { no: 5, po: 'PO-2026-005', code: 'FG-1005', desc: 'Flange', workCenter: 'WC-05', planned: 400, actual: 380, uom: 'Nos', start: '04-Oct-2026', completion: '09-Oct-2026', closure: '10-Oct-2026', delay: 1, status: 'Closed' },
  { no: 6, po: 'PO-2026-006', code: 'FG-1006', desc: 'Shaft', workCenter: 'WC-01', planned: 250, actual: 0, uom: 'Nos', start: '05-Oct-2026', completion: null, closure: null, delay: null, status: 'In Progress' },
  { no: 7, po: 'PO-2026-007', code: 'FG-1007', desc: 'Gear Cover', workCenter: 'WC-02', planned: 600, actual: 550, uom: 'Nos', start: '06-Oct-2026', completion: null, closure: null, delay: null, status: 'In Progress' },
  { no: 8, po: 'PO-2026-008', code: 'FG-1008', desc: 'Bearing Housing', workCenter: 'WC-03', planned: 350, actual: 0, uom: 'Nos', start: '07-Oct-2026', completion: null, closure: null, delay: null, status: 'Not Closed' },
  { no: 9, po: 'PO-2026-009', code: 'FG-1009', desc: 'End Plate', workCenter: 'WC-04', planned: 150, actual: 0, uom: 'Nos', start: '08-Oct-2026', completion: null, closure: null, delay: null, status: 'Not Closed' },
  { no: 10, po: 'PO-2026-010', code: 'FG-1010', desc: 'Coupling', workCenter: 'WC-05', planned: 450, actual: 430, uom: 'Nos', start: '09-Oct-2026', completion: '10-Oct-2026', closure: '10-Oct-2026', delay: 0, status: 'Closed' },
];

const STATUS_COLOR = { Closed: 'success', 'In Progress': 'warning', 'Not Closed': 'error' };
const TOTAL_RECORDS = 28;
const TOTAL_PAGES = 3;

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function dash(v) {
  return v === null || v === undefined ? '-' : v;
}

export default function ProductionCloserReport() {
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
  const [status, setStatus] = useState('All');
  const [customer, setCustomer] = useState('All');
  const [show, setShow] = useState('Summary & Details');

  const handleReset = () => {
    setFromDate('2026-10-01');
    setToDate('2026-10-10');
    setPlant('All');
    setWorkCenter('All');
    setPoSearch('');
    setItemSearch('');
    setItemGroup('All');
    setStatus('All');
    setCustomer('All');
    setShow('Summary & Details');
  };

  const toggleAll = (e) => setSelected(e.target.checked ? DETAILS.map((d) => d.po) : []);
  const toggleOne = (key) => setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <Box>
      <EntityHeaderCard
        icon={<ListAltIcon />}
        title="Production Closer Report"
        subtitle="View production order closure status, actual vs planned details, variances and closure analysis."
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
                <MenuItem value="WC-01">WC-01</MenuItem>
                <MenuItem value="WC-02">WC-02</MenuItem>
                <MenuItem value="WC-03">WC-03</MenuItem>
                <MenuItem value="WC-04">WC-04</MenuItem>
                <MenuItem value="WC-05">WC-05</MenuItem>
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
              <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Closed">Closed</MenuItem>
                <MenuItem value="In Progress">In Progress</MenuItem>
                <MenuItem value="Not Closed">Not Closed</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField fullWidth size="small" select label="Customer (For Make-to-Order)" value={customer} onChange={(e) => setCustomer(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="ABC Engineering">ABC Engineering</MenuItem>
                <MenuItem value="XYZ Motors">XYZ Motors</MenuItem>
                <MenuItem value="DEF Valves">DEF Valves</MenuItem>
                <MenuItem value="GHI Industries">GHI Industries</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
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
                    {t.sub && <Typography variant="caption" color="text.secondary" textAlign="center">{t.sub}</Typography>}
                  </Stack>
                </Grid>
              );
            })}
          </Grid>
        </CardContent>
      </Card>

      {/* Charts row */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} lg={5}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Order Closure Trend (Quantity)</Typography>
          <Card variant="outlined">
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={TREND} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: 'Quantity', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} label={{ value: 'Closure %', angle: 90, position: 'insideRight', style: { fontSize: 11 } }} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="planned" name="Planned Qty" fill="#1976d2" radius={[3, 3, 0, 0]} />
                  <Bar yAxisId="left" dataKey="actual" name="Actual Qty" fill="#2e7d32" radius={[3, 3, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="pct" name="Closure Rate %" stroke="#ef6c00" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Order Status Distribution</Typography>
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
                <Typography variant="caption" color="text.secondary">Total Orders</Typography>
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

        <Grid item xs={12} lg={3}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Closure Delay Analysis</Typography>
          <Card variant="outlined">
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={DELAY_ANALYSIS} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 10 }} interval={0} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} label={{ value: 'Orders', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                  <Tooltip />
                  <Bar dataKey="orders" radius={[3, 3, 0, 0]} barSize={32}>
                    {DELAY_ANALYSIS.map((d) => <Cell key={d.bucket} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Production Closer Details */}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Production Closer Details ({numberFmt(TOTAL_RECORDS)} records)</Typography>
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
                  <TableCell>Production Order No.</TableCell>
                  <TableCell>Item Code</TableCell>
                  <TableCell>Item Description</TableCell>
                  <TableCell>Work Center</TableCell>
                  <TableCell align="right">Planned Qty</TableCell>
                  <TableCell align="right">Actual Qty</TableCell>
                  <TableCell align="right">Variance</TableCell>
                  <TableCell>UOM</TableCell>
                  <TableCell>Start Date</TableCell>
                  <TableCell>Completion Date</TableCell>
                  <TableCell>Closure Date</TableCell>
                  <TableCell align="right">Closure Delay (Days)</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {DETAILS.map((d) => {
                  const variance = d.actual - d.planned;
                  return (
                    <TableRow key={d.po} hover selected={selected.includes(d.po)}>
                      <TableCell padding="checkbox">
                        <Checkbox size="small" checked={selected.includes(d.po)} onChange={() => toggleOne(d.po)} />
                      </TableCell>
                      <TableCell>{d.no}</TableCell>
                      <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{d.po}</Typography></TableCell>
                      <TableCell>{d.code}</TableCell>
                      <TableCell>{d.desc}</TableCell>
                      <TableCell>{d.workCenter}</TableCell>
                      <TableCell align="right">{numberFmt(d.planned)}</TableCell>
                      <TableCell align="right">{numberFmt(d.actual)}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color={variance < 0 ? 'error.main' : 'text.primary'} fontWeight={600}>{variance}</Typography>
                      </TableCell>
                      <TableCell>{d.uom}</TableCell>
                      <TableCell>{d.start}</TableCell>
                      <TableCell>{dash(d.completion)}</TableCell>
                      <TableCell>{dash(d.closure)}</TableCell>
                      <TableCell align="right">{dash(d.delay)}</TableCell>
                      <TableCell><Chip size="small" label={d.status} color={STATUS_COLOR[d.status]} /></TableCell>
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
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Showing 1 to {DETAILS.length} of {numberFmt(TOTAL_RECORDS)} records
            </Typography>
            <Pagination count={TOTAL_PAGES} page={page} onChange={(e, v) => setPage(v)} color="primary" />
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
