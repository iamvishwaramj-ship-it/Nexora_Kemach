import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Chip, Checkbox,
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
import Inventory2Icon from '@mui/icons-material/Inventory2';
import DescriptionIcon from '@mui/icons-material/Description';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CalculateIcon from '@mui/icons-material/Calculate';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Material Consumption Report" screen -- the
// dedicated drill-down reached from Production Execution > Reports >
// Material Consumption. There is no reporting backend behind Production
// Execution in this schema, so this lays out the report exactly as
// designed with fixed mock data for a 01-Oct-2026 to 10-Oct-2026 window,
// following the same convention as the other static-mock screens in this
// module. Local state only (filters, selection, pagination) -- nothing
// here persists or calls the server. Only the first page of the mocked
// "320 records" is actually rendered as row data; the rest is represented
// by the (static) pagination control, same as the reference design.
// ---------------------------------------------------------------------------

const SUMMARY_TILES = [
  { label: 'Production Orders', sub: '(Selected Period)', value: '48', color: 'info', icon: Inventory2Icon },
  { label: 'Total Material Lines', sub: null, value: '320', color: 'success', icon: DescriptionIcon },
  { label: 'Total Planned Cost', sub: '(INR)', value: '₹ 12,45,600', color: 'info', icon: AssignmentIcon },
  { label: 'Actual Consumption Cost', sub: '(INR)', value: '₹ 11,98,450', color: 'success', icon: AutorenewIcon },
  { label: 'Cost Variance', sub: '(Savings)', value: '-3.79%', color: 'warning', icon: CalculateIcon },
  { label: 'Items Over Consumption', sub: '(> 5% Variance)', value: '12', color: 'error', icon: WarningAmberIcon },
];

const PLANNED_VS_ACTUAL = [
  { stage: 'Casting', planned: 460000, actual: 400000 },
  { stage: 'Machining', planned: 390000, actual: 350000 },
  { stage: 'Assembly', planned: 260000, actual: 250000 },
  { stage: 'Painting', planned: 150000, actual: 140000 },
  { stage: 'Testing', planned: 120000, actual: 110000 },
];

const ITEM_GROUP_PIE = [
  { name: 'Raw Material', pct: 42.5, color: '#1976d2' },
  { name: 'Purchased Parts', pct: 25.3, color: '#f9a825' },
  { name: 'Consumables', pct: 15.6, color: '#ffca28' },
  { name: 'Packing Material', pct: 8.4, color: '#e53935' },
  { name: 'Others', pct: 8.2, color: '#2e7d32' },
];

const VARIANCE_ANALYSIS = [
  { label: 'Within Tolerance (±5%)', pct: 68, color: '#2e7d32' },
  { label: 'Over Consumption (>5%)', pct: 20, color: '#ef6c00' },
  { label: 'Under Consumption (<-5%)', pct: 12, color: '#1976d2' },
];

const DETAILS = [
  { no: 1, po: 'PO-2026-001', code: 'RM-2001', desc: 'Cast Iron', group: 'Raw Material', uom: 'Kg', bomQty: 1000, actualQty: 1020, varQty: 20, varPct: 2.0, plannedCost: 65000, actualCost: 66300, status: 'Within Limit' },
  { no: 2, po: 'PO-2026-001', code: 'RM-2002', desc: 'Bearing 6205', group: 'Purchased Parts', uom: 'Nos', bomQty: 100, actualQty: 110, varQty: 10, varPct: 10.0, plannedCost: 12000, actualCost: 13200, status: 'Over Consumption' },
  { no: 3, po: 'PO-2026-002', code: 'RM-2003', desc: 'Gasket', group: 'Consumables', uom: 'Nos', bomQty: 200, actualQty: 190, varQty: -10, varPct: -5.0, plannedCost: 4000, actualCost: 3800, status: 'Within Limit' },
  { no: 4, po: 'PO-2026-002', code: 'PM-1001', desc: 'Paint (Grey)', group: 'Consumables', uom: 'Ltr', bomQty: 50, actualQty: 48, varQty: -2, varPct: -4.0, plannedCost: 7500, actualCost: 7200, status: 'Within Limit' },
  { no: 5, po: 'PO-2026-003', code: 'FG-1001', desc: 'Gear Housing', group: 'Raw Material', uom: 'Nos', bomQty: 300, actualQty: 312, varQty: 12, varPct: 4.0, plannedCost: 150000, actualCost: 156000, status: 'Within Limit' },
  { no: 6, po: 'PO-2026-003', code: 'PM-1002', desc: 'Thinner', group: 'Consumables', uom: 'Ltr', bomQty: 20, actualQty: 25, varQty: 5, varPct: 25.0, plannedCost: 3000, actualCost: 3750, status: 'Over Consumption' },
  { no: 7, po: 'PO-2026-004', code: 'PK-1001', desc: 'Packing Box', group: 'Packing Material', uom: 'Nos', bomQty: 400, actualQty: 395, varQty: -5, varPct: -1.3, plannedCost: 8000, actualCost: 7900, status: 'Within Limit' },
  { no: 8, po: 'PO-2026-005', code: 'RM-2004', desc: 'Alloy Steel', group: 'Raw Material', uom: 'Kg', bomQty: 800, actualQty: 760, varQty: -40, varPct: -5.0, plannedCost: 96000, actualCost: 91200, status: 'Under Consumption' },
  { no: 9, po: 'PO-2026-006', code: 'RM-2005', desc: 'Shaft Blank', group: 'Raw Material', uom: 'Nos', bomQty: 250, actualQty: 265, varQty: 15, varPct: 6.0, plannedCost: 62500, actualCost: 66250, status: 'Over Consumption' },
  { no: 10, po: 'PO-2026-006', code: 'CM-1001', desc: 'Cutting Oil', group: 'Consumables', uom: 'Ltr', bomQty: 100, actualQty: 95, varQty: -5, varPct: -5.0, plannedCost: 10000, actualCost: 9500, status: 'Within Limit' },
];

const STATUS_COLOR = { 'Within Limit': 'success', 'Over Consumption': 'error', 'Under Consumption': 'info' };
const TOTAL_RECORDS = 320;
const TOTAL_PAGES = 32;

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function money(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MaterialConsumptionReport() {
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
  const [bomNo, setBomNo] = useState('All');
  const [materialCategory, setMaterialCategory] = useState('All');
  const [show, setShow] = useState('Summary & Details');

  const handleReset = () => {
    setFromDate('2026-10-01');
    setToDate('2026-10-10');
    setPlant('All');
    setWorkCenter('All');
    setPoSearch('');
    setItemSearch('');
    setItemGroup('All');
    setBomNo('All');
    setMaterialCategory('All');
    setShow('Summary & Details');
  };

  const toggleAll = (e) => setSelected(e.target.checked ? DETAILS.map((d) => `${d.po}-${d.code}`) : []);
  const toggleOne = (key) => setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <Box>
      <EntityHeaderCard
        icon={<ListAltIcon />}
        title="Material Consumption Report"
        subtitle="Analyze actual material consumption against planned (BOM) for production orders."
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
                <MenuItem value="WC-01 - Machining">WC-01 - Machining</MenuItem>
                <MenuItem value="WC-02 - Drilling">WC-02 - Drilling</MenuItem>
                <MenuItem value="WC-03 - Assembly">WC-03 - Assembly</MenuItem>
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
                <MenuItem value="Raw Material">Raw Material</MenuItem>
                <MenuItem value="Purchased Parts">Purchased Parts</MenuItem>
                <MenuItem value="Consumables">Consumables</MenuItem>
                <MenuItem value="Packing Material">Packing Material</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField fullWidth size="small" select label="BOM No." value={bomNo} onChange={(e) => setBomNo(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="BOM-1001">BOM-1001</MenuItem>
                <MenuItem value="BOM-1002">BOM-1002</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField fullWidth size="small" select label="Material Category" value={materialCategory} onChange={(e) => setMaterialCategory(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Direct">Direct</MenuItem>
                <MenuItem value="Indirect">Indirect</MenuItem>
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
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Planned vs Actual Consumption (Value)</Typography>
          <Card variant="outlined">
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={PLANNED_VS_ACTUAL} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => numberFmt(v)} label={{ value: 'Value (INR)', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                  <Tooltip formatter={(v) => money(v)} />
                  <Legend />
                  <Bar dataKey="planned" name="Planned Cost" fill="#1976d2" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actual" name="Actual Cost" fill="#2e7d32" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Material Consumption by Item Group</Typography>
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
                <Typography variant="subtitle1" fontWeight={700}>₹ 11,98,450</Typography>
                <Typography variant="caption" color="text.secondary">Total Actual Cost</Typography>
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
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Variance Analysis</Typography>
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2.5}>
                {VARIANCE_ANALYSIS.map((v) => (
                  <Box key={v.label}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="body2">{v.label}</Typography>
                      <Typography variant="body2" fontWeight={700}>{v.pct}%</Typography>
                    </Stack>
                    <Box sx={{ height: 10, borderRadius: 1, bgcolor: 'action.hover', overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${v.pct}%`, bgcolor: v.color, borderRadius: 1 }} />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Material Consumption Details */}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Material Consumption Details ({numberFmt(TOTAL_RECORDS)} records)</Typography>
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
                  <TableCell>UOM</TableCell>
                  <TableCell align="right">BOM Qty</TableCell>
                  <TableCell align="right">Actual Qty</TableCell>
                  <TableCell align="right">Variance Qty</TableCell>
                  <TableCell align="right">Variance %</TableCell>
                  <TableCell align="right">Planned Cost (INR)</TableCell>
                  <TableCell align="right">Actual Cost (INR)</TableCell>
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
                      <TableCell>{d.uom}</TableCell>
                      <TableCell align="right">{numberFmt(d.bomQty)}</TableCell>
                      <TableCell align="right">{numberFmt(d.actualQty)}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color={d.varQty < 0 ? 'error.main' : 'text.primary'} fontWeight={600}>{d.varQty}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color={d.varPct < 0 ? 'error.main' : 'text.primary'} fontWeight={600}>{d.varPct.toFixed(1)}%</Typography>
                      </TableCell>
                      <TableCell align="right">{money(d.plannedCost)}</TableCell>
                      <TableCell align="right">{money(d.actualCost)}</TableCell>
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
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
            <Pagination count={TOTAL_PAGES} page={page} onChange={(e, v) => setPage(v)} color="primary" />
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
