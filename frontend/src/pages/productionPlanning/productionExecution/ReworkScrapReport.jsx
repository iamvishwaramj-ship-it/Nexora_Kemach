import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Chip, Checkbox,
  Table, TableHead, TableBody, TableRow, TableCell, IconButton, Tooltip as MuiTooltip, Pagination, Divider,
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
import AutorenewIcon from '@mui/icons-material/Autorenew';
import RecyclingIcon from '@mui/icons-material/Recycling';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import PaidIcon from '@mui/icons-material/Paid';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Rework & Scrap Report" screen -- the
// dedicated drill-down reached from Production Execution > Reports >
// Rework & Scrap Report. There is no reporting backend behind Production
// Execution in this schema, so this lays out the report exactly as
// designed with fixed mock data for a 01-Oct-2026 to 10-Oct-2026 window,
// following the same convention as the other static-mock screens in this
// module. Local state only (filters, selection, pagination) -- nothing
// here persists or calls the server. Only the first page of the mocked
// "43 records" is actually rendered as row data; the rest is represented
// by the (static) pagination control, same as the reference design.
// ---------------------------------------------------------------------------

const SUMMARY_TILES = [
  { label: 'Rework Transactions', sub: null, value: '25', color: 'info', icon: AutorenewIcon },
  { label: 'Scrap Transactions', sub: null, value: '18', color: 'success', icon: RecyclingIcon },
  { label: 'Rework Qty', sub: 'Nos / Kg / Ltr', value: '420', color: 'info', icon: Inventory2Icon },
  { label: 'Scrap Qty', sub: 'Nos / Kg / Ltr', value: '310', color: 'error', icon: DeleteOutlineIcon },
  { label: 'Rework Cost', sub: '(INR)', value: '₹ 1,25,600', color: 'warning', icon: MonetizationOnIcon },
  { label: 'Scrap Cost', sub: '(INR)', value: '₹ 98,450', color: 'secondary', icon: PaidIcon },
  { label: 'Total Rework %', sub: '(of Production Qty)', value: '2.8%', color: 'success', icon: ShowChartIcon },
  { label: 'Total Scrap %', sub: '(of Production Qty)', value: '2.1%', color: 'error', icon: TrendingDownIcon },
];

const TREND = [
  { date: '01-Oct', rework: 45, scrap: 30, pct: 4.2 },
  { date: '02-Oct', rework: 60, scrap: 40, pct: 5.8 },
  { date: '03-Oct', rework: 35, scrap: 65, pct: 6.5 },
  { date: '04-Oct', rework: 50, scrap: 35, pct: 4.8 },
  { date: '05-Oct', rework: 40, scrap: 25, pct: 3.5 },
  { date: '06-Oct', rework: 55, scrap: 45, pct: 6.0 },
  { date: '07-Oct', rework: 70, scrap: 50, pct: 7.2 },
  { date: '08-Oct', rework: 30, scrap: 20, pct: 3.0 },
  { date: '09-Oct', rework: 45, scrap: 30, pct: 4.5 },
  { date: '10-Oct', rework: 40, scrap: 25, pct: 3.8 },
];

const REASON_PIE = [
  { name: 'Machine Setting', pct: 28, color: '#1976d2' },
  { name: 'Material Defect', pct: 22, color: '#f9a825' },
  { name: 'Dimensional Deviation', pct: 18, color: '#2e7d32' },
  { name: 'Surface Defect', pct: 14, color: '#e53935' },
  { name: 'Process Error', pct: 10, color: '#8e24aa' },
  { name: 'Others', pct: 8, color: '#757575' },
];
const REASON_TOTAL = 730;

const ITEM_GROUP_QTY = [
  { name: 'Castings', qty: 220, color: '#1976d2' },
  { name: 'Machined Parts', qty: 180, color: '#2e7d32' },
  { name: 'Fabricated Parts', qty: 120, color: '#f9a825' },
  { name: 'Purchased Parts', qty: 90, color: '#ef6c00' },
  { name: 'Assemblies', qty: 70, color: '#8e24aa' },
  { name: 'Others', qty: 50, color: '#757575' },
];

const TOP_ITEMS = [
  { no: 1, code: 'RM-2001', desc: 'Cast Iron Housing', rework: 120, scrap: 80, total: 200, rejection: 5.2 },
  { no: 2, code: 'FG-1001', desc: 'Gear Housing', rework: 90, scrap: 60, total: 150, rejection: 4.1 },
  { no: 3, code: 'PM-1001', desc: 'Pump Cover', rework: 75, scrap: 40, total: 115, rejection: 3.8 },
  { no: 4, code: 'RM-2002', desc: 'Bearing 6205', rework: 50, scrap: 30, total: 80, rejection: 2.9 },
  { no: 5, code: 'PK-1001', desc: 'Packing Box', rework: 40, scrap: 25, total: 65, rejection: 2.4 },
];

const TOP_WORK_CENTERS = [
  { no: 1, name: 'WC-01 - Machining', rework: 180, scrap: 120, total: 300 },
  { no: 2, name: 'WC-02 - Drilling', rework: 90, scrap: 70, total: 160 },
  { no: 3, name: 'WC-03 - Assembly', rework: 60, scrap: 50, total: 110 },
  { no: 4, name: 'WC-04 - Painting', rework: 45, scrap: 40, total: 85 },
  { no: 5, name: 'WC-05 - Testing', rework: 25, scrap: 30, total: 55 },
];

const COST_IMPACT = [
  { label: 'Rework Cost', value: '1,25,600' },
  { label: 'Scrap Cost', value: '98,450' },
  { label: 'Total Rejection Cost', value: '2,24,050' },
  { label: 'Cost as % of Production Cost', value: '3.9%' },
  { label: 'Avg. Rework Cost per Unit', value: '₹ 42.5' },
  { label: 'Avg. Scrap Cost per Unit', value: '₹ 38.7' },
];

const DETAILS = [
  { no: 1, date: '01-Oct-2026', po: 'PO-2026-001', code: 'FG-1001', desc: 'Gear Housing', type: 'Rework', reason: 'Dimensional Deviation', qty: 50, uom: 'Nos', cost: 15000, workCenter: 'WC-01', reportedBy: 'Ravi', status: 'Closed', remarks: 'Re-machined' },
  { no: 2, date: '01-Oct-2026', po: 'PO-2026-001', code: 'FG-1001', desc: 'Gear Housing', type: 'Scrap', reason: 'Surface Defect', qty: 20, uom: 'Nos', cost: 8000, workCenter: 'WC-01', reportedBy: 'Kumar', status: 'Closed', remarks: 'Crack found' },
  { no: 3, date: '02-Oct-2026', po: 'PO-2026-002', code: 'PM-1001', desc: 'Pump Cover', type: 'Rework', reason: 'Machine Setting', qty: 30, uom: 'Nos', cost: 9000, workCenter: 'WC-02', reportedBy: 'Suresh', status: 'Closed', remarks: 'Size correction' },
  { no: 4, date: '03-Oct-2026', po: 'PO-2026-003', code: 'RM-2001', desc: 'Cast Iron Housing', type: 'Scrap', reason: 'Material Defect', qty: 15, uom: 'Nos', cost: 6450, workCenter: 'WC-01', reportedBy: 'Ravi', status: 'Closed', remarks: 'Casting defect' },
  { no: 5, date: '03-Oct-2026', po: 'PO-2026-003', code: 'RM-2001', desc: 'Cast Iron Housing', type: 'Rework', reason: 'Process Error', qty: 40, uom: 'Nos', cost: 12000, workCenter: 'WC-03', reportedBy: 'Mani', status: 'In Progress', remarks: 'Rework in process' },
];

const STATUS_COLOR = { Closed: 'success', 'In Progress': 'warning' };
const TYPE_COLOR = { Rework: 'warning', Scrap: 'error' };
const TOTAL_RECORDS = 43;
const TOTAL_PAGES = 5;

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function money(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function ReworkScrapReport() {
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
  const [type, setType] = useState('All');
  const [reason, setReason] = useState('All');
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
    setType('All');
    setReason('All');
    setStatus('All');
    setShow('Summary & Details');
  };

  const toggleAll = (e) => setSelected(e.target.checked ? DETAILS.map((d) => `${d.po}-${d.no}`) : []);
  const toggleOne = (key) => setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const maxItemGroupQty = Math.max(...ITEM_GROUP_QTY.map((g) => g.qty));

  return (
    <Box>
      <EntityHeaderCard
        icon={<ListAltIcon />}
        title="Rework & Scrap Report"
        subtitle="Analyze rework and scrap quantities, reasons, cost impact and trends."
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
                {TOP_WORK_CENTERS.map((w) => <MenuItem key={w.name} value={w.name}>{w.name}</MenuItem>)}
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
                {ITEM_GROUP_QTY.map((g) => <MenuItem key={g.name} value={g.name}>{g.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField fullWidth size="small" select label="Rework/Scrap Type" value={type} onChange={(e) => setType(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Rework">Rework</MenuItem>
                <MenuItem value="Scrap">Scrap</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField fullWidth size="small" select label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                {REASON_PIE.map((r) => <MenuItem key={r.name} value={r.name}>{r.name}</MenuItem>)}
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
              return (
                <Grid item xs={6} sm={3} key={t.label}>
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

      {/* Charts row */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} lg={5}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Rework & Scrap Trend (Quantity)</Typography>
          <Card variant="outlined">
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={TREND} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: 'Quantity', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} label={{ value: 'Rejection %', angle: 90, position: 'insideRight', style: { fontSize: 11 } }} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="rework" name="Rework Qty" fill="#1976d2" radius={[3, 3, 0, 0]} />
                  <Bar yAxisId="left" dataKey="scrap" name="Scrap Qty" fill="#e53935" radius={[3, 3, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="pct" name="Total Rejection %" stroke="#2e7d32" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Rework & Scrap by Reason (Qty)</Typography>
          <Card variant="outlined">
            <CardContent sx={{ position: 'relative' }}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={REASON_PIE} dataKey="pct" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {REASON_PIE.map((s) => <Cell key={s.name} fill={s.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `${v}%`} />
                </PieChart>
              </ResponsiveContainer>
              <Box sx={{ position: 'absolute', top: '34%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <Typography variant="h6" fontWeight={700}>{numberFmt(REASON_TOTAL)}</Typography>
                <Typography variant="caption" color="text.secondary">Total Qty</Typography>
              </Box>
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {REASON_PIE.map((s) => (
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

        <Grid item xs={12} lg={3}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Rework & Scrap by Item Group (Qty)</Typography>
          <Card variant="outlined">
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={ITEM_GROUP_QTY} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 250]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="qty" radius={[0, 4, 4, 0]} barSize={16}>
                    {ITEM_GROUP_QTY.map((g) => <Cell key={g.name} fill={g.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Top 5 tables + Cost Impact */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} lg={4}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Top 5 Items by Rework & Scrap Qty</Typography>
          <Card variant="outlined">
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>S.No</TableCell>
                    <TableCell>Item Code</TableCell>
                    <TableCell>Item Description</TableCell>
                    <TableCell align="right">Rework Qty</TableCell>
                    <TableCell align="right">Scrap Qty</TableCell>
                    <TableCell align="right">Total Qty</TableCell>
                    <TableCell align="right">Rejection %</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {TOP_ITEMS.map((t) => (
                    <TableRow key={t.code} hover>
                      <TableCell>{t.no}</TableCell>
                      <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{t.code}</Typography></TableCell>
                      <TableCell>{t.desc}</TableCell>
                      <TableCell align="right">{t.rework}</TableCell>
                      <TableCell align="right">{t.scrap}</TableCell>
                      <TableCell align="right">{t.total}</TableCell>
                      <TableCell align="right">{t.rejection.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Top 5 Work Centers by Rework & Scrap Qty</Typography>
          <Card variant="outlined">
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>S.No</TableCell>
                    <TableCell>Work Center</TableCell>
                    <TableCell align="right">Rework Qty</TableCell>
                    <TableCell align="right">Scrap Qty</TableCell>
                    <TableCell align="right">Total Qty</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {TOP_WORK_CENTERS.map((w) => (
                    <TableRow key={w.name} hover>
                      <TableCell>{w.no}</TableCell>
                      <TableCell>{w.name}</TableCell>
                      <TableCell align="right">{w.rework}</TableCell>
                      <TableCell align="right">{w.scrap}</TableCell>
                      <TableCell align="right">{w.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
            Cost Impact Summary (INR)
          </Typography>
          <Card variant="outlined">
            <CardContent>
              <Stack divider={<Divider />} spacing={1.25}>
                {COST_IMPACT.map((c) => (
                  <Stack key={c.label} direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">{c.label}</Typography>
                    <Typography variant="body2" fontWeight={700}>{c.value}</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Rework & Scrap Details */}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Rework & Scrap Details ({numberFmt(TOTAL_RECORDS)} records)</Typography>
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
                  <TableCell>Date</TableCell>
                  <TableCell>Production Order No.</TableCell>
                  <TableCell>Item Code</TableCell>
                  <TableCell>Item Description</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell align="right">Quantity</TableCell>
                  <TableCell>UOM</TableCell>
                  <TableCell align="right">Cost (INR)</TableCell>
                  <TableCell>Work Center</TableCell>
                  <TableCell>Reported By</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Remarks</TableCell>
                  <TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {DETAILS.map((d) => {
                  const key = `${d.po}-${d.no}`;
                  return (
                    <TableRow key={key} hover selected={selected.includes(key)}>
                      <TableCell padding="checkbox">
                        <Checkbox size="small" checked={selected.includes(key)} onChange={() => toggleOne(key)} />
                      </TableCell>
                      <TableCell>{d.no}</TableCell>
                      <TableCell>{d.date}</TableCell>
                      <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{d.po}</Typography></TableCell>
                      <TableCell>{d.code}</TableCell>
                      <TableCell>{d.desc}</TableCell>
                      <TableCell><Chip size="small" label={d.type} color={TYPE_COLOR[d.type]} /></TableCell>
                      <TableCell>{d.reason}</TableCell>
                      <TableCell align="right">{numberFmt(d.qty)}</TableCell>
                      <TableCell>{d.uom}</TableCell>
                      <TableCell align="right">{money(d.cost)}</TableCell>
                      <TableCell>{d.workCenter}</TableCell>
                      <TableCell>{d.reportedBy}</TableCell>
                      <TableCell><Chip size="small" label={d.status} color={STATUS_COLOR[d.status]} /></TableCell>
                      <TableCell>{d.remarks}</TableCell>
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
