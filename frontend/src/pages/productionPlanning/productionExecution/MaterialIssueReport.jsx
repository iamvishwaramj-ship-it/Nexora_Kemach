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
import Inventory2Icon from '@mui/icons-material/Inventory2';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import GroupsIcon from '@mui/icons-material/Groups';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Material Issue Report" screen -- the
// dedicated drill-down reached from Production Execution > Reports >
// Material Issue. There is no reporting backend behind Production
// Execution in this schema, so this lays out the report exactly as
// designed with fixed mock data for a 01-Oct-2026 to 10-Oct-2026 window,
// following the same convention as the other static-mock screens in this
// module. Local state only (filters, selection, pagination) -- nothing
// here persists or calls the server. Only the first page of the mocked
// "325 records" is actually rendered as row data; the rest is represented
// by the (static) pagination control, same as the reference design.
// ---------------------------------------------------------------------------

const SUMMARY_TILES = [
  { label: 'Total Issue Transactions', sub: null, value: '325', color: 'info', icon: AssignmentIcon },
  { label: 'Total Quantity Issued', sub: 'Nos / Kg / Ltr', value: '1,245', color: 'success', icon: Inventory2Icon },
  { label: 'Total Issue Value', sub: '(INR)', value: '₹ 12,45,600', color: 'info', icon: Inventory2Icon },
  { label: 'Production Orders Issued', sub: null, value: '310', color: 'success', icon: AutorenewIcon },
  { label: 'Work Centers', sub: null, value: '15', color: 'warning', icon: GroupsIcon },
  { label: 'Over Issue Transactions', sub: null, value: '8', color: 'error', icon: WarningAmberIcon },
];

const TREND = [
  { date: '01-Oct', qty: 220, issues: 18 },
  { date: '02-Oct', qty: 180, issues: 15 },
  { date: '03-Oct', qty: 350, issues: 28 },
  { date: '04-Oct', qty: 150, issues: 20 },
  { date: '05-Oct', qty: 230, issues: 19 },
  { date: '06-Oct', qty: 310, issues: 26 },
  { date: '07-Oct', qty: 260, issues: 22 },
  { date: '08-Oct', qty: 170, issues: 16 },
  { date: '09-Oct', qty: 230, issues: 20 },
  { date: '10-Oct', qty: 330, issues: 24 },
];

const ITEM_GROUP_PIE = [
  { name: 'Raw Material', pct: 45.2, color: '#1976d2' },
  { name: 'Purchased Parts', pct: 22.5, color: '#f9a825' },
  { name: 'Consumables', pct: 12.8, color: '#2e7d32' },
  { name: 'Packing Material', pct: 8.6, color: '#e53935' },
  { name: 'Others', pct: 10.9, color: '#8e24aa' },
];

const WORK_CENTER_QTY = [
  { name: 'WC-01 - Machining', qty: 480, color: '#1976d2' },
  { name: 'WC-02 - Drilling', qty: 320, color: '#2e7d32' },
  { name: 'WC-03 - Assembly', qty: 250, color: '#f9a825' },
  { name: 'WC-04 - Painting', qty: 180, color: '#ef6c00' },
  { name: 'WC-05 - Testing', qty: 95, color: '#8e24aa' },
];

const DETAILS = [
  { no: 1, issueNo: 'MI-2026-001', date: '01-Oct-2026', po: 'PO-2026-001', code: 'RM-2001', desc: 'Cast Iron', group: 'Raw Material', uom: 'Kg', qty: 1020, value: 66300, workCenter: 'WC-01', issuedBy: 'Ravi', purpose: 'Production', status: 'Posted' },
  { no: 2, issueNo: 'MI-2026-002', date: '01-Oct-2026', po: 'PO-2026-001', code: 'RM-2002', desc: 'Bearing 6205', group: 'Purchased Parts', uom: 'Nos', qty: 110, value: 13200, workCenter: 'WC-02', issuedBy: 'Kumar', purpose: 'Production', status: 'Posted' },
  { no: 3, issueNo: 'MI-2026-003', date: '02-Oct-2026', po: 'PO-2026-002', code: 'PM-1001', desc: 'Paint (Grey)', group: 'Consumables', uom: 'Ltr', qty: 48, value: 7200, workCenter: 'WC-03', issuedBy: 'Suresh', purpose: 'Production', status: 'Posted' },
  { no: 4, issueNo: 'MI-2026-004', date: '03-Oct-2026', po: 'PO-2026-003', code: 'FG-1001', desc: 'Gear Housing (Mat)', group: 'Raw Material', uom: 'Nos', qty: 312, value: 156000, workCenter: 'WC-01', issuedBy: 'Ravi', purpose: 'Production', status: 'Posted' },
  { no: 5, issueNo: 'MI-2026-005', date: '04-Oct-2026', po: 'PO-2026-003', code: 'PK-1001', desc: 'Packing Box', group: 'Packing Material', uom: 'Nos', qty: 395, value: 7900, workCenter: 'WC-02', issuedBy: 'Kumar', purpose: 'Packing', status: 'Posted' },
  { no: 6, issueNo: 'MI-2026-006', date: '05-Oct-2026', po: 'PO-2026-004', code: 'CM-1001', desc: 'Cutting Oil', group: 'Consumables', uom: 'Ltr', qty: 95, value: 9500, workCenter: 'WC-01', issuedBy: 'Mani', purpose: 'Production', status: 'Posted' },
  { no: 7, issueNo: 'MI-2026-007', date: '06-Oct-2026', po: 'PO-2026-005', code: 'RM-2004', desc: 'Alloy Steel', group: 'Raw Material', uom: 'Kg', qty: 760, value: 91200, workCenter: 'WC-03', issuedBy: 'Ravi', purpose: 'Production', status: 'Posted' },
  { no: 8, issueNo: 'MI-2026-008', date: '07-Oct-2026', po: 'PO-2026-006', code: 'RM-2005', desc: 'Shaft Blank', group: 'Raw Material', uom: 'Nos', qty: 265, value: 66250, workCenter: 'WC-04', issuedBy: 'Suresh', purpose: 'Production', status: 'Over Issue' },
  { no: 9, issueNo: 'MI-2026-009', date: '08-Oct-2026', po: 'PO-2026-006', code: 'PM-1002', desc: 'Thinner', group: 'Consumables', uom: 'Ltr', qty: 25, value: 3750, workCenter: 'WC-02', issuedBy: 'Kumar', purpose: 'Rework', status: 'Posted' },
  { no: 10, issueNo: 'MI-2026-010', date: '09-Oct-2026', po: 'PO-2026-007', code: 'RM-2003', desc: 'Gasket', group: 'Purchased Parts', uom: 'Nos', qty: 190, value: 3800, workCenter: 'WC-05', issuedBy: 'Mani', purpose: 'Production', status: 'Posted' },
];

const STATUS_COLOR = { Posted: 'success', 'Over Issue': 'error' };
const TOTAL_RECORDS = 325;
const TOTAL_PAGES = 33;

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function money(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MaterialIssueReport() {
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [fromDate, setFromDate] = useState('2026-10-01');
  const [toDate, setToDate] = useState('2026-10-10');
  const [plant, setPlant] = useState('All');
  const [workCenter, setWorkCenter] = useState('All');
  const [poSearch, setPoSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [issueType, setIssueType] = useState('All');
  const [itemGroup, setItemGroup] = useState('All');
  const [issuedBy, setIssuedBy] = useState('All');
  const [status, setStatus] = useState('All');
  const [show, setShow] = useState('Summary & Details');

  const handleReset = () => {
    setFromDate('2026-10-01');
    setToDate('2026-10-10');
    setPlant('All');
    setWorkCenter('All');
    setPoSearch('');
    setItemSearch('');
    setIssueType('All');
    setItemGroup('All');
    setIssuedBy('All');
    setStatus('All');
    setShow('Summary & Details');
  };

  const toggleAll = (e) => setSelected(e.target.checked ? DETAILS.map((d) => d.issueNo) : []);
  const toggleOne = (key) => setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const maxWcQty = Math.max(...WORK_CENTER_QTY.map((w) => w.qty));

  return (
    <Box>
      <EntityHeaderCard
        icon={<ListAltIcon />}
        title="Material Issue Report"
        subtitle="View material issued to production orders, work centers and operations."
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
                {WORK_CENTER_QTY.map((w) => <MenuItem key={w.name} value={w.name}>{w.name}</MenuItem>)}
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
              <TextField fullWidth size="small" select label="Issue Type" value={issueType} onChange={(e) => setIssueType(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Production">Production</MenuItem>
                <MenuItem value="Rework">Rework</MenuItem>
                <MenuItem value="Packing">Packing</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField fullWidth size="small" select label="Item Group" value={itemGroup} onChange={(e) => setItemGroup(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Raw Material">Raw Material</MenuItem>
                <MenuItem value="Purchased Parts">Purchased Parts</MenuItem>
                <MenuItem value="Consumables">Consumables</MenuItem>
                <MenuItem value="Packing Material">Packing Material</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField fullWidth size="small" select label="Issued By" value={issuedBy} onChange={(e) => setIssuedBy(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Ravi">Ravi</MenuItem>
                <MenuItem value="Kumar">Kumar</MenuItem>
                <MenuItem value="Suresh">Suresh</MenuItem>
                <MenuItem value="Mani">Mani</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Posted">Posted</MenuItem>
                <MenuItem value="Over Issue">Over Issue</MenuItem>
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
                <Grid item xs={6} sm={4} md={2} key={t.label}>
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
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Material Issue Trend (Quantity)</Typography>
          <Card variant="outlined">
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={TREND} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: 'Quantity', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} label={{ value: 'No. of Issues', angle: 90, position: 'insideRight', style: { fontSize: 11 } }} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="qty" name="Issue Qty" fill="#1976d2" radius={[3, 3, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="issues" name="No. of Issues" stroke="#2e7d32" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Material Issue by Item Group (Value)</Typography>
          <Card variant="outlined">
            <CardContent sx={{ position: 'relative' }}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={ITEM_GROUP_PIE} dataKey="pct" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {ITEM_GROUP_PIE.map((s) => <Cell key={s.name} fill={s.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `${v}%`} />
                </PieChart>
              </ResponsiveContainer>
              <Box sx={{ position: 'absolute', top: '34%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <Typography variant="subtitle1" fontWeight={700}>₹ 12,45,600</Typography>
                <Typography variant="caption" color="text.secondary">Total Issue Value</Typography>
              </Box>
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {ITEM_GROUP_PIE.map((s) => (
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
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Material Issue by Work Center (Quantity)</Typography>
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={1.75}>
                {WORK_CENTER_QTY.map((w) => (
                  <Box key={w.name}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="body2">{w.name}</Typography>
                      <Typography variant="body2" fontWeight={600}>{numberFmt(w.qty)}</Typography>
                    </Stack>
                    <Box sx={{ height: 10, borderRadius: 1, bgcolor: 'action.hover', overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${(w.qty / maxWcQty) * 100}%`, bgcolor: w.color, borderRadius: 1 }} />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Material Issue Details */}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Material Issue Details ({numberFmt(TOTAL_RECORDS)} records)</Typography>
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
                  <TableCell>Issue No.</TableCell>
                  <TableCell>Issue Date</TableCell>
                  <TableCell>Production Order No.</TableCell>
                  <TableCell>Item Code</TableCell>
                  <TableCell>Item Description</TableCell>
                  <TableCell>Item Group</TableCell>
                  <TableCell>UOM</TableCell>
                  <TableCell align="right">Issue Qty</TableCell>
                  <TableCell align="right">Issue Value (INR)</TableCell>
                  <TableCell>Work Center</TableCell>
                  <TableCell>Issued By</TableCell>
                  <TableCell>Purpose</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {DETAILS.map((d) => (
                  <TableRow key={d.issueNo} hover selected={selected.includes(d.issueNo)}>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={selected.includes(d.issueNo)} onChange={() => toggleOne(d.issueNo)} />
                    </TableCell>
                    <TableCell>{d.no}</TableCell>
                    <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{d.issueNo}</Typography></TableCell>
                    <TableCell>{d.date}</TableCell>
                    <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{d.po}</Typography></TableCell>
                    <TableCell>{d.code}</TableCell>
                    <TableCell>{d.desc}</TableCell>
                    <TableCell>{d.group}</TableCell>
                    <TableCell>{d.uom}</TableCell>
                    <TableCell align="right">{numberFmt(d.qty)}</TableCell>
                    <TableCell align="right">{money(d.value)}</TableCell>
                    <TableCell>{d.workCenter}</TableCell>
                    <TableCell>{d.issuedBy}</TableCell>
                    <TableCell>{d.purpose}</TableCell>
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
