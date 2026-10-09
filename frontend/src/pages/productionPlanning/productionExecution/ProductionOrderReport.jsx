import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Chip, Checkbox,
  Table, TableHead, TableBody, TableRow, TableCell, IconButton, Tooltip as MuiTooltip,
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
import InsertChartOutlinedIcon from '@mui/icons-material/InsertChartOutlined';
import ClipboardIcon from '@mui/icons-material/Assignment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CancelIcon from '@mui/icons-material/Cancel';
import BarChartIcon from '@mui/icons-material/BarChart';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Production Order Report" screen -- the
// dedicated drill-down reached from Production Execution > Reports >
// Production Order Report. There is no reporting backend behind Production
// Execution in this schema, so this lays out the report exactly as designed
// with fixed mock data for a 01-Oct-2026 to 10-Oct-2026 window, following
// the same convention as the other static-mock screens in this module.
// Local state only (filters, selection) -- nothing here persists or calls
// the server.
// ---------------------------------------------------------------------------

const ORDERS = [
  { no: 1, po: 'PO-2026-001', code: 'FG-1001', desc: 'Gear Housing', planned: 500, uom: 'Nos', completed: 480, inProgress: 20, pending: 0, start: '01-Oct-2026', due: '10-Oct-2026', status: 'Completed', customer: 'ABC Engineering', workCenter: 'WC-01' },
  { no: 2, po: 'PO-2026-002', code: 'FG-1002', desc: 'Motor Bracket', planned: 1000, uom: 'Nos', completed: 800, inProgress: 200, pending: 0, start: '01-Oct-2026', due: '10-Oct-2026', status: 'In Progress', customer: 'XYZ Motors', workCenter: 'WC-02' },
  { no: 3, po: 'PO-2026-003', code: 'FG-1003', desc: 'Pump Cover', planned: 300, uom: 'Nos', completed: 300, inProgress: 0, pending: 0, start: '02-Oct-2026', due: '10-Oct-2026', status: 'Completed', customer: 'ABC Engineering', workCenter: 'WC-03' },
  { no: 4, po: 'PO-2026-004', code: 'FG-1004', desc: 'Valve Body', planned: 200, uom: 'Nos', completed: 100, inProgress: 100, pending: 0, start: '03-Oct-2026', due: '10-Oct-2026', status: 'In Progress', customer: 'DEF Valves', workCenter: 'WC-01' },
  { no: 5, po: 'PO-2026-005', code: 'FG-1005', desc: 'Flange', planned: 400, uom: 'Nos', completed: 0, inProgress: 0, pending: 400, start: '04-Oct-2026', due: '10-Oct-2026', status: 'Not Completed', customer: 'GHI Industries', workCenter: 'WC-02' },
  { no: 6, po: 'PO-2026-006', code: 'FG-1006', desc: 'Shaft', planned: 250, uom: 'Nos', completed: 250, inProgress: 0, pending: 0, start: '04-Oct-2026', due: '09-Oct-2026', status: 'Completed', customer: 'ABC Engineering', workCenter: 'WC-03' },
  { no: 7, po: 'PO-2026-007', code: 'FG-1007', desc: 'Gear Cover', planned: 600, uom: 'Nos', completed: 420, inProgress: 150, pending: 30, start: '05-Oct-2026', due: '12-Oct-2026', status: 'In Progress', customer: 'XYZ Motors', workCenter: 'WC-01' },
  { no: 8, po: 'PO-2026-008', code: 'FG-1008', desc: 'Bearing Housing', planned: 350, uom: 'Nos', completed: 300, inProgress: 50, pending: 0, start: '06-Oct-2026', due: '12-Oct-2026', status: 'In Progress', customer: 'ABC Engineering', workCenter: 'WC-02' },
  { no: 9, po: 'PO-2026-009', code: 'FG-1009', desc: 'End Plate', planned: 150, uom: 'Nos', completed: 0, inProgress: 0, pending: 150, start: '07-Oct-2026', due: '12-Oct-2026', status: 'Not Completed', customer: 'DEF Valves', workCenter: 'WC-03' },
  { no: 10, po: 'PO-2026-010', code: 'FG-1010', desc: 'Coupling', planned: 450, uom: 'Nos', completed: 400, inProgress: 50, pending: 0, start: '08-Oct-2026', due: '15-Oct-2026', status: 'In Progress', customer: 'GHI Industries', workCenter: 'WC-01' },
];

const STATUS_COLOR = { Completed: 'success', 'In Progress': 'warning', 'Not Completed': 'error' };

const STATUS_PIE = [
  { name: 'Completed', value: 15, pct: 60, color: '#2e7d32' },
  { name: 'In Progress', value: 6, pct: 24, color: '#ed6c02' },
  { name: 'Not Completed', value: 4, pct: 16, color: '#d32f2f' },
];
const STATUS_TOTAL = STATUS_PIE.reduce((sum, s) => sum + s.value, 0);

const PLANNED_VS_COMPLETED = [
  { item: 'Gear Housing', planned: 500, completed: 480 },
  { item: 'Motor Bracket', planned: 1000, completed: 800 },
  { item: 'Pump Cover', planned: 300, completed: 300 },
  { item: 'Valve Body', planned: 200, completed: 100 },
  { item: 'Flange', planned: 400, completed: 0 },
];

const WORK_CENTERS = [
  { name: 'WC-01 - Machining', pct: 85 },
  { name: 'WC-02 - Drilling', pct: 70 },
  { name: 'WC-03 - Assembly', pct: 60 },
  { name: 'WC-04 - Painting', pct: 50 },
  { name: 'WC-05 - Testing', pct: 30 },
];

const TOP_ITEMS = [
  { item: 'Gear Housing', qty: 1600 },
  { item: 'Motor Bracket', qty: 1000 },
  { item: 'Gear Cover', qty: 600 },
  { item: 'Flange', qty: 400 },
  { item: 'Pump Cover', qty: 300 },
];
const TOP_ITEMS_MAX = Math.max(...TOP_ITEMS.map((t) => t.qty));

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function pct(n, total) {
  return total ? `${((n / total) * 100).toFixed(1)}%` : '0%';
}

export default function ProductionOrderReport() {
  const [selected, setSelected] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [fromDate, setFromDate] = useState('2026-10-01');
  const [toDate, setToDate] = useState('2026-10-10');
  const [plant, setPlant] = useState('All');
  const [workCenter, setWorkCenter] = useState('All');
  const [poSearch, setPoSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [itemGroup, setItemGroup] = useState('All');
  const [status, setStatus] = useState('All');
  const [routingOperation, setRoutingOperation] = useState('All');
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
    setRoutingOperation('All');
    setCustomer('All');
    setShow('Summary & Details');
  };

  const toggleAll = (e) => setSelected(e.target.checked ? ORDERS.map((o) => o.po) : []);
  const toggleOne = (po) => setSelected((prev) => (prev.includes(po) ? prev.filter((p) => p !== po) : [...prev, po]));

  const planned = ORDERS.reduce((sum, o) => sum + o.planned, 0);
  const completedQty = ORDERS.reduce((sum, o) => sum + o.completed, 0);
  const inProgressQty = ORDERS.reduce((sum, o) => sum + o.inProgress, 0);
  const pendingQty = ORDERS.reduce((sum, o) => sum + o.pending, 0);
  const completedCount = ORDERS.filter((o) => o.status === 'Completed').length;
  const inProgressCount = ORDERS.filter((o) => o.status === 'In Progress').length;
  const notCompletedCount = ORDERS.filter((o) => o.status === 'Not Completed').length;

  const summaryTiles = [
    { label: 'Total Production Orders', value: numberFmt(ORDERS.length), sub: null, color: 'info', icon: ClipboardIcon },
    { label: 'Completed', value: numberFmt(completedCount), sub: pct(completedCount, ORDERS.length), color: 'success', icon: CheckCircleIcon },
    { label: 'In Progress', value: numberFmt(inProgressCount), sub: pct(inProgressCount, ORDERS.length), color: 'warning', icon: AutorenewIcon },
    { label: 'Not Completed', value: numberFmt(notCompletedCount), sub: pct(notCompletedCount, ORDERS.length), color: 'error', icon: CancelIcon },
    { label: 'Planned Qty', value: numberFmt(planned), sub: null, color: 'default', icon: BarChartIcon },
    { label: 'Completed Qty', value: numberFmt(completedQty), sub: pct(completedQty, planned), color: 'success', icon: Inventory2Icon },
    { label: 'In Progress Qty', value: numberFmt(inProgressQty), sub: pct(inProgressQty, planned), color: 'warning', icon: AccessTimeIcon },
    { label: 'Pending Qty', value: numberFmt(pendingQty), sub: pct(pendingQty, planned), color: 'error', icon: WarningAmberIcon },
  ];

  return (
    <Box>
      <EntityHeaderCard
        icon={<ListAltIcon />}
        title="Production Order Report"
        subtitle="View and analyze production order status, quantities, completion and delays."
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
            <Grid item xs={12} sm={6} md={1.7}>
              <TextField fullWidth size="small" type="date" label="From Date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={1.7}>
              <TextField fullWidth size="small" type="date" label="To Date" value={toDate} onChange={(e) => setToDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={1.7}>
              <TextField fullWidth size="small" select label="Plant / Location" value={plant} onChange={(e) => setPlant(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Main Plant">Main Plant</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={1.7}>
              <TextField fullWidth size="small" select label="Work Center" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                {WORK_CENTERS.map((w) => <MenuItem key={w.name} value={w.name}>{w.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={1.6}>
              <TextField
                fullWidth size="small" label="Production Order No." placeholder="Search PO..."
                value={poSearch} onChange={(e) => setPoSearch(e.target.value)}
                InputProps={{ endAdornment: <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} /> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={1.6}>
              <TextField
                fullWidth size="small" label="Item Code" placeholder="Search Item..."
                value={itemSearch} onChange={(e) => setItemSearch(e.target.value)}
                InputProps={{ endAdornment: <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} /> }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={1.7}>
              <TextField fullWidth size="small" select label="Item Group" value={itemGroup} onChange={(e) => setItemGroup(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Finished Goods">Finished Goods</MenuItem>
                <MenuItem value="Sub Assembly">Sub Assembly</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={1.7}>
              <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Completed">Completed</MenuItem>
                <MenuItem value="In Progress">In Progress</MenuItem>
                <MenuItem value="Not Completed">Not Completed</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={1.7}>
              <TextField fullWidth size="small" select label="Routing Operation" value={routingOperation} onChange={(e) => setRoutingOperation(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="OP-10 - Machining">OP-10 - Machining</MenuItem>
                <MenuItem value="OP-20 - Drilling">OP-20 - Drilling</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={1.7}>
              <TextField fullWidth size="small" select label="Customer (For Make-to-Order)" value={customer} onChange={(e) => setCustomer(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="ABC Engineering">ABC Engineering</MenuItem>
                <MenuItem value="XYZ Motors">XYZ Motors</MenuItem>
                <MenuItem value="DEF Valves">DEF Valves</MenuItem>
                <MenuItem value="GHI Industries">GHI Industries</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={1.9}>
              <TextField fullWidth size="small" select label="Show" value={show} onChange={(e) => setShow(e.target.value)}>
                <MenuItem value="Summary & Details">Summary & Details</MenuItem>
                <MenuItem value="Summary Only">Summary Only</MenuItem>
                <MenuItem value="Details Only">Details Only</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={1.4}>
              <Stack direction="row" spacing={1.5}>
                <Button fullWidth variant="outlined" onClick={handleReset}>Reset</Button>
                <Button fullWidth variant="contained" startIcon={<SearchIcon />}>Search</Button>
              </Stack>
            </Grid>
          </Grid>

          {/* Summary tiles */}
          <Grid container spacing={1.5}>
            {summaryTiles.map((t) => {
              const Icon = t.icon;
              const bg = t.color === 'default' ? 'action.hover' : `${t.color}.lighter`;
              const iconColor = t.color === 'default' ? 'text.secondary' : t.color;
              return (
                <Grid item xs={6} sm={4} md={1.5} key={t.label}>
                  <Stack alignItems="center" spacing={0.5} sx={{ bgcolor: bg, borderRadius: 2, py: 2, px: 1 }}>
                    <Icon sx={{ color: iconColor === 'text.secondary' ? 'text.secondary' : `${t.color}.main` }} />
                    <Typography variant="h6" fontWeight={700}>{t.value}</Typography>
                    <Typography variant="caption" color="text.secondary" textAlign="center">{t.label}</Typography>
                    {t.sub && (
                      <Typography variant="caption" fontWeight={600} color={`${t.color}.dark`}>{t.sub}</Typography>
                    )}
                  </Stack>
                </Grid>
              );
            })}
          </Grid>
        </CardContent>
      </Card>

      {/* Production Order List */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Production Order List ({ORDERS.length})</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary">Records per page</Typography>
              <TextField
                select size="small" value={rowsPerPage} onChange={(e) => setRowsPerPage(e.target.value)}
                sx={{ width: 80 }}
              >
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
                      checked={selected.length === ORDERS.length}
                      indeterminate={selected.length > 0 && selected.length < ORDERS.length}
                      onChange={toggleAll}
                    />
                  </TableCell>
                  <TableCell>S.No</TableCell>
                  <TableCell>Production Order No.</TableCell>
                  <TableCell>Item Code</TableCell>
                  <TableCell>Item Description</TableCell>
                  <TableCell align="right">Planned Qty</TableCell>
                  <TableCell>UOM</TableCell>
                  <TableCell align="right">Completed Qty</TableCell>
                  <TableCell align="right">In Progress Qty</TableCell>
                  <TableCell align="right">Pending Qty</TableCell>
                  <TableCell>Start Date</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Work Center</TableCell>
                  <TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ORDERS.slice(0, rowsPerPage).map((o) => (
                  <TableRow key={o.po} hover selected={selected.includes(o.po)}>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={selected.includes(o.po)} onChange={() => toggleOne(o.po)} />
                    </TableCell>
                    <TableCell>{o.no}</TableCell>
                    <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{o.po}</Typography></TableCell>
                    <TableCell>{o.code}</TableCell>
                    <TableCell>{o.desc}</TableCell>
                    <TableCell align="right">{numberFmt(o.planned)}</TableCell>
                    <TableCell>{o.uom}</TableCell>
                    <TableCell align="right">{numberFmt(o.completed)}</TableCell>
                    <TableCell align="right">{numberFmt(o.inProgress)}</TableCell>
                    <TableCell align="right">{numberFmt(o.pending)}</TableCell>
                    <TableCell>{o.start}</TableCell>
                    <TableCell>{o.due}</TableCell>
                    <TableCell><Chip size="small" label={o.status} color={STATUS_COLOR[o.status]} /></TableCell>
                    <TableCell>{o.customer}</TableCell>
                    <TableCell>{o.workCenter}</TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.25} justifyContent="center">
                        <MuiTooltip title="View">
                          <IconButton size="small"><VisibilityOutlinedIcon fontSize="small" /></IconButton>
                        </MuiTooltip>
                        <MuiTooltip title="Analytics">
                          <IconButton size="small"><InsertChartOutlinedIcon fontSize="small" /></IconButton>
                        </MuiTooltip>
                        <MuiTooltip title="Download">
                          <IconButton size="small"><FileDownloadOutlinedIcon fontSize="small" /></IconButton>
                        </MuiTooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTableContainer>
        </CardContent>
      </Card>

      {/* Charts row */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6} lg={3}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Status Wise Production Orders</Typography>
          <Card variant="outlined">
            <CardContent sx={{ position: 'relative' }}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={STATUS_PIE} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2}>
                    {STATUS_PIE.map((s) => <Cell key={s.name} fill={s.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <Box sx={{ position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <Typography variant="h5" fontWeight={700}>{numberFmt(STATUS_TOTAL)}</Typography>
                <Typography variant="caption" color="text.secondary">Total PO</Typography>
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

        <Grid item xs={12} md={6} lg={3}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Planned vs Completed Quantity</Typography>
          <Card variant="outlined">
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={PLANNED_VS_COMPLETED} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="item" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={45} />
                  <YAxis domain={[0, 2000]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="planned" name="Planned Qty" fill="#1976d2" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="completed" name="Completed Qty" fill="#2e7d32" radius={[3, 3, 0, 0]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Work Center Performance</Typography>
          <Card variant="outlined">
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={WORK_CENTERS} layout="vertical" margin={{ top: 5, right: 25, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="pct" radius={[0, 4, 4, 0]} barSize={16}>
                    {WORK_CENTERS.map((w) => (
                      <Cell key={w.name} fill={w.pct >= 60 ? '#2e7d32' : w.pct >= 40 ? '#ed6c02' : '#d32f2f'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Top 5 Items by Production Qty</Typography>
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={1.5}>
                {TOP_ITEMS.map((t) => (
                  <Box key={t.item}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="body2">{t.item}</Typography>
                      <Typography variant="body2" fontWeight={600}>{numberFmt(t.qty)}</Typography>
                    </Stack>
                    <Box sx={{ height: 8, borderRadius: 1, bgcolor: 'action.hover', overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${(t.qty / TOP_ITEMS_MAX) * 100}%`, bgcolor: 'primary.main', borderRadius: 1 }} />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
