import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button,
  Chip, Checkbox, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell,
  IconButton, Collapse, LinearProgress, CircularProgress, Divider,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import AddIcon from '@mui/icons-material/Add';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import OutboxOutlinedIcon from '@mui/icons-material/OutboxOutlined';
import FilterListOutlinedIcon from '@mui/icons-material/FilterListOutlined';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import EntityListPagination from '../../../components/data-display/EntityListPagination';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Production Orders" screen, built to match the
// reference design the user supplied. Same convention as the other
// Production Planning / Production Execution screens already built this way
// (Generate Order - MRP, Generate Order - Manual, Order Generation Options,
// Generated Orders): there is no ProductionOrder, WorkCenter, BOM-issue or
// production-progress data model anywhere in this schema, so this lays out
// the screen exactly as designed with fixed mock data rather than
// fabricating "real" numbers against tables that don't exist. Local state
// only -- nothing here persists or calls the server; row selection just
// drives which row's details show in the right-hand panel.
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = ['All', 'Planned', 'Released', 'In Progress', 'Completed'];
const STATUS_META = {
  Planned: { color: 'warning' },
  Released: { color: 'info' },
  'In Progress': { color: 'success' },
  Completed: { color: 'success' },
};

const PRIORITY_OPTIONS = ['All', 'High', 'Medium', 'Low'];
const PRIORITY_META = {
  High: { color: 'error' },
  Medium: { color: 'warning' },
  Low: { color: 'info' },
};

const ORDERS = [
  { no: 'PO-2026-001', code: 'FG-1001', desc: 'Gear Housing', planned: 500, produced: 320, balance: 180, start: '01-Oct-2026', due: '10-Oct-2026', status: 'Released', priority: 'High' },
  { no: 'PO-2026-002', code: 'FG-1002', desc: 'Motor Bracket', planned: 300, produced: 300, balance: 0, start: '28-Sep-2026', due: '08-Oct-2026', status: 'Completed', priority: 'Medium' },
  { no: 'PO-2026-003', code: 'FG-1003', desc: 'Pump Cover', planned: 250, produced: 100, balance: 150, start: '02-Oct-2026', due: '14-Oct-2026', status: 'In Progress', priority: 'High' },
  { no: 'PO-2026-004', code: 'FG-1004', desc: 'Shaft Assembly', planned: 200, produced: 0, balance: 200, start: '05-Oct-2026', due: '18-Oct-2026', status: 'Planned', priority: 'Medium' },
  { no: 'PO-2026-005', code: 'FG-1005', desc: 'Valve Body', planned: 150, produced: 40, balance: 110, start: '10-Oct-2026', due: '22-Oct-2026', status: 'In Progress', priority: 'High' },
  { no: 'PO-2026-006', code: 'FG-1006', desc: 'Flange Plate', planned: 200, produced: 200, balance: 0, start: '15-Sep-2026', due: '05-Oct-2026', status: 'Completed', priority: 'Low' },
  { no: 'PO-2026-007', code: 'FG-1007', desc: 'Heat Treatment Part', planned: 150, produced: 60, balance: 90, start: '12-Oct-2026', due: '26-Oct-2026', status: 'Released', priority: 'Medium' },
  { no: 'PO-2026-008', code: 'FG-1008', desc: 'Bearing Housing', planned: 120, produced: 0, balance: 120, start: '18-Oct-2026', due: '28-Oct-2026', status: 'Planned', priority: 'Low' },
  { no: 'PO-2026-009', code: 'FG-1010', desc: 'Control Panel', planned: 100, produced: 50, balance: 50, start: '20-Oct-2026', due: '30-Oct-2026', status: 'In Progress', priority: 'Medium' },
  { no: 'PO-2026-010', code: 'FG-1011', desc: 'Electrical Kit', planned: 180, produced: 0, balance: 180, start: '22-Oct-2026', due: '02-Nov-2026', status: 'Released', priority: 'High' },
];

const TOTAL_ORDER_RECORDS = 12; // cosmetic -- matches "Showing 1 to 10 of 12 records"; only page 1's 10 rows are mocked.

const ORDER_DETAILS_EXTRA = {
  'PO-2026-001': { workCenter: 'WC-01 - Machining', salesOrder: 'SO-2026-09-001', project: 'PRJ-2026-001', customer: 'Agni Steel Pvt Ltd' },
  'PO-2026-002': { workCenter: 'WC-02 - Assembly', salesOrder: 'SO-2026-09-002', project: 'PRJ-2026-001', customer: 'XYZ Industries' },
  'PO-2026-003': { workCenter: 'WC-01 - Machining', salesOrder: 'SO-2026-09-003', project: '-', customer: 'LMN Fabrication' },
  'PO-2026-004': { workCenter: 'WC-03 - Welding', salesOrder: '-', project: 'PRJ-2026-001', customer: 'Agni Steel Pvt Ltd' },
  'PO-2026-005': { workCenter: 'WC-02 - Assembly', salesOrder: 'SO-2026-09-004', project: '-', customer: 'PQR Pvt Ltd' },
  'PO-2026-006': { workCenter: 'WC-01 - Machining', salesOrder: 'SO-2026-09-005', project: '-', customer: 'Siva Textiles' },
  'PO-2026-007': { workCenter: 'WC-04 - Heat Treatment', salesOrder: '-', project: '-', customer: 'ABC Engineering' },
  'PO-2026-008': { workCenter: 'WC-01 - Machining', salesOrder: '-', project: '-', customer: 'XYZ Industries' },
  'PO-2026-009': { workCenter: 'WC-02 - Assembly', salesOrder: '-', project: '-', customer: 'LMN Fabrication' },
  'PO-2026-010': { workCenter: 'WC-03 - Welding', salesOrder: '-', project: 'PRJ-2026-001', customer: 'Agni Steel Pvt Ltd' },
};

const MATERIAL_STATUS = { issued: 8, pending: 2, notRequired: 0 };

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

export default function ProductionOrders() {
  const [orderNo, setOrderNo] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [fromDate, setFromDate] = useState('2026-10-01');
  const [toDate, setToDate] = useState('2026-12-31');
  const [plant, setPlant] = useState('Main Plant');
  const [productionType, setProductionType] = useState('All');
  const [project, setProject] = useState('All Projects');
  const [salesOrder, setSalesOrder] = useState('All Sales Orders');
  const [customer, setCustomer] = useState('All Customers');
  const [workCenter, setWorkCenter] = useState('All Work Centers');
  const [priority, setPriority] = useState('All');

  const [search, setSearch] = useState('');
  const [checked, setChecked] = useState(() => new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [selectedOrder, setSelectedOrder] = useState('PO-2026-001');
  const [panelOpen, setPanelOpen] = useState(true);

  const rows = ORDERS.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.no.toLowerCase().includes(q) || r.code.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q);
  });

  const toggleRow = (no) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no);
      else next.add(no);
      return next;
    });
  };

  const selected = ORDERS.find((r) => r.no === selectedOrder) || ORDERS[0];
  const extra = ORDER_DETAILS_EXTRA[selected.no] || {};
  const progressPct = selected.planned > 0 ? Math.round((selected.produced / selected.planned) * 100) : 0;
  const materialPct = Math.round((MATERIAL_STATUS.issued / (MATERIAL_STATUS.issued + MATERIAL_STATUS.pending + MATERIAL_STATUS.notRequired || 1)) * 100);

  const headerActions = (
    <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
      <Button variant="contained" startIcon={<AddIcon />}>Create Production Order</Button>
      <Button variant="outlined" startIcon={<UploadFileOutlinedIcon />}>Import from Excel</Button>
      <Button variant="outlined" startIcon={<ContentCopyIcon />}>Copy</Button>
      <Button variant="outlined" startIcon={<PrintOutlinedIcon />}>Print</Button>
    </Stack>
  );

  return (
    <Box>
      <EntityHeaderCard
        icon={<SettingsIcon />}
        title="Production Orders"
        subtitle="Create, plan, release and monitor production orders for manufacturing items."
        rightContent={headerActions}
      />

      {/* Filter / Search */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2.5 }}>
            <FilterListOutlinedIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1" fontWeight={700}>Filter / Search</Typography>
          </Stack>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" label="Order No." placeholder="Enter order no..."
                value={orderNo} onChange={(e) => setOrderNo(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" label="Item Code / Description" placeholder="Search item..."
                value={itemSearch} onChange={(e) => setItemSearch(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" type="date" label="From Date"
                value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" type="date" label="To Date"
                value={toDate} onChange={(e) => setToDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Plant / Location" value={plant} onChange={(e) => setPlant(e.target.value)}>
                <MenuItem value="Main Plant">Main Plant</MenuItem>
                <MenuItem value="Plant 2">Plant 2</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Production Type" value={productionType} onChange={(e) => setProductionType(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Make to Order">Make to Order</MenuItem>
                <MenuItem value="Make to Stock">Make to Stock</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Project" value={project} onChange={(e) => setProject(e.target.value)}>
                <MenuItem value="All Projects">All Projects</MenuItem>
                <MenuItem value="PRJ-2026-001">PRJ-2026-001</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Sales Order" value={salesOrder} onChange={(e) => setSalesOrder(e.target.value)}>
                <MenuItem value="All Sales Orders">All Sales Orders</MenuItem>
                <MenuItem value="SO-2026-09-001">SO-2026-09-001</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Customer" value={customer} onChange={(e) => setCustomer(e.target.value)}>
                <MenuItem value="All Customers">All Customers</MenuItem>
                <MenuItem value="Agni Steel Pvt Ltd">Agni Steel Pvt Ltd</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Work Center" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}>
                <MenuItem value="All Work Centers">All Work Centers</MenuItem>
                <MenuItem value="WC-01 - Machining">WC-01 - Machining</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={1}>
              <TextField fullWidth size="small" select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITY_OPTIONS.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={1}>
              <Stack direction="row" spacing={1} sx={{ height: '100%' }} alignItems="center">
                <Button fullWidth variant="contained" color="warning" startIcon={<SearchIcon />}>Search</Button>
              </Stack>
            </Grid>
          </Grid>
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.5 }}>
            <Button variant="outlined" size="small">Clear</Button>
          </Stack>
        </CardContent>
      </Card>

      {/* List + details panel */}
      <Card variant="outlined">
        <Stack
          direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5}
          sx={{ px: 3, pt: 2.5, pb: 1.5 }}
        >
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Typography variant="subtitle1" fontWeight={700}>Production Orders</Typography>
            <Chip size="small" label={TOTAL_ORDER_RECORDS} color="primary" />
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
            <TextField
              size="small"
              placeholder="Search in list..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              sx={{ minWidth: 220 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
            <Button variant="outlined" size="small" startIcon={<FilterAltOutlinedIcon />}>Filter</Button>
            <Button variant="outlined" size="small" startIcon={<FileDownloadOutlinedIcon />}>Export</Button>
          </Stack>
        </Stack>

        <Grid container>
          <Grid item xs={12} md={8} lg={8.5}>
            <ScrollableTableContainer maxHeight="clamp(260px, calc(100vh - 520px), 460px)">
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" rowSpan={2} />
                    <TableCell rowSpan={2}>S.No</TableCell>
                    <TableCell rowSpan={2}>Production Order No.</TableCell>
                    <TableCell rowSpan={2}>Item Code</TableCell>
                    <TableCell rowSpan={2}>Item Description</TableCell>
                    <TableCell align="center" colSpan={3}>Quantity</TableCell>
                    <TableCell rowSpan={2}>Start Date</TableCell>
                    <TableCell rowSpan={2}>Due Date</TableCell>
                    <TableCell rowSpan={2}>Status</TableCell>
                    <TableCell rowSpan={2}>Priority</TableCell>
                    <TableCell rowSpan={2}>Action</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell align="right">Planned</TableCell>
                    <TableCell align="right">Produced</TableCell>
                    <TableCell align="right">Balance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r, idx) => (
                    <TableRow
                      key={r.no} hover selected={selectedOrder === r.no}
                      onClick={() => setSelectedOrder(r.no)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox size="small" checked={checked.has(r.no)} onClick={(e) => e.stopPropagation()} onChange={() => toggleRow(r.no)} />
                      </TableCell>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{r.no}</Typography></TableCell>
                      <TableCell>{r.code}</TableCell>
                      <TableCell>{r.desc}</TableCell>
                      <TableCell align="right">{numberFmt(r.planned)}</TableCell>
                      <TableCell align="right">{numberFmt(r.produced)}</TableCell>
                      <TableCell align="right">{numberFmt(r.balance)}</TableCell>
                      <TableCell>{r.start}</TableCell>
                      <TableCell>{r.due}</TableCell>
                      <TableCell>
                        <Chip size="small" label={r.status} color={STATUS_META[r.status]?.color || 'default'} />
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={r.priority} color={PRIORITY_META[r.priority]?.color || 'default'} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Button size="small" endIcon={<KeyboardArrowDownIcon />}>View</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTableContainer>

            <EntityListPagination
              total={TOTAL_ORDER_RECORDS}
              page={page}
              onChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
            />
          </Grid>

          {/* Production Order Details side panel */}
          <Grid item xs={12} md={4} lg={3.5}>
            <Box sx={{ p: 2.5, borderLeft: { md: '1px solid' }, borderColor: 'divider', height: '100%' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <DescriptionOutlinedIcon fontSize="small" color="primary" />
                  <Typography variant="body2" fontWeight={700}>Production Order Details</Typography>
                </Stack>
                <IconButton size="small" onClick={() => setPanelOpen((v) => !v)}>
                  {panelOpen ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                </IconButton>
              </Stack>

              <Collapse in={panelOpen}>
                <Stack spacing={1} sx={{ mb: 2.5 }}>
                  {[
                    { label: 'Production Order No.', value: selected.no },
                    { label: 'Item Code', value: selected.code },
                    { label: 'Item Description', value: selected.desc },
                    { label: 'Planned Qty', value: `${numberFmt(selected.planned)} Nos` },
                    { label: 'Produced Qty', value: `${numberFmt(selected.produced)} Nos` },
                    { label: 'Balance Qty', value: `${numberFmt(selected.balance)} Nos` },
                    { label: 'Start Date', value: selected.start },
                    { label: 'Due Date', value: selected.due },
                  ].map((f) => (
                    <Stack key={f.label} direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">{f.label}</Typography>
                      <Typography variant="caption" fontWeight={600}>{f.value}</Typography>
                    </Stack>
                  ))}
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary">Status</Typography>
                    <Chip size="small" label={selected.status} color={STATUS_META[selected.status]?.color || 'default'} />
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary">Priority</Typography>
                    <Chip size="small" label={selected.priority} color={PRIORITY_META[selected.priority]?.color || 'default'} variant="outlined" />
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">Work Center</Typography>
                    <Typography variant="caption" fontWeight={600}>{extra.workCenter || '-'}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">Sales Order</Typography>
                    <Typography variant="caption" fontWeight={600}>{extra.salesOrder || '-'}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">Project</Typography>
                    <Typography variant="caption" fontWeight={600}>{extra.project || '-'}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">Customer</Typography>
                    <Typography variant="caption" fontWeight={600}>{extra.customer || '-'}</Typography>
                  </Stack>
                </Stack>

                <Divider sx={{ mb: 2 }} />

                <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>Production Progress</Typography>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
                  <LinearProgress
                    variant="determinate" value={progressPct}
                    sx={{ flex: 1, height: 8, borderRadius: 4 }}
                    color="success"
                  />
                  <Typography variant="caption" fontWeight={700}>{progressPct}%</Typography>
                </Stack>
                <Stack spacing={0.5} sx={{ mb: 2.5 }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">Planned Qty</Typography>
                    <Typography variant="caption" fontWeight={600}>{numberFmt(selected.planned)}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">Produced Qty</Typography>
                    <Typography variant="caption" fontWeight={600}>{numberFmt(selected.produced)}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">Balance Qty</Typography>
                    <Typography variant="caption" fontWeight={600}>{numberFmt(selected.balance)}</Typography>
                  </Stack>
                </Stack>

                <Divider sx={{ mb: 2 }} />

                <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Material Status (BOM)</Typography>
                <Stack direction="row" spacing={2.5} alignItems="center" sx={{ mb: 2 }}>
                  <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                    <CircularProgress variant="determinate" value={materialPct} size={64} thickness={5} color="success" />
                    <Box sx={{
                      top: 0, left: 0, bottom: 0, right: 0, position: 'absolute',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Typography variant="caption" fontWeight={700}>{materialPct}%</Typography>
                    </Box>
                  </Box>
                  <Stack spacing={0.5}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} />
                      <Typography variant="caption" color="text.secondary">Issued : {MATERIAL_STATUS.issued}</Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main' }} />
                      <Typography variant="caption" color="text.secondary">Pending : {MATERIAL_STATUS.pending}</Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'action.disabled' }} />
                      <Typography variant="caption" color="text.secondary">Not Required : {MATERIAL_STATUS.notRequired}</Typography>
                    </Stack>
                  </Stack>
                </Stack>

                <Stack direction="row" spacing={2}>
                  <Typography variant="caption" color="primary.main" fontWeight={600} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <DescriptionOutlinedIcon sx={{ fontSize: 14 }} /> View BOM
                  </Typography>
                  <Typography variant="caption" color="primary.main" fontWeight={600} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <OutboxOutlinedIcon sx={{ fontSize: 14 }} /> View Material Issue
                  </Typography>
                </Stack>
              </Collapse>
            </Box>
          </Grid>
        </Grid>
      </Card>

      {/* Bottom action bar */}
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 2.5 }} flexWrap="wrap" useFlexGap>
        <Button variant="outlined" startIcon={<VisibilityOutlinedIcon />}>View</Button>
        <Button variant="outlined" startIcon={<EditOutlinedIcon />}>Edit</Button>
        <Button variant="outlined" startIcon={<RocketLaunchOutlinedIcon />}>Release</Button>
        <Button variant="outlined" startIcon={<CheckCircleOutlineIcon />}>Close</Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" startIcon={<PrintOutlinedIcon />}>Print</Button>
        <Button variant="contained" color="warning" startIcon={<AddIcon />}>Create Production Order</Button>
      </Stack>
    </Box>
  );
}
