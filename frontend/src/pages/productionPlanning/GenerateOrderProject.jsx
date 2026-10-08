import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button,
  Chip, Checkbox, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell,
  IconButton, Avatar,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import InsightsIcon from '@mui/icons-material/Insights';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ClearIcon from '@mui/icons-material/Clear';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AssignmentIcon from '@mui/icons-material/Assignment';
import SummarizeOutlinedIcon from '@mui/icons-material/SummarizeOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import GroupsIcon from '@mui/icons-material/Groups';
import BuildIcon from '@mui/icons-material/Build';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import EntityListPagination from '../../components/data-display/EntityListPagination';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Generate Order - Project" screen, built to
// match the reference design the user supplied. Same convention as the other
// Production Planning Generate Order screens already built this way
// (Generate Order - MRP, Generate Order - Manual, Generate Order - Sales
// Order, Order Generation Options, Generated Orders): there is no Project or
// sales-order-fulfilment data model wired to production planning anywhere in
// this schema, so this lays out the screen exactly as designed with fixed
// mock data rather than fabricating "real" numbers against tables that don't
// exist. Local state only -- nothing here persists or calls the server; only
// the 5 method cards and the Preview/Generate Orders actions actually
// navigate (to the other already-built Generate Order pages).
// ---------------------------------------------------------------------------

const METHODS = [
  {
    key: 'mrp', path: '/production-planning/generate-order-mrp', label: 'MRP', desc: 'Based on MRP planned requirements',
    icon: AssignmentOutlinedIcon, color: '#e65100', a: { label: 'Items', value: '52' }, b: { label: 'Net Qty', value: '12,500' },
  },
  {
    key: 'manual', path: '/production-planning/generate-order-manual', label: 'Manual', desc: 'Manually select FG items',
    icon: TouchAppIcon, color: '#1565c0', a: { label: 'Items', value: '28' }, b: { label: 'Net Qty', value: '8,200' },
  },
  {
    key: 'sales-order', path: '/production-planning/generate-order-sales-order', label: 'Sales Order', desc: 'Based on open Sales Order quantity',
    icon: DescriptionOutlinedIcon, color: '#2e7d32', a: { label: 'Orders', value: '15' }, b: { label: 'Open Qty', value: '6,800' },
  },
  {
    key: 'forecast', path: '/production-planning/generate-order-forecast', label: 'Forecast', desc: 'Based on forecast / planned demand',
    icon: InsightsIcon, color: '#6a1b9a', a: { label: 'Plans', value: '8' }, b: { label: 'Net Qty', value: '4,500' },
  },
  {
    key: 'project', path: '/production-planning/generate-order-project', label: 'Project', desc: 'Based on Project name (Only Sales Orders with selected Project)',
    icon: WorkOutlineIcon, color: '#00695c', a: { label: 'Projects', value: '6' }, b: { label: 'Net Qty', value: '3,800' },
  },
];

const SALES_ORDERS = [
  { no: 'SO-2026-09-001', customer: 'Agni Steel Pvt Ltd', project: 'PRJ-2026-001', orderDate: '25-Sep-2026', deliveryDate: '05-Oct-2026', status: 'Open', netQty: 500, selectQty: 500 },
  { no: 'SO-2026-09-004', customer: 'Agni Steel Pvt Ltd', project: 'PRJ-2026-001', orderDate: '28-Sep-2026', deliveryDate: '12-Oct-2026', status: 'Open', netQty: 300, selectQty: 300 },
  { no: 'SO-2026-09-007', customer: 'Agni Steel Pvt Ltd', project: 'PRJ-2026-001', orderDate: '01-Oct-2026', deliveryDate: '18-Oct-2026', status: 'Open', netQty: 250, selectQty: 250 },
  { no: 'SO-2026-09-010', customer: 'Agni Steel Pvt Ltd', project: 'PRJ-2026-001', orderDate: '02-Oct-2026', deliveryDate: '25-Oct-2026', status: 'Open', netQty: 200, selectQty: 0 },
  { no: 'SO-2026-10-001', customer: 'Agni Steel Pvt Ltd', project: 'PRJ-2026-001', orderDate: '03-Oct-2026', deliveryDate: '28-Oct-2026', status: 'Open', netQty: 150, selectQty: 0 },
  { no: 'SO-2026-10-003', customer: 'Agni Steel Pvt Ltd', project: 'PRJ-2026-001', orderDate: '04-Oct-2026', deliveryDate: '30-Oct-2026', status: 'Open', netQty: 100, selectQty: 0 },
];

const TOTAL_SO_RECORDS = 6;

const PROJECT_INFO = [
  { label: 'Project Code', value: 'PRJ-2026-001' },
  { label: 'Project Name', value: 'Agni Steel Expansion' },
  { label: 'Customer', value: 'Agni Steel Pvt Ltd' },
  { label: 'Project Manager', value: 'Radhakrishnan' },
  { label: 'Start Date', value: '01-Sep-2026' },
  { label: 'End Date', value: '31-Dec-2026' },
  { label: 'Status', value: 'In Progress', isChip: true },
  { label: 'Plant / Location', value: 'Main Plant' },
];

const ORDER_PREVIEW_CARDS = [
  { key: 'production', label: 'Production Orders', icon: PrecisionManufacturingIcon, color: 'info', items: 8, qty: '1,050', unit: 'Nos' },
  { key: 'purchase', label: 'Purchase Orders', icon: ShoppingCartIcon, color: 'warning', items: 4, qty: '450', unit: 'Nos' },
  { key: 'subcontracting', label: 'Subcontracting Orders', icon: GroupsIcon, color: 'secondary', items: 2, qty: '300', unit: 'Nos' },
  { key: 'jobwork', label: 'Job Work Orders', icon: BuildIcon, color: 'success', items: 1, qty: '100', unit: 'Nos' },
];

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

export default function GenerateOrderProject() {
  const navigate = useNavigate();
  const [project, setProject] = useState('PRJ-2026-001 - Agni Steel Expansion');
  const [goNumber, setGoNumber] = useState('GO-2026-10-005');
  const [goDate, setGoDate] = useState('2026-10-01');
  const [requiredDate, setRequiredDate] = useState('2026-12-31');
  const [plant, setPlant] = useState('Main Plant');
  const [notes, setNotes] = useState('');

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set(['SO-2026-09-001', 'SO-2026-09-004', 'SO-2026-09-007']));
  const [selectQtyByNo, setSelectQtyByNo] = useState(() => Object.fromEntries(SALES_ORDERS.map((r) => [r.no, r.selectQty])));
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const rows = SALES_ORDERS.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.no.toLowerCase().includes(q) || r.customer.toLowerCase().includes(q);
  });

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.no));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) rows.forEach((r) => next.delete(r.no));
      else rows.forEach((r) => next.add(r.no));
      return next;
    });
  };
  const toggleRow = (no) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no);
      else next.add(no);
      return next;
    });
  };

  const totalNetQty = SALES_ORDERS.filter((r) => selected.has(r.no)).reduce((sum, r) => sum + r.netQty, 0);
  const totalSelectedQty = SALES_ORDERS.filter((r) => selected.has(r.no)).reduce((sum, r) => sum + Number(selectQtyByNo[r.no] || 0), 0);

  return (
    <Box>
      <EntityHeaderCard
        icon={<SettingsIcon />}
        title="Generate Order (Project)"
        subtitle="Create Production, Purchase, Subcontracting and Job Work orders from Sales Orders for the selected Project."
      />

      {/* Method selector */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {METHODS.map((m) => {
          const Icon = m.icon;
          const active = m.key === 'project';
          return (
            <Grid item xs={12} sm={6} md={2.4} key={m.key}>
              <Card
                variant="outlined"
                onClick={() => !active && navigate(m.path)}
                sx={{
                  cursor: active ? 'default' : 'pointer', height: '100%',
                  borderColor: active ? '#00695c' : 'divider', borderWidth: active ? 2 : 1,
                  bgcolor: active ? 'rgba(0, 105, 92, 0.06)' : 'background.paper',
                }}
              >
                <CardContent>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                    <Avatar sx={{ bgcolor: m.color, width: 40, height: 40 }}>
                      <Icon fontSize="small" />
                    </Avatar>
                    <Box
                      sx={{
                        width: 18, height: 18, borderRadius: '50%', border: '2px solid',
                        borderColor: active ? '#00695c' : 'divider',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {active && <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: '#00695c' }} />}
                    </Box>
                  </Stack>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 1 }}>{m.label}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', minHeight: 32 }}>
                    {m.desc}
                  </Typography>
                  <Stack direction="row" spacing={2.5} sx={{ mt: 1 }}>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={700}>{m.a.value}</Typography>
                      <Typography variant="caption" color="text.secondary">{m.a.label}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={700}>{m.b.value}</Typography>
                      <Typography variant="caption" color="text.secondary">{m.b.label}</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Step 1 */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>
            Step 1: Select Project &amp; GO Details
          </Typography>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" select label="Project" required
                value={project} onChange={(e) => setProject(e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end" sx={{ mr: 2 }}>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); setProject(''); }}>
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              >
                <MenuItem value="PRJ-2026-001 - Agni Steel Expansion">PRJ-2026-001 - Agni Steel Expansion</MenuItem>
                <MenuItem value="PRJ-2026-002 - Shakti Foundry Upgrade">PRJ-2026-002 - Shakti Foundry Upgrade</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Stack direction="row" spacing={0.5}>
                <TextField
                  fullWidth size="small" label="GO Number" required
                  value={goNumber} onChange={(e) => setGoNumber(e.target.value)}
                />
                <IconButton size="small" sx={{ border: '1px solid', borderColor: 'divider', alignSelf: 'center' }}>
                  <SettingsIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" type="date" label="GO Date" required
                value={goDate} onChange={(e) => setGoDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" type="date" label="Required Delivery Date"
                value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={1.5}>
              <TextField
                fullWidth size="small" select label="Plant / Location"
                value={plant} onChange={(e) => setPlant(e.target.value)}
              >
                <MenuItem value="Main Plant">Main Plant</MenuItem>
                <MenuItem value="Plant 2">Plant 2</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={1.5}>
              <TextField
                fullWidth size="small" label="Notes" placeholder="Enter remarks..."
                value={notes} onChange={(e) => setNotes(e.target.value)}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Step 2 */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <Stack
          direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5}
          sx={{ px: 3, pt: 2.5, pb: 1.5 }}
        >
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Typography variant="subtitle1" fontWeight={700}>Step 2: Select Sales Orders for the Project</Typography>
            <Chip size="small" label={SALES_ORDERS.length} color="primary" />
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
            <TextField
              size="small"
              placeholder="Search Sales Order, Customer, Item..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              sx={{ minWidth: 260 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
            <Button variant="outlined" size="small" startIcon={<FilterAltOutlinedIcon />}>Filter</Button>
          </Stack>
        </Stack>

        <Box sx={{ px: 3, pb: 1.5 }}>
          <Stack
            direction="row" spacing={1} alignItems="center"
            sx={{ p: 1.25, borderRadius: 1, bgcolor: 'rgba(33, 150, 243, 0.08)', border: '1px solid', borderColor: 'rgba(33, 150, 243, 0.3)' }}
          >
            <InfoOutlinedIcon fontSize="small" color="info" />
            <Typography variant="caption" color="text.secondary">
              Only open Sales Orders with the selected Project name are listed below.
            </Typography>
          </Stack>
        </Box>

        <Grid container>
          <Grid item xs={12} md={8} lg={8.5}>
            <ScrollableTableContainer maxHeight="clamp(240px, calc(100vh - 560px), 420px)">
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={allSelected} onChange={toggleAll} />
                    </TableCell>
                    <TableCell>S.No</TableCell>
                    <TableCell>Sales Order No.</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Project Name</TableCell>
                    <TableCell>Order Date</TableCell>
                    <TableCell>Delivery Date</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Net Qty (Nos)</TableCell>
                    <TableCell align="right">Select Qty (Nos)</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r, idx) => (
                    <TableRow key={r.no} hover>
                      <TableCell padding="checkbox">
                        <Checkbox size="small" checked={selected.has(r.no)} onChange={() => toggleRow(r.no)} />
                      </TableCell>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{r.no}</Typography></TableCell>
                      <TableCell>{r.customer}</TableCell>
                      <TableCell>{r.project}</TableCell>
                      <TableCell>{r.orderDate}</TableCell>
                      <TableCell>{r.deliveryDate}</TableCell>
                      <TableCell><Chip size="small" label={r.status} color="success" variant="outlined" /></TableCell>
                      <TableCell align="right">{numberFmt(r.netQty)}</TableCell>
                      <TableCell align="right">
                        <TextField
                          size="small" type="number" value={selectQtyByNo[r.no]}
                          onChange={(e) => setSelectQtyByNo((prev) => ({ ...prev, [r.no]: e.target.value }))}
                          sx={{ width: 90 }}
                          inputProps={{ style: { textAlign: 'right' } }}
                        />
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
              total={TOTAL_SO_RECORDS}
              page={page}
              onChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
            />
          </Grid>

          {/* Project / selection summary side panel */}
          <Grid item xs={12} md={4} lg={3.5}>
            <Box sx={{ p: 2.5, borderLeft: { md: '1px solid' }, borderColor: 'divider', height: '100%' }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <AssignmentIcon fontSize="small" color="primary" />
                <Typography variant="body2" fontWeight={700}>Project Information</Typography>
              </Stack>
              <Stack spacing={1} sx={{ mb: 2.5 }}>
                {PROJECT_INFO.map((f) => (
                  <Stack key={f.label} direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary">{f.label}</Typography>
                    {f.isChip ? (
                      <Chip size="small" label={f.value} color="warning" variant="outlined" />
                    ) : (
                      <Typography variant="caption" fontWeight={600}>{f.value}</Typography>
                    )}
                  </Stack>
                ))}
              </Stack>

              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <SummarizeOutlinedIcon fontSize="small" color="primary" />
                <Typography variant="body2" fontWeight={700}>Selected Sales Order Summary</Typography>
              </Stack>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">Total Sales Orders</Typography>
                  <Typography variant="caption" fontWeight={600}>{selected.size}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">Total Net Qty</Typography>
                  <Typography variant="caption" fontWeight={600}>{numberFmt(totalNetQty)} Nos</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">Selected Qty</Typography>
                  <Typography variant="caption" fontWeight={600}>{numberFmt(totalSelectedQty)} Nos</Typography>
                </Stack>
              </Stack>
            </Box>
          </Grid>
        </Grid>
      </Card>

      {/* Step 3 */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>
            Step 3: Order Generation Preview ({selected.size} Sales Order{selected.size === 1 ? '' : 's'} Selected)
          </Typography>
          <Grid container spacing={2}>
            {ORDER_PREVIEW_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <Grid item xs={12} sm={6} md={3} key={card.key}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Avatar sx={{ bgcolor: `${card.color}.main`, width: 40, height: 40, mb: 1 }}>
                        <Icon fontSize="small" />
                      </Avatar>
                      <Typography variant="subtitle2" fontWeight={700}>{card.label}</Typography>
                      <Stack direction="row" spacing={3} sx={{ mt: 1 }}>
                        <Box>
                          <Typography variant="h6" fontWeight={700}>{card.items}</Typography>
                          <Typography variant="caption" color="text.secondary">{card.items === 1 ? 'Item' : 'Items'}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="h6" fontWeight={700}>{card.qty}</Typography>
                          <Typography variant="caption" color="text.secondary">{card.unit}</Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 2.5 }} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" startIcon={<ArrowBackIcon />}>Back to Selection</Button>
            <Box sx={{ flex: 1 }} />
            <Button variant="outlined" startIcon={<VisibilityOutlinedIcon />} onClick={() => navigate('/production-planning/preview-order')}>
              Preview Orders
            </Button>
            <Button
              variant="contained" color="warning" startIcon={<SettingsSuggestIcon />} endIcon={<KeyboardArrowDownIcon />}
              onClick={() => navigate('/production-planning/generated-orders')}
            >
              Generate Orders
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
