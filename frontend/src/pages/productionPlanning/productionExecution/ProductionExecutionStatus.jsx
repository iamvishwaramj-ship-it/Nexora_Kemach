import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Chip,
  Checkbox, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell, IconButton, Menu,
} from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import SettingsIcon from '@mui/icons-material/Settings';
import AddIcon from '@mui/icons-material/Add';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import OutboxOutlinedIcon from '@mui/icons-material/OutboxOutlined';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import EntityListPagination from '../../../components/data-display/EntityListPagination';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Production Execution" list screen, built to
// match the reference design the user supplied for the Production
// Execution > Production Execution submenu. Same convention as the other
// Production Execution list screens (Production Orders, Material
// Requisition, Material Issue): there is no per-operation execution data
// model in this schema, so this lays out the screen exactly as designed
// with fixed mock data rather than fabricating "real" records against
// tables that don't exist. Local state only -- nothing here persists or
// calls the server. The right-rail summary numbers are fixed to match the
// reference screenshot exactly rather than being derived from the 10 mock
// rows shown on this page (the screenshot itself represents 12 total
// records with only page 1's 10 rows mocked), same static-mock convention
// used for Material Issue and Product Cost History.
// ---------------------------------------------------------------------------

const STATUS_META = {
  Completed: { color: 'success' },
  'In Progress': { color: 'info' },
  'Not Started': { color: 'default' },
  'On Hold': { color: 'warning' },
  Delayed: { color: 'error' },
};

const EXECUTIONS = [
  { id: 1, po: 'PO-2026-001', itemCode: 'FG-1001', itemDesc: 'Gear Housing', workCenter: 'WC-01', opNo: 'OP-10', opName: 'Machining', plannedQty: 500, actualQty: 480, status: 'In Progress', start: '01-Oct-26 08:00', end: '-' },
  { id: 2, po: 'PO-2026-001', itemCode: 'FG-1001', itemDesc: 'Gear Housing', workCenter: 'WC-02', opNo: 'OP-20', opName: 'Drilling', plannedQty: 500, actualQty: 320, status: 'In Progress', start: '01-Oct-26 10:30', end: '-' },
  { id: 3, po: 'PO-2026-002', itemCode: 'FG-1002', itemDesc: 'Motor Bracket', workCenter: 'WC-01', opNo: 'OP-10', opName: 'Cutting', plannedQty: 1000, actualQty: 1000, status: 'Completed', start: '01-Oct-26 07:45', end: '01-Oct-26 12:30' },
  { id: 4, po: 'PO-2026-002', itemCode: 'FG-1002', itemDesc: 'Motor Bracket', workCenter: 'WC-03', opNo: 'OP-20', opName: 'Tapping', plannedQty: 1000, actualQty: 850, status: 'In Progress', start: '01-Oct-26 13:15', end: '-' },
  { id: 5, po: 'PO-2026-003', itemCode: 'FG-1003', itemDesc: 'Pump Cover', workCenter: 'WC-02', opNo: 'OP-10', opName: 'Turning', plannedQty: 300, actualQty: 0, status: 'Not Started', start: '-', end: '-' },
  { id: 6, po: 'PO-2026-003', itemCode: 'FG-1003', itemDesc: 'Pump Cover', workCenter: 'WC-04', opNo: 'OP-20', opName: 'Milling', plannedQty: 300, actualQty: 0, status: 'Not Started', start: '-', end: '-' },
  { id: 7, po: 'PO-2026-004', itemCode: 'FG-1004', itemDesc: 'Valve Body', workCenter: 'WC-01', opNo: 'OP-10', opName: 'Machining', plannedQty: 200, actualQty: 200, status: 'Completed', start: '02-Oct-26 08:00', end: '02-Oct-26 16:30' },
  { id: 8, po: 'PO-2026-005', itemCode: 'FG-1005', itemDesc: 'Flange', workCenter: 'WC-03', opNo: 'OP-10', opName: 'Drilling', plannedQty: 400, actualQty: 250, status: 'In Progress', start: '03-Oct-26 09:00', end: '-' },
  { id: 9, po: 'PO-2026-006', itemCode: 'FG-1006', itemDesc: 'Shaft', workCenter: 'WC-02', opNo: 'OP-10', opName: 'Turning', plannedQty: 150, actualQty: 150, status: 'Completed', start: '03-Oct-26 07:30', end: '03-Oct-26 11:45' },
  { id: 10, po: 'PO-2026-006', itemCode: 'FG-1006', itemDesc: 'Shaft', workCenter: 'WC-04', opNo: 'OP-20', opName: 'Grinding', plannedQty: 150, actualQty: 60, status: 'In Progress', start: '03-Oct-26 13:00', end: '-' },
];

const TOTAL_RECORDS = 12;

const STATUS_SUMMARY = [
  { label: 'Completed', value: 3, color: '#2e7d32' },
  { label: 'In Progress', value: 5, color: '#1976d2' },
  { label: 'Not Started', value: 2, color: '#9e9e9e' },
  { label: 'On Hold', value: 1, color: '#f9a825' },
  { label: 'Delayed', value: 1, color: '#d32f2f' },
];

const WORK_CENTER_LOAD = [
  { label: 'WC-01', value: 85, color: 'success' },
  { label: 'WC-02', value: 70, color: 'info' },
  { label: 'WC-03', value: 60, color: 'info' },
  { label: 'WC-04', value: 40, color: 'warning' },
];

const OPERATOR_PERFORMANCE = [
  { label: 'Mani', qty: 320 },
  { label: 'Dheena S', qty: 250 },
  { label: 'Arunkumar', qty: 200 },
  { label: 'Kannan P', qty: 150 },
];

const TOP_ITEMS_BY_ACTUAL_QTY = [
  { label: 'Gear Housing', qty: 800 },
  { label: 'Motor Bracket', qty: 850 },
  { label: 'Valve Body', qty: 200 },
  { label: 'Flange', qty: 250 },
  { label: 'Shaft', qty: 210 },
];

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function progressPct(actual, planned) {
  if (!planned) return 0;
  return Math.min(100, Math.round((actual / planned) * 100));
}

function RowActionMenu() {
  const [anchorEl, setAnchorEl] = useState(null);
  return (
    <>
      <IconButton size="small" onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); }}>
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)} onClick={(e) => e.stopPropagation()}>
        <MenuItem onClick={() => setAnchorEl(null)}>View Details</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>Update Actuals</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>Hold Order</MenuItem>
      </Menu>
    </>
  );
}

export default function ProductionExecutionStatus() {
  const navigate = useNavigate();
  const [productionOrder, setProductionOrder] = useState('');
  const [fromDate, setFromDate] = useState('2026-10-01');
  const [toDate, setToDate] = useState('2026-10-10');
  const [status, setStatus] = useState('All');
  const [workCenter, setWorkCenter] = useState('All');
  const [itemCode, setItemCode] = useState('');
  const [plant, setPlant] = useState('Main Plant');
  const [shift, setShift] = useState('All');
  const [operator, setOperator] = useState('All');
  const [routingOperation, setRoutingOperation] = useState('All');

  const [checked, setChecked] = useState(() => new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const toggleRow = (id) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const headerActions = (
    <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/production-execution/record-production')}>
        Record Production
      </Button>
      <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />}>Import Data</Button>
      <Button variant="outlined" startIcon={<PrintOutlinedIcon />}>Print</Button>
    </Stack>
  );

  return (
    <Box>
      <EntityHeaderCard
        icon={<SettingsIcon />}
        title="Production Execution"
        subtitle="Execute and record production activities, track progress and capture actual details."
        rightContent={headerActions}
      />

      {/* Search / Filter */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>Search / Filter</Typography>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" label="Production Order" placeholder="Search PO..."
                value={productionOrder} onChange={(e) => setProductionOrder(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" type="date" label="From Date"
                value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" type="date" label="To Date"
                value={toDate} onChange={(e) => setToDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Not Started">Not Started</MenuItem>
                <MenuItem value="In Progress">In Progress</MenuItem>
                <MenuItem value="Completed">Completed</MenuItem>
                <MenuItem value="On Hold">On Hold</MenuItem>
                <MenuItem value="Delayed">Delayed</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Work Center" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="WC-01">WC-01</MenuItem>
                <MenuItem value="WC-02">WC-02</MenuItem>
                <MenuItem value="WC-03">WC-03</MenuItem>
                <MenuItem value="WC-04">WC-04</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" label="Item Code" placeholder="Search item..."
                value={itemCode} onChange={(e) => setItemCode(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Plant / Location" value={plant} onChange={(e) => setPlant(e.target.value)}>
                <MenuItem value="Main Plant">Main Plant</MenuItem>
                <MenuItem value="Plant 2">Plant 2</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Shift" value={shift} onChange={(e) => setShift(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Day">Day</MenuItem>
                <MenuItem value="Night">Night</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Operator" value={operator} onChange={(e) => setOperator(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Mani">Mani</MenuItem>
                <MenuItem value="Dheena S">Dheena S</MenuItem>
                <MenuItem value="Arunkumar">Arunkumar</MenuItem>
                <MenuItem value="Kannan P">Kannan P</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Routing Operation" value={routingOperation} onChange={(e) => setRoutingOperation(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Machining">Machining</MenuItem>
                <MenuItem value="Drilling">Drilling</MenuItem>
                <MenuItem value="Cutting">Cutting</MenuItem>
                <MenuItem value="Tapping">Tapping</MenuItem>
                <MenuItem value="Turning">Turning</MenuItem>
                <MenuItem value="Milling">Milling</MenuItem>
                <MenuItem value="Grinding">Grinding</MenuItem>
              </TextField>
            </Grid>
          </Grid>

          <Stack direction="row" justifyContent="flex-end" spacing={1.5} sx={{ mt: 2.5 }}>
            <Button variant="outlined">Reset</Button>
            <Button variant="contained" startIcon={<SearchIcon />}>Search</Button>
          </Stack>
        </CardContent>
      </Card>

      {/* List + summary */}
      <Grid container spacing={2}>
        <Grid item xs={12} lg={8.5}>
          <Card variant="outlined">
            <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={700}>Production Execution List ({TOTAL_RECORDS})</Typography>
            </Stack>

            <ScrollableTableContainer maxHeight="clamp(260px, calc(100vh - 560px), 460px)">
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>S.No</TableCell>
                    <TableCell>Prod. Order No.</TableCell>
                    <TableCell>Item Code</TableCell>
                    <TableCell>Item Description</TableCell>
                    <TableCell>Work Center</TableCell>
                    <TableCell>Operation</TableCell>
                    <TableCell align="right">Planned Qty</TableCell>
                    <TableCell align="right">Actual Qty</TableCell>
                    <TableCell sx={{ minWidth: 120 }}>Progress</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Start Time</TableCell>
                    <TableCell>End Time</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {EXECUTIONS.map((r, idx) => {
                    const pct = progressPct(r.actualQty, r.plannedQty);
                    return (
                      <TableRow key={r.id} hover>
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={checked.has(r.id)} onChange={() => toggleRow(r.id)} />
                        </TableCell>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{r.po}</Typography></TableCell>
                        <TableCell>{r.itemCode}</TableCell>
                        <TableCell>{r.itemDesc}</TableCell>
                        <TableCell>{r.workCenter}</TableCell>
                        <TableCell>{r.opNo}<br /><Typography variant="caption" color="text.secondary">{r.opName}</Typography></TableCell>
                        <TableCell align="right">{numberFmt(r.plannedQty)}</TableCell>
                        <TableCell align="right">{numberFmt(r.actualQty)}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box sx={{ flex: 1, height: 7, borderRadius: 4, bgcolor: 'action.hover', overflow: 'hidden' }}>
                              <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: pct === 100 ? 'success.main' : pct > 0 ? 'info.main' : 'transparent' }} />
                            </Box>
                            <Typography variant="caption" fontWeight={700} sx={{ minWidth: 32 }}>{pct}%</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={r.status} color={STATUS_META[r.status]?.color || 'default'} />
                        </TableCell>
                        <TableCell>{r.start}</TableCell>
                        <TableCell>{r.end}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.25}>
                            <IconButton size="small"><VisibilityOutlinedIcon fontSize="small" /></IconButton>
                            <IconButton size="small"><EditOutlinedIcon fontSize="small" /></IconButton>
                            <RowActionMenu />
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollableTableContainer>

            <EntityListPagination
              total={TOTAL_RECORDS}
              page={page}
              onChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
            />
          </Card>
        </Grid>

        {/* Right rail: summaries */}
        <Grid item xs={12} lg={3.5}>
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Execution Summary</Typography>
              <Stack direction="row" spacing={2.5} alignItems="center">
                <Box sx={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={STATUS_SUMMARY} dataKey="value" nameKey="label"
                        innerRadius={36} outerRadius={56} paddingAngle={2}
                      >
                        {STATUS_SUMMARY.map((s) => <Cell key={s.label} fill={s.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <Box sx={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Typography variant="h6" fontWeight={700}>{TOTAL_RECORDS}</Typography>
                    <Typography variant="caption" color="text.secondary">Orders</Typography>
                  </Box>
                </Box>
                <Stack spacing={0.75}>
                  {STATUS_SUMMARY.map((s) => (
                    <Stack key={s.label} direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color }} />
                        <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                      </Stack>
                      <Typography variant="caption" fontWeight={700}>: {s.value}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Work Center Load (Today)</Typography>
              <Stack spacing={1.5}>
                {WORK_CENTER_LOAD.map((w) => (
                  <Stack key={w.label} direction="row" spacing={1.5} alignItems="center">
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 40 }}>{w.label}</Typography>
                    <Box sx={{ flex: 1, height: 7, borderRadius: 4, bgcolor: 'action.hover', overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${w.value}%`, bgcolor: `${w.color}.main` }} />
                    </Box>
                    <Typography variant="caption" fontWeight={700} sx={{ minWidth: 32, textAlign: 'right' }}>{w.value}%</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Operator Performance (Today)</Typography>
              <Stack spacing={1.25}>
                {OPERATOR_PERFORMANCE.map((o) => (
                  <Stack key={o.label} direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">{o.label}</Typography>
                    <Typography variant="body2" fontWeight={700}>{numberFmt(o.qty)}</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Top 5 Items by Actual Qty</Typography>
              <Stack spacing={1.25}>
                {TOP_ITEMS_BY_ACTUAL_QTY.map((item, idx) => (
                  <Stack key={item.label} direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">{idx + 1}. {item.label}</Typography>
                    <Typography variant="body2" fontWeight={700}>{numberFmt(item.qty)}</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Bottom action bar */}
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 2.5 }}>
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />}>Back to List</Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" startIcon={<EditOutlinedIcon />}>Update Actuals</Button>
        <Button variant="outlined" startIcon={<OutboxOutlinedIcon />}>Issue Material</Button>
        <Button variant="contained" color="success" startIcon={<CheckCircleOutlineIcon />}>Complete Operation</Button>
        <Button variant="outlined" color="error" startIcon={<CancelOutlinedIcon />}>Close Order</Button>
      </Stack>
    </Box>
  );
}
