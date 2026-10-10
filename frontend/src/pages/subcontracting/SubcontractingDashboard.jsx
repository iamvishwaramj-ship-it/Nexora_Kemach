import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, Button, Chip, TextField, MenuItem, InputAdornment,
  Table, TableHead, TableBody, TableRow, TableCell, Checkbox, IconButton, Pagination,
} from '@mui/material';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip, Legend,
  ComposedChart, CartesianGrid, XAxis, YAxis, Bar, Line, BarChart,
} from 'recharts';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CancelIcon from '@mui/icons-material/Cancel';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import LayersIcon from '@mui/icons-material/Layers';
import MoveToInboxIcon from '@mui/icons-material/MoveToInbox';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Subcontracting - Dashboard" screen, rebuilt to
// match the reference screenshot the user supplied (two copies of the same
// image). Subcontracting is its own top-level menu (see navConfig.js), so
// this page is the landing dashboard for that menu, not a Production
// Execution sub-screen. Same convention as every other screen in this
// project: no Subcontracting data model exists in this schema, so this is
// fixed mock data only -- nothing persists or calls the server. The
// breadcrumb trail in the header is cosmetic text matching the image; this
// app has no breadcrumb component elsewhere, so it is laid out inline here
// rather than as a reusable piece.
// ---------------------------------------------------------------------------

const VENDORS = ['All', 'Sri Balaji Heat Treatment', 'Alpha Engineering', 'Metal Works', 'Shakti Coating', 'Precision Grinding'];
const STATUS_OPTIONS = ['All', 'Completed', 'In Progress', 'Pending'];
const WORK_CENTERS = ['All', 'Heat Treatment', 'CNC Machining', 'Surface Coating', 'Plating', 'Grinding', 'Laser Cutting'];
const ITEM_GROUPS = ['All', 'Finished Goods', 'Raw Material', 'Semi-Finished'];
const SHOW_OPTIONS = ['Summary & Details', 'Summary Only', 'Details Only'];

const SUMMARY_TILES = [
  { label: 'Total Subcontract Orders', value: '36', sub: null, icon: DescriptionOutlinedIcon, color: 'primary' },
  { label: 'Completed', value: '22', sub: '61.1%', icon: CheckCircleIcon, color: 'success' },
  { label: 'In Progress', value: '8', sub: '22.2%', icon: AutorenewIcon, color: 'warning' },
  { label: 'Pending', value: '6', sub: '16.7%', icon: CancelIcon, color: 'error' },
  { label: 'Total Subcontract Value', value: '₹ 18,25,600', sub: null, icon: Inventory2Icon, color: 'secondary' },
  { label: 'Material Issued Value', value: '₹ 12,45,800', sub: null, icon: LayersIcon, color: 'success' },
  { label: 'Received Value', value: '₹ 9,86,450', sub: null, icon: MoveToInboxIcon, color: 'error' },
  { label: 'Pending Value', value: '₹ 3,20,350', sub: null, icon: DescriptionOutlinedIcon, color: 'secondary' },
];

const ORDER_TREND = [
  { date: '01-Oct', issued: 420, received: 380, pending: 420 },
  { date: '02-Oct', issued: 560, received: 520, pending: 500 },
  { date: '03-Oct', issued: 480, received: 460, pending: 480 },
  { date: '04-Oct', issued: 520, received: 480, pending: 540 },
  { date: '05-Oct', issued: 600, received: 540, pending: 560 },
  { date: '06-Oct', issued: 540, received: 500, pending: 520 },
  { date: '07-Oct', issued: 500, received: 470, pending: 500 },
  { date: '08-Oct', issued: 820, received: 700, pending: 900 },
  { date: '09-Oct', issued: 460, received: 440, pending: 600 },
  { date: '10-Oct', issued: 620, received: 580, pending: 600 },
];

const VENDOR_VALUE = [
  { name: 'Sri Balaji Heat Treatment', value: 28, color: '#1976d2' },
  { name: 'Alpha Engineering', value: 22, color: '#f9a825' },
  { name: 'Metal Works', value: 18, color: '#2e7d32' },
  { name: 'Shakti Coating', value: 14, color: '#e53935' },
  { name: 'Precision Grinding', value: 10, color: '#8e24aa' },
  { name: 'Others', value: 8, color: '#757575' },
];

const PROCESS_DISTRIBUTION = [
  { process: 'Heat Treatment', qty: 2450, color: '#1976d2' },
  { process: 'Surface Coating', qty: 1820, color: '#2e7d32' },
  { process: 'CNC Machining', qty: 1200, color: '#f9a825' },
  { process: 'Grinding', qty: 980, color: '#e53935' },
  { process: 'Plating', qty: 650, color: '#8e24aa' },
  { process: 'Laser Cutting', qty: 420, color: '#757575' },
];

const ORDERS = [
  { no: 1, sco: 'SCO-2026-001', po: 'PO-2026-001', vendor: 'Sri Balaji HT', itemCode: 'FG-1001', itemDesc: 'Gear Housing', process: 'Heat Treatment', orderQty: 500, issuedQty: 500, receivedQty: 500, balanceQty: 0, orderDate: '01-Oct-2026', promiseDate: '05-Oct-2026', status: 'Completed', value: 250000 },
  { no: 2, sco: 'SCO-2026-002', po: 'PO-2026-001', vendor: 'Alpha Engineering', itemCode: 'FG-1002', itemDesc: 'Motor Bracket', process: 'CNC Machining', orderQty: 800, issuedQty: 800, receivedQty: 600, balanceQty: 200, orderDate: '01-Oct-2026', promiseDate: '06-Oct-2026', status: 'In Progress', value: 320000 },
  { no: 3, sco: 'SCO-2026-003', po: 'PO-2026-002', vendor: 'Metal Works', itemCode: 'PM-1001', itemDesc: 'Pump Cover', process: 'Surface Coating', orderQty: 600, issuedQty: 600, receivedQty: 600, balanceQty: 0, orderDate: '02-Oct-2026', promiseDate: '06-Oct-2026', status: 'Completed', value: 180000 },
  { no: 4, sco: 'SCO-2026-004', po: 'PO-2026-002', vendor: 'Shakti Coating', itemCode: 'RM-2001', itemDesc: 'Cast Iron Housing', process: 'Plating', orderQty: 400, issuedQty: 400, receivedQty: 280, balanceQty: 120, orderDate: '03-Oct-2026', promiseDate: '08-Oct-2026', status: 'In Progress', value: 120000 },
  { no: 5, sco: 'SCO-2026-005', po: 'PO-2026-003', vendor: 'Precision Grinding', itemCode: 'FG-1003', itemDesc: 'Valve Body', process: 'Grinding', orderQty: 300, issuedQty: 300, receivedQty: 300, balanceQty: 0, orderDate: '03-Oct-2026', promiseDate: '07-Oct-2026', status: 'Completed', value: 90000 },
  { no: 6, sco: 'SCO-2026-006', po: 'PO-2026-003', vendor: 'Sri Balaji HT', itemCode: 'FG-1004', itemDesc: 'Flange', process: 'Heat Treatment', orderQty: 450, issuedQty: 450, receivedQty: 200, balanceQty: 250, orderDate: '04-Oct-2026', promiseDate: '09-Oct-2026', status: 'Pending', value: 135000 },
  { no: 7, sco: 'SCO-2026-007', po: 'PO-2026-004', vendor: 'Alpha Engineering', itemCode: 'FG-1005', itemDesc: 'Shaft', process: 'CNC Machining', orderQty: 350, issuedQty: 350, receivedQty: 350, balanceQty: 0, orderDate: '05-Oct-2026', promiseDate: '08-Oct-2026', status: 'Completed', value: 105000 },
  { no: 8, sco: 'SCO-2026-008', po: 'PO-2026-004', vendor: 'Metal Works', itemCode: 'FG-1006', itemDesc: 'Gear Cover', process: 'Surface Coating', orderQty: 600, issuedQty: 600, receivedQty: 450, balanceQty: 150, orderDate: '06-Oct-2026', promiseDate: '10-Oct-2026', status: 'In Progress', value: 180000 },
  { no: 9, sco: 'SCO-2026-009', po: 'PO-2026-005', vendor: 'Shakti Coating', itemCode: 'FG-1007', itemDesc: 'Bearing Housing', process: 'Plating', orderQty: 450, issuedQty: 450, receivedQty: 0, balanceQty: 450, orderDate: '07-Oct-2026', promiseDate: '12-Oct-2026', status: 'Pending', value: 135000 },
  { no: 10, sco: 'SCO-2026-010', po: 'PO-2026-005', vendor: 'Precision Grinding', itemCode: 'FG-1008', itemDesc: 'End Plate', process: 'Grinding', orderQty: 300, issuedQty: 300, receivedQty: 300, balanceQty: 0, orderDate: '08-Oct-2026', promiseDate: '11-Oct-2026', status: 'Completed', value: 90000 },
];

const TOTAL_RECORDS = 36;
const TOTAL_PAGES = 4;
const STATUS_COLOR = { Completed: 'success', 'In Progress': 'warning', Pending: 'error' };

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

export default function SubcontractingDashboard() {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState('2026-10-01');
  const [toDate, setToDate] = useState('2026-10-10');
  const [vendor, setVendor] = useState('All');
  const [itemSearch, setItemSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [workCenter, setWorkCenter] = useState('All');
  const [poSearch, setPoSearch] = useState('');
  const [scoSearch, setScoSearch] = useState('');
  const [itemGroup, setItemGroup] = useState('All');
  const [show, setShow] = useState('Summary & Details');
  const [checked, setChecked] = useState(() => new Set());
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const toggleAll = () => {
    setChecked((prev) => (prev.size === ORDERS.length ? new Set() : new Set(ORDERS.map((o) => o.sco))));
  };
  const toggleOne = (sco) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(sco)) next.delete(sco); else next.add(sco);
      return next;
    });
  };

  const breadcrumb = (
    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
      {/* <Typography variant="caption" color="primary.main" fontWeight={600}>Manufacturing</Typography>
      <Typography variant="caption" color="text.disabled">&gt;</Typography>
      <Typography variant="caption" color="primary.main" fontWeight={600}>Subcontracting</Typography>
      <Typography variant="caption" color="text.disabled">&gt;</Typography>
      <Typography variant="caption" color="error.main" fontWeight={700}>Subcontracting Overview</Typography> */}
    </Stack>
  );

  const headerActions = (
    <Stack spacing={1} alignItems="flex-end">
      {breadcrumb}
      <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap justifyContent="flex-end">
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/subcontracting/subcontract-orders')}>
          New Subcontract Order
        </Button>
        <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} endIcon={<KeyboardArrowDownIcon />}>Export</Button>
        <Button variant="outlined" startIcon={<PrintOutlinedIcon />}>Print</Button>
        <Button variant="outlined" startIcon={<SettingsOutlinedIcon />}>Set As Default</Button>
      </Stack>
    </Stack>
  );

  return (
    <Box>
      <EntityHeaderCard
        icon={<PersonOutlineIcon />}
        title="Subcontracting"
        subtitle="Manage subcontracting orders, material issue, inward, quality and costing."
        rightContent={headerActions}
      />

      {/* Filter Criteria */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>Filter Criteria</Typography>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" type="date" label="From Date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" type="date" label="To Date" value={toDate} onChange={(e) => setToDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Vendor" value={vendor} onChange={(e) => setVendor(e.target.value)}>
                {VENDORS.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" label="Item Code" placeholder="Search Item..."
                value={itemSearch} onChange={(e) => setItemSearch(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Work Center / Process" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}>
                {WORK_CENTERS.map((w) => <MenuItem key={w} value={w}>{w}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" label="Production Order No." placeholder="Search PO..."
                value={poSearch} onChange={(e) => setPoSearch(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" label="Subcontract Order No." placeholder="Search SCO..."
                value={scoSearch} onChange={(e) => setScoSearch(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Item Group" value={itemGroup} onChange={(e) => setItemGroup(e.target.value)}>
                {ITEM_GROUPS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Show" value={show} onChange={(e) => setShow(e.target.value)}>
                {SHOW_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
          <Stack direction="row" justifyContent="flex-end" spacing={1.5} sx={{ mt: 2 }}>
            <Button variant="outlined">Reset</Button>
            <Button variant="contained" startIcon={<SearchIcon />}>Search</Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Summary tiles */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {SUMMARY_TILES.map((s) => {
          const Icon = s.icon;
          return (
            <Grid item xs={6} sm={4} md={3} lg={1.5} key={s.label}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Box sx={{
                    width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: `${s.color}.lighter`, color: `${s.color}.main`, mx: 'auto', mb: 1,
                  }}>
                    <Icon fontSize="small" />
                  </Box>
                  <Typography variant="h6" fontWeight={700} lineHeight={1.2}>{s.value}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">{s.label}</Typography>
                  {s.sub && <Typography variant="caption" color={`${s.color}.main`} fontWeight={700}>{s.sub}</Typography>}
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Subcontract Order Trend (Qty)</Typography>
              <Box sx={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <ComposedChart data={ORDER_TREND}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <RTooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="issued" name="Issued Qty" fill="#1976d2" radius={[3, 3, 0, 0]} />
                    <Line type="monotone" dataKey="received" name="Received Qty" stroke="#2e7d32" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="pending" name="Pending Qty" stroke="#f9a825" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Subcontract by Vendor (Value)</Typography>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ position: 'relative', width: 150, height: 150, flexShrink: 0 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={VENDOR_VALUE} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
                        {VENDOR_VALUE.map((v) => <Cell key={v.name} fill={v.color} />)}
                      </Pie>
                      <RTooltip formatter={(v) => `${v}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" fontWeight={700}>₹ 18,25,600</Typography>
                    <Typography variant="caption" color="text.secondary">Total Value</Typography>
                  </Box>
                </Box>
                <Stack spacing={0.6}>
                  {VENDOR_VALUE.map((v) => (
                    <Stack key={v.name} direction="row" spacing={1} alignItems="center">
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: v.color, flexShrink: 0 }} />
                      <Typography variant="caption" color="text.secondary">{v.name} {v.value}%</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Process Wise Distribution (Qty)</Typography>
              <Box sx={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={PROCESS_DISTRIBUTION} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="process" width={90} tick={{ fontSize: 10 }} />
                    <RTooltip formatter={(v) => numberFmt(v)} />
                    <Bar dataKey="qty" radius={[0, 4, 4, 0]}>
                      {PROCESS_DISTRIBUTION.map((p) => <Cell key={p.process} fill={p.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Subcontracting Orders table */}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Subcontracting Orders ({TOTAL_RECORDS} records)</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary">Records per page</Typography>
              <TextField select size="small" value={rowsPerPage} onChange={(e) => setRowsPerPage(e.target.value)} sx={{ width: 80 }}>
                <MenuItem value={10}>10</MenuItem>
                <MenuItem value={25}>25</MenuItem>
                <MenuItem value={50}>50</MenuItem>
              </TextField>
            </Stack>
          </Stack>

          <ScrollableTableContainer maxHeight="clamp(260px, calc(100vh - 720px), 460px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={checked.size === ORDERS.length}
                      indeterminate={checked.size > 0 && checked.size < ORDERS.length}
                      onChange={toggleAll}
                    />
                  </TableCell>
                  <TableCell>S.No</TableCell>
                  <TableCell>SCO No.</TableCell>
                  <TableCell>PO No.</TableCell>
                  <TableCell>Vendor Name</TableCell>
                  <TableCell>Item Code</TableCell>
                  <TableCell>Item Description</TableCell>
                  <TableCell>Process</TableCell>
                  <TableCell align="right">Order Qty</TableCell>
                  <TableCell align="right">Issued Qty</TableCell>
                  <TableCell align="right">Received Qty</TableCell>
                  <TableCell align="right">Balance Qty</TableCell>
                  <TableCell>Order Date</TableCell>
                  <TableCell>Promise Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Subcontract Value (INR)</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ORDERS.map((o) => (
                  <TableRow key={o.sco} hover selected={checked.has(o.sco)}>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={checked.has(o.sco)} onChange={() => toggleOne(o.sco)} />
                    </TableCell>
                    <TableCell>{o.no}</TableCell>
                    <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{o.sco}</Typography></TableCell>
                    <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{o.po}</Typography></TableCell>
                    <TableCell>{o.vendor}</TableCell>
                    <TableCell>{o.itemCode}</TableCell>
                    <TableCell>{o.itemDesc}</TableCell>
                    <TableCell>{o.process}</TableCell>
                    <TableCell align="right">{numberFmt(o.orderQty)}</TableCell>
                    <TableCell align="right">{numberFmt(o.issuedQty)}</TableCell>
                    <TableCell align="right">{numberFmt(o.receivedQty)}</TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color={o.balanceQty > 0 ? 'error.main' : 'text.primary'} fontWeight={600}>{numberFmt(o.balanceQty)}</Typography>
                    </TableCell>
                    <TableCell>{o.orderDate}</TableCell>
                    <TableCell>{o.promiseDate}</TableCell>
                    <TableCell><Chip size="small" label={o.status} color={STATUS_COLOR[o.status] || 'default'} /></TableCell>
                    <TableCell align="right">{numberFmt(o.value)}</TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => navigate('/subcontracting/subcontract-orders')}>
                        <VisibilityOutlinedIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTableContainer>

          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Showing 1 to {ORDERS.length} of {TOTAL_RECORDS} records
            </Typography>
            <Pagination count={TOTAL_PAGES} page={page} onChange={(e, v) => setPage(v)} color="primary" />
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
