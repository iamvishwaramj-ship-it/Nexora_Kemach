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
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import DescriptionIcon from '@mui/icons-material/Description';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import BarChartIcon from '@mui/icons-material/BarChart';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Costing Report" screen -- the dedicated
// drill-down reached from Production Execution > Reports > Costing Report.
// There is no reporting backend behind Production Execution in this
// schema, so this lays out the report exactly as designed with fixed mock
// data for a 01-Oct-2026 to 10-Oct-2026 window, following the same
// convention as the other static-mock screens in this module. Local state
// only (filters, selection, pagination) -- nothing here persists or calls
// the server. Only the first page of the mocked "28 records" is actually
// rendered as row data; the rest is represented by the (static) pagination
// control, same as the reference design.
// ---------------------------------------------------------------------------

const SUMMARY_TILES = [
  { label: 'Total Production Cost', sub: null, trend: '6.8%', up: true, value: '₹ 12,45,600', color: 'info', icon: MonetizationOnIcon },
  { label: 'Avg. Cost per Unit', sub: null, trend: '3.2%', up: true, value: '₹ 980 / Unit', color: 'success', icon: DescriptionIcon },
  { label: 'Standard Cost per Unit', sub: null, trend: null, up: true, value: '₹ 850 / Unit', color: 'secondary', icon: GpsFixedIcon },
  { label: 'Cost Variance %', sub: null, trend: '4.1%', up: false, value: '15.3%', color: 'warning', icon: BarChartIcon },
  { label: 'Total Production Qty', sub: null, trend: '5.2%', up: true, value: '6,500 Nos', color: 'error', icon: Inventory2Icon },
  { label: 'Total Variance Amount', sub: null, trend: '12.6%', up: true, value: '₹ 1,27,200', color: 'success', icon: ShowChartIcon },
];

const COST_BREAKUP = [
  { name: 'Raw Material', pct: 52.4, color: '#1976d2' },
  { name: 'Direct Labour', pct: 18.6, color: '#f9a825' },
  { name: 'Machine Overhead', pct: 12.8, color: '#2e7d32' },
  { name: 'Manufacturing Overhead', pct: 8.9, color: '#e53935' },
  { name: 'Others', pct: 7.3, color: '#8e24aa' },
];
const COST_BREAKUP_TOTAL = '₹ 12,45,600';

const COST_TREND = [
  { date: '01-Oct', actual: 720, standard: 650 },
  { date: '02-Oct', actual: 650, standard: 640 },
  { date: '03-Oct', actual: 780, standard: 660 },
  { date: '04-Oct', actual: 700, standard: 650 },
  { date: '05-Oct', actual: 820, standard: 680 },
  { date: '06-Oct', actual: 760, standard: 660 },
  { date: '07-Oct', actual: 900, standard: 700 },
  { date: '08-Oct', actual: 850, standard: 690 },
  { date: '09-Oct', actual: 950, standard: 710 },
  { date: '10-Oct', actual: 1020, standard: 720 },
];

const COST_BY_ITEM_GROUP = [
  { name: 'Fabricated Parts', value: 420600, color: '#1976d2' },
  { name: 'Machined Parts', value: 285400, color: '#2e7d32' },
  { name: 'Castings', value: 190500, color: '#f9a825' },
  { name: 'Purchased Parts', value: 125300, color: '#ef6c00' },
  { name: 'Assemblies', value: 85200, color: '#e53935' },
  { name: 'Others', value: 38600, color: '#8e24aa' },
];

const DETAILS = [
  { no: 1, po: 'PO-2026-001', code: 'FG-1001', desc: 'Gear Housing', group: 'Castings', qty: 500, rawMaterial: 210000, directLabour: 80000, machineOverhead: 45000, mfgOverhead: 25000, totalCost: 360000, costPerUnit: 720, standardCost: 650, variance: 70, variancePct: 10.8, status: 'Closed' },
  { no: 2, po: 'PO-2026-002', code: 'FG-1002', desc: 'Motor Bracket', group: 'Machined Parts', qty: 800, rawMaterial: 160000, directLabour: 72000, machineOverhead: 38000, mfgOverhead: 20000, totalCost: 290000, costPerUnit: 363, standardCost: 340, variance: 23, variancePct: 6.8, status: 'Closed' },
  { no: 3, po: 'PO-2026-003', code: 'PM-1001', desc: 'Pump Cover', group: 'Fabricated Parts', qty: 600, rawMaterial: 185000, directLabour: 90000, machineOverhead: 52000, mfgOverhead: 30000, totalCost: 357000, costPerUnit: 595, standardCost: 520, variance: 75, variancePct: 14.4, status: 'Closed' },
  { no: 4, po: 'PO-2026-004', code: 'RM-2001', desc: 'Cast Iron Housing', group: 'Castings', qty: 300, rawMaterial: 120000, directLabour: 54000, machineOverhead: 28000, mfgOverhead: 16000, totalCost: 218000, costPerUnit: 727, standardCost: 650, variance: 77, variancePct: 11.8, status: 'In Progress' },
  { no: 5, po: 'PO-2026-005', code: 'FG-1003', desc: 'Valve Body', group: 'Machined Parts', qty: 400, rawMaterial: 105000, directLabour: 48000, machineOverhead: 26000, mfgOverhead: 14000, totalCost: 193000, costPerUnit: 483, standardCost: 450, variance: 33, variancePct: 7.3, status: 'Closed' },
  { no: 6, po: 'PO-2026-005', code: 'FG-1004', desc: 'Flange', group: 'Fabricated Parts', qty: 250, rawMaterial: 88000, directLabour: 42000, machineOverhead: 21000, mfgOverhead: 12000, totalCost: 163000, costPerUnit: 652, standardCost: 600, variance: 52, variancePct: 8.7, status: 'Closed' },
  { no: 7, po: 'PO-2026-003', code: 'FG-1005', desc: 'Shaft', group: 'Machined Parts', qty: 600, rawMaterial: 125000, directLabour: 56000, machineOverhead: 32000, mfgOverhead: 18000, totalCost: 231000, costPerUnit: 385, standardCost: 360, variance: 25, variancePct: 6.9, status: 'Closed' },
  { no: 8, po: 'PO-2026-006', code: 'FG-1006', desc: 'Gear Cover', group: 'Machined Parts', qty: 350, rawMaterial: 96000, directLabour: 40000, machineOverhead: 22000, mfgOverhead: 12000, totalCost: 170000, costPerUnit: 486, standardCost: 430, variance: 56, variancePct: 13.0, status: 'In Progress' },
  { no: 9, po: 'PO-2026-003', code: 'FG-1007', desc: 'Bearing Housing', group: 'Castings', qty: 450, rawMaterial: 158000, directLabour: 66000, machineOverhead: 36000, mfgOverhead: 20000, totalCost: 280000, costPerUnit: 622, standardCost: 580, variance: 42, variancePct: 7.2, status: 'Closed' },
  { no: 10, po: 'PO-2026-008', code: 'FG-1008', desc: 'End Plate', group: 'Fabricated Parts', qty: 300, rawMaterial: 78000, directLabour: 30000, machineOverhead: 18000, mfgOverhead: 10000, totalCost: 136000, costPerUnit: 453, standardCost: 420, variance: 33, variancePct: 7.9, status: 'Closed' },
];

const STATUS_COLOR = { Closed: 'success', 'In Progress': 'warning' };
const TOTAL_RECORDS = 28;
const TOTAL_PAGES = 4;

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

export default function CostingReport() {
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
  const [costType, setCostType] = useState('All');
  const [costElement, setCostElement] = useState('All');
  const [status, setStatus] = useState('All');
  const [show, setShow] = useState('Summary & Details');

  const handleReset = () => {
    setFromDate('2026-10-01');
    setToDate('2026-10-10');
    setPlant('All');
    setWorkCenter('All');
    setPoSearch('');
    setItemSearch('');
    setItemGroup('All');
    setCostType('All');
    setCostElement('All');
    setStatus('All');
    setShow('Summary & Details');
  };

  const toggleAll = (e) => setSelected(e.target.checked ? DETAILS.map((d) => `${d.po}-${d.code}`) : []);
  const toggleOne = (key) => setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <Box>
      <EntityHeaderCard
        icon={<ListAltIcon />}
        title="Costing Report"
        subtitle="Analyze actual production cost vs standard cost with detailed cost breakup and variance analysis."
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
                {COST_BY_ITEM_GROUP.map((g) => <MenuItem key={g.name} value={g.name}>{g.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField fullWidth size="small" select label="Cost Type" value={costType} onChange={(e) => setCostType(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Actual">Actual</MenuItem>
                <MenuItem value="Standard">Standard</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField fullWidth size="small" select label="Cost Element" value={costElement} onChange={(e) => setCostElement(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Raw Material">Raw Material</MenuItem>
                <MenuItem value="Direct Labour">Direct Labour</MenuItem>
                <MenuItem value="Machine Overhead">Machine Overhead</MenuItem>
                <MenuItem value="Manufacturing Overhead">Manufacturing Overhead</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Closed">Closed</MenuItem>
                <MenuItem value="In Progress">In Progress</MenuItem>
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
              return (
                <Grid item xs={6} sm={4} md={2} key={t.label}>
                  <Stack alignItems="center" spacing={0.5} sx={{ bgcolor: `${t.color}.lighter`, borderRadius: 2, py: 2, px: 1 }}>
                    <Icon color={t.color} />
                    <Typography variant="h6" fontWeight={700}>{t.value}</Typography>
                    <Typography variant="caption" color="text.secondary" textAlign="center">{t.label}</Typography>
                    {t.trend && (
                      <Stack direction="row" alignItems="center" spacing={0.25}>
                        <TrendIcon sx={{ fontSize: 14, color: t.up ? 'success.main' : 'error.main' }} />
                        <Typography variant="caption" fontWeight={600} color={t.up ? 'success.main' : 'error.main'}>{t.trend}</Typography>
                      </Stack>
                    )}
                  </Stack>
                </Grid>
              );
            })}
          </Grid>
        </CardContent>
      </Card>

      {/* Charts row */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} lg={4}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Cost Breakup (INR)</Typography>
          <Card variant="outlined">
            <CardContent sx={{ position: 'relative' }}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={COST_BREAKUP} dataKey="pct" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {COST_BREAKUP.map((s) => <Cell key={s.name} fill={s.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `${v}%`} />
                </PieChart>
              </ResponsiveContainer>
              <Box sx={{ position: 'absolute', top: '34%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <Typography variant="subtitle1" fontWeight={700}>{COST_BREAKUP_TOTAL}</Typography>
                <Typography variant="caption" color="text.secondary">Total Cost</Typography>
              </Box>
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {COST_BREAKUP.map((s) => (
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
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Cost Trend (Per Unit)</Typography>
          <Card variant="outlined">
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={COST_TREND} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 1200]} tick={{ fontSize: 11 }} label={{ value: 'Cost (INR)', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="actual" name="Actual Cost / Unit" fill="#1976d2" radius={[3, 3, 0, 0]} />
                  <Line type="monotone" dataKey="standard" name="Standard Cost / Unit" stroke="#2e7d32" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Cost by Item Group (INR)</Typography>
          <Card variant="outlined">
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={COST_BY_ITEM_GROUP} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 500000]} tickFormatter={(v) => `${v / 1000}K`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => numberFmt(v)} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                    {COST_BY_ITEM_GROUP.map((g) => <Cell key={g.name} fill={g.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Costing Details */}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Costing Details ({numberFmt(TOTAL_RECORDS)} records)</Typography>
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
                  <TableCell>Item Group</TableCell>
                  <TableCell align="right">Production Qty</TableCell>
                  <TableCell align="right">Raw Material Cost</TableCell>
                  <TableCell align="right">Direct Labour Cost</TableCell>
                  <TableCell align="right">Machine Overhead</TableCell>
                  <TableCell align="right">Manufacturing Overhead</TableCell>
                  <TableCell align="right">Total Cost</TableCell>
                  <TableCell align="right">Cost per Unit</TableCell>
                  <TableCell align="right">Standard Cost</TableCell>
                  <TableCell align="right">Variance</TableCell>
                  <TableCell align="right">Variance %</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {DETAILS.map((d) => {
                  const key = `${d.po}-${d.code}`;
                  return (
                    <TableRow key={key} hover selected={selected.includes(key)}>
                      <TableCell padding="checkbox">
                        <Checkbox size="small" checked={selected.includes(key)} onChange={() => toggleOne(key)} />
                      </TableCell>
                      <TableCell>{d.no}</TableCell>
                      <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{d.po}</Typography></TableCell>
                      <TableCell>{d.code}</TableCell>
                      <TableCell>{d.desc}</TableCell>
                      <TableCell>{d.group}</TableCell>
                      <TableCell align="right">{numberFmt(d.qty)}</TableCell>
                      <TableCell align="right">{numberFmt(d.rawMaterial)}</TableCell>
                      <TableCell align="right">{numberFmt(d.directLabour)}</TableCell>
                      <TableCell align="right">{numberFmt(d.machineOverhead)}</TableCell>
                      <TableCell align="right">{numberFmt(d.mfgOverhead)}</TableCell>
                      <TableCell align="right">{numberFmt(d.totalCost)}</TableCell>
                      <TableCell align="right">{numberFmt(d.costPerUnit)}</TableCell>
                      <TableCell align="right">{numberFmt(d.standardCost)}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color={d.variance > 0 ? 'error.main' : 'text.primary'} fontWeight={600}>{d.variance}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color={d.variancePct > 10 ? 'error.main' : 'text.primary'} fontWeight={600}>{d.variancePct.toFixed(1)}%</Typography>
                      </TableCell>
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
